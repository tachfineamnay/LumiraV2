'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Clock, Image as ImageIcon, MapPin, MessageSquare, Target, X } from 'lucide-react';
import { ExpertPrivatePhoto } from '@/components/private-media/ExpertPrivatePhoto';
import { resolveDeskReadingSource } from '@/lib/desk-reading-source';
import type { Order } from '../types';

interface ReadingDossierDrawerProps {
  order: Order;
  open: boolean;
  onClose: () => void;
}

export function ReadingDossierDrawer({ order, open, onClose }: ReadingDossierDrawerProps) {
  const source = resolveDeskReadingSource(order);
  const profile = source.profile;

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
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="absolute inset-y-0 left-0 flex w-full max-w-lg flex-col border-r border-desk-border bg-desk-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-desk-border px-4 py-4">
              <div>
                <h2 className="font-semibold text-desk-text">Dossier client</h2>
                <p className="text-xs text-desk-muted">
                  {order.user.firstName} {order.user.lastName} · {order.orderNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer le dossier"
                className="rounded-lg p-2 text-desk-muted hover:bg-desk-hover hover:text-desk-text"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <section className="rounded-2xl border border-desk-border bg-desk-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-desk-subtle">Identité</p>
                <p className="mt-2 text-lg font-semibold text-desk-text">
                  {order.user.firstName} {order.user.lastName}
                </p>
                {profile?.usageName && (
                  <p className="mt-1 text-sm text-amber-600">Prénom d’usage : {profile.usageName}</p>
                )}
                <div className="mt-4 space-y-2 text-sm text-desk-muted">
                  {profile?.birthDate && (
                    <p className="flex items-center gap-2"><Calendar className="h-4 w-4" />{new Date(profile.birthDate).toLocaleDateString('fr-FR')}</p>
                  )}
                  {profile?.birthTime && (
                    <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{profile.birthTime}</p>
                  )}
                  {profile?.birthPlace && (
                    <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{profile.birthPlace}</p>
                  )}
                </div>
              </section>

              {profile?.specificQuestion && (
                <section className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-600"><MessageSquare className="h-4 w-4" />Question</p>
                  <p className="mt-2 text-sm leading-relaxed text-desk-text">{profile.specificQuestion}</p>
                </section>
              )}

              {profile?.objective && (
                <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600"><Target className="h-4 w-4" />Objectif</p>
                  <p className="mt-2 text-sm leading-relaxed text-desk-text">{profile.objective}</p>
                </section>
              )}

              {(profile?.highs || profile?.lows || profile?.fears || profile?.lifeEvents) && (
                <section className="space-y-3 rounded-2xl border border-desk-border bg-desk-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-desk-subtle">Contexte de vie</p>
                  {profile.highs && <Field label="Ce qui porte" value={profile.highs} />}
                  {profile.lows && <Field label="Ce qui freine" value={profile.lows} />}
                  {profile.fears && <Field label="Peurs et blocages" value={profile.fears} />}
                  {profile.lifeEvents && <Field label="Période marquante" value={profile.lifeEvents} />}
                </section>
              )}

              {(profile?.facePhotoUrl || profile?.palmPhotoUrl) && (
                <section className="rounded-2xl border border-desk-border bg-desk-card p-4">
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-desk-subtle"><ImageIcon className="h-4 w-4" />Photos</p>
                  <div className="grid grid-cols-2 gap-3">
                    {profile.facePhotoUrl && <ExpertPrivatePhoto clientId={order.user.id} kind="face" alt="Visage" />}
                    {profile.palmPhotoUrl && <ExpertPrivatePhoto clientId={order.user.id} kind="palm" alt="Paume" />}
                  </div>
                </section>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-desk-subtle">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-desk-muted">{value}</p>
    </div>
  );
}
