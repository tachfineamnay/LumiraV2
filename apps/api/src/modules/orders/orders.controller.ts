import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    create(@Body() createOrderDto: CreateOrderDto, @Request() req): Promise<any> {
        // Authenticated user is optional for guest checkout
        const userId = req.user?.userId;
        return this.ordersService.create(createOrderDto, userId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get()
    @Roles('CLIENT', 'EXPERT', 'ADMIN')
    findAll(@Request() req): Promise<any> {
        if (req.user.role === 'CLIENT') {
            return this.ordersService.findAll(req.user.userId);
        }
        return this.ordersService.findAll(req.user.userId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get(':id')
    @Roles('CLIENT', 'EXPERT', 'ADMIN')
    findOne(@Param('id') id: string): Promise<any> {
        return this.ordersService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id')
    @Roles('EXPERT', 'ADMIN')
    update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto): Promise<any> {
        return this.ordersService.update(id, updateOrderDto);
    }
}
