'use client';

import { useState } from 'react';
import { Search, Bell, Wifi, WifiOff, Command, Menu, X } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useExpertAuth } from '@/context/ExpertAuthContext';

interface HeaderProps {
  onMenuClick?: () => void;
  mobileNavOpen?: boolean;
}

export function Header({ onMenuClick, mobileNavOpen }: HeaderProps) {
  const { isConnected, onlineCount, latency } = useSocket();
  const { expert, isAuthenticated } = useExpertAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSearchClick = () => {
    document.dispatchEvent(new CustomEvent('lumira:palette:toggle'));
  };

  return (
    <header className="h-12 flex-shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 border-b border-desk-border bg-desk-surface">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuClick}
          aria-label={mobileNavOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileNavOpen}
          className="lg:hidden flex-shrink-0 p-2 min-w-[44px] min-h-[44px] -ml-1 rounded-lg
                     hover:bg-desk-hover text-desk-muted hover:text-desk-text
                     flex items-center justify-center transition-colors"
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Search — icon on mobile, full pill on sm+ */}
        <button
          onClick={handleSearchClick}
          aria-label="Rechercher"
          className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-desk-card
                     border border-desk-border hover:border-desk-border
                     text-desk-muted hover:text-desk-text transition-all
                     min-h-[36px] sm:min-w-0 sm:w-48 md:w-64 flex-1 sm:flex-initial max-w-md"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm truncate hidden sm:inline">Rechercher...</span>
          <div className="ml-auto hidden md:flex items-center gap-1 text-xs text-desk-subtle">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        {/* Connection status — icon only on mobile */}
        <div
          className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-desk-card border border-desk-border"
          title={isConnected ? `Live${latency ? ` ${latency}ms` : ''}` : 'Hors ligne'}
        >
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs text-emerald-600 hidden sm:inline">Live</span>
              {latency != null && (
                <span className="text-xs text-desk-subtle hidden md:inline">{latency}ms</span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs text-red-600 hidden sm:inline">Hors ligne</span>
            </>
          )}
        </div>

        {/* Online experts — md+ only */}
        {onlineCount > 0 && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-desk-card border border-desk-border">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-desk-muted">
              {onlineCount} expert{onlineCount > 1 ? 's' : ''} en ligne
            </span>
          </div>
        )}

        <button
          onClick={() => setShowNotifications(!showNotifications)}
          title="Notifications"
          aria-label="Notifications"
          className="relative p-2 min-w-[40px] min-h-[40px] rounded-lg hover:bg-desk-hover transition-colors
                     flex items-center justify-center"
        >
          <Bell className="w-5 h-5 text-desk-muted" />
        </button>

        <div
          className="w-7 h-7 rounded-full bg-amber-500
                      flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          title={isAuthenticated && expert?.name ? expert.name : 'Expert'}
        >
          {isAuthenticated && expert?.name ? expert.name[0].toUpperCase() : 'E'}
        </div>
      </div>
    </header>
  );
}
