import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController, InsightsWebhookController } from './insights.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [InsightsController, InsightsWebhookController],
    providers: [InsightsService],
    exports: [InsightsService],
})
export class InsightsModule { }
