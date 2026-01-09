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
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        OR: [
          { status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED'] } },
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
    // First find the user
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { profile: true },
    });

    if (!user) {
      return null;
    }

    // Check if user has at least one paid/valid order
    // Include PENDING orders for paid products (they will be updated to PAID by webhook)
    const paidOrder = await this.prisma.order.findFirst({
      where: {
        userId: user.id,
        OR: [
          { status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED'] } },
          { status: 'PENDING', amount: 0 }, // Free orders
          { status: 'PENDING', amount: { gt: 0 } }, // Paid orders awaiting webhook confirmation
        ],
      },
    });

    if (!paidOrder) {
      return null;
    }

    return user;
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
}
