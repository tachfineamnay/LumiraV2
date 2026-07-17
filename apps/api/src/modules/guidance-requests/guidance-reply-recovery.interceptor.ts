import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Expert } from '@prisma/client';
import { catchError, from, Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { GuidanceRequestsService } from './guidance-requests.service';

type ExpertReplyRequest = {
  method: string;
  originalUrl?: string;
  url?: string;
  body?: { content?: unknown };
  expert?: Expert;
};

@Injectable()
export class GuidanceReplyRecoveryInterceptor implements NestInterceptor {
  constructor(
    private readonly requests: GuidanceRequestsService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<ExpertReplyRequest>();
    const path = (request.originalUrl || request.url || '').split('?')[0];
    const match = path.match(/\/expert\/requests\/([^/]+)\/messages$/);
    const content = typeof request.body?.content === 'string' ? request.body.content.trim() : '';

    if (request.method !== 'POST' || !match || !request.expert || !content) {
      return next.handle();
    }

    return next.handle().pipe(
      catchError((error: unknown) =>
        from(this.recoverPersistedReply(match[1], request.expert as Expert, content, error)),
      ),
    );
  }

  private async recoverPersistedReply(
    requestId: string,
    expert: Expert,
    content: string,
    originalError: unknown,
  ) {
    const detail = await this.requests.getExpertRequest(requestId).catch(() => null);
    const messages = detail?.messages || [];
    const lastMessage = messages[messages.length - 1];

    if (
      !detail ||
      !lastMessage ||
      lastMessage.senderType !== 'EXPERT' ||
      lastMessage.senderId !== expert.id ||
      lastMessage.content !== content
    ) {
      throw originalError;
    }

    if (detail.client?.id) {
      await this.prisma.notification
        .create({
          data: {
            userId: detail.client.id,
            type: 'SYSTEM',
            title: 'Une réponse vous attend',
            message: 'Une réponse à votre demande d’éclairage est disponible dans votre Sanctuaire.',
            metadata: {
              guidanceRequestId: detail.id,
              relatedOrderId: detail.relatedReading?.id || null,
            },
          },
        })
        .catch(() => undefined);
    }

    return detail;
  }
}
