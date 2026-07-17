'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Kanban,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  Users,
  Archive,
  X,
} from 'lucide-react';
import { useOrders } from '../hooks/useOrders';

const NAV_ITEMS = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: '/admin/board',
    label: 'Board',
    icon: Kanban,
    badge: true,
  },
  {
    href: '/admin/production',
    label: 'Production',
    icon: Activity,
  },
  {
    href: '/admin/clients',
    label: 'Clients',
    icon: Users,
  },
  {
    href: '/admin/archive',
    label: 'Archives',
    icon: Archive,
  },
  {
    href: '/admin/settings',
    label: 'Paramètres',
    icon: Settings,
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavContent({
  onNavigate,
  showLabels,
  layoutId,
}: {
  onNavigate?: () => void;
  showLabels: boolean;
  layoutId: string;
}) {
  const pathname = usePathname();
  const { totalCount } = useOrders({ autoFetch: true });

  const handleLogout = () => {
    localStorage.removeItem('expert_token');
    window.location.href = '/admin/login';
  };

  return (
    <>
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`
                group relative flex items-center gap-3 px-2.5 py-2.5 min-h-[44px] rounded-lg
                transition-all duration-150
                ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'text-desk-muted hover:bg-desk-hover hover:text-desk-text'
                }
              `}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-amber-600' : ''}`} />

              {showLabels && <span className="text-sm font-medium">{item.label}</span>}

              {item.badge && totalCount > 0 && (
                <span
                  className={`
                    ${!showLabels ? 'absolute -top-1 -right-1' : 'ml-auto'}
                    min-w-[20px] h-5 px-1.5 rounded-full
                    bg-amber-500 text-slate-900 text-xs font-bold
                    flex items-center justify-center
                  `}
                >
                  {totalCount > 99 ? '99+' : totalCount}
                </span>
              )}

              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-500 rounded-r-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-desk-border">
        <button
          onClick={handleLogout}
          className="
            w-full flex items-center gap-3 px-2.5 py-2.5 min-h-[44px] rounded-lg
            text-desk-muted hover:bg-red-500/10 hover:text-red-600
            transition-all duration-150
          "
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {showLabels && <span className="text-sm font-medium">Déconnexion</span>}
        </button>
      </div>
    </>
  );
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 64 : 220 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="relative hidden lg:flex flex-col bg-desk-surface border-r border-desk-border flex-shrink-0"
      >
        <div className="h-12 flex items-center px-3 border-b border-desk-border">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-semibold text-sm text-desk-text"
                >
                  Oracle Desk
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        <NavContent showLabels={!isCollapsed} layoutId="sidebar-active-desktop" />

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Étendre la sidebar' : 'Réduire la sidebar'}
          className="absolute -right-3 top-20 w-6 h-6 min-w-[24px] rounded-full bg-desk-surface border border-desk-border
                     flex items-center justify-center text-desk-muted hover:text-desk-text
                     transition-colors z-10 shadow-sm"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={onMobileClose}
              aria-hidden="true"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 w-[min(280px,85vw)] flex flex-col
                         bg-desk-surface border-r border-desk-border shadow-xl lg:hidden"
            >
              <div className="h-12 flex items-center justify-between px-3 border-b border-desk-border">
                <Link href="/admin" onClick={onMobileClose} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-sm text-desk-text">Oracle Desk</span>
                </Link>
                <button
                  onClick={onMobileClose}
                  aria-label="Fermer le menu"
                  className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-desk-hover text-desk-muted
                             flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <NavContent showLabels onNavigate={onMobileClose} layoutId="sidebar-active-mobile" />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
