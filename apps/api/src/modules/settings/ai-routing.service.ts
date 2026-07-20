import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductLevel, AiMission } from '@prisma/client';
import { AiRuntimeCacheService } from '../../services/factory/ai-runtime-cache.service';

export type AiProvider = 'gemini' | 'openai';

export interface ResolvedRouting {
  provider: AiProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  promptVersionId?: string;
  /** true if this comes from a specific AiRoutingRule, false = global defaults */
  isCustomRule: boolean;
  /** Description for logging */
  source: string;
}

export interface UpsertRoutingRuleDto {
  productLevel: ProductLevel;
  agent: string;
  mission?: AiMission;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  promptVersionId?: string | null;
  note?: string | null;
  isActive?: boolean;
}

@Injectable()
export class AiRoutingService {
  private readonly logger = new Logger(AiRoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRuntimeCache: AiRuntimeCacheService,
  ) {}

  /**
   * Resolve the AI routing params for a given (productLevel, agent, mission) triple.
   * Fallback chain:
   *   1. Exact match: productLevel + agent + mission
   *   2. DEFAULT mission for: productLevel + agent + DEFAULT
   *   3. Returns null (caller falls back to global VertexOracle defaults)
   */
  async resolveRule(
    productLevel: ProductLevel,
    agent: string,
    mission: AiMission = AiMission.DEFAULT,
  ): Promise<ResolvedRouting | null> {
    try {
      // 1. Try exact match
      const exact = await this.prisma.aiRoutingRule.findUnique({
        where: {
          productLevel_agent_mission: {
            productLevel,
            agent,
            mission,
          },
        },
      });

      if (exact?.isActive) {
        this.logger.debug(
          `🎯 [AI Routing] Exact rule: ${productLevel}/${agent}/${mission} → ${exact.provider}/${exact.model}`,
        );
        return {
          provider: exact.provider as AiProvider,
          model: exact.model,
          temperature: exact.temperature,
          maxTokens: exact.maxTokens,
          promptVersionId: exact.promptVersionId ?? undefined,
          isCustomRule: true,
          source: `rule:${productLevel}/${agent}/${mission}`,
        };
      }

      // 2. Fallback to DEFAULT mission if not already querying DEFAULT
      if (mission !== AiMission.DEFAULT) {
        const defaultRule = await this.prisma.aiRoutingRule.findUnique({
          where: {
            productLevel_agent_mission: {
              productLevel,
              agent,
              mission: AiMission.DEFAULT,
            },
          },
        });

        if (defaultRule?.isActive) {
          this.logger.debug(
            `↩️ [AI Routing] DEFAULT fallback: ${productLevel}/${agent} → ${defaultRule.provider}/${defaultRule.model}`,
          );
          return {
            provider: defaultRule.provider as AiProvider,
            model: defaultRule.model,
            temperature: defaultRule.temperature,
            maxTokens: defaultRule.maxTokens,
            promptVersionId: defaultRule.promptVersionId ?? undefined,
            isCustomRule: true,
            source: `rule:${productLevel}/${agent}/DEFAULT`,
          };
        }
      }

      // 3. No rule found — caller uses global defaults
      this.logger.debug(
        `⬇️ [AI Routing] No rule for ${productLevel}/${agent}/${mission} — using global defaults`,
      );
      return null;
    } catch (err) {
      this.logger.warn(`[AI Routing] resolveRule error: ${err} — falling back to global defaults`);
      return null;
    }
  }

  /**
   * List all routing rules (for admin UI).
   */
  async listRules() {
    return this.prisma.aiRoutingRule.findMany({
      orderBy: [{ productLevel: 'asc' }, { agent: 'asc' }, { mission: 'asc' }],
      include: {
        promptVersion: {
          select: { id: true, key: true, version: true },
        },
      },
    });
  }

  /**
   * Create or update a routing rule (upsert on productLevel + agent + mission).
   */
  async upsertRule(dto: UpsertRoutingRuleDto) {
    const { productLevel, agent, mission = AiMission.DEFAULT, ...rest } = dto;

    const rule = await this.prisma.aiRoutingRule.upsert({
      where: {
        productLevel_agent_mission: {
          productLevel,
          agent,
          mission,
        },
      },
      create: {
        productLevel,
        agent,
        mission,
        provider: rest.provider,
        model: rest.model,
        temperature: rest.temperature,
        maxTokens: rest.maxTokens,
        promptVersionId: rest.promptVersionId ?? null,
        note: rest.note ?? null,
        isActive: rest.isActive ?? true,
      },
      update: {
        provider: rest.provider,
        model: rest.model,
        temperature: rest.temperature,
        maxTokens: rest.maxTokens,
        promptVersionId: rest.promptVersionId ?? null,
        note: rest.note ?? null,
        isActive: rest.isActive ?? true,
      },
    });

    this.logger.log(
      `✅ [AI Routing] Rule upserted: ${productLevel}/${agent}/${mission} → ${rest.provider}/${rest.model}`,
    );
    this.aiRuntimeCache.invalidateAll(`routing:${productLevel}/${agent}/${mission}`);
    return rule;
  }

  /**
   * Delete a routing rule by id.
   */
  async deleteRule(id: string) {
    await this.prisma.aiRoutingRule.delete({ where: { id } });
    this.logger.log(`🗑️ [AI Routing] Rule deleted: ${id}`);
    this.aiRuntimeCache.invalidateAll(`routing:delete:${id}`);
  }

  /**
   * Reset all rules for a productLevel+agent combo (back to global defaults).
   */
  async resetRules(productLevel: ProductLevel, agent: string) {
    const deleted = await this.prisma.aiRoutingRule.deleteMany({
      where: { productLevel, agent },
    });
    this.logger.log(`🔄 [AI Routing] Reset ${deleted.count} rules for ${productLevel}/${agent}`);
    this.aiRuntimeCache.invalidateAll(`routing:reset:${productLevel}/${agent}`);
    return deleted;
  }
}
