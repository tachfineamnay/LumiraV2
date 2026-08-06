import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UserProfile as PrismaUserProfile } from '@prisma/client';
import {
  IntentionMode,
  READING_REQUIREMENTS_VERSION,
  evaluateReadingRequirements,
  resolveIntention,
} from '../../modules/users/reading-intake-policy';
import { UserProfile as VertexUserProfile } from './VertexOracle';

export type ReadingSourceKind =
  | 'EFFECTIVE_SNAPSHOT'
  | 'SEALED_INTAKE'
  | 'LEGACY_PROFILE';

export type ReadingLifeAreas = Record<string, { state: string; note?: string }>;

export interface ReadingSourceProfile {
  intentionMode: IntentionMode | null;
  openReading: boolean;
  usageName: string | null;
  birthDate: string;
  birthTime: string | null;
  birthPlace: string;
  specificQuestion: string | null;
  objective: string | null;
  facePhotoUrl: string | null;
  palmPhotoUrl: string | null;
  palmRole: 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';
  highs: string | null;
  lows: string | null;
  lifeEvents: string | null;
  lifeAreas: ReadingLifeAreas | null;
  strongSide: string | null;
  weakSide: string | null;
  strongZone: string | null;
  weakZone: string | null;
  deliveryStyle: string | null;
  pace: number | null;
  ailments: string | null;
  fears: string | null;
  rituals: string | null;
}

export interface ResolvedReadingSource {
  source: ReadingSourceKind;
  requirementsVersion?: string;
  sealedAt?: string;
  contentHash?: string;
  inputSnapshotId?: string;
  revision?: number;
  amendmentIds?: string[];
  profile: ReadingSourceProfile;
}

export interface OrderForReadingSource {
  id: string;
  orderNumber?: string;
  clientInputs: unknown;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profile: PrismaUserProfile | null;
  };
}

const PROFILE_FIELDS = [
  'intentionMode',
  'openReading',
  'usageName',
  'birthDate',
  'birthTime',
  'birthPlace',
  'specificQuestion',
  'objective',
  'facePhotoUrl',
  'palmPhotoUrl',
  'palmRole',
  'highs',
  'lows',
  'lifeEvents',
  'lifeAreas',
  'strongSide',
  'weakSide',
  'strongZone',
  'weakZone',
  'deliveryStyle',
  'pace',
  'ailments',
  'fears',
  'rituals',
] as const;

const OPEN_READING_CONTEXT = 'Lecture ouverte explicitement choisie par le client.';

@Injectable()
export class ReadingSourceResolver {
  private readonly logger = new Logger(ReadingSourceResolver.name);

  resolve(order: OrderForReadingSource): ResolvedReadingSource {
    const clientInputs = this.asRecord(order.clientInputs);
    const effective = this.asRecord(clientInputs.readingIntakeEffective);
    const effectiveSnapshotId = this.nonEmptyString(effective.snapshotId);

    if (effectiveSnapshotId) {
      const contentHash = this.nonEmptyString(effective.contentHash);
      const profileRaw = effective.profile;
      if (!contentHash || !this.isValidSealedProfile(profileRaw)) {
        this.logInvalid(order, 'EFFECTIVE_SNAPSHOT', Boolean(contentHash), profileRaw);
        throw this.incompleteSourceError(
          'Le snapshot effectif de cette commande est incomplet ou invalide pour la génération',
          profileRaw,
        );
      }
      const profile = this.normalizeSealedProfile(profileRaw as Record<string, unknown>);
      const effectiveAt =
        this.nonEmptyString(effective.effectiveAt) ??
        this.nonEmptyString(effective.sealedAt) ??
        undefined;
      const revision =
        typeof effective.revision === 'number' && Number.isInteger(effective.revision)
          ? effective.revision
          : undefined;
      const amendmentIds = this.stringArray(effective.amendmentIds);
      const requirementsVersion =
        this.nonEmptyString(effective.requirementsVersion) ?? READING_REQUIREMENTS_VERSION;
      this.logResolved(order, 'EFFECTIVE_SNAPSHOT', contentHash, effectiveSnapshotId);
      return {
        source: 'EFFECTIVE_SNAPSHOT',
        requirementsVersion,
        sealedAt: effectiveAt,
        contentHash,
        inputSnapshotId: effectiveSnapshotId,
        revision,
        amendmentIds,
        profile,
      };
    }

    const readingIntake = this.asRecord(clientInputs.readingIntake);
    const sealedAt = this.nonEmptyString(readingIntake.sealedAt);
    if (sealedAt) {
      const contentHash = this.nonEmptyString(readingIntake.contentHash);
      const profileRaw = readingIntake.profile;
      if (!contentHash || !this.isValidSealedProfile(profileRaw)) {
        this.logInvalid(order, 'SEALED_INTAKE', Boolean(contentHash), profileRaw);
        throw this.incompleteSourceError(
          'Le dossier scellé de cette commande est incomplet ou invalide pour la génération',
          profileRaw,
        );
      }
      const profile = this.normalizeSealedProfile(profileRaw as Record<string, unknown>);
      const requirementsVersion =
        this.nonEmptyString(readingIntake.requirementsVersion) ?? READING_REQUIREMENTS_VERSION;
      this.logResolved(order, 'SEALED_INTAKE', contentHash);
      return {
        source: 'SEALED_INTAKE',
        requirementsVersion,
        sealedAt,
        contentHash,
        profile,
      };
    }

    const legacyProfile = this.fromLegacyProfile(order.user.profile);
    this.logger.log(
      JSON.stringify({
        event: 'Reading source resolved',
        orderId: order.id,
        orderNumber: order.orderNumber ?? null,
        source: 'LEGACY_PROFILE',
      }),
    );
    this.logger.log('Reading source: LEGACY_PROFILE');
    return { source: 'LEGACY_PROFILE', profile: legacyProfile };
  }

  toVertexUserProfile(
    user: OrderForReadingSource['user'],
    resolved: ResolvedReadingSource,
  ): VertexUserProfile {
    const profile = resolved.profile;
    const vertexProfile = {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      intentionMode: profile.intentionMode ?? undefined,
      openReading: profile.openReading,
      usageName: profile.usageName ?? undefined,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime ?? undefined,
      birthPlace: profile.birthPlace ?? undefined,
      specificQuestion:
        profile.specificQuestion ??
        (profile.intentionMode === 'OPEN' ? OPEN_READING_CONTEXT : undefined),
      objective: profile.objective ?? undefined,
      facePhotoUrl: profile.facePhotoUrl ?? undefined,
      palmPhotoUrl: profile.palmPhotoUrl ?? undefined,
      palmRole: profile.palmRole,
      highs: profile.highs ?? undefined,
      lows: profile.lows ?? undefined,
      lifeEvents: profile.lifeEvents ?? undefined,
      lifeAreas: profile.lifeAreas ?? undefined,
      strongSide: profile.strongSide ?? undefined,
      weakSide: profile.weakSide ?? undefined,
      strongZone: profile.strongZone ?? undefined,
      weakZone: profile.weakZone ?? undefined,
      deliveryStyle: profile.deliveryStyle ?? undefined,
      pace: profile.pace ?? undefined,
      ailments: profile.ailments ?? undefined,
      fears: profile.fears ?? undefined,
      rituals: profile.rituals ?? undefined,
    };
    return vertexProfile as VertexUserProfile;
  }

  private logResolved(
    order: OrderForReadingSource,
    source: Exclude<ReadingSourceKind, 'LEGACY_PROFILE'>,
    contentHash: string,
    snapshotId?: string,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: 'Reading source resolved',
        orderId: order.id,
        orderNumber: order.orderNumber ?? null,
        source,
        contentHash,
        inputSnapshotId: snapshotId ?? null,
      }),
    );
    this.logger.log(`Reading source: ${source}`);
  }

  private logInvalid(
    order: OrderForReadingSource,
    source: Exclude<ReadingSourceKind, 'LEGACY_PROFILE'>,
    hasContentHash: boolean,
    profileRaw: unknown,
  ): void {
    const requirements = evaluateReadingRequirements(this.asRecord(profileRaw), {
      requireExplicitIntentionMode: false,
      strictIntentionExclusivity: true,
    });
    this.logger.warn(
      JSON.stringify({
        event: 'Invalid reading source',
        orderId: order.id,
        orderNumber: order.orderNumber ?? null,
        source,
        hasContentHash,
        hasValidProfile: requirements.complete,
        missingFields: requirements.missingFields,
        invalidFields: requirements.invalidFields,
      }),
    );
  }

  private isValidSealedProfile(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return evaluateReadingRequirements(value as Record<string, unknown>, {
      requireExplicitIntentionMode: false,
      strictIntentionExclusivity: true,
    }).complete;
  }

  private incompleteSourceError(message: string, profileRaw: unknown): BadRequestException {
    const requirements = evaluateReadingRequirements(this.asRecord(profileRaw), {
      requireExplicitIntentionMode: false,
      strictIntentionExclusivity: true,
    });
    return new BadRequestException({
      statusCode: 400,
      code: 'READING_INTAKE_INCOMPLETE',
      message,
      missingFields: requirements.missingFields,
      invalidFields: requirements.invalidFields,
    });
  }

  private normalizeSealedProfile(raw: Record<string, unknown>): ReadingSourceProfile {
    const intention = resolveIntention(raw, {
      requireExplicitIntentionMode: false,
      strictIntentionExclusivity: true,
    });
    return {
      intentionMode: intention.mode,
      openReading: intention.mode === 'OPEN',
      usageName: this.nullableString(raw.usageName),
      birthDate: this.nonEmptyString(raw.birthDate) ?? '',
      birthTime: this.nullableString(raw.birthTime),
      birthPlace: this.nonEmptyString(raw.birthPlace) ?? '',
      specificQuestion: this.nullableString(raw.specificQuestion),
      objective: this.nullableString(raw.objective),
      facePhotoUrl:
        this.nullableString(raw.facePhotoUrl) ?? this.nullableString(raw.facePhoto),
      palmPhotoUrl:
        this.nullableString(raw.palmPhotoUrl) ?? this.nullableString(raw.palmPhoto),
      palmRole: this.palmRole(raw.palmRole),
      highs: this.nullableString(raw.highs),
      lows: this.nullableString(raw.lows),
      lifeEvents: this.nullableString(raw.lifeEvents),
      lifeAreas: this.nullableLifeAreas(raw.lifeAreas),
      strongSide: this.nullableString(raw.strongSide),
      weakSide: this.nullableString(raw.weakSide),
      strongZone: this.nullableString(raw.strongZone),
      weakZone: this.nullableString(raw.weakZone),
      deliveryStyle: this.nullableString(raw.deliveryStyle),
      pace: typeof raw.pace === 'number' ? raw.pace : null,
      ailments: this.nullableString(raw.ailments),
      fears: this.nullableString(raw.fears),
      rituals: this.nullableString(raw.rituals),
    };
  }

  private fromLegacyProfile(profile: PrismaUserProfile | null): ReadingSourceProfile {
    const intention = resolveIntention(
      {
        specificQuestion: profile?.specificQuestion,
        objective: profile?.objective,
        openReading: false,
      },
      { requireExplicitIntentionMode: false },
    );
    return {
      intentionMode: intention.mode,
      openReading: false,
      usageName: profile?.usageName ?? null,
      birthDate: profile?.birthDate ?? '',
      birthTime: profile?.birthTime ?? null,
      birthPlace: profile?.birthPlace ?? '',
      specificQuestion: profile?.specificQuestion ?? null,
      objective: profile?.objective ?? null,
      facePhotoUrl: profile?.facePhotoUrl ?? null,
      palmPhotoUrl: profile?.palmPhotoUrl ?? null,
      palmRole: 'PALM_UNKNOWN',
      highs: profile?.highs ?? null,
      lows: profile?.lows ?? null,
      lifeEvents: profile?.lifeEvents ?? null,
      lifeAreas: this.nullableLifeAreas(profile?.lifeAreas),
      strongSide: profile?.strongSide ?? null,
      weakSide: profile?.weakSide ?? null,
      strongZone: profile?.strongZone ?? null,
      weakZone: profile?.weakZone ?? null,
      deliveryStyle: profile?.deliveryStyle ?? null,
      pace: profile?.pace ?? null,
      ailments: profile?.ailments ?? null,
      fears: profile?.fears ?? null,
      rituals: profile?.rituals ?? null,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private nonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private nullableString(value: unknown): string | null {
    if (value === null || value === undefined || typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  }

  private palmRole(value: unknown): 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN' {
    return value === 'PALM_LEFT' || value === 'PALM_RIGHT' ? value : 'PALM_UNKNOWN';
  }

  private nullableLifeAreas(value: unknown): ReadingLifeAreas | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const areas: ReadingLifeAreas = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const state = this.nonEmptyString((entry as Record<string, unknown>).state);
      if (!state) continue;
      const note = this.nullableString((entry as Record<string, unknown>).note);
      areas[key] = note ? { state, note } : { state };
    }
    return Object.keys(areas).length > 0 ? areas : null;
  }
}

export { PROFILE_FIELDS };
