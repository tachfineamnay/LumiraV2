import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryConfigService } from './memory-config.service';
import { MemoryBankError } from './memory.types';
import { MemorySanitizerService } from './memory-sanitizer.service';
import { UserMemoryService } from './user-memory.service';
import { VertexMemoryBankClient } from './vertex-memory-bank.client';

type ConflictResolution = 'SUPERSEDE' | 'KEEP_BOTH';

/**
 * Keeps expert decisions durable and responsive even when the optional Vertex
 * replica is unavailable. PostgreSQL remains the source of truth; failed remote
 * convergence is visible as SYNC_FAILED and retried by the worker with cooldown.
 */
@Injectable()
export class ResilientUserMemoryService extends UserMemoryService {
  private readonly resilienceLogger = new Logger(ResilientUserMemoryService.name);
  private static readonly RETRY_COOLDOWN_MS = 60_000;

  constructor(
    private readonly localPrisma: PrismaService,
    sanitizer: MemorySanitizerService,
    memoryConfig: MemoryConfigService,
    bank: VertexMemoryBankClient,
  ) {
    super(localPrisma, sanitizer, memoryConfig, bank);
  }

  override async approve(
    memoryId: string,
    userId: string,
    expertId: string,
    input: {
      conflictResolution?: ConflictResolution;
      supersedeMemoryId?: string;
      confirmKeepBoth?: boolean;
    },
  ) {
    try {
      return await super.approve(memoryId, userId, expertId, input);
    } catch (error) {
      if (!(error instanceof MemoryBankError)) throw error;

      // The base service persists the approval intent before contacting Vertex.
      // Do not turn an optional replica outage into a failed human decision.
      this.resilienceLogger.warn(`Memory approval queued: code=${error.code}`);
      return this.localMutationResult(memoryId);
    }
  }

  override async convergePendingMutations(
    limit: number,
  ): Promise<{ processed: number; failed: number }> {
    const retryBefore = new Date(Date.now() - ResilientUserMemoryService.RETRY_COOLDOWN_MS);
    const pending = await this.localPrisma.userMemory.findMany({
      where: {
        pendingOperation: { in: ['UPSERT', 'DELETE', 'SUPERSEDE'] },
        OR: [
          { lastSyncError: null },
          { lastSyncError: { in: ['upsert_pending', 'delete_pending', 'write_disabled'] } },
          { updatedAt: { lte: retryBefore } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      // A single remote mutation per worker tick prevents burst retries and
      // preserves quota while Memory Bank is in preview.
      take: Math.min(Math.max(limit, 0), 1),
      select: { id: true },
    });

    let processed = 0;
    let failed = 0;
    for (const memory of pending) {
      try {
        await this.syncMemory(memory.id);
        processed += 1;
      } catch {
        failed += 1;
      }
    }
    return { processed, failed };
  }

  private async localMutationResult(memoryId: string) {
    const memory = await this.localPrisma.userMemory.findUnique({
      where: { id: memoryId },
      select: {
        id: true,
        status: true,
        syncedAt: true,
        vertexMemoryName: true,
        pendingOperation: true,
        lastSyncError: true,
      },
    });
    if (!memory) throw new MemoryBankError('not_found', 'Local memory was not found.', false);

    const { vertexMemoryName, ...publicMemory } = memory;
    return {
      ...publicMemory,
      vertexSynced: Boolean(
        vertexMemoryName &&
          memory.syncedAt &&
          !memory.pendingOperation &&
          memory.status === 'ACTIVE',
      ),
    };
  }
}
