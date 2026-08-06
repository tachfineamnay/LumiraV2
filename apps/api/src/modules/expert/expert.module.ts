import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExpertController } from './expert.controller';
import { ProductionControlController } from './production-control.controller';
import { ClientControlController } from './client-control.controller';
import { ClientPurgeController } from './client-purge.controller';
import { AiProductionReadinessController } from './ai-production-readiness.controller';
import { ReadingWorkspaceController } from './reading-workspace.controller';
import { ExpertService } from './expert.service';
import { ExpertOrderPhotoService } from './expert-order-photo.service';
import { ClientPurgeService } from './client-purge.service';
import { AdminSettingsService } from './admin-settings.service';
import { AiProviderDiagnosticsService } from './ai-provider-diagnostics.service';
import { AiProductionReadinessService } from './ai-production-readiness.service';
import { AiModelCatalogService } from './ai-model-catalog.service';
import { ExpertAdminBootstrapService } from './expert-admin-bootstrap.service';
import { ExpertAuthGuard } from './guards/expert-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ExpertGateway } from './expert.gateway';
import { IdGenerator } from '../../utils/IdGenerator';
import { ServicesModule } from '../../services/services.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ProductionControlService } from './production-control.service';
import { ProductionQueueInterceptor } from './production-queue.interceptor';
import { ProductionCancelInterceptor } from './production-cancel.interceptor';
import { DeliveryRecoveryInterceptor } from './delivery-recovery.interceptor';
import { ProductionPaidRecoveryService } from './production-paid-recovery.service';
import { ClientControlService } from './client-control.service';
import { ReadingCalculationsService } from './reading-calculations.service';
import { ReadingWorkspaceService } from './reading-workspace.service';

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
  controllers: [
    ExpertController,
    ProductionControlController,
    ClientControlController,
    ClientPurgeController,
    AiProductionReadinessController,
    ReadingWorkspaceController,
  ],
  providers: [
    ExpertService,
    ExpertOrderPhotoService,
    ClientPurgeService,
    AdminSettingsService,
    AiProviderDiagnosticsService,
    AiProductionReadinessService,
    AiModelCatalogService,
    ExpertAdminBootstrapService,
    ExpertAuthGuard,
    RolesGuard,
    ExpertGateway,
    IdGenerator,
    ProductionControlService,
    ProductionPaidRecoveryService,
    ClientControlService,
    ReadingCalculationsService,
    ReadingWorkspaceService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ProductionQueueInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ProductionCancelInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DeliveryRecoveryInterceptor,
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
    AiProviderDiagnosticsService,
    AiProductionReadinessService,
    ReadingCalculationsService,
    ReadingWorkspaceService,
    JwtModule,
  ],
})
export class ExpertModule {}
