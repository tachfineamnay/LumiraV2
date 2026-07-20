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
  SlidersHorizontal,
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

function deliveryStyleLabel(value: string): string {
  if (value === 'DIRECT_ET_CONCRET') return 'Directe et concrète';
  if (value === 'SYMBOLIQUE_ET_PROFOND') return 'Symbolique et profonde';
  return 'Douce et claire';
}

function paceLabel(value: number): string {
  if (value >= 70) return 'Lecture soutenue et approfondie';
  if (value <= 30) return 'Lecture progressive et très posée';
  return 'Lecture équilibrée';
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-white/[0.06] py-4 first:border-t-0 first:pt-0 last:pb-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stellar-500">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stellar-300">{value}</p>
    </div>
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
  const deliveryStyle = pickField(
    sealed,
    profile?.deliveryStyle,
    text(draft.deliveryStyle) || 'DOUX_ET_CLAIR',
  );
  const rawPace = sealed ? profile?.pace : draft.pace ?? profile?.pace;
  const pace = typeof rawPace === 'number' ? rawPace : 50;

  const contextFields = [
    {
      label: 'Ce qui vous porte',
      value: pickField(sealed, profile?.highs, text(draft.highs)),
    },
    {
      label: 'Ce qui vous freine',
      value: pickField(sealed, profile?.lows, text(draft.lows)),
    },
    {
      label: 'Contexte corporel déclaré',
      value: pickField(sealed, profile?.ailments, text(draft.ailments)),
    },
    {
      label: 'Peurs ou blocages identifiés',
      value: pickField(sealed, profile?.fears, text(draft.fears)),
    },
    {
      label: 'Pratiques ou rituels actuels',
      value: pickField(sealed, profile?.rituals, text(draft.rituals)),
    },
  ].filter((field) => Boolean(field.value));

  const draftProgress = Math.min(
    100,
    Math.round((((onboardingProgress?.currentStep ?? 0) + 1) / 6) * 100),
  );

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
            Votre transmission
          </p>
          <h1 className="mt-3 font-playfair text-3xl italic text-stellar-100 sm:text-4xl">
            Mon dossier de lecture
          </h1>
          <p className="mt-3 text-base leading-7 text-stellar-400">
            Retrouvez ici les éléments que vous avez choisis pour préparer votre lecture.
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
                  {sealed ? 'Version confirmée' : 'Brouillon privé'}
                </p>
                <h2 className="mt-2 font-playfair text-2xl italic text-stellar-100">
                  {sealed
                    ? productionActive
                      ? 'Votre dossier est utilisé pour préparer la lecture'
                      : delivered
                        ? 'Les éléments de cette lecture restent consultables'
                        : 'Votre dossier est enregistré'
                    : 'Vous pouvez encore tout relire et modifier'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stellar-400">
                  {sealed
                    ? delivered
                      ? 'Cette lecture reste liée aux éléments que vous aviez confirmés au moment de sa préparation.'
                      : 'L’équipe travaille uniquement à partir de la version que vous avez relue et confirmée.'
                    : 'Votre brouillon est sauvegardé automatiquement. Il ne sera transmis à la production qu’après votre confirmation finale.'}
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
                  ? 'Continuer mon dossier'
                  : 'Préparer mon dossier'}
              </button>
            ) : delivered ? (
              <Link
                href="/sanctuaire/draws"
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-stellar-200 hover:bg-white/[0.05]"
              >
                Voir ma lecture
              </Link>
            ) : null}
          </div>

          {!sealed && (
            <div className="mt-6 max-w-xl" aria-label={`Brouillon complété à ${draftProgress}%`}>
              <div className="flex justify-between text-xs text-stellar-500">
                <span>Progression du brouillon</span>
                <span>{draftProgress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-horizon-400"
                  style={{ width: `${draftProgress}%` }}
                />
              </div>
            </div>
          )}
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
            title="Votre intention"
            status={specificQuestion || objective ? 'Transmise' : 'Facultative'}
          >
            {specificQuestion || objective ? (
              <div className="space-y-3">
                {specificQuestion && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-stellar-500">Question</p>
                    <p className="mt-1 text-stellar-300">« {specificQuestion} »</p>
                  </div>
                )}
                {objective && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-stellar-500">Objectif</p>
                    <p className="mt-1 text-stellar-300">{objective}</p>
                  </div>
                )}
              </div>
            ) : (
              <p>Vous avez choisi de ne transmettre aucune question particulière.</p>
            )}
          </SummaryCard>

          <SummaryCard
            icon={<ImageIcon className="h-5 w-5" />}
            title="Photos privées"
            status={facePhoto || palmPhoto ? 'Sélectionnées' : 'Facultatives'}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                {facePhoto ? (
                  <SanctuairePrivatePhoto kind="face" alt="Photo de visage privée" />
                ) : (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center p-4 text-center">
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
                  <div className="flex aspect-[4/3] flex-col items-center justify-center p-4 text-center">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                    <p className="mt-2 text-sm text-stellar-300">Paume</p>
                    <p className="mt-1 text-xs text-stellar-500">Non transmise</p>
                  </div>
                )}
              </div>
            </div>
          </SummaryCard>

          <SummaryCard
            icon={<SlidersHorizontal className="h-5 w-5" />}
            title="Préférences de lecture"
            status="Enregistrées"
          >
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-stellar-500">Style</p>
                <p className="mt-1 text-stellar-300">{deliveryStyleLabel(deliveryStyle)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-stellar-500">Rythme</p>
                <p className="mt-1 text-stellar-300">{paceLabel(pace)}</p>
              </div>
            </div>
          </SummaryCard>
        </div>

        <section className="mt-6 rounded-3xl border border-white/[0.08] bg-abyss-600/50 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-horizon-400/10 text-horizon-300">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-[11px] font-medium text-stellar-400">
              {contextFields.length
                ? `${contextFields.length} élément${contextFields.length > 1 ? 's' : ''}`
                : 'Facultatif'}
            </span>
          </div>
          <h2 className="mt-4 font-playfair text-xl italic text-stellar-100">Contexte personnel</h2>
          {contextFields.length ? (
            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
              {contextFields.map((field) => (
                <DetailRow key={field.label} label={field.label} value={field.value} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-7 text-stellar-400">
              Aucun contexte intime supplémentaire n’a été transmis.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Eye className="mt-0.5 h-5 w-5 shrink-0 text-horizon-300" />
            <div>
              <h2 className="text-sm font-medium text-stellar-100">Vous gardez le contrôle</h2>
              <p className="mt-2 text-sm leading-6 text-stellar-500">
                Le brouillon reste modifiable jusqu’à votre confirmation. Une fois le dossier scellé,
                la version confirmée reste liée à cette lecture et ne change pas silencieusement.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
