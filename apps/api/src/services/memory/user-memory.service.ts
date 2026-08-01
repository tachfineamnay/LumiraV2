import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
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

type ConflictResolution = 'SUPERSEDE' | 'KEEP_BOTH';

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
        ...(activeStatus ? { pendingOperation: 'UPSERT' as const } : {}),
        ...(activeStatus && !this.memoryConfig.isWriteEnabled()
          ? { lastSyncError: 'write_disabled' }
          : {}),
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
    const memory = await this.prisma.userMemory.findUnique({
      where: { id: memoryId },
      select: {
        id: true,
        userId: true,
        fact: true,
        category: true,
        status: true,
        vertexMemoryName: true,
        pendingOperation: true,
      },
    });
    if (!memory) return;

    if (!this.memoryConfig.isWriteEnabled()) return;

    if (memory.pendingOperation === 'DELETE' || memory.pendingOperation === 'SUPERSEDE') {
      await this.convergeDelete(memory);
      return;
    }
    if (!['ACTIVE', 'SYNC_FAILED'].includes(memory.status)) return;

    try {
      const remote = memory.vertexMemoryName
        ? await this.bank.updateMemory(memory.vertexMemoryName, memory.fact)
        : await this.bank.createMemory({
            memoryId: this.vertexMemoryId(memory.id),
            userId: memory.userId,
            fact: memory.fact,
            category: memory.category as MemoryCategory,
          });
      if (remote.scope.user_id !== memory.userId) {
        throw new MemoryBankError('invalid_argument', 'Memory Bank scope mismatch.', false);
      }
      if (remote.fact !== memory.fact) {
        throw new MemoryBankError('invalid_argument', 'Memory Bank fact mismatch.', false);
      }
      await this.prisma.userMemory.update({
        where: { id: memory.id },
        data: {
          status: 'ACTIVE',
          vertexMemoryName: remote.name,
          syncedAt: new Date(),
          lastSyncError: null,
          pendingOperation: null,
        },
      });
    } catch (error) {
      const normalized = this.asMemoryError(error);
      await this.markConvergenceFailure(memory, normalized.code);
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
      where: { userId, vertexMemoryName: { not: null } },
      select: { vertexMemoryName: true },
    });
    if (!this.memoryConfig.isWriteEnabled()) {
      if (local.length > 0) {
        throw new MemoryBankError(
          'not_configured',
          'Vertex Memory writing must be enabled before a referenced memory can be purged.',
          false,
        );
      }
      return { deleted: 0 };
    }
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
      if (memory.vertexMemoryName) await this.bank.deleteMemory(memory.vertexMemoryName, userId);
    }
    const deleted = await this.bank.deleteAllUserMemories(userId);
    return { deleted: Math.max(deleted, local.length) };
  }

  async markAllDeleted(userId: string): Promise<void> {
    await this.prisma.userMemory.updateMany({
      where: { userId },
      data: {
        status: 'DELETED',
        vertexMemoryName: null,
        syncedAt: null,
        pendingOperation: null,
        lastSyncError: null,
      },
    });
  }

  async listForExpert(userId: string) {
    const memories = await this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceType: true,
        sourceVersionId: true,
        category: true,
        fact: true,
        status: true,
        vertexMemoryName: true,
        confidence: true,
        approvedAt: true,
        syncedAt: true,
        lastSyncError: true,
        pendingOperation: true,
        conflictResolution: true,
        conflictResolvedAt: true,
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
    return memories.map(({ vertexMemoryName, ...memory }) => ({
      ...memory,
      vertexSynced: Boolean(
        vertexMemoryName &&
        memory.syncedAt &&
        !memory.pendingOperation &&
        memory.status === 'ACTIVE',
      ),
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

  async approve(
    memoryId: string,
    userId: string,
    expertId: string,
    input: {
      conflictResolution?: ConflictResolution;
      supersedeMemoryId?: string;
      confirmKeepBoth?: boolean;
    },
  ) {
    const memory = await this.assertOwned(memoryId, userId);
    const conflict = memory.lastSyncError === 'potential_conflict';
    let resolution: ConflictResolution | undefined;
    let supersededId: string | undefined;
    let supersededMemory:
      | { id: string; status: string; vertexMemoryName: string | null }
      | undefined;

    if (conflict) {
      resolution = input.conflictResolution;
      if (!resolution) {
        throw new BadRequestException(
          'Un conflit potentiel exige de choisir remplacer ou conserver les deux.',
        );
      }
      if (resolution === 'KEEP_BOTH' && input.confirmKeepBoth !== true) {
        throw new BadRequestException(
          'La conservation des deux faits doit être confirmée explicitement.',
        );
      }
      if (resolution === 'SUPERSEDE') {
        if (!input.supersedeMemoryId || input.supersedeMemoryId === memoryId) {
          throw new BadRequestException(
            'Choisissez une mémoire existante du même client à remplacer.',
          );
        }
        const superseded = await this.assertOwned(input.supersedeMemoryId, userId);
        if (superseded.status !== 'ACTIVE') {
          throw new BadRequestException('Seule une mémoire active peut être remplacée.');
        }
        supersededId = superseded.id;
        supersededMemory = superseded;
      }
    } else if (input.conflictResolution || input.supersedeMemoryId || input.confirmKeepBoth) {
      throw new BadRequestException(
        'Aucune résolution de conflit n’est attendue pour cette mémoire.',
      );
    }

    const writing = this.memoryConfig.isWriteEnabled();
    const approvalData = {
      status: writing ? 'SYNC_FAILED' : 'ACTIVE',
      approvedAt: new Date(),
      approvedByExpertId: expertId,
      pendingOperation: 'UPSERT',
      lastSyncError: writing ? 'upsert_pending' : 'write_disabled',
      ...(resolution
        ? {
            conflictResolution: resolution,
            conflictResolvedAt: new Date(),
            conflictResolvedByExpertId: expertId,
          }
        : {}),
    } satisfies Prisma.UserMemoryUpdateInput;
    const approved = supersededMemory
      ? await this.prisma.$transaction((tx) =>
          this.applySupersedeAndUpdate(
            tx,
            supersededMemory,
            memoryId,
            expertId,
            approvalData,
            { id: true, status: true, pendingOperation: true, syncedAt: true },
          ),
        )
      : await this.prisma.userMemory.update({
          where: { id: memoryId },
          data: approvalData,
          select: { id: true, status: true, pendingOperation: true, syncedAt: true },
        });
    if (writing && supersededId) {
      await this.convergeSupersedePair(supersededId, approved.id);
    } else if (writing) {
      await this.syncMemory(approved.id);
    }
    return this.publicMutationResult(approved.id);
  }

  async reject(memoryId: string, userId: string, expertId: string) {
    const memory = await this.assertOwned(memoryId, userId);
    await this.prepareTerminalMutation(memory, 'REJECTED', expertId, 'DELETE');
    await this.syncMemory(memory.id);
    return this.publicMutationResult(memory.id);
  }

  async delete(memoryId: string, userId: string) {
    const memory = await this.assertOwned(memoryId, userId);
    await this.prepareTerminalMutation(memory, 'DELETED', undefined, 'DELETE');
    await this.syncMemory(memory.id);
    return this.publicMutationResult(memory.id);
  }

  async edit(
    memoryId: string,
    userId: string,
    expertId: string,
    input: {
      fact: string;
      category?: string;
      conflictResolution?: ConflictResolution;
      supersedeMemoryId?: string;
      confirmKeepBoth?: boolean;
    },
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

    let supersededId: string | undefined;
    let supersededMemory:
      | { id: string; status: string; vertexMemoryName: string | null }
      | undefined;
    if (input.supersedeMemoryId || input.conflictResolution || input.confirmKeepBoth) {
      if (input.conflictResolution !== 'SUPERSEDE' || !input.supersedeMemoryId) {
        throw new BadRequestException('Un remplacement exige une résolution SUPERSEDE explicite.');
      }
      if (input.supersedeMemoryId === memoryId) {
        throw new BadRequestException('Une mémoire ne peut pas se remplacer elle-même.');
      }
      const superseded = await this.assertOwned(input.supersedeMemoryId, userId);
      if (superseded.status !== 'ACTIVE') {
        throw new BadRequestException('Seule une mémoire active peut être remplacée.');
      }
      supersededId = superseded.id;
      supersededMemory = superseded;
    }

    const mustConverge = Boolean(
      memory.vertexMemoryName || memory.status === 'ACTIVE' || supersededId,
    );
    const editData = {
      category: editable.category,
      fact: editable.fact,
      contentHash: editable.contentHash,
      sourceType: 'EXPERT_CORRECTION',
      approvedByExpertId: expertId,
      approvedAt: new Date(),
      status: mustConverge ? 'SYNC_FAILED' : memory.status,
      pendingOperation: mustConverge ? 'UPSERT' : null,
      lastSyncError: mustConverge
        ? this.memoryConfig.isWriteEnabled()
          ? 'upsert_pending'
          : 'write_disabled'
        : null,
      ...(input.conflictResolution
        ? {
            conflictResolution: input.conflictResolution,
            conflictResolvedAt: new Date(),
            conflictResolvedByExpertId: expertId,
          }
        : {}),
    } satisfies Prisma.UserMemoryUpdateInput;
    const updated = supersededMemory
      ? await this.prisma.$transaction((tx) =>
          this.applySupersedeAndUpdate(
            tx,
            supersededMemory,
            memoryId,
            expertId,
            editData,
            { id: true },
          ),
        )
      : await this.prisma.userMemory.update({
          where: { id: memoryId },
          data: editData,
          select: { id: true },
        });
    if (this.memoryConfig.isWriteEnabled() && supersededId) {
      await this.convergeSupersedePair(supersededId, updated.id);
    } else if (mustConverge && this.memoryConfig.isWriteEnabled()) {
      await this.syncMemory(updated.id);
    }
    return this.publicMutationResult(updated.id);
  }

  async resync(memoryId: string, userId: string) {
    const memory = await this.assertOwned(memoryId, userId);
    if (['DELETED', 'REJECTED', 'SUPERSEDED'].includes(memory.status) && !memory.pendingOperation) {
      throw new BadRequestException('Cette mémoire ne peut pas être resynchronisée.');
    }
    if (memory.status === 'PENDING' && !memory.pendingOperation) {
      throw new BadRequestException('Cette mémoire doit être approuvée avant synchronisation.');
    }
    if (!this.memoryConfig.isWriteEnabled()) {
      throw new BadRequestException(
        'L’écriture Vertex est désactivée : aucune resynchronisation distante n’a été lancée.',
      );
    }
    await this.syncMemory(memory.id);
    return this.publicMutationResult(memory.id);
  }

  /**
   * Shadow-mode approvals persist an intent without touching Vertex. Once the
   * operator enables writing, the worker drains this bounded oldest-first set.
   * Every remote operation remains idempotent through syncMemory.
   */
  async convergePendingMutations(limit: number): Promise<{ processed: number; failed: number }> {
    if (!this.memoryConfig.isWriteEnabled()) return { processed: 0, failed: 0 };
    const pending = await this.prisma.userMemory.findMany({
      where: { pendingOperation: { in: ['UPSERT', 'DELETE', 'SUPERSEDE'] } },
      orderBy: { updatedAt: 'asc' },
      take: limit,
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

  async runIsolationDiagnostic(label?: string) {
    const users = this.memoryConfig.diagnosticUsers();
    if (!users) {
      throw new BadRequestException(
        'Les deux comptes techniques de diagnostic Vertex doivent être configurés.',
      );
    }
    await this.ensureBankConfigured();
    const caseVariantA = users.userAId.toUpperCase();
    if (caseVariantA === users.userAId || caseVariantA === users.userBId) {
      throw new BadRequestException(
        'Le compte technique A doit permettre un test de variante de casse distinct.',
      );
    }
    const realAccounts = await this.prisma.user.count({
      where: { id: { in: [users.userAId, users.userBId, caseVariantA] } },
    });
    if (realAccounts > 0) {
      throw new ConflictException(
        'Les comptes techniques de diagnostic ne doivent correspondre à aucun client Lumira.',
      );
    }
    const [existingA, existingB, existingCaseVariant] = await Promise.all([
      this.bank.listUserMemories(users.userAId),
      this.bank.listUserMemories(users.userBId),
      this.bank.listUserMemories(caseVariantA),
    ]);
    if (existingA.length > 0 || existingB.length > 0 || existingCaseVariant.length > 0) {
      throw new ConflictException(
        'Les comptes techniques de diagnostic doivent être vides avant le test.',
      );
    }

    const fact = `Diagnostic technique Lumira ${label?.trim().slice(0, 40) || Date.now().toString(36)}`;
    let createdName: string | null = null;
    let result:
      | {
          created: true;
          retrievedForA: true;
          absentFromB: true;
          absentFromCaseVariant: true;
          scopeBreakRejected: true;
        }
      | undefined;
    let cleanupVerified = true;
    try {
      const created = await this.bank.createMemory({
        memoryId: this.diagnosticMemoryId(users.userAId, fact),
        userId: users.userAId,
        fact,
        category: 'READING_CONTINUITY',
      });
      createdName = created.name;
      const [retrievedA, listedB, listedCaseVariant] = await Promise.all([
        this.bank.retrieveMemories(users.userAId, fact, 8),
        this.bank.listUserMemories(users.userBId),
        this.bank.retrieveMemories(caseVariantA, fact, 8),
      ]);
      const foundA = retrievedA.some((memory) => memory.name === created.name);
      const absentFromB = listedB.every((memory) => memory.name !== created.name);
      const absentFromCaseVariant = listedCaseVariant.every(
        (memory) => memory.name !== created.name,
      );
      if (!foundA || !absentFromB || !absentFromCaseVariant) {
        throw new MemoryBankError(
          'invalid_argument',
          'Vertex Memory isolation diagnostic failed.',
          false,
        );
      }
      result = {
        created: true,
        retrievedForA: true,
        absentFromB: true,
        absentFromCaseVariant: true,
        scopeBreakRejected: true,
      };
    } finally {
      if (createdName) {
        await this.bank.deleteMemory(createdName, users.userAId);
        const remaining = await this.bank.listUserMemories(users.userAId);
        if (remaining.length > 0) {
          cleanupVerified = false;
        }
      }
    }
    if (!cleanupVerified) {
      throw new MemoryBankError('unavailable', 'Diagnostic cleanup could not be verified.', true);
    }
    return { ...result!, deleted: true, absentAfterDeletion: true };
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
        lastSyncError: true,
        pendingOperation: true,
      },
    });
    if (!memory || memory.userId !== userId) {
      throw new NotFoundException('Mémoire introuvable pour ce client.');
    }
    return memory;
  }

  private async prepareTerminalMutation(
    memory: {
      id: string;
      vertexMemoryName: string | null;
    },
    status: 'REJECTED' | 'DELETED' | 'SUPERSEDED',
    expertId: string | undefined,
    operation: 'DELETE' | 'SUPERSEDE',
  ): Promise<void> {
    // This is intentionally the first write. If Vertex succeeds and the final
    // local cleanup fails, the durable operation remains visible and resync can
    // safely repeat DELETE (NOT_FOUND is idempotent).
    await this.prisma.userMemory.update({
      where: { id: memory.id },
      data: this.terminalMutationData(status, expertId, operation),
    });
  }

  private terminalMutationData(
    status: 'REJECTED' | 'DELETED' | 'SUPERSEDED',
    expertId: string | undefined,
    operation: 'DELETE' | 'SUPERSEDE',
  ) {
    return {
      status,
      approvedAt: expertId ? new Date() : undefined,
      approvedByExpertId: expertId,
      pendingOperation: operation,
      lastSyncError: 'delete_pending',
    };
  }

  private async applySupersedeAndUpdate<T extends Prisma.UserMemorySelect>(
    tx: Prisma.TransactionClient,
    superseded: { id: string },
    memoryId: string,
    expertId: string,
    data: Prisma.UserMemoryUpdateInput,
    select: T,
  ) {
    await tx.userMemory.update({
      where: { id: superseded.id },
      data: this.terminalMutationData('SUPERSEDED', expertId, 'SUPERSEDE'),
    });
    return tx.userMemory.update({ where: { id: memoryId }, data, select });
  }

  private async convergeSupersedePair(
    supersededMemoryId: string,
    replacementMemoryId: string,
  ): Promise<void> {
    let firstError: unknown;
    try {
      await this.syncMemory(supersededMemoryId);
    } catch (error) {
      firstError = error;
    }
    try {
      await this.syncMemory(replacementMemoryId);
    } catch (error) {
      firstError ??= error;
    }
    if (firstError) throw firstError;
  }

  private async convergeDelete(memory: {
    id: string;
    userId: string;
    status: string;
    vertexMemoryName: string | null;
  }): Promise<void> {
    try {
      if (memory.vertexMemoryName) {
        await this.ensureBankConfigured();
        await this.bank.deleteMemory(memory.vertexMemoryName, memory.userId);
      }
      await this.prisma.userMemory.update({
        where: { id: memory.id },
        data: {
          vertexMemoryName: null,
          syncedAt: null,
          pendingOperation: null,
          lastSyncError: null,
        },
      });
    } catch (error) {
      const normalized = this.asMemoryError(error);
      await this.markConvergenceFailure(memory, normalized.code);
      this.logger.warn(`Memory delete convergence failed: code=${normalized.code}`);
      throw normalized;
    }
  }

  private async markConvergenceFailure(
    memory: { id: string; status: string; pendingOperation?: string | null },
    code: string,
  ): Promise<void> {
    try {
      await this.prisma.userMemory.update({
        where: { id: memory.id },
        data: {
          ...(memory.pendingOperation === 'DELETE' || memory.pendingOperation === 'SUPERSEDE'
            ? {}
            : { status: 'SYNC_FAILED' }),
          lastSyncError: code,
        },
      });
    } catch {
      // The operation was already persisted before the remote call. Do not mask
      // the original failure with a second best-effort persistence error.
    }
  }

  private async publicMutationResult(memoryId: string) {
    const memory = await this.prisma.userMemory.findUnique({
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
    if (!memory) throw new NotFoundException('Mémoire introuvable.');
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

  private vertexMemoryId(memoryId: string): string {
    return `lumira-${createHash('sha256').update(memoryId).digest('hex').slice(0, 40)}`;
  }

  private diagnosticMemoryId(userId: string, nonce: string): string {
    return `lumira-diag-${createHash('sha256').update(`${userId}:${nonce}`).digest('hex').slice(0, 32)}`;
  }

  private async ensureBankConfigured(): Promise<void> {
    if (!this.memoryConfig.isWriteEnabled()) {
      throw new MemoryBankError('not_configured', 'Vertex Memory writing is disabled.', false);
    }
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
