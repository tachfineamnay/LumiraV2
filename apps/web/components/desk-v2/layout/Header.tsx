'use client';

import { useState } from 'react';

import { Search, Bell, Wifi, WifiOff, Command } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useExpertAuth } from '@/context/ExpertAuthContext';

export function Header() {
  const { isConnected, onlineCount, latency } = useSocket();
  const { expert, isAuthenticated } = useExpertAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSearchClick = () => {
    document.dispatchEvent(new CustomEvent('lumira:palette:toggle'));
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-desk-border bg-desk-surface">
      {/* Search */}
      <button
        onClick={handleSearchClick}
        className="flex items-center gap-3 px-4 py-2 rounded-lg bg-desk-card 
                   border border-desk-border hover:border-desk-border
                   text-desk-muted hover:text-desk-text transition-all w-80"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Rechercher...</span>
        <div className="ml-auto flex items-center gap-1 text-xs text-desk-subtle">
          <Command className="w-3 h-3" />
          <span>K</span>
        </div>
      </button>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-desk-card border border-desk-border">
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs text-emerald-600">Live</span>
              {latency && (
                <span className="text-xs text-desk-subtle">{latency}ms</span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs text-red-600">Hors ligne</span>
            </>
          )}
        </div>

        {/* Online experts count */}
        {onlineCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-desk-card border border-desk-border">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-desk-muted">
              {onlineCount} expert{onlineCount > 1 ? 's' : ''} en ligne
            </span>
          </div>
        )}

        {/* Notifications */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          title="Notifications"
          className="relative p-2 rounded-lg hover:bg-desk-hover transition-colors"
        >
          <Bell className="w-5 h-5 text-desk-muted" />
        </button>

        {/* Expert avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 
                        flex items-center justify-center text-sm font-bold text-white">
          {isAuthenticated && expert?.name ? expert.name[0].toUpperCase() : 'E'}
        </div>
      </div>
    </header>
  );
}
