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

/** 1×1 PNG — minimal controlled multimodal payload (no external fetch). */
export const MINIMAL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export const DEFAULT_AI_TEST_TIMEOUT_MS = 20_000;
export const AI_HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;
