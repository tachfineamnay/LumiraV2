import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  inputType: 'date' | 'text' | 'textarea' | 'photo';
  required: boolean;
  status: IntakeCompletenessStatus;
  hasValue: boolean;
  displayValue: string | null;
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

interface ResolvedProfile {
  openReading?: boolean;
  birthDate?: string;
  birthPlace?: string;
  objective?: string;
  specificQuestion?: string;
  facePhotoUrl?: string;
  palmPhotoUrl?: string;
  [key: string]: unknown;
}

const PUBLIC_FIELDS: RequestableProfileFieldKey[] = [
  'birthDate',
  'birthPlace',
  'specificQuestion',
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

    const fields = PUBLIC_FIELDS.filter((key) => this.isRequired(key, profile)).map((key) => {
      const active = activeRows.find((row) => this.amendmentIncludes(row, key));
      const invalidFields = new Set(this.stringArray(this.asRecord(active?.data).invalidFields));
      const rawValue = profile[key];
      const hasValue = this.hasUsableValue(key, rawValue);
      let status: IntakeCompletenessStatus;
      if (active) {
        status = active.status;
      } else if (invalidFields.has(key)) {
        status = 'INVALID';
      } else {
        status = hasValue ? 'PRESENT' : 'MISSING';
      }

      return {
        key,
        label: PROFILE_FIELD_CATALOG[key].label,
        inputType: PROFILE_FIELD_CATALOG[key].input as IntakeCompletenessField['inputType'],
        required: true,
        status,
        hasValue,
        displayValue: this.displayValue(key, rawValue),
        requestable: !active,
        canMarkInvalid: hasValue && !active,
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
      requested: fields.filter((field) =>
        ['REQUESTED', 'DRAFT'].includes(field.status),
      ).length,
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
      if (!field || !field.required) {
        throw new BadRequestException(
          `L’information « ${PROFILE_FIELD_CATALOG[key].label} » n’est pas requise pour ce dossier`,
        );
      }
      if (field.activeAmendmentId) {
        throw new ConflictException(`Une demande est déjà ouverte pour « ${field.label} »`);
      }
      if (field.hasValue && !invalidSet.has(key)) {
        throw new ConflictException(`L’information « ${field.label} » est déjà présente`);
      }
      if (!field.hasValue && invalidSet.has(key)) {
        throw new BadRequestException(
          `L’information « ${field.label} » est manquante, pas invalide`,
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

  private isRequired(key: RequestableProfileFieldKey, profile: ResolvedProfile): boolean {
    if (key === 'specificQuestion') {
      return profile.openReading !== true && !this.clean(profile.objective);
    }
    return true;
  }

  private hasUsableValue(key: RequestableProfileFieldKey, value: unknown): boolean {
    const cleaned = this.clean(value);
    if (!cleaned) return false;
    if (key === 'birthDate') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return false;
      const parsed = new Date(`${cleaned}T00:00:00.000Z`);
      return (
        Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === cleaned
      );
    }
    return true;
  }

  private displayValue(key: RequestableProfileFieldKey, value: unknown): string | null {
    if (key === 'facePhotoUrl' || key === 'palmPhotoUrl') return null;
    return this.clean(value);
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
      openReading: source.openReading === true,
      birthDate: this.clean(source.birthDate) ?? undefined,
      birthPlace: this.clean(source.birthPlace) ?? undefined,
      objective: this.clean(source.objective) ?? undefined,
      specificQuestion: this.clean(source.specificQuestion) ?? undefined,
      facePhotoUrl:
        this.clean(source.facePhotoUrl) ?? this.clean(source.facePhoto) ?? undefined,
      palmPhotoUrl:
        this.clean(source.palmPhotoUrl) ?? this.clean(source.palmPhoto) ?? undefined,
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

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter(
          (entry): entry is string => typeof entry === 'string' && entry.length > 0,
        )
      : [];
  }
}
