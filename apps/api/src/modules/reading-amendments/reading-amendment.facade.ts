import { ConflictException, Injectable } from '@nestjs/common';
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

@Injectable()
export class ReadingAmendmentFacade {
  constructor(
    private readonly amendments: ReadingAmendmentService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async requestPalmPhoto(orderId: string, expertId: string, dto: CreatePalmAmendmentDto) {
    const amendment = await this.amendments.requestPalmPhoto(orderId, expertId, dto);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        user: { select: { email: true, firstName: true } },
      },
    });

    if (order) {
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
    }

    return amendment;
  }

  listForClient(userId: string) {
    return this.amendments.listForClient(userId);
  }

  listForExpert(orderId: string) {
    return this.amendments.listForExpert(orderId);
  }

  savePalmDraft(userId: string, amendmentId: string, dto: SavePalmAmendmentDraftDto) {
    return this.amendments.savePalmDraft(userId, amendmentId, dto);
  }

  submitPalm(userId: string, amendmentId: string, dto: SubmitPalmAmendmentDto) {
    return this.amendments.submitPalm(userId, amendmentId, dto);
  }

  approvePalm(
    orderId: string,
    amendmentId: string,
    expertId: string,
    dto: ReviewPalmAmendmentDto,
  ) {
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

  /**
   * Claims a revision before calling the existing reopen/generation workflow.
   * This closes the gap where two expert clicks could both enqueue V2 before
   * ReadingAmendmentService persisted revisionQueuedAt.
   */
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
      const refreshed = (await this.amendments.listForExpert(orderId)).find(
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

  private getWebUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000'
    );
  }
}
