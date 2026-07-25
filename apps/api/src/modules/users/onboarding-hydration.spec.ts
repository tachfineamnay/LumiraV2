import { parseAndNormalizeOnboardingProgress } from '../../../../web/lib/onboarding-parser';

describe('Sanctuary Onboarding Hydration Parser', () => {
  const mockFilledDraft = {
    status: 'IN_PROGRESS',
    orderId: 'order-123',
    currentStep: 1,
    revision: 7,
    updatedAt: '2026-07-25T18:00:00.000Z',
    completedAt: null,
    canEdit: true,
    data: {
      usageName: 'Amnay',
      birthDate: '1990-01-01',
      birthTime: '12:00',
      birthPlace: 'Paris',
      specificQuestion: 'Quelle est ma direction de vie ?',
      objective: 'Éclairage spirituel',
    },
  };

  it('1. Hydrates a filled draft returned as a JSON object', () => {
    const result = parseAndNormalizeOnboardingProgress(mockFilledDraft);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('IN_PROGRESS');
    expect(result?.orderId).toBe('order-123');
    expect(result?.currentStep).toBe(1);
    expect(result?.revision).toBe(7);
    expect(result?.data.usageName).toBe('Amnay');
    expect(result?.data.birthPlace).toBe('Paris');
  });

  it('2. Hydrates the same draft returned as a JSON string', () => {
    const jsonString = JSON.stringify(mockFilledDraft);
    const result = parseAndNormalizeOnboardingProgress(jsonString);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('IN_PROGRESS');
    expect(result?.orderId).toBe('order-123');
    expect(result?.currentStep).toBe(1);
    expect(result?.revision).toBe(7);
    expect(result?.data.usageName).toBe('Amnay');
  });

  it('3. Rejects invalid or truncated JSON string with an explicit error', () => {
    const truncatedJson =
      '{"status":"IN_PROGRESS","orderId":"order-123","currentStep":1,"data":{"usageName":"Amn';
    expect(() => parseAndNormalizeOnboardingProgress(truncatedJson)).toThrow(
      'Invalid or truncated onboarding JSON string',
    );
  });

  it('4. Correctly parses currentStep: 1 without demoting to step 0', () => {
    const draftWithStep1 = {
      status: 'IN_PROGRESS',
      orderId: 'order-123',
      currentStep: 1,
      data: { specificQuestion: 'Test' },
    };
    const result = parseAndNormalizeOnboardingProgress(draftWithStep1);
    expect(result?.currentStep).toBe(1);
  });

  it('5. Handles stringified inner data field inside JSON object', () => {
    const nestedStringified = {
      status: 'IN_PROGRESS',
      orderId: 'order-456',
      currentStep: 2,
      data: JSON.stringify({ usageName: 'Lina', birthDate: '1995-05-05' }),
    };
    const result = parseAndNormalizeOnboardingProgress(nestedStringified);
    expect(result?.data.usageName).toBe('Lina');
    expect(result?.data.birthDate).toBe('1995-05-05');
  });

  it('6. Returns null safely for null, undefined, or empty objects', () => {
    expect(parseAndNormalizeOnboardingProgress(null)).toBeNull();
    expect(parseAndNormalizeOnboardingProgress(undefined)).toBeNull();
    expect(parseAndNormalizeOnboardingProgress({})).toBeNull();
  });
});
