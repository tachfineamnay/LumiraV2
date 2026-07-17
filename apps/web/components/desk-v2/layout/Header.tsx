'use client';

import Link from 'next/link';
import { Search, Bell, Wifi, WifiOff, Command, Menu, X } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useExpertAuth } from '@/context/ExpertAuthContext';
import { ProductionIndicator } from '../production/ProductionIndicator';
import { useGuidanceRequests } from '../messages/useGuidanceRequests';

interface HeaderProps {
  onMenuClick?: () => void;
  mobileNavOpen?: boolean;
}

export function Header({ onMenuClick, mobileNavOpen }: HeaderProps) {
  const { isConnected, onlineCount, latency } = useSocket();
  const { expert, isAuthenticated } = useExpertAuth();
  const { unreadCount } = useGuidanceRequests(7000);

  const handleSearchClick = () => {
    document.dispatchEvent(new CustomEvent('lumira:palette:toggle'));
  };

  return (
    <header className="flex h-12 flex-shrink-0 items-center justify-between gap-2 border-b border-desk-border bg-desk-surface px-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          onClick={onMenuClick}
          aria-label={mobileNavOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileNavOpen}
          className="-ml-1 flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg p-2 text-desk-muted transition-colors hover:bg-desk-hover hover:text-desk-text lg:hidden"
        >
          {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <button
          onClick={handleSearchClick}
          aria-label="Rechercher"
          className="flex min-h-[36px] max-w-md flex-1 items-center gap-2 rounded-lg border border-desk-border bg-desk-card px-2.5 py-1.5 text-desk-muted transition-all hover:text-desk-text sm:w-48 sm:flex-initial sm:min-w-0 sm:px-3 md:w-64"
        >
          <Search className="h-4 w-4 flex-shrink-0" />
          <span className="hidden truncate text-sm sm:inline">Rechercher...</span>
          <div className="ml-auto hidden items-center gap-1 text-xs text-desk-subtle md:flex">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </button>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
        <ProductionIndicator />

        <div
          className="hidden items-center gap-2 rounded-full border border-desk-border bg-desk-card px-2 py-1.5 sm:flex sm:px-3"
          title={isConnected ? `Live${latency ? ` ${latency}ms` : ''}` : 'Hors ligne'}
        >
          {isConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden text-xs text-emerald-600 sm:inline">Live</span>
              {latency != null && (
                <span className="hidden text-xs text-desk-subtle md:inline">{latency}ms</span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-red-600" />
              <span className="hidden text-xs text-red-600 sm:inline">Hors ligne</span>
            </>
          )}
        </div>

        {onlineCount > 0 && (
          <div className="hidden items-center gap-2 rounded-full border border-desk-border bg-desk-card px-3 py-1.5 xl:flex">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs text-desk-muted">
              {onlineCount} expert{onlineCount > 1 ? 's' : ''} en ligne
            </span>
          </div>
        )}

        <Link
          href="/admin/messages"
          title={unreadCount > 0 ? `${unreadCount} demande(s) non lue(s)` : 'Demandes d’éclairage'}
          aria-label="Demandes d’éclairage"
          className="relative flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-2 transition-colors hover:bg-desk-hover"
        >
          <Bell className="h-5 w-5 text-desk-muted" />
          {unreadCount > 0 && (
            <span className="absolute right-0 top-0 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white"
          title={isAuthenticated && expert?.name ? expert.name : 'Expert'}
        >
          {isAuthenticated && expert?.name ? expert.name[0].toUpperCase() : 'E'}
        </div>
      </div>
    </header>
  );
}
