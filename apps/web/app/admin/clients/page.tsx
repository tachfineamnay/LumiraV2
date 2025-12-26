'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { motion } from 'framer-motion';
import { Mail, Phone, Calendar, Trash2, Edit2, Save, X } from 'lucide-react';
import { ClientsList } from '../../../components/admin/ClientsList';
import { ClientStats } from '../../../components/admin/ClientStats';
import { OrderQueue } from '../../../components/admin/OrderQueue';

import { Order, Client, ClientStatsData } from '../../../lib/types';

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientStats, setClientStats] = useState<ClientStatsData | null>(null);
    const [clientOrders, setClientOrders] = useState<Order[]>([]);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '' });
    const [searchQuery, setSearchQuery] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const getToken = () => localStorage.getItem('expert_token');

    const fetchClients = useCallback(async () => {
        setLoading(true);
        const token = getToken();
        if (!token) return;

        try {
            const url = searchQuery
                ? `${apiUrl}/api/expert/clients?search=${encodeURIComponent(searchQuery)}`
                : `${apiUrl}/api/expert/clients`;
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
        setEditing(false);
        setEditForm({ firstName: client.firstName, lastName: client.lastName, phone: client.phone || '' });

        const token = getToken();

        // Fetch stats and orders
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
                const mappedOrders = (orders.data || []).map((o: Order) => ({
                    ...o,
                    userName: `${client.firstName} ${client.lastName}`,
                    userEmail: client.email,
                }));
                setClientOrders(mappedOrders);
            }
        } catch {
            toast.error('Erreur de chargement des détails');
        }
    };

    const handleUpdateClient = async () => {
        if (!selectedClient) return;
        const token = getToken();

        try {
            const res = await fetch(`${apiUrl}/api/expert/clients/${selectedClient.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(editForm),
            });

            if (!res.ok) throw new Error('Échec de la mise à jour');

            toast.success('Client mis à jour !');
            setEditing(false);
            setSelectedClient({ ...selectedClient, ...editForm });
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
            setClientStats(null);
            setClientOrders([]);
            fetchClients();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Échec de la suppression';
            toast.error(message);
        }
    };

    return (
        <div className="space-y-8">
            <Toaster position="top-center" richColors />

            <div>
                <h1 className="text-2xl font-bold text-white mb-2">Clients</h1>
                <p className="text-white/60">Gérez vos clients et consultez leur historique</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Clients List */}
                <ClientsList
                    clients={clients}
                    loading={loading}
                    selectedClientId={selectedClient?.id}
                    onSelect={handleSelectClient}
                    onSearch={setSearchQuery}
                />

                {/* Client Details */}
                <div className="space-y-6">
                    {selectedClient ? (
                        <>
                            {/* Client Info Card */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
                            >
                                <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                                    <h3 className="font-bold text-white">Informations Client</h3>
                                    <div className="flex items-center gap-2">
                                        {editing ? (
                                            <>
                                                <button
                                                    onClick={() => setEditing(false)}
                                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={handleUpdateClient}
                                                    className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setEditing(true)}
                                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={handleDeleteClient}
                                                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 space-y-4">
                                    {editing ? (
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={editForm.firstName}
                                                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                                                placeholder="Prénom"
                                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                                            />
                                            <input
                                                type="text"
                                                value={editForm.lastName}
                                                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                                                placeholder="Nom"
                                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                                            />
                                            <input
                                                type="text"
                                                value={editForm.phone}
                                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                                placeholder="Téléphone"
                                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white">
                                                    {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-white">
                                                        {selectedClient.firstName} {selectedClient.lastName}
                                                    </p>
                                                    <p className="text-white/50 text-sm flex items-center gap-1">
                                                        <Mail className="w-3.5 h-3.5" />
                                                        {selectedClient.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 text-white/60 text-sm">
                                                {selectedClient.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="w-4 h-4" />
                                                        {selectedClient.phone}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4" />
                                                    Inscrit le {new Date(selectedClient.createdAt).toLocaleDateString('fr-FR')}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>

                            {/* Stats */}
                            <ClientStats stats={clientStats} loading={!clientStats} />

                            {/* Client Orders */}
                            <OrderQueue
                                orders={clientOrders}
                                title="Dernières Commandes"
                                showTake={false}
                                emptyMessage="Aucune commande"
                            />
                        </>
                    ) : (
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-white/40">
                            <Mail className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-sm">Sélectionnez un client pour voir les détails</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
