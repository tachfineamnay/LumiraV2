import { ConflictException } from '@nestjs/common';
import {
  READING_REQUIREMENTS_VERSION,
  RequiredReadingField,
  evaluateReadingRequirements,
} from '../users/reading-intake-policy';

export const READING_INTAKE_REQUIRED_CODE = 'READING_INTAKE_REQUIRED';
export const READING_INTAKE_INCOMPLETE_CODE = 'READING_INTAKE_INCOMPLETE';

export type ReadingIntakeReadinessStatus =
  | 'LEGACY'
  | 'MISSING'
  | 'DRAFT'
  | 'INVALID'
  | 'INCOMPLETE'
  | 'SEALED';

export interface ReadingIntakeReadiness {
  required: boolean;
  ready: boolean;
  status: ReadingIntakeReadinessStatus;
  sealedAt: string | null;
  contentHash: string | null;
  data: Record<string, unknown>;
  requirementsVersion: string | null;
  missingFields: RequiredReadingField[];
  invalidFields: RequiredReadingField[];
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

function baseResult(
  input: Omit<ReadingIntakeReadiness, 'requirementsVersion' | 'missingFields' | 'invalidFields'>,
): ReadingIntakeReadiness {
  return {
    ...input,
    requirementsVersion: null,
    missingFields: [],
    invalidFields: [],
  };
}

/**
 * New orders have an immutable, order-scoped intake. A SEALED database status
 * is not enough: the stored data must also satisfy the five production inputs.
 * Legacy orders remain readable and are handled by the compatibility workflow.
 */
export function readOrderIntakeReadiness(order: OrderWithReadingIntake): ReadingIntakeReadiness {
  if (order.intakeRequired !== true) {
    return baseResult({
      required: false,
      ready: true,
      status: 'LEGACY',
      sealedAt: null,
      contentHash: null,
      data: {},
    });
  }

  const intake = asRecord(order.readingIntake);
  if (Object.keys(intake).length === 0) {
    return baseResult({
      required: true,
      ready: false,
      status: 'MISSING',
      sealedAt: null,
      contentHash: null,
      data: {},
    });
  }

  const rawStatus = nonEmptyString(intake.status);
  const sealedAt = nonEmptyString(intake.sealedAt);
  const contentHash = nonEmptyString(intake.contentHash);
  const data = asRecord(intake.data);
  const hasSnapshot = Object.keys(data).length > 0;

  if (rawStatus !== 'SEALED') {
    return baseResult({
      required: true,
      ready: false,
      status: rawStatus === 'DRAFT' ? 'DRAFT' : 'INVALID',
      sealedAt,
      contentHash,
      data,
    });
  }

  if (!sealedAt || !contentHash || !hasSnapshot) {
    return baseResult({
      required: true,
      ready: false,
      status: 'INVALID',
      sealedAt,
      contentHash,
      data,
    });
  }

  const requirements = evaluateReadingRequirements(data, {
    requireExplicitIntentionMode: false,
    strictIntentionExclusivity: false,
  });
  const requirementsVersion =
    nonEmptyString(data.requirementsVersion) ?? READING_REQUIREMENTS_VERSION;

  return {
    required: true,
    ready: requirements.complete,
    status: requirements.complete ? 'SEALED' : 'INCOMPLETE',
    sealedAt,
    contentHash,
    data,
    requirementsVersion,
    missingFields: requirements.missingFields,
    invalidFields: requirements.invalidFields,
  };
}

export function assertOrderIntakeReady(order: OrderWithReadingIntake): void {
  const readiness = readOrderIntakeReadiness(order);
  if (readiness.ready) return;

  const incomplete = readiness.status === 'INCOMPLETE';
  throw new ConflictException({
    statusCode: 409,
    code: incomplete ? READING_INTAKE_INCOMPLETE_CODE : READING_INTAKE_REQUIRED_CODE,
    message: incomplete
      ? 'Le dossier scellé doit être complété avant toute prise en charge ou production.'
      : 'Le dossier client doit être finalisé et scellé avant toute prise en charge ou production.',
    intakeStatus: readiness.status,
    missingFields: readiness.missingFields,
    invalidFields: readiness.invalidFields,
  });
}
