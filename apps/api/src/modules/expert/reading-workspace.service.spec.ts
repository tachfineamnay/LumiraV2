import { BadRequestException, ConflictException } from '@nestjs/common';
import { Expert } from '@prisma/client';
import { ReadingWorkspaceService } from './reading-workspace.service';
import type { CanonicalReadingContent } from './reading-version';

const expert = { id: 'expert-1', role: 'ADMIN' } as Expert;

function validReading(): CanonicalReadingContent {
  const domains = [
    'spirituel',
    'relations',
    'mission',
    'creativite',
    'emotions',
    'travail',
    'sante',
    'finance',
  ];
  const paragraph = Array.from({ length: 190 }, (_, index) => `mot${index}`).join(' ');
  return {
    pdf_content: {
      introduction: paragraph,
      archetype_reveal: paragraph,
      sections: domains.map((domain) => ({
        domain,
        title: `Titre ${domain}`,
        content: paragraph,
      })),
      karmic_insights: [paragraph, paragraph, paragraph, paragraph],
      life_mission: paragraph,
      rituals: [
        {
          name: 'Rituel ancrage',
          description: paragraph,
          instructions: [
            'Préparer un espace calme pendant cinq minutes.',
            'Respirer lentement en observant les appuis du corps.',
            'Écrire une phrase simple sur le besoin du jour.',
            'Choisir une action réaliste à accomplir maintenant.',
          ],
        },
        {
          name: 'Rituel décision',
          description: paragraph,
          instructions: [
            'Nommer clairement la décision à examiner.',
            'Lister les faits disponibles sans interprétation.',
            'Identifier la limite à respecter aujourd’hui.',
            'Poser un premier acte mesurable dans la journée.',
          ],
        },
      ],
      conclusion: paragraph,
    },
    synthesis: {
      archetype: 'Le Guide',
      keywords: ['ancrage', 'clarté', 'relation', 'création', 'action'],
      emotional_state: 'En transition',
      key_blockage: 'Dispersion',
    },
    timeline: [],
    lecture: 'ancienne narration',
  };
}

function createHarness(generatedContent: Record<string, unknown>) {
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'order-1',
        amount: 1700,
        status: 'AWAITING_VALIDATION',
        generatedContent,
      }),
      update: jest.fn().mockResolvedValue({ id: 'order-1' }),
    },
  };
  const expertService = {
    getOrderById: jest.fn().mockResolvedValue({
      id: 'order-1',
      orderNumber: 'LUM-1',
      amount: 1700,
      status: 'AWAITING_VALIDATION',
      generatedContent,
      user: {
        id: 'user-1',
        firstName: 'Amina',
        lastName: 'Test',
        profile: { birthDate: '1990-01-01' },
      },
      files: [],
    }),
    getContentVersions: jest.fn().mockResolvedValue({ versions: [] }),
    listOrderDeliveries: jest.fn().mockResolvedValue({ deliveries: [] }),
    validateContent: jest.fn(),
    reopenForRevision: jest.fn(),
  };
  const production = { enqueueReading: jest.fn() };
  const vertexOracle = { refineContent: jest.fn() };
  const pdfFactory = { generatePdf: jest.fn() };

  const service = new ReadingWorkspaceService(
    prisma as never,
    expertService as never,
    production as never,
    vertexOracle as never,
    pdfFactory as never,
  );

  return { service, prisma, expertService, vertexOracle };
}

describe('ReadingWorkspaceService', () => {
  it('saves one block, snapshots its previous value and rebuilds the narration', async () => {
    const reading = validReading();
    const harness = createHarness({ ...reading, readingRevision: 0 });
    const updatedSection = {
      ...reading.pdf_content.sections[2],
      content: 'Mission corrigée par l’expert avec une formulation unique.',
    };

    const result = await harness.service.patchBlock(
      'order-1',
      'section.mission',
      { value: updatedSection, expectedRevision: 0 },
      expert,
    );

    expect(result.revision).toBe(1);
    expect(result.restorableBlocks).toContain('section.mission');
    expect(result.reading.lecture).toContain(updatedSection.content);
    expect(result.reading.lecture).toContain('1. Préparer un espace calme');

    const update = harness.prisma.order.update.mock.calls[0][0];
    const payload = update.data.generatedContent as Record<string, unknown>;
    const versions = payload.blockVersions as Record<string, unknown[]>;
    expect(versions['section.mission']).toHaveLength(1);
  });

  it('rejects a stale optimistic revision', async () => {
    const reading = validReading();
    const harness = createHarness({ ...reading, readingRevision: 4 });

    await expect(
      harness.service.patchBlock(
        'order-1',
        'conclusion',
        { value: 'Nouvelle conclusion', expectedRevision: 3 },
        expert,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('restores the latest short block snapshot', async () => {
    const reading = validReading();
    const previousConclusion = 'Conclusion précédente conservée dans l’historique court.';
    const harness = createHarness({
      ...reading,
      readingRevision: 2,
      blockVersions: {
        conclusion: [
          { at: new Date().toISOString(), expertId: expert.id, value: previousConclusion },
        ],
      },
    });

    const result = await harness.service.restoreBlock(
      'order-1',
      'conclusion',
      { expectedRevision: 2 },
      expert,
    );

    expect(result.reading.pdf_content.conclusion).toBe(previousConclusion);
    expect(result.restorableBlocks).not.toContain('conclusion');
  });

  it('blocks sealing when the canonical reading is structurally incomplete', async () => {
    const broken = validReading();
    broken.pdf_content.rituals[0].instructions = [];
    const harness = createHarness({ ...broken, readingRevision: 0 });

    await expect(
      harness.service.seal('order-1', { acknowledgeWarnings: true }, expert),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.expertService.validateContent).not.toHaveBeenCalled();
  });
});
