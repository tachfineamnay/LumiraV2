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
   * Creates a Stripe Checkout Session (one-time payment) for lifetime access.
   * Returns { url } to redirect the user to Stripe Hosted Checkout.
   */
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(@Request() req, @Body() dto: CreateCheckoutDto) {
    const webBaseUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');
    const successUrl = dto.successUrl ?? `${webBaseUrl}/sanctuaire?onboarding=1`;
    const cancelUrl = dto.cancelUrl ?? `${webBaseUrl}/tarifs?subscription=cancelled`;

    return this.subscriptionsService.createCheckoutSession(req.user.userId, successUrl, cancelUrl);
  }

  /**
   * GET /subscriptions/status
   * Returns the current subscription record for the authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@Request() req) {
    return this.subscriptionsService.getStatus(req.user.userId);
  }

  /**
   * POST /subscriptions/cancel
   * Legacy endpoint for genuine recurring Stripe subscriptions only.
   */
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Request() req) {
    return this.subscriptionsService.cancel(req.user.userId);
  }

  /**
   * POST /subscriptions/resume
   * Reverts a scheduled cancellation — subscription continues as normal.
   */
  @UseGuards(JwtAuthGuard)
  @Post('resume')
  @HttpCode(HttpStatus.OK)
  async resume(@Request() req) {
    return this.subscriptionsService.resume(req.user.userId);
  }
}
