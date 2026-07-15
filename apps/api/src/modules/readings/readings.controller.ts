import {
  Controller,
  Get,
  Param,
  Res,
  Logger,
  NotFoundException,
  UseGuards,
  Request,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ReadingsService } from './readings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

/**
 * ReadingsController - PDF download / stream endpoints
 */
@Controller('readings')
export class ReadingsController {
  private readonly logger = new Logger(ReadingsController.name);

  constructor(private readonly readingsService: ReadingsService) {}

  /**
   * GET /api/readings/:orderNumber/file
   * Authenticated binary stream — preferred for in-app viewer (no S3 CORS / redirect issues).
   */
  @Get(':orderNumber/file')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async streamPdf(
    @Param('orderNumber') orderNumber: string,
    @Request() req: { user: { userId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log(`📥 Stream request for: ${orderNumber} by user ${req.user.userId}`);

    try {
      const { stream, contentType, contentLength, filename } =
        await this.readingsService.getPdfStream(orderNumber, req.user.userId);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'private, max-age=300');
      if (contentLength != null) {
        res.setHeader('Content-Length', String(contentLength));
      }

      return new StreamableFile(stream);
    } catch (error) {
      this.logger.error(`❌ Stream error for ${orderNumber}:`, error);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new NotFoundException('PDF non disponible');
    }
  }

  /**
   * GET /api/readings/:orderNumber/download
   * Redirects to a signed S3 URL for PDF download / open-in-new-tab.
   * Prefer /file for in-app viewing. Ownership is NOT checked here (legacy);
   * order numbers are unguessable but /file is the secure path.
   */
  @Get(':orderNumber/download')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async downloadPdf(@Param('orderNumber') orderNumber: string, @Res() res: Response) {
    this.logger.log(`📥 Download request for: ${orderNumber}`);

    try {
      const { url, filename } = await this.readingsService.getPdfSignedUrl(orderNumber);

      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');

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
   * Authenticated redirect to signed S3 URL (ownership verified).
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
