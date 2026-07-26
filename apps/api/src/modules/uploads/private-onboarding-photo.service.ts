import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3ObjectMetadata, S3ObjectResult, S3Service } from './s3.service';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import sharp from 'sharp';

export type OnboardingPhotoKind = 'face' | 'palm';
export type PhotoActorType = 'client' | 'expert';
export type PrivatePhotoSource = 'profile' | 'onboarding';

const ALLOWED_ONBOARDING_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_ONBOARDING_PHOTO_BYTES = Math.floor(1.2 * 1024 * 1024);

export interface ValidatedOnboardingPhoto {
  storageRef: string;
  key: string;
  contentType: string;
  size: number;
  etag: string;
  versionId: string | null;
}

export interface PrivatePhotoStreamResult extends S3ObjectResult {
  contentType: string;
}

/** A verified visual asset. The bytes are intentionally short lived and are
 * passed only to the multimodal call; durable audit metadata is stored without
 * a signed URL or raw image data. */
export interface PreparedOnboardingPhoto extends ValidatedOnboardingPhoto {
  kind: OnboardingPhotoKind;
  width: number;
  height: number;
  orientation: number | null;
  sha256: string;
  base64: string;
}

const MIN_IMAGE_DIMENSION = 64;
const MAX_IMAGE_DIMENSION = 8192;

@Injectable()
export class PrivateOnboardingPhotoService {
  private readonly logger = new Logger(PrivateOnboardingPhotoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Accept only durable private refs of the form:
   * s3://onboarding/{expectedUserId}/...
   * Returns the S3 object key (without the s3:// scheme).
   */
  parseStorageReference(storageRef: string, expectedUserId: string): string {
    if (!storageRef || typeof storageRef !== 'string' || !storageRef.trim()) {
      throw new BadRequestException('Référence photo invalide');
    }

    const trimmed = storageRef.trim();
    if (trimmed.includes('..')) {
      throw new BadRequestException('Référence photo invalide');
    }
    if (/^https?:\/\//i.test(trimmed)) {
      throw new BadRequestException('Référence photo invalide');
    }
    if (!trimmed.startsWith('s3://')) {
      throw new BadRequestException('Référence photo invalide');
    }

    const key = trimmed.slice('s3://'.length);
    if (!key || key.includes('..')) {
      throw new BadRequestException('Référence photo invalide');
    }

    const expectedPrefix = `onboarding/${expectedUserId}/`;
    if (!key.startsWith(expectedPrefix)) {
      throw new BadRequestException('Référence photo invalide');
    }

    // Reject accidental readings-bucket style keys even if prefixed oddly.
    if (key.startsWith('readings/') || key.includes('/readings/')) {
      throw new BadRequestException('Référence photo invalide');
    }

    return key;
  }

  async getClientPhotoKey(userId: string, kind: OnboardingPhotoKind): Promise<string> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { facePhotoUrl: true, palmPhotoUrl: true },
    });
    if (!profile) {
      throw new NotFoundException('Photo introuvable');
    }

    const storageRef = kind === 'face' ? profile.facePhotoUrl : profile.palmPhotoUrl;
    if (!storageRef) {
      throw new NotFoundException('Photo introuvable');
    }

    return this.parseStorageReference(storageRef, userId);
  }

  async getExpertPhotoKey(clientId: string, kind: OnboardingPhotoKind): Promise<string> {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Client introuvable');
    }
    return this.getClientPhotoKey(clientId, kind);
  }

  /** Resolve the exact asset referenced by the latest order-scoped intake. */
  async getClientOnboardingPhotoKey(userId: string, kind: OnboardingPhotoKind): Promise<string> {
    const order = await this.prisma.order.findFirst({
      where: {
        userId,
        intakeRequired: true,
        status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { readingIntake: { select: { data: true } } },
    });

    if (order) {
      const data = this.asRecord(order.readingIntake?.data);
      const storageRef =
        kind === 'face'
          ? this.firstString(data.facePhoto, data.facePhotoUrl)
          : this.firstString(data.palmPhoto, data.palmPhotoUrl);
      if (!storageRef) throw new NotFoundException('Photo introuvable');
      return this.parseStorageReference(storageRef, userId);
    }

    // Compatibility for an in-flight legacy draft not attached by the migration.
    const legacy = await this.prisma.onboardingProgress.findUnique({
      where: { userId },
      select: { data: true, status: true },
    });
    if (!legacy || legacy.status !== 'IN_PROGRESS') {
      throw new NotFoundException('Photo introuvable');
    }
    const data = this.asRecord(legacy.data);
    const storageRef =
      kind === 'face'
        ? this.firstString(data.facePhoto, data.facePhotoUrl)
        : this.firstString(data.palmPhoto, data.palmPhotoUrl);
    if (!storageRef) throw new NotFoundException('Photo introuvable');
    return this.parseStorageReference(storageRef, userId);
  }

  async validateOnboardingPhoto(
    storageRef: string,
    expectedUserId: string,
    kind: OnboardingPhotoKind,
  ): Promise<ValidatedOnboardingPhoto> {
    const normalizedRef = storageRef.trim();
    const key = this.parseStorageReference(normalizedRef, expectedUserId);
    const fileName = key.split('/').pop()?.toLowerCase() || '';
    if (!fileName.startsWith(`${kind}-`) && !fileName.startsWith(`${kind}.`)) {
      throw new BadRequestException(`La photo ${kind} ne correspond pas au type attendu`);
    }

    let metadata: S3ObjectMetadata;
    try {
      metadata = await this.s3Service.headObject(key, 'uploads');
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(`La photo ${kind} n’existe plus dans le stockage privé`);
      }
      throw error;
    }

    const contentType = metadata.contentType?.toLowerCase();
    const size = metadata.contentLength;
    const etag = metadata.etag?.replace(/^"|"$/g, '');
    if (!contentType || !ALLOWED_ONBOARDING_IMAGE_TYPES.has(contentType)) {
      throw new BadRequestException(`Le format réel de la photo ${kind} n’est pas autorisé`);
    }
    if (!size || size <= 0 || size > MAX_ONBOARDING_PHOTO_BYTES) {
      throw new BadRequestException(`La photo ${kind} dépasse 1,2 Mo ou est vide`);
    }
    if (!etag) {
      throw new BadRequestException(`La photo ${kind} ne possède pas d’empreinte vérifiable`);
    }

    return {
      storageRef: normalizedRef,
      key,
      contentType,
      size,
      etag,
      versionId: metadata.versionId || null,
    };
  }

  /**
   * Reads, decodes and fingerprints the exact private object used by a
   * multimodal generation. Head metadata alone is never sufficient: clients
   * can upload a different binary under an image content type.
   */
  async prepareForAi(
    storageRef: string,
    expectedUserId: string,
    kind: OnboardingPhotoKind,
  ): Promise<PreparedOnboardingPhoto> {
    const validated = await this.validateOnboardingPhoto(storageRef, expectedUserId, kind);
    const object = await this.s3Service.getObject(validated.key, 'uploads');
    const bytes = await this.readStream(object.stream, MAX_ONBOARDING_PHOTO_BYTES);
    if (bytes.length !== validated.size) {
      throw new BadRequestException(`La photo ${kind} a changé pendant sa validation`);
    }

    let metadata: sharp.Metadata;
    try {
      // rotate().toBuffer() forces a full decode and rejects truncated/corrupt
      // payloads while preserving no transformed bytes in persistence.
      const decoder = sharp(bytes, { failOn: 'error', limitInputPixels: MAX_IMAGE_DIMENSION ** 2 });
      metadata = await decoder.metadata();
      await decoder.rotate().toBuffer();
    } catch {
      throw new BadRequestException(`La photo ${kind} est illisible ou corrompue`);
    }

    const actualContentType = this.contentTypeForFormat(metadata.format);
    if (!actualContentType || actualContentType !== validated.contentType) {
      throw new BadRequestException(`Le type réel de la photo ${kind} ne correspond pas à son type déclaré`);
    }
    if (!metadata.width || !metadata.height ||
      metadata.width < MIN_IMAGE_DIMENSION || metadata.height < MIN_IMAGE_DIMENSION ||
      metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
      throw new BadRequestException(`Les dimensions de la photo ${kind} sont inutilisables`);
    }
    if (object.contentType && object.contentType.split(';')[0].trim().toLowerCase() !== actualContentType) {
      throw new BadRequestException(`Le stockage retourne un type incohérent pour la photo ${kind}`);
    }

    return {
      ...validated,
      kind,
      width: metadata.width,
      height: metadata.height,
      orientation: metadata.orientation ?? null,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      base64: bytes.toString('base64'),
    };
  }

  async getPhotoStream(options: {
    clientId: string;
    kind: OnboardingPhotoKind;
    actorType: PhotoActorType;
    actorId: string;
    source?: PrivatePhotoSource;
  }): Promise<PrivatePhotoStreamResult> {
    const started = Date.now();
    const { clientId, kind, actorType, actorId, source = 'profile' } = options;
    const requestId = createHash('sha256')
      .update(`${actorType}:${actorId}:${clientId}:${kind}:${started}`)
      .digest('hex')
      .slice(0, 12);

    this.logger.log(
      JSON.stringify({
        event: 'Private onboarding photo requested',
        requestId,
        actorType,
        actorId,
        clientId,
        kind,
      }),
    );

    try {
      const key =
        source === 'onboarding'
          ? await this.getClientOnboardingPhotoKey(clientId, kind)
          : actorType === 'expert'
            ? await this.getExpertPhotoKey(clientId, kind)
            : await this.getClientPhotoKey(clientId, kind);

      const object = await this.s3Service.getObject(key, 'uploads');
      const contentType = this.resolveContentType(object.contentType, key);

      this.logger.log(
        JSON.stringify({
          event: 'Private onboarding photo served',
          requestId,
          actorType,
          actorId,
          clientId,
          kind,
          status: 200,
          durationMs: Date.now() - started,
          fileHint: this.fileHint(key),
        }),
      );

      return { ...object, contentType };
    } catch (error) {
      const status =
        error instanceof NotFoundException ? 404 : error instanceof BadRequestException ? 400 : 500;

      if (error instanceof NotFoundException) {
        this.logger.warn(
          JSON.stringify({
            event: 'Private onboarding photo missing',
            requestId,
            actorType,
            actorId,
            clientId,
            kind,
            status,
            durationMs: Date.now() - started,
          }),
        );
      } else if (error instanceof BadRequestException) {
        this.logger.warn(
          JSON.stringify({
            event: 'Invalid onboarding photo reference',
            requestId,
            actorType,
            actorId,
            clientId,
            kind,
            status,
            durationMs: Date.now() - started,
          }),
        );
      } else {
        this.logger.error(
          JSON.stringify({
            event: 'S3 onboarding photo retrieval failed',
            requestId,
            actorType,
            actorId,
            clientId,
            kind,
            status,
            durationMs: Date.now() - started,
            cause: error instanceof Error ? error.name : 'unknown',
          }),
        );
      }

      throw error;
    }
  }

  private resolveContentType(contentType: string | undefined, key: string): string {
    if (contentType && contentType.startsWith('image/')) {
      return contentType;
    }
    const lower = key.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }

  private contentTypeForFormat(format: string | undefined): string | null {
    if (format === 'jpeg') return 'image/jpeg';
    if (format === 'png') return 'image/png';
    if (format === 'webp') return 'image/webp';
    return null;
  }

  private async readStream(stream: Readable, maxBytes: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) {
        stream.destroy();
        throw new BadRequestException('La photo dépasse la taille autorisée');
      }
      chunks.push(bytes);
    }
    if (size === 0) throw new BadRequestException('La photo est vide');
    return Buffer.concat(chunks);
  }

  private fileHint(key: string): string {
    const fileName = key.split('/').pop() || 'photo';
    return fileName.length > 24 ? `${fileName.slice(0, 12)}…${fileName.slice(-8)}` : fileName;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private firstString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }
}
