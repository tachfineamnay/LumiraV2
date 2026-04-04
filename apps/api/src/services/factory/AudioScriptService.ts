import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import OpenAI from 'openai';
import { VertexOracle } from './VertexOracle';

const NARRATOR_SYSTEM_PROMPT = `Tu es la voix de Lumira, oracle bienveillant et guide spirituel.
Tu transformes un texte de lecture spirituelle en script de narration audio méditatif.

Règles absolues :
- Supprime tous les titres de sections, numérotations, tirets de liste, astérisques, symboles visuels
- Convertis chaque liste en phrases fluides liées par des transitions naturelles
- Conserve EXACTEMENT le sens et toutes les informations — ne rajoute rien, n'omets rien
- Tutoie l'auditeur (interdit de vouvoyer)
- Phrases courtes à moyennes, rythme lent et respiratoire
- Transitions douces : "Alors...", "Dans ce mouvement...", "Tu remarqueras que...", "Et ici..."
- Évite tout jargon visuel : "section", "domaine", "point", "ci-dessous", "tableau"
- Longueur output : 80-90% de l'input
- Retourne UNIQUEMENT le texte reformulé, sans intro, sans commentaire`;

export interface AudioScriptInput {
    text: string;
    type: 'synthesis' | 'insight';
    category?: string;
}

@Injectable()
export class AudioScriptService {
    private readonly logger = new Logger(AudioScriptService.name);
    private readonly model: GenerativeModel | null = null;
    private readonly openaiClient: OpenAI | null = null;

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => VertexOracle))
        private readonly vertexOracle: VertexOracle,
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not found — AudioScriptService Gemini will passthrough');
        } else {
            const genAI = new GoogleGenerativeAI(apiKey);
            this.model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: {
                    temperature: 0.3,
                    topP: 0.8,
                    maxOutputTokens: 8192,
                },
            });
        }

        const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (openaiKey) {
            this.openaiClient = new OpenAI({ apiKey: openaiKey });
        }
    }

    async reformulate(input: AudioScriptInput): Promise<string> {
        // Check NARRATOR provider from VertexOracle config
        const agentProviders = this.vertexOracle.getAgentProviders();
        const provider = agentProviders.NARRATOR || 'gemini';

        const userPrompt = input.type === 'synthesis'
            ? `Transforme cette synthèse spirituelle en narration audio :\n\n${input.text}`
            : `Transforme cet insight sur le domaine '${input.category}' en narration audio :\n\n${input.text}`;

        if (provider === 'openai') {
            return this.reformulateWithOpenAI(userPrompt, input.text);
        }
        return this.reformulateWithGemini(userPrompt, input.text);
    }

    private async reformulateWithGemini(userPrompt: string, fallbackText: string): Promise<string> {
        if (!this.model) {
            return fallbackText;
        }

        try {
            const result = await Promise.race([
                this.model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                    systemInstruction: { role: 'system', parts: [{ text: NARRATOR_SYSTEM_PROMPT }] },
                }),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 20_000)),
            ]);

            if (!result) {
                this.logger.warn('⏱️ AudioScript timeout — fallback to raw text');
                return fallbackText;
            }

            const reformulated = result.response.text();

            if (!reformulated || reformulated.length < fallbackText.length * 0.3) {
                this.logger.warn('⚠️ AudioScript returned suspiciously short output — fallback to raw text');
                return fallbackText;
            }

            this.logger.log(`🖊️ [NARRATOR/Gemini] Script: ${fallbackText.length} → ${reformulated.length} chars`);
            return reformulated;
        } catch (error) {
            this.logger.warn(`❌ AudioScript Gemini error — fallback to raw text: ${error instanceof Error ? error.message : String(error)}`);
            return fallbackText;
        }
    }

    private async reformulateWithOpenAI(userPrompt: string, fallbackText: string): Promise<string> {
        if (!this.openaiClient) {
            this.logger.warn('OPENAI_API_KEY not set — NARRATOR falling back to raw text');
            return fallbackText;
        }

        try {
            const modelConfig = this.vertexOracle.getModelConfig();
            const model = modelConfig.openaiFlashModel || 'gpt-4o-mini';

            const result = await Promise.race([
                this.openaiClient.responses.create({
                    model,
                    instructions: NARRATOR_SYSTEM_PROMPT,
                    input: userPrompt,
                    temperature: 0.3,
                    top_p: 0.8,
                    max_output_tokens: 8192,
                }),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 20_000)),
            ]);

            if (!result) {
                this.logger.warn('⏱️ AudioScript OpenAI timeout — fallback to raw text');
                return fallbackText;
            }

            const reformulated = result.output_text;

            if (!reformulated || reformulated.length < fallbackText.length * 0.3) {
                this.logger.warn('⚠️ AudioScript OpenAI returned short output — fallback to raw text');
                return fallbackText;
            }

            this.logger.log(`🖊️ [NARRATOR/OpenAI] Script: ${fallbackText.length} → ${reformulated.length} chars`);
            return reformulated;
        } catch (error) {
            this.logger.warn(`❌ AudioScript OpenAI error — fallback to raw text: ${error instanceof Error ? error.message : String(error)}`);
            return fallbackText;
        }
    }
}
