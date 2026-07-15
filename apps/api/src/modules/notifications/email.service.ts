import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { SendEmailDto } from './dto/send-email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async send(sendEmailDto: SendEmailDto) {
    try {
      await this.sendOrThrow(sendEmailDto);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isConnRefused = errorMessage.includes('ECONNREFUSED');

      if (isConnRefused && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV)) {
        this.logger.warn(
          `[DEV] Email sending failed (Connection Refused). Is SMTP server running? suppressing error to allow flow to continue.`,
        );
      } else {
        this.logger.error(`Failed to send email to ${sendEmailDto.to}: ${errorMessage}`);
      }
      // Non-critical notifications must not block their caller.
    }
  }

  /**
   * Deliver a security-critical email (for example, a magic login link).
   * Unlike `send`, failure is intentionally propagated so the application
   * never claims that a link has been delivered when it has not.
   */
  async sendOrThrow(sendEmailDto: SendEmailDto): Promise<void> {
    await this.mailerService.sendMail({
      to: sendEmailDto.to,
      subject: sendEmailDto.subject,
      template: sendEmailDto.template,
      context: sendEmailDto.context,
    });
    this.logger.log(`Email sent to ${sendEmailDto.to} with template ${sendEmailDto.template}`);
  }
}
