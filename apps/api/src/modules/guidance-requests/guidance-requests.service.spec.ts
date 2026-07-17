import { ExpertRole } from '@prisma/client';
import { GuidanceRequestsService } from './guidance-requests.service';
import {
  GUIDANCE_MESSAGE_KIND,
  GUIDANCE_REQUEST_META_KIND,
  serializeGuidanceRequest,
} from './guidance-request.types';

const expert = {
  id: 'expert-1',
  email: 'expert@example.com',
  password: 'hash',
  name: 'Expert Test',
  role: ExpertRole.EXPERT,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const now = '2026-07-17T10:00:00.000Z';

function canonicalMessages(status = 'NEW') {
  return serializeGuidanceRequest({
    meta: {
      kind: GUIDANCE_REQUEST_META_KIND,
      version: 1,
      status: status as 'NEW',
      category: 'READING_CLARIFICATION',
      priority: 'NORMAL',
      assignedExpertId: null,
      assignedExpertName: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    },
    messages: [
      {
        kind: GUIDANCE_MESSAGE_KIND,
        id: 'msg-client',
        senderType: 'CLIENT',
        senderId: 'user-1',
        senderName: null,
        content: 'Je souhaite comprendre ce passage de ma lecture.',
        createdAt: now,
        readByClientAt: now,
        readByExpertAt: null,
      },
    ],
  });
}

function createPrisma() {
  const session = {
    id: 'request-1',
    userId: 'user-1',
    relatedOrderId: 'order-1',
    title: 'Clarifier ma lecture',
    messages: canonicalMessages(),
    isActive: true,
    lastMessageAt: new Date(now),
    createdAt: new Date(now),
    updatedAt: new Date(now),
    user: {
      id: 'user-1',
      firstName: 'Client',
      lastName: 'Test',
      email: 'client@example.com',
    },
    relatedOrder: { id: 'order-1', orderNumber: 'LUM-1' },
  };
  const tx = {
    chatSession: {
      findUnique: jest.fn().mockResolvedValue(session),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...session,
        ...data,
        updatedAt: new Date('2026-07-17T10:05:00.000Z'),
      })),
    },
  };
  const prisma = {
    order: {
      findFirst: jest.fn().mockResolvedValue({ id: 'order-1' }),
    },
    chatSession: {
      create: jest.fn().mockResolvedValue(session),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(session),
      findUnique: jest.fn().mockResolvedValue(session),
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    tx,
    session,
  };
  return prisma;
}

describe('GuidanceRequestsService', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date(now)));
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('requires a paid lifetime entitlement before a client creates a request', async () => {
    const prisma = createPrisma();
    prisma.order.findFirst.mockResolvedValue(null);
    const service = new GuidanceRequestsService(prisma as never);

    await expect(
      service.createClientRequest('user-1', {
        subject: 'Une question précise',
        content: 'Je souhaite obtenir un éclairage sur cette situation.',
      }),
    ).rejects.toThrow('Une commande payée est nécessaire');
    expect(prisma.chatSession.create).not.toHaveBeenCalled();
  });

  it('creates a structured request without changing the legacy AI chat contract', async () => {
    const prisma = createPrisma();
    const service = new GuidanceRequestsService(prisma as never);

    await service.createClientRequest('user-1', {
      subject: 'Clarifier ma lecture',
      content: 'Je souhaite comprendre ce passage de ma lecture.',
      category: 'READING_CLARIFICATION',
      relatedOrderId: 'order-1',
    });

    expect(prisma.chatSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        relatedOrderId: 'order-1',
        title: 'Clarifier ma lecture',
        isActive: true,
        messages: expect.any(Array),
      }),
      include: { user: true, relatedOrder: true },
    });
    const messages = prisma.chatSession.create.mock.calls[0][0].data.messages as Array<
      Record<string, unknown>
    >;
    expect(messages[0]).toMatchObject({ kind: GUIDANCE_REQUEST_META_KIND, status: 'NEW' });
    expect(messages[1]).toMatchObject({
      kind: GUIDANCE_MESSAGE_KIND,
      senderType: 'CLIENT',
      content: 'Je souhaite comprendre ce passage de ma lecture.',
    });
  });

  it('excludes legacy AI sessions from the Desk request inbox', async () => {
    const prisma = createPrisma();
    prisma.chatSession.findMany.mockResolvedValue([
      {
        ...prisma.session,
        id: 'legacy-chat',
        messages: [
          { role: 'user', content: 'Chat IA', timestamp: now },
          { role: 'assistant', content: 'Réponse IA', timestamp: now },
        ],
      },
      prisma.session,
    ]);
    const service = new GuidanceRequestsService(prisma as never);

    const requests = await service.listExpertRequests(expert);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ id: 'request-1', subject: 'Clarifier ma lecture' });
  });

  it('sends an expert reply, waits for the client and creates a private-safe notification', async () => {
    const prisma = createPrisma();
    const service = new GuidanceRequestsService(prisma as never);

    const result = await service.addExpertMessage(
      expert,
      'request-1',
      'Voici une réponse précise liée à votre lecture.',
    );

    expect(result.status).toBe('WAITING_CLIENT');
    expect(result.assignedExpert).toEqual({ id: expert.id, name: expert.name });
    expect(prisma.tx.chatSession.update).toHaveBeenCalledTimes(1);
    const stored = prisma.tx.chatSession.update.mock.calls[0][0].data.messages as Array<
      Record<string, unknown>
    >;
    expect(stored[0]).toMatchObject({
      status: 'WAITING_CLIENT',
      assignedExpertId: expert.id,
    });
    expect(stored[2]).toMatchObject({
      senderType: 'EXPERT',
      content: 'Voici une réponse précise liée à votre lecture.',
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'SYSTEM',
        title: 'Une réponse vous attend',
        message: 'Une réponse à votre demande d’éclairage est disponible dans votre Sanctuaire.',
        metadata: {
          guidanceRequestId: 'request-1',
          relatedOrderId: 'order-1',
        },
      },
    });
    expect(JSON.stringify(prisma.notification.create.mock.calls[0][0])).not.toContain(
      'Voici une réponse précise',
    );
  });
});
