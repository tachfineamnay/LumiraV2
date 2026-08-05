import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expert, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpertService } from '../expert/expert.service';
import { EmailService } from '../notifications/email.service';
import {
  PreparedOnboardingPhoto,
  PrivateOnboardingPhotoService,
  ValidatedOnboardingPhoto,
} from '../uploads/private-onboarding-photo.service';
import {
  CreateProfileFieldAmendmentDto,
  ReviewProfileFieldAmendmentDto,
  SaveProfileFieldAmendmentDraftDto,
  SubmitProfileFieldAmendmentDto,
} from './dto/profile-field-amendment.dto';
import {
  PROFILE_FIELD_CATALOG,
  ProfileFieldKey,
  parseProfileFields,
  profileFieldLabels,
} from './profile-field-catalog';

type AmendmentStatus =
  | 'REQUESTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

interface AmendmentRow {
  id: string;
  orderId: string;
  userId: string;
  readingIntakeId: string | null;
  kind: 'PROFILE_FIELDS';
  requestedFields: string[];
  reason: string;
  status: AmendmentStatus;
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

const ACTIVE_STATUSES: AmendmentStatus[] = ['REQUESTED', 'DRAFT', 'SUBMITTED'];
const REVISION_MARKER = '[COMPLEMENT_INFORMATIONS_APPROUVE]';

@Injectable()
export class ProfileFieldAmendmentService {
  private readonly logger = new Logger(ProfileFieldAmendmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly privatePhotos: PrivateOnboardingPhotoService,
    private readonly expertService: ExpertService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async request(orderId: string, expertId: string, dto: CreateProfileFieldAmendmentDto) {
    const fields = parseProfileFields(dto.fields);
    const reason = dto.reason.trim();
    const expiresAt = this.parseExpiry(dto.expiresAt);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            userId: true,
            orderNumber: true,
            status: true,
            clientInputs: true,
            user: { select: { email: true, firstName: true } },
            readingIntake: { select: { id: true, status: true } },
          },
        });
        if (!order) throw new NotFoundException('Commande non trouvée');
        if (!['COMPLETED', 'AWAITING_VALIDATION', 'FAILED'].includes(order.status)) {
          throw new ConflictException(
            `La commande ne peut pas recevoir de complément dans son état actuel (${order.status})`,
          );
        }
        const original = this.asRecord(this.asRecord(order.clientInputs).readingIntake);
        if (order.readingIntake?.status !== 'SEALED' && !this.nonEmptyString(original.sealedAt)) {
          throw new ConflictException('Aucun dossier scellé ne peut servir de base à ce complément');
        }

        await tx.$executeRaw(Prisma.sql`
          UPDATE "ReadingIntakeAmendment"
          SET "status" = 'CANCELLED',
              "data" = "data" || '{"cancelReason":"EXPIRED"}'::JSONB,
              "revision" = "revision" + 1,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "orderId" = ${orderId}
            AND "kind" = 'PROFILE_FIELDS'
            AND "status" IN ('REQUESTED', 'DRAFT')
            AND "expiresAt" <= CURRENT_TIMESTAMP
        `);

        const active = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
          SELECT "id", "status" FROM "ReadingIntakeAmendment"
          WHERE "orderId" = ${orderId}
            AND "kind" = 'PROFILE_FIELDS'
            AND "status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')
          LIMIT 1
        `);
        if (active.length > 0) {
          throw new ConflictException(
            active[0].status === 'SUBMITTED'
              ? 'Des informations transmises attendent encore la vérification'
              : 'Une demande d’informations est déjà ouverte',
          );
        }

        const id = `ram_${randomUUID()}`;
        const data = {
          schemaVersion: '2026-08-05-profile-fields-v1',
          fieldLabels: profileFieldLabels(fields),
          values: {},
        };
        const rows = await tx.$queryRaw<AmendmentRow[]>(Prisma.sql`
          INSERT INTO "ReadingIntakeAmendment" (
            "id", "orderId", "userId", "readingIntakeId", "kind",
            "requestedFields", "reason", "status", "data", "revision",
            "requestedByExpertId", "requestedAt", "expiresAt", "createdAt", "updatedAt"
          ) VALUES (
            ${id}, ${order.id}, ${order.userId}, ${order.readingIntake?.id ?? null},
            'PROFILE_FIELDS', ${fields}::TEXT[], ${reason}, 'REQUESTED',
            ${JSON.stringify(data)}::JSONB, 0, ${expertId}, CURRENT_TIMESTAMP,
            ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING *
        `);

        await tx.notification.create({
          data: {
            userId: order.userId,
            type: 'SYSTEM',
            title: 'Informations complémentaires demandées',
            message: `${reason} Éléments demandés : ${profileFieldLabels(fields).join(', ')}.`,
            metadata: {
              event: 'READING_PROFILE_FIELDS_REQUESTED',
              amendmentId: id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              kind: 'PROFILE_FIELDS',
              requestedFields: fields,
              expiresAt: expiresAt.toISOString(),
            },
          },
        });

        return {
          amendment: this.toPublic(rows[0]),
          recipient: order.user,
          orderNumber: order.orderNumber,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    try {
      await this.email.send({
        to: result.recipient.email,
        subject: 'Une action est demandée dans votre Sanctuaire Lumira',
        template: 'reading-amendment-requested',
        messageId: `<lumira-profile-amendment-${result.amendment.id}@oraclelumira.com>`,
        context: {
          firstName: result.recipient.firstName,
          orderNumber: result.orderNumber,
          reason: `${result.amendment.reason} (${profileFieldLabels(fields).join(', ')})`,
          expiresAt: new Date(result.amendment.expiresAt).toLocaleDateString('fr-FR'),
          sanctuaireLink: `${this.getWebUrl()}/sanctuaire`,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Demande ${result.amendment.id} créée mais email non envoyé: ${
          error instanceof Error ? error.message : 'erreur inconnue'
        }`,
      );
    }

    return result.amendment;
  }

  async saveDraft(
    userId: string,
    amendmentId: string,
    dto: SaveProfileFieldAmendmentDraftDto,
  ) {
    const amendment = await this.getOwned(amendmentId, userId);
    this.assertClientEditable(amendment, dto.expectedRevision);
    const fields = this.fields(amendment);
    const values = await this.sanitizeValues(userId, fields, dto.values, false);
    const currentData = this.asRecord(amendment.data);
    const nextData = {
      ...currentData,
      values,
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
        AND "kind" = 'PROFILE_FIELDS'
        AND "revision" = ${dto.expectedRevision}
        AND "status" IN ('REQUESTED', 'DRAFT')
        AND "expiresAt" > CURRENT_TIMESTAMP
      RETURNING *
    `);
    if (rows.length !== 1) throw this.staleConflict();
    return this.toPublic(rows[0]);
  }

  async submit(userId: string, amendmentId: string, dto: SubmitProfileFieldAmendmentDto) {
    const amendment = await this.getOwned(amendmentId, userId);
    this.assertClientEditable(amendment, dto.expectedRevision);
    const fields = this.fields(amendment);
    const values = await this.sanitizeValues(userId, fields, dto.values, true);
    const preparedFace = fields.includes('facePhotoUrl')
      ? await this.privatePhotos.prepareForAi(
          String(values.facePhotoUrl),
          userId,
          'face',
          'FACE_FRONTAL',
        )
      : null;
    const submittedAt = new Date();
    const nextData = {
      ...this.asRecord(amendment.data),
      values,
      ...(preparedFace ? { faceAsset: this.persistablePreparedAsset(preparedFace) } : {}),
      submittedAt: submittedAt.toISOString(),
    };
    const contentHash = this.hashJson({
      amendmentId,
      kind: 'PROFILE_FIELDS',
      requestedFields: fields,
      values,
      faceSha256: preparedFace?.sha256 ?? null,
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
        AND "kind" = 'PROFILE_FIELDS'
        AND "revision" = ${dto.expectedRevision}
        AND "status" IN ('REQUESTED', 'DRAFT')
        AND "expiresAt" > CURRENT_TIMESTAMP
      RETURNING *
    `);
    if (rows.length !== 1) throw this.staleConflict();
    return this.toPublic(rows[0]);
  }

  async approve(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    const amendment = await this.getForOrder(amendmentId, orderId);
    if (amendment.status === 'APPROVED') return this.toPublic(amendment);
    this.assertReviewable(amendment, dto.expectedRevision);
    const fields = this.fields(amendment);
    const submittedData = this.asRecord(amendment.data);
    const values = await this.sanitizeValues(
      amendment.userId,
      fields,
      this.asRecord(submittedData.values),
      true,
    );
    const preparedFace = fields.includes('facePhotoUrl')
      ? await this.privatePhotos.prepareForAi(
          String(values.facePhotoUrl),
          amendment.userId,
          'face',
          'FACE_FRONTAL',
        )
      : null;

    return this.prisma.$transaction(
      async (tx) => {
        const currentRows = await tx.$queryRaw<AmendmentRow[]>(Prisma.sql`
          SELECT * FROM "ReadingIntakeAmendment"
          WHERE "id" = ${amendmentId}
            AND "orderId" = ${orderId}
            AND "kind" = 'PROFILE_FIELDS'
          FOR UPDATE
        `);
        const current = currentRows[0];
        if (!current) throw new NotFoundException('Demande de complément introuvable');
        this.assertReviewable(current, dto.expectedRevision);

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

        const clientInputs = this.asRecord(order.clientInputs);
        const original = this.resolveOriginal(clientInputs, order.readingIntake);
        const previousEffective = this.asRecord(clientInputs.readingIntakeEffective);
        const base = Object.keys(previousEffective).length > 0 ? previousEffective : original;
        const profile = this.asRecord(base.profile);
        const assets = this.asRecord(base.assets);
        const nextProfile = { ...profile, ...values };
        const nextAssets = preparedFace
          ? { ...assets, face: this.persistablePreparedAsset(preparedFace) }
          : assets;

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
          version: '2026-08-05-effective-intake-v2',
          revision: nextRevision,
          effectiveAt: effectiveAt.toISOString(),
          parentSnapshotId,
          parentContentHash: this.nonEmptyString(base.contentHash),
          baseIntakeContentHash:
            this.nonEmptyString(original.contentHash) ?? order.readingIntake?.contentHash ?? null,
          profile: nextProfile,
          assets: nextAssets,
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
            ${snapshotHash}, ${amendmentIds}::TEXT[], ${effectiveAt}
          )
        `);

        const approvedData = {
          ...this.asRecord(current.data),
          values,
          ...(preparedFace ? { faceAsset: this.persistablePreparedAsset(preparedFace) } : {}),
          approvedAt: effectiveAt.toISOString(),
          reviewReason: dto.reason?.trim() || null,
          snapshotId,
          snapshotRevision: nextRevision,
          snapshotContentHash: snapshotHash,
        };
        const approvedHash = this.hashJson({
          amendmentId,
          fields,
          values,
          faceSha256: preparedFace?.sha256 ?? null,
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
            AND "kind" = 'PROFILE_FIELDS'
            AND "revision" = ${dto.expectedRevision}
            AND "status" = 'SUBMITTED'
          RETURNING *
        `);
        if (updated.length !== 1) throw this.staleConflict();

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
            title: 'Vos informations ont été acceptées',
            message:
              'Votre expert a validé le complément. Il peut maintenant préparer une version révisée de votre lecture.',
            metadata: {
              event: 'READING_PROFILE_FIELDS_APPROVED',
              amendmentId,
              orderId,
              orderNumber: order.orderNumber,
              snapshotId,
              requestedFields: fields,
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
    return this.reviewTransition(amendment, expertId, dto.expectedRevision, 'REJECTED', {
      reviewReason: reason,
      rejectedAt: new Date().toISOString(),
    });
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
    if (amendment.revision !== dto.expectedRevision) throw this.staleConflict();
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Le motif de reprise est requis');
    const nextData = {
      previousSubmission: this.asRecord(amendment.data),
      values: {},
      retakeReason: reason,
      retakeRequestedAt: new Date().toISOString(),
      retakeRequestedByExpertId: expertId,
    };
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
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
    if (rows.length !== 1) throw this.staleConflict();
    await this.notify(amendment.userId, {
      title: 'Informations à corriger',
      message: reason,
      event: 'READING_PROFILE_FIELDS_RETAKE_REQUESTED',
      amendmentId,
      orderId,
    });
    return this.toPublic(rows[0]);
  }

  async cancel(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    const amendment = await this.getForOrder(amendmentId, orderId);
    if (!ACTIVE_STATUSES.includes(amendment.status)) {
      throw new ConflictException('Seule une demande ouverte peut être annulée');
    }
    if (amendment.revision !== dto.expectedRevision) throw this.staleConflict();
    const nextData = {
      ...this.asRecord(amendment.data),
      cancelReason: dto.reason?.trim() || 'CANCELLED_BY_EXPERT',
      cancelledByExpertId: expertId,
      cancelledAt: new Date().toISOString(),
    };
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
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
    if (rows.length !== 1) throw this.staleConflict();
    return this.toPublic(rows[0]);
  }

  async createRevisedReading(
    orderId: string,
    amendmentId: string,
    expert: Expert,
    dto: ReviewProfileFieldAmendmentDto,
  ) {
    const operationId = `rev_${randomUUID()}`;
    const claim = {
      id: operationId,
      status: 'CLAIMED',
      startedAt: new Date().toISOString(),
      expertId: expert.id,
    };
    const claimed = await this.prisma.$queryRaw<Array<{ revision: number; data: Prisma.JsonValue }>>(
      Prisma.sql`
        UPDATE "ReadingIntakeAmendment"
        SET "data" = "data" || jsonb_build_object('revisionClaim', ${JSON.stringify(claim)}::JSONB),
            "revision" = "revision" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${amendmentId}
          AND "orderId" = ${orderId}
          AND "kind" = 'PROFILE_FIELDS'
          AND "status" = 'APPROVED'
          AND "revision" = ${dto.expectedRevision}
          AND COALESCE("data"->>'revisionQueuedAt', '') = ''
          AND COALESCE("data"#>>'{revisionClaim,status}', '') <> 'CLAIMED'
        RETURNING "revision", "data"
      `,
    );
    if (claimed.length !== 1) {
      throw new ConflictException({
        code: 'AMENDMENT_REVISION_ALREADY_CLAIMED',
        message: 'Cette révision est déjà en cours ou a été lancée. Actualisez le dossier.',
      });
    }

    try {
      const amendmentData = this.asRecord(claimed[0].data);
      const snapshotId = this.nonEmptyString(amendmentData.snapshotId);
      if (!snapshotId) throw new ConflictException('Le snapshot effectif est introuvable');
      const fields = parseProfileFields(
        await this.requestedFieldsFor(amendmentId, orderId),
      );
      let order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, expertInstructions: true, clientInputs: true },
      });
      if (!order) throw new NotFoundException('Commande non trouvée');

      if (order.status === 'COMPLETED') {
        await this.expertService.reopenForRevision(
          orderId,
          expert,
          dto.reason?.trim() || 'Informations complémentaires approuvées',
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

      const instruction = `${REVISION_MARKER}\nConserve les éléments valides de la lecture précédente. Intègre uniquement les informations complémentaires approuvées suivantes : ${profileFieldLabels(fields).join(', ')}. Révise les passages concernés sans modifier gratuitement le reste.`;
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
        ...amendmentData,
        revisionQueuedAt: queuedAt,
        revisionRequestedByExpertId: expert.id,
        workingReadingVersionId: workingVersion.id,
        generation,
      };
      const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
        UPDATE "ReadingIntakeAmendment"
        SET "data" = (${JSON.stringify(nextData)}::JSONB - 'revisionClaim'),
            "revision" = "revision" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${amendmentId}
          AND "orderId" = ${orderId}
          AND "kind" = 'PROFILE_FIELDS'
          AND "revision" = ${claimed[0].revision}
          AND "data"#>>'{revisionClaim,id}' = ${operationId}
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
    } catch (error) {
      const failure = {
        id: operationId,
        failedAt: new Date().toISOString(),
        error: error instanceof Error ? error.name : 'UnknownError',
      };
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "ReadingIntakeAmendment"
        SET "data" = ("data" - 'revisionClaim') || jsonb_build_object(
              'lastRevisionFailure', ${JSON.stringify(failure)}::JSONB
            ),
            "revision" = "revision" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${amendmentId}
          AND "orderId" = ${orderId}
          AND "kind" = 'PROFILE_FIELDS'
          AND "data"#>>'{revisionClaim,id}' = ${operationId}
          AND COALESCE("data"->>'revisionQueuedAt', '') = ''
      `);
      throw error;
    }
  }

  async getPhotoReference(options: {
    amendmentId: string;
    userId?: string;
    orderId?: string;
  }): Promise<{ userId: string; storageRef: string }> {
    let rows: AmendmentRow[];
    if (options.userId) {
      rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
        SELECT * FROM "ReadingIntakeAmendment"
        WHERE "id" = ${options.amendmentId}
          AND "userId" = ${options.userId}
          AND "kind" = 'PROFILE_FIELDS'
        LIMIT 1
      `);
    } else if (options.orderId) {
      rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
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
    const values = this.asRecord(this.asRecord(row.data).values);
    const storageRef = this.nonEmptyString(values.facePhotoUrl);
    if (!storageRef) throw new NotFoundException('Photo de complément introuvable');
    return { userId: row.userId, storageRef };
  }

  private async sanitizeValues(
    userId: string,
    fields: ProfileFieldKey[],
    input: Record<string, unknown>,
    requireAll: boolean,
  ): Promise<Record<string, string>> {
    const allowed = new Set(fields);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key as ProfileFieldKey)) {
        throw new BadRequestException(`Le champ ${key} n’a pas été demandé`);
      }
    }

    const result: Record<string, string> = {};
    for (const field of fields) {
      const definition = PROFILE_FIELD_CATALOG[field];
      const raw = input[field];
      if (raw === undefined || raw === null || raw === '') {
        if (requireAll) {
          throw new BadRequestException(`Le champ « ${definition.label} » est requis`);
        }
        continue;
      }
      if (typeof raw !== 'string') {
        throw new BadRequestException(`Le champ « ${definition.label} » est invalide`);
      }
      const value = raw.trim();
      if (!value) {
        if (requireAll) {
          throw new BadRequestException(`Le champ « ${definition.label} » est requis`);
        }
        continue;
      }
      if (value.length > definition.maxLength) {
        throw new BadRequestException(`Le champ « ${definition.label} » est trop long`);
      }
      if (field === 'birthDate' && !this.isValidDate(value)) {
        throw new BadRequestException('La date de naissance est invalide');
      }
      if (field === 'facePhotoUrl') {
        await this.privatePhotos.validateOnboardingPhoto(value, userId, 'face');
      }
      result[field] = value;
    }
    return result;
  }

  private async reviewTransition(
    amendment: AmendmentRow,
    expertId: string,
    expectedRevision: number,
    status: 'REJECTED',
    extra: Record<string, unknown>,
  ) {
    const nextData = { ...this.asRecord(amendment.data), ...extra };
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = ${status},
          "data" = ${JSON.stringify(nextData)}::JSONB,
          "reviewedByExpertId" = ${expertId},
          "reviewedAt" = CURRENT_TIMESTAMP,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendment.id}
        AND "orderId" = ${amendment.orderId}
        AND "kind" = 'PROFILE_FIELDS'
        AND "revision" = ${expectedRevision}
        AND "status" = 'SUBMITTED'
      RETURNING *
    `);
    if (rows.length !== 1) throw this.staleConflict();
    await this.notify(amendment.userId, {
      title: 'Informations à corriger',
      message: String(extra.reviewReason || 'Le complément doit être repris.'),
      event: 'READING_PROFILE_FIELDS_REJECTED',
      amendmentId: amendment.id,
      orderId: amendment.orderId,
    });
    return this.toPublic(rows[0]);
  }

  private resolveOriginal(
    clientInputs: Record<string, unknown>,
    intake: {
      id: string;
      status: string;
      data: Prisma.JsonValue;
      contentHash: string | null;
      sealedAt: Date | null;
    } | null,
  ): Record<string, unknown> {
    const existing = this.asRecord(clientInputs.readingIntake);
    if (
      this.nonEmptyString(existing.sealedAt) &&
      this.nonEmptyString(existing.contentHash) &&
      Object.keys(this.asRecord(existing.profile)).length > 0
    ) {
      return existing;
    }
    if (intake?.status !== 'SEALED' || !intake.sealedAt || !intake.contentHash) {
      throw new ConflictException('Le dossier scellé original est introuvable');
    }
    return {
      version: 'relational-reading-intake-v1',
      sealedAt: intake.sealedAt.toISOString(),
      contentHash: intake.contentHash,
      profile: this.asRecord(intake.data),
      assets: {},
    };
  }

  private async getOwned(id: string, userId: string): Promise<AmendmentRow> {
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      SELECT * FROM "ReadingIntakeAmendment"
      WHERE "id" = ${id} AND "userId" = ${userId} AND "kind" = 'PROFILE_FIELDS'
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('Demande de complément introuvable');
    return rows[0];
  }

  private async getForOrder(id: string, orderId: string): Promise<AmendmentRow> {
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      SELECT * FROM "ReadingIntakeAmendment"
      WHERE "id" = ${id} AND "orderId" = ${orderId} AND "kind" = 'PROFILE_FIELDS'
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('Demande de complément introuvable');
    return rows[0];
  }

  private async requestedFieldsFor(id: string, orderId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ requestedFields: string[] }>>(Prisma.sql`
      SELECT "requestedFields" FROM "ReadingIntakeAmendment"
      WHERE "id" = ${id} AND "orderId" = ${orderId} AND "kind" = 'PROFILE_FIELDS'
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('Demande de complément introuvable');
    return rows[0].requestedFields;
  }

  private fields(amendment: AmendmentRow): ProfileFieldKey[] {
    return parseProfileFields(amendment.requestedFields);
  }

  private assertClientEditable(amendment: AmendmentRow, expectedRevision: number) {
    if (amendment.revision !== expectedRevision) throw this.staleConflict();
    if (!['REQUESTED', 'DRAFT'].includes(amendment.status)) {
      throw new ConflictException('Cette demande ne peut plus être modifiée');
    }
    if (amendment.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Cette demande de complément a expiré');
    }
  }

  private assertReviewable(amendment: AmendmentRow, expectedRevision: number) {
    if (amendment.revision !== expectedRevision) throw this.staleConflict();
    if (amendment.status !== 'SUBMITTED') {
      throw new ConflictException('Le complément doit être transmis avant sa validation');
    }
  }

  private parseExpiry(value?: string): Date {
    const expiresAt = value ? new Date(value) : new Date(Date.now() + 7 * 86_400_000);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("La date d'expiration doit être dans le futur");
    }
    if (expiresAt.getTime() > Date.now() + 30 * 86_400_000) {
      throw new BadRequestException("Une demande de complément ne peut pas dépasser 30 jours");
    }
    return expiresAt;
  }

  private isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  private staleConflict(): ConflictException {
    return new ConflictException({
      code: 'AMENDMENT_REVISION_CHANGED',
      message: 'La demande a changé. Rechargez-la avant de continuer.',
    });
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
    return createHash('sha256').update(JSON.stringify(this.canonicalize(value))).digest('hex');
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

  private getWebUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('NEXT_PUBLIC_WEB_URL') ||
      'https://oraclelumira.com'
    ).replace(/\/$/, '');
  }
}
