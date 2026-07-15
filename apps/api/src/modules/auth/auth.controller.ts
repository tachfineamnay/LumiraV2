import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginExpertDto } from './dto/login.dto';
import { SanctuaireAuthDto, SanctuaireMagicLinkDto } from './dto/sanctuaire-v2.dto';
import { SanctuaireRegisterDto } from './dto/sanctuaire-register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login/expert')
  async loginExpert(@Request() req, @Body() dto: LoginExpertDto) {
    // Passport local strategy handles validation and attaches expert to req.user
    void dto;
    return this.authService.login(req.user, 'expert');
  }

  /**
   * POST /api/auth/sanctuaire/register
   * Pre-registers a Sanctuaire client (create-if-missing). Does NOT return a JWT.
   * Rate limited: 10 attempts per 60 seconds.
   */
  @Post('sanctuaire/register')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async registerSanctuaire(@Body() dto: SanctuaireRegisterDto) {
    return this.authService.registerSanctuaire(dto);
  }

  @Post('sanctuaire-v2')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  async requestSanctuaireMagicLink(@Body() dto: SanctuaireAuthDto) {
    return this.authService.requestSanctuaireMagicLink(dto.email);
  }

  @Post('sanctuaire/consume-link')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async consumeSanctuaireMagicLink(@Body() dto: SanctuaireMagicLinkDto) {
    return this.authService.consumeSanctuaireMagicLink(dto.token);
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    return this.authService.getMe(req.user);
  }
}
