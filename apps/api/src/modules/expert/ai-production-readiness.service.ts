import { Injectable } from '@nestjs/common';
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
    const [admin, activePrompts, activeRules, providerStatus, recentRuns] = await Promise.all([
      this.prisma.expert.findUnique({
        where: { email: 'expert@oraclelumira.com' },
        select: { email: true, role: true, isActive: true },
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
        take: 30,
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

    const checks: ReadinessCheck[] = [
      {
        id: 'canonical_admin',
        label: 'Compte administrateur unique',
        level:
          admin?.role === 'ADMIN' && admin.isActive
            ? 'pass'
            : 'fail',
        detail:
          admin?.role === 'ADMIN' && admin.isActive
            ? 'expert@oraclelumira.com est ADMIN et actif.'
            : 'expert@oraclelumira.com doit être ADMIN et actif.',
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
        level:
          !modelConfigParseError && normalized.issues.length === 0
            ? 'pass'
            : 'fail',
        detail: modelConfigParseError
          ? `MODEL_CONFIG illisible: ${modelConfigParseError}`
          : normalized.issues.length > 0
            ? normalized.issues.join(' | ')
            : 'Configuration par agent valide et OpenAI-only.',
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
      {
        id: 'telemetry',
        label: 'Télémétrie IA',
        level: recentRuns.length > 0 ? 'pass' : 'warning',
        detail:
          recentRuns.length > 0
            ? `${recentRuns.length} appel(s) récent(s) visibles.`
            : 'Aucun appel AiRun enregistré; effectuer une génération de préproduction.',
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
      activePromptVersions: activePrompts.map(({ value: _value, ...metadata }) => metadata),
      activeRoutingRules: activeRules,
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
