export type ProviderProbeStatus = 'ok' | 'error' | 'not_tested';

export type ProviderCredentialState =
  | 'not_configured'
  | 'configured'
  | 'not_tested'
  | 'connection_ok'
  | 'test_failed'
  | 'quota_billing'
  | 'model_inaccessible';

export type AiErrorCategory =
  | 'missing_key'
  | 'invalid_key'
  | 'forbidden'
  | 'quota'
  | 'rate_limit'
  | 'model_not_found'
  | 'timeout'
  | 'unknown';

export interface ProviderProbeResult {
  status: ProviderProbeStatus;
  model: string;
  error?: string;
  errorCategory?: AiErrorCategory;
  testedAt?: string;
}

export interface ProviderCredentialStatus {
  envVar: string;
  configured: boolean;
  state: ProviderCredentialState;
  model: string;
  lastTestedAt?: string;
  lastError?: string;
  text: ProviderProbeStatus;
  multimodal?: ProviderProbeStatus;
}

export interface AiHealthSnapshot {
  gemini: {
    configured: boolean;
    text: ProviderProbeStatus;
    multimodal: ProviderProbeStatus;
    model: string;
  };
  openai: {
    configured: boolean;
    text: ProviderProbeStatus;
    model: string;
  };
}

export interface ProviderConnectionTestResult {
  success: boolean;
  provider: 'gemini' | 'openai';
  model: string;
  testedAt: string;
  text: ProviderProbeStatus;
  multimodal?: ProviderProbeStatus;
  error?: string;
  errorCategory?: AiErrorCategory;
  /** @deprecated legacy field kept for backward compatibility */
  projectId?: string;
}

export interface AiCredentialsStatusResponse {
  gemini: ProviderCredentialStatus;
  openai: ProviderCredentialStatus;
  /** @deprecated use gemini.configured */
  vertexConfigured?: boolean;
  /** @deprecated use openai.configured */
  openaiConfigured?: boolean;
}
