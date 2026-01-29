'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, Wifi, WifiOff, Command } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

export function Header() {
  const { isConnected, onlineCount, latency } = useSocket();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSearchClick = () => {
    // Trigger command palette
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-slate-900/30">
      {/* Search */}
      <button
        onClick={handleSearchClick}
        className="flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-800/50 
                   border border-white/5 hover:border-white/10
                   text-slate-400 hover:text-white transition-all w-80"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Rechercher...</span>
        <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
          <Command className="w-3 h-3" />
          <span>K</span>
        </div>
      </button>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-white/5">
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">Live</span>
              {latency && (
                <span className="text-xs text-slate-500">{latency}ms</span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-400">Hors ligne</span>
            </>
          )}
        </div>

        {/* Online experts count */}
        {onlineCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-white/5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">
              {onlineCount} expert{onlineCount > 1 ? 's' : ''} en ligne
            </span>
          </div>
        )}

        {/* Notifications */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <Bell className="w-5 h-5 text-slate-400" />
          {/* Notification dot */}
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
        </button>

        {/* Expert avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 
                        flex items-center justify-center text-sm font-bold text-white">
          E
        </div>
      </div>
    </header>
  );
}
