import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Order } from '@prisma/client';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  create(
    @Body() createOrderDto: CreateOrderDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<Order> {
    return this.ordersService.create(createOrderDto, req.user.userId);
  }

  /**
   * Get most recent PAID order for the authenticated client (upsell after payment).
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('recent')
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  async getRecentOrder(@Request() req: AuthenticatedRequest) {
    const order = await this.ordersService.findRecentForUser(req.user.userId);
    if (!order) {
      return { found: false };
    }

    return {
      found: true,
      orderId: order.id,
      amount: order.amount,
      paidAt: order.paidAt,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  findAll(@Request() req: AuthenticatedRequest): Promise<Order[]> {
    if (req.user.role === 'CLIENT') {
      return this.ordersService.findAll(req.user.userId);
    }
    return this.ordersService.findAllForDesk();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<Order> {
    return this.ordersService.findOne(id, req.user.userId, req.user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles('EXPERT', 'ADMIN')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto): Promise<Order> {
    return this.ordersService.update(id, updateOrderDto);
  }
}
