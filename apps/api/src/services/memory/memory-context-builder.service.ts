import { Injectable, Logger } from '@nestjs/common';
import { MemoryConfigService } from './memory-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VertexMemoryBankClient } from './vertex-memory-bank.client';

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
   */
  async build(userId: string, currentQuestion?: string): Promise<string> {
    if (!this.config.isReadEnabled()) return '';
    try {
      const local = await this.prisma.userMemory.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: [{ updatedAt: 'desc' }, { confidence: 'desc' }],
        take: 8,
        select: { id: true, fact: true, vertexMemoryName: true },
      });
      if (local.length === 0) return '';

      let facts = local.map((item) => item.fact);
      try {
        const remote = await this.bank.retrieveMemories(
          userId,
          currentQuestion || 'continuité de la lecture actuelle',
          8,
        );
        const orderedNames = remote.map((item) => item.name);
        if (orderedNames.length > 0) {
          const returned = await this.prisma.userMemory.findMany({
            where: {
              userId,
              status: 'ACTIVE',
              vertexMemoryName: { in: orderedNames },
            },
            select: { fact: true, vertexMemoryName: true },
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

  private withBudget(facts: string[], budget: number): string {
    return facts
      .slice(0, 8)
      .reduce<string[]>((acc, fact) => {
        const next = `- ${fact}`;
        return acc.join('\n').length + next.length <= budget ? [...acc, next] : acc;
      }, [])
      .join('\n');
  }

  private logFallback(error: unknown, source: 'local' | 'vertex'): void {
    // Technical class only: no fact, prompt, client id, order id or sealed text.
    this.logger.warn(
      `Memory context ${source} fallback: ${error instanceof Error ? error.name : 'unknown'}`,
    );
  }
}
