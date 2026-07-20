import { ConflictException } from '@nestjs/common';

export const READING_INTAKE_REQUIRED_CODE = 'READING_INTAKE_REQUIRED';

export type ReadingIntakeReadinessStatus = 'LEGACY' | 'MISSING' | 'DRAFT' | 'INVALID' | 'SEALED';

export interface ReadingIntakeReadiness {
  required: boolean;
  ready: boolean;
  status: ReadingIntakeReadinessStatus;
  sealedAt: string | null;
  contentHash: string | null;
  data: Record<string, unknown>;
}

export interface OrderWithReadingIntake {
  intakeRequired?: boolean | null;
  readingIntake?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmptyString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * New orders have an immutable, order-scoped intake. Legacy orders deliberately
 * remain processable through their historical profile/clientInputs fallback.
 */
export function readOrderIntakeReadiness(order: OrderWithReadingIntake): ReadingIntakeReadiness {
  if (order.intakeRequired !== true) {
    return {
      required: false,
      ready: true,
      status: 'LEGACY',
      sealedAt: null,
      contentHash: null,
      data: {},
    };
  }

  const intake = asRecord(order.readingIntake);
  if (Object.keys(intake).length === 0) {
    return {
      required: true,
      ready: false,
      status: 'MISSING',
      sealedAt: null,
      contentHash: null,
      data: {},
    };
  }

  const rawStatus = nonEmptyString(intake.status);
  const sealedAt = nonEmptyString(intake.sealedAt);
  const contentHash = nonEmptyString(intake.contentHash);
  const data = asRecord(intake.data);
  const hasSnapshot = Object.keys(data).length > 0;

  if (rawStatus !== 'SEALED') {
    return {
      required: true,
      ready: false,
      status: rawStatus === 'DRAFT' ? 'DRAFT' : 'INVALID',
      sealedAt,
      contentHash,
      data,
    };
  }

  const ready = Boolean(sealedAt && contentHash && hasSnapshot);
  return {
    required: true,
    ready,
    status: ready ? 'SEALED' : 'INVALID',
    sealedAt,
    contentHash,
    data,
  };
}

export function assertOrderIntakeReady(order: OrderWithReadingIntake): void {
  const readiness = readOrderIntakeReadiness(order);
  if (readiness.ready) return;

  throw new ConflictException({
    statusCode: 409,
    code: READING_INTAKE_REQUIRED_CODE,
    message:
      'Le dossier client doit être finalisé et scellé avant toute prise en charge ou production.',
    intakeStatus: readiness.status,
  });
}
