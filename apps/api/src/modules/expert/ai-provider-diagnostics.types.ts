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
  | 'region_not_supported'
  | 'api_not_enabled'
  | 'credentials_invalid'
  | 'structured_output_unsupported'
  | 'timeout'
  | 'network'
  | 'unknown';

export type DiagnosticsProvider = 'openai' | 'gemini' | 'vertex';

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
  structured?: ProviderProbeStatus;
  credentialSource?: string;
  location?: string;
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
    multimodal: ProviderProbeStatus;
    model: string;
  };
  vertex: {
    configured: boolean;
    text: ProviderProbeStatus;
    multimodal: ProviderProbeStatus;
    model: string;
  };
}

export interface ProviderConnectionTestResult {
  success: boolean;
  provider: DiagnosticsProvider;
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
  vertex: ProviderCredentialStatus;
  /** @deprecated use vertex.configured */
  vertexConfigured?: boolean;
  /** @deprecated use openai.configured */
  openaiConfigured?: boolean;
}
