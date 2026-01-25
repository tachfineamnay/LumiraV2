/**
 * @fileoverview DigitalSoulService - Orchestration service that ties Orders, AI, and Database together.
 * This is the main orchestrator for the reading generation pipeline.
 *
 * @module services/factory/DigitalSoulService
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { VertexOracle, OracleResponse, UserProfile, OrderContext } from './VertexOracle';
import { PdfFactory, ReadingPdfData } from './PdfFactory';
import { PathActionType } from '@prisma/client';

// S3 upload dependencies
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// =============================================================================
// TYPES
// =============================================================================

export interface GenerationResult {
    orderId: string;
    orderNumber: string;
    pdfUrl: string;
    spiritualPathId: string;
    archetype: string;
    stepsCreated: number;
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class DigitalSoulService {
    private readonly logger = new Logger(DigitalSoulService.name);
    private readonly s3Client: S3Client;
    private readonly s3Bucket: string;
    private readonly s3Region: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly vertexOracle: VertexOracle,
        private readonly pdfFactory: PdfFactory,
    ) {
        this.s3Region = this.configService.get<string>('AWS_REGION', 'eu-west-3');
        this.s3Bucket = this.configService.get<string>('AWS_S3_BUCKET_READINGS', 'lumira-readings');

        this.s3Client = new S3Client({
            region: this.s3Region,
            credentials: {
                accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
                secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
            },
        });
    }

    /**
     * Main orchestration method: processes an order and generates the complete reading.
     *
     * Flow:
     * 1. Retrieve Order + User Profile from Prisma
     * 2. Call VertexOracle.generateFullReading()
     * 3. Update SpiritualPath and create PathSteps (in transaction)
     * 4. Generate PDF via PdfFactory
     * 5. Upload to S3 and update Order status
     */
    async processOrderGeneration(orderId: string): Promise<GenerationResult> {
        this.logger.log(`Starting order generation: ${orderId}`);

        // ==========================================================================
        // STEP 1: Retrieve Order + User Profile
        // ==========================================================================
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: {
                    include: { profile: true },
                },
                files: true,
            },
        });

        if (!order) {
            throw new NotFoundException(`Order not found: ${orderId}`);
        }

        if (order.status !== 'PAID' && order.status !== 'PROCESSING') {
            throw new BadRequestException(`Order ${orderId} is not in a valid state for generation: ${order.status}`);
        }

        // Update order status to PROCESSING
        await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'PROCESSING' },
        });

        const user = order.user;
        const profile = user.profile;

        // Build user profile for AI
        const userProfile: UserProfile = {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            birthDate: profile?.birthDate || '',
            birthTime: profile?.birthTime || undefined,
            birthPlace: profile?.birthPlace || undefined,
            specificQuestion: profile?.specificQuestion || undefined,
            objective: profile?.objective || undefined,
            facePhotoUrl: profile?.facePhotoUrl || undefined,
            palmPhotoUrl: profile?.palmPhotoUrl || undefined,
            highs: profile?.highs || undefined,
            lows: profile?.lows || undefined,
            strongSide: profile?.strongSide || undefined,
            fears: profile?.fears || undefined,
            rituals: profile?.rituals || undefined,
        };

        // Build order context
        const orderContext: OrderContext = {
            orderId: order.id,
            orderNumber: order.orderNumber,
            level: order.level,
            productName: this.getLevelName(order.level),
        };

        this.logger.log(`Order data retrieved for ${user.firstName} ${user.lastName}`);

        // ==========================================================================
        // STEP 2: AI Generation
        // ==========================================================================
        let aiResponse: OracleResponse;
        try {
            aiResponse = await this.vertexOracle.generateFullReading(userProfile, orderContext);
            this.logger.log(`AI reading generated: archetype = ${aiResponse.synthesis.archetype}`);
        } catch (error) {
            await this.prisma.order.update({
                where: { id: orderId },
                data: { status: 'FAILED', errorLog: `AI generation failed: ${error}` },
            });
            throw error;
        }

        // Save generated content to order
        await this.prisma.order.update({
            where: { id: orderId },
            data: { generatedContent: aiResponse as object },
        });

        // ==========================================================================
        // STEP 3: Database Updates (Transaction)
        // ==========================================================================
        const { spiritualPath, stepsCreated } = await this.prisma.$transaction(async (tx) => {
            // Upsert SpiritualPath
            const path = await tx.spiritualPath.upsert({
                where: { userId: user.id },
                update: {
                    archetype: aiResponse.synthesis.archetype,
                    synthesis: aiResponse.pdf_content.introduction,
                    keyBlockage: aiResponse.synthesis.key_blockage || null,
                    updatedAt: new Date(),
                },
                create: {
                    userId: user.id,
                    archetype: aiResponse.synthesis.archetype,
                    synthesis: aiResponse.pdf_content.introduction,
                    keyBlockage: aiResponse.synthesis.key_blockage || null,
                },
            });

            // Delete existing steps for fresh generation
            await tx.pathStep.deleteMany({
                where: { spiritualPathId: path.id },
            });

            // Create PathStep entries from timeline
            const steps = await Promise.all(
                aiResponse.timeline.map(async (day, index) => {
                    return tx.pathStep.create({
                        data: {
                            spiritualPathId: path.id,
                            dayNumber: day.day || index + 1,
                            title: day.title,
                            description: day.action,
                            synthesis: day.mantra,
                            archetype: aiResponse.synthesis.archetype,
                            actionType: this.mapActionType(day.actionType),
                            isCompleted: false,
                            unlockedAt: index === 0 ? new Date() : null, // Unlock day 1 immediately
                            originReadingId: orderId,
                        },
                    });
                }),
            );

            return { spiritualPath: path, stepsCreated: steps.length };
        });

        this.logger.log(`SpiritualPath updated, ${stepsCreated} steps created`);

        // ==========================================================================
        // STEP 4: PDF Generation
        // ==========================================================================
        const pdfData: ReadingPdfData = {
            userName: `${user.firstName} ${user.lastName}`,
            archetype: aiResponse.synthesis.archetype,
            archetypeDescription: aiResponse.pdf_content.archetype_reveal,
            introduction: aiResponse.pdf_content.introduction,
            sections: aiResponse.pdf_content.sections.map((s) => ({
                domain: s.domain,
                title: s.title,
                content: s.content,
            })),
            karmicInsights: aiResponse.pdf_content.karmic_insights,
            lifeMission: aiResponse.pdf_content.life_mission,
            rituals: aiResponse.pdf_content.rituals,
            conclusion: aiResponse.pdf_content.conclusion,
            birthData: {
                date: userProfile.birthDate,
                time: userProfile.birthTime,
                place: userProfile.birthPlace,
            },
            generatedAt: new Date().toISOString(),
        };

        let pdfBuffer: Buffer;
        try {
            pdfBuffer = await this.pdfFactory.generatePdf('reading', pdfData);
            this.logger.log(`PDF generated: ${pdfBuffer.length} bytes`);
        } catch (error) {
            await this.prisma.order.update({
                where: { id: orderId },
                data: { status: 'FAILED', errorLog: `PDF generation failed: ${error}` },
            });
            throw error;
        }

        // ==========================================================================
        // STEP 5: Upload to S3 and Update Order
        // ==========================================================================
        const pdfKey = `readings/${order.orderNumber}/${Date.now()}-lecture.pdf`;
        let pdfUrl: string;

        try {
            await this.s3Client.send(
                new PutObjectCommand({
                    Bucket: this.s3Bucket,
                    Key: pdfKey,
                    Body: pdfBuffer,
                    ContentType: 'application/pdf',
                    Metadata: {
                        orderId: order.id,
                        orderNumber: order.orderNumber,
                        userId: user.id,
                    },
                }),
            );

            pdfUrl = `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${pdfKey}`;
            this.logger.log(`PDF uploaded to S3: ${pdfKey}`);
        } catch (error) {
            this.logger.error(`S3 upload failed: ${error}`);
            // Use local fallback URL
            pdfUrl = `/api/readings/${order.orderNumber}/download`;
        }

        // Update order to completed
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'COMPLETED',
                deliveredAt: new Date(),
                generatedContent: {
                    ...aiResponse,
                    pdfUrl,
                    pdfKey,
                } as object,
            },
        });

        this.logger.log(`Order ${order.orderNumber} completed successfully`);

        return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            pdfUrl,
            spiritualPathId: spiritualPath.id,
            archetype: aiResponse.synthesis.archetype,
            stepsCreated,
        };
    }

    // ===========================================================================
    // HELPER METHODS
    // ===========================================================================

    private getLevelName(level: number): string {
        const names: Record<number, string> = {
            1: 'Initié',
            2: 'Mystique',
            3: 'Profond',
            4: 'Intégrale',
        };
        return names[level] || 'Initié';
    }

    private mapActionType(type: string): PathActionType {
        const map: Record<string, PathActionType> = {
            MANTRA: 'MANTRA',
            RITUAL: 'RITUAL',
            JOURNALING: 'JOURNALING',
            MEDITATION: 'MEDITATION',
            REFLECTION: 'REFLECTION',
        };
        return map[type] || 'REFLECTION';
    }
}
