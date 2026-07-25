export interface CanonicalOnboardingProgress {
  orderId?: string;
  currentStep: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  data: Record<string, unknown>;
  revision?: number;
  updatedAt?: string | null;
  completedAt: string | null;
  canEdit?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Parses and validates an onboarding response payload from the BFF or API.
 * Accepts either a parsed JSON object or a full JSON stringified payload.
 * Throws a descriptive error if the payload is malformed or truncated JSON,
 * preventing silent fallback to empty state.
 */
export function parseAndNormalizeOnboardingProgress(
  rawInput: unknown,
): CanonicalOnboardingProgress | null {
  if (rawInput === null || rawInput === undefined) {
    return null;
  }

  let parsed: unknown = rawInput;

  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid or truncated onboarding JSON string');
    }
  }

  if (parsed === null || parsed === undefined) {
    return null;
  }

  if (!isRecord(parsed)) {
    throw new Error('Onboarding payload must be a JSON object');
  }

  // If the object is an empty container without status, step, or data, treat as no draft
  if (
    Object.keys(parsed).length === 0 ||
    (!parsed.status && parsed.currentStep === undefined && !parsed.data && !parsed.orderId)
  ) {
    return null;
  }

  let dataObj: Record<string, unknown> = {};
  if (typeof parsed.data === 'string') {
    try {
      const innerData = JSON.parse(parsed.data);
      if (isRecord(innerData)) {
        dataObj = innerData;
      }
    } catch {
      throw new Error('Invalid or truncated onboarding inner data JSON');
    }
  } else if (isRecord(parsed.data)) {
    dataObj = parsed.data;
  }

  let status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' = 'NOT_STARTED';
  if (
    parsed.status === 'COMPLETED' ||
    parsed.status === 'IN_PROGRESS' ||
    parsed.status === 'NOT_STARTED'
  ) {
    status = parsed.status;
  } else if (parsed.completedAt || parsed.canEdit === false) {
    status = 'COMPLETED';
  } else if (Object.keys(dataObj).length > 0 || typeof parsed.currentStep === 'number') {
    status = 'IN_PROGRESS';
  }

  let currentStep = 0;
  if (typeof parsed.currentStep === 'number' && Number.isFinite(parsed.currentStep)) {
    currentStep = Math.max(0, Math.floor(parsed.currentStep));
  } else if (typeof parsed.currentStep === 'string' && !Number.isNaN(Number(parsed.currentStep))) {
    currentStep = Math.max(0, Math.floor(Number(parsed.currentStep)));
  }

  const orderId = typeof parsed.orderId === 'string' ? parsed.orderId : undefined;
  const revision =
    typeof parsed.revision === 'number' && Number.isFinite(parsed.revision)
      ? parsed.revision
      : undefined;
  const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
  const completedAt = typeof parsed.completedAt === 'string' ? parsed.completedAt : null;
  const canEdit = typeof parsed.canEdit === 'boolean' ? parsed.canEdit : undefined;

  return {
    orderId,
    currentStep,
    status,
    data: dataObj,
    revision,
    updatedAt,
    completedAt,
    canEdit,
  };
}
