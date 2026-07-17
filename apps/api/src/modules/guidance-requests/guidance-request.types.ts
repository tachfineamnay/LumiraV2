import { Prisma } from '@prisma/client';

export const GUIDANCE_REQUEST_META_KIND = 'LUMIRA_EXPERT_REQUEST_V1' as const;
export const GUIDANCE_MESSAGE_KIND = 'LUMIRA_GUIDANCE_MESSAGE_V1' as const;

export const GUIDANCE_REQUEST_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'WAITING_EXPERT',
  'RESOLVED',
  'ARCHIVED',
] as const;
export type GuidanceRequestStatus = (typeof GUIDANCE_REQUEST_STATUSES)[number];

export const GUIDANCE_REQUEST_CATEGORIES = [
  'READING_CLARIFICATION',
  'SPECIFIC_SITUATION',
  'INTEGRATION_ADVICE',
  'OTHER',
] as const;
export type GuidanceRequestCategory = (typeof GUIDANCE_REQUEST_CATEGORIES)[number];

export const GUIDANCE_REQUEST_PRIORITIES = ['NORMAL', 'HIGH'] as const;
export type GuidanceRequestPriority = (typeof GUIDANCE_REQUEST_PRIORITIES)[number];

export type GuidanceSenderType = 'CLIENT' | 'EXPERT' | 'SYSTEM';

export interface GuidanceRequestMeta {
  kind: typeof GUIDANCE_REQUEST_META_KIND;
  version: 1;
  status: GuidanceRequestStatus;
  category: GuidanceRequestCategory;
  priority: GuidanceRequestPriority;
  assignedExpertId?: string | null;
  assignedExpertName?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

export interface GuidanceMessage {
  kind: typeof GUIDANCE_MESSAGE_KIND;
  id: string;
  senderType: GuidanceSenderType;
  senderId?: string | null;
  senderName?: string | null;
  content: string;
  createdAt: string;
  readByClientAt?: string | null;
  readByExpertAt?: string | null;
}

export interface ParsedGuidanceRequest {
  meta: GuidanceRequestMeta;
  messages: GuidanceMessage[];
}

export function parseGuidanceRequest(value: Prisma.JsonValue): ParsedGuidanceRequest | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const [rawMeta, ...rawMessages] = value;
  if (!rawMeta || typeof rawMeta !== 'object' || Array.isArray(rawMeta)) return null;

  const metaRecord = rawMeta as Record<string, unknown>;
  if (metaRecord.kind !== GUIDANCE_REQUEST_META_KIND) return null;
  if (!GUIDANCE_REQUEST_STATUSES.includes(metaRecord.status as GuidanceRequestStatus)) return null;
  if (!GUIDANCE_REQUEST_CATEGORIES.includes(metaRecord.category as GuidanceRequestCategory)) {
    return null;
  }

  const meta: GuidanceRequestMeta = {
    kind: GUIDANCE_REQUEST_META_KIND,
    version: 1,
    status: metaRecord.status as GuidanceRequestStatus,
    category: metaRecord.category as GuidanceRequestCategory,
    priority: GUIDANCE_REQUEST_PRIORITIES.includes(
      metaRecord.priority as GuidanceRequestPriority,
    )
      ? (metaRecord.priority as GuidanceRequestPriority)
      : 'NORMAL',
    assignedExpertId:
      typeof metaRecord.assignedExpertId === 'string' ? metaRecord.assignedExpertId : null,
    assignedExpertName:
      typeof metaRecord.assignedExpertName === 'string' ? metaRecord.assignedExpertName : null,
    createdAt:
      typeof metaRecord.createdAt === 'string' ? metaRecord.createdAt : new Date(0).toISOString(),
    updatedAt:
      typeof metaRecord.updatedAt === 'string'
        ? metaRecord.updatedAt
        : typeof metaRecord.createdAt === 'string'
          ? metaRecord.createdAt
          : new Date(0).toISOString(),
    resolvedAt: typeof metaRecord.resolvedAt === 'string' ? metaRecord.resolvedAt : null,
  };

  const messages: GuidanceMessage[] = [];
  for (const raw of rawMessages) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    if (record.kind !== GUIDANCE_MESSAGE_KIND || typeof record.id !== 'string') continue;
    if (!['CLIENT', 'EXPERT', 'SYSTEM'].includes(String(record.senderType))) continue;
    if (typeof record.content !== 'string' || typeof record.createdAt !== 'string') continue;
    messages.push({
      kind: GUIDANCE_MESSAGE_KIND,
      id: record.id,
      senderType: record.senderType as GuidanceSenderType,
      senderId: typeof record.senderId === 'string' ? record.senderId : null,
      senderName: typeof record.senderName === 'string' ? record.senderName : null,
      content: record.content,
      createdAt: record.createdAt,
      readByClientAt: typeof record.readByClientAt === 'string' ? record.readByClientAt : null,
      readByExpertAt: typeof record.readByExpertAt === 'string' ? record.readByExpertAt : null,
    });
  }

  return { meta, messages };
}

export function serializeGuidanceRequest(value: ParsedGuidanceRequest): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify([value.meta, ...value.messages])) as Prisma.InputJsonValue;
}
