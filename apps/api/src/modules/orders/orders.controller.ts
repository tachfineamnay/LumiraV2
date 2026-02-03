import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
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
    }
}

@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    create(@Body() createOrderDto: CreateOrderDto, @Request() req: AuthenticatedRequest): Promise<Order> {
        // Authenticated user is optional for guest checkout
        const userId = req.user?.userId;
        return this.ordersService.create(createOrderDto, userId);
    }

    /**
     * Get most recent order by email (for upsell flow after payment)
     * Public endpoint - only returns orderId if paid within last hour
     */
    @Get('recent')
    async getRecentOrder(@Query('email') email: string) {
        if (!email) {
            throw new HttpException('Email required', HttpStatus.BAD_REQUEST);
        }
        
        const order = await this.ordersService.findRecentByEmail(email);
        if (!order) {
            return { found: false };
        }
        
        // Only return minimal data for security
        return {
            found: true,
            orderId: order.id,
            level: order.level,
            amount: order.amount,
            paidAt: order.paidAt
        };
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get()
    @Roles('CLIENT', 'EXPERT', 'ADMIN')
    findAll(@Request() req: AuthenticatedRequest): Promise<Order[]> {
        if (req.user.role === 'CLIENT') {
            return this.ordersService.findAll(req.user.userId);
        }
        return this.ordersService.findAll(req.user.userId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get(':id')
    @Roles('CLIENT', 'EXPERT', 'ADMIN')
    findOne(@Param('id') id: string): Promise<Order> {
        return this.ordersService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id')
    @Roles('EXPERT', 'ADMIN')
    update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto): Promise<Order> {
        return this.ordersService.update(id, updateOrderDto);
    }
}
