import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  READING_REQUIREMENTS_VERSION,
  RequiredReadingField,
  evaluateReadingRequirements,
} from '../users/reading-intake-policy';
import { ReviewProfileFieldAmendmentDto } from './dto/profile-field-amendment.dto';
import {
  expandProfileAmendmentValues,
  parseProfileFields,
  profileFieldLabels,
  publicProfileFields,
} from './profile-field-catalog';
import { ProfileFieldAmendmentClientService } from './profile-field-amendment-client.service';
import {
  ACTIVE_PROFILE_AMENDMENT_STATUSES,
  AmendmentPhotoKind,
  ProfileAmendmentRow,
  asRecord,
  hashCanonicalJson,
  nonEmptyString,
  persistablePreparedAsset,
  persistablePreparedAssets,
  resolveOriginalInput,
  staleAmendmentConflict,
  stringArray,
  toPublicProfileAmendment,
} from './profile-field-amendment.shared';

@Injectable()
export class ProfileFieldAmendmentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ProfileFieldAmendmentClientService,
  ) {}

  async approve(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    const amendment = await this.getForOrder(amendmentId, orderId);
    if (amendment.status === 'APPROVED') {
      const data = asRecord(amendment.data);
      const snapshotId = nonEmptyString(data.snapshotId);
      return {
        amendment: toPublicProfileAmendment(amendment),
        snapshot: snapshotId
          ? {
              id: snapshotId,
              revision:
                typeof data.snapshotRevision === 'number'
                  ? data.snapshotRevision
                  : amendment.revision,
              contentHash: nonEmptyString(data.snapshotContentHash) ?? '',
              amendmentIds: [amendment.id],
              requirementsComplete: data.requirementsComplete === true,
              missingFields: stringArray(data.missingFields) as RequiredReadingField[],
              invalidFields: stringArray(data.invalidFields) as RequiredReadingField[],
            }
          : undefined,
      };
    }
    this.assertReviewable(amendment, dto.expectedRevision);
    const fields = parseProfileFields(amendment.requestedFields);
    const values = await this.client.sanitizeValues(
      amendment.userId,
      fields,
      asRecord(asRecord(amendment.data).values),
      true,
    );
    const assets = await this.client.prepareAssets(amendment.userId, fields, values);
    const currentSubmissionHash = hashCanonicalJson({
      amendmentId,
      kind: 'PROFILE_FIELDS',
      requestedFields: fields,
      values,
      faceSha256: assets.face?.sha256 ?? null,
      palmSha256: assets.palm?.sha256 ?? null,
    });
    if (!amendment.contentHash || amendment.contentHash !== currentSubmissionHash) {
      throw new ConflictException(
        'Les informations ou les photos ont changé depuis leur transmission',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const currentRows = await tx.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
          SELECT *
          FROM "ReadingIntakeAmendment"
          WHERE "id" = ${amendmentId}
            AND "orderId" = ${orderId}
            AND "kind" = 'PROFILE_FIELDS'
          FOR UPDATE
        `);
        const current = currentRows[0];
        if (!current) throw new NotFoundException('Demande de complément introuvable');
        this.assertReviewable(current, dto.expectedRevision);
        if (current.contentHash !== amendment.contentHash) {
          throw new ConflictException('Les informations ont changé pendant leur validation');
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            userId: true,
            orderNumber: true,
            clientInputs: true,
            readingIntake: {
              select: {
                id: true,
                status: true,
                data: true,
                contentHash: true,
                sealedAt: true,
              },
            },
          },
        });
        if (!order || order.userId !== current.userId) {
          throw new ConflictException('La demande ne correspond plus à cette commande');
        }

        const clientInputs = asRecord(order.clientInputs);
        const original = resolveOriginalInput(clientInputs, order.readingIntake);
        const previousEffective = asRecord(clientInputs.readingIntakeEffective);
        const base = Object.keys(previousEffective).length > 0 ? previousEffective : original;
        const profile = asRecord(base.profile);
        const baseAssets = asRecord(base.assets);
        const nextProfile = {
          ...profile,
          ...expandProfileAmendmentValues(values),
        };
        const nextAssets = {
          ...baseAssets,
          ...(assets.face ? { face: persistablePreparedAsset(assets.face) } : {}),
          ...(assets.palm ? { palm: persistablePreparedAsset(assets.palm) } : {}),
        };
        const requirements = evaluateReadingRequirements(nextProfile, {
          requireExplicitIntentionMode: false,
          strictIntentionExclusivity: true,
          facePhotoStatus: nextAssets.face ? 'VALID' : undefined,
          palmPhotoStatus: nextAssets.palm ? 'VALID' : undefined,
        });

        const revisionRows = await tx.$queryRaw<Array<{ revision: number }>>(Prisma.sql`
          SELECT (COALESCE(MAX("revision"), 0) + 1)::INTEGER AS "revision"
          FROM "ReadingInputSnapshot"
          WHERE "orderId" = ${orderId}
        `);
        const nextRevision = revisionRows[0]?.revision ?? 1;
        const snapshotId = `ris_${randomUUID()}`;
        const parentSnapshotId = nonEmptyString(previousEffective.snapshotId);
        const amendmentIds = Array.from(new Set([...stringArray(base.amendmentIds), amendmentId]));
        const effectiveAt = new Date();
        const {
          snapshotId: _previousSnapshotId,
          contentHash: _previousContentHash,
          ...baseWithoutIdentity
        } = base;
        void _previousSnapshotId;
        void _previousContentHash;
        const snapshotCore = {
          ...baseWithoutIdentity,
          version: '2026-08-05-effective-intake-v2',
          requirementsVersion: READING_REQUIREMENTS_VERSION,
          revision: nextRevision,
          effectiveAt: effectiveAt.toISOString(),
          parentSnapshotId,
          parentContentHash: nonEmptyString(base.contentHash),
          baseIntakeContentHash:
            nonEmptyString(original.contentHash) ?? order.readingIntake?.contentHash ?? null,
          profile: nextProfile,
          assets: nextAssets,
          amendmentIds,
          requirementsComplete: requirements.complete,
          missingFields: requirements.missingFields,
          invalidFields: requirements.invalidFields,
        };
        const snapshotHash = hashCanonicalJson(snapshotCore);
        const effectiveSnapshot = {
          ...snapshotCore,
          snapshotId,
          contentHash: snapshotHash,
        };

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "ReadingInputSnapshot" (
            "id", "orderId", "userId", "baseIntakeId", "revision",
            "parentSnapshotId", "data", "contentHash", "amendmentIds", "createdAt"
          ) VALUES (
            ${snapshotId}, ${orderId}, ${order.userId}, ${order.readingIntake?.id ?? null},
            ${nextRevision}, ${parentSnapshotId}, ${JSON.stringify(effectiveSnapshot)}::JSONB,
            ${snapshotHash}, ARRAY[${Prisma.join(amendmentIds)}]::TEXT[], ${effectiveAt}
          )
        `);

        const approvedData = {
          ...asRecord(current.data),
          values,
          ...persistablePreparedAssets(assets),
          approvedAt: effectiveAt.toISOString(),
          reviewReason: dto.reason?.trim() || null,
          snapshotId,
          snapshotRevision: nextRevision,
          snapshotContentHash: snapshotHash,
          requirementsComplete: requirements.complete,
          missingFields: requirements.missingFields,
          invalidFields: requirements.invalidFields,
        };
        const approvedHash = hashCanonicalJson({
          amendmentId,
          fields,
          values,
          faceSha256: assets.face?.sha256 ?? null,
          palmSha256: assets.palm?.sha256 ?? null,
          snapshotId,
          snapshotContentHash: snapshotHash,
        });
        const updated = await tx.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
          UPDATE "ReadingIntakeAmendment"
          SET "status" = 'APPROVED',
              "data" = ${JSON.stringify(approvedData)}::JSONB,
              "contentHash" = ${approvedHash},
              "reviewedByExpertId" = ${expertId},
              "reviewedAt" = ${effectiveAt},
              "revision" = "revision" + 1,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${amendmentId}
            AND "orderId" = ${orderId}
            AND "kind" = 'PROFILE_FIELDS'
            AND "revision" = ${dto.expectedRevision}
            AND "status" = 'SUBMITTED'
          RETURNING *
        `);
        if (updated.length !== 1) throw staleAmendmentConflict();

        await tx.order.update({
          where: { id: orderId },
          data: {
            clientInputs: {
              ...clientInputs,
              readingIntake: original,
              readingIntakeEffective: effectiveSnapshot,
            } as Prisma.InputJsonValue,
          },
        });

        await tx.notification.create({
          data: {
            userId: order.userId,
            type: 'SYSTEM',
            title: requirements.complete
              ? 'Votre dossier est maintenant complet'
              : 'Vos informations ont été validées',
            message: requirements.complete
              ? 'Votre expert a validé les informations demandées. Votre dossier contient désormais tous les éléments obligatoires.'
              : 'Votre expert a validé les informations demandées. D’autres éléments restent nécessaires avant la production.',
            metadata: {
              event: 'READING_PROFILE_FIELDS_APPROVED',
              amendmentId,
              orderId,
              orderNumber: order.orderNumber,
              snapshotId,
              requestedFields: publicProfileFields(fields),
              requirementsComplete: requirements.complete,
              missingFields: requirements.missingFields,
              invalidFields: requirements.invalidFields,
            },
          },
        });

        return {
          amendment: toPublicProfileAmendment(updated[0]),
          snapshot: {
            id: snapshotId,
            revision: nextRevision,
            contentHash: snapshotHash,
            amendmentIds,
            requirementsComplete: requirements.complete,
            missingFields: requirements.missingFields,
            invalidFields: requirements.invalidFields,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async reject(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    const amendment = await this.getForOrder(amendmentId, orderId);
    this.assertReviewable(amendment, dto.expectedRevision);
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Le motif du refus est requis');
    const nextData = {
      ...asRecord(amendment.data),
      reviewReason: reason,
      rejectedAt: new Date().toISOString(),
    };
    const rows = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'REJECTED',
          "data" = ${JSON.stringify(nextData)}::JSONB,
          "reviewedByExpertId" = ${expertId},
          "reviewedAt" = CURRENT_TIMESTAMP,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "kind" = 'PROFILE_FIELDS'
        AND "revision" = ${dto.expectedRevision}
        AND "status" = 'SUBMITTED'
      RETURNING *
    `);
    if (rows.length !== 1) throw staleAmendmentConflict();
    await this.notify(amendment.userId, {
      title: 'Informations refusées',
      message: reason,
      event: 'READING_PROFILE_FIELDS_REJECTED',
      amendmentId,
      orderId,
    });
    return toPublicProfileAmendment(rows[0]);
  }

  async requestRetake(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    const amendment = await this.getForOrder(amendmentId, orderId);
    if (!['SUBMITTED', 'REJECTED'].includes(amendment.status)) {
      throw new ConflictException('Cette demande ne peut pas être rouverte');
    }
    if (amendment.revision !== dto.expectedRevision) throw staleAmendmentConflict();
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Le motif de reprise est requis');
    const previousData = asRecord(amendment.data);
    const fields = parseProfileFields(amendment.requestedFields);
    const nextData = {
      schemaVersion: READING_REQUIREMENTS_VERSION,
      fieldLabels: previousData.fieldLabels ?? profileFieldLabels(publicProfileFields(fields)),
      previousValues: previousData.previousValues ?? {},
      invalidFields: previousData.invalidFields ?? [],
      previousSubmission: previousData,
      values: {},
      retakeReason: reason,
      retakeRequestedAt: new Date().toISOString(),
      retakeRequestedByExpertId: expertId,
    };
    const rows = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'REQUESTED',
          "data" = ${JSON.stringify(nextData)}::JSONB,
          "contentHash" = NULL,
          "submittedAt" = NULL,
          "reviewedByExpertId" = ${expertId},
          "reviewedAt" = CURRENT_TIMESTAMP,
          "expiresAt" = GREATEST("expiresAt", CURRENT_TIMESTAMP + INTERVAL '7 days'),
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "kind" = 'PROFILE_FIELDS'
        AND "revision" = ${dto.expectedRevision}
        AND "status" IN ('SUBMITTED', 'REJECTED')
      RETURNING *
    `);
    if (rows.length !== 1) throw staleAmendmentConflict();
    await this.notify(amendment.userId, {
      title: 'Informations à corriger',
      message: reason,
      event: 'READING_PROFILE_FIELDS_RETAKE_REQUESTED',
      amendmentId,
      orderId,
    });
    return toPublicProfileAmendment(rows[0]);
  }

  async cancel(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    const amendment = await this.getForOrder(amendmentId, orderId);
    if (!ACTIVE_PROFILE_AMENDMENT_STATUSES.includes(amendment.status)) {
      throw new ConflictException('Seule une demande ouverte peut être annulée');
    }
    if (amendment.revision !== dto.expectedRevision) throw staleAmendmentConflict();
    const nextData = {
      ...asRecord(amendment.data),
      cancelReason: dto.reason?.trim() || 'CANCELLED_BY_EXPERT',
      cancelledByExpertId: expertId,
      cancelledAt: new Date().toISOString(),
    };
    const rows = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'CANCELLED',
          "data" = ${JSON.stringify(nextData)}::JSONB,
          "reviewedByExpertId" = ${expertId},
          "reviewedAt" = CURRENT_TIMESTAMP,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "kind" = 'PROFILE_FIELDS'
        AND "revision" = ${dto.expectedRevision}
        AND "status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')
      RETURNING *
    `);
    if (rows.length !== 1) throw staleAmendmentConflict();
    return toPublicProfileAmendment(rows[0]);
  }

  async getPhotoReference(options: {
    amendmentId: string;
    kind: AmendmentPhotoKind;
    userId?: string;
    orderId?: string;
  }): Promise<{ userId: string; storageRef: string }> {
    let rows: ProfileAmendmentRow[];
    if (options.userId) {
      rows = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
        SELECT * FROM "ReadingIntakeAmendment"
        WHERE "id" = ${options.amendmentId}
          AND "userId" = ${options.userId}
          AND "kind" = 'PROFILE_FIELDS'
        LIMIT 1
      `);
    } else if (options.orderId) {
      rows = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
        SELECT * FROM "ReadingIntakeAmendment"
        WHERE "id" = ${options.amendmentId}
          AND "orderId" = ${options.orderId}
          AND "kind" = 'PROFILE_FIELDS'
        LIMIT 1
      `);
    } else {
      throw new ForbiddenException('Périmètre photo manquant');
    }
    const row = rows[0];
    if (!row) throw new NotFoundException('Complément introuvable');
    const values = asRecord(asRecord(row.data).values);
    const storageRef = nonEmptyString(
      options.kind === 'face' ? values.facePhotoUrl : values.palmPhotoUrl,
    );
    if (!storageRef) throw new NotFoundException('Photo de complément introuvable');
    return { userId: row.userId, storageRef };
  }

  private async getForOrder(id: string, orderId: string): Promise<ProfileAmendmentRow> {
    const rows = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
      SELECT * FROM "ReadingIntakeAmendment"
      WHERE "id" = ${id} AND "orderId" = ${orderId} AND "kind" = 'PROFILE_FIELDS'
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('Demande de complément introuvable');
    return rows[0];
  }

  private assertReviewable(amendment: ProfileAmendmentRow, expectedRevision: number) {
    if (amendment.revision !== expectedRevision) throw staleAmendmentConflict();
    if (amendment.status !== 'SUBMITTED') {
      throw new ConflictException('Le complément doit être transmis avant sa validation');
    }
  }

  private async notify(
    userId: string,
    input: {
      title: string;
      message: string;
      event: string;
      amendmentId: string;
      orderId: string;
    },
  ) {
    await this.prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: input.title,
        message: input.message,
        metadata: {
          event: input.event,
          amendmentId: input.amendmentId,
          orderId: input.orderId,
        },
      },
    });
  }
}
