import {
  Controller,
  Get,
  Patch,
  Body,
  Request,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Param,
  Res,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { ReadingIntakeService } from './reading-intake.service';
import { EffectiveClientProfileService } from './effective-client-profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateOnboardingProgressDto, UpdateProfileDto } from './dto/update-profile.dto';
import {
  OnboardingPhotoKind,
  PrivateOnboardingPhotoService,
} from '../uploads/private-onboarding-photo.service';
import { S3Service } from '../uploads/s3.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly readingIntakeService: ReadingIntakeService,
    private readonly effectiveProfiles: EffectiveClientProfileService,
    private readonly privateOnboardingPhotoService: PrivateOnboardingPhotoService,
    private readonly s3Service: S3Service,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'EXPERT') {
      throw new ForbiddenException('Admin or Expert access required');
    }

    const skip = (page - 1) * limit;
    return this.usersService.findAll(skip, limit);
  }

  /**
   * GET /api/users/entitlements
   * Returns the authenticated user's capabilities based on their purchased products.
   */
  @Get('entitlements')
  @UseGuards(JwtAuthGuard)
  async getEntitlements(@Request() req: { user: { userId: string } }) {
    return this.usersService.getEntitlements(req.user.userId);
  }

  /** Streams the exact private photo referenced by the current order-scoped intake. */
  @Get('onboarding/photos/:kind')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async streamOnboardingPhoto(
    @Param('kind') kind: string,
    @Request() req: { user: { userId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const photoKind = this.parsePhotoKind(kind);
    const { stream, contentType, contentLength, etag, lastModified } =
      await this.privateOnboardingPhotoService.getPhotoStream({
        clientId: req.user.userId,
        kind: photoKind,
        actorType: 'client',
        actorId: req.user.userId,
        source: 'onboarding',
      });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (contentLength != null) res.setHeader('Content-Length', String(contentLength));
    if (etag) res.setHeader('ETag', etag);
    if (lastModified) res.setHeader('Last-Modified', lastModified.toUTCString());

    return new StreamableFile(stream);
  }

  /**
   * GET /api/users/profile/photos/:kind
   * Streams the latest effective face/palm photo. Approved complements override
   * the profile projection while the original sealed intake remains immutable.
   */
  @Get('profile/photos/:kind')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async streamOwnPhoto(
    @Param('kind') kind: string,
    @Request() req: { user: { userId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const photoKind = this.parsePhotoKind(kind);
    const data = await this.usersService.getUserProfile(req.user.userId);
    if (!data) throw new NotFoundException('Profil utilisateur non trouvé');

    const persistedReference =
      photoKind === 'face' ? data.profile?.facePhotoUrl ?? null : data.profile?.palmPhotoUrl ?? null;
    const storageRef = await this.effectiveProfiles.resolvePhotoReference(
      req.user.userId,
      photoKind,
      persistedReference,
    );
    if (!storageRef) throw new NotFoundException('Photo introuvable');

    const key = this.privateOnboardingPhotoService.parseStorageReference(
      storageRef,
      req.user.userId,
    );
    const object = await this.s3Service.getObject(key, 'uploads');
    const contentType = this.resolveContentType(object.contentType, key);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (object.contentLength != null) {
      res.setHeader('Content-Length', String(object.contentLength));
    }
    if (object.etag) res.setHeader('ETag', object.etag);
    if (object.lastModified) res.setHeader('Last-Modified', object.lastModified.toUTCString());

    return new StreamableFile(object.stream);
  }

  /** Returns the authenticated user's complete effective profile data. */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: { user: { userId: string } }) {
    const data = await this.usersService.getUserProfile(req.user.userId);
    if (!data) {
      throw new NotFoundException('Profil utilisateur non trouvé');
    }
    const effective = await this.effectiveProfiles.resolveProfile(
      req.user.userId,
      data.profile,
    );
    const profile = effective.profile;

    return {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.firstName,
      lastName: data.user.lastName,
      phone: data.user.phone,
      profile: profile
        ? {
            usageName: profile.usageName,
            birthDate: profile.birthDate,
            birthTime: profile.birthTime,
            birthPlace: profile.birthPlace,
            specificQuestion: profile.specificQuestion,
            objective: profile.objective,
            facePhotoUrl: profile.facePhotoUrl,
            palmPhotoUrl: profile.palmPhotoUrl,
            highs: profile.highs,
            lows: profile.lows,
            lifeEvents: profile.lifeEvents,
            lifeAreas: profile.lifeAreas,
            strongSide: profile.strongSide,
            weakSide: profile.weakSide,
            strongZone: profile.strongZone,
            weakZone: profile.weakZone,
            deliveryStyle: profile.deliveryStyle,
            pace: profile.pace,
            ailments: profile.ailments,
            fears: profile.fears,
            rituals: profile.rituals,
            profileCompleted: profile.profileCompleted,
            submittedAt: profile.submittedAt,
          }
        : null,
      effectiveSnapshot: effective.snapshotId
        ? {
            id: effective.snapshotId,
            revision: effective.snapshotRevision,
            effectiveAt: effective.effectiveAt,
          }
        : null,
      stats: data.stats,
    };
  }

  /** Returns the authenticated user's completed/delivered orders. */
  @Get('orders/completed')
  @UseGuards(JwtAuthGuard)
  async getCompletedOrders(@Request() req: { user: { userId: string } }) {
    return this.usersService.getCompletedOrders(req.user.userId);
  }

  /**
   * PATCH /api/users/profile
   * Normal profile edits remain possible outside an active reading. A completion
   * request is different: it atomically seals the client intake into the paid order.
   */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: { user: { userId: string } },
    @Body() updateData: UpdateProfileDto,
  ) {
    if (updateData.profileCompleted === true) {
      return this.readingIntakeService.seal(req.user.userId, updateData);
    }
    await this.readingIntakeService.assertProfileEditable(req.user.userId);
    return this.usersService.updateProfile(req.user.userId, updateData);
  }

  @Get('onboarding')
  @UseGuards(JwtAuthGuard)
  async getOnboardingProgress(@Request() req: { user: { userId: string } }) {
    return this.usersService.getOnboardingProgress(req.user.userId);
  }

  @Patch('onboarding')
  @UseGuards(JwtAuthGuard)
  async saveOnboardingProgress(
    @Request() req: { user: { userId: string } },
    @Body() dto: UpdateOnboardingProgressDto,
  ) {
    return this.usersService.saveOnboardingProgress(req.user.userId, dto);
  }

  private parsePhotoKind(kind: string): OnboardingPhotoKind {
    if (kind === 'face' || kind === 'palm') return kind;
    throw new BadRequestException('Type de photo invalide');
  }

  private resolveContentType(contentType: string | undefined, key: string): string {
    if (contentType === 'image/jpeg' || contentType === 'image/png' || contentType === 'image/webp') {
      return contentType;
    }
    const lowerKey = key.toLowerCase();
    if (lowerKey.endsWith('.png')) return 'image/png';
    if (lowerKey.endsWith('.webp')) return 'image/webp';
    if (lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg')) return 'image/jpeg';
    throw new BadRequestException('Type de photo invalide');
  }
}
