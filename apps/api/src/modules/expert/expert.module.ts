import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ExpertController } from './expert.controller';
import { ExpertService } from './expert.service';
import { AdminSettingsService } from './admin-settings.service';
import { ExpertAuthGuard } from './guards/expert-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
    imports: [
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    expiresIn: configService.get<string>('JWT_EXPIRES_IN', '8h') as any,
                },
            }),
        }),
        ThrottlerModule.forRoot([
            {
                name: 'default',
                ttl: 900000, // 15 minutes
                limit: 10,
            },
        ]),
    ],
    controllers: [ExpertController],
    providers: [
        ExpertService,
        AdminSettingsService,
        ExpertAuthGuard,
        RolesGuard,
        PrismaService,
    ],
    exports: [ExpertService],
})
export class ExpertModule { }
