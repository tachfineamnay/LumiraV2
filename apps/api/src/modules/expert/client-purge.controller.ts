import { Controller, Delete, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { ClientPurgeService } from './client-purge.service';
import { Roles } from './decorators';
import { ExpertAuthGuard } from './guards/expert-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Controller('expert/clients')
@UseGuards(ExpertAuthGuard, RolesGuard)
export class ClientPurgeController {
  constructor(private readonly clientPurgeService: ClientPurgeService) {}

  @Delete(':id/purge')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async purge(@Param('id') clientId: string) {
    return this.clientPurgeService.purge(clientId);
  }
}
