import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryConfigService } from './memory-config.service';
import { MemoryBankError, SanitizedMemoryCandidate } from './memory.types';
import { MemorySanitizerService } from './memory-sanitizer.service';
import { VertexMemoryBankClient } from './vertex-memory-bank.client';

@Injectable()
export class UserMemoryService {
  private readonly logger = new Logger(UserMemoryService.name);
  static readonly AUTO_APPROVE_CONFIDENCE = 0.8;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sanitizer: MemorySanitizerService,
    private readonly memoryConfig: MemoryConfigService,
    private readonly bank: VertexMemoryBankClient,
  ) {}

  async persistSealedCandidates(input: {
    userId: string;
    readingVersionId: string;
    candidates: unknown;
  }): Promise<{ accepted: number; active: number }> {
    const candidates = this.sanitizer.sanitize(input.candidates);
    const now = new Date();
    const rows = candidates.map((candidate) => ({
      userId: input.userId,
      sourceType: 'SEALED_READING' as const,
      sourceId: input.readingVersionId,
      sourceVersionId: input.readingVersionId,
      category: candidate.category,
      fact: candidate.fact,
      contentHash: this.sanitizer.hash(
        `${candidate.category}:${candidate.fact.toLocaleLowerCase('fr-FR')}`,
      ),
      confidence: candidate.confidence,
      status: this.shouldAutoApprove(candidate) ? ('ACTIVE' as const) : ('PENDING' as const),
      ...(this.shouldAutoApprove(candidate) ? { approvedAt: now } : {}),
    }));
    if (rows.length === 0) return { accepted: 0, active: 0 };
    const result = await this.prisma.userMemory.createMany({ data: rows, skipDuplicates: true });
    return { accepted: result.count, active: rows.filter((row) => row.status === 'ACTIVE').length };
  }

  async syncActiveForReading(
    readingVersionId: string,
  ): Promise<{ synced: number; failed: number }> {
    if (!this.memoryConfig.isWriteEnabled()) return { synced: 0, failed: 0 };
    const memories = await this.prisma.userMemory.findMany({
      where: {
        sourceVersionId: readingVersionId,
        status: { in: ['ACTIVE', 'SYNC_FAILED'] },
        vertexMemoryName: null,
      },
      select: { id: true, userId: true, fact: true, category: true },
    });
    let synced = 0;
    let failed = 0;
    for (const memory of memories) {
      try {
        const remote = await this.bank.createMemory({
          userId: memory.userId,
          fact: memory.fact,
          category: memory.category as SanitizedMemoryCandidate['category'],
        });
        await this.prisma.userMemory.update({
          where: { id: memory.id },
          data: {
            status: 'ACTIVE',
            vertexMemoryName: remote.name,
            syncedAt: new Date(),
            lastSyncError: null,
          },
        });
        synced += 1;
      } catch (error) {
        failed += 1;
        const normalized =
          error instanceof MemoryBankError
            ? error
            : new MemoryBankError('non_retryable', 'sync failed', false);
        await this.prisma.userMemory.update({
          where: { id: memory.id },
          data: { status: 'SYNC_FAILED', lastSyncError: normalized.code },
        });
        this.logger.warn(`Memory sync failed: code=${normalized.code}`);
      }
    }
    return { synced, failed };
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const local = await this.prisma.userMemory.findMany({
      where: { userId, vertexMemoryName: { not: null }, status: { not: 'DELETED' } },
      select: { id: true, vertexMemoryName: true },
    });
    if (await this.bank.isConfigured()) {
      for (const memory of local) {
        if (!memory.vertexMemoryName) continue;
        await this.bank.deleteMemory(memory.vertexMemoryName);
      }
      await this.bank.deleteAllUserMemories(userId);
    }
    await this.prisma.userMemory.updateMany({ where: { userId }, data: { status: 'DELETED' } });
  }

  async listForExpert(userId: string) {
    return this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceType: true,
        sourceVersionId: true,
        category: true,
        fact: true,
        status: true,
        confidence: true,
        approvedAt: true,
        syncedAt: true,
        lastSyncError: true,
        createdAt: true,
      },
    });
  }

  async approve(memoryId: string, expertId: string) {
    const memory = await this.prisma.userMemory.update({
      where: { id: memoryId },
      data: {
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedByExpertId: expertId,
        lastSyncError: null,
      },
      select: { id: true, sourceVersionId: true },
    });
    if (memory.sourceVersionId && this.memoryConfig.isWriteEnabled()) {
      await this.syncActiveForReading(memory.sourceVersionId);
    }
    return memory;
  }

  async reject(memoryId: string, expertId: string) {
    return this.prisma.userMemory.update({
      where: { id: memoryId },
      data: { status: 'REJECTED', approvedAt: new Date(), approvedByExpertId: expertId },
      select: { id: true, status: true },
    });
  }

  async delete(memoryId: string) {
    const memory = await this.prisma.userMemory.findUnique({
      where: { id: memoryId },
      select: { vertexMemoryName: true },
    });
    if (!memory) return null;
    if (memory.vertexMemoryName && (await this.bank.isConfigured())) {
      await this.bank.deleteMemory(memory.vertexMemoryName);
    }
    return this.prisma.userMemory.update({
      where: { id: memoryId },
      data: { status: 'DELETED', vertexMemoryName: null, syncedAt: null },
      select: { id: true, status: true },
    });
  }

  private shouldAutoApprove(candidate: SanitizedMemoryCandidate): boolean {
    return (
      this.memoryConfig.isAutoApproveEnabled() &&
      candidate.confidence >= UserMemoryService.AUTO_APPROVE_CONFIDENCE
    );
  }
}
