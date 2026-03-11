import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * V2 SubscriptionGuard — Single-offer 29€/month model.
 * Allows access only when the authenticated user has an ACTIVE Stripe subscription.
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
        const userId: string | undefined = request.user?.id;

        if (!userId) {
            throw new ForbiddenException('Authentication required.');
        }

        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            select: { status: true },
        });

        if (subscription?.status !== 'ACTIVE') {
            throw new ForbiddenException(
                'An active subscription is required to access this resource.',
            );
        }

        return true;
    }
}
