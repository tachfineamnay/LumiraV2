import { BadRequestException } from '@nestjs/common';
import { DigitalSoulService } from './DigitalSoulService';
import { OracleResponse } from './VertexOracle';

const oldDraft = {
  lecture: 'Ancienne lecture livrée qui doit rester lisible.',
  synthesis: { archetype: 'Le Sage' },
  pdf_content: {
    introduction: 'Ancienne introduction',
    archetype_reveal: 'Ancien archétype',
    conclusion: 'Ancienne conclusion',
    sections: [{ domain: 'spirituel', title: 'Ancien', content: 'Ancien contenu' }],
    karmic_insights: [],
    rituals: [],
  },
};

function candidate(qualityStatus: 'PASS' | 'WARNING' | 'BLOCKED'): OracleResponse {
  return {
    pdf_content: {
      title: 'Lecture',
      subtitle: 'Sous-titre',
      introduction: 'Une introduction suffisamment longue pour réussir la validation de contenu.',
      sections: [{ domain: 'spirituel', title: 'Ancrage', content: 'Contenu de la section.' }],
      archetype_reveal: 'Révélation',
      karmic_insights: [],
      life_mission: 'Mission',
      rituals: [],
      conclusion: 'Une conclusion suffisamment longue.',
    },
    synthesis: { archetype: 'Le Sage', keywords: [], emotional_state: '', key_blockage: '' },
    timeline: [
      {
        day: 1,
        title: 'Jour 1',
        action: 'Respirer',
        mantra: 'Je respire',
        actionType: 'MEDITATION',
      },
    ],
    pipeline: {
      scribeCompletedAt: '2026-07-26T00:00:00.000Z',
      editorCompletedAt: null,
      qualityStatus,
      blockingIssues:
        qualityStatus === 'BLOCKED'
          ? [{ code: 'DOMAINS_NOT_UNIQUE', message: 'Domaines invalides', severity: 'BLOCKING' }]
          : [],
      warnings:
        qualityStatus === 'WARNING'
          ? [{ code: 'STYLE', message: 'Avertissement', severity: 'WARNING' }]
          : [],
      promptVersions: { SCRIBE: 'prompt-1' },
      models: { SCRIBE: 'openai:gpt-5.5-2026-04-23' },
    },
  };
}

function buildService(qualityStatus: 'PASS' | 'WARNING' | 'BLOCKED') {
  const transactionOrderUpdate = jest.fn().mockResolvedValue({});
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-1',
        status: 'AWAITING_VALIDATION',
        amount: 2900,
        generatedContent: oldDraft,
        files: [],
        readingIntake: null,
        user: {
          id: 'user-1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean@example.test',
          profile: null,
        },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback({ order: { update: transactionOrderUpdate } }),
    ),
  };
  const readingSource = {
    source: 'SEALED_INTAKE' as const,
    contentHash: 'sealed-intake-hash',
    profile: { facePhotoUrl: null, palmPhotoUrl: null },
  };
  const service = new DigitalSoulService(
    { get: jest.fn((_key: string, fallback?: string) => fallback) } as never,
    prisma as never,
    { generateFullReading: jest.fn().mockResolvedValue(candidate(qualityStatus)) } as never,
    {} as never,
    {
      resolve: jest.fn().mockReturnValue(readingSource),
      toVertexUserProfile: jest
        .fn()
        .mockReturnValue({
          userId: 'user-1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean@example.test',
        }),
    } as never,
    {} as never,
  );
  return { service, prisma, transactionOrderUpdate };
}

describe('DigitalSoulService candidate promotion', () => {
  it('does not persist a BLOCKED candidate and preserves the existing draft', async () => {
    const { service, prisma, transactionOrderUpdate } = buildService('BLOCKED');

    await expect(service.generateContentOnly('order-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transactionOrderUpdate).not.toHaveBeenCalled();
    expect(oldDraft.lecture).toBe('Ancienne lecture livrée qui doit rester lisible.');
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(
      prisma.order.update.mock.calls.every((call) => !('generatedContent' in call[0].data)),
    ).toBe(true);
  });

  it.each(['PASS', 'WARNING'] as const)(
    'promotes a %s candidate as a review draft',
    async (qualityStatus) => {
      const { service, prisma, transactionOrderUpdate } = buildService(qualityStatus);

      await expect(service.generateContentOnly('order-1')).resolves.toEqual(
        expect.objectContaining({ orderId: 'order-1', generatedContent: expect.any(Object) }),
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(transactionOrderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'AWAITING_VALIDATION' }),
        }),
      );
    },
  );
});
