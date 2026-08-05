import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExpertModule } from '../expert/expert.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import {
  ClientReadingAmendmentController,
  ExpertIntakeCompletenessController,
  ExpertReadingAmendmentController,
} from './reading-amendment.controller';
import { IntakeCompletenessService } from './intake-completeness.service';
import { ProfileFieldAmendmentClientService } from './profile-field-amendment-client.service';
import { ProfileFieldAmendmentRequestService } from './profile-field-amendment-request.service';
import { ProfileFieldAmendmentReviewService } from './profile-field-amendment-review.service';
import { ProfileFieldAmendmentService } from './profile-field-amendment.service';
import { ProfileFieldRevisionService } from './profile-field-revision.service';
import { ReadingAmendmentFacade } from './reading-amendment.facade';
import { ReadingAmendmentResponseInterceptor } from './reading-amendment-response.interceptor';
import { ReadingAmendmentService } from './reading-amendment.service';

@Module({
  imports: [PrismaModule, UploadsModule, ExpertModule, NotificationsModule],
  controllers: [
    ClientReadingAmendmentController,
    ExpertIntakeCompletenessController,
    ExpertReadingAmendmentController,
  ],
  providers: [
    ReadingAmendmentService,
    ProfileFieldAmendmentService,
    ProfileFieldAmendmentRequestService,
    ProfileFieldAmendmentClientService,
    ProfileFieldAmendmentReviewService,
    ProfileFieldRevisionService,
    IntakeCompletenessService,
    ReadingAmendmentFacade,
    {
      provide: APP_INTERCEPTOR,
      useClass: ReadingAmendmentResponseInterceptor,
    },
  ],
  exports: [ReadingAmendmentFacade, IntakeCompletenessService],
})
export class ReadingAmendmentModule {}
