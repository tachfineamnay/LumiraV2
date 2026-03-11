import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ServicesModule } from '../../services/services.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [OrdersModule, PrismaModule, NotificationsModule, ServicesModule],
    controllers: [PaymentsController],
    providers: [PaymentsService],
})
export class PaymentsModule { }
