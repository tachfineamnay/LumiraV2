import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryConfigService } from './memory-config.service';
import { MemoryReadinessService } from './memory-readiness.service';
import { MemoryBankError } from './memory.types';

type Transaction = Prisma.TransactionClient;
type EnqueueInput = {
  userId: string;
  orderId: string;
  readingVersionId: string;
  contentHash: string;
};

@Injectable()
export class MemorySyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryConfig: MemoryConfigService,
    private readonly readiness: MemoryReadinessService,
  ) {}

  async enqueueForSealedReading(
    tx: Transaction | PrismaService,
    input: EnqueueInput,
  ): Promise<void> {
    if (!this.memoryConfig.isEnabled()) return;
    if (!(await this.readiness.getStatus()).ready) return;
    await this.createJob(tx, input);
  }

  /** Historical backfill is ADMIN-only. The worker never calls this method. */
  async enqueueMissingJobs(input: {
    dryRun: boolean;
    limit: number;
    userId?: string;
    orderId?: string;
  }) {
    if (!this.memoryConfig.isEnabled()) return { enabled: false, candidates: [], enqueued: 0 };
    const readiness = input.dryRun ? null : await this.readiness.getStatus();
    if (readiness && !readiness.ready) {
      return {
        enabled: true,
        ready: false,
        readiness: readiness.code,
        candidates: [],
        enqueued: 0,
      };
    }
    return this.enqueueByWhere(input, {});
  }

  /**
   * Recovery deliberately has a short temporal window. It only fills an
   * enqueue gap for a newly sealed reading, never replays the history.
   */
  async enqueueRecentMissingJobs() {
    if (!this.memoryConfig.isEnabled()) return { enabled: false, candidates: [], enqueued: 0 };
    const readiness = await this.readiness.getStatus();
    if (!readiness.ready) {
      return {
        enabled: true,
        ready: false,
        readiness: readiness.code,
        candidates: [],
        enqueued: 0,
      };
    }
    return this.enqueueByWhere(
      { dryRun: false, limit: this.memoryConfig.recoveryLimit() },
      { sealedAt: { gte: new Date(Date.now() - this.memoryConfig.recoveryLookbackMs()) } },
    );
  }

  private async enqueueByWhere(
    input: { dryRun: boolean; limit: number; userId?: string; orderId?: string },
    extraWhere: Prisma.ReadingVersionWhereInput,
  ) {
    const where: Prisma.ReadingVersionWhereInput = {
      status: 'SEALED',
      memorySyncJob: null,
      ...extraWhere,
      ...(input.userId || input.orderId
        ? {
            order: {
              ...(input.userId ? { userId: input.userId } : {}),
              ...(input.orderId ? { id: input.orderId } : {}),
            },
          }
        : {}),
    };
    const versions = await this.prisma.readingVersion.findMany({
      where,
      take: input.limit,
      orderBy: { sealedAt: 'asc' },
      select: { id: true, orderId: true, contentHash: true, order: { select: { userId: true } } },
    });
    const candidates = versions.map((version) => ({
      userId: version.order.userId,
      orderId: version.orderId,
      readingVersionId: version.id,
      contentHash: version.contentHash,
    }));
    if (input.dryRun) return { enabled: true, candidates, enqueued: 0 };

    let enqueued = 0;
    for (const candidate of candidates) {
      try {
        await this.createJob(this.prisma, candidate);
        enqueued += 1;
      } catch (error) {
        if ((error as { code?: string })?.code !== 'P2002') throw error;
      }
    }
    return { enabled: true, candidates, enqueued };
  }

  async recoverStaleJobs(): Promise<void> {
    if (!(await this.readiness.getStatus()).ready) return;
    const staleAt = new Date(Date.now() - this.memoryConfig.staleMs());
    const jobs = await this.prisma.memorySyncJob.findMany({
      where: {
        status: 'RUNNING',
        OR: [{ heartbeatAt: { lt: staleAt } }, { heartbeatAt: null, startedAt: { lt: staleAt } }],
      },
      select: { id: true, attempts: true, maxAttempts: true },
      take: 100,
    });
    for (const job of jobs) {
      const terminal = job.attempts >= job.maxAttempts;
      await this.prisma.memorySyncJob.updateMany({
        where: { id: job.id, status: 'RUNNING', attempts: job.attempts },
        data: terminal
          ? {
              status: 'CANCELLED',
              failedAt: new Date(),
              heartbeatAt: null,
              nextAttemptAt: null,
              lastError: 'stale_exhausted',
            }
          : {
              status: 'QUEUED',
              nextAttemptAt: new Date(),
              startedAt: null,
              heartbeatAt: null,
              lastError: 'stale_recovered',
            },
      });
    }
  }

  async claimNext() {
    if (!(await this.readiness.getStatus()).ready) return null;
    const now = new Date();
    const candidate = await this.prisma.memorySyncJob.findFirst({
      where: {
        OR: [
          {
            status: 'QUEUED',
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
          },
          { status: 'FAILED', nextAttemptAt: { lte: now } },
        ],
      },
      orderBy: { queuedAt: 'asc' },
    });
    if (!candidate) return null;
    if (candidate.attempts >= candidate.maxAttempts) {
      await this.prisma.memorySyncJob.updateMany({
        where: { id: candidate.id, status: candidate.status, attempts: candidate.attempts },
        data: {
          status: 'CANCELLED',
          failedAt: now,
          nextAttemptAt: null,
          lastError: 'attempts_exhausted',
        },
      });
      return null;
    }
    const claim = await this.prisma.memorySyncJob.updateMany({
      where: { id: candidate.id, status: candidate.status, attempts: candidate.attempts },
      data: {
        status: 'RUNNING',
        attempts: { increment: 1 },
        startedAt: now,
        heartbeatAt: now,
        lastError: null,
      },
    });
    return claim.count === 1
      ? this.prisma.memorySyncJob.findUnique({ where: { id: candidate.id } })
      : null;
  }

  async heartbeat(id: string): Promise<void> {
    await this.prisma.memorySyncJob.updateMany({
      where: { id, status: 'RUNNING' },
      data: { heartbeatAt: new Date() },
    });
  }

  async succeed(id: string, result: Record<string, unknown>): Promise<void> {
    await this.prisma.memorySyncJob.updateMany({
      where: { id, status: 'RUNNING' },
      data: {
        status: 'SUCCEEDED',
        completedAt: new Date(),
        heartbeatAt: null,
        result: result as Prisma.InputJsonValue,
        nextAttemptAt: null,
      },
    });
  }

  async fail(job: { id: string; attempts: number; maxAttempts: number }, error: MemoryBankError) {
    const exhausted = !error.retryable || job.attempts >= job.maxAttempts;
    const delay = Math.min(60_000 * 2 ** Math.max(job.attempts - 1, 0), 3_600_000);
    await this.prisma.memorySyncJob.updateMany({
      where: { id: job.id, status: 'RUNNING', attempts: job.attempts },
      data: {
        status: exhausted ? 'CANCELLED' : 'FAILED',
        failedAt: exhausted ? new Date() : null,
        heartbeatAt: null,
        nextAttemptAt: exhausted ? null : new Date(Date.now() + delay),
        lastError: error.code,
      },
    });
  }

  async listForUser(userId: string, limit = 20) {
    return this.prisma.memorySyncJob.findMany({
      where: { userId },
      orderBy: { queuedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        orderId: true,
        readingVersionId: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        queuedAt: true,
        startedAt: true,
        completedAt: true,
        failedAt: true,
        nextAttemptAt: true,
        lastError: true,
        result: true,
      },
    });
  }

  async retryForUser(jobId: string, userId: string) {
    const job = await this.prisma.memorySyncJob.findUnique({
      where: { id: jobId },
      select: { id: true, userId: true, status: true },
    });
    if (!job || job.userId !== userId)
      throw new NotFoundException('Job mémoire introuvable pour ce client.');
    if (!['FAILED', 'CANCELLED'].includes(job.status)) {
      throw new BadRequestException('Seul un job mémoire arrêté peut être relancé manuellement.');
    }
    return this.prisma.memorySyncJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        attempts: 0,
        queuedAt: new Date(),
        startedAt: null,
        heartbeatAt: null,
        completedAt: null,
        failedAt: null,
        nextAttemptAt: new Date(),
        lastError: null,
      },
      select: { id: true, status: true, attempts: true, maxAttempts: true },
    });
  }

  private async createJob(client: Transaction | PrismaService, input: EnqueueInput): Promise<void> {
    try {
      await client.memorySyncJob.create({
        data: { ...input, maxAttempts: this.memoryConfig.maxAttempts(), status: 'QUEUED' },
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
    }
  }
}
