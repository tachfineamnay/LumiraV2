import { Module, Global } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { ConfigService, ConfigModule } from '@nestjs/config';

@Global()
@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (config: ConfigService) => ({
                transport: {
                    host: config.get('SMTP_HOST'),
                    port: config.get('SMTP_PORT', 587),
                    auth: {
                        user: config.get('SMTP_USER'),
                        pass: config.get('SMTP_PASS'),
                    },
                },
                defaults: {
                    from: `"Oracle Lumira" <${config.get('MAIL_FROM', 'noreply@oraclelumira.com')}>`,
                },
                template: {
                    dir: join(__dirname, 'templates'),
                    adapter: new HandlebarsAdapter(),
                    options: {
                        strict: true,
                    },
                },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [NotificationsService, EmailService],
    exports: [NotificationsService],
})
export class NotificationsModule { }
