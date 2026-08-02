import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MemoryConfigService } from './memory-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VertexMemoryBankClient } from './vertex-memory-bank.client';

export interface MemoryContextOptions {
  currentOrderId?: string;
  excludedReadingVersionIds?: string[];
}

@Injectable()
export class MemoryContextBuilder {
  private readonly logger = new Logger(MemoryContextBuilder.name);

  constructor(
    private readonly config: MemoryConfigService,
    private readonly prisma: PrismaService,
    private readonly bank: VertexMemoryBankClient,
  ) {}

  /**
   * SCRIBE enrichment is intentionally fail-open: neither PostgreSQL nor
   * Vertex can cancel, retry, or alter a reading when continuity is absent.
   *
   * A correction is different from a new independent order: memories produced
   * by the reading currently being revised are excluded so V1 cannot validate
   * or amplify itself while V2 is being generated. Memories from other orders
   * remain available.
   */
  async build(
    userId: string,
    _currentQuestion?: string,
    options: MemoryContextOptions = {},
  ): Promise<string> {
    // Keep the caller contract while intentionally discarding free-form client text.
    void _currentQuestion;
    if (!this.config.isReadEnabled()) return '';
    try {
      const excludedReadingVersionIds = await this.resolveExcludedVersions(userId, options);
      const baseWhere: Prisma.UserMemoryWhereInput = {
        userId,
        status: 'ACTIVE',
        pendingOperation: null,
        vertexMemoryName: { not: null },
        syncedAt: { not: null },
        lastSyncError: null,
        ...(excludedReadingVersionIds.length > 0
          ? {
              OR: [
                { sourceVersionId: null },
                { sourceVersionId: { notIn: excludedReadingVersionIds } },
              ],
            }
          : {}),
      };

      const local = await this.prisma.userMemory.findMany({
        where: baseWhere,
        orderBy: [{ updatedAt: 'desc' }, { confidence: 'desc' }],
        take: 8,
        select: { id: true, fact: true, vertexMemoryName: true, sourceVersionId: true },
      });
      if (local.length === 0) return '';

      let facts = local.map((item) => item.fact);
      try {
        const remote = await this.bank.retrieveMemories(userId, this.safeSearchQuery(), 8);
        const orderedNames = remote.map((item) => item.name);
        if (orderedNames.length > 0) {
          const returned = await this.prisma.userMemory.findMany({
            where: {
              ...baseWhere,
              vertexMemoryName: { in: orderedNames },
            },
            select: { fact: true, vertexMemoryName: true, sourceVersionId: true },
          });
          const byName = new Map(
            returned
              .filter((item): item is typeof item & { vertexMemoryName: string } =>
                Boolean(item.vertexMemoryName),
              )
              .map((item) => [item.vertexMemoryName, item.fact]),
          );
          const ranked = orderedNames
            .map((name) => byName.get(name))
            .filter((fact): fact is string => Boolean(fact));
          facts = [...ranked, ...facts.filter((fact) => !ranked.includes(fact))].slice(0, 8);
        }
      } catch (error) {
        this.logFallback(error, 'vertex');
      }

      const text = this.withBudget(facts, 5_000);
      return text
        ? [
            '=== MÉMOIRE DE CONTINUITÉ — SOURCE SECONDAIRE ===',
            'Ces éléments sont des repères antérieurs validés. Le dossier présent est prioritaire : ne les transforme jamais en faits objectifs, ne les répète pas mécaniquement et signale avec prudence toute contradiction.',
            text,
          ].join('\n')
        : '';
    } catch (error) {
      this.logFallback(error, 'local');
      return '';
    }
  }

  private async resolveExcludedVersions(
    userId: string,
    options: MemoryContextOptions,
  ): Promise<string[]> {
    const explicit = new Set(options.excludedReadingVersionIds ?? []);
    let currentOrderId = options.currentOrderId;

    if (!currentOrderId) {
      const currentOrder = await this.prisma.order.findFirst({
        where: {
          userId,
          status: { in: ['PROCESSING', 'AWAITING_VALIDATION'] },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, status: true, generatedContent: true, clientInputs: true },
      });
      if (currentOrder && this.isRevisionGeneration(currentOrder)) {
        currentOrderId = currentOrder.id;
      }
    }

    if (currentOrderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: currentOrderId, userId },
        select: { id: true },
      });
      if (!order) {
        throw new Error('MEMORY_REVISION_SCOPE_INVALID');
      }
      const versions = await this.prisma.readingVersion.findMany({
        where: { orderId: currentOrderId },
        select: { id: true },
      });
      for (const version of versions) explicit.add(version.id);
    }

    return [...explicit];
  }

  private isRevisionGeneration(order: {
    status: string;
    generatedContent: Prisma.JsonValue | null;
    clientInputs: Prisma.JsonValue | null;
  }): boolean {
    const generated = this.asRecord(order.generatedContent);
    const clientInputs = this.asRecord(order.clientInputs);
    const effective = this.asRecord(clientInputs.readingIntakeEffective);
    const hasReopenLineage =
      this.nonEmptyString(generated.reopenedFromVersionId) ||
      this.nonEmptyString(generated.workingReadingVersionId);
    const hasEffectiveSnapshot =
      this.nonEmptyString(effective.snapshotId) && this.nonEmptyString(effective.contentHash);
    return Boolean(hasEffectiveSnapshot && (hasReopenLineage || order.status === 'PROCESSING'));
  }

  private withBudget(facts: string[], budget: number): string {
    return facts
      .slice(0, 8)
      .reduce<string[]>((acc, fact) => {
        const next = `- ${fact}`;
        return acc.join('\n').length + next.length <= budget ? [...acc, next] : acc;
      }, [])
      .join('\n');
  }

  private safeSearchQuery(): string {
    // The customer question can contain sensitive free text. Vertex only ever
    // receives this fixed, non-personal continuity query for similarity ranking.
    return 'continuité de la lecture actuelle';
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private nonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private logFallback(error: unknown, source: 'local' | 'vertex'): void {
    // Technical class only: no fact, prompt, client id, order id or sealed text.
    this.logger.warn(
      `Memory context ${source} fallback: ${error instanceof Error ? error.name : 'unknown'}`,
    );
  }
}
