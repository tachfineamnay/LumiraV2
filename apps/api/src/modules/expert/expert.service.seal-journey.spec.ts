import { Expert, ExpertRole } from '@prisma/client';
import { ExpertService } from './expert.service';
import { CanonicalReadingContent } from './reading-version';

const expert = {
  id: 'expert-1',
  email: 'expert@example.test',
  password: 'hash',
  name: 'Expert',
  role: ExpertRole.EXPERT,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function deliverableReading(): CanonicalReadingContent {
  const paragraph = Array.from({ length: 190 }, (_, index) => `mot${index}`).join(' ');
  return {
    pdf_content: {
      introduction: paragraph,
      archetype_reveal: paragraph,
      sections: [
        'spirituel',
        'relations',
        'mission',
        'creativite',
        'emotions',
        'travail',
        'sante',
        'finance',
      ].map((domain) => ({ domain, title: domain, content: paragraph })),
      karmic_insights: [paragraph, paragraph, paragraph, paragraph],
      life_mission: paragraph,
      rituals: [
        { name: 'Ancrage', description: paragraph, instructions: ['a', 'b', 'c', 'd'] },
        { name: 'Clarté', description: paragraph, instructions: ['a', 'b', 'c', 'd'] },
      ],
      conclusion: paragraph,
    },
    synthesis: {
      archetype: 'Le Guide',
      keywords: ['ancrage', 'clarté', 'relation', 'création', 'action'],
      emotional_state: '',
      key_blockage: '',
    },
    timeline: [
      {
        day: 1,
        title: 'Jour 1',
        action: 'Respirer',
        mantra: 'Je respire',
        actionType: 'MEDITATION',
      },
    ],
    lecture: paragraph,
  };
}

describe('ExpertService sealed journey promotion', () => {
  it('keeps a rejected draft and leaves sealed versions untouched', async () => {
    const currentDraft = {
      lecture: 'Draft expert',
      readingRevision: 4,
      pdf_content: {},
      synthesis: {},
    };
    const orderUpdate = jest
      .fn()
      .mockResolvedValue({ id: 'order-1', generatedContent: currentDraft });
    const sealedUpdate = jest.fn();
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'LUM-001',
          status: 'AWAITING_VALIDATION',
          intakeRequired: false,
          readingIntake: null,
          generatedContent: currentDraft,
          revisionCount: 2,
          expertPrompt: null,
          expertInstructions: null,
        }),
        update: orderUpdate,
      },
      readingVersion: { update: sealedUpdate },
    };
    const service = new ExpertService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { enqueueReading: jest.fn() } as never,
      {} as never,
    );

    await service.validateContent(
      { orderId: 'order-1', action: 'reject', rejectionReason: 'À revoir' },
      expert,
    );

    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'AWAITING_VALIDATION',
          revisionCount: { increment: 1 },
          expertValidation: expect.objectContaining({
            reason: 'À revoir',
            rejectedBy: expert.id,
            revisionCount: 3,
            draftRevision: 4,
            regeneration: 'REQUIRES_EXPLICIT_ACTION',
          }),
        }),
      }),
    );
    expect(orderUpdate.mock.calls[0][0].data.generatedContent).toBeUndefined();
    expect(sealedUpdate).not.toHaveBeenCalled();
  });

  it('uses the durable regeneration job after an explicit rejection request', async () => {
    const currentDraft = { lecture: 'Draft expert', readingRevision: 2 };
    const enqueueReading = jest.fn().mockResolvedValue({ accepted: true, jobId: 'prod-1' });
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'LUM-001',
          status: 'AWAITING_VALIDATION',
          intakeRequired: false,
          readingIntake: null,
          generatedContent: currentDraft,
          revisionCount: 0,
          expertPrompt: 'Reprendre la structure',
          expertInstructions: 'Rester prudent',
        }),
        update: jest.fn().mockResolvedValue({ id: 'order-1', generatedContent: currentDraft }),
      },
    };
    const service = new ExpertService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { enqueueReading } as never,
      {} as never,
    );

    await service.validateContent(
      { orderId: 'order-1', action: 'reject', regenerate: true },
      expert,
    );

    expect(enqueueReading).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ id: expert.id }),
      expect.objectContaining({
        expertPrompt: 'Reprendre la structure',
        expertInstructions: 'Rester prudent',
        regenerationOfExistingContent: true,
      }),
    );
  });

  it('preserves the rejected draft when durable regeneration cannot be queued', async () => {
    const currentDraft = { lecture: 'Draft expert', readingRevision: 3 };
    const orderUpdate = jest
      .fn()
      .mockResolvedValue({ id: 'order-1', generatedContent: currentDraft });
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'LUM-001',
          status: 'AWAITING_VALIDATION',
          intakeRequired: false,
          readingIntake: null,
          generatedContent: currentDraft,
          revisionCount: 0,
          expertPrompt: null,
          expertInstructions: null,
        }),
        update: orderUpdate,
      },
    };
    const service = new ExpertService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { enqueueReading: jest.fn().mockRejectedValue(new Error('queue unavailable')) } as never,
      {} as never,
    );

    await expect(
      service.validateContent({ orderId: 'order-1', action: 'reject', regenerate: true }, expert),
    ).rejects.toThrow('queue unavailable');
    expect(orderUpdate).toHaveBeenCalledTimes(1);
    expect(orderUpdate.mock.calls[0][0].data.generatedContent).toBeUndefined();
  });

  it('refuses to delete an order that would cascade historical versions or deliveries', async () => {
    const orderDelete = jest.fn();
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'LUM-001',
          status: 'COMPLETED',
          paidAt: new Date(),
          paymentIntentId: 'pi-1',
          stripeSessionId: 'cs-1',
          readingIntake: { id: 'intake-1' },
          expertReview: { productionHistory: [{ id: 'prod-1' }] },
          _count: {
            files: 1,
            readingVersions: 1,
            deliveries: 1,
            generatedSteps: 1,
            chatContexts: 1,
            aiRuns: 1,
          },
        }),
        delete: orderDelete,
      },
      orderFile: { deleteMany: jest.fn() },
    };
    const service = new ExpertService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.deleteOrder('order-1')).rejects.toThrow(
      'sans historique peuvent être supprimées',
    );
    expect(orderDelete).not.toHaveBeenCalled();
  });

  it('only deletes an empty unpaid pending draft', async () => {
    const orderFileDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const orderDelete = jest.fn().mockResolvedValue({ id: 'order-1' });
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'LUM-001',
          status: 'PENDING',
          paidAt: null,
          paymentIntentId: null,
          stripeSessionId: null,
          readingIntake: null,
          expertReview: null,
          _count: {
            files: 0,
            readingVersions: 0,
            deliveries: 0,
            generatedSteps: 0,
            chatContexts: 0,
            aiRuns: 0,
          },
        }),
        delete: orderDelete,
      },
      orderFile: { deleteMany: orderFileDeleteMany },
    };
    const service = new ExpertService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.deleteOrder('order-1');

    expect(orderFileDeleteMany).toHaveBeenCalledWith({ where: { orderId: 'order-1' } });
    expect(orderDelete).toHaveBeenCalledWith({ where: { id: 'order-1' } });
  });

  it('refuses to delete a client with durable Lumira history', async () => {
    const userDelete = jest.fn();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'client-1',
          _count: {
            orders: 1,
            readingIntakes: 1,
            spiritualPaths: 1,
            dreams: 0,
            consents: 1,
          },
        }),
        delete: userDelete,
      },
    };
    const service = new ExpertService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.deleteClient('client-1')).rejects.toThrow('possède un historique Lumira');
    expect(userDelete).not.toHaveBeenCalled();
  });

  it('delegates legacy generation helpers to the durable production job', async () => {
    const enqueueReading = jest.fn().mockResolvedValue({ accepted: true, jobId: 'prod-1' });
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ generatedContent: { lecture: 'draft' } }),
      },
    };
    const service = new ExpertService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { generateContentOnly: jest.fn() } as never,
      {} as never,
      {} as never,
      { enqueueReading } as never,
      {} as never,
    );

    await expect(
      service.generateReadingWithPrompt('order-1', 'Orientation experte', expert),
    ).resolves.toEqual({ accepted: true, jobId: 'prod-1' });

    expect(enqueueReading).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ id: expert.id }),
      expect.objectContaining({
        expertPrompt: 'Orientation experte',
        regenerationOfExistingContent: true,
      }),
    );
  });

  it('creates the journey only from the immutable sealed version', async () => {
    const readingVersionCreate = jest.fn().mockResolvedValue({ id: 'sealed-version-1' });
    const spiritualPathCreate = jest.fn().mockResolvedValue({ id: 'path-1' });
    const orderUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback({
          readingVersion: {
            findFirst: jest.fn().mockResolvedValue({ version: 3 }),
            create: readingVersionCreate,
          },
          spiritualPath: { create: spiritualPathCreate },
          order: { update: orderUpdate },
        }),
      ),
    };
    const service = new ExpertService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await (
      service as unknown as {
        sealReadingVersion: (
          order: unknown,
          content: CanonicalReadingContent,
          expert: Expert,
          source: string,
        ) => Promise<unknown>;
      }
    ).sealReadingVersion(
      { id: 'order-1', userId: 'user-1', generatedContent: {} },
      deliverableReading(),
      expert,
      'TEST_SEAL',
    );

    expect(readingVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SEALED' }) }),
    );
    expect(spiritualPathCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          readingVersionId: 'sealed-version-1',
          steps: expect.objectContaining({ create: [expect.objectContaining({ dayNumber: 1 })] }),
        }),
      }),
    );
  });
});
