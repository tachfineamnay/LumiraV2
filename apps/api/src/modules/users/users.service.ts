import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User, Expert, UserProfile, ReadingIntake, OrderStatus } from '@prisma/client';
import { aggregateCapabilities, getHighestLevel, EntitlementsResponse } from '@packages/shared';
import { UpdateOnboardingProgressDto, UpdateProfileDto } from './dto/update-profile.dto';

const ONBOARDING_CONSENT_PURPOSE = 'PERSONALIZED_SPIRITUAL_EXPERIENCE';
const ONBOARDING_CONSENT_VERSION = '2026-07-18-user-agency-v1';
const READING_INTAKE_SCHEMA_VERSION = '2026-07-20-order-intake-v1';
const PAID_READING_STATUSES: OrderStatus[] = [
  'PAID',
  'PROCESSING',
  'AWAITING_VALIDATION',
  'COMPLETED',
  'FAILED',
];
const MAX_ONBOARDING_DRAFT_BYTES = 32 * 1024;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<(User & { profile: UserProfile | null }) | null> {
    const normalizedEmail = email.toLowerCase().trim();
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });
  }

  async findExpertByEmail(email: string): Promise<Expert | null> {
    const normalizedEmail = email.toLowerCase().trim();
    return this.prisma.expert.findUnique({
      where: { email: normalizedEmail },
    });
  }

  /**
   * Sanctuaire access is permanent after a paid order. Subscription records are
   * retained only as legacy billing metadata and must never authorize access.
   */
  async getEntitlements(userId: string): Promise<EntitlementsResponse> {
    const orderCount = await this.prisma.order.count({
      where: {
        userId,
        status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'] },
      },
    });

    const hasPaidOrder = orderCount > 0;
    const levels = hasPaidOrder ? [4] : [];
    const capabilities = aggregateCapabilities(levels);
    const highestLevel = getHighestLevel(levels);

    return {
      capabilities,
      products: hasPaidOrder ? ['lifetime-access'] : [],
      highestLevel,
      orderCount,
    };
  }

  /**
   * Get basic entitlements (maxLevel + capabilities) - legacy format
   */
  async getBasicEntitlements(
    userId: string,
  ): Promise<{ maxLevel: number; capabilities: string[] }> {
    const { highestLevel, capabilities } = await this.getEntitlements(userId);
    return {
      maxLevel: highestLevel,
      capabilities,
    };
  }

  async findAll(skip = 0, take = 20): Promise<{ users: User[]; total: number }> {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          subscriptionStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return { users: users as unknown as User[], total };
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find a user by email only if they have at least one paid/valid order.
   * Used for Sanctuaire passwordless authentication.
   * PENDING orders never grant access (prevents pay-what-you-want / amount-0 bypass).
   */
  async findUserWithPaidOrder(
    email: string,
  ): Promise<(User & { profile: UserProfile | null }) | null> {
    const normalizedEmail = email.toLowerCase().trim();
    // First find the user
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });

    if (!user) {
      return null;
    }

    // Check if user has at least one paid/valid order.
    // FAILED orders are included — paid orders where generation failed, user should still have access.
    const paidOrder = await this.prisma.order.findFirst({
      where: {
        userId: user.id,
        status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'] },
      },
    });

    if (!paidOrder) {
      return null;
    }

    return user;
  }

  /**
   * Create user if missing. Never overwrites PII on existing accounts.
   */
  async createIfNotExists(
    email: string,
    firstName: string,
    lastName: string,
    phone?: string,
  ): Promise<User> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return existing;
    }
    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName,
        lastName,
        phone: phone ?? null,
      },
    });
  }

  /**
   * Find or create a user by email (upsert).
   * Used for pre-registration before Stripe checkout.
   * Existing users are NOT overwritten (prevents profile takeover by email).
   */
  async upsertByEmail(
    email: string,
    firstName: string,
    lastName: string,
    phone?: string,
  ): Promise<User> {
    return this.createIfNotExists(email, firstName, lastName, phone);
  }

  /**
   * DEBUG: Get user and all their orders for diagnosis
   */
  async debugUserAndOrders(email: string): Promise<{
    email: string;
    user: { id: string; email: string; firstName: string; lastName: string } | null;
    orders: { id: string; status: string; amount: number; createdAt: Date }[];
    wouldAuth: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      return { email, user: null, orders: [], wouldAuth: false };
    }

    const orders = await this.prisma.order.findMany({
      where: { userId: user.id },
      select: { id: true, status: true, amount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Check if any order would pass auth
    const wouldAuth = orders.some(
      (o) =>
        ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'].includes(o.status) ||
        (o.status === 'PENDING' && o.amount === 0),
    );

    return { email, user, orders, wouldAuth };
  }

  /**
   * Get complete user profile data for Sanctuaire
   */
  async getUserProfile(userId: string): Promise<{
    user: User;
    profile: UserProfile | null;
    stats: { totalOrders: number; completedOrders: number };
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return null;
    }

    // Get order stats
    const [totalOrders, completedOrders] = await Promise.all([
      this.prisma.order.count({ where: { userId } }),
      this.prisma.order.count({ where: { userId, status: 'COMPLETED' } }),
    ]);

    return {
      user,
      profile: user.profile,
      stats: { totalOrders, completedOrders },
    };
  }

  /**
   * Get user's completed/delivered orders for Sanctuaire
   */
  async getCompletedOrders(userId: string): Promise<
    Array<{
      id: string;
      orderNumber: string;
      status: string;
      deliveredAt: Date | null;
      createdAt: Date;
      intakeRequired: boolean;
      intakeStatus: 'DRAFT' | 'SEALED' | null;
      intakeSealedAt: Date | null;
    }>
  > {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: ['COMPLETED', 'AWAITING_VALIDATION', 'PROCESSING', 'PAID'] },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deliveredAt: true,
        createdAt: true,
        intakeRequired: true,
        readingIntake: {
          select: {
            status: true,
            sealedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(({ readingIntake, ...order }) => ({
      ...order,
      intakeStatus: readingIntake?.status ?? null,
      intakeSealedAt: readingIntake?.sealedAt ?? null,
    }));
  }

  /**
   * Update or create user profile data
   */
  async updateProfile(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<{ success: boolean; profile: UserProfile }> {
    if (data.facePhotoUrl !== undefined)
      this.assertPrivateOnboardingPhoto(data.facePhotoUrl, userId);
    if (data.palmPhotoUrl !== undefined)
      this.assertPrivateOnboardingPhoto(data.palmPhotoUrl, userId);
    if (data.profileCompleted && !data.consent?.accepted) {
      throw new BadRequestException(
        'Le consentement explicite est requis pour finaliser le diagnostic',
      );
    }

    // Upsert the profile (create if not exists, update if exists)
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        birthDate: data.birthDate || null,
        birthTime: data.birthTime || null,
        birthPlace: data.birthPlace || null,
        specificQuestion: data.specificQuestion || null,
        objective: data.objective || null,
        facePhotoUrl: data.facePhotoUrl || null,
        palmPhotoUrl: data.palmPhotoUrl || null,
        highs: data.highs || null,
        lows: data.lows || null,
        strongSide: data.strongSide || null,
        weakSide: data.weakSide || null,
        strongZone: data.strongZone || null,
        weakZone: data.weakZone || null,
        deliveryStyle: data.deliveryStyle || null,
        pace: data.pace ?? null,
        ailments: data.ailments || null,
        fears: data.fears || null,
        rituals: data.rituals || null,
        profileCompleted: data.profileCompleted || false,
        submittedAt: data.profileCompleted ? new Date() : null,
      },
      update: {
        ...(data.birthDate !== undefined && { birthDate: data.birthDate }),
        ...(data.birthTime !== undefined && { birthTime: data.birthTime }),
        ...(data.birthPlace !== undefined && { birthPlace: data.birthPlace }),
        ...(data.specificQuestion !== undefined && { specificQuestion: data.specificQuestion }),
        ...(data.objective !== undefined && { objective: data.objective }),
        ...(data.facePhotoUrl !== undefined && { facePhotoUrl: data.facePhotoUrl }),
        ...(data.palmPhotoUrl !== undefined && { palmPhotoUrl: data.palmPhotoUrl }),
        ...(data.highs !== undefined && { highs: data.highs }),
        ...(data.lows !== undefined && { lows: data.lows }),
        ...(data.strongSide !== undefined && { strongSide: data.strongSide }),
        ...(data.weakSide !== undefined && { weakSide: data.weakSide }),
        ...(data.strongZone !== undefined && { strongZone: data.strongZone }),
        ...(data.weakZone !== undefined && { weakZone: data.weakZone }),
        ...(data.deliveryStyle !== undefined && { deliveryStyle: data.deliveryStyle }),
        ...(data.pace !== undefined && { pace: data.pace }),
        ...(data.ailments !== undefined && { ailments: data.ailments }),
        ...(data.fears !== undefined && { fears: data.fears }),
        ...(data.rituals !== undefined && { rituals: data.rituals }),
        ...(data.profileCompleted !== undefined && {
          profileCompleted: data.profileCompleted,
          ...(data.profileCompleted && { submittedAt: new Date() }),
        }),
      },
    });

    if (data.profileCompleted && data.consent) {
      await this.prisma.$transaction([
        this.prisma.consentRecord.upsert({
          where: {
            userId_purpose_version: {
              userId,
              purpose: ONBOARDING_CONSENT_PURPOSE,
              version: ONBOARDING_CONSENT_VERSION,
            },
          },
          create: {
            userId,
            purpose: ONBOARDING_CONSENT_PURPOSE,
            version: ONBOARDING_CONSENT_VERSION,
          },
          update: { revokedAt: null, acceptedAt: new Date() },
        }),
        this.prisma.onboardingProgress.upsert({
          where: { userId },
          create: {
            userId,
            currentStep: 4,
            status: 'COMPLETED',
            data: {} as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
          update: { currentStep: 4, status: 'COMPLETED', completedAt: new Date() },
        }),
      ]);
    }

    return { success: true, profile };
  }

  async getOnboardingProgress(userId: string) {
    const targetOrder = await this.findRequiredIntakeOrder(userId, this.prisma);
    if (targetOrder) {
      if (!targetOrder.readingIntake && targetOrder.status === 'PAID') {
        return this.materializeOrderScopedDraft(userId, targetOrder.id);
      }
      return this.mapOrderScopedProgress(targetOrder);
    }

    const legacy = await this.prisma.onboardingProgress.findUnique({ where: { userId } });
    if (!legacy) return null;
    return {
      status: legacy.status,
      orderId: null,
      currentStep: Math.min(Math.max(legacy.currentStep, 0), 4),
      data: legacy.data,
      revision: 0,
      updatedAt: legacy.updatedAt,
      completedAt: legacy.completedAt,
      canEdit: legacy.status === 'IN_PROGRESS',
    };
  }

  async saveOnboardingProgress(userId: string, dto: UpdateOnboardingProgressDto) {
    const serialized = JSON.stringify(dto.data);
    if (serialized.includes('data:image/')) {
      throw new BadRequestException(
        'Les aperçus Base64 ne peuvent pas être persistés dans un brouillon',
      );
    }
    if (Buffer.byteLength(serialized, 'utf8') > MAX_ONBOARDING_DRAFT_BYTES) {
      throw new BadRequestException('Le brouillon dépasse la taille maximale autorisée');
    }

    this.assertPrivateOnboardingPhoto(dto.data.facePhoto, userId);
    this.assertPrivateOnboardingPhoto(dto.data.facePhotoUrl, userId);
    this.assertPrivateOnboardingPhoto(dto.data.palmPhoto, userId);
    this.assertPrivateOnboardingPhoto(dto.data.palmPhotoUrl, userId);

    const data = JSON.parse(serialized) as Prisma.InputJsonValue;
    const targetOrder = await this.findRequiredIntakeOrder(userId, this.prisma);
    if (!targetOrder) {
      if (dto.orderId) {
        throw new ConflictException({
          code: 'ACTIVE_ORDER_CHANGED',
          message: 'La commande active a changé. Rechargez le formulaire avant de continuer.',
          activeOrderId: null,
        });
      }
      return this.saveLegacyOnboardingProgress(userId, dto, data);
    }
    if (dto.orderId !== targetOrder.id) {
      throw new ConflictException({
        code: 'ACTIVE_ORDER_CHANGED',
        message: 'La commande active a changé. Rechargez le formulaire avant de continuer.',
        activeOrderId: targetOrder.id,
      });
    }

    return this.withSerializableRetry(async (tx) => {
      const order = await this.findRequiredIntakeOrder(userId, tx);
      if (!order || dto.orderId !== order.id) {
        throw new ConflictException({
          code: 'ACTIVE_ORDER_CHANGED',
          message: 'La commande active a changé. Rechargez le formulaire avant de continuer.',
          activeOrderId: order?.id ?? null,
        });
      }
      if (!order) {
        throw new BadRequestException('Aucune commande payée ne peut recevoir ce brouillon');
      }
      if (order.status !== 'PAID') {
        throw new ConflictException(
          'La production a commencé. Ce dossier ne peut plus être modifié.',
        );
      }

      if (order.readingIntake?.status === 'SEALED') {
        throw new ConflictException('Ce dossier est déjà scellé et ne peut plus être modifié.');
      }

      let saved: ReadingIntake;
      if (!order.readingIntake) {
        if (dto.revision !== undefined && dto.revision !== 0) {
          throw this.staleDraftConflict(0);
        }
        saved = await tx.readingIntake.create({
          data: {
            orderId: order.id,
            userId,
            status: 'DRAFT',
            schemaVersion: READING_INTAKE_SCHEMA_VERSION,
            currentStep: dto.currentStep,
            data,
            revision: 1,
          },
        });
      } else {
        const expectedRevision = dto.revision ?? order.readingIntake.revision;
        if (dto.revision !== undefined && dto.revision !== order.readingIntake.revision) {
          throw this.staleDraftConflict(order.readingIntake.revision);
        }

        const updated = await tx.readingIntake.updateMany({
          where: {
            id: order.readingIntake.id,
            status: 'DRAFT',
            revision: expectedRevision,
          },
          data: {
            currentStep: dto.currentStep,
            data,
            schemaVersion: READING_INTAKE_SCHEMA_VERSION,
            revision: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          const current = await tx.readingIntake.findUnique({
            where: { id: order.readingIntake.id },
            select: { revision: true, status: true },
          });
          if (current?.status === 'SEALED') {
            throw new ConflictException('Ce dossier vient d’être scellé.');
          }
          throw this.staleDraftConflict(current?.revision ?? expectedRevision);
        }
        saved = await tx.readingIntake.findUniqueOrThrow({
          where: { id: order.readingIntake.id },
        });
      }

      // Compatibility projection for clients and Desk views that still read the
      // historical one-row-per-user progress model.
      await tx.onboardingProgress.upsert({
        where: { userId },
        create: {
          userId,
          currentStep: dto.currentStep,
          status: 'IN_PROGRESS',
          data,
        },
        update: {
          currentStep: dto.currentStep,
          status: 'IN_PROGRESS',
          data,
          completedAt: null,
        },
      });

      return this.mapOrderScopedProgress({ ...order, readingIntake: saved });
    });
  }

  private async saveLegacyOnboardingProgress(
    userId: string,
    dto: UpdateOnboardingProgressDto,
    data: Prisma.InputJsonValue,
  ) {
    return this.withSerializableRetry(async (tx) => {
      const activeOrder = await this.findRequiredIntakeOrder(userId, tx);
      if (activeOrder) {
        throw new ConflictException({
          code: 'ACTIVE_ORDER_CHANGED',
          message: 'Une nouvelle commande requiert ce formulaire. Rechargez avant de continuer.',
          activeOrderId: activeOrder.id,
        });
      }

      const [existingProgress, profile] = await Promise.all([
        tx.onboardingProgress.findUnique({ where: { userId } }),
        tx.userProfile.findUnique({
          where: { userId },
          select: { profileCompleted: true },
        }),
      ]);
      if (existingProgress?.status === 'COMPLETED' || profile?.profileCompleted) {
        return existingProgress
          ? {
              status: 'COMPLETED' as const,
              orderId: null,
              currentStep: Math.min(Math.max(existingProgress.currentStep, 0), 4),
              data: existingProgress.data,
              revision: 0,
              updatedAt: existingProgress.updatedAt,
              completedAt: existingProgress.completedAt,
              canEdit: false,
            }
          : null;
      }

      const saved = existingProgress
        ? await tx.onboardingProgress.update({
            where: { userId },
            data: {
              currentStep: dto.currentStep,
              data,
              status: 'IN_PROGRESS',
              completedAt: null,
            },
          })
        : await tx.onboardingProgress.create({
            data: { userId, currentStep: dto.currentStep, data },
          });

      return {
        status: saved.status,
        orderId: null,
        currentStep: saved.currentStep,
        data: saved.data,
        revision: 0,
        updatedAt: saved.updatedAt,
        completedAt: saved.completedAt,
        canEdit: true,
      };
    });
  }

  private async materializeOrderScopedDraft(userId: string, orderId: string) {
    return this.withSerializableRetry(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          userId,
          intakeRequired: true,
          status: 'PAID',
        },
        select: { id: true, status: true, readingIntake: true },
      });
      if (!order) {
        throw new ConflictException('Cette commande n’est plus disponible pour la préparation.');
      }
      if (order.readingIntake) return this.mapOrderScopedProgress(order);

      const profile = await tx.userProfile.findUnique({ where: { userId } });
      const data = this.profileToDraftData(profile);
      const intake = await tx.readingIntake.create({
        data: {
          orderId,
          userId,
          status: 'DRAFT',
          schemaVersion: READING_INTAKE_SCHEMA_VERSION,
          currentStep: 0,
          data,
          revision: 0,
        },
      });

      await tx.onboardingProgress.upsert({
        where: { userId },
        create: { userId, currentStep: 0, status: 'IN_PROGRESS', data },
        update: {
          currentStep: 0,
          status: 'IN_PROGRESS',
          data,
          completedAt: null,
        },
      });
      return this.mapOrderScopedProgress({ ...order, readingIntake: intake });
    });
  }

  private profileToDraftData(profile: UserProfile | null): Prisma.InputJsonValue {
    const privateRef = (value: string | null) =>
      value?.startsWith('s3://onboarding/') && !value.includes('..') ? value : '';
    return {
      schemaVersion: 2,
      birthDate: profile?.birthDate || '',
      birthTime: profile?.birthTime || '',
      birthPlace: profile?.birthPlace || '',
      specificQuestion: profile?.specificQuestion || '',
      objective: profile?.objective || '',
      facePhoto: privateRef(profile?.facePhotoUrl || null),
      palmPhoto: privateRef(profile?.palmPhotoUrl || null),
      highs: profile?.highs || '',
      lows: profile?.lows || '',
      strongSide: profile?.strongSide || '',
      weakSide: profile?.weakSide || '',
      strongZone: profile?.strongZone || '',
      weakZone: profile?.weakZone || '',
      deliveryStyle: profile?.deliveryStyle || 'DOUX_ET_CLAIR',
      pace: profile?.pace ?? 50,
      ailments: profile?.ailments || '',
      fears: profile?.fears || '',
      rituals: profile?.rituals || '',
    } as Prisma.InputJsonValue;
  }

  private findRequiredIntakeOrder(userId: string, client: Pick<Prisma.TransactionClient, 'order'>) {
    return client.order.findFirst({
      where: {
        userId,
        intakeRequired: true,
        status: { in: [...PAID_READING_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        readingIntake: true,
      },
    });
  }

  private mapOrderScopedProgress(order: {
    id: string;
    status: string;
    readingIntake: {
      status: string;
      currentStep: number;
      data: Prisma.JsonValue;
      revision: number;
      updatedAt: Date;
      sealedAt: Date | null;
    } | null;
  }) {
    const intake = order.readingIntake;
    const status =
      intake?.status === 'SEALED' ? 'COMPLETED' : intake ? 'IN_PROGRESS' : 'NOT_STARTED';
    return {
      status,
      orderId: order.id,
      currentStep: intake?.currentStep ?? 0,
      data: intake?.data ?? {},
      revision: intake?.revision ?? 0,
      updatedAt: intake?.updatedAt ?? null,
      completedAt: intake?.sealedAt ?? null,
      canEdit: order.status === 'PAID' && intake?.status !== 'SEALED',
    };
  }

  private staleDraftConflict(currentRevision: number) {
    return new ConflictException({
      statusCode: 409,
      code: 'STALE_DRAFT',
      message: 'Une version plus récente du brouillon existe déjà.',
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
    throw new ConflictException('Le brouillon a été modifié simultanément. Réessayez.');
  }

  private assertPrivateOnboardingPhoto(value: string | null | undefined, userId: string) {
    if (value === null || value === undefined || value === '') return;
    if (!value.startsWith(`s3://onboarding/${userId}/`) || value.includes('..')) {
      throw new BadRequestException(
        'Les photos doivent être envoyées dans le stockage privé Lumira',
      );
    }
  }
}
