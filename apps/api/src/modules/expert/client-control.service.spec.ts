import { ClientControlService } from './client-control.service';

const now = new Date('2026-07-17T12:00:00.000Z');

function buildClient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    refId: 'LUM-C-26-0001',
    email: 'client@example.com',
    firstName: 'Client',
    lastName: 'Test',
    phone: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    profile: {
      profileCompleted: true,
      birthDate: '1983-01-01',
      birthPlace: 'Casablanca',
      facePhotoUrl: 's3://private/face.jpg',
      palmPhotoUrl: 's3://private/palm.jpg',
    },
    consents: [{ id: 'consent-1', revokedAt: null, acceptedAt: now }],
    onboardingProgress: {
      id: 'onboarding-1',
      status: 'COMPLETED',
      completedAt: new Date('2026-07-02T10:00:00.000Z'),
    },
    orders: [
      {
        id: 'order-1',
        orderNumber: 'LUM-2026-0001',
        amount: 2900,
        currency: 'eur',
        status: 'COMPLETED',
        paidAt: new Date('2026-07-02T12:00:00.000Z'),
        deliveredAt: new Date('2026-07-03T12:00:00.000Z'),
        createdAt: new Date('2026-07-02T11:00:00.000Z'),
        generatedContent: {
          synthesis: { archetype: 'Le Visionnaire' },
        },
        expertReview: {
          assignedBy: 'expert-1',
          assignedName: 'Grégory',
          assignedAt: '2026-07-02T12:30:00.000Z',
          production: {
            id: 'prod-1',
            orderId: 'order-1',
            orderNumber: 'LUM-2026-0001',
            type: 'AUDIO_GENERATION',
            status: 'SUCCEEDED',
            stage: 'COMPLETED',
            attempts: 1,
            maxAttempts: 3,
            requestedByExpertId: 'expert-1',
            queuedAt: '2026-07-03T11:00:00.000Z',
          },
        },
        readingVersions: [
          {
            id: 'version-2',
            version: 2,
            status: 'SEALED',
            sealedAt: new Date('2026-07-03T10:00:00.000Z'),
            createdAt: new Date('2026-07-03T09:00:00.000Z'),
          },
          {
            id: 'version-1',
            version: 1,
            status: 'REOPENED',
            sealedAt: new Date('2026-07-02T18:00:00.000Z'),
            createdAt: new Date('2026-07-02T17:00:00.000Z'),
          },
        ],
        deliveries: [
          {
            id: 'delivery-1',
            readingVersionId: 'version-2',
            pdfKey: 'readings/LUM-2026-0001/final.pdf',
            contentHash: 'hash-v2',
            emailStatus: 'SENT',
            emailAttempts: 1,
            emailSentAt: new Date('2026-07-03T12:00:00.000Z'),
            lastEmailError: null,
            createdAt: new Date('2026-07-03T11:30:00.000Z'),
          },
        ],
        files: [
          {
            id: 'audio-1',
            type: 'AUDIO_READING',
            key: 'audio/LUM-2026-0001/synthesis.mp3',
            uploadedAt: new Date('2026-07-03T11:45:00.000Z'),
          },
        ],
        chatContexts: [],
      },
    ],
    chatSessions: [
      {
        id: 'chat-1',
        relatedOrderId: 'order-1',
        title: 'Question privée',
        messages: [
          {
            role: 'user',
            content: 'CONTENU_PERSONNEL_NE_DOIT_PAS_ETRE_DANS_LA_TIMELINE',
            timestamp: '2026-07-04T10:00:00.000Z',
          },
          {
            role: 'assistant',
            content: 'Réponse confidentielle',
            timestamp: '2026-07-04T10:01:00.000Z',
          },
        ],
        isActive: true,
        lastMessageAt: new Date('2026-07-04T10:01:00.000Z'),
        createdAt: new Date('2026-07-04T10:00:00.000Z'),
        updatedAt: new Date('2026-07-04T10:01:00.000Z'),
      },
    ],
    notifications: [
      {
        id: 'notification-1',
        type: 'CONTENT_READY',
        title: 'Lecture prête',
        read: false,
        createdAt: now,
        metadata: { orderId: 'order-1' },
      },
    ],
    ...overrides,
  };
}

describe('ClientControlService', () => {
  it('returns a lifetime client history without flattening reading versions', async () => {
    const client = buildClient();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(client),
        findUniqueOrThrow: jest.fn().mockResolvedValue(client),
      },
    };
    const service = new ClientControlService(prisma as never);

    const result = await service.getClientControlCenter('user-1');

    expect(result.client.access).toBe('LIFETIME');
    expect(result.summary).toMatchObject({
      totalReadings: 1,
      deliveredReadings: 1,
      incidents: 0,
      conversations: 1,
      unreadNotifications: 1,
    });
    expect(result.readings[0]).toMatchObject({
      title: 'Lecture fondatrice — Le Visionnaire',
      state: 'DELIVERED',
      versions: {
        count: 2,
        sealedVersionId: 'version-2',
        sealedVersionNumber: 2,
      },
      assets: {
        pdf: { status: 'READY', contentHash: 'hash-v2' },
        audio: { status: 'READY', fileId: 'audio-1' },
        email: { status: 'SENT', attempts: 1 },
      },
    });
  });

  it('keeps personal message bodies out of the operational timeline', async () => {
    const client = buildClient();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(client),
        findUniqueOrThrow: jest.fn().mockResolvedValue(client),
      },
    };
    const service = new ClientControlService(prisma as never);

    const result = await service.getClientControlCenter('user-1');
    const serializedTimeline = JSON.stringify(result.timeline);

    expect(serializedTimeline).toContain('Échange IA — Question privée');
    expect(serializedTimeline).not.toContain('CONTENU_PERSONNEL_NE_DOIT_PAS_ETRE_DANS_LA_TIMELINE');
    expect(serializedTimeline).not.toContain('Réponse confidentielle');
  });

  it('keeps lifetime access when a paid generation fails and marks the reading as an incident', async () => {
    const base = buildClient();
    const failedOrder = {
      ...base.orders[0],
      status: 'FAILED',
      deliveredAt: null,
      files: [],
      deliveries: [],
      readingVersions: [],
      generatedContent: null,
      expertReview: {
        production: {
          id: 'prod-failed',
          orderId: 'order-1',
          orderNumber: 'LUM-2026-0001',
          type: 'READING_GENERATION',
          status: 'FAILED',
          stage: 'FAILED',
          attempts: 1,
          maxAttempts: 3,
          requestedByExpertId: 'expert-1',
          queuedAt: '2026-07-03T11:00:00.000Z',
          error: { message: 'Provider indisponible' },
        },
      },
    };
    const client = buildClient({ orders: [failedOrder] });
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(client),
        findUniqueOrThrow: jest.fn().mockResolvedValue(client),
      },
    };
    const service = new ClientControlService(prisma as never);

    const result = await service.getClientControlCenter('user-1');

    expect(result.client.access).toBe('LIFETIME');
    expect(result.readings[0].state).toBe('INCIDENT');
    expect(result.summary.incidents).toBe(1);
  });
});
