import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { mergeMap, Observable } from 'rxjs';
import { GuidanceRequestsService } from './guidance-requests.service';

type AuthenticatedRequest = {
  method: string;
  originalUrl?: string;
  url?: string;
  user?: { id?: string; userId?: string };
  body?: { category?: unknown };
};

@Injectable()
export class GuidanceResponseInterceptor implements NestInterceptor {
  constructor(private readonly requests: GuidanceRequestsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const path = (request.originalUrl || request.url || '').split('?')[0];
    const userId = request.user?.userId || request.user?.id;

    if (request.method !== 'POST' || !path.endsWith('/client/requests') || !userId) {
      return next.handle();
    }

    if (request.body?.category === 'PERSONAL_SITUATION') {
      request.body.category = 'SPECIFIC_SITUATION';
    } else if (request.body?.category === 'TECHNICAL_HELP') {
      request.body.category = 'OTHER';
    }

    return next.handle().pipe(
      mergeMap(async (created: unknown) => {
        const requestId =
          created && typeof created === 'object' && typeof (created as { id?: unknown }).id === 'string'
            ? (created as { id: string }).id
            : null;

        return requestId ? this.requests.getClientRequest(userId, requestId) : created;
      }),
    );
  }
}
