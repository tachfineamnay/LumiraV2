import { BadRequestException } from '@nestjs/common';
import { AdminSettingsService } from './admin-settings.service';
import { AiRuntimeCacheService } from '../../services/factory/ai-runtime-cache.service';
import { AiProviderDiagnosticsService } from './ai-provider-diagnostics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_AI_MODEL_CONFIG } from '../../services/factory/ai-model-config';

describe('AdminSettingsService restore latest custom', () => {
  const promptVersion = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  };

  const prisma = {
    promptVersion,
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ promptVersion })),
  };

  const aiRuntimeCache = { invalidateAll: jest.fn() };
  const aiModelCatalog = { clearCache: jest.fn() };
  const aiProviderDiagnostics = {
    clearAllCaches: jest.fn(),
    clearProviderCache: jest.fn(),
    testProviderModelPair: jest
      .fn()
      .mockResolvedValue({ success: true, text: 'ok', multimodal: 'ok', structured: 'ok' }),
  };
  let service: AdminSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminSettingsService(
      prisma as unknown as PrismaService,
      { get: jest.fn() } as unknown as ConfigService,
      aiProviderDiagnostics as unknown as AiProviderDiagnosticsService,
      aiRuntimeCache as unknown as AiRuntimeCacheService,
      aiModelCatalog as never,
    );
  });

  it('detects production-migration authors as system', () => {
    expect(service.isSystemPromptAuthor('production-migration', 'anything')).toBe(true);
    expect(service.isSystemPromptAuthor('expert@oraclelumira.com', 'Desk save')).toBe(false);
    expect(
      service.isSystemPromptAuthor(
        null,
        'OpenAI-only V1 production baseline with pinned snapshots',
      ),
    ).toBe(true);
  });

  it('restores the latest non-system SCRIBE version', async () => {
    promptVersion.findMany.mockResolvedValue([
      {
        id: 'sys',
        key: 'SCRIBE',
        version: 3,
        value: 'system scribe',
        changedBy: 'production-migration',
        comment: 'baseline',
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: 'custom',
        key: 'SCRIBE',
        version: 2,
        value: 'my custom scribe',
        changedBy: 'founder@oraclelumira.com',
        comment: 'Desk',
        isActive: false,
        createdAt: new Date(),
      },
    ]);
    promptVersion.findUnique.mockResolvedValue({
      id: 'custom',
      key: 'SCRIBE',
      version: 2,
      value: 'my custom scribe',
      changedBy: 'founder@oraclelumira.com',
      comment: 'Desk',
      isActive: false,
      createdAt: new Date(),
    });
    promptVersion.findFirst
      .mockResolvedValueOnce({ version: 2 }) // latest before create in persist - actually persist uses findFirst for latest version
      .mockResolvedValueOnce({ version: 4, isActive: true }); // after restore
    promptVersion.updateMany.mockResolvedValue({ count: 1 });
    promptVersion.create.mockResolvedValue({ version: 4 });

    // persistPromptVersion uses findFirst for latest version number
    promptVersion.findFirst.mockReset();
    promptVersion.findFirst
      .mockResolvedValueOnce({ version: 3 }) // inside persist: latest version
      .mockResolvedValueOnce({ version: 4, isActive: true }); // after restoreLatestCustom

    const result = await service.restoreLatestCustomPrompt('SCRIBE', 'desk-restore');
    expect(result.success).toBe(true);
    expect(promptVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'SCRIBE',
          value: 'my custom scribe',
          isActive: true,
        }),
      }),
    );
    expect(aiRuntimeCache.invalidateAll).toHaveBeenCalled();
  });

  it('throws when no custom version exists', async () => {
    promptVersion.findMany.mockResolvedValue([
      {
        id: 'sys',
        key: 'EDITOR',
        version: 1,
        value: 'system',
        changedBy: 'production-migration',
        comment: 'baseline',
        isActive: true,
        createdAt: new Date(),
      },
    ]);

    await expect(service.restoreLatestCustomPrompt('EDITOR')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns model config desk meta for system baseline', async () => {
    promptVersion.findFirst.mockResolvedValue({
      id: 'mc',
      key: 'MODEL_CONFIG',
      version: 5,
      value: JSON.stringify(DEFAULT_AI_MODEL_CONFIG),
      changedBy: 'production-migration',
      comment: 'V1 production baseline',
      isActive: true,
      createdAt: new Date(),
    });
    promptVersion.findMany.mockResolvedValue([
      {
        id: 'mc',
        key: 'MODEL_CONFIG',
        version: 5,
        value: JSON.stringify(DEFAULT_AI_MODEL_CONFIG),
        changedBy: 'production-migration',
        comment: 'V1 production baseline',
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: 'mc-custom',
        key: 'MODEL_CONFIG',
        version: 4,
        value: JSON.stringify({
          ...DEFAULT_AI_MODEL_CONFIG,
          providerMode: 'per_agent',
        }),
        changedBy: 'founder',
        comment: 'Desk',
        isActive: false,
        createdAt: new Date(),
      },
    ]);

    const desk = await service.getModelConfigForDesk();
    expect(desk.meta.isCustom).toBe(false);
    expect(desk.meta.hasRestorableCustom).toBe(true);
    expect(desk.config.providerMode).toBe('per_agent');
  });

  it('never performs Prisma writes during GET getModelConfigForDesk (strict read-only)', async () => {
    const invalidConfig = {
      ...DEFAULT_AI_MODEL_CONFIG,
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          ...DEFAULT_AI_MODEL_CONFIG.agents.SCRIBE,
          model: 'custom-unverified-model',
        },
      },
    };
    promptVersion.findFirst.mockResolvedValue({
      id: 'mc-custom',
      key: 'MODEL_CONFIG',
      version: 7,
      value: JSON.stringify(invalidConfig),
      changedBy: 'founder',
      comment: 'Desk',
      isActive: true,
      createdAt: new Date(),
    });
    promptVersion.findMany.mockResolvedValue([]);

    const desk = await service.getModelConfigForDesk();
    expect(desk.config.agents.SCRIBE.model).toBe('custom-unverified-model');
    expect(promptVersion.create).not.toHaveBeenCalled();
    expect(promptVersion.updateMany).not.toHaveBeenCalled();
  });

  it('rejects testAndApplyModelConfig when probe fails and preserves existing DB config', async () => {
    promptVersion.findFirst.mockResolvedValue({
      id: 'mc',
      key: 'MODEL_CONFIG',
      version: 5,
      value: JSON.stringify(DEFAULT_AI_MODEL_CONFIG),
      changedBy: 'production-migration',
      comment: 'baseline',
      isActive: true,
      createdAt: new Date(),
    });
    promptVersion.findMany.mockResolvedValue([]);

    (aiProviderDiagnostics.testProviderModelPair as jest.Mock) = jest.fn().mockResolvedValue({
      success: false,
      error: 'Model probe failed (404 Not Found)',
    });

    await expect(
      service.testAndApplyModelConfig(
        {
          providerMode: 'per_agent',
          agents: {
            ...DEFAULT_AI_MODEL_CONFIG.agents,
            SCRIBE: {
              ...DEFAULT_AI_MODEL_CONFIG.agents.SCRIBE,
              model: 'non-existent-model',
            },
          },
        },
        'founder',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(promptVersion.create).not.toHaveBeenCalled();
  });
});
