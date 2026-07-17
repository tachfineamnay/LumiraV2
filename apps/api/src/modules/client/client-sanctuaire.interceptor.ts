import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { from, mergeMap, Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { parseGuidanceRequest } from '../guidance-requests/guidance-request.types';

type ClientRequest = {
  method: string;
  originalUrl?: string;
  url?: string;
  body?: { sessionId?: unknown };
  user?: { id?: string; userId?: string };
};

type LegacyMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

@Injectable()
export class ClientSanctuaireInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<ClientRequest>();
    const path = (request.originalUrl || request.url || '').split('?')[0];
    const userId = request.user?.userId || request.user?.id;
    if (!userId) return next.handle();

    if (request.method === 'GET' && path.endsWith('/client/chat/history')) {
      return from(this.getLatestAiHistory(userId));
    }

    if (request.method === 'POST' && path.endsWith('/client/chat')) {
      const sessionId =
        typeof request.body?.sessionId === 'string' && request.body.sessionId.trim()
          ? request.body.sessionId.trim()
          : null;
      if (!sessionId) return next.handle();
      return from(this.assertOwnedAiSession(userId, sessionId)).pipe(mergeMap(() => next.handle()));
    }

    if (request.method === 'GET' && path.endsWith('/client/spiritual-path')) {
      return next.handle().pipe(
        mergeMap(async (payload) => {
          if (!payload || typeof payload !== 'object') return payload;
          const result = payload as Record<string, unknown>;
          if (result.exists === false || result.synthesisAudioUrl) return result;

          const audio = await this.prisma.orderFile.findFirst({
            where: { order: { userId }, type: 'AUDIO_READING' },
            orderBy: { uploadedAt: 'desc' },
            select: { order: { select: { orderNumber: true } } },
          });

          return audio
            ? { ...result, synthesisAudioUrl: `/api/readings/${audio.order.orderNumber}/audio` }
            : result;
        }),
      );
    }

    return next.handle();
  }

  private async getLatestAiHistory(
    userId: string,
  ): Promise<{ sessionId: string | null; messages: LegacyMessage[] }> {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      take: 25,
      select: { id: true, messages: true },
    });

    for (const session of sessions) {
      if (parseGuidanceRequest(session.messages)) continue;
      const messages = this.readLegacyMessages(session.messages);
      if (messages.length > 0) return { sessionId: session.id, messages };
    }

    return { sessionId: null, messages: [] };
  }

  private async assertOwnedAiSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { messages: true },
    });
    if (!session || parseGuidanceRequest(session.messages)) {
      throw new NotFoundException('Conversation introuvable');
    }
  }

  private readLegacyMessages(value: Prisma.JsonValue): LegacyMessage[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is LegacyMessage =>
        Boolean(item) &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        ['user', 'assistant'].includes(String((item as { role?: unknown }).role)) &&
        typeof (item as { content?: unknown }).content === 'string' &&
        typeof (item as { timestamp?: unknown }).timestamp === 'string',
    );
  }
}
