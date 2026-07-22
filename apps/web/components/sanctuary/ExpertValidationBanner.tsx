'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Sparkles, Clock, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useClientNotifications, type ClientNotification } from '@/hooks/useClientNotifications';

interface ExpertValidationBannerProps {
  onDismiss?: () => void;
}

/**
 * Banner qui s'affiche quand un expert a validé une lecture
 * "Dernière mise à jour par l'Expert : il y a 2 minutes"
 */
export const ExpertValidationBanner: React.FC<ExpertValidationBannerProps> = ({ onDismiss }) => {
  const { latestExpertValidation, getRelativeTime, markAsRead } = useClientNotifications();

  if (!latestExpertValidation || latestExpertValidation.read) {
    return null;
  }

  const expertName = latestExpertValidation.metadata?.expertName || 'Un expert Lumira';
  const relativeTime = getRelativeTime(latestExpertValidation.createdAt);
  const orderNumber = latestExpertValidation.metadata?.orderNumber;

  const handleDismiss = () => {
    markAsRead(latestExpertValidation.id);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full"
      >
        <div className="relative overflow-hidden rounded-2xl border border-ivoire-400/20 bg-gradient-to-r from-brume-800/90 via-abyss-700/90 to-brume-800/90 backdrop-blur-xl shadow-[0_0_40px_rgba(212,175,55,0.15)]">
          {/* Animated shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-ivoire-400/4 to-transparent pointer-events-none animate-shimmer" />

          {/* Gold border glow */}
          <div className="absolute inset-0 rounded-2xl border border-ivoire-400/15 pointer-events-none" />

          <div className="relative p-4 md:p-5 flex items-center gap-4">
            {/* Icon with pulse effect */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-ivoire-400/18 blur-xl rounded-full animate-pulse" />
              <div className="relative w-12 h-12 rounded-full bg-ivoire-400/12 flex items-center justify-center border border-ivoire-400/25">
                <Eye className="w-6 h-6 text-ivoire-400" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-ivoire-400" />
                <span className="text-ivoire-400 font-playfair italic text-sm md:text-base truncate">
                  {expertName} a validé votre lecture
                </span>
              </div>
              <div className="flex items-center gap-2 text-brume-200 text-xs">
                <Clock className="w-3 h-3" />
                <span>{relativeTime}</span>
                {orderNumber && (
                  <>
                    <span className="text-brume-400">•</span>
                    <span className="text-brume-300">{orderNumber}</span>
                  </>
                )}
              </div>
            </div>

            {/* Action */}
            <Link
              href="/sanctuaire/draws"
              onClick={handleDismiss}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ivoire-400/8 hover:bg-ivoire-400/12 border border-ivoire-400/20 text-ivoire-400 text-sm font-medium transition-all hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] group"
            >
              <span className="hidden sm:inline">Voir ma lecture</span>
              <span className="sm:hidden">Voir</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-2 rounded-full hover:bg-brume-700/25 transition-colors text-brume-300 hover:text-ivoire-200"
              aria-label="Fermer la notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Badge de notification pour indiquer les notifications non lues
 */
export const NotificationBadge: React.FC<{ className?: string }> = ({ className }) => {
  const { unreadCount } = useClientNotifications();

  if (unreadCount === 0) return null;

  return (
    <span
      className={`absolute -top-1 -right-1 w-5 h-5 rounded-full bg-horizon-400 text-abyss-900 text-xs font-bold flex items-center justify-center shadow-lg ${className}`}
    >
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  );
};

/**
 * Liste déroulante des notifications (pour futur dropdown)
 */
export const NotificationList: React.FC = () => {
  const { notifications, markAsRead, markAllAsRead, getRelativeTime, isLoading } =
    useClientNotifications();

  if (isLoading) {
    return <div className="p-4 text-center text-brume-300 text-sm">Chargement...</div>;
  }

  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center">
        <Sparkles className="w-8 h-8 text-brume-400 mx-auto mb-2" />
        <p className="text-brume-300 text-sm">Aucune notification</p>
      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRead={() => markAsRead(notification.id)}
          getRelativeTime={getRelativeTime}
        />
      ))}

      {notifications.some((n) => !n.read) && (
        <div className="p-3 border-t border-ivoire-100/8">
          <button
            onClick={markAllAsRead}
            className="w-full text-center text-xs text-brume-300 hover:text-ivoire-200 transition-colors"
          >
            Tout marquer comme lu
          </button>
        </div>
      )}
    </div>
  );
};

const NotificationItem: React.FC<{
  notification: ClientNotification;
  onRead: () => void;
  getRelativeTime: (date: string) => string;
}> = ({ notification, onRead, getRelativeTime }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'EXPERT_VALIDATION':
        return <Eye className="w-4 h-4" />;
      case 'ORDER_COMPLETED':
      case 'CONTENT_READY':
        return <Sparkles className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  return (
    <button
      onClick={onRead}
      className={`w-full p-4 text-left border-b border-ivoire-100/[0.04] hover:bg-brume-700/25 transition-colors ${
        notification.read ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            notification.read
              ? 'bg-ivoire-100/8 text-brume-300'
              : 'bg-ivoire-400/12 text-ivoire-400'
          }`}
        >
          {getIcon()}
        </div>
        <div className="flex-grow min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              notification.read ? 'text-brume-200' : 'text-ivoire-200'
            }`}
          >
            {notification.title}
          </p>
          <p className="text-xs text-brume-300 line-clamp-2 mt-0.5">{notification.message}</p>
          <p className="text-xs text-brume-400 mt-1">{getRelativeTime(notification.createdAt)}</p>
        </div>
        {!notification.read && (
          <div className="w-2 h-2 rounded-full bg-horizon-400 flex-shrink-0 mt-2" />
        )}
      </div>
    </button>
  );
};
