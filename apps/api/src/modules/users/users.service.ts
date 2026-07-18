import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User, Expert, UserProfile } from '@prisma/client';
import { aggregateCapabilities, getHighestLevel, EntitlementsResponse } from '@packages/shared';
import { UpdateOnboardingProgressDto, UpdateProfileDto } from './dto/update-profile.dto';

const ONBOARDING_CONSENT_PURPOSE = 'PERSONALIZED_SPIRITUAL_EXPERIENCE';

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
    }>
  > {
    return this.prisma.order.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
    });
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
              version: data.consent.version,
            },
          },
          create: {
            userId,
            purpose: ONBOARDING_CONSENT_PURPOSE,
            version: data.consent.version,
          },
          update: { revokedAt: null },
        }),
        this.prisma.onboardingProgress.upsert({
          where: { userId },
          create: {
            userId,
            currentStep: 5,
            status: 'COMPLETED',
            data: {} as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
          update: { currentStep: 5, status: 'COMPLETED', completedAt: new Date() },
        }),
      ]);
    }

    return { success: true, profile };
  }

  async getOnboardingProgress(userId: string) {
    return this.prisma.onboardingProgress.findUnique({ where: { userId } });
  }

  async saveOnboardingProgress(userId: string, dto: UpdateOnboardingProgressDto) {
    if (JSON.stringify(dto.data).includes('data:image/')) {
      throw new BadRequestException(
        'Les aperçus Base64 ne peuvent pas être persistés dans un brouillon',
      );
    }

    // A late autosave must never downgrade a finalized preparation. Profile
    // completion (and OnboardingProgress.COMPLETED) are authoritative.
    const [existingProgress, profile] = await Promise.all([
      this.prisma.onboardingProgress.findUnique({ where: { userId } }),
      this.prisma.userProfile.findUnique({
        where: { userId },
        select: { profileCompleted: true },
      }),
    ]);
    if (existingProgress?.status === 'COMPLETED' || profile?.profileCompleted) {
      return existingProgress;
    }

    return this.prisma.onboardingProgress.upsert({
      where: { userId },
      create: {
        userId,
        currentStep: dto.currentStep,
        data: dto.data as Prisma.InputJsonValue,
      },
      update: {
        currentStep: dto.currentStep,
        data: dto.data as Prisma.InputJsonValue,
        status: 'IN_PROGRESS',
        completedAt: null,
      },
    });
  }

  private assertPrivateOnboardingPhoto(value: string | null, userId: string) {
    if (value === null || value === '') return;
    if (!value.startsWith(`s3://onboarding/${userId}/`)) {
      throw new BadRequestException(
        'Les photos doivent être envoyées dans le stockage privé Lumira',
      );
    }
  }
}
