'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import { ClientIdentityHeader } from '@/components/desk-v2/clients/ClientIdentityHeader';
import { ClientTabs } from '@/components/desk-v2/clients/ClientTabs';
import { ClientFullData } from '@/components/desk-v2/clients/types';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientFullData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data } = await api.get(`/expert/clients/${clientId}/full`);
      setClient(data);
    } catch (err) {
      console.error('Failed to fetch client:', err);
      setError('Impossible de charger les données du client');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          <p className="text-desk-muted">Chargement du dossier client...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-600" />
          <p className="text-red-600">{error || 'Client non trouvé'}</p>
          <button
            onClick={() => router.push('/admin/clients')}
            className="px-4 py-2 bg-desk-hover hover:bg-desk-card rounded-lg text-desk-text transition-colors"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6"
    >
      {/* Back navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/clients')}
          className="p-2 hover:bg-desk-hover rounded-lg transition-colors"
          title="Retour à la liste"
          aria-label="Retour à la liste des clients"
        >
          <ArrowLeft className="w-5 h-5 text-desk-muted" />
        </button>
        <h1 className="text-xl font-semibold text-desk-text">
          Dossier d&apos;Âme
        </h1>
        <button
          onClick={fetchClient}
          className="ml-auto p-2 hover:bg-desk-hover rounded-lg transition-colors"
          title="Actualiser les données"
          aria-label="Actualiser les données"
        >
          <RefreshCw className="w-4 h-4 text-desk-muted" />
        </button>
      </div>

      {/* Identity Header with KPIs */}
      <ClientIdentityHeader client={client} />

      {/* Tabbed Content */}
      <ClientTabs client={client} onRefresh={fetchClient} />
    </motion.div>
  );
}
