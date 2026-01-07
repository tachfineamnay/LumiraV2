import { Controller, Post, Body, UseGuards, Get, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginClientDto, LoginExpertDto } from './dto/login.dto';
import { SanctuaireAuthDto } from './dto/sanctuaire-v2.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login/client')
    async loginClient(@Body() loginDto: LoginClientDto) {
        const user = await this.authService.validateClient(loginDto.email);
        return this.authService.login(user, 'client');
    }

    @UseGuards(LocalAuthGuard)
    @Post('login/expert')
    async loginExpert(@Request() req, @Body() dto: LoginExpertDto) {
        // Passport local strategy handles validation and attaches expert to req.user
        void dto;
        return this.authService.login(req.user, 'expert');
    }

    /**
     * POST /api/auth/sanctuaire-v2
     * Passwordless authentication for Sanctuaire clients.
     * Validates email against paid orders.
     * Rate limited: 5 attempts per 60 seconds.
     */
    @Post('sanctuaire-v2')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async authenticateSanctuaire(@Body() dto: SanctuaireAuthDto) {
        return this.authService.authenticateSanctuaire(dto.email);
    }

    @SkipThrottle()
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@Request() req) {
        return this.authService.getMe(req.user);
    }
}
