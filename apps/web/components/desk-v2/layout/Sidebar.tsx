'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Kanban,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
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
    href: '/admin/clients',
    label: 'Clients',
    icon: Users,
  },
  {
    href: '/admin/settings',
    label: 'Paramètres',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { totalCount } = useOrders({ autoFetch: true });

  const handleLogout = () => {
    localStorage.removeItem('expert_token');
    window.location.href = '/admin/login';
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col bg-slate-900/50 border-r border-white/5"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/5">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-semibold text-lg text-white"
              >
                Oracle Desk
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-150
                ${isActive 
                  ? 'bg-amber-500/10 text-amber-400' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-amber-400' : ''}`} />
              
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="text-sm font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Badge */}
              {item.badge && totalCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`
                    ${isCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'}
                    min-w-[20px] h-5 px-1.5 rounded-full
                    bg-amber-500 text-slate-900 text-xs font-bold
                    flex items-center justify-center
                  `}
                >
                  {totalCount > 99 ? '99+' : totalCount}
                </motion.span>
              )}

              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-400 rounded-r-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-800 border border-white/10 
                   flex items-center justify-center text-slate-400 hover:text-white
                   transition-colors z-10"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Bottom section */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
            text-slate-400 hover:bg-red-500/10 hover:text-red-400
            transition-all duration-150
          `}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium"
              >
                Déconnexion
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
