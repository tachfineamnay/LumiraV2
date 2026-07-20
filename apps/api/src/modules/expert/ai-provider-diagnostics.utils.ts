import { AiErrorCategory } from './ai-provider-diagnostics.types';

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{10,}\b/g,
  /\bAIza[A-Za-z0-9_-]{10,}\b/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
];

export function sanitizeAiErrorMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[redacted]');
  }
  return sanitized.slice(0, 500);
}

export function classifyAiError(rawMessage: string): {
  category: AiErrorCategory;
  userMessage: string;
} {
  const message = sanitizeAiErrorMessage(rawMessage).toLowerCase();

  if (message.includes('timeout') || message.includes('timed out') || message.includes('abort')) {
    return {
      category: 'timeout',
      userMessage: 'Délai dépassé lors du test. Réessayez ou vérifiez la connectivité réseau.',
    };
  }

  if (
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('billing') ||
    message.includes('insufficient_quota') ||
    message.includes('exceeded your current quota')
  ) {
    return {
      category: 'quota',
      userMessage:
        'Quota ou facturation absents. Vérifiez la facturation Google AI Studio / OpenAI Platform.',
    };
  }

  if (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('rate_limit') ||
    message.includes('too many requests')
  ) {
    return {
      category: 'rate_limit',
      userMessage: 'Limite de requêtes atteinte (429). Attendez quelques instants puis retestez.',
    };
  }

  if (
    message.includes('401') ||
    message.includes('api_key_invalid') ||
    message.includes('invalid api key') ||
    message.includes('incorrect api key') ||
    message.includes('unauthorized')
  ) {
    return {
      category: 'invalid_key',
      userMessage: 'Clé API invalide (401). Vérifiez la variable d’environnement correspondante.',
    };
  }

  if (
    message.includes('403') ||
    message.includes('permission denied') ||
    message.includes('forbidden')
  ) {
    return {
      category: 'forbidden',
      userMessage: 'Permission refusée (403). La clé API n’a pas accès à ce modèle ou à ce projet.',
    };
  }

  if (
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('model_not_found') ||
    message.includes('does not exist') ||
    message.includes('is not supported')
  ) {
    return {
      category: 'model_not_found',
      userMessage: 'Modèle inaccessible. Vérifiez le nom du modèle dans Paramètres IA → Modèles.',
    };
  }

  return {
    category: 'unknown',
    userMessage: sanitizeAiErrorMessage(rawMessage),
  };
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/** 1×1 PNG — minimal controlled multimodal payload (no external fetch). */
export const MINIMAL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export const DEFAULT_AI_TEST_TIMEOUT_MS = 20_000;
export const AI_HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;
