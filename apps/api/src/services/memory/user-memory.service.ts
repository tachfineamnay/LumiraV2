import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryConfigService } from './memory-config.service';
import { MemoryBankError, MemoryCategory, SanitizedMemoryCandidate } from './memory.types';
import { MemorySanitizerService } from './memory-sanitizer.service';
import { VertexMemoryBankClient } from './vertex-memory-bank.client';

type EditableMemory = {
  category: MemoryCategory;
  fact: string;
  contentHash: string;
};

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
    const active = await this.prisma.userMemory.findMany({
      where: {
        userId: input.userId,
        status: 'ACTIVE',
        category: { in: candidates.map((item) => item.category) },
      },
      select: { category: true, contentHash: true },
    });
    const activeByCategory = new Map(active.map((item) => [item.category, item.contentHash]));
    const now = new Date();
    const rows = candidates.map((candidate) => {
      const contentHash = this.sanitizer.hash(
        `${candidate.category}:${candidate.fact.toLocaleLowerCase('fr-FR')}`,
      );
      const potentialConflict =
        activeByCategory.has(candidate.category) &&
        activeByCategory.get(candidate.category) !== contentHash;
      const activeStatus = this.shouldAutoApprove(candidate) && !potentialConflict;
      return {
        userId: input.userId,
        sourceType: 'SEALED_READING' as const,
        sourceId: input.readingVersionId,
        sourceVersionId: input.readingVersionId,
        category: candidate.category,
        fact: candidate.fact,
        contentHash,
        confidence: candidate.confidence,
        status: activeStatus ? ('ACTIVE' as const) : ('PENDING' as const),
        ...(activeStatus ? { approvedAt: now } : {}),
        ...(potentialConflict ? { lastSyncError: 'potential_conflict' } : {}),
      };
    });
    if (rows.length === 0) return { accepted: 0, active: 0 };
    const result = await this.prisma.userMemory.createMany({ data: rows, skipDuplicates: true });
    return { accepted: result.count, active: rows.filter((row) => row.status === 'ACTIVE').length };
  }

  async syncActiveForReading(readingVersionId: string): Promise<{
    synced: number;
    failed: number;
    error?: MemoryBankError;
  }> {
    if (!this.memoryConfig.isWriteEnabled()) return { synced: 0, failed: 0 };
    const memories = await this.prisma.userMemory.findMany({
      where: {
        sourceVersionId: readingVersionId,
        status: { in: ['ACTIVE', 'SYNC_FAILED'] },
      },
      select: { id: true },
    });
    let synced = 0;
    let failed = 0;
    let firstError: MemoryBankError | undefined;
    for (const memory of memories) {
      try {
        await this.syncMemory(memory.id);
        synced += 1;
      } catch (error) {
        failed += 1;
        firstError ??= this.asMemoryError(error);
      }
    }
    return { synced, failed, error: firstError };
  }

  async syncMemory(memoryId: string): Promise<void> {
    if (!this.memoryConfig.isWriteEnabled()) return;
    const memory = await this.prisma.userMemory.findUnique({
      where: { id: memoryId },
      select: {
        id: true,
        userId: true,
        fact: true,
        category: true,
        status: true,
        vertexMemoryName: true,
      },
    });
    if (!memory || !['ACTIVE', 'SYNC_FAILED'].includes(memory.status)) return;

    try {
      const remote = memory.vertexMemoryName
        ? await this.bank.updateMemory(memory.vertexMemoryName, memory.fact)
        : await this.bank.createMemory({
            userId: memory.userId,
            fact: memory.fact,
            category: memory.category as MemoryCategory,
          });
      if (remote.scope.user_id !== memory.userId) {
        throw new MemoryBankError('invalid_argument', 'Memory Bank scope mismatch.', false);
      }
      await this.prisma.userMemory.update({
        where: { id: memory.id },
        data: {
          status: 'ACTIVE',
          vertexMemoryName: remote.name,
          syncedAt: new Date(),
          lastSyncError: null,
        },
      });
    } catch (error) {
      const normalized = this.asMemoryError(error);
      await this.prisma.userMemory.update({
        where: { id: memory.id },
        data: { status: 'SYNC_FAILED', lastSyncError: normalized.code },
      });
      this.logger.warn(`Memory sync failed: code=${normalized.code}`);
      throw normalized;
    }
  }

  /**
   * Deletes and re-lists the remote scope before any customer S3 or PostgreSQL
   * data is touched. A legacy account with no memory trace remains purgeable.
   */
  async deleteRemoteForUser(userId: string): Promise<{ deleted: number }> {
    const local = await this.prisma.userMemory.findMany({
      where: { userId, vertexMemoryName: { not: null }, status: { not: 'DELETED' } },
      select: { vertexMemoryName: true },
    });
    const configured = await this.bank.isConfigured();
    if (!configured) {
      if (local.length > 0) {
        throw new MemoryBankError(
          'not_configured',
          'Vertex Memory must be configured before a referenced memory can be purged.',
          false,
        );
      }
      return { deleted: 0 };
    }

    for (const memory of local) {
      if (memory.vertexMemoryName) await this.bank.deleteMemory(memory.vertexMemoryName);
    }
    const deleted = await this.bank.deleteAllUserMemories(userId);
    return { deleted: Math.max(deleted, local.length) };
  }

  async markAllDeleted(userId: string): Promise<void> {
    await this.prisma.userMemory.updateMany({
      where: { userId },
      data: { status: 'DELETED', vertexMemoryName: null, syncedAt: null },
    });
  }

  async listForExpert(userId: string) {
    const memories = await this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        sourceType: true,
        sourceId: true,
        sourceVersionId: true,
        category: true,
        fact: true,
        status: true,
        contentHash: true,
        vertexMemoryName: true,
        confidence: true,
        approvedByExpertId: true,
        approvedAt: true,
        syncedAt: true,
        lastSyncError: true,
        createdAt: true,
        updatedAt: true,
        readingVersion: { select: { orderId: true, version: true } },
      },
    });
    const activeByCategory = new Map<string, Array<{ id: string; fact: string }>>();
    for (const memory of memories) {
      if (memory.status !== 'ACTIVE') continue;
      activeByCategory.set(memory.category, [
        ...(activeByCategory.get(memory.category) ?? []),
        { id: memory.id, fact: memory.fact },
      ]);
    }
    return memories.map((memory) => ({
      ...memory,
      conflictsWith:
        memory.status === 'PENDING'
          ? (activeByCategory.get(memory.category) ?? []).filter(
              (item) => item.fact !== memory.fact,
            )
          : [],
    }));
  }

  async countersForExpert(userId: string) {
    const grouped = await this.prisma.userMemory.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    });
    return grouped.reduce<Record<string, number>>((counts, row) => {
      counts[row.status] = row._count._all;
      return counts;
    }, {});
  }

  async approve(memoryId: string, userId: string, expertId: string, supersedeMemoryId?: string) {
    await this.assertOwned(memoryId, userId);
    if (supersedeMemoryId) {
      if (supersedeMemoryId === memoryId) {
        throw new BadRequestException('Une mémoire ne peut pas se remplacer elle-même.');
      }
      const superseded = await this.assertOwned(supersedeMemoryId, userId);
      await this.deleteRemoteReference(superseded.vertexMemoryName);
      await this.prisma.userMemory.update({
        where: { id: superseded.id },
        data: { status: 'SUPERSEDED', vertexMemoryName: null, syncedAt: null },
      });
    }
    const memory = await this.prisma.userMemory.update({
      where: { id: memoryId },
      data: {
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedByExpertId: expertId,
        lastSyncError: null,
      },
      select: { id: true, userId: true },
    });
    await this.syncMemory(memory.id);
    return memory;
  }

  async reject(memoryId: string, userId: string, expertId: string) {
    const memory = await this.assertOwned(memoryId, userId);
    await this.deleteRemoteReference(memory.vertexMemoryName);
    return this.prisma.userMemory.update({
      where: { id: memoryId },
      data: {
        status: 'REJECTED',
        approvedAt: new Date(),
        approvedByExpertId: expertId,
        vertexMemoryName: null,
        syncedAt: null,
      },
      select: { id: true, userId: true, status: true },
    });
  }

  async delete(memoryId: string, userId: string) {
    const memory = await this.assertOwned(memoryId, userId);
    await this.deleteRemoteReference(memory.vertexMemoryName);
    return this.prisma.userMemory.update({
      where: { id: memoryId },
      data: { status: 'DELETED', vertexMemoryName: null, syncedAt: null },
      select: { id: true, userId: true, status: true },
    });
  }

  async edit(
    memoryId: string,
    userId: string,
    expertId: string,
    input: { fact: string; category?: string; supersedeMemoryId?: string },
  ) {
    const memory = await this.assertOwned(memoryId, userId);
    if (['DELETED', 'REJECTED', 'SUPERSEDED'].includes(memory.status)) {
      throw new BadRequestException('Cette mémoire ne peut plus être modifiée.');
    }
    const editable = this.sanitizeEdit(input.fact, input.category ?? memory.category);
    const duplicate = await this.prisma.userMemory.findFirst({
      where: { userId, contentHash: editable.contentHash, id: { not: memoryId } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Une mémoire identique existe déjà pour ce client.');

    if (input.supersedeMemoryId) {
      if (input.supersedeMemoryId === memoryId) {
        throw new BadRequestException('Une mémoire ne peut pas se remplacer elle-même.');
      }
      const superseded = await this.assertOwned(input.supersedeMemoryId, userId);
      await this.deleteRemoteReference(superseded.vertexMemoryName);
      await this.prisma.userMemory.update({
        where: { id: superseded.id },
        data: { status: 'SUPERSEDED', vertexMemoryName: null, syncedAt: null },
      });
    }

    if (memory.vertexMemoryName) {
      await this.ensureBankConfigured();
      await this.bank.updateMemory(memory.vertexMemoryName, editable.fact);
    }
    const updated = await this.prisma.userMemory.update({
      where: { id: memoryId },
      data: {
        category: editable.category,
        fact: editable.fact,
        contentHash: editable.contentHash,
        sourceType: 'EXPERT_CORRECTION',
        approvedByExpertId: expertId,
        approvedAt: new Date(),
        lastSyncError: null,
      },
      select: { id: true, userId: true, status: true, vertexMemoryName: true },
    });
    if (!updated.vertexMemoryName && updated.status === 'ACTIVE') await this.syncMemory(updated.id);
    return updated;
  }

  async resync(memoryId: string, userId: string) {
    const memory = await this.assertOwned(memoryId, userId);
    if (['DELETED', 'REJECTED', 'SUPERSEDED'].includes(memory.status)) {
      throw new BadRequestException('Cette mémoire ne peut pas être resynchronisée.');
    }
    if (memory.status === 'PENDING') {
      throw new BadRequestException('Cette mémoire doit être approuvée avant synchronisation.');
    }
    await this.syncMemory(memory.id);
    return this.prisma.userMemory.findUnique({
      where: { id: memory.id },
      select: { id: true, userId: true, status: true, vertexMemoryName: true, syncedAt: true },
    });
  }

  async runIsolationDiagnostic(label?: string) {
    const users = this.memoryConfig.diagnosticUsers();
    if (!users) {
      throw new BadRequestException(
        'Les deux comptes techniques de diagnostic Vertex doivent être configurés.',
      );
    }
    await this.ensureBankConfigured();
    const [existingA, existingB] = await Promise.all([
      this.bank.listUserMemories(users.userAId),
      this.bank.listUserMemories(users.userBId),
    ]);
    if (existingA.length > 0 || existingB.length > 0) {
      throw new ConflictException(
        'Les comptes techniques de diagnostic doivent être vides avant le test.',
      );
    }

    const fact = `Diagnostic technique Lumira ${label?.trim().slice(0, 40) || Date.now().toString(36)}`;
    let createdName: string | null = null;
    let diagnosticError: unknown;
    let result: {
      created: true;
      retrievedForA: true;
      absentFromB: true;
      scopeBreakRejected: true;
    } | null = null;
    try {
      const created = await this.bank.createMemory({
        userId: users.userAId,
        fact,
        category: 'READING_CONTINUITY',
      });
      createdName = created.name;
      const [retrievedA, listedB] = await Promise.all([
        this.bank.retrieveMemories(users.userAId, fact, 8),
        this.bank.listUserMemories(users.userBId),
      ]);
      const foundA = retrievedA.some((memory) => memory.name === created.name);
      const absentFromB = listedB.every((memory) => memory.name !== created.name);
      if (!foundA || !absentFromB) {
        throw new MemoryBankError(
          'invalid_argument',
          'Vertex Memory isolation diagnostic failed.',
          false,
        );
      }
      result = { created: true, retrievedForA: true, absentFromB: true, scopeBreakRejected: true };
    } catch (error) {
      diagnosticError = error;
    }
    if (createdName) {
      await this.bank.deleteMemory(createdName);
      const remaining = await this.bank.listUserMemories(users.userAId);
      if (remaining.some((memory) => memory.name === createdName)) {
        throw new MemoryBankError('unavailable', 'Diagnostic cleanup could not be verified.', true);
      }
    }
    if (diagnosticError) throw diagnosticError;
    return result!;
  }

  private sanitizeEdit(fact: string, category: string): EditableMemory {
    const sanitized = this.sanitizer.sanitize([
      { category, fact, confidence: 1, shouldPersist: true, sensitive: false },
    ])[0];
    if (!sanitized) {
      throw new BadRequestException('Le fait ne respecte pas les règles de mémoire prudente.');
    }
    return {
      category: sanitized.category,
      fact: sanitized.fact,
      contentHash: this.sanitizer.hash(
        `${sanitized.category}:${sanitized.fact.toLocaleLowerCase('fr-FR')}`,
      ),
    };
  }

  private async assertOwned(memoryId: string, userId: string) {
    const memory = await this.prisma.userMemory.findUnique({
      where: { id: memoryId },
      select: {
        id: true,
        userId: true,
        category: true,
        status: true,
        vertexMemoryName: true,
      },
    });
    if (!memory || memory.userId !== userId) {
      throw new NotFoundException('Mémoire introuvable pour ce client.');
    }
    return memory;
  }

  private async deleteRemoteReference(vertexMemoryName: string | null): Promise<void> {
    if (!vertexMemoryName) return;
    await this.ensureBankConfigured();
    await this.bank.deleteMemory(vertexMemoryName);
  }

  private async ensureBankConfigured(): Promise<void> {
    if (!(await this.bank.isConfigured())) {
      throw new MemoryBankError('not_configured', 'Vertex Memory is not configured.', false);
    }
  }

  private asMemoryError(error: unknown): MemoryBankError {
    return error instanceof MemoryBankError
      ? error
      : new MemoryBankError('non_retryable', 'Memory sync failed.', false);
  }

  private shouldAutoApprove(candidate: SanitizedMemoryCandidate): boolean {
    return (
      this.memoryConfig.isAutoApproveEnabled() &&
      candidate.confidence >= UserMemoryService.AUTO_APPROVE_CONFIDENCE
    );
  }
}
