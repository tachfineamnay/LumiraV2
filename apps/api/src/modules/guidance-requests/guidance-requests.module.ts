import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ExpertModule } from '../expert/expert.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  ClientGuidanceRequestsController,
  ExpertGuidanceRequestsController,
} from './guidance-requests.controller';
import { GuidanceRequestsService } from './guidance-requests.service';
import { GuidanceResponseInterceptor } from './guidance-response.interceptor';

@Module({
  imports: [ExpertModule, NotificationsModule],
  controllers: [ClientGuidanceRequestsController, ExpertGuidanceRequestsController],
  providers: [
    GuidanceRequestsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: GuidanceResponseInterceptor,
    },
  ],
  exports: [GuidanceRequestsService],
})
export class GuidanceRequestsModule {}
