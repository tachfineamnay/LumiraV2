import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MemoryBankError } from './memory.types';
import { MemoryConfigService } from './memory-config.service';
import { MemoryReadinessService } from './memory-readiness.service';
import { MemorySyncService } from './memory-sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserMemoryService } from './user-memory.service';
import { VertexOracle } from '../factory/VertexOracle';

@Injectable()
export class MemorySyncWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemorySyncWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastReadinessCode: string | null = null;

  constructor(
    private readonly config: MemoryConfigService,
    private readonly readiness: MemoryReadinessService,
    private readonly sync: MemorySyncService,
    private readonly prisma: PrismaService,
    private readonly userMemory: UserMemoryService,
    private readonly oracle: VertexOracle,
  ) {}

  onModuleInit(): void {
    if (!this.config.isWorkerEnabled()) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.config.pollMs());
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.running || !this.config.isWorkerEnabled()) return;
    this.running = true;
    try {
      const readiness = await this.readiness.getStatus();
      if (!readiness.ready) {
        this.logNotReady(readiness.code);
        return;
      }
      this.lastReadinessCode = null;
      await this.sync.recoverStaleJobs();
      // Recovery is local PostgreSQL work only. It never invokes Vertex and
      // therefore cannot make sealing or client-facing generation slower.
      await this.sync.enqueueRecentMissingJobs();
      await Promise.all(Array.from({ length: this.config.concurrency() }, () => this.processOne()));
      if (this.config.isWriteEnabled()) {
        await this.userMemory.convergePendingMutations(this.config.pendingMutationLimit());
      }
    } catch (error) {
      this.logger.warn(
        `Memory worker tick failed: ${error instanceof Error ? error.name : 'unknown'}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async processOne(): Promise<void> {
    const readiness = await this.readiness.getStatus();
    if (!readiness.ready) {
      this.logNotReady(readiness.code);
      return;
    }
    const job = await this.sync.claimNext();
    if (!job) return;
    try {
      await this.withHeartbeat(job.id, async () => {
        const version = await this.prisma.readingVersion.findUnique({
          where: { id: job.readingVersionId },
          select: {
            status: true,
            contentHash: true,
            content: true,
            order: { select: { userId: true } },
          },
        });
        if (
          !version ||
          version.status !== 'SEALED' ||
          version.contentHash !== job.contentHash ||
          version.order.userId !== job.userId
        ) {
          throw new MemoryBankError(
            'non_retryable',
            'sealed version no longer matches the queued job',
            false,
          );
        }
        const candidates = await this.oracle.extractMemoryCandidates({
          orderId: job.orderId,
          readingVersionId: job.readingVersionId,
          contentHash: job.contentHash,
          sealedContent: version.content,
        });
        const stored = await this.userMemory.persistSealedCandidates({
          userId: job.userId,
          readingVersionId: job.readingVersionId,
          candidates,
        });
        const synced = await this.userMemory.syncActiveForReading(job.readingVersionId);
        if (synced.failed > 0) {
          throw synced.error ?? new MemoryBankError('unavailable', 'memory write failed', true);
        }
        await this.sync.succeed(job.id, {
          candidateCount: Array.isArray(candidates) ? candidates.length : 0,
          accepted: stored.accepted,
          active: stored.active,
          synced: synced.synced,
          syncFailed: synced.failed,
        });
      });
    } catch (error) {
      const normalized = this.normalizeError(error);
      await this.sync.fail(job, normalized);
      this.logger.warn(`Memory job failed: code=${normalized.code}`);
    }
  }

  private logNotReady(code: string): void {
    if (this.lastReadinessCode === code) return;
    this.lastReadinessCode = code;
    // Keep this operational signal free of config values, user ids and content.
    this.logger.warn(`Memory worker blocked: readiness=${code}`);
  }

  private async withHeartbeat<T>(jobId: string, work: () => Promise<T>): Promise<T> {
    await this.sync.heartbeat(jobId);
    const timer = setInterval(() => {
      void this.sync.heartbeat(jobId).catch((error) => {
        this.logger.warn(
          `Memory worker heartbeat failed: ${error instanceof Error ? error.name : 'unknown'}`,
        );
      });
    }, this.config.heartbeatMs());
    try {
      return await work();
    } finally {
      clearInterval(timer);
    }
  }

  private normalizeError(error: unknown): MemoryBankError {
    if (error instanceof MemoryBankError) return error;
    const code = String((error as { code?: unknown })?.code ?? '').toLowerCase();
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (code === '8' || /quota|resource exhausted|rate limit/.test(message)) {
      return new MemoryBankError('quota', 'memory job quota limited', true);
    }
    if (code === '4' || /timeout|deadline/.test(message)) {
      return new MemoryBankError('timeout', 'memory job timed out', true);
    }
    if (code === '14' || /unavailable|network/.test(message)) {
      return new MemoryBankError('unavailable', 'memory job temporarily unavailable', true);
    }
    if (code === '7' || /permission/.test(message)) {
      return new MemoryBankError('permission_denied', 'memory job permission denied', false);
    }
    if (code === '16' || /credential|unauthenticated/.test(message)) {
      return new MemoryBankError('invalid_credentials', 'memory job credentials invalid', false);
    }
    if (code === '3' || /invalid parent|invalid argument|sealed version/.test(message)) {
      return new MemoryBankError('invalid_argument', 'memory job input invalid', false);
    }
    return new MemoryBankError('non_retryable', 'memory job failed', false);
  }
}
