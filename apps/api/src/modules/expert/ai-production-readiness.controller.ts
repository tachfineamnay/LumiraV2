import { Controller, Get, UseGuards } from '@nestjs/common';
import { ExpertAuthGuard, RolesGuard } from './guards';
import { Roles } from './decorators';
import { AiProductionReadinessService } from './ai-production-readiness.service';

@Controller('expert/settings/readiness')
@UseGuards(ExpertAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AiProductionReadinessController {
  constructor(private readonly readiness: AiProductionReadinessService) {}

  @Get()
  async getReadiness() {
    return this.readiness.getReadiness();
  }
}
