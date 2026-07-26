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
