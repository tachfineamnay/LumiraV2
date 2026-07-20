import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { AiProviderDiagnosticsService } from './modules/expert/ai-provider-diagnostics.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly aiProviderDiagnostics: AiProviderDiagnosticsService,
  ) {}

  @Get('health')
  health() {
    return this.appService.getHealth();
  }

  @Get('health/ai')
  async aiHealth() {
    return this.aiProviderDiagnostics.getAiHealthSnapshotWithModels();
  }
}
