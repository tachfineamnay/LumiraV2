import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { CreateProfileFieldAmendmentDto } from './dto/profile-field-amendment.dto';
import { IntakeCompletenessService } from './intake-completeness.service';
import {
  normalizeRequestedProfileFields,
  profileFieldLabels,
  publicProfileFields,
} from './profile-field-catalog';
import {
  ProfileAmendmentRow,
  asRecord,
  parseAmendmentExpiry,
  resolveOriginalInput,
  toPublicProfileAmendment,
} from './profile-field-amendment.shared';

@Injectable()
export class ProfileFieldAmendmentRequestService {
  private readonly logger = new Logger(ProfileFieldAmendmentRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly completeness: IntakeCompletenessService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async request(orderId: string, expertId: string, dto: CreateProfileFieldAmendmentDto) {
    const validation = await this.completeness.assertRequestable(
      orderId,
      dto.fields,
      dto.invalidFields ?? [],
    );
    const fields = normalizeRequestedProfileFields(validation.fields);
    const visibleFields = publicProfileFields(fields);
    const invalidFields = validation.invalidFields;
    const reason = dto.reason.trim();
    const expiresAt = parseAmendmentExpiry(dto.expiresAt);

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
        if (!order) throw new NotFoundException('Commande non trouvée');
        if (!['PAID', 'COMPLETED', 'AWAITING_VALIDATION', 'FAILED'].includes(order.status)) {
          throw new ConflictException(
            `La commande ne peut pas recevoir de complément dans son état actuel (${order.status})`,
          );
        }
        resolveOriginalInput(asRecord(order.clientInputs), order.readingIntake);

        await tx.$executeRaw(Prisma.sql`
          UPDATE "ReadingIntakeAmendment"
          SET "status" = 'CANCELLED',
              "data" = "data" || '{"cancelReason":"EXPIRED"}'::JSONB,
              "revision" = "revision" + 1,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "orderId" = ${orderId}
            AND "status" IN ('REQUESTED', 'DRAFT')
            AND "expiresAt" <= CURRENT_TIMESTAMP
        `);

        const active = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
          SELECT "id", "status"
          FROM "ReadingIntakeAmendment"
          WHERE "orderId" = ${orderId}
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

        const currentByKey = new Map(
          validation.result.fields.map((field) => [field.key, field.displayValue]),
        );
        const previousValues = Object.fromEntries(
          visibleFields.map((field) => [field, currentByKey.get(field) ?? null]),
        );
        const id = `ram_${randomUUID()}`;
        const data = {
          schemaVersion: '2026-08-05-required-profile-fields-v1',
          fieldLabels: profileFieldLabels(visibleFields),
          previousValues,
          invalidFields,
          values: {},
        };
        const rows = await tx.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
          INSERT INTO "ReadingIntakeAmendment" (
            "id", "orderId", "userId", "readingIntakeId", "kind",
            "requestedFields", "reason", "status", "data", "revision",
            "requestedByExpertId", "requestedAt", "expiresAt", "createdAt", "updatedAt"
          ) VALUES (
            ${id}, ${order.id}, ${order.userId}, ${order.readingIntake?.id ?? null},
            'PROFILE_FIELDS', ARRAY[${Prisma.join(fields)}]::TEXT[], ${reason}, 'REQUESTED',
            ${JSON.stringify(data)}::JSONB, 0, ${expertId}, CURRENT_TIMESTAMP,
            ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING *
        `);

        await tx.notification.create({
          data: {
            userId: order.userId,
            type: 'SYSTEM',
            title: 'Votre dossier doit être complété',
            message: `${reason} Éléments demandés : ${profileFieldLabels(visibleFields).join(', ')}.`,
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
          amendment: toPublicProfileAmendment(rows[0]),
          recipient: order.user,
          orderNumber: order.orderNumber,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    try {
      await this.email.send({
        to: result.recipient.email,
        subject: 'Votre dossier Lumira doit être complété',
        template: 'reading-amendment-requested',
        messageId: `<lumira-profile-fields-${result.amendment.id}@oraclelumira.com>`,
        context: {
          firstName: result.recipient.firstName,
          orderNumber: result.orderNumber,
          reason: `${reason} (${profileFieldLabels(visibleFields).join(', ')})`,
          expiresAt: expiresAt.toLocaleDateString('fr-FR'),
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

  private getWebUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }
}
