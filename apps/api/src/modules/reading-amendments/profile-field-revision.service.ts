import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Expert } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpertService } from '../expert/expert.service';
import { evaluateReadingRequirements } from '../users/reading-intake-policy';
import { ReviewProfileFieldAmendmentDto } from './dto/profile-field-amendment.dto';
import {
  ProfileAmendmentRow,
  asRecord,
  nonEmptyString,
  staleAmendmentConflict,
} from './profile-field-amendment.shared';

@Injectable()
export class ProfileFieldRevisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expertService: ExpertService,
  ) {}

  async createRevision(
    orderId: string,
    amendmentId: string,
    expert: Expert,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    const rows = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
      SELECT * FROM "ReadingIntakeAmendment"
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "kind" = 'PROFILE_FIELDS'
      LIMIT 1
    `);
    const amendment = rows[0];
    if (!amendment) throw new NotFoundException('Complément introuvable');
    if (amendment.status !== 'APPROVED') {
      throw new ConflictException('Le complément doit être approuvé avant une révision');
    }
    if (amendment.revision !== dto.expectedRevision) throw staleAmendmentConflict();
    const amendmentData = asRecord(amendment.data);
    const snapshotId = nonEmptyString(amendmentData.snapshotId);
    if (!snapshotId) throw new ConflictException('Le snapshot approuvé est introuvable');
    if (nonEmptyString(amendmentData.revisionQueuedAt)) {
      throw new ConflictException('Une révision a déjà été lancée pour ce complément');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { clientInputs: true },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');
    const effective = asRecord(asRecord(order.clientInputs).readingIntakeEffective);
    if (nonEmptyString(effective.snapshotId) !== snapshotId) {
      throw new ConflictException('Le snapshot approuvé n’est plus la version effective');
    }
    const requirements = evaluateReadingRequirements(asRecord(effective.profile), {
      requireExplicitIntentionMode: false,
      strictIntentionExclusivity: true,
    });
    if (!requirements.complete || effective.requirementsComplete === false) {
      throw new ConflictException({
        code: 'READING_INTAKE_INCOMPLETE',
        message: 'Le dossier effectif doit contenir les cinq éléments obligatoires avant une révision.',
        missingFields: requirements.missingFields,
        invalidFields: requirements.invalidFields,
      });
    }

    const userPrompt =
      dto.reason?.trim() ||
      'Créer une révision corrective fondée uniquement sur le snapshot de dossier approuvé.';
    const result = await this.expertService.generateReading(orderId, expert);
    if (!result?.jobId) {
      throw new BadRequestException('La révision n’a pas pu être mise en attente');
    }

    const nextData = {
      ...amendmentData,
      revisionQueuedAt: new Date().toISOString(),
      revisionJobId: result.jobId,
      revisionRequestedByExpertId: expert.id,
      revisionInstructions: userPrompt,
      inputSnapshotId: snapshotId,
    };
    const updated = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "data" = ${JSON.stringify(nextData)}::JSONB,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "revision" = ${dto.expectedRevision}
        AND "status" = 'APPROVED'
        AND COALESCE("data"->>'revisionQueuedAt', '') = ''
      RETURNING *
    `);
    if (updated.length !== 1) throw staleAmendmentConflict();
    return {
      jobId: result.jobId,
      inputSnapshotId: snapshotId,
      amendmentRevision: updated[0].revision,
    };
  }
}
