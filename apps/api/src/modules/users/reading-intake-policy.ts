export const READING_REQUIREMENTS_VERSION = '2026-08-05-required-intake-v2';

export const INTENTION_MODES = ['QUESTION', 'SITUATION', 'OPEN'] as const;
export type IntentionMode = (typeof INTENTION_MODES)[number];

export const REQUIRED_READING_FIELDS = [
  'birthDate',
  'birthPlace',
  'intention',
  'facePhotoUrl',
  'palmPhotoUrl',
] as const;

export type RequiredReadingField = (typeof REQUIRED_READING_FIELDS)[number];
export type ReadingPhotoStatus = 'MISSING' | 'VALID' | 'INVALID' | 'LIMITED';

export interface ReadingRequirementsProfile {
  birthDate?: unknown;
  birthPlace?: unknown;
  intentionMode?: unknown;
  openReading?: unknown;
  specificQuestion?: unknown;
  objective?: unknown;
  facePhotoUrl?: unknown;
  facePhoto?: unknown;
  palmPhotoUrl?: unknown;
  palmPhoto?: unknown;
}

export interface ReadingRequirementsOptions {
  requireExplicitIntentionMode?: boolean;
  strictIntentionExclusivity?: boolean;
  facePhotoStatus?: ReadingPhotoStatus;
  palmPhotoStatus?: ReadingPhotoStatus;
}

export interface ReadingRequirementsResult {
  requirementsVersion: typeof READING_REQUIREMENTS_VERSION;
  complete: boolean;
  missingFields: RequiredReadingField[];
  invalidFields: RequiredReadingField[];
  intention: {
    mode: IntentionMode | null;
    valid: boolean;
    explicit: boolean;
    value: string | null;
  };
  photos: {
    face: ReadingPhotoStatus;
    palm: ReadingPhotoStatus;
  };
}

const MIN_INTENTION_LENGTH = 10;

export function evaluateReadingRequirements(
  profile: ReadingRequirementsProfile,
  options: ReadingRequirementsOptions = {},
): ReadingRequirementsResult {
  const missingFields: RequiredReadingField[] = [];
  const invalidFields: RequiredReadingField[] = [];

  const birthDate = clean(profile.birthDate);
  if (!birthDate) missingFields.push('birthDate');
  else if (!isValidPastCalendarDate(birthDate)) invalidFields.push('birthDate');

  const birthPlace = clean(profile.birthPlace);
  if (!birthPlace) missingFields.push('birthPlace');
  else if (birthPlace.length < 2) invalidFields.push('birthPlace');

  const intention = resolveIntention(profile, options);
  if (!intention.value && !intention.mode) missingFields.push('intention');
  else if (!intention.valid) invalidFields.push('intention');

  const face = resolvePhotoStatus(
    firstClean(profile.facePhotoUrl, profile.facePhoto),
    options.facePhotoStatus,
  );
  const palm = resolvePhotoStatus(
    firstClean(profile.palmPhotoUrl, profile.palmPhoto),
    options.palmPhotoStatus,
  );
  addPhotoIssue('facePhotoUrl', face, missingFields, invalidFields);
  addPhotoIssue('palmPhotoUrl', palm, missingFields, invalidFields);

  return {
    requirementsVersion: READING_REQUIREMENTS_VERSION,
    complete: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields,
    intention,
    photos: { face, palm },
  };
}

export function assertCompleteReadingRequirements(
  profile: ReadingRequirementsProfile,
  options: ReadingRequirementsOptions = {},
): ReadingRequirementsResult {
  const result = evaluateReadingRequirements(profile, options);
  if (!result.complete) {
    const error = new Error('Le dossier doit être complété avant sa transmission.');
    Object.assign(error, {
      code: 'READING_INTAKE_INCOMPLETE',
      missingFields: result.missingFields,
      invalidFields: result.invalidFields,
    });
    throw error;
  }
  return result;
}

export function isPrivateOnboardingPhotoReference(value: unknown): value is string {
  const normalized = clean(value);
  return Boolean(
    normalized &&
      normalized.startsWith('s3://onboarding/') &&
      !normalized.includes('..') &&
      !/^https?:\/\//i.test(normalized),
  );
}

export function resolveIntention(
  profile: ReadingRequirementsProfile,
  options: Pick<
    ReadingRequirementsOptions,
    'requireExplicitIntentionMode' | 'strictIntentionExclusivity'
  > = {},
): ReadingRequirementsResult['intention'] {
  const question = clean(profile.specificQuestion);
  const objective = clean(profile.objective);
  const open = profile.openReading === true;
  const explicitMode = isIntentionMode(profile.intentionMode) ? profile.intentionMode : null;
  const mode =
    explicitMode ??
    (options.requireExplicitIntentionMode
      ? null
      : question
        ? 'QUESTION'
        : objective
          ? 'SITUATION'
          : open
            ? 'OPEN'
            : null);

  const value = mode === 'QUESTION' ? question : mode === 'SITUATION' ? objective : mode === 'OPEN' ? 'OPEN' : null;
  let valid = false;
  if (mode === 'QUESTION') valid = Boolean(question && question.length >= MIN_INTENTION_LENGTH);
  if (mode === 'SITUATION') valid = Boolean(objective && objective.length >= MIN_INTENTION_LENGTH);
  if (mode === 'OPEN') valid = open;

  if (options.strictIntentionExclusivity && mode) {
    const contradictory =
      (mode === 'QUESTION' && (open || Boolean(objective))) ||
      (mode === 'SITUATION' && (open || Boolean(question))) ||
      (mode === 'OPEN' && (Boolean(question) || Boolean(objective)));
    if (contradictory) valid = false;
  }

  return {
    mode,
    valid,
    explicit: Boolean(explicitMode),
    value: value === 'OPEN' ? null : value,
  };
}

function resolvePhotoStatus(
  storageRef: string | null,
  validatedStatus?: ReadingPhotoStatus,
): ReadingPhotoStatus {
  if (validatedStatus) return validatedStatus;
  if (!storageRef) return 'MISSING';
  return isPrivateOnboardingPhotoReference(storageRef) ? 'VALID' : 'INVALID';
}

function addPhotoIssue(
  field: Extract<RequiredReadingField, 'facePhotoUrl' | 'palmPhotoUrl'>,
  status: ReadingPhotoStatus,
  missing: RequiredReadingField[],
  invalid: RequiredReadingField[],
): void {
  if (status === 'MISSING') missing.push(field);
  else if (status === 'INVALID') invalid.push(field);
}

function isIntentionMode(value: unknown): value is IntentionMode {
  return typeof value === 'string' && INTENTION_MODES.includes(value as IntentionMode);
}

function firstClean(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = clean(value);
    if (normalized) return normalized;
  }
  return null;
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function isValidPastCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return timestamp <= todayUtc;
}
