import { AiRunService } from './ai-run.service';

describe('AiRunService', () => {
  it('persists the resolved thinking-only configuration without retaining raw intake or prompt data', async () => {
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
        provider: 'vertex',
        model: 'gemini-3.1-pro-preview',
        thinkingLevel: 'high',
        promptVersionId: 'prompt-7',
        routingSource: 'model-config:SCRIBE',
      },
      inputSnapshot: {
        inputSha256: 'input-hash',
        intakeContentHash: 'sealed-intake-hash',
        schemaName: 'lumira_core_reading',
        imageCount: 2,
        imageRoles: ['FACE_FRONT', 'PALM_UNKNOWN'],
        imageHashes: ['a'.repeat(64), 'b'.repeat(64)],
        promptVersionId: 'prompt-7',
        technical: {
          timeoutMs: 300000,
          structured: true,
          privateUrl: 'https://private.example.test/technical',
        },
        content: 'Jean Dupont, né le 1er janvier, question personnelle',
        base64: 'aGVsbG8=',
        privateUrl: 'https://private.example.test/image',
      },
    });

    expect(prisma.aiRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          executionSnapshot: expect.objectContaining({
            thinkingLevel: 'high',
            promptVersionId: 'prompt-7',
          }),
          inputSnapshot: {
            inputSha256: 'input-hash',
            intakeContentHash: 'sealed-intake-hash',
            schemaName: 'lumira_core_reading',
            imageCount: 2,
            imageRoles: ['FACE_FRONT', 'PALM_UNKNOWN'],
            imageHashes: ['a'.repeat(64), 'b'.repeat(64)],
            promptVersionId: 'prompt-7',
            technical: { timeoutMs: 300000, structured: true },
          },
        }),
      }),
    );
  });
});
