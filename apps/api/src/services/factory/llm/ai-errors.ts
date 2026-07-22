import { AiProvider } from '../ai-execution.types';

/**
 * Normalized AI error categories for Desk + AiRun.
 * Keep messages free of secrets; include provider + model.
 */
export type AiNormalizedErrorCode =
  | 'quota_billing'
  | 'rate_limit'
  | 'invalid_key'
  | 'forbidden'
  | 'model_not_found'
  | 'region_not_supported'
  | 'api_not_enabled'
  | 'credentials_invalid'
  | 'structured_output_unsupported'
  | 'timeout'
  | 'network'
  | 'unknown';

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{10,}\b/g,
  /\bAIza[A-Za-z0-9_-]{10,}\b/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gi,
];

export function sanitizeAiErrorMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[redacted]');
  }
  return sanitized.slice(0, 500);
}

export function providerDisplayName(provider: AiProvider | string): string {
  if (provider === 'gemini') return 'Gemini API';
  if (provider === 'vertex') return 'Vertex AI';
  if (provider === 'openai') return 'OpenAI';
  return String(provider);
}

export function classifyNormalizedAiError(rawMessage: string): AiNormalizedErrorCode {
  const message = sanitizeAiErrorMessage(rawMessage).toLowerCase();

  if (message.includes('timeout') || message.includes('timed out') || message.includes('abort')) {
    return 'timeout';
  }
  if (
    message.includes('resource_exhausted') ||
    message.includes('insufficient_quota') ||
    message.includes('exceeded your current quota') ||
    (message.includes('quota') && message.includes('billing')) ||
    message.includes('billing hard limit')
  ) {
    return 'quota_billing';
  }
  if (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('rate_limit') ||
    message.includes('too many requests')
  ) {
    return 'rate_limit';
  }
  if (
    message.includes('401') ||
    message.includes('api_key_invalid') ||
    message.includes('invalid api key') ||
    message.includes('incorrect api key') ||
    message.includes('unauthorized')
  ) {
    return 'invalid_key';
  }
  if (
    message.includes('credentials') &&
    (message.includes('invalid') || message.includes('unable to') || message.includes('failed'))
  ) {
    return 'credentials_invalid';
  }
  if (
    message.includes('api not enabled') ||
    message.includes('has not been used') ||
    message.includes('enable it by visiting') ||
    message.includes('service_disabled')
  ) {
    return 'api_not_enabled';
  }
  if (
    message.includes('location') &&
    (message.includes('not supported') ||
      message.includes('unavailable') ||
      message.includes('not found') ||
      message.includes('invalid'))
  ) {
    return 'region_not_supported';
  }
  if (
    message.includes('403') ||
    message.includes('permission denied') ||
    message.includes('forbidden') ||
    message.includes('access denied')
  ) {
    return 'forbidden';
  }
  if (
    message.includes('json schema') ||
    message.includes('response_schema') ||
    message.includes('responsejsonschema') ||
    message.includes('structured output') ||
    message.includes('additionalproperties')
  ) {
    return 'structured_output_unsupported';
  }
  if (
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('model_not_found') ||
    message.includes('does not exist') ||
    message.includes('is not supported')
  ) {
    return 'model_not_found';
  }
  if (
    message.includes('network') ||
    message.includes('socket') ||
    message.includes('econn') ||
    message.includes('etimedout') ||
    message.includes('fetch failed') ||
    message.includes('enotfound')
  ) {
    return 'network';
  }
  return 'unknown';
}

export function isRetryableNormalizedError(code: AiNormalizedErrorCode): boolean {
  return code === 'rate_limit' || code === 'network';
}

export function isRetryableHttpStatus(status?: number): boolean {
  return status === 429 || (typeof status === 'number' && status >= 500 && status < 600);
}

export function formatProviderError(
  provider: AiProvider | string,
  model: string,
  error: unknown,
  options?: { location?: string },
): Error {
  const raw = error instanceof Error ? error.message : String(error);
  const sanitized = sanitizeAiErrorMessage(raw);
  const code = classifyNormalizedAiError(sanitized);
  const label = providerDisplayName(provider);
  const status =
    (error as { status?: number; statusCode?: number } | null)?.status ??
    (error as { statusCode?: number } | null)?.statusCode;

  let detail: string;
  switch (code) {
    case 'quota_billing':
      detail = `quota ou facturation insuffisants pour le modèle ${model}.`;
      break;
    case 'rate_limit':
      detail = `limite de requêtes atteinte pour le modèle ${model}.`;
      break;
    case 'invalid_key':
      detail = `clé API invalide pour le modèle ${model}.`;
      break;
    case 'credentials_invalid':
      detail = `identifiants invalides pour le modèle ${model}.`;
      break;
    case 'forbidden':
      detail = `permissions refusées pour le modèle ${model}.`;
      break;
    case 'model_not_found':
      detail =
        provider === 'gemini'
          ? `modèle ${model} inaccessible avec la clé actuelle.`
          : `modèle ${model} introuvable ou inaccessible.`;
      break;
    case 'region_not_supported':
      detail = options?.location
        ? `modèle ${model} indisponible dans la région ${options.location} pour le projet configuré.`
        : `région non supportée pour le modèle ${model}.`;
      break;
    case 'api_not_enabled':
      detail = `API non activée pour le modèle ${model}.`;
      break;
    case 'structured_output_unsupported':
      detail = `sortie JSON structurée non supportée pour le modèle ${model}.`;
      break;
    case 'timeout':
      detail = `délai dépassé pour le modèle ${model}.`;
      break;
    case 'network':
      detail = `erreur réseau pour le modèle ${model}.`;
      break;
    default:
      detail = `échec sur le modèle ${model}: ${sanitized}`;
  }

  const formatted = new Error(`${label} — ${detail}`);
  (
    formatted as Error & { code?: string; status?: number; provider?: string; model?: string }
  ).code = code;
  (formatted as Error & { status?: number }).status = status;
  (formatted as Error & { provider?: string }).provider = String(provider);
  (formatted as Error & { model?: string }).model = model;
  return formatted;
}
