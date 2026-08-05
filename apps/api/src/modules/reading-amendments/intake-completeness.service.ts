import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  evaluateReadingRequirements,
  resolveIntention,
} from '../users/reading-intake-policy';
import {
  PROFILE_FIELD_CATALOG,
  RequestableProfileFieldKey,
  normalizeRequestedProfileFields,
  publicProfileFields,
} from './profile-field-catalog';

export type IntakeCompletenessSource =
  | 'EFFECTIVE_SNAPSHOT'
  | 'SEALED_INTAKE'
  | 'LEGACY_PROFILE'
  | 'INVALID_INTAKE';

export type IntakeCompletenessStatus =
  | 'PRESENT'
  | 'MISSING'
  | 'INVALID'
  | 'REQUESTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED';

export interface IntakeCompletenessField {
  key: RequestableProfileFieldKey;
  label: string;
  inputType: 'date' | 'text' | 'intention' | 'photo';
  required: true;
  status: IntakeCompletenessStatus;
  hasValue: boolean;
  displayValue: string | null;
  currentValue: unknown;
  requestable: boolean;
  canMarkInvalid: boolean;
  activeAmendmentId: string | null;
  photoKind: 'face' | 'palm' | null;
}

export interface IntakeCompletenessResult {
  orderId: string;
  source: IntakeCompletenessSource;
  complete: boolean;
  summary: {
    required: number;
    present: number;
    missing: number;
    invalid: number;
    requested: number;
    submitted: number;
  };
  fields: IntakeCompletenessField[];
}

interface ActiveAmendmentRow {
  id: string;
  kind: 'PALM_PHOTO' | 'PROFILE_FIELDS';
  requestedFields: string[];
  status: 'REQUESTED' | 'DRAFT' | 'SUBMITTED';
  data: Prisma.JsonValue;
}

type ResolvedProfile = Record<string, unknown>;

const REQUIRED_FIELDS: RequestableProfileFieldKey[] = [
  'birthDate',
  'birthPlace',
  'intention',
  'facePhotoUrl',
  'palmPhotoUrl',
];

@Injectable()
export class IntakeCompletenessService {
  constructor(private readonly prisma: PrismaService) {}

  async getForOrder(orderId: string): Promise<IntakeCompletenessResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        intakeRequired: true,
        clientInputs: true,
        readingIntake: {
          select: {
            status: true,
            data: true,
            contentHash: true,
            sealedAt: true,
          },
        },
        user: { select: { profile: true } },
      },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');

    await this.expireOpenDrafts(orderId);
    const activeRows = await this.prisma.$queryRaw<ActiveAmendmentRow[]>(Prisma.sql`
      SELECT "id", "kind", "requestedFields", "status", "data"
      FROM "ReadingIntakeAmendment"
      WHERE "orderId" = ${orderId}
        AND "status" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')
      ORDER BY "createdAt" DESC
    `);

    const { source, profile } = this.resolveProfile({
      intakeRequired: order.intakeRequired,
      clientInputs: order.clientInputs,
      readingIntake: order.readingIntake,
      legacyProfile: order.user.profile,
    });
    const requirements = evaluateReadingRequirements(profile, {
      requireExplicitIntentionMode: false,
      strictIntentionExclusivity: false,
    });
    const missing = new Set(requirements.missingFields);
    const invalid = new Set(requirements.invalidFields);

    const fields = REQUIRED_FIELDS.map((key) => {
      const active = activeRows.find((row) => this.amendmentIncludes(row, key));
      const hasValue = this.hasRawValue(key, profile);
      let status: IntakeCompletenessStatus;
      if (active) status = active.status;
      else if (invalid.has(key)) status = 'INVALID';
      else if (missing.has(key)) status = 'MISSING';
      else status = 'PRESENT';

      return {
        key,
        label: PROFILE_FIELD_CATALOG[key].label,
        inputType: PROFILE_FIELD_CATALOG[key].input as IntakeCompletenessField['inputType'],
        required: true,
        status,
        hasValue,
        displayValue: this.displayValue(key, profile),
        currentValue: this.currentValue(key, profile),
        requestable: !active && (status === 'MISSING' || status === 'INVALID'),
        canMarkInvalid: !active && status === 'PRESENT',
        activeAmendmentId: active?.id ?? null,
        photoKind:
          key === 'facePhotoUrl' ? 'face' : key === 'palmPhotoUrl' ? 'palm' : null,
      } satisfies IntakeCompletenessField;
    });

    const summary = {
      required: fields.length,
      present: fields.filter((field) => field.status === 'PRESENT').length,
      missing: fields.filter((field) => field.status === 'MISSING').length,
      invalid: fields.filter((field) => field.status === 'INVALID').length,
      requested: fields.filter((field) => ['REQUESTED', 'DRAFT'].includes(field.status)).length,
      submitted: fields.filter((field) => field.status === 'SUBMITTED').length,
    };

    return {
      orderId,
      source,
      complete: fields.every((field) => field.status === 'PRESENT'),
      summary,
      fields,
    };
  }

  async assertRequestable(
    orderId: string,
    requestedValues: string[],
    invalidValues: string[] = [],
  ): Promise<{
    result: IntakeCompletenessResult;
    fields: RequestableProfileFieldKey[];
    invalidFields: RequestableProfileFieldKey[];
  }> {
    const fields = publicProfileFields(normalizeRequestedProfileFields(requestedValues));
    const invalidFields = this.normalizeInvalidFields(invalidValues, fields);
    const invalidSet = new Set<RequestableProfileFieldKey>(invalidFields);
    const result = await this.getForOrder(orderId);

    for (const key of fields) {
      const field = result.fields.find((candidate) => candidate.key === key);
      if (!field) {
        throw new BadRequestException(
          `L’information « ${PROFILE_FIELD_CATALOG[key].label} » est inconnue`,
        );
      }
      if (field.activeAmendmentId) {
        throw new ConflictException(`Une demande est déjà ouverte pour « ${field.label} »`);
      }
      if (field.status === 'PRESENT' && !invalidSet.has(key)) {
        throw new ConflictException(`L’information « ${field.label} » est déjà présente`);
      }
      if (field.status === 'MISSING' && invalidSet.has(key)) {
        throw new BadRequestException(
          `L’information « ${field.label} » est absente, pas inexploitable`,
        );
      }
      if (field.status === 'INVALID' && !invalidSet.has(key)) {
        throw new BadRequestException(
          `L’information « ${field.label} » doit être signalée comme inexploitable`,
        );
      }
    }

    return { result, fields, invalidFields };
  }

  private normalizeInvalidFields(
    values: string[],
    requested: RequestableProfileFieldKey[],
  ): RequestableProfileFieldKey[] {
    const requestedSet = new Set<string>(requested);
    const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
    for (const value of unique) {
      if (!requestedSet.has(value)) {
        throw new BadRequestException(
          'Un champ signalé comme inexploitable doit aussi être demandé',
        );
      }
    }
    return unique as RequestableProfileFieldKey[];
  }

  private amendmentIncludes(
    row: ActiveAmendmentRow,
    key: RequestableProfileFieldKey,
  ): boolean {
    if (row.kind === 'PALM_PHOTO') return key === 'palmPhotoUrl';
    return row.requestedFields.includes(key);
  }

  private hasRawValue(key: RequestableProfileFieldKey, profile: ResolvedProfile): boolean {
    if (key === 'intention') {
      return Boolean(
        profile.openReading === true ||
          this.clean(profile.intentionMode) ||
          this.clean(profile.specificQuestion) ||
          this.clean(profile.objective),
      );
    }
    return Boolean(this.clean(profile[key]));
  }

  private displayValue(key: RequestableProfileFieldKey, profile: ResolvedProfile): string | null {
    if (key === 'facePhotoUrl' || key === 'palmPhotoUrl') return null;
    if (key !== 'intention') return this.clean(profile[key]);
    const intention = resolveIntention(profile, { requireExplicitIntentionMode: false });
    if (intention.mode === 'QUESTION') {
      return `Question — ${this.clean(profile.specificQuestion) ?? 'incomplète'}`;
    }
    if (intention.mode === 'SITUATION') {
      return `Situation — ${this.clean(profile.objective) ?? 'incomplète'}`;
    }
    if (intention.mode === 'OPEN') return 'Lecture ouverte';
    return null;
  }

  private currentValue(key: RequestableProfileFieldKey, profile: ResolvedProfile): unknown {
    if (key === 'facePhotoUrl' || key === 'palmPhotoUrl') return null;
    if (key !== 'intention') return this.clean(profile[key]);
    const intention = resolveIntention(profile, { requireExplicitIntentionMode: false });
    return intention.mode
      ? {
          intentionMode: intention.mode,
          openReading: intention.mode === 'OPEN',
          specificQuestion: this.clean(profile.specificQuestion),
          objective: this.clean(profile.objective),
        }
      : null;
  }

  private resolveProfile(input: {
    intakeRequired: boolean;
    clientInputs: Prisma.JsonValue | null;
    readingIntake: {
      status: string;
      data: Prisma.JsonValue;
      contentHash: string | null;
      sealedAt: Date | null;
    } | null;
    legacyProfile: unknown;
  }): { source: IntakeCompletenessSource; profile: ResolvedProfile } {
    const clientInputs = this.asRecord(input.clientInputs);
    const effective = this.asRecord(clientInputs.readingIntakeEffective);
    const effectiveProfile = this.normalizedProfile(effective.profile);
    if (
      this.clean(effective.snapshotId) &&
      this.clean(effective.contentHash) &&
      Object.keys(effectiveProfile).length > 0
    ) {
      return { source: 'EFFECTIVE_SNAPSHOT', profile: effectiveProfile };
    }

    const projected = this.asRecord(clientInputs.readingIntake);
    const projectedProfile = this.normalizedProfile(projected.profile ?? projected.data);
    if (this.clean(projected.sealedAt) && Object.keys(projectedProfile).length > 0) {
      return { source: 'SEALED_INTAKE', profile: projectedProfile };
    }

    if (input.readingIntake?.status === 'SEALED') {
      return {
        source:
          input.readingIntake.contentHash && input.readingIntake.sealedAt
            ? 'SEALED_INTAKE'
            : 'INVALID_INTAKE',
        profile: this.normalizedProfile(input.readingIntake.data),
      };
    }

    if (!input.intakeRequired) {
      return {
        source: 'LEGACY_PROFILE',
        profile: this.normalizedProfile(input.legacyProfile),
      };
    }

    return {
      source: 'INVALID_INTAKE',
      profile: this.normalizedProfile(input.readingIntake?.data),
    };
  }

  private normalizedProfile(value: unknown): ResolvedProfile {
    const source = this.asRecord(value);
    if (Object.keys(source).length === 0) return {};
    return {
      ...source,
      intentionMode: this.clean(source.intentionMode) ?? undefined,
      openReading: source.openReading === true,
      birthDate: this.clean(source.birthDate) ?? undefined,
      birthPlace: this.clean(source.birthPlace) ?? undefined,
      objective: this.clean(source.objective) ?? undefined,
      specificQuestion: this.clean(source.specificQuestion) ?? undefined,
      facePhotoUrl:
        this.clean(source.facePhotoUrl) ?? this.clean(source.facePhoto) ?? undefined,
      palmPhotoUrl:
        this.clean(source.palmPhotoUrl) ?? this.clean(source.palmPhoto) ?? undefined,
      palmRole: this.clean(source.palmRole) ?? undefined,
    };
  }

  private async expireOpenDrafts(orderId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'CANCELLED',
          "data" = "data" || '{"cancelReason":"EXPIRED"}'::JSONB,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "orderId" = ${orderId}
        AND "status" IN ('REQUESTED', 'DRAFT')
        AND "expiresAt" <= CURRENT_TIMESTAMP
    `);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private clean(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const cleaned = value.trim();
    return cleaned || null;
  }
}
