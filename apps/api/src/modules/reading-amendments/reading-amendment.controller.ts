import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Expert } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentExpert, Roles } from '../expert/decorators';
import { ExpertAuthGuard, RolesGuard } from '../expert/guards';
import { S3Service } from '../uploads/s3.service';
import { PrivateOnboardingPhotoService } from '../uploads/private-onboarding-photo.service';
import {
  CreatePalmAmendmentDto,
  ReviewPalmAmendmentDto,
  SavePalmAmendmentDraftDto,
  SubmitPalmAmendmentDto,
} from './dto/reading-amendment.dto';
import { ReadingAmendmentService } from './reading-amendment.service';

@Controller('users/reading-amendments')
@UseGuards(JwtAuthGuard)
export class ClientReadingAmendmentController {
  constructor(
    private readonly amendments: ReadingAmendmentService,
    private readonly privatePhotos: PrivateOnboardingPhotoService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  async list(@Request() req: { user: { userId: string } }) {
    return this.amendments.listForClient(req.user.userId);
  }

  @Patch(':id/draft')
  async saveDraft(
    @Param('id') amendmentId: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: SavePalmAmendmentDraftDto,
  ) {
    return this.amendments.savePalmDraft(req.user.userId, amendmentId, dto);
  }

  @Post(':id/submit')
  async submit(
    @Param('id') amendmentId: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: SubmitPalmAmendmentDto,
  ) {
    return this.amendments.submitPalm(req.user.userId, amendmentId, dto);
  }

  @Get(':id/photo')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async streamOwnAmendmentPhoto(
    @Param('id') amendmentId: string,
    @Request() req: { user: { userId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const reference = await this.amendments.getPhotoReference({
      amendmentId,
      userId: req.user.userId,
    });
    return this.streamPhoto(reference.storageRef, reference.userId, res);
  }

  private async streamPhoto(storageRef: string, userId: string, res: Response) {
    const key = this.privatePhotos.parseStorageReference(storageRef, userId);
    const object = await this.s3.getObject(key, 'uploads');
    const contentType = this.resolveContentType(object.contentType, key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (object.contentLength != null) res.setHeader('Content-Length', String(object.contentLength));
    if (object.etag) res.setHeader('ETag', object.etag);
    if (object.lastModified) res.setHeader('Last-Modified', object.lastModified.toUTCString());
    return new StreamableFile(object.stream);
  }

  private resolveContentType(contentType: string | undefined, key: string): string {
    if (contentType === 'image/jpeg' || contentType === 'image/png' || contentType === 'image/webp') {
      return contentType;
    }
    if (key.toLowerCase().endsWith('.png')) return 'image/png';
    if (key.toLowerCase().endsWith('.webp')) return 'image/webp';
    if (key.toLowerCase().endsWith('.jpg') || key.toLowerCase().endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    throw new BadRequestException('Type de photo invalide');
  }
}

@Controller('expert/orders/:orderId/amendments')
@UseGuards(ExpertAuthGuard, RolesGuard)
@Roles('EXPERT', 'ADMIN')
export class ExpertReadingAmendmentController {
  constructor(
    private readonly amendments: ReadingAmendmentService,
    private readonly privatePhotos: PrivateOnboardingPhotoService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  async list(@Param('orderId') orderId: string) {
    return this.amendments.listForExpert(orderId);
  }

  @Post('palm-photo')
  async requestPalmPhoto(
    @Param('orderId') orderId: string,
    @CurrentExpert() expert: Expert,
    @Body() dto: CreatePalmAmendmentDto,
  ) {
    return this.amendments.requestPalmPhoto(orderId, expert.id, dto);
  }

  @Post(':id/approve')
  async approve(
    @Param('orderId') orderId: string,
    @Param('id') amendmentId: string,
    @CurrentExpert() expert: Expert,
    @Body() dto: ReviewPalmAmendmentDto,
  ) {
    return this.amendments.approvePalm(orderId, amendmentId, expert.id, dto);
  }

  @Post(':id/reject')
  async reject(
    @Param('orderId') orderId: string,
    @Param('id') amendmentId: string,
    @CurrentExpert() expert: Expert,
    @Body() dto: ReviewPalmAmendmentDto,
  ) {
    return this.amendments.rejectPalm(orderId, amendmentId, expert.id, dto);
  }

  @Post(':id/retake')
  async requestRetake(
    @Param('orderId') orderId: string,
    @Param('id') amendmentId: string,
    @CurrentExpert() expert: Expert,
    @Body() dto: ReviewPalmAmendmentDto,
  ) {
    return this.amendments.requestRetake(orderId, amendmentId, expert.id, dto);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('orderId') orderId: string,
    @Param('id') amendmentId: string,
    @CurrentExpert() expert: Expert,
    @Body() dto: ReviewPalmAmendmentDto,
  ) {
    return this.amendments.cancel(orderId, amendmentId, expert.id, dto);
  }

  @Post(':id/create-revision')
  async createRevision(
    @Param('orderId') orderId: string,
    @Param('id') amendmentId: string,
    @CurrentExpert() expert: Expert,
    @Body() dto: ReviewPalmAmendmentDto,
  ) {
    return this.amendments.createRevisedReading(orderId, amendmentId, expert, dto);
  }

  @Get(':id/photo')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async streamAmendmentPhoto(
    @Param('orderId') orderId: string,
    @Param('id') amendmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reference = await this.amendments.getPhotoReference({ amendmentId, orderId });
    const key = this.privatePhotos.parseStorageReference(reference.storageRef, reference.userId);
    const object = await this.s3.getObject(key, 'uploads');
    const contentType = this.resolveContentType(object.contentType, key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (object.contentLength != null) res.setHeader('Content-Length', String(object.contentLength));
    if (object.etag) res.setHeader('ETag', object.etag);
    if (object.lastModified) res.setHeader('Last-Modified', object.lastModified.toUTCString());
    return new StreamableFile(object.stream);
  }

  private resolveContentType(contentType: string | undefined, key: string): string {
    if (contentType === 'image/jpeg' || contentType === 'image/png' || contentType === 'image/webp') {
      return contentType;
    }
    if (key.toLowerCase().endsWith('.png')) return 'image/png';
    if (key.toLowerCase().endsWith('.webp')) return 'image/webp';
    if (key.toLowerCase().endsWith('.jpg') || key.toLowerCase().endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    throw new BadRequestException('Type de photo invalide');
  }
}
