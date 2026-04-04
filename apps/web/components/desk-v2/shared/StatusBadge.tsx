'use client';

import { STATUS_CONFIG } from '../types';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || {
    label: status,
    color: 'gray',
    icon: '❓',
  };

  const colorClasses = {
    gray: 'bg-slate-500/10 text-slate-600',
    amber: 'bg-amber-500/20 text-amber-600',
    blue: 'bg-blue-500/20 text-blue-600',
    purple: 'bg-purple-500/20 text-purple-600',
    green: 'bg-emerald-500/20 text-emerald-600',
    red: 'bg-red-500/20 text-red-600',
  }[config.color] || 'bg-slate-500/10 text-slate-600';

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }[size];

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${colorClasses}
        ${sizeClasses}
      `}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
