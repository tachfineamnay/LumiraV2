import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { IdGenerator } from '../../utils/IdGenerator';
import { NotificationsService } from '../notifications/notifications.service';
import { DigitalSoulService } from '../../services/factory/DigitalSoulService';
import { VertexOracle } from '../../services/factory/VertexOracle';
import { ExpertGateway } from './expert.gateway';
import * as bcrypt from 'bcryptjs';
import { Expert, Order, Prisma, User, UserProfile, OrderFile, UserStatus } from '@prisma/client';
import {
  buildGeneratedReadingVersion,
  buildStudioReadingVersion,
  CanonicalReadingContent,
  hashReadingContent,
} from './reading-version';

type ExpertWithoutPassword = Omit<Expert, 'password'>;

import {
  LoginExpertDto,
  RegisterExpertDto,
  ValidateContentDto,
  ProcessOrderDto,
  UpdateClientDto,
  PaginationDto,
  CreateClientDto,
  UpdateClientStatusDto,
  RefineContentDto,
  ChatOrderDto,
  ClientsQueryDto,
} from './dto';

interface ExpertEntity {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClientStats {
  totalOrders: number;
  completedOrders: number;
  totalSpent: number;
  favoriteLevel: string | null;
  lastOrderAt: Date | null;
}

export interface DashboardStats {
  pendingOrders: number;
  processingOrders: number;
  awaitingValidation: number;
  completedOrders: number;
  totalRevenue: number;
  todayOrders: number;
}

@Injectable()
export class ExpertService {
  private readonly logger = new Logger(ExpertService.name);
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private idGenerator: IdGenerator,
    private notificationsService: NotificationsService,
    private digitalSoulService: DigitalSoulService,
    private vertexOracle: VertexOracle,
    private gateway: ExpertGateway,
  ) {
    this.logger.log(`🔌 DigitalSoulService injected via DI`);
  }

  // ========================
  // AUTHENTICATION
  // ========================

  async login(
    dto: LoginExpertDto,
  ): Promise<{ accessToken: string; refreshToken: string; expert: Omit<Expert, 'password'> }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const expert = await this.prisma.expert.findUnique({
      where: { email: normalizedEmail },
    });

    if (!expert) {
      this.logger.warn(`🔐 Login failed: expert not found - ${normalizedEmail}`);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (!expert.isActive) {
      this.logger.warn(`🔐 Login failed: expert inactive - ${normalizedEmail}`);
      throw new UnauthorizedException('Compte désactivé');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, expert.password);
    if (!isPasswordValid) {
      this.logger.warn(`🔐 Login failed: invalid password - ${normalizedEmail}`);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Update last login
    await this.prisma.expert.update({
      where: { id: expert.id },
      data: { lastLogin: new Date() },
    });

    const payload = { sub: expert.id, email: expert.email, role: expert.role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '8h'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    this.logger.log(`✅ Expert logged in: ${expert.email}`);

    return {
      accessToken,
      refreshToken,
      expert: {
        ...expert,
        password: '',
      } as unknown as ExpertWithoutPassword,
    };
  }

  async register(dto: RegisterExpertDto): Promise<Omit<Expert, 'password'>> {
    const existingExpert = await this.prisma.expert.findUnique({
      where: { email: dto.email },
    });

    if (existingExpert) {
      throw new BadRequestException('Un expert avec cet email existe déjà');
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const expert = await this.prisma.expert.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role || 'EXPERT',
      },
    });

    this.logger.log(`✅ Expert registered: ${expert.email}`);

    return {
      ...expert,
      password: '',
    } as unknown as ExpertWithoutPassword;
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_SECRET'),
      });

      const expert = await this.prisma.expert.findUnique({
        where: { id: payload.sub },
      });

      if (!expert || !expert.isActive) {
        throw new UnauthorizedException('Expert non trouvé ou inactif');
      }

      const newPayload = { sub: expert.id, email: expert.email, role: expert.role };
      const accessToken = this.jwtService.sign(newPayload, {
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '8h'),
      });

      return { accessToken };
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
  }

  async getProfile(expertId: string): Promise<Omit<Expert, 'password'>> {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
    });

    if (!expert) {
      throw new NotFoundException('Expert non trouvé');
    }

    return {
      ...expert,
      password: '',
    } as unknown as ExpertWithoutPassword;
  }

  // ========================
  // ORDERS
  // ========================

  /**
   * Get recent activity feed for the desk dashboard.
   * Returns recent order events (new, completed, etc.).
   */
  async getActivity(limit: number) {
    const recentOrders = await this.prisma.order.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    const activities = recentOrders.map((order) => {
      let type: string;
      let message: string;
      let timestamp: string;

      switch (order.status) {
        case 'PAID':
          type = 'new_order';
          message = `Nouvelle commande de ${order.userName || order.userEmail}`;
          timestamp = order.createdAt.toISOString();
          break;
        case 'PROCESSING':
          type = 'processing';
          message = `Commande ${order.orderNumber} en cours de traitement`;
          timestamp = order.updatedAt.toISOString();
          break;
        case 'AWAITING_VALIDATION':
          type = 'awaiting_validation';
          message = `Lecture ${order.orderNumber} prête à valider`;
          timestamp = order.updatedAt.toISOString();
          break;
        case 'COMPLETED':
          type = 'completed';
          message = `Commande ${order.orderNumber} terminée`;
          timestamp = order.updatedAt.toISOString();
          break;
        default:
          type = 'status_change';
          message = `Commande ${order.orderNumber} → ${order.status}`;
          timestamp = order.updatedAt.toISOString();
      }

      return {
        id: order.id,
        type,
        message,
        orderNumber: order.orderNumber,
        timestamp,
      };
    });

    return { activities };
  }

  /**
   * Get newly paid orders (PAID status).
   * These are orders that just completed payment and are waiting for expert to start work.
   */
  async getPaidOrders(dto: PaginationDto): Promise<PaginatedResult<Order>> {
    const { page = 1, limit = 20, search } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      status: 'PAID',
    };

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            include: { profile: true },
          },
          files: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get orders awaiting validation (AWAITING_VALIDATION status).
   * These are orders where AI generation is complete and ready for expert review.
   * @param dto.since - Optional ISO date string to filter orders created/updated after this date
   */
  async getPendingOrders(dto: PaginationDto & { since?: string }): Promise<PaginatedResult<Order>> {
    const { page = 1, limit = 20, search, since } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      status: 'AWAITING_VALIDATION',
    };

    // Filter by 'since' date if provided (for notification polling)
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.updatedAt = { gte: sinceDate };
      }
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: true, files: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProcessingOrders(dto: PaginationDto): Promise<PaginatedResult<Order>> {
    const { page = 1, limit = 20, search } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      status: 'PROCESSING',
    };

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: { user: true, files: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getValidationQueue(dto: PaginationDto): Promise<PaginatedResult<Order>> {
    const { page = 1, limit = 20, search } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      status: 'AWAITING_VALIDATION',
    };

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: { user: true, files: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrderHistory(dto: PaginationDto): Promise<PaginatedResult<Order>> {
    const { page = 1, limit = 20, search, status } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      status: { in: ['COMPLETED', 'FAILED', 'REFUNDED'] },
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: { user: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrderById(
    orderId: string,
  ): Promise<Order & { user: User & { profile: UserProfile | null }; files: OrderFile[] }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { include: { profile: true } }, files: true },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    return order;
  }

  async assignOrder(orderId: string, expertId: string): Promise<Order> {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
      select: { name: true },
    });

    if (!expert) {
      throw new NotFoundException('Expert non trouvé');
    }

    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, expertReview: true },
    });
    if (!existing) {
      throw new NotFoundException('Commande non trouvée');
    }
    if (!['PAID', 'AWAITING_VALIDATION', 'FAILED'].includes(existing.status)) {
      throw new BadRequestException(
        `Cette commande ne peut pas être prise (statut: ${existing.status})`,
      );
    }
    const assignedBy = (existing.expertReview as Record<string, unknown> | null)?.assignedBy;
    if (assignedBy && assignedBy !== expertId) {
      throw new ConflictException('Cette commande est déjà assignée à un autre expert');
    }

    // Claiming an order records ownership but does not pretend that AI work
    // has started. Only the generation lock may move an order to PROCESSING.
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        expertReview: {
          ...((existing.expertReview as Record<string, unknown>) || {}),
          assignedBy: expertId,
          assignedName: expert.name,
          assignedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`📋 Order ${updatedOrder.orderNumber} assigned to expert ${expertId}`);

    // Notify all connected experts in real-time
    this.gateway.notifyOrderClaimed({
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      expertId,
      expertName: expert?.name || 'Expert',
    });

    return updatedOrder;
  }

  /**
   * Desk status update with transition guards.
   * PAID is webhook-only and cannot be set here.
   */
  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    if (status === 'PAID') {
      throw new ForbiddenException('PAID status can only be set by the payment webhook');
    }

    const EXPERT_TRANSITIONS: Record<string, string[]> = {
      PAID: ['PROCESSING'],
      PROCESSING: ['AWAITING_VALIDATION', 'FAILED'],
      AWAITING_VALIDATION: ['COMPLETED', 'PROCESSING'],
      FAILED: ['PROCESSING'],
      COMPLETED: [],
      REFUNDED: [],
      PENDING: [],
    };

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    const allowed = EXPERT_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: status as Order['status'] },
    });
  }

  /**
   * Autosave studio draft content into generatedContent.
   */
  async saveOrderDraft(orderId: string, content: string, expertId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    if (!['PROCESSING', 'AWAITING_VALIDATION', 'FAILED'].includes(order.status)) {
      throw new BadRequestException(`Cannot save draft for order in status ${order.status}`);
    }

    const existing = (order.generatedContent as Record<string, unknown>) || {};
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        generatedContent: {
          ...existing,
          lecture: content,
          draftSavedAt: new Date().toISOString(),
          draftSavedBy: expertId,
        },
      },
    });
  }

  async deleteOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    // Delete related files first
    await this.prisma.orderFile.deleteMany({
      where: { orderId },
    });

    await this.prisma.order.delete({
      where: { id: orderId },
    });

    this.logger.log(`🗑️ Order ${order.orderNumber} deleted`);
  }

  // ========================
  // ORDER PROCESSING
  // ========================

  async processOrder(
    dto: ProcessOrderDto,
    expert: ExpertEntity,
  ): Promise<Order & { generationResult?: { archetype: string; stepsCreated: number } }> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { user: { include: { profile: true } }, files: true },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    // PROCESSING is an active generation lease, never a requestable state.
    const validStatuses = ['PAID', 'AWAITING_VALIDATION', 'FAILED'];
    if (!validStatuses.includes(order.status)) {
      throw new BadRequestException("Cette commande n'est pas prête pour la génération");
    }
    const assignedBy = (order.expertReview as Record<string, unknown> | null)?.assignedBy;
    if (assignedBy && assignedBy !== expert.id && expert.role !== 'ADMIN') {
      throw new ForbiddenException('Cette commande est assignée à un autre expert');
    }

    // Persist expert context before DigitalSoul acquires the atomic lease.
    const updatedOrder = await this.prisma.order.update({
      where: { id: dto.orderId },
      data: {
        expertPrompt: dto.expertPrompt,
        expertInstructions: dto.expertInstructions,
        expertReview: {
          ...((order.expertReview as Record<string, unknown>) || {}),
          processedBy: expert.id,
          processedAt: new Date().toISOString(),
        },
      },
    });

    // Use internal DigitalSoulService instead of n8n webhook
    this.logger.log(`🚀 Starting internal generation for order ${order.orderNumber}`);

    try {
      // Generate AI content only (no PDF yet) - will be validated by expert
      const result = await this.digitalSoulService.generateContentOnly(dto.orderId);

      this.logger.log(
        `✅ Order ${order.orderNumber} content generated - Archetype: ${result.archetype}`,
      );
      this.logger.log(`📋 Order now AWAITING_VALIDATION`);

      // Fetch the updated order with generated content
      const finalOrder = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: { user: { include: { profile: true } }, files: true },
      });

      this.gateway.notifyOrderStatusChange({
        id: dto.orderId,
        orderNumber: order.orderNumber,
        previousStatus: order.status,
        newStatus: 'AWAITING_VALIDATION',
        updatedBy: expert.id,
      });
      this.gateway.notifyGenerationComplete(dto.orderId, order.orderNumber, true);

      return {
        ...(finalOrder || updatedOrder),
        generationResult: {
          archetype: result.archetype,
          stepsCreated: result.stepsCreated,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Generation failed for order ${order.orderNumber}: ${error}`);

      // Update order status to FAILED
      await this.prisma.order.update({
        where: { id: dto.orderId },
        data: {
          status: 'FAILED',
          errorLog: `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
      this.gateway.notifyGenerationComplete(
        dto.orderId,
        order.orderNumber,
        false,
        error instanceof Error ? error.message : String(error),
      );

      throw new BadRequestException(
        `Échec de la génération: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * @deprecated This method is no longer used - order generation now uses internal DigitalSoulService.
   * Kept for reference and potential future external integration needs.
   */
  private async sendToN8n(payload: Record<string, unknown>, retries = 3): Promise<void> {
    const webhookUrl = this.configService.get('N8N_WEBHOOK_URL');
    const secret = this.configService.get('N8N_CALLBACK_SECRET');
    const timeout = this.configService.get('N8N_TIMEOUT_MS', 10000);

    if (!webhookUrl) {
      this.logger.warn('⚠️ N8N_WEBHOOK_URL not configured, skipping webhook');
      return;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const body = JSON.stringify(payload);

        // Generate HMAC signature
        const crypto = await import('crypto');
        if (!secret) {
          throw new BadRequestException('N8N_CALLBACK_SECRET non configuré');
        }
        const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), Number(timeout));

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Lumira-Signature': signature,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`n8n responded with ${response.status}`);
        }

        this.logger.log(`✅ n8n webhook sent successfully (attempt ${attempt})`);
        return;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`⚠️ n8n webhook attempt ${attempt} failed: ${errorMessage}`);

        if (attempt === retries) {
          this.logger.error(`❌ n8n webhook failed after ${retries} attempts`);
          throw new BadRequestException("Échec de l'envoi vers n8n");
        }

        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async validateContent(dto: ValidateContentDto, expert: ExpertEntity): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    if (order.status !== 'AWAITING_VALIDATION') {
      throw new BadRequestException("Cette commande n'est pas en attente de validation");
    }

    if (dto.action === 'approve') {
      this.logger.log(`📋 Approving order ${order.orderNumber} - generating PDF...`);

      // Generate PDF and finalize order using DigitalSoulService
      try {
        await this.sealReadingVersion(
          order,
          buildGeneratedReadingVersion(order.generatedContent),
          expert,
          'EXPERT_APPROVAL',
        );

        // Generate PDF and finalize
        const result = await this.digitalSoulService.finalizeWithPdf(dto.orderId);

        // Update with expert validation info
        const updatedOrder = await this.prisma.order.update({
          where: { id: dto.orderId },
          data: {
            expertValidation: {
              action: 'approve',
              validatedBy: expert.id,
              validatedAt: new Date().toISOString(),
              notes: dto.validationNotes,
              pdfUrl: result.pdfUrl,
            },
          },
        });

        await this.sendDeliveryEmail(dto.orderId, expert.name || 'Un expert Lumira');

        this.logger.log(`✅ Order ${order.orderNumber} approved and PDF delivered`);
        return updatedOrder;
      } catch (error) {
        this.logger.error(`❌ Failed to finalize order ${order.orderNumber}: ${error}`);
        throw new BadRequestException(
          `Échec de la génération PDF: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      // Reject - increment revision count and reset status
      const updatedOrder = await this.prisma.order.update({
        where: { id: dto.orderId },
        data: {
          status: 'PROCESSING',
          revisionCount: { increment: 1 },
          generatedContent: null,
          expertValidation: {
            action: 'reject',
            rejectedBy: expert.id,
            rejectedAt: new Date().toISOString(),
            reason: dto.rejectionReason,
          },
        },
      });

      this.logger.log(`❌ Order ${order.orderNumber} rejected: ${dto.rejectionReason}`);
      return updatedOrder;
    }
  }

  async regenerateLecture(
    orderId: string,
    expert: ExpertEntity,
  ): Promise<Order & { generationResult?: { archetype: string; stepsCreated: number } }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { include: { profile: true } } },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    if (!order.expertPrompt) {
      throw new BadRequestException('Aucun prompt expert enregistré pour cette commande');
    }
    if (!['AWAITING_VALIDATION', 'FAILED'].includes(order.status)) {
      throw new BadRequestException(
        `Cette commande ne peut pas être régénérée (statut: ${order.status})`,
      );
    }

    // Keep a lockable source status. generateContentOnly will atomically set
    // PROCESSING and then return the order to AWAITING_VALIDATION.
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        generatedContent: null,
        revisionCount: { increment: 1 },
      },
    });

    return this.processOrder(
      {
        orderId,
        expertPrompt: order.expertPrompt,
        expertInstructions: order.expertInstructions || undefined,
      },
      expert,
    );
  }

  /**
   * Triggers AI-powered reading generation using the new Internal Factory.
   * Generates content only. PDF creation is restricted to validation.
   */
  async generateReading(
    orderId: string,
    expert: ExpertEntity,
  ): Promise<{
    success: boolean;
    orderId: string;
    orderNumber: string;
    archetype: string;
    stepsCreated: number;
  }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }
    if (!['PAID', 'AWAITING_VALIDATION', 'FAILED'].includes(order.status)) {
      throw new BadRequestException(
        `Cette commande n’est pas prête pour la génération (statut: ${order.status})`,
      );
    }
    const review = (order.expertReview as Record<string, unknown> | null) || {};
    if (!review.assignedBy) {
      await this.assignOrder(orderId, expert.id);
    }
    return this.generateReadingWithPrompt(orderId, undefined, expert);
  }

  /**
   * Triggers AI-powered reading generation with optional expert prompt.
   * Called by /generate-full endpoint from admin panel.
   */
  async generateReadingWithPrompt(
    orderId: string,
    expertPrompt: string | undefined,
    expert: ExpertEntity,
  ): Promise<{
    success: boolean;
    orderId: string;
    orderNumber: string;
    archetype: string;
    stepsCreated: number;
  }> {
    this.logger.log(
      `🚀 Starting AI reading generation for order: ${orderId}${expertPrompt ? ' (with expert prompt)' : ''}`,
    );

    const order = await this.processOrder({ orderId, expertPrompt }, expert);
    const result = order.generationResult;
    if (!result) {
      throw new BadRequestException('La génération de contenu n’a retourné aucun résultat');
    }
    return {
      success: true,
      orderId,
      orderNumber: order.orderNumber,
      archetype: result.archetype,
      stepsCreated: result.stepsCreated,
    };
  }

  // ========================
  // CLIENTS
  // ========================

  /**
   * Refine content using AI based on expert prompt.
   * Used in the Co-Creation Studio for content adjustments.
   */
  async refineContent(
    orderId: string,
    dto: RefineContentDto,
    expert: ExpertEntity,
  ): Promise<{ message: string; updatedContent?: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { include: { profile: true } } },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    this.logger.log(
      `🎨 Refining content for order ${order.orderNumber} with instruction: "${dto.instruction}"`,
    );

    try {
      // Build the refinement prompt - matching spec exactly
      const systemPrompt = `Tu es Oracle Lumira, un guide spirituel expert en lectures karmiques et astrologiques.
Voici un texte sacré. Voici l'instruction de l'Expert : [Instruction].
Réécris le texte en appliquant la modification.
Garde le même format Markdown.
IMPORTANT: Retourne UNIQUEMENT le contenu modifié, sans explications ni commentaires.`;

      const userPrompt = `## Instruction de l'Expert:
${dto.instruction}

## Texte sacré à modifier:
${dto.currentContent}

## Texte modifié:`;

      const refinedContent = await this.vertexOracle.refineText(userPrompt, {
        systemPrompt,
        maxTokens: 4096,
        temperature: 0.7,
      });

      // Update order with refined content AND save version history
      const currentGenerated = (order.generatedContent as Record<string, unknown>) || {};
      const existingVersions =
        (currentGenerated.contentVersions as Array<{
          content: string;
          timestamp: string;
          action: string;
          expertId: string;
        }>) || [];

      // Save current content to version history before replacing
      const previousContent = currentGenerated.lecture as string;
      if (previousContent) {
        existingVersions.push({
          content: previousContent,
          timestamp: new Date().toISOString(),
          action: 'refine',
          expertId: expert.id,
        });
      }

      // Keep only last 10 versions to avoid bloat
      const trimmedVersions = existingVersions.slice(-10);

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          generatedContent: {
            ...currentGenerated,
            lecture: refinedContent,
            contentVersions: trimmedVersions,
            lastRefinedAt: new Date().toISOString(),
            refinedBy: expert.id,
          },
        },
      });

      this.logger.log(`✅ Content refined for order ${order.orderNumber}`);

      return {
        message: `Le contenu a été affiné selon vos instructions.`,
        updatedContent: refinedContent,
      };
    } catch (error) {
      this.logger.error(`❌ Content refinement failed: ${error}`);
      throw new BadRequestException(
        `Échec du raffinement: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * AI Chat endpoint for the Desk v2 AI Assistant.
   * Uses Gemini Flash model for fast conversational responses about a specific order.
   */
  async chatAboutOrder(
    orderId: string,
    dto: ChatOrderDto,
    expert: ExpertEntity,
  ): Promise<{ response: string; suggestedEdit: string | null; hasSuggestion: boolean }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { include: { profile: true } },
        files: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    this.logger.log(`💬 AI Chat for order ${order.orderNumber} - Expert: ${expert.name}`);

    try {
      const profile = order.user?.profile;
      const currentContent =
        ((order.generatedContent as Record<string, unknown>)?.lecture as string) || '';

      // Build rich context for the AI
      // Profile fields from UserProfile schema
      const chatContext = {
        userId: order.userId,
        firstName:
          dto.context?.firstName || (profile as { firstName?: string })?.firstName || 'Inconnu',
        birthDate: dto.context?.birthDate || profile?.birthDate || '',
        question: dto.context?.question || profile?.specificQuestion || '',
        objective: dto.context?.objective || profile?.objective || '',
        emotionalState:
          dto.context?.emotionalState ||
          (profile as { emotionalState?: string })?.emotionalState ||
          '',
        orderLevel: 4,
        orderNumber: order.orderNumber,
        hasGeneratedContent: !!currentContent,
        existingLecture: currentContent ? currentContent.substring(0, 2000) : '', // First 2000 chars for context
      };

      // Enhanced system prompt for Desk assistant - with structured edit suggestions
      const systemPrompt = `Tu es l'assistant IA d'Oracle Lumira, spécialisé dans les lectures spirituelles et karmiques.
Tu assistes l'expert "${expert.name}" dans la création d'une lecture pour ${chatContext.firstName}.

CONTEXTE DE LA COMMANDE:
- Numéro: ${chatContext.orderNumber}
- Niveau: ${chatContext.orderLevel}
- Question: ${chatContext.question}
- Objectif spirituel: ${chatContext.objective}
- État émotionnel: ${chatContext.emotionalState}
${chatContext.hasGeneratedContent ? `- Lecture en cours (extrait): ${chatContext.existingLecture.substring(0, 500)}...` : '- Pas encore de lecture générée'}

RÈGLES:
1. Réponds de manière concise et mystique
2. Utilise le vocabulaire spirituel de Lumira (archétypes, chemin karmique, énergies, cycles...)
3. Propose des insights actionnables pour l'expert
4. Si on te demande des suggestions de contenu, reste créatif mais aligné avec le profil du client
5. Réponds en français
6. **IMPORTANT**: Si l'expert demande de modifier/améliorer/réécrire du contenu, structure ta réponse ainsi:
   - D'abord une brève explication de ta suggestion
   - Puis le texte proposé entre balises <suggestion>...</suggestion> pour faciliter l'insertion

MESSAGE DE L'EXPERT:`;

      // Use the chatWithUser method but with our custom system prompt
      const response = await this.vertexOracle.refineText(`${systemPrompt}\n\n${dto.message}`, {
        maxTokens: 1024,
        temperature: 0.9,
      });

      this.logger.log(`✅ AI Chat response generated for order ${order.orderNumber}`);

      // Extract suggested edit if present
      const suggestionMatch = response.match(/<suggestion>(.*?)<\/suggestion>/s);
      const suggestedEdit = suggestionMatch ? suggestionMatch[1].trim() : null;
      const cleanResponse = response.replace(/<suggestion>.*?<\/suggestion>/gs, '').trim();

      return {
        response: cleanResponse,
        suggestedEdit,
        hasSuggestion: !!suggestedEdit,
      };
    } catch (error) {
      this.logger.error(`❌ AI Chat failed: ${error}`);
      throw new BadRequestException(
        `Échec du chat IA: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate and seal an order from the Co-Creation Studio.
   * Saves the final content and generates the PDF.
   */
  async validateFromStudio(
    orderId: string,
    finalContent: string,
    approval: string,
    expert: ExpertEntity,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }
    if (order.status !== 'AWAITING_VALIDATION') {
      throw new BadRequestException(
        `La validation exige le statut AWAITING_VALIDATION (actuel : ${order.status})`,
      );
    }
    if (!finalContent?.trim()) {
      throw new BadRequestException('Le contenu final est requis pour valider la lecture');
    }
    if (approval !== 'APPROVED') {
      throw new BadRequestException(
        'Utilisez la demande de révision pour toute validation non approuvée',
      );
    }

    this.logger.log(`📋 Validating order ${order.orderNumber} from Studio`);

    const currentGenerated = (order.generatedContent as Record<string, unknown>) || {};
    await this.sealReadingVersion(
      order,
      buildStudioReadingVersion(currentGenerated, finalContent),
      expert,
      'STUDIO_VALIDATE',
    );

    // Generate PDF and finalize
    try {
      const result = await this.digitalSoulService.finalizeWithPdf(orderId);

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          expertValidation: {
            action: 'approve',
            validatedBy: expert.id,
            validatedAt: new Date().toISOString(),
            pdfUrl: result.pdfUrl,
            source: 'studio',
          },
        },
      });

      await this.sendDeliveryEmail(orderId, expert.name || 'Un expert Lumira');

      this.logger.log(`✅ Order ${order.orderNumber} sealed and PDF delivered from Studio`);
      this.gateway.notifyOrderSealed({
        id: order.id,
        orderNumber: order.orderNumber,
        sealedBy: expert.id,
      });
      return updatedOrder;
    } catch (error) {
      this.logger.error(`❌ Failed to finalize order ${order.orderNumber}: ${error}`);
      throw new BadRequestException(
        `Échec de la génération PDF: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Finalize an order from the Co-Creation Studio.
   * Seals the content and triggers PDF generation using Gotenberg.
   * Uses the current content from the Right Panel (not the initial draft).
   *
   * Handles two scenarios:
   * 1. AI-generated content exists (pdf_content structure) → use standard flow
   * 2. Manual content only (no AI generation) → build minimal pdf_content from raw text
   */
  async finalizeFromStudio(
    orderId: string,
    finalContent: string,
    expert: ExpertEntity,
  ): Promise<{ success: boolean; orderId: string; orderNumber: string; pdfUrl: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { include: { profile: true } } },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }
    if (order.status !== 'AWAITING_VALIDATION') {
      throw new BadRequestException(
        `La finalisation exige le statut AWAITING_VALIDATION (actuel : ${order.status})`,
      );
    }
    if (!finalContent?.trim()) {
      throw new BadRequestException('Le contenu final est requis pour sceller la lecture');
    }

    this.logger.log(`🔏 Finalizing order ${order.orderNumber} from Studio...`);

    try {
      const currentGenerated = (order.generatedContent as Record<string, unknown>) || {};
      await this.sealReadingVersion(
        order,
        buildStudioReadingVersion(currentGenerated, finalContent),
        expert,
        'STUDIO_FINALIZE',
      );

      // 2. Generate PDF and finalize (sets status=COMPLETED + deliveredAt)
      const result = await this.digitalSoulService.finalizeWithPdf(orderId);

      // 3. Append expert validation metadata (status already COMPLETED from finalizeWithPdf)
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          expertValidation: {
            action: 'finalize',
            finalizedBy: expert.id,
            finalizedAt: new Date().toISOString(),
            pdfUrl: result.pdfUrl,
            source: 'studio',
          },
        },
      });

      // 4. Send a tracked, retry-safe email notification to the client.
      await this.sendDeliveryEmail(orderId, expert.name || 'Un expert Lumira');

      this.logger.log(`✅ Order ${order.orderNumber} finalized - PDF: ${result.pdfUrl}`);
      this.gateway.notifyOrderSealed({
        id: order.id,
        orderNumber: order.orderNumber,
        sealedBy: expert.id,
      });

      return {
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        pdfUrl: result.pdfUrl,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to finalize order ${order.orderNumber}: ${error}`);

      // Update order status to FAILED
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'FAILED',
          errorLog: `Finalization failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      });

      throw new BadRequestException(
        `Échec de la finalisation: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Persists an immutable, auditable content version before the PDF is made.
   * The order JSON is kept as a denormalized display cache only; delivery reads
   * the ReadingVersion row, never this cache.
   */
  private async sealReadingVersion(
    order: Order,
    content: CanonicalReadingContent,
    expert: ExpertEntity,
    source: string,
  ) {
    const sealedAt = new Date();
    const currentGenerated = (order.generatedContent as Record<string, unknown>) || {};

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.readingVersion.findFirst({
        where: { orderId: order.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = await tx.readingVersion.create({
        data: {
          orderId: order.id,
          version: (latest?.version || 0) + 1,
          status: 'SEALED',
          content: content as unknown as Prisma.InputJsonValue,
          contentHash: hashReadingContent(content),
          source,
          sealedByExpertId: expert.id,
          sealedAt,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          generatedContent: {
            ...currentGenerated,
            ...content,
            canonicalReadingVersionId: version.id,
            sealedAt: sealedAt.toISOString(),
            sealedBy: expert.id,
            source,
          } as unknown as Prisma.InputJsonValue,
          status: 'AWAITING_VALIDATION',
        },
      });

      return version;
    });
  }

  /**
   * Sends at most one confirmation email per sealed PDF. The delivery record is
   * retained on failures so a scheduled retry can safely resume it later.
   */
  private async sendDeliveryEmail(orderId: string, expertName: string): Promise<void> {
    const [order, delivery] = await Promise.all([
      this.prisma.order.findUnique({ where: { id: orderId }, include: { user: true } }),
      this.prisma.deliveryRecord.findFirst({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!order || !delivery) {
      this.logger.warn(`No delivery record available for order ${orderId}; email not sent`);
      return;
    }
    if (delivery.emailStatus === 'SENT') {
      this.logger.log(`Delivery email already sent for ${order.orderNumber}`);
      return;
    }

    await this.prisma.deliveryRecord.update({
      where: { id: delivery.id },
      data: {
        emailStatus: 'SENDING',
        emailAttempts: { increment: 1 },
        lastEmailError: null,
      },
    });

    try {
      await this.notificationsService.sendExpertValidation(order, order.user, expertName);
      await this.prisma.deliveryRecord.update({
        where: { id: delivery.id },
        data: { emailStatus: 'SENT', emailSentAt: new Date(), lastEmailError: null },
      });
      this.logger.log(`📧 Delivery email sent to ${order.user.email} for ${order.orderNumber}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.deliveryRecord.update({
        where: { id: delivery.id },
        data: { emailStatus: 'FAILED', lastEmailError: message },
      });
      this.logger.error(`Delivery email failed for ${order.orderNumber}: ${message}`);
    }
  }

  async getClients(dto: ClientsQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      subscriptionStatus,
      hasOrders,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { refId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (subscriptionStatus) {
      where.subscriptionStatus = subscriptionStatus;
    }

    if (hasOrders === true) {
      where.totalOrders = { gt: 0 };
    } else if (hasOrders === false) {
      where.totalOrders = 0;
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    // Build orderBy — totalSpent needs post-sort
    const needsPostSort = sortBy === 'totalSpent';
    const orderBy: Record<string, string> = needsPostSort
      ? { createdAt: 'desc' }
      : { [sortBy]: sortOrder };

    const [clients, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: needsPostSort ? undefined : skip,
        take: needsPostSort ? undefined : limit,
        include: {
          profile: { select: { id: true, profileCompleted: true } },
          subscription: { select: { status: true, currentPeriodEnd: true } },
          orders: {
            select: { amount: true, status: true, formData: true },
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Enrich with computed fields
    const enriched = clients.map((client) => {
      const completedOrders = client.orders.filter(
        (o) => o.status === 'COMPLETED' || o.status === 'PAID',
      );
      const totalSpent = completedOrders.reduce((sum, o) => sum + o.amount, 0);
      const lastOrder = client.orders[0];
      const lastLevel = lastOrder?.formData
        ? ((lastOrder.formData as Record<string, unknown>)?.level as string) || null
        : null;

      return {
        id: client.id,
        refId: client.refId,
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        status: client.status,
        subscriptionStatus: client.subscriptionStatus,
        totalOrders: client._count.orders,
        totalSpent,
        lastLevel,
        lastOrderAt: client.lastOrderAt,
        tags: client.tags,
        source: client.source,
        createdAt: client.createdAt,
        profile: client.profile,
        subscription: client.subscription,
      };
    });

    // Post-sort if totalSpent
    if (needsPostSort) {
      enriched.sort((a, b) =>
        sortOrder === 'asc' ? a.totalSpent - b.totalSpent : b.totalSpent - a.totalSpent,
      );
      const paginated = enriched.slice(skip, skip + limit);
      return { data: paginated, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    return { data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getClientsStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalClients, activeSubscriptions, newThisMonth, revenueResult] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { subscriptionStatus: 'ACTIVE' } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.order.aggregate({
        where: { status: { in: ['COMPLETED', 'PAID'] } },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalClients,
      activeSubscriptions,
      newThisMonth,
      totalRevenue: revenueResult._sum.amount || 0,
    };
  }

  async getClientById(clientId: string): Promise<User & { profile: UserProfile | null }> {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      include: { profile: true },
    });

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    return client;
  }

  /**
   * Get complete client data for CRM "Dossier d'Âme" (Client 360)
   * Returns user + profile + orders + subscription + dreams + akashic record + insights + enriched stats
   */
  async getClientFull(clientId: string) {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      include: {
        profile: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            files: true,
          },
        },
        subscription: true,
        dreams: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        akashicRecord: true,
        spiritualPath: {
          include: {
            steps: {
              orderBy: { dayNumber: 'asc' },
            },
          },
        },
        chatSessions: {
          orderBy: { lastMessageAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            messages: true,
            lastMessageAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    // Get insights separately (different table)
    const insights = await this.prisma.insight.findMany({
      where: { userId: clientId },
      orderBy: { createdAt: 'desc' },
    });

    // ── Core order stats ──
    const completedOrders = client.orders.filter(
      (o: { status: string }) => o.status === 'COMPLETED',
    );
    const totalSpent = completedOrders.reduce(
      (sum: number, o: { amount: number }) => sum + o.amount,
      0,
    );
    const lastOrder = client.orders[0] || null;
    const isVip = totalSpent >= 29900;

    // ── Engagement metrics ──
    const stepsTotal = client.spiritualPath?.steps?.length ?? 0;
    const stepsCompleted =
      client.spiritualPath?.steps?.filter((s: { isCompleted: boolean }) => s.isCompleted).length ??
      0;
    const insightsTotal = insights.length;
    const insightsViewed = insights.filter(
      (i: { viewedAt: Date | null }) => i.viewedAt !== null,
    ).length;

    // Transform chatSessions to include messagesCount
    const chatSessionsWithCount = client.chatSessions.map(
      (session: {
        id: string;
        title: string | null;
        messages: unknown;
        lastMessageAt: Date | null;
        createdAt: Date;
      }) => ({
        id: session.id,
        title: session.title,
        messagesCount: Array.isArray(session.messages) ? session.messages.length : 0,
        lastMessageAt: session.lastMessageAt,
        createdAt: session.createdAt,
      }),
    );

    const chatMessagesTotal = chatSessionsWithCount.reduce(
      (sum: number, s: { messagesCount: number }) => sum + s.messagesCount,
      0,
    );
    const dreamsCount = client.dreams?.length ?? 0;

    // Engagement score (0-100): 30% steps + 25% insights viewed + 25% chat + 20% dreams
    const stepsScore = stepsTotal > 0 ? (stepsCompleted / stepsTotal) * 100 : 0;
    const insightsScore = insightsTotal > 0 ? (insightsViewed / insightsTotal) * 100 : 0;
    const chatScore = Math.min(chatMessagesTotal / 20, 1) * 100; // 20 messages = 100%
    const dreamsScore = Math.min(dreamsCount / 5, 1) * 100; // 5 dreams = 100%
    const engagementScore = Math.round(
      stepsScore * 0.3 + insightsScore * 0.25 + chatScore * 0.25 + dreamsScore * 0.2,
    );

    // ── Recency ──
    const activityDates: { date: Date; type: string }[] = [];
    if (lastOrder) activityDates.push({ date: new Date(lastOrder.createdAt), type: 'order' });
    const lastChat = chatSessionsWithCount[0];
    if (lastChat?.lastMessageAt)
      activityDates.push({ date: new Date(lastChat.lastMessageAt), type: 'chat' });
    if (client.dreams?.length > 0)
      activityDates.push({ date: new Date(client.dreams[0].createdAt), type: 'dream' });
    const completedSteps =
      client.spiritualPath?.steps?.filter((s: { isCompleted: boolean }) => s.isCompleted) ?? [];
    if (completedSteps.length > 0)
      activityDates.push({
        date: new Date(
          completedSteps[completedSteps.length - 1].updatedAt ??
            completedSteps[completedSteps.length - 1].createdAt,
        ),
        type: 'step',
      });

    activityDates.sort((a, b) => b.date.getTime() - a.date.getTime());
    const lastActivityDate = activityDates[0]?.date ?? null;
    const daysSinceLastActivity = lastActivityDate
      ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const lastActivityType = activityDates[0]?.type ?? 'none';

    // ── Content coverage ──
    const audioCoverage =
      insightsTotal > 0
        ? insights.filter((i: { audioUrl: string | null }) => i.audioUrl !== null).length /
          insightsTotal
        : 0;

    // Profile completeness (key profile fields)
    const profileKeyFields = [
      'birthDate',
      'birthTime',
      'birthPlace',
      'specificQuestion',
      'objective',
      'facePhotoUrl',
      'palmPhotoUrl',
      'highs',
      'lows',
      'fears',
      'rituals',
      'strongSide',
      'weakSide',
    ] as const;
    const profileFilledCount = client.profile
      ? profileKeyFields.filter(
          (f) =>
            client.profile![f] !== null &&
            client.profile![f] !== undefined &&
            client.profile![f] !== '',
        ).length
      : 0;
    const profileCompleteness = Math.round((profileFilledCount / profileKeyFields.length) * 100);

    // Archetype
    const archetype = client.spiritualPath?.archetype ?? client.akashicRecord?.archetype ?? null;

    // ── Subscription ──
    const sub = client.subscription;
    let subscriptionStatus: string = 'none';
    let subscriptionDaysLeft: number | null = null;
    if (sub) {
      if (sub.cancelAtPeriodEnd && sub.status === 'ACTIVE') {
        subscriptionStatus = 'canceling';
      } else if (sub.status === 'ACTIVE') {
        subscriptionStatus = 'active';
      } else if (['CANCELED', 'EXPIRED'].includes(sub.status)) {
        subscriptionStatus = 'expired';
      } else {
        subscriptionStatus = sub.status.toLowerCase();
      }
      subscriptionDaysLeft = Math.max(
        0,
        Math.floor((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );
    }

    // ── Upsell history ──
    const upsellHistory = client.orders
      .filter(
        (o: { addons?: unknown; upsellOfferedAt?: Date | null }) => o.addons || o.upsellOfferedAt,
      )
      .flatMap(
        (o: {
          id: string;
          addons?: unknown;
          upsellOfferedAt?: Date | null;
          upsellAcceptedAt?: Date | null;
        }) => {
          const items: {
            orderId: string;
            type: string;
            offeredAt: Date | null;
            acceptedAt: Date | null;
          }[] = [];
          if (Array.isArray(o.addons)) {
            for (const addon of o.addons as Array<{ type: string; paidAt?: string }>) {
              items.push({
                orderId: o.id,
                type: addon.type,
                offeredAt: o.upsellOfferedAt ?? null,
                acceptedAt: o.upsellAcceptedAt ?? null,
              });
            }
          } else if (o.upsellOfferedAt) {
            items.push({
              orderId: o.id,
              type: 'unknown',
              offeredAt: o.upsellOfferedAt,
              acceptedAt: o.upsellAcceptedAt ?? null,
            });
          }
          return items;
        },
      );

    return {
      ...client,
      chatSessions: chatSessionsWithCount,
      insights,
      stats: {
        totalOrders: client.orders.length,
        completedOrders: completedOrders.length,
        totalSpent,
        totalSpentFormatted: `${(totalSpent / 100).toFixed(2)} €`,
        favoriteLevel: null as string | null,
        highestLevel: 'Abonné',
        highestLevelNumber: 4,
        lastOrderAt: lastOrder?.createdAt || null,
        isVip,
        memberSince: client.createdAt,
        // Engagement
        engagementScore,
        stepsCompleted,
        stepsTotal,
        insightsViewed,
        insightsTotal,
        chatMessagesTotal,
        dreamsCount,
        // Recency
        daysSinceLastActivity,
        lastActivityType,
        // Content
        audioCoverage: Math.round(audioCoverage * 100),
        profileCompleteness,
        archetype,
        // Subscription
        subscriptionStatus,
        subscriptionDaysLeft,
        // Upsell
        upsellHistory,
      },
    };
  }

  async getClientStats(clientId: string): Promise<ClientStats> {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    const orders = await this.prisma.order.findMany({
      where: { userId: clientId },
      select: {
        status: true,
        amount: true,
        createdAt: true,
      },
    });

    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
    const totalSpent = completedOrders.reduce((sum, o) => sum + o.amount, 0);

    const favoriteLevel: string | null = null;

    const lastOrder = orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    return {
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      totalSpent,
      favoriteLevel,
      lastOrderAt: lastOrder?.createdAt || null,
    };
  }

  async getClientOrders(clientId: string, dto: PaginationDto): Promise<PaginatedResult<Order>> {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId: clientId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId: clientId } }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateClient(clientId: string, dto: UpdateClientDto): Promise<User> {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    const updatedClient = await this.prisma.user.update({
      where: { id: clientId },
      data: dto,
    });

    this.logger.log(`📝 Client ${clientId} updated`);

    return updatedClient;
  }

  async deleteClient(clientId: string): Promise<void> {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    // Atomic transaction: delete all related data then the user
    await this.prisma.$transaction(async (tx) => {
      // Delete all order files (no cascade from Order→User)
      await tx.orderFile.deleteMany({
        where: { order: { userId: clientId } },
      });

      // Delete all orders (no cascade from User)
      await tx.order.deleteMany({
        where: { userId: clientId },
      });

      // Delete insights (no relation defined to User in schema)
      await tx.insight.deleteMany({
        where: { userId: clientId },
      });

      // Delete profile (no cascade from User)
      await tx.userProfile.deleteMany({
        where: { userId: clientId },
      });

      // Delete user — auto-cascades: SpiritualPath, ChatSession, AkashicRecord, Subscription, Dream, Notification
      await tx.user.delete({
        where: { id: clientId },
      });
    });

    this.logger.log(`🗑️ Client ${clientId} and all related data deleted`);
  }

  /**
   * Create a new client manually (CRM functionality)
   */
  async createClient(dto: CreateClientDto): Promise<User> {
    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Un client avec cet email existe déjà');
    }

    // Generate business reference ID
    const refId = await this.idGenerator.generateClientRefId();

    const client = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        notes: dto.notes,
        tags: dto.tags || [],
        source: dto.source || 'manual',
        refId,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`👤 New client created: ${refId} - ${dto.firstName} ${dto.lastName}`);

    return client;
  }

  /**
   * Update client status (Ban/Unban/Suspend)
   */
  async updateClientStatus(clientId: string, dto: UpdateClientStatusDto): Promise<User> {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    const previousStatus = client.status;

    const updatedClient = await this.prisma.user.update({
      where: { id: clientId },
      data: {
        status: dto.status as UserStatus,
        notes: dto.reason
          ? `${client.notes ? client.notes + '\n\n' : ''}[${new Date().toISOString()}] Status changed from ${previousStatus} to ${dto.status}: ${dto.reason}`
          : client.notes,
      },
    });

    this.logger.log(
      `🔒 Client ${client.refId || clientId} status changed: ${previousStatus} → ${dto.status}`,
    );

    return updatedClient;
  }

  /**
   * Assign refId to existing clients without one (migration helper)
   */
  async assignMissingRefIds(): Promise<number> {
    const clientsWithoutRefId = await this.prisma.user.findMany({
      where: { refId: null },
      orderBy: { createdAt: 'asc' },
    });

    let count = 0;
    for (const client of clientsWithoutRefId) {
      const refId = await this.idGenerator.generateClientRefId();
      await this.prisma.user.update({
        where: { id: client.id },
        data: { refId },
      });
      count++;
    }

    this.logger.log(`📝 Assigned refId to ${count} existing clients`);
    return count;
  }

  // ========================
  // STATS
  // ========================

  async getStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      pendingOrders,
      processingOrders,
      awaitingValidation,
      completedOrders,
      revenueResult,
      todayOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where: { status: { in: ['PENDING', 'PAID'] } } }),
      this.prisma.order.count({ where: { status: 'PROCESSING' } }),
      this.prisma.order.count({ where: { status: 'AWAITING_VALIDATION' } }),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.order.count({ where: { createdAt: { gte: today } } }),
    ]);

    return {
      pendingOrders,
      processingOrders,
      awaitingValidation,
      completedOrders,
      totalRevenue: revenueResult._sum.amount || 0,
      todayOrders,
    };
  }

  // ========================
  // CONTENT VERSIONING
  // ========================

  /**
   * Get content version history for an order.
   */
  async getContentVersions(orderId: string): Promise<{
    versions: Array<{ content: string; timestamp: string; action: string; expertId: string }>;
    currentContent: string | null;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { generatedContent: true },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    const content = (order.generatedContent as Record<string, unknown>) || {};
    const versions =
      (content.contentVersions as Array<{
        content: string;
        timestamp: string;
        action: string;
        expertId: string;
      }>) || [];
    const currentContent = (content.lecture as string) || null;

    return { versions, currentContent };
  }

  /**
   * Restore a previous content version.
   */
  async restoreContentVersion(
    orderId: string,
    versionIndex: number,
    expert: ExpertEntity,
  ): Promise<{ success: boolean; restoredContent: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { generatedContent: true, orderNumber: true },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    const content = (order.generatedContent as Record<string, unknown>) || {};
    const versions =
      (content.contentVersions as Array<{
        content: string;
        timestamp: string;
        action: string;
        expertId: string;
      }>) || [];

    if (versionIndex < 0 || versionIndex >= versions.length) {
      throw new BadRequestException('Index de version invalide');
    }

    const versionToRestore = versions[versionIndex];
    const currentContent = content.lecture as string;

    // Save current content to history before restoring
    if (currentContent) {
      versions.push({
        content: currentContent,
        timestamp: new Date().toISOString(),
        action: 'before_restore',
        expertId: expert.id,
      });
    }

    // Keep only last 10 versions
    const trimmedVersions = versions.slice(-10);

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        generatedContent: {
          ...content,
          lecture: versionToRestore.content,
          contentVersions: trimmedVersions,
          lastRestoredAt: new Date().toISOString(),
          restoredBy: expert.id,
        },
      },
    });

    this.logger.log(`↩️ Restored version ${versionIndex} for order ${order.orderNumber}`);

    return { success: true, restoredContent: versionToRestore.content };
  }

  /**
   * Clear old content versions (keep only last N).
   */
  async clearOldVersions(
    orderId: string,
    keepCount: number = 3,
  ): Promise<{ success: boolean; deletedCount: number }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { generatedContent: true },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    const content = (order.generatedContent as Record<string, unknown>) || {};
    const versions =
      (content.contentVersions as Array<{
        content: string;
        timestamp: string;
        action: string;
        expertId: string;
      }>) || [];
    const originalCount = versions.length;

    // Keep only last N versions
    const trimmedVersions = versions.slice(-keepCount);

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        generatedContent: {
          ...content,
          contentVersions: trimmedVersions,
        },
      },
    });

    const deletedCount = originalCount - trimmedVersions.length;
    this.logger.log(`🗑️ Cleared ${deletedCount} old versions for order ${orderId}`);

    return { success: true, deletedCount };
  }

  /**
   * Full regeneration from Studio - clears content and re-runs AI generation.
   */
  async regenerateFromStudio(
    orderId: string,
    expert: ExpertEntity,
  ): Promise<{
    success: boolean;
    orderId: string;
    orderNumber: string;
    archetype: string;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { include: { profile: true } } },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }
    if (!['AWAITING_VALIDATION', 'FAILED'].includes(order.status)) {
      throw new BadRequestException(
        `Cette commande ne peut pas être régénérée (statut: ${order.status})`,
      );
    }

    this.logger.log(
      `🔄 Full regeneration requested for order ${order.orderNumber} by ${expert.name}`,
    );

    // Save current content to version history if exists
    const currentGenerated = (order.generatedContent as Record<string, unknown>) || {};
    const existingVersions =
      (currentGenerated.contentVersions as Array<{
        content: string;
        timestamp: string;
        action: string;
        expertId: string;
      }>) || [];
    const currentContent = currentGenerated.lecture as string;

    if (currentContent) {
      existingVersions.push({
        content: currentContent,
        timestamp: new Date().toISOString(),
        action: 'before_regenerate',
        expertId: expert.id,
      });
    }

    // Preserve a lockable status; content generation acquires PROCESSING
    // atomically and will return to AWAITING_VALIDATION on success.
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        generatedContent: {
          contentVersions: existingVersions.slice(-10), // Keep history
          regeneratedAt: new Date().toISOString(),
          regeneratedBy: expert.id,
        },
        revisionCount: { increment: 1 },
      },
    });

    // Trigger new generation
    try {
      const result = await this.generateReading(orderId, expert);

      this.logger.log(
        `✅ Regeneration completed for ${order.orderNumber} - Archetype: ${result.archetype}`,
      );

      return {
        success: true,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        archetype: result.archetype,
      };
    } catch (error) {
      this.logger.error(`❌ Regeneration failed for ${order.orderNumber}: ${error}`);

      // Restore previous content on failure
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'AWAITING_VALIDATION',
          generatedContent: currentGenerated as object,
          errorLog: `Regeneration failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      });

      throw new BadRequestException(
        `Échec de la régénération: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ========================
  // FILES
  // ========================

  async getPresignedUrl(fileUrl: string): Promise<string> {
    // If already a signed URL or not S3, return as-is
    if (!fileUrl || (!fileUrl.includes('s3.') && !fileUrl.includes('amazonaws.com'))) {
      return fileUrl;
    }

    // For now, return the URL directly
    // In production, you would generate a presigned URL using AWS SDK
    // This would be integrated with the S3Service
    return fileUrl;
  }
}
