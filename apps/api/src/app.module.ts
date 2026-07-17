import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ExpertModule } from './modules/expert/expert.module';
import { ProductsModule } from './modules/products/products.module';
import { InsightsModule } from './modules/insights/insights.module';
import { ClientModule } from './modules/client/client.module';
import { ReadingsModule } from './modules/readings/readings.module';
import { ServicesModule } from './services/services.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { DreamsModule } from './modules/dreams/dreams.module';
import { SettingsModule } from './modules/settings/settings.module';
import { GuidanceRequestsModule } from './modules/guidance-requests/guidance-requests.module';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { validateEnvironment } from './config/validate-env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    ServicesModule,
    UsersModule,
    AuthModule,
    OrdersModule,
    PaymentsModule,
    UploadsModule,
    WebhooksModule,
    NotificationsModule,
    ExpertModule,
    GuidanceRequestsModule,
    ProductsModule,
    InsightsModule,
    ClientModule,
    ReadingsModule,
    SubscriptionsModule,
    DreamsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
