'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Kanban,
  Users,
  Settings,
  FileText,
  Plus,
  Zap,
  Moon,
  ArrowRight,
  X,
} from 'lucide-react';
import { useOrders } from '../hooks/useOrders';

interface CommandItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
  category: 'navigation' | 'actions' | 'orders';
}

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { orders } = useOrders({ autoFetch: false });

  // Build command items
  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      icon: <Zap className="w-4 h-4" />,
      label: 'Dashboard',
      description: 'Vue d\'ensemble',
      shortcut: 'G D',
      action: () => router.push('/admin'),
      category: 'navigation',
    },
    {
      id: 'nav-board',
      icon: <Kanban className="w-4 h-4" />,
      label: 'Board',
      description: 'Kanban des commandes',
      shortcut: 'G B',
      action: () => router.push('/admin/board'),
      category: 'navigation',
    },
    {
      id: 'nav-clients',
      icon: <Users className="w-4 h-4" />,
      label: 'Clients',
      description: 'Gestion CRM',
      shortcut: 'G C',
      action: () => router.push('/admin/clients'),
      category: 'navigation',
    },
    {
      id: 'nav-settings',
      icon: <Settings className="w-4 h-4" />,
      label: 'Paramètres',
      description: 'Configuration',
      shortcut: 'G S',
      action: () => router.push('/admin/settings'),
      category: 'navigation',
    },
    // Actions
    {
      id: 'action-new-client',
      icon: <Plus className="w-4 h-4" />,
      label: 'Nouveau client',
      description: 'Créer un client',
      action: () => router.push('/admin/clients?action=new'),
      category: 'actions',
    },
    {
      id: 'action-theme',
      icon: <Moon className="w-4 h-4" />,
      label: 'Basculer thème',
      description: 'Changer l\'apparence',
      action: () => console.log('Toggle theme'),
      category: 'actions',
    },
    // Orders (dynamic)
    ...orders.paid.slice(0, 5).map(order => ({
      id: `order-${order.id}`,
      icon: <FileText className="w-4 h-4" />,
      label: order.orderNumber,
      description: `${order.user.firstName} ${order.user.lastName}`,
      action: () => router.push(`/admin/studio/${order.id}`),
      category: 'orders' as const,
    })),
  ];

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter(
        cmd =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Group by category
  const grouped = {
    navigation: filteredCommands.filter(c => c.category === 'navigation'),
    actions: filteredCommands.filter(c => c.category === 'actions'),
    orders: filteredCommands.filter(c => c.category === 'orders'),
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }

      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filteredCommands[selectedIndex]?.action();
        setIsOpen(false);
      }
    },
    [filteredCommands, selectedIndex]
  );

  const executeCommand = (command: CommandItem) => {
    command.action();
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Command palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
          >
            <div className="bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 border-b border-white/5">
                <Search className="w-5 h-5 text-slate-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher une commande, un client, une action..."
                  className="flex-1 py-4 bg-transparent text-white placeholder-slate-500 
                             outline-none text-base"
                />
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[400px] overflow-y-auto py-2">
                {filteredCommands.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-500">
                    Aucun résultat pour &quot;{query}&quot;
                  </div>
                ) : (
                  <>
                    {grouped.navigation.length > 0 && (
                      <CommandGroup
                        title="Navigation"
                        items={grouped.navigation}
                        selectedIndex={selectedIndex}
                        onSelect={executeCommand}
                        startIndex={0}
                      />
                    )}
                    {grouped.actions.length > 0 && (
                      <CommandGroup
                        title="Actions"
                        items={grouped.actions}
                        selectedIndex={selectedIndex}
                        onSelect={executeCommand}
                        startIndex={grouped.navigation.length}
                      />
                    )}
                    {grouped.orders.length > 0 && (
                      <CommandGroup
                        title="Commandes récentes"
                        items={grouped.orders}
                        selectedIndex={selectedIndex}
                        onSelect={executeCommand}
                        startIndex={grouped.navigation.length + grouped.actions.length}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">↑↓</kbd>
                  naviguer
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">↵</kbd>
                  sélectionner
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">esc</kbd>
                  fermer
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface CommandGroupProps {
  title: string;
  items: CommandItem[];
  selectedIndex: number;
  onSelect: (item: CommandItem) => void;
  startIndex: number;
}

function CommandGroup({ title, items, selectedIndex, onSelect, startIndex }: CommandGroupProps) {
  return (
    <div className="px-2">
      <div className="px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
        {title}
      </div>
      {items.map((item, index) => {
        const globalIndex = startIndex + index;
        const isSelected = globalIndex === selectedIndex;

        return (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
              transition-colors text-left
              ${isSelected ? 'bg-amber-500/10 text-amber-400' : 'text-slate-300 hover:bg-white/5'}
            `}
          >
            <span className={isSelected ? 'text-amber-400' : 'text-slate-500'}>
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{item.label}</div>
              {item.description && (
                <div className="text-xs text-slate-500 truncate">{item.description}</div>
              )}
            </div>
            {item.shortcut && (
              <kbd className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                {item.shortcut}
              </kbd>
            )}
            {isSelected && <ArrowRight className="w-4 h-4 text-amber-400" />}
          </button>
        );
      })}
    </div>
  );
}
