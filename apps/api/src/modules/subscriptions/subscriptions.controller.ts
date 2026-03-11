import {
    Controller,
    Post,
    Get,
    Body,
    Request,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { ConfigService } from '@nestjs/config';

@Controller('subscriptions')
export class SubscriptionsController {
    constructor(
        private readonly subscriptionsService: SubscriptionsService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * POST /subscriptions/checkout
     * Creates a Stripe Checkout Session (mode: subscription) for the 29€/month plan.
     * Returns { url } to redirect the user to Stripe Hosted Checkout.
     */
    @UseGuards(JwtAuthGuard)
    @Post('checkout')
    async checkout(@Request() req, @Body() dto: CreateCheckoutDto) {
        const webBaseUrl = this.configService.get<string>('WEB_BASE_URL', 'http://localhost:3000');
        const successUrl = dto.successUrl ?? `${webBaseUrl}/sanctuaire?subscription=success`;
        const cancelUrl = dto.cancelUrl ?? `${webBaseUrl}/tarifs?subscription=cancelled`;

        return this.subscriptionsService.createCheckoutSession(
            req.user.id,
            successUrl,
            cancelUrl,
        );
    }

    /**
     * GET /subscriptions/status
     * Returns the current subscription record for the authenticated user.
     */
    @UseGuards(JwtAuthGuard)
    @Get('status')
    async status(@Request() req) {
        return this.subscriptionsService.getStatus(req.user.id);
    }

    /**
     * POST /subscriptions/cancel
     * Schedules the subscription to cancel at the end of the current billing period.
     * User keeps full access until currentPeriodEnd.
     */
    @UseGuards(JwtAuthGuard)
    @Post('cancel')
    @HttpCode(HttpStatus.OK)
    async cancel(@Request() req) {
        return this.subscriptionsService.cancel(req.user.id);
    }

    /**
     * POST /subscriptions/resume
     * Reverts a scheduled cancellation — subscription continues as normal.
     */
    @UseGuards(JwtAuthGuard)
    @Post('resume')
    @HttpCode(HttpStatus.OK)
    async resume(@Request() req) {
        return this.subscriptionsService.resume(req.user.id);
    }
}
