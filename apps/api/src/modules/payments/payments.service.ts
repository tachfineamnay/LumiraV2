import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
    private stripe: Stripe;
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        private configService: ConfigService,
        private ordersService: OrdersService,
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
    ) {
        this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY')!, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            apiVersion: '2025-12-15.clover' as any,
        });
    }

    async createPaymentIntent(orderId: string, amount: number, currency: string = 'eur') {
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount,
            currency,
            metadata: { orderId },
        });

        await this.ordersService.update(orderId, {
            paymentIntentId: paymentIntent.id,
        });

        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
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
            throw err;
        }

        // Idempotency check
        const processed = await this.prisma.processedEvent.findUnique({
            where: { eventId: event.id },
        });
        if (processed) {
            this.logger.log(`Event ${event.id} already processed`);
            return { received: true };
        }

        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                await this.handlePaymentSucceeded(paymentIntent);
                break;
            }
            // Add more event handlers as needed
        }

        await this.prisma.processedEvent.create({
            data: {
                eventId: event.id,
                eventType: event.type,
                data: event.data.object as unknown as Prisma.InputJsonValue,
            },
        });

        return { received: true };
    }

    private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
        const orderId = paymentIntent.metadata.orderId;
        if (orderId) {
            const order = await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    status: 'PAID',
                    paidAt: new Date(),
                },
                include: { user: true }
            });
            this.logger.log(`Order ${orderId} marked as PAID`);

            // Send order confirmation email
            await this.notificationsService.sendOrderConfirmation(order, order.user);

            // Send expert alert
            await this.notificationsService.sendExpertAlert(order);
        }
    }
}
