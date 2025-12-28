import { Controller, Post, Body, Headers, Request, RawBodyRequest } from '@nestjs/common';
import { PaymentsService, CheckoutIntentDto } from './payments.service';
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
}

