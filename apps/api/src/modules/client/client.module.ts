import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ServicesModule } from '../../services/services.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClientSanctuaireInterceptor } from './client-sanctuaire.interceptor';

@Module({
  imports: [PrismaModule, ServicesModule, NotificationsModule],
  controllers: [ClientController],
  providers: [
    ClientService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ClientSanctuaireInterceptor,
    },
  ],
  exports: [ClientService],
})
export class ClientModule {}
