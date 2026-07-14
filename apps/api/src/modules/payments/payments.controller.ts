import { Controller, Post, Get, Body, Headers, Request, RawBodyRequest, Param, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { PaymentsService, CreateUpsellIntentDto } from './payments.service';
import { CheckoutIntentDto } from './dto/checkout-intent.dto';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends ExpressRequest {
    user: {
        userId: string;
        email: string;
        role: string;
    };
}

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post('create-intent')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('CLIENT', 'EXPERT', 'ADMIN')
    async createIntent(@Body() body: { orderId: string; currency?: string }) {
        return this.paymentsService.createPaymentIntent(body.orderId, body.currency);
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
        if (!req.rawBody) {
            throw new HttpException('Missing raw body for webhook verification', HttpStatus.BAD_REQUEST);
        }
        return this.paymentsService.handleWebhook(signature, req.rawBody);
    }

    // =========================
    // UPSELL ENDPOINTS (auth required — ownership checked in service)
    // =========================

    @Get('orders/:orderId/upsell')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('CLIENT', 'EXPERT', 'ADMIN')
    async getUpsellOptions(@Param('orderId') orderId: string, @Request() req: AuthenticatedRequest) {
        const userId = req.user.role === 'CLIENT' ? req.user.userId : undefined;
        const result = await this.paymentsService.getOrderForUpsell(orderId, userId);
        if (!result) {
            throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
        }
        return result;
    }

    @Post('orders/:orderId/upsell/offered')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('CLIENT', 'EXPERT', 'ADMIN')
    async markUpsellOffered(@Param('orderId') orderId: string, @Request() req: AuthenticatedRequest) {
        const ownership = await this.paymentsService.getOrderForUpsell(
            orderId,
            req.user.role === 'CLIENT' ? req.user.userId : undefined,
        );
        if (!ownership) {
            throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
        }
        return this.paymentsService.markUpsellOffered(orderId);
    }

    @Post('orders/:orderId/upsell')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('CLIENT', 'EXPERT', 'ADMIN')
    async createUpsellIntent(
        @Param('orderId') orderId: string,
        @Body() body: CreateUpsellIntentDto,
        @Request() req: AuthenticatedRequest,
    ) {
        try {
            return await this.paymentsService.createUpsellIntent(
                orderId,
                body.addonType,
                req.user.role === 'CLIENT' ? req.user.userId : undefined,
            );
        } catch (error) {
            throw new HttpException(
                error instanceof Error ? error.message : 'Upsell failed',
                error instanceof HttpException ? error.getStatus() : HttpStatus.BAD_REQUEST,
            );
        }
    }

    @Post('orders/:orderId/upsell/confirm')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('CLIENT', 'EXPERT', 'ADMIN')
    async confirmUpsell(
        @Param('orderId') orderId: string,
        @Body() body: { addonType: string; paymentIntentId: string },
        @Request() req: AuthenticatedRequest,
    ) {
        try {
            return await this.paymentsService.confirmUpsell(
                orderId,
                body.addonType,
                body.paymentIntentId,
                req.user.role === 'CLIENT' ? req.user.userId : undefined,
            );
        } catch (error) {
            throw new HttpException(
                error instanceof Error ? error.message : 'Confirmation failed',
                error instanceof HttpException ? error.getStatus() : HttpStatus.BAD_REQUEST,
            );
        }
    }
}
