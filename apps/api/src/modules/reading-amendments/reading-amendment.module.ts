import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExpertModule } from '../expert/expert.module';
import { UploadsModule } from '../uploads/uploads.module';
import {
  ClientReadingAmendmentController,
  ExpertReadingAmendmentController,
} from './reading-amendment.controller';
import { ReadingAmendmentFacade } from './reading-amendment.facade';
import { ReadingAmendmentService } from './reading-amendment.service';

@Module({
  imports: [PrismaModule, UploadsModule, ExpertModule],
  controllers: [ClientReadingAmendmentController, ExpertReadingAmendmentController],
  providers: [ReadingAmendmentService, ReadingAmendmentFacade],
  exports: [ReadingAmendmentService, ReadingAmendmentFacade],
})
export class ReadingAmendmentModule {}
