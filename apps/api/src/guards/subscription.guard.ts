import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { isEarlyAccessActive } from '@packages/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Legacy-named guard for Sanctuaire content. Authorizes from a paid Order whose
 * early-access window (paidAt + 3 months) is still open. Subscription status is
 * never the authorization source.
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

    const paidOrders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'] },
        paidAt: { not: null },
      },
      select: { paidAt: true },
      orderBy: { paidAt: 'desc' },
      take: 20,
    });

    const hasActiveAccess = paidOrders.some((order) => isEarlyAccessActive(order.paidAt));

    if (!hasActiveAccess) {
      throw new ForbiddenException(
        'An active early access period is required to access this resource.',
      );
    }

    return true;
  }
}
