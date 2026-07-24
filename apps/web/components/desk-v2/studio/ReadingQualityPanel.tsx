'use client';

import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Wrench } from 'lucide-react';
import type { QualityReport } from './reading-workspace.types';

interface ReadingQualityPanelProps {
  quality: QualityReport | null;
  isRepairing: boolean;
  onRepair: () => void;
}

const STATUS_STYLES = {
  PASS: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  WARNING: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  BLOCKED: 'border-red-500/30 bg-red-500/10 text-red-700',
} as const;

export function ReadingQualityPanel({
  quality,
  isRepairing,
  onRepair,
}: ReadingQualityPanelProps) {
  if (!quality) {
    return (
      <aside className="rounded-2xl border border-desk-border bg-desk-surface p-4">
        <p className="text-sm font-semibold text-desk-text">Contrôle qualité</p>
        <p className="mt-2 text-sm text-desk-muted">Disponible après la génération.</p>
      </aside>
    );
  }

  const issues = [...quality.blockingIssues, ...quality.warnings];
  const statusLabel =
    quality.status === 'PASS'
      ? 'Prête à valider'
      : quality.status === 'WARNING'
        ? 'À examiner'
        : 'Corrections requises';

  return (
    <aside className="space-y-3">
      <div className={`rounded-2xl border p-4 ${STATUS_STYLES[quality.status]}`}>
        <div className="flex items-start gap-3">
          {quality.status === 'PASS' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : quality.status === 'WARNING' ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="font-semibold">{statusLabel}</p>
            <p className="mt-1 text-xs opacity-80">
              {quality.metrics.totalWords.toLocaleString('fr-FR')} mots ·{' '}
              {quality.metrics.insightsCount} insights · {quality.metrics.ritualsCount} rituels
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-desk-border bg-desk-surface p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-desk-text">Points à traiter</h3>
        </div>

        {issues.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-600">Aucune anomalie détectée.</p>
        ) : (
          <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {issues.map((issue, index) => (
              <div
                key={`${issue.code}-${issue.field ?? index}`}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  issue.severity === 'BLOCKING'
                    ? 'border-red-500/20 bg-red-500/5 text-red-700'
                    : 'border-amber-500/20 bg-amber-500/5 text-amber-700'
                }`}
              >
                <p className="font-medium">{issue.message}</p>
                {issue.field && <p className="mt-1 opacity-70">Bloc : {issue.field}</p>}
              </div>
            ))}
          </div>
        )}

        {issues.length > 0 && (
          <button
            type="button"
            onClick={onRepair}
            disabled={isRepairing}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            <Wrench className="h-4 w-4" />
            {isRepairing ? 'Correction en cours…' : 'Nettoyer les défauts sûrs'}
          </button>
        )}
      </div>
    </aside>
  );
}
