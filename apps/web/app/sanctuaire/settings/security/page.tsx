'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { Lock, Download, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { PaperPanel } from '../../../../components/sanctuary/SanctuaireStage';

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-xl italic text-paper-ink sm:text-2xl">
          Sécurité & Confidentialité
        </h2>
        <p className="mt-1 text-sm text-paper-subtle">
          Protégez votre compte et vos données personnelles.
        </p>
      </div>

      <PaperPanel>
        <h3 className="mb-2 flex items-center gap-2 font-playfair text-lg text-paper-ink">
          <Lock className="h-5 w-5 text-horizon-500" /> Accès à votre compte
        </h3>
        <p className="mb-4 text-sm text-paper-subtle">
          L’accès Sanctuaire se fait par lien magique e-mail. Aucun mot de passe client n’est
          requis.
        </p>
        <div className="inline-flex items-center gap-2 rounded-xl border border-paper-line bg-paper-muted px-4 py-2.5 text-sm text-paper-subtle">
          <Clock className="h-4 w-4" />
          Lien magique actif
        </div>
      </PaperPanel>

      <PaperPanel>
        <h3 className="mb-2 flex items-center gap-2 font-playfair text-lg text-paper-ink">
          <Download className="h-5 w-5 text-serenity-500" /> Mes Données (RGPD)
        </h3>
        <p className="mb-4 text-sm text-paper-subtle">
          L&apos;export de vos données personnelles sera disponible prochainement. Contactez le
          support pour une demande urgente.
        </p>
        <div className="inline-flex items-center gap-2 rounded-xl border border-serenity-400/30 bg-serenity-200/20 px-4 py-2.5 text-sm text-serenity-600">
          <Clock className="h-4 w-4" />
          Bientôt disponible
        </div>
      </PaperPanel>

      <div className="rounded-2xl border border-rose-400/30 bg-rose-50 p-5 sm:p-6">
        <h3 className="mb-2 flex items-center gap-2 font-playfair text-lg text-rose-700">
          <AlertTriangle className="h-5 w-5" /> Zone de danger
        </h3>
        <p className="mb-4 text-sm text-rose-700/80">
          La suppression de compte en libre-service n&apos;est pas encore active. Écrivez-nous pour
          une demande de suppression.
        </p>
        <div className="inline-flex items-center gap-2 rounded-xl border border-rose-300/50 bg-white/60 px-4 py-2.5 text-sm text-rose-700">
          <Trash2 className="h-4 w-4" />
          Bientôt disponible
        </div>
      </div>
    </div>
  );
}
