import { Module } from '@nestjs/common';
import { ExpertModule } from '../expert/expert.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  ClientGuidanceRequestsController,
  ExpertGuidanceRequestsController,
} from './guidance-requests.controller';
import { GuidanceRequestsService } from './guidance-requests.service';

@Module({
  imports: [ExpertModule, NotificationsModule],
  controllers: [ClientGuidanceRequestsController, ExpertGuidanceRequestsController],
  providers: [GuidanceRequestsService],
  exports: [GuidanceRequestsService],
})
export class GuidanceRequestsModule {}
