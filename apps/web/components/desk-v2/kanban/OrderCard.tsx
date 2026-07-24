'use client';

import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Hand,
  Loader2,
  Play,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { KanbanColumnId, Order } from '../types';
import type { OrderViewer } from '../hooks/useSocket';

interface ProductionState {
  status?: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  stage?: string;
}

interface OrderCardProps {
  order: Order;
  currentExpertId?: string;
  columnId?: KanbanColumnId;
  viewers?: OrderViewer[];
  onClaim?: (orderId: string) => void;
}

export function OrderCard({
  order,
  currentExpertId,
  columnId,
  viewers = [],
  onClaim,
}: OrderCardProps) {
  const router = useRouter();
  const review = (order.expertReview ?? {}) as {
    assignedBy?: string;
    assignedName?: string;
    production?: ProductionState;
  };
  const pipeline = (order.generatedContent as unknown as {
    pipeline?: { qualityStatus?: 'PASS' | 'WARNING' | 'BLOCKED' };
  } | null)?.pipeline;
  const isAssignedToMe = review.assignedBy === currentExpertId;
  const isAssignedToOther = Boolean(review.assignedBy) && !isAssignedToMe;
  const activeProduction =
    review.production?.status === 'QUEUED' || review.production?.status === 'RUNNING';
  const timeAgo = formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: fr });

  const open = () => router.push(`/admin/studio/${order.id}`);
  const claim = (event: React.MouseEvent) => {
    event.stopPropagation();
    onClaim?.(order.id);
  };

  const action = getAction(order.status, Boolean(review.assignedBy));

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') open();
      }}
      className={`cursor-pointer rounded-xl border bg-desk-surface p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
        isAssignedToOther
          ? 'border-desk-border opacity-65'
          : isAssignedToMe
            ? 'border-emerald-500/35'
            : 'border-desk-border hover:border-amber-500/30 hover:bg-desk-card'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-desk-text">{order.orderNumber}</p>
          <p className="mt-1 truncate text-sm font-medium text-desk-text">
            {order.user.firstName} {order.user.lastName}
          </p>
        </div>
        <QualityBadge status={pipeline?.qualityStatus} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-desk-muted">
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeAgo}</span>
        {isAssignedToMe && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700"><UserCheck className="h-3 w-3" />À moi</span>}
        {isAssignedToOther && <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-700"><UserCheck className="h-3 w-3" />{review.assignedName || 'Prise'}</span>}
      </div>

      {order.user.profile?.specificQuestion && (
        <p className="mt-3 line-clamp-2 rounded-lg border border-desk-border bg-desk-card px-3 py-2 text-xs leading-5 text-desk-muted">
          {order.user.profile.specificQuestion}
        </p>
      )}

      {activeProduction && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {review.production?.status === 'QUEUED' ? 'En file' : 'Production en cours'}
        </div>
      )}

      {columnId === 'paid' && !review.assignedBy && onClaim ? (
        <button type="button" onClick={claim} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500/15 text-sm font-semibold text-amber-700 hover:bg-amber-500/25"><Hand className="h-4 w-4" />Prendre en charge</button>
      ) : (
        <button type="button" onClick={(event) => { event.stopPropagation(); open(); }} className={`mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold ${action.primary ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'border border-desk-border text-desk-muted hover:bg-desk-hover hover:text-desk-text'}`}>
          <ActionIcon status={order.status} />{action.label}
        </button>
      )}

      {viewers.length > 0 && (
        <p className="mt-2 text-center text-[10px] text-desk-subtle">
          {viewers.length === 1 ? '1 expert consulte' : `${viewers.length} experts consultent`}
        </p>
      )}
    </article>
  );
}

function getAction(status: string, assigned: boolean) {
  if (status === 'PAID') return { label: assigned ? 'Préparer la lecture' : 'Ouvrir', primary: assigned };
  if (status === 'PROCESSING') return { label: 'Voir l’avancement', primary: false };
  if (status === 'AWAITING_VALIDATION') return { label: 'Réviser', primary: true };
  if (status === 'COMPLETED') return { label: 'Consulter', primary: false };
  if (status === 'FAILED') return { label: 'Résoudre l’incident', primary: true };
  return { label: 'Ouvrir', primary: false };
}

function ActionIcon({ status }: { status: string }) {
  if (status === 'PROCESSING') return <Loader2 className="h-4 w-4 animate-spin" />;
  if (status === 'AWAITING_VALIDATION') return <Eye className="h-4 w-4" />;
  if (status === 'COMPLETED') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'FAILED') return <AlertTriangle className="h-4 w-4" />;
  return <Play className="h-4 w-4" />;
}

function QualityBadge({ status }: { status?: 'PASS' | 'WARNING' | 'BLOCKED' }) {
  if (status === 'PASS') return <span title="Qualité validée" className="text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span>;
  if (status === 'WARNING') return <span title="Avertissements" className="text-amber-600"><AlertTriangle className="h-5 w-5" /></span>;
  if (status === 'BLOCKED') return <span title="Corrections requises" className="text-red-600"><ShieldAlert className="h-5 w-5" /></span>;
  return null;
}
