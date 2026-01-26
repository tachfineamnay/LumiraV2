/**
 * @fileoverview DigitalSoulService - Orchestration service that ties Orders, AI, and Database together.
 * This is the main orchestrator for the reading generation pipeline.
 * 
 * HARDENED VERSION with:
 * - Verbose logging at every step
 * - Data validation before PDF generation
 * - Proper error handling with errorLog saving
 * - Timeouts and retries handled by child services
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
     * 3. VALIDATE AI response content
     * 4. Update SpiritualPath and create PathSteps (in transaction)
     * 5. Generate PDF via PdfFactory
     * 6. Upload to S3 and update Order status
     */
    async processOrderGeneration(orderId: string): Promise<GenerationResult> {
        const startTime = Date.now();
        
        this.logger.log(`\n${'='.repeat(60)}`);
        this.logger.log(`🚀 STARTING GENERATION FOR ORDER: ${orderId}`);
        this.logger.log(`${'='.repeat(60)}`);
        this.logger.log(`⏱️ Timestamp: ${new Date().toISOString()}`);

        try {
            // ==========================================================================
            // STEP 1: Retrieve Order + User Profile
            // ==========================================================================
            this.logger.log(`\n📋 STEP 1: Loading order and user profile...`);
            
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

            this.logger.log(`   ✅ Order found: ${order.orderNumber}`);
            this.logger.log(`   📦 Status: ${order.status}`);
            this.logger.log(`   💰 Level: ${order.level}`);

            if (order.status !== 'PAID' && order.status !== 'PROCESSING') {
                throw new BadRequestException(`Order ${orderId} is not in a valid state for generation: ${order.status}`);
            }

            // Update order status to PROCESSING
            await this.prisma.order.update({
                where: { id: orderId },
                data: { status: 'PROCESSING', errorLog: null },
            });
            this.logger.log(`   📝 Status updated to PROCESSING`);

            const user = order.user;
            const profile = user.profile;

            this.logger.log(`\n👤 STEP 1b: User profile loaded`);
            this.logger.log(`   👤 Name: ${user.firstName} ${user.lastName}`);
            this.logger.log(`   📧 Email: ${user.email}`);
            this.logger.log(`   🎂 Birth date: ${profile?.birthDate || 'NOT PROVIDED'}`);
            this.logger.log(`   📍 Birth place: ${profile?.birthPlace || 'NOT PROVIDED'}`);
            this.logger.log(`   🖼️ Face photo: ${profile?.facePhotoUrl ? 'YES' : 'NO'}`);
            this.logger.log(`   ✋ Palm photo: ${profile?.palmPhotoUrl ? 'YES' : 'NO'}`);
            this.logger.log(`   📁 Files attached: ${order.files?.length || 0}`);

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

            // ==========================================================================
            // STEP 2: AI Generation
            // ==========================================================================
            this.logger.log(`\n🔮 STEP 2: Calling Vertex AI (Gemini 1.5 Pro)...`);
            this.logger.log(`   🎯 Product level: ${orderContext.productName}`);
            
            let aiResponse: OracleResponse;
            const aiStartTime = Date.now();
            
            try {
                aiResponse = await this.vertexOracle.generateFullReading(userProfile, orderContext);
                const aiElapsed = Date.now() - aiStartTime;
                
                this.logger.log(`\n✅ STEP 2 COMPLETE: Vertex AI Response received`);
                this.logger.log(`   ⏱️ AI generation took: ${aiElapsed}ms`);
                this.logger.log(`   🎭 Archetype: ${aiResponse.synthesis?.archetype || 'UNKNOWN'}`);
                this.logger.log(`   📝 Sections: ${aiResponse.pdf_content?.sections?.length || 0}`);
                this.logger.log(`   📅 Timeline days: ${aiResponse.timeline?.length || 0}`);
                this.logger.log(`   🔑 Keywords: ${aiResponse.synthesis?.keywords?.join(', ') || 'NONE'}`);
            } catch (error) {
                const errorMsg = `AI generation failed: ${error instanceof Error ? error.message : String(error)}`;
                this.logger.error(`\n❌ STEP 2 FAILED: ${errorMsg}`);
                await this.saveErrorAndFail(orderId, errorMsg);
                throw new BadRequestException(errorMsg);
            }

            // ==========================================================================
            // STEP 3: VALIDATE AI Response
            // ==========================================================================
            this.logger.log(`\n🔍 STEP 3: Validating AI response...`);
            
            const validationErrors: string[] = [];
            
            if (!aiResponse.pdf_content) {
                validationErrors.push('Missing pdf_content');
            } else {
                if (!aiResponse.pdf_content.introduction || aiResponse.pdf_content.introduction.length < 50) {
                    validationErrors.push('Introduction is empty or too short');
                }
                if (!aiResponse.pdf_content.sections || aiResponse.pdf_content.sections.length === 0) {
                    validationErrors.push('No sections in pdf_content');
                }
                if (!aiResponse.pdf_content.conclusion || aiResponse.pdf_content.conclusion.length < 20) {
                    validationErrors.push('Conclusion is empty or too short');
                }
            }
            
            if (!aiResponse.synthesis) {
                validationErrors.push('Missing synthesis');
            } else {
                if (!aiResponse.synthesis.archetype) {
                    validationErrors.push('Missing archetype in synthesis');
                }
            }
            
            if (!aiResponse.timeline || aiResponse.timeline.length === 0) {
                validationErrors.push('Missing or empty timeline');
            }

            if (validationErrors.length > 0) {
                const errorMsg = `AI returned invalid content: ${validationErrors.join('; ')}`;
                this.logger.error(`\n❌ STEP 3 FAILED: ${errorMsg}`);
                await this.saveErrorAndFail(orderId, errorMsg);
                throw new BadRequestException(errorMsg);
            }

            this.logger.log(`   ✅ Validation passed - all required fields present`);

            // Save generated content to order
            await this.prisma.order.update({
                where: { id: orderId },
                data: { generatedContent: aiResponse as object },
            });
            this.logger.log(`   💾 AI content saved to order.generatedContent`);

            // ==========================================================================
            // STEP 4: Database Updates (Transaction)
            // ==========================================================================
            this.logger.log(`\n💾 STEP 4: Updating SpiritualPath and creating PathSteps...`);
            
            let spiritualPath: { id: string };
            let stepsCreated: number;

            try {
                const result = await this.prisma.$transaction(async (tx) => {
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

                    this.logger.log(`   📚 SpiritualPath upserted: ${path.id}`);

                    // Delete existing steps for fresh generation
                    const deletedCount = await tx.pathStep.deleteMany({
                        where: { spiritualPathId: path.id },
                    });
                    this.logger.log(`   🗑️ Deleted ${deletedCount.count} existing steps`);

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
                                    unlockedAt: index === 0 ? new Date() : null,
                                    originReadingId: orderId,
                                },
                            });
                        }),
                    );

                    return { spiritualPath: path, stepsCreated: steps.length };
                });

                spiritualPath = result.spiritualPath;
                stepsCreated = result.stepsCreated;
                
                this.logger.log(`   ✅ STEP 4 COMPLETE: ${stepsCreated} PathSteps created`);
            } catch (error) {
                const errorMsg = `Database transaction failed: ${error instanceof Error ? error.message : String(error)}`;
                this.logger.error(`\n❌ STEP 4 FAILED: ${errorMsg}`);
                await this.saveErrorAndFail(orderId, errorMsg);
                throw new BadRequestException(errorMsg);
            }

            // ==========================================================================
            // STEP 5: PDF Generation
            // ==========================================================================
            this.logger.log(`\n📄 STEP 5: Generating PDF with Gotenberg...`);

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
                karmicInsights: aiResponse.pdf_content.karmic_insights || [],
                lifeMission: aiResponse.pdf_content.life_mission || '',
                rituals: aiResponse.pdf_content.rituals || [],
                conclusion: aiResponse.pdf_content.conclusion,
                birthData: {
                    date: userProfile.birthDate,
                    time: userProfile.birthTime,
                    place: userProfile.birthPlace,
                },
                generatedAt: new Date().toISOString(),
            };

            this.logger.log(`   📝 PDF data prepared for: ${pdfData.userName}`);
            this.logger.log(`   📊 Sections to render: ${pdfData.sections.length}`);

            let pdfBuffer: Buffer;
            const pdfStartTime = Date.now();
            
            try {
                pdfBuffer = await this.pdfFactory.generatePdf('reading', pdfData);
                const pdfElapsed = Date.now() - pdfStartTime;
                
                this.logger.log(`\n✅ STEP 5 COMPLETE: PDF Buffer created`);
                this.logger.log(`   📦 Size: ${pdfBuffer.length} bytes (${Math.round(pdfBuffer.length / 1024)}KB)`);
                this.logger.log(`   ⏱️ PDF generation took: ${pdfElapsed}ms`);
            } catch (error) {
                const errorMsg = `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`;
                this.logger.error(`\n❌ STEP 5 FAILED: ${errorMsg}`);
                await this.saveErrorAndFail(orderId, errorMsg);
                throw new BadRequestException(errorMsg);
            }

            // ==========================================================================
            // STEP 6: Upload to S3 and Update Order
            // ==========================================================================
            this.logger.log(`\n☁️ STEP 6: Uploading PDF to S3...`);
            this.logger.log(`   🪣 Bucket: ${this.s3Bucket}`);
            this.logger.log(`   🌍 Region: ${this.s3Region}`);

            const pdfKey = `readings/${order.orderNumber}/${Date.now()}-lecture.pdf`;
            let pdfUrl: string;

            try {
                const s3StartTime = Date.now();
                
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

                const s3Elapsed = Date.now() - s3StartTime;
                pdfUrl = `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${pdfKey}`;
                
                this.logger.log(`\n✅ STEP 6 COMPLETE: S3 Upload successful`);
                this.logger.log(`   🔑 Key: ${pdfKey}`);
                this.logger.log(`   🔗 URL: ${pdfUrl}`);
                this.logger.log(`   ⏱️ S3 upload took: ${s3Elapsed}ms`);
            } catch (error) {
                this.logger.warn(`\n⚠️ STEP 6 WARNING: S3 upload failed, using fallback`);
                this.logger.warn(`   Error: ${error instanceof Error ? error.message : String(error)}`);
                // Use local fallback URL
                pdfUrl = `/api/readings/${order.orderNumber}/download`;
                this.logger.log(`   🔗 Fallback URL: ${pdfUrl}`);
            }

            // ==========================================================================
            // STEP 7: Final Order Update
            // ==========================================================================
            this.logger.log(`\n💾 STEP 7: Finalizing order...`);

            await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    status: 'COMPLETED',
                    deliveredAt: new Date(),
                    errorLog: null, // Clear any previous errors
                    generatedContent: {
                        ...aiResponse,
                        pdfUrl,
                        pdfKey,
                    } as object,
                },
            });

            const totalElapsed = Date.now() - startTime;

            this.logger.log(`\n${'='.repeat(60)}`);
            this.logger.log(`🎉 GENERATION COMPLETE FOR ORDER: ${order.orderNumber}`);
            this.logger.log(`${'='.repeat(60)}`);
            this.logger.log(`   👤 User: ${user.firstName} ${user.lastName}`);
            this.logger.log(`   🎭 Archetype: ${aiResponse.synthesis.archetype}`);
            this.logger.log(`   📅 Steps: ${stepsCreated}`);
            this.logger.log(`   📄 PDF: ${Math.round(pdfBuffer.length / 1024)}KB`);
            this.logger.log(`   ⏱️ TOTAL TIME: ${totalElapsed}ms (${Math.round(totalElapsed / 1000)}s)`);
            this.logger.log(`${'='.repeat(60)}\n`);

            return {
                orderId: order.id,
                orderNumber: order.orderNumber,
                pdfUrl,
                spiritualPathId: spiritualPath.id,
                archetype: aiResponse.synthesis.archetype,
                stepsCreated,
            };
        } catch (error) {
            // Top-level catch for any uncaught errors
            const totalElapsed = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : String(error);
            
            this.logger.error(`\n${'='.repeat(60)}`);
            this.logger.error(`💥 GENERATION FAILED FOR ORDER: ${orderId}`);
            this.logger.error(`${'='.repeat(60)}`);
            this.logger.error(`   ❌ Error: ${errorMsg}`);
            this.logger.error(`   ⏱️ Failed after: ${totalElapsed}ms`);
            this.logger.error(`${'='.repeat(60)}\n`);

            // Make sure error is saved (might already be saved by step handlers)
            await this.saveErrorAndFail(orderId, errorMsg).catch(() => {});

            throw error;
        }
    }

    // ===========================================================================
    // HELPER METHODS
    // ===========================================================================

    /**
     * Saves error to order and sets status to FAILED
     */
    private async saveErrorAndFail(orderId: string, errorMessage: string): Promise<void> {
        try {
            await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    status: 'FAILED',
                    errorLog: `[${new Date().toISOString()}] ${errorMessage}`,
                },
            });
            this.logger.log(`   💾 Error saved to order.errorLog`);
        } catch (dbError) {
            this.logger.error(`   ❌ Could not save error to database: ${dbError}`);
        }
    }

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
