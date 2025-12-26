import { Injectable } from '@nestjs/common';
import { EmailService } from './email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Order, User } from '@prisma/client';
import {
    OrderConfirmationContext,
    ExpertAlertContext,
    ContentReadyContext,
    ReminderContext
} from './dto/send-email.dto';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly emailService: EmailService,
        private readonly prisma: PrismaService,
    ) { }

    private getLevelName(level: number): string {
        const levels = {
            1: 'Initié',
            2: 'Mystique',
            3: 'Profond',
            4: 'Intégrale'
        };
        return levels[level] || 'Lecture Spirituelle';
    }

    async sendOrderConfirmation(order: Order, user: User) {
        const context: OrderConfirmationContext = {
            firstName: user.firstName,
            orderNumber: order.orderNumber,
            level: this.getLevelName(order.level),
            amount: (order.amount / 100).toFixed(2),
            expectedDelivery: '24-48h',
        };

        await this.emailService.send({
            to: user.email,
            subject: `Commande ${order.orderNumber} confirmée - Oracle Lumira`,
            template: 'order-confirmation',
            context,
        });
    }

    async sendExpertAlert(order: Order) {
        const experts = await this.prisma.expert.findMany({
            where: { isActive: true },
        });

        for (const expert of experts) {
            const context: ExpertAlertContext = {
                orderNumber: order.orderNumber,
                clientName: order.userName || 'Client',
                level: this.getLevelName(order.level),
                createdAt: new Date(order.createdAt).toLocaleString('fr-FR'),
            };

            await this.emailService.send({
                to: expert.email,
                subject: `🔔 Nouvelle commande ${order.orderNumber} à valider`,
                template: 'expert-alert',
                context,
            });
        }
    }

    async sendContentReady(order: Order, user: User) {
        const context: ContentReadyContext = {
            firstName: user.firstName,
            orderNumber: order.orderNumber,
            sanctuaireLink: `${process.env.FRONTEND_URL}/sanctuaire`,
        };

        await this.emailService.send({
            to: user.email,
            subject: `✨ Votre lecture spirituelle est prête !`,
            template: 'content-ready',
            context,
        });
    }

    async sendReminder(order: Order, user: User) {
        const context: ReminderContext = {
            firstName: user.firstName,
            orderNumber: order.orderNumber,
            sanctuaireLink: `${process.env.FRONTEND_URL}/sanctuaire`,
        };

        await this.emailService.send({
            to: user.email,
            subject: `🌙 N'oubliez pas votre lecture spirituelle`,
            template: 'reminder',
            context,
        });
    }
}
