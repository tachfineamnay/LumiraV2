/**
 * @fileoverview ContextDispatcher - The Logic Glue for Oracle Lumira.
 * 
 * This service orchestrates context-aware interactions by:
 * - Fetching user profile, Akashic Records, and order history
 * - Building rich context prompts for AI agents
 * - Dispatching requests to the appropriate VertexOracle agent
 * - Updating Akashic Records after significant interactions
 * 
 * @module services/factory/ContextDispatcher
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { 
    VertexOracle, 
    ChatContext, 
    ChatMessage, 
    AkashicDomains,
    ReadingSynthesis,
    OracleResponse 
} from './VertexOracle';
import { PdfFactory, ReadingPdfData } from './PdfFactory';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface DispatchResult {
    reply: string;
    sessionId: string;
    contextUsed: {
        hasAkashic: boolean;
        hasRecentOrder: boolean;
        archetype?: string;
    };
}

export interface FinalizeResult {
    success: boolean;
    orderId: string;
    orderNumber: string;
    pdfUrl: string;
    akashicUpdated: boolean;
}

interface AkashicHistoryEntry {
    date: string;
    topic: string;
    insights: string;
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}

interface DomainSummary {
    summary: string;
    lastUpdated: string;
    keyInsights?: string[];
}

interface AkashicRecordData {
    id: string;
    userId: string;
    archetype: string | null;
    domains: AkashicDomains | null;
    history: AkashicHistoryEntry[] | null;
}

interface UserWithRelations {
    id: string;
    firstName: string;
    lastName: string;
    profile: {
        birthDate: string | null;
        birthTime: string | null;
        birthPlace: string | null;
    } | null;
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class ContextDispatcher {
    private readonly logger = new Logger(ContextDispatcher.name);
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

    // =========================================================================
    // MAIN METHOD: dispatchChatRequest
    // =========================================================================

    /**
     * Dispatches a chat request with full context from:
     * - User Profile
     * - Akashic Record (archetype, domains, history)
     * - Last completed order content
     * 
     * Constructs a rich context prompt and calls VertexOracle.chatWithUser()
     */
    async dispatchChatRequest(
        userId: string,
        message: string,
        sessionId?: string,
    ): Promise<DispatchResult> {
        this.logger.log(`💬 [DISPATCH] Chat request for user ${userId.substring(0, 8)}...`);
        const startTime = Date.now();

        // Step 1: Fetch User with Profile
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
            },
        });

        if (!user) {
            throw new NotFoundException(`User not found: ${userId}`);
        }

        this.logger.log(`👤 User: ${user.firstName} ${user.lastName}`);

        // Step 2: Fetch Akashic Record separately (handles model existence)
        const akashicRecord = await this.getAkashicRecord(userId);

        // Step 3: Fetch last completed order with generated content
        const lastOrder = await this.prisma.order.findFirst({
            where: {
                userId: userId,
                status: 'COMPLETED',
                generatedContent: { not: null },
            },
            orderBy: { deliveredAt: 'desc' },
            select: {
                id: true,
                orderNumber: true,
                generatedContent: true,
                deliveredAt: true,
            },
        });

        // Step 4: Build Akashic context
        const akashicDomains = akashicRecord?.domains ?? null;
        const akashicHistory = akashicRecord?.history ?? null;

        // Step 5: Extract last reading excerpt if available
        let lastReadingExcerpt: string | undefined;
        if (lastOrder?.generatedContent) {
            const content = lastOrder.generatedContent as unknown as OracleResponse;
            if (content.pdf_content) {
                lastReadingExcerpt = this.buildReadingExcerpt(content);
            }
        }

        // Step 6: Build ChatContext for VertexOracle
        const chatContext: ChatContext = {
            userId: user.id,
            sessionId: sessionId || this.generateSessionId(),
            archetype: akashicRecord?.archetype ?? undefined,
            akashicDomains: akashicDomains ?? undefined,
            recentHistory: akashicHistory?.slice(-5).map(h => ({
                date: h.date,
                topic: h.topic,
                sentiment: h.sentiment,
            })) ?? undefined,
            currentQuestion: message,
        };

        // Step 7: Fetch conversation history for this session
        let conversationHistory: ChatMessage[] = [];
        if (sessionId) {
            const session = await this.prisma.chatSession.findUnique({
                where: { id: sessionId },
            });
            if (session?.messages) {
                conversationHistory = session.messages as unknown as ChatMessage[];
            }
        }

        // Step 8: Enrich message with context prompt
        const enrichedMessage = this.buildContextualPrompt(
            message,
            user.firstName,
            akashicRecord?.archetype ?? undefined,
            akashicDomains,
            lastReadingExcerpt,
        );

        // Step 9: Call VertexOracle CONFIDANT agent
        this.logger.log(`🤖 Calling CONFIDANT agent...`);
        const reply = await this.vertexOracle.chatWithUser(
            enrichedMessage,
            chatContext,
            conversationHistory,
        );

        // Step 10: Save conversation to session
        const newSessionId = chatContext.sessionId!;
        await this.saveConversation(
            userId,
            newSessionId,
            message,
            reply,
            lastOrder?.id,
        );

        // Step 11: Update Akashic history with this interaction
        await this.updateAkashicHistory(userId, message, reply);

        const elapsed = Date.now() - startTime;
        this.logger.log(`✅ [DISPATCH] Chat completed in ${elapsed}ms`);

        return {
            reply,
            sessionId: newSessionId,
            contextUsed: {
                hasAkashic: !!akashicRecord,
                hasRecentOrder: !!lastOrder,
                archetype: akashicRecord?.archetype ?? undefined,
            },
        };
    }

    // =========================================================================
    // MAIN METHOD: finalizeOrder
    // =========================================================================

    /**
     * Finalizes an order by:
     * 1. Generating PDF from the provided content
     * 2. Uploading to S3
     * 3. CRITICAL: Updating AkashicRecord with new synthesis/archetype
     * 4. Completing the order status
     */
    async finalizeOrder(
        orderId: string,
        content: string,
        expertId?: string,
    ): Promise<FinalizeResult> {
        this.logger.log(`🔏 [FINALIZE] Starting finalization for order ${orderId}`);
        const startTime = Date.now();

        // Step 1: Load order with user data
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: {
                    include: {
                        profile: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException(`Order not found: ${orderId}`);
        }

        if (!order.user) {
            throw new NotFoundException(`User not found for order: ${orderId}`);
        }

        const user = order.user as UserWithRelations;
        this.logger.log(`📋 Order: ${order.orderNumber} | User: ${user.firstName} ${user.lastName}`);

        // Step 2: Parse or generate synthesis from content
        const existingContent = order.generatedContent as unknown as OracleResponse | null;
        const synthesis = existingContent?.synthesis || await this.extractSynthesisFromContent(content);

        // Step 3: Build PDF data
        const pdfData: ReadingPdfData = {
            userName: `${user.firstName} ${user.lastName}`,
            archetype: synthesis.archetype,
            archetypeDescription: existingContent?.pdf_content?.archetype_reveal || '',
            introduction: existingContent?.pdf_content?.introduction || this.extractSection(content, 'introduction'),
            sections: existingContent?.pdf_content?.sections || this.extractSections(content),
            karmicInsights: existingContent?.pdf_content?.karmic_insights || [],
            lifeMission: existingContent?.pdf_content?.life_mission || '',
            rituals: existingContent?.pdf_content?.rituals || [],
            conclusion: existingContent?.pdf_content?.conclusion || this.extractSection(content, 'conclusion'),
            birthData: {
                date: user.profile?.birthDate || '',
                time: user.profile?.birthTime || undefined,
                place: user.profile?.birthPlace || undefined,
            },
            generatedAt: new Date().toISOString(),
        };

        // Step 4: Generate PDF
        this.logger.log(`📄 Generating PDF...`);
        let pdfBuffer: Buffer;
        try {
            pdfBuffer = await this.pdfFactory.generatePdf('reading', pdfData);
            this.logger.log(`✅ PDF generated: ${Math.round(pdfBuffer.length / 1024)}KB`);
        } catch (error) {
            const errorMsg = `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error(`❌ ${errorMsg}`);
            throw new BadRequestException(errorMsg);
        }

        // Step 5: Upload to S3
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
            this.logger.log(`☁️ PDF uploaded: ${pdfKey}`);
        } catch {
            this.logger.warn(`⚠️ S3 upload failed, using fallback URL`);
            pdfUrl = `/api/readings/${order.orderNumber}/download`;
        }

        // Step 6: CRITICAL - Update AkashicRecord with new synthesis
        let akashicUpdated = false;
        try {
            await this.updateAkashicFromSynthesis(user.id, synthesis, content);
            akashicUpdated = true;
            this.logger.log(`📚 Akashic Record updated with archetype: ${synthesis.archetype}`);
        } catch (error) {
            this.logger.error(`⚠️ Failed to update Akashic Record: ${error}`);
            // Non-blocking - order can still complete
        }

        // Step 7: Update order to COMPLETED
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'COMPLETED',
                deliveredAt: new Date(),
                errorLog: null,
                generatedContent: {
                    ...(existingContent || {}),
                    lecture: content,
                    pdfUrl,
                    pdfKey,
                    sealedAt: new Date().toISOString(),
                    sealedBy: expertId || 'system',
                } as object,
            },
        });

        // Step 8: Update SpiritualPath if needed
        await this.prisma.spiritualPath.upsert({
            where: { userId: user.id },
            update: {
                archetype: synthesis.archetype,
                synthesis: synthesis.emotional_state || pdfData.introduction.substring(0, 500),
                keyBlockage: synthesis.key_blockage || null,
            },
            create: {
                userId: user.id,
                archetype: synthesis.archetype,
                synthesis: synthesis.emotional_state || pdfData.introduction.substring(0, 500),
                keyBlockage: synthesis.key_blockage || null,
            },
        });

        const elapsed = Date.now() - startTime;
        this.logger.log(`\n${'='.repeat(60)}`);
        this.logger.log(`🎉 ORDER FINALIZED: ${order.orderNumber}`);
        this.logger.log(`   📄 PDF: ${pdfUrl}`);
        this.logger.log(`   📚 Akashic: ${akashicUpdated ? 'UPDATED' : 'SKIPPED'}`);
        this.logger.log(`   ⏱️ Time: ${elapsed}ms`);
        this.logger.log(`${'='.repeat(60)}\n`);

        return {
            success: true,
            orderId: order.id,
            orderNumber: order.orderNumber,
            pdfUrl,
            akashicUpdated,
        };
    }

    // =========================================================================
    // AKASHIC RECORD HELPERS (using raw queries for compatibility)
    // =========================================================================

    /**
     * Gets the Akashic Record for a user.
     * Uses raw query for compatibility when Prisma client isn't regenerated.
     */
    private async getAkashicRecord(userId: string): Promise<AkashicRecordData | null> {
        try {
            const records = await this.prisma.$queryRaw<AkashicRecordData[]>`
                SELECT id, "userId", archetype, domains, history
                FROM "AkashicRecord"
                WHERE "userId" = ${userId}
                LIMIT 1
            `;
            return records[0] || null;
        } catch (error) {
            this.logger.warn(`⚠️ Could not fetch Akashic Record: ${error}`);
            return null;
        }
    }

    /**
     * Upserts an Akashic Record.
     */
    private async upsertAkashicRecord(
        userId: string,
        data: Partial<AkashicRecordData>,
    ): Promise<void> {
        try {
            const existing = await this.getAkashicRecord(userId);
            const now = new Date();
            const id = existing?.id || `akashic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            if (existing) {
                await this.prisma.$executeRaw`
                    UPDATE "AkashicRecord"
                    SET archetype = ${data.archetype ?? existing.archetype},
                        domains = ${JSON.stringify(data.domains ?? existing.domains ?? {})}::jsonb,
                        history = ${JSON.stringify(data.history ?? existing.history ?? [])}::jsonb,
                        "updatedAt" = ${now}
                    WHERE "userId" = ${userId}
                `;
            } else {
                await this.prisma.$executeRaw`
                    INSERT INTO "AkashicRecord" (id, "userId", archetype, domains, history, "createdAt", "updatedAt")
                    VALUES (
                        ${id},
                        ${userId},
                        ${data.archetype ?? null},
                        ${JSON.stringify(data.domains ?? {})}::jsonb,
                        ${JSON.stringify(data.history ?? [])}::jsonb,
                        ${now},
                        ${now}
                    )
                `;
            }
        } catch (error) {
            this.logger.error(`❌ Failed to upsert Akashic Record: ${error}`);
            throw error;
        }
    }

    // =========================================================================
    // PRIVATE HELPER METHODS
    // =========================================================================

    /**
     * Builds a contextual prompt enriched with user data.
     */
    private buildContextualPrompt(
        message: string,
        firstName: string,
        archetype?: string,
        domains?: AkashicDomains | null,
        lastReadingExcerpt?: string,
    ): string {
        const parts: string[] = [];

        // Add Akashic context
        if (archetype || domains) {
            parts.push(`Voici ce que tu sais du client ${firstName}:`);
            
            if (archetype) {
                parts.push(`- Archétype: ${archetype}`);
            }

            if (domains) {
                const domainSummaries: string[] = [];
                for (const [domain, data] of Object.entries(domains)) {
                    const domainData = data as DomainSummary;
                    if (domainData?.summary) {
                        domainSummaries.push(`  • ${domain}: ${domainData.summary}`);
                    }
                }
                if (domainSummaries.length > 0) {
                    parts.push(`- Annales Akashiques:\n${domainSummaries.join('\n')}`);
                }
            }
        }

        // Add last reading excerpt
        if (lastReadingExcerpt) {
            parts.push(`\nVoici sa dernière lecture (extrait):\n${lastReadingExcerpt}`);
        }

        // Add the actual question
        parts.push(`\nSa question est:\n${message}`);

        return parts.join('\n');
    }

    /**
     * Builds a concise excerpt from an Oracle response.
     */
    private buildReadingExcerpt(response: OracleResponse): string {
        const parts: string[] = [];

        if (response.synthesis?.archetype) {
            parts.push(`Archétype identifié: ${response.synthesis.archetype}`);
        }

        if (response.synthesis?.key_blockage) {
            parts.push(`Blocage principal: ${response.synthesis.key_blockage}`);
        }

        if (response.synthesis?.keywords?.length > 0) {
            parts.push(`Mots-clés: ${response.synthesis.keywords.slice(0, 5).join(', ')}`);
        }

        // Add a brief from introduction
        if (response.pdf_content?.introduction) {
            const intro = response.pdf_content.introduction;
            parts.push(`Introduction: ${intro.substring(0, 200)}...`);
        }

        return parts.join('\n');
    }

    /**
     * Saves a conversation to the ChatSession.
     */
    private async saveConversation(
        userId: string,
        sessionId: string,
        userMessage: string,
        assistantReply: string,
        relatedOrderId?: string,
    ): Promise<void> {
        const now = new Date();

        const userMsg: ChatMessage = {
            role: 'user',
            content: userMessage,
            timestamp: now.toISOString(),
        };

        const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: assistantReply,
            timestamp: new Date(now.getTime() + 1).toISOString(),
        };

        // Check if session exists
        const existingSession = await this.prisma.chatSession.findUnique({
            where: { id: sessionId },
        });

        if (existingSession) {
            // Append to existing messages
            const currentMessages = existingSession.messages as unknown as ChatMessage[] || [];
            const updatedMessages = [...currentMessages, userMsg, assistantMsg];
            
            await this.prisma.chatSession.update({
                where: { id: sessionId },
                data: {
                    messages: updatedMessages as unknown as object,
                    lastMessageAt: now,
                },
            });
        } else {
            // Create new session
            await this.prisma.chatSession.create({
                data: {
                    id: sessionId,
                    userId,
                    relatedOrderId: relatedOrderId || null,
                    messages: [userMsg, assistantMsg] as unknown as object,
                    lastMessageAt: now,
                    title: this.generateSessionTitle(userMessage),
                },
            });
        }
    }

    /**
     * Updates Akashic history with a new interaction.
     */
    private async updateAkashicHistory(
        userId: string,
        question: string,
        answer: string,
    ): Promise<void> {
        const topic = this.extractTopic(question);
        const sentiment = this.analyzeSentiment(question);

        const newEntry: AkashicHistoryEntry = {
            date: new Date().toISOString(),
            topic,
            insights: answer.substring(0, 200),
            sentiment,
        };

        const existing = await this.getAkashicRecord(userId);
        const currentHistory = existing?.history ?? [];
        const updatedHistory = [...currentHistory, newEntry].slice(-50); // Keep last 50 entries

        await this.upsertAkashicRecord(userId, {
            history: updatedHistory,
        });
    }

    /**
     * CRITICAL: Updates Akashic Record with synthesis from a completed reading.
     */
    private async updateAkashicFromSynthesis(
        userId: string,
        synthesis: ReadingSynthesis,
        fullContent: string,
    ): Promise<void> {
        // Build domain summaries from the content
        const domains = await this.extractDomainsFromContent(fullContent);

        await this.upsertAkashicRecord(userId, {
            archetype: synthesis.archetype,
            domains,
        });
    }

    /**
     * Extracts domain summaries from reading content.
     */
    private async extractDomainsFromContent(content: string): Promise<AkashicDomains> {
        const domains: AkashicDomains = {};
        const now = new Date().toISOString();

        // Domain patterns to look for
        const domainPatterns: Record<string, RegExp> = {
            spirituel: /spirituel|âme|éveil|conscience/i,
            relations: /relation|amour|couple|famille|ami/i,
            mission: /mission|vocation|but|destinée/i,
            creativite: /créati|art|expression|talent/i,
            emotions: /émotion|sentiment|cœur|ressenti/i,
            travail: /travail|carrière|profession|métier/i,
            sante: /santé|corps|bien-être|vitalité/i,
            finance: /financ|argent|abondance|prospérité/i,
        };

        // Split content into sections and analyze
        const sections = content.split(/#{2,3}\s+/);
        
        for (const section of sections) {
            if (section.length < 50) continue;

            for (const [domain, pattern] of Object.entries(domainPatterns)) {
                if (pattern.test(section)) {
                    // Extract first 300 chars as summary
                    const summary = section.replace(/\n/g, ' ').substring(0, 300).trim();
                    if (summary.length > 50) {
                        domains[domain as keyof AkashicDomains] = {
                            summary: summary + '...',
                            lastUpdated: now,
                        };
                    }
                    break;
                }
            }
        }

        return domains;
    }

    /**
     * Extracts a synthesis from raw content when not available.
     */
    private async extractSynthesisFromContent(content: string): Promise<ReadingSynthesis> {
        // Try to identify archetype from content
        const archetypes = ['Le Guérisseur', 'Le Visionnaire', 'Le Guide', 'Le Créateur', 'Le Sage'];
        let detectedArchetype = 'Le Sage'; // Default

        for (const archetype of archetypes) {
            if (content.toLowerCase().includes(archetype.toLowerCase())) {
                detectedArchetype = archetype;
                break;
            }
        }

        // Extract keywords from content
        const words = content.toLowerCase()
            .replace(/[^\w\sàâäéèêëïîôùûüÿç]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 5);
        
        const wordFreq = new Map<string, number>();
        for (const word of words) {
            wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        }

        const keywords = Array.from(wordFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);

        return {
            archetype: detectedArchetype,
            keywords,
            emotional_state: 'État émotionnel extrait de la lecture',
            key_blockage: 'Blocage identifié dans la lecture',
        };
    }

    /**
     * Extracts a specific section from markdown content.
     */
    private extractSection(content: string, sectionName: string): string {
        const patterns: Record<string, RegExp> = {
            introduction: /^#\s+.*?\n\n([\s\S]*?)(?=\n##|\n---|$)/,
            conclusion: /##?\s*conclusion.*?\n\n([\s\S]*?)(?=\n##|$)/i,
        };

        const pattern = patterns[sectionName];
        if (!pattern) return '';

        const match = content.match(pattern);
        return match?.[1]?.trim() || '';
    }

    /**
     * Extracts sections from markdown content.
     */
    private extractSections(content: string): Array<{ domain: string; title: string; content: string }> {
        const sections: Array<{ domain: string; title: string; content: string }> = [];
        const sectionRegex = /##\s+(.+?)\n\n([\s\S]*?)(?=\n##|$)/g;

        let match;
        while ((match = sectionRegex.exec(content)) !== null) {
            const title = match[1].trim();
            const sectionContent = match[2].trim();

            // Try to detect domain from title
            const domain = this.detectDomainFromTitle(title);

            sections.push({
                domain,
                title,
                content: sectionContent,
            });
        }

        return sections;
    }

    /**
     * Detects domain from section title.
     */
    private detectDomainFromTitle(title: string): string {
        const titleLower = title.toLowerCase();
        
        if (titleLower.includes('spirit') || titleLower.includes('âme')) return 'spirituel';
        if (titleLower.includes('relation') || titleLower.includes('amour')) return 'relations';
        if (titleLower.includes('mission') || titleLower.includes('vocation')) return 'mission';
        if (titleLower.includes('créat') || titleLower.includes('art')) return 'creativite';
        if (titleLower.includes('émotion') || titleLower.includes('cœur')) return 'emotions';
        if (titleLower.includes('travail') || titleLower.includes('carrière')) return 'travail';
        if (titleLower.includes('santé') || titleLower.includes('corps')) return 'sante';
        if (titleLower.includes('financ') || titleLower.includes('argent')) return 'finance';

        return 'general';
    }

    /**
     * Extracts topic from a user question.
     */
    private extractTopic(question: string): string {
        const topics: Record<string, RegExp> = {
            'amour': /amour|relation|couple|partenaire/i,
            'travail': /travail|carrière|emploi|profession/i,
            'santé': /santé|corps|bien-être|maladie/i,
            'finances': /argent|financ|investissement/i,
            'spiritualité': /spirit|méditation|éveil|âme/i,
            'famille': /famille|parent|enfant/i,
            'décision': /décision|choix|dilemme/i,
        };

        for (const [topic, pattern] of Object.entries(topics)) {
            if (pattern.test(question)) {
                return topic;
            }
        }

        return 'général';
    }

    /**
     * Simple sentiment analysis.
     */
    private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' | 'mixed' {
        const positiveWords = /joie|bonheur|amour|espoir|merci|bien|super|excellent/i;
        const negativeWords = /triste|peur|anxiété|déprime|mal|difficile|problème/i;

        const hasPositive = positiveWords.test(text);
        const hasNegative = negativeWords.test(text);

        if (hasPositive && hasNegative) return 'mixed';
        if (hasPositive) return 'positive';
        if (hasNegative) return 'negative';
        return 'neutral';
    }

    /**
     * Generates a session ID.
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Generates a session title from the first message.
     */
    private generateSessionTitle(message: string): string {
        const maxLength = 50;
        const cleaned = message.replace(/\n/g, ' ').trim();
        
        if (cleaned.length <= maxLength) {
            return cleaned;
        }

        return cleaned.substring(0, maxLength - 3) + '...';
    }
}
