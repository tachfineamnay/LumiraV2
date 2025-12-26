'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { User, Mail, ChevronRight } from 'lucide-react';

import { Client } from '../../lib/types';

interface ClientsListProps {
    clients: Client[];
    loading?: boolean;
    selectedClientId?: string | null;
    onSelect?: (client: Client) => void;
    onSearch?: (query: string) => void;
}

export function ClientsList({
    clients,
    loading = false,
    selectedClientId,
    onSelect,
    onSearch,
}: ClientsListProps) {
    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            {/* Header + Search */}
            <div className="p-4 border-b border-white/10">
                <h2 className="text-lg font-bold text-white mb-3">Clients</h2>
                {onSearch && (
                    <input
                        type="text"
                        placeholder="Rechercher par email ou nom..."
                        onChange={(e) => onSearch(e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
                    />
                )}
            </div>

            {/* Clients List */}
            <div className="max-h-[500px] overflow-y-auto">
                {loading ? (
                    <div className="p-4 space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="bg-white/5 rounded-xl p-4 animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/10 rounded-full" />
                                    <div className="flex-1">
                                        <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
                                        <div className="h-3 bg-white/5 rounded w-3/4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : clients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/40">
                        <User className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm">Aucun client trouvé</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-2">
                        {clients.map((client, index) => (
                            <motion.button
                                key={client.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                onClick={() => onSelect?.(client)}
                                className={`w-full text-left p-4 rounded-xl transition-all group ${selectedClientId === client.id
                                    ? 'bg-amber-500/20 border border-amber-500/30'
                                    : 'bg-white/5 border border-transparent hover:border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${selectedClientId === client.id
                                        ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                                        : 'bg-gradient-to-br from-purple-500 to-indigo-600'
                                        }`}>
                                        {client.firstName[0]}{client.lastName[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium truncate">
                                            {client.firstName} {client.lastName}
                                        </p>
                                        <p className="text-white/50 text-xs truncate flex items-center gap-1">
                                            <Mail className="w-3 h-3" />
                                            {client.email}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {client._count?.orders !== undefined && (
                                            <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/60">
                                                {client._count.orders} cmd
                                            </span>
                                        )}
                                        <ChevronRight className={`w-4 h-4 transition-transform ${selectedClientId === client.id ? 'text-amber-400' : 'text-white/30 group-hover:text-white/60'
                                            } group-hover:translate-x-0.5`} />
                                    </div>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
