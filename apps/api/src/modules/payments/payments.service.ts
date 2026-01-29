import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';

export interface CheckoutIntentDto {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    productLevel: string;
    amountCents: number;
}

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

    /**
     * Creates a PaymentIntent and pre-creates User/Order with PENDING status.
     * This ensures the user can authenticate immediately after frontend payment confirmation.
     * The webhook will update the order status from PENDING to PAID.
     */
    async createCheckoutIntent(dto: CheckoutIntentDto) {
        // 1. Upsert User immediately
        const user = await this.prisma.user.upsert({
            where: { email: dto.email.toLowerCase().trim() },
            update: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone || null,
            },
            create: {
                email: dto.email.toLowerCase().trim(),
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone || null,
                totalOrders: 0,
            },
        });

        // 2. Map level
        const levelMap: Record<string, number> = {
            'INITIE': 1,
            'MYSTIQUE': 2,
            'PROFOND': 3,
            'INTEGRALE': 4,
        };
        const level = levelMap[dto.productLevel?.toUpperCase()] || 1;

        // 3. Generate order number
        const orderNumber = await this.generateOrderNumber();

        // 4. Create Order with PENDING status (will be updated to PAID by webhook)
        const order = await this.prisma.order.create({
            data: {
                orderNumber,
                userId: user.id,
                userEmail: dto.email.toLowerCase().trim(),
                userName: `${dto.firstName} ${dto.lastName}`.trim(),
                level,
                amount: dto.amountCents,
                currency: 'eur',
                status: 'PENDING',
                formData: { phone: dto.phone || '' } as Prisma.JsonObject,
            },
        });

        this.logger.log(`Checkout flow: Created User ${user.id} and Order ${order.id}`);

        // 5. Create PaymentIntent with orderId in metadata
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: dto.amountCents,
            currency: 'eur',
            automatic_payment_methods: { enabled: true },
            metadata: {
                orderId: order.id, // Now we have an orderId for the legacy flow
                email: dto.email,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone || '',
                productLevel: dto.productLevel,
            },
        });

        // 6. Link PaymentIntent to Order
        await this.prisma.order.update({
            where: { id: order.id },
            data: { paymentIntentId: paymentIntent.id },
        });

        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
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
        const { orderId, checkoutFlow, email, firstName, lastName, phone, productLevel } = paymentIntent.metadata;

        // Legacy flow: orderId already exists
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

            try {
                await this.notificationsService.sendOrderConfirmation(order, order.user);
            } catch (error) {
                this.logger.error(`Failed to send order confirmation: ${error instanceof Error ? error.message : String(error)}`);
            }

            // 🚀 AUTO-GENERATE: Trigger AI generation in background
            this.triggerAutoGeneration(orderId).catch(err => {
                this.logger.error(`Auto-generation failed for order ${orderId}: ${err}`);
            });

            return;
        }

        // New checkout flow: create User and Order from metadata
        if (checkoutFlow === 'true' && email) {
            // 1. Upsert User
            const user = await this.prisma.user.upsert({
                where: { email },
                update: {
                    totalOrders: { increment: 1 },
                    lastOrderAt: new Date(),
                },
                create: {
                    email,
                    firstName: firstName || '',
                    lastName: lastName || '',
                    phone: phone || null,
                    totalOrders: 1,
                    lastOrderAt: new Date(),
                },
            });

            // 2. Map level
            const levelMap: Record<string, number> = {
                'INITIE': 1,
                'MYSTIQUE': 2,
                'PROFOND': 3,
                'INTEGRALE': 4,
            };
            const level = levelMap[productLevel?.toUpperCase()] || 1;

            // 3. Generate order number
            const orderNumber = await this.generateOrderNumber();

            // 4. Create Order
            const order = await this.prisma.order.create({
                data: {
                    orderNumber,
                    userId: user.id,
                    userEmail: email,
                    userName: `${firstName} ${lastName}`.trim(),
                    level,
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
                this.logger.error(`Failed to send order confirmation: ${error instanceof Error ? error.message : String(error)}`);
            }

            // 🚀 AUTO-GENERATE: Trigger AI generation in background
            this.triggerAutoGeneration(order.id).catch(err => {
                this.logger.error(`Auto-generation failed for order ${order.id}: ${err}`);
            });
        }
    }

    /**
     * Triggers automatic AI generation for an order.
     * Runs in background after payment confirmation.
     */
    private async triggerAutoGeneration(orderId: string): Promise<void> {
        this.logger.log(`🚀 Starting auto-generation for order: ${orderId}`);
        
        try {
            // Dynamic import to avoid circular dependencies
            const { DigitalSoulService } = await import('../../services/factory/DigitalSoulService');
            const { VertexOracle } = await import('../../services/factory/VertexOracle');
            const { PdfFactory } = await import('../../services/factory/PdfFactory');

            const vertexOracle = new VertexOracle(this.configService, this.prisma);
            const pdfFactory = new PdfFactory(this.configService);
            await pdfFactory.onModuleInit();

            const digitalSoulService = new DigitalSoulService(
                this.configService,
                this.prisma,
                vertexOracle,
                pdfFactory,
            );

            const result = await digitalSoulService.processOrderGeneration(orderId);
            this.logger.log(`✅ Auto-generation completed for ${result.orderNumber} - Archetype: ${result.archetype}`);
        } catch (error) {
            this.logger.error(`❌ Auto-generation failed for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`);
            
            // Mark order as FAILED so admin can see it
            await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    status: 'FAILED',
                    errorLog: `Auto-generation failed: ${error instanceof Error ? error.message : String(error)}`,
                },
            });
        }
    }

    private async generateOrderNumber(): Promise<string> {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const datePrefix = `LU${year}${month}${day}`;

        const count = await this.prisma.order.count({
            where: {
                orderNumber: { startsWith: datePrefix },
            },
        });

        const sequence = (count + 1).toString().padStart(3, '0');
        return `${datePrefix}${sequence}`;
    }
}

