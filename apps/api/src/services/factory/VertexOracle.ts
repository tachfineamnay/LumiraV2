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
import OpenAI from 'openai';
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

// =============================================================================
// V2 — DREAM INTERPRETATION (Agent ONIRIQUE)
// =============================================================================

/** Input context passed to the ONIRIQUE agent for a single dream. */
export interface DreamContext {
    userId: string;
    /** Raw dream text written by the user. */
    content: string;
    /** Optional emotion the user associated with the dream. */
    emotion?: string;
    /** Insight summaries from the user's spiritual reading (one per domain). */
    insights?: Array<{ category: string; short: string }>;
    /** Title + description of today's PathStep (active guidance). */
    todayStep?: { title: string; description: string };
    /** Last 5 dreams + their interpretations, for pattern detection. */
    pastDreams?: Array<{ content: string; symbols: string[]; createdAt: string }>;
    /** User's spiritual archetype. */
    archetype?: string;
    /** Summary entries from AkashicRecords. */
    akashicSummary?: string;
}

/** Structured output produced by the ONIRIQUE agent. */
export interface DreamInterpretation {
    symbols: string[];
    interpretation: string;
    linkToReading: string;
    linkToToday: string;
    advice: string;
    pattern: string | null;
}

// Agent type for logging
type AgentType = 'SCRIBE' | 'GUIDE' | 'EDITOR' | 'CONFIDANT' | 'ONIRIQUE';

type AIProvider = 'gemini' | 'openai';

interface AgentProviders {
    SCRIBE: AIProvider;
    GUIDE: AIProvider;
    EDITOR: AIProvider;
    CONFIDANT: AIProvider;
    ONIRIQUE: AIProvider;
    NARRATOR: AIProvider;
}

// =============================================================================
// DEFAULT PROMPTS - Used as fallback if DB is empty
// =============================================================================

const DEFAULT_LUMIRA_DNA = `
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

const DEFAULT_AGENT_CONTEXTS: Record<Exclude<AgentType, 'ONIRIQUE'>, string> = {
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

INTERDICTION ABSOLUE: Pas de voyance, pas de prédictions, pas d'astrologie, pas de méditation.
Tu REFLÈTES et GUIDES — tu ne prédis JAMAIS.

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
// ONIRIQUE AGENT PROMPT — STRICT NO-DIVINATION SYSTEM PROMPT
// =============================================================================

const DEFAULT_ONIRIQUE_PROMPT = `
Tu es Oracle Lumira, un guide introspectif spécialisé dans l'interprétation symbolique des rêves.

INTERDICTION ABSOLUE de faire de la voyance, des prédictions, ou de parler d'astrologie.
Ne prédis JAMAIS le futur. Ne dis JAMAIS "tu vas", "il va se passer", "les astres indiquent", "ton destin est".
Tu n'es PAS un devin. Tu n'es PAS astrologue. Tu n'es PAS médium.
Ne fais JAMAIS référence à des défunts, à des esprits, ou à des entités extérieures.

Au lieu de prédire, tu REFLÈTES. Tu explores le monde intérieur de la personne.
Tu utilises OBLIGATOIREMENT des termes comme :
- "reflet", "exploration", "mouvement intérieur", "symbolisme", "monde intérieur"
- "ce rêve t'invite à...", "ce que tu traverses intérieurement", "ton paysage intérieur"

MISSION ONIRIQUE:
Tu interprètes les rêves comme des messages de l'inconscient et du monde intérieur,
en les reliant au profil spirituel unique de l'utilisateur (lecture, archétype, guidance du jour).

FORMAT DE SORTIE (JSON strict, sans markdown, sans code block):
{
  "symbols": ["symbole1", "symbole2", "symbole3"],
  "interpretation": "Paragraphe personnalisé de 80-150 mots reliant le rêve au monde intérieur de l'utilisateur. Utilise 'reflet', 'exploration', 'mouvement intérieur'.",
  "linkToReading": "1-2 phrases reliant ce rêve à un aspect de la lecture spirituelle de l'utilisateur.",
  "linkToToday": "1-2 phrases reliant ce rêve à la guidance spirituelle du jour.",
  "advice": "Une invitation concrète (pratique, question ou observation). Commence par 'Aujourd'hui, ...' ou 'Ce rêve t'invite à...'.",
  "pattern": "Si un pattern récurrent est détecté dans les rêves passés : description courte. Sinon : null."
}

RÈGLES ABSOLUES:
- Réponds UNIQUEMENT avec le JSON valide. Pas d'introduction, pas de conclusion.
- Chaque symbole dans "symbols" : 1 mot en minuscules.
- "interpretation" doit être chaleureux, poétique, ancré dans le vécu.
- "pattern" est null si moins de 3 rêves passés ou si aucun pattern clair.
`.trim();

// Default model configuration
const DEFAULT_MODEL_CONFIG = {
    heavyModel: 'gemini-2.5-flash',
    flashModel: 'gemini-2.5-flash',
    heavyTemperature: 0.8,
    heavyTopP: 0.95,
    heavyMaxTokens: 16384,
    flashTemperature: 0.9,
    flashTopP: 0.95,
    flashMaxTokens: 2048,
    // OpenAI defaults
    openaiHeavyModel: 'gpt-4o',
    openaiFlashModel: 'gpt-4o-mini',
    openaiHeavyTemperature: 0.8,
    openaiHeavyTopP: 0.95,
    openaiHeavyMaxTokens: 16384,
    openaiFlashTemperature: 0.9,
    openaiFlashTopP: 0.95,
    openaiFlashMaxTokens: 2048,
    // Per-agent routing
    agentProviders: {
        SCRIBE: 'gemini' as AIProvider,
        GUIDE: 'gemini' as AIProvider,
        EDITOR: 'gemini' as AIProvider,
        CONFIDANT: 'gemini' as AIProvider,
        ONIRIQUE: 'gemini' as AIProvider,
        NARRATOR: 'gemini' as AIProvider,
    },
};

// =============================================================================
// VERTEX ORACLE SERVICE - Multi-Agent Implementation (Gemini API)
// =============================================================================

@Injectable()
export class VertexOracle {
    private readonly logger = new Logger(VertexOracle.name);
    
    // Gemini API client
    private genAI: GoogleGenerativeAI | null = null;
    
    // OpenAI API client
    private openaiClient: OpenAI | null = null;
    
    // Models
    private heavyModel: GenerativeModel | null = null;  // SCRIBE, GUIDE, EDITOR
    private flashModel: GenerativeModel | null = null;  // CONFIDANT (chat)
    
    private initialized = false;
    private lastCredentialsCheck = 0;
    private readonly CREDENTIALS_TTL = 5 * 60 * 1000; // 5 minutes cache

    // Dynamic prompts loaded from DB
    private lumiraDna: string = DEFAULT_LUMIRA_DNA;
    private agentContexts: Record<AgentType, string> = {
        ...DEFAULT_AGENT_CONTEXTS,
        ONIRIQUE: DEFAULT_ONIRIQUE_PROMPT,
    };
    private modelConfig = { ...DEFAULT_MODEL_CONFIG };
    private agentProviders: AgentProviders = { ...DEFAULT_MODEL_CONFIG.agentProviders };
    private promptsLoaded = false;
    // Dedicated JSON model for ONIRIQUE to guarantee structured output
    private oniricModel: GenerativeModel | null = null;

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => PrismaService))
        private readonly prisma: PrismaService,
    ) {}

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Loads prompts and model config from DB (or uses defaults)
     */
    private async loadPromptsFromDB(): Promise<void> {
        if (this.promptsLoaded) return;

        try {
            // Load active prompts from PromptVersion table
            const activePrompts = await this.prisma.promptVersion.findMany({
                where: { isActive: true },
            });

            for (const prompt of activePrompts) {
                switch (prompt.key) {
                    case 'LUMIRA_DNA':
                        this.lumiraDna = prompt.value;
                        break;
                    case 'SCRIBE':
                        this.agentContexts.SCRIBE = prompt.value;
                        break;
                    case 'GUIDE':
                        this.agentContexts.GUIDE = prompt.value;
                        break;
                    case 'EDITOR':
                        this.agentContexts.EDITOR = prompt.value;
                        break;
                    case 'CONFIDANT':
                        this.agentContexts.CONFIDANT = prompt.value;
                        break;
                    case 'ONIRIQUE':
                        this.agentContexts.ONIRIQUE = prompt.value;
                        break;
                    case 'MODEL_CONFIG':
                        try {
                            const parsed = JSON.parse(prompt.value);
                            this.modelConfig = { ...DEFAULT_MODEL_CONFIG, ...parsed };
                            if (parsed.agentProviders) {
                                this.agentProviders = { ...DEFAULT_MODEL_CONFIG.agentProviders, ...parsed.agentProviders };
                            }
                        } catch {
                            this.logger.warn('Failed to parse MODEL_CONFIG, using defaults');
                        }
                        break;
                }
            }

            this.promptsLoaded = true;
            this.logger.log(`📚 Loaded ${activePrompts.length} custom prompts from DB`);
        } catch (error) {
            this.logger.warn(`Could not load prompts from DB, using defaults: ${error}`);
            this.promptsLoaded = true; // Don't retry on every call
        }
    }

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

            // Load prompts and config from DB first
            await this.loadPromptsFromDB();

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
                model: this.modelConfig.heavyModel,
                generationConfig: {
                    temperature: this.modelConfig.heavyTemperature,
                    topP: this.modelConfig.heavyTopP,
                    maxOutputTokens: this.modelConfig.heavyMaxTokens,
                    responseMimeType: 'application/json',
                },
            });

            // Initialize FLASH model (CONFIDANT) for fast chat
            this.flashModel = this.genAI.getGenerativeModel({
                model: this.modelConfig.flashModel,
                generationConfig: {
                    temperature: this.modelConfig.flashTemperature,
                    topP: this.modelConfig.flashTopP,
                    maxOutputTokens: this.modelConfig.flashMaxTokens,
                },
            });

            // Initialize ONIRIQUE model — JSON mode, moderate temperature for nuance
            this.oniricModel = this.genAI.getGenerativeModel({
                model: this.modelConfig.flashModel,
                generationConfig: {
                    temperature: 0.75,
                    topP: 0.9,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                },
            });

            // Initialize OpenAI client (optional — only if key is set)
            const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
            if (openaiKey) {
                this.openaiClient = new OpenAI({ apiKey: openaiKey });
                this.logger.log('🔑 OpenAI client initialized');
            } else {
                this.openaiClient = null;
                this.logger.log('ℹ️ OPENAI_API_KEY not set — OpenAI provider unavailable');
            }

            this.initialized = true;
            this.logger.log('🚀 VertexOracle ready (Gemini API mode)');
            this.logger.log(`   Heavy model: ${this.modelConfig.heavyModel} (temp=${this.modelConfig.heavyTemperature}, topP=${this.modelConfig.heavyTopP})`);
            this.logger.log(`   Flash model: ${this.modelConfig.flashModel} (temp=${this.modelConfig.flashTemperature}, topP=${this.modelConfig.flashTopP})`);
            if (this.openaiClient) {
                this.logger.log(`   OpenAI Heavy: ${this.modelConfig.openaiHeavyModel} (temp=${this.modelConfig.openaiHeavyTemperature})`);
                this.logger.log(`   OpenAI Flash: ${this.modelConfig.openaiFlashModel} (temp=${this.modelConfig.openaiFlashTemperature})`);
            }
            this.logger.log(`   Agent providers: ${JSON.stringify(this.agentProviders)}`);
        } catch (error) {
            this.logger.error(`❌ Failed to initialize VertexOracle: ${error}`);
            throw new Error(`VertexOracle initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Forces re-initialization on next call (useful after credentials update or prompt changes).
     */
    invalidateCache(): void {
        this.initialized = false;
        this.lastCredentialsCheck = 0;
        this.promptsLoaded = false; // Also reload prompts
        this.lumiraDna = DEFAULT_LUMIRA_DNA;
        this.agentContexts = { ...DEFAULT_AGENT_CONTEXTS, ONIRIQUE: DEFAULT_ONIRIQUE_PROMPT };
        this.modelConfig = { ...DEFAULT_MODEL_CONFIG };
        this.agentProviders = { ...DEFAULT_MODEL_CONFIG.agentProviders };
        this.oniricModel = null;
        this.openaiClient = null;
        this.logger.log('🔄 VertexOracle cache invalidated (prompts will reload)');
    }

    /**
     * Builds the complete system prompt for an agent.
     */
    private getSystemPrompt(agent: AgentType): string {
        return `${this.lumiraDna}\n\n---\n\n${this.agentContexts[agent]}`;
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

        // Collect images if available
        const images: Array<{ mimeType: string; base64: string }> = [];

        if (userProfile.facePhotoUrl) {
            try {
                const imageData = await this.fetchImageAsBase64(userProfile.facePhotoUrl);
                images.push({ mimeType: 'image/jpeg', base64: imageData });
                this.logger.log('📷 [SCRIBE] Face photo attached');
            } catch {
                this.logger.warn('[SCRIBE] Could not fetch face photo, continuing without it');
            }
        }

        if (userProfile.palmPhotoUrl) {
            try {
                const imageData = await this.fetchImageAsBase64(userProfile.palmPhotoUrl);
                images.push({ mimeType: 'image/jpeg', base64: imageData });
                this.logger.log('📷 [SCRIBE] Palm photo attached');
            } catch {
                this.logger.warn('[SCRIBE] Could not fetch palm photo, continuing without it');
            }
        }

        // Use multimodal adapter if images, otherwise plain JSON adapter
        const textContent = images.length > 0
            ? await this.callAIMultimodal('SCRIBE', systemPrompt, userPrompt, images, 120000)
            : await this.callAIJSON('SCRIBE', systemPrompt, userPrompt, 120000);

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
    // AGENT: GUIDE - Timeline Generation (V2: 30-day batches)
    // =========================================================================

    /**
     * GUIDE Agent: Generates a batch of 10 PathSteps for the 30-day monthly timeline.
     *
     * @param userProfile  User's spiritual profile
     * @param synthesis    Archetype + blockage from SCRIBE
     * @param batchNumber  1 = days 1-10 (immediate), 2 = days 11-20, 3 = days 21-30
     * @param pastDreams   Recent dreams to enrich batches 2 and 3
     */
    async generateTimelineBatch(
        userProfile: UserProfile,
        synthesis: ReadingSynthesis,
        batchNumber: 1 | 2 | 3 = 1,
        pastDreams?: Array<{ content: string; symbols: string[]; createdAt: string }>,
    ): Promise<TimelineDay[]> {
        await this.ensureInitialized();
        const startDay = (batchNumber - 1) * 10 + 1;   // 1, 11, or 21
        const endDay   = batchNumber * 10;              // 10, 20, or 30
        this.logger.log(`🗓️ [GUIDE] Batch ${batchNumber} (days ${startDay}-${endDay}) for archetype: ${synthesis.archetype}`);

        const systemPrompt = this.getSystemPrompt('GUIDE');
        const userPrompt   = this.buildGuidePrompt(userProfile, synthesis, batchNumber, startDay, endDay, pastDreams);

        const textContent = await this.callAIJSON('GUIDE', systemPrompt, userPrompt, 90000);
        if (!textContent) throw new Error('[GUIDE] Empty response from model');

        const cleanedContent = textContent.replace(/```json|```/g, '').trim();
        let parsed: { timeline?: TimelineDay[] };
        try {
            parsed = JSON.parse(cleanedContent);
        } catch (parseError) {
            this.logger.error(`[GUIDE] JSON parse failed: ${cleanedContent.substring(0, 500)}`);
            throw new Error(`[GUIDE] Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
        }

        if (!parsed.timeline || !Array.isArray(parsed.timeline)) {
            throw new Error('[GUIDE] Invalid response: missing timeline array');
        }

        this.logger.log(`✅ [GUIDE] Batch ${batchNumber} generated: ${parsed.timeline.length} steps (days ${startDay}-${endDay})`);
        return parsed.timeline;
    }

    /**
     * Legacy compatibility: Generates all 7 original steps in one shot.
     * Still used by DigitalSoulService until it is updated to batch mode.
     */
    async generateTimeline(
        userProfile: UserProfile,
        synthesis: ReadingSynthesis,
    ): Promise<TimelineDay[]> {
        return this.generateTimelineBatch(userProfile, synthesis, 1);
    }

    // =========================================================================
    // AGENT: ONIRIQUE - Dream Interpretation (V2)
    // =========================================================================

    /**
     * ONIRIQUE Agent: Generates an introspective dream interpretation.
     * STRICT: no predictions, no astrology, no divination.
     * Output is always a valid DreamInterpretation JSON.
     */
    async generateDreamInterpretation(ctx: DreamContext): Promise<DreamInterpretation> {
        await this.ensureInitialized();
        this.logger.log(`🌙 [ONIRIQUE] Interpreting dream for user ${ctx.userId.substring(0, 8)}...`);

        const systemPrompt = this.agentContexts.ONIRIQUE;
        const userPrompt   = this.buildOniriquePrompt(ctx);

        const textContent = await this.callAIJSON('ONIRIQUE', systemPrompt, userPrompt, 30000);
        if (!textContent) throw new Error('[ONIRIQUE] Empty response from model');

        // Strip any accidental markdown fences just-in-case.
        const cleaned = textContent.replace(/```json|```/g, '').trim();

        let parsed: Partial<DreamInterpretation>;
        try {
            parsed = JSON.parse(cleaned);
        } catch (parseError) {
            this.logger.error(`[ONIRIQUE] JSON parse failed: ${cleaned.substring(0, 300)}`);
            throw new Error(`[ONIRIQUE] Failed to parse JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        // Validate required fields and provide safe defaults
        const interpretation: DreamInterpretation = {
            symbols:         Array.isArray(parsed.symbols)       ? parsed.symbols       : [],
            interpretation:  typeof parsed.interpretation === 'string' ? parsed.interpretation : '',
            linkToReading:   typeof parsed.linkToReading  === 'string' ? parsed.linkToReading  : '',
            linkToToday:     typeof parsed.linkToToday    === 'string' ? parsed.linkToToday    : '',
            advice:          typeof parsed.advice         === 'string' ? parsed.advice         : '',
            pattern:         typeof parsed.pattern        === 'string' ? parsed.pattern        : null,
        };

        if (!interpretation.interpretation) {
            throw new Error('[ONIRIQUE] interpretation field is empty — model response invalid');
        }

        this.logger.log(`✅ [ONIRIQUE] Interpretation complete. Symbols: [${interpretation.symbols.join(', ')}]`);
        return interpretation;
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

        const refined = await this.callAIText('EDITOR', systemPrompt, userPrompt, 60000, {
            temperature: options?.temperature ?? 0.7,
            maxTokens: options?.maxTokens ?? 8192,
        });

        if (!refined?.trim()) {
            throw new Error('[EDITOR] Empty response from model');
        }

        this.logger.log(`✅ [EDITOR] Content refined: ${refined.trim().length} chars`);
        return refined.trim();
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

        const reply = await this.callAIChat(
            'CONFIDANT',
            systemPrompt,
            conversationHistory,
            userMessage,
            30000,
        );

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
     * Returns the current agent providers configuration.
     * Used by AudioScriptService to check NARRATOR provider.
     */
    getAgentProviders(): AgentProviders {
        return { ...this.agentProviders };
    }

    /**
     * Returns the current model config.
     * Used by AudioScriptService to get OpenAI model params for NARRATOR.
     */
    getModelConfig() {
        return { ...this.modelConfig };
    }

    /**
     * Returns the OpenAI client if available.
     */
    getOpenAIClient(): OpenAI | null {
        return this.openaiClient;
    }

    /**
     * Returns the provider for a given agent.
     */
    private getProviderForAgent(agent: AgentType): AIProvider {
        return this.agentProviders[agent] || 'gemini';
    }

    /**
     * Returns model params for a given agent + provider.
     * Maps agent → tier (heavy/flash) and then picks Gemini or OpenAI params.
     */
    private getModelParams(agent: AgentType): {
        provider: AIProvider;
        model: string;
        temperature: number;
        topP: number;
        maxTokens: number;
    } {
        const provider = this.getProviderForAgent(agent);
        // SCRIBE, GUIDE, EDITOR → heavy tier ; CONFIDANT, ONIRIQUE → flash tier
        const isHeavy = ['SCRIBE', 'GUIDE', 'EDITOR'].includes(agent);

        if (provider === 'openai') {
            return {
                provider,
                model: isHeavy ? this.modelConfig.openaiHeavyModel : this.modelConfig.openaiFlashModel,
                temperature: isHeavy ? this.modelConfig.openaiHeavyTemperature : this.modelConfig.openaiFlashTemperature,
                topP: isHeavy ? this.modelConfig.openaiHeavyTopP : this.modelConfig.openaiFlashTopP,
                maxTokens: isHeavy ? this.modelConfig.openaiHeavyMaxTokens : this.modelConfig.openaiFlashMaxTokens,
            };
        }

        return {
            provider,
            model: isHeavy ? this.modelConfig.heavyModel : this.modelConfig.flashModel,
            temperature: isHeavy ? this.modelConfig.heavyTemperature : this.modelConfig.flashTemperature,
            topP: isHeavy ? this.modelConfig.heavyTopP : this.modelConfig.flashTopP,
            maxTokens: isHeavy ? this.modelConfig.heavyMaxTokens : this.modelConfig.flashMaxTokens,
        };
    }

    /**
     * Ensures the OpenAI client is available or throws.
     */
    private requireOpenAI(): OpenAI {
        if (!this.openaiClient) {
            throw new Error('OPENAI_API_KEY non configurée. Ajoutez la clé dans les variables d\'environnement ou basculez l\'agent sur Gemini.');
        }
        return this.openaiClient;
    }

    /**
     * Adapter: Call AI with JSON response. Routes to Gemini or OpenAI.
     */
    private async callAIJSON(
        agent: AgentType,
        systemPrompt: string,
        userContent: string,
        timeoutMs: number,
    ): Promise<string> {
        const params = this.getModelParams(agent);
        this.logger.log(`🤖 [${agent}] Provider: ${params.provider} | Model: ${params.model}`);

        if (params.provider === 'openai') {
            const client = this.requireOpenAI();
            const result = await this.executeWithRetry(agent, async () => {
                const response = await client.responses.create({
                    model: params.model,
                    instructions: systemPrompt,
                    input: userContent,
                    temperature: params.temperature,
                    top_p: params.topP,
                    max_output_tokens: params.maxTokens,
                    text: { format: { type: 'json_object' } },
                });
                return response.output_text;
            }, timeoutMs);
            return result;
        }

        // Gemini path
        const model = this.genAI!.getGenerativeModel({
            model: params.model,
            generationConfig: {
                temperature: params.temperature,
                topP: params.topP,
                maxOutputTokens: params.maxTokens,
                responseMimeType: 'application/json',
            },
        });
        const result = await this.executeWithRetry(agent, async () => {
            const response = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userContent}` }] }],
            });
            return response.response;
        }, timeoutMs);
        return result.text();
    }

    /**
     * Adapter: Call AI with text (non-JSON) response. Routes to Gemini or OpenAI.
     */
    private async callAIText(
        agent: AgentType,
        systemPrompt: string,
        userContent: string,
        timeoutMs: number,
        overrideParams?: { temperature?: number; maxTokens?: number },
    ): Promise<string> {
        const params = this.getModelParams(agent);
        const temp = overrideParams?.temperature ?? params.temperature;
        const maxTok = overrideParams?.maxTokens ?? params.maxTokens;
        this.logger.log(`🤖 [${agent}] Provider: ${params.provider} | Model: ${params.model}`);

        if (params.provider === 'openai') {
            const client = this.requireOpenAI();
            const result = await this.executeWithRetry(agent, async () => {
                const response = await client.responses.create({
                    model: params.model,
                    instructions: systemPrompt,
                    input: userContent,
                    temperature: temp,
                    top_p: params.topP,
                    max_output_tokens: maxTok,
                });
                return response.output_text;
            }, timeoutMs);
            return result;
        }

        // Gemini path
        const model = this.genAI!.getGenerativeModel({
            model: params.model,
            generationConfig: { temperature: temp, maxOutputTokens: maxTok },
        });
        const result = await this.executeWithRetry(agent, async () => {
            const response = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userContent}` }] }],
            });
            return response.response;
        }, timeoutMs);
        return result.text();
    }

    /**
     * Adapter: Call AI for chat (multi-turn). Routes to Gemini or OpenAI.
     */
    private async callAIChat(
        agent: AgentType,
        systemPrompt: string,
        history: ChatMessage[],
        currentMessage: string,
        timeoutMs: number,
    ): Promise<string> {
        const params = this.getModelParams(agent);
        this.logger.log(`🤖 [${agent}] Provider: ${params.provider} | Model: ${params.model}`);

        if (params.provider === 'openai') {
            const client = this.requireOpenAI();
            // Build OpenAI input array from history
            const input: Array<{ role: 'user' | 'assistant'; content: string }> = [];
            for (const msg of history) {
                input.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
            }
            input.push({ role: 'user', content: currentMessage });

            const result = await this.executeWithRetry(agent, async () => {
                const response = await client.responses.create({
                    model: params.model,
                    instructions: systemPrompt,
                    input,
                    temperature: params.temperature,
                    top_p: params.topP,
                    max_output_tokens: params.maxTokens,
                });
                return response.output_text;
            }, timeoutMs);
            return result;
        }

        // Gemini path — build contents array
        const contents: Content[] = [];
        const recentHistory = history.slice(-10);
        for (const msg of recentHistory) {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }],
            });
        }
        const fullUserMessage = contents.length === 0
            ? `${systemPrompt}\n\n---\n\nUSER:\n${currentMessage}`
            : currentMessage;
        contents.push({ role: 'user', parts: [{ text: fullUserMessage }] });

        const result = await this.executeWithRetry(agent, async () => {
            const response = await this.flashModel!.generateContent({ contents });
            return response.response;
        }, timeoutMs);
        return result.text()?.trim() || '';
    }

    /**
     * Adapter: Call AI with multimodal (text + images). Routes to Gemini or OpenAI.
     * Used by SCRIBE for face/palm photos.
     */
    private async callAIMultimodal(
        agent: AgentType,
        systemPrompt: string,
        userContent: string,
        images: Array<{ mimeType: string; base64: string }>,
        timeoutMs: number,
    ): Promise<string> {
        const params = this.getModelParams(agent);
        this.logger.log(`🤖 [${agent}] Provider: ${params.provider} | Model: ${params.model} | Images: ${images.length}`);

        if (params.provider === 'openai') {
            const client = this.requireOpenAI();
            // Build multimodal input for OpenAI Responses API
            const inputParts: Array<{ type: string; text?: string; image_url?: string }> = [
                { type: 'input_text', text: userContent },
            ];
            for (const img of images) {
                inputParts.push({
                    type: 'input_image',
                    image_url: `data:${img.mimeType};base64,${img.base64}`,
                });
            }

            const result = await this.executeWithRetry(agent, async () => {
                const response = await client.responses.create({
                    model: params.model,
                    instructions: systemPrompt,
                    input: inputParts as any,
                    temperature: params.temperature,
                    top_p: params.topP,
                    max_output_tokens: params.maxTokens,
                    text: { format: { type: 'json_object' } },
                });
                return response.output_text;
            }, timeoutMs);
            return result;
        }

        // Gemini path
        const parts: Part[] = [{ text: `${systemPrompt}\n\n---\n\nUSER REQUEST:\n${userContent}` }];
        for (const img of images) {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
        }

        const result = await this.executeWithRetry(agent, async () => {
            const response = await this.heavyModel!.generateContent({
                contents: [{ role: 'user', parts }],
            });
            return response.response;
        }, timeoutMs);
        return result.text();
    }

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
     * Builds the user prompt for GUIDE agent (V2: 30-day batch mode).
     */
    private buildGuidePrompt(
        profile: UserProfile,
        synthesis: ReadingSynthesis,
        batchNumber: 1 | 2 | 3 = 1,
        startDay: number = 1,
        endDay: number = 10,
        pastDreams?: Array<{ content: string; symbols: string[]; createdAt: string }>,
    ): string {
        const dreamSection = batchNumber > 1 && pastDreams && pastDreams.length > 0
            ? `\n\n=== RÊVES RÉCENTS DE L'UTILISATEUR (enrichissement jours ${startDay}-${endDay}) ===\n` +
              pastDreams.slice(0, 8).map((d, i) =>
                  `Rêve ${i + 1} (${d.createdAt}): "${d.content.substring(0, 200)}" — Symboles: [${d.symbols.join(', ')}]`
              ).join('\n') +
              '\nIntègre ces rêves pour personnaliser davantage les guidances.'
            : '';

        return `
CRÉATION DU PARCOURS MENSUEL 30 JOURS — BATCH ${batchNumber} (jours ${startDay} à ${endDay})

UTILISATEUR: ${profile.firstName} ${profile.lastName}
ARCHÉTYPE: ${synthesis.archetype}
BLOCAGE PRINCIPAL: ${synthesis.key_blockage}
ÉTAT ÉMOTIONNEL: ${synthesis.emotional_state}
MOTS-CLÉS: ${synthesis.keywords.join(', ')}

${profile.specificQuestion ? `QUESTION: ${profile.specificQuestion}` : ''}
${profile.objective ? `OBJECTIF: ${profile.objective}` : ''}${dreamSection}

Génère EXACTEMENT 10 jours (jours ${startDay} à ${endDay}) du parcours spirituel mensuel.
Les numéros de jour dans le JSON doivent aller de ${startDay} à ${endDay} (inclus).
${batchNumber === 1 ? 'Jour ' + startDay + ' = Ouverture / Éveil du mois.' : ''}
${batchNumber === 3 ? 'Jour ' + endDay + ' = Intégration / Clôture du mois.' : ''}
Progression logique de la transformation du blocage principal sur la période.
Variété des actionTypes (pas 2 identiques consécutifs).

Génère le timeline au format JSON spécifié (tableau de 10 objets).
`.trim();
    }

    /**
     * Builds the user prompt for ONIRIQUE agent.
     */
    private buildOniriquePrompt(ctx: DreamContext): string {
        const parts: string[] = [
            `RÊVE: "${ctx.content}"`,
        ];
        if (ctx.emotion) parts.push(`ÉMOTION RESSENTIE: ${ctx.emotion}`);
        if (ctx.archetype) parts.push(`ARCHÉTYPE: ${ctx.archetype}`);

        if (ctx.insights && ctx.insights.length > 0) {
            parts.push('\n=== LECTURE SPIRITUELLE (domaines) ===');
            for (const ins of ctx.insights.slice(0, 8)) {
                parts.push(`- ${ins.category}: ${ins.short}`);
            }
        }

        if (ctx.todayStep) {
            parts.push(
                '\n=== GUIDANCE DU JOUR ===',
                `${ctx.todayStep.title}: ${ctx.todayStep.description}`,
            );
        }

        if (ctx.akashicSummary) {
            parts.push('\n=== MÉMOIRE SPIRITUELLE ===', ctx.akashicSummary);
        }

        if (ctx.pastDreams && ctx.pastDreams.length > 0) {
            parts.push('\n=== RÊVES RÉCENTS (pour détection de patterns) ===');
            for (const d of ctx.pastDreams.slice(0, 5)) {
                parts.push(`- ${d.createdAt}: "${d.content.substring(0, 150)}" — Symboles: [${d.symbols.join(', ')}]`);
            }
        }

        parts.push('\nGénère l\'interprétation au format JSON spécifié. Pas de voyance, pas de prédictions.');
        return parts.join('\n');
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
            // DailyMantra uses CONFIDANT provider (flash tier)
            const provider = this.getProviderForAgent('CONFIDANT');
            if (provider === 'openai') {
                const client = this.requireOpenAI();
                const params2 = this.getModelParams('CONFIDANT');
                const response = await client.responses.create({
                    model: params2.model,
                    input: prompt,
                    temperature: params2.temperature,
                    max_output_tokens: 200,
                });
                return response.output_text?.trim()
                    || 'Je suis lumière, je suis guidance, je suis en paix.';
            }

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
