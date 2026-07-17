'use client';

import Link from 'next/link';
import { AlertTriangle, Cog, Loader2 } from 'lucide-react';
import { useProductionControl } from './useProductionControl';

export function ProductionIndicator() {
  const { summary, isLoading } = useProductionControl({ includeJobs: false, pollIntervalMs: 5000 });
  const active = summary.queued + summary.running;

  return (
    <Link
      href="/admin/production"
      title="Ouvrir le centre de production"
      className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-desk-border bg-desk-card px-2.5 py-1.5 text-xs transition-colors hover:bg-desk-hover sm:px-3"
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-desk-muted" />
      ) : summary.failed > 0 ? (
        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
      ) : (
        <Cog className={`h-3.5 w-3.5 text-amber-600 ${summary.running > 0 ? 'animate-spin' : ''}`} />
      )}
      <span className="hidden text-desk-muted sm:inline">Production</span>
      <span className={summary.failed > 0 ? 'font-bold text-red-600' : 'font-bold text-desk-text'}>
        {active}
      </span>
      {summary.failed > 0 && (
        <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 font-bold text-red-600">
          {summary.failed} incident{summary.failed > 1 ? 's' : ''}
        </span>
      )}
    </Link>
  );
}
