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
    const heavyAgents: AgentType[] = ['SCRIBE', 'GUIDE', 'EDITOR', 'NARRATOR'];
    const isHeavy = heavyAgents.includes(ctx.agent);

    let provider: 'gemini' | 'openai' = snapshot.agentProviders[ctx.agent] ?? 'gemini';
    let model = isHeavy ? snapshot.modelConfig.heavyModel : snapshot.modelConfig.flashModel;
    let temperature = isHeavy
      ? snapshot.modelConfig.heavyTemperature
      : snapshot.modelConfig.flashTemperature;
    let topP = isHeavy ? snapshot.modelConfig.heavyTopP : snapshot.modelConfig.flashTopP;
    let maxTokens = isHeavy
      ? snapshot.modelConfig.heavyMaxTokens
      : snapshot.modelConfig.flashMaxTokens;
    let routingSource = `global:${ctx.agent}`;
    let rulePromptVersionId: string | undefined;

    if (provider === 'openai') {
      model = isHeavy
        ? snapshot.modelConfig.openaiHeavyModel
        : snapshot.modelConfig.openaiFlashModel;
      temperature = isHeavy
        ? snapshot.modelConfig.openaiHeavyTemperature
        : snapshot.modelConfig.openaiFlashTemperature;
      topP = isHeavy ? snapshot.modelConfig.openaiHeavyTopP : snapshot.modelConfig.openaiFlashTopP;
      maxTokens = isHeavy
        ? snapshot.modelConfig.openaiHeavyMaxTokens
        : snapshot.modelConfig.openaiFlashMaxTokens;
    }

    if (ctx.productLevel) {
      const rule = await this.aiRouting.resolveRule(ctx.productLevel, ctx.agent, ctx.mission);
      if (rule) {
        provider = rule.provider;
        model = rule.model;
        temperature = rule.temperature;
        maxTokens = rule.maxTokens;
        rulePromptVersionId = rule.promptVersionId;
        routingSource = rule.source;
        topP =
          provider === 'openai'
            ? isHeavy
              ? snapshot.modelConfig.openaiHeavyTopP
              : snapshot.modelConfig.openaiFlashTopP
            : isHeavy
              ? snapshot.modelConfig.heavyTopP
              : snapshot.modelConfig.flashTopP;
        this.logger.log(
          `[${ctx.agent}] Routing ${routingSource} → ${provider}/${model} mission=${ctx.mission}`,
        );
      }
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
