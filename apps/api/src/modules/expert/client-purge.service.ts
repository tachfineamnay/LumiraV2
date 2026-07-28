import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { FileType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { S3BucketKind, S3Service } from '../uploads/s3.service';

export interface ClientPurgeResult {
  clientId: string;
  deletedOrders: number;
  deletedStorageObjects: number;
}

@Injectable()
export class ClientPurgeService {
  private readonly logger = new Logger(ClientPurgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  async purge(clientId: string): Promise<ClientPurgeResult> {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        profile: {
          select: {
            facePhotoUrl: true,
            palmPhotoUrl: true,
          },
        },
        onboardingProgress: { select: { data: true } },
        readingIntakes: { select: { data: true } },
        orders: {
          select: {
            id: true,
            files: { select: { key: true, type: true } },
            deliveries: { select: { pdfKey: true } },
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    const insights = await this.prisma.insight.findMany({
      where: { userId: clientId },
      select: { audioUrl: true },
    });

    const uploads = new Set<string>();
    const readings = new Set<string>();

    this.collectPrivateUploadReferences(client.profile?.facePhotoUrl, clientId, uploads);
    this.collectPrivateUploadReferences(client.profile?.palmPhotoUrl, clientId, uploads);
    this.collectPrivateUploadReferences(client.onboardingProgress?.data, clientId, uploads);
    for (const intake of client.readingIntakes) {
      this.collectPrivateUploadReferences(intake.data, clientId, uploads);
    }

    for (const order of client.orders) {
      for (const file of order.files) {
        if (!file.key) continue;
        if (file.type === FileType.FACE_PHOTO || file.type === FileType.PALM_PHOTO) {
          uploads.add(this.stripS3Scheme(file.key));
        } else {
          readings.add(this.stripS3Scheme(file.key));
        }
      }
      for (const delivery of order.deliveries) {
        if (delivery.pdfKey) readings.add(this.stripS3Scheme(delivery.pdfKey));
      }
    }

    for (const insight of insights) {
      const key = this.readingKeyFromUrl(insight.audioUrl);
      if (key) readings.add(key);
    }

    await this.deleteStorageObjects(uploads, 'uploads', clientId);
    await this.deleteStorageObjects(readings, 'readings', clientId);

    const orderIds = client.orders.map((order) => order.id);

    await this.prisma.$transaction(async (tx) => {
      if (orderIds.length > 0) {
        await tx.deliveryRecord.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.orderFile.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.aiRun.deleteMany({ where: { orderId: { in: orderIds } } });

        // ReadingVersion has a self-referencing RESTRICT relation. Break the
        // lineage before deleting every version belonging to the client.
        await tx.readingVersion.updateMany({
          where: { orderId: { in: orderIds } },
          data: { parentVersionId: null },
        });
        await tx.readingVersion.deleteMany({ where: { orderId: { in: orderIds } } });

        await tx.readingIntake.deleteMany({ where: { userId: clientId } });
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      } else {
        await tx.readingIntake.deleteMany({ where: { userId: clientId } });
      }

      // Insight has no Prisma relation to User, so it must be removed explicitly.
      await tx.insight.deleteMany({ where: { userId: clientId } });

      // ProductOrder is intentionally relation-less; remove records that can be
      // tied unambiguously to this account so the same email starts cleanly.
      await tx.productOrder.deleteMany({
        where: {
          OR: [
            { customerEmail: client.email },
            { customerId: client.id },
            ...(client.stripeCustomerId ? [{ customerId: client.stripeCustomerId }] : []),
          ],
        },
      });

      // UserProfile does not cascade from User.
      await tx.userProfile.deleteMany({ where: { userId: clientId } });

      // The remaining user-owned records cascade here: Sanctuaire tokens,
      // consent, onboarding progress, subscription, notifications, dreams,
      // paths/steps, chats and Akashic record.
      await tx.user.delete({ where: { id: clientId } });
    });

    this.logger.log(
      `Client purge completed: clientId=${clientId}, orders=${orderIds.length}, storage=${uploads.size + readings.size}`,
    );

    return {
      clientId,
      deletedOrders: orderIds.length,
      deletedStorageObjects: uploads.size + readings.size,
    };
  }

  private async deleteStorageObjects(
    keys: Set<string>,
    bucket: S3BucketKind,
    clientId: string,
  ): Promise<void> {
    for (const key of keys) {
      try {
        await this.s3Service.deleteObjectStrict(key, bucket);
      } catch (error) {
        this.logger.error(
          `Client purge storage failure: clientId=${clientId}, bucket=${bucket}, key=${key}`,
        );
        throw new ServiceUnavailableException(
          'La suppression des fichiers privés n’a pas pu être terminée. Aucun compte n’a été supprimé ; réessayez dans un instant.',
          { cause: error },
        );
      }
    }
  }

  private collectPrivateUploadReferences(
    value: unknown,
    clientId: string,
    target: Set<string>,
  ): void {
    if (typeof value === 'string') {
      const key = this.stripS3Scheme(value.trim());
      if (key.startsWith(`onboarding/${clientId}/`)) target.add(key);
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) this.collectPrivateUploadReferences(entry, clientId, target);
      return;
    }

    if (value && typeof value === 'object') {
      for (const entry of Object.values(value as Record<string, unknown>)) {
        this.collectPrivateUploadReferences(entry, clientId, target);
      }
    }
  }

  private readingKeyFromUrl(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    const marker = '/api/readings/audio/';
    const markerIndex = trimmed.indexOf(marker);
    if (markerIndex >= 0) return trimmed.slice(markerIndex + marker.length);

    const key = this.stripS3Scheme(trimmed);
    if (key.startsWith('audio/') || key.startsWith('readings/') || key.startsWith('pdf/')) {
      return key;
    }
    return null;
  }

  private stripS3Scheme(value: string): string {
    return value.startsWith('s3://') ? value.slice('s3://'.length) : value;
  }
}
