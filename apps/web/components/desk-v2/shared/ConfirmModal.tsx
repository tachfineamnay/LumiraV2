'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
  children?: React.ReactNode;
}

const VARIANT_CONFIG = {
  danger: {
    gradient: 'from-red-500/10 to-red-600/10',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-600',
    icon: Trash2,
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    gradient: 'from-amber-500/10 to-amber-600/10',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-600',
    icon: AlertTriangle,
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  isLoading = false,
  children,
}: ConfirmModalProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !isLoading && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-desk-surface border border-desk-border rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`relative bg-gradient-to-r ${config.gradient} px-6 py-5 border-b border-desk-border`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold text-desk-text">{title}</h3>
              </div>
              {!isLoading && (
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1 rounded-lg hover:bg-desk-hover transition-colors"
                >
                  <X className="w-4 h-4 text-desk-muted" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-desk-muted leading-relaxed">{description}</p>
              {children}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 bg-desk-card border-t border-desk-border">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-desk-border text-desk-text
                           hover:bg-desk-hover transition-colors text-sm font-medium disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors
                           disabled:opacity-50 flex items-center justify-center gap-2 ${config.button}`}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
