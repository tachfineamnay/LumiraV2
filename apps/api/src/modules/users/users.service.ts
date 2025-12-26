import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { User, Expert, UserProfile } from '@prisma/client';

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

  async getEntitlements(userId: string): Promise<{ maxLevel: number; capabilities: string[] }> {
    const orders = await this.prisma.order.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { level: true },
    });

    const maxLevel = Math.max(0, ...orders.map((o) => o.level));

    return {
      maxLevel,
      capabilities: this.getCapabilitiesByLevel(maxLevel),
    };
  }

  private getCapabilitiesByLevel(level: number) {
    const capabilities = [];
    if (level >= 1) capabilities.push('BASIC_READING');
    if (level >= 2) capabilities.push('AUDIO_GUIDANCE');
    if (level >= 3) capabilities.push('MANDALA_ACCESS');
    if (level >= 4) capabilities.push('RITUALS_ACCESS');
    return capabilities;
  }

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }
}
