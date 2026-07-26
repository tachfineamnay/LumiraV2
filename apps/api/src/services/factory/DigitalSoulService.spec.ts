import { BadRequestException, ConflictException } from '@nestjs/common';
import { DigitalSoulService } from './DigitalSoulService';
import { OracleResponse } from './VertexOracle';
import { hashReadingWorkspaceSnapshot } from '../../modules/expert/reading-version';

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

function buildService(
  qualityStatus: 'PASS' | 'WARNING' | 'BLOCKED',
  generatedContent: Record<string, unknown> = oldDraft,
) {
  const transactionOrderUpdate = jest.fn().mockResolvedValue({});
  const readingVersionCreate = jest.fn().mockResolvedValue({ id: 'candidate-version-1' });
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-1',
        status: 'AWAITING_VALIDATION',
        amount: 2900,
        generatedContent,
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
      callback({
        order: {
          findUnique: jest.fn().mockResolvedValue({ generatedContent }),
          update: transactionOrderUpdate,
        },
        readingVersion: {
          findFirst: jest.fn().mockResolvedValue({ version: 8 }),
          create: readingVersionCreate,
        },
      }),
    ),
  };
  const readingSource = {
    source: 'SEALED_INTAKE' as const,
    contentHash: 'sealed-intake-hash',
    profile: {
      facePhotoUrl: null as string | null,
      palmPhotoUrl: null as string | null,
      palmRole: 'PALM_UNKNOWN' as const,
    },
  };
  const vertexOracle = {
    generateFullReading: jest.fn().mockResolvedValue(candidate(qualityStatus)),
  };
  const onboardingPhotos = { prepareForAi: jest.fn() };
  const service = new DigitalSoulService(
    { get: jest.fn((_key: string, fallback?: string) => fallback) } as never,
    prisma as never,
    vertexOracle as never,
    {} as never,
    {
      resolve: jest.fn().mockReturnValue(readingSource),
      toVertexUserProfile: jest.fn().mockReturnValue({
        userId: 'user-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@example.test',
      }),
    } as never,
    onboardingPhotos as never,
  );
  return {
    service,
    prisma,
    transactionOrderUpdate,
    readingVersionCreate,
    vertexOracle,
    readingSource,
    onboardingPhotos,
  };
}

describe('DigitalSoulService candidate promotion', () => {
  it('continues without palmistry when the palm cannot be prepared', async () => {
    const { service, readingSource, onboardingPhotos, vertexOracle } = buildService('PASS');
    readingSource.profile.palmPhotoUrl = 's3://onboarding/user-1/palm-corrupt.jpg';
    onboardingPhotos.prepareForAi.mockRejectedValue(new BadRequestException('corrompue'));

    await service.generateContentOnly('order-1');

    expect(vertexOracle.generateFullReading).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      [expect.objectContaining({ role: 'PALM_UNKNOWN', analysisLimited: true })],
    );
  });

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

  it('versions a successful regeneration candidate without overwriting the source draft', async () => {
    const sourceDraft = {
      ...oldDraft,
      readingRevision: 7,
      workingReadingVersionId: 'source-version-1',
      blockVersions: {
        conclusion: [{ at: '2026-07-26T00:00:00.000Z', expertId: 'expert-1', value: 'Avant' }],
      },
      expertEditHistory: [{ action: 'block:conclusion', revision: 7 }],
    };
    const { service, transactionOrderUpdate, readingVersionCreate } = buildService(
      'PASS',
      sourceDraft,
    );

    await expect(
      service.generateContentOnly('order-1', {
        generationKind: 'REGENERATE',
        sourceReadingVersionId: 'source-version-1',
        sourceRevision: 7,
        sourceDraftHash: hashReadingWorkspaceSnapshot(sourceDraft),
      }),
    ).resolves.toEqual(expect.objectContaining({ orderId: 'order-1' }));

    const promoted = transactionOrderUpdate.mock.calls.at(-1)[0].data.generatedContent as Record<
      string,
      unknown
    >;
    expect(promoted).toMatchObject({
      generationKind: 'REGENERATE',
      sourceReadingVersionId: 'source-version-1',
      sourceRevision: 7,
      candidateReadingVersionId: 'candidate-version-1',
      readingRevision: 0,
    });
    expect(sourceDraft.blockVersions).toEqual({
      conclusion: [{ at: '2026-07-26T00:00:00.000Z', expertId: 'expert-1', value: 'Avant' }],
    });
    expect(readingVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentVersionId: 'source-version-1', status: 'DRAFT' }),
      }),
    );
  });

  it('keeps a regeneration candidate but does not apply it when the source draft changed', async () => {
    const sourceDraft = {
      ...oldDraft,
      readingRevision: 2,
      workingReadingVersionId: 'source-version-1',
    };
    const changedDraft = {
      ...sourceDraft,
      readingRevision: 3,
      lecture: 'Modification manuelle récente',
    };
    const { service, prisma, transactionOrderUpdate } = buildService('PASS', sourceDraft);
    const conflictCreate = jest.fn().mockResolvedValue({ id: 'conflict-candidate-1' });
    prisma.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => unknown) =>
      callback({
        order: {
          findUnique: jest.fn().mockResolvedValue({ generatedContent: changedDraft }),
          update: transactionOrderUpdate,
        },
        readingVersion: {
          findFirst: jest.fn().mockResolvedValue({ version: 8 }),
          create: conflictCreate,
        },
      }),
    );

    await expect(
      service.generateContentOnly('order-1', {
        generationKind: 'REGENERATE',
        sourceReadingVersionId: 'source-version-1',
        sourceRevision: 2,
        sourceDraftHash: hashReadingWorkspaceSnapshot(sourceDraft),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transactionOrderUpdate).not.toHaveBeenCalled();
    expect(conflictCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'SCRIBE_REGENERATE_CONFLICT_CANDIDATE' }),
      }),
    );
  });

  it('leaves the source draft untouched when SCRIBE regeneration fails', async () => {
    const sourceDraft = {
      ...oldDraft,
      readingRevision: 5,
      workingReadingVersionId: 'source-version-1',
    };
    const { service, prisma, transactionOrderUpdate, vertexOracle } = buildService(
      'PASS',
      sourceDraft,
    );
    vertexOracle.generateFullReading.mockRejectedValue(new Error('provider unavailable'));

    await expect(
      service.generateContentOnly('order-1', {
        generationKind: 'REGENERATE',
        sourceReadingVersionId: 'source-version-1',
        sourceRevision: 5,
        sourceDraftHash: hashReadingWorkspaceSnapshot(sourceDraft),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transactionOrderUpdate).not.toHaveBeenCalled();
    expect(sourceDraft.readingRevision).toBe(5);
    expect(
      prisma.order.update.mock.calls.every((call) => !('generatedContent' in call[0].data)),
    ).toBe(true);
  });
});
