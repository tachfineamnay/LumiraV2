import {
    Injectable,
    NotFoundException,
    BadRequestException,
    UnauthorizedException,
    ConflictException,
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
import { Expert, Order, User, UserProfile, OrderFile, UserStatus } from '@prisma/client';

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

    async login(dto: LoginExpertDto): Promise<{ accessToken: string; refreshToken: string; expert: Omit<Expert, 'password'> }> {
        const expert = await this.prisma.expert.findUnique({
            where: { email: dto.email },
        });

        if (!expert) {
            this.logger.warn(`🔐 Login failed: expert not found - ${dto.email}`);
            throw new UnauthorizedException('Email ou mot de passe incorrect');
        }

        if (!expert.isActive) {
            this.logger.warn(`🔐 Login failed: expert inactive - ${dto.email}`);
            throw new UnauthorizedException('Compte désactivé');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, expert.password);
        if (!isPasswordValid) {
            this.logger.warn(`🔐 Login failed: invalid password - ${dto.email}`);
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

        const activities = recentOrders.map(order => {
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
            status: { in: ['PAID', 'FAILED'] }, // Include FAILED for orders that need retry
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
                        include: { profile: true }
                    }, 
                    files: true 
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

    async getOrderById(orderId: string): Promise<Order & { user: User & { profile: UserProfile | null }; files: OrderFile[] }> {
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
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new NotFoundException('Commande non trouvée');
        }

        // Allow re-assignment if already assigned (ADMIN use-case)
        if (!['PENDING', 'PAID', 'PROCESSING'].includes(order.status)) {
            throw new BadRequestException('Cette commande ne peut pas être prise');
        }

        const expert = await this.prisma.expert.findUnique({
            where: { id: expertId },
            select: { name: true },
        });

        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'PROCESSING',
                expertReview: {
                    assignedBy: expertId,
                    assignedName: expert?.name || 'Expert',
                    assignedAt: new Date().toISOString(),
                },
            },
        });

        this.logger.log(`📋 Order ${order.orderNumber} assigned to expert ${expertId}`);

        // Notify all connected experts in real-time
        this.gateway.notifyOrderClaimed({
            orderId: updatedOrder.id,
            orderNumber: order.orderNumber,
            expertId,
            expertName: expert?.name || 'Expert',
        });

        return updatedOrder;
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

    async processOrder(dto: ProcessOrderDto, expert: ExpertEntity): Promise<Order & { generationResult?: { archetype: string; stepsCreated: number } }> {
        const order = await this.prisma.order.findUnique({
            where: { id: dto.orderId },
            include: { user: { include: { profile: true } }, files: true },
        });

        if (!order) {
            throw new NotFoundException('Commande non trouvée');
        }

        // Accept PAID, PROCESSING, AWAITING_VALIDATION (re-generation), and FAILED (retry)
        const validStatuses = ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'FAILED'];
        if (!validStatuses.includes(order.status)) {
            throw new BadRequestException('Cette commande n\'est pas prête pour la génération');
        }

        // Update order with expert prompt and set to PROCESSING
        const updatedOrder = await this.prisma.order.update({
            where: { id: dto.orderId },
            data: {
                status: 'PROCESSING',
                expertPrompt: dto.expertPrompt,
                expertInstructions: dto.expertInstructions,
                expertReview: {
                    ...(order.expertReview as Record<string, unknown> || {}),
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

            this.logger.log(`✅ Order ${order.orderNumber} content generated - Archetype: ${result.archetype}`);
            this.logger.log(`📋 Order now AWAITING_VALIDATION`);

            // Fetch the updated order with generated content
            const finalOrder = await this.prisma.order.findUnique({
                where: { id: dto.orderId },
                include: { user: { include: { profile: true } }, files: true },
            });

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

            throw new BadRequestException(`Échec de la génération: ${error instanceof Error ? error.message : String(error)}`);
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
                const signature = crypto
                    .createHmac('sha256', secret || 'default-secret')
                    .update(body)
                    .digest('hex');

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
                    throw new BadRequestException('Échec de l\'envoi vers n8n');
                }

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
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
            throw new BadRequestException('Cette commande n\'est pas en attente de validation');
        }

        if (dto.action === 'approve') {
            this.logger.log(`📋 Approving order ${order.orderNumber} - generating PDF...`);

            // Generate PDF and finalize order using DigitalSoulService
            try {
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

                this.logger.log(`✅ Order ${order.orderNumber} approved and PDF delivered`);
                return updatedOrder;
            } catch (error) {
                this.logger.error(`❌ Failed to finalize order ${order.orderNumber}: ${error}`);
                throw new BadRequestException(`Échec de la génération PDF: ${error instanceof Error ? error.message : String(error)}`);
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

    async regenerateLecture(orderId: string, expert: ExpertEntity): Promise<Order & { generationResult?: { pdfUrl: string; archetype: string; stepsCreated: number } }> {
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

        // Reset status and increment revision count
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'PROCESSING',
                generatedContent: null,
                revisionCount: { increment: 1 },
            },
        });

        // Use internal DigitalSoulService instead of n8n webhook
        this.logger.log(`🔄 Starting regeneration for order ${order.orderNumber}`);

        try {
            // Regenerate using internal factory
            const result = await this.digitalSoulService.processOrderGeneration(orderId);

            this.logger.log(`✅ Order ${order.orderNumber} regenerated successfully - Archetype: ${result.archetype}`);

            // Fetch the updated order
            const updatedOrder = await this.prisma.order.findUnique({
                where: { id: orderId },
                include: { user: { include: { profile: true } } },
            });

            return {
                ...(updatedOrder || order),
                generationResult: {
                    pdfUrl: result.pdfUrl,
                    archetype: result.archetype,
                    stepsCreated: result.stepsCreated,
                },
            };
        } catch (error) {
            this.logger.error(`❌ Regeneration failed for order ${order.orderNumber}: ${error}`);

            // Update order status to FAILED
            await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    status: 'FAILED',
                    errorLog: `Regeneration failed: ${error instanceof Error ? error.message : String(error)}`,
                },
            });

            throw new BadRequestException(`Échec de la régénération: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Triggers AI-powered reading generation using the new Internal Factory.
     * Uses DigitalSoulService to orchestrate: Vertex AI → Database → PDF → S3.
     * This replaces the n8n workflow for new orders.
     */
    async generateReading(orderId: string, expert: ExpertEntity): Promise<{
        success: boolean;
        orderId: string;
        orderNumber: string;
        pdfUrl: string;
        archetype: string;
        stepsCreated: number;
    }> {
        // Auto-assign the order to this expert if not already assigned
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (order && ['PENDING', 'PAID'].includes(order.status)) {
            await this.assignOrder(orderId, expert.id);
        } else if (order && order.status === 'PROCESSING') {
            // If processing but not assigned, stamp the expert
            const review = (order.expertReview as Record<string, unknown>) || {};
            if (!review.assignedBy) {
                await this.assignOrder(orderId, expert.id);
            }
        }
        return this.generateReadingWithPrompt(orderId, undefined, expert);
    }

    /**
     * Triggers AI-powered reading generation with optional expert prompt.
     * Called by /generate-full endpoint from admin panel.
     */
    async generateReadingWithPrompt(orderId: string, expertPrompt: string | undefined, expert: ExpertEntity): Promise<{
        success: boolean;
        orderId: string;
        orderNumber: string;
        pdfUrl: string;
        archetype: string;
        stepsCreated: number;
    }> {
        this.logger.log(`🚀 Starting AI reading generation for order: ${orderId}${expertPrompt ? ' (with expert prompt)' : ''}`);

        try {
            const result = await this.digitalSoulService.processOrderGeneration(orderId);

            this.logger.log(`✅ AI reading generation completed: ${result.orderNumber} - ${result.archetype}`);

            return {
                success: true,
                orderId: result.orderId,
                orderNumber: result.orderNumber,
                pdfUrl: result.pdfUrl,
                archetype: result.archetype,
                stepsCreated: result.stepsCreated,
            };
        } catch (error) {
            this.logger.error(`❌ AI reading generation failed: ${error}`);
            throw error;
        }
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

        this.logger.log(`🎨 Refining content for order ${order.orderNumber} with instruction: "${dto.instruction}"`);

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

## Texte modifié:`

            const refinedContent = await this.vertexOracle.refineText(userPrompt, {
                systemPrompt,
                maxTokens: 4096,
                temperature: 0.7,
            });

            // Update order with refined content AND save version history
            const currentGenerated = order.generatedContent as Record<string, unknown> || {};
            const existingVersions = (currentGenerated.contentVersions as Array<{ content: string; timestamp: string; action: string; expertId: string }>) || [];
            
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
            throw new BadRequestException(`Échec du raffinement: ${error instanceof Error ? error.message : String(error)}`);
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
            const currentContent = (order.generatedContent as Record<string, unknown>)?.lecture as string || '';

            // Build rich context for the AI
            // Profile fields from UserProfile schema
            const chatContext = {
                userId: order.userId,
                firstName: dto.context?.firstName || (profile as { firstName?: string })?.firstName || 'Inconnu',
                birthDate: dto.context?.birthDate || profile?.birthDate || '',
                question: dto.context?.question || profile?.specificQuestion || '',
                objective: dto.context?.objective || profile?.objective || '',
                emotionalState: dto.context?.emotionalState || (profile as { emotionalState?: string })?.emotionalState || '',
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
            const response = await this.vertexOracle.refineText(
                `${systemPrompt}\n\n${dto.message}`,
                {
                    maxTokens: 1024,
                    temperature: 0.9,
                }
            );

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
            throw new BadRequestException(`Échec du chat IA: ${error instanceof Error ? error.message : String(error)}`);
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

        this.logger.log(`📋 Validating order ${order.orderNumber} from Studio`);

        // Save the final content
        const currentGenerated = order.generatedContent as Record<string, unknown> || {};
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                generatedContent: {
                    ...currentGenerated,
                    lecture: finalContent,
                    sealedAt: new Date().toISOString(),
                    sealedBy: expert.id,
                },
                status: 'AWAITING_VALIDATION',
            },
        });

        if (approval === 'APPROVED') {
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

                this.logger.log(`✅ Order ${order.orderNumber} sealed and PDF delivered from Studio`);
                return updatedOrder;
            } catch (error) {
                this.logger.error(`❌ Failed to finalize order ${order.orderNumber}: ${error}`);
                throw new BadRequestException(`Échec de la génération PDF: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return this.prisma.order.findUnique({ where: { id: orderId } }) as Promise<Order>;
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

        this.logger.log(`🔏 Finalizing order ${order.orderNumber} from Studio...`);

        try {
            const currentGenerated = order.generatedContent as Record<string, unknown> || {};
            const hasPdfContent = currentGenerated.pdf_content && 
                typeof currentGenerated.pdf_content === 'object';
            
            // Build pdf_content structure if missing (manual content scenario)
            let pdfContentData = currentGenerated.pdf_content as Record<string, unknown> | undefined;
            let synthesisData = currentGenerated.synthesis as Record<string, unknown> | undefined;
            
            if (!hasPdfContent) {
                this.logger.log(`📝 No AI content found, building pdf_content from manual text...`);
                
                // Parse sections from the final content (split by headers or double newlines)
                const contentSections = this.parseManualContentToSections(finalContent);
                
                // Build minimal pdf_content structure
                pdfContentData = {
                    introduction: contentSections.introduction || 'Bienvenue dans votre lecture spirituelle personnalisée.',
                    archetype_reveal: 'Votre guidance spirituelle unique',
                    sections: contentSections.sections.length > 0 
                        ? contentSections.sections 
                        : [{
                            domain: 'Guidance Spirituelle',
                            title: 'Votre Lecture Personnalisée',
                            content: finalContent,
                        }],
                    conclusion: contentSections.conclusion || 'Que cette lecture vous accompagne sur votre chemin.',
                    karmic_insights: [],
                    life_mission: '',
                    rituals: [],
                };
                
                synthesisData = {
                    archetype: 'Guidance Personnalisée',
                    keywords: [],
                    emotional_state: 'En chemin',
                    key_blockage: '',
                };
            }

            // 1. Save the final content with pdf_content structure
            const updatedContent = {
                ...currentGenerated,
                pdf_content: pdfContentData,
                synthesis: synthesisData || currentGenerated.synthesis,
                lecture: finalContent,
                sealedAt: new Date().toISOString(),
                sealedBy: expert.id,
                source: 'studio',
            };
            
            await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    generatedContent: updatedContent as object,
                    status: 'AWAITING_VALIDATION',
                },
            });

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

            // 4. Send email notification to the client
            try {
                const expertName = expert.name || 'Un expert Lumira';
                await this.notificationsService.sendExpertValidation(order, order.user, expertName);
                this.logger.log(`📧 Expert validation email sent to ${order.user.email} (validated by ${expertName})`);
            } catch (emailError) {
                // Log but don't fail the finalization if email fails
                this.logger.warn(`⚠️ Failed to send email notification: ${emailError}`);
            }

            this.logger.log(`✅ Order ${order.orderNumber} finalized - PDF: ${result.pdfUrl}`);

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

            throw new BadRequestException(`Échec de la finalisation: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Parse manual text content into sections for PDF generation.
     * Attempts to extract introduction, body sections, and conclusion.
     */
    private parseManualContentToSections(content: string): {
        introduction: string;
        sections: { domain: string; title: string; content: string }[];
        conclusion: string;
    } {
        // Split content by common section markers
        const lines = content.split('\n').filter(line => line.trim());
        
        // Try to detect headers (lines starting with # or all caps or short lines followed by content)
        const sections: { domain: string; title: string; content: string }[] = [];
        let currentSection: { title: string; content: string[] } | null = null;
        let introduction = '';
        let conclusion = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const isHeader = line.startsWith('#') || 
                             (line.length < 60 && line === line.toUpperCase() && line.length > 3) ||
                             line.match(/^[A-ZÀ-Ü][^.!?]*:?\s*$/);
            
            if (isHeader) {
                // Save previous section
                if (currentSection && currentSection.content.length > 0) {
                    sections.push({
                        domain: 'Guidance',
                        title: currentSection.title.replace(/^#+\s*/, ''),
                        content: currentSection.content.join('\n\n'),
                    });
                }
                currentSection = { title: line, content: [] };
            } else if (currentSection) {
                currentSection.content.push(line);
            } else {
                // Before first header = introduction
                introduction += (introduction ? '\n\n' : '') + line;
            }
        }
        
        // Save last section
        if (currentSection && currentSection.content.length > 0) {
            sections.push({
                domain: 'Guidance',
                title: currentSection.title.replace(/^#+\s*/, ''),
                content: currentSection.content.join('\n\n'),
            });
        }
        
        // If we have sections, use last one as conclusion candidate
        if (sections.length > 1) {
            const lastSection = sections[sections.length - 1];
            if (lastSection.title.toLowerCase().includes('conclusion') ||
                lastSection.title.toLowerCase().includes('fin') ||
                lastSection.content.length < 200) {
                conclusion = lastSection.content;
                sections.pop();
            }
        }
        
        // If no sections found, treat whole content as one section
        if (sections.length === 0 && !introduction) {
            introduction = content.substring(0, Math.min(500, content.length));
            if (content.length > 500) {
                sections.push({
                    domain: 'Guidance Spirituelle',
                    title: 'Votre Message',
                    content: content.substring(500),
                });
            }
        }
        
        return { introduction, sections, conclusion };
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
                    orders: { select: { amount: true, status: true, formData: true }, orderBy: { createdAt: 'desc' } },
                    _count: { select: { orders: true } },
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        // Enrich with computed fields
        const enriched = clients.map((client) => {
            const completedOrders = client.orders.filter((o) => o.status === 'COMPLETED' || o.status === 'PAID');
            const totalSpent = completedOrders.reduce((sum, o) => sum + o.amount, 0);
            const lastOrder = client.orders[0];
            const lastLevel = lastOrder?.formData
                ? (lastOrder.formData as Record<string, unknown>)?.level as string || null
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
        const completedOrders = client.orders.filter((o: { status: string }) => o.status === 'COMPLETED');
        const totalSpent = completedOrders.reduce((sum: number, o: { amount: number }) => sum + o.amount, 0);
        const lastOrder = client.orders[0] || null;
        const isVip = totalSpent >= 29900;

        // ── Engagement metrics ──
        const stepsTotal = client.spiritualPath?.steps?.length ?? 0;
        const stepsCompleted = client.spiritualPath?.steps?.filter((s: { isCompleted: boolean }) => s.isCompleted).length ?? 0;
        const insightsTotal = insights.length;
        const insightsViewed = insights.filter((i: { viewedAt: Date | null }) => i.viewedAt !== null).length;

        // Transform chatSessions to include messagesCount
        const chatSessionsWithCount = client.chatSessions.map((session: { id: string; title: string | null; messages: unknown; lastMessageAt: Date | null; createdAt: Date }) => ({
            id: session.id,
            title: session.title,
            messagesCount: Array.isArray(session.messages) ? session.messages.length : 0,
            lastMessageAt: session.lastMessageAt,
            createdAt: session.createdAt,
        }));

        const chatMessagesTotal = chatSessionsWithCount.reduce((sum: number, s: { messagesCount: number }) => sum + s.messagesCount, 0);
        const dreamsCount = client.dreams?.length ?? 0;

        // Engagement score (0-100): 30% steps + 25% insights viewed + 25% chat + 20% dreams
        const stepsScore = stepsTotal > 0 ? (stepsCompleted / stepsTotal) * 100 : 0;
        const insightsScore = insightsTotal > 0 ? (insightsViewed / insightsTotal) * 100 : 0;
        const chatScore = Math.min(chatMessagesTotal / 20, 1) * 100; // 20 messages = 100%
        const dreamsScore = Math.min(dreamsCount / 5, 1) * 100; // 5 dreams = 100%
        const engagementScore = Math.round(stepsScore * 0.3 + insightsScore * 0.25 + chatScore * 0.25 + dreamsScore * 0.2);

        // ── Recency ──
        const activityDates: { date: Date; type: string }[] = [];
        if (lastOrder) activityDates.push({ date: new Date(lastOrder.createdAt), type: 'order' });
        const lastChat = chatSessionsWithCount[0];
        if (lastChat?.lastMessageAt) activityDates.push({ date: new Date(lastChat.lastMessageAt), type: 'chat' });
        if (client.dreams?.length > 0) activityDates.push({ date: new Date(client.dreams[0].createdAt), type: 'dream' });
        const completedSteps = client.spiritualPath?.steps?.filter((s: { isCompleted: boolean }) => s.isCompleted) ?? [];
        if (completedSteps.length > 0) activityDates.push({ date: new Date(completedSteps[completedSteps.length - 1].updatedAt ?? completedSteps[completedSteps.length - 1].createdAt), type: 'step' });

        activityDates.sort((a, b) => b.date.getTime() - a.date.getTime());
        const lastActivityDate = activityDates[0]?.date ?? null;
        const daysSinceLastActivity = lastActivityDate
            ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;
        const lastActivityType = activityDates[0]?.type ?? 'none';

        // ── Content coverage ──
        const audioCoverage = insightsTotal > 0
            ? insights.filter((i: { audioUrl: string | null }) => i.audioUrl !== null).length / insightsTotal
            : 0;

        // Profile completeness (key profile fields)
        const profileKeyFields = ['birthDate', 'birthTime', 'birthPlace', 'specificQuestion', 'objective', 'facePhotoUrl', 'palmPhotoUrl', 'highs', 'lows', 'fears', 'rituals', 'strongSide', 'weakSide'] as const;
        const profileFilledCount = client.profile
            ? profileKeyFields.filter(f => client.profile![f] !== null && client.profile![f] !== undefined && client.profile![f] !== '').length
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
            subscriptionDaysLeft = Math.max(0, Math.floor((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        }

        // ── Upsell history ──
        const upsellHistory = client.orders
            .filter((o: { addons?: unknown; upsellOfferedAt?: Date | null }) => o.addons || o.upsellOfferedAt)
            .flatMap((o: { id: string; addons?: unknown; upsellOfferedAt?: Date | null; upsellAcceptedAt?: Date | null }) => {
                const items: { orderId: string; type: string; offeredAt: Date | null; acceptedAt: Date | null }[] = [];
                if (Array.isArray(o.addons)) {
                    for (const addon of o.addons as Array<{ type: string; paidAt?: string }>) {
                        items.push({ orderId: o.id, type: addon.type, offeredAt: o.upsellOfferedAt ?? null, acceptedAt: o.upsellAcceptedAt ?? null });
                    }
                } else if (o.upsellOfferedAt) {
                    items.push({ orderId: o.id, type: 'unknown', offeredAt: o.upsellOfferedAt, acceptedAt: o.upsellAcceptedAt ?? null });
                }
                return items;
            });

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

        const completedOrders = orders.filter(o => o.status === 'COMPLETED');
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

        // Delete all order files
        await this.prisma.orderFile.deleteMany({
            where: { order: { userId: clientId } },
        });

        // Delete all orders
        await this.prisma.order.deleteMany({
            where: { userId: clientId },
        });

        // Delete insights (no onDelete: Cascade in schema)
        await this.prisma.insight.deleteMany({
            where: { userId: clientId },
        });

        // Delete profile
        await this.prisma.userProfile.deleteMany({
            where: { userId: clientId },
        });

        // Delete user (cascades: SpiritualPath, ChatSessions, AkashicRecord, Dreams, Notifications, Subscription)
        await this.prisma.user.delete({
            where: { id: clientId },
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

        this.logger.log(`🔒 Client ${client.refId || clientId} status changed: ${previousStatus} → ${dto.status}`);

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

        const content = order.generatedContent as Record<string, unknown> || {};
        const versions = (content.contentVersions as Array<{ content: string; timestamp: string; action: string; expertId: string }>) || [];
        const currentContent = content.lecture as string || null;

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

        const content = order.generatedContent as Record<string, unknown> || {};
        const versions = (content.contentVersions as Array<{ content: string; timestamp: string; action: string; expertId: string }>) || [];

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

        const content = order.generatedContent as Record<string, unknown> || {};
        const versions = (content.contentVersions as Array<{ content: string; timestamp: string; action: string; expertId: string }>) || [];
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

        this.logger.log(`🔄 Full regeneration requested for order ${order.orderNumber} by ${expert.name}`);

        // Save current content to version history if exists
        const currentGenerated = order.generatedContent as Record<string, unknown> || {};
        const existingVersions = (currentGenerated.contentVersions as Array<{ content: string; timestamp: string; action: string; expertId: string }>) || [];
        const currentContent = currentGenerated.lecture as string;

        if (currentContent) {
            existingVersions.push({
                content: currentContent,
                timestamp: new Date().toISOString(),
                action: 'before_regenerate',
                expertId: expert.id,
            });
        }

        // Reset order status and clear generated content (keep versions)
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'PROCESSING',
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

            this.logger.log(`✅ Regeneration completed for ${order.orderNumber} - Archetype: ${result.archetype}`);

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

            throw new BadRequestException(`Échec de la régénération: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ========================
    // FILES
    // ========================

    async getPresignedUrl(fileUrl: string): Promise<string> {
        // If already a signed URL or not S3, return as-is
        if (!fileUrl || !fileUrl.includes('s3.') && !fileUrl.includes('amazonaws.com')) {
            return fileUrl;
        }

        // For now, return the URL directly
        // In production, you would generate a presigned URL using AWS SDK
        // This would be integrated with the S3Service
        return fileUrl;
    }
}
