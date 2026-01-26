'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail, Phone, Calendar, Trash2, Edit2, Save, X, Search,
    UserPlus, Shield, ShieldOff, ShieldAlert, ChevronDown,
    MoreHorizontal, Users, ArrowUpDown, Eye, Ban, CheckCircle,
    Tag, FileText
} from 'lucide-react';
import { ClientStats } from '../../../components/admin/ClientStats';
import { OrderQueue } from '../../../components/admin/OrderQueue';
import { Order, Client, ClientStatsData } from '../../../lib/types';

type ClientStatus = 'ACTIVE' | 'BANNED' | 'SUSPENDED';

const STATUS_CONFIG: Record<ClientStatus, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
    ACTIVE: { label: 'Actif', color: 'text-emerald-400', icon: <CheckCircle className="w-3.5 h-3.5" />, bgColor: 'bg-emerald-500/10' },
    BANNED: { label: 'Banni', color: 'text-rose-400', icon: <Ban className="w-3.5 h-3.5" />, bgColor: 'bg-rose-500/10' },
    SUSPENDED: { label: 'Suspendu', color: 'text-amber-400', icon: <ShieldAlert className="w-3.5 h-3.5" />, bgColor: 'bg-amber-500/10' },
};

interface CreateClientForm {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    notes: string;
    source: string;
}

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientStats, setClientStats] = useState<ClientStatsData | null>(null);
    const [clientOrders, setClientOrders] = useState<Order[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [sortField, setSortField] = useState<'createdAt' | 'refId' | 'firstName'>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [createForm, setCreateForm] = useState<CreateClientForm>({
        email: '', firstName: '', lastName: '', phone: '', notes: '', source: 'manual'
    });
    const [statusForm, setStatusForm] = useState<{ status: ClientStatus; reason: string }>({
        status: 'ACTIVE', reason: ''
    });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const getToken = () => localStorage.getItem('expert_token');

    const fetchClients = useCallback(async () => {
        setLoading(true);
        const token = getToken();
        if (!token) return;

        try {
            const url = searchQuery
                ? `${apiUrl}/api/expert/clients?search=${encodeURIComponent(searchQuery)}&limit=100`
                : `${apiUrl}/api/expert/clients?limit=100`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setClients(data.data || []);
            }
        } catch {
            toast.error('Erreur de chargement');
        } finally {
            setLoading(false);
        }
    }, [apiUrl, searchQuery]);

    useEffect(() => {
        const debounce = setTimeout(() => fetchClients(), 300);
        return () => clearTimeout(debounce);
    }, [fetchClients]);

    const handleSelectClient = async (client: Client) => {
        setSelectedClient(client);
        setShowDetailPanel(true);

        const token = getToken();
        try {
            const [statsRes, ordersRes] = await Promise.all([
                fetch(`${apiUrl}/api/expert/clients/${client.id}/stats`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${apiUrl}/api/expert/clients/${client.id}/orders?limit=10`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (statsRes.ok) {
                const stats = await statsRes.json();
                setClientStats(stats);
            }
            if (ordersRes.ok) {
                const orders = await ordersRes.json();
                setClientOrders((orders.data || []).map((o: Order) => ({
                    ...o,
                    userName: `${client.firstName} ${client.lastName}`,
                    userEmail: client.email,
                })));
            }
        } catch {
            toast.error('Erreur de chargement des détails');
        }
    };

    const handleCreateClient = async () => {
        const token = getToken();
        try {
            const res = await fetch(`${apiUrl}/api/expert/clients`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(createForm),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Échec de la création');
            }

            toast.success('✨ Client créé avec succès !');
            setShowCreateModal(false);
            setCreateForm({ email: '', firstName: '', lastName: '', phone: '', notes: '', source: 'manual' });
            fetchClients();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Échec de la création';
            toast.error(message);
        }
    };

    const handleUpdateStatus = async () => {
        if (!selectedClient) return;
        const token = getToken();

        try {
            const res = await fetch(`${apiUrl}/api/expert/clients/${selectedClient.id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(statusForm),
            });

            if (!res.ok) throw new Error('Échec de la mise à jour');

            toast.success('Statut mis à jour !');
            setShowStatusModal(false);
            setSelectedClient({ ...selectedClient, status: statusForm.status });
            fetchClients();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Échec de la mise à jour';
            toast.error(message);
        }
    };

    const handleDeleteClient = async () => {
        if (!selectedClient) return;
        if (!confirm(`Supprimer ${selectedClient.firstName} ${selectedClient.lastName} et toutes ses commandes ?`)) return;

        const token = getToken();
        try {
            const res = await fetch(`${apiUrl}/api/expert/clients/${selectedClient.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('Échec de la suppression');

            toast.success('Client supprimé');
            setSelectedClient(null);
            setShowDetailPanel(false);
            fetchClients();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Échec de la suppression';
            toast.error(message);
        }
    };

    const sortedClients = [...clients].sort((a, b) => {
        const order = sortOrder === 'asc' ? 1 : -1;
        if (sortField === 'createdAt') {
            return order * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
        if (sortField === 'refId') {
            return order * ((a.refId || '').localeCompare(b.refId || ''));
        }
        return order * a.firstName.localeCompare(b.firstName);
    });

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    return (
        <div className="space-y-6">
            <Toaster position="top-center" richColors />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                        <Users className="w-7 h-7 text-purple-400" />
                        CRM Clients
                    </h1>
                    <p className="text-white/60 text-sm">
                        {clients.length} clients · Gérez votre base clients
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 
                             hover:from-purple-600 hover:to-indigo-600 text-white font-medium rounded-xl 
                             transition-all duration-200 shadow-lg shadow-purple-500/20"
                >
                    <UserPlus className="w-4 h-4" />
                    Nouveau Client
                </button>
            </div>

            {/* Search & Filters */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher par nom, email ou ID (LUM-C-...)..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white 
                                     placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                        />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="text-left px-4 py-3">
                                    <button
                                        onClick={() => toggleSort('refId')}
                                        className="flex items-center gap-1 text-xs font-semibold text-white/60 uppercase tracking-wider hover:text-white"
                                    >
                                        ID Client
                                        <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="text-left px-4 py-3">
                                    <button
                                        onClick={() => toggleSort('firstName')}
                                        className="flex items-center gap-1 text-xs font-semibold text-white/60 uppercase tracking-wider hover:text-white"
                                    >
                                        Nom
                                        <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60 uppercase tracking-wider">
                                    Statut
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60 uppercase tracking-wider">
                                    Commandes
                                </th>
                                <th className="text-left px-4 py-3">
                                    <button
                                        onClick={() => toggleSort('createdAt')}
                                        className="flex items-center gap-1 text-xs font-semibold text-white/60 uppercase tracking-wider hover:text-white"
                                    >
                                        Inscrit le
                                        <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-white/40">
                                        Chargement...
                                    </td>
                                </tr>
                            ) : sortedClients.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-white/40">
                                        Aucun client trouvé
                                    </td>
                                </tr>
                            ) : (
                                sortedClients.map((client) => {
                                    const status = STATUS_CONFIG[client.status || 'ACTIVE'];
                                    return (
                                        <tr
                                            key={client.id}
                                            onClick={() => handleSelectClient(client)}
                                            className={`cursor-pointer transition-colors hover:bg-white/5 ${selectedClient?.id === client.id ? 'bg-purple-500/10' : ''
                                                }`}
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-sm text-purple-400">
                                                    {client.refId || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 
                                                                  flex items-center justify-center text-xs font-bold text-white">
                                                        {client.firstName[0]}{client.lastName[0]}
                                                    </div>
                                                    <span className="font-medium text-white">
                                                        {client.firstName} {client.lastName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-white/60 text-sm">{client.email}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                                                    {status.icon}
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-white/80 font-medium">
                                                    {client._count?.orders ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-white/50 text-sm">
                                                    {new Date(client.createdAt).toLocaleDateString('fr-FR')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleSelectClient(client); }}
                                                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Panel (Slide-over) */}
            <AnimatePresence>
                {showDetailPanel && selectedClient && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDetailPanel(false)}
                            className="fixed inset-0 bg-black/50 z-40"
                        />
                        {/* Panel */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed right-0 top-0 h-full w-full max-w-xl bg-[#0a0a1a] border-l border-white/10 z-50 overflow-y-auto"
                        >
                            {/* Panel Header */}
                            <div className="sticky top-0 bg-[#0a0a1a]/95 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white">
                                        {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{selectedClient.firstName} {selectedClient.lastName}</h3>
                                        <p className="text-xs text-purple-400 font-mono">{selectedClient.refId || 'ID en attente'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowDetailPanel(false)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/60"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Panel Content */}
                            <div className="p-4 space-y-6">
                                {/* Contact Info */}
                                <div className="bg-white/5 rounded-xl p-4 space-y-3">
                                    <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Contact</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 text-white/80">
                                            <Mail className="w-4 h-4 text-white/40" />
                                            <span className="text-sm">{selectedClient.email}</span>
                                        </div>
                                        {selectedClient.phone && (
                                            <div className="flex items-center gap-3 text-white/80">
                                                <Phone className="w-4 h-4 text-white/40" />
                                                <span className="text-sm">{selectedClient.phone}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 text-white/80">
                                            <Calendar className="w-4 h-4 text-white/40" />
                                            <span className="text-sm">Inscrit le {new Date(selectedClient.createdAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status & Actions */}
                                <div className="bg-white/5 rounded-xl p-4 space-y-3">
                                    <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Statut & Actions</h4>
                                    <div className="flex items-center gap-3">
                                        {(() => {
                                            const s = STATUS_CONFIG[selectedClient.status || 'ACTIVE'];
                                            return (
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${s.bgColor} ${s.color}`}>
                                                    {s.icon}
                                                    {s.label}
                                                </span>
                                            );
                                        })()}
                                        <button
                                            onClick={() => {
                                                setStatusForm({ status: selectedClient.status || 'ACTIVE', reason: '' });
                                                setShowStatusModal(true);
                                            }}
                                            className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70"
                                        >
                                            Changer le statut
                                        </button>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={handleDeleteClient}
                                            className="flex items-center gap-2 px-3 py-2 text-sm bg-rose-500/10 hover:bg-rose-500/20 
                                                     border border-rose-500/20 rounded-lg text-rose-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Supprimer
                                        </button>
                                    </div>
                                </div>

                                {/* Notes */}
                                {selectedClient.notes && (
                                    <div className="bg-white/5 rounded-xl p-4 space-y-3">
                                        <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            Notes
                                        </h4>
                                        <p className="text-white/70 text-sm whitespace-pre-wrap">{selectedClient.notes}</p>
                                    </div>
                                )}

                                {/* Tags */}
                                {selectedClient.tags && selectedClient.tags.length > 0 && (
                                    <div className="bg-white/5 rounded-xl p-4 space-y-3">
                                        <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
                                            <Tag className="w-4 h-4" />
                                            Tags
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedClient.tags.map((tag, i) => (
                                                <span key={i} className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Stats */}
                                <ClientStats stats={clientStats} loading={!clientStats} />

                                {/* Orders */}
                                <div>
                                    <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Dernières Commandes</h4>
                                    <OrderQueue
                                        orders={clientOrders}
                                        title=""
                                        showTake={false}
                                        emptyMessage="Aucune commande"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Create Client Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCreateModal(false)}
                            className="fixed inset-0 bg-black/50 z-50"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#0a0a1a] border border-white/10 rounded-2xl z-50 overflow-hidden"
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <UserPlus className="w-5 h-5 text-purple-400" />
                                    Nouveau Client
                                </h3>
                                <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-white/60 mb-1">Prénom *</label>
                                        <input
                                            type="text"
                                            value={createForm.firstName}
                                            onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-white/60 mb-1">Nom *</label>
                                        <input
                                            type="text"
                                            value={createForm.lastName}
                                            onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-white/60 mb-1">Email *</label>
                                    <input
                                        type="email"
                                        value={createForm.email}
                                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-white/60 mb-1">Téléphone</label>
                                    <input
                                        type="tel"
                                        value={createForm.phone}
                                        onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-white/60 mb-1">Source</label>
                                    <select
                                        value={createForm.source}
                                        onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                                    >
                                        <option value="manual">Manuel</option>
                                        <option value="organic">Organique</option>
                                        <option value="referral">Parrainage</option>
                                        <option value="ads">Publicité</option>
                                        <option value="social">Réseaux sociaux</option>
                                        <option value="other">Autre</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-white/60 mb-1">Notes internes</label>
                                    <textarea
                                        value={createForm.notes}
                                        onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                                        rows={3}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm resize-none"
                                    />
                                </div>
                                <button
                                    onClick={handleCreateClient}
                                    disabled={!createForm.email || !createForm.firstName || !createForm.lastName}
                                    className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium rounded-lg 
                                             disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Créer le client
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Status Change Modal */}
            <AnimatePresence>
                {showStatusModal && selectedClient && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowStatusModal(false)}
                            className="fixed inset-0 bg-black/50 z-50"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[#0a0a1a] border border-white/10 rounded-2xl z-50 overflow-hidden"
                        >
                            <div className="p-4 border-b border-white/10">
                                <h3 className="text-lg font-bold text-white">Changer le statut</h3>
                                <p className="text-sm text-white/60">{selectedClient.firstName} {selectedClient.lastName}</p>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-3 gap-2">
                                    {(['ACTIVE', 'SUSPENDED', 'BANNED'] as const).map((s) => {
                                        const cfg = STATUS_CONFIG[s];
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => setStatusForm({ ...statusForm, status: s })}
                                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${statusForm.status === s
                                                        ? 'border-purple-500 bg-purple-500/10'
                                                        : 'border-white/10 hover:border-white/20'
                                                    }`}
                                            >
                                                <span className={cfg.color}>{cfg.icon}</span>
                                                <span className="text-xs text-white/80">{cfg.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-white/60 mb-1">Raison (optionnel)</label>
                                    <textarea
                                        value={statusForm.reason}
                                        onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                                        rows={2}
                                        placeholder="Pourquoi ce changement de statut..."
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm resize-none"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowStatusModal(false)}
                                        className="flex-1 py-2 bg-white/5 text-white/70 rounded-lg"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleUpdateStatus}
                                        className="flex-1 py-2 bg-purple-500 text-white font-medium rounded-lg"
                                    >
                                        Confirmer
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
