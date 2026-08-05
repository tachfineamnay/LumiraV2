import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PreparedOnboardingPhoto } from '../uploads/private-onboarding-photo.service';

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
  reviewedByExpertId: string | null;
  requestedAt: Date;
  submittedAt: Date | null;
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

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(asRecord(value)).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
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

export function normalizeSnapshotProfile(value: unknown): Record<string, unknown> {
  const profile = asRecord(value);
  return {
    ...profile,
    facePhotoUrl: nonEmptyString(profile.facePhotoUrl) ?? nonEmptyString(profile.facePhoto),
    palmPhotoUrl: nonEmptyString(profile.palmPhotoUrl) ?? nonEmptyString(profile.palmPhoto),
  };
}

export function hasOriginalInputProjection(clientInputs: Record<string, unknown>): boolean {
  const existing = asRecord(clientInputs.readingIntake);
  return Boolean(
    nonEmptyString(existing.sealedAt) &&
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
    };
  }

  if (options.intakeRequired !== false) {
    throw new ConflictException('Le dossier scellé original est introuvable');
  }

  const profile = normalizeSnapshotProfile(options.legacyProfile);
  if (Object.keys(profile).length === 0) {
    throw new ConflictException('Le profil historique servant de base est introuvable');
  }
  const sealedAt = (options.capturedAt ?? new Date()).toISOString();
  const core = {
    version: 'legacy-profile-capture-v1',
    sealedAt,
    legacy: true,
    profile,
    assets: {},
  };
  return {
    ...core,
    contentHash: hashCanonicalJson(core),
  };
}

export function persistablePreparedAsset(asset: PreparedOnboardingPhoto) {
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
    ...(assets.face ? { faceAsset: persistablePreparedAsset(assets.face) } : {}),
    ...(assets.palm ? { palmAsset: persistablePreparedAsset(assets.palm) } : {}),
  };
}

export function hashCanonicalJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = canonicalize((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}

export function sanitizePublicAmendmentData(value: Prisma.JsonValue): Record<string, unknown> {
  const data = { ...asRecord(value) };
  const values = { ...asRecord(data.values) };
  const previousValues = { ...asRecord(data.previousValues) };
  const photoFields: string[] = [];
  for (const key of ['facePhotoUrl', 'palmPhotoUrl'] as const) {
    if (nonEmptyString(values[key])) photoFields.push(key);
    delete values[key];
    delete previousValues[key];
  }
  delete data.faceAsset;
  delete data.palmAsset;
  data.values = values;
  data.previousValues = previousValues;
  data.photoFields = photoFields;
  return data;
}

export function toPublicProfileAmendment(row: ProfileAmendmentRow) {
  const data = sanitizePublicAmendmentData(row.data);
  return {
    id: row.id,
    orderId: row.orderId,
    kind: row.kind,
    requestedFields: row.requestedFields,
    reason: row.reason,
    status: row.status,
    displayStatus:
      row.status === 'CANCELLED' && data.cancelReason === 'EXPIRED' ? 'EXPIRED' : row.status,
    data,
    contentHash: row.contentHash,
    revision: row.revision,
    requestedAt: row.requestedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
