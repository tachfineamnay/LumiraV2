'use client';

import { LEVEL_CONFIG } from '../types';

interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function LevelBadge({ level, size = 'sm', showIcon = true }: LevelBadgeProps) {
  const config = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG[1];

  const colorClasses = {
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  }[config.color];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  }[size];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium border
        ${colorClasses}
        ${sizeClasses}
      `}
    >
      {showIcon && <span>{config.icon}</span>}
      <span>{config.name}</span>
    </span>
  );
}
