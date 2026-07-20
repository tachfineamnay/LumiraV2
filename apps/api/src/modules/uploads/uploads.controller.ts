import {
  BadRequestException,
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Request,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateOnboardingPhotoDto } from '../users/dto/update-profile.dto';

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private readonly s3Service: S3Service) {}

  @Roles('CLIENT')
  @Post('onboarding-presign')
  async getOnboardingPhotoPresign(
    @Request() req: { user: { userId: string } },
    @Body() body: CreateOnboardingPhotoDto,
  ) {
    const extensionByMime = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    } as const;
    const extension = extensionByMime[body.contentType];
    if (!extension) {
      throw new BadRequestException('Format de photo non autorisé');
    }

    const key = `onboarding/${req.user.userId}/${body.kind.toLowerCase()}-${randomUUID()}.${extension}`;
    const expiresIn = 600;
    const uploadUrl = await this.s3Service.getUploadPresignedUrl(key, body.contentType, expiresIn);
    return { uploadUrl, key, storageRef: `s3://${key}`, expiresIn };
  }

  @Roles('CLIENT')
  @Post('presign')
  async getPresignUrl(@Body() body: { fileName: string; contentType: string; orderId: string }) {
    const key = `orders/${body.orderId}/${Date.now()}-${body.fileName}`;
    const url = await this.s3Service.getUploadPresignedUrl(key, body.contentType);
    return { url, key };
  }

  // Client media has dedicated ownership-checked routes. This legacy generic
  // signer remains available to the Desk only; a client must never turn an
  // arbitrary object key into a private download URL.
  @Roles('EXPERT', 'ADMIN')
  @Get('signed-url')
  async getSignedUrl(
    @Query('key') key: string,
    @Query('bucket') bucket: 'uploads' | 'readings' = 'readings',
  ) {
    const url = await this.s3Service.getDownloadPresignedUrl(key, bucket);
    return { url };
  }
}
