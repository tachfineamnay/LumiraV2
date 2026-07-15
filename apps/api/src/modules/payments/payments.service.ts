import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { SpiritualPathBatchService } from '../../services/factory/SpiritualPathBatchService';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from '../auth/auth.service';
import { IdGenerator } from '../../utils/IdGenerator';
import { CheckoutIntentDto } from './dto/checkout-intent.dto';

export { CheckoutIntentDto };

/** Server-side product catalog — never trust client amounts */
const CHECKOUT_CATALOG: Record<string, { amountCents: number; name: string }> = {
  '1': { amountCents: 2900, name: 'Cercle des Initiés' },
  '2': { amountCents: 2900, name: 'Cercle des Initiés' },
  '3': { amountCents: 2900, name: 'Cercle des Initiés' },
  '4': { amountCents: 2900, name: 'Cercle des Initiés' },
  initie: { amountCents: 2900, name: 'Cercle des Initiés' },
  subscription: { amountCents: 2900, name: 'Cercle des Initiés' },
};

export interface UpsellAddon {
  type: string;
  name: string;
  amount: number;
  paidAt?: Date;
  paymentIntentId?: string;
}

export interface CreateUpsellIntentDto {
  addonType: 'FORECAST_6M' | 'FORECAST_12M' | 'PRIORITY_DELIVERY';
}

type StripeSubscriptionPeriod = Stripe.Subscription & {
  current_period_start?: number;
  current_period_end?: number;
};

type StripeInvoiceExtras = Stripe.Invoice & {
  billing_reason?: string;
  subscription?: string | Stripe.Subscription | null;
};

type PrismaSubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  private getSubscriptionPeriod(subscription: Stripe.Subscription): {
    start: Date;
    end: Date;
  } {
    const sub = subscription as StripeSubscriptionPeriod;
    return {
      start: new Date((sub.current_period_start ?? 0) * 1000),
      end: new Date((sub.current_period_end ?? 0) * 1000),
    };
  }

  constructor(
    private configService: ConfigService,
    private ordersService: OrdersService,
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private spiritualPathBatchService: SpiritualPathBatchService,
    private idGenerator: IdGenerator,
    private authService: AuthService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY')!, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: '2025-12-15.clover' as any,
    });
  }

  /**
   * Client-side confirmation after Stripe Elements payment succeeds.
   * Verifies the PI with Stripe, fulfills the order (idempotent with webhook),
   * and returns a Sanctuaire JWT so the buyer enters without re-login.
   */
  async confirmCheckout(paymentIntentId: string) {
    const trimmedId = paymentIntentId?.trim();
    if (!trimmedId || !trimmedId.startsWith('pi_')) {
      throw new BadRequestException('Invalid paymentIntentId');
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(trimmedId);

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not confirmed. Status: ${paymentIntent.status}`);
    }

    // Fulfill order + activate subscription (safe if webhook already ran)
    await this.handlePaymentSucceeded(paymentIntent);

    const email =
      paymentIntent.metadata?.email?.toLowerCase().trim() ||
      (await this.resolveEmailFromPaymentIntent(paymentIntent));

    if (!email) {
      throw new BadRequestException('Unable to resolve buyer email from payment');
    }

    return this.authService.issueSanctuaireSessionForVerifiedPayment(email);
  }

  private async resolveEmailFromPaymentIntent(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<string | null> {
    const orderId = paymentIntent.metadata?.orderId;
    if (orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { userEmail: true },
      });
      if (order?.userEmail) return order.userEmail.toLowerCase().trim();
    }

    const byPi = await this.prisma.order.findFirst({
      where: { paymentIntentId: paymentIntent.id },
      select: { userEmail: true },
    });
    return byPi?.userEmail?.toLowerCase().trim() ?? null;
  }

  async createPaymentIntent(orderId: string, currency: string = 'eur') {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { amount: true, status: true },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Order is not in PENDING status');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: order.amount,
      currency,
      metadata: { orderId },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentIntentId: paymentIntent.id },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Creates a PaymentIntent and pre-creates User/Order with PENDING status.
   * Amount is resolved server-side from productLevel — never from the client.
   */
  async createCheckoutIntent(dto: CheckoutIntentDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const productKey = dto.productLevel.toLowerCase().trim();
    const catalogEntry = CHECKOUT_CATALOG[productKey];
    if (!catalogEntry) {
      throw new BadRequestException(`Unknown productLevel: ${dto.productLevel}`);
    }
    const amountCents = catalogEntry.amountCents;

    this.logger.log(
      `[CheckoutIntent] Starting for email: ${normalizedEmail}, amount=${amountCents}`,
    );

    // 1. Create user if missing — never overwrite PII on existing accounts
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    const user =
      existing ??
      (await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone || null,
          totalOrders: 0,
        },
      }));

    this.logger.log(`[CheckoutIntent] User ready: ${user.id} for email: ${normalizedEmail}`);

    const orderNumber = await this.generateOrderNumber();

    // 2. Create PaymentIntent first — only persist order after Stripe accepts
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        metadata: {
          email: normalizedEmail,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone || '',
          productLevel: productKey,
          expectedAmount: String(amountCents),
        },
      });
    } catch (err) {
      this.logger.error(
        `[CheckoutIntent] Stripe PI creation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Unable to create payment intent');
    }

    // 3. Create Order linked to PI
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        userEmail: normalizedEmail,
        userName: `${dto.firstName} ${dto.lastName}`.trim(),
        amount: amountCents,
        currency: 'eur',
        status: 'PENDING',
        paymentIntentId: paymentIntent.id,
        formData: { phone: dto.phone || '' } as Prisma.JsonObject,
      },
    });

    // 4. Attach orderId to PI metadata
    await this.stripe.paymentIntents.update(paymentIntent.id, {
      metadata: {
        ...paymentIntent.metadata,
        orderId: order.id,
      },
    });

    this.logger.log(`[CheckoutIntent] Order created: ${order.id}, PI: ${paymentIntent.id}`);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountCents,
    };
  }

  async handleWebhook(signature: string, payload: Buffer) {
    const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook signature verification failed: ${errorMessage}`);
      throw new BadRequestException(`Invalid Stripe signature: ${errorMessage}`);
    }

    // Idempotency: skip if already successfully processed
    const alreadyDone = await this.prisma.processedEvent.findUnique({
      where: { eventId: event.id },
    });
    if (alreadyDone) {
      this.logger.log(`Event ${event.id} already processed`);
      return { received: true };
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await this.handlePaymentSucceeded(paymentIntent);
          break;
        }

        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.payment_status === 'paid') {
            await this.handleCheckoutSessionCompleted(session);
          }
          break;
        }

        case 'customer.subscription.created': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.handleSubscriptionCreated(subscription);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.handleSubscriptionUpdated(subscription);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.handleSubscriptionDeleted(subscription);
          break;
        }

        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice;
          await this.handleInvoicePaid(invoice);
          break;
        }
      }

      // Mark processed only after handlers succeed — Stripe can retry on failure
      try {
        await this.prisma.processedEvent.create({
          data: {
            eventId: event.id,
            eventType: event.type,
            data: event.data.object as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err: unknown) {
        // Concurrent duplicate delivery after successful processing
        if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
          this.logger.log(`Event ${event.id} already marked processed (race)`);
          return { received: true };
        }
        throw err;
      }
    } catch (err) {
      this.logger.error(
        `Webhook handler failed for ${event.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    return { received: true };
  }

  // =========================================================================
  // V2 — Subscription webhook handlers
  // =========================================================================

  /**
   * customer.subscription.created
   * Provisions the Subscription record in Prisma and triggers async reading generation.
   * Responds 200 immediately; generation is fired via setImmediate to avoid Stripe timeout.
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.warn(`[Sub Created] No userId in subscription metadata: ${subscription.id}`);
      return;
    }

    const { start: currentPeriodStart, end: currentPeriodEnd } =
      this.getSubscriptionPeriod(subscription);

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        stripePriceId: subscription.items.data[0]?.price?.id ?? '',
        status: 'ACTIVE',
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        stripePriceId: subscription.items.data[0]?.price?.id ?? '',
        status: 'ACTIVE',
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    // Also sync legacy subscriptionStatus on User
    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'ACTIVE' },
    });

    this.logger.log(
      `[Sub Created] Subscription ${subscription.id} provisioned for user ${userId}.`,
    );

    // Fire-and-forget: trigger batch 1 timeline generation (days 1-10).
    // setImmediate ensures the webhook 200 response is not blocked.
    setImmediate(() => {
      this.spiritualPathBatchService.generateBatch1ForUser(userId).catch((err) => {
        this.logger.error(
          `[Sub Created] Batch 1 generation failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
      this.logger.log(`[Sub Created] Batch 1 generation triggered for user ${userId}.`);
    });
  }

  /**
   * customer.subscription.updated
   * Syncs status, period dates and cancelAtPeriodEnd to Prisma.
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const stripeStatus = subscription.status; // active | past_due | canceled | ...
    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      unpaid: 'PAST_DUE',
      incomplete: 'PAST_DUE',
      incomplete_expired: 'EXPIRED',
      trialing: 'ACTIVE',
      paused: 'PAST_DUE',
    };
    const mappedStatus = (statusMap[stripeStatus] ?? 'PAST_DUE') as PrismaSubscriptionStatus;

    const existing = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!existing) {
      this.logger.warn(`[Sub Updated] Subscription ${subscription.id} not found in DB — skipping.`);
      return;
    }

    const { start: currentPeriodStart, end: currentPeriodEnd } =
      this.getSubscriptionPeriod(subscription);

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: mappedStatus,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    // Sync legacy User.subscriptionStatus
    await this.prisma.user.update({
      where: { id: existing.userId },
      data: { subscriptionStatus: mappedStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE' },
    });

    this.logger.log(
      `[Sub Updated] ${subscription.id} → ${mappedStatus}, cancelAtPeriodEnd=${subscription.cancel_at_period_end}`,
    );
  }

  /**
   * customer.subscription.deleted
   * Marks the subscription as EXPIRED. User loses access to chat/dreams/timeline.
   * PDF documents are retained.
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const existing = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!existing) {
      this.logger.warn(`[Sub Deleted] Subscription ${subscription.id} not found in DB — skipping.`);
      return;
    }

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'EXPIRED' },
    });

    await this.prisma.user.update({
      where: { id: existing.userId },
      data: { subscriptionStatus: 'INACTIVE' },
    });

    this.logger.log(
      `[Sub Deleted] Subscription ${subscription.id} marked EXPIRED for user ${existing.userId}.`,
    );
  }

  /**
   * checkout.session.completed
   * Grants access for one-time 29€ payment. Sets subscription record with far-future
   * currentPeriodEnd so access never expires, then fires batch 1 generation.
   */
  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const userId = session.client_reference_id;
    if (!userId) {
      this.logger.warn(`[Checkout] No userId in client_reference_id: ${session.id}`);
      return;
    }

    const now = new Date();
    const farFuture = new Date('2099-12-31');

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubscriptionId: session.id,
        stripeCustomerId: (session.customer as string) ?? '',
        stripePriceId: this.configService.get<string>('STRIPE_PRICE_29') ?? '',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: farFuture,
        cancelAtPeriodEnd: false,
      },
      update: {
        stripeSubscriptionId: session.id,
        stripeCustomerId: (session.customer as string) ?? '',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: farFuture,
        cancelAtPeriodEnd: false,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'ACTIVE' },
    });

    this.logger.log(`[Checkout] Access granted for user ${userId} via session ${session.id}`);

    setImmediate(() => {
      this.spiritualPathBatchService.generateBatch1ForUser(userId).catch((err) => {
        this.logger.error(
          `[Checkout] Batch 1 failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    });
  }

  /**
   * invoice.paid
   * On renewal (billing_reason = subscription_cycle), update the subscription period
   * and fire async generation of a new reading + timeline for the new month.
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const invoiceExtras = invoice as StripeInvoiceExtras;
    const billingReason = invoiceExtras.billing_reason;
    if (billingReason !== 'subscription_cycle') {
      // First payment is handled by subscription.created — skip.
      return;
    }

    const stripeSubId: string | undefined =
      typeof invoiceExtras.subscription === 'string'
        ? invoiceExtras.subscription
        : invoiceExtras.subscription?.id;

    if (!stripeSubId) return;

    const existing = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSubId },
    });
    if (!existing) {
      this.logger.warn(`[Invoice Paid] Subscription ${stripeSubId} not found in DB — skipping.`);
      return;
    }

    // Fetch fresh subscription object to get updated period dates
    const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubId);
    const { start: currentPeriodStart, end: currentPeriodEnd } =
      this.getSubscriptionPeriod(stripeSub);

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: stripeSubId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });

    this.logger.log(`[Invoice Paid] Renewal for user ${existing.userId} — period updated.`);

    // Fire-and-forget: trigger batch 1 timeline generation for the new subscription month.
    setImmediate(() => {
      this.spiritualPathBatchService.generateBatch1ForUser(existing.userId).catch((err) => {
        this.logger.error(
          `[Invoice Paid] Batch 1 renewal generation failed for user ${existing.userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
      this.logger.log(
        `[Invoice Paid] Batch 1 generation triggered for renewal, user ${existing.userId}.`,
      );
    });
  }

  // =========================================================================
  // Legacy one-shot payment handlers
  // =========================================================================

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const {
      orderId,
      checkoutFlow,
      email,
      firstName,
      lastName,
      phone,
      productLevel,
      isUpsell,
      upsellType,
      expectedAmount,
    } = paymentIntent.metadata;

    // Handle UPSELL payment
    if (isUpsell === 'true' && orderId && upsellType) {
      this.logger.log(
        `[Upsell Webhook] Processing upsell for order ${orderId}, type: ${upsellType}`,
      );
      await this.confirmUpsell(orderId, upsellType, paymentIntent.id);
      return;
    }

    // Assert paid amount matches catalog expectation when present
    if (expectedAmount && paymentIntent.amount !== Number(expectedAmount)) {
      this.logger.error(
        `[PaymentIntent] Amount mismatch for ${paymentIntent.id}: expected ${expectedAmount}, got ${paymentIntent.amount}`,
      );
      throw new BadRequestException('Payment amount does not match expected catalog price');
    }
    if (productLevel) {
      const catalogEntry = CHECKOUT_CATALOG[productLevel.toLowerCase()];
      if (catalogEntry && paymentIntent.amount !== catalogEntry.amountCents) {
        this.logger.error(
          `[PaymentIntent] Catalog amount mismatch for ${paymentIntent.id}: expected ${catalogEntry.amountCents}, got ${paymentIntent.amount}`,
        );
        throw new BadRequestException('Payment amount does not match product catalog');
      }
    }

    // Legacy flow: orderId already exists (from createCheckoutIntent)
    if (orderId) {
      const existingOrder = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (existingOrder && paymentIntent.amount !== existingOrder.amount) {
        this.logger.error(
          `[PaymentIntent] Order amount mismatch for ${orderId}: order=${existingOrder.amount}, pi=${paymentIntent.amount}`,
        );
        throw new BadRequestException('Payment amount does not match order');
      }

      const result = await this.prisma.order.updateMany({
        where: {
          id: orderId,
          status: { notIn: ['PAID', 'COMPLETED'] },
        },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      if (result.count === 0) {
        this.logger.log(`Order ${orderId} already PAID or COMPLETED, skipping duplicate webhook`);
        return;
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true },
      });

      if (!order) {
        this.logger.error(`Order ${orderId} not found after update`);
        return;
      }

      this.logger.log(`Order ${orderId} marked as PAID`);

      try {
        await this.notificationsService.sendOrderConfirmation(order, order.user);
      } catch (error) {
        this.logger.error(
          `Failed to send order confirmation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // V2: Activate subscription (one-time 29€ access) + trigger generation
      if (productLevel) {
        const now = new Date();
        const farFuture = new Date('2099-12-31');

        await this.prisma.subscription.upsert({
          where: { userId: order.userId },
          create: {
            userId: order.userId,
            stripeSubscriptionId: paymentIntent.id,
            stripeCustomerId:
              typeof paymentIntent.customer === 'string' ? paymentIntent.customer : '',
            stripePriceId: this.configService.get<string>('STRIPE_PRICE_29') ?? '',
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: farFuture,
            cancelAtPeriodEnd: false,
          },
          update: {
            stripeSubscriptionId: paymentIntent.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: farFuture,
            cancelAtPeriodEnd: false,
          },
        });

        await this.prisma.user.update({
          where: { id: order.userId },
          data: { subscriptionStatus: 'ACTIVE' },
        });

        this.logger.log(`[PaymentIntent] Subscription activated for user ${order.userId}`);

        // Fire-and-forget: trigger batch 1 generation
        setImmediate(() => {
          this.spiritualPathBatchService.generateBatch1ForUser(order.userId).catch((err) => {
            this.logger.error(
              `[PaymentIntent] Batch 1 failed for user ${order.userId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
          this.logger.log(`[PaymentIntent] Batch 1 generation triggered for user ${order.userId}`);
        });
      }

      return;
    }

    // New checkout flow: create User and Order from metadata
    if (checkoutFlow === 'true' && email) {
      // 1. Upsert User — create-only semantics for PII
      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      const user = existingUser
        ? await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              totalOrders: { increment: 1 },
              lastOrderAt: new Date(),
            },
          })
        : await this.prisma.user.create({
            data: {
              email: normalizedEmail,
              firstName: firstName || '',
              lastName: lastName || '',
              phone: phone || null,
              totalOrders: 1,
              lastOrderAt: new Date(),
            },
          });

      // 3. Generate order number
      const orderNumber = await this.generateOrderNumber();

      // 4. Create Order
      const order = await this.prisma.order.create({
        data: {
          orderNumber,
          userId: user.id,
          userEmail: normalizedEmail,
          userName: `${firstName} ${lastName}`.trim(),
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'PAID',
          paidAt: new Date(),
          paymentIntentId: paymentIntent.id,
          formData: { phone } as Prisma.JsonObject,
        },
        include: { user: true },
      });

      this.logger.log(`Checkout flow: Created User ${user.id} and Order ${order.id}`);

      try {
        await this.notificationsService.sendOrderConfirmation(order, order.user);
      } catch (error) {
        this.logger.error(
          `Failed to send order confirmation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // NOTE: No auto-generation. Client completes onboarding first, then expert generates manually from Desk.
    }
  }

  private async generateOrderNumber(): Promise<string> {
    return this.idGenerator.generateOrderNumber();
  }

  // =========================
  // UPSELL ONE-CLICK SYSTEM
  // =========================

  private readonly UPSELL_PRODUCTS: Record<
    string,
    { name: string; amount: number; description: string }
  > = {
    FORECAST_6M: {
      name: 'Prévisions 6 mois',
      amount: 2700, // 27€ (special price, normally 67€)
      description: 'Ajout des prévisions sur 6 mois à votre lecture',
    },
    FORECAST_12M: {
      name: 'Prévisions 12 mois',
      amount: 4700, // 47€ (special price, normally 97€)
      description: 'Ajout des prévisions sur 12 mois à votre lecture',
    },
    PRIORITY_DELIVERY: {
      name: 'Livraison Prioritaire',
      amount: 1500, // 15€
      description: 'Recevez votre lecture en priorité sous 24h',
    },
  };

  /**
   * Mark that upsell was shown to user (for analytics)
   */
  async markUpsellOffered(orderId: string) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { upsellOfferedAt: new Date() },
    });
  }

  /**
   * Get order with upsell eligibility info (minimal public DTO — no full user PII)
   */
  async getOrderForUpsell(orderId: string, requestingUserId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        userId: true,
        amount: true,
        addons: true,
      },
    });

    if (!order) {
      return null;
    }

    if (requestingUserId && order.userId !== requestingUserId) {
      throw new ForbiddenException('Not authorized for this order');
    }

    const existingAddons = (order.addons as unknown as UpsellAddon[] | null) || [];
    const availableUpsells = Object.entries(this.UPSELL_PRODUCTS)
      .filter(([type]) => !existingAddons.some((a) => a.type === type))
      .map(([type, product]) => ({
        type,
        ...product,
      }));

    return {
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      availableUpsells,
      isEligible: order.status === 'PAID' && availableUpsells.length > 0,
    };
  }

  /**
   * Create PaymentIntent for upsell addon (one-click if payment method saved)
   */
  async createUpsellIntent(orderId: string, addonType: string, requestingUserId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (requestingUserId && order.userId !== requestingUserId) {
      throw new ForbiddenException('Not authorized for this order');
    }

    if (order.status !== 'PAID') {
      throw new BadRequestException('Order must be paid before upsell');
    }

    const product = this.UPSELL_PRODUCTS[addonType];
    if (!product) {
      throw new BadRequestException('Invalid upsell product');
    }

    // Check if addon already purchased
    const existingAddons = (order.addons as unknown as UpsellAddon[] | null) || [];
    if (existingAddons.some((a) => a.type === addonType)) {
      throw new BadRequestException('Addon already purchased');
    }

    // Try to get saved payment method from Stripe customer
    let paymentMethodId: string | null = null;
    if (order.user.stripeCustomerId) {
      try {
        const paymentMethods = await this.stripe.paymentMethods.list({
          customer: order.user.stripeCustomerId,
          type: 'card',
          limit: 1,
        });
        if (paymentMethods.data.length > 0) {
          paymentMethodId = paymentMethods.data[0].id;
        }
      } catch (e) {
        this.logger.warn(`Could not fetch payment methods: ${e}`);
      }
    }

    // Ensure customer exists or create one
    let customerId = order.user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: order.userEmail,
        name: order.userName || undefined,
        metadata: { userId: order.userId },
      });
      customerId = customer.id;

      // Save customer ID
      await this.prisma.user.update({
        where: { id: order.userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create PaymentIntent
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: product.amount,
      currency: 'eur',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: order.id,
        upsellType: addonType,
        upsellName: product.name,
        isUpsell: 'true',
      },
      description: product.description,
    };

    // If we have a saved payment method, attach it for faster checkout
    if (paymentMethodId) {
      paymentIntentParams.payment_method = paymentMethodId;
    }

    const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentParams);

    this.logger.log(
      `[Upsell] Created PaymentIntent ${paymentIntent.id} for order ${orderId}, addon: ${addonType}`,
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: product.amount,
      productName: product.name,
      hasPaymentMethod: !!paymentMethodId,
    };
  }

  /**
   * Confirm upsell after successful payment (called by webhook or direct confirmation)
   */
  async confirmUpsell(
    orderId: string,
    addonType: string,
    paymentIntentId: string,
    requestingUserId?: string,
  ) {
    const product = this.UPSELL_PRODUCTS[addonType];
    if (!product) {
      throw new BadRequestException('Invalid upsell product');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (requestingUserId && order.userId !== requestingUserId) {
      throw new ForbiddenException('Not authorized for this order');
    }

    // Verify payment succeeded with Stripe
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not confirmed. Status: ${paymentIntent.status}`);
    }

    // Bind PI metadata to this order + upsell type
    if (paymentIntent.metadata?.orderId !== orderId) {
      throw new BadRequestException('PaymentIntent is not bound to this order');
    }
    if (paymentIntent.metadata?.isUpsell !== 'true') {
      throw new BadRequestException('PaymentIntent is not an upsell payment');
    }
    if (paymentIntent.metadata?.upsellType && paymentIntent.metadata.upsellType !== addonType) {
      throw new BadRequestException('PaymentIntent upsell type mismatch');
    }

    // Verify payment amount matches product
    if (paymentIntent.amount !== product.amount) {
      throw new BadRequestException(
        `Payment amount mismatch. Expected: ${product.amount}, Got: ${paymentIntent.amount}`,
      );
    }

    const existingAddons = (order.addons as unknown as UpsellAddon[] | null) || [];

    // Idempotent: already confirmed
    if (existingAddons.some((a) => a.type === addonType || a.paymentIntentId === paymentIntentId)) {
      return {
        success: true,
        order,
        addon: existingAddons.find((a) => a.type === addonType)!,
        alreadyConfirmed: true,
      };
    }

    // Add the new addon
    const newAddon: UpsellAddon = {
      type: addonType,
      name: product.name,
      amount: product.amount,
      paidAt: new Date(),
      paymentIntentId,
    };

    const updatedAddons = [...existingAddons, newAddon];

    // Update order
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        addons: updatedAddons as unknown as Prisma.InputJsonValue,
        upsellAcceptedAt: new Date(),
        // Also update total amount for records
        amount: order.amount + product.amount,
      },
    });

    this.logger.log(
      `[Upsell] Confirmed addon ${addonType} for order ${orderId}. New total: ${updatedOrder.amount}`,
    );

    return {
      success: true,
      order: updatedOrder,
      addon: newAddon,
    };
  }
}
