import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginClientDto, LoginExpertDto } from './dto/login.dto';
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

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@Request() req) {
        return this.authService.getMe(req.user);
    }
}
