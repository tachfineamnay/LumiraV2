import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { EditorialIntelligenceSettingsController } from './editorial-intelligence-settings.controller';
import { EditorialIntelligenceSettingsService } from './editorial-intelligence-settings.service';
import { EditorialIntelligenceDiagnosticsService } from './editorial-intelligence-diagnostics.service';
import { EditorialIntelligenceAiService } from './editorial-intelligence-ai.service';
import {
  BaselineSearchResearchProvider,
  BaselineSearchPerformanceProvider,
} from './mock-search-providers';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [EditorialIntelligenceSettingsController],
  providers: [
    EditorialIntelligenceSettingsService,
    EditorialIntelligenceDiagnosticsService,
    EditorialIntelligenceAiService,
    BaselineSearchResearchProvider,
    BaselineSearchPerformanceProvider,
    JwtService,
  ],
  exports: [
    EditorialIntelligenceSettingsService,
    EditorialIntelligenceDiagnosticsService,
    EditorialIntelligenceAiService,
    BaselineSearchResearchProvider,
    BaselineSearchPerformanceProvider,
  ],
})
export class EditorialIntelligenceModule {}
