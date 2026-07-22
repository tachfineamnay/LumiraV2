'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ReadingPdfViewer } from '../../../../components/sanctuary/ReadingPdfViewer';
import { useSanctuaireAuth } from '../../../../context/SanctuaireAuthContext';
import sanctuaireApi from '../../../../lib/sanctuaireApi';

type ReadingMeta = {
  orderNumber: string;
  title: string;
  assets: { pdf?: string | null };
};

export default function SanctuaireLecturePage() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = decodeURIComponent(params.orderNumber || '');
  const { isLoading: authLoading, isAuthenticated } = useSanctuaireAuth();
  const [title, setTitle] = useState('Votre lecture');
  const [missing, setMissing] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !orderNumber) return;

    let cancelled = false;
    const load = async () => {
      setLoadingMeta(true);
      try {
        const { data } = await sanctuaireApi.get('/client/readings');
        const readings = (data.readings || []) as ReadingMeta[];
        const match = readings.find((r) => r.orderNumber === orderNumber);
        if (!match?.assets?.pdf) {
          if (!cancelled) setMissing(true);
          return;
        }
        if (!cancelled) {
          setTitle(match.title || 'Votre lecture');
          setMissing(false);
        }
      } catch {
        if (!cancelled) setMissing(true);
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, orderNumber]);

  if (authLoading || loadingMeta) {
    return (
      <div className="flex min-h-[50vh] bg-brume-800/20 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ivoire-200" />
      </div>
    );
  }

  if (!isAuthenticated || missing || !orderNumber) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-playfair text-2xl italic text-ivoire-100">Lecture introuvable</p>
        <p className="mt-3 text-sm text-brume-200">
          Cette lecture n’est pas disponible depuis votre Sanctuaire pour le moment.
        </p>
        <Link
          href="/sanctuaire"
          className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-brume-800/20 px-5 py-3 text-sm font-semibold text-ivoire-100"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au Sanctuaire
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-10">
      <Link
        href="/sanctuaire"
        className="mb-4 inline-flex min-h-[40px] items-center gap-2 text-sm text-brume-200 hover:text-ivoire-400"
      >
        <ArrowLeft className="h-4 w-4" /> Retour au Sanctuaire
      </Link>
      <ReadingPdfViewer orderNumber={orderNumber} title={title} />
    </div>
  );
}
