import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PreparedOnboardingPhoto } from '../uploads/private-onboarding-photo.service';
import { IntentionMode } from '../users/reading-intake-policy';
import { ProfileFieldKey } from './profile-field-catalog';

export type ProfileAmendmentStatus =
  | 'REQUESTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';
export type PalmRole = 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';
export type AmendmentPhotoKind = 'face' | 'palm';

export interface ProfileAmendmentRow {
  id: string;
  orderId: string;
  userId: string;
  readingIntakeId: string | null;
  kind: 'PROFILE_FIELDS';
  requestedFields: string[];
  reason: string;
  status: ProfileAmendmentStatus;
  data: Prisma.JsonValue;
  contentHash: string | null;
  revision: number;
  requestedByExpertId: string;
  requestedAt: Date;
  submittedAt: Date | null;
  reviewedByExpertId: string | null;
  reviewedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReadingIntakeRow {
  id: string;
  status: string;
  data: Prisma.JsonValue;
  contentHash: string | null;
  sealedAt: Date | null;
}

export interface PreparedProfileAssets {
  face: PreparedOnboardingPhoto | null;
  palm: PreparedOnboardingPhoto | null;
}

export const ACTIVE_PROFILE_AMENDMENT_STATUSES: ProfileAmendmentStatus[] = [
  'REQUESTED',
  'DRAFT',
  'SUBMITTED',
];

const PUBLIC_STATUS: Record<ProfileAmendmentStatus, string> = {
  REQUESTED: 'REQUESTED',
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

const PRIVATE_ASSET_KEYS = new Set([
  'storageRef',
  'key',
  'etag',
  'versionId',
  'sha256',
  'base64',
]);

const LEGACY_TEXT_FIELDS = [
  'usageName',
  'birthTime',
  'birthPlace',
  'specificQuestion',
  'objective',
  'highs',
  'lows',
  'lifeEvents',
  'strongSide',
  'weakSide',
  'strongZone',
  'weakZone',
  'deliveryStyle',
  'ailments',
  'fears',
  'rituals',
] as const;

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

export function isPalmRole(value: unknown): value is PalmRole {
  return value === 'PALM_LEFT' || value === 'PALM_RIGHT' || value === 'PALM_UNKNOWN';
}

export function palmRole(value: unknown): PalmRole {
  return isPalmRole(value) ? value : 'PALM_UNKNOWN';
}

export function parseAmendmentExpiry(value?: string): Date {
  const expiresAt = value ? new Date(value) : new Date(Date.now() + 7 * 86_400_000);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new BadRequestException("La date d'expiration doit être dans le futur");
  }
  if (expiresAt.getTime() > Date.now() + 30 * 86_400_000) {
    throw new BadRequestException('Une demande de complément ne peut pas dépasser 30 jours');
  }
  return expiresAt;
}

export function staleAmendmentConflict(): ConflictException {
  return new ConflictException({
    code: 'AMENDMENT_REVISION_CHANGED',
    message: 'La demande a changé. Rechargez-la avant de continuer.',
  });
}

/**
 * Build a strict reading-only JSON projection from either a Prisma UserProfile,
 * an intake draft or a previously sealed profile. No technical Prisma columns,
 * relation objects, Date instances, BigInt or undefined values survive.
 */
export function normalizeSnapshotProfile(value: unknown): Record<string, unknown> {
  const source = asRecord(value);
  const profile: Record<string, unknown> = {};

  for (const field of LEGACY_TEXT_FIELDS) {
    profile[field] = nullableText(source[field]);
  }

  profile.birthDate = normalizeCalendarDate(source.birthDate);
  profile.facePhotoUrl =
    nonEmptyString(source.facePhotoUrl) ?? nonEmptyString(source.facePhoto);
  profile.palmPhotoUrl =
    nonEmptyString(source.palmPhotoUrl) ?? nonEmptyString(source.palmPhoto);
  profile.palmRole = palmRole(source.palmRole);
  profile.openReading = source.openReading === true;
  profile.intentionMode = normalizeIntentionMode(source, profile);
  profile.lifeAreas = normalizeLifeAreas(source.lifeAreas);
  profile.pace =
    typeof source.pace === 'number' && Number.isFinite(source.pace)
      ? Math.min(100, Math.max(0, Math.round(source.pace)))
      : null;

  return profile;
}

export function hasOriginalInputProjection(clientInputs: Record<string, unknown>): boolean {
  const existing = asRecord(clientInputs.readingIntake);
  const hasCaptureBoundary = Boolean(
    nonEmptyString(existing.sealedAt) || nonEmptyString(existing.capturedAt),
  );
  return Boolean(
    hasCaptureBoundary &&
      nonEmptyString(existing.contentHash) &&
      Object.keys(asRecord(existing.profile)).length > 0,
  );
}

export function resolveOriginalInput(
  clientInputs: Record<string, unknown>,
  intake: ReadingIntakeRow | null,
  options: {
    intakeRequired?: boolean;
    legacyProfile?: unknown;
    capturedAt?: Date;
  } = {},
): Record<string, unknown> {
  const existing = asRecord(clientInputs.readingIntake);
  if (hasOriginalInputProjection(clientInputs)) return existing;

  if (intake?.status === 'SEALED' && intake.sealedAt && intake.contentHash) {
    return {
      version: 'relational-reading-intake-v1',
      sealedAt: intake.sealedAt.toISOString(),
      contentHash: intake.contentHash,
      profile: normalizeSnapshotProfile(intake.data),
      assets: {},
      amendmentIds: [],
    };
  }

  if (options.intakeRequired === false) {
    const capturedAt = options.capturedAt ?? new Date();
    const profile = normalizeSnapshotProfile(options.legacyProfile);
    const core = {
      version: 'legacy-profile-capture-v1',
      sealedAt: capturedAt.toISOString(),
      capturedAt: capturedAt.toISOString(),
      capturedFrom: 'LEGACY_USER_PROFILE',
      profile,
      assets: {},
      amendmentIds: [],
    };
    return {
      ...core,
      contentHash: hashCanonicalJson(core),
    };
  }

  const capturedAt = options.capturedAt ?? new Date();
  const capturedFrom = !intake
    ? 'MISSING_READING_INTAKE'
    : intake.status === 'DRAFT'
      ? 'READING_INTAKE_DRAFT'
      : 'READING_INTAKE_INCOMPLETE';
  const core = {
    version: 'incomplete-reading-intake-capture-v1',
    capturedAt: capturedAt.toISOString(),
    capturedFrom,
    sourceStatus: intake?.status ?? 'MISSING',
    profile: normalizeSnapshotProfile(intake?.data ?? options.legacyProfile),
    assets: {},
    amendmentIds: [],
  };
  return {
    ...core,
    contentHash: hashCanonicalJson(core),
  };
}

export function persistablePreparedAsset(
  asset: PreparedOnboardingPhoto,
): Record<string, unknown> {
  return {
    storageRef: asset.storageRef,
    key: asset.key,
    contentType: asset.contentType,
    size: asset.size,
    etag: asset.etag,
    versionId: asset.versionId,
    role: asset.role,
    width: asset.width,
    height: asset.height,
    orientation: asset.orientation,
    sha256: asset.sha256,
    analysisLimited: asset.analysisLimited,
    warnings: asset.warnings,
  };
}

export function persistablePreparedAssets(
  assets: PreparedProfileAssets,
): Record<string, unknown> {
  return {
    preparedAssets: {
      face: assets.face ? persistablePreparedAsset(assets.face) : null,
      palm: assets.palm ? persistablePreparedAsset(assets.palm) : null,
    },
  };
}

export function hashCanonicalJson(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

export function toPublicProfileAmendment(row: ProfileAmendmentRow) {
  const sanitizedData = sanitizeAmendmentData(asRecord(row.data));
  return {
    id: row.id,
    orderId: row.orderId,
    kind: row.kind,
    requestedFields: row.requestedFields,
    reason: row.reason,
    status: row.status,
    displayStatus: displayStatus(row),
    data: sanitizedData,
    revision: row.revision,
    requestedAt: row.requestedAt,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function sanitizeAmendmentData(value: Record<string, unknown>) {
  const photoFields = new Set<string>();
  const currentValues = asRecord(value.values);
  for (const field of ['facePhotoUrl', 'palmPhotoUrl'] as const) {
    if (isPrivateStorageRef(currentValues[field])) photoFields.add(field);
  }

  const sanitized = sanitizePrivateReferences(value);
  const output = asRecord(sanitized);
  delete output.photoFields;
  if (photoFields.size > 0) output.photoFields = Array.from(photoFields).sort();
  return output;
}

function displayStatus(row: ProfileAmendmentRow): string {
  if (
    (row.status === 'REQUESTED' || row.status === 'DRAFT') &&
    row.expiresAt.getTime() <= Date.now()
  ) {
    return 'EXPIRED';
  }
  return PUBLIC_STATUS[row.status];
}

function sanitizePrivateReferences(value: unknown): unknown {
  if (isPrivateStorageRef(value)) return null;
  if (Array.isArray(value)) return value.map((item) => sanitizePrivateReferences(item));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !PRIVATE_ASSET_KEYS.has(key))
      .map(([key, nested]) => [key, sanitizePrivateReferences(nested)]),
  );
}

function isPrivateStorageRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('s3://onboarding/');
}

function canonicalStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`)
    .join(',')}}`;
}

function nullableText(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeCalendarDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const normalized = nonEmptyString(value);
  if (!normalized) return null;
  const dateOnly = normalized.includes('T') ? normalized.slice(0, 10) : normalized;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : normalized;
}

function normalizeIntentionMode(
  source: Record<string, unknown>,
  normalized: Record<string, unknown>,
): IntentionMode | null {
  if (
    source.intentionMode === 'QUESTION' ||
    source.intentionMode === 'SITUATION' ||
    source.intentionMode === 'OPEN'
  ) {
    return source.intentionMode;
  }
  if (source.openReading === true) return 'OPEN';
  if (nonEmptyString(normalized.specificQuestion)) return 'QUESTION';
  if (nonEmptyString(normalized.objective)) return 'SITUATION';
  return null;
}

function normalizeLifeAreas(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const output: Record<string, unknown> = {};
  for (const [key, rawEntry] of Object.entries(value as Record<string, unknown>)) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
    const entry = asRecord(rawEntry);
    const state = nonEmptyString(entry.state);
    if (!state) continue;
    const note = nonEmptyString(entry.note);
    output[key] = note ? { state, note } : { state };
  }
  return Object.keys(output).length > 0 ? output : null;
}

export function requestedPhotoFields(fields: ProfileFieldKey[]): AmendmentPhotoKind[] {
  return [
    ...(fields.includes('facePhotoUrl') ? (['face'] as AmendmentPhotoKind[]) : []),
    ...(fields.includes('palmPhotoUrl') ? (['palm'] as AmendmentPhotoKind[]) : []),
  ];
}
