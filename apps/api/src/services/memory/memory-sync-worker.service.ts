import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MemoryBankError } from './memory.types';
import { MemoryConfigService } from './memory-config.service';
import { MemorySyncService } from './memory-sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserMemoryService } from './user-memory.service';
import { VertexOracle } from '../factory/VertexOracle';

@Injectable()
export class MemorySyncWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemorySyncWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: MemoryConfigService,
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
      await this.sync.recoverStaleJobs();
      await Promise.all(Array.from({ length: this.config.concurrency() }, () => this.processOne()));
    } finally {
      this.running = false;
    }
  }

  private async processOne(): Promise<void> {
    const job = await this.sync.claimNext();
    if (!job) return;
    try {
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
      await this.sync.heartbeat(job.id);
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
        throw new MemoryBankError('unavailable', 'one or more memory writes failed', true);
      }
      await this.sync.succeed(job.id, {
        candidateCount: Array.isArray(candidates) ? candidates.length : 0,
        accepted: stored.accepted,
        active: stored.active,
        synced: synced.synced,
        syncFailed: synced.failed,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const normalized =
        error instanceof MemoryBankError
          ? error
          : /unavailable|timeout|quota|rate limit|network/.test(message)
            ? new MemoryBankError('unavailable', 'memory job temporarily unavailable', true)
            : new MemoryBankError('non_retryable', 'memory job failed', false);
      await this.sync.fail(job.id, job.attempts, normalized.code, normalized.retryable);
      this.logger.warn(`Memory job failed: code=${normalized.code}`);
    }
  }
}
