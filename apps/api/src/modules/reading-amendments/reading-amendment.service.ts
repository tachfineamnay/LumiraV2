import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpertService } from '../expert/expert.service';
import {
  PreparedOnboardingPhoto,
  PrivateOnboardingPhotoService,
  ValidatedOnboardingPhoto,
} from '../uploads/private-onboarding-photo.service';
import {
  CreatePalmAmendmentDto,
  ReviewPalmAmendmentDto,
  SavePalmAmendmentDraftDto,
  SubmitPalmAmendmentDto,
} from './dto/reading-amendment.dto';

export type ReadingAmendmentStatus =
  | 'REQUESTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type PalmRole = 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';

interface AmendmentRow {
  id: string;
  orderId: string;
  userId: string;
  readingIntakeId: string | null;
  kind: 'PALM_PHOTO';
  requestedFields: string[];
  reason: string;
  status: ReadingAmendmentStatus;
  data: Prisma.JsonValue;
  contentHash: string | null;
  revision: number;
  requestedByExpertId: string;
  reviewedByExpertId: string | null;
  requestedAt: Date;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ACTIVE_STATUSES: ReadingAmendmentStatus[] = ['REQUESTED', 'DRAFT', 'SUBMITTED'];
const REVISION_MARKER = '[COMPLEMENT_PAUME_APPROUVE]';
const REVISION_INSTRUCTION = `${REVISION_MARKER}
Conserve les éléments valides de la lecture précédente. Intègre uniquement les observations réellement soutenues par la nouvelle photo de la paume. Révise les parties affectées sans inventer de détails visuels ni modifier gratuitement les éléments non concernés.`;

@Injectable()
export class ReadingAmendmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privatePhotos: PrivateOnboardingPhotoService,
    private readonly expertService: ExpertService,
  ) {}

  async requestPalmPhoto(orderId: string, expertId: string, dto: CreatePalmAmendmentDto) {
    const reason = dto.reason.trim();
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("La date d'expiration doit être dans le futur");
    }
    if (expiresAt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Une demande de complément ne peut pas dépasser 30 jours');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            userId: true,
            orderNumber: true,
            status: true,
            clientInputs: true,
            readingIntake: { select: { id: true, status: true } },
          },
        });
        if (!order) throw new NotFoundException('Commande non trouvée');
        if (!['COMPLETED', 'AWAITING_VALIDATION', 'FAILED'].includes(order.status)) {
          throw new ConflictException(
            `La commande ne peut pas recevoir de complément dans son état actuel (${order.status})`,
          );
        }

        const sealedInput = this.resolveOriginalSealedInput(order.clientInputs);
        if (order.readingIntake?.status !== 'SEALED' && !sealedInput) {
          throw new ConflictException(
            'Aucun dossier scellé ne peut servir de base à ce complément',
          );
        }

        await this.expireOpenRequests(tx, orderId);
        const active = await tx.$queryRaw<AmendmentRow[]>(Prisma.sql`
          SELECT * FROM "ReadingIntakeAmendment"
          WHERE "orderId" = ${orderId}
            AND "kind" = 'PALM_PHOTO'
            AND "status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')
          LIMIT 1
        `);
        if (active.length > 0) {
          throw new ConflictException('Une demande de photo de paume est déjà ouverte');
        }

        const id = `ram_${randomUUID()}`;
        const rows = await tx.$queryRaw<AmendmentRow[]>(Prisma.sql`
          INSERT INTO "ReadingIntakeAmendment" (
            "id", "orderId", "userId", "readingIntakeId", "kind",
            "requestedFields", "reason", "status", "data", "revision",
            "requestedByExpertId", "requestedAt", "expiresAt", "createdAt", "updatedAt"
          ) VALUES (
            ${id}, ${order.id}, ${order.userId}, ${order.readingIntake?.id ?? null},
            'PALM_PHOTO', ARRAY['palmPhotoUrl', 'palmRole']::TEXT[], ${reason},
            'REQUESTED', '{}'::JSONB, 0, ${expertId}, CURRENT_TIMESTAMP,
            ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING *
        `);

        await tx.notification.create({
          data: {
            userId: order.userId,
            type: 'SYSTEM',
            title: 'Photo de paume demandée',
            message:
              "Votre expert a besoin d'une photo de votre paume pour compléter votre lecture. Vous pouvez l'ajouter directement depuis votre Sanctuaire.",
            metadata: {
              event: 'READING_AMENDMENT_REQUESTED',
              amendmentId: id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              kind: 'PALM_PHOTO',
              expiresAt: expiresAt.toISOString(),
            },
          },
        });

        return this.toPublic(rows[0]);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listForClient(userId: string) {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'CANCELLED',
          "data" = "data" || '{"cancelReason":"EXPIRED"}'::JSONB,
          "updatedAt" = CURRENT_TIMESTAMP,
          "revision" = "revision" + 1
      WHERE "userId" = ${userId}
        AND "status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')
        AND "expiresAt" <= CURRENT_TIMESTAMP
    `);
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      SELECT * FROM "ReadingIntakeAmendment"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
    `);
    return rows.map((row) => this.toPublic(row));
  }

  async listForExpert(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'CANCELLED',
          "data" = "data" || '{"cancelReason":"EXPIRED"}'::JSONB,
          "updatedAt" = CURRENT_TIMESTAMP,
          "revision" = "revision" + 1
      WHERE "orderId" = ${orderId}
        AND "status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')
        AND "expiresAt" <= CURRENT_TIMESTAMP
    `);
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      SELECT * FROM "ReadingIntakeAmendment"
      WHERE "orderId" = ${orderId}
      ORDER BY "createdAt" DESC
    `);
    return rows.map((row) => this.toPublic(row));
  }

  async savePalmDraft(userId: string, amendmentId: string, dto: SavePalmAmendmentDraftDto) {
    const amendment = await this.getOwnedAmendment(userId, amendmentId);
    this.assertClientEditable(amendment, dto.expectedRevision);

    let validated: ValidatedOnboardingPhoto | null = null;
    if (dto.storageRef?.trim()) {
      validated = await this.privatePhotos.validateOnboardingPhoto(
        dto.storageRef.trim(),
        userId,
        'palm',
      );
    }
    const currentData = this.asRecord(amendment.data);
    const nextData = {
      ...currentData,
      palmRole: dto.palmRole,
      ...(validated
        ? {
            storageRef: validated.storageRef,
            upload: this.persistableAsset(validated),
          }
        : {}),
      draftSavedAt: new Date().toISOString(),
    };

    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'DRAFT',
          "data" = ${JSON.stringify(nextData)}::JSONB,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "userId" = ${userId}
        AND "revision" = ${dto.expectedRevision}
        AND "status" IN ('REQUESTED', 'DRAFT')
        AND "expiresAt" > CURRENT_TIMESTAMP
      RETURNING *
    `);
    if (rows.length !== 1) throw this.staleConflict();
    return this.toPublic(rows[0]);
  }

  async submitPalm(userId: string, amendmentId: string, dto: SubmitPalmAmendmentDto) {
    const amendment = await this.getOwnedAmendment(userId, amendmentId);
    this.assertClientEditable(amendment, dto.expectedRevision);

    const prepared = await this.privatePhotos.prepareForAi(
      dto.storageRef.trim(),
      userId,
      'palm',
      dto.palmRole,
    );
    const submittedAt = new Date();
    const nextData = {
      storageRef: prepared.storageRef,
      palmRole: dto.palmRole,
      asset: this.persistablePreparedAsset(prepared),
      submittedAt: submittedAt.toISOString(),
    };
    const contentHash = this.hashJson({
      amendmentId,
      kind: 'PALM_PHOTO',
      storageRef: prepared.storageRef,
      palmRole: dto.palmRole,
      sha256: prepared.sha256,
      contentType: prepared.contentType,
      size: prepared.size,
      width: prepared.width,
      height: prepared.height,
    });

    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'SUBMITTED',
          "data" = ${JSON.stringify(nextData)}::JSONB,
          "contentHash" = ${contentHash},
          "submittedAt" = ${submittedAt},
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "userId" = ${userId}
        AND "revision" = ${dto.expectedRevision}
        AND "status" IN ('REQUESTED', 'DRAFT')
        AND "expiresAt" > CURRENT_TIMESTAMP
      RETURNING *
    `);
    if (rows.length !== 1) throw this.staleConflict();
    return this.toPublic(rows[0]);
  }

  async approvePalm(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    const amendment = await this.getOrderAmendment(orderId, amendmentId);
    if (amendment.status === 'APPROVED') return this.toPublic(amendment);
    this.assertReviewable(amendment, dto.expectedRevision);

    const submittedData = this.asRecord(amendment.data);
    const storageRef = this.nonEmptyString(submittedData.storageRef);
    const palmRole = this.palmRole(submittedData.palmRole);
    if (!storageRef) throw new ConflictException('La photo soumise est introuvable');

    // Re-read and decode the exact object at approval time. A stale or replaced
    // object can never silently enter the effective reading snapshot.
    const prepared = await this.privatePhotos.prepareForAi(
      storageRef,
      amendment.userId,
      'palm',
      palmRole,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const currentRows = await tx.$queryRaw<AmendmentRow[]>(Prisma.sql`
          SELECT * FROM "ReadingIntakeAmendment"
          WHERE "id" = ${amendmentId} AND "orderId" = ${orderId}
          FOR UPDATE
        `);
        const current = currentRows[0];
        if (!current) throw new NotFoundException('Demande de complément introuvable');
        this.assertReviewable(current, dto.expectedRevision);

        const currentData = this.asRecord(current.data);
        if (this.nonEmptyString(currentData.storageRef) !== prepared.storageRef) {
          throw new ConflictException('La photo a changé pendant sa validation');
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            userId: true,
            orderNumber: true,
            clientInputs: true,
            readingIntake: { select: { id: true, status: true, contentHash: true } },
          },
        });
        if (!order || order.userId !== current.userId) {
          throw new ConflictException('La demande ne correspond plus à cette commande');
        }

        const clientInputs = this.asRecord(order.clientInputs);
        const original = this.resolveOriginalSealedInput(order.clientInputs);
        if (!original) {
          throw new ConflictException('Le dossier scellé original est introuvable');
        }
        const previousEffective = this.asRecord(clientInputs.readingIntakeEffective);
        const base = Object.keys(previousEffective).length > 0 ? previousEffective : original;
        const profile = this.asRecord(base.profile);
        const assets = this.asRecord(base.assets);

        const revisionRows = await tx.$queryRaw<Array<{ revision: number }>>(Prisma.sql`
          SELECT (COALESCE(MAX("revision"), 0) + 1)::INTEGER AS "revision"
          FROM "ReadingInputSnapshot"
          WHERE "orderId" = ${orderId}
        `);
        const nextRevision = revisionRows[0]?.revision ?? 1;
        const snapshotId = `ris_${randomUUID()}`;
        const parentSnapshotId = this.nonEmptyString(previousEffective.snapshotId);
        const amendmentIds = Array.from(
          new Set([...this.stringArray(base.amendmentIds), amendmentId]),
        );
        const effectiveAt = new Date();
        const snapshotCore = {
          ...base,
          version: '2026-08-02-effective-intake-v1',
          revision: nextRevision,
          effectiveAt: effectiveAt.toISOString(),
          parentSnapshotId,
          parentContentHash: this.nonEmptyString(base.contentHash),
          baseIntakeContentHash:
            this.nonEmptyString(original.contentHash) ?? order.readingIntake?.contentHash ?? null,
          profile: {
            ...profile,
            palmPhotoUrl: prepared.storageRef,
            palmRole,
          },
          assets: {
            ...assets,
            palm: this.persistablePreparedAsset(prepared),
          },
          amendmentIds,
        };
        const snapshotHash = this.hashJson(snapshotCore);
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
            ${snapshotHash}, ARRAY[${amendmentId}]::TEXT[], ${effectiveAt}
          )
        `);

        const approvedData = {
          ...currentData,
          palmRole,
          storageRef: prepared.storageRef,
          asset: this.persistablePreparedAsset(prepared),
          approvedAt: effectiveAt.toISOString(),
          reviewReason: dto.reason?.trim() || null,
          snapshotId,
          snapshotRevision: nextRevision,
          snapshotContentHash: snapshotHash,
        };
        const approvedHash = this.hashJson({
          amendmentId,
          palmRole,
          asset: approvedData.asset,
          snapshotId,
          snapshotContentHash: snapshotHash,
        });
        const updated = await tx.$queryRaw<AmendmentRow[]>(Prisma.sql`
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
            AND "revision" = ${dto.expectedRevision}
            AND "status" = 'SUBMITTED'
          RETURNING *
        `);
        if (updated.length !== 1) throw this.staleConflict();

        // Preserve readingIntake byte-for-byte. The new projection has a
        // distinct key and can be selected explicitly by generation.
        await tx.order.update({
          where: { id: orderId },
          data: {
            clientInputs: {
              ...clientInputs,
              readingIntakeEffective: effectiveSnapshot,
            } as Prisma.InputJsonValue,
          },
        });

        await tx.notification.create({
          data: {
            userId: order.userId,
            type: 'SYSTEM',
            title: 'Votre photo de paume a été acceptée',
            message:
              'Votre expert a validé le complément. Il peut maintenant préparer une version révisée de votre lecture.',
            metadata: {
              event: 'READING_AMENDMENT_APPROVED',
              amendmentId,
              orderId,
              orderNumber: order.orderNumber,
              snapshotId,
            },
          },
        });

        return {
          amendment: this.toPublic(updated[0]),
          snapshot: {
            id: snapshotId,
            revision: nextRevision,
            contentHash: snapshotHash,
            amendmentIds,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async rejectPalm(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    const amendment = await this.getOrderAmendment(orderId, amendmentId);
    this.assertReviewable(amendment, dto.expectedRevision);
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Le motif du rejet est requis');
    const data = {
      ...this.asRecord(amendment.data),
      reviewReason: reason,
      rejectedAt: new Date().toISOString(),
    };
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'REJECTED',
          "data" = ${JSON.stringify(data)}::JSONB,
          "reviewedByExpertId" = ${expertId},
          "reviewedAt" = CURRENT_TIMESTAMP,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "revision" = ${dto.expectedRevision}
        AND "status" = 'SUBMITTED'
      RETURNING *
    `);
    if (rows.length !== 1) throw this.staleConflict();
    await this.notifyClient(amendment.userId, {
      title: 'Photo de paume à reprendre',
      message: reason,
      event: 'READING_AMENDMENT_REJECTED',
      amendmentId,
      orderId,
    });
    return this.toPublic(rows[0]);
  }

  async requestRetake(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    const amendment = await this.getOrderAmendment(orderId, amendmentId);
    if (!['SUBMITTED', 'REJECTED'].includes(amendment.status)) {
      throw new ConflictException(
        'Cette demande ne peut pas être rouverte pour une nouvelle photo',
      );
    }
    if (amendment.revision !== dto.expectedRevision) throw this.staleConflict();
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Le motif de reprise est requis');
    const data = {
      previousSubmission: this.asRecord(amendment.data),
      retakeReason: reason,
      retakeRequestedAt: new Date().toISOString(),
      retakeRequestedByExpertId: expertId,
    };
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'REQUESTED',
          "data" = ${JSON.stringify(data)}::JSONB,
          "contentHash" = NULL,
          "submittedAt" = NULL,
          "reviewedByExpertId" = ${expertId},
          "reviewedAt" = CURRENT_TIMESTAMP,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "revision" = ${dto.expectedRevision}
        AND "status" IN ('SUBMITTED', 'REJECTED')
      RETURNING *
    `);
    if (rows.length !== 1) throw this.staleConflict();
    await this.notifyClient(amendment.userId, {
      title: 'Nouvelle photo de paume demandée',
      message: reason,
      event: 'READING_AMENDMENT_RETAKE_REQUESTED',
      amendmentId,
      orderId,
    });
    return this.toPublic(rows[0]);
  }

  async cancel(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    const amendment = await this.getOrderAmendment(orderId, amendmentId);
    if (!ACTIVE_STATUSES.includes(amendment.status)) {
      throw new ConflictException('Seule une demande ouverte peut être annulée');
    }
    if (amendment.revision !== dto.expectedRevision) throw this.staleConflict();
    const data = {
      ...this.asRecord(amendment.data),
      cancelReason: dto.reason?.trim() || 'CANCELLED_BY_EXPERT',
      cancelledByExpertId: expertId,
      cancelledAt: new Date().toISOString(),
    };
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'CANCELLED',
          "data" = ${JSON.stringify(data)}::JSONB,
          "reviewedByExpertId" = ${expertId},
          "reviewedAt" = CURRENT_TIMESTAMP,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "revision" = ${dto.expectedRevision}
        AND "status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')
      RETURNING *
    `);
    if (rows.length !== 1) throw this.staleConflict();
    return this.toPublic(rows[0]);
  }

  async createRevisedReading(
    orderId: string,
    amendmentId: string,
    expert: { id: string; email: string; name: string },
    dto: ReviewPalmAmendmentDto,
  ) {
    const amendment = await this.getOrderAmendment(orderId, amendmentId);
    if (amendment.status !== 'APPROVED') {
      throw new ConflictException('Le complément doit être approuvé avant de réviser la lecture');
    }
    if (amendment.revision !== dto.expectedRevision) throw this.staleConflict();
    const amendmentData = this.asRecord(amendment.data);
    const snapshotId = this.nonEmptyString(amendmentData.snapshotId);
    if (!snapshotId) throw new ConflictException('Le snapshot effectif est introuvable');
    if (this.nonEmptyString(amendmentData.revisionQueuedAt)) {
      throw new ConflictException('Une révision a déjà été lancée pour ce complément');
    }

    let order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        expertInstructions: true,
        clientInputs: true,
      },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');

    if (order.status === 'COMPLETED') {
      await this.expertService.reopenForRevision(
        orderId,
        expert,
        dto.reason?.trim() || 'Complément de photo de paume approuvé',
      );
      order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          expertInstructions: true,
          clientInputs: true,
        },
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

    const currentInstructions = order.expertInstructions?.trim() || '';
    const nextInstructions = currentInstructions.includes(REVISION_MARKER)
      ? currentInstructions
      : [currentInstructions, REVISION_INSTRUCTION].filter(Boolean).join('\n\n');
    await this.prisma.order.update({
      where: { id: orderId },
      data: { expertInstructions: nextInstructions },
    });

    const generation = await this.expertService.generateReading(orderId, expert);
    const queuedAt = new Date().toISOString();
    const nextData = {
      ...amendmentData,
      revisionQueuedAt: queuedAt,
      revisionRequestedByExpertId: expert.id,
      workingReadingVersionId: workingVersion.id,
      generation,
    };
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "data" = ${JSON.stringify(nextData)}::JSONB,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "revision" = ${dto.expectedRevision}
        AND "status" = 'APPROVED'
      RETURNING *
    `);
    if (rows.length !== 1) throw this.staleConflict();

    return {
      success: true,
      orderId,
      amendment: this.toPublic(rows[0]),
      snapshotId,
      workingReadingVersionId: workingVersion.id,
      generation,
    };
  }

  async getPhotoReference(options: {
    amendmentId: string;
    userId?: string;
    orderId?: string;
  }): Promise<{ userId: string; storageRef: string; palmRole: PalmRole }> {
    let rows: AmendmentRow[];
    if (options.userId) {
      rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
        SELECT * FROM "ReadingIntakeAmendment"
        WHERE "id" = ${options.amendmentId} AND "userId" = ${options.userId}
        LIMIT 1
      `);
    } else if (options.orderId) {
      rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
        SELECT * FROM "ReadingIntakeAmendment"
        WHERE "id" = ${options.amendmentId} AND "orderId" = ${options.orderId}
        LIMIT 1
      `);
    } else {
      throw new ForbiddenException('Périmètre photo manquant');
    }
    const row = rows[0];
    if (!row) throw new NotFoundException('Photo de complément introuvable');
    const data = this.asRecord(row.data);
    const storageRef = this.nonEmptyString(data.storageRef);
    if (!storageRef) throw new NotFoundException('Photo de complément introuvable');
    return { userId: row.userId, storageRef, palmRole: this.palmRole(data.palmRole) };
  }

  private async getOwnedAmendment(userId: string, id: string): Promise<AmendmentRow> {
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      SELECT * FROM "ReadingIntakeAmendment"
      WHERE "id" = ${id} AND "userId" = ${userId}
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('Demande de complément introuvable');
    return rows[0];
  }

  private async getOrderAmendment(orderId: string, id: string): Promise<AmendmentRow> {
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      SELECT * FROM "ReadingIntakeAmendment"
      WHERE "id" = ${id} AND "orderId" = ${orderId}
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('Demande de complément introuvable');
    return rows[0];
  }

  private assertClientEditable(amendment: AmendmentRow, expectedRevision: number): void {
    if (amendment.revision !== expectedRevision) throw this.staleConflict();
    if (!['REQUESTED', 'DRAFT'].includes(amendment.status)) {
      throw new ConflictException('Cette demande ne peut plus être modifiée');
    }
    if (amendment.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Cette demande de complément a expiré');
    }
  }

  private assertReviewable(amendment: AmendmentRow, expectedRevision: number): void {
    if (amendment.revision !== expectedRevision) throw this.staleConflict();
    if (amendment.status !== 'SUBMITTED') {
      throw new ConflictException('Le complément doit être transmis avant sa validation');
    }
  }

  private staleConflict(): ConflictException {
    return new ConflictException({
      code: 'AMENDMENT_REVISION_CHANGED',
      message: 'La demande a changé. Rechargez-la avant de continuer.',
    });
  }

  private async expireOpenRequests(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'CANCELLED',
          "data" = "data" || '{"cancelReason":"EXPIRED"}'::JSONB,
          "updatedAt" = CURRENT_TIMESTAMP,
          "revision" = "revision" + 1
      WHERE "orderId" = ${orderId}
        AND "status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')
        AND "expiresAt" <= CURRENT_TIMESTAMP
    `);
  }

  private async notifyClient(
    userId: string,
    input: {
      title: string;
      message: string;
      event: string;
      amendmentId: string;
      orderId: string;
    },
  ): Promise<void> {
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

  private resolveOriginalSealedInput(clientInputs: unknown): Record<string, unknown> | null {
    const input = this.asRecord(clientInputs);
    const snapshot = this.asRecord(input.readingIntake);
    return this.nonEmptyString(snapshot.sealedAt) ? snapshot : null;
  }

  private persistableAsset(asset: ValidatedOnboardingPhoto) {
    return {
      storageRef: asset.storageRef,
      key: asset.key,
      contentType: asset.contentType,
      size: asset.size,
      etag: asset.etag,
      versionId: asset.versionId,
    };
  }

  private persistablePreparedAsset(asset: PreparedOnboardingPhoto) {
    return {
      ...this.persistableAsset(asset),
      role: asset.role,
      width: asset.width,
      height: asset.height,
      orientation: asset.orientation,
      sha256: asset.sha256,
      analysisLimited: asset.analysisLimited,
      warnings: asset.warnings,
    };
  }

  private toPublic(row: AmendmentRow) {
    const data = this.asRecord(row.data);
    return {
      id: row.id,
      orderId: row.orderId,
      kind: row.kind,
      requestedFields: row.requestedFields,
      reason: row.reason,
      status: row.status,
      displayStatus:
        row.status === 'CANCELLED' && data.cancelReason === 'EXPIRED' ? 'EXPIRED' : row.status,
      data,
      contentHash: row.contentHash,
      revision: row.revision,
      requestedAt: row.requestedAt.toISOString(),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private hashJson(value: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(this.canonicalize(value)))
      .digest('hex');
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.canonicalize(item));
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = this.canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
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

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  }

  private palmRole(value: unknown): PalmRole {
    return value === 'PALM_LEFT' || value === 'PALM_RIGHT' ? value : 'PALM_UNKNOWN';
  }
}
