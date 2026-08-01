import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryConfigService } from './memory-config.service';

type Transaction = Prisma.TransactionClient;

@Injectable()
export class MemorySyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryConfig: MemoryConfigService,
  ) {}

  async enqueueForSealedReading(
    tx: Transaction,
    input: { userId: string; orderId: string; readingVersionId: string; contentHash: string },
  ): Promise<void> {
    if (!this.memoryConfig.isEnabled()) return;
    try {
      await tx.memorySyncJob.create({
        data: { ...input, maxAttempts: this.memoryConfig.maxAttempts(), status: 'QUEUED' },
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
    }
  }

  async recoverStaleJobs(): Promise<void> {
    const staleAt = new Date(Date.now() - this.memoryConfig.staleMs());
    await this.prisma.memorySyncJob.updateMany({
      where: { status: 'RUNNING', heartbeatAt: { lt: staleAt } },
      data: { status: 'QUEUED', nextAttemptAt: new Date(), startedAt: null, heartbeatAt: null },
    });
  }

  async claimNext() {
    const now = new Date();
    const candidate = await this.prisma.memorySyncJob.findFirst({
      where: {
        status: { in: ['QUEUED', 'FAILED'] },
        attempts: { lt: this.memoryConfig.maxAttempts() },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { queuedAt: 'asc' },
    });
    if (!candidate) return null;
    const claim = await this.prisma.memorySyncJob.updateMany({
      where: { id: candidate.id, status: candidate.status },
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
    await this.prisma.memorySyncJob.update({
      where: { id },
      data: {
        status: 'SUCCEEDED',
        completedAt: new Date(),
        heartbeatAt: null,
        result: result as Prisma.InputJsonValue,
      },
    });
  }

  async fail(id: string, attempts: number, errorCode: string, retryable: boolean): Promise<void> {
    const exhausted = !retryable || attempts >= this.memoryConfig.maxAttempts();
    const delay = Math.min(60_000 * 2 ** Math.max(attempts - 1, 0), 3_600_000);
    await this.prisma.memorySyncJob.update({
      where: { id },
      data: {
        status: 'FAILED',
        failedAt: exhausted ? new Date() : null,
        heartbeatAt: null,
        nextAttemptAt: exhausted ? null : new Date(Date.now() + delay),
        lastError: errorCode,
      },
    });
  }
}
