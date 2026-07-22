import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductionControlService } from './production-control.service';
import { ProductionQueueInterceptor } from './production-queue.interceptor';

function httpContext(path: string, body: Record<string, unknown> = {}): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        originalUrl: `/api${path}`,
        body,
        expert: { id: 'expert-1', name: 'Expert', role: 'ADMIN' },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ProductionQueueInterceptor', () => {
  const production = {
    enqueueReading: jest.fn(),
    enqueueAudio: jest.fn(),
    waitForJob: jest.fn(),
  };
  const prisma = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const next = { handle: jest.fn(() => of({ legacy: true })) } as CallHandler;
  const interceptor = new ProductionQueueInterceptor(
    production as unknown as ProductionControlService,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    production.enqueueReading.mockResolvedValue({
      accepted: true,
      jobId: 'prod-1',
      status: 'QUEUED',
    });
    prisma.order.findUnique.mockResolvedValue({
      status: 'AWAITING_VALIDATION',
      expertPrompt: 'Prompt enregistré',
      expertInstructions: 'Instruction enregistrée',
      generatedContent: { pdf_content: { introduction: 'Ancienne lecture' } },
      revisionCount: 2,
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1' });
  });

  it('queues the legacy process-order route without waiting for completion', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        httpContext('/expert/process-order', {
          orderId: 'order-1',
          expertPrompt: 'Prompt expert',
        }),
        next,
      ),
    );

    expect(result).toEqual(expect.objectContaining({ accepted: true, jobId: 'prod-1' }));
    expect(production.enqueueReading).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ id: 'expert-1' }),
      expect.objectContaining({ expertPrompt: 'Prompt expert' }),
    );
    expect(production.waitForJob).not.toHaveBeenCalled();
    expect(next.handle).not.toHaveBeenCalled();
  });

  it.each([
    '/expert/orders/order-1/generate',
    '/expert/orders/order-1/generate-full',
  ])('queues %s as a durable reading job', async (path) => {
    const result = await firstValueFrom(interceptor.intercept(httpContext(path), next));

    expect(result).toEqual(expect.objectContaining({ status: 'QUEUED' }));
    expect(production.enqueueReading).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ id: 'expert-1' }),
      expect.any(Object),
    );
    expect(production.waitForJob).not.toHaveBeenCalled();
  });

  it('clears the draft and increments revision count before queueing a regeneration', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(httpContext('/expert/orders/order-1/regenerate'), next),
    );

    expect(result).toEqual(expect.objectContaining({ status: 'QUEUED' }));
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        generatedContent: expect.anything(),
        revisionCount: { increment: 1 },
      }),
    });
    expect(production.enqueueReading).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ id: 'expert-1' }),
      {
        expertPrompt: 'Prompt enregistré',
        expertInstructions: 'Instruction enregistrée',
      },
    );
  });

  it('restores the previous draft when regeneration cannot be queued', async () => {
    production.enqueueReading.mockRejectedValueOnce(new Error('Job already active'));

    await expect(
      firstValueFrom(
        interceptor.intercept(httpContext('/expert/orders/order-1/regenerate'), next),
      ),
    ).rejects.toThrow('Job already active');

    expect(prisma.order.update).toHaveBeenLastCalledWith({
      where: { id: 'order-1' },
      data: {
        generatedContent: { pdf_content: { introduction: 'Ancienne lecture' } },
        revisionCount: 2,
      },
    });
  });
});
