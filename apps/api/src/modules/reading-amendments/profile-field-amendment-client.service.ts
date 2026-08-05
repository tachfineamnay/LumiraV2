import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  asStringRecord,
  hashCanonicalJson,
  isPalmRole,
  palmRole,
  persistablePreparedAssets,
  staleAmendmentConflict,
  toPublicProfileAmendment,
} from './profile-field-amendment.shared';

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
    const supplied = await this.sanitizeValues(userId, fields, dto.values, false);
    const currentData = asRecord(amendment.data);
    const values = { ...asStringRecord(currentData.values), ...supplied };
    const nextData = { ...currentData, values, draftSavedAt: new Date().toISOString() };

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
    const currentValues = asStringRecord(asRecord(amendment.data).values);
    const supplied = await this.sanitizeValues(userId, fields, dto.values, false);
    const values = await this.sanitizeValues(
      userId,
      fields,
      { ...currentValues, ...supplied },
      true,
    );
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
  ): Promise<Record<string, string>> {
    const allowed = new Set(fields);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key as ProfileFieldKey)) {
        throw new BadRequestException(`Le champ ${key} n’a pas été demandé`);
      }
    }

    const result: Record<string, string> = {};
    for (const field of fields) {
      const definition = PROFILE_FIELD_CATALOG[field];
      const raw = input[field];
      if (raw === undefined || raw === null || raw === '') {
        if (requireAll) {
          throw new BadRequestException(`Le champ « ${definition.label} » est requis`);
        }
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
      if (field === 'birthDate' && !this.isValidDate(value)) {
        throw new BadRequestException('La date de naissance est invalide');
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
    values: Record<string, string>,
  ): Promise<PreparedProfileAssets> {
    const face = fields.includes('facePhotoUrl')
      ? await this.privatePhotos.prepareForAi(values.facePhotoUrl, userId, 'face', 'FACE_FRONTAL')
      : null;
    const palm = fields.includes('palmPhotoUrl')
      ? await this.privatePhotos.prepareForAi(
          values.palmPhotoUrl,
          userId,
          'palm',
          palmRole(values.palmRole),
        )
      : null;
    return { face, palm };
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

  private isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
}
