'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { Clock, Sparkles, GripVertical, ExternalLink } from 'lucide-react';
import { Order, LEVEL_CONFIG } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface OrderCardProps {
  order: Order;
  isDragging?: boolean;
}

export function OrderCard({ order, isDragging }: OrderCardProps) {
  const router = useRouter();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const levelConfig = LEVEL_CONFIG[order.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG[1];
  const timeAgo = formatDistanceToNow(new Date(order.createdAt), { 
    addSuffix: true,
    locale: fr,
  });

  const handleClick = () => {
    router.push(`/admin/studio/${order.id}`);
  };

  const isBeingDragged = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative rounded-xl border transition-all duration-200
        ${isBeingDragged 
          ? 'bg-slate-800 border-amber-500/50 shadow-xl shadow-amber-500/10 scale-105 rotate-2 cursor-grabbing z-50' 
          : 'bg-slate-800/50 border-white/5 hover:border-white/10 hover:bg-slate-800/80 cursor-pointer'
        }
      `}
      onClick={!isBeingDragged ? handleClick : undefined}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100
                   hover:bg-white/5 cursor-grab active:cursor-grabbing transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-slate-500" />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{levelConfig.icon}</span>
              <span className="font-mono text-sm font-medium text-white">
                {order.orderNumber}
              </span>
            </div>
            <span className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
              ${getLevelBadgeColor(order.level)}
            `}>
              {levelConfig.name}
            </span>
          </div>
          <span className="text-lg font-semibold text-amber-400">
            {(order.amount / 100).toFixed(0)}€
          </span>
        </div>

        {/* Client info */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 
                          flex items-center justify-center text-xs font-medium text-white">
            {order.user.firstName?.[0]}{order.user.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {order.user.firstName} {order.user.lastName}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {order.user.email}
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeAgo}</span>
          </div>
          {order.generatedContent && (
            <div className="flex items-center gap-1 text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Généré</span>
            </div>
          )}
        </div>

        {/* Question preview */}
        {order.user.profile?.specificQuestion && (
          <div className="mt-3 p-2 rounded-lg bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-400 line-clamp-2">
              &quot;{order.user.profile.specificQuestion}&quot;
            </p>
          </div>
        )}
      </div>

      {/* Hover action */}
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1 text-xs text-amber-400">
          <span>Ouvrir</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}

function getLevelBadgeColor(level: number): string {
  switch (level) {
    case 1:
      return 'bg-emerald-500/20 text-emerald-400';
    case 2:
      return 'bg-blue-500/20 text-blue-400';
    case 3:
      return 'bg-purple-500/20 text-purple-400';
    case 4:
      return 'bg-amber-500/20 text-amber-400';
    default:
      return 'bg-slate-500/20 text-slate-400';
  }
}
