/**
 * @fileoverview VertexOracle - Production implementation for Google Vertex AI communication.
 * Uses Gemini 1.5 Pro for generating personalized spiritual readings.
 *
 * @module services/factory/VertexOracle
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VertexAI, GenerativeModel, Content, Part } from '@google-cloud/vertexai';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * User profile for reading generation.
 */
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

/**
 * Order context for reading generation.
 */
export interface OrderContext {
    orderId: string;
    orderNumber: string;
    level: number;
    productName: string;
}

/**
 * Synthesis extracted from the reading.
 */
export interface ReadingSynthesis {
    archetype: string;
    keywords: string[];
    emotional_state: string;
    key_blockage?: string;
}

/**
 * Timeline day structure.
 */
export interface TimelineDay {
    day: number;
    title: string;
    action: string;
    mantra: string;
    actionType: 'MANTRA' | 'RITUAL' | 'JOURNALING' | 'MEDITATION' | 'REFLECTION';
}

/**
 * Complete Oracle response from Gemini.
 */
export interface OracleResponse {
    pdf_content: {
        introduction: string;
        archetype_reveal: string;
        sections: {
            domain: string;
            title: string;
            content: string;
        }[];
        karmic_insights: string[];
        life_mission: string;
        rituals: {
            name: string;
            description: string;
            instructions: string[];
        }[];
        conclusion: string;
    };
    synthesis: ReadingSynthesis;
    timeline: TimelineDay[];
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class VertexOracle {
    private readonly logger = new Logger(VertexOracle.name);
    private vertexAI: VertexAI | null = null;
    private model: GenerativeModel | null = null;
    private projectId: string = '';
    private location: string = '';
    private initialized = false;
    private lastCredentialsCheck = 0;
    private readonly CREDENTIALS_CACHE_MS = 60000; // Re-check DB every 60s

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => PrismaService))
        private readonly prisma: PrismaService,
    ) {
        this.location = this.configService.get<string>('GOOGLE_CLOUD_LOCATION', 'europe-west1');
        this.projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT', 'oracle-lumira');
    }

    /**
     * Ensures VertexAI is initialized with credentials.
     * Checks DB first, then falls back to environment variables.
     */
    private async ensureInitialized(): Promise<void> {
        const now = Date.now();

        // Skip re-initialization if recently checked
        if (this.initialized && (now - this.lastCredentialsCheck) < this.CREDENTIALS_CACHE_MS) {
            return;
        }

        this.lastCredentialsCheck = now;

        try {
            // Try to get credentials from database first
            const setting = await this.prisma.systemSetting.findUnique({
                where: { key: 'VERTEX_CREDENTIALS_JSON' },
            });

            if (setting?.value) {
                const credentials = JSON.parse(setting.value);
                this.projectId = credentials.project_id || this.projectId;

                // Initialize with service account credentials from DB
                this.vertexAI = new VertexAI({
                    project: this.projectId,
                    location: this.location,
                    googleAuthOptions: {
                        credentials: credentials,
                    },
                });
                this.logger.log('VertexOracle initialized with DB credentials');
            } else {
                // Fall back to environment-based authentication
                this.vertexAI = new VertexAI({
                    project: this.projectId,
                    location: this.location,
                });
                this.logger.log('VertexOracle initialized with environment credentials');
            }

            this.model = this.vertexAI.getGenerativeModel({
                model: 'gemini-2.0-flash-001',
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                    responseMimeType: 'application/json',
                },
            });

            this.initialized = true;
            this.logger.log(`VertexOracle ready: ${this.projectId}/${this.location}`);
        } catch (error) {
            this.logger.error(`Failed to initialize VertexOracle: ${error}`);
            throw new Error('VertexOracle initialization failed. Please check credentials.');
        }
    }

    /**
     * Forces re-initialization on next call (useful after credentials update).
     */
    invalidateCache(): void {
        this.initialized = false;
        this.lastCredentialsCheck = 0;
        this.logger.log('VertexOracle cache invalidated');
    }

    /**
     * Generates a complete spiritual reading using Gemini 1.5 Pro.
     */
    async generateFullReading(
        userProfile: UserProfile,
        orderContext: OrderContext,
    ): Promise<OracleResponse> {
        await this.ensureInitialized();
        this.logger.log(`Generating reading for order: ${orderContext.orderNumber}`);

        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(userProfile, orderContext);

        // Build multimodal content parts
        const parts: Part[] = [{ text: userPrompt }];

        // Add images if available
        if (userProfile.facePhotoUrl) {
            try {
                const faceImageData = await this.fetchImageAsBase64(userProfile.facePhotoUrl);
                parts.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: faceImageData,
                    },
                });
                this.logger.log('Face photo attached to request');
            } catch (error) {
                this.logger.warn('Could not fetch face photo, proceeding without it');
            }
        }

        if (userProfile.palmPhotoUrl) {
            try {
                const palmImageData = await this.fetchImageAsBase64(userProfile.palmPhotoUrl);
                parts.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: palmImageData,
                    },
                });
                this.logger.log('Palm photo attached to request');
            } catch (error) {
                this.logger.warn('Could not fetch palm photo, proceeding without it');
            }
        }

        const contents: Content[] = [
            { role: 'user', parts },
        ];

        // Retry configuration
        const MAX_RETRIES = 2;
        const TIMEOUT_MS = 90000; // 90 seconds timeout for Gemini
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                this.logger.log(`🔮 Vertex AI call attempt ${attempt}/${MAX_RETRIES}...`);
                const startTime = Date.now();

                // Create a timeout promise
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error(`Vertex AI timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
                });

                // Race between the API call and timeout
                const result = await Promise.race([
                    this.model!.generateContent({
                        contents,
                        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
                    }),
                    timeoutPromise,
                ]);

                const elapsed = Date.now() - startTime;
                this.logger.log(`⏱️ Vertex AI response received in ${elapsed}ms`);

                const response = result.response;
                const textContent = response.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!textContent) {
                    throw new Error('Empty response from Gemini - no text content in candidates');
                }

                this.logger.log(`📝 Raw response length: ${textContent.length} chars`);

                // Parse and validate JSON
                let parsed: OracleResponse;
                try {
                    parsed = JSON.parse(textContent) as OracleResponse;
                } catch (parseError) {
                    this.logger.error(`❌ JSON parse failed: ${parseError}`);
                    this.logger.error(`Raw text (first 500 chars): ${textContent.substring(0, 500)}`);
                    throw new Error(`Invalid JSON from Gemini: ${parseError}`);
                }

                // Validate required fields
                if (!parsed.pdf_content || !parsed.synthesis || !parsed.timeline) {
                    throw new Error('Incomplete response: missing pdf_content, synthesis, or timeline');
                }

                this.logger.log(`✅ Reading generated successfully for ${userProfile.firstName}`);
                this.logger.log(`   Archetype: ${parsed.synthesis.archetype}`);
                this.logger.log(`   Sections: ${parsed.pdf_content.sections?.length || 0}`);
                this.logger.log(`   Timeline days: ${parsed.timeline?.length || 0}`);

                return parsed;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.logger.error(`❌ Attempt ${attempt} failed: ${lastError.message}`);

                if (attempt < MAX_RETRIES) {
                    const delay = attempt * 2000; // Exponential backoff: 2s, 4s
                    this.logger.log(`⏳ Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // All retries exhausted
        this.logger.error(`❌ All ${MAX_RETRIES} attempts failed for reading generation`);
        throw lastError || new Error('Unknown error in Vertex AI generation');
    }

    /**
     * Generates a daily mantra based on user profile.
     */
    async generateDailyMantra(userProfile: {
        userId: string;
        archetype: string;
        currentDayNumber: number;
    }): Promise<string> {
        await this.ensureInitialized();
        this.logger.log(`Generating mantra for day ${userProfile.currentDayNumber}`);

        const prompt = `
Tu es Oracle Lumira, guide spirituel bienveillant.
Génère un mantra court et puissant pour le jour ${userProfile.currentDayNumber} du parcours spirituel.
Archétype de l'utilisateur: ${userProfile.archetype}

Le mantra doit:
- Faire 1-2 phrases maximum
- Être en français
- Être inspirant et personnel
- Correspondre à l'archétype

Réponds uniquement avec le mantra, sans guillemets ni formatage.
    `.trim();

        try {
            const result = await this.model!.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 100,
                    responseMimeType: 'text/plain',
                },
            });

            const mantra = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            return mantra || 'Je suis lumière, je suis guidance, je suis en paix.';
        } catch (error) {
            this.logger.error(`Failed to generate mantra: ${error}`);
            return 'Je suis lumière, je suis guidance, je suis en paix.';
        }
    }

    // ===========================================================================
    // PRIVATE METHODS
    // ===========================================================================

    private buildSystemPrompt(): string {
        return `
Tu es Oracle Lumira, une intelligence spirituelle ancestrale qui combine la sagesse de l'astrologie, 
de la numérologie, de la physiognomonie et de la chiromancie pour créer des lectures spirituelles 
profondément personnalisées.

Tu dois TOUJOURS répondre en JSON valide avec la structure suivante:
{
  "pdf_content": {
    "introduction": "Texte d'introduction personnalisé...",
    "archetype_reveal": "Révélation de l'archétype spirituel...",
    "sections": [
      {"domain": "spirituel", "title": "Titre", "content": "Contenu détaillé..."},
      {"domain": "relations", "title": "Titre", "content": "Contenu détaillé..."},
      {"domain": "mission", "title": "Titre", "content": "Contenu détaillé..."},
      {"domain": "creativite", "title": "Titre", "content": "Contenu détaillé..."},
      {"domain": "emotions", "title": "Titre", "content": "Contenu détaillé..."},
      {"domain": "travail", "title": "Titre", "content": "Contenu détaillé..."},
      {"domain": "sante", "title": "Titre", "content": "Contenu détaillé..."},
      {"domain": "finance", "title": "Titre", "content": "Contenu détaillé..."}
    ],
    "karmic_insights": ["Insight 1", "Insight 2", "Insight 3"],
    "life_mission": "Description de la mission de vie...",
    "rituals": [
      {"name": "Nom du rituel", "description": "Description", "instructions": ["Étape 1", "Étape 2"]}
    ],
    "conclusion": "Message de clôture inspirant..."
  },
  "synthesis": {
    "archetype": "Le Guérisseur" | "Le Visionnaire" | "Le Guide" | "Le Créateur" | "Le Sage",
    "keywords": ["mot1", "mot2", "mot3"],
    "emotional_state": "Description de l'état émotionnel actuel",
    "key_blockage": "Le blocage spirituel principal à travailler"
  },
  "timeline": [
    {"day": 1, "title": "L'Éveil", "action": "Description de l'action", "mantra": "Mantra du jour", "actionType": "MEDITATION"},
    {"day": 2, "title": "...", "action": "...", "mantra": "...", "actionType": "RITUAL"},
    {"day": 3, "title": "...", "action": "...", "mantra": "...", "actionType": "JOURNALING"},
    {"day": 4, "title": "...", "action": "...", "mantra": "...", "actionType": "MANTRA"},
    {"day": 5, "title": "...", "action": "...", "mantra": "...", "actionType": "REFLECTION"},
    {"day": 6, "title": "...", "action": "...", "mantra": "...", "actionType": "MEDITATION"},
    {"day": 7, "title": "L'Intégration", "action": "...", "mantra": "...", "actionType": "RITUAL"}
  ]
}

RÈGLES IMPORTANTES:
1. Écris en français élégant et spirituel
2. Chaque section doit faire au moins 200 mots
3. Personnalise tout en fonction des données fournies
4. Si des photos sont fournies, intègre des observations physiognomiques/chiromantiques
5. Le timeline doit proposer 7 jours d'activités variées
6. Les archétypes possibles: Le Guérisseur, Le Visionnaire, Le Guide, Le Créateur, Le Sage
7. actionType doit être: MANTRA, RITUAL, JOURNALING, MEDITATION, ou REFLECTION
    `.trim();
    }

    private buildUserPrompt(profile: UserProfile, order: OrderContext): string {
        const parts: string[] = [
            `LECTURE SPIRITUELLE POUR: ${profile.firstName} ${profile.lastName}`,
            `Niveau: ${order.productName} (${order.level})`,
            '',
            '=== DONNÉES NATALES ===',
            `Date de naissance: ${profile.birthDate}`,
        ];

        if (profile.birthTime) {
            parts.push(`Heure de naissance: ${profile.birthTime}`);
        }
        if (profile.birthPlace) {
            parts.push(`Lieu de naissance: ${profile.birthPlace}`);
        }

        if (profile.specificQuestion) {
            parts.push('', '=== QUESTION SPÉCIFIQUE ===', profile.specificQuestion);
        }

        if (profile.objective) {
            parts.push('', '=== OBJECTIF ===', profile.objective);
        }

        if (profile.highs) {
            parts.push('', '=== POINTS FORTS / MOMENTS DE GRÂCE ===', profile.highs);
        }

        if (profile.lows) {
            parts.push('', '=== DÉFIS / POINTS BAS ===', profile.lows);
        }

        if (profile.strongSide) {
            parts.push('', '=== CÔTÉ LUMIÈRE / TALENTS ===', profile.strongSide);
        }

        if (profile.weakSide) {
            parts.push('', '=== CÔTÉ OMBRE / BLOCAGES ===', profile.weakSide);
        }

        if (profile.strongZone) {
            parts.push('', '=== ZONE CORPORELLE FORTE ===', profile.strongZone);
        }

        if (profile.weakZone) {
            parts.push('', '=== ZONE CORPORELLE FAIBLE ===', profile.weakZone);
        }

        if (profile.ailments) {
            parts.push('', '=== MAUX PHYSIQUES ===', profile.ailments);
        }

        if (profile.fears) {
            parts.push('', '=== PEURS / BLOQUAGES ===', profile.fears);
        }

        if (profile.rituals) {
            parts.push('', '=== RITUELS ACTUELS / ASPIRATIONS ===', profile.rituals);
        }

        if (profile.deliveryStyle) {
            parts.push('', '=== STYLE DE GUIDANCE PRÉFÉRÉ ===', profile.deliveryStyle);
        }

        if (profile.pace !== undefined) {
            parts.push('', '=== RYTHME D\'ACCOMPAGNEMENT ===', `${profile.pace}/100`);
        }

        if (profile.facePhotoUrl || profile.palmPhotoUrl) {
            parts.push('', '=== PHOTOS FOURNIES ===');
            if (profile.facePhotoUrl) parts.push('- Photo du visage (analyse physiognomique)');
            if (profile.palmPhotoUrl) parts.push('- Photo de la paume (analyse chiromancie)');
        }

        parts.push('', 'Génère une lecture spirituelle complète et personnalisée au format JSON.');

        return parts.join('\n');
    }

    private async fetchImageAsBase64(url: string): Promise<string> {
        this.logger.log(`📷 Fetching image from: ${url.substring(0, 50)}...`);
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 30000, // 30 second timeout for image fetch
        });
        const size = Buffer.from(response.data).length;
        this.logger.log(`📷 Image fetched: ${Math.round(size / 1024)}KB`);
        return Buffer.from(response.data).toString('base64');
    }
}
