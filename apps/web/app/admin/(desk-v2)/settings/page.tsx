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
type ProviderMode = 'openai_only' | 'per_agent';
type ModelId = string;

interface PromptWithMeta {
  key: string;
  value: string;
  version: number;
  isCustom: boolean;
  changedBy?: string;
  updatedAt?: string;
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
  model: ModelId;
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  temperature?: number;
  topP?: number;
  maxOutputTokens: number;
}

interface ModelConfig {
  providerMode: ProviderMode;
  agents: Record<AgentKey, AgentModelConfig>;
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
}

interface CredentialsStatus {
  openai: ProviderStatus;
  gemini: ProviderStatus;
  vertex: ProviderStatus;
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
  error?: string;
}

const AGENTS: Array<{ key: AgentKey; label: string; description: string }> = [
  { key: 'SCRIBE', label: 'SCRIBE', description: 'Lecture principale multimodale et synthèse' },
  { key: 'EDITOR', label: 'EDITOR', description: 'Corrections guidées par l’expert' },
  { key: 'GUIDE', label: 'GUIDE', description: 'Parcours de 30 jours en lots de 10 jours' },
  {
    key: 'NARRATOR',
    label: 'NARRATOR',
    description: 'Adaptation de la lecture validée pour l’audio',
  },
  {
    key: 'CONFIDANT',
    label: 'CONFIDANT',
    description: 'Compagnon optionnel, désactivé au lancement',
  },
  {
    key: 'ONIRIQUE',
    label: 'ONIRIQUE',
    description: 'Interprétation des rêves, désactivée au lancement',
  },
];

const OPENAI_MODEL_OPTIONS: Array<{ id: string; label: string; price: string }> = [
  {
    id: 'gpt-5.5-2026-04-23',
    label: 'GPT-5.5 · snapshot 23/04/2026',
    price: '5 $ entrée / 30 $ sortie par million',
  },
  {
    id: 'gpt-5.4-2026-03-05',
    label: 'GPT-5.4 · snapshot 05/03/2026',
    price: '2,50 $ entrée / 15 $ sortie par million',
  },
  {
    id: 'gpt-4o-2024-11-20',
    label: 'GPT-4o · snapshot 20/11/2024',
    price: '2,50 $ entrée / 10 $ sortie par million',
  },
];

const GOOGLE_MODEL_OPTIONS: Array<{ id: string; label: string; price: string }> = [
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', price: 'Vertex / Gemini API' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', price: 'Vertex / Gemini API' },
];

const PROVIDER_OPTIONS: Array<{ id: ProviderId; label: string }> = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'vertex', label: 'Vertex AI' },
  { id: 'gemini', label: 'Gemini API' },
];

function modelsForProvider(provider: ProviderId) {
  return provider === 'openai' ? OPENAI_MODEL_OPTIONS : GOOGLE_MODEL_OPTIONS;
}

function defaultModelForProvider(provider: ProviderId): string {
  return modelsForProvider(provider)[0].id;
}

function messageFromError(error: unknown): string {
  const value = error as {
    response?: { status?: number; data?: { message?: string; error?: string } };
    message?: string;
  };
  if (value.response?.status === 403) {
    return 'Accès refusé : le compte connecté doit être ADMIN.';
  }
  return (
    value.response?.data?.message ||
    value.response?.data?.error ||
    value.message ||
    'Erreur inconnue'
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn('rounded-2xl border border-desk-border bg-desk-surface shadow-sm', className)}
    >
      {children}
    </section>
  );
}

function Pill({ level, children }: { level: 'pass' | 'warning' | 'fail'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        level === 'pass' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
        level === 'warning' && 'border-amber-500/30 bg-amber-500/10 text-amber-600',
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
  onDirtyChange,
}: {
  promptKey: string;
  prompt: PromptWithMeta;
  defaultValue: string;
  saving: boolean;
  onSave: (key: string, value: string, comment?: string) => Promise<void>;
  onReset: (key: string) => Promise<void>;
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
          <Pill level={prompt.isCustom ? 'warning' : 'pass'}>
            {prompt.isCustom ? `Personnalisé v${prompt.version}` : 'Défaut contrôlé'}
          </Pill>
          {value !== defaultValue && (
            <span className="text-xs text-desk-muted">Différent du défaut</span>
          )}
        </div>
        <button
          type="button"
          onClick={toggleHistory}
          disabled={historyLoading}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-desk-muted hover:bg-desk-hover hover:text-desk-text"
        >
          {historyLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <History className="h-4 w-4" />
          )}
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
        {dirty && <span className="text-amber-600">Modification non enregistrée</span>}
      </div>

      {dirty && (
        <input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Note de version recommandée"
          className="w-full rounded-xl border border-desk-border bg-desk-input px-3 py-2.5 text-sm text-desk-text outline-none focus:border-amber-500/60"
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSave(promptKey, value, comment)}
          disabled={!dirty || saving || !value.trim()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer une version
        </button>
        {prompt.isCustom && (
          <button
            type="button"
            onClick={() => onReset(promptKey)}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-desk-border px-4 py-2 text-sm text-desk-text hover:bg-desk-hover"
          >
            <RotateCcw className="h-4 w-4" />
            Revenir au défaut
          </button>
        )}
      </div>

      {historyOpen && (
        <div className="space-y-2 rounded-xl border border-desk-border bg-desk-bg p-3">
          {history.length === 0 ? (
            <p className="text-sm text-desk-muted">Aucune version enregistrée.</p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-desk-card p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-desk-text">v{item.version}</span>
                    {item.isActive && <Pill level="pass">Active</Pill>}
                  </div>
                  <p className="truncate text-xs text-desk-muted">
                    {item.comment || 'Sans note'} ·{' '}
                    {new Date(item.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                {!item.isActive && (
                  <button
                    type="button"
                    onClick={() => restore(item.version)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/10"
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
  const [testing, setTesting] = useState(false);
  const [dirtyPrompt, setDirtyPrompt] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<AgentKey | null>('SCRIBE');
  const [prompts, setPrompts] = useState<Record<string, PromptWithMeta> | null>(null);
  const [defaults, setDefaults] = useState<Record<string, string> | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [savedModelConfig, setSavedModelConfig] = useState<ModelConfig | null>(null);
  const [credentials, setCredentials] = useState<CredentialsStatus | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testingProvider, setTestingProvider] = useState<ProviderId | null>(null);

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
      setModelConfig(modelResponse.data);
      setSavedModelConfig(modelResponse.data);
      setCredentials(statusResponse.data);
      setReadiness(readinessResponse.data);
    } catch (error) {
      setPrompts(null);
      setDefaults(null);
      setModelConfig(null);
      setSavedModelConfig(null);
      setCredentials(null);
      setReadiness(null);
      setLoadError(messageFromError(error));
    } finally {
      setLoading(false);
    }
  }, []);

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

  const clearFeedback = () => {
    setActionError(null);
    setSuccess(null);
  };

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

  const runProviderTest = async (provider: ProviderId) => {
    clearFeedback();
    setTesting(true);
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
          provider === 'openai'
            ? 'OpenAI Responses + vision validés.'
            : provider === 'vertex'
              ? 'Vertex AI texte + vision validés.'
              : 'Gemini API texte + vision validés.',
        );
      } else setActionError(data.error || `Le test ${provider} a échoué.`);
      await loadAll();
    } catch (error) {
      setActionError(messageFromError(error));
    } finally {
      setTesting(false);
      setTestingProvider(null);
    }
  };

  const saveModels = async () => {
    if (!modelConfig) return;
    clearFeedback();
    setSaving(true);
    try {
      await expertApi.put('/expert/settings/model-config', modelConfig);
      setSuccess('Configuration des modèles enregistrée et cache runtime invalidé.');
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
      const nextAgent = { ...current.agents[agent], ...patch };
      if (patch.provider && patch.provider !== current.agents[agent].provider) {
        const allowed = modelsForProvider(patch.provider).map((option) => option.id);
        if (!allowed.includes(nextAgent.model)) {
          nextAgent.model = defaultModelForProvider(patch.provider);
        }
        if (patch.provider === 'openai' && nextAgent.model.startsWith('gpt-5.')) {
          nextAgent.reasoningEffort = nextAgent.reasoningEffort || 'medium';
          nextAgent.verbosity = nextAgent.verbosity || 'medium';
        } else {
          nextAgent.temperature = nextAgent.temperature ?? 0.4;
          nextAgent.topP = nextAgent.topP ?? 0.9;
        }
      }
      return {
        ...current,
        agents: {
          ...current.agents,
          [agent]: nextAgent,
        },
      };
    });
  };

  const updateProviderMode = (providerMode: ProviderMode) => {
    setModelConfig((current) => (current ? { ...current, providerMode } : current));
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
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
            <div>
              <h1 className="text-lg font-semibold text-desk-text">
                Configuration IA non vérifiée
              </h1>
              <p className="mt-2 text-sm leading-6 text-desk-muted">
                Le Desk n’affiche aucune valeur locale de secours. La configuration réelle doit être
                lisible avant la production.
              </p>
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
            </div>
          </div>
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
            <p className="text-xs text-desk-muted">
              Configuration réelle, snapshots, prompts, vision et coûts
            </p>
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
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-desk-border px-3 text-sm text-desk-muted hover:bg-desk-hover hover:text-desk-text"
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
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
          )}
        >
          {actionError ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{actionError || success}</span>
        </div>
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
                  ? 'border-amber-500/30 bg-amber-500/15 text-amber-600'
                  : 'border-transparent text-desk-muted hover:bg-desk-hover hover:text-desk-text',
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
              <p className="text-xs uppercase tracking-wide text-desk-muted">Validés</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600">
                {readiness.summary.passes}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-desk-muted">À tester</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">
                {readiness.summary.warnings}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-desk-muted">Blocages</p>
              <p className="mt-1 text-2xl font-semibold text-red-600">
                {readiness.summary.failures}
              </p>
            </Card>
          </div>

          <Card className="divide-y divide-desk-border">
            {readiness.checks.map((check) => (
              <div
                key={check.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h2 className="text-sm font-semibold text-desk-text">{check.label}</h2>
                  <p className="mt-1 text-sm text-desk-muted">{check.detail}</p>
                </div>
                <Pill level={check.level}>
                  {check.level === 'pass'
                    ? 'Validé'
                    : check.level === 'warning'
                      ? 'À tester'
                      : 'Bloquant'}
                </Pill>
              </div>
            ))}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-amber-600" />
                <h2 className="font-semibold text-desk-text">Télémétrie récente</h2>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-desk-card p-3">
                  <p className="text-xl font-semibold text-desk-text">
                    {readiness.recentRunSummary.count}
                  </p>
                  <p className="text-xs text-desk-muted">Appels</p>
                </div>
                <div className="rounded-xl bg-desk-card p-3">
                  <p className="text-xl font-semibold text-red-600">
                    {readiness.recentRunSummary.errors}
                  </p>
                  <p className="text-xs text-desk-muted">Erreurs</p>
                </div>
                <div className="rounded-xl bg-desk-card p-3">
                  <p className="text-xl font-semibold text-amber-600">
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
                  <dd className="font-mono text-desk-text">
                    {readiness.effectiveConfig.providerMode}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-desk-muted">Règles actives</dt>
                  <dd className="font-mono text-desk-text">
                    {readiness.activeRoutingRules.length}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-desk-muted">Vérification</dt>
                  <dd className="text-right text-desk-text">
                    {new Date(readiness.generatedAt).toLocaleString('fr-FR')}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-desk-border p-4">
              <h2 className="font-semibold text-desk-text">Appels réellement exécutés</h2>
              <p className="mt-1 text-sm text-desk-muted">
                Snapshot, source, tokens, durée et coût.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-desk-card text-desk-muted">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Snapshot</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Tokens entrée / sortie</th>
                    <th className="px-4 py-3">Durée</th>
                    <th className="px-4 py-3">Coût</th>
                    <th className="px-4 py-3">État</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-desk-border">
                  {readiness.recentRuns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-desk-muted">
                        Aucun appel enregistré. Une génération de préproduction est encore
                        nécessaire.
                      </td>
                    </tr>
                  ) : (
                    readiness.recentRuns.map((run) => (
                      <tr key={run.id} className="text-desk-text">
                        <td className="whitespace-nowrap px-4 py-3">
                          {new Date(run.startedAt).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 font-semibold">{run.agent}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono">{run.model}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-desk-muted">
                          {run.routingSource || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {(run.inputTokens || 0).toLocaleString('fr-FR')} /{' '}
                          {(run.outputTokens || 0).toLocaleString('fr-FR')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)} s` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {run.estimatedCost != null ? `$${run.estimatedCost.toFixed(4)}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Pill level={run.status === 'SUCCESS' ? 'pass' : 'fail'}>
                            {run.status}
                          </Pill>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'credentials' && credentials && (
        <div className="space-y-4">
          {(
            [
              {
                id: 'openai' as const,
                title: 'OpenAI',
                subtitle: 'Lectures et agents en mode openai_only',
                status: credentials.openai,
              },
              {
                id: 'vertex' as const,
                title: 'Vertex AI',
                subtitle: 'Recommandé pour SCRIBE / lectures',
                status: credentials.vertex,
              },
              {
                id: 'gemini' as const,
                title: 'Gemini API',
                subtitle: 'Recommandé pour EDITOR / assistance expert',
                status: credentials.gemini,
              },
            ] as const
          ).map((card) => (
            <Card key={card.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-desk-text">{card.title}</h2>
                    <p className="mt-1 text-sm text-desk-muted">{card.subtitle}</p>
                    <p className="mt-1 text-sm text-desk-muted">
                      Modèle testé : {card.status.model}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill level={card.status.configured ? 'pass' : 'fail'}>
                        {card.status.configured ? 'Configuré' : 'Non configuré'}
                      </Pill>
                      <Pill
                        level={
                          card.status.text === 'ok'
                            ? 'pass'
                            : card.status.text === 'error'
                              ? 'fail'
                              : 'warning'
                        }
                      >
                        Texte {card.status.text}
                      </Pill>
                      <Pill
                        level={
                          card.status.multimodal === 'ok'
                            ? 'pass'
                            : card.status.multimodal === 'error'
                              ? 'fail'
                              : 'warning'
                        }
                      >
                        Vision {card.status.multimodal || 'not_tested'}
                      </Pill>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runProviderTest(card.id)}
                  disabled={testing}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {testing && testingProvider === card.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  Tester
                </button>
              </div>
              {(card.status.lastError ||
                (testResult?.provider === card.id && testResult.error)) && (
                <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">
                  {(testResult?.provider === card.id && testResult.error) || card.status.lastError}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'personality' && (
        <Card className="p-5">
          <div className="mb-5">
            <h2 className="font-semibold text-desk-text">ADN commun de Lumira</h2>
            <p className="mt-1 text-sm text-desk-muted">
              Cadre partagé de ton, prudence et interprétation.
            </p>
          </div>
          <PromptPanel
            promptKey="LUMIRA_DNA"
            prompt={prompts.LUMIRA_DNA}
            defaultValue={defaults.LUMIRA_DNA || ''}
            saving={saving}
            onSave={savePrompt}
            onReset={resetPrompt}
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
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-desk-text">{agent.label}</span>
                        <Pill level={config.enabled ? 'pass' : 'warning'}>
                          {config.enabled ? 'Actif' : 'Désactivé'}
                        </Pill>
                        <span className="font-mono text-xs text-desk-muted">
                          {config.provider}/{config.model}
                        </span>
                      </div>
                      <p className="truncate text-sm text-desk-muted">{agent.description}</p>
                    </div>
                  </div>
                  {open ? (
                    <ChevronUp className="h-5 w-5 text-desk-muted" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-desk-muted" />
                  )}
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
                      onDirtyChange={setDirtyPrompt}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'models' && modelConfig && (
        <div className="space-y-4">
          <Card className="border-blue-500/30 p-5">
            <h2 className="font-semibold text-desk-text">Mode de routage</h2>
            <p className="mt-1 text-sm text-desk-muted">
              `openai_only` force OpenAI. `per_agent` laisse chaque agent choisir OpenAI, Vertex ou
              Gemini. Les prompts restent partagés.
            </p>
            <label className="mt-4 block text-sm text-desk-muted">
              Provider mode
              <select
                value={modelConfig.providerMode}
                onChange={(event) => updateProviderMode(event.target.value as ProviderMode)}
                className="mt-1 w-full max-w-sm rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
              >
                <option value="openai_only">openai_only</option>
                <option value="per_agent">per_agent</option>
              </select>
            </label>
          </Card>

          {AGENTS.map((agent) => {
            const item = modelConfig.agents[agent.key];
            const providerLocked = modelConfig.providerMode === 'openai_only';
            const effectiveProvider = providerLocked ? 'openai' : item.provider;
            const modelOptions = modelsForProvider(effectiveProvider);
            const isGpt5 = effectiveProvider === 'openai' && item.model.startsWith('gpt-5.');
            const useTempKnobs = !isGpt5;
            const price = modelOptions.find((option) => option.id === item.model)?.price;
            return (
              <Card key={agent.key} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-desk-text">{agent.label}</h2>
                      <Pill level={item.enabled ? 'pass' : 'warning'}>
                        {item.enabled ? 'Actif' : 'Désactivé'}
                      </Pill>
                      <span className="font-mono text-xs text-desk-muted">
                        {effectiveProvider}/{item.model}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-desk-muted">{agent.description}</p>
                    <p className="mt-1 text-xs text-desk-muted">{price}</p>
                  </div>
                  <label className="inline-flex min-h-10 items-center gap-2 text-sm text-desk-muted">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) =>
                        updateAgent(agent.key, { enabled: event.target.checked })
                      }
                      className="h-4 w-4 accent-amber-500"
                    />
                    Agent actif
                  </label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm text-desk-muted">
                    Provider
                    <select
                      value={effectiveProvider}
                      disabled={providerLocked}
                      onChange={(event) =>
                        updateAgent(agent.key, { provider: event.target.value as ProviderId })
                      }
                      className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text disabled:opacity-60"
                    >
                      {PROVIDER_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm text-desk-muted">
                    Modèle
                    <select
                      value={item.model}
                      onChange={(event) => {
                        const model = event.target.value;
                        updateAgent(agent.key, {
                          model,
                          ...(model.startsWith('gpt-5.')
                            ? {
                                reasoningEffort: item.reasoningEffort || 'medium',
                                verbosity: item.verbosity || 'medium',
                              }
                            : {
                                temperature: item.temperature ?? 0.4,
                                topP: item.topP ?? 0.9,
                              }),
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                    >
                      {modelOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm text-desk-muted">
                    Tokens de sortie max
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={item.maxOutputTokens}
                      onChange={(event) =>
                        updateAgent(agent.key, { maxOutputTokens: Number(event.target.value) })
                      }
                      className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                    />
                  </label>

                  {isGpt5 ? (
                    <>
                      <label className="text-sm text-desk-muted">
                        Raisonnement
                        <select
                          value={item.reasoningEffort || 'medium'}
                          onChange={(event) =>
                            updateAgent(agent.key, {
                              reasoningEffort: event.target
                                .value as AgentModelConfig['reasoningEffort'],
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                        >
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                        </select>
                      </label>
                      <label className="text-sm text-desk-muted">
                        Verbosity
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
                    </>
                  ) : useTempKnobs ? (
                    <>
                      <label className="text-sm text-desk-muted">
                        Température
                        <input
                          type="number"
                          min={0}
                          max={2}
                          step={0.05}
                          value={item.temperature ?? 0.4}
                          onChange={(event) =>
                            updateAgent(agent.key, { temperature: Number(event.target.value) })
                          }
                          className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                        />
                      </label>
                      <label className="text-sm text-desk-muted">
                        Top P
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={item.topP ?? 0.9}
                          onChange={(event) =>
                            updateAgent(agent.key, { topP: Number(event.target.value) })
                          }
                          className="mt-1 w-full rounded-lg border border-desk-border bg-desk-input p-2.5 text-desk-text"
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              </Card>
            );
          })}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void saveModels()}
              disabled={saving || !modelDirty}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer la configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
