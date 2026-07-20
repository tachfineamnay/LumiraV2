import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { createHash } from 'crypto';
import { Prisma, UserProfile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OnboardingDraftDataDto, UpdateProfileDto } from './dto/update-profile.dto';
import {
  PrivateOnboardingPhotoService,
  ValidatedOnboardingPhoto,
} from '../uploads/private-onboarding-photo.service';

const CONSENT_PURPOSE = 'PERSONALIZED_SPIRITUAL_EXPERIENCE';
const CONSENT_VERSION = '2026-07-18-user-agency-v1';
const INTAKE_SCHEMA_VERSION = '2026-07-20-order-intake-v1';
const ACTIVE_READING_STATUSES = ['PAID', 'PROCESSING', 'AWAITING_VALIDATION'] as const;

type IntakeProfile = {
  openReading?: boolean;
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

type SnapshotAsset = {
  storageRef: string;
  key: string;
  contentType: string;
  size: number;
  etag: string;
  versionId: string | null;
};

type ReadingIntakeSnapshot = {
  version: string;
  revision: number;
  sealedAt: string;
  sealedBy: 'CLIENT';
  consentVersion: string;
  contentHash: string;
  profile: IntakeProfile;
  assets: {
    face: SnapshotAsset | null;
    palm: SnapshotAsset | null;
  };
};

type SealResult = {
  success: true;
  sealed: true;
  orderId: string;
  sealedAt: string;
  profile: UserProfile;
  revision: number;
  contentHash: string;
};

@Injectable()
export class ReadingIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privatePhotos: PrivateOnboardingPhotoService,
  ) {}

  /**
   * Seal exactly the server-side revision reviewed by the client. Required
   * orders use ReadingIntake as their canonical source; pre-migration orders
   * retain the legacy DTO/clientInputs path.
   */
  async seal(userId: string, dto: UpdateProfileDto): Promise<SealResult> {
    const activeOrderGuard = await this.prisma.order.findFirst({
      where: {
        userId,
        intakeRequired: true,
        status: {
          in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'],
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (activeOrderGuard?.id !== dto.orderId) {
      throw new ConflictException({
        code: 'ACTIVE_ORDER_CHANGED',
        message: 'La commande active a changé. Rechargez le formulaire avant de le sceller.',
        activeOrderId: activeOrderGuard?.id ?? null,
      });
    }

    if (!dto.consent?.accepted) {
      throw new BadRequestException(
        'La confirmation explicite est requise pour sceller le dossier',
      );
    }

    const requiredOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        intakeRequired: true,
        status: { in: [...ACTIVE_READING_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        clientInputs: true,
        readingIntake: true,
      },
    });

    if (requiredOrder) {
      return this.sealOrderScoped(userId, dto, requiredOrder);
    }
    return this.sealLegacy(userId, dto);
  }

  private async sealOrderScoped(
    userId: string,
    dto: UpdateProfileDto,
    order: {
      id: string;
      status: string;
      clientInputs: Prisma.JsonValue | null;
      readingIntake: {
        id: string;
        status: string;
        revision: number;
        data: Prisma.JsonValue;
        contentHash: string | null;
        sealedAt: Date | null;
      } | null;
    },
  ): Promise<SealResult> {
    if (!order.readingIntake) {
      throw new BadRequestException('Enregistrez votre brouillon avant de le sceller');
    }

    if (order.readingIntake.status === 'SEALED') {
      if (dto.intakeRevision !== undefined && dto.intakeRevision !== order.readingIntake.revision) {
        throw this.staleDraftConflict(order.readingIntake.revision);
      }
      return this.readIdempotentSeal(userId, order.id, order.readingIntake);
    }

    if (dto.intakeRevision === undefined) {
      throw new BadRequestException('La révision relue du brouillon est requise');
    }
    if (dto.intakeRevision !== order.readingIntake.revision) {
      throw this.staleDraftConflict(order.readingIntake.revision);
    }
    if (order.status !== 'PAID') {
      throw new ConflictException(
        'La production a déjà commencé. Les éléments de cette lecture ne peuvent plus être modifiés.',
      );
    }

    const draft = this.validateStoredDraft(order.readingIntake.data);
    const profilePayload = this.profileFromDraft(draft);
    this.assertRequiredBirthData(profilePayload);
    const assets = await this.validatePhotoAssets(userId, profilePayload);
    const normalizedDraft = this.toJson(draft);
    const contentHash = this.hashSnapshot(order.readingIntake.revision, profilePayload, assets);
    const sealedAt = new Date();

    return this.withSerializableRetry(async (tx) => {
      const activeOrderInTransaction = await tx.order.findFirst({
        where: {
          userId,
          intakeRequired: true,
          status: {
            in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'],
          },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      if (activeOrderInTransaction?.id !== dto.orderId) {
        throw new ConflictException({
          code: 'ACTIVE_ORDER_CHANGED',
          message: 'La commande active a changé pendant le scellement. Rechargez le formulaire.',
          activeOrderId: activeOrderInTransaction?.id ?? null,
        });
      }

      const currentOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: {
          id: true,
          status: true,
          clientInputs: true,
          readingIntake: true,
        },
      });
      if (!currentOrder || currentOrder.readingIntake?.userId !== userId) {
        throw new BadRequestException('Commande de lecture introuvable');
      }

      const currentIntake = currentOrder.readingIntake;
      if (currentIntake.status === 'SEALED') {
        if (
          currentIntake.revision === order.readingIntake.revision &&
          currentIntake.contentHash === contentHash &&
          currentIntake.sealedAt
        ) {
          const profile = await tx.userProfile.findUnique({ where: { userId } });
          if (!profile) throw new ConflictException('Profil scellé introuvable');
          return {
            success: true,
            sealed: true,
            orderId: currentOrder.id,
            sealedAt: currentIntake.sealedAt.toISOString(),
            profile,
            revision: currentIntake.revision,
            contentHash,
          };
        }
        throw new ConflictException('Ce dossier est déjà scellé avec une autre version.');
      }
      if (
        currentOrder.status !== 'PAID' ||
        currentIntake.revision !== order.readingIntake.revision
      ) {
        throw this.staleDraftConflict(currentIntake.revision);
      }

      const consent = await tx.consentRecord.upsert({
        where: {
          userId_purpose_version: {
            userId,
            purpose: CONSENT_PURPOSE,
            version: CONSENT_VERSION,
          },
        },
        create: {
          userId,
          purpose: CONSENT_PURPOSE,
          version: CONSENT_VERSION,
          acceptedAt: sealedAt,
        },
        update: { revokedAt: null, acceptedAt: sealedAt },
      });

      const intakeUpdate = await tx.readingIntake.updateMany({
        where: {
          id: currentIntake.id,
          status: 'DRAFT',
          revision: order.readingIntake.revision,
        },
        data: {
          status: 'SEALED',
          currentStep: 4,
          data: normalizedDraft,
          contentHash,
          sealedAt,
          consentRecordId: consent.id,
        },
      });
      if (intakeUpdate.count !== 1) {
        throw this.staleDraftConflict(currentIntake.revision);
      }

      const snapshot = this.buildSnapshot(
        order.readingIntake.revision,
        sealedAt,
        contentHash,
        profilePayload,
        assets,
      );
      const existingInputs = this.asRecord(currentOrder.clientInputs);
      const orderUpdate = await tx.order.updateMany({
        where: { id: currentOrder.id, userId, status: 'PAID', intakeRequired: true },
        data: {
          clientInputs: {
            ...existingInputs,
            readingIntake: snapshot,
          } as Prisma.InputJsonValue,
        },
      });
      if (orderUpdate.count !== 1) {
        throw new ConflictException(
          'La production vient de démarrer. Rechargez la page pour voir le nouvel état.',
        );
      }

      const profile = await this.upsertProfile(tx, userId, profilePayload, sealedAt);
      await tx.onboardingProgress.upsert({
        where: { userId },
        create: {
          userId,
          currentStep: 4,
          status: 'COMPLETED',
          data: {} as Prisma.InputJsonValue,
          completedAt: sealedAt,
        },
        update: {
          currentStep: 4,
          status: 'COMPLETED',
          data: {} as Prisma.InputJsonValue,
          completedAt: sealedAt,
        },
      });

      return {
        success: true,
        sealed: true,
        orderId: currentOrder.id,
        sealedAt: sealedAt.toISOString(),
        profile,
        revision: order.readingIntake.revision,
        contentHash,
      };
    });
  }

  /** Compatibility path for orders created before intakeRequired existed. */
  private async sealLegacy(userId: string, dto: UpdateProfileDto): Promise<SealResult> {
    const profilePayload = this.profileFromLegacyDto(dto);
    this.assertRequiredBirthData(profilePayload);
    const assets = await this.validatePhotoAssets(userId, profilePayload);
    const contentHash = this.hashSnapshot(0, profilePayload, assets);
    const sealedAt = new Date();

    return this.withSerializableRetry(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          userId,
          intakeRequired: false,
          status: { in: [...ACTIVE_READING_STATUSES] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, clientInputs: true },
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

      const consent = await tx.consentRecord.upsert({
        where: {
          userId_purpose_version: {
            userId,
            purpose: CONSENT_PURPOSE,
            version: CONSENT_VERSION,
          },
        },
        create: {
          userId,
          purpose: CONSENT_PURPOSE,
          version: CONSENT_VERSION,
          acceptedAt: sealedAt,
        },
        update: { revokedAt: null, acceptedAt: sealedAt },
      });
      const snapshot = this.buildSnapshot(0, sealedAt, contentHash, profilePayload, assets);
      const orderUpdate = await tx.order.updateMany({
        where: { id: order.id, status: 'PAID', intakeRequired: false },
        data: {
          clientInputs: {
            ...existingInputs,
            readingIntake: snapshot,
          } as Prisma.InputJsonValue,
        },
      });
      if (orderUpdate.count !== 1) {
        throw new ConflictException(
          'La production vient de démarrer. Rechargez la page pour voir le nouvel état.',
        );
      }

      const profile = await this.upsertProfile(tx, userId, profilePayload, sealedAt);
      await tx.onboardingProgress.upsert({
        where: { userId },
        create: {
          userId,
          currentStep: 4,
          status: 'COMPLETED',
          data: {} as Prisma.InputJsonValue,
          completedAt: sealedAt,
        },
        update: {
          currentStep: 4,
          status: 'COMPLETED',
          data: {} as Prisma.InputJsonValue,
          completedAt: sealedAt,
        },
      });

      // Populate the new relation for legacy orders sealed after this release.
      await tx.readingIntake.create({
        data: {
          orderId: order.id,
          userId,
          status: 'SEALED',
          schemaVersion: INTAKE_SCHEMA_VERSION,
          currentStep: 4,
          data: this.toJson(this.draftFromProfile(profilePayload)),
          revision: 0,
          contentHash,
          sealedAt,
          consentRecordId: consent.id,
        },
      });

      return {
        success: true,
        sealed: true,
        orderId: order.id,
        sealedAt: sealedAt.toISOString(),
        profile,
        revision: 0,
        contentHash,
      };
    });
  }

  /** Profile preferences may evolve, but not while an active sealed reading exists. */
  async assertProfileEditable(userId: string): Promise<void> {
    const activeOrders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: [...ACTIVE_READING_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      select: { clientInputs: true, readingIntake: { select: { status: true } } },
    });
    for (const activeOrder of activeOrders) {
      const legacySnapshot = this.asRecord(this.asRecord(activeOrder.clientInputs).readingIntake);
      if (activeOrder.readingIntake?.status === 'SEALED' || legacySnapshot.sealedAt) {
        throw new ConflictException(
          'Votre dossier de lecture est scellé pendant la production. Vos préférences générales pourront être modifiées après la livraison.',
        );
      }
    }
  }

  private validateStoredDraft(value: Prisma.JsonValue): OnboardingDraftDataDto {
    const draft = plainToInstance(OnboardingDraftDataDto, this.asRecord(value));
    const errors = validateSync(draft, {
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    });
    if (errors.length > 0) {
      throw new BadRequestException(
        'Le brouillon contient des données invalides. Relisez les champs.',
      );
    }
    if (draft.openReading !== true && !draft.specificQuestion?.trim() && !draft.objective?.trim()) {
      throw new BadRequestException(
        'Ajoutez une question ou choisissez explicitement une lecture ouverte',
      );
    }

    return draft;
  }

  private profileFromDraft(draft: OnboardingDraftDataDto): IntakeProfile {
    return {
      birthDate: this.clean(draft.birthDate) || '',
      birthTime: this.clean(draft.birthTime),
      birthPlace: this.clean(draft.birthPlace) || '',
      specificQuestion: this.clean(draft.specificQuestion),
      objective: this.clean(draft.objective),
      facePhotoUrl: this.clean(draft.facePhoto) || this.clean(draft.facePhotoUrl),
      palmPhotoUrl: this.clean(draft.palmPhoto) || this.clean(draft.palmPhotoUrl),
      highs: this.clean(draft.highs),
      lows: this.clean(draft.lows),
      strongSide: this.clean(draft.strongSide),
      weakSide: this.clean(draft.weakSide),
      strongZone: this.clean(draft.strongZone),
      weakZone: this.clean(draft.weakZone),
      deliveryStyle: this.clean(draft.deliveryStyle),
      pace: draft.pace ?? null,
      ailments: this.clean(draft.ailments),
      fears: this.clean(draft.fears),
      rituals: this.clean(draft.rituals),
    };
  }

  private profileFromLegacyDto(dto: UpdateProfileDto): IntakeProfile {
    return {
      birthDate: this.clean(dto.birthDate) || '',
      birthTime: this.clean(dto.birthTime),
      birthPlace: this.clean(dto.birthPlace) || '',
      specificQuestion: this.clean(dto.specificQuestion),
      objective: this.clean(dto.objective),
      facePhotoUrl: this.clean(dto.facePhotoUrl),
      palmPhotoUrl: this.clean(dto.palmPhotoUrl),
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
  }

  private assertRequiredBirthData(profile: IntakeProfile) {
    if (!profile.birthDate || !profile.birthPlace) {
      throw new BadRequestException('La date et le lieu de naissance sont requis');
    }
  }

  private async validatePhotoAssets(
    userId: string,
    profile: IntakeProfile,
  ): Promise<{ face: SnapshotAsset | null; palm: SnapshotAsset | null }> {
    const [face, palm] = await Promise.all([
      profile.facePhotoUrl
        ? this.privatePhotos.validateOnboardingPhoto(profile.facePhotoUrl, userId, 'face')
        : Promise.resolve(null),
      profile.palmPhotoUrl
        ? this.privatePhotos.validateOnboardingPhoto(profile.palmPhotoUrl, userId, 'palm')
        : Promise.resolve(null),
    ]);
    return {
      face: this.snapshotAsset(face),
      palm: this.snapshotAsset(palm),
    };
  }

  private snapshotAsset(value: ValidatedOnboardingPhoto | null): SnapshotAsset | null {
    if (!value) return null;
    return {
      storageRef: value.storageRef,
      key: value.key,
      contentType: value.contentType,
      size: value.size,
      etag: value.etag,
      versionId: value.versionId,
    };
  }

  private hashSnapshot(
    revision: number,
    profile: IntakeProfile,
    assets: ReadingIntakeSnapshot['assets'],
  ) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          schemaVersion: INTAKE_SCHEMA_VERSION,
          revision,
          profile,
          assets,
        }),
      )
      .digest('hex');
  }

  private buildSnapshot(
    revision: number,
    sealedAt: Date,
    contentHash: string,
    profile: IntakeProfile,
    assets: ReadingIntakeSnapshot['assets'],
  ): ReadingIntakeSnapshot {
    return {
      version: INTAKE_SCHEMA_VERSION,
      revision,
      sealedAt: sealedAt.toISOString(),
      sealedBy: 'CLIENT',
      consentVersion: CONSENT_VERSION,
      contentHash,
      profile,
      assets,
    };
  }

  private upsertProfile(
    tx: Prisma.TransactionClient,
    userId: string,
    profile: IntakeProfile,
    submittedAt: Date,
  ) {
    return tx.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...profile,
        profileCompleted: true,
        submittedAt,
      },
      update: {
        ...profile,
        profileCompleted: true,
        submittedAt,
      },
    });
  }

  private async readIdempotentSeal(
    userId: string,
    orderId: string,
    intake: {
      revision: number;
      contentHash: string | null;
      sealedAt: Date | null;
    },
  ): Promise<SealResult> {
    if (!intake.contentHash || !intake.sealedAt) {
      throw new ConflictException('Le dossier scellé est incomplet');
    }
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) throw new ConflictException('Profil scellé introuvable');
    return {
      success: true,
      sealed: true,
      orderId,
      sealedAt: intake.sealedAt.toISOString(),
      profile,
      revision: intake.revision,
      contentHash: intake.contentHash,
    };
  }

  private draftFromProfile(profile: IntakeProfile): OnboardingDraftDataDto {
    return {
      schemaVersion: 2,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      birthPlace: profile.birthPlace,
      specificQuestion: profile.specificQuestion,
      objective: profile.objective,
      facePhoto: profile.facePhotoUrl,
      palmPhoto: profile.palmPhotoUrl,
      highs: profile.highs,
      lows: profile.lows,
      strongSide: profile.strongSide,
      weakSide: profile.weakSide,
      strongZone: profile.strongZone,
      weakZone: profile.weakZone,
      deliveryStyle: profile.deliveryStyle,
      pace: profile.pace,
      ailments: profile.ailments,
      fears: profile.fears,
      rituals: profile.rituals,
    };
  }

  private clean(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private toJson(value: object): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private staleDraftConflict(currentRevision: number) {
    return new ConflictException({
      statusCode: 409,
      code: 'STALE_DRAFT',
      message: 'Le brouillon a changé depuis votre dernière relecture.',
      currentRevision,
    });
  }

  private async withSerializableRetry<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || error.code === 'P2002');
        if (!retryable || attempt === 2) throw error;
      }
    }
    throw new ConflictException('Le dossier a été modifié simultanément. Réessayez.');
  }
}
