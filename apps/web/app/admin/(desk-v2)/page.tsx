'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { StatsGrid } from '@/components/desk-v2/dashboard/StatsGrid';
import { ActivityFeed } from '@/components/desk-v2/dashboard/ActivityFeed';
import { QuickActions } from '@/components/desk-v2/dashboard/QuickActions';
import { useStats } from '@/components/desk-v2/hooks/useStats';
import { useActivity } from '@/components/desk-v2/hooks/useActivity';
import { useSocket } from '@/components/desk-v2/hooks/useSocket';
import { TrendingUp, Calendar } from 'lucide-react';

export default function DashboardPage() {
  const { stats, isLoading, updateStats } = useStats();
  const { items: activityItems, isLoading: activityLoading, addItem } = useActivity({ limit: 10 });
  const [greeting, setGreeting] = useState('');

  // Real-time stats updates via WebSocket
  useSocket({
    onStatsUpdate: updateStats,
    onNewActivity: addItem,
  });

  // Dynamic greeting based on time
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Bonjour');
    } else if (hour < 18) {
      setGreeting('Bon après-midi');
    } else {
      setGreeting('Bonsoir');
    }
  }, []);

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-lg font-semibold text-desk-text">
            {greeting}, Expert
          </h1>
          <p className="text-desk-muted text-sm flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3.5 h-3.5" />
            {today}
          </p>
        </div>

        {/* Quick summary */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span className="text-sm text-emerald-600 font-medium">
            {stats.completedToday} lectures aujourd&apos;hui
          </span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <section>
        <h2 className="text-xs font-medium text-desk-muted uppercase tracking-wide mb-2">Vue d&apos;ensemble</h2>
        <StatsGrid stats={stats} isLoading={isLoading} />
      </section>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Feed - 2 columns */}
        <div className="lg:col-span-2">
          <h2 className="text-xs font-medium text-desk-muted uppercase tracking-wide mb-2">Activité récente</h2>
          <ActivityFeed items={activityItems} isLoading={activityLoading} />
        </div>

        {/* Quick Actions - 1 column */}
        <div>
          <h2 className="text-xs font-medium text-desk-muted uppercase tracking-wide mb-2">Actions rapides</h2>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
