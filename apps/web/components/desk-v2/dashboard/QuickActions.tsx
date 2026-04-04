'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Kanban, Settings, Users, Archive, LucideIcon } from 'lucide-react';

// Static color classes to avoid Tailwind purge issues
const COLOR_CLASSES = {
  amber: {
    bg: 'bg-amber-500/15',
    bgHover: 'group-hover:bg-amber-500/20',
    text: 'text-amber-600',
  },
  slate: {
    bg: 'bg-slate-500/15',
    bgHover: 'group-hover:bg-slate-500/20',
    text: 'text-slate-600',
  },
  blue: {
    bg: 'bg-blue-500/15',
    bgHover: 'group-hover:bg-blue-500/20',
    text: 'text-blue-600',
  },
  emerald: {
    bg: 'bg-emerald-500/15',
    bgHover: 'group-hover:bg-emerald-500/20',
    text: 'text-emerald-600',
  },
} as const;

type ColorKey = keyof typeof COLOR_CLASSES;

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: ColorKey;
  href: string;
}

const ACTIONS: QuickAction[] = [
  {
    id: 'board',
    label: 'Voir le Board',
    description: 'Gérer les commandes',
    icon: Kanban,
    color: 'amber',
    href: '/admin/board',
  },
  {
    id: 'clients',
    label: 'Clients',
    description: 'Voir les clients',
    icon: Users,
    color: 'blue',
    href: '/admin/clients',
  },
  {
    id: 'archive',
    label: 'Archives',
    description: 'Commandes terminées',
    icon: Archive,
    color: 'emerald',
    href: '/admin/archive',
  },
  {
    id: 'settings',
    label: 'Paramètres',
    description: 'Configuration IA',
    icon: Settings,
    color: 'slate',
    href: '/admin/settings',
  },
];

export function QuickActions() {
  const router = useRouter();

  return (
    <div className="bg-desk-surface rounded-lg border border-desk-border p-3">
      <h3 className="text-xs font-medium text-desk-muted uppercase tracking-wide mb-3">Actions rapides</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((action, index) => {
          const colors = COLOR_CLASSES[action.color];
          const Icon = action.icon;
          
          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => router.push(action.href)}
              className="flex items-center gap-2.5 p-2.5 rounded-lg text-left
                bg-desk-card border border-desk-border
                hover:bg-desk-hover hover:border-desk-border
                transition-all group"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                ${colors.bg} ${colors.bgHover} transition-colors`}>
                <Icon className={`w-4 h-4 ${colors.text}`} />
              </div>
              <div>
                <div className="text-sm font-medium text-desk-text">{action.label}</div>
                <div className="text-xs text-desk-subtle">{action.description}</div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
