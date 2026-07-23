import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AiMission } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRoutingService } from '../../modules/settings/ai-routing.service';
import {
  AGENT_PROMPT_KEYS,
  AgentType,
  AiExecutionContext,
  AiPromptSnapshot,
  ResolvedAiExecution,
} from './ai-execution.types';
import { normalizeAiModelConfig, assertOperationalModel } from './ai-model-config';

@Injectable()
export class AiExecutionResolverService {
  private readonly logger = new Logger(AiExecutionResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    /** Kept for DI compatibility; Tranche A never reads AiRoutingRule. */
    private readonly aiRouting: AiRoutingService,
  ) {}

  async resolve(ctx: AiExecutionContext, snapshot: AiPromptSnapshot): Promise<ResolvedAiExecution> {
    const normalized = normalizeAiModelConfig(snapshot.modelConfig);
    if (normalized.issues.length > 0) {
      this.logger.warn(
        `Configuration IA normalisée avant exécution: ${normalized.issues.join(' | ')}`,
      );
    }

    const modelConfig = normalized.config;
    const config = modelConfig.agents[ctx.agent];
    if (!config.enabled) {
      throw new BadRequestException(`L'agent ${ctx.agent} est désactivé.`);
    }

    // Tranche A: openai_only | per_agent from MODEL_CONFIG only. Never call aiRouting.
    void this.aiRouting;

    const routingSource = `global:${ctx.agent}`;
    const promptVersionId = ctx.promptVersionId;
    const agentPrompt = await this.resolveAgentPrompt(ctx.agent, snapshot, promptVersionId);

    if (!agentPrompt?.trim()) {
      throw new BadRequestException(`Le prompt actif de l'agent ${ctx.agent} est vide.`);
    }
    if (ctx.agent !== 'ONIRIQUE' && !snapshot.lumiraDna?.trim()) {
      throw new BadRequestException('Le prompt actif LUMIRA_DNA est vide.');
    }

    const systemPrompt =
      ctx.agent === 'ONIRIQUE' ? agentPrompt : `${snapshot.lumiraDna}\n\n---\n\n${agentPrompt}`;
    const effectiveThinking = config.thinkingLevel ?? config.reasoningEffort;

    this.logger.log(
      `[${ctx.agent}] ${routingSource} → ${config.provider}/${config.model} mode=${modelConfig.providerMode} thinking=${effectiveThinking ?? 'non défini'}`,
    );

    assertOperationalModel(config.provider, config.model, ctx.agent);

    return {
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      topP: config.topP,
      thinkingLevel: config.thinkingLevel,
      // Compatibility bridge: VertexOracle already forwards reasoningEffort to every adapter.
      reasoningEffort: effectiveThinking,
      verbosity: config.verbosity,
      maxTokens: config.maxOutputTokens,
      systemPrompt,
      promptVersionId,
      routingSource,
    };
  }

  private async resolveAgentPrompt(
    agent: AgentType,
    snapshot: AiPromptSnapshot,
    promptVersionId?: string,
  ): Promise<string> {
    if (!promptVersionId) {
      return snapshot.agentContexts[agent];
    }

    const version = await this.prisma.promptVersion.findUnique({
      where: { id: promptVersionId },
    });

    if (!version) {
      throw new BadRequestException(
        `Configuration IA invalide : PromptVersion ${promptVersionId} introuvable pour l'agent ${agent}.`,
      );
    }

    const expectedKey = AGENT_PROMPT_KEYS[agent];
    if (version.key !== expectedKey) {
      throw new BadRequestException(
        `Configuration IA invalide : PromptVersion ${promptVersionId} (clé ${version.key}) ne correspond pas à l'agent ${agent} (attendu ${expectedKey}).`,
      );
    }

    if (!version.value?.trim()) {
      throw new BadRequestException(
        `Configuration IA invalide : PromptVersion ${promptVersionId} est vide pour l'agent ${agent}.`,
      );
    }

    this.logger.log(`[${agent}] PromptVersion v${version.version} (${version.id}) appliquée`);
    return version.value;
  }
}

export function buildAiContext(
  agent: AgentType,
  mission: AiMission,
  partial?: Partial<AiExecutionContext>,
): AiExecutionContext {
  return {
    agent,
    mission,
    ...partial,
  };
}
