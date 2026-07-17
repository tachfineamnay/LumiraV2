const REQUIRED_PRODUCTION_VARIABLES = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SETTINGS_ENCRYPTION_KEY',
  'WEB_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'GEMINI_API_KEY',
  'GOTENBERG_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET_NAME',
  'AWS_UPLOADS_BUCKET_NAME',
] as const;

const PLACEHOLDER_MARKERS = [
  'change-me',
  'generate-',
  'your-',
  'example.com',
  'xxxxxxxx',
];

const BOOLEAN_VALUES = ['true', 'false', '1', '0'] as const;

function read(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isLoopbackSmtpHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '0.0.0.0' ||
    normalized === 'host.docker.internal' ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

/**
 * Refuse to boot a production API with an incomplete or example
 * configuration. Development and test environments retain their local
 * fallbacks so CI can compile without production credentials.
 */
export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  if (read(config, 'NODE_ENV') !== 'production') return config;

  const missing = REQUIRED_PRODUCTION_VARIABLES.filter((key) => !read(config, key));
  if (missing.length > 0) {
    throw new Error(`Configuration production incomplète: ${missing.join(', ')}`);
  }

  const unsafe = REQUIRED_PRODUCTION_VARIABLES.filter((key) => {
    const value = read(config, key).toLowerCase();
    return PLACEHOLDER_MARKERS.some((marker) => value.includes(marker));
  });
  if (unsafe.length > 0) {
    throw new Error(`Valeurs d’exemple interdites en production: ${unsafe.join(', ')}`);
  }

  const jwtSecret = read(config, 'JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caractères en production');
  }

  const encryptionKey = Buffer.from(read(config, 'SETTINGS_ENCRYPTION_KEY'), 'base64');
  if (encryptionKey.length !== 32) {
    throw new Error('SETTINGS_ENCRYPTION_KEY doit être une clé base64 de 32 octets');
  }

  for (const key of ['WEB_URL', 'GOTENBERG_URL'] as const) {
    const url = read(config, key);
    if (!/^https?:\/\//i.test(url) || /localhost|127\.0\.0\.1/i.test(url)) {
      throw new Error(`${key} doit être une URL de production accessible`);
    }
  }

  if (!/^postgres(?:ql)?:\/\//i.test(read(config, 'DATABASE_URL'))) {
    throw new Error('DATABASE_URL doit être une URL PostgreSQL valide');
  }

  const smtpHost = read(config, 'SMTP_HOST');
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(smtpHost) || /[\s/]/.test(smtpHost)) {
    throw new Error('SMTP_HOST doit contenir uniquement le nom d’hôte du fournisseur, sans protocole');
  }
  if (isLoopbackSmtpHost(smtpHost)) {
    throw new Error(
      'SMTP_HOST ne peut pas pointer vers localhost, une adresse loopback ou host.docker.internal en production',
    );
  }

  const smtpPortRaw = read(config, 'SMTP_PORT') || '587';
  const smtpPort = Number(smtpPortRaw);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT doit être un port TCP valide');
  }

  for (const key of ['SMTP_SECURE', 'SMTP_REQUIRE_TLS'] as const) {
    const value = read(config, key).toLowerCase();
    if (value && !BOOLEAN_VALUES.includes(value as (typeof BOOLEAN_VALUES)[number])) {
      throw new Error(`${key} doit valoir true, false, 1 ou 0`);
    }
  }

  const smtpSecure = read(config, 'SMTP_SECURE').toLowerCase();
  if (smtpPort === 465 && (smtpSecure === 'false' || smtpSecure === '0')) {
    throw new Error('SMTP_SECURE doit être activé avec SMTP_PORT=465');
  }

  const mailFrom = read(config, 'MAIL_FROM');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailFrom)) {
    throw new Error('MAIL_FROM doit être une adresse e-mail valide sans nom d’affichage');
  }

  return config;
}
