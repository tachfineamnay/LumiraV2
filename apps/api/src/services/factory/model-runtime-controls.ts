import { AiProvider } from './ai-execution.types';

export type AiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface ModelRuntimeControls {
  thinkingLevels: readonly AiThinkingLevel[];
  defaultThinkingLevel?: AiThinkingLevel;
  operational: boolean;
  operationalReason?:
    | 'thinking_supported'
    | 'thinking_not_registered'
    | 'legacy_model'
    | 'non_text_model';
  samplingPolicy: 'provider_default';
}

function nonTextReason(model: string): ModelRuntimeControls | null {
  const lower = model.toLowerCase();
  if (/embedding|moderation|audio|realtime|transcri|whisper|tts|dall-e|image|search/.test(lower)) {
    return {
      thinkingLevels: [],
      defaultThinkingLevel: undefined,
      operational: false,
      operationalReason: 'non_text_model',
      samplingPolicy: 'provider_default',
    };
  }
  return null;
}

function legacyReason(): ModelRuntimeControls {
  return {
    thinkingLevels: [],
    defaultThinkingLevel: undefined,
    operational: false,
    operationalReason: 'legacy_model',
    samplingPolicy: 'provider_default',
  };
}

function notRegisteredReason(): ModelRuntimeControls {
  return {
    thinkingLevels: [],
    defaultThinkingLevel: undefined,
    operational: false,
    operationalReason: 'thinking_not_registered',
    samplingPolicy: 'provider_default',
  };
}

export function getModelRuntimeControls(provider: AiProvider, model: string): ModelRuntimeControls {
  if (typeof model !== 'string') return notRegisteredReason();
  const normalized = model.trim().toLowerCase();
  if (!normalized) return notRegisteredReason();

  const nonText = nonTextReason(normalized);
  if (nonText) return nonText;

  if (provider === 'openai') {
    if (/^gpt-5\.5(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['low', 'medium', 'high', 'xhigh'],
        defaultThinkingLevel: 'medium',
        operational: true,
        operationalReason: 'thinking_supported',
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gpt-5\.4(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['low', 'medium', 'high', 'xhigh'],
        defaultThinkingLevel: 'medium',
        operational: true,
        operationalReason: 'thinking_supported',
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gpt-4o|^gpt-4\.1|^gpt-4(?![0-9])|^gpt-3\.5/i.test(normalized)) {
      return legacyReason();
    }
    return notRegisteredReason();
  }

  if (provider === 'gemini' || provider === 'vertex') {
    if (/^gemini-3\.6-flash(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        defaultThinkingLevel: 'medium',
        operational: true,
        operationalReason: 'thinking_supported',
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-3\.5-flash-lite(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        defaultThinkingLevel: 'minimal',
        operational: true,
        operationalReason: 'thinking_supported',
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-3\.5-flash(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        defaultThinkingLevel: 'medium',
        operational: true,
        operationalReason: 'thinking_supported',
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-3\.1-pro(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['low', 'medium', 'high'],
        defaultThinkingLevel: 'high',
        operational: true,
        operationalReason: 'thinking_supported',
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-3-flash(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        defaultThinkingLevel: 'high',
        operational: true,
        operationalReason: 'thinking_supported',
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-3-pro(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['low', 'high'],
        defaultThinkingLevel: 'high',
        operational: true,
        operationalReason: 'thinking_supported',
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-2\.5-(?:pro|flash(?:-lite)?)(?:[.-]|$)/i.test(normalized)) {
      return legacyReason();
    }
    return notRegisteredReason();
  }

  return notRegisteredReason();
}

export function isOperationalThinkingModel(provider: AiProvider, model: string): boolean {
  return getModelRuntimeControls(provider, model).operational === true;
}

export function supportsThinkingLevel(provider: AiProvider, model: string): boolean {
  return isOperationalThinkingModel(provider, model);
}
