'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, FileText, History, Sparkles, UserRound, X } from 'lucide-react';
import type { WorkspaceHistoryEvent } from './reading-workspace.types';

interface ReadingHistoryPanelProps {
  events: WorkspaceHistoryEvent[];
  open: boolean;
  onClose: () => void;
}

export function ReadingHistoryPanel({ events, open, onClose }: ReadingHistoryPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-desk-border bg-desk-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-desk-border px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/15 p-2 text-amber-600"><History className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-semibold text-desk-text">Chronologie</h2>
                  <p className="text-xs text-desk-muted">{events.length} événement{events.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label="Fermer l’historique" className="rounded-lg p-2 text-desk-muted hover:bg-desk-hover hover:text-desk-text"><X className="h-5 w-5" /></button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {events.length === 0 ? (
                <div className="py-16 text-center text-sm text-desk-muted">Aucun événement enregistré.</div>
              ) : (
                <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[18px] before:top-4 before:w-px before:bg-desk-border">
                  {events.map((event) => (
                    <div key={event.id} className="relative flex gap-3">
                      <div className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-desk-border bg-desk-surface text-desk-muted">
                        <EventIcon type={event.type} />
                      </div>
                      <div className="min-w-0 flex-1 rounded-xl border border-desk-border bg-desk-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-desk-text">{event.label}</p>
                          {event.status && <span className="rounded-full bg-desk-hover px-2 py-0.5 text-[10px] font-medium text-desk-muted">{event.status}</span>}
                        </div>
                        {event.detail && <p className="mt-1 text-xs text-desk-muted">{event.detail}</p>}
                        <p className="mt-2 flex items-center gap-1 text-[11px] text-desk-subtle"><Clock3 className="h-3 w-3" />{new Date(event.at).toLocaleString('fr-FR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EventIcon({ type }: { type: string }) {
  if (type === 'SCRIBE' || type === 'EDITOR') return <Sparkles className="h-4 w-4" />;
  if (type === 'DELIVERY') return <FileText className="h-4 w-4" />;
  if (type === 'EXPERT_EDIT') return <UserRound className="h-4 w-4" />;
  return <History className="h-4 w-4" />;
}
