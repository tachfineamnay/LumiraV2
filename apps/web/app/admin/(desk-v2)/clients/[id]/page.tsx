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
import { IncarnationPanel } from '@/components/desk-v2/clients/IncarnationPanel';
import { AkashicSummary } from '@/components/desk-v2/clients/AkashicSummary';
import { OrderTimeline } from '@/components/desk-v2/clients/OrderTimeline';
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
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          <p className="text-stellar-400">Chargement du dossier client...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-red-400">{error || 'Client non trouvé'}</p>
          <button
            onClick={() => router.push('/admin/clients')}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-stellar-100 transition-colors"
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
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          title="Retour à la liste"
          aria-label="Retour à la liste des clients"
        >
          <ArrowLeft className="w-5 h-5 text-stellar-400" />
        </button>
        <h1 className="text-xl font-semibold text-stellar-100">
          Dossier Confidentiel
        </h1>
        <button
          onClick={fetchClient}
          className="ml-auto p-2 hover:bg-white/5 rounded-lg transition-colors"
          title="Actualiser les données"
          aria-label="Actualiser les données"
        >
          <RefreshCw className="w-4 h-4 text-stellar-400" />
        </button>
      </div>

      {/* Identity Header */}
      <ClientIdentityHeader client={client} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_300px] gap-6">
        {/* Left Column - Incarnation */}
        <IncarnationPanel client={client} />

        {/* Center - Akashic Summary */}
        <AkashicSummary client={client} />

        {/* Right Column - Timeline */}
        <OrderTimeline client={client} onRefresh={fetchClient} />
      </div>
    </motion.div>
  );
}
