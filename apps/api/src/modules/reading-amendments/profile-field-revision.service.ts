import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Expert, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpertService } from '../expert/expert.service';
import { ReviewProfileFieldAmendmentDto } from './dto/profile-field-amendment.dto';
import {
  parseProfileFields,
  profileFieldLabels,
  publicProfileFields,
} from './profile-field-catalog';

interface ApprovedProfileFieldAmendmentRow {
  id: string;
  orderId: string;
  status: string;
  requestedFields: string[];
  data: Prisma.JsonValue;
  revision: number;
}

const REVISION_MARKER = '[COMPLEMENT_INFORMATIONS_OBLIGATOIRES_APPROUVE]';

/**
 * Isolates the optional production side effect from the collection workflow.
 * Approval only updates the effective input snapshot; generation still needs
 * this explicit expert action.
 */
@Injectable()
export class ProfileFieldRevisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expertService: ExpertService,
  ) {}

  async create(
    orderId: string,
    amendmentId: string,
    expert: Expert,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    const amendment = await this.getApproved(orderId, amendmentId);
    if (amendment.revision !== dto.expectedRevision) throw this.staleConflict();

    const data = this.asRecord(amendment.data);
    if (this.nonEmptyString(data.revisionQueuedAt)) {
      throw new ConflictException('Cette révision a déjà été lancée');
    }
    const snapshotId = this.nonEmptyString(data.snapshotId);
    if (!snapshotId) throw new ConflictException('Le snapshot effectif est introuvable');

    let order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, expertInstructions: true, clientInputs: true },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');

    if (order.status === 'COMPLETED') {
      await this.expertService.reopenForRevision(
        orderId,
        expert,
        dto.reason?.trim() || 'Informations obligatoires complétées',
      );
      order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, expertInstructions: true, clientInputs: true },
      });
    }
    if (!order || order.status !== 'AWAITING_VALIDATION') {
      throw new ConflictException(
        `La lecture ne peut pas être révisée dans son état actuel (${order?.status ?? 'inconnu'})`,
      );
    }

    const effective = this.asRecord(this.asRecord(order.clientInputs).readingIntakeEffective);
    if (this.nonEmptyString(effective.snapshotId) !== snapshotId) {
      throw new ConflictException('Le complément approuvé n’est plus le snapshot effectif courant');
    }

    const workingVersion = await this.prisma.readingVersion.findFirst({
      where: { orderId, status: 'REOPENED' },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (!workingVersion) {
      throw new ConflictException('La version de travail réouverte est introuvable');
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ReadingVersion"
      SET "inputSnapshotId" = ${snapshotId}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${workingVersion.id} AND "orderId" = ${orderId}
    `);

    const visibleFields = publicProfileFields(parseProfileFields(amendment.requestedFields));
    const instruction = `${REVISION_MARKER}\nConserve les éléments valides de la lecture précédente. Intègre uniquement les informations approuvées suivantes : ${profileFieldLabels(visibleFields).join(', ')}. Révise seulement les passages réellement concernés.`;
    const currentInstructions = order.expertInstructions?.trim() || '';
    const nextInstructions = currentInstructions.includes(REVISION_MARKER)
      ? currentInstructions
      : [currentInstructions, instruction].filter(Boolean).join('\n\n');
    await this.prisma.order.update({
      where: { id: orderId },
      data: { expertInstructions: nextInstructions },
    });

    const generation = await this.expertService.generateReading(orderId, expert);
    const queuedAt = new Date().toISOString();
    const nextData = {
      ...data,
      revisionQueuedAt: queuedAt,
      revisionRequestedByExpertId: expert.id,
      workingReadingVersionId: workingVersion.id,
      generation,
    };
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "data" = ${JSON.stringify(nextData)}::JSONB,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "kind" = 'PROFILE_FIELDS'
        AND "revision" = ${dto.expectedRevision}
        AND "status" = 'APPROVED'
        AND COALESCE("data"->>'revisionQueuedAt', '') = ''
      RETURNING "id"
    `);
    if (rows.length !== 1) throw this.staleConflict();

    return {
      success: true,
      orderId,
      snapshotId,
      workingReadingVersionId: workingVersion.id,
      generation,
    };
  }

  private async getApproved(
    orderId: string,
    amendmentId: string,
  ): Promise<ApprovedProfileFieldAmendmentRow> {
    const rows = await this.prisma.$queryRaw<ApprovedProfileFieldAmendmentRow[]>(Prisma.sql`
      SELECT "id", "orderId", "status", "requestedFields", "data", "revision"
      FROM "ReadingIntakeAmendment"
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "kind" = 'PROFILE_FIELDS'
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) throw new NotFoundException('Demande de complément introuvable');
    if (row.status !== 'APPROVED') {
      throw new ConflictException('Les informations doivent être approuvées avant la révision');
    }
    return row;
  }

  private staleConflict(): ConflictException {
    return new ConflictException({
      code: 'AMENDMENT_REVISION_CHANGED',
      message: 'La demande a changé. Rechargez-la avant de continuer.',
    });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private nonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
