import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Expert } from '@prisma/client';
import { CurrentExpert } from './decorators';
import { ExpertAuthGuard, RolesGuard } from './guards';
import { ProductionControlService } from './production-control.service';
import { ProductionJobStatus } from './production-control.types';

@Controller('expert')
@UseGuards(ExpertAuthGuard, RolesGuard)
export class ProductionControlController {
  constructor(private readonly production: ProductionControlService) {}

  @Get('production/summary')
  async getSummary() {
    return this.production.getSummary();
  }

  @Get('production/jobs')
  async getJobs(
    @Query('status') status?: ProductionJobStatus,
    @Query('limit') limit?: string,
  ) {
    return {
      data: await this.production.listJobs({
        status,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
      }),
    };
  }

  @Get('orders/:id/control-center')
  async getOrderControlCenter(@Param('id') orderId: string) {
    return this.production.getOrderControlCenter(orderId);
  }

  @Post('orders/:id/jobs/reading')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueueReading(
    @Param('id') orderId: string,
    @Body() body: { expertPrompt?: string; expertInstructions?: string },
    @CurrentExpert() expert: Expert,
  ) {
    return this.production.enqueueReading(orderId, expert, body || {});
  }

  @Post('orders/:id/jobs/audio')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueueAudio(@Param('id') orderId: string, @CurrentExpert() expert: Expert) {
    return this.production.enqueueAudio(orderId, expert);
  }

  @Post('production/jobs/:jobId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  async retryJob(@Param('jobId') jobId: string, @CurrentExpert() expert: Expert) {
    return this.production.retryJob(jobId, expert);
  }

  @Post('production/jobs/:jobId/cancel')
  async cancelJob(@Param('jobId') jobId: string, @CurrentExpert() expert: Expert) {
    return this.production.cancelJob(jobId, expert);
  }

  @Post('production/recover-stale')
  async recoverStaleJobs() {
    const recovered = await this.production.recoverStaleJobs(true);
    return { recovered };
  }
}
