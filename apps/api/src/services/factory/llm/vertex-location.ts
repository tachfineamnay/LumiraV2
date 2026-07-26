/**
 * Single source of truth for Vertex AI region.
 *
 * Default: `global` — canonical region for Vertex AI in Lumira.
 */
export const DEFAULT_VERTEX_LOCATION = 'global';
export const DEFAULT_VERTEX_MODEL_GARDEN_LOCATION = 'us-central1';

export type VertexLocationReader = {
  get?<T = string>(key: string, defaultValue?: T): T | undefined;
};

export function resolveVertexLocation(source?: VertexLocationReader | string | null): string {
  if (typeof source === 'string') {
    const trimmed = source.trim();
    return trimmed || DEFAULT_VERTEX_LOCATION;
  }
  const fromEnv = typeof process !== 'undefined' ? process.env.VERTEX_LOCATION?.trim() : undefined;
  const fromConfig = source?.get?.<string>('VERTEX_LOCATION')?.trim();
  return fromConfig || fromEnv || DEFAULT_VERTEX_LOCATION;
}

export function resolveVertexModelGardenLocation(
  source?: VertexLocationReader | string | null,
): string {
  if (typeof source === 'string') {
    const trimmed = source.trim();
    return trimmed || DEFAULT_VERTEX_MODEL_GARDEN_LOCATION;
  }
  const fromEnv =
    typeof process !== 'undefined' ? process.env.VERTEX_MODEL_GARDEN_LOCATION?.trim() : undefined;
  const fromConfig = source?.get?.<string>('VERTEX_MODEL_GARDEN_LOCATION')?.trim();
  return fromConfig || fromEnv || DEFAULT_VERTEX_MODEL_GARDEN_LOCATION;
}

