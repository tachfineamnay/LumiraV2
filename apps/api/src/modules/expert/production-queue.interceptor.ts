import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Expert } from '@prisma/client';
import { from, Observable } from 'rxjs';
import { ProductionControlService } from './production-control.service';

interface ExpertRequest {
  method: string;
  originalUrl?: string;
  url?: string;
  body?: Record<string, unknown>;
  expert?: Expert;
}

@Injectable()
export class ProductionQueueInterceptor implements NestInterceptor {
  constructor(private readonly production: ProductionControlService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<ExpertRequest>();
    if (request.method !== 'POST' || !request.expert) return next.handle();

    const path = (request.originalUrl || request.url || '').split('?')[0];

    if (path.endsWith('/expert/process-order')) {
      return from(this.enqueueAndWaitForLegacyProcess(request));
    }

    const audioTestMatch = path.match(/\/expert\/test-audio\/([^/]+)$/);
    if (audioTestMatch) {
      return from(this.production.enqueueAudio(audioTestMatch[1], request.expert));
    }

    const generateMatch = path.match(/\/expert\/orders\/([^/]+)\/generate$/);
    if (generateMatch) {
      return from(
        this.production.enqueueReading(generateMatch[1], request.expert, {
          expertPrompt: this.stringValue(request.body?.expertPrompt),
          expertInstructions: this.stringValue(request.body?.expertInstructions),
        }),
      );
    }

    const fullMatch = path.match(/\/expert\/orders\/([^/]+)\/generate-full$/);
    if (fullMatch) {
      return from(this.enqueueAndWait(fullMatch[1], request));
    }

    return next.handle();
  }

  private async enqueueAndWaitForLegacyProcess(request: ExpertRequest) {
    const orderId = this.stringValue(request.body?.orderId);
    if (!orderId) throw new BadRequestException('orderId est requis');
    return this.enqueueAndWait(orderId, request);
  }

  private async enqueueAndWait(orderId: string, request: ExpertRequest) {
    if (!request.expert) throw new BadRequestException('Expert non résolu');
    const queued = await this.production.enqueueReading(orderId, request.expert, {
      expertPrompt: this.stringValue(request.body?.expertPrompt),
      expertInstructions: this.stringValue(request.body?.expertInstructions),
    });

    return this.production.waitForJob(queued.jobId);
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
