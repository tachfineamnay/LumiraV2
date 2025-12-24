import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { N8nCallbackDto, GeneratedContentDto } from './dto/n8n-callback.dto';
type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'AWAITING_VALIDATION' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

@Injectable()
export class N8nService {
    private readonly logger = new Logger(N8nService.name);

    constructor(private prisma: PrismaService) { }

    async handleCallback(dto: N8nCallbackDto): Promise<any> {
        this.logger.log(`Received callback for order ${dto.orderNumber} (ID: ${dto.orderId})`);

        const order = await this.validateOrder(dto.orderId);

        if (dto.status === 'failed') {
            this.logger.error(`Generation failed for order ${dto.orderNumber}`);
            await this.prisma.order.update({
                where: { id: dto.orderId },
                data: {
                    status: 'FAILED',
                    errorLog: 'n8n generation failed callback received',
                } as any,
            });
            return { status: 'acknowledged', error: 'Generation failed' };
        }

        return this.updateOrderContent(dto.orderId, dto.content);
    }

    private async validateOrder(orderId: string) {
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
                    },
                    status: 'AWAITING_VALIDATION',
                } as any,
            });

            this.logger.log(`Order ${orderId} updated successfully with generated content`);
            return updatedOrder;
        } catch (error: any) {
            this.logger.error(`Failed to update order ${orderId}: ${error.message}`);
            throw new BadRequestException('Failed to update order with generated content');
        }
    }
}
