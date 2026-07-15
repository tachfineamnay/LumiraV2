import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController, InsightsWebhookController } from './insights.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [InsightsController, InsightsWebhookController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
