'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { Lock, Download, Trash2, AlertTriangle, Mail } from 'lucide-react';
import { GlassCard } from '../../../../components/ui/GlassCard';

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl sm:text-2xl font-playfair italic text-ivoire-100">
          Sécurité & Confidentialité
        </h2>
        <p className="text-brume-200 text-sm mt-1">
          Protégez votre compte et vos données personnelles.
        </p>
      </div>

      <GlassCard className="p-5 sm:p-8">
        <h3 className="text-lg font-playfair text-ivoire-100 mb-2 flex items-center gap-2">
          <Lock className="w-5 h-5 text-ivoire-400" /> Connexion sécurisée
        </h3>
        <p className="text-brume-200 text-sm mb-4">
          Votre accès est protégé par un lien de connexion personnel, à usage unique. Aucun mot de
          passe n&apos;est conservé dans le Sanctuaire.
        </p>
      </GlassCard>

      <GlassCard className="p-5 sm:p-8">
        <h3 className="text-lg font-playfair text-ivoire-100 mb-2 flex items-center gap-2">
          <Download className="w-5 h-5 text-purple-400" /> Mes Données (RGPD)
        </h3>
        <p className="text-brume-200 text-sm mb-4">
          Vous pouvez demander un export de vos données personnelles directement à l&apos;équipe.
        </p>
        <a
          href="mailto:contact@oraclelumira.com?subject=Demande%20d%27export%20de%20mes%20donn%C3%A9es%20Lumira"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-2.5 text-sm text-purple-200 hover:bg-purple-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
        >
          <Download className="w-4 h-4" />
          Demander mon export
        </a>
      </GlassCard>

      <div className="p-5 sm:p-8 rounded-2xl border border-rose-500/20 bg-rose-500/5">
        <h3 className="text-lg font-playfair text-rose-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Zone de danger
        </h3>
        <p className="text-rose-300/60 text-sm mb-4">
          La suppression nécessite une vérification par l&apos;équipe pour protéger votre dossier et
          vos contenus privés.
        </p>
        <a
          href="mailto:contact@oraclelumira.com?subject=Demande%20de%20suppression%20de%20mon%20compte%20Lumira"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
        >
          <Trash2 className="w-4 h-4" />
          Demander la suppression de mon compte
        </a>
        <p className="mt-3 flex items-center gap-2 text-xs text-rose-200/70">
          <Mail className="h-3.5 w-3.5" /> Une réponse de l&apos;équipe est nécessaire avant toute
          suppression.
        </p>
      </div>
    </div>
  );
}
