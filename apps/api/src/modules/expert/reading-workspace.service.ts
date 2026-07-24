import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Expert, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfFactory, ReadingPdfData } from '../../services/factory/PdfFactory';
import { VertexOracle } from '../../services/factory/VertexOracle';
import { productLevelFromAmountCents } from '../../services/factory/product-level.util';
import { ExpertService } from './expert.service';
import { ProductionControlService } from './production-control.service';
import {
  assertReadingDeliverable,
  ReadingQualityReport,
  ReadingQualityValidator,
} from './reading-quality.validator';
import {
  buildGeneratedReadingVersion,
  CanonicalReadingContent,
  CanonicalReadingRitual,
  CanonicalReadingSection,
} from './reading-version';
import { ValidateContentDto } from './dto/validate-content.dto';
import {
  GenerateWorkspaceReadingDto,
  PatchReadingBlockDto,
  ReopenStructuredReadingDto,
  ReviseReadingBlockDto,
  SaveStructuredReadingDto,
  SealStructuredReadingDto,
} from './dto/reading-workspace.dto';

type JsonRecord = Record<string, unknown>;

type WorkspaceHistoryEvent = {
  id: string;
  at: string;
  type: string;
  label: string;
  detail?: string;
  version?: number;
  status?: string;
};

@Injectable()
export class ReadingWorkspaceService {
  private readonly quality = new ReadingQualityValidator();

  constructor(
    private readonly prisma: PrismaService,
    private readonly expertService: ExpertService,
    private readonly production: ProductionControlService,
    private readonly vertexOracle: VertexOracle,
    private readonly pdfFactory: PdfFactory,
  ) {}

  async getWorkspace(orderId: string) {
    const order = await this.expertService.getOrderById(orderId);
    const generated = this.asRecord(order.generatedContent);
    const reading = this.readCanonical(generated);
    const revision = this.readRevision(generated);
    const quality = reading ? this.quality.validate(reading) : null;
    const history = await this.buildHistory(orderId, generated);

    return {
      order,
      reading,
      revision,
      quality,
      history,
    };
  }

  async generate(orderId: string, dto: GenerateWorkspaceReadingDto, expert: Expert) {
    const priorities = dto.priorities?.filter(Boolean) ?? [];
    const tone = dto.tone ? `Style de restitution : ${dto.tone}` : '';
    const priorityText = priorities.length
      ? `Domaines prioritaires : ${priorities.join(', ')}`
      : '';
    const expertInstructions = [priorityText, tone].filter(Boolean).join('\n');

    return this.production.enqueueReading(orderId, expert, {
      expertPrompt: dto.orientation.trim(),
      expertInstructions: expertInstructions || undefined,
    });
  }

  async saveStructuredDraft(
    orderId: string,
    dto: SaveStructuredReadingDto,
    expert: Expert,
  ) {
    return this.persistReading(orderId, dto.content, dto.expectedRevision, expert.id, 'draft');
  }

  async patchBlock(
    orderId: string,
    blockId: string,
    dto: PatchReadingBlockDto,
    expert: Expert,
  ) {
    const { generated, reading, revision } = await this.loadEditableReading(orderId);
    this.assertRevision(dto.expectedRevision, revision);

    const next = this.clone(reading);
    this.setBlockValue(next, blockId, dto.value);
    return this.persistReadingFromLoaded(
      orderId,
      generated,
      next,
      revision,
      expert.id,
      `block:${blockId}`,
    );
  }

  async reviseBlock(
    orderId: string,
    blockId: string,
    dto: ReviseReadingBlockDto,
    expert: Expert,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande non trouvée');

    const { generated, reading, revision } = await this.loadEditableReading(orderId);
    this.assertRevision(dto.expectedRevision, revision);
    const current = this.getTextBlockValue(reading, blockId);
    if (!current) {
      throw new BadRequestException(
        'La correction assistée est disponible uniquement pour les blocs textuels.',
      );
    }

    const refined = await this.vertexOracle.refineContent(current, dto.instruction, {
      preserveStructure: false,
      maxTokens: 4096,
      routing: {
        orderId,
        productLevel: productLevelFromAmountCents(order.amount),
      },
    });

    const next = this.clone(reading);
    this.setBlockValue(next, blockId, refined.trim());
    return this.persistReadingFromLoaded(
      orderId,
      generated,
      next,
      revision,
      expert.id,
      `editor:${blockId}`,
    );
  }

  async repairSafeIssues(orderId: string, expert: Expert) {
    const { generated, reading, revision } = await this.loadEditableReading(orderId);
    const next = this.cleanDeterministically(reading);
    return this.persistReadingFromLoaded(
      orderId,
      generated,
      next,
      revision,
      expert.id,
      'safe-repair',
    );
  }

  async previewPdf(orderId: string): Promise<{ buffer: Buffer; filename: string }> {
    const order = await this.expertService.getOrderById(orderId);
    const reading = this.readCanonical(this.asRecord(order.generatedContent));
    if (!reading) throw new BadRequestException('Aucune lecture structurée à prévisualiser');
    assertReadingDeliverable(reading);

    const profile = order.user.profile;
    const data: ReadingPdfData = {
      userName: `${order.user.firstName} ${order.user.lastName}`.trim(),
      archetype: reading.synthesis.archetype,
      archetypeDescription: reading.pdf_content.archetype_reveal,
      keywords: reading.synthesis.keywords,
      introduction: reading.pdf_content.introduction,
      sections: reading.pdf_content.sections,
      karmicInsights: reading.pdf_content.karmic_insights,
      lifeMission: reading.pdf_content.life_mission,
      rituals: reading.pdf_content.rituals,
      conclusion: reading.pdf_content.conclusion,
      birthData: {
        date: profile?.birthDate ?? '',
        time: profile?.birthTime,
        place: profile?.birthPlace,
      },
      generatedAt: new Date().toISOString(),
    };

    const buffer = await this.pdfFactory.generatePdf('reading', data);
    return { buffer, filename: `${order.orderNumber}-apercu.pdf` };
  }

  async seal(orderId: string, dto: SealStructuredReadingDto, expert: Expert) {
    const order = await this.expertService.getOrderById(orderId);
    const reading = this.readCanonical(this.asRecord(order.generatedContent));
    if (!reading) throw new BadRequestException('Aucune lecture structurée à sceller');
    const report = this.quality.validate(reading);
    if (report.status === 'BLOCKED') {
      throw new BadRequestException({
        message: 'La lecture contient encore des défauts bloquants',
        quality: report,
      });
    }
    if (report.status === 'WARNING' && !dto.acknowledgeWarnings) {
      throw new BadRequestException({
        message: 'Confirmez explicitement les avertissements avant le scellement',
        quality: report,
      });
    }

    const validation: ValidateContentDto = {
      orderId,
      action: 'approve',
      validationNotes: dto.note,
    };
    return this.expertService.validateContent(validation, expert);
  }

  async reopen(orderId: string, dto: ReopenStructuredReadingDto, expert: Expert) {
    return this.expertService.reopenForRevision(orderId, expert, dto.reason);
  }

  async getHistory(orderId: string) {
    const order = await this.expertService.getOrderById(orderId);
    return {
      history: await this.buildHistory(orderId, this.asRecord(order.generatedContent)),
    };
  }

  private async persistReading(
    orderId: string,
    reading: CanonicalReadingContent,
    expectedRevision: number | undefined,
    expertId: string,
    action: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande non trouvée');
    const generated = this.asRecord(order.generatedContent);
    const revision = this.readRevision(generated);
    this.assertRevision(expectedRevision, revision);
    return this.persistReadingFromLoaded(
      orderId,
      generated,
      reading,
      revision,
      expertId,
      action,
    );
  }

  private async persistReadingFromLoaded(
    orderId: string,
    generated: JsonRecord,
    reading: CanonicalReadingContent,
    revision: number,
    expertId: string,
    action: string,
  ) {
    const quality = this.quality.validate(reading);
    const nextRevision = revision + 1;
    const existingPipeline = this.asRecord(generated.pipeline);
    const history = Array.isArray(generated.expertEditHistory)
      ? generated.expertEditHistory.slice(-49)
      : [];
    history.push({
      at: new Date().toISOString(),
      action,
      expertId,
      revision: nextRevision,
      qualityStatus: quality.status,
    });

    const payload: JsonRecord = {
      ...generated,
      ...reading,
      readingRevision: nextRevision,
      lastExpertEditAt: new Date().toISOString(),
      lastExpertEditBy: expertId,
      expertEditHistory: history,
      pipeline: {
        ...existingPipeline,
        qualityStatus: quality.status,
        blockingIssues: quality.blockingIssues,
        warnings: quality.warnings,
        metrics: quality.metrics,
      },
    };

    await this.prisma.order.update({
      where: { id: orderId },
      data: { generatedContent: payload as Prisma.InputJsonValue },
    });

    return { reading, revision: nextRevision, quality };
  }

  private async loadEditableReading(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande non trouvée');
    if (!['AWAITING_VALIDATION', 'FAILED'].includes(order.status)) {
      throw new BadRequestException(`Lecture non modifiable dans l’état ${order.status}`);
    }
    const generated = this.asRecord(order.generatedContent);
    const reading = this.readCanonical(generated);
    if (!reading) throw new BadRequestException('Lecture structurée absente');
    return { generated, reading, revision: this.readRevision(generated) };
  }

  private readCanonical(generated: JsonRecord): CanonicalReadingContent | null {
    if (!generated.pdf_content || !generated.synthesis) return null;
    try {
      return buildGeneratedReadingVersion(generated);
    } catch {
      return null;
    }
  }

  private readRevision(generated: JsonRecord): number {
    return typeof generated.readingRevision === 'number' ? generated.readingRevision : 0;
  }

  private assertRevision(expected: number | undefined, current: number) {
    if (expected !== undefined && expected !== current) {
      throw new ConflictException({
        message: 'La lecture a été modifiée ailleurs. Rechargez avant de poursuivre.',
        expectedRevision: expected,
        currentRevision: current,
      });
    }
  }

  private setBlockValue(reading: CanonicalReadingContent, blockId: string, value: unknown) {
    if (blockId === 'introduction') return this.assignString(reading.pdf_content, 'introduction', value);
    if (blockId === 'archetype_reveal') {
      return this.assignString(reading.pdf_content, 'archetype_reveal', value);
    }
    if (blockId === 'life_mission') return this.assignString(reading.pdf_content, 'life_mission', value);
    if (blockId === 'conclusion') return this.assignString(reading.pdf_content, 'conclusion', value);

    if (blockId.startsWith('section.')) {
      const domain = blockId.slice('section.'.length);
      const index = reading.pdf_content.sections.findIndex((section) => section.domain === domain);
      if (index < 0) throw new BadRequestException(`Section inconnue : ${domain}`);
      if (typeof value === 'string') {
        reading.pdf_content.sections[index].content = value;
      } else if (this.isRecord(value)) {
        const current = reading.pdf_content.sections[index];
        reading.pdf_content.sections[index] = {
          domain: current.domain,
          title: typeof value.title === 'string' ? value.title : current.title,
          content: typeof value.content === 'string' ? value.content : current.content,
        };
      } else {
        throw new BadRequestException('Valeur de section invalide');
      }
      return;
    }

    if (blockId.startsWith('insight.')) {
      const index = Number.parseInt(blockId.slice('insight.'.length), 10);
      if (!Number.isInteger(index) || index < 0 || index >= 4 || typeof value !== 'string') {
        throw new BadRequestException('Insight invalide');
      }
      reading.pdf_content.karmic_insights[index] = value;
      return;
    }

    if (blockId.startsWith('ritual.')) {
      const index = Number.parseInt(blockId.slice('ritual.'.length), 10);
      if (!Number.isInteger(index) || index < 0 || index >= 2 || !this.isRecord(value)) {
        throw new BadRequestException('Rituel invalide');
      }
      const ritual: CanonicalReadingRitual = {
        name: typeof value.name === 'string' ? value.name : '',
        description: typeof value.description === 'string' ? value.description : '',
        instructions: Array.isArray(value.instructions)
          ? value.instructions.filter((item): item is string => typeof item === 'string')
          : [],
      };
      reading.pdf_content.rituals[index] = ritual;
      return;
    }

    throw new BadRequestException(`Bloc inconnu : ${blockId}`);
  }

  private getTextBlockValue(reading: CanonicalReadingContent, blockId: string): string | null {
    if (blockId === 'introduction') return reading.pdf_content.introduction;
    if (blockId === 'archetype_reveal') return reading.pdf_content.archetype_reveal;
    if (blockId === 'life_mission') return reading.pdf_content.life_mission;
    if (blockId === 'conclusion') return reading.pdf_content.conclusion;
    if (blockId.startsWith('section.')) {
      return (
        reading.pdf_content.sections.find(
          (section) => section.domain === blockId.slice('section.'.length),
        )?.content ?? null
      );
    }
    if (blockId.startsWith('insight.')) {
      const index = Number.parseInt(blockId.slice('insight.'.length), 10);
      return reading.pdf_content.karmic_insights[index] ?? null;
    }
    return null;
  }

  private assignString(target: Record<string, unknown>, key: string, value: unknown) {
    if (typeof value !== 'string') throw new BadRequestException(`Le bloc ${key} doit être un texte`);
    target[key] = value;
  }

  private cleanDeterministically<T>(input: T): T {
    if (typeof input === 'string') {
      return input
        .replace(/```/g, '')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim() as T;
    }
    if (Array.isArray(input)) return input.map((item) => this.cleanDeterministically(item)) as T;
    if (this.isRecord(input)) {
      return Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, this.cleanDeterministically(value)]),
      ) as T;
    }
    return input;
  }

  private async buildHistory(orderId: string, generated: JsonRecord): Promise<WorkspaceHistoryEvent[]> {
    const events: WorkspaceHistoryEvent[] = [];
    const pipeline = this.asRecord(generated.pipeline);
    if (typeof pipeline.scribeCompletedAt === 'string') {
      events.push({
        id: 'pipeline-scribe',
        at: pipeline.scribeCompletedAt,
        type: 'SCRIBE',
        label: 'Lecture générée par SCRIBE',
        status: typeof pipeline.qualityStatus === 'string' ? pipeline.qualityStatus : undefined,
      });
    }
    if (typeof pipeline.editorCompletedAt === 'string') {
      events.push({
        id: 'pipeline-editor',
        at: pipeline.editorCompletedAt,
        type: 'EDITOR',
        label: 'Correction éditoriale automatique',
        status: typeof pipeline.qualityStatus === 'string' ? pipeline.qualityStatus : undefined,
      });
    }

    if (Array.isArray(generated.expertEditHistory)) {
      generated.expertEditHistory.forEach((entry, index) => {
        if (!this.isRecord(entry) || typeof entry.at !== 'string') return;
        events.push({
          id: `edit-${index}-${entry.at}`,
          at: entry.at,
          type: 'EXPERT_EDIT',
          label: 'Modification experte',
          detail: typeof entry.action === 'string' ? entry.action : undefined,
          version: typeof entry.revision === 'number' ? entry.revision : undefined,
          status: typeof entry.qualityStatus === 'string' ? entry.qualityStatus : undefined,
        });
      });
    }

    try {
      const versions = await this.expertService.getContentVersions(orderId);
      for (const [index, version] of (versions.versions ?? []).entries()) {
        events.push({
          id: `legacy-version-${index}`,
          at: version.timestamp,
          type: 'DRAFT_VERSION',
          label: 'Version de travail enregistrée',
          detail: version.action,
        });
      }
    } catch {
      // Legacy history is best-effort only.
    }

    try {
      const deliveries = await this.expertService.listOrderDeliveries(orderId);
      for (const delivery of deliveries.deliveries ?? []) {
        events.push({
          id: `delivery-${delivery.id}`,
          at: delivery.sealedAt ?? delivery.createdAt,
          type: 'DELIVERY',
          label: `PDF version ${delivery.version} livré`,
          version: delivery.version,
          status: delivery.emailStatus,
        });
      }
    } catch {
      // Delivery history may not exist before the first seal.
    }

    return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private asRecord(value: unknown): JsonRecord {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
