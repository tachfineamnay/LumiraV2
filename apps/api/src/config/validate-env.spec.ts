import { validateEnvironment } from './validate-env';

const validProductionConfig = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://lumira:secret@postgres.internal:5432/lumira',
  JWT_SECRET: 'a-secure-jwt-secret-with-more-than-32-characters',
  SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  WEB_URL: 'https://oraclelumira.com',
  STRIPE_SECRET_KEY: 'sk_live_validvalue',
  STRIPE_WEBHOOK_SECRET: 'whsec_validvalue',
  SMTP_HOST: 'smtp.provider.net',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_REQUIRE_TLS: 'true',
  SMTP_USER: 'lumira',
  SMTP_PASS: 'secure-password',
  MAIL_FROM: 'noreply@oraclelumira.com',
  GEMINI_API_KEY: 'gemini-validvalue',
  OPENAI_API_KEY: 'sk-openai-validvalue',
  GOTENBERG_URL: 'http://gotenberg.internal:3000',
  AWS_ACCESS_KEY_ID: 'AKIAVALIDVALUE',
  AWS_SECRET_ACCESS_KEY: 'aws-secret-value',
  AWS_REGION: 'eu-west-3',
  AWS_S3_BUCKET_NAME: 'lumira-readings-production',
  AWS_UPLOADS_BUCKET_NAME: 'lumira-uploads-production',
};

describe('validateEnvironment', () => {
  it('accepts an explicit production configuration', () => {
    expect(validateEnvironment({ ...validProductionConfig })).toEqual(validProductionConfig);
  });

  it('rejects missing production variables with their names', () => {
    const config = { ...validProductionConfig, STRIPE_WEBHOOK_SECRET: '' };
    expect(() => validateEnvironment(config)).toThrow('STRIPE_WEBHOOK_SECRET');
  });

  it('rejects localhost service URLs in production', () => {
    const config = { ...validProductionConfig, GOTENBERG_URL: 'http://localhost:3002' };
    expect(() => validateEnvironment(config)).toThrow('GOTENBERG_URL');
  });

  it.each([
    'localhost',
    '127.0.0.1',
    '127.0.0.42',
    '::1',
    '[::1]',
    '0.0.0.0',
    'host.docker.internal',
  ])('rejects loopback SMTP host %s in production', (smtpHost) => {
    const config = { ...validProductionConfig, SMTP_HOST: smtpHost };
    expect(() => validateEnvironment(config)).toThrow('SMTP_HOST');
  });

  it('rejects a protocol in SMTP_HOST', () => {
    const config = { ...validProductionConfig, SMTP_HOST: 'smtp://smtp.provider.net' };
    expect(() => validateEnvironment(config)).toThrow('sans protocole');
  });

  it('rejects an invalid SMTP port', () => {
    const config = { ...validProductionConfig, SMTP_PORT: 'not-a-port' };
    expect(() => validateEnvironment(config)).toThrow('SMTP_PORT');
  });

  it('requires implicit TLS on SMTP port 465', () => {
    const config = { ...validProductionConfig, SMTP_PORT: '465', SMTP_SECURE: 'false' };
    expect(() => validateEnvironment(config)).toThrow('SMTP_SECURE');
  });

  it('accepts implicit TLS on SMTP port 465', () => {
    const config = { ...validProductionConfig, SMTP_PORT: '465', SMTP_SECURE: 'true' };
    expect(validateEnvironment(config)).toEqual(config);
  });

  it('rejects an invalid sender address', () => {
    const config = { ...validProductionConfig, MAIL_FROM: 'Oracle Lumira' };
    expect(() => validateEnvironment(config)).toThrow('MAIL_FROM');
  });

  it('does not require OPENAI_API_KEY at production startup', () => {
    const { OPENAI_API_KEY, ...configWithoutOpenAi } = validProductionConfig;
    expect(validateEnvironment(configWithoutOpenAi)).toEqual(configWithoutOpenAi);
  });

  it('does not require production secrets during tests', () => {
    expect(validateEnvironment({ NODE_ENV: 'test' })).toEqual({ NODE_ENV: 'test' });
  });
});
