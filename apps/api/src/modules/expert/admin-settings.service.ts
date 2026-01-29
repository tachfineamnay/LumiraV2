import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

const VERTEX_CREDENTIALS_KEY = 'VERTEX_CREDENTIALS_JSON';

export interface VertexTestResult {
    success: boolean;
    projectId?: string;
    error?: string;
}

export interface VertexConfigStatus {
    vertexConfigured: boolean;
    projectId?: string;
    clientEmail?: string;
    lastTested?: string;
    lastTestSuccess?: boolean;
}

@Injectable()
export class AdminSettingsService {
    private readonly logger = new Logger(AdminSettingsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Save Vertex AI credentials to the database.
     * Validates that the input is valid JSON before saving.
     */
    async setVertexCredentials(jsonString: string): Promise<{ success: boolean; message: string }> {
        // Validate JSON format
        try {
            const parsed = JSON.parse(jsonString);

            // Basic validation for Google credentials structure
            if (!parsed.type || !parsed.project_id) {
                throw new BadRequestException(
                    'Invalid credentials format. Expected Google Cloud service account JSON.',
                );
            }
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Invalid JSON format. Please provide valid JSON credentials.');
        }

        // Upsert the setting
        await this.prisma.systemSetting.upsert({
            where: { key: VERTEX_CREDENTIALS_KEY },
            update: {
                value: jsonString,
                isEncrypted: true, // Mark as sensitive
            },
            create: {
                key: VERTEX_CREDENTIALS_KEY,
                value: jsonString,
                isEncrypted: true,
            },
        });

        this.logger.log('Vertex AI credentials saved successfully');
        return { success: true, message: 'Identifiants Vertex AI sauvegardés avec succès.' };
    }

    /**
     * Get Vertex AI credentials from the database.
     * Returns null if not configured.
     */
    async getVertexCredentials(): Promise<string | null> {
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key: VERTEX_CREDENTIALS_KEY },
        });

        return setting?.value ?? null;
    }

    /**
     * Get configuration status for the admin dashboard.
     * Returns metadata about the credentials (but not the actual secret values).
     */
    async getConfigStatus(): Promise<VertexConfigStatus> {
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key: VERTEX_CREDENTIALS_KEY },
        });

        if (!setting?.value) {
            return { vertexConfigured: false };
        }

        try {
            const parsed = JSON.parse(setting.value);
            return {
                vertexConfigured: true,
                projectId: parsed.project_id || 'Inconnu',
                clientEmail: parsed.client_email || 'Inconnu',
            };
        } catch {
            return { vertexConfigured: true, projectId: 'Erreur parsing' };
        }
    }

    /**
     * Get the full credentials JSON (for display in admin panel).
     * Only accessible by authenticated admins.
     */
    async getVertexCredentialsForDisplay(): Promise<{ configured: boolean; credentials?: string; projectId?: string }> {
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key: VERTEX_CREDENTIALS_KEY },
        });

        if (!setting?.value) {
            return { configured: false };
        }

        try {
            const parsed = JSON.parse(setting.value);
            return {
                configured: true,
                credentials: setting.value,
                projectId: parsed.project_id,
            };
        } catch {
            return { configured: true, credentials: setting.value };
        }
    }

    /**
     * Test the Gemini API connection with the API key.
     * Actually tries to call the model to verify access.
     */
    async testVertexConnection(): Promise<VertexTestResult> {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            return { success: false, error: 'GEMINI_API_KEY non configurée dans les variables d\'environnement' };
        }

        try {
            this.logger.log('🔄 Testing Gemini API connection...');
            
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash-preview-05-20',
            });

            // Try a minimal generation to verify full access
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            });

            // If we get here, it works!
            const text = result.response.text();
            this.logger.log(`✅ Gemini API connection test successful`);
            
            return {
                success: true,
                projectId: 'gemini-api',
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`❌ Gemini API connection test failed: ${errorMessage}`);
            
            // Extract meaningful error
            let friendlyError = errorMessage;
            if (errorMessage.includes('API_KEY_INVALID')) {
                friendlyError = 'Clé API invalide. Vérifiez votre GEMINI_API_KEY.';
            } else if (errorMessage.includes('403')) {
                friendlyError = 'Permission refusée (403). La clé API n\'a pas accès au modèle.';
            } else if (errorMessage.includes('401')) {
                friendlyError = 'Non autorisé (401). La clé API est invalide.';
            } else if (errorMessage.includes('RESOURCE_EXHAUSTED')) {
                friendlyError = 'Quota dépassé. Attendez un moment ou augmentez vos limites.';
            }

            return {
                success: false,
                error: friendlyError,
            };
        }
    }

    /**
     * Delete Vertex AI credentials from the database.
     */
    async deleteVertexCredentials(): Promise<{ success: boolean; message: string }> {
        await this.prisma.systemSetting.deleteMany({
            where: { key: VERTEX_CREDENTIALS_KEY },
        });

        this.logger.log('Vertex AI credentials deleted');
        return { success: true, message: 'Identifiants Vertex AI supprimés.' };
    }
}
