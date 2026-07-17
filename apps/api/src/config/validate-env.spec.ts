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
  SMTP_USER: 'lumira',
  SMTP_PASS: 'secure-password',
  MAIL_FROM: 'noreply@oraclelumira.com',
  GEMINI_API_KEY: 'gemini-validvalue',
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

  it('does not require production secrets during tests', () => {
    expect(validateEnvironment({ NODE_ENV: 'test' })).toEqual({ NODE_ENV: 'test' });
  });
});
