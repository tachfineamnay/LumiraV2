import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./modules/users/users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";

import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ExpertModule } from "./modules/expert/expert.module";
import { ProductsModule } from "./modules/products/products.module";
import { InsightsModule } from "./modules/insights/insights.module";
import { ClientModule } from "./modules/client/client.module";
import { ServicesModule } from "./services/services.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"]
    }),
    // Rate limiting - 100 requests per 60 seconds (more permissive for polling)
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
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
    ProductsModule,
    InsightsModule,
    ClientModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ]
})
export class AppModule { }
