import { AiRunService } from './ai-run.service';

describe('AiRunService', () => {
  it('persists the resolved thinking-only configuration and actual request snapshot', async () => {
    const prisma = { aiRun: { create: jest.fn().mockResolvedValue({ id: 'run-1' }) } };
    const service = new AiRunService(prisma as never);

    await service.recordRun({
      orderId: 'order-1',
      agent: 'SCRIBE',
      mission: 'READING_GENERATION' as never,
      provider: 'vertex',
      model: 'gemini-3.1-pro-preview',
      status: 'SUCCESS',
      durationMs: 123,
      executionSnapshot: {
        provider: 'vertex', model: 'gemini-3.1-pro-preview', thinkingLevel: 'high',
        promptVersionId: 'prompt-7', routingSource: 'model-config:SCRIBE',
      },
      inputSnapshot: { content: 'dossier scellé', sha256: 'input-hash', imageCount: 2 },
    });

    expect(prisma.aiRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          executionSnapshot: expect.objectContaining({ thinkingLevel: 'high', promptVersionId: 'prompt-7' }),
          inputSnapshot: expect.objectContaining({ content: 'dossier scellé', imageCount: 2 }),
        }),
      }),
    );
  });
});
