import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Expert, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GUIDANCE_MESSAGE_KIND,
  GUIDANCE_REQUEST_CATEGORIES,
  GUIDANCE_REQUEST_META_KIND,
  GUIDANCE_REQUEST_PRIORITIES,
  GUIDANCE_REQUEST_STATUSES,
  GuidanceMessage,
  GuidanceRequestCategory,
  GuidanceRequestMeta,
  GuidanceRequestPriority,
  GuidanceRequestStatus,
  ParsedGuidanceRequest,
  parseGuidanceRequest,
  serializeGuidanceRequest,
} from './guidance-request.types';

interface CreateGuidanceRequestInput {
  subject: string;
  content: string;
  category?: GuidanceRequestCategory;
  priority?: GuidanceRequestPriority;
  relatedOrderId?: string;
}

interface GuidanceRequestListOptions {
  status?: GuidanceRequestStatus;
  assignedTo?: string;
  unreadOnly?: boolean;
  limit?: number;
}

@Injectable()
export class GuidanceRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createClientRequest(userId: string, input: CreateGuidanceRequestInput) {
    await this.assertLifetimeAccess(userId);
    const subject = this.cleanText(input.subject, 'Sujet', 3, 120);
    const content = this.cleanText(input.content, 'Message', 10, 5000);
    const category = GUIDANCE_REQUEST_CATEGORIES.includes(input.category as GuidanceRequestCategory)
      ? (input.category as GuidanceRequestCategory)
      : 'OTHER';
    const priority = GUIDANCE_REQUEST_PRIORITIES.includes(input.priority as GuidanceRequestPriority)
      ? (input.priority as GuidanceRequestPriority)
      : 'NORMAL';

    if (input.relatedOrderId) {
      const related = await this.prisma.order.findFirst({
        where: { id: input.relatedOrderId, userId },
        select: { id: true },
      });
      if (!related) throw new BadRequestException('La lecture associée est introuvable');
    }

    const now = new Date().toISOString();
    const parsed: ParsedGuidanceRequest = {
      meta: {
        kind: GUIDANCE_REQUEST_META_KIND,
        version: 1,
        status: 'NEW',
        category,
        priority,
        assignedExpertId: null,
        assignedExpertName: null,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      },
      messages: [this.createMessage('CLIENT', userId, null, content, now, 'CLIENT')],
    };

    const session = await this.prisma.chatSession.create({
      data: {
        userId,
        relatedOrderId: input.relatedOrderId || null,
        title: subject,
        messages: serializeGuidanceRequest(parsed),
        isActive: true,
        lastMessageAt: new Date(now),
      },
      include: { user: true, relatedOrder: true },
    });

    return this.toRequestDto(session, parsed, 'CLIENT');
  }

  async listClientRequests(userId: string) {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      include: { relatedOrder: true },
    });

    return sessions.flatMap((session) => {
      const parsed = parseGuidanceRequest(session.messages);
      return parsed ? [this.toRequestDto(session, parsed, 'CLIENT')] : [];
    });
  }

  async getClientRequest(userId: string, requestId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: requestId, userId },
      include: { relatedOrder: true },
    });
    if (!session) throw new NotFoundException('Demande introuvable');
    const parsed = parseGuidanceRequest(session.messages);
    if (!parsed) throw new NotFoundException('Demande introuvable');
    return this.toRequestDto(session, parsed, 'CLIENT', true);
  }

  async addClientMessage(userId: string, requestId: string, contentInput: string) {
    const content = this.cleanText(contentInput, 'Message', 2, 5000);
    const updated = await this.mutateRequest(requestId, async (session, parsed) => {
      if (session.userId !== userId) throw new NotFoundException('Demande introuvable');
      if (parsed.meta.status === 'ARCHIVED') {
        throw new BadRequestException('Cette demande est archivée');
      }
      const now = new Date().toISOString();
      parsed.messages.push(this.createMessage('CLIENT', userId, null, content, now, 'CLIENT'));
      parsed.meta.status = 'WAITING_EXPERT';
      parsed.meta.updatedAt = now;
      parsed.meta.resolvedAt = null;
      return { parsed, isActive: true, lastMessageAt: new Date(now) };
    });
    return this.toRequestDto(updated.session, updated.parsed, 'CLIENT', true);
  }

  async markClientRead(userId: string, requestId: string) {
    const updated = await this.mutateRequest(requestId, async (session, parsed) => {
      if (session.userId !== userId) throw new NotFoundException('Demande introuvable');
      const now = new Date().toISOString();
      parsed.messages = parsed.messages.map((message) =>
        message.senderType === 'EXPERT' && !message.readByClientAt
          ? { ...message, readByClientAt: now }
          : message,
      );
      return { parsed };
    });
    return { success: true, request: this.toRequestDto(updated.session, updated.parsed, 'CLIENT') };
  }

  async listExpertRequests(expert: Expert, options: GuidanceRequestListOptions = {}) {
    const limit = Math.min(Math.max(options.limit || 200, 1), 500);
    const sessions = await this.prisma.chatSession.findMany({
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: { user: true, relatedOrder: true },
    });

    return sessions.flatMap((session) => {
      const parsed = parseGuidanceRequest(session.messages);
      if (!parsed) return [];
      if (options.status && parsed.meta.status !== options.status) return [];
      if (options.assignedTo === 'mine' && parsed.meta.assignedExpertId !== expert.id) return [];
      if (options.assignedTo === 'unassigned' && parsed.meta.assignedExpertId) return [];
      if (options.unreadOnly && !this.hasUnreadForExpert(parsed)) return [];
      return [this.toRequestDto(session, parsed, 'EXPERT')];
    });
  }

  async getExpertRequest(requestId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: requestId },
      include: { user: true, relatedOrder: true },
    });
    if (!session) throw new NotFoundException('Demande introuvable');
    const parsed = parseGuidanceRequest(session.messages);
    if (!parsed) throw new NotFoundException('Demande introuvable');
    return this.toRequestDto(session, parsed, 'EXPERT', true);
  }

  async assignRequest(requestId: string, expert: Expert) {
    const updated = await this.mutateRequest(requestId, async (_session, parsed) => {
      if (
        parsed.meta.assignedExpertId &&
        parsed.meta.assignedExpertId !== expert.id &&
        expert.role !== 'ADMIN'
      ) {
        throw new ConflictException('Cette demande est déjà assignée à un autre expert');
      }
      const now = new Date().toISOString();
      parsed.meta.assignedExpertId = expert.id;
      parsed.meta.assignedExpertName = expert.name;
      parsed.meta.updatedAt = now;
      if (parsed.meta.status === 'NEW') parsed.meta.status = 'IN_PROGRESS';
      return { parsed };
    });
    return this.toRequestDto(updated.session, updated.parsed, 'EXPERT', true);
  }

  async addExpertMessage(expert: Expert, requestId: string, contentInput: string) {
    const content = this.cleanText(contentInput, 'Réponse', 2, 10000);
    const updated = await this.mutateRequest(requestId, async (_session, parsed) => {
      if (
        parsed.meta.assignedExpertId &&
        parsed.meta.assignedExpertId !== expert.id &&
        expert.role !== 'ADMIN'
      ) {
        throw new ForbiddenException('Cette demande est assignée à un autre expert');
      }
      const now = new Date().toISOString();
      parsed.meta.assignedExpertId = parsed.meta.assignedExpertId || expert.id;
      parsed.meta.assignedExpertName = parsed.meta.assignedExpertName || expert.name;
      parsed.meta.status = 'WAITING_CLIENT';
      parsed.meta.updatedAt = now;
      parsed.meta.resolvedAt = null;
      parsed.messages.push(
        this.createMessage('EXPERT', expert.id, expert.name, content, now, 'EXPERT'),
      );
      return { parsed, isActive: true, lastMessageAt: new Date(now) };
    });

    await this.prisma.notification.create({
      data: {
        userId: updated.session.userId,
        type: 'SYSTEM',
        title: 'Une réponse vous attend',
        message: 'Une réponse à votre demande d’éclairage est disponible dans votre Sanctuaire.',
        metadata: {
          guidanceRequestId: updated.session.id,
          relatedOrderId: updated.session.relatedOrderId,
        },
      },
    });

    return this.toRequestDto(updated.session, updated.parsed, 'EXPERT', true);
  }

  async updateStatus(requestId: string, statusInput: string, expert: Expert) {
    if (!GUIDANCE_REQUEST_STATUSES.includes(statusInput as GuidanceRequestStatus)) {
      throw new BadRequestException('Statut de demande invalide');
    }
    const status = statusInput as GuidanceRequestStatus;
    const updated = await this.mutateRequest(requestId, async (_session, parsed) => {
      if (
        parsed.meta.assignedExpertId &&
        parsed.meta.assignedExpertId !== expert.id &&
        expert.role !== 'ADMIN'
      ) {
        throw new ForbiddenException('Cette demande est assignée à un autre expert');
      }
      const now = new Date().toISOString();
      parsed.meta.status = status;
      parsed.meta.updatedAt = now;
      parsed.meta.resolvedAt = status === 'RESOLVED' ? now : null;
      return { parsed, isActive: !['RESOLVED', 'ARCHIVED'].includes(status) };
    });
    return this.toRequestDto(updated.session, updated.parsed, 'EXPERT', true);
  }

  async markExpertRead(requestId: string) {
    const updated = await this.mutateRequest(requestId, async (_session, parsed) => {
      const now = new Date().toISOString();
      parsed.messages = parsed.messages.map((message) =>
        message.senderType === 'CLIENT' && !message.readByExpertAt
          ? { ...message, readByExpertAt: now }
          : message,
      );
      return { parsed };
    });
    return { success: true, request: this.toRequestDto(updated.session, updated.parsed, 'EXPERT') };
  }

  private async mutateRequest(
    requestId: string,
    mutate: (
      session: { id: string; userId: string; relatedOrderId: string | null },
      parsed: ParsedGuidanceRequest,
    ) => Promise<{
      parsed: ParsedGuidanceRequest;
      isActive?: boolean;
      lastMessageAt?: Date;
    }>,
  ) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const session = await tx.chatSession.findUnique({
              where: { id: requestId },
              include: { user: true, relatedOrder: true },
            });
            if (!session) throw new NotFoundException('Demande introuvable');
            const parsed = parseGuidanceRequest(session.messages);
            if (!parsed) throw new NotFoundException('Demande introuvable');
            const mutation = await mutate(session, parsed);
            const updatedSession = await tx.chatSession.update({
              where: { id: requestId },
              data: {
                messages: serializeGuidanceRequest(mutation.parsed),
                isActive: mutation.isActive ?? session.isActive,
                lastMessageAt: mutation.lastMessageAt ?? session.lastMessageAt,
              },
              include: { user: true, relatedOrder: true },
            });
            return { session: updatedSession, parsed: mutation.parsed };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if ((error as { code?: string })?.code !== 'P2034' || attempt === 3) throw error;
      }
    }
    throw new ConflictException('La demande a été modifiée simultanément. Réessayez.');
  }

  private toRequestDto(
    session: {
      id: string;
      userId: string;
      relatedOrderId: string | null;
      title: string | null;
      isActive: boolean;
      lastMessageAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      user?: { firstName: string; lastName: string; email: string } | null;
      relatedOrder?: { orderNumber: string } | null;
    },
    parsed: ParsedGuidanceRequest,
    viewer: 'CLIENT' | 'EXPERT',
    includeMessages = false,
  ) {
    const unreadCount = parsed.messages.filter((message) =>
      viewer === 'CLIENT'
        ? message.senderType === 'EXPERT' && !message.readByClientAt
        : message.senderType === 'CLIENT' && !message.readByExpertAt,
    ).length;
    const lastMessage = parsed.messages[parsed.messages.length - 1] || null;

    return {
      id: session.id,
      subject: session.title || 'Demande d’éclairage',
      status: parsed.meta.status,
      category: parsed.meta.category,
      priority: parsed.meta.priority,
      assignedExpert: parsed.meta.assignedExpertId
        ? {
            id: parsed.meta.assignedExpertId,
            name: parsed.meta.assignedExpertName || 'Expert',
          }
        : null,
      client: session.user
        ? {
            id: session.userId,
            firstName: session.user.firstName,
            lastName: session.user.lastName,
            email: session.user.email,
          }
        : undefined,
      relatedReading: session.relatedOrderId
        ? {
            id: session.relatedOrderId,
            orderNumber: session.relatedOrder?.orderNumber || null,
          }
        : null,
      unreadCount,
      messageCount: parsed.messages.length,
      lastSender: lastMessage?.senderType || null,
      lastMessageAt: session.lastMessageAt || session.updatedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: includeMessages ? parsed.messages : undefined,
    };
  }

  private createMessage(
    senderType: GuidanceMessage['senderType'],
    senderId: string,
    senderName: string | null,
    content: string,
    createdAt: string,
    reader: 'CLIENT' | 'EXPERT',
  ): GuidanceMessage {
    return {
      kind: GUIDANCE_MESSAGE_KIND,
      id: `msg_${randomUUID()}`,
      senderType,
      senderId,
      senderName,
      content,
      createdAt,
      readByClientAt: reader === 'CLIENT' ? createdAt : null,
      readByExpertAt: reader === 'EXPERT' ? createdAt : null,
    };
  }

  private async assertLifetimeAccess(userId: string) {
    const paidOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'] },
      },
      select: { id: true },
    });
    if (!paidOrder) {
      throw new ForbiddenException('Une commande payée est nécessaire pour envoyer une demande');
    }
  }

  private hasUnreadForExpert(parsed: ParsedGuidanceRequest) {
    return parsed.messages.some(
      (message) => message.senderType === 'CLIENT' && !message.readByExpertAt,
    );
  }

  private cleanText(value: string, label: string, min: number, max: number) {
    const clean = typeof value === 'string' ? value.trim() : '';
    if (clean.length < min || clean.length > max) {
      throw new BadRequestException(`${label} doit contenir entre ${min} et ${max} caractères`);
    }
    return clean;
  }
}
