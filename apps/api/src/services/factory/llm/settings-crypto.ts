import { createDecipheriv } from 'crypto';

const VERTEX_CREDENTIALS_KEY = 'VERTEX_CREDENTIALS_JSON';
const ENCRYPTED_VALUE_PREFIX = 'enc:v1';

export { VERTEX_CREDENTIALS_KEY };

export function decryptSettingsValue(value: string, encryptionKeyBase64?: string): string {
  if (!value.startsWith(`${ENCRYPTED_VALUE_PREFIX}.`)) {
    return value;
  }
  if (!encryptionKeyBase64) {
    throw new Error('SETTINGS_ENCRYPTION_KEY requis pour déchiffrer les identifiants Vertex.');
  }
  const key = Buffer.from(encryptionKeyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('SETTINGS_ENCRYPTION_KEY doit être une clé base64 de 32 octets.');
  }
  const [, , ivPart, tagPart, ciphertextPart] = value.split('.');
  if (!ivPart || !tagPart || !ciphertextPart) {
    throw new Error('Format chiffré des identifiants Vertex invalide.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export interface VertexServiceAccount {
  type?: string;
  project_id: string;
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
}

export function parseVertexServiceAccount(jsonString: string): VertexServiceAccount {
  const parsed = JSON.parse(jsonString) as VertexServiceAccount;
  if (!parsed.project_id) {
    throw new Error('Identifiants Vertex invalides: project_id manquant.');
  }
  return parsed;
}
