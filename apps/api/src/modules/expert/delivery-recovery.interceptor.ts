import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { from, Observable, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

interface ExpertRequest {
  method: string;
  originalUrl?: string;
  url?: string;
  body?: Record<string, unknown>;
}

/**
 * PDF conversion, S3 upload and delivery are retryable operations. Once an
 * expert has sealed a ReadingVersion, a transient delivery failure must not
 * make the validated content disappear behind the generic FAILED workflow.
 */
@Injectable()
export class DeliveryRecoveryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DeliveryRecoveryInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<ExpertRequest>();
    const orderId = this.finalizationOrderId(request);
    if (!orderId) return next.handle();

    return next.handle().pipe(
      catchError((error: unknown) =>
        from(this.restoreReviewableState(orderId, error)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }

  private finalizationOrderId(request: ExpertRequest): string | null {
    if (request.method !== 'POST') return null;
    const path = (request.originalUrl || request.url || '').split('?')[0];

    const studioMatch = path.match(/\/expert\/orders\/([^/]+)\/(?:finalize|validate)$/);
    if (studioMatch) return studioMatch[1];

    if (path.endsWith('/expert/validate-content')) {
      const orderId = request.body?.orderId;
      return typeof orderId === 'string' && orderId.trim() ? orderId.trim() : null;
    }

    return null;
  }

  private async restoreReviewableState(orderId: string, error: unknown): Promise<void> {
    try {
      const [order, sealedVersion] = await Promise.all([
        this.prisma.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        }),
        this.prisma.readingVersion.findFirst({
          where: { orderId, status: 'SEALED' },
          orderBy: { version: 'desc' },
          select: { id: true, contentHash: true },
        }),
      ]);

      if (!order || order.status === 'COMPLETED' || !sealedVersion) return;

      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'AWAITING_VALIDATION',
          errorLog: `[DELIVERY_RETRYABLE] ${message}`.slice(0, 4000),
        },
      });

      this.logger.warn(
        `Delivery failed for ${orderId}; sealed version ${sealedVersion.id} preserved for retry`,
      );
    } catch (recoveryError) {
      this.logger.error(
        `Could not restore retryable delivery state for ${orderId}: ${
          recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
        }`,
      );
    }
  }
}
