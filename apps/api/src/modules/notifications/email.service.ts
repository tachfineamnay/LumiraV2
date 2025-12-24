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
        } catch (error: any) {
            this.logger.error(`Failed to send email to ${sendEmailDto.to}: ${error.message}`);
            // We don't throw here to avoid blocking the main flow as requested
        }
    }
}
