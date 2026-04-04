'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { Clock, Sparkles, GripVertical, ExternalLink, Eye, UserCheck, Hand } from 'lucide-react';
import { Order, LEVEL_CONFIG, KanbanColumnId } from '../types';
import type { OrderViewer } from '../hooks/useSocket';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface OrderCardProps {
  order: Order;
  isDragging?: boolean;
  currentExpertId?: string;
  columnId?: KanbanColumnId;
  viewers?: OrderViewer[];
  onClaim?: (orderId: string) => void;
}

export function OrderCard({ order, isDragging, currentExpertId, columnId, viewers = [], onClaim }: OrderCardProps) {
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

  // Assignment info
  const assignedBy = (order.expertReview as { assignedBy?: string })?.assignedBy;
  const assignedName = (order.expertReview as { assignedName?: string })?.assignedName;
  const isAssignedToMe = assignedBy === currentExpertId;
  const isAssignedToOther = !!assignedBy && !isAssignedToMe;

  const handleClick = () => {
    router.push(`/admin/studio/${order.id}`);
  };

  const handleClaim = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClaim?.(order.id);
  };

  const isBeingDragged = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative rounded-xl border transition-all duration-200
        ${isBeingDragged 
          ? 'bg-desk-surface border-amber-500/50 shadow-xl shadow-amber-500/10 scale-105 rotate-2 cursor-grabbing z-50' 
          : isAssignedToOther
            ? 'bg-desk-surface/60 border-desk-border opacity-60 cursor-pointer'
            : isAssignedToMe
              ? 'bg-desk-surface border-emerald-500/40 ring-1 ring-emerald-500/20 cursor-pointer'
              : 'bg-desk-surface border-desk-border hover:border-desk-border hover:bg-desk-card cursor-pointer'
        }
      `}
      onClick={!isBeingDragged ? handleClick : undefined}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100
                   hover:bg-desk-hover cursor-grab active:cursor-grabbing transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-desk-subtle" />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{levelConfig.icon}</span>
              <span className="font-mono text-sm font-medium text-desk-text">
                {order.orderNumber}
              </span>
            </div>
            <span className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
              ${getLevelBadgeColor(order.level)}
            `}>
              {levelConfig.name}
            </span>
            {/* Assignment badge */}
            {isAssignedToMe && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600">
                <UserCheck className="w-3 h-3" />
                Ma commande
              </span>
            )}
            {isAssignedToOther && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-600">
                <UserCheck className="w-3 h-3" />
                {assignedName || 'Prise'}
              </span>
            )}
          </div>
          <span className="text-lg font-semibold text-amber-600">
            {(order.amount / 100).toFixed(0)}€
          </span>
        </div>

        {/* Client info */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 
                          flex items-center justify-center text-xs font-medium text-white">
            {order.user.firstName?.[0]}{order.user.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-desk-text truncate">
              {order.user.firstName} {order.user.lastName}
            </div>
            <div className="text-xs text-desk-subtle truncate">
              {order.user.email}
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-desk-subtle">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeAgo}</span>
          </div>
          {order.status === 'AWAITING_VALIDATION' ? (
            <div className="flex items-center gap-1 text-purple-600 animate-pulse">
              <Eye className="w-3.5 h-3.5" />
              <span>À valider</span>
            </div>
          ) : order.generatedContent ? (
            <div className="flex items-center gap-1 text-emerald-600">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Généré</span>
            </div>
          ) : null}
        </div>

        {/* Question preview */}
        {order.user.profile?.specificQuestion && (
          <div className="mt-3 p-2 rounded-lg bg-desk-card border border-desk-border">
            <p className="text-xs text-desk-muted line-clamp-2">
              &quot;{order.user.profile.specificQuestion}&quot;
            </p>
          </div>
        )}

        {/* Claim button — shown on unassigned orders in paid column */}
        {columnId === 'paid' && !assignedBy && onClaim && (
          <button
            onClick={handleClaim}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-amber-500/10 text-amber-600 text-xs font-medium
                       hover:bg-amber-500/20 transition-colors"
          >
            <Hand className="w-3.5 h-3.5" />
            Prendre cette commande
          </button>
        )}

        {/* Presence viewers */}
        {viewers.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {viewers.slice(0, 3).map(v => (
                <div
                  key={v.expertId}
                  title={v.expertEmail}
                  className="w-5 h-5 rounded-full bg-blue-500 border-2 border-desk-surface
                             flex items-center justify-center text-[9px] font-bold text-white"
                >
                  {v.expertEmail[0]?.toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-desk-subtle">
              {viewers.length === 1 ? '1 expert consulte' : `${viewers.length} experts consultent`}
            </span>
          </div>
        )}
      </div>

      {/* Hover action */}
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1 text-xs text-amber-600">
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
      return 'bg-emerald-500/20 text-emerald-600';
    case 2:
      return 'bg-blue-500/20 text-blue-600';
    case 3:
      return 'bg-purple-500/20 text-purple-600';
    case 4:
      return 'bg-amber-500/20 text-amber-600';
    default:
      return 'bg-slate-500/20 text-slate-600';
  }
}
