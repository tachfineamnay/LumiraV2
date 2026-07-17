import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ExpertRole } from '@prisma/client';
import { firstValueFrom, throwError } from 'rxjs';
import { GuidanceReplyRecoveryInterceptor } from './guidance-reply-recovery.interceptor';

function contextFor(expert: Record<string, unknown>, content: string) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        originalUrl: '/api/expert/requests/request-1/messages',
        body: { content },
        expert,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('GuidanceReplyRecoveryInterceptor', () => {
  const expert = {
    id: 'expert-1',
    email: 'expert@example.com',
    name: 'Expert',
    role: ExpertRole.EXPERT,
  };

  it('returns the persisted reply when only the secondary notification failed', async () => {
    const detail = {
      id: 'request-1',
      client: { id: 'user-1' },
      relatedReading: { id: 'order-1' },
      messages: [
        {
          id: 'message-1',
          senderType: 'EXPERT',
          senderId: 'expert-1',
          content: 'Réponse enregistrée',
        },
      ],
    };
    const requests = { getExpertRequest: jest.fn().mockResolvedValue(detail) };
    const prisma = { notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) } };
    const interceptor = new GuidanceReplyRecoveryInterceptor(requests as never, prisma as never);
    const next = {
      handle: jest.fn(() => throwError(() => new Error('notification unavailable'))),
    } as unknown as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(contextFor(expert, 'Réponse enregistrée'), next)),
    ).resolves.toEqual(detail);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        metadata: expect.objectContaining({ guidanceRequestId: 'request-1' }),
      }),
    });
  });

  it('preserves the original error when no matching reply was persisted', async () => {
    const requests = {
      getExpertRequest: jest.fn().mockResolvedValue({
        id: 'request-1',
        messages: [
          {
            id: 'message-1',
            senderType: 'CLIENT',
            senderId: 'user-1',
            content: 'Question',
          },
        ],
      }),
    };
    const prisma = { notification: { create: jest.fn() } };
    const interceptor = new GuidanceReplyRecoveryInterceptor(requests as never, prisma as never);
    const original = new Error('database unavailable');
    const next = {
      handle: jest.fn(() => throwError(() => original)),
    } as unknown as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(contextFor(expert, 'Réponse non enregistrée'), next)),
    ).rejects.toBe(original);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
