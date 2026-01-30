'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Kanban, Settings } from 'lucide-react';

export function QuickActions() {
  const router = useRouter();

  const actions = [
    {
      id: 'board',
      label: 'Voir le Board',
      description: 'Gérer les commandes',
      icon: Kanban,
      color: 'amber',
      onClick: () => router.push('/admin/board'),
    },
    {
      id: 'settings',
      label: 'Paramètres',
      description: 'Configuration IA',
      icon: Settings,
      color: 'slate',
      onClick: () => router.push('/admin/settings'),
    },
  ];

  return (
    <div className="bg-slate-900/50 rounded-xl border border-white/5 p-4">
      <h3 className="text-sm font-semibold text-white mb-4">Actions rapides</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={action.onClick}
            className={`
              flex items-center gap-3 p-3 rounded-lg text-left
              bg-slate-800/50 border border-white/5
              hover:bg-slate-800 hover:border-white/10
              transition-all group
            `}
          >
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center
              bg-${action.color}-500/20 group-hover:bg-${action.color}-500/30
              transition-colors
            `}>
              <action.icon className={`w-5 h-5 text-${action.color}-400`} />
            </div>
            <div>
              <div className="text-sm font-medium text-white">{action.label}</div>
              <div className="text-xs text-slate-500">{action.description}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
