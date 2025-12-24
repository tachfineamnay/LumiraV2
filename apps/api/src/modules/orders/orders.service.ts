import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService,
    ) { }

    async create(createOrderDto: CreateOrderDto, authenticatedUserId?: string): Promise<any> {
        // 1. Resolve or Create User
        let userId = authenticatedUserId;
        if (!userId) {
            const user = await this.prisma.user.upsert({
                where: { email: createOrderDto.email },
                update: {},
                create: {
                    email: createOrderDto.email,
                    firstName: createOrderDto.firstName,
                    lastName: createOrderDto.lastName,
                },
            });
            userId = user.id;
        }

        // 2. Map level (String/Type to Int for Prisma)
        const levelMap: Record<string, number> = {
            'INITIE': 1,
            'MYSTIQUE': 2,
            'PROFOND': 3,
            'INTEGRALE': 4
        };

        const orderNumber = await this.generateOrderNumber();

        // 3. Extract form data
        const { email, firstName, lastName, totalAmount, type, ...formData } = createOrderDto;

        return this.prisma.order.create({
            data: {
                orderNumber,
                userId,
                userEmail: email,
                userName: `${firstName} ${lastName}`,
                level: levelMap[type] || 1,
                amount: totalAmount,
                formData: formData as any,
                status: 'PENDING',
            },
        });
    }

    async findAll(userId: string): Promise<any> {
        return this.prisma.order.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string): Promise<any> {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: { files: true },
        });
        if (!order) {
            throw new NotFoundException(`Order with ID ${id} not found`);
        }
        return order;
    }

    async update(id: string, updateOrderDto: UpdateOrderDto) {
        const order = await this.prisma.order.update({
            where: { id },
            data: updateOrderDto as any,
            include: { user: true }
        }) as any;

        if (updateOrderDto.status === 'COMPLETED') {
            await this.notificationsService.sendContentReady(order, order.user);
        }

        return order;
    }

    private async generateOrderNumber(): Promise<string> {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const datePrefix = `LU${year}${month}${day}`;

        const count = await this.prisma.order.count({
            where: {
                orderNumber: {
                    startsWith: datePrefix,
                },
            },
        });

        const sequence = (count + 1).toString().padStart(3, '0');
        return `${datePrefix}${sequence}`;
    }
}
