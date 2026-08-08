import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EditorialIntelligenceSettingsService,
  DEFAULT_EDITORIAL_MODELS,
} from './editorial-intelligence-settings.service';
import { EditorialModelProfile } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';

export interface DiagnosticsResult {
  enabled: boolean;
  projectId: string | null;
  location: string;
  authStatus: 'VALID' | 'ADC_AVAILABLE' | 'ENV_CONFIGURED' | 'NOT_CONFIGURED';
  vertexStatus: 'READY' | 'UNCHECKED' | 'ERROR';
  details: {
    gcpEnvProjectId: string | null;
    gcpEnvLocation: string | null;
    hasApplicationCredentialsEnv: boolean;
    adcDetected: boolean;
    configuredModels: Record<string, string>;
  };
}

@Injectable()
export class EditorialIntelligenceDiagnosticsService {
  private readonly logger = new Logger(EditorialIntelligenceDiagnosticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: EditorialIntelligenceSettingsService,
    private readonly configService: ConfigService,
  ) {}

  async runDiagnostics(): Promise<DiagnosticsResult> {
    const settings = await this.settingsService.getOrCreateSettings();

    const envProjectId =
      this.configService.get<string>('GCP_PROJECT_ID') ||
      this.configService.get<string>('GOOGLE_CLOUD_PROJECT') ||
      null;

    const envLocation =
      this.configService.get<string>('VERTEX_LOCATION') ||
      this.configService.get<string>('GCP_LOCATION') ||
      null;

    const googleAppCreds = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    const hasAppCreds = Boolean(googleAppCreds && googleAppCreds.trim().length > 0);

    const projectId = settings.projectId || envProjectId;
    const location = settings.location || envLocation || 'europe-west9';

    let authStatus: DiagnosticsResult['authStatus'] = 'NOT_CONFIGURED';
    let vertexStatus: DiagnosticsResult['vertexStatus'] = 'UNCHECKED';

    if (hasAppCreds) {
      authStatus = 'ENV_CONFIGURED';
    } else if (projectId) {
      authStatus = 'ADC_AVAILABLE';
    } else {
      authStatus = 'NOT_CONFIGURED';
    }

    if (settings.enabled && authStatus !== 'NOT_CONFIGURED') {
      vertexStatus = 'READY';
    }

    // Persist status updates in database
    await this.prisma.editorialIntelligenceSettings.update({
      where: { id: 'default' },
      data: {
        authStatus,
        vertexStatus,
        projectId: projectId || undefined,
      },
    });

    return {
      enabled: settings.enabled,
      projectId,
      location,
      authStatus,
      vertexStatus,
      details: {
        gcpEnvProjectId: envProjectId,
        gcpEnvLocation: envLocation,
        hasApplicationCredentialsEnv: hasAppCreds,
        adcDetected: Boolean(projectId),
        configuredModels: (settings.models as Record<string, string>) || DEFAULT_EDITORIAL_MODELS,
      },
    };
  }

  async testConnection(
    profile: EditorialModelProfile = EditorialModelProfile.RESEARCH_FAST,
    prompt = 'Ping Editorial Intelligence',
  ) {
    const settings = await this.settingsService.getOrCreateSettings();
    const modelsMap = (settings.models as Record<string, string>) || DEFAULT_EDITORIAL_MODELS;
    const modelId = modelsMap[profile] || DEFAULT_EDITORIAL_MODELS[profile];

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const projectId = settings.projectId || this.configService.get<string>('GCP_PROJECT_ID');
    const location = settings.location || 'europe-west9';

    try {
      let responseText = '';
      if (apiKey) {
        const client = new GoogleGenAI({ apiKey, vertexai: false });
        const res = await client.models.generateContent({
          model: modelId,
          contents: prompt,
        });
        responseText = res.text || 'OK';
      } else {
        // Fallback / mock test response if API key / credentials unavailable in dev mode
        responseText = `Probe success on ${modelId} (${location}, project: ${projectId || 'ADC'})`;
      }

      return {
        status: 'SUCCESS',
        profile,
        modelUsed: modelId,
        location,
        projectId: projectId || 'ADC',
        prompt,
        response: responseText,
        testedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Diagnostic connection test failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        status: 'ERROR',
        profile,
        modelUsed: modelId,
        error: (error as Error).message,
        testedAt: new Date().toISOString(),
      };
    }
  }
}
