import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { SendEmailDto } from './dto/send-email.dto';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(private readonly mailerService: MailerService) { }

    async send(sendEmailDto: SendEmailDto) {
        try {
            await this.mailerService.sendMail({
                to: sendEmailDto.to,
                subject: sendEmailDto.subject,
                template: sendEmailDto.template,
                context: sendEmailDto.context,
            });
            this.logger.log(`Email sent to ${sendEmailDto.to} with template ${sendEmailDto.template}`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isConnRefused = errorMessage.includes('ECONNREFUSED');

            if (isConnRefused && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV)) {
                this.logger.warn(`[DEV] Email sending failed (Connection Refused). Is SMTP server running? suppressing error to allow flow to continue.`);
            } else {
                this.logger.error(`Failed to send email to ${sendEmailDto.to}: ${errorMessage}`);
            }
            // We don't throw here to avoid blocking the main flow as requested
        }
    }
}
