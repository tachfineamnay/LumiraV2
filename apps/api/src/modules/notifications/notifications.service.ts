import { Injectable } from '@nestjs/common';
import { EmailService } from './email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Order, User, NotificationType, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import {
    OrderConfirmationContext,
    ExpertAlertContext,
    ContentReadyContext,
    ReminderContext,
    ExpertValidationContext
} from './dto/send-email.dto';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly emailService: EmailService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    async sendOrderConfirmation(order: Order, user: User) {
        const context: OrderConfirmationContext = {
            firstName: user.firstName,
            orderNumber: order.orderNumber,
            level: 'Abonné',
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

        const frontendUrl = this.configService.get('FRONTEND_URL') || process.env.FRONTEND_URL || 'http://localhost:3000';
        const adminUrl = `${frontendUrl}/expert`;

        for (const expert of experts) {
            const context: ExpertAlertContext = {
                orderNumber: order.orderNumber,
                clientName: order.userName || 'Client',
                level: 'Abonné',
                createdAt: new Date(order.createdAt).toLocaleString('fr-FR'),
                adminUrl,
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

    async sendExpertValidation(order: Order, user: User, expertName: string) {
        const context: ExpertValidationContext = {
            firstName: user.firstName,
            orderNumber: order.orderNumber,
            expertName: expertName,
            levelName: 'Abonné',
            validatedAt: new Date().toLocaleString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            sanctuaireLink: `${process.env.FRONTEND_URL}/sanctuaire`,
        };

        // Send email
        await this.emailService.send({
            to: user.email,
            subject: `👁️ ${expertName} a validé votre lecture`,
            template: 'expert-validation',
            context,
        });

        // Create in-app notification
        await this.createNotification({
            userId: user.id,
            type: NotificationType.EXPERT_VALIDATION,
            title: `${expertName} a validé votre lecture`,
            message: `Votre lecture spirituelle (${order.orderNumber}) a été finalisée et validée par ${expertName}. Elle vous attend dans votre Sanctuaire.`,
            metadata: {
                expertName,
                orderId: order.id,
                orderNumber: order.orderNumber,
                level: 4,
            },
        });
    }

    // ========================================
    // In-App Notifications
    // ========================================

    async createNotification(data: {
        userId: string;
        type: NotificationType;
        title: string;
        message: string;
        metadata?: Record<string, unknown>;
    }) {
        return this.prisma.notification.create({
            data: {
                userId: data.userId,
                type: data.type,
                title: data.title,
                message: data.message,
                metadata: data.metadata as Prisma.InputJsonValue | undefined,
            },
        });
    }

    async getUserNotifications(userId: string, limit = 10) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async getUnreadCount(userId: string) {
        return this.prisma.notification.count({
            where: { userId, read: false },
        });
    }

    async markAsRead(notificationId: string, userId: string) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { read: true, readAt: new Date() },
        });
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true, readAt: new Date() },
        });
    }
}
