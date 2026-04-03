'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Calendar,
  ShoppingBag,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';

interface Client {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  _count?: {
    orders: number;
  };
  profile?: {
    id: string;
  } | null;
}

interface PaginatedResponse {
  data: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        ...(searchQuery && { search: searchQuery }),
      });
      const { data } = await api.get<PaginatedResponse>(`/expert/clients?${params}`);
      setClients(data.data || []);
      setTotalPages(data.totalPages);
      setTotalClients(data.total);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Debounced search - reset page on query change (fetchClients re-runs via useCallback dep)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-purple-400" />
            Clients
          </h1>
          <p className="text-slate-400 mt-1">
            {totalClients} client{totalClients > 1 ? 's' : ''} au total
          </p>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl
                       bg-slate-800/50 border border-white/10
                       text-white placeholder:text-slate-500
                       focus:outline-none focus:border-purple-500/50
                       transition-colors"
          />
        </div>
        
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                           bg-slate-800/50 border border-white/10
                           text-slate-400 hover:text-white transition-colors">
          <Filter className="w-4 h-4" />
          <span>Filtres</span>
        </button>
      </motion.div>

      {/* Clients Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-900/50 rounded-xl border border-white/5 overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Users className="w-16 h-16 text-slate-600 mb-4" />
            <p className="text-slate-400">Aucun client trouvé</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Inscrit le
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Commandes
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total dépensé
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Dernier niveau
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, index) => {
                const ordersCount = client._count?.orders || 0;
                
                return (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600
                                        flex items-center justify-center text-sm font-bold text-white">
                          {client.firstName?.[0] || '?'}{client.lastName?.[0] || ''}
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {client.firstName || 'Sans nom'} {client.lastName || ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm">{client.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">
                          {new Date(client.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800">
                        <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-sm text-white font-medium">{ordersCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-slate-400">—</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-slate-600">—</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/admin/clients/${client.id}`)}
                        title="Voir le profil"
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg
                                   hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between"
        >
          <p className="text-sm text-slate-500">
            Page {page} sur {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg
                         bg-slate-800/50 border border-white/10
                         text-slate-400 hover:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Précédent</span>
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-lg
                         bg-slate-800/50 border border-white/10
                         text-slate-400 hover:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              <span>Suivant</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
