import { Module, Global } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { ConfigService, ConfigModule } from '@nestjs/config';

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return fallback;
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        const host = config.get<string>('SMTP_HOST')?.trim();
        const port = parsePositiveInteger(config.get('SMTP_PORT'), 587);
        const secure = parseBoolean(config.get('SMTP_SECURE'), port === 465);
        const requireTLS = parseBoolean(config.get('SMTP_REQUIRE_TLS'), false);

        return {
          transport: {
            host,
            port,
            secure,
            requireTLS,
            auth: {
              user: config.get<string>('SMTP_USER'),
              pass: config.get<string>('SMTP_PASS'),
            },
            connectionTimeout: parsePositiveInteger(
              config.get('SMTP_CONNECTION_TIMEOUT_MS'),
              10_000,
            ),
            greetingTimeout: parsePositiveInteger(config.get('SMTP_GREETING_TIMEOUT_MS'), 10_000),
            socketTimeout: parsePositiveInteger(config.get('SMTP_SOCKET_TIMEOUT_MS'), 30_000),
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
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [NotificationsService, EmailService],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
