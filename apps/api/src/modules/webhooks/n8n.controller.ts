import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { N8nService } from './n8n.service';
import { N8nCallbackDto } from './dto/n8n-callback.dto';
import { HmacSignatureGuard } from './guards/hmac-signature.guard';
import { Order } from '@prisma/client';

@Controller('webhooks')
export class N8nController {
    constructor(private readonly n8nService: N8nService) { }

    @Post('n8n')
    @UseGuards(HmacSignatureGuard)
    @HttpCode(HttpStatus.OK)
    async handleN8nCallback(@Body() dto: N8nCallbackDto): Promise<{ status: string; error?: string } | Order> {
        return this.n8nService.handleCallback(dto);
    }
}
