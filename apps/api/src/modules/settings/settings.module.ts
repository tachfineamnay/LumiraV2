import { Module } from '@nestjs/common';
import { AiRoutingService } from './ai-routing.service';
import { AiRoutingController } from './ai-routing.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExpertAuthGuard } from '../expert/guards/expert-auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') as any,
        },
      }),
    }),
  ],
  controllers: [AiRoutingController],
  providers: [AiRoutingService, ExpertAuthGuard],
  exports: [AiRoutingService],
})
export class SettingsModule {}
