'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { Lock, Download, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { GlassCard } from '../../../../components/ui/GlassCard';

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl sm:text-2xl font-playfair italic text-white">
          Sécurité & Confidentialité
        </h2>
        <p className="text-stellar-400 text-sm mt-1">
          Protégez votre compte et vos données personnelles.
        </p>
      </div>

      <GlassCard className="p-5 sm:p-8">
        <h3 className="text-lg font-playfair text-white mb-2 flex items-center gap-2">
          <Lock className="w-5 h-5 text-horizon-400" /> Mot de passe
        </h3>
        <p className="text-stellar-400 text-sm mb-4">
          La modification du mot de passe depuis le Sanctuaire arrive bientôt.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-stellar-500 text-sm">
          <Clock className="w-4 h-4" />
          Bientôt disponible
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-8">
        <h3 className="text-lg font-playfair text-white mb-2 flex items-center gap-2">
          <Download className="w-5 h-5 text-purple-400" /> Mes Données (RGPD)
        </h3>
        <p className="text-stellar-400 text-sm mb-4">
          L&apos;export de vos données personnelles sera disponible prochainement. Contactez le
          support pour une demande urgente.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300/70 text-sm">
          <Clock className="w-4 h-4" />
          Bientôt disponible
        </div>
      </GlassCard>

      <div className="p-5 sm:p-8 rounded-2xl border border-rose-500/20 bg-rose-500/5">
        <h3 className="text-lg font-playfair text-rose-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Zone de danger
        </h3>
        <p className="text-rose-300/60 text-sm mb-4">
          La suppression de compte en libre-service n&apos;est pas encore active. Écrivez-nous pour
          une demande de suppression.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400/70 text-sm">
          <Trash2 className="w-4 h-4" />
          Bientôt disponible
        </div>
      </div>
    </div>
  );
}
