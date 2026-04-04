'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  BookOpen,
  Sparkles,
  Compass,
  Brain,
} from 'lucide-react';
import { ClientFullData } from './types';
import { TabProfil } from './TabProfil';
import { TabLectures } from './TabLectures';
import { TabInsights } from './TabInsights';
import { TabParcours } from './TabParcours';
import { TabIntelligence } from './TabIntelligence';

type TabId = 'profil' | 'lectures' | 'insights' | 'parcours' | 'intelligence';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

interface ClientTabsProps {
  client: ClientFullData;
  onRefresh: () => void;
}

export function ClientTabs({ client, onRefresh }: ClientTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profil');

  const tabs: Tab[] = [
    { id: 'profil', label: 'Profil', icon: <User className="w-4 h-4" /> },
    { id: 'lectures', label: 'Lectures', icon: <BookOpen className="w-4 h-4" />, count: client.orders.length },
    { id: 'insights', label: 'Insights & Audio', icon: <Sparkles className="w-4 h-4" />, count: client.insights.length },
    { id: 'parcours', label: 'Parcours', icon: <Compass className="w-4 h-4" /> },
    { id: 'intelligence', label: 'Intelligence', icon: <Brain className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden">
      {/* Tab Bar */}
      <div className="flex border-b border-white/10 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors whitespace-nowrap min-w-[140px]
              ${activeTab === tab.id
                ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/5'
                : 'text-stellar-400 hover:text-stellar-100 hover:bg-white/5'
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`
                px-1.5 py-0.5 text-xs rounded-full
                ${activeTab === tab.id ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-stellar-400'}
              `}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="p-5"
      >
        {activeTab === 'profil' && <TabProfil client={client} />}
        {activeTab === 'lectures' && <TabLectures client={client} onRefresh={onRefresh} />}
        {activeTab === 'insights' && <TabInsights client={client} />}
        {activeTab === 'parcours' && <TabParcours client={client} />}
        {activeTab === 'intelligence' && <TabIntelligence client={client} />}
      </motion.div>
    </div>
  );
}
