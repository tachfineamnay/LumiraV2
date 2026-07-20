import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3ObjectResult, S3Service } from './s3.service';
import { createHash } from 'crypto';

export type OnboardingPhotoKind = 'face' | 'palm';
export type PhotoActorType = 'client' | 'expert';

export interface PrivatePhotoStreamResult extends S3ObjectResult {
  contentType: string;
}

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

  async getPhotoStream(options: {
    clientId: string;
    kind: OnboardingPhotoKind;
    actorType: PhotoActorType;
    actorId: string;
  }): Promise<PrivatePhotoStreamResult> {
    const started = Date.now();
    const { clientId, kind, actorType, actorId } = options;
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
        actorType === 'expert'
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

  private fileHint(key: string): string {
    const fileName = key.split('/').pop() || 'photo';
    return fileName.length > 24 ? `${fileName.slice(0, 12)}…${fileName.slice(-8)}` : fileName;
  }
}
