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
    // Fetch all paid/completed orders for the user
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: ['PAID', 'COMPLETED'] }
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
}
