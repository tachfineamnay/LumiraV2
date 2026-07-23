'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  History,
  Key,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  TestTube,
  X,
} from 'lucide-react';
import expertApi from '@/lib/expertApi';
import { cn } from '@/lib/utils';

type AgentKey = 'SCRIBE' | 'EDITOR' | 'GUIDE' | 'NARRATOR' | 'CONFIDANT' | 'ONIRIQUE';
type TabId = 'readiness' | 'credentials' | 'personality' | 'agents' | 'models';
type ProbeStatus = 'ok' | 'error' | 'not_tested';
type ProviderId = 'openai' | 'vertex' | 'gemini';
type Capability = 'text' | 'vision' | 'structured' | 'long_text' | 'fast_text';

type AgentVisualStatus = 'disabled' | 'functional' | 'failed' | 'detected' | 'missing';

interface PromptWithMeta {
  key: string;
  value: string;
  version: number;
  isCustom: boolean;
  changedBy?: string;
  updatedAt?: string;
  hasRestorableCustom?: boolean;
}

interface ModelConfigMeta {
  isCustom: boolean;
  version: number;
  changedBy?: string;
  hasRestorableCustom: boolean;
}

interface PromptHistory {
  id: string;
  version: number;
  value: string;
  changedBy?: string;
  comment?: string;
  isActive: boolean;
  createdAt: string;
}

interface AgentModelConfig {
  enabled: boolean;
  provider: ProviderId;
  model: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  temperature?: number;
  topP?: number;
  maxOutputTokens: number;
}

interface ModelConfig {
  providerMode: 'per_agent';
  agents: Record<AgentKey, AgentModelConfig>;
}

interface CatalogModel {
  id: string;
  displayName?: string;
  detected?: boolean;
  callable?: boolean | null;
  testedAt?: string;
  error?: string;
}

interface ProviderCatalog {
  configured: boolean;
  models: CatalogModel[];
  error?: string;
  source: 'live' | 'supported' | 'unavailable' | 'error';
  location?: string;
  detectedCount?: number;
}

interface AvailableModelsResponse {
  fetchedAt: string;
  openai: ProviderCatalog;
  gemini: ProviderCatalog;
  vertex: ProviderCatalog;
}

interface ModelProbeSnapshot {
  provider: ProviderId;
  model: string;
  configured: boolean;
  text: ProbeStatus;
  multimodal: ProbeStatus;
  structured: ProbeStatus;
  lastError?: string;
  lastTestedAt?: string;
  location?: string;
}

interface ProviderStatus {
  envVar: string;
  configured: boolean;
  state: string;
  model: string;
  lastTestedAt?: string;
  lastError?: string;
  text: ProbeStatus;
  multimodal?: ProbeStatus;
  structured?: ProbeStatus;
  credentialSource?: string;
  location?: string;
  activeModels?: string[];
}

interface CredentialsStatus {
  openai: ProviderStatus;
  gemini: ProviderStatus;
  vertex: ProviderStatus;
  modelProbes?: ModelProbeSnapshot[];
}

interface ReadinessCheck {
  id: string;
  label: string;
  level: 'pass' | 'warning' | 'fail';
  detail: string;
}

interface AiRunRow {
  id: string;
  agent: string;
  mission: string;
  provider?: string;
  model: string;
  routingSource?: string | null;
  status: 'SUCCESS' | 'ERROR';
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCost?: number | null;
  durationMs?: number | null;
  errorCode?: string | null;
  startedAt: string;
}

interface ReadinessResponse {
  ready: boolean;
  verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  generatedAt: string;
  summary: { failures: number; warnings: number; passes: number };
  checks: ReadinessCheck[];
  effectiveConfig: ModelConfig;
  activePromptVersions: Array<{
    id: string;
    key: string;
    version: number;
    changedBy?: string | null;
    comment?: string | null;
    createdAt: string;
  }>;
  activeRoutingRules: Array<{
    id: string;
    productLevel: string;
    agent: string;
    mission: string;
    provider: string;
    model: string;
  }>;
  recentRuns: AiRunRow[];
  recentRunSummary: {
    count: number;
    successes: number;
    errors: number;
    estimatedCost: number;
  };
}

interface ConnectionTestResult {
  success: boolean;
  provider: ProviderId;
  model: string;
  testedAt: string;
  text: ProbeStatus;
  multimodal?: ProbeStatus;
  structured?: ProbeStatus;
  error?: string;
  models?: Array<{
    model: string;
    success: boolean;
    text: ProbeStatus;
    multimodal?: ProbeStatus;
    structured?: ProbeStatus;
    error?: string;
  }>;
}

const AGENTS: Array<{ key: AgentKey; label: string; description: string }> = [
  { key: 'SCRIBE', label: 'SCRIBE', description: 'Lecture principale multimodale et synthèse' },
  { key: 'EDITOR', label: 'EDITOR', description: 'Corrections guidées par l’expert' },
  { key: 'GUIDE', label: 'GUIDE', description: 'Parcours de 30 jours en lots de 10 jours' },
  { key: 'NARRATOR', label: 'NARRATOR', description: 'Adaptation de la lecture pour l’audio' },
  { key: 'CONFIDANT', label: 'CONFIDANT', description: 'Compagnon optionnel' },
  { key: 'ONIRIQUE', label: 'ONIRIQUE', description: 'Interprétation des rêves' },
];

const AGENT_REQUIRED_CAPS: Record<AgentKey, Capability[]> = {
  SCRIBE: ['text', 'vision', 'structured'],
  GUIDE: ['text', 'structured'],
  EDITOR: ['text'],
  NARRATOR: ['text', 'long_text'],
  CONFIDANT: ['text', 'fast_text'],
  ONIRIQUE: ['text', 'structured'],
};

const PROVIDER_OPTIONS: Array<{ id: ProviderId; label: string }> = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'vertex', label: 'Vertex AI — Google Cloud' },
  { id: 'gemini', label: 'Gemini API — AI Studio' },
];

function messageFromError(error: unknown): string {
  const value = error as {
    response?: { status?: number; data?: { message?: string | string[]; error?: string } };
    message?: string;
  };
  if (value.response?.status === 403) return 'Accès refusé : le compte connecté doit être ADMIN.';
  const message = value.response?.data?.message;
  if (Array.isArray(message)) return message.join(' · ');
  return message || value.response?.data?.error || value.message || 'Erreur inconnue';
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-desk-border bg-desk-surface shadow-sm', className)}>
      {children}
    </section>
  );
}

function Pill({ level, children }: { level: 'pass' | 'warning' | 'fail'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        level === 'pass' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
        level === 'warning' && 'border-amber-500/30 bg-amber-500/10 text-amber-700',
        level === 'fail' && 'border-red-500/30 bg-red-500/10 text-red-600',
      )}
    >
      {level === 'pass' ? (
        <Check className="h-3.5 w-3.5" />
      ) : level === 'fail' ? (
        <X className="h-3.5 w-3.5" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5" />
      )}
      {children}
    </span>
  );
}

function PromptPanel({
  promptKey,
  prompt,
  defaultValue,
  saving,
  onSave,
  onReset,
  onRestoreLatestCustom,
  onDirtyChange,
}: {
  promptKey: string;
  prompt: PromptWithMeta;
  defaultValue: string;
  saving: boolean;
  onSave: (key: string, value: string, comment?: string) => Promise<void>;
  onReset: (key: string) => Promise<void>;
  onRestoreLatestCustom: (key: string) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [value, setValue] = useState(prompt.value);
  const [comment, setComment] = useState('');
  const [history, setHistory] = useState<PromptHistory[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    setValue(prompt.value);
    setComment('');
  }, [prompt.value, prompt.version]);

  const dirty = value !== prompt.value;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const toggleHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const { data } = await expertApi.get(`/expert/settings/prompts/${promptKey}/history`);
      setHistory(data);
      setHistoryOpen(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  const restore = async (version: number) => {
    await expertApi.post(`/expert/settings/prompts/${promptKey}/restore/${version}`);
    window.location.reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill level={prompt.isCustom ? 'pass' : 'warning'}>
            {prompt.isCustom
              ? `Personnalisé v${prompt.version}`
              : prompt.version > 0
                ? `Baseline système v${prompt.version}`
                : 'Défaut code'}
          </Pill>
          {value !== defaultValue && <span className="text-xs text-desk-muted">Différent du défaut</span>}
        </div>
        <button
          type="button"
          onClick={toggleHistory}
          disabled={historyLoading}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-desk-muted hover:bg-desk-hover"
        >
          {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
          Historique
        </button>
      </div>

      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={14}
        className="w-full resize-y rounded-xl border border-desk-border bg-desk-input p-4 font-mono text-sm leading-6 text-desk-text outline-none focus:border-amber-500/60"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-desk-muted">
        <span>{value.length.toLocaleString('fr-FR')} caractères</span>
        {dirty && <span className="text-amber-700">Modification non enregistrée</span>}
      </div>

      {dirty && (
        <input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Note de version"
          className="w-full rounded-xl border border-desk-border bg-desk-input px-3 py-2.5 text-sm text-desk-text outline-none"
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSave(promptKey, value, comment)}
          disabled={!dirty || saving || !value.trim()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer une version
        </button>
        {prompt.isCustom && (
          <button
            type="button"
            onClick={() => onReset(promptKey)}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-desk-border px-4 py-2 text-sm text-desk-text"
          >
            <RotateCcw className="h-4 w-4" />
            Revenir au défaut
          </button>
        )}
        {prompt.hasRestorableCustom && (
          <button
            type="button"
            onClick={() => void onRestoreLatestCustom(promptKey)}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-700"
          >
            <History className="h-4 w-4" />
            Réactiver dernière perso
          </button>
        )}
      </div>

      {historyOpen && (
        <div className="space-y-2 rounded-xl border border-desk-border bg-desk-bg p-3">
          {history.length === 0 ? (
            <p className="text-sm text-desk-muted">Aucune version enregistrée.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-desk-card p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-desk-text">v{item.version}</span>
                    {item.isActive && <Pill level="pass">Active</Pill>}
                  </div>
                  <p className="truncate text-xs text-desk-muted">
                    {item.comment || 'Sans note'} · {new Date(item.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                {!item.isActive && (
                  <button
                    type="button"
                    onClick={() => restore(item.version)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-amber-700"
                  >
                    Restaurer
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('readiness');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<ProviderId | null>(null);
  const [dirtyPrompt, setDirtyPrompt] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<AgentKey | null>('SCRIBE');
  const [prompts, setPrompts] = useState<Record<string, PromptWithMeta> | null>(null);
  const [defaults, setDefaults] = useState<Record<string, string> | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [savedModelConfig, setSavedModelConfig] = useState<ModelConfig | null>(null);
  const [modelConfigMeta, setModelConfigMeta] = useState<ModelConfigMeta | null>(null);
  const [credentials, setCredentials] = useState<CredentialsStatus | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModelsResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const clearFeedback = () => {
    setActionError(null);
    setSuccess(null);
  };

  const loadCatalog = useCallback(async (force = false) => {
    setCatalogLoading(true);
    try {
      const { data } = force
        ? await expertApi.post('/expert/settings/available-models/refresh')
        : await expertApi.get('/expert/settings/available-models');
      setAvailableModels(data);
    } catch (error) {
      setActionError(messageFromError(error));
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [promptResponse, defaultResponse, modelResponse, statusResponse, readinessResponse] =
        await Promise.all([
          expertApi.get('/expert/settings/prompts'),
          expertApi.get('/expert/settings/prompts/defaults'),
          expertApi.get('/expert/settings/model-config'),
          expertApi.get('/expert/settings/status'),
          expertApi.get('/expert/settings/readiness'),
        ]);
      setPrompts(promptResponse.data);
      setDefaults(defaultResponse.data);
      const loadedConfig = {
        ...(modelResponse.data.config as ModelConfig),
        providerMode: 'per_agent' as const,
      };
      setModelConfig(loadedConfig);
      setSavedModelConfig(loadedConfig);
      setModelConfigMeta(modelResponse.data.meta);
      setCredentials(statusResponse.data);
      setReadiness(readinessResponse.data);
      void loadCatalog(false);
    } catch (error) {
      setLoadError(messageFromError(error));
    } finally {
      setLoading(false);
    }
  }, [loadCatalog]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const modelDirty =
    modelConfig && savedModelConfig
      ? JSON.stringify(modelConfig) !== JSON.stringify(savedModelConfig)
      : false;

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyPrompt && !modelDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirtyPrompt, modelDirty]);

  const providerCatalog = useCallback(
    (provider: ProviderId): ProviderCatalog | undefined =>
      provider === 'openai'
        ? availableModels?.openai
        : provider === 'vertex'
          ? availableModels?.vertex
          : availableModels?.gemini,
    [availableModels],
  );

  const findProbe = useCallback(
    (provider: ProviderId, model: string): ModelProbeSnapshot | undefined =>
      credentials?.modelProbes?.find(
        (probe) => probe.provider === provider && probe.model === model,
      ),
    [credentials],
  );

  const blockingCapabilities = (agent: AgentKey): Capability[] =>
    AGENT_REQUIRED_CAPS[agent].filter((cap) =>
      cap === 'text' || cap === 'vision' || cap === 'structured',
    );

  const probePasses = useCallback(
    (agent: AgentKey, probe?: ModelProbeSnapshot): boolean => {
      if (!probe) return false;
      return blockingCapabilities(agent).every((cap) => {
        if (cap === 'text') return probe.text === 'ok';
        if (cap === 'vision') return probe.multimodal === 'ok';
        return probe.structured === 'ok';
      });
    },
    [],
  );

  const probeFails = useCallback(
    (agent: AgentKey, probe?: ModelProbeSnapshot): boolean => {
      if (!probe) return false;
      return blockingCapabilities(agent).some((cap) => {
        if (cap === 'text') return probe.text === 'error';
        if (cap === 'vision') return probe.multimodal === 'error';
        return probe.structured === 'error';
      });
    },
    [],
  );

  const modelsForProvider = useCallback(
    (provider: ProviderId, agent: AgentKey): CatalogModel[] => {
      const catalog = providerCatalog(provider);
      const models = [...(catalog?.models ?? [])].sort((a, b) =>
        (a.displayName || a.id).localeCompare(b.displayName || b.id),
      );
      const current = modelConfig?.agents[agent];
      if (current?.provider === provider && current.model && !models.some((model) => model.id === current.model)) {
        models.unshift({ id: current.model, displayName: current.model, detected: false, callable: null });
      }
      return models;
    },
    [modelConfig, providerCatalog],
  );

  const agentVisualStatus = useCallback(
    (agent: AgentKey, item: AgentModelConfig): AgentVisualStatus => {
      if (!item.enabled) return 'disabled';
      if (!item.model) return 'missing';
      const probe = findProbe(item.provider, item.model);
      if (probeFails(agent, probe)) return 'failed';
      if (probePasses(agent, probe)) return 'functional';
      return providerCatalog(item.provider)?.models.some((model) => model.id === item.model)
        ? 'detected'
        : 'missing';
    },
    [findProbe, probeFails, probePasses, providerCatalog],
  );

  const providerUsed = useCallback(
    (provider: ProviderId): boolean =>
      Boolean(
        modelConfig &&
          Object.values(modelConfig.agents).some(
            (agent) => agent.enabled && agent.provider === provider,
          ),
      ),
    [modelConfig],
  );

  const savePrompt = async (key: string, value: string, comment?: string) => {
    clearFeedback();
    setSaving(true);
    try {
      await expertApi.put(`/expert/settings/prompts/${key}`, { value, comment });
      setSuccess(`${key} enregistré et appliqué au runtime.`);
      setDirtyPrompt(false);
      await loadAll();
    } catch (error) {
      setActionError(messageFromError(error));
    } finally {
      setSaving(false);
    }
  };

  const resetPrompt = async (key: string) => {
    clearFeedback();
    setSaving(true);
    try {
      await expertApi.post(`/expert/settings/prompts/${key}/reset`);
      setSuccess(`${key} restauré au défaut contrôlé.`);
      setDirtyPrompt(false);
      await loadAll();
    } catch (error) {
      setActionError(messageFromError(error));
    } finally {
      setSaving(false);
    }
  };

  const restoreLatestCustom = async (key: string) => {
    clearFeedback();
    setSaving(true);
    try {
      const { data } = await expertApi.post(
        `/expert/settings/prompts/${key}/restore-latest-custom`,
      );
      setSuccess(`${key} réactivé (v${data.version}).`);
      setDirtyPrompt(false);
      await loadAll();
    } catch (error) {
      setActionError(messageFromError(error));
    } finally {
      setSaving(false);
    }
  };

  const restoreAllLatestCustoms = async () => {
    clearFeedback();
    setSaving(true);
    try {
      const { data } = await expertApi.post('/expert/settings/prompts-restore-latest-customs');
      setSuccess(
        data.restored?.length
          ? `${data.restored.length} configuration(s) personnalisée(s) réactivée(s).`
          : 'Aucune version personnalisée à réactiver.',
      );
      await loadAll();
    } catch (error) {
      setActionError(messageFromError(error));
    } finally {
      setSaving(false);
    }
  };

  const runProviderTest = async (provider: ProviderId) => {
    clearFeedback();
    setTestingProvider(provider);
    setTestResult(null);
    try {
      const path =
        provider === 'openai'
          ? '/expert/settings/openai-test'
          : provider === 'vertex'
            ? '/expert/settings/vertex-test'
            : '/expert/settings/gemini-test';
      const { data } = await expertApi.post(path);
      setTestResult(data);
      if (data.success) {
        setSuccess(
          data.models?.length
            ? `${provider} validé sur ${data.models.length} modèle(s) actif(s).`
            : `${provider} configuré mais non utilisé : aucun appel lancé.`,
        );
      } else {
        setActionError(
          data.models?.find((entry: { success: boolean }) => !entry.success)?.error ||
            data.error ||
            `Le test ${provider} a échoué.`,
        );
      }
      await loadAll();
    } catch (error) {
      setActionError(messageFromError(error));
    } finally {
      setTestingProvider(null);
    }
  };

  const testAndApplyModels = async () => {
    if (!modelConfig) return;
    clearFeedback();
    setSaving(true);
    try {
      const { data } = await expertApi.post('/expert/settings/model-config/test-and-apply', {
        providerMode: 'per_agent',
        agents: modelConfig.agents,
      });
      setSuccess(data.message || 'Configuration IA testée et appliquée.');
      await loadAll();
    } catch (error) {
      setActionError(messageFromError(error));
    } finally {
      setSaving(false);
    }
  };

  const updateAgent = (agent: AgentKey, patch: Partial<AgentModelConfig>) => {
    setModelConfig((current) => {
      if (!current) return current;
      const previous = current.agents[agent];
      const providerChanged = patch.provider && patch.provider !== previous.provider;
      const next: AgentModelConfig = {
        ...previous,
        ...patch,
        ...(providerChanged ? { model: '' } : {}),
      };
      if (providerChanged && patch.provider === 'openai') {
        next.reasoningEffort = next.reasoningEffort || 'medium';
        next.verbosity = next.verbosity || 'medium';
      }
      return {
        ...current,
        providerMode: 'per_agent',
        agents: { ...current.agents, [agent]: next },
      };
    });
  };

  const tabs = useMemo(
    () => [
      { id: 'readiness' as const, label: 'Préproduction', icon: ShieldCheck },
      { id: 'credentials' as const, label: 'Connexion', icon: Key },
      { id: 'personality' as const, label: 'ADN Lumira', icon: Brain },
      { id: 'agents' as const, label: 'Prompts', icon: Bot },
      { id: 'models' as const, label: 'Modèles', icon: Settings },
    ],
    [],
  );

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-600" />
          <p className="mt-3 text-sm text-desk-muted">Lecture de la configuration réelle…</p>
        </div>
      </div>
    );
  }

  if (loadError || !prompts || !defaults || !modelConfig || !credentials || !readiness) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="mx-auto max-w-2xl border-red-500/30 p-6">
          <h1 className="text-lg font-semibold text-desk-text">Configuration IA non lisible</h1>
          <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">
            {loadError || 'Réponse de configuration incomplète.'}
          </p>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black"
          >
            <RefreshCw className="h-4 w-4" />
            Relire la configuration
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-3 sm:p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-desk-text">Contrôle IA de production</h1>
            <p className="text-xs text-desk-muted">Un choix explicite, un test réel, une application atomique</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill
            level={
              readiness.verdict === 'GO'
                ? 'pass'
                : readiness.verdict === 'NO_GO'
                  ? 'fail'
                  : 'warning'
            }
          >
            {readiness.verdict}
          </Pill>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-desk-border px-3 text-sm text-desk-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </header>

      {(actionError || success) && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-xl border p-3 text-sm',
            actionError
              ? 'border-red-500/30 bg-red-500/10 text-red-600'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
          )}
        >
          {actionError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <Check className="mt-0.5 h-4 w-4" />}
          <span>{actionError || success}</span>
        </div>
      )}

      {modelConfigMeta?.hasRestorableCustom && !modelConfigMeta.isCustom && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-desk-text">Une configuration personnalisée existe dans l’historique.</p>
            <button
              type="button"
              onClick={() => void restoreAllLatestCustoms()}
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black"
            >
              <History className="h-4 w-4" />
              Réactiver les dernières versions perso
            </button>
          </div>
        </Card>
      )}

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Paramètres IA">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium',
                activeTab === tab.id
                  ? 'border-amber-500/30 bg-amber-500/15 text-amber-700'
                  : 'border-transparent text-desk-muted hover:bg-desk-hover',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === 'readiness' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase text-desk-muted">Validés</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">{readiness.summary.passes}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-desk-muted">À tester</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{readiness.summary.warnings}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-desk-muted">Blocages</p>
              <p className="mt-1 text-2xl font-semibold text-red-600">{readiness.summary.failures}</p>
            </Card>
          </div>

          <Card className="divide-y divide-desk-border">
            {readiness.checks.map((check) => (
              <div key={check.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-desk-text">{check.label}</h2>
                  <p className="mt-1 text-sm text-desk-muted">{check.detail}</p>
                </div>
                <Pill level={check.level}>
                  {check.level === 'pass' ? 'Validé' : check.level === 'warning' ? 'À tester' : 'Bloquant'}
                </Pill>
              </div>
            ))}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-amber-700" />
                <h2 className="font-semibold text-desk-text">Télémétrie récente</h2>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-desk-card p-3">
                  <p className="text-xl font-semibold">{readiness.recentRunSummary.count}</p>
                  <p className="text-xs text-desk-muted">Appels</p>
                </div>
                <div className="rounded-xl bg-desk-card p-3">
                  <p className="text-xl font-semibold text-red-600">{readiness.recentRunSummary.errors}</p>
                  <p className="text-xs text-desk-muted">Erreurs</p>
                </div>
                <div className="rounded-xl bg-desk-card p-3">
                  <p className="text-xl font-semibold text-amber-700">
                    ${readiness.recentRunSummary.estimatedCost.toFixed(4)}
                  </p>
                  <p className="text-xs text-desk-muted">Coût</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold text-desk-text">Source de vérité</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-desk-muted">Mode</dt>
                  <dd className="font-mono">per_agent</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-desk-muted">Règles héritées</dt>
                  <dd className="font-mono">{readiness.activeRoutingRules.length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-desk-muted">Vérification</dt>
                  <dd>{new Date(readiness.generatedAt).toLocaleString('fr-FR')}</dd>
                </div>
              </dl>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'credentials' && (
        <div className="space-y-4">
          {(
            [
              { id: 'openai' as const, title: 'OpenAI', status: credentials.openai },
              { id: 'vertex' as const, title: 'Vertex AI — Google Cloud', status: credentials.vertex },
              { id: 'gemini' as const, title: 'Gemini API — AI Studio', status: credentials.gemini },
            ] as const
          ).map((card) => {
            const used = providerUsed(card.id);
            const failed = used && ['test_failed', 'quota_billing', 'model_inaccessible'].includes(card.status.state);
            return (
              <Card key={card.id} className={cn('p-5', failed && 'border-red-500/40')}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
                      <Key className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-desk-text">{card.title}</h2>
                      <p className="mt-1 text-sm text-desk-muted">
                        Source : {card.status.credentialSource || card.status.envVar}
                      </p>
                      <p className="mt-1 text-sm text-desk-muted">
                        {used
                          ? `Modèle(s) actif(s) : ${card.status.activeModels?.join(', ') || card.status.model}`
                          : 'Aucun agent actif ne l’utilise'}
                        {card.status.location ? ` · région ${card.status.location}` : ''}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill level={card.status.configured ? 'pass' : used ? 'fail' : 'warning'}>
                          {card.status.configured ? 'Configuré' : 'Non configuré'}
                        </Pill>
                        {!used ? (
                          <Pill level="warning">Non utilisé — aucun test</Pill>
                        ) : (
                          <>
                            <Pill level={card.status.text === 'ok' ? 'pass' : card.status.text === 'error' ? 'fail' : 'warning'}>
                              Texte {card.status.text}
                            </Pill>
                            <Pill level={card.status.multimodal === 'ok' ? 'pass' : card.status.multimodal === 'error' ? 'fail' : 'warning'}>
                              Vision {card.status.multimodal || 'not_tested'}
                            </Pill>
                            <Pill level={card.status.structured === 'ok' ? 'pass' : card.status.structured === 'error' ? 'fail' : 'warning'}>
                              JSON {card.status.structured || 'not_tested'}
                            </Pill>
                          </>
                        )}
                      </div>
                      {used && card.status.lastError && (
                        <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">
                          {card.status.lastError}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runProviderTest(card.id)}
                    disabled={!used || testingProvider !== null}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {testingProvider === card.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                    {used ? 'Tester les modèles actifs' : 'Non utilisé'}
                  </button>
                </div>
                {testResult?.provider === card.id && testResult.models && testResult.models.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {testResult.models.map((entry) => (
                      <p
                        key={entry.model}
                        className={cn(
                          'rounded-lg p-3 text-sm',
                          entry.success
                            ? 'bg-emerald-500/10 text-emerald-700'
                            : 'bg-red-500/10 text-red-600',
                        )}
                      >
                        {entry.model}: texte {entry.text} · vision {entry.multimodal || 'n/a'} · JSON{' '}
                        {entry.structured || 'n/a'}
                        {entry.error ? ` — ${entry.error}` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'personality' && (
        <Card className="p-5">
          <h2 className="mb-5 font-semibold text-desk-text">ADN commun de Lumira</h2>
          <PromptPanel
            promptKey="LUMIRA_DNA"
            prompt={prompts.LUMIRA_DNA}
            defaultValue={defaults.LUMIRA_DNA || ''}
            saving={saving}
            onSave={savePrompt}
            onReset={resetPrompt}
            onRestoreLatestCustom={restoreLatestCustom}
            onDirtyChange={setDirtyPrompt}
          />
        </Card>
      )}

      {activeTab === 'agents' && (
        <div className="space-y-3">
          {AGENTS.map((agent) => {
            const open = expandedAgent === agent.key;
            const config = modelConfig.agents[agent.key];
            return (
              <Card key={agent.key}>
                <button
                  type="button"
                  onClick={() => setExpandedAgent(open ? null : agent.key)}
                  className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-desk-text">{agent.label}</span>
                      <Pill level={config.enabled ? 'pass' : 'warning'}>{config.enabled ? 'Actif' : 'Désactivé'}</Pill>
                      <span className="font-mono text-xs text-desk-muted">
                        {config.provider}/{config.model || 'aucun modèle'}
                      </span>
                    </div>
                    <p className="truncate text-sm text-desk-muted">{agent.description}</p>
                  </div>
                  {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
                {open && (
                  <div className="border-t border-desk-border p-4">
                    <PromptPanel
                      promptKey={agent.key}
                      prompt={prompts[agent.key]}
                      defaultValue={defaults[agent.key] || ''}
                      saving={saving}
                      onSave={savePrompt}
                      onReset={resetPrompt}
                      onRestoreLatestCustom={restoreLatestCustom}
                      onDirtyChange={setDirtyPrompt}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'models' && (
        <div className="space-y-4">
          <Card className="border-blue-500/30 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-desk-text">Catalogue des modèles</h2>
                <p className="mt-1 text-sm text-desk-muted">
                  La découverte liste les modèles sans les appeler. Aucun token n’est consommé ici.
                  Un modèle devient fonctionnel uniquement après « Tester et appliquer ».
                </p>
                {availableModels && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {(['openai', 'gemini', 'vertex'] as ProviderId[]).map((provider) => {
                      const catalog = providerCatalog(provider)!;
                      const tested = credentials.modelProbes?.filter(
                        (probe) =>
                          probe.provider === provider &&
                          probe.text === 'ok' &&
                          probe.multimodal !== 'error' &&
                          probe.structured !== 'error',
                      ).length ?? 0;
                      return (
                        <div key={provider} className="rounded-xl border border-desk-border bg-desk-bg p-3">
                          <div className="text-xs font-semibold uppercase text-desk-muted">{provider}</div>
                          <div className="mt-1 text-sm text-desk-text">
                            {catalog.models.length} détecté(s) · {tested} testé(s) OK
                          </div>
                          {catalog.error && <p className="mt-1 text-xs text-red-600">{catalog.error}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void loadCatalog(true)}
                disabled={catalogLoading}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-700 disabled:opacity-50"
              >
                {catalogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Actualiser le catalogue
              </button>
            </div>
          </Card>

          {AGENTS.map((agent) => {
            const item = modelConfig.agents[agent.key];
            const visual = agentVisualStatus(agent.key, item);
            const probe = item.model ? findProbe(item.provider, item.model) : undefined;
            const options = modelsForProvider(item.provider, agent.key);
            const isGpt5 = item.provider === 'openai' && item.model.startsWith('gpt-5.');
            const statusPill =
              visual === 'disabled' ? (
                <Pill level="warning">Désactivé — non évalué</Pill>
              ) : visual === 'functional' ? (
                <Pill level="pass">Fonctionnel</Pill>
              ) : visual === 'failed' ? (
                <Pill level="fail">Inaccessible — test échoué</Pill>
              ) : visual === 'detected' ? (
                <Pill level="warning">Détecté — non testé</Pill>
              ) : (
                <Pill level="warning">Sélection manuelle requise</Pill>
              );

            return (
              <Card
                key={agent.key}
                className={cn('p-5', visual === 'failed' && 'border-red-500/50 bg-red-500/5')}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-desk-text">{agent.label}</h2>
                      <Pill level={item.enabled ? 'pass' : 'warning'}>{item.enabled ? 'Actif' : 'Désactivé'}</Pill>
                      {statusPill}
                      <span className="font-mono text-xs text-desk-muted">
                        {item.provider}/{item.model || 'aucun modèle'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-desk-muted">{agent.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-desk-muted">
                      {AGENT_REQUIRED_CAPS[agent.key].map((capability) => (
                        <span key={capability} className="rounded-md border border-desk-border px-1.5 py-0.5 font-mono">
                          {capability}
                        </span>
                      ))}
                    </div>
                    {item.enabled && probe?.lastTestedAt && (
                      <p className="mt-2 text-xs text-desk-muted">
                        Dernier test : {new Date(probe.lastTestedAt).toLocaleString('fr-FR')}
                      </p>
                    )}
                    {visual === 'failed' && probe?.lastError && (
                      <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-sm text-red-600">{probe.lastError}</p>
                    )}
                  </div>
                  <label className="inline-flex min-h-10 items-center gap-2 text-sm text-desk-muted">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) => updateAgent(agent.key, { enabled: event.target.checked })}
                      className="h-4 w-4 accent-amber-500"
                    />
                    Agent actif
                  </label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm text-desk-muted">
                    Fournisseur
                    <select
                      value={item.provider}
                      onChange={(event) => updateAgent(agent.key, { provider: event.target.value as ProviderId })}
                      className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                    >
                      {PROVIDER_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm text-desk-muted">
                    Modèle
                    <select
                      value={item.model}
                      onChange={(event) => updateAgent(agent.key, { model: event.target.value })}
                      className={cn(
                        'mt-1 w-full rounded-lg border bg-desk-input p-2.5 text-desk-text',
                        visual === 'failed' ? 'border-red-500' : 'border-desk-border',
                      )}
                    >
                      <option value="">Sélectionner un modèle</option>
                      {options.map((option) => {
                        const optionProbe = findProbe(item.provider, option.id);
                        const label = probePasses(agent.key, optionProbe)
                          ? 'Fonctionnel'
                          : probeFails(agent.key, optionProbe)
                            ? 'Test échoué'
                            : option.detected === false
                              ? 'Actuel — non détecté'
                              : 'Détecté — non testé';
                        return (
                          <option key={option.id} value={option.id}>
                            {option.displayName || option.id} · {label}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label className="text-sm text-desk-muted">
                    Tokens de sortie max
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={item.maxOutputTokens}
                      onChange={(event) => updateAgent(agent.key, { maxOutputTokens: Number(event.target.value) })}
                      className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                    />
                  </label>

                  {isGpt5 ? (
                    <label className="text-sm text-desk-muted">
                      Raisonnement
                      <select
                        value={item.reasoningEffort || 'medium'}
                        onChange={(event) =>
                          updateAgent(agent.key, {
                            reasoningEffort: event.target.value as AgentModelConfig['reasoningEffort'],
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                      >
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                    </label>
                  ) : (
                    <label className="text-sm text-desk-muted">
                      Température
                      <input
                        type="number"
                        min={0}
                        max={2}
                        step={0.05}
                        value={item.temperature ?? 0.4}
                        onChange={(event) => updateAgent(agent.key, { temperature: Number(event.target.value) })}
                        className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                      />
                    </label>
                  )}

                  {isGpt5 ? (
                    <label className="text-sm text-desk-muted">
                      Verbosité
                      <select
                        value={item.verbosity || 'medium'}
                        onChange={(event) =>
                          updateAgent(agent.key, {
                            verbosity: event.target.value as AgentModelConfig['verbosity'],
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                      >
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                    </label>
                  ) : (
                    <label className="text-sm text-desk-muted">
                      Top P
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={item.topP ?? 0.9}
                        onChange={(event) => updateAgent(agent.key, { topP: Number(event.target.value) })}
                        className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                      />
                    </label>
                  )}
                </div>
              </Card>
            );
          })}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void testAndApplyModels()}
              disabled={saving || !modelDirty}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
              Tester et appliquer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
