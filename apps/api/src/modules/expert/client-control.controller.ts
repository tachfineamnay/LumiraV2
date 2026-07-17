import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ClientControlService } from './client-control.service';
import { ExpertAuthGuard, RolesGuard } from './guards';

@Controller('expert/clients')
@UseGuards(ExpertAuthGuard, RolesGuard)
export class ClientControlController {
  constructor(private readonly clients: ClientControlService) {}

  @Get(':id/control-center')
  async getControlCenter(@Param('id') clientId: string) {
    return this.clients.getClientControlCenter(clientId);
  }
}
