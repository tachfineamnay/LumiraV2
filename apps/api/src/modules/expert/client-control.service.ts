import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isEarlyAccessActive } from '@packages/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { parseGuidanceRequest } from '../guidance-requests/guidance-request.types';
import { readCurrentProduction, readExpertReview } from './production-control.types';

type ClientReadingState =
  | 'WAITING_CLIENT'
  | 'READY_FOR_PRODUCTION'
  | 'IN_PRODUCTION'
  | 'AWAITING_REVIEW'
  | 'ASSETS_PENDING'
  | 'DELIVERED'
  | 'INCIDENT'
  | 'REFUNDED';

type LegacyChatMessage = {
  role?: string;
  content?: string;
  timestamp?: string;
};

type ClientConversationProjection = {
  id: string;
  type: 'AI_ASSISTANT' | 'EXPERT_REQUEST';
  relatedOrderId: string | null;
  title: string;
  status: string;
  category?: string;
  assignedExpert?: { id: string; name: string } | null;
  messageCount: number;
  unreadByExpert: number;
  unreadByClient: number;
  lastSender: string | null;
  lastMessageAt: Date;
  createdAt: Date;
};

@Injectable()
export class ClientControlService {
  constructor(private readonly prisma: PrismaService) {}

  async getClientControlCenter(clientId: string) {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      include: {
        profile: true,
        consents: { orderBy: { acceptedAt: 'desc' } },
        onboardingProgress: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            files: { orderBy: { uploadedAt: 'desc' } },
            readingVersions: { orderBy: { version: 'desc' } },
            deliveries: { orderBy: { createdAt: 'desc' } },
            chatContexts: { orderBy: { lastMessageAt: 'desc' } },
          },
        },
        chatSessions: { orderBy: { lastMessageAt: 'desc' } },
        notifications: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    if (!client) throw new NotFoundException('Client non trouvé');

    const readings = client.orders.map((order) => {
      const production = readCurrentProduction(order.expertReview);
      const review = readExpertReview(order.expertReview);
      const sealedVersion = order.readingVersions.find((version) => version.status === 'SEALED');
      const delivery = sealedVersion
        ? order.deliveries.find((record) => record.readingVersionId === sealedVersion.id) || null
        : order.deliveries[0] || null;
      const audio = order.files.find((file) => file.type === 'AUDIO_READING') || null;
      const generated = this.asRecord(order.generatedContent);
      const synthesis = this.asRecord(generated.synthesis as Prisma.JsonValue | undefined);
      const state = this.resolveReadingState({
        orderStatus: order.status,
        profileCompleted: client.profile?.profileCompleted === true,
        productionStatus: production?.status,
        hasPdf: Boolean(delivery?.pdfKey),
        hasAudio: Boolean(audio),
      });

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        title: this.resolveReadingTitle(generated, synthesis, order.orderNumber),
        state,
        amount: order.amount,
        currency: order.currency,
        orderedAt: order.createdAt,
        paidAt: order.paidAt,
        deliveredAt: order.deliveredAt,
        assignedExpert: review.assignedBy
          ? {
              id: review.assignedBy,
              name: review.assignedName || 'Expert',
              assignedAt: review.assignedAt || null,
            }
          : null,
        production: production || null,
        versions: {
          count: order.readingVersions.length,
          sealedVersionId: sealedVersion?.id || null,
          sealedVersionNumber: sealedVersion?.version || null,
          latestStatus: order.readingVersions[0]?.status || null,
        },
        assets: {
          pdf: delivery?.pdfKey
            ? {
                status: 'READY',
                storageKey: delivery.pdfKey,
                contentHash: delivery.contentHash,
              }
            : { status: 'MISSING' },
          audio: audio
            ? {
                status: 'READY',
                fileId: audio.id,
                storageKey: audio.key,
              }
            : review.assets?.audio || { status: 'MISSING' },
          email: delivery
            ? {
                status: delivery.emailStatus,
                attempts: delivery.emailAttempts,
                sentAt: delivery.emailSentAt,
                error: delivery.lastEmailError,
              }
            : { status: 'PENDING' },
        },
      };
    });

    const conversations: ClientConversationProjection[] = client.chatSessions.map((session) => {
      const guidance = parseGuidanceRequest(session.messages);
      if (guidance) {
        const lastMessage = guidance.messages[guidance.messages.length - 1] || null;
        return {
          id: session.id,
          type: 'EXPERT_REQUEST',
          relatedOrderId: session.relatedOrderId,
          title: session.title || 'Demande d’éclairage',
          status: guidance.meta.status,
          category: guidance.meta.category,
          assignedExpert: guidance.meta.assignedExpertId
            ? {
                id: guidance.meta.assignedExpertId,
                name: guidance.meta.assignedExpertName || 'Expert',
              }
            : null,
          messageCount: guidance.messages.length,
          unreadByExpert: guidance.messages.filter(
            (message) => message.senderType === 'CLIENT' && !message.readByExpertAt,
          ).length,
          unreadByClient: guidance.messages.filter(
            (message) => message.senderType === 'EXPERT' && !message.readByClientAt,
          ).length,
          lastSender: lastMessage?.senderType || null,
          lastMessageAt: session.lastMessageAt || session.updatedAt,
          createdAt: session.createdAt,
        };
      }

      const messages = this.readLegacyMessages(session.messages);
      const lastMessage = messages[messages.length - 1] || null;
      return {
        id: session.id,
        type: 'AI_ASSISTANT',
        relatedOrderId: session.relatedOrderId,
        title: session.title || 'Échange Lumira',
        status: session.isActive ? 'OPEN' : 'ARCHIVED',
        assignedExpert: null,
        messageCount: messages.length,
        unreadByExpert: 0,
        unreadByClient: 0,
        lastSender: lastMessage?.role || null,
        lastMessageAt: session.lastMessageAt || session.updatedAt,
        createdAt: session.createdAt,
      };
    });

    const timeline = this.buildTimeline(client, conversations);
    const paidStatuses = ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'];
    const activeAccess = client.orders.some(
      (order) => paidStatuses.includes(order.status) && isEarlyAccessActive(order.paidAt),
    );
    const openReadings = readings.filter(
      (reading) => !['DELIVERED', 'REFUNDED'].includes(reading.state),
    );
    const guidanceRequests = conversations.filter(
      (conversation) => conversation.type === 'EXPERT_REQUEST',
    );

    return {
      client: {
        id: client.id,
        refId: client.refId,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        status: client.status,
        access: activeAccess ? 'EARLY_3M' : 'NONE',
        createdAt: client.createdAt,
      },
      readiness: {
        profileCompleted: client.profile?.profileCompleted === true,
        onboardingStatus: client.onboardingProgress?.status || null,
        birthData: Boolean(client.profile?.birthDate && client.profile?.birthPlace),
        facePhoto: Boolean(client.profile?.facePhotoUrl),
        palmPhoto: Boolean(client.profile?.palmPhotoUrl),
        activeConsent: client.consents.some((consent) => !consent.revokedAt),
      },
      summary: {
        totalReadings: readings.length,
        deliveredReadings: readings.filter((reading) => reading.state === 'DELIVERED').length,
        openReadings: openReadings.length,
        incidents: readings.filter((reading) => reading.state === 'INCIDENT').length,
        conversations: conversations.length,
        guidanceRequests: guidanceRequests.length,
        openGuidanceRequests: guidanceRequests.filter(
          (request) => !['RESOLVED', 'ARCHIVED'].includes(request.status),
        ).length,
        unreadGuidanceForExpert: guidanceRequests.reduce(
          (total, request) => total + request.unreadByExpert,
          0,
        ),
        unreadNotifications: client.notifications.filter((notification) => !notification.read)
          .length,
      },
      readings,
      conversations,
      timeline: timeline.slice(0, 100),
      notifications: client.notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        read: notification.read,
        createdAt: notification.createdAt,
        metadata: notification.metadata,
      })),
    };
  }

  private resolveReadingState(input: {
    orderStatus: string;
    profileCompleted: boolean;
    productionStatus?: string;
    hasPdf: boolean;
    hasAudio: boolean;
  }): ClientReadingState {
    if (input.orderStatus === 'REFUNDED') return 'REFUNDED';
    if (input.productionStatus === 'FAILED' || input.orderStatus === 'FAILED') return 'INCIDENT';
    if (!input.profileCompleted && ['PAID', 'PENDING'].includes(input.orderStatus)) {
      return 'WAITING_CLIENT';
    }
    if (input.productionStatus === 'QUEUED' || input.productionStatus === 'RUNNING') {
      return 'IN_PRODUCTION';
    }
    if (input.orderStatus === 'PAID') return 'READY_FOR_PRODUCTION';
    if (input.orderStatus === 'PROCESSING') return 'IN_PRODUCTION';
    if (input.orderStatus === 'AWAITING_VALIDATION') return 'AWAITING_REVIEW';
    if (input.orderStatus === 'COMPLETED' && input.hasPdf && input.hasAudio) return 'DELIVERED';
    if (input.orderStatus === 'COMPLETED') return 'ASSETS_PENDING';
    return 'WAITING_CLIENT';
  }

  private resolveReadingTitle(
    generated: Record<string, unknown>,
    synthesis: Record<string, unknown>,
    orderNumber: string,
  ) {
    const explicit = generated.title;
    if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
    const archetype = synthesis.archetype || generated.archetype;
    if (typeof archetype === 'string' && archetype.trim()) {
      return `Lecture fondatrice — ${archetype.trim()}`;
    }
    return `Lecture ${orderNumber}`;
  }

  private buildTimeline(
    client: Awaited<ReturnType<typeof this.loadClientShape>>,
    conversations: ClientConversationProjection[],
  ) {
    const events: Array<{
      id: string;
      type: string;
      title: string;
      occurredAt: Date;
      orderId?: string;
      conversationId?: string;
      metadata?: Record<string, unknown>;
    }> = [];

    events.push({
      id: `client-${client.id}`,
      type: 'CLIENT_CREATED',
      title: 'Dossier client créé',
      occurredAt: client.createdAt,
    });

    if (client.onboardingProgress?.completedAt) {
      events.push({
        id: `onboarding-${client.onboardingProgress.id}`,
        type: 'ONBOARDING_COMPLETED',
        title: 'Éléments essentiels validés',
        occurredAt: client.onboardingProgress.completedAt,
      });
    }

    for (const order of client.orders) {
      events.push({
        id: `order-${order.id}`,
        type: order.paidAt ? 'ORDER_PAID' : 'ORDER_CREATED',
        title: order.paidAt
          ? `Paiement confirmé — ${order.orderNumber}`
          : `Commande créée — ${order.orderNumber}`,
        occurredAt: order.paidAt || order.createdAt,
        orderId: order.id,
      });

      const review = readExpertReview(order.expertReview);
      if (review.assignedAt) {
        events.push({
          id: `assignment-${order.id}`,
          type: 'ORDER_ASSIGNED',
          title: `Commande prise en charge par ${review.assignedName || 'un expert'}`,
          occurredAt: new Date(review.assignedAt),
          orderId: order.id,
        });
      }

      for (const version of order.readingVersions) {
        events.push({
          id: `version-${version.id}`,
          type: version.status === 'SEALED' ? 'READING_SEALED' : 'READING_VERSION_CREATED',
          title:
            version.status === 'SEALED'
              ? `Lecture scellée — version ${version.version}`
              : `Version ${version.version} enregistrée`,
          occurredAt: version.sealedAt || version.createdAt,
          orderId: order.id,
        });
      }

      for (const file of order.files) {
        if (file.type !== 'AUDIO_READING') continue;
        events.push({
          id: `audio-${file.id}`,
          type: 'AUDIO_READY',
          title: `Audio disponible — ${order.orderNumber}`,
          occurredAt: file.uploadedAt,
          orderId: order.id,
        });
      }

      for (const delivery of order.deliveries) {
        if (!delivery.emailSentAt) continue;
        events.push({
          id: `delivery-${delivery.id}`,
          type: 'DELIVERY_SENT',
          title: `Lecture livrée — ${order.orderNumber}`,
          occurredAt: delivery.emailSentAt,
          orderId: order.id,
        });
      }
    }

    for (const conversation of conversations) {
      events.push({
        id: `conversation-${conversation.id}`,
        type:
          conversation.type === 'EXPERT_REQUEST'
            ? 'GUIDANCE_REQUEST_ACTIVITY'
            : 'AI_CONVERSATION_ACTIVITY',
        title:
          conversation.type === 'EXPERT_REQUEST'
            ? `Demande d’éclairage — ${conversation.title}`
            : `Échange IA — ${conversation.title}`,
        occurredAt: conversation.lastMessageAt,
        conversationId: conversation.id,
      });
    }

    return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  private async loadClientShape(clientId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: clientId },
      include: {
        profile: true,
        consents: true,
        onboardingProgress: true,
        orders: {
          include: {
            files: true,
            readingVersions: true,
            deliveries: true,
            chatContexts: true,
          },
        },
        chatSessions: true,
        notifications: true,
      },
    });
  }

  private readLegacyMessages(value: Prisma.JsonValue): LegacyChatMessage[] {
    if (!Array.isArray(value)) return [];
    const messages: LegacyChatMessage[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      messages.push({
        role: typeof record.role === 'string' ? record.role : undefined,
        content: typeof record.content === 'string' ? record.content : undefined,
        timestamp: typeof record.timestamp === 'string' ? record.timestamp : undefined,
      });
    }
    return messages;
  }

  private asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }
}
