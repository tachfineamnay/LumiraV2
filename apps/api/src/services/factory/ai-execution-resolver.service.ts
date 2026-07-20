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

@Injectable()
export class AiExecutionResolverService {
  private readonly logger = new Logger(AiExecutionResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouting: AiRoutingService,
  ) {}

  async resolve(ctx: AiExecutionContext, snapshot: AiPromptSnapshot): Promise<ResolvedAiExecution> {
    const config = snapshot.modelConfig.agents[ctx.agent];
    if (!config.enabled) {
      throw new BadRequestException(`L'agent ${ctx.agent} est désactivé en V1.`);
    }

    let provider = config.provider;
    let model = config.model;
    let temperature = config.temperature;
    let topP = config.topP;
    let reasoningEffort = config.reasoningEffort;
    let verbosity = config.verbosity;
    let maxTokens = config.maxOutputTokens;
    let routingSource = `global:${ctx.agent}`;
    let rulePromptVersionId: string | undefined;

    if (ctx.productLevel) {
      const rule = await this.aiRouting.resolveRule(ctx.productLevel, ctx.agent, ctx.mission);
      if (
        rule &&
        !(snapshot.modelConfig.providerMode === 'openai_only' && rule.provider === 'gemini')
      ) {
        provider = rule.provider;
        model = rule.model;
        temperature = rule.temperature;
        maxTokens = rule.maxTokens;
        reasoningEffort = undefined;
        verbosity = undefined;
        rulePromptVersionId = rule.promptVersionId;
        routingSource = rule.source;
        topP = provider === 'openai' ? config.topP : undefined;
        this.logger.log(
          `[${ctx.agent}] Routing ${routingSource} → ${provider}/${model} mission=${ctx.mission}`,
        );
      }
    }

    if (snapshot.modelConfig.providerMode === 'openai_only') {
      provider = 'openai';
    }

    const promptVersionId = ctx.promptVersionId ?? rulePromptVersionId;
    const agentPrompt = await this.resolveAgentPrompt(ctx.agent, snapshot, promptVersionId);

    const systemPrompt =
      ctx.agent === 'ONIRIQUE' ? agentPrompt : `${snapshot.lumiraDna}\n\n---\n\n${agentPrompt}`;

    return {
      provider,
      model,
      temperature,
      topP,
      reasoningEffort,
      verbosity,
      maxTokens,
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
