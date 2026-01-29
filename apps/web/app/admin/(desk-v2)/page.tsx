'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { StatsGrid } from '@/components/desk-v2/dashboard/StatsGrid';
import { ActivityFeed } from '@/components/desk-v2/dashboard/ActivityFeed';
import { QuickActions } from '@/components/desk-v2/dashboard/QuickActions';
import { useStats } from '@/components/desk-v2/hooks/useStats';
import { useSocket } from '@/components/desk-v2/hooks/useSocket';
import { Sparkles, TrendingUp, Calendar } from 'lucide-react';

export default function DashboardPage() {
  const { stats, isLoading, updateStats } = useStats();
  const [greeting, setGreeting] = useState('');

  // Real-time stats updates via WebSocket
  useSocket({
    onStatsUpdate: updateStats,
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-amber-400" />
            {greeting}, Expert
          </h1>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {today}
          </p>
        </div>

        {/* Quick summary */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <span className="text-sm text-emerald-400 font-medium">
            {stats.completedToday} lectures aujourd&apos;hui
          </span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 mb-3">Vue d&apos;ensemble</h2>
        <StatsGrid stats={stats} isLoading={isLoading} />
      </section>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed - 2 columns */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-slate-400 mb-3">Activité récente</h2>
          <ActivityFeed />
        </div>

        {/* Quick Actions - 1 column */}
        <div>
          <h2 className="text-sm font-medium text-slate-400 mb-3">Actions rapides</h2>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
