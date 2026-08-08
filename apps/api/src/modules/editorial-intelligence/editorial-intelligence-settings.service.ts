import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EditorialModelProfile, Prisma } from '@prisma/client';
import {
  UpdateEditorialIntelligenceSettingsDto,
  CreateEditorialCompetitorDto,
  UpdateEditorialCompetitorDto,
} from './dto';

export const DEFAULT_EDITORIAL_MODELS: Record<EditorialModelProfile, string> = {
  [EditorialModelProfile.RESEARCH_FAST]: 'gemini-2.5-flash',
  [EditorialModelProfile.RESEARCH_DEEP]: 'gemini-2.5-pro',
  [EditorialModelProfile.SERP_ANALYSIS]: 'gemini-2.5-flash',
  [EditorialModelProfile.LINKING]: 'gemini-2.5-flash',
  [EditorialModelProfile.SEO_COPILOT]: 'gemini-2.5-pro',
};

export const DEFAULT_OPPORTUNITY_WEIGHTS: Record<string, number> = {
  customerIntent: 0.2,
  serpWeakness: 0.2,
  demand: 0.15,
  topicalFit: 0.15,
  trend: 0.1,
  specificity: 0.1,
  clusterGap: 0.1,
};

@Injectable()
export class EditorialIntelligenceSettingsService {
  private readonly logger = new Logger(EditorialIntelligenceSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateSettings() {
    let settings = await this.prisma.editorialIntelligenceSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await this.prisma.editorialIntelligenceSettings.create({
        data: {
          id: 'default',
          enabled: false,
          location: 'europe-west9',
          authStatus: 'NOT_CONFIGURED',
          vertexStatus: 'UNCHECKED',
          models: DEFAULT_EDITORIAL_MODELS as unknown as Prisma.InputJsonValue,
          opportunityWeights: DEFAULT_OPPORTUNITY_WEIGHTS as unknown as Prisma.InputJsonValue,
          country: 'FR',
          language: 'fr',
          locale: 'fr-FR',
          secondaryMarkets: [],
          groundingEnabled: true,
          confidenceMinimum: 0.7,
        },
      });
    }

    return settings;
  }

  async updateSettings(dto: UpdateEditorialIntelligenceSettingsDto) {
    const current = await this.getOrCreateSettings();

    const dataToUpdate: Prisma.EditorialIntelligenceSettingsUpdateInput = {};

    if (dto.enabled !== undefined) dataToUpdate.enabled = dto.enabled;
    if (dto.projectId !== undefined) dataToUpdate.projectId = dto.projectId;
    if (dto.location !== undefined) dataToUpdate.location = dto.location;
    if (dto.country !== undefined) dataToUpdate.country = dto.country;
    if (dto.language !== undefined) dataToUpdate.language = dto.language;
    if (dto.locale !== undefined) dataToUpdate.locale = dto.locale;
    if (dto.secondaryMarkets !== undefined) dataToUpdate.secondaryMarkets = dto.secondaryMarkets;
    if (dto.groundingEnabled !== undefined) dataToUpdate.groundingEnabled = dto.groundingEnabled;
    if (dto.confidenceMinimum !== undefined) dataToUpdate.confidenceMinimum = dto.confidenceMinimum;
    if (dto.opportunityScanEnabled !== undefined)
      dataToUpdate.opportunityScanEnabled = dto.opportunityScanEnabled;
    if (dto.opportunityScanFrequency !== undefined)
      dataToUpdate.opportunityScanFrequency = dto.opportunityScanFrequency;
    if (dto.competitorScanEnabled !== undefined)
      dataToUpdate.competitorScanEnabled = dto.competitorScanEnabled;
    if (dto.competitorScanFrequency !== undefined)
      dataToUpdate.competitorScanFrequency = dto.competitorScanFrequency;
    if (dto.performanceSyncEnabled !== undefined)
      dataToUpdate.performanceSyncEnabled = dto.performanceSyncEnabled;
    if (dto.dailyCallLimit !== undefined) dataToUpdate.dailyCallLimit = dto.dailyCallLimit;
    if (dto.monthlyWarningThreshold !== undefined)
      dataToUpdate.monthlyWarningThreshold = dto.monthlyWarningThreshold;
    if (dto.concurrencyLimit !== undefined) dataToUpdate.concurrencyLimit = dto.concurrencyLimit;
    if (dto.timeoutMs !== undefined) dataToUpdate.timeoutMs = dto.timeoutMs;

    if (dto.models !== undefined) {
      const mergedModels = {
        ...(current.models as Record<string, string>),
        ...dto.models,
      };
      dataToUpdate.models = mergedModels as unknown as Prisma.InputJsonValue;
    }

    if (dto.opportunityWeights !== undefined) {
      const mergedWeights = {
        ...(current.opportunityWeights as Record<string, number>),
        ...dto.opportunityWeights,
      };
      dataToUpdate.opportunityWeights = mergedWeights as unknown as Prisma.InputJsonValue;
    }

    return this.prisma.editorialIntelligenceSettings.update({
      where: { id: 'default' },
      data: dataToUpdate,
    });
  }

  async getModelProfiles() {
    const settings = await this.getOrCreateSettings();
    const configuredModels = (settings.models as Record<string, string>) || {};

    const profiles = Object.values(EditorialModelProfile).map((profile) => ({
      profile,
      modelId: configuredModels[profile] || DEFAULT_EDITORIAL_MODELS[profile],
      defaultModelId: DEFAULT_EDITORIAL_MODELS[profile],
    }));

    return {
      profiles,
      globalSettings: {
        enabled: settings.enabled,
        location: settings.location,
        projectId: settings.projectId,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Competitors
  // ---------------------------------------------------------------------------

  async findAllCompetitors() {
    return this.prisma.editorialCompetitor.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCompetitor(dto: CreateEditorialCompetitorDto) {
    const domainNormalized = dto.domain.trim().toLowerCase();
    const existing = await this.prisma.editorialCompetitor.findUnique({
      where: { domain: domainNormalized },
    });

    if (existing) {
      throw new ConflictException(
        `Le concurrent avec le domaine '${domainNormalized}' existe déjà.`,
      );
    }

    return this.prisma.editorialCompetitor.create({
      data: {
        domain: domainNormalized,
        name: dto.name,
        isTracked: dto.isTracked ?? true,
        targetKeywords: dto.targetKeywords ?? [],
        metadata: (dto.metadata as unknown as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async updateCompetitor(id: string, dto: UpdateEditorialCompetitorDto) {
    const competitor = await this.prisma.editorialCompetitor.findUnique({
      where: { id },
    });
    if (!competitor) {
      throw new NotFoundException(`Concurrent '${id}' introuvable.`);
    }

    let domainNormalized = competitor.domain;
    if (dto.domain) {
      domainNormalized = dto.domain.trim().toLowerCase();
      if (domainNormalized !== competitor.domain) {
        const existing = await this.prisma.editorialCompetitor.findUnique({
          where: { domain: domainNormalized },
        });
        if (existing) {
          throw new ConflictException(`Le domaine '${domainNormalized}' est déjà utilisé.`);
        }
      }
    }

    return this.prisma.editorialCompetitor.update({
      where: { id },
      data: {
        domain: domainNormalized,
        name: dto.name,
        isTracked: dto.isTracked,
        targetKeywords: dto.targetKeywords,
        metadata: dto.metadata ? (dto.metadata as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async deleteCompetitor(id: string) {
    const competitor = await this.prisma.editorialCompetitor.findUnique({
      where: { id },
    });
    if (!competitor) {
      throw new NotFoundException(`Concurrent '${id}' introuvable.`);
    }

    return this.prisma.editorialCompetitor.delete({
      where: { id },
    });
  }
}
