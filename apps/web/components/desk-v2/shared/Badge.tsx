'use client';

import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
}

const VARIANTS = {
  default: 'bg-slate-500/10 text-slate-600',
  success: 'bg-emerald-500/20 text-emerald-600',
  warning: 'bg-amber-500/20 text-amber-600',
  error: 'bg-red-500/20 text-red-600',
  info: 'bg-blue-500/20 text-blue-600',
};

const SIZES = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-sm',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        ${VARIANTS[variant]}
        ${SIZES[size]}
      `}
    >
      {children}
    </span>
  );
}
