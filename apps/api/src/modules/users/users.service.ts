import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { User, Expert, UserProfile } from '@prisma/client';
import {
  aggregateCapabilities,
  getHighestLevel,
  EntitlementsResponse,
} from '@packages/shared';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

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
   * V2: Get entitlements based on active subscription.
   * Returns level 4 (full access) when subscribed, 0 when not.
   */
  async getEntitlements(userId: string): Promise<EntitlementsResponse> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { status: true },
    });

    const isActive = subscription?.status === 'ACTIVE';
    const levels = isActive ? [4] : [];
    const capabilities = aggregateCapabilities(levels);
    const highestLevel = getHighestLevel(levels);

    return {
      capabilities,
      products: isActive ? ['subscription'] : [],
      highestLevel,
      orderCount: isActive ? 1 : 0,
    };
  }

  /**
   * Get basic entitlements (maxLevel + capabilities) - legacy format
   */
  async getBasicEntitlements(userId: string): Promise<{ maxLevel: number; capabilities: string[] }> {
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
    
    return { users, total };
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
  async findUserWithPaidOrder(email: string): Promise<(User & { profile: UserProfile | null }) | null> {
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[findUserWithPaidOrder] Looking for user with email: ${normalizedEmail}`);
    
    // First find the user
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });

    if (!user) {
      console.log(`[findUserWithPaidOrder] No user found with email: ${normalizedEmail}`);
      return null;
    }
    
    console.log(`[findUserWithPaidOrder] Found user: ${user.id}`);

    // Check if user has at least one paid/valid order.
    // FAILED orders are included — paid orders where generation failed, user should still have access.
    const paidOrder = await this.prisma.order.findFirst({
      where: {
        userId: user.id,
        status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'] },
      },
    });

    if (!paidOrder) {
      console.log(`[findUserWithPaidOrder] No valid order found for user: ${user.id}`);
      // Log all orders for debugging
      const allOrders = await this.prisma.order.findMany({
        where: { userId: user.id },
        select: { id: true, status: true, amount: true, createdAt: true },
      });
      console.log(`[findUserWithPaidOrder] User's orders:`, JSON.stringify(allOrders));
      return null;
    }
    
    console.log(`[findUserWithPaidOrder] Found valid order: ${paidOrder.id} (status: ${paidOrder.status}, amount: ${paidOrder.amount})`);

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
    const wouldAuth = orders.some(o =>
      ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'].includes(o.status) ||
      (o.status === 'PENDING' && o.amount === 0)
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
  async getCompletedOrders(userId: string): Promise<Array<{
    id: string;
    orderNumber: string;
    status: string;
    deliveredAt: Date | null;
    createdAt: Date;
  }>> {
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
  async updateProfile(userId: string, data: {
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    specificQuestion?: string;
    objective?: string;
    facePhotoUrl?: string;
    palmPhotoUrl?: string;
    highs?: string;
    lows?: string;
    strongSide?: string;
    weakSide?: string;
    strongZone?: string;
    weakZone?: string;
    deliveryStyle?: string;
    pace?: number;
    ailments?: string;
    fears?: string;
    rituals?: string;
    profileCompleted?: boolean;
  }): Promise<{ success: boolean; profile: UserProfile }> {
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

    return { success: true, profile };
  }
}
