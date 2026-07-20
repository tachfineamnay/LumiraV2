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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateOnboardingProgressDto, UpdateProfileDto } from './dto/update-profile.dto';
import {
  OnboardingPhotoKind,
  PrivateOnboardingPhotoService,
} from '../uploads/private-onboarding-photo.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly readingIntakeService: ReadingIntakeService,
    private readonly privateOnboardingPhotoService: PrivateOnboardingPhotoService,
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

  /**
   * GET /api/users/profile/photos/:kind
   * Streams the authenticated client's private face/palm photo.
   * Ownership is always taken from the JWT — never from query params.
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
    const { stream, contentType, contentLength, etag, lastModified } =
      await this.privateOnboardingPhotoService.getPhotoStream({
        clientId: req.user.userId,
        kind: photoKind,
        actorType: 'client',
        actorId: req.user.userId,
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

  /** Returns the authenticated user's complete profile data. */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: { user: { userId: string } }) {
    const data = await this.usersService.getUserProfile(req.user.userId);
    if (!data) {
      throw new NotFoundException('Profil utilisateur non trouvé');
    }
    return {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.firstName,
      lastName: data.user.lastName,
      phone: data.user.phone,
      profile: data.profile
        ? {
            birthDate: data.profile.birthDate,
            birthTime: data.profile.birthTime,
            birthPlace: data.profile.birthPlace,
            specificQuestion: data.profile.specificQuestion,
            objective: data.profile.objective,
            facePhotoUrl: data.profile.facePhotoUrl,
            palmPhotoUrl: data.profile.palmPhotoUrl,
            highs: data.profile.highs,
            lows: data.profile.lows,
            strongSide: data.profile.strongSide,
            weakSide: data.profile.weakSide,
            strongZone: data.profile.strongZone,
            weakZone: data.profile.weakZone,
            deliveryStyle: data.profile.deliveryStyle,
            pace: data.profile.pace,
            ailments: data.profile.ailments,
            fears: data.profile.fears,
            rituals: data.profile.rituals,
            profileCompleted: data.profile.profileCompleted,
            submittedAt: data.profile.submittedAt,
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
}
