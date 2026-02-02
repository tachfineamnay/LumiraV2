import {
    Controller,
    Get,
    Param,
    Res,
    Logger,
    NotFoundException,
    UseGuards,
    Request,
} from '@nestjs/common';
import { Response } from 'express';
import { ReadingsService } from './readings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

/**
 * ReadingsController - PDF download endpoints
 * 
 * Provides endpoints for:
 * - Downloading PDF readings via signed S3 URLs
 * - Streaming PDF content directly
 */
@Controller('readings')
export class ReadingsController {
    private readonly logger = new Logger(ReadingsController.name);

    constructor(private readonly readingsService: ReadingsService) {}

    /**
     * GET /api/readings/:orderNumber/download
     * Redirects to a signed S3 URL for PDF download
     * 
     * This endpoint is called when the frontend tries to display/download a PDF.
     * It generates a temporary signed URL and redirects to it.
     */
    @Get(':orderNumber/download')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async downloadPdf(
        @Param('orderNumber') orderNumber: string,
        @Res() res: Response,
    ) {
        this.logger.log(`📥 Download request for: ${orderNumber}`);

        try {
            const { url, filename } = await this.readingsService.getPdfSignedUrl(orderNumber);

            // Set headers for download
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            res.setHeader('Cache-Control', 'private, max-age=3600');

            // Redirect to signed S3 URL
            this.logger.log(`↪️ Redirecting to signed URL for ${filename}`);
            return res.redirect(302, url);
        } catch (error) {
            this.logger.error(`❌ Download error for ${orderNumber}:`, error);
            
            if (error instanceof NotFoundException) {
                throw error;
            }
            
            throw new NotFoundException('PDF non disponible');
        }
    }

    /**
     * GET /api/readings/:orderNumber/download/secure
     * Authenticated endpoint that verifies user owns the order
     */
    @Get(':orderNumber/download/secure')
    @UseGuards(JwtAuthGuard)
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async downloadPdfSecure(
        @Param('orderNumber') orderNumber: string,
        @Request() req: { user: { userId: string } },
        @Res() res: Response,
    ) {
        this.logger.log(`📥 Secure download request for: ${orderNumber} by user ${req.user.userId}`);

        try {
            const { url, filename } = await this.readingsService.getPdfSignedUrl(
                orderNumber,
                req.user.userId,
            );

            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            res.setHeader('Cache-Control', 'private, max-age=3600');

            return res.redirect(302, url);
        } catch (error) {
            this.logger.error(`❌ Secure download error for ${orderNumber}:`, error);
            
            if (error instanceof NotFoundException) {
                throw error;
            }
            
            throw new NotFoundException('PDF non disponible');
        }
    }
}
