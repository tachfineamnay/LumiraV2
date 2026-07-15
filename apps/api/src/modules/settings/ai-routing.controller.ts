import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiRoutingService, UpsertRoutingRuleDto } from './ai-routing.service';
import { ExpertAuthGuard, RolesGuard } from '../expert/guards';
import { Roles } from '../expert/decorators';

import { ProductLevel } from '@prisma/client';

@Controller('settings/ai-routing')
@UseGuards(ExpertAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AiRoutingController {
  private readonly logger = new Logger(AiRoutingController.name);

  constructor(private readonly aiRoutingService: AiRoutingService) {}

  /**
   * GET /api/settings/ai-routing
   * Returns all routing rules ordered by productLevel / agent / mission.
   */
  @Get()
  async listRules() {
    return this.aiRoutingService.listRules();
  }

  /**
   * POST /api/settings/ai-routing
   * Create or update a routing rule (upsert).
   * Body: UpsertRoutingRuleDto
   */
  @Post()
  async upsertRule(@Body() dto: UpsertRoutingRuleDto) {
    this.logger.log(
      `📝 Upserting rule: ${dto.productLevel}/${dto.agent}/${dto.mission ?? 'DEFAULT'}`,
    );
    return this.aiRoutingService.upsertRule(dto);
  }

  /**
   * DELETE /api/settings/ai-routing/:id
   * Delete a routing rule by its id.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(@Param('id') id: string) {
    this.logger.log(`🗑️ Deleting rule: ${id}`);
    await this.aiRoutingService.deleteRule(id);
  }

  /**
   * DELETE /api/settings/ai-routing/reset/:productLevel/:agent
   * Reset all rules for a productLevel+agent combo (back to global defaults).
   */
  @Delete('reset/:productLevel/:agent')
  async resetRules(@Param('productLevel') productLevel: string, @Param('agent') agent: string) {
    this.logger.log(`🔄 Resetting rules for ${productLevel}/${agent}`);
    return this.aiRoutingService.resetRules(productLevel as ProductLevel, agent);
  }
}
