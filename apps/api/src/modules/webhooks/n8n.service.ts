import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { N8nCallbackDto, GeneratedContentDto } from './dto/n8n-callback.dto';
import { Order, Prisma } from '@prisma/client';

@Injectable()
export class N8nService {
    private readonly logger = new Logger(N8nService.name);

    constructor(private prisma: PrismaService) { }

    async handleCallback(dto: N8nCallbackDto): Promise<Order | { status: string; error: string }> {
        this.logger.log(`Received callback for order ${dto.orderNumber} (ID: ${dto.orderId})`);

        await this.validateOrder(dto.orderId);

        if (dto.status === 'failed') {
            this.logger.error(`Generation failed for order ${dto.orderNumber}`);
            await this.prisma.order.update({
                where: { id: dto.orderId },
                data: {
                    status: 'FAILED',
                    errorLog: 'n8n generation failed callback received',
                },
            });
            return { status: 'acknowledged', error: 'Generation failed' };
        }

        return this.updateOrderContent(dto.orderId, dto.content);
    }

    private async validateOrder(orderId: string): Promise<Order> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new NotFoundException(`Order ${orderId} not found`);
        }

        const allowedStatuses: string[] = [
            'PAID',
            'PROCESSING',
        ];

        if (!allowedStatuses.includes(order.status)) {
            this.logger.warn(`Order ${orderId} is in status ${order.status}, cannot process callback`);
            throw new BadRequestException(`Order ${orderId} is in invalid status: ${order.status}`);
        }

        return order;
    }

    private async updateOrderContent(orderId: string, content: GeneratedContentDto) {
        try {
            const updatedOrder = await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    generatedContent: {
                        ...content,
                        generatedAt: new Date().toISOString(),
                    } as unknown as Prisma.JsonObject,
                    status: 'AWAITING_VALIDATION',
                },
            });

            return updatedOrder;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to update order ${orderId}: ${errorMessage}`);
            throw new BadRequestException('Failed to update order with generated content');
        }
    }
}
