import {
  classifyNormalizedAiError,
  providerDisplayName,
  sanitizeAiErrorMessage,
} from '../../services/factory/llm/ai-errors';
import { AiErrorCategory } from './ai-provider-diagnostics.types';

export { sanitizeAiErrorMessage };

export function classifyAiError(
  rawMessage: string,
  context?: { provider?: string; model?: string; location?: string },
): {
  category: AiErrorCategory;
  userMessage: string;
} {
  const code = classifyNormalizedAiError(rawMessage);
  const legacyCategory = toLegacyCategory(code);
  const label = context?.provider ? providerDisplayName(context.provider) : undefined;
  const model = context?.model;

  let userMessage: string;
  switch (code) {
    case 'timeout':
      userMessage = 'Délai dépassé lors du test. Réessayez ou vérifiez la connectivité réseau.';
      break;
    case 'quota_billing':
      userMessage = label
        ? `${label}${model ? ` — modèle ${model}` : ''} : quota ou facturation insuffisants.`
        : 'Quota ou facturation absents. Vérifiez la facturation du provider concerné.';
      break;
    case 'rate_limit':
      userMessage = 'Limite de requêtes atteinte (429). Attendez quelques instants puis retestez.';
      break;
    case 'invalid_key':
      userMessage = label
        ? `${label} — clé API invalide (401).`
        : 'Clé API invalide (401). Vérifiez la variable d’environnement correspondante.';
      break;
    case 'credentials_invalid':
      userMessage = label
        ? `${label} — identifiants de service invalides.`
        : 'Identifiants invalides.';
      break;
    case 'forbidden':
      userMessage = label
        ? `${label}${model ? ` — modèle ${model}` : ''} : permission refusée (403).`
        : 'Permission refusée (403). La clé ou le compte n’a pas accès à ce modèle.';
      break;
    case 'model_not_found':
      userMessage = label
        ? `${label} — modèle ${model || 'sélectionné'} inaccessible avec les credentials actuels.`
        : 'Modèle inaccessible. Vérifiez le nom du modèle dans Paramètres IA → Modèles.';
      break;
    case 'region_not_supported':
      userMessage = label
        ? `${label} — modèle ${model || 'sélectionné'} indisponible dans la région ${context?.location || 'configurée'}.`
        : 'Région Vertex non supportée pour ce modèle.';
      break;
    case 'api_not_enabled':
      userMessage = label
        ? `${label} — API non activée sur le projet Google Cloud.`
        : 'API Google non activée sur le projet.';
      break;
    case 'structured_output_unsupported':
      userMessage = label
        ? `${label} — sortie JSON structurée non supportée pour ${model || 'ce modèle'}.`
        : 'Sortie JSON structurée non supportée.';
      break;
    case 'network':
      userMessage = 'Erreur réseau vers le provider. Vérifiez la connectivité sortante.';
      break;
    default:
      userMessage = sanitizeAiErrorMessage(rawMessage);
  }

  return { category: legacyCategory, userMessage };
}

function toLegacyCategory(code: string): AiErrorCategory {
  switch (code) {
    case 'quota_billing':
      return 'quota';
    case 'rate_limit':
      return 'rate_limit';
    case 'invalid_key':
      return 'invalid_key';
    case 'credentials_invalid':
      return 'credentials_invalid';
    case 'forbidden':
      return 'forbidden';
    case 'api_not_enabled':
      return 'api_not_enabled';
    case 'model_not_found':
      return 'model_not_found';
    case 'region_not_supported':
      return 'region_not_supported';
    case 'timeout':
      return 'timeout';
    case 'structured_output_unsupported':
      return 'structured_output_unsupported';
    case 'network':
      return 'network';
    default:
      return 'unknown';
  }
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

/** 1×1 PNG — retained only for backward compatibility. */
export const MINIMAL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** 512x512 valid PNG containing red circle on left, blue square on right, and number 27 for vision validation. */
// Small valid fixture used only for provider capability probes; it contains no user data.
export const IDENTIFIABLE_VISION_PROBE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAAKW0lEQVR42u3cQVYiURBFQfa/6XLiTAEHBRbvRpxcgfzM293a3g4Akm6+BAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAALA96fkYwIEYOysv2IABKBy8fUAEAAXXw8AAXD0xQAQAHdfCQABcPeVABAAp18GQABw95UABACnXwZAAHD6ZcBLMeM7ZLEttAx4L0YAsMoy4NUYAbDERga8HSMA1tfIgBdkBMDuGg3wiIwA2FojA56SEQArazTAazICYFlNOwM+fCMANtVL96yMEQA7+q6pucZT4uRPVQAEwPUXAAEQAAEQANdfAARAAARAAFx/ARAAARAAAXD9BUAABEAABMDpFwABEAABEID4D+UJgAAIgAAIQPRHsgVAAARAAASgeP0FQAAEQAAEIHr9BUAABEAABKD7n/EFQAAEQADaAQj/nhEBEAABEIBwANq/aEoABEAABKAagPxvGhQAARAAAUgGwO+ZFQABEAABEAABEAABEAAByATAQZ9ZnVceX4/RKxaAuQBYnbHVEQCvWAAEwLZ1V0cAvGIBEID4qqVXRwC8YgEQgPKe1VdHALxiARAAARAAAfCKBUAAWktmdQTAKxYAAYhumNV5vDEC4BULgABYHQEQAK9YAAoBsDrB1REAr1gABMDqdFdHALxiARAAqyMAAuAVC0AvAFbH6giAVywAxQBYHavzY3sEwCsWAAGwOgIgAF6xAKwGwOpYnd8WSAC8YgEQAKsjAALgVQrAZAD82cmq3dkhAfAqBUAArJoACIBXKQB7AfCvp1bt/hoJgFcpAAJg1QRAALxKARgLgJ+fsGoPN0kAvEoBEACrJgAC4FUKwFIAvBSrdvrXx8v1KgVAAKyaAHi5XqUAXDUAnolVEwCvUgAEQACsmgB4lQIgAA6cVRMAr1IAtgPgjVg1AfAqBUAABMCqCYBXKQCZAHggVk0AvEoBEABj1QTAqxQAATBGABx0AdgOgNdhBEAABEAAjBEAARAAATBGAARAALYD4GkYARAAARAAYwRAAARAAIwRAAEQAAEwRgAEQAAGA+BdGAEQAAEQAGMEQAAEQACMEQABEAABMEYABEAABMAYARAAAVgJgEdhBEAABEAAjBEAARAAATBGAARAAATAOOh/P0X172c56AIgAEYABEAABODqAfAizOmnSwAEQAAEwAiAAAiAAAiAEQABEAABEAAjAAIgAAIgAEYABMAIgAAYARAAIwACYARAAIwACIARAAEwAiAARgAEwAiAABgBEAAjAAJgBEAAjAAIgBEAATACIABGAATACIAAGAEQACMArr+D/sZTtBMAB10A/A3ACMCHLJkAGAEQACMAAmAEQAAEQAAEwAiAAAiAAAiAAAiAAAiAAAiAAAiAEQABEAABEAAjAAIgAAIgAEYABEAABEAAjAAIgAAIgAAYARAAARAAATACIAACIAACYARAAARAAATACIAAGAEQACMAAmAE4MoB0AABOPd0HYcAGAEQAJM8RVcPgIMuAAIgAAIgAAIgAALgUQiAAAiAAAiAEQABEAABSAVAAwRgaL0EwAiAAAiAAAiAEQABEAABEAAjAAIgAAIgAAIgAAIgAAIgAAIgABogAEO7JQBGAARAAARAAIwACIAACIAAGAEQAAEQAAEQAAHQAAHYXCwBMAIgAAIgAAJgBEAABEAABMAIgAY46PNbJQBGAARAAARAAIwACIAACIAAGAHQAAGYXykBMAIgAAIgAAJgBEADBKC0TwJgBEAABEAABMAIgAAIgAAIgBEADRCA8WUSACMAAiAAAiAARgA0QABC118AjAAIgAAIgAAYAdAAAShdfwEwAiAAAiAAAmAEQAMEoHT9BcAIgAAIgAAIgBEADXDQS9dfAIwACIAACIAAGAHQAAEoXX8BMAIgAAIgAAJgBEADBKB0/QXACIAGCED0+guAEQABEAABEAAjABogAKXrLwBGADRAAKLXXwCMAAiAAAiAABgB0AABKF1/ATACoAECEL3+AmAEQAAEQAAEwAiABghA6foLgBEADRCA6PUXACMAGiAA0esvAEYANOB/DjpPTqkAGAEYDMBoAxAAF1MABEAAEAAjAAJQagAC4GIKgABEG4AAuJgCIADRBiAALqYACEC0AQiAiykAAhBtAALgYgqAAEQbgAC4mAIgANEGIAAupgAIQLQBCICLKQACEG0AAuBiCoAARDOAALiYAiAA0QYgAC6mAAhAtAEIgIspAAIQbQAC4GIKgAD4foD37nEZCyEANtVL96yMtRAAy+qZe1PGZgiAlfXAvSZjPwTA1nrdnpKxIgJgd51+j8hYFAGwvq6/F2TsigBYYqff2zE2RgCsstPv1RgBwEI7/d6LEQCstdPvpRgBwHI7/TB+1XwJZMDpBwFACdx9EACaGQAEgFYJAAGgVQJAAAjFAEAAKj0AEIBKDwAEYCoVAAIAgAAAIAAACAAAAgCAAAAgAAAIAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAgAAAIAgAAAIAAACAAAAgCAAAAgAAAIAAACAIAAACAAAAIAgAAAIAAACAAAAgCAAADwkb4A89jF+mkGrkMAAAAASUVORK5CYII=';

export const DEFAULT_AI_TEST_TIMEOUT_MS = 30_000;
export const AI_HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;

export function sanitizeVisionResponsePreview(text?: string): string {
  if (!text) return '';
  const withoutControls = Array.from(text, (character) => {
    const code = character.charCodeAt(0);
    const isPreservedWhitespace = code === 9 || code === 10 || code === 13;
    return (code >= 32 && code !== 127) || isPreservedWhitespace ? character : '';
  }).join('');
  const cleaned = withoutControls.replace(/\s+/g, ' ').trim();
  return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned;
}
