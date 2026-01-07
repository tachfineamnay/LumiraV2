import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ExpertService } from './expert.service';
import { ExpertAuthGuard, RolesGuard } from './guards';
import { Expert } from '@prisma/client';
import { CurrentExpert, Public, Roles } from './decorators';
import {
    LoginExpertDto,
    RegisterExpertDto,
    ValidateContentDto,
    ProcessOrderDto,
    UpdateClientDto,
    PaginationDto,
} from './dto';

@Controller('expert')
@UseGuards(ExpertAuthGuard, RolesGuard)
export class ExpertController {
    constructor(private readonly expertService: ExpertService) { }

    // ========================
    // AUTHENTICATION
    // ========================

    @Post('login')
    @Public()
    @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 requests per 15 minutes
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginExpertDto) {
        return this.expertService.login(dto);
    }

    @Post('register')
    @Roles('ADMIN')
    async register(@Body() dto: RegisterExpertDto) {
        return this.expertService.register(dto);
    }

    @Get('verify')
    async verify(@CurrentExpert() expert: Expert) {
        return { valid: true, expert: { id: expert.id, email: expert.email, role: expert.role } };
    }

    @Post('refresh')
    @Public()
    @HttpCode(HttpStatus.OK)
    async refresh(@Body('refreshToken') refreshToken: string) {
        return this.expertService.refreshToken(refreshToken);
    }

    @Get('profile')
    async getProfile(@CurrentExpert() expert: Expert) {
        return this.expertService.getProfile(expert.id);
    }

    // ========================
    // ORDERS
    // ========================

    @Get('orders')
    async getOrders(@Query() query: PaginationDto) {
        return this.expertService.getPendingOrders(query);
    }

    @Get('orders/pending')
    async getPendingOrders(@Query() query: PaginationDto) {
        return this.expertService.getPendingOrders(query);
    }

    @Get('orders/processing')
    async getProcessingOrders(@Query() query: PaginationDto) {
        return this.expertService.getProcessingOrders(query);
    }

    @Get('orders/validation')
    async getValidationQueue(@Query() query: PaginationDto) {
        return this.expertService.getValidationQueue(query);
    }

    @Get('orders/history')
    async getOrderHistory(@Query() query: PaginationDto) {
        return this.expertService.getOrderHistory(query);
    }

    @Get('orders/:id')
    async getOrderById(@Param('id') id: string) {
        return this.expertService.getOrderById(id);
    }

    @Post('orders/:id/assign')
    async assignOrder(@Param('id') id: string, @CurrentExpert() expert: Expert) {
        return this.expertService.assignOrder(id, expert.id);
    }

    @Delete('orders/:id')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteOrder(@Param('id') id: string) {
        await this.expertService.deleteOrder(id);
    }

    // ========================
    // ORDER PROCESSING
    // ========================

    @Post('process-order')
    async processOrder(@Body() dto: ProcessOrderDto, @CurrentExpert() expert: Expert) {
        return this.expertService.processOrder(dto, expert);
    }

    @Post('validate-content')
    async validateContent(@Body() dto: ValidateContentDto, @CurrentExpert() expert: Expert) {
        return this.expertService.validateContent(dto, expert);
    }

    @Post('regenerate')
    async regenerateLecture(@Body('orderId') orderId: string, @CurrentExpert() expert: Expert) {
        return this.expertService.regenerateLecture(orderId, expert);
    }

    // ========================
    // CLIENTS
    // ========================

    @Get('clients')
    async getClients(@Query() query: PaginationDto) {
        return this.expertService.getClients(query);
    }

    @Get('clients/:id')
    async getClientById(@Param('id') id: string) {
        return this.expertService.getClientById(id);
    }

    @Get('clients/:id/stats')
    async getClientStats(@Param('id') id: string) {
        return this.expertService.getClientStats(id);
    }

    @Get('clients/:id/orders')
    async getClientOrders(@Param('id') id: string, @Query() query: PaginationDto) {
        return this.expertService.getClientOrders(id, query);
    }

    @Patch('clients/:id')
    async updateClient(@Param('id') id: string, @Body() dto: UpdateClientDto) {
        return this.expertService.updateClient(id, dto);
    }

    @Delete('clients/:id')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteClient(@Param('id') id: string) {
        await this.expertService.deleteClient(id);
    }

    // ========================
    // FILES
    // ========================

    @Get('files/presign')
    async getPresignedUrl(@Query('url') url: string) {
        const signedUrl = await this.expertService.getPresignedUrl(url);
        return { url: signedUrl };
    }

    // ========================
    // STATS
    // ========================

    @Get('stats')
    async getStats() {
        return this.expertService.getStats();
    }
}
