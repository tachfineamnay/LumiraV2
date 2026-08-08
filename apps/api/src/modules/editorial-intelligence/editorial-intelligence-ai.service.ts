import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EditorialIntelligenceSettingsService,
  DEFAULT_EDITORIAL_MODELS,
} from './editorial-intelligence-settings.service';
import { EditorialModelProfile, Prisma } from '@prisma/client';
import {
  EditorialAiProvider,
  ExecuteProfilePromptOptions,
  ExecuteProfilePromptResult,
} from './contracts';

@Injectable()
export class EditorialIntelligenceAiService implements EditorialAiProvider {
  private readonly logger = new Logger(EditorialIntelligenceAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: EditorialIntelligenceSettingsService,
    private readonly configService: ConfigService,
  ) {}

  public calculateInputHash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  async executeProfilePrompt(
    profile: EditorialModelProfile,
    prompt: string,
    options?: ExecuteProfilePromptOptions & {
      targetType?: string;
      targetId?: string;
      insightType?: string;
    },
  ): Promise<ExecuteProfilePromptResult> {
    const settings = await this.settingsService.getOrCreateSettings();
    const modelsMap = (settings.models as Record<string, string>) || DEFAULT_EDITORIAL_MODELS;
    const modelId = modelsMap[profile] || DEFAULT_EDITORIAL_MODELS[profile];

    const inputHash =
      options?.inputHash ||
      this.calculateInputHash(
        JSON.stringify({
          profile,
          modelId,
          prompt,
          systemInstruction: options?.systemInstruction,
          jsonSchema: options?.jsonSchema,
        }),
      );

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    let responseText = '';

    try {
      if (apiKey) {
        const client = new GoogleGenAI({ apiKey, vertexai: false });
        const reqContents = options?.systemInstruction
          ? `${options.systemInstruction}\n\n${prompt}`
          : prompt;

        const res = await client.models.generateContent({
          model: modelId,
          contents: reqContents,
          config: {
            temperature: options?.temperature ?? 0.2,
          },
        });
        responseText = res.text || '';
      } else {
        responseText = `[EditorialIntelligence AI DryRun] Response for profile ${profile} (${modelId}) on prompt hash ${inputHash.substring(0, 8)}`;
      }

      const targetType = options?.targetType || 'PROMPT';
      const targetId = options?.targetId || inputHash;
      const insightType = options?.insightType || profile.toString();

      await this.prisma.editorialAiInsight.create({
        data: {
          targetType,
          targetId,
          insightType,
          payload: { prompt, response: responseText } as unknown as Prisma.InputJsonValue,
          modelProfile: profile,
          modelUsed: modelId,
          inputHash,
        },
      });

      return {
        content: responseText,
        modelUsed: modelId,
        inputHash,
      };
    } catch (error) {
      this.logger.error(
        `Error executing AI prompt for profile ${profile}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
