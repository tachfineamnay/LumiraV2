import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Legacy-named guard for Sanctuaire content. It authorizes from a paid Order,
 * never from Subscription status, because Lumira access is lifetime.
 * Must be used AFTER JwtAuthGuard so that req.user.id is available.
 *
 * @example
 * @UseGuards(JwtAuthGuard, SubscriptionGuard)
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId ?? request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Authentication required.');
    }

    const paidOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'] },
      },
      select: { id: true },
    });

    if (!paidOrder) {
      throw new ForbiddenException('A paid order is required to access this resource.');
    }

    return true;
  }
}
