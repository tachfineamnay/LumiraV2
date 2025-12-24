import { Controller, Post, Body, UseGuards, Request, Get, Query } from '@nestjs/common';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
    constructor(private readonly s3Service: S3Service) { }

    @Roles('CLIENT')
    @Post('presign')
    async getPresignUrl(
        @Body() body: { fileName: string; contentType: string; orderId: string },
        @Request() req,
    ) {
        const key = `orders/${body.orderId}/${Date.now()}-${body.fileName}`;
        const url = await this.s3Service.getUploadPresignedUrl(key, body.contentType);
        return { url, key };
    }

    @Roles('CLIENT', 'EXPERT', 'ADMIN')
    @Get('signed-url')
    async getSignedUrl(
        @Query('key') key: string,
        @Query('bucket') bucket: 'uploads' | 'readings' = 'readings',
    ) {
        const url = await this.s3Service.getDownloadPresignedUrl(key, bucket);
        return { url };
    }
}
