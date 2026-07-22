/**
 * Single source of truth for Vertex AI region.
 *
 * Default: `us-central1` — officially compatible with Gemini 2.5 on Vertex.
 * Set `VERTEX_LOCATION=global` only when the selected models support the
 * global endpoint for the project.
 */
export const DEFAULT_VERTEX_LOCATION = 'us-central1';

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
