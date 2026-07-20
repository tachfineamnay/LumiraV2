'use client';

export const dynamic = 'force-dynamic';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ClipboardCheck,
  Clock3,
  Eye,
  FileLock2,
  Image as ImageIcon,
  MapPin,
  MessageSquareText,
  Pencil,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ReadingPreparation } from '../../../components/onboarding/ReadingPreparation';
import { SanctuairePrivatePhoto } from '../../../components/private-media/SanctuairePrivatePhoto';
import { useSanctuaireAuth } from '../../../context/SanctuaireAuthContext';

const ACTIVE_STATUSES = new Set(['PAID', 'PROCESSING', 'AWAITING_VALIDATION']);

type DraftRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pickField(
  sealed: boolean,
  profileValue: string | null | undefined,
  draftValue: string,
): string {
  if (sealed) return profileValue || draftValue;
  return draftValue || profileValue || '';
}

function SummaryCard({
  icon,
  title,
  status,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/[0.08] bg-abyss-600/50 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-horizon-400/10 text-horizon-300">
          {icon}
        </span>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-[11px] font-medium text-stellar-400">
          {status}
        </span>
      </div>
      <h2 className="mt-4 font-playfair text-xl italic text-stellar-100">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-stellar-400">{children}</div>
    </section>
  );
}

export default function ReadingDossierPage() {
  const { onboardingProgress, orders, profile, refetchData } = useSanctuaireAuth();
  const [showPreparation, setShowPreparation] = useState(false);

  const draft = (onboardingProgress?.data || {}) as DraftRecord;
  const latestOrder = useMemo(
    () =>
      [...orders].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )[0],
    [orders],
  );
  const sealed = profile?.profileCompleted === true;
  const productionActive =
    sealed && Boolean(latestOrder && ACTIVE_STATUSES.has(latestOrder.status));
  const delivered = latestOrder?.status === 'COMPLETED';

  const birthDate = pickField(sealed, profile?.birthDate, text(draft.birthDate));
  const birthTime = pickField(sealed, profile?.birthTime, text(draft.birthTime));
  const birthPlace = pickField(sealed, profile?.birthPlace, text(draft.birthPlace));
  const specificQuestion = pickField(
    sealed,
    profile?.specificQuestion,
    text(draft.specificQuestion),
  );
  const objective = pickField(sealed, profile?.objective, text(draft.objective));
  const facePhoto = pickField(
    sealed,
    profile?.facePhotoUrl,
    text(draft.facePhoto) || text(draft.facePhotoUrl),
  );
  const palmPhoto = pickField(
    sealed,
    profile?.palmPhotoUrl,
    text(draft.palmPhoto) || text(draft.palmPhotoUrl),
  );
  const contextCount = [
    pickField(sealed, profile?.highs, text(draft.highs)),
    pickField(sealed, profile?.lows, text(draft.lows)),
    pickField(sealed, profile?.ailments, text(draft.ailments)),
    pickField(sealed, profile?.fears, text(draft.fears)),
    pickField(sealed, profile?.rituals, text(draft.rituals)),
  ].filter(Boolean).length;

  return (
    <>
      {showPreparation && (
        <ReadingPreparation
          onCompleted={async () => {
            await refetchData();
          }}
          onClose={() => setShowPreparation(false)}
        />
      )}

      <div className="mx-auto w-full max-w-5xl px-4 py-8 pb-28 sm:px-6 sm:py-12 lg:pb-12">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-300">
            Ce que vous transmettez
          </p>
          <h1 className="mt-3 font-playfair text-3xl italic text-stellar-100 sm:text-4xl">
            Mon dossier de lecture
          </h1>
          <p className="mt-3 text-base leading-7 text-stellar-400">
            Cet espace sépare clairement votre profil général des éléments que vous choisissez pour
            construire votre lecture de base.
          </p>
        </header>

        <section
          className={`mt-8 overflow-hidden rounded-3xl border p-5 sm:p-7 ${
            sealed
              ? 'border-emerald-400/20 bg-emerald-400/[0.055]'
              : 'border-horizon-400/20 bg-horizon-400/[0.055]'
          }`}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                  sealed
                    ? 'bg-emerald-400/15 text-emerald-300'
                    : 'bg-horizon-400/15 text-horizon-300'
                }`}
              >
                {sealed ? (
                  <FileLock2 className="h-6 w-6" />
                ) : (
                  <ClipboardCheck className="h-6 w-6" />
                )}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stellar-500">
                  {sealed ? 'Dossier scellé' : 'Brouillon privé'}
                </p>
                <h2 className="mt-2 font-playfair text-2xl italic text-stellar-100">
                  {sealed
                    ? productionActive
                      ? 'Les éléments transmis sont protégés pendant la production'
                      : 'Votre transmission de base est enregistrée'
                    : 'Vous pouvez encore tout modifier'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stellar-400">
                  {sealed
                    ? delivered
                      ? 'La lecture déjà livrée reste liée à l’instantané que vous avez confirmé. Les changements futurs de profil ne modifieront pas cette lecture.'
                      : 'L’IA et l’expert travaillent à partir de l’instantané que vous avez relu et confirmé. Il ne peut plus être remplacé silencieusement.'
                    : 'Rien n’est transmis à la production tant que vous n’avez pas relu puis scellé le dossier.'}
                </p>
              </div>
            </div>

            {!sealed ? (
              <button
                type="button"
                onClick={() => setShowPreparation(true)}
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300"
              >
                <Pencil className="h-4 w-4" />
                {onboardingProgress?.status === 'IN_PROGRESS'
                  ? 'Reprendre et modifier'
                  : 'Préparer mon dossier'}
              </button>
            ) : delivered ? (
              <Link
                href="/sanctuaire/profile"
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-stellar-200 hover:bg-white/[0.05]"
              >
                Gérer mon profil
              </Link>
            ) : null}
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SummaryCard
            icon={<CalendarDays className="h-5 w-5" />}
            title="Repères essentiels"
            status={birthDate && birthPlace ? 'Renseignés' : 'À compléter'}
          >
            <div className="space-y-2">
              <p className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-stellar-600" />
                {birthDate || 'Date non renseignée'}
              </p>
              <p className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-stellar-600" />
                {birthTime || 'Heure non transmise — facultative'}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-stellar-600" />
                {birthPlace || 'Lieu non renseigné'}
              </p>
            </div>
          </SummaryCard>

          <SummaryCard
            icon={<MessageSquareText className="h-5 w-5" />}
            title="Intention"
            status={specificQuestion || objective ? 'Transmise' : 'Non transmise'}
          >
            {specificQuestion || objective ? (
              <div className="space-y-2">
                {specificQuestion && <p>« {specificQuestion} »</p>}
                {objective && <p>Objectif : {objective}</p>}
              </div>
            ) : (
              <p>Vous avez choisi de ne transmettre aucune question particulière.</p>
            )}
          </SummaryCard>

          <SummaryCard
            icon={<ImageIcon className="h-5 w-5" />}
            title="Photos privées"
            status={facePhoto || palmPhoto ? 'Sélectionnées' : 'Aucune'}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                {facePhoto ? (
                  <SanctuairePrivatePhoto kind="face" alt="Photo de visage privée" />
                ) : (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center p-4">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                    <p className="mt-2 text-sm text-stellar-300">Visage</p>
                    <p className="mt-1 text-xs text-stellar-500">Non transmis</p>
                  </div>
                )}
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                {palmPhoto ? (
                  <SanctuairePrivatePhoto kind="palm" alt="Photo de paume privée" />
                ) : (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center p-4">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                    <p className="mt-2 text-sm text-stellar-300">Paume</p>
                    <p className="mt-1 text-xs text-stellar-500">Non transmise</p>
                  </div>
                )}
              </div>
            </div>
          </SummaryCard>

          <SummaryCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Contexte facultatif"
            status={
              contextCount ? `${contextCount} élément${contextCount > 1 ? 's' : ''}` : 'Aucun'
            }
          >
            {contextCount ? (
              <p>
                Vous avez choisi de transmettre {contextCount} élément{contextCount > 1 ? 's' : ''}{' '}
                de contexte pour personnaliser la lecture.
              </p>
            ) : (
              <p>Aucun contexte intime supplémentaire n’a été transmis.</p>
            )}
          </SummaryCard>
        </div>

        <section className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Eye className="mt-0.5 h-5 w-5 shrink-0 text-horizon-300" />
            <div>
              <h2 className="text-sm font-medium text-stellar-100">Principe de contrôle</h2>
              <p className="mt-2 text-sm leading-6 text-stellar-500">
                Le brouillon est modifiable. Le scellement crée l’instantané utilisé pour cette
                lecture. Votre profil personnel pourra ensuite évoluer sans réécrire rétroactivement
                ce que vous aviez transmis.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
