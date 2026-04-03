import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

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

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not found — AudioScriptService will passthrough');
            return;
        }

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

    async reformulate(input: AudioScriptInput): Promise<string> {
        if (!this.model) {
            return input.text;
        }

        const userPrompt = input.type === 'synthesis'
            ? `Transforme cette synthèse spirituelle en narration audio :\n\n${input.text}`
            : `Transforme cet insight sur le domaine '${input.category}' en narration audio :\n\n${input.text}`;

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
                return input.text;
            }

            const reformulated = result.response.text();

            if (!reformulated || reformulated.length < input.text.length * 0.3) {
                this.logger.warn('⚠️ AudioScript returned suspiciously short output — fallback to raw text');
                return input.text;
            }

            this.logger.log(`🖊️ Script: ${input.text.length} chars → ${reformulated.length} chars`);
            return reformulated;
        } catch (error) {
            this.logger.warn(`❌ AudioScript error — fallback to raw text: ${error instanceof Error ? error.message : String(error)}`);
            return input.text;
        }
    }
}
