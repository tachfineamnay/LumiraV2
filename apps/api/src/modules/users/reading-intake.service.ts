import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, UserProfile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const CONSENT_PURPOSE = 'PERSONALIZED_SPIRITUAL_EXPERIENCE';
const INTAKE_VERSION = '2026-07-18-user-agency-v1';
const ACTIVE_READING_STATUSES = ['PAID', 'PROCESSING', 'AWAITING_VALIDATION'] as const;

type ReadingIntakeSnapshot = {
  version: string;
  sealedAt: string;
  sealedBy: 'CLIENT';
  consentVersion: string;
  contentHash: string;
  profile: {
    birthDate: string;
    birthTime: string | null;
    birthPlace: string;
    specificQuestion: string | null;
    objective: string | null;
    facePhotoUrl: string | null;
    palmPhotoUrl: string | null;
    highs: string | null;
    lows: string | null;
    strongSide: string | null;
    weakSide: string | null;
    strongZone: string | null;
    weakZone: string | null;
    deliveryStyle: string | null;
    pace: number | null;
    ailments: string | null;
    fears: string | null;
    rituals: string | null;
  };
};

@Injectable()
export class ReadingIntakeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seals the client-owned source material used for the first reading.
   * The editable profile remains the client profile, while Order.clientInputs
   * keeps an auditable snapshot of what the client explicitly transmitted.
   */
  async seal(userId: string, dto: UpdateProfileDto): Promise<{
    success: true;
    sealed: true;
    orderId: string;
    sealedAt: string;
    profile: UserProfile;
  }> {
    const birthDate = dto.birthDate;
    const birthPlace = dto.birthPlace?.trim();
    const consentVersion = dto.consent?.version || INTAKE_VERSION;

    if (!dto.consent?.accepted) {
      throw new BadRequestException('La confirmation explicite est requise pour sceller le dossier');
    }
    if (!birthDate || !birthPlace) {
      throw new BadRequestException('La date et le lieu de naissance sont requis');
    }

    this.assertPrivatePhoto(dto.facePhotoUrl, userId);
    this.assertPrivatePhoto(dto.palmPhotoUrl, userId);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          userId,
          status: { in: [...ACTIVE_READING_STATUSES] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          clientInputs: true,
        },
      });

      if (!order) {
        throw new BadRequestException('Aucune commande payée ne peut recevoir ce dossier');
      }

      const existingInputs = this.asRecord(order.clientInputs);
      const existingSnapshot = this.asRecord(existingInputs.readingIntake);
      if (existingSnapshot.sealedAt) {
        throw new ConflictException(
          'Ce dossier est déjà scellé. Les éléments transmis ne peuvent plus être remplacés pendant la production.',
        );
      }
      if (order.status !== 'PAID') {
        throw new ConflictException(
          'La production a déjà commencé. Les éléments de cette lecture ne peuvent plus être modifiés.',
        );
      }

      const sealedAt = new Date().toISOString();
      const profilePayload: ReadingIntakeSnapshot['profile'] = {
        birthDate,
        birthTime: dto.birthTime || null,
        birthPlace,
        specificQuestion: this.clean(dto.specificQuestion),
        objective: this.clean(dto.objective),
        facePhotoUrl: dto.facePhotoUrl || null,
        palmPhotoUrl: dto.palmPhotoUrl || null,
        highs: this.clean(dto.highs),
        lows: this.clean(dto.lows),
        strongSide: this.clean(dto.strongSide),
        weakSide: this.clean(dto.weakSide),
        strongZone: this.clean(dto.strongZone),
        weakZone: this.clean(dto.weakZone),
        deliveryStyle: this.clean(dto.deliveryStyle),
        pace: dto.pace ?? null,
        ailments: this.clean(dto.ailments),
        fears: this.clean(dto.fears),
        rituals: this.clean(dto.rituals),
      };
      const contentHash = createHash('sha256')
        .update(JSON.stringify(profilePayload))
        .digest('hex');
      const snapshot: ReadingIntakeSnapshot = {
        version: INTAKE_VERSION,
        sealedAt,
        sealedBy: 'CLIENT',
        consentVersion,
        contentHash,
        profile: profilePayload,
      };

      const profile = await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...profilePayload,
          profileCompleted: true,
          submittedAt: new Date(sealedAt),
        },
        update: {
          ...profilePayload,
          profileCompleted: true,
          submittedAt: new Date(sealedAt),
        },
      });

      await tx.consentRecord.upsert({
        where: {
          userId_purpose_version: {
            userId,
            purpose: CONSENT_PURPOSE,
            version: consentVersion,
          },
        },
        create: {
          userId,
          purpose: CONSENT_PURPOSE,
          version: consentVersion,
        },
        update: { revokedAt: null },
      });

      await tx.onboardingProgress.upsert({
        where: { userId },
        create: {
          userId,
          currentStep: 5,
          status: 'COMPLETED',
          data: {} as Prisma.InputJsonValue,
          completedAt: new Date(sealedAt),
        },
        update: {
          currentStep: 5,
          status: 'COMPLETED',
          completedAt: new Date(sealedAt),
        },
      });

      const sealed = await tx.order.updateMany({
        where: { id: order.id, status: 'PAID' },
        data: {
          clientInputs: {
            ...existingInputs,
            readingIntake: snapshot,
          } as Prisma.InputJsonValue,
        },
      });
      if (sealed.count !== 1) {
        throw new ConflictException(
          'La production vient de démarrer. Rechargez la page pour voir le nouvel état.',
        );
      }

      return { success: true, sealed: true, orderId: order.id, sealedAt, profile };
    });
  }

  /** Profile preferences may evolve, but not while they are the live source of an active sealed reading. */
  async assertProfileEditable(userId: string): Promise<void> {
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: { in: [...ACTIVE_READING_STATUSES] },
        clientInputs: { not: Prisma.JsonNull },
      },
      orderBy: { createdAt: 'desc' },
      select: { clientInputs: true },
    });
    const snapshot = this.asRecord(this.asRecord(activeOrder?.clientInputs).readingIntake);
    if (snapshot.sealedAt) {
      throw new ConflictException(
        'Votre dossier de lecture est scellé pendant la production. Vos préférences générales pourront être modifiées après la livraison.',
      );
    }
  }

  private clean(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private assertPrivatePhoto(value: string | null | undefined, userId: string) {
    if (!value) return;
    if (!value.startsWith(`s3://onboarding/${userId}/`) || value.includes('..')) {
      throw new BadRequestException('Référence de photo privée invalide');
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
