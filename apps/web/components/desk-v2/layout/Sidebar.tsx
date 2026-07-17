'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Kanban,
  Activity,
  MessageCircle,
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
import { useGuidanceRequests } from '../messages/useGuidanceRequests';

type NavBadge = 'orders' | 'messages';

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: NavBadge;
}> = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/board', label: 'Board', icon: Kanban, badge: 'orders' },
  { href: '/admin/production', label: 'Production', icon: Activity },
  { href: '/admin/messages', label: 'Messages', icon: MessageCircle, badge: 'messages' },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/archive', label: 'Archives', icon: Archive },
  { href: '/admin/settings', label: 'Paramètres', icon: Settings },
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
  const { unreadCount } = useGuidanceRequests(7000);

  const handleLogout = () => {
    localStorage.removeItem('expert_token');
    window.location.href = '/admin/login';
  };

  return (
    <>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const badgeCount =
            item.badge === 'orders' ? totalCount : item.badge === 'messages' ? unreadCount : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group relative flex min-h-[44px] items-center gap-3 rounded-lg px-2.5 py-2.5 transition-all duration-150 ${
                isActive
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'text-desk-muted hover:bg-desk-hover hover:text-desk-text'
              }`}
            >
              <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-amber-600' : ''}`} />
              {showLabels && <span className="text-sm font-medium">{item.label}</span>}

              {badgeCount > 0 && (
                <span
                  className={`${!showLabels ? 'absolute -right-1 -top-1' : 'ml-auto'} flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-slate-900`}
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}

              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-amber-500"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-desk-border p-2">
        <button
          onClick={handleLogout}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-desk-muted transition-all duration-150 hover:bg-red-500/10 hover:text-red-600"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
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
        className="relative hidden flex-shrink-0 flex-col border-r border-desk-border bg-desk-surface lg:flex"
      >
        <div className="flex h-12 items-center border-b border-desk-border px-3">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-sm font-semibold text-desk-text"
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
          className="absolute -right-3 top-20 z-10 flex h-6 min-h-[24px] w-6 min-w-[24px] items-center justify-center rounded-full border border-desk-border bg-desk-surface text-desk-muted shadow-sm transition-colors hover:text-desk-text"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
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
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
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
              className="fixed inset-y-0 left-0 z-50 flex w-[min(280px,85vw)] flex-col border-r border-desk-border bg-desk-surface shadow-xl lg:hidden"
            >
              <div className="flex h-12 items-center justify-between border-b border-desk-border px-3">
                <Link href="/admin" onClick={onMobileClose} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-desk-text">Oracle Desk</span>
                </Link>
                <button
                  onClick={onMobileClose}
                  aria-label="Fermer le menu"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-desk-muted hover:bg-desk-hover"
                >
                  <X className="h-5 w-5" />
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
