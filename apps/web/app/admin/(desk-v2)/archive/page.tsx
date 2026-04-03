'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Archive,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  CheckCircle,
  FileText,
  ExternalLink,
  Loader2,
  Download,
} from 'lucide-react';
import api from '@/lib/api';
import { LEVEL_CONFIG } from '@/components/desk-v2/types';

interface ArchivedOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  completedAt: string;
  level: number;
  amount: number;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface PaginatedResponse {
  orders: ArchivedOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function ArchivePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ArchivedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        status: 'COMPLETED',
        ...(searchQuery && { search: searchQuery }),
      });
      const { data } = await api.get<PaginatedResponse>(`/expert/orders/archive?${params}`);
      setOrders(data.orders);
      setTotalPages(data.totalPages);
      setTotalOrders(data.total);
    } catch (error) {
      console.error('Failed to fetch archived orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Debounced search - reset page on query change (fetchOrders re-runs via useCallback dep)
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
            <Archive className="w-7 h-7 text-emerald-400" />
            Archives
          </h1>
          <p className="text-slate-400 mt-1">
            {totalOrders} commande{totalOrders > 1 ? 's' : ''} terminée{totalOrders > 1 ? 's' : ''}
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
            placeholder="Rechercher par numéro ou client..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl
                       bg-slate-800/50 border border-white/10
                       text-white placeholder:text-slate-500
                       focus:outline-none focus:border-emerald-500/50
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

      {/* Orders Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/50 rounded-xl border border-white/5">
            <Archive className="w-16 h-16 text-slate-600 mb-4" />
            <p className="text-slate-400">Aucune commande archivée</p>
          </div>
        ) : (
          orders.map((order, index) => {
            const levelConfig = LEVEL_CONFIG[order.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG[1];
            
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-slate-900/50 border border-white/5 rounded-xl p-4
                           hover:bg-slate-900/70 hover:border-white/10 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Status badge */}
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20
                                    flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    
                    {/* Order info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400 font-medium">
                          {order.orderNumber}
                        </span>
                        <span className="text-lg">{levelConfig.icon}</span>
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                          {levelConfig.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {order.user.firstName} {order.user.lastName}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span>{order.user.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right side info */}
                  <div className="flex items-center gap-6">
                    {/* Dates */}
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Créée le {new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Livrée le {new Date(order.completedAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right min-w-[80px]">
                      <span className="text-lg font-semibold text-white">
                        {(order.amount / 100).toFixed(0)}€
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                          window.open(`${apiBase}/api/readings/${order.orderNumber}/download`, '_blank');
                        }}
                        title="Télécharger le PDF"
                        className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => router.push(`/admin/studio/${order.id}`)}
                        title="Voir les détails"
                        className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
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
