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

  async build(userId: string, currentQuestion?: string): Promise<string> {
    if (!this.config.isReadEnabled()) return '';
    const local = await this.prisma.userMemory.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ updatedAt: 'desc' }, { confidence: 'desc' }],
      take: 8,
      select: { fact: true, vertexMemoryName: true },
    });
    if (local.length === 0) return '';
    let facts = local.map((item) => item.fact);
    try {
      const remote = await this.bank.retrieveMemories(
        userId,
        currentQuestion || 'continuité de la lecture actuelle',
        8,
      );
      const allowed = new Set(local.map((item) => item.vertexMemoryName).filter(Boolean));
      const ranked = remote.filter((item) => allowed.has(item.name)).map((item) => item.fact);
      facts = [...ranked, ...facts.filter((fact) => !ranked.includes(fact))];
    } catch (error) {
      this.logger.warn(
        `Memory context fallback: ${error instanceof Error ? error.name : 'unknown'}`,
      );
    }
    const budget = 4000;
    const text = facts
      .reduce<string[]>((acc, fact) => {
        const next = `- ${fact}`;
        return acc.join('\n').length + next.length <= budget ? [...acc, next] : acc;
      }, [])
      .join('\n');
    return text
      ? `=== MÉMOIRE DE CONTINUITÉ — SOURCE SECONDAIRE ===\nCette mémoire provient d'informations antérieures validées. Le dossier actuel reste prioritaire. N'en fais jamais un fait objectif, ne la répète pas mécaniquement et signale toute contradiction avec prudence.\n${text}`
      : '';
  }
}
