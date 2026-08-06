import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ExpertOrderPhotoKind = 'face' | 'palm';

@Injectable()
export class ExpertOrderPhotoService {
  constructor(private readonly prisma: PrismaService) {}

  async getReference(
    orderId: string,
    kind: ExpertOrderPhotoKind,
  ): Promise<{ userId: string; storageRef: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        clientInputs: true,
        readingIntake: {
          select: {
            status: true,
            data: true,
          },
        },
        user: {
          select: {
            profile: {
              select: {
                facePhotoUrl: true,
                palmPhotoUrl: true,
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');

    const clientInputs = this.asRecord(order.clientInputs);
    const effective = this.asRecord(clientInputs.readingIntakeEffective);
    const effectiveProfile = this.asRecord(effective.profile);
    const effectiveRef = this.photoRef(effectiveProfile, kind);
    if (effectiveRef) return { userId: order.userId, storageRef: effectiveRef };

    const relationalRef = this.photoRef(this.asRecord(order.readingIntake?.data), kind);
    if (relationalRef) return { userId: order.userId, storageRef: relationalRef };

    const projected = this.asRecord(clientInputs.readingIntake);
    const projectedProfile = this.asRecord(projected.profile ?? projected.data);
    const projectedRef = this.photoRef(projectedProfile, kind);
    if (projectedRef) return { userId: order.userId, storageRef: projectedRef };

    const profileRef =
      kind === 'face' ? order.user.profile?.facePhotoUrl : order.user.profile?.palmPhotoUrl;
    const storageRef = this.nonEmptyString(profileRef);
    if (!storageRef) throw new NotFoundException('Photo introuvable');

    return { userId: order.userId, storageRef };
  }

  private photoRef(source: Record<string, unknown>, kind: ExpertOrderPhotoKind): string | null {
    return kind === 'face'
      ? this.firstString(source.facePhotoUrl, source.facePhoto)
      : this.firstString(source.palmPhotoUrl, source.palmPhoto);
  }

  private firstString(...values: unknown[]): string | null {
    for (const value of values) {
      const normalized = this.nonEmptyString(value);
      if (normalized) return normalized;
    }
    return null;
  }

  private nonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized || null;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
