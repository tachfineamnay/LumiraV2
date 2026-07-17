import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ProductionJobState,
  readCurrentProduction,
  readExpertReview,
  toJson,
} from './production-control.types';

/**
 * Covers the narrow crash window between claiming a reading job and the
 * DigitalSoulService transition from PAID to PROCESSING.
 */
@Injectable()
export class ProductionPaidRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductionPaidRecoveryService.name);
  private readonly enabled: boolean;
  private readonly staleAfterMs: number;
  private readonly scanIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private scanning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.enabled = this.config.get<string>('PRODUCTION_WORKER_ENABLED', 'true') !== 'false';
    this.staleAfterMs = this.readPositiveInt('PRODUCTION_JOB_STALE_MS', 15 * 60 * 1000);
    this.scanIntervalMs = Math.max(30_000, Math.min(this.staleAfterMs / 2, 60_000));
  }

  onModuleInit() {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.scan(), this.scanIntervalMs);
    setTimeout(() => void this.scan(), 1_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async scan(now = Date.now()): Promise<number> {
    if (!this.enabled || this.scanning) return 0;
    this.scanning = true;
    try {
      const orders = await this.prisma.order.findMany({
        where: { status: 'PAID' },
        orderBy: { updatedAt: 'asc' },
        take: 100,
        select: { id: true, expertReview: true },
      });

      let recovered = 0;
      for (const order of orders) {
        const job = readCurrentProduction(order.expertReview);
        if (!job || job.type !== 'READING_GENERATION' || job.status !== 'RUNNING') continue;

        const heartbeat = Date.parse(job.heartbeatAt || job.startedAt || job.queuedAt);
        if (!Number.isFinite(heartbeat) || now - heartbeat < this.staleAfterMs) continue;

        const review = readExpertReview(order.expertReview);
        const timestamp = new Date(now).toISOString();
        const production: ProductionJobState =
          job.attempts >= job.maxAttempts
            ? {
                ...job,
                status: 'FAILED',
                stage: 'STALE_MAX_ATTEMPTS',
                failedAt: timestamp,
                heartbeatAt: timestamp,
                error: {
                  code: 'STALE_JOB',
                  message: 'Traitement interrompu avant le démarrage de la génération',
                },
              }
            : {
                ...job,
                status: 'QUEUED',
                stage: 'RECOVERED_AFTER_RESTART',
                heartbeatAt: timestamp,
                error: undefined,
              };

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: production.status === 'FAILED' ? 'FAILED' : 'PAID',
            expertReview: toJson({ ...review, production }),
          },
        });
        recovered += 1;
      }

      if (recovered > 0) {
        this.logger.warn(`Recovered ${recovered} PAID production job(s) after restart`);
      }
      return recovered;
    } finally {
      this.scanning = false;
    }
  }

  private readPositiveInt(key: string, fallback: number) {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
}
