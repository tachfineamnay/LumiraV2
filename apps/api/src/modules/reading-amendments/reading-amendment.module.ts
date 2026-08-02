import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExpertModule } from '../expert/expert.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import {
  ClientReadingAmendmentController,
  ExpertReadingAmendmentController,
} from './reading-amendment.controller';
import { ReadingAmendmentFacade } from './reading-amendment.facade';
import { ReadingAmendmentService } from './reading-amendment.service';

@Module({
  imports: [PrismaModule, UploadsModule, ExpertModule, NotificationsModule],
  controllers: [ClientReadingAmendmentController, ExpertReadingAmendmentController],
  providers: [ReadingAmendmentService, ReadingAmendmentFacade],
  exports: [ReadingAmendmentFacade],
})
export class ReadingAmendmentModule {}
