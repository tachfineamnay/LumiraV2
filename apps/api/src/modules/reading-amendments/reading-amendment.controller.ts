import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  StreamableFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Expert } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentExpert, Roles } from '../expert/decorators';
import { ExpertAuthGuard, RolesGuard } from '../expert/guards';
import { PrivateOnboardingPhotoService } from '../uploads/private-onboarding-photo.service';
import { S3Service } from '../uploads/s3.service';
import { CreateProfileFieldAmendmentDto } from './dto/profile-field-amendment.dto';
import {
  CreatePalmAmendmentDto,
  ReviewPalmAmendmentDto,
  SaveReadingAmendmentDraftDto,
  SubmitReadingAmendmentDto,
} from './dto/reading-amendment.dto';
import { ReadingAmendmentResponseInterceptor } from './reading-amendment-response.interceptor';
import { ReadingAmendmentFacade } from './reading-amendment.facade';

type PhotoKind = 'face' | 'palm';

@Controller('users/reading-amendments')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ReadingAmendmentResponseInterceptor)
export class ClientReadingAmendmentController {
  constructor(
    private readonly amendments: ReadingAmendmentFacade,
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
    @Body() dto: SaveReadingAmendmentDraftDto,
  ) {
    return this.amendments.saveDraft(req.user.userId, amendmentId, dto);
  }

  @Post(':id/submit')
  async submit(
    @Param('id') amendmentId: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: SubmitReadingAmendmentDto,
  ) {
    return this.amendments.submit(req.user.userId, amendmentId, dto);
  }

  @Get(':id/photo')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async streamOwnAmendmentPhoto(
    @Param('id') amendmentId: string,
    @Query('kind') kind: string | undefined,
    @Request() req: { user: { userId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const reference = await this.amendments.getPhotoReference({
      amendmentId,
      kind: this.parseOptionalPhotoKind(kind),
      userId: req.user.userId,
    });
    return this.streamPhoto(reference.storageRef, reference.userId, res);
  }

  private parseOptionalPhotoKind(kind?: string): PhotoKind | undefined {
    if (!kind) return undefined;
    if (kind === 'face' || kind === 'palm') return kind;
    throw new BadRequestException('Type de photo invalide');
  }

  private async streamPhoto(storageRef: string, userId: string, res: Response) {
    const key = this.privatePhotos.parseStorageReference(storageRef, userId);
    const object = await this.s3.getObject(key, 'uploads');
    const contentType = this.resolveContentType(object.contentType, key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
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

@Controller('expert/orders/:orderId/intake-completeness')
@UseGuards(ExpertAuthGuard, RolesGuard)
@Roles('EXPERT', 'ADMIN')
export class ExpertIntakeCompletenessController {
  constructor(private readonly amendments: ReadingAmendmentFacade) {}

  @Get()
  async get(@Param('orderId') orderId: string) {
    return this.amendments.getCompleteness(orderId);
  }
}

@Controller('expert/orders/:orderId/amendments')
@UseGuards(ExpertAuthGuard, RolesGuard)
@UseInterceptors(ReadingAmendmentResponseInterceptor)
@Roles('EXPERT', 'ADMIN')
export class ExpertReadingAmendmentController {
  constructor(
    private readonly amendments: ReadingAmendmentFacade,
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

  @Post('required-fields')
  async requestProfileFields(
    @Param('orderId') orderId: string,
    @CurrentExpert() expert: Expert,
    @Body() dto: CreateProfileFieldAmendmentDto,
  ) {
    return this.amendments.requestProfileFields(orderId, expert.id, dto);
  }

  @Post(':id/approve')
  async approve(
    @Param('orderId') orderId: string,
    @Param('id') amendmentId: string,
    @CurrentExpert() expert: Expert,
    @Body() dto: ReviewPalmAmendmentDto,
  ) {
    return this.amendments.approve(orderId, amendmentId, expert.id, dto);
  }

  @Post(':id/reject')
  async reject(
    @Param('orderId') orderId: string,
    @Param('id') amendmentId: string,
    @CurrentExpert() expert: Expert,
    @Body() dto: ReviewPalmAmendmentDto,
  ) {
    return this.amendments.reject(orderId, amendmentId, expert.id, dto);
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
    @Query('kind') kind: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reference = await this.amendments.getPhotoReference({
      amendmentId,
      orderId,
      kind: this.parseOptionalPhotoKind(kind),
    });
    const key = this.privatePhotos.parseStorageReference(reference.storageRef, reference.userId);
    const object = await this.s3.getObject(key, 'uploads');
    const contentType = this.resolveContentType(object.contentType, key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (object.contentLength != null) res.setHeader('Content-Length', String(object.contentLength));
    if (object.etag) res.setHeader('ETag', object.etag);
    if (object.lastModified) res.setHeader('Last-Modified', object.lastModified.toUTCString());
    return new StreamableFile(object.stream);
  }

  private parseOptionalPhotoKind(kind?: string): PhotoKind | undefined {
    if (!kind) return undefined;
    if (kind === 'face' || kind === 'palm') return kind;
    throw new BadRequestException('Type de photo invalide');
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
