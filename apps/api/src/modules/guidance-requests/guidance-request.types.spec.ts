import {
  GUIDANCE_MESSAGE_KIND,
  GUIDANCE_REQUEST_META_KIND,
  parseGuidanceRequest,
  serializeGuidanceRequest,
} from './guidance-request.types';

describe('guidance request JSON contract', () => {
  const parsed = {
    meta: {
      kind: GUIDANCE_REQUEST_META_KIND,
      version: 1 as const,
      status: 'WAITING_EXPERT' as const,
      category: 'READING_CLARIFICATION' as const,
      priority: 'NORMAL' as const,
      assignedExpertId: null,
      assignedExpertName: null,
      createdAt: '2026-07-17T10:00:00.000Z',
      updatedAt: '2026-07-17T10:00:00.000Z',
      resolvedAt: null,
    },
    messages: [
      {
        kind: GUIDANCE_MESSAGE_KIND,
        id: 'msg-1',
        senderType: 'CLIENT' as const,
        senderId: 'user-1',
        senderName: null,
        content: 'Je souhaite clarifier un passage de ma lecture.',
        createdAt: '2026-07-17T10:00:00.000Z',
        readByClientAt: '2026-07-17T10:00:00.000Z',
        readByExpertAt: null,
      },
    ],
  };

  it('round-trips the canonical structured request', () => {
    expect(parseGuidanceRequest(serializeGuidanceRequest(parsed))).toEqual(parsed);
  });

  it('does not reinterpret a legacy AI chat session as an expert request', () => {
    expect(
      parseGuidanceRequest([
        { role: 'user', content: 'Ancien chat IA', timestamp: '2026-07-17T10:00:00.000Z' },
        { role: 'assistant', content: 'Réponse IA', timestamp: '2026-07-17T10:01:00.000Z' },
      ]),
    ).toBeNull();
  });

  it('rejects unknown metadata and malformed messages without exposing them', () => {
    expect(parseGuidanceRequest([{ kind: 'UNKNOWN', status: 'NEW', category: 'OTHER' }])).toBeNull();

    const value = serializeGuidanceRequest(parsed) as unknown[];
    value.push({ kind: GUIDANCE_MESSAGE_KIND, id: 'bad', content: 42 });
    expect(parseGuidanceRequest(value as never)?.messages).toHaveLength(1);
  });
});
