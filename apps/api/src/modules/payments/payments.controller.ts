import { Controller, Post, Get, Body, Headers, Request, RawBodyRequest, Param, HttpException, HttpStatus } from '@nestjs/common';
import { PaymentsService, CheckoutIntentDto, CreateUpsellIntentDto } from './payments.service';
import { Request as ExpressRequest } from 'express';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post('create-intent')
    async createIntent(@Body() body: { orderId: string; amount: number; currency?: string }) {
        return this.paymentsService.createPaymentIntent(body.orderId, body.amount, body.currency);
    }

    @Post('checkout-intent')
    async createCheckoutIntent(@Body() body: CheckoutIntentDto) {
        return this.paymentsService.createCheckoutIntent(body);
    }

    @Post('webhook')
    async webhook(
        @Headers('stripe-signature') signature: string,
        @Request() req: RawBodyRequest<ExpressRequest>,
    ) {
        return this.paymentsService.handleWebhook(signature, req.rawBody);
    }

    // =========================
    // UPSELL ENDPOINTS
    // =========================

    /**
     * Get upsell eligibility and available products for an order
     */
    @Get('orders/:orderId/upsell')
    async getUpsellOptions(@Param('orderId') orderId: string) {
        const result = await this.paymentsService.getOrderForUpsell(orderId);
        if (!result) {
            throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
        }
        return result;
    }

    /**
     * Mark that upsell was shown to user (analytics tracking)
     */
    @Post('orders/:orderId/upsell/offered')
    async markUpsellOffered(@Param('orderId') orderId: string) {
        return this.paymentsService.markUpsellOffered(orderId);
    }

    /**
     * Create PaymentIntent for upsell addon
     */
    @Post('orders/:orderId/upsell')
    async createUpsellIntent(
        @Param('orderId') orderId: string,
        @Body() body: CreateUpsellIntentDto
    ) {
        try {
            return await this.paymentsService.createUpsellIntent(orderId, body.addonType);
        } catch (error) {
            throw new HttpException(
                error instanceof Error ? error.message : 'Upsell failed',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    /**
     * Confirm upsell after payment (for direct confirmation without webhook)
     */
    @Post('orders/:orderId/upsell/confirm')
    async confirmUpsell(
        @Param('orderId') orderId: string,
        @Body() body: { addonType: string; paymentIntentId: string }
    ) {
        try {
            return await this.paymentsService.confirmUpsell(orderId, body.addonType, body.paymentIntentId);
        } catch (error) {
            throw new HttpException(
                error instanceof Error ? error.message : 'Confirmation failed',
                HttpStatus.BAD_REQUEST
            );
        }
    }
}

