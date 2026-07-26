import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Expert } from '@prisma/client';
import { from, Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(
    private readonly production: ProductionControlService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<ExpertRequest>();
    if (request.method !== 'POST' || !request.expert) return next.handle();

    const path = (request.originalUrl || request.url || '').split('?')[0];

    if (path.endsWith('/expert/process-order')) {
      return from(this.enqueueLegacyProcess(request));
    }

    if (path.endsWith('/expert/regenerate')) {
      return from(this.prepareAndEnqueueRegenerationFromBody(request));
    }

    const audioTestMatch = path.match(/\/expert\/test-audio\/([^/]+)$/);
    if (audioTestMatch) {
      return from(this.production.enqueueAudio(audioTestMatch[1], request.expert));
    }

    const generateMatch = path.match(/\/expert\/orders\/([^/]+)\/generate$/);
    if (generateMatch) {
      return from(this.enqueueReading(generateMatch[1], request));
    }

    const fullMatch = path.match(/\/expert\/orders\/([^/]+)\/generate-full$/);
    if (fullMatch) {
      return from(this.enqueueReading(fullMatch[1], request));
    }

    const regenerateMatch = path.match(/\/expert\/orders\/([^/]+)\/regenerate$/);
    if (regenerateMatch) {
      return from(this.prepareAndEnqueueRegeneration(regenerateMatch[1], request));
    }

    return next.handle();
  }

  private async enqueueLegacyProcess(request: ExpertRequest) {
    const orderId = this.stringValue(request.body?.orderId);
    if (!orderId) throw new BadRequestException('orderId est requis');
    return this.enqueueReading(orderId, request);
  }

  private async enqueueReading(orderId: string, request: ExpertRequest) {
    if (!request.expert) throw new BadRequestException('Expert non résolu');
    return this.production.enqueueReading(orderId, request.expert, {
      expertPrompt: this.stringValue(request.body?.expertPrompt),
      expertInstructions: this.stringValue(request.body?.expertInstructions),
    });
  }

  private async prepareAndEnqueueRegeneration(orderId: string, request: ExpertRequest) {
    if (!request.expert) throw new BadRequestException('Expert non résolu');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        expertPrompt: true,
        expertInstructions: true,
        generatedContent: true,
      },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');
    if (!order.expertPrompt?.trim()) {
      throw new BadRequestException('Aucun prompt expert enregistré pour cette commande');
    }
    if (!['AWAITING_VALIDATION', 'FAILED'].includes(order.status)) {
      throw new BadRequestException(
        `Cette commande ne peut pas être régénérée (statut: ${order.status})`,
      );
    }

    // The current delivered/draft projection remains readable while a new
    // candidate is queued. DigitalSoul promotes its result only after the
    // complete candidate has passed deterministic validation.
    return this.production.enqueueReading(orderId, request.expert, {
      expertPrompt: order.expertPrompt.trim(),
      expertInstructions: this.stringValue(order.expertInstructions),
      regenerationOfExistingContent: Boolean(order.generatedContent),
    });
  }

  private async prepareAndEnqueueRegenerationFromBody(request: ExpertRequest) {
    const orderId = this.stringValue(request.body?.orderId);
    if (!orderId) throw new BadRequestException('orderId est requis');
    return this.prepareAndEnqueueRegeneration(orderId, request);
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
