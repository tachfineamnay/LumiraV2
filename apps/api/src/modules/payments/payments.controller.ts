import { Controller, Post, Body, Headers, Request, RawBodyRequest, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post('create-intent')
    async createIntent(@Body() body: { orderId: string; amount: number; currency?: string }) {
        return this.paymentsService.createPaymentIntent(body.orderId, body.amount, body.currency);
    }

    @Post('webhook')
    async webhook(
        @Headers('stripe-signature') signature: string,
        @Request() req: RawBodyRequest<any>,
    ) {
        return this.paymentsService.handleWebhook(signature, req.rawBody);
    }
}
