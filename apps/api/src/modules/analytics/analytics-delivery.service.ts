import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsDeliveryStatus, Order } from '@prisma/client';
import { LUMIRA_EARLY_OFFER } from '@packages/shared';
import { Ga4MeasurementProtocolService } from './ga4-measurement-protocol.service';

const BACKOFF_SECONDS = [
  60, // 1 min
  5 * 60, // 5 min
  15 * 60, // 15 min
  60 * 60, // 1 h
  6 * 60 * 60, // 6 h
  24 * 60 * 60, // 24 h
];

export function computeNextAttemptAt(attemptCount: number, now = new Date()): Date | null {
  if (attemptCount >= 8) {
    return null;
  }
  const index = Math.min(attemptCount - 1, BACKOFF_SECONDS.length - 1);
  const seconds = BACKOFF_SECONDS[Math.max(0, index)];
  return new Date(now.getTime() + seconds * 1000);
}

@Injectable()
export class AnalyticsDeliveryService {
  private readonly logger = new Logger(AnalyticsDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ga4Service: Ga4MeasurementProtocolService,
  ) {}

  /**
   * Enregistre un événement de vente `purchase` pour une commande payée.
   * Utilise une clé unique `ga4:purchase:<paymentIntentId>` pour l'idempotence stricte.
   */
  async recordPurchase(order: Order, paymentIntentId: string) {
    const eventKey = `ga4:purchase:${paymentIntentId}`;

    const existing = await this.prisma.analyticsDelivery.findUnique({
      where: { eventKey },
    });
    if (existing) {
      this.logger.log(`[AnalyticsDelivery] Purchase delivery already recorded for key=${eventKey}`);
      return existing;
    }

    if (!order.analyticsConsentGranted) {
      this.logger.log(`[AnalyticsDelivery] Skipped purchase key=${eventKey}: no_consent`);
      return this.prisma.analyticsDelivery.create({
        data: {
          provider: 'ga4',
          eventName: 'purchase',
          eventKey,
          transactionId: paymentIntentId,
          orderId: order.id,
          clientId: order.ga4ClientId,
          sessionId: order.ga4SessionId,
          payload: {},
          status: AnalyticsDeliveryStatus.SKIPPED,
          skippedReason: 'no_consent',
        },
      });
    }

    if (!order.ga4ClientId) {
      this.logger.log(`[AnalyticsDelivery] Skipped purchase key=${eventKey}: no_client_id`);
      return this.prisma.analyticsDelivery.create({
        data: {
          provider: 'ga4',
          eventName: 'purchase',
          eventKey,
          transactionId: paymentIntentId,
          orderId: order.id,
          clientId: null,
          sessionId: order.ga4SessionId,
          payload: {},
          status: AnalyticsDeliveryStatus.SKIPPED,
          skippedReason: 'no_client_id',
        },
      });
    }

    const paidTimestampMicros = String((order.paidAt ? order.paidAt.getTime() : Date.now()) * 1000);
    const valueEuros = order.amount / 100;

    const payload = {
      client_id: order.ga4ClientId,
      timestamp_micros: paidTimestampMicros,
      events: [
        {
          name: 'purchase',
          params: {
            transaction_id: paymentIntentId,
            currency: order.currency.toUpperCase(),
            value: valueEuros,
            session_id: order.ga4SessionId || undefined,
            engagement_time_msec: 1,
            items: [
              {
                item_id: LUMIRA_EARLY_OFFER.code,
                item_name: 'Lecture Oracle Lumira',
                affiliation: 'Oracle Lumira',
                item_brand: 'Oracle Lumira',
                item_category: 'Lecture personnalisée',
                price: valueEuros,
                quantity: 1,
              },
            ],
          },
        },
      ],
    };

    const delivery = await this.prisma.analyticsDelivery.create({
      data: {
        provider: 'ga4',
        eventName: 'purchase',
        eventKey,
        transactionId: paymentIntentId,
        orderId: order.id,
        clientId: order.ga4ClientId,
        sessionId: order.ga4SessionId,
        payload,
        status: AnalyticsDeliveryStatus.PENDING,
      },
    });

    // Envoi immédiat en arrière-plan (sans bloquer la réponse webhook)
    void this.processDelivery(delivery.id);
    return delivery;
  }

  /**
   * Enregistre un événement de remboursement `refund`.
   * Utilise une clé unique `ga4:refund:<refundId>` pour l'idempotence stricte.
   */
  async recordRefund(
    paymentIntentId: string,
    refundId: string,
    amountCents: number,
    currency = 'eur',
  ) {
    const eventKey = `ga4:refund:${refundId}`;

    const existing = await this.prisma.analyticsDelivery.findUnique({
      where: { eventKey },
    });
    if (existing) {
      this.logger.log(`[AnalyticsDelivery] Refund delivery already recorded for key=${eventKey}`);
      return existing;
    }

    const order = await this.prisma.order.findFirst({
      where: { paymentIntentId },
    });

    if (!order || !order.analyticsConsentGranted) {
      const reason = !order ? 'order_not_found' : 'no_consent';
      return this.prisma.analyticsDelivery.create({
        data: {
          provider: 'ga4',
          eventName: 'refund',
          eventKey,
          transactionId: paymentIntentId,
          orderId: order?.id || null,
          clientId: order?.ga4ClientId || null,
          sessionId: order?.ga4SessionId || null,
          payload: {},
          status: AnalyticsDeliveryStatus.SKIPPED,
          skippedReason: reason,
        },
      });
    }

    if (!order.ga4ClientId) {
      return this.prisma.analyticsDelivery.create({
        data: {
          provider: 'ga4',
          eventName: 'refund',
          eventKey,
          transactionId: paymentIntentId,
          orderId: order.id,
          clientId: null,
          sessionId: order.ga4SessionId,
          payload: {},
          status: AnalyticsDeliveryStatus.SKIPPED,
          skippedReason: 'no_client_id',
        },
      });
    }

    const refundValueEuros = amountCents / 100;
    const payload = {
      client_id: order.ga4ClientId,
      events: [
        {
          name: 'refund',
          params: {
            transaction_id: paymentIntentId,
            currency: (currency || order.currency || 'eur').toUpperCase(),
            value: refundValueEuros,
            session_id: order.ga4SessionId || undefined,
            items: [
              {
                item_id: LUMIRA_EARLY_OFFER.code,
                item_name: 'Lecture Oracle Lumira',
                price: order.amount / 100,
                quantity: 1,
              },
            ],
          },
        },
      ],
    };

    const delivery = await this.prisma.analyticsDelivery.create({
      data: {
        provider: 'ga4',
        eventName: 'refund',
        eventKey,
        transactionId: paymentIntentId,
        orderId: order.id,
        clientId: order.ga4ClientId,
        sessionId: order.ga4SessionId,
        payload,
        status: AnalyticsDeliveryStatus.PENDING,
      },
    });

    void this.processDelivery(delivery.id);
    return delivery;
  }

  /**
   * Effectue une tentative de livraison d'un événement analytique.
   * Utilise un verrouillage atomique PENDING -> PROCESSING.
   */
  async processDelivery(deliveryId: string): Promise<boolean> {
    const now = new Date();
    const transition = await this.prisma.analyticsDelivery.updateMany({
      where: {
        id: deliveryId,
        status: { in: [AnalyticsDeliveryStatus.PENDING, AnalyticsDeliveryStatus.FAILED] },
      },
      data: {
        status: AnalyticsDeliveryStatus.PROCESSING,
        lockedAt: now,
      },
    });

    if (!transition || transition.count === 0) {
      return false;
    }

    const delivery = await this.prisma.analyticsDelivery.findUnique({
      where: { id: deliveryId },
    });
    if (!delivery) {
      return false;
    }

    if (!this.ga4Service.isEnabled()) {
      const nextAttemptAt = computeNextAttemptAt(delivery.attempts + 1, now);
      await this.prisma.analyticsDelivery.update({
        where: { id: deliveryId },
        data: {
          status: AnalyticsDeliveryStatus.FAILED,
          attempts: { increment: 1 },
          lastError: 'GA4_ENABLED is false',
          nextAttemptAt,
          lockedAt: null,
        },
      });
      return false;
    }

    const result = await this.ga4Service.sendGa4Event(delivery.payload as Record<string, unknown>);

    if (result.success) {
      await this.prisma.analyticsDelivery.update({
        where: { id: deliveryId },
        data: {
          status: AnalyticsDeliveryStatus.SENT,
          sentAt: new Date(),
          lastError: null,
          lockedAt: null,
        },
      });
      this.logger.log(
        `[AnalyticsDelivery] Sent eventKey=${delivery.eventKey} (status=${result.status})`,
      );
      return true;
    }

    const nextAttemptAt = computeNextAttemptAt(delivery.attempts + 1, now);
    await this.prisma.analyticsDelivery.update({
      where: { id: deliveryId },
      data: {
        status: AnalyticsDeliveryStatus.FAILED,
        attempts: { increment: 1 },
        lastError: result.error || `HTTP ${result.status}`,
        nextAttemptAt,
        lockedAt: null,
      },
    });
    this.logger.warn(
      `[AnalyticsDelivery] Failed eventKey=${delivery.eventKey} attempt=${delivery.attempts + 1} nextAttemptAt=${nextAttemptAt?.toISOString() || 'MAX_REACHED'}`,
    );
    return false;
  }
}
