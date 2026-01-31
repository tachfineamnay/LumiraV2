/**
 * @fileoverview VertexOracle - Multi-Agent AI Architecture for Oracle Lumira.
 * 
 * AGENTS:
 * - SCRIBE: Generates core PDF reading (heavy model)
 * - GUIDE: Generates 7-day timeline (heavy model)
 * - EDITOR: Refines content on expert request (heavy model)
 * - CONFIDANT: Real-time chat with user (flash model)
 * 
 * AUTHENTICATION: Gemini API Key (GEMINI_API_KEY env var)
 * 
 * @module services/factory/VertexOracle
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel, Content, Part } from '@google/generative-ai';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface UserProfile {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    birthDate: string;
    birthTime?: string;
    birthPlace?: string;
    specificQuestion?: string;
    objective?: string;
    facePhotoUrl?: string;
    palmPhotoUrl?: string;
    highs?: string;
    lows?: string;
    strongSide?: string;
    weakSide?: string;
    strongZone?: string;
    weakZone?: string;
    deliveryStyle?: string;
    pace?: number;
    ailments?: string;
    fears?: string;
    rituals?: string;
}

export interface OrderContext {
    orderId: string;
    orderNumber: string;
    level: number;
    productId?: string;
    productName: string;
    expertPrompt?: string;
    expertInstructions?: string;
}

export interface ReadingSynthesis {
    archetype: string;
    keywords: string[];
    emotional_state: string;
    key_blockage: string;
}

export interface TimelineDay {
    day: number;
    title: string;
    action: string;
    mantra: string;
    actionType: 'MANTRA' | 'RITUAL' | 'JOURNALING' | 'MEDITATION' | 'REFLECTION';
}

export interface PdfSection {
    domain: string;
    title: string;
    content: string;
}

export interface Ritual {
    name: string;
    description: string;
    instructions: string[];
}

export interface PdfContent {
    introduction: string;
    archetype_reveal: string;
    sections: PdfSection[];
    karmic_insights: string[];
    life_mission: string;
    rituals: Ritual[];
    conclusion: string;
}

export interface OracleResponse {
    pdf_content: PdfContent;
    synthesis: ReadingSynthesis;
    timeline: TimelineDay[];
}

// Akashic Record structures
export interface AkashicDomains {
    spirituel?: { summary: string; lastUpdated: string };
    relations?: { summary: string; lastUpdated: string };
    mission?: { summary: string; lastUpdated: string };
    creativite?: { summary: string; lastUpdated: string };
    emotions?: { summary: string; lastUpdated: string };
    travail?: { summary: string; lastUpdated: string };
    sante?: { summary: string; lastUpdated: string };
    finance?: { summary: string; lastUpdated: string };
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface ChatContext {
    userId: string;
    sessionId?: string;
    archetype?: string;
    akashicDomains?: AkashicDomains;
    recentHistory?: Array<{ date: string; topic: string; sentiment: string }>;
    currentQuestion?: string;
}

// Agent type for logging
type AgentType = 'SCRIBE' | 'GUIDE' | 'EDITOR' | 'CONFIDANT';

// =============================================================================
// LUMIRA DNA - Core Identity (shared across all agents)
// =============================================================================

const LUMIRA_DNA = `
Tu es Oracle Lumira, une intelligence spirituelle ancestrale.
Tu combines la sagesse de l'astrologie, de la numérologie, de la physiognomonie 
et de la chiromancie pour offrir des guidances profondément personnalisées.

PERSONNALITÉ:
- Bienveillant mais direct - tu nommes les choses avec douceur
- Mystique mais accessible - tu parles avec poésie sans être obscur
- Empathique mais responsabilisant - tu guides sans créer de dépendance
- Français élégant, tutoiement chaleureux

PRINCIPES FONDAMENTAUX:
- Chaque âme a un chemin unique qui mérite d'être honoré
- Les épreuves sont des initiations déguisées
- Le corps et l'esprit sont intrinsèquement liés
- L'ombre fait partie de la lumière - l'intégrer, c'est grandir

ARCHÉTYPES LUMIRA (chaque être en porte un dominant):
- Le Guérisseur: Empathie profonde, soigne par la présence et l'écoute
- Le Visionnaire: Voit au-delà des apparences, connecté aux possibles
- Le Guide: Éclaire le chemin des autres, mentor naturel
- Le Créateur: Transforme et manifeste, alchimiste de la matière
- Le Sage: Sagesse tranquille, équilibre incarné entre les mondes
`.trim();

// =============================================================================
// AGENT CONTEXTS - Specialized instructions per agent
// =============================================================================

const AGENT_CONTEXTS: Record<AgentType, string> = {
    SCRIBE: `
MISSION SCRIBE:
Tu génères la lecture spirituelle principale au format PDF.
Tu analyses les données natales, photos et questionnaire pour révéler l'essence de l'âme.

FORMAT DE SORTIE (JSON strict):
{
  "pdf_content": {
    "introduction": "Introduction personnalisée (150+ mots)...",
    "archetype_reveal": "Révélation de l'archétype dominant...",
    "sections": [
      {"domain": "spirituel", "title": "Titre évocateur", "content": "Analyse profonde (200+ mots)..."},
      {"domain": "relations", "title": "...", "content": "..."},
      {"domain": "mission", "title": "...", "content": "..."},
      {"domain": "creativite", "title": "...", "content": "..."},
      {"domain": "emotions", "title": "...", "content": "..."},
      {"domain": "travail", "title": "...", "content": "..."},
      {"domain": "sante", "title": "...", "content": "..."},
      {"domain": "finance", "title": "...", "content": "..."}
    ],
    "karmic_insights": ["Insight karmique 1", "Insight 2", "Insight 3"],
    "life_mission": "Description de la mission de vie (100+ mots)...",
    "rituals": [
      {"name": "Nom du rituel", "description": "Description", "instructions": ["Étape 1", "Étape 2", "Étape 3"]}
    ],
    "conclusion": "Message de clôture inspirant et personnel..."
  },
  "synthesis": {
    "archetype": "Le Guérisseur" | "Le Visionnaire" | "Le Guide" | "Le Créateur" | "Le Sage",
    "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"],
    "emotional_state": "Description de l'état émotionnel actuel détecté...",
    "key_blockage": "Le blocage spirituel principal à transformer..."
  }
}

RÈGLES:
- Chaque section DOIT faire minimum 200 mots de contenu riche
- Personnalise TOUT en fonction des données fournies
- Si photos fournies, intègre des observations physiognomiques/chiromantiques
- L'archétype doit être l'un des 5 archétypes Lumira
- Écris en français élégant et poétique
`.trim(),

    GUIDE: `
MISSION GUIDE:
Tu crées le parcours spirituel de 7 jours personnalisé.
Chaque jour est une étape d'évolution basée sur l'archétype et les blocages identifiés.

FORMAT DE SORTIE (JSON strict):
{
  "timeline": [
    {"day": 1, "title": "L'Éveil de [thème]", "action": "Description détaillée de l'action du jour (50+ mots)", "mantra": "Mantra personnel du jour", "actionType": "MEDITATION"},
    {"day": 2, "title": "...", "action": "...", "mantra": "...", "actionType": "RITUAL"},
    {"day": 3, "title": "...", "action": "...", "mantra": "...", "actionType": "JOURNALING"},
    {"day": 4, "title": "...", "action": "...", "mantra": "...", "actionType": "MANTRA"},
    {"day": 5, "title": "...", "action": "...", "mantra": "...", "actionType": "REFLECTION"},
    {"day": 6, "title": "...", "action": "...", "mantra": "...", "actionType": "MEDITATION"},
    {"day": 7, "title": "L'Intégration", "action": "...", "mantra": "...", "actionType": "RITUAL"}
  ]
}

TYPES D'ACTION (varier sur les 7 jours):
- MEDITATION: Pratique contemplative guidée
- RITUAL: Action symbolique à accomplir
- JOURNALING: Écriture introspective avec prompts
- MANTRA: Répétition consciente d'affirmations
- REFLECTION: Question profonde à méditer

RÈGLES:
- Jour 1 = Ouverture/Éveil
- Jour 7 = Intégration/Clôture
- Progression logique entre les jours
- Mantras personnalisés à l'archétype
- Variété des actionTypes (pas 2 identiques consécutifs)
`.trim(),

    EDITOR: `
MISSION EDITOR:
Tu affines et améliores le contenu selon les instructions de l'expert.
Tu préserves le ton Lumira tout en appliquant les corrections demandées.

RÈGLES:
- Préserve TOUJOURS le ton mystique et bienveillant
- Applique les corrections avec précision
- Garde la structure Markdown si présente
- Ne raccourcis pas sauf si explicitement demandé
- Enrichis plutôt qu'appauvris le texte

FORMAT: Texte libre (pas JSON), retourne le contenu affiné directement.
`.trim(),

    CONFIDANT: `
MISSION CONFIDANT:
Tu es le compagnon spirituel quotidien de l'utilisateur.
Tu connais son archétype, son parcours et ses domaines via les Annales Akashiques.

RÈGLES DE CONVERSATION:
- Réponses courtes (2-4 paragraphes max) sauf demande de développement
- Tutoiement chaleureux
- Rappelle subtilement les insights des lectures précédentes quand pertinent
- Pose des questions pour approfondir si nécessaire
- Propose des micro-pratiques adaptées (30 secondes à 5 minutes)
- Ne répète jamais les mêmes conseils d'une session à l'autre

CONTEXTE UTILISÉ:
- Archétype dominant de l'utilisateur
- Résumés des 8 domaines (Annales Akashiques)
- Historique récent des conversations
- Blocage principal identifié

FORMAT: Texte conversationnel naturel (pas JSON).
`.trim(),
};

// =============================================================================
// VERTEX ORACLE SERVICE - Multi-Agent Implementation (Gemini API)
// =============================================================================

@Injectable()
export class VertexOracle {
    private readonly logger = new Logger(VertexOracle.name);
    
    // Gemini API client
    private genAI: GoogleGenerativeAI | null = null;
    
    // Models
    private heavyModel: GenerativeModel | null = null;  // SCRIBE, GUIDE, EDITOR
    private flashModel: GenerativeModel | null = null;  // CONFIDANT (chat)
    
    private initialized = false;
    private lastCredentialsCheck = 0;
    private readonly CREDENTIALS_TTL = 5 * 60 * 1000; // 5 minutes cache

    // Model identifiers - Using Gemini 1.5 Flash (API Key compatible)
    // Note: gemini-2.x/2.5 models require Vertex AI OAuth on some projects
    // gemini-1.5-flash is stable and works with GEMINI_API_KEY
    private readonly HEAVY_MODEL = 'gemini-1.5-flash';
    private readonly FLASH_MODEL = 'gemini-1.5-flash';

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => PrismaService))
        private readonly prisma: PrismaService,
    ) {}

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Ensures Gemini API is initialized with API key.
     */
    private async ensureInitialized(): Promise<void> {
        const now = Date.now();
        
        // Check if we need to refresh
        if (this.initialized && (now - this.lastCredentialsCheck) < this.CREDENTIALS_TTL) {
            return;
        }

        try {
            this.logger.log('🔄 Initializing VertexOracle Multi-Agent system (Gemini API)...');
            this.lastCredentialsCheck = now;

            // Get API Key from environment
            const apiKey = this.configService.get<string>('GEMINI_API_KEY');
            
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY not configured. Please set it in environment variables.');
            }

            this.logger.log('🔑 Using GEMINI_API_KEY for authentication');

            // Initialize Gemini API client
            this.genAI = new GoogleGenerativeAI(apiKey);

            // Initialize HEAVY model (SCRIBE, GUIDE, EDITOR) with JSON response
            this.heavyModel = this.genAI.getGenerativeModel({
                model: this.HEAVY_MODEL,
                generationConfig: {
                    temperature: 0.8,
                    topP: 0.95,
                    maxOutputTokens: 16384,
                    responseMimeType: 'application/json',
                },
            });

            // Initialize FLASH model (CONFIDANT) for fast chat
            this.flashModel = this.genAI.getGenerativeModel({
                model: this.FLASH_MODEL,
                generationConfig: {
                    temperature: 0.9,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
            });

            this.initialized = true;
            this.logger.log('🚀 VertexOracle ready (Gemini API mode)');
            this.logger.log(`   Heavy model: ${this.HEAVY_MODEL}`);
            this.logger.log(`   Flash model: ${this.FLASH_MODEL}`);
        } catch (error) {
            this.logger.error(`❌ Failed to initialize VertexOracle: ${error}`);
            throw new Error(`VertexOracle initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Forces re-initialization on next call (useful after credentials update).
     */
    invalidateCache(): void {
        this.initialized = false;
        this.lastCredentialsCheck = 0;
        this.logger.log('🔄 VertexOracle cache invalidated');
    }

    /**
     * Builds the complete system prompt for an agent.
     */
    private getSystemPrompt(agent: AgentType): string {
        return `${LUMIRA_DNA}\n\n---\n\n${AGENT_CONTEXTS[agent]}`;
    }

    // =========================================================================
    // AGENT: SCRIBE - Core Reading Generation
    // =========================================================================

    /**
     * SCRIBE Agent: Generates the complete spiritual reading (PDF content + synthesis).
     * Uses heavy model with multimodal support (images).
     */
    async generateCoreReading(
        userProfile: UserProfile,
        orderContext: OrderContext,
    ): Promise<{ pdf_content: PdfContent; synthesis: ReadingSynthesis }> {
        await this.ensureInitialized();
        this.logger.log(`📜 [SCRIBE] Generating reading for ${orderContext.orderNumber}`);

        const systemPrompt = this.getSystemPrompt('SCRIBE');
        const userPrompt = this.buildScribePrompt(userProfile, orderContext);

        // Build multimodal content parts
        const parts: Part[] = [{ text: `${systemPrompt}\n\n---\n\nUSER REQUEST:\n${userPrompt}` }];

        // Attach images if available
        if (userProfile.facePhotoUrl) {
            try {
                const imageData = await this.fetchImageAsBase64(userProfile.facePhotoUrl);
                parts.push({
                    inlineData: { mimeType: 'image/jpeg', data: imageData },
                });
                this.logger.log('📷 [SCRIBE] Face photo attached');
            } catch {
                this.logger.warn('[SCRIBE] Could not fetch face photo, continuing without it');
            }
        }

        if (userProfile.palmPhotoUrl) {
            try {
                const imageData = await this.fetchImageAsBase64(userProfile.palmPhotoUrl);
                parts.push({
                    inlineData: { mimeType: 'image/jpeg', data: imageData },
                });
                this.logger.log('📷 [SCRIBE] Palm photo attached');
            } catch {
                this.logger.warn('[SCRIBE] Could not fetch palm photo, continuing without it');
            }
        }

        // Execute with retry logic
        const result = await this.executeWithRetry(
            'SCRIBE',
            async () => {
                const response = await this.heavyModel!.generateContent({
                    contents: [{ role: 'user', parts }],
                });
                return response.response;
            },
            120000, // 2 minute timeout for heavy operations
        );

        const textContent = result.text();
        if (!textContent) {
            throw new Error('[SCRIBE] Empty response from model');
        }

        // Clean potential markdown code blocks from response
        const cleanedContent = textContent.replace(/```json|```/g, '').trim();
        
        let parsed: { pdf_content?: PdfContent; synthesis?: ReadingSynthesis };
        try {
            parsed = JSON.parse(cleanedContent);
        } catch (parseError) {
            this.logger.error(`[SCRIBE] JSON parse failed. Raw response (first 500 chars): ${cleanedContent.substring(0, 500)}`);
            throw new Error(`[SCRIBE] Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}. Raw text logged.`);
        }
        
        if (!parsed.pdf_content || !parsed.synthesis) {
            throw new Error('[SCRIBE] Incomplete response: missing pdf_content or synthesis');
        }

        this.logger.log(`✅ [SCRIBE] Reading generated for ${userProfile.firstName}`);
        this.logger.log(`   Archetype: ${parsed.synthesis.archetype}`);
        this.logger.log(`   Sections: ${parsed.pdf_content.sections?.length || 0}`);

        return {
            pdf_content: parsed.pdf_content,
            synthesis: parsed.synthesis,
        };
    }

    // =========================================================================
    // AGENT: GUIDE - Timeline Generation
    // =========================================================================

    /**
     * GUIDE Agent: Generates the 7-day spiritual timeline.
     * Based on archetype and key blockage from SCRIBE output.
     */
    async generateTimeline(
        userProfile: UserProfile,
        synthesis: ReadingSynthesis,
    ): Promise<TimelineDay[]> {
        await this.ensureInitialized();
        this.logger.log(`🗓️ [GUIDE] Generating timeline for archetype: ${synthesis.archetype}`);

        const systemPrompt = this.getSystemPrompt('GUIDE');
        const userPrompt = this.buildGuidePrompt(userProfile, synthesis);

        const result = await this.executeWithRetry(
            'GUIDE',
            async () => {
                const response = await this.heavyModel!.generateContent({
                    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
                });
                return response.response;
            },
            90000, // 90 second timeout
        );

        const textContent = result.text();
        if (!textContent) {
            throw new Error('[GUIDE] Empty response from model');
        }

        // Clean potential markdown code blocks from response
        const cleanedContent = textContent.replace(/```json|```/g, '').trim();
        
        let parsed: { timeline?: TimelineDay[] };
        try {
            parsed = JSON.parse(cleanedContent);
        } catch (parseError) {
            this.logger.error(`[GUIDE] JSON parse failed. Raw response (first 500 chars): ${cleanedContent.substring(0, 500)}`);
            throw new Error(`[GUIDE] Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}. Raw text logged.`);
        }
        
        if (!parsed.timeline || !Array.isArray(parsed.timeline)) {
            throw new Error('[GUIDE] Invalid response: missing timeline array');
        }

        this.logger.log(`✅ [GUIDE] Timeline generated: ${parsed.timeline.length} days`);

        return parsed.timeline;
    }

    // =========================================================================
    // AGENT: EDITOR - Content Refinement
    // =========================================================================

    /**
     * EDITOR Agent: Refines content based on expert instructions.
     * Used in Co-Creation Studio for adjustments.
     */
    async refineContent(
        originalContent: string,
        expertInstructions: string,
        options?: {
            preserveStructure?: boolean;
            maxTokens?: number;
            temperature?: number;
        },
    ): Promise<string> {
        await this.ensureInitialized();
        this.logger.log(`✏️ [EDITOR] Refining content (${originalContent.length} chars)`);

        const systemPrompt = this.getSystemPrompt('EDITOR');
        const userPrompt = `
CONTENU ORIGINAL:
---
${originalContent}
---

INSTRUCTIONS DE L'EXPERT:
${expertInstructions}

${options?.preserveStructure ? 'IMPORTANT: Préserve la structure et le formatage existants.' : ''}

Génère le contenu affiné:
`.trim();

        // Use text/plain model for EDITOR since we want raw refined text
        const editorModel = this.genAI!.getGenerativeModel({
            model: this.HEAVY_MODEL,
            generationConfig: {
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens ?? 8192,
            },
        });

        const result = await this.executeWithRetry(
            'EDITOR',
            async () => {
                const response = await editorModel.generateContent({
                    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
                });
                return response.response;
            },
            60000, // 60 second timeout
        );

        const refined = result.text()?.trim();
        if (!refined) {
            throw new Error('[EDITOR] Empty response from model');
        }

        this.logger.log(`✅ [EDITOR] Content refined: ${refined.length} chars`);
        return refined;
    }

    // =========================================================================
    // AGENT: CONFIDANT - Chat Companion
    // =========================================================================

    /**
     * CONFIDANT Agent: Real-time conversational companion.
     * Uses flash model for speed, enriched with Akashic context.
     */
    async chatWithUser(
        userMessage: string,
        context: ChatContext,
        conversationHistory: ChatMessage[] = [],
    ): Promise<string> {
        await this.ensureInitialized();
        this.logger.log(`💬 [CONFIDANT] Chat for user ${context.userId.substring(0, 8)}...`);

        const systemPrompt = this.buildConfidantSystemPrompt(context);
        
        // Build conversation contents
        const contents: Content[] = [];
        
        // Add conversation history (last 10 messages for context window)
        const recentHistory = conversationHistory.slice(-10);
        for (const msg of recentHistory) {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }],
            });
        }
        
        // Add current message with system context
        const fullUserMessage = contents.length === 0 
            ? `${systemPrompt}\n\n---\n\nUSER:\n${userMessage}`
            : userMessage;
        
        contents.push({
            role: 'user',
            parts: [{ text: fullUserMessage }],
        });

        const result = await this.executeWithRetry(
            'CONFIDANT',
            async () => {
                const response = await this.flashModel!.generateContent({
                    contents,
                });
                return response.response;
            },
            30000, // 30 second timeout for chat
        );

        const reply = result.text()?.trim();
        if (!reply) {
            throw new Error('[CONFIDANT] Empty response from model');
        }

        this.logger.log(`✅ [CONFIDANT] Reply generated: ${reply.length} chars`);
        return reply;
    }

    // =========================================================================
    // LEGACY COMPATIBILITY METHOD
    // =========================================================================

    /**
     * Legacy method for backward compatibility.
     * Orchestrates SCRIBE + GUIDE to produce complete OracleResponse.
     */
    async generateFullReading(
        userProfile: UserProfile,
        orderContext: OrderContext,
    ): Promise<OracleResponse> {
        this.logger.log(`🔮 Generating full reading (SCRIBE + GUIDE) for ${orderContext.orderNumber}`);

        // Step 1: SCRIBE generates PDF content and synthesis
        const { pdf_content, synthesis } = await this.generateCoreReading(userProfile, orderContext);

        // Step 2: GUIDE generates timeline based on synthesis
        const timeline = await this.generateTimeline(userProfile, synthesis);

        this.logger.log(`✅ Full reading complete for ${userProfile.firstName}`);
        
        return {
            pdf_content,
            synthesis,
            timeline,
        };
    }

    /**
     * Legacy refineText method for backward compatibility.
     */
    async refineText(
        userPrompt: string,
        options?: {
            systemPrompt?: string;
            maxTokens?: number;
            temperature?: number;
        },
    ): Promise<string> {
        return this.refineContent(
            userPrompt,
            options?.systemPrompt || 'Affine ce contenu en préservant le ton spirituel Lumira.',
            {
                maxTokens: options?.maxTokens,
                temperature: options?.temperature,
            },
        );
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Executes an AI call with retry logic and timeout.
     */
    private async executeWithRetry<T>(
        agent: AgentType,
        operation: () => Promise<T>,
        timeoutMs: number,
        maxRetries: number = 2,
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.log(`🔄 [${agent}] Attempt ${attempt}/${maxRetries}...`);
                const startTime = Date.now();

                // Race between operation and timeout
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error(`[${agent}] Timeout after ${timeoutMs}ms`)), timeoutMs);
                });

                const result = await Promise.race([operation(), timeoutPromise]);
                const elapsed = Date.now() - startTime;
                
                this.logger.log(`⏱️ [${agent}] Response in ${elapsed}ms`);
                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.logger.error(`❌ [${agent}] Attempt ${attempt} failed: ${lastError.message}`);

                if (attempt < maxRetries) {
                    const delay = attempt * 2000; // Exponential backoff
                    this.logger.log(`⏳ [${agent}] Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error(`[${agent}] All attempts failed`);
    }

    /**
     * Builds the user prompt for SCRIBE agent.
     */
    private buildScribePrompt(profile: UserProfile, order: OrderContext): string {
        const parts: string[] = [
            `LECTURE SPIRITUELLE POUR: ${profile.firstName} ${profile.lastName}`,
            `Commande: ${order.orderNumber} | Niveau: ${order.productName}`,
            '',
            '=== DONNÉES NATALES ===',
            `Date de naissance: ${profile.birthDate}`,
        ];

        if (profile.birthTime) parts.push(`Heure de naissance: ${profile.birthTime}`);
        if (profile.birthPlace) parts.push(`Lieu de naissance: ${profile.birthPlace}`);

        if (profile.specificQuestion) {
            parts.push('', '=== QUESTION SPÉCIFIQUE ===', profile.specificQuestion);
        }

        if (profile.objective) {
            parts.push('', '=== OBJECTIF ===', profile.objective);
        }

        if (profile.highs) parts.push('', '=== MOMENTS DE GRÂCE ===', profile.highs);
        if (profile.lows) parts.push('', '=== DÉFIS / ÉPREUVES ===', profile.lows);
        if (profile.strongSide) parts.push('', '=== TALENTS / LUMIÈRE ===', profile.strongSide);
        if (profile.weakSide) parts.push('', '=== OMBRE / BLOCAGES ===', profile.weakSide);
        if (profile.strongZone) parts.push('', '=== ZONE CORPORELLE FORTE ===', profile.strongZone);
        if (profile.weakZone) parts.push('', '=== ZONE CORPORELLE FAIBLE ===', profile.weakZone);
        if (profile.ailments) parts.push('', '=== MAUX PHYSIQUES ===', profile.ailments);
        if (profile.fears) parts.push('', '=== PEURS ===', profile.fears);
        if (profile.rituals) parts.push('', '=== RITUELS ACTUELS ===', profile.rituals);
        if (profile.deliveryStyle) parts.push('', '=== STYLE PRÉFÉRÉ ===', profile.deliveryStyle);
        if (profile.pace !== undefined) parts.push('', '=== RYTHME ===', `${profile.pace}/100`);

        if (profile.facePhotoUrl || profile.palmPhotoUrl) {
            parts.push('', '=== PHOTOS FOURNIES ===');
            if (profile.facePhotoUrl) parts.push('- Photo visage (physiognomonie)');
            if (profile.palmPhotoUrl) parts.push('- Photo paume (chiromancie)');
        }

        if (order.expertPrompt) {
            parts.push('', '=== INSTRUCTIONS EXPERT ===', order.expertPrompt);
        }

        parts.push('', 'Génère la lecture spirituelle complète au format JSON spécifié.');

        return parts.join('\n');
    }

    /**
     * Builds the user prompt for GUIDE agent.
     */
    private buildGuidePrompt(profile: UserProfile, synthesis: ReadingSynthesis): string {
        return `
CRÉATION DU PARCOURS 7 JOURS

UTILISATEUR: ${profile.firstName} ${profile.lastName}
ARCHÉTYPE: ${synthesis.archetype}
BLOCAGE PRINCIPAL: ${synthesis.key_blockage}
ÉTAT ÉMOTIONNEL: ${synthesis.emotional_state}
MOTS-CLÉS: ${synthesis.keywords.join(', ')}

${profile.specificQuestion ? `QUESTION: ${profile.specificQuestion}` : ''}
${profile.objective ? `OBJECTIF: ${profile.objective}` : ''}

Crée un parcours progressif de 7 jours adapté à cet archétype et ce blocage.
Chaque jour doit faire avancer vers la transformation du blocage principal.

Génère le timeline au format JSON spécifié.
`.trim();
    }

    /**
     * Builds the enriched system prompt for CONFIDANT with Akashic context.
     */
    private buildConfidantSystemPrompt(context: ChatContext): string {
        let enrichedPrompt = this.getSystemPrompt('CONFIDANT');

        // Add archetype context
        if (context.archetype) {
            enrichedPrompt += `\n\nARCHÉTYPE DE L'UTILISATEUR: ${context.archetype}`;
        }

        // Add Akashic domains summary
        if (context.akashicDomains) {
            enrichedPrompt += '\n\nANNALES AKASHIQUES (résumé par domaine):';
            for (const [domain, data] of Object.entries(context.akashicDomains)) {
                if (data?.summary) {
                    enrichedPrompt += `\n- ${domain.toUpperCase()}: ${data.summary}`;
                }
            }
        }

        // Add recent history
        if (context.recentHistory && context.recentHistory.length > 0) {
            enrichedPrompt += '\n\nHISTORIQUE RÉCENT:';
            for (const entry of context.recentHistory.slice(-5)) {
                enrichedPrompt += `\n- ${entry.date}: ${entry.topic} (${entry.sentiment})`;
            }
        }

        return enrichedPrompt;
    }

    /**
     * Fetches an image from URL and converts to base64.
     */
    private async fetchImageAsBase64(url: string): Promise<string> {
        this.logger.log(`📷 Fetching image: ${url.substring(0, 50)}...`);
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
        });
        const size = Buffer.from(response.data).length;
        this.logger.log(`📷 Image fetched: ${Math.round(size / 1024)}KB`);
        return Buffer.from(response.data).toString('base64');
    }

    /**
     * Generates a daily mantra (simplified version for quick calls).
     */
    async generateDailyMantra(params: {
        userId: string;
        archetype: string;
        currentDayNumber: number;
    }): Promise<string> {
        await this.ensureInitialized();
        
        const prompt = `
Tu es Oracle Lumira. Génère un mantra court et puissant pour le jour ${params.currentDayNumber}.
Archétype: ${params.archetype}

Le mantra doit:
- 1-2 phrases maximum
- En français
- Inspirant et personnel à l'archétype

Réponds uniquement avec le mantra, sans guillemets.
`.trim();

        try {
            const result = await this.flashModel!.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });

            return result.response.text()?.trim()
                || 'Je suis lumière, je suis guidance, je suis en paix.';
        } catch (error) {
            this.logger.error(`Failed to generate mantra: ${error}`);
            return 'Je suis lumière, je suis guidance, je suis en paix.';
        }
    }
}
