import {
    Injectable,
    NotFoundException,
    BadRequestException,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Expert, Order, User, UserProfile, OrderFile } from '@prisma/client';

type ExpertWithoutPassword = Omit<Expert, 'password'>;

import {
    LoginExpertDto,
    RegisterExpertDto,
    ValidateContentDto,
    ProcessOrderDto,
    UpdateClientDto,
    PaginationDto,
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

    async getPendingOrders(dto: PaginationDto): Promise<PaginatedResult<Order>> {
        const { page = 1, limit = 20, search } = dto;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {
            status: { in: ['PENDING', 'PAID'] },
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

    async processOrder(dto: ProcessOrderDto, expert: ExpertEntity): Promise<Order> {
        const order = await this.prisma.order.findUnique({
            where: { id: dto.orderId },
            include: { user: { include: { profile: true } }, files: true },
        });

        if (!order) {
            throw new NotFoundException('Commande non trouvée');
        }

        if (order.status !== 'PROCESSING') {
            throw new BadRequestException('Cette commande n\'est pas en cours de traitement');
        }

        // Update order with expert prompt
        const updatedOrder = await this.prisma.order.update({
            where: { id: dto.orderId },
            data: {
                expertPrompt: dto.expertPrompt,
                expertInstructions: dto.expertInstructions,
                expertReview: {
                    ...(order.expertReview as Record<string, unknown> || {}),
                    processedBy: expert.id,
                    processedAt: new Date().toISOString(),
                },
            },
        });

        // Prepare n8n payload
        const n8nPayload = {
            orderId: order.id,
            orderNumber: order.orderNumber,
            level: order.level,
            expertPrompt: dto.expertPrompt,
            expertInstructions: dto.expertInstructions,
            client: {
                email: order.userEmail,
                name: order.userName,
                ...(order.user?.profile || {}),
            },
            formData: order.formData,
            expert: {
                id: expert.id,
                name: expert.name,
            },
        };

        // Send to n8n with retry
        await this.sendToN8n(n8nPayload);

        this.logger.log(`🚀 Order ${order.orderNumber} sent to n8n for generation`);

        return updatedOrder;
    }

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
            const updatedOrder = await this.prisma.order.update({
                where: { id: dto.orderId },
                data: {
                    status: 'COMPLETED',
                    deliveredAt: new Date(),
                    expertValidation: {
                        action: 'approve',
                        validatedBy: expert.id,
                        validatedAt: new Date().toISOString(),
                        notes: dto.validationNotes,
                    },
                },
            });

            this.logger.log(`✅ Order ${order.orderNumber} approved by ${expert.name}`);
            return updatedOrder;
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

    async regenerateLecture(orderId: string, expert: ExpertEntity): Promise<Order> {
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

        // Reset status and resend
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'PROCESSING',
                generatedContent: null,
                revisionCount: { increment: 1 },
            },
        });

        // Resend to n8n
        const n8nPayload = {
            orderId: order.id,
            orderNumber: order.orderNumber,
            level: order.level,
            expertPrompt: order.expertPrompt,
            expertInstructions: order.expertInstructions,
            client: {
                email: order.userEmail,
                name: order.userName,
                ...(order.user?.profile || {}),
            },
            formData: order.formData,
            expert: {
                id: expert.id,
                name: expert.name,
            },
            isRegeneration: true,
        };

        await this.sendToN8n(n8nPayload);

        this.logger.log(`🔄 Order ${order.orderNumber} regeneration triggered`);

        return order;
    }

    // ========================
    // CLIENTS
    // ========================

    async getClients(dto: PaginationDto): Promise<PaginatedResult<User>> {
        const { page = 1, limit = 20, search } = dto;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};

        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
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
