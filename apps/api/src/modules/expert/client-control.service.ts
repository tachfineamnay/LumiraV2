import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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

interface LegacyChatMessage {
  role?: string;
  content?: string;
  timestamp?: string;
}

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

    const conversations = client.chatSessions.map((session) => {
      const messages = this.readMessages(session.messages);
      const lastMessage = messages[messages.length - 1] || null;
      return {
        id: session.id,
        type: 'AI_ASSISTANT' as const,
        relatedOrderId: session.relatedOrderId,
        title: session.title || 'Échange Lumira',
        status: session.isActive ? 'OPEN' : 'ARCHIVED',
        messageCount: messages.length,
        lastSender: lastMessage?.role || null,
        lastMessageAt: session.lastMessageAt || session.updatedAt,
        createdAt: session.createdAt,
      };
    });

    const timeline = this.buildTimeline(client, readings, conversations);
    const paidStatuses = ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'];
    const lifetimeAccess = client.orders.some((order) => paidStatuses.includes(order.status));
    const openReadings = readings.filter(
      (reading) => !['DELIVERED', 'REFUNDED'].includes(reading.state),
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
        access: lifetimeAccess ? 'LIFETIME' : 'NONE',
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
        unreadNotifications: client.notifications.filter((notification) => !notification.read).length,
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
    readings: Array<Record<string, unknown>>,
    conversations: Array<Record<string, unknown>>,
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
        title: order.paidAt ? `Paiement confirmé — ${order.orderNumber}` : `Commande créée — ${order.orderNumber}`,
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
        id: `conversation-${String(conversation.id)}`,
        type: 'CONVERSATION_ACTIVITY',
        title: `Échange client — ${String(conversation.title)}`,
        occurredAt: new Date(String(conversation.lastMessageAt)),
        conversationId: String(conversation.id),
      });
    }

    return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  /** Type anchor used only by buildTimeline to preserve the Prisma query shape. */
  private async loadClientShape(clientId: string) {
    const client = await this.prisma.user.findUniqueOrThrow({
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
    return client;
  }

  private readMessages(value: Prisma.JsonValue): LegacyChatMessage[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is LegacyChatMessage => Boolean(item && typeof item === 'object' && !Array.isArray(item)),
    );
  }

  private asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }
}
