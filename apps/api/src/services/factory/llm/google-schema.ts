import { JsonSchema } from './llm.types';

/**
 * Strip JSON Schema fields that Google responseSchema rejects
 * (additionalProperties is commonly unsupported).
 */
export function sanitizeGoogleJsonSchema(schema: JsonSchema): JsonSchema {
  if (Array.isArray(schema)) {
    return schema.map((item) =>
      typeof item === 'object' && item !== null
        ? sanitizeGoogleJsonSchema(item as JsonSchema)
        : item,
    ) as unknown as JsonSchema;
  }
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }
  const result: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'additionalProperties') continue;
    if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeGoogleJsonSchema(value as JsonSchema);
    } else {
      result[key] = value;
    }
  }
  return result;
}
