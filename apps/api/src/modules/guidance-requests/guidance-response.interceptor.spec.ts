import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { GuidanceResponseInterceptor } from './guidance-response.interceptor';

function contextFor(request: Record<string, unknown>) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('GuidanceResponseInterceptor', () => {
  it('normalizes the Sanctuaire category and returns the complete created request', async () => {
    const requests = {
      getClientRequest: jest.fn().mockResolvedValue({
        id: 'request-1',
        category: 'SPECIFIC_SITUATION',
        messages: [{ id: 'message-1', content: 'Contexte complet' }],
      }),
    };
    const interceptor = new GuidanceResponseInterceptor(requests as never);
    const body = { category: 'PERSONAL_SITUATION' };
    const next = { handle: jest.fn(() => of({ id: 'request-1' })) } as unknown as CallHandler;

    const result = await firstValueFrom(
      interceptor.intercept(
        contextFor({
          method: 'POST',
          originalUrl: '/api/client/requests',
          user: { userId: 'user-1' },
          body,
        }),
        next,
      ),
    );

    expect(body.category).toBe('SPECIFIC_SITUATION');
    expect(requests.getClientRequest).toHaveBeenCalledWith('user-1', 'request-1');
    expect(result).toMatchObject({
      id: 'request-1',
      messages: [{ id: 'message-1', content: 'Contexte complet' }],
    });
  });
});
