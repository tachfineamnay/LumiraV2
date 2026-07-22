import { ConflictException } from '@nestjs/common';
import { ExpertService } from './expert.service';

describe('ExpertService audio enqueue after finalize', () => {
  const expert = {
    id: 'exp-1',
    email: 'expert@lumira.test',
    name: 'Expert',
    role: 'EXPERT',
    isActive: true,
  } as const;

  function buildService(
    overrides: {
      enqueueAudio?: jest.Mock;
      finalizeWithPdf?: jest.Mock;
    } = {},
  ) {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ord-1',
          orderNumber: 'LUM-001',
          status: 'AWAITING_VALIDATION',
          generatedContent: { pdf_content: { introduction: 'x', sections: [], conclusion: 'y' } },
          user: { profile: {} },
        }),
        update: jest.fn().mockResolvedValue({ id: 'ord-1', orderNumber: 'LUM-001' }),
      },
      readingVersion: {
        create: jest.fn().mockResolvedValue({ id: 'rv-1', contentHash: 'hash' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const digitalSoulService = {
      finalizeWithPdf:
        overrides.finalizeWithPdf ||
        jest.fn().mockResolvedValue({
          orderId: 'ord-1',
          orderNumber: 'LUM-001',
          pdfUrl: '/pdf',
          spiritualPathId: 'sp-1',
          archetype: 'Test',
          stepsCreated: 0,
        }),
    };

    const productionControl = {
      enqueueAudio:
        overrides.enqueueAudio || jest.fn().mockResolvedValue({ accepted: true, jobId: 'job-1' }),
    };

    const gateway = { notifyOrderSealed: jest.fn() };
    const notificationsService = {
      sendDeliveryEmailTracked: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ExpertService(
      prisma as never,
      {} as never,
      { get: jest.fn() } as never,
      {} as never,
      notificationsService as never,
      digitalSoulService as never,
      {} as never,
      gateway as never,
      productionControl as never,
    );

    // Avoid real email path complexity — stub private method
    (service as unknown as { sendDeliveryEmail: jest.Mock }).sendDeliveryEmail = jest
      .fn()
      .mockResolvedValue(undefined);
    (service as unknown as { sealReadingVersion: jest.Mock }).sealReadingVersion = jest
      .fn()
      .mockResolvedValue(undefined);

    return { service, productionControl, digitalSoulService, gateway };
  }

  it('enqueues AUDIO_GENERATION after finalizeFromStudio succeeds', async () => {
    const { service, productionControl } = buildService();
    const result = await service.finalizeFromStudio(
      'ord-1',
      'Contenu final validé',
      expert as never,
    );

    expect(result.success).toBe(true);
    expect(productionControl.enqueueAudio).toHaveBeenCalledWith('ord-1', expert);
  });

  it('does not fail seal when audio enqueue conflicts', async () => {
    const { service, productionControl } = buildService({
      enqueueAudio: jest.fn().mockRejectedValue(new ConflictException('audio exists')),
    });

    await expect(
      service.finalizeFromStudio('ord-1', 'Contenu final validé', expert as never),
    ).resolves.toMatchObject({ success: true, orderId: 'ord-1' });

    expect(productionControl.enqueueAudio).toHaveBeenCalled();
  });

  it('does not fail seal when audio enqueue throws unexpectedly', async () => {
    const { service } = buildService({
      enqueueAudio: jest.fn().mockRejectedValue(new Error('queue down')),
    });

    await expect(
      service.finalizeFromStudio('ord-1', 'Contenu final validé', expert as never),
    ).resolves.toMatchObject({ success: true });
  });
});
