import { Test, TestingModule } from '@nestjs/testing';
import {
  EditorialIntelligenceSettingsService,
  DEFAULT_EDITORIAL_MODELS,
} from './editorial-intelligence-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EditorialModelProfile } from '@prisma/client';

describe('EditorialIntelligenceSettingsService', () => {
  let service: EditorialIntelligenceSettingsService;
  let prisma: Record<string, any>;

  const mockSettings = {
    id: 'default',
    enabled: true,
    projectId: 'lumira-prod-gcp',
    location: 'europe-west9',
    authStatus: 'ADC_AVAILABLE',
    vertexStatus: 'READY',
    models: DEFAULT_EDITORIAL_MODELS,
    country: 'FR',
    language: 'fr',
    locale: 'fr-FR',
    secondaryMarkets: ['BE', 'CH'],
    groundingEnabled: true,
    confidenceMinimum: 0.8,
    opportunityWeights: { customerIntent: 0.3 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCompetitor = {
    id: 'comp-1',
    domain: 'concurrent-astrologie.fr',
    name: 'Concurrent Astrologie',
    isTracked: true,
    targetKeywords: ['tarot', 'horoscope'],
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      editorialIntelligenceSettings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      editorialCompetitor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditorialIntelligenceSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EditorialIntelligenceSettingsService>(
      EditorialIntelligenceSettingsService,
    );
  });

  describe('getOrCreateSettings', () => {
    it('returns existing settings if present', async () => {
      prisma.editorialIntelligenceSettings.findUnique.mockResolvedValue(mockSettings);
      const result = await service.getOrCreateSettings();
      expect(result).toEqual(mockSettings);
    });

    it('creates default settings if not present', async () => {
      prisma.editorialIntelligenceSettings.findUnique.mockResolvedValue(null);
      prisma.editorialIntelligenceSettings.create.mockResolvedValue(mockSettings);
      const result = await service.getOrCreateSettings();
      expect(prisma.editorialIntelligenceSettings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: 'default', enabled: false }),
        }),
      );
      expect(result).toEqual(mockSettings);
    });
  });

  describe('updateSettings', () => {
    it('updates specific non-secret settings', async () => {
      prisma.editorialIntelligenceSettings.findUnique.mockResolvedValue(mockSettings);
      prisma.editorialIntelligenceSettings.update.mockResolvedValue({
        ...mockSettings,
        confidenceMinimum: 0.85,
      });

      const result = await service.updateSettings({ confidenceMinimum: 0.85 });
      expect(prisma.editorialIntelligenceSettings.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: expect.objectContaining({ confidenceMinimum: 0.85 }),
      });
      expect(result.confidenceMinimum).toBe(0.85);
    });
  });

  describe('getModelProfiles', () => {
    it('returns configured profiles matching required model profiles', async () => {
      prisma.editorialIntelligenceSettings.findUnique.mockResolvedValue(mockSettings);
      const result = await service.getModelProfiles();

      expect(result.profiles.length).toBe(5);
      const fastProfile = result.profiles.find(
        (p) => p.profile === EditorialModelProfile.RESEARCH_FAST,
      );
      expect(fastProfile?.modelId).toBe('gemini-2.5-flash');
    });
  });

  describe('Competitors CRUD', () => {
    it('creates a new competitor with normalized domain', async () => {
      prisma.editorialCompetitor.findUnique.mockResolvedValue(null);
      prisma.editorialCompetitor.create.mockResolvedValue(mockCompetitor);

      const result = await service.createCompetitor({
        domain: 'Concurrent-Astrologie.fr ',
        name: 'Concurrent Astrologie',
      });

      expect(prisma.editorialCompetitor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          domain: 'concurrent-astrologie.fr',
          name: 'Concurrent Astrologie',
        }),
      });
      expect(result).toEqual(mockCompetitor);
    });
  });
});
