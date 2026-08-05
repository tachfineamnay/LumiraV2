import { Injectable } from '@nestjs/common';
import { OrderStatus, UserProfile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const EFFECTIVE_ORDER_STATUSES: OrderStatus[] = [
  'PROCESSING',
  'AWAITING_VALIDATION',
  'COMPLETED',
  'FAILED',
];

const PROFILE_KEYS = [
  'usageName',
  'birthDate',
  'birthTime',
  'birthPlace',
  'specificQuestion',
  'objective',
  'facePhotoUrl',
  'palmPhotoUrl',
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

type PhotoKind = 'face' | 'palm';

interface EffectiveSnapshot {
  snapshotId: string | null;
  revision: number | null;
  effectiveAt: string | null;
  profile: Record<string, unknown>;
}

export interface EffectiveProfileResolution {
  profile: UserProfile | null;
  snapshotId: string | null;
  snapshotRevision: number | null;
  effectiveAt: string | null;
}

/**
 * ReadingIntake remains immutable. Approved complements are stored in an
 * order-scoped effective snapshot; this service exposes that latest approved
 * projection to the Sanctuaire without rewriting historical intake data.
 */
@Injectable()
export class EffectiveClientProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveProfile(
    userId: string,
    persistedProfile: UserProfile | null,
  ): Promise<EffectiveProfileResolution> {
    const snapshot = await this.findLatestEffectiveSnapshot(userId);
    if (!snapshot || !persistedProfile) {
      return {
        profile: persistedProfile,
        snapshotId: snapshot?.snapshotId ?? null,
        snapshotRevision: snapshot?.revision ?? null,
        effectiveAt: snapshot?.effectiveAt ?? null,
      };
    }

    const overlay: Record<string, unknown> = {};
    for (const key of PROFILE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(snapshot.profile, key)) {
        overlay[key] = snapshot.profile[key];
      }
    }

    return {
      profile: { ...persistedProfile, ...overlay } as UserProfile,
      snapshotId: snapshot.snapshotId,
      snapshotRevision: snapshot.revision,
      effectiveAt: snapshot.effectiveAt,
    };
  }

  async resolvePhotoReference(
    userId: string,
    kind: PhotoKind,
    persistedReference: string | null,
  ): Promise<string | null> {
    const snapshot = await this.findLatestEffectiveSnapshot(userId);
    const key = kind === 'face' ? 'facePhotoUrl' : 'palmPhotoUrl';
    const effectiveReference = this.nonEmptyString(snapshot?.profile[key]);
    return effectiveReference ?? persistedReference;
  }

  private async findLatestEffectiveSnapshot(userId: string): Promise<EffectiveSnapshot | null> {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: EFFECTIVE_ORDER_STATUSES },
      },
      select: { clientInputs: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    let latest: EffectiveSnapshot | null = null;
    let latestTimestamp = Number.NEGATIVE_INFINITY;

    for (const order of orders) {
      const inputs = this.asRecord(order.clientInputs);
      const effective = this.asRecord(inputs.readingIntakeEffective);
      const profile = this.asRecord(effective.profile);
      if (Object.keys(profile).length === 0) continue;

      const effectiveAt = this.nonEmptyString(effective.effectiveAt);
      const timestamp = effectiveAt ? new Date(effectiveAt).getTime() : Number.NaN;
      const comparableTimestamp = Number.isFinite(timestamp) ? timestamp : 0;
      if (latest && comparableTimestamp <= latestTimestamp) continue;

      latestTimestamp = comparableTimestamp;
      latest = {
        snapshotId: this.nonEmptyString(effective.snapshotId),
        revision: this.nonNegativeInteger(effective.revision),
        effectiveAt,
        profile,
      };
    }

    return latest;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private nonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private nonNegativeInteger(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
  }
}
