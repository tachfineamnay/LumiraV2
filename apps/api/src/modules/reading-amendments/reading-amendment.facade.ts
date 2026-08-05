import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expert, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import {
  CreateProfileFieldAmendmentDto,
  ReviewProfileFieldAmendmentDto,
  SaveProfileFieldAmendmentDraftDto,
  SubmitProfileFieldAmendmentDto,
} from './dto/profile-field-amendment.dto';
import {
  CreatePalmAmendmentDto,
  ReviewPalmAmendmentDto,
  SavePalmAmendmentDraftDto,
  SaveReadingAmendmentDraftDto,
  SubmitPalmAmendmentDto,
  SubmitReadingAmendmentDto,
} from './dto/reading-amendment.dto';
import { IntakeCompletenessService } from './intake-completeness.service';
import { ProfileFieldAmendmentService } from './profile-field-amendment.service';
import { ReadingAmendmentService } from './reading-amendment.service';

interface RevisionClaimRow {
  revision: number;
  data: Prisma.JsonValue;
}

interface AmendmentRow {
  id: string;
  orderId: string;
  kind: 'PALM_PHOTO' | 'PROFILE_FIELDS';
  requestedFields: string[];
  reason: string;
  status: 'REQUESTED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  data: Prisma.JsonValue;
  contentHash: string | null;
  revision: number;
  requestedAt: Date;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

type AmendmentKind = AmendmentRow['kind'];

@Injectable()
export class ReadingAmendmentFacade {
  private readonly logger = new Logger(ReadingAmendmentFacade.name);

  constructor(
    private readonly amendments: ReadingAmendmentService,
    private readonly profileFields: ProfileFieldAmendmentService,
    private readonly completeness: IntakeCompletenessService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  getCompleteness(orderId: string) {
    return this.completeness.getForOrder(orderId);
  }

  requestProfileFields(
    orderId: string,
    expertId: string,
    dto: CreateProfileFieldAmendmentDto,
  ) {
    return this.profileFields.request(orderId, expertId, dto);
  }

  async requestPalmPhoto(orderId: string, expertId: string, dto: CreatePalmAmendmentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        orderNumber: true,
        user: { select: { email: true, firstName: true } },
      },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');
    if (!['COMPLETED', 'AWAITING_VALIDATION'].includes(order.status)) {
      throw new ConflictException(
        `Une demande de complément ne peut être créée dans l’état ${order.status}`,
      );
    }

    const active = await this.prisma.$queryRaw<
      Array<{ id: string; kind: AmendmentKind; status: string }>
    >(Prisma.sql`
      SELECT "id", "kind", "status" FROM "ReadingIntakeAmendment"
      WHERE "orderId" = ${orderId}
        AND "status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')
      LIMIT 1
    `);
    if (active.length > 0) {
      throw new ConflictException(
        active[0].status === 'SUBMITTED'
          ? 'Un complément transmis attend encore la vérification'
          : 'Une demande de complément est déjà ouverte pour cette commande',
      );
    }

    const amendment = await this.amendments.requestPalmPhoto(orderId, expertId, dto);
    try {
      await this.email.send({
        to: order.user.email,
        subject: 'Une action est demandée dans votre Sanctuaire Lumira',
        template: 'reading-amendment-requested',
        messageId: `<lumira-amendment-${amendment.id}@oraclelumira.com>`,
        context: {
          firstName: order.user.firstName,
          orderNumber: order.orderNumber,
          reason: amendment.reason,
          expiresAt: new Date(amendment.expiresAt).toLocaleDateString('fr-FR'),
          sanctuaireLink: `${this.getWebUrl()}/sanctuaire`,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Demande ${amendment.id} créée mais email non envoyé: ${
          error instanceof Error ? error.message : 'erreur inconnue'
        }`,
      );
    }

    return amendment;
  }

  async listForClient(userId: string) {
    await this.expireDrafts({ userId });
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      SELECT "id", "orderId", "kind", "requestedFields", "reason", "status",
             "data", "contentHash", "revision", "requestedAt", "submittedAt",
             "reviewedAt", "expiresAt", "createdAt", "updatedAt"
      FROM "ReadingIntakeAmendment"
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
    await this.expireDrafts({ orderId });
    const rows = await this.prisma.$queryRaw<AmendmentRow[]>(Prisma.sql`
      SELECT "id", "orderId", "kind", "requestedFields", "reason", "status",
             "data", "contentHash", "revision", "requestedAt", "submittedAt",
             "reviewedAt", "expiresAt", "createdAt", "updatedAt"
      FROM "ReadingIntakeAmendment"
      WHERE "orderId" = ${orderId}
      ORDER BY "createdAt" DESC
    `);
    return rows.map((row) => this.toPublic(row));
  }

  async saveDraft(userId: string, amendmentId: string, dto: SaveReadingAmendmentDraftDto) {
    const kind = await this.getKind({ amendmentId, userId });
    if (kind === 'PROFILE_FIELDS') {
      const profileDto: SaveProfileFieldAmendmentDraftDto = {
        expectedRevision: dto.expectedRevision,
        values: dto.values ?? {},
      };
      return this.profileFields.saveDraft(userId, amendmentId, profileDto);
    }
    const palmDto: SavePalmAmendmentDraftDto = {
      expectedRevision: dto.expectedRevision,
      storageRef: dto.storageRef,
      palmRole: dto.palmRole ?? 'PALM_UNKNOWN',
    };
    return this.amendments.savePalmDraft(userId, amendmentId, palmDto);
  }

  async submit(userId: string, amendmentId: string, dto: SubmitReadingAmendmentDto) {
    const kind = await this.getKind({ amendmentId, userId });
    if (kind === 'PROFILE_FIELDS') {
      const profileDto: SubmitProfileFieldAmendmentDto = {
        expectedRevision: dto.expectedRevision,
        values: dto.values ?? {},
      };
      return this.profileFields.submit(userId, amendmentId, profileDto);
    }
    const storageRef = dto.storageRef?.trim();
    if (!storageRef) {
      throw new BadRequestException('Ajoutez une photo de paume avant de la transmettre');
    }
    const palmDto: SubmitPalmAmendmentDto = {
      expectedRevision: dto.expectedRevision,
      storageRef,
      palmRole: dto.palmRole ?? 'PALM_UNKNOWN',
    };
    return this.amendments.submitPalm(userId, amendmentId, palmDto);
  }

  savePalmDraft(userId: string, amendmentId: string, dto: SavePalmAmendmentDraftDto) {
    return this.amendments.savePalmDraft(userId, amendmentId, dto);
  }

  submitPalm(userId: string, amendmentId: string, dto: SubmitPalmAmendmentDto) {
    return this.amendments.submitPalm(userId, amendmentId, dto);
  }

  async approve(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    await this.ensureOriginalInputProjection(orderId);
    const kind = await this.getKind({ amendmentId, orderId });
    if (kind === 'PROFILE_FIELDS') {
      return this.profileFields.approve(orderId, amendmentId, expertId, dto);
    }
    return this.amendments.approvePalm(orderId, amendmentId, expertId, dto);
  }

  approvePalm(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    return this.approve(orderId, amendmentId, expertId, dto);
  }

  async reject(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    const kind = await this.getKind({ amendmentId, orderId });
    if (kind === 'PROFILE_FIELDS') {
      return this.profileFields.reject(orderId, amendmentId, expertId, dto);
    }
    return this.amendments.rejectPalm(orderId, amendmentId, expertId, dto);
  }

  rejectPalm(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    return this.reject(orderId, amendmentId, expertId, dto);
  }

  async requestRetake(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    const kind = await this.getKind({ amendmentId, orderId });
    if (kind === 'PROFILE_FIELDS') {
      return this.profileFields.requestRetake(orderId, amendmentId, expertId, dto);
    }
    return this.amendments.requestRetake(orderId, amendmentId, expertId, dto);
  }

  async cancel(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    const kind = await this.getKind({ amendmentId, orderId });
    if (kind === 'PROFILE_FIELDS') {
      return this.profileFields.cancel(orderId, amendmentId, expertId, dto);
    }
    return this.amendments.cancel(orderId, amendmentId, expertId, dto);
  }

  async getPhotoReference(options: {
    amendmentId: string;
    kind?: 'face' | 'palm';
    userId?: string;
    orderId?: string;
  }) {
    const kind = await this.getKind(options);
    if (kind === 'PROFILE_FIELDS') {
      if (!options.kind) throw new NotFoundException('Type de photo manquant');
      return this.profileFields.getPhotoReference({
        amendmentId: options.amendmentId,
        kind: options.kind,
        userId: options.userId,
        orderId: options.orderId,
      });
    }
    return this.amendments.getPhotoReference({
      amendmentId: options.amendmentId,
      userId: options.userId,
      orderId: options.orderId,
    });
  }

  async createRevisedReading(
    orderId: string,
    amendmentId: string,
    expert: Expert,
    dto: ReviewPalmAmendmentDto,
  ) {
    const kind = await this.getKind({ amendmentId, orderId });
    const operationId = `rev_${randomUUID()}`;
    const claim = {
      id: operationId,
      status: 'CLAIMED',
      startedAt: new Date().toISOString(),
      expertId: expert.id,
    };
    const claimed = await this.prisma.$queryRaw<RevisionClaimRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "data" = "data" || jsonb_build_object(
            'revisionClaim', ${JSON.stringify(claim)}::JSONB
          ),
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "orderId" = ${orderId}
        AND "status" = 'APPROVED'
        AND "revision" = ${dto.expectedRevision}
        AND COALESCE("data"->>'revisionQueuedAt', '') = ''
        AND COALESCE("data"#>>'{revisionClaim,status}', '') <> 'CLAIMED'
      RETURNING "revision", "data"
    `);
    if (claimed.length !== 1) {
      throw new ConflictException({
        code: 'AMENDMENT_REVISION_ALREADY_CLAIMED',
        message: 'Cette révision est déjà en cours ou a été lancée. Actualisez le dossier.',
      });
    }

    try {
      const reviewDto: ReviewProfileFieldAmendmentDto = {
        ...dto,
        expectedRevision: claimed[0].revision,
      };
      const result =
        kind === 'PROFILE_FIELDS'
          ? await this.profileFields.createRevisedReading(
              orderId,
              amendmentId,
              expert,
              reviewDto,
            )
          : await this.amendments.createRevisedReading(orderId, amendmentId, expert, reviewDto);

      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "ReadingIntakeAmendment"
        SET "data" = "data" - 'revisionClaim',
            "revision" = "revision" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${amendmentId}
          AND "orderId" = ${orderId}
          AND "data"#>>'{revisionClaim,id}' = ${operationId}
      `);
      const refreshed = (await this.listForExpert(orderId)).find(
        (item) => item.id === amendmentId,
      );
      return refreshed && result && typeof result === 'object'
        ? { ...(result as Record<string, unknown>), amendment: refreshed }
        : result;
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
          AND "data"#>>'{revisionClaim,id}' = ${operationId}
          AND COALESCE("data"->>'revisionQueuedAt', '') = ''
      `);
      throw error;
    }
  }

  private async getKind(options: {
    amendmentId: string;
    userId?: string;
    orderId?: string;
  }): Promise<AmendmentKind> {
    let rows: Array<{ kind: AmendmentKind }>;
    if (options.userId) {
      rows = await this.prisma.$queryRaw<Array<{ kind: AmendmentKind }>>(Prisma.sql`
        SELECT "kind" FROM "ReadingIntakeAmendment"
        WHERE "id" = ${options.amendmentId} AND "userId" = ${options.userId}
        LIMIT 1
      `);
    } else if (options.orderId) {
      rows = await this.prisma.$queryRaw<Array<{ kind: AmendmentKind }>>(Prisma.sql`
        SELECT "kind" FROM "ReadingIntakeAmendment"
        WHERE "id" = ${options.amendmentId} AND "orderId" = ${options.orderId}
        LIMIT 1
      `);
    } else {
      throw new NotFoundException('Périmètre de complément manquant');
    }
    if (!rows[0]) throw new NotFoundException('Demande de complément introuvable');
    return rows[0].kind;
  }

  private async ensureOriginalInputProjection(orderId: string): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            clientInputs: true,
            readingIntake: {
              select: {
                status: true,
                data: true,
                contentHash: true,
                sealedAt: true,
              },
            },
          },
        });
        if (!order) throw new NotFoundException('Commande non trouvée');

        const clientInputs = this.asRecord(order.clientInputs);
        const existing = this.asRecord(clientInputs.readingIntake);
        const existingProfile = this.asRecord(existing.profile);
        if (
          this.nonEmptyString(existing.sealedAt) &&
          this.nonEmptyString(existing.contentHash) &&
          Object.keys(existingProfile).length > 0
        ) {
          return;
        }

        const intake = order.readingIntake;
        if (
          intake?.status !== 'SEALED' ||
          !intake.sealedAt ||
          !intake.contentHash ||
          !intake.data
        ) {
          throw new ConflictException('Le dossier scellé original est introuvable');
        }

        const rawProfile = this.asRecord(intake.data);
        await tx.order.update({
          where: { id: orderId },
          data: {
            clientInputs: {
              ...clientInputs,
              readingIntake: {
                version: 'relational-reading-intake-v1',
                sealedAt: intake.sealedAt.toISOString(),
                contentHash: intake.contentHash,
                profile: {
                  ...rawProfile,
                  facePhotoUrl:
                    this.nonEmptyString(rawProfile.facePhotoUrl) ??
                    this.nonEmptyString(rawProfile.facePhoto),
                  palmPhotoUrl:
                    this.nonEmptyString(rawProfile.palmPhotoUrl) ??
                    this.nonEmptyString(rawProfile.palmPhoto),
                },
              },
            } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async expireDrafts(scope: { userId?: string; orderId?: string }) {
    if (scope.userId) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "ReadingIntakeAmendment"
        SET "status" = 'CANCELLED',
            "data" = "data" || '{"cancelReason":"EXPIRED"}'::JSONB,
            "revision" = "revision" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${scope.userId}
          AND "status" IN ('REQUESTED', 'DRAFT')
          AND "expiresAt" <= CURRENT_TIMESTAMP
      `);
      return;
    }
    if (scope.orderId) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "ReadingIntakeAmendment"
        SET "status" = 'CANCELLED',
            "data" = "data" || '{"cancelReason":"EXPIRED"}'::JSONB,
            "revision" = "revision" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "orderId" = ${scope.orderId}
          AND "status" IN ('REQUESTED', 'DRAFT')
          AND "expiresAt" <= CURRENT_TIMESTAMP
      `);
    }
  }

  private toPublic(row: AmendmentRow) {
    const data =
      row.kind === 'PROFILE_FIELDS'
        ? this.sanitizeProfileFieldData(row.data)
        : this.asRecord(row.data);
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

  private sanitizeProfileFieldData(value: Prisma.JsonValue): Record<string, unknown> {
    const data = { ...this.asRecord(value) };
    const values = { ...this.asRecord(data.values) };
    const previousValues = { ...this.asRecord(data.previousValues) };
    const photoFields: string[] = [];
    for (const key of ['facePhotoUrl', 'palmPhotoUrl'] as const) {
      if (this.nonEmptyString(values[key])) photoFields.push(key);
      delete values[key];
      delete previousValues[key];
    }
    delete data.faceAsset;
    delete data.palmAsset;
    data.values = values;
    data.previousValues = previousValues;
    data.photoFields = photoFields;
    return data;
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

  private getWebUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }
}
