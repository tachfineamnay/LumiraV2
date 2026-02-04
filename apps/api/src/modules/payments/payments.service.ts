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

export interface UpsellAddon {
    type: string;
    name: string;
    amount: number;
    paidAt?: Date;
}

export interface CreateUpsellIntentDto {
    addonType: 'FORECAST_6M' | 'FORECAST_12M' | 'PRIORITY_DELIVERY';
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
        const normalizedEmail = dto.email.toLowerCase().trim();
        this.logger.log(`[CheckoutIntent] Starting for email: ${normalizedEmail}`);
        
        // 1. Upsert User immediately
        const user = await this.prisma.user.upsert({
            where: { email: normalizedEmail },
            update: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone || null,
            },
            create: {
                email: normalizedEmail,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone || null,
                totalOrders: 0,
            },
        });
        
        this.logger.log(`[CheckoutIntent] User upserted: ${user.id} for email: ${normalizedEmail}`);

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
                userEmail: normalizedEmail,
                userName: `${dto.firstName} ${dto.lastName}`.trim(),
                level,
                amount: dto.amountCents,
                currency: 'eur',
                status: 'PENDING',
                formData: { phone: dto.phone || '' } as Prisma.JsonObject,
            },
        });

        this.logger.log(`[CheckoutIntent] Order created: ${order.id}, status: ${order.status}, amount: ${order.amount}, email: ${normalizedEmail}`);

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
        const { orderId, checkoutFlow, email, firstName, lastName, phone, productLevel, isUpsell, upsellType } = paymentIntent.metadata;

        // Handle UPSELL payment
        if (isUpsell === 'true' && orderId && upsellType) {
            this.logger.log(`[Upsell Webhook] Processing upsell for order ${orderId}, type: ${upsellType}`);
            await this.confirmUpsell(orderId, upsellType, paymentIntent.id);
            return;
        }

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

            // NOTE: No auto-generation. Client completes onboarding first, then expert generates manually from Desk.

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

            // NOTE: No auto-generation. Client completes onboarding first, then expert generates manually from Desk.
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

    // =========================
    // UPSELL ONE-CLICK SYSTEM
    // =========================

    private readonly UPSELL_PRODUCTS: Record<string, { name: string; amount: number; description: string }> = {
        'FORECAST_6M': {
            name: 'Prévisions 6 mois',
            amount: 2700, // 27€ (special price, normally 67€)
            description: 'Ajout des prévisions sur 6 mois à votre lecture'
        },
        'FORECAST_12M': {
            name: 'Prévisions 12 mois',
            amount: 4700, // 47€ (special price, normally 97€)
            description: 'Ajout des prévisions sur 12 mois à votre lecture'
        },
        'PRIORITY_DELIVERY': {
            name: 'Livraison Prioritaire',
            amount: 1500, // 15€
            description: 'Recevez votre lecture en priorité sous 24h'
        }
    };

    /**
     * Mark that upsell was shown to user (for analytics)
     */
    async markUpsellOffered(orderId: string) {
        return this.prisma.order.update({
            where: { id: orderId },
            data: { upsellOfferedAt: new Date() }
        });
    }

    /**
     * Get order with upsell eligibility info
     */
    async getOrderForUpsell(orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { user: true }
        });

        if (!order) {
            return null;
        }

        // Check eligibility: order must be PAID and not already have this addon
        const existingAddons = (order.addons as unknown as UpsellAddon[] | null) || [];
        const availableUpsells = Object.entries(this.UPSELL_PRODUCTS)
            .filter(([type]) => !existingAddons.some(a => a.type === type))
            .map(([type, product]) => ({
                type,
                ...product
            }));

        return {
            order,
            availableUpsells,
            isEligible: order.status === 'PAID' && availableUpsells.length > 0
        };
    }

    /**
     * Create PaymentIntent for upsell addon (one-click if payment method saved)
     */
    async createUpsellIntent(orderId: string, addonType: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { user: true }
        });

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.status !== 'PAID') {
            throw new Error('Order must be paid before upsell');
        }

        const product = this.UPSELL_PRODUCTS[addonType];
        if (!product) {
            throw new Error('Invalid upsell product');
        }

        // Check if addon already purchased
        const existingAddons = (order.addons as unknown as UpsellAddon[] | null) || [];
        if (existingAddons.some(a => a.type === addonType)) {
            throw new Error('Addon already purchased');
        }

        // Try to get saved payment method from Stripe customer
        let paymentMethodId: string | null = null;
        if (order.user.stripeCustomerId) {
            try {
                const paymentMethods = await this.stripe.paymentMethods.list({
                    customer: order.user.stripeCustomerId,
                    type: 'card',
                    limit: 1
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
                metadata: { userId: order.userId }
            });
            customerId = customer.id;
            
            // Save customer ID
            await this.prisma.user.update({
                where: { id: order.userId },
                data: { stripeCustomerId: customerId }
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
                isUpsell: 'true'
            },
            description: product.description
        };

        // If we have a saved payment method, attach it for faster checkout
        if (paymentMethodId) {
            paymentIntentParams.payment_method = paymentMethodId;
        }

        const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentParams);

        this.logger.log(`[Upsell] Created PaymentIntent ${paymentIntent.id} for order ${orderId}, addon: ${addonType}`);

        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: product.amount,
            productName: product.name,
            hasPaymentMethod: !!paymentMethodId
        };
    }

    /**
     * Confirm upsell after successful payment (called by webhook or direct confirmation)
     */
    async confirmUpsell(orderId: string, addonType: string, paymentIntentId: string) {
        const product = this.UPSELL_PRODUCTS[addonType];
        if (!product) {
            throw new Error('Invalid upsell product');
        }

        const order = await this.prisma.order.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            throw new Error('Order not found');
        }

        const existingAddons = (order.addons as unknown as UpsellAddon[] | null) || [];
        
        // Add the new addon
        const newAddon: UpsellAddon = {
            type: addonType,
            name: product.name,
            amount: product.amount,
            paidAt: new Date()
        };

        const updatedAddons = [...existingAddons, newAddon];

        // Update order
        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                addons: updatedAddons as unknown as Prisma.InputJsonValue,
                upsellAcceptedAt: new Date(),
                // Also update total amount for records
                amount: order.amount + product.amount
            }
        });

        this.logger.log(`[Upsell] Confirmed addon ${addonType} for order ${orderId}. New total: ${updatedOrder.amount}`);

        return {
            success: true,
            order: updatedOrder,
            addon: newAddon
        };
    }
}

