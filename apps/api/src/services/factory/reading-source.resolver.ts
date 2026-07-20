import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UserProfile as PrismaUserProfile } from '@prisma/client';
import { UserProfile as VertexUserProfile } from './VertexOracle';

export type ReadingSourceKind = 'SEALED_INTAKE' | 'LEGACY_PROFILE';

/** Normalized reading fields shared by sealed intake and legacy profile. */
export interface ReadingSourceProfile {
  birthDate: string;
  birthTime: string | null;
  birthPlace: string;
  specificQuestion: string | null;
  objective: string | null;
  facePhotoUrl: string | null;
  palmPhotoUrl: string | null;
  highs: string | null;
  lows: string | null;
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
  sealedAt?: string;
  contentHash?: string;
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
  'birthDate',
  'birthTime',
  'birthPlace',
  'specificQuestion',
  'objective',
  'facePhotoUrl',
  'palmPhotoUrl',
  'highs',
  'lows',
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

@Injectable()
export class ReadingSourceResolver {
  private readonly logger = new Logger(ReadingSourceResolver.name);

  resolve(order: OrderForReadingSource): ResolvedReadingSource {
    const clientInputs = this.asRecord(order.clientInputs);
    const readingIntake = this.asRecord(clientInputs.readingIntake);
    const sealedAt = this.nonEmptyString(readingIntake.sealedAt);

    if (sealedAt) {
      const contentHash = this.nonEmptyString(readingIntake.contentHash);
      const profileRaw = readingIntake.profile;

      if (!contentHash || !this.isValidSealedProfile(profileRaw)) {
        this.logger.warn(
          JSON.stringify({
            event: 'Invalid sealed reading intake',
            orderId: order.id,
            orderNumber: order.orderNumber ?? null,
            hasContentHash: Boolean(contentHash),
            hasValidProfile: this.isValidSealedProfile(profileRaw),
          }),
        );
        throw new BadRequestException(
          'Le dossier scellé de cette commande est incomplet ou invalide pour la génération',
        );
      }

      const profile = this.normalizeSealedProfile(profileRaw);
      this.logger.log(
        JSON.stringify({
          event: 'Reading source resolved',
          orderId: order.id,
          orderNumber: order.orderNumber ?? null,
          source: 'SEALED_INTAKE',
        }),
      );
      this.logger.log('Reading source: SEALED_INTAKE');
      this.logger.log(
        JSON.stringify({
          event: 'Reading intake hash loaded',
          orderId: order.id,
          contentHash,
        }),
      );

      return {
        source: 'SEALED_INTAKE',
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

    return {
      source: 'LEGACY_PROFILE',
      profile: legacyProfile,
    };
  }

  toVertexUserProfile(
    user: OrderForReadingSource['user'],
    resolved: ResolvedReadingSource,
  ): VertexUserProfile {
    const profile = resolved.profile;
    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime ?? undefined,
      birthPlace: profile.birthPlace ?? undefined,
      specificQuestion: profile.specificQuestion ?? undefined,
      objective: profile.objective ?? undefined,
      facePhotoUrl: profile.facePhotoUrl ?? undefined,
      palmPhotoUrl: profile.palmPhotoUrl ?? undefined,
      highs: profile.highs ?? undefined,
      lows: profile.lows ?? undefined,
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
  }

  private isValidSealedProfile(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const profile = value as Record<string, unknown>;
    const birthDate = this.nonEmptyString(profile.birthDate);
    const birthPlace = this.nonEmptyString(profile.birthPlace);
    return Boolean(birthDate && birthPlace);
  }

  private normalizeSealedProfile(raw: Record<string, unknown>): ReadingSourceProfile {
    return {
      birthDate: this.nonEmptyString(raw.birthDate) ?? '',
      birthTime: this.nullableString(raw.birthTime),
      birthPlace: this.nonEmptyString(raw.birthPlace) ?? '',
      specificQuestion: this.nullableString(raw.specificQuestion),
      objective: this.nullableString(raw.objective),
      facePhotoUrl: this.nullableString(raw.facePhotoUrl),
      palmPhotoUrl: this.nullableString(raw.palmPhotoUrl),
      highs: this.nullableString(raw.highs),
      lows: this.nullableString(raw.lows),
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
    return {
      birthDate: profile?.birthDate ?? '',
      birthTime: profile?.birthTime ?? null,
      birthPlace: profile?.birthPlace ?? '',
      specificQuestion: profile?.specificQuestion ?? null,
      objective: profile?.objective ?? null,
      facePhotoUrl: profile?.facePhotoUrl ?? null,
      palmPhotoUrl: profile?.palmPhotoUrl ?? null,
      highs: profile?.highs ?? null,
      lows: profile?.lows ?? null,
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
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}

export { PROFILE_FIELDS };
