import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { User, Expert, UserProfile } from '@prisma/client';
import {
  aggregateCapabilities,
  getHighestLevel,
  getLevelMetadata,
  getLevelNameFromLevel,
  EntitlementsResponse,
} from '@packages/shared';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  async findByEmail(email: string): Promise<(User & { profile: UserProfile | null }) | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  async findExpertByEmail(email: string): Promise<Expert | null> {
    return this.prisma.expert.findUnique({
      where: { email },
    });
  }

  /**
   * Get full entitlements for a user based on their paid/completed orders
   */
  async getEntitlements(userId: string): Promise<EntitlementsResponse> {
    // Fetch all orders that should grant entitlements.
    // Note: an order can move from PAID -> PROCESSING -> AWAITING_VALIDATION -> COMPLETED,
    // and should continue granting access across the whole lifecycle.
    // FAILED orders are paid orders where generation failed - they should still grant access.
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        OR: [
          { status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'] } },
          // Free orders (amount=0) are valid even without a payment step.
          { status: 'PENDING', amount: 0 },
        ],
      },
      select: { level: true },
    });

    // Extract levels from orders
    const levels = orders.map((o) => o.level);

    // Calculate highest level and aggregate capabilities
    const highestLevel = getHighestLevel(levels);
    const capabilities = aggregateCapabilities(levels);
    const levelMetadata = getLevelMetadata(highestLevel);

    // Get product IDs the user has purchased
    const products = [...new Set(levels.map(l => getLevelNameFromLevel(l)))];

    return {
      capabilities,
      products,
      highestLevel,
      levelMetadata,
      orderCount: orders.length,
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

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find a user by email only if they have at least one paid/valid order.
   * Used for Sanctuaire passwordless authentication.
   * Also accepts PENDING orders for paid products (awaiting webhook confirmation).
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

    // Check if user has at least one paid/valid order
    // Include PENDING orders for paid products (they will be updated to PAID by webhook)
    // Also include FAILED orders - these are paid orders where generation failed, user should still have access
    const paidOrder = await this.prisma.order.findFirst({
      where: {
        userId: user.id,
        OR: [
          { status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'] } },
          { status: 'PENDING', amount: 0 }, // Free orders
          { status: 'PENDING', amount: { gt: 0 } }, // Paid orders awaiting webhook confirmation
        ],
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
   * DEBUG: Get user and all their orders for diagnosis
   */
  async debugUserAndOrders(email: string): Promise<{
    email: string;
    user: { id: string; email: string; firstName: string; lastName: string } | null;
    orders: { id: string; status: string; amount: number; level: number; createdAt: Date }[];
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
      select: { id: true, status: true, amount: true, level: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Check if any order would pass auth
    const wouldAuth = orders.some(o => 
      ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'].includes(o.status) ||
      (o.status === 'PENDING' && o.amount === 0) ||
      (o.status === 'PENDING' && o.amount > 0)
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
    level: number;
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
        level: true,
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
