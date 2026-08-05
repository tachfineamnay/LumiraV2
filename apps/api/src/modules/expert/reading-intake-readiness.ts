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
  source: 'LEGACY' | 'READING_INTAKE' | 'EFFECTIVE_SNAPSHOT';
  sealedAt: string | null;
  contentHash: string | null;
  data: Record<string, unknown>;
  requirementsVersion: string | null;
  missingFields: RequiredReadingField[];
  invalidFields: RequiredReadingField[];
}

export interface OrderWithReadingIntake {
  intakeRequired?: boolean | null;
  clientInputs?: unknown;
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

function semanticResult(input: {
  source: 'READING_INTAKE' | 'EFFECTIVE_SNAPSHOT';
  profile: Record<string, unknown>;
  sealedAt: string | null;
  contentHash: string | null;
  requirementsVersion: string | null;
}): ReadingIntakeReadiness {
  const requirements = evaluateReadingRequirements(input.profile, {
    requireExplicitIntentionMode: false,
    strictIntentionExclusivity: true,
  });
  return {
    required: true,
    ready: Boolean(input.sealedAt && input.contentHash && requirements.complete),
    status:
      input.sealedAt && input.contentHash
        ? requirements.complete
          ? 'SEALED'
          : 'INCOMPLETE'
        : 'INVALID',
    source: input.source,
    sealedAt: input.sealedAt,
    contentHash: input.contentHash,
    data: input.profile,
    requirementsVersion: input.requirementsVersion ?? READING_REQUIREMENTS_VERSION,
    missingFields: requirements.missingFields,
    invalidFields: requirements.invalidFields,
  };
}

/**
 * Approved effective snapshots are the production source of truth. The original
 * ReadingIntake remains immutable and is used only when no approved projection
 * exists. A SEALED status alone never makes an incomplete dossier producible.
 */
export function readOrderIntakeReadiness(order: OrderWithReadingIntake): ReadingIntakeReadiness {
  if (order.intakeRequired !== true) {
    return baseResult({
      required: false,
      ready: true,
      status: 'LEGACY',
      source: 'LEGACY',
      sealedAt: null,
      contentHash: null,
      data: {},
    });
  }

  const clientInputs = asRecord(order.clientInputs);
  const effective = asRecord(clientInputs.readingIntakeEffective);
  const effectiveProfile = asRecord(effective.profile);
  const effectiveSnapshotId = nonEmptyString(effective.snapshotId);
  if (effectiveSnapshotId || Object.keys(effectiveProfile).length > 0) {
    return semanticResult({
      source: 'EFFECTIVE_SNAPSHOT',
      profile: effectiveProfile,
      sealedAt:
        nonEmptyString(effective.effectiveAt) ?? nonEmptyString(effective.sealedAt),
      contentHash: nonEmptyString(effective.contentHash),
      requirementsVersion: nonEmptyString(effective.requirementsVersion),
    });
  }

  const intake = asRecord(order.readingIntake);
  if (Object.keys(intake).length === 0) {
    return baseResult({
      required: true,
      ready: false,
      status: 'MISSING',
      source: 'READING_INTAKE',
      sealedAt: null,
      contentHash: null,
      data: {},
    });
  }

  const rawStatus = nonEmptyString(intake.status);
  const sealedAt = nonEmptyString(intake.sealedAt);
  const contentHash = nonEmptyString(intake.contentHash);
  const data = asRecord(intake.data);

  if (rawStatus !== 'SEALED') {
    return baseResult({
      required: true,
      ready: false,
      status: rawStatus === 'DRAFT' ? 'DRAFT' : 'INVALID',
      source: 'READING_INTAKE',
      sealedAt,
      contentHash,
      data,
    });
  }

  if (Object.keys(data).length === 0) {
    return baseResult({
      required: true,
      ready: false,
      status: 'INVALID',
      source: 'READING_INTAKE',
      sealedAt,
      contentHash,
      data,
    });
  }

  return semanticResult({
    source: 'READING_INTAKE',
    profile: data,
    sealedAt,
    contentHash,
    requirementsVersion: nonEmptyString(data.requirementsVersion),
  });
}

export function assertOrderIntakeReady(order: OrderWithReadingIntake): void {
  const readiness = readOrderIntakeReadiness(order);
  if (readiness.ready) return;

  const incomplete = readiness.status === 'INCOMPLETE';
  throw new ConflictException({
    statusCode: 409,
    code: incomplete ? READING_INTAKE_INCOMPLETE_CODE : READING_INTAKE_REQUIRED_CODE,
    message: incomplete
      ? 'Le dossier effectif doit être complété avant toute prise en charge ou production.'
      : 'Le dossier client doit être finalisé et scellé avant toute prise en charge ou production.',
    intakeStatus: readiness.status,
    intakeSource: readiness.source,
    missingFields: readiness.missingFields,
    invalidFields: readiness.invalidFields,
  });
}
