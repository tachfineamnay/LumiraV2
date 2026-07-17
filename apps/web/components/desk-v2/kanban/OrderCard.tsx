'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Eye,
  GripVertical,
  Hand,
  Loader2,
  Play,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { Order, LEVEL_CONFIG, KanbanColumnId } from '../types';
import type { OrderViewer } from '../hooks/useSocket';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProductionState {
  id?: string;
  status?: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  stage?: string;
  type?: 'READING_GENERATION' | 'AUDIO_GENERATION';
}

interface OrderCardProps {
  order: Order;
  isDragging?: boolean;
  currentExpertId?: string;
  columnId?: KanbanColumnId;
  viewers?: OrderViewer[];
  onClaim?: (orderId: string) => void;
  onGenerate?: (orderId: string) => void;
  generatingOrderId?: string | null;
}

export function OrderCard({
  order,
  isDragging,
  currentExpertId,
  columnId,
  viewers = [],
  onClaim,
  onGenerate,
  generatingOrderId,
}: OrderCardProps) {
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

  const review = (order.expertReview || {}) as {
    assignedBy?: string;
    assignedName?: string;
    production?: ProductionState;
  };
  const assignedBy = review.assignedBy;
  const assignedName = review.assignedName;
  const production = review.production;
  const isAssignedToMe = assignedBy === currentExpertId;
  const isAssignedToOther = !!assignedBy && !isAssignedToMe;
  const isStarting = generatingOrderId === order.id;
  const hasActiveProduction = production?.status === 'QUEUED' || production?.status === 'RUNNING';
  const hasProductionIncident = production?.status === 'FAILED';

  const handleClick = () => {
    router.push(`/admin/studio/${order.id}`);
  };

  const handleClaim = (event: React.MouseEvent) => {
    event.stopPropagation();
    onClaim?.(order.id);
  };

  const handleGenerate = (event: React.MouseEvent) => {
    event.stopPropagation();
    onGenerate?.(order.id);
  };

  const isBeingDragged = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative rounded-xl border transition-all duration-200
        ${
          isBeingDragged
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
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 p-2 min-w-[36px] min-h-[36px] rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100
                   hover:bg-desk-hover cursor-grab active:cursor-grabbing transition-opacity flex items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-desk-subtle" />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{levelConfig.icon}</span>
              <span className="font-mono text-sm font-medium text-desk-text">
                {order.orderNumber}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getLevelBadgeColor(order.level)}`}
              >
                {levelConfig.name}
              </span>
              {isAssignedToMe && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600">
                  <UserCheck className="w-3 h-3" /> À moi
                </span>
              )}
              {isAssignedToOther && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-600">
                  <UserCheck className="w-3 h-3" /> {assignedName || 'Prise'}
                </span>
              )}
            </div>
          </div>
          <span className="text-lg font-semibold text-amber-600">
            {(order.amount / 100).toFixed(0)}€
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-xs font-medium text-white">
            {order.user.firstName?.[0]}
            {order.user.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-desk-text truncate">
              {order.user.firstName} {order.user.lastName}
            </div>
            <div className="text-xs text-desk-subtle truncate">{order.user.email}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-desk-subtle">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeAgo}</span>
          </div>
          {hasActiveProduction ? (
            <div className="flex items-center gap-1 text-blue-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{production?.status === 'QUEUED' ? 'En file' : 'Production'}</span>
            </div>
          ) : hasProductionIncident ? (
            <div className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Incident</span>
            </div>
          ) : order.status === 'AWAITING_VALIDATION' ? (
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

        {production?.stage && hasActiveProduction && (
          <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-2.5 py-2 text-xs text-blue-700">
            {production.stage === 'GENERATING_READING'
              ? 'La lecture se génère côté serveur. Vous pouvez quitter cette page.'
              : production.stage.replaceAll('_', ' ').toLowerCase()}
          </div>
        )}

        {order.user.profile?.specificQuestion && (
          <div className="mt-3 p-2 rounded-lg bg-desk-card border border-desk-border">
            <p className="text-xs text-desk-muted line-clamp-2">
              &quot;{order.user.profile.specificQuestion}&quot;
            </p>
          </div>
        )}

        {columnId === 'paid' && !assignedBy && onClaim && (
          <button
            onClick={handleClaim}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg bg-amber-500/10 text-amber-600 text-sm font-medium hover:bg-amber-500/20 transition-colors"
          >
            <Hand className="w-4 h-4" />
            Prendre en charge
          </button>
        )}

        {columnId === 'paid' && isAssignedToMe && onGenerate && !hasActiveProduction && (
          <button
            onClick={handleGenerate}
            disabled={isStarting}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60"
          >
            {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Lancer la production
          </button>
        )}

        {viewers.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {viewers.slice(0, 3).map((viewer) => (
                <div
                  key={viewer.expertId}
                  title={viewer.expertEmail}
                  className="w-5 h-5 rounded-full bg-blue-500 border-2 border-desk-surface flex items-center justify-center text-[9px] font-bold text-white"
                >
                  {viewer.expertEmail[0]?.toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-desk-subtle">
              {viewers.length === 1 ? '1 expert consulte' : `${viewers.length} experts consultent`}
            </span>
          </div>
        )}
      </div>

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
