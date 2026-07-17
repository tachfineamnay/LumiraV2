import { Prisma } from '@prisma/client';

export const PRODUCTION_JOB_TYPES = ['READING_GENERATION', 'AUDIO_GENERATION'] as const;
export type ProductionJobType = (typeof PRODUCTION_JOB_TYPES)[number];

export const PRODUCTION_JOB_STATUSES = [
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
] as const;
export type ProductionJobStatus = (typeof PRODUCTION_JOB_STATUSES)[number];

export interface ProductionJobError {
  code?: string;
  message: string;
}

export interface ProductionJobState {
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
  cancelledAt?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: ProductionJobError;
}

export interface ProductionAssetState {
  status: 'MISSING' | 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED';
  updatedAt?: string;
  error?: string;
  fileId?: string;
  storageKey?: string;
}

export interface ExpertReviewState extends Record<string, unknown> {
  assignedBy?: string;
  assignedName?: string;
  assignedAt?: string;
  production?: ProductionJobState;
  productionHistory?: ProductionJobState[];
  assets?: {
    audio?: ProductionAssetState;
    pdf?: ProductionAssetState;
    email?: ProductionAssetState;
  };
}

export type ProductionWorkflowState =
  | 'WAITING_CLIENT'
  | 'READY_FOR_PRODUCTION'
  | 'IN_PRODUCTION'
  | 'AWAITING_REVIEW'
  | 'ASSETS_IN_PRODUCTION'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERED'
  | 'INCIDENT';

export interface ProductionSummary {
  queued: number;
  running: number;
  failed: number;
  awaitingReview: number;
  audioMissing: number;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

export function readExpertReview(value: unknown): ExpertReviewState {
  return asRecord(value) as ExpertReviewState;
}

export function readCurrentProduction(value: unknown): ProductionJobState | undefined {
  const review = readExpertReview(value);
  const job = review.production;
  if (!job || typeof job !== 'object' || typeof job.id !== 'string') return undefined;
  return job;
}

export function isActiveProductionJob(job?: ProductionJobState): boolean {
  return job?.status === 'QUEUED' || job?.status === 'RUNNING';
}

/**
 * Prisma JSON fields reject `undefined` values nested in objects. Production
 * state is assembled from optional fields, so normalize it through JSON before
 * persistence. Dates are stored as ISO strings by design.
 */
export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
