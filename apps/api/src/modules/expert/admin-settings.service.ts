import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VertexAI } from '@google-cloud/vertexai';

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

    constructor(private readonly prisma: PrismaService) { }

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
     * Test the Vertex AI connection with the stored credentials.
     * Actually tries to initialize VertexAI to verify permissions.
     */
    async testVertexConnection(): Promise<VertexTestResult> {
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key: VERTEX_CREDENTIALS_KEY },
        });

        if (!setting?.value) {
            return { success: false, error: 'Aucun identifiant configuré' };
        }

        let credentials: { project_id?: string; client_email?: string };
        try {
            credentials = JSON.parse(setting.value);
        } catch {
            return { success: false, error: 'JSON invalide dans la base de données' };
        }

        const projectId = credentials.project_id || 'lumira-oracle';

        try {
            this.logger.log(`🔄 Testing Vertex AI connection for project: ${projectId}`);
            
            const vertexAI = new VertexAI({
                project: projectId,
                location: 'us-central1',
                googleAuthOptions: { credentials },
            });

            // Try to get a model - this will fail if credentials are invalid
            const model = vertexAI.getGenerativeModel({
                model: 'gemini-1.5-flash-002',
            });

            // Try a minimal generation to verify full access
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            });

            // If we get here, it works!
            const response = result.response;
            this.logger.log(`✅ Vertex AI connection test successful for ${projectId}`);
            
            return {
                success: true,
                projectId,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`❌ Vertex AI connection test failed: ${errorMessage}`);
            
            // Extract meaningful error
            let friendlyError = errorMessage;
            if (errorMessage.includes('403')) {
                friendlyError = 'Permission refusée (403). Vérifiez que le compte de service a les rôles Vertex AI User.';
            } else if (errorMessage.includes('401')) {
                friendlyError = 'Non autorisé (401). Les identifiants sont invalides.';
            } else if (errorMessage.includes('PERMISSION_DENIED')) {
                friendlyError = 'Permission refusée. Activez l\'API Vertex AI sur le projet Google Cloud.';
            } else if (errorMessage.includes('CONSUMER_INVALID')) {
                friendlyError = 'Projet invalide ou désactivé. Vérifiez que le projet existe et que la facturation est active.';
            }

            return {
                success: false,
                projectId,
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
