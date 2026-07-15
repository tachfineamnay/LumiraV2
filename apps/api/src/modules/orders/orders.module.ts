import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IdGenerator } from '../../utils/IdGenerator';

@Module({
    imports: [PrismaModule, NotificationsModule],
    controllers: [OrdersController],
    providers: [OrdersService, IdGenerator],
    exports: [OrdersService],
})
export class OrdersModule { }
