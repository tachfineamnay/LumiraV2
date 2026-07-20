import { Injectable } from '@nestjs/common';
import { ExpertRole, FileType, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeAiModelConfig } from '../../services/factory/ai-model-config';
import { AiProviderDiagnosticsService } from './ai-provider-diagnostics.service';

export type ReadinessLevel = 'pass' | 'warning' | 'fail';

export interface ReadinessCheck {
  id: string;
  label: string;
  level: ReadinessLevel;
  detail: string;
}

@Injectable()
export class AiProductionReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnostics: AiProviderDiagnosticsService,
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
      expectedModel: string,
    ): ReadinessCheck => {
      const relevant = orderRuns.filter((run) => run.agent === agent && run.mission === mission);
      const success = relevant.find(
        (run) =>
          run.status === 'SUCCESS' &&
          run.provider === 'openai' &&
          run.model === expectedModel &&
          (run.inputTokens ?? 0) > 0 &&
          (run.outputTokens ?? 0) > 0 &&
          run.estimatedCost != null,
      );
      const error = relevant.find((run) => run.status === 'ERROR');

      if (success) {
        return {
          id: `run_${agent.toLowerCase()}`,
          label: `${agent} exécuté en préproduction`,
          level: 'pass',
          detail: `${expectedModel} · ${(success.durationMs ?? 0) / 1000}s · $${(success.estimatedCost ?? 0).toFixed(4)}.`,
        };
      }
      if (error) {
        return {
          id: `run_${agent.toLowerCase()}`,
          label: `${agent} exécuté en préproduction`,
          level: 'fail',
          detail: error.errorCode || `Le dernier appel ${agent} a échoué.`,
        };
      }
      return {
        id: `run_${agent.toLowerCase()}`,
        label: `${agent} exécuté en préproduction`,
        level: 'warning',
        detail: latestCompletedOrder
          ? `Aucun succès ${agent}/${expectedModel} mesuré pour ${latestCompletedOrder.orderNumber}.`
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
      {
        id: 'openai_key',
        label: 'Clé OpenAI',
        level: providerStatus.openai.configured ? 'pass' : 'fail',
        detail: providerStatus.openai.configured
          ? 'OPENAI_API_KEY est configurée.'
          : 'OPENAI_API_KEY est absente.',
      },
      {
        id: 'openai_text',
        label: 'Responses API texte structuré',
        level:
          providerStatus.openai.text === 'ok'
            ? 'pass'
            : providerStatus.openai.text === 'not_tested'
              ? 'warning'
              : 'fail',
        detail:
          providerStatus.openai.text === 'ok'
            ? `Test réussi avec ${providerStatus.openai.model}.`
            : providerStatus.openai.lastError || 'Test réel non exécuté depuis le dernier démarrage.',
      },
      {
        id: 'openai_vision',
        label: 'Responses API vision',
        level:
          providerStatus.openai.multimodal === 'ok'
            ? 'pass'
            : providerStatus.openai.multimodal === 'not_tested'
              ? 'warning'
              : 'fail',
        detail:
          providerStatus.openai.multimodal === 'ok'
            ? `Vision réussie avec ${providerStatus.openai.model}.`
            : providerStatus.openai.lastError || 'Test vision non exécuté depuis le dernier démarrage.',
      },
      {
        id: 'model_config',
        label: 'Configuration OpenAI-only',
        level: !modelConfigParseError && normalized.issues.length === 0 ? 'pass' : 'fail',
        detail: modelConfigParseError
          ? `MODEL_CONFIG illisible: ${modelConfigParseError}`
          : normalized.issues.length > 0
            ? normalized.issues.join(' | ')
            : 'Configuration par agent valide, OpenAI-only et verrouillée sur des snapshots.',
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
          guide && /30\s*jours/i.test(guide.value) && !/parcours spirituel de 7 jours/i.test(guide.value)
            ? 'pass'
            : 'fail',
        detail:
          guide && /30\s*jours/i.test(guide.value) && !/parcours spirituel de 7 jours/i.test(guide.value)
            ? `Prompt GUIDE v${guide.version} aligné.`
            : 'Le prompt GUIDE actif ne correspond pas au runtime 30 jours.',
      },
      executionCheck(
        'SCRIBE',
        'READING_GENERATION',
        normalized.config.agents.SCRIBE.model,
      ),
      executionCheck('GUIDE', 'TIMELINE_BATCH', normalized.config.agents.GUIDE.model),
      executionCheck(
        'NARRATOR',
        'AUDIO_NARRATION',
        normalized.config.agents.NARRATOR.model,
      ),
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
}
