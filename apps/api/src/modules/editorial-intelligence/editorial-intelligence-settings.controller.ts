import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ExpertAuthGuard, RolesGuard } from '../expert/guards';
import { Roles } from '../expert/decorators';
import { EditorialIntelligenceSettingsService } from './editorial-intelligence-settings.service';
import { EditorialIntelligenceDiagnosticsService } from './editorial-intelligence-diagnostics.service';
import {
  UpdateEditorialIntelligenceSettingsDto,
  CreateEditorialCompetitorDto,
  UpdateEditorialCompetitorDto,
  TestConnectionDto,
} from './dto';

@Controller('expert/editorial-intelligence')
@UseGuards(ExpertAuthGuard, RolesGuard)
@Roles('ADMIN')
export class EditorialIntelligenceSettingsController {
  constructor(
    private readonly settingsService: EditorialIntelligenceSettingsService,
    private readonly diagnosticsService: EditorialIntelligenceDiagnosticsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Settings & Configuration
  // ---------------------------------------------------------------------------

  @Get('settings')
  getSettings() {
    return this.settingsService.getOrCreateSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateEditorialIntelligenceSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  @Get('diagnostics')
  getDiagnostics() {
    return this.diagnosticsService.runDiagnostics();
  }

  @Get('models')
  getModelProfiles() {
    return this.settingsService.getModelProfiles();
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  testConnection(@Body() dto: TestConnectionDto) {
    return this.diagnosticsService.testConnection(dto.profile, dto.prompt);
  }

  // ---------------------------------------------------------------------------
  // Competitors
  // ---------------------------------------------------------------------------

  @Get('competitors')
  findAllCompetitors() {
    return this.settingsService.findAllCompetitors();
  }

  @Post('competitors')
  createCompetitor(@Body() dto: CreateEditorialCompetitorDto) {
    return this.settingsService.createCompetitor(dto);
  }

  @Patch('competitors/:id')
  updateCompetitor(@Param('id') id: string, @Body() dto: UpdateEditorialCompetitorDto) {
    return this.settingsService.updateCompetitor(id, dto);
  }

  @Delete('competitors/:id')
  deleteCompetitor(@Param('id') id: string) {
    return this.settingsService.deleteCompetitor(id);
  }
}
