import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IdGenerator } from '../../utils/IdGenerator';
import { ServiceApiKeyGuard } from '../../guards/service-api-key.guard';

@Module({
    imports: [PrismaModule, NotificationsModule],
    controllers: [OrdersController],
    providers: [OrdersService, IdGenerator, ServiceApiKeyGuard],
    exports: [OrdersService],
})
export class OrdersModule { }
