import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(SubscriptionsService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.stripe = new Stripe(
            this.configService.get<string>('STRIPE_SECRET_KEY')!,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { apiVersion: '2025-12-15.clover' as any },
        );
    }

    // -------------------------------------------------------------------------
    // POST /subscriptions/checkout
    // -------------------------------------------------------------------------

    /**
     * Creates a Stripe Checkout Session in subscription mode for the 29€/month plan.
     * The userId is embedded in subscription_data.metadata so the webhook can
     * retrieve it when customer.subscription.created fires.
     */
    async createCheckoutSession(
        userId: string,
        successUrl: string,
        cancelUrl: string,
    ): Promise<{ url: string }> {
        // Prevent duplicate active subscriptions
        const existing = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (existing?.status === 'ACTIVE') {
            throw new ConflictException('User already has an active subscription.');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, firstName: true, lastName: true, stripeCustomerId: true },
        });
        if (!user) throw new NotFoundException('User not found.');

        // Upsert Stripe customer
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await this.stripe.customers.create({
                email: user.email,
                name: `${user.firstName} ${user.lastName}`.trim(),
                metadata: { userId },
            });
            customerId = customer.id;
            await this.prisma.user.update({
                where: { id: userId },
                data: { stripeCustomerId: customerId },
            });
        }

        const priceId = this.configService.get<string>('STRIPE_PRICE_29_MONTHLY');
        if (!priceId) {
            throw new BadRequestException('Stripe monthly price ID is not configured (STRIPE_PRICE_29_MONTHLY).');
        }

        const session = await this.stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            // userId forwarded to the subscription object — used by webhook handler
            subscription_data: {
                metadata: { userId },
            },
            client_reference_id: userId,
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        this.logger.log(`[Checkout] Session created for user ${userId}: ${session.id}`);
        return { url: session.url! };
    }

    // -------------------------------------------------------------------------
    // GET /subscriptions/status
    // -------------------------------------------------------------------------

    async getStatus(userId: string) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            return { hasSubscription: false, subscription: null };
        }
        return { hasSubscription: true, subscription };
    }

    // -------------------------------------------------------------------------
    // POST /subscriptions/cancel
    // -------------------------------------------------------------------------

    /**
     * Schedules cancellation at the end of the current billing period.
     * Access is NOT blocked immediately — the user retains access until currentPeriodEnd.
     */
    async cancel(userId: string) {
        const sub = await this.requireSubscription(userId);

        if (sub.cancelAtPeriodEnd) {
            throw new ConflictException('Subscription is already scheduled for cancellation.');
        }

        await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });

        const updated = await this.prisma.subscription.update({
            where: { userId },
            data: { cancelAtPeriodEnd: true },
        });

        this.logger.log(`[Cancel] Subscription ${sub.stripeSubscriptionId} scheduled for cancellation.`);
        return updated;
    }

    // -------------------------------------------------------------------------
    // POST /subscriptions/resume
    // -------------------------------------------------------------------------

    /**
     * Reverts a scheduled cancellation — user stays subscribed.
     */
    async resume(userId: string) {
        const sub = await this.requireSubscription(userId);

        if (!sub.cancelAtPeriodEnd) {
            throw new ConflictException('Subscription is not scheduled for cancellation.');
        }

        await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
            cancel_at_period_end: false,
        });

        const updated = await this.prisma.subscription.update({
            where: { userId },
            data: { cancelAtPeriodEnd: false },
        });

        this.logger.log(`[Resume] Cancellation reverted for subscription ${sub.stripeSubscriptionId}.`);
        return updated;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private async requireSubscription(userId: string) {
        const sub = await this.prisma.subscription.findUnique({ where: { userId } });
        if (!sub) throw new NotFoundException('No subscription found for this user.');
        if (sub.status === 'EXPIRED' || sub.status === 'CANCELED') {
            throw new BadRequestException('Subscription is no longer active.');
        }
        return sub;
    }
}
