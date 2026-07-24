'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  Send,
  Volume2,
  X,
} from 'lucide-react';
import type { QualityReport } from './reading-workspace.types';

interface SealReadingModalProps {
  open: boolean;
  clientName: string;
  orderNumber: string;
  quality: QualityReport;
  isSealing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SealReadingModal({
  open,
  clientName,
  orderNumber,
  quality,
  isSealing,
  onCancel,
  onConfirm,
}: SealReadingModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !isSealing && onCancel()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-desk-border bg-desk-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between border-b border-desk-border px-5 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                  Préflight de livraison
                </p>
                <h2 className="mt-2 text-xl font-semibold text-desk-text">
                  Sceller cette version ?
                </h2>
                <p className="mt-1 text-sm text-desk-muted">
                  {clientName} · {orderNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSealing}
                aria-label="Fermer"
                className="rounded-lg p-2 text-desk-muted hover:bg-desk-hover disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-4 p-5">
              <div
                className={`rounded-2xl border p-4 ${
                  quality.status === 'PASS'
                    ? 'border-emerald-500/25 bg-emerald-500/10'
                    : 'border-amber-500/25 bg-amber-500/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  {quality.status === 'PASS' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                  )}
                  <div>
                    <p className="font-semibold text-desk-text">
                      {quality.status === 'PASS'
                        ? 'Contrôle qualité validé'
                        : `${quality.warnings.length} avertissement${quality.warnings.length > 1 ? 's' : ''} accepté${quality.warnings.length > 1 ? 's' : ''}`}
                    </p>
                    <p className="mt-1 text-xs text-desk-muted">
                      {quality.metrics.totalWords.toLocaleString('fr-FR')} mots ·{' '}
                      {quality.metrics.insightsCount} insights · {quality.metrics.ritualsCount} rituels ·{' '}
                      {quality.metrics.instructionsCount} étapes
                    </p>
                  </div>
                </div>
              </div>

              {quality.warnings.length > 0 && (
                <div className="max-h-36 space-y-2 overflow-y-auto rounded-2xl border border-desk-border bg-desk-card p-3">
                  {quality.warnings.map((warning, index) => (
                    <p key={`${warning.code}-${warning.field ?? index}`} className="text-xs text-amber-700">
                      • {warning.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-3">
                <DeliveryItem icon={<FileText className="h-4 w-4" />} label="PDF" detail="Version immuable" />
                <DeliveryItem icon={<Mail className="h-4 w-4" />} label="Email" detail="Envoi suivi" />
                <DeliveryItem icon={<Volume2 className="h-4 w-4" />} label="Audio" detail="Mis en file" />
              </div>

              <p className="text-xs leading-5 text-desk-subtle">
                Le PDF et l’audio utiliseront exactement cette version structurée. Une nouvelle correction nécessitera une réouverture et une nouvelle version scellée.
              </p>
            </div>

            <footer className="flex gap-3 border-t border-desk-border bg-desk-card/60 px-5 py-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSealing}
                className="min-h-11 flex-1 rounded-xl border border-desk-border px-4 text-sm font-medium text-desk-muted hover:bg-desk-hover disabled:opacity-50"
              >
                Continuer la révision
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSealing}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                {isSealing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Sceller et envoyer
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DeliveryItem({ icon, label, detail }: { icon: ReactNode; label: string; detail: string }) {
  return (
    <div className="rounded-xl border border-desk-border bg-desk-card p-3">
      <div className="flex items-center gap-2 text-emerald-600">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="mt-1 text-[11px] text-desk-muted">{detail}</p>
    </div>
  );
}
