import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExpertController } from './expert.controller';
import { ProductionControlController } from './production-control.controller';
import { ClientControlController } from './client-control.controller';
import { ExpertService } from './expert.service';
import { AdminSettingsService } from './admin-settings.service';
import { ExpertAuthGuard } from './guards/expert-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ExpertGateway } from './expert.gateway';
import { IdGenerator } from '../../utils/IdGenerator';
import { ServicesModule } from '../../services/services.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ProductionControlService } from './production-control.service';
import { ProductionQueueInterceptor } from './production-queue.interceptor';
import { ProductionCancelInterceptor } from './production-cancel.interceptor';
import { ProductionPaidRecoveryService } from './production-paid-recovery.service';
import { ClientControlService } from './client-control.service';

@Module({
  imports: [
    ConfigModule,
    ServicesModule,
    UploadsModule,
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
  ],
  controllers: [ExpertController, ProductionControlController, ClientControlController],
  providers: [
    ExpertService,
    AdminSettingsService,
    ExpertAuthGuard,
    RolesGuard,
    ExpertGateway,
    IdGenerator,
    ProductionControlService,
    ProductionPaidRecoveryService,
    ClientControlService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ProductionQueueInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ProductionCancelInterceptor,
    },
  ],
  exports: [
    ExpertService,
    ExpertGateway,
    IdGenerator,
    ExpertAuthGuard,
    RolesGuard,
    ProductionControlService,
    ClientControlService,
    JwtModule,
  ],
})
export class ExpertModule {}
