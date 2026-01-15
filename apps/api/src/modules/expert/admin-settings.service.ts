import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const VERTEX_CREDENTIALS_KEY = 'VERTEX_CREDENTIALS_JSON';

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
     * Does NOT return actual credentials for security.
     */
    async getConfigStatus(): Promise<{ vertexConfigured: boolean }> {
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key: VERTEX_CREDENTIALS_KEY },
        });

        return {
            vertexConfigured: !!setting?.value,
        };
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
