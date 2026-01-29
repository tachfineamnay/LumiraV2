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
    ) { }

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

        if (!['PENDING', 'PAID'].includes(order.status)) {
            throw new BadRequestException('Cette commande ne peut pas être prise');
        }

        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'PROCESSING',
                expertReview: {
                    assignedBy: expertId,
                    assignedAt: new Date().toISOString(),
                },
            },
        });

        this.logger.log(`📋 Order ${order.orderNumber} assigned to expert ${expertId}`);

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

        // Accept both PAID and PROCESSING statuses for generation
        if (order.status !== 'PROCESSING' && order.status !== 'PAID') {
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
            // Dynamic import to avoid circular dependencies
            const { DigitalSoulService } = await import('../../services/factory/DigitalSoulService');
            const { VertexOracle } = await import('../../services/factory/VertexOracle');
            const { PdfFactory } = await import('../../services/factory/PdfFactory');

            // Create service instances
            const vertexOracle = new VertexOracle(this.configService, this.prisma);
            const pdfFactory = new PdfFactory(this.configService);
            await pdfFactory.onModuleInit();
            
            const digitalSoulService = new DigitalSoulService(
                this.configService,
                this.prisma,
                vertexOracle,
                pdfFactory,
            );

            // Generate AI content only (no PDF yet) - will be validated by expert
            const result = await digitalSoulService.generateContentOnly(dto.orderId);

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
                const { DigitalSoulService } = await import('../../services/factory/DigitalSoulService');
                const { VertexOracle } = await import('../../services/factory/VertexOracle');
                const { PdfFactory } = await import('../../services/factory/PdfFactory');

                const vertexOracle = new VertexOracle(this.configService, this.prisma);
                const pdfFactory = new PdfFactory(this.configService);
                await pdfFactory.onModuleInit();

                const digitalSoulService = new DigitalSoulService(
                    this.configService,
                    this.prisma,
                    vertexOracle,
                    pdfFactory,
                );

                // Generate PDF and finalize
                const result = await digitalSoulService.finalizeWithPdf(dto.orderId);

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
            // Dynamic import to avoid circular dependencies
            const { DigitalSoulService } = await import('../../services/factory/DigitalSoulService');
            const { VertexOracle } = await import('../../services/factory/VertexOracle');
            const { PdfFactory } = await import('../../services/factory/PdfFactory');

            // Create service instances
            const vertexOracle = new VertexOracle(this.configService, this.prisma);
            const pdfFactory = new PdfFactory(this.configService);
            await pdfFactory.onModuleInit();
            
            const digitalSoulService = new DigitalSoulService(
                this.configService,
                this.prisma,
                vertexOracle,
                pdfFactory,
            );

            // Regenerate using internal factory
            const result = await digitalSoulService.processOrderGeneration(orderId);

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

        // Import the DigitalSoulService dynamically to avoid circular dependencies
        // In production, this should be properly injected
        const { DigitalSoulService } = await import('../../services/factory/DigitalSoulService');
        const { VertexOracle } = await import('../../services/factory/VertexOracle');
        const { PdfFactory } = await import('../../services/factory/PdfFactory');

        // Create service instances (in production, use proper DI)
        const vertexOracle = new VertexOracle(this.configService, this.prisma);
        const pdfFactory = new PdfFactory(this.configService);
        await pdfFactory.onModuleInit();

        const digitalSoulService = new DigitalSoulService(
            this.configService,
            this.prisma,
            vertexOracle,
            pdfFactory,
        );

        try {
            const result = await digitalSoulService.processOrderGeneration(orderId);

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
            // Import VertexOracle for AI refinement
            const { VertexOracle } = await import('../../services/factory/VertexOracle');
            const vertexOracle = new VertexOracle(this.configService, this.prisma);

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

            const refinedContent = await vertexOracle.refineText(userPrompt, {
                systemPrompt,
                maxTokens: 4096,
                temperature: 0.7,
            });

            // Update order with refined content
            const currentGenerated = order.generatedContent as Record<string, unknown> || {};
            await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    generatedContent: {
                        ...currentGenerated,
                        lecture: refinedContent,
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
    ): Promise<{ response: string }> {
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
            // Import VertexOracle for AI chat
            const { VertexOracle } = await import('../../services/factory/VertexOracle');
            const vertexOracle = new VertexOracle(this.configService, this.prisma);

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
                orderLevel: order.level,
                orderNumber: order.orderNumber,
                hasGeneratedContent: !!currentContent,
                existingLecture: currentContent ? currentContent.substring(0, 2000) : '', // First 2000 chars for context
            };

            // Enhanced system prompt for Desk assistant
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

MESSAGE DE L'EXPERT:`;

            // Use the chatWithUser method but with our custom system prompt
            const response = await vertexOracle.refineText(
                `${systemPrompt}\n\n${dto.message}`,
                {
                    maxTokens: 1024,
                    temperature: 0.9,
                }
            );

            this.logger.log(`✅ AI Chat response generated for order ${order.orderNumber}`);

            return { response };
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
                const { DigitalSoulService } = await import('../../services/factory/DigitalSoulService');
                const { VertexOracle } = await import('../../services/factory/VertexOracle');
                const { PdfFactory } = await import('../../services/factory/PdfFactory');

                const vertexOracle = new VertexOracle(this.configService, this.prisma);
                const pdfFactory = new PdfFactory(this.configService);
                await pdfFactory.onModuleInit();

                const digitalSoulService = new DigitalSoulService(
                    this.configService,
                    this.prisma,
                    vertexOracle,
                    pdfFactory,
                );

                const result = await digitalSoulService.finalizeWithPdf(orderId);

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
            // 1. Save the final content to the order
            const currentGenerated = order.generatedContent as Record<string, unknown> || {};
            await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    generatedContent: {
                        ...currentGenerated,
                        lecture: finalContent,
                        sealedAt: new Date().toISOString(),
                        sealedBy: expert.id,
                        source: 'studio',
                    },
                    status: 'AWAITING_VALIDATION',
                },
            });

            // 2. Generate PDF using Gotenberg via DigitalSoulService
            const { DigitalSoulService } = await import('../../services/factory/DigitalSoulService');
            const { VertexOracle } = await import('../../services/factory/VertexOracle');
            const { PdfFactory } = await import('../../services/factory/PdfFactory');

            const vertexOracle = new VertexOracle(this.configService, this.prisma);
            const pdfFactory = new PdfFactory(this.configService);
            await pdfFactory.onModuleInit();

            const digitalSoulService = new DigitalSoulService(
                this.configService,
                this.prisma,
                vertexOracle,
                pdfFactory,
            );

            // Finalize with PDF generation
            const result = await digitalSoulService.finalizeWithPdf(orderId);

            // 3. Update order with validation info
            await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    status: 'COMPLETED',
                    deliveredAt: new Date(),
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
                await this.notificationsService.sendContentReady(order, order.user);
                this.logger.log(`📧 Email notification sent to ${order.user.email}`);
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

    async getClients(dto: PaginationDto): Promise<PaginatedResult<User>> {
        const { page = 1, limit = 20, search } = dto;
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

        const [clients, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: { profile: true, _count: { select: { orders: true } } },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            data: clients,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
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
                level: true,
                createdAt: true,
            },
        });

        const completedOrders = orders.filter(o => o.status === 'COMPLETED');
        const totalSpent = completedOrders.reduce((sum, o) => sum + o.amount, 0);

        // Find favorite level
        const levelCounts = completedOrders.reduce((acc: Record<number, number>, o) => {
            acc[o.level] = (acc[o.level] || 0) + 1;
            return acc;
        }, {});

        const levelNames: Record<number, string> = {
            1: 'INITIÉ',
            2: 'MYSTIQUE',
            3: 'PROFOND',
            4: 'INTÉGRALE',
        };

        let favoriteLevel: string | null = null;
        let maxCount = 0;
        for (const [level, count] of Object.entries(levelCounts)) {
            if (count > maxCount) {
                maxCount = count;
                favoriteLevel = levelNames[Number(level)] || null;
            }
        }

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

        // Delete profile
        await this.prisma.userProfile.deleteMany({
            where: { userId: clientId },
        });

        // Delete user
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
