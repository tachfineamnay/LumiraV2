import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"]
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    OrdersModule,
    PaymentsModule,
    UploadsModule,
    WebhooksModule,
    NotificationsModule,
    ExpertModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule { }
