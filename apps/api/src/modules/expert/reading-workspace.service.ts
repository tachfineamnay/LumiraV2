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
import { ValidateContentDto } from './dto/validate-content.dto';
import {
  GenerateWorkspaceReadingDto,
  PatchReadingBlockDto,
  ReopenStructuredReadingDto,
  RestoreReadingBlockDto,
  ReviseReadingBlockDto,
  SaveStructuredReadingDto,
  SealStructuredReadingDto,
} from './dto/reading-workspace.dto';
import { ExpertService } from './expert.service';
import { ProductionControlService } from './production-control.service';
import {
  assertReadingDeliverable,
  ReadingQualityValidator,
} from './reading-quality.validator';
import {
  buildGeneratedReadingVersion,
  CanonicalReadingContent,
  CanonicalReadingRitual,
} from './reading-version';

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

type BlockSnapshot = {
  at: string;
  expertId: string;
  value: unknown;
};

type BlockVersions = Record<string, BlockSnapshot[]>;

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
    const generated = this.toRecord(order.generatedContent);
    const reading = this.readCanonical(generated);
    const blockVersions = this.readBlockVersions(generated);

    return {
      order,
      reading,
      revision: this.readRevision(generated),
      quality: reading ? this.quality.validate(reading) : null,
      restorableBlocks: Object.entries(blockVersions)
        .filter(([, versions]) => versions.length > 0)
        .map(([blockId]) => blockId),
      history: await this.buildHistory(orderId, generated),
    };
  }

  async generate(orderId: string, dto: GenerateWorkspaceReadingDto, expert: Expert) {
    const priorities = dto.priorities?.filter(Boolean) ?? [];
    const instructions = [
      priorities.length ? `Domaines prioritaires : ${priorities.join(', ')}` : '',
      dto.tone ? `Style de restitution : ${dto.tone}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return this.production.enqueueReading(orderId, expert, {
      expertPrompt: dto.orientation.trim(),
      expertInstructions: instructions || undefined,
    });
  }

  async saveStructuredDraft(
    orderId: string,
    dto: SaveStructuredReadingDto,
    expert: Expert,
  ) {
    const state = await this.loadEditable(orderId);
    this.assertRevision(dto.expectedRevision, state.revision);
    return this.persist(
      orderId,
      state.generated,
      dto.content,
      state.revision,
      expert.id,
      'draft',
    );
  }

  async patchBlock(
    orderId: string,
    blockId: string,
    dto: PatchReadingBlockDto,
    expert: Expert,
  ) {
    const state = await this.loadEditable(orderId);
    this.assertRevision(dto.expectedRevision, state.revision);
    const previousValue = this.getBlockValue(state.reading, blockId);
    const next = this.clone(state.reading);
    this.setBlock(next, blockId, dto.value);
    return this.persist(
      orderId,
      state.generated,
      next,
      state.revision,
      expert.id,
      `block:${blockId}`,
      { blockId, value: previousValue },
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

    const state = await this.loadEditable(orderId);
    this.assertRevision(dto.expectedRevision, state.revision);
    const current = this.getTextBlock(state.reading, blockId);
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

    const next = this.clone(state.reading);
    this.setBlock(next, blockId, refined.trim());
    return this.persist(
      orderId,
      state.generated,
      next,
      state.revision,
      expert.id,
      `editor:${blockId}`,
      { blockId, value: this.getBlockValue(state.reading, blockId) },
    );
  }

  async restoreBlock(
    orderId: string,
    blockId: string,
    dto: RestoreReadingBlockDto,
    expert: Expert,
  ) {
    const state = await this.loadEditable(orderId);
    this.assertRevision(dto.expectedRevision, state.revision);
    const versions = this.readBlockVersions(state.generated);
    const history = versions[blockId] ?? [];
    const snapshot = history.at(-1);
    if (!snapshot) {
      throw new BadRequestException('Aucune version précédente disponible pour ce bloc');
    }

    const next = this.clone(state.reading);
    this.setBlock(next, blockId, this.clone(snapshot.value));
    const remaining = history.slice(0, -1);
    const nextBlockVersions: BlockVersions = { ...versions };
    if (remaining.length > 0) nextBlockVersions[blockId] = remaining;
    else delete nextBlockVersions[blockId];

    return this.persist(
      orderId,
      { ...state.generated, blockVersions: nextBlockVersions },
      next,
      state.revision,
      expert.id,
      `restore:${blockId}`,
    );
  }

  async repairSafeIssues(orderId: string, expert: Expert) {
    const state = await this.loadEditable(orderId);
    return this.persist(
      orderId,
      state.generated,
      this.clean(state.reading),
      state.revision,
      expert.id,
      'safe-repair',
    );
  }

  async previewPdf(orderId: string): Promise<{ buffer: Buffer; filename: string }> {
    const order = await this.expertService.getOrderById(orderId);
    const reading = this.readCanonical(this.toRecord(order.generatedContent));
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

    return {
      buffer: await this.pdfFactory.generatePdf('reading', data),
      filename: `${order.orderNumber}-apercu.pdf`,
    };
  }

  async seal(orderId: string, dto: SealStructuredReadingDto, expert: Expert) {
    const order = await this.expertService.getOrderById(orderId);
    const reading = this.readCanonical(this.toRecord(order.generatedContent));
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
      history: await this.buildHistory(orderId, this.toRecord(order.generatedContent)),
    };
  }

  private async loadEditable(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande non trouvée');
    if (!['AWAITING_VALIDATION', 'FAILED'].includes(order.status)) {
      throw new BadRequestException(`Lecture non modifiable dans l’état ${order.status}`);
    }

    const generated = this.toRecord(order.generatedContent);
    const reading = this.readCanonical(generated);
    if (!reading) throw new BadRequestException('Lecture structurée absente');

    return {
      generated,
      reading,
      revision: this.readRevision(generated),
    };
  }

  private async persist(
    orderId: string,
    generated: JsonRecord,
    reading: CanonicalReadingContent,
    revision: number,
    expertId: string,
    action: string,
    snapshot?: { blockId: string; value: unknown },
  ) {
    reading.lecture = this.buildCanonicalLecture(reading);
    const quality = this.quality.validate(reading);
    const nextRevision = revision + 1;
    const priorHistory = Array.isArray(generated.expertEditHistory)
      ? generated.expertEditHistory.slice(-49)
      : [];
    const expertEditHistory = [
      ...priorHistory,
      {
        at: new Date().toISOString(),
        action,
        expertId,
        revision: nextRevision,
        qualityStatus: quality.status,
      },
    ];
    const pipeline = this.toRecord(generated.pipeline);
    const blockVersions = this.readBlockVersions(generated);
    if (snapshot) {
      const priorVersions = blockVersions[snapshot.blockId] ?? [];
      blockVersions[snapshot.blockId] = [
        ...priorVersions,
        {
          at: new Date().toISOString(),
          expertId,
          value: this.clone(snapshot.value),
        },
      ].slice(-5);
    }

    const payload: JsonRecord = {
      ...generated,
      ...reading,
      readingRevision: nextRevision,
      blockVersions,
      lastExpertEditAt: new Date().toISOString(),
      lastExpertEditBy: expertId,
      expertEditHistory,
      pipeline: {
        ...pipeline,
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

    return {
      reading,
      revision: nextRevision,
      quality,
      restorableBlocks: Object.entries(blockVersions)
        .filter(([, versions]) => versions.length > 0)
        .map(([blockId]) => blockId),
    };
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

  private readBlockVersions(generated: JsonRecord): BlockVersions {
    if (!this.isRecord(generated.blockVersions)) return {};
    const result: BlockVersions = {};
    for (const [blockId, rawVersions] of Object.entries(generated.blockVersions)) {
      if (!Array.isArray(rawVersions)) continue;
      const versions = rawVersions
        .filter((entry): entry is JsonRecord => this.isRecord(entry))
        .filter(
          (entry) => typeof entry.at === 'string' && typeof entry.expertId === 'string',
        )
        .map((entry) => ({
          at: entry.at as string,
          expertId: entry.expertId as string,
          value: entry.value,
        }));
      if (versions.length > 0) result[blockId] = versions.slice(-5);
    }
    return result;
  }

  private assertRevision(expected: number | undefined, current: number) {
    if (expected === undefined || expected === current) return;
    throw new ConflictException({
      message: 'La lecture a été modifiée ailleurs. Rechargez avant de poursuivre.',
      expectedRevision: expected,
      currentRevision: current,
    });
  }

  private setBlock(reading: CanonicalReadingContent, blockId: string, value: unknown) {
    if (blockId === 'introduction') {
      reading.pdf_content.introduction = this.requireString(value, blockId);
      return;
    }
    if (blockId === 'archetype_reveal') {
      reading.pdf_content.archetype_reveal = this.requireString(value, blockId);
      return;
    }
    if (blockId === 'life_mission') {
      reading.pdf_content.life_mission = this.requireString(value, blockId);
      return;
    }
    if (blockId === 'conclusion') {
      reading.pdf_content.conclusion = this.requireString(value, blockId);
      return;
    }

    if (blockId.startsWith('section.')) {
      const domain = blockId.slice('section.'.length);
      const index = reading.pdf_content.sections.findIndex((section) => section.domain === domain);
      if (index < 0) throw new BadRequestException(`Section inconnue : ${domain}`);
      const current = reading.pdf_content.sections[index];
      if (typeof value === 'string') {
        current.content = value;
        return;
      }
      if (!this.isRecord(value)) throw new BadRequestException('Valeur de section invalide');
      reading.pdf_content.sections[index] = {
        domain: current.domain,
        title: typeof value.title === 'string' ? value.title : current.title,
        content: typeof value.content === 'string' ? value.content : current.content,
      };
      return;
    }

    if (blockId.startsWith('insight.')) {
      const index = this.indexFromBlock(blockId, 'insight.', 4);
      reading.pdf_content.karmic_insights[index] = this.requireString(value, blockId);
      return;
    }

    if (blockId.startsWith('ritual.')) {
      const index = this.indexFromBlock(blockId, 'ritual.', 2);
      if (!this.isRecord(value)) throw new BadRequestException('Rituel invalide');
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

  private getBlockValue(reading: CanonicalReadingContent, blockId: string): unknown {
    if (blockId === 'introduction') return reading.pdf_content.introduction;
    if (blockId === 'archetype_reveal') return reading.pdf_content.archetype_reveal;
    if (blockId === 'life_mission') return reading.pdf_content.life_mission;
    if (blockId === 'conclusion') return reading.pdf_content.conclusion;
    if (blockId.startsWith('section.')) {
      const section = reading.pdf_content.sections.find(
        (candidate) => candidate.domain === blockId.slice('section.'.length),
      );
      if (!section) throw new BadRequestException(`Bloc inconnu : ${blockId}`);
      return this.clone(section);
    }
    if (blockId.startsWith('insight.')) {
      return reading.pdf_content.karmic_insights[this.indexFromBlock(blockId, 'insight.', 4)];
    }
    if (blockId.startsWith('ritual.')) {
      return this.clone(
        reading.pdf_content.rituals[this.indexFromBlock(blockId, 'ritual.', 2)],
      );
    }
    throw new BadRequestException(`Bloc inconnu : ${blockId}`);
  }

  private getTextBlock(reading: CanonicalReadingContent, blockId: string): string | null {
    const value = this.getBlockValue(reading, blockId);
    if (typeof value === 'string') return value;
    if (this.isRecord(value) && typeof value.content === 'string') return value.content;
    return null;
  }

  private indexFromBlock(blockId: string, prefix: string, max: number): number {
    const index = Number.parseInt(blockId.slice(prefix.length), 10);
    if (!Number.isInteger(index) || index < 0 || index >= max) {
      throw new BadRequestException(`Index de bloc invalide : ${blockId}`);
    }
    return index;
  }

  private requireString(value: unknown, blockId: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`Le bloc ${blockId} doit être un texte`);
    }
    return value;
  }

  private buildCanonicalLecture(reading: CanonicalReadingContent): string {
    const pdf = reading.pdf_content;
    const rituals = pdf.rituals.flatMap((ritual) => [
      ritual.name,
      ritual.description,
      ...ritual.instructions.map((instruction, index) => `${index + 1}. ${instruction}`),
    ]);
    return [
      pdf.introduction,
      pdf.archetype_reveal,
      ...pdf.sections.flatMap((section) => [section.title, section.content]),
      ...pdf.karmic_insights,
      pdf.life_mission,
      ...rituals,
      pdf.conclusion,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join('\n\n');
  }

  private clean<T>(value: T): T {
    if (typeof value === 'string') {
      return value
        .replace(/```/g, '')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim() as T;
    }
    if (Array.isArray(value)) return value.map((item) => this.clean(item)) as T;
    if (this.isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.clean(item)]),
      ) as T;
    }
    return value;
  }

  private async buildHistory(
    orderId: string,
    generated: JsonRecord,
  ): Promise<WorkspaceHistoryEvent[]> {
    const events: WorkspaceHistoryEvent[] = [];
    const pipeline = this.toRecord(generated.pipeline);

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

    const versions = await this.expertService.getContentVersions(orderId);
    versions.versions.forEach((version, index) => {
      events.push({
        id: `draft-${index}-${version.timestamp}`,
        at: version.timestamp,
        type: 'DRAFT_VERSION',
        label: 'Version de travail enregistrée',
        detail: version.action,
      });
    });

    const deliveries = await this.expertService.listOrderDeliveries(orderId);
    deliveries.deliveries.forEach((delivery) => {
      events.push({
        id: `delivery-${delivery.id}`,
        at: delivery.sealedAt ?? delivery.createdAt,
        type: 'DELIVERY',
        label: `PDF version ${delivery.version} livré`,
        version: delivery.version,
        status: delivery.emailStatus,
      });
    });

    return events.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private toRecord(value: unknown): JsonRecord {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
