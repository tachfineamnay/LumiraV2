import { Module } from '@nestjs/common';
import { AiRoutingService } from './ai-routing.service';
import { AiRoutingController } from './ai-routing.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExpertModule } from '../expert/expert.module';

@Module({
  imports: [PrismaModule, ExpertModule],
  controllers: [AiRoutingController],
  providers: [AiRoutingService],
  exports: [AiRoutingService],
})
export class SettingsModule {}
