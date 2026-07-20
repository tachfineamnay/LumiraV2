import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Order, Prisma } from '@prisma/client';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { IdGenerator } from '../../utils/IdGenerator';
import { NotificationsService } from '../notifications/notifications.service';

/** Server catalog for guest/authenticated order creation — never trust client totals */
const ORDER_AMOUNT_CENTS = 2900;

/**
 * Expert/desk may move workflow statuses, but PAID is webhook-only.
 * Schema uses REFUNDED (not CANCELLED).
 */
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['REFUNDED'],
  PAID: ['PROCESSING'],
  PROCESSING: ['AWAITING_VALIDATION', 'FAILED'],
  AWAITING_VALIDATION: ['COMPLETED', 'PROCESSING'],
  COMPLETED: [],
  FAILED: ['PROCESSING'],
  REFUNDED: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private idGenerator: IdGenerator,
  ) {}

  async create(createOrderDto: CreateOrderDto, authenticatedUserId?: string): Promise<Order> {
    let userId = authenticatedUserId;
    if (!userId) {
      const normalizedEmail = createOrderDto.email.toLowerCase().trim();
      const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        userId = existing.id;
      } else {
        const user = await this.prisma.user.create({
          data: {
            email: normalizedEmail,
            firstName: createOrderDto.firstName,
            lastName: createOrderDto.lastName,
          },
        });
        userId = user.id;
      }
    }

    const orderNumber = await this.generateOrderNumber();
    const { email, firstName, lastName, totalAmount: _ignored, ...formData } = createOrderDto;
    void _ignored;

    return this.prisma.order.create({
      data: {
        orderNumber,
        userId,
        userEmail: email.toLowerCase().trim(),
        userName: `${firstName} ${lastName}`,
        amount: ORDER_AMOUNT_CENTS,
        formData: formData as Prisma.JsonObject,
        status: 'PENDING',
        intakeRequired: true,
      },
    });
  }

  async findAll(userId: string): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllForDesk(): Promise<Order[]> {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, requestingUserId?: string, role?: string): Promise<Order> {
    const where: Prisma.OrderWhereUniqueInput =
      role === 'CLIENT' && requestingUserId ? { id, userId: requestingUserId } : { id };

    const order = await this.prisma.order.findUnique({
      where,
      include: { files: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const currentOrder = await this.prisma.order.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!currentOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (updateOrderDto.status === 'PAID') {
      throw new ForbiddenException('PAID status can only be set by the payment webhook');
    }

    if (updateOrderDto.status && updateOrderDto.status !== currentOrder.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[currentOrder.status] || [];
      if (!allowedTransitions.includes(updateOrderDto.status)) {
        throw new BadRequestException(
          `Cannot transition order from ${currentOrder.status} to ${updateOrderDto.status}. ` +
            `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`,
        );
      }
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: updateOrderDto as Prisma.OrderUpdateInput,
      include: { user: true },
    });

    if (updateOrderDto.status === 'COMPLETED') {
      await this.notificationsService.sendContentReady(order, order.user);
    }

    return order;
  }

  private async generateOrderNumber(): Promise<string> {
    return this.idGenerator.generateOrderNumber();
  }

  /**
   * Get most recent PAID order for the authenticated user (upsell flow).
   * Requires ownership — never lookup by email alone.
   */
  async findRecentForUser(userId: string): Promise<Order | null> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    return this.prisma.order.findFirst({
      where: {
        userId,
        status: 'PAID',
        paidAt: { gte: oneHourAgo },
      },
      orderBy: { paidAt: 'desc' },
    });
  }
}
