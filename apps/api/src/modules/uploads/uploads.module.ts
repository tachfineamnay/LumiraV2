import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { UploadsController } from './uploads.controller';
import { PrivateOnboardingPhotoService } from './private-onboarding-photo.service';

@Module({
  providers: [S3Service, PrivateOnboardingPhotoService],
  controllers: [UploadsController],
  exports: [S3Service, PrivateOnboardingPhotoService],
})
export class UploadsModule {}
