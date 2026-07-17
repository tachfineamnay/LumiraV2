export type ProductionJobType = 'READING_GENERATION' | 'AUDIO_GENERATION';
export type ProductionJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface ProductionJob {
  id: string;
  orderId: string;
  orderNumber: string;
  type: ProductionJobType;
  status: ProductionJobStatus;
  stage: string;
  attempts: number;
  maxAttempts: number;
  requestedByExpertId: string;
  requestedByExpertName?: string;
  queuedAt: string;
  startedAt?: string;
  heartbeatAt?: string;
  completedAt?: string;
  failedAt?: string;
  error?: { code?: string; message: string } | null;
  orderStatus: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface ProductionSummary {
  queued: number;
  running: number;
  failed: number;
  awaitingReview: number;
  audioMissing: number;
}

export interface OrderControlCenter {
  workflowState:
    | 'WAITING_CLIENT'
    | 'READY_FOR_PRODUCTION'
    | 'IN_PRODUCTION'
    | 'AWAITING_REVIEW'
    | 'ASSETS_IN_PRODUCTION'
    | 'READY_FOR_DELIVERY'
    | 'DELIVERED'
    | 'INCIDENT';
  checklist: {
    paymentConfirmed: boolean;
    profileValidated: boolean;
    birthData: boolean;
    facePhoto: boolean;
    palmPhoto: boolean;
    consent: boolean;
  };
  production: ProductionJob | null;
  assets: {
    pdf: Record<string, unknown>;
    audio: Record<string, unknown>;
    email: Record<string, unknown>;
  };
}
