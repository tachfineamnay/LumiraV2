import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsDeliveryStatus } from '@prisma/client';
import { AnalyticsDeliveryService } from './analytics-delivery.service';

@Injectable()
export class AnalyticsDeliveryWorker {
  private readonly logger = new Logger(AnalyticsDeliveryWorker.name);
  private isProcessing = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly deliveryService: AnalyticsDeliveryService,
  ) {}

  private isWorkerEnabled(): boolean {
    const ga4Enabled = this.configService.get<string>('GA4_ENABLED') === 'true';
    const workerEnabled = this.configService.get<string>('GA4_DELIVERY_WORKER_ENABLED') === 'true';
    return ga4Enabled && workerEnabled;
  }

  @Cron('*/2 * * * *')
  async handleCron() {
    if (!this.isWorkerEnabled() || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      await this.processPendingBatch();
    } catch (err) {
      this.logger.error(
        `[AnalyticsWorker] Cron cycle failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  async processPendingBatch(batchSize = 20): Promise<number> {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const candidates = await this.prisma.analyticsDelivery.findMany({
      where: {
        OR: [
          { status: AnalyticsDeliveryStatus.PENDING },
          {
            status: AnalyticsDeliveryStatus.FAILED,
            attempts: { lt: 8 },
            nextAttemptAt: { lte: now },
          },
          {
            status: AnalyticsDeliveryStatus.PROCESSING,
            lockedAt: { lte: fifteenMinutesAgo },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    if (candidates.length === 0) {
      return 0;
    }

    this.logger.log(
      `[AnalyticsWorker] Processing batch of ${candidates.length} pending/failed deliveries`,
    );
    let processedCount = 0;

    for (const item of candidates) {
      try {
        const success = await this.deliveryService.processDelivery(item.id);
        if (success) processedCount++;
      } catch (err) {
        this.logger.error(
          `[AnalyticsWorker] Error processing item ${item.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return processedCount;
  }
}
