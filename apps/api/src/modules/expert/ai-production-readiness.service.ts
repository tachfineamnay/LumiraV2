import { Injectable } from '@nestjs/common';
import { ExpertRole, FileType, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  activeProvidersInConfig,
  AGENT_REQUIRED_CAPABILITIES,
  normalizeAiModelConfig,
} from '../../services/factory/ai-model-config';
import { AgentType, AiProvider } from '../../services/factory/ai-execution.types';
import { resolveVertexLocation } from '../../services/factory/llm';
import { ConfigService } from '@nestjs/config';
import { AiProviderDiagnosticsService } from './ai-provider-diagnostics.service';
import { ProviderCredentialStatus } from './ai-provider-diagnostics.types';

export type ReadinessLevel = 'pass' | 'warning' | 'fail';

export interface ReadinessCheck {
  id: string;
  label: string;
  level: ReadinessLevel;
  detail: string;
}

const TRACKED_AGENTS: Array<{
  agent: AgentType;
  mission: 'READING_GENERATION' | 'TIMELINE_BATCH' | 'AUDIO_NARRATION';
}> = [
  { agent: 'SCRIBE', mission: 'READING_GENERATION' },
  { agent: 'GUIDE', mission: 'TIMELINE_BATCH' },
  { agent: 'NARRATOR', mission: 'AUDIO_NARRATION' },
];

@Injectable()
export class AiProductionReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnostics: AiProviderDiagnosticsService,
    private readonly configService: ConfigService,
  ) {}

  async getReadiness() {
    const [
      admin,
      activeAdminCount,
      activePrompts,
      activeRules,
      providerStatus,
      recentRuns,
      latestCompletedOrder,
    ] = await Promise.all([
      this.prisma.expert.findUnique({
        where: { email: 'expert@oraclelumira.com' },
        select: { email: true, role: true, isActive: true },
      }),
      this.prisma.expert.count({
        where: { role: ExpertRole.ADMIN, isActive: true },
      }),
      this.prisma.promptVersion.findMany({
        where: { isActive: true },
        orderBy: [{ key: 'asc' }, { version: 'desc' }],
        select: {
          id: true,
          key: true,
          version: true,
          value: true,
          changedBy: true,
          comment: true,
          createdAt: true,
        },
      }),
      this.prisma.aiRoutingRule.findMany({
        where: { isActive: true },
        orderBy: [{ productLevel: 'asc' }, { agent: 'asc' }, { mission: 'asc' }],
        select: {
          id: true,
          productLevel: true,
          agent: true,
          mission: true,
          provider: true,
          model: true,
          promptVersionId: true,
        },
      }),
      this.diagnostics.getCredentialsStatus(),
      this.prisma.aiRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          orderId: true,
          agent: true,
          mission: true,
          provider: true,
          model: true,
          routingSource: true,
          status: true,
          inputTokens: true,
          outputTokens: true,
          estimatedCost: true,
          durationMs: true,
          errorCode: true,
          startedAt: true,
        },
      }),
      this.prisma.order.findFirst({
        where: { status: OrderStatus.COMPLETED },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          updatedAt: true,
          files: {
            where: { type: FileType.AUDIO_READING },
            take: 1,
            select: { id: true, key: true, size: true },
          },
          deliveries: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, pdfKey: true, emailStatus: true },
          },
        },
      }),
    ]);

    const activeByKey = new Map<string, typeof activePrompts>();
    for (const prompt of activePrompts) {
      const entries = activeByKey.get(prompt.key) ?? [];
      entries.push(prompt);
      activeByKey.set(prompt.key, entries);
    }

    const modelRows = activeByKey.get('MODEL_CONFIG') ?? [];
    let parsedModelConfig: unknown;
    let modelConfigParseError: string | null = null;
    if (modelRows[0]) {
      try {
        parsedModelConfig = JSON.parse(modelRows[0].value);
      } catch (error) {
        modelConfigParseError = error instanceof Error ? error.message : String(error);
      }
    }
    const normalized = normalizeAiModelConfig(parsedModelConfig);
    const activeProviders = activeProvidersInConfig(normalized.config);
    const guide = (activeByKey.get('GUIDE') ?? [])[0];
    const duplicateKeys = [...activeByKey.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]) => ({ key, count: rows.length }));
    const canonicalAdminReady =
      admin?.role === ExpertRole.ADMIN && admin.isActive && activeAdminCount === 1;

    const completedOrderId = latestCompletedOrder?.id;
    const orderRuns = completedOrderId
      ? recentRuns.filter((run) => run.orderId === completedOrderId)
      : [];

    const executionCheck = (
      agent: 'SCRIBE' | 'GUIDE' | 'NARRATOR',
      mission: 'READING_GENERATION' | 'TIMELINE_BATCH' | 'AUDIO_NARRATION',
      expectedProvider: AiProvider,
      expectedModel: string,
    ): ReadinessCheck => {
      const relevant = orderRuns.filter((run) => run.agent === agent && run.mission === mission);
      const success = relevant.find((run) => {
        if (run.status !== 'SUCCESS') return false;
        if (run.provider !== expectedProvider) return false;
        if (run.model !== expectedModel) return false;
        if ((run.inputTokens ?? 0) <= 0 || (run.outputTokens ?? 0) <= 0) return false;
        // OpenAI cost is expected; Google providers may not have estimatedCost.
        if (expectedProvider === 'openai' && run.estimatedCost == null) return false;
        return true;
      });
      const error = relevant.find((run) => run.status === 'ERROR');
      const label = `${agent} → ${expectedProvider}/${expectedModel}`;

      if (success) {
        const costPart =
          success.estimatedCost != null
            ? ` · $${success.estimatedCost.toFixed(4)}`
            : expectedProvider === 'openai'
              ? ''
              : ' · coût N/A (Google)';
        return {
          id: `run_${agent.toLowerCase()}`,
          label: `${agent} exécuté en préproduction`,
          level: 'pass',
          detail: `${label} · ${(success.durationMs ?? 0) / 1000}s${costPart}.`,
        };
      }
      if (error) {
        return {
          id: `run_${agent.toLowerCase()}`,
          label: `${agent} exécuté en préproduction`,
          level: 'fail',
          detail: error.errorCode || `Le dernier appel ${agent} a échoué (${label}).`,
        };
      }
      return {
        id: `run_${agent.toLowerCase()}`,
        label: `${agent} exécuté en préproduction`,
        level: 'warning',
        detail: latestCompletedOrder
          ? `Aucun succès ${label} mesuré pour ${latestCompletedOrder.orderNumber}.`
          : 'Aucune commande de préproduction complète disponible.',
      };
    };

    const pipelineHasPdf = Boolean(latestCompletedOrder?.deliveries[0]?.pdfKey);
    const pipelineHasAudio = Boolean(
      latestCompletedOrder?.files[0]?.key && (latestCompletedOrder.files[0].size ?? 0) > 0,
    );
    const pipelineLevel: ReadinessLevel =
      latestCompletedOrder && pipelineHasPdf && pipelineHasAudio ? 'pass' : 'warning';

    const checks: ReadinessCheck[] = [
      {
        id: 'canonical_admin',
        label: 'Compte administrateur unique',
        level: canonicalAdminReady ? 'pass' : 'fail',
        detail: canonicalAdminReady
          ? 'expert@oraclelumira.com est le seul ADMIN actif.'
          : `Le compte canonique doit être ADMIN et actif, avec un seul ADMIN actif au total. Nombre actuel: ${activeAdminCount}.`,
      },
      ...this.providerCredentialChecks(activeProviders, providerStatus, normalized.config.agents),
      {
        id: 'model_config',
        label:
          normalized.config.providerMode === 'openai_only'
            ? 'Configuration openai_only'
            : 'Configuration per_agent',
        level: !modelConfigParseError && normalized.issues.length === 0 ? 'pass' : 'fail',
        detail: modelConfigParseError
          ? `MODEL_CONFIG illisible: ${modelConfigParseError}`
          : normalized.issues.length > 0
            ? normalized.issues.join(' | ')
            : `Mode ${normalized.config.providerMode} · providers actifs: ${[...activeProviders].join(', ') || 'aucun'}.`,
      },
      {
        id: 'routing_rules',
        label: 'Matrice héritée neutralisée',
        level: activeRules.length === 0 ? 'pass' : 'fail',
        detail:
          activeRules.length === 0
            ? 'Aucune règle héritée active.'
            : `${activeRules.length} règle(s) active(s) doivent être désactivées.`,
      },
      {
        id: 'prompt_uniqueness',
        label: 'Une version active par prompt',
        level: duplicateKeys.length === 0 ? 'pass' : 'fail',
        detail:
          duplicateKeys.length === 0
            ? 'Aucun doublon actif.'
            : duplicateKeys.map((entry) => `${entry.key}: ${entry.count}`).join(', '),
      },
      {
        id: 'guide_contract',
        label: 'GUIDE aligné sur 30 jours',
        level:
          guide &&
          /30\s*jours/i.test(guide.value) &&
          !/parcours spirituel de 7 jours/i.test(guide.value)
            ? 'pass'
            : 'fail',
        detail:
          guide &&
          /30\s*jours/i.test(guide.value) &&
          !/parcours spirituel de 7 jours/i.test(guide.value)
            ? `Prompt GUIDE v${guide.version} aligné.`
            : 'Le prompt GUIDE actif ne correspond pas au runtime 30 jours.',
      },
      ...TRACKED_AGENTS.filter(({ agent }) => normalized.config.agents[agent].enabled).map(
        ({ agent, mission }) => {
          const cfg = normalized.config.agents[agent];
          return executionCheck(
            agent as 'SCRIBE' | 'GUIDE' | 'NARRATOR',
            mission,
            cfg.provider,
            cfg.model,
          );
        },
      ),
      ...this.agentCapabilityChecks(normalized.config.agents, providerStatus),
      {
        id: 'pipeline_assets',
        label: 'Pipeline PDF et audio terminé',
        level: pipelineLevel,
        detail:
          pipelineLevel === 'pass'
            ? `${latestCompletedOrder?.orderNumber}: PDF privé et audio complet disponibles.`
            : latestCompletedOrder
              ? `${latestCompletedOrder.orderNumber}: PDF=${pipelineHasPdf ? 'OK' : 'absent'}, audio=${pipelineHasAudio ? 'OK' : 'absent'}.`
              : 'Finaliser une commande de préproduction avec PDF et audio.',
      },
    ];

    if (activeProviders.has('vertex')) {
      checks.push({
        id: 'vertex_location',
        label: 'Région Vertex unique',
        level: 'pass',
        detail: `VERTEX_LOCATION=${resolveVertexLocation(this.configService)} (catalogue, diagnostics et runtime).`,
      });
    }

    const failures = checks.filter((check) => check.level === 'fail').length;
    const warnings = checks.filter((check) => check.level === 'warning').length;
    const totalCost = recentRuns.reduce((sum, run) => sum + (run.estimatedCost ?? 0), 0);

    return {
      ready: failures === 0 && warnings === 0,
      verdict: failures > 0 ? 'NO_GO' : warnings > 0 ? 'CONDITIONAL_GO' : 'GO',
      generatedAt: new Date().toISOString(),
      summary: { failures, warnings, passes: checks.length - failures - warnings },
      checks,
      effectiveConfig: normalized.config,
      activeProviders: [...activeProviders],
      activePromptVersions: activePrompts.map((prompt) => ({
        id: prompt.id,
        key: prompt.key,
        version: prompt.version,
        changedBy: prompt.changedBy,
        comment: prompt.comment,
        createdAt: prompt.createdAt,
      })),
      activeRoutingRules: activeRules,
      latestCompletedOrder: latestCompletedOrder
        ? {
            id: latestCompletedOrder.id,
            orderNumber: latestCompletedOrder.orderNumber,
            updatedAt: latestCompletedOrder.updatedAt,
            hasPdf: pipelineHasPdf,
            hasAudio: pipelineHasAudio,
          }
        : null,
      recentRuns,
      recentRunSummary: {
        count: recentRuns.length,
        successes: recentRuns.filter((run) => run.status === 'SUCCESS').length,
        errors: recentRuns.filter((run) => run.status === 'ERROR').length,
        estimatedCost: Number(totalCost.toFixed(6)),
      },
    };
  }

  private providerNeeds(
    agents: ReturnType<typeof normalizeAiModelConfig>['config']['agents'],
    provider: AiProvider,
  ): { vision: boolean; structured: boolean } {
    let vision = false;
    let structured = false;
    for (const [agent, config] of Object.entries(agents) as Array<
      [AgentType, (typeof agents)[AgentType]]
    >) {
      if (!config.enabled || config.provider !== provider) continue;
      const caps = AGENT_REQUIRED_CAPABILITIES[agent];
      if (caps.includes('vision')) vision = true;
      if (caps.includes('structured')) structured = true;
    }
    return { vision, structured };
  }

  private providerCredentialChecks(
    activeProviders: Set<AiProvider>,
    status: {
      openai: ProviderCredentialStatus;
      gemini: ProviderCredentialStatus;
      vertex: ProviderCredentialStatus;
    },
    agents: ReturnType<typeof normalizeAiModelConfig>['config']['agents'],
  ): ReadinessCheck[] {
    const checks: ReadinessCheck[] = [];
    const entries: Array<{ id: AiProvider; label: string; status: ProviderCredentialStatus }> = [
      { id: 'openai', label: 'OpenAI', status: status.openai },
      { id: 'gemini', label: 'Gemini API', status: status.gemini },
      { id: 'vertex', label: 'Vertex AI', status: status.vertex },
    ];

    for (const entry of entries) {
      if (!activeProviders.has(entry.id)) continue;
      const needs = this.providerNeeds(agents, entry.id);

      checks.push({
        id: `${entry.id}_key`,
        label: `Credentials ${entry.label}`,
        level: entry.status.configured ? 'pass' : 'fail',
        detail: entry.status.configured
          ? `${entry.status.credentialSource || entry.status.envVar} configuré.`
          : `${entry.status.envVar} absent — provider actif dans MODEL_CONFIG.`,
      });

      checks.push({
        id: `${entry.id}_text`,
        label: `${entry.label} — texte`,
        level:
          entry.status.text === 'ok'
            ? 'pass'
            : entry.status.text === 'not_tested'
              ? 'warning'
              : 'fail',
        detail:
          entry.status.text === 'ok'
            ? `Test réussi avec ${entry.status.model}.`
            : entry.status.lastError || `Provider ${entry.label} configuré mais non testé.`,
      });

      if (needs.vision) {
        checks.push({
          id: `${entry.id}_vision`,
          label: `${entry.label} — vision`,
          level:
            entry.status.multimodal === 'ok'
              ? 'pass'
              : entry.status.multimodal === 'not_tested'
                ? 'warning'
                : 'fail',
          detail:
            entry.status.multimodal === 'ok'
              ? `Vision réussie avec ${entry.status.model}.`
              : entry.status.lastError || 'Test vision non exécuté.',
        });
      }

      if (needs.structured && (entry.id === 'gemini' || entry.id === 'vertex')) {
        checks.push({
          id: `${entry.id}_structured`,
          label: `${entry.label} — JSON structuré`,
          level:
            entry.status.structured === 'ok'
              ? 'pass'
              : entry.status.structured === 'not_tested'
                ? 'warning'
                : 'fail',
          detail:
            entry.status.structured === 'ok'
              ? `JSON structuré OK avec ${entry.status.model}.`
              : entry.status.lastError || 'Test JSON structuré non exécuté.',
        });
      }
    }

    return checks;
  }

  private agentCapabilityChecks(
    agents: ReturnType<typeof normalizeAiModelConfig>['config']['agents'],
    status: {
      openai: ProviderCredentialStatus;
      gemini: ProviderCredentialStatus;
      vertex: ProviderCredentialStatus;
    },
  ): ReadinessCheck[] {
    const checks: ReadinessCheck[] = [];
    for (const [agent, config] of Object.entries(agents) as Array<
      [AgentType, (typeof agents)[AgentType]]
    >) {
      if (!config.enabled) continue;
      const caps = AGENT_REQUIRED_CAPABILITIES[agent];
      const providerStatus =
        config.provider === 'openai'
          ? status.openai
          : config.provider === 'gemini'
            ? status.gemini
            : status.vertex;

      const parts: string[] = [`${agent} → ${config.provider} → ${config.model}`];
      let level: ReadinessLevel = 'pass';
      const escalate = (next: ReadinessLevel) => {
        if (next === 'fail' || level === 'fail') level = 'fail';
        else if (next === 'warning') level = 'warning';
      };

      if (!providerStatus.configured) {
        escalate('fail');
        parts.push('credentials absents');
      } else {
        if (caps.includes('text')) {
          if (providerStatus.text === 'ok') parts.push('texte OK');
          else if (providerStatus.text === 'not_tested') {
            escalate('warning');
            parts.push('texte non testé');
          } else {
            escalate('fail');
            parts.push('texte KO');
          }
        }
        if (caps.includes('vision')) {
          if (providerStatus.multimodal === 'ok') parts.push('vision OK');
          else if (providerStatus.multimodal === 'not_tested') {
            escalate('warning');
            parts.push('vision non testée');
          } else {
            escalate('fail');
            parts.push('vision KO');
          }
        }
        if (caps.includes('structured')) {
          const structured =
            config.provider === 'openai'
              ? providerStatus.text
              : (providerStatus.structured ?? 'not_tested');
          if (structured === 'ok') parts.push('JSON OK');
          else if (structured === 'not_tested') {
            escalate('warning');
            parts.push('JSON non testé');
          } else {
            escalate('fail');
            parts.push('JSON KO');
          }
        }
      }

      checks.push({
        id: `agent_${agent.toLowerCase()}`,
        label: `Agent ${agent}`,
        level,
        detail: parts.join(' · '),
      });
    }
    return checks;
  }
}
