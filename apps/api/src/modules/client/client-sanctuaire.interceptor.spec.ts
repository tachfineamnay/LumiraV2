import { CallHandler, ExecutionContext, NotFoundException } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ClientSanctuaireInterceptor } from './client-sanctuaire.interceptor';
import {
  GUIDANCE_MESSAGE_KIND,
  GUIDANCE_REQUEST_META_KIND,
  serializeGuidanceRequest,
} from '../guidance-requests/guidance-request.types';

function contextFor(request: Record<string, unknown>) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const guidanceMessages = serializeGuidanceRequest({
  meta: {
    kind: GUIDANCE_REQUEST_META_KIND,
    version: 1,
    status: 'WAITING_EXPERT',
    category: 'READING_CLARIFICATION',
    priority: 'NORMAL',
    assignedExpertId: null,
    assignedExpertName: null,
    createdAt: '2026-07-17T10:00:00.000Z',
    updatedAt: '2026-07-17T10:00:00.000Z',
    resolvedAt: null,
  },
  messages: [
    {
      kind: GUIDANCE_MESSAGE_KIND,
      id: 'message-1',
      senderType: 'CLIENT',
      senderId: 'user-1',
      senderName: null,
      content: 'Demande humaine',
      createdAt: '2026-07-17T10:00:00.000Z',
      readByClientAt: '2026-07-17T10:00:00.000Z',
      readByExpertAt: null,
    },
  ],
});

const legacyMessages = [
  {
    role: 'user',
    content: 'Question IA',
    timestamp: '2026-07-17T09:00:00.000Z',
  },
  {
    role: 'assistant',
    content: 'Réponse IA',
    timestamp: '2026-07-17T09:01:00.000Z',
  },
];

describe('ClientSanctuaireInterceptor', () => {
  it('returns the latest AI session and skips structured Desk requests', async () => {
    const prisma = {
      chatSession: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'guidance-1', messages: guidanceMessages },
          { id: 'ai-1', messages: legacyMessages },
        ]),
      },
      orderFile: { findFirst: jest.fn() },
    };
    const interceptor = new ClientSanctuaireInterceptor(prisma as never);
    const next = { handle: jest.fn(() => of({ legacy: true })) } as unknown as CallHandler;

    const result = await firstValueFrom(
      interceptor.intercept(
        contextFor({
          method: 'GET',
          originalUrl: '/api/client/chat/history',
          user: { userId: 'user-1' },
        }),
        next,
      ),
    );

    expect(result).toEqual({ sessionId: 'ai-1', messages: legacyMessages });
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('rejects a structured Desk request used as an AI session', async () => {
    const prisma = {
      chatSession: {
        findFirst: jest.fn().mockResolvedValue({ messages: guidanceMessages }),
      },
      orderFile: { findFirst: jest.fn() },
    };
    const interceptor = new ClientSanctuaireInterceptor(prisma as never);
    const next = { handle: jest.fn(() => of({ success: true })) } as unknown as CallHandler;

    await expect(
      firstValueFrom(
        interceptor.intercept(
          contextFor({
            method: 'POST',
            originalUrl: '/api/client/chat',
            body: { sessionId: 'guidance-1' },
            user: { userId: 'user-1' },
          }),
          next,
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('adds the authenticated audio route when legacy key filtering misses sealed audio', async () => {
    const prisma = {
      chatSession: { findMany: jest.fn(), findFirst: jest.fn() },
      orderFile: {
        findFirst: jest.fn().mockResolvedValue({ order: { orderNumber: 'LUM-001' } }),
      },
    };
    const interceptor = new ClientSanctuaireInterceptor(prisma as never);
    const next = {
      handle: jest.fn(() =>
        of({ exists: true, archetype: 'Le Visionnaire', synthesisAudioUrl: null }),
      ),
    } as unknown as CallHandler;

    const result = await firstValueFrom(
      interceptor.intercept(
        contextFor({
          method: 'GET',
          originalUrl: '/api/client/spiritual-path',
          user: { userId: 'user-1' },
        }),
        next,
      ),
    );

    expect(result).toMatchObject({
      exists: true,
      synthesisAudioUrl: '/api/readings/LUM-001/audio',
    });
  });
});
