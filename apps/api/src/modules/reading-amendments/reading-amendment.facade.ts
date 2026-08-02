import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expert, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import {
  CreatePalmAmendmentDto,
  ReviewPalmAmendmentDto,
  SavePalmAmendmentDraftDto,
  SubmitPalmAmendmentDto,
} from './dto/reading-amendment.dto';
import { ReadingAmendmentService } from './reading-amendment.service';

interface RevisionClaimRow {
  revision: number;
  data: Prisma.JsonValue;
}

interface AmendmentRow {
  id: string;
  orderId: string;
  kind: 'PALM_PHOTO';
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

@Injectable()
export class ReadingAmendmentFacade {
  constructor(
    private readonly amendments: ReadingAmendmentService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

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

    // A photo delivered before the deadline remains reviewable afterward. The
    // legacy core expiry helper also includes SUBMITTED, so guard that state
    // before delegating and never let a received photo be silently cancelled.
    const submitted = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "ReadingIntakeAmendment"
      WHERE "orderId" = ${orderId}
        AND "kind" = 'PALM_PHOTO'
        AND "status" = 'SUBMITTED'
      LIMIT 1
    `);
    if (submitted.length > 0) {
      throw new ConflictException('Une photo de paume transmise attend encore la vérification');
    }

    const amendment = await this.amendments.requestPalmPhoto(orderId, expertId, dto);
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

  savePalmDraft(userId: string, amendmentId: string, dto: SavePalmAmendmentDraftDto) {
    return this.amendments.savePalmDraft(userId, amendmentId, dto);
  }

  submitPalm(userId: string, amendmentId: string, dto: SubmitPalmAmendmentDto) {
    return this.amendments.submitPalm(userId, amendmentId, dto);
  }

  async approvePalm(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    await this.ensureOriginalInputProjection(orderId);
    return this.amendments.approvePalm(orderId, amendmentId, expertId, dto);
  }

  rejectPalm(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    return this.amendments.rejectPalm(orderId, amendmentId, expertId, dto);
  }

  requestRetake(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    return this.amendments.requestRetake(orderId, amendmentId, expertId, dto);
  }

  cancel(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
    return this.amendments.cancel(orderId, amendmentId, expertId, dto);
  }

  getPhotoReference(options: { amendmentId: string; userId?: string; orderId?: string }) {
    return this.amendments.getPhotoReference(options);
  }

  /** Claims the approved amendment before any reopen or generation side effect. */
  async createRevisedReading(
    orderId: string,
    amendmentId: string,
    expert: Expert,
    dto: ReviewPalmAmendmentDto,
  ) {
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
      const result = await this.amendments.createRevisedReading(orderId, amendmentId, expert, {
        ...dto,
        expectedRevision: claimed[0].revision,
      });

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

  /**
   * Current orders store their sealed intake in ReadingIntake.data. Older
   * generation helpers still expect an immutable clientInputs.readingIntake
   * projection. Materialize that projection once without mutating ReadingIntake.
   */
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

        await tx.order.update({
          where: { id: orderId },
          data: {
            clientInputs: {
              ...clientInputs,
              readingIntake: {
                version: 'relational-reading-intake-v1',
                sealedAt: intake.sealedAt.toISOString(),
                contentHash: intake.contentHash,
                profile: intake.data,
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
    );
  }
}
