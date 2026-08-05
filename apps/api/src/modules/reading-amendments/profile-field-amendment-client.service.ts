import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  INTENTION_MODES,
  IntentionMode,
  resolveIntention,
} from '../users/reading-intake-policy';
import { PrivateOnboardingPhotoService } from '../uploads/private-onboarding-photo.service';
import {
  SaveProfileFieldAmendmentDraftDto,
  SubmitProfileFieldAmendmentDto,
} from './dto/profile-field-amendment.dto';
import { PROFILE_FIELD_CATALOG, ProfileFieldKey, parseProfileFields } from './profile-field-catalog';
import {
  PreparedProfileAssets,
  ProfileAmendmentRow,
  asRecord,
  hashCanonicalJson,
  isPalmRole,
  nonEmptyString,
  palmRole,
  persistablePreparedAssets,
  staleAmendmentConflict,
  toPublicProfileAmendment,
} from './profile-field-amendment.shared';

type SanitizedAmendmentValues = Record<string, unknown>;
type IntentionValue = {
  intentionMode?: IntentionMode;
  openReading?: boolean;
  specificQuestion?: string | null;
  objective?: string | null;
};

const INTENTION_KEYS = new Set([
  'intentionMode',
  'openReading',
  'specificQuestion',
  'objective',
]);

@Injectable()
export class ProfileFieldAmendmentClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privatePhotos: PrivateOnboardingPhotoService,
  ) {}

  async saveDraft(
    userId: string,
    amendmentId: string,
    dto: SaveProfileFieldAmendmentDraftDto,
  ) {
    const amendment = await this.getOwned(amendmentId, userId);
    this.assertEditable(amendment, dto.expectedRevision);
    const fields = parseProfileFields(amendment.requestedFields);
    const currentValues = asRecord(asRecord(amendment.data).values);
    const merged = this.mergeValues(currentValues, dto.values);
    const values = await this.sanitizeValues(userId, fields, merged, false);
    const nextData = {
      ...asRecord(amendment.data),
      values,
      draftSavedAt: new Date().toISOString(),
    };

    const rows = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'DRAFT',
          "data" = ${JSON.stringify(nextData)}::JSONB,
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "userId" = ${userId}
        AND "kind" = 'PROFILE_FIELDS'
        AND "revision" = ${dto.expectedRevision}
        AND "status" IN ('REQUESTED', 'DRAFT')
        AND "expiresAt" > CURRENT_TIMESTAMP
      RETURNING *
    `);
    if (rows.length !== 1) throw staleAmendmentConflict();
    return toPublicProfileAmendment(rows[0]);
  }

  async submit(userId: string, amendmentId: string, dto: SubmitProfileFieldAmendmentDto) {
    const amendment = await this.getOwned(amendmentId, userId);
    this.assertEditable(amendment, dto.expectedRevision);
    const fields = parseProfileFields(amendment.requestedFields);
    const currentValues = asRecord(asRecord(amendment.data).values);
    const merged = this.mergeValues(currentValues, dto.values);
    const values = await this.sanitizeValues(userId, fields, merged, true);
    const assets = await this.prepareAssets(userId, fields, values);
    const submittedAt = new Date();
    const nextData = {
      ...asRecord(amendment.data),
      values,
      ...persistablePreparedAssets(assets),
      submittedAt: submittedAt.toISOString(),
    };
    const contentHash = hashCanonicalJson({
      amendmentId,
      kind: 'PROFILE_FIELDS',
      requestedFields: fields,
      values,
      faceSha256: assets.face?.sha256 ?? null,
      palmSha256: assets.palm?.sha256 ?? null,
    });

    const rows = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
      UPDATE "ReadingIntakeAmendment"
      SET "status" = 'SUBMITTED',
          "data" = ${JSON.stringify(nextData)}::JSONB,
          "contentHash" = ${contentHash},
          "submittedAt" = ${submittedAt},
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${amendmentId}
        AND "userId" = ${userId}
        AND "kind" = 'PROFILE_FIELDS'
        AND "revision" = ${dto.expectedRevision}
        AND "status" IN ('REQUESTED', 'DRAFT')
        AND "expiresAt" > CURRENT_TIMESTAMP
      RETURNING *
    `);
    if (rows.length !== 1) throw staleAmendmentConflict();
    return toPublicProfileAmendment(rows[0]);
  }

  async sanitizeValues(
    userId: string,
    fields: ProfileFieldKey[],
    input: Record<string, unknown>,
    requireAll: boolean,
  ): Promise<SanitizedAmendmentValues> {
    const allowed = new Set(fields);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key as ProfileFieldKey)) {
        throw new BadRequestException(`Le champ ${key} n’a pas été demandé`);
      }
    }

    const result: SanitizedAmendmentValues = {};
    for (const field of fields) {
      const definition = PROFILE_FIELD_CATALOG[field];
      const raw = input[field];
      const missing = raw === undefined || raw === null || raw === '';
      if (missing) {
        if (requireAll) {
          throw new BadRequestException(`Le champ « ${definition.label} » est requis`);
        }
        continue;
      }

      if (field === 'intention') {
        result.intention = this.sanitizeIntention(raw, requireAll);
        continue;
      }

      if (typeof raw !== 'string') {
        throw new BadRequestException(`Le champ « ${definition.label} » est invalide`);
      }
      const value = raw.trim();
      if (!value) {
        if (requireAll) {
          throw new BadRequestException(`Le champ « ${definition.label} » est requis`);
        }
        continue;
      }
      if (value.length > definition.maxLength) {
        throw new BadRequestException(`Le champ « ${definition.label} » est trop long`);
      }
      if (field === 'birthDate' && !this.isValidPastDate(value)) {
        throw new BadRequestException('La date de naissance est invalide');
      }
      if (field === 'birthPlace' && value.length < 2) {
        throw new BadRequestException('Le lieu de naissance est trop court');
      }
      if (field === 'palmRole' && !isPalmRole(value)) {
        throw new BadRequestException('La main photographiée est invalide');
      }
      if (field === 'facePhotoUrl') {
        await this.privatePhotos.validateOnboardingPhoto(value, userId, 'face');
      }
      if (field === 'palmPhotoUrl') {
        await this.privatePhotos.validateOnboardingPhoto(value, userId, 'palm');
      }
      result[field] = value;
    }
    return result;
  }

  async prepareAssets(
    userId: string,
    fields: ProfileFieldKey[],
    values: SanitizedAmendmentValues,
  ): Promise<PreparedProfileAssets> {
    const faceRef = nonEmptyString(values.facePhotoUrl);
    const palmRef = nonEmptyString(values.palmPhotoUrl);
    const face = fields.includes('facePhotoUrl') && faceRef
      ? await this.privatePhotos.prepareForAi(faceRef, userId, 'face', 'FACE_FRONTAL')
      : null;
    const palm = fields.includes('palmPhotoUrl') && palmRef
      ? await this.privatePhotos.prepareForAi(
          palmRef,
          userId,
          'palm',
          palmRole(values.palmRole),
        )
      : null;
    return { face, palm };
  }

  private sanitizeIntention(raw: unknown, requireAll: boolean): IntentionValue {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('Le bloc intention est invalide');
    }
    const source = raw as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      if (!INTENTION_KEYS.has(key)) {
        throw new BadRequestException(`Le champ d’intention ${key} est interdit`);
      }
    }

    const mode =
      typeof source.intentionMode === 'string' &&
      INTENTION_MODES.includes(source.intentionMode as IntentionMode)
        ? (source.intentionMode as IntentionMode)
        : undefined;
    if (source.intentionMode !== undefined && !mode) {
      throw new BadRequestException('Le mode d’intention est invalide');
    }
    if (source.openReading !== undefined && typeof source.openReading !== 'boolean') {
      throw new BadRequestException('Le choix de lecture ouverte est invalide');
    }
    const specificQuestion = this.optionalText(source.specificQuestion, 'question');
    const objective = this.optionalText(source.objective, 'situation');
    const intention: IntentionValue = {
      ...(mode && { intentionMode: mode }),
      ...(source.openReading !== undefined && { openReading: source.openReading === true }),
      ...(source.specificQuestion !== undefined && { specificQuestion }),
      ...(source.objective !== undefined && { objective }),
    };

    if (requireAll) {
      const resolved = resolveIntention(intention, {
        requireExplicitIntentionMode: true,
        strictIntentionExclusivity: true,
      });
      if (!mode || !resolved.valid) {
        throw new BadRequestException(
          'Choisissez une intention valide : question, situation ou lecture ouverte',
        );
      }
      return {
        intentionMode: mode,
        openReading: mode === 'OPEN',
        specificQuestion: mode === 'QUESTION' ? specificQuestion : null,
        objective: mode === 'SITUATION' ? objective : null,
      };
    }

    return intention;
  }

  private mergeValues(
    current: Record<string, unknown>,
    supplied: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged = { ...current, ...supplied };
    if (current.intention || supplied.intention) {
      merged.intention = {
        ...asRecord(current.intention),
        ...asRecord(supplied.intention),
      };
    }
    return merged;
  }

  private optionalText(value: unknown, label: string): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') {
      throw new BadRequestException(`Le texte de ${label} est invalide`);
    }
    const cleaned = value.trim();
    if (cleaned.length > 2000) {
      throw new BadRequestException(`Le texte de ${label} est trop long`);
    }
    return cleaned || null;
  }

  private async getOwned(id: string, userId: string): Promise<ProfileAmendmentRow> {
    const rows = await this.prisma.$queryRaw<ProfileAmendmentRow[]>(Prisma.sql`
      SELECT *
      FROM "ReadingIntakeAmendment"
      WHERE "id" = ${id} AND "userId" = ${userId} AND "kind" = 'PROFILE_FIELDS'
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('Demande de complément introuvable');
    return rows[0];
  }

  private assertEditable(amendment: ProfileAmendmentRow, expectedRevision: number) {
    if (amendment.revision !== expectedRevision) throw staleAmendmentConflict();
    if (!['REQUESTED', 'DRAFT'].includes(amendment.status)) {
      throw new ConflictException('Cette demande ne peut plus être modifiée');
    }
    if (amendment.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Cette demande de complément a expiré');
    }
  }

  private isValidPastDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      return false;
    }
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    return date.getTime() <= todayUtc;
  }
}
