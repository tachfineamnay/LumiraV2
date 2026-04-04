'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Mail,
  Calendar,
  ShoppingBag,
  ExternalLink,
  Loader2,
  TrendingUp,
  CreditCard,
  DollarSign,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface Client {
  id: string;
  refId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  subscriptionStatus: string;
  totalOrders: number;
  totalSpent: number;
  lastLevel: string | null;
  lastOrderAt: string | null;
  tags: string[];
  source: string | null;
  createdAt: string;
  profile: { id: string; profileCompleted: boolean } | null;
  subscription: { status: string; currentPeriodEnd: string } | null;
}

interface PaginatedResponse {
  data: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ClientsStats {
  totalClients: number;
  activeSubscriptions: number;
  newThisMonth: number;
  totalRevenue: number;
}

interface Filters {
  status: string;
  subscriptionStatus: string;
  hasOrders: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: string;
}

const DEFAULT_FILTERS: Filters = {
  status: '',
  subscriptionStatus: '',
  hasOrders: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

const SUBSCRIPTION_BADGES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Actif', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  INACTIVE: { label: 'Inactif', className: 'bg-slate-500/15 text-slate-600 border-slate-500/30' },
  TRIAL: { label: 'Essai', className: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  PAST_DUE: { label: 'Impayé', className: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  CANCELED: { label: 'Annulé', className: 'bg-red-500/15 text-red-600 border-red-500/30' },
  EXPIRED: { label: 'Expiré', className: 'bg-red-500/15 text-red-600 border-red-500/30' },
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Actif', className: 'bg-emerald-500/15 text-emerald-600' },
  BANNED: { label: 'Banni', className: 'bg-red-500/15 text-red-600' },
  SUSPENDED: { label: 'Suspendu', className: 'bg-orange-500/15 text-orange-600' },
};

// =============================================================================
// COMPONENTS
// =============================================================================

function StatCard({
  icon,
  label,
  value,
  gradient,
  iconColor,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  gradient: string;
  iconColor: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative overflow-hidden rounded-xl border border-desk-border bg-desk-surface backdrop-blur-sm p-5"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5`} />
      <div className="relative flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-desk-muted">{label}</p>
          <p className="text-2xl font-bold text-desk-text">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
        active
          ? 'bg-purple-500/20 text-purple-600 border-purple-500/40'
          : 'bg-desk-card text-desk-muted border-desk-border hover:border-desk-border hover:text-desk-text'
      )}
    >
      {label}
    </button>
  );
}

function SortableHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
  align = 'left',
}: {
  label: string;
  field: string;
  currentSort: string;
  currentOrder: string;
  onSort: (field: string) => void;
  align?: 'left' | 'center' | 'right';
}) {
  const isActive = currentSort === field;
  const alignClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

  return (
    <th
      className={cn(
        'px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
        isActive ? 'text-purple-600' : 'text-desk-subtle hover:text-desk-text'
      )}
      onClick={() => onSort(field)}
    >
      <div className={cn('flex items-center gap-1', alignClass)}>
        <span>{label}</span>
        {isActive ? (
          currentOrder === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        )}
      </div>
    </th>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [stats, setStats] = useState<ClientsStats | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch stats on mount
  useEffect(() => {
    api.get<ClientsStats>('/expert/clients/stats')
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, []);

  // Fetch clients
  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.status) params.set('status', filters.status);
      if (filters.subscriptionStatus) params.set('subscriptionStatus', filters.subscriptionStatus);
      if (filters.hasOrders) params.set('hasOrders', filters.hasOrders);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

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
  }, [page, pageSize, debouncedSearch, filters]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.subscriptionStatus) count++;
    if (filters.hasOrders) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    return count;
  }, [filters]);

  const handleSort = (field: string) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
    setPage(1);
  };

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }));
    setPage(1);
  };

  // Pagination range display
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalClients);

  // Page numbers
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-desk-text flex items-center gap-3">
          <Users className="w-7 h-7 text-purple-600" />
          Clients
        </h1>
        <p className="text-desk-muted mt-1">
          Gestion et suivi de vos clients
        </p>
      </motion.div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-6 h-6" />}
            label="Total Clients"
            value={stats.totalClients}
            gradient="from-purple-500/20 to-violet-600/20"
            iconColor="text-purple-600"
            delay={0}
          />
          <StatCard
            icon={<CreditCard className="w-6 h-6" />}
            label="Abonnements Actifs"
            value={stats.activeSubscriptions}
            gradient="from-emerald-500/20 to-teal-600/20"
            iconColor="text-emerald-600"
            delay={0.05}
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="Nouveaux ce mois"
            value={stats.newThisMonth}
            gradient="from-blue-500/20 to-indigo-600/20"
            iconColor="text-blue-600"
            delay={0.1}
          />
          <StatCard
            icon={<DollarSign className="w-6 h-6" />}
            label="Revenu Total"
            value={formatCurrency(stats.totalRevenue)}
            gradient="from-amber-500/20 to-orange-600/20"
            iconColor="text-amber-600"
            delay={0.15}
          />
        </div>
      )}

      {/* Search & Filter Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-3"
      >
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-desk-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, email ou réf..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-desk-card border border-desk-border
                       text-desk-text placeholder:text-desk-subtle focus:outline-none focus:border-purple-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-desk-subtle hover:text-desk-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors',
            showFilters || activeFilterCount > 0
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-600'
              : 'bg-desk-card border-desk-border text-desk-muted hover:text-desk-text'
          )}
        >
          <Filter className="w-4 h-4" />
          <span>Filtres</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Page size selector */}
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="px-3 py-2.5 rounded-xl bg-desk-card border border-desk-border
                     text-desk-text text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
        >
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </motion.div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-xl bg-desk-surface border border-desk-border space-y-5">
              {/* Row 1: Status filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* User Status */}
                <div>
                  <label className="block text-xs font-semibold text-desk-subtle uppercase tracking-wider mb-2">
                    Statut Client
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <FilterPill label="Tous" active={!filters.status} onClick={() => setFilters((p) => ({ ...p, status: '' }))} />
                    <FilterPill label="Actif" active={filters.status === 'ACTIVE'} onClick={() => updateFilter('status', 'ACTIVE')} />
                    <FilterPill label="Banni" active={filters.status === 'BANNED'} onClick={() => updateFilter('status', 'BANNED')} />
                    <FilterPill label="Suspendu" active={filters.status === 'SUSPENDED'} onClick={() => updateFilter('status', 'SUSPENDED')} />
                  </div>
                </div>

                {/* Subscription Status */}
                <div>
                  <label className="block text-xs font-semibold text-desk-subtle uppercase tracking-wider mb-2">
                    Abonnement
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <FilterPill label="Tous" active={!filters.subscriptionStatus} onClick={() => setFilters((p) => ({ ...p, subscriptionStatus: '' }))} />
                    <FilterPill label="Actif" active={filters.subscriptionStatus === 'ACTIVE'} onClick={() => updateFilter('subscriptionStatus', 'ACTIVE')} />
                    <FilterPill label="Inactif" active={filters.subscriptionStatus === 'INACTIVE'} onClick={() => updateFilter('subscriptionStatus', 'INACTIVE')} />
                    <FilterPill label="Annulé" active={filters.subscriptionStatus === 'CANCELED'} onClick={() => updateFilter('subscriptionStatus', 'CANCELED')} />
                    <FilterPill label="Impayé" active={filters.subscriptionStatus === 'PAST_DUE'} onClick={() => updateFilter('subscriptionStatus', 'PAST_DUE')} />
                  </div>
                </div>

                {/* Has Orders */}
                <div>
                  <label className="block text-xs font-semibold text-desk-subtle uppercase tracking-wider mb-2">
                    Commandes
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <FilterPill label="Tous" active={!filters.hasOrders} onClick={() => setFilters((p) => ({ ...p, hasOrders: '' }))} />
                    <FilterPill label="Avec commandes" active={filters.hasOrders === 'true'} onClick={() => updateFilter('hasOrders', 'true')} />
                    <FilterPill label="Sans commandes" active={filters.hasOrders === 'false'} onClick={() => updateFilter('hasOrders', 'false')} />
                  </div>
                </div>
              </div>

              {/* Row 2: Date range + reset */}
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <label className="block text-xs font-semibold text-desk-subtle uppercase tracking-wider mb-2">
                    Inscrit du
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => { setFilters((p) => ({ ...p, dateFrom: e.target.value })); setPage(1); }}
                    className="px-3 py-2 rounded-lg bg-desk-card border border-desk-border text-desk-text text-sm
                               focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-desk-subtle uppercase tracking-wider mb-2">
                    Au
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => { setFilters((p) => ({ ...p, dateTo: e.target.value })); setPage(1); }}
                    className="px-3 py-2 rounded-lg bg-desk-card border border-desk-border text-desk-text text-sm
                               focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>

                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                               text-desk-muted hover:text-desk-text transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-desk-subtle">
        <span>
          {totalClients > 0
            ? `Affichage ${rangeStart}-${rangeEnd} sur ${totalClients} client${totalClients > 1 ? 's' : ''}`
            : 'Aucun résultat'}
        </span>
        {activeFilterCount > 0 && (
          <span className="text-purple-600">{activeFilterCount} filtre{activeFilterCount > 1 ? 's' : ''} actif{activeFilterCount > 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Clients Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-desk-surface rounded-xl border border-desk-border overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Users className="w-16 h-16 text-desk-subtle mb-4" />
            <p className="text-desk-muted">Aucun client trouvé</p>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="mt-2 text-sm text-purple-600 hover:text-purple-500 transition-colors">
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-desk-border">
                  <SortableHeader
                    label="Client"
                    field="firstName"
                    currentSort={filters.sortBy}
                    currentOrder={filters.sortOrder}
                    onSort={handleSort}
                  />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-desk-subtle uppercase tracking-wider">
                    Email
                  </th>
                  <SortableHeader
                    label="Inscrit le"
                    field="createdAt"
                    currentSort={filters.sortBy}
                    currentOrder={filters.sortOrder}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Commandes"
                    field="totalOrders"
                    currentSort={filters.sortBy}
                    currentOrder={filters.sortOrder}
                    onSort={handleSort}
                    align="center"
                  />
                  <SortableHeader
                    label="Total dépensé"
                    field="totalSpent"
                    currentSort={filters.sortBy}
                    currentOrder={filters.sortOrder}
                    onSort={handleSort}
                    align="right"
                  />
                  <th className="text-center px-4 py-3 text-xs font-semibold text-desk-subtle uppercase tracking-wider">
                    Abonnement
                  </th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {clients.map((client, index) => {
                  const subBadge = SUBSCRIPTION_BADGES[client.subscriptionStatus] || SUBSCRIPTION_BADGES.INACTIVE;
                  const ordersBadgeColor =
                    client.totalOrders === 0
                      ? 'bg-desk-card text-desk-subtle'
                      : client.totalOrders <= 2
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-amber-500/10 text-amber-600';

                  return (
                    <motion.tr
                      key={client.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => router.push(`/admin/clients/${client.id}`)}
                      className="border-b border-desk-border hover:bg-desk-card transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600
                                          flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {client.firstName?.[0]?.toUpperCase() || '?'}{client.lastName?.[0]?.toUpperCase() || ''}
                          </div>
                          <div className="min-w-0">
                            <p className="text-desk-text font-medium truncate">
                              {client.firstName || 'Sans nom'} {client.lastName || ''}
                            </p>
                            {client.refId && (
                              <p className="text-[11px] text-desk-subtle font-mono">{client.refId}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-desk-muted">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-sm truncate max-w-[200px]">{client.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-desk-muted">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-sm whitespace-nowrap">
                            {new Date(client.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium', ordersBadgeColor)}>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          {client.totalOrders}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {client.totalSpent > 0 ? (
                          <span className="text-desk-text font-medium text-sm">{formatCurrency(client.totalSpent)}</span>
                        ) : (
                          <span className="text-desk-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border', subBadge.className)}>
                          {subBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/admin/clients/${client.id}`); }}
                          title="Voir le profil"
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg
                                     hover:bg-desk-hover text-desk-muted hover:text-desk-text transition-all"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
          <p className="text-sm text-desk-muted">
            Page {page} sur {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-desk-card border border-desk-border
                         text-desk-muted hover:text-desk-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Précédent</span>
            </button>

            {pageNumbers.map((num) => (
              <button
                key={num}
                onClick={() => setPage(num)}
                className={cn(
                  'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                  num === page
                    ? 'bg-purple-500/10 text-purple-600 border border-purple-500/30'
                    : 'text-desk-muted hover:text-desk-text hover:bg-desk-hover'
                )}
              >
                {num}
              </button>
            ))}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-desk-card border border-desk-border
                         text-desk-muted hover:text-desk-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="hidden sm:inline">Suivant</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
