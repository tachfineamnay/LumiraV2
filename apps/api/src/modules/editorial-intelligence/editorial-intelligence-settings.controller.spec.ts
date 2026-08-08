import { Test, TestingModule } from '@nestjs/testing';
import { EditorialIntelligenceSettingsController } from './editorial-intelligence-settings.controller';
import { EditorialIntelligenceSettingsService } from './editorial-intelligence-settings.service';
import { EditorialIntelligenceDiagnosticsService } from './editorial-intelligence-diagnostics.service';
import { ExpertAuthGuard, RolesGuard } from '../expert/guards';
import { Reflector } from '@nestjs/core';
import { EditorialModelProfile } from '@prisma/client';

describe('EditorialIntelligenceSettingsController (Auth Boundary & Endpoints)', () => {
  let controller: EditorialIntelligenceSettingsController;
  let settingsService: jest.Mocked<EditorialIntelligenceSettingsService>;
  let diagnosticsService: jest.Mocked<EditorialIntelligenceDiagnosticsService>;

  beforeEach(async () => {
    const mockSettingsService = {
      getOrCreateSettings: jest.fn(),
      updateSettings: jest.fn(),
      getModelProfiles: jest.fn(),
      findAllCompetitors: jest.fn(),
      createCompetitor: jest.fn(),
      updateCompetitor: jest.fn(),
      deleteCompetitor: jest.fn(),
    };

    const mockDiagnosticsService = {
      runDiagnostics: jest.fn(),
      testConnection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EditorialIntelligenceSettingsController],
      providers: [
        { provide: EditorialIntelligenceSettingsService, useValue: mockSettingsService },
        { provide: EditorialIntelligenceDiagnosticsService, useValue: mockDiagnosticsService },
        Reflector,
      ],
    })
      .overrideGuard(ExpertAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EditorialIntelligenceSettingsController>(
      EditorialIntelligenceSettingsController,
    );
    settingsService = module.get(EditorialIntelligenceSettingsService);
    diagnosticsService = module.get(EditorialIntelligenceDiagnosticsService);
  });

  it('should be defined with ADMIN roles guard metadata', () => {
    expect(controller).toBeDefined();
    const roles = Reflect.getMetadata('roles', EditorialIntelligenceSettingsController);
    expect(roles).toEqual(['ADMIN']);
  });

  it('delegates getSettings to service', async () => {
    settingsService.getOrCreateSettings.mockResolvedValue({ id: 'default' } as any);
    await controller.getSettings();
    expect(settingsService.getOrCreateSettings).toHaveBeenCalled();
  });

  it('delegates updateSettings to service', async () => {
    settingsService.updateSettings.mockResolvedValue({ id: 'default', enabled: true } as any);
    await controller.updateSettings({ enabled: true });
    expect(settingsService.updateSettings).toHaveBeenCalledWith({ enabled: true });
  });

  it('delegates getDiagnostics to diagnostics service', async () => {
    diagnosticsService.runDiagnostics.mockResolvedValue({ enabled: false } as any);
    await controller.getDiagnostics();
    expect(diagnosticsService.runDiagnostics).toHaveBeenCalled();
  });

  it('delegates testConnection to diagnostics service', async () => {
    diagnosticsService.testConnection.mockResolvedValue({ status: 'SUCCESS' } as any);
    await controller.testConnection({ profile: EditorialModelProfile.RESEARCH_FAST });
    expect(diagnosticsService.testConnection).toHaveBeenCalledWith(
      EditorialModelProfile.RESEARCH_FAST,
      undefined,
    );
  });
});
