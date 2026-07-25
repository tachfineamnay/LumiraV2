import { AiProvider } from './ai-execution.types';

export type AiThinkingLevel = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface ModelRuntimeControls {
  thinkingLevels: readonly AiThinkingLevel[];
  defaultThinkingLevel?: AiThinkingLevel;
  supportsVerbosity: boolean;
  samplingPolicy: 'provider_default';
}

const EMPTY_CONTROLS: ModelRuntimeControls = {
  thinkingLevels: [],
  defaultThinkingLevel: undefined,
  supportsVerbosity: false,
  samplingPolicy: 'provider_default',
};

export function getModelRuntimeControls(provider: AiProvider, model: string): ModelRuntimeControls {
  if (typeof model !== 'string') return EMPTY_CONTROLS;
  const normalized = model.trim().toLowerCase();
  if (!normalized) return EMPTY_CONTROLS;

  if (provider === 'openai') {
    if (/^gpt-5\.5(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['none', 'low', 'medium', 'high', 'xhigh'],
        defaultThinkingLevel: 'medium',
        supportsVerbosity: true,
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gpt-5\.4(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['none', 'low', 'medium', 'high', 'xhigh'],
        defaultThinkingLevel: 'none',
        supportsVerbosity: true,
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gpt-4o(?:[.-]|$)/i.test(normalized)) {
      return EMPTY_CONTROLS;
    }
    return EMPTY_CONTROLS;
  }

  if (provider === 'gemini' || provider === 'vertex') {
    if (/^gemini-3\.6-flash(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        defaultThinkingLevel: 'medium',
        supportsVerbosity: false,
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-3\.5-flash-lite(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        defaultThinkingLevel: 'minimal',
        supportsVerbosity: false,
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-3\.5-flash(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        defaultThinkingLevel: 'medium',
        supportsVerbosity: false,
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-3\.1-pro(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['low', 'medium', 'high'],
        defaultThinkingLevel: 'high',
        supportsVerbosity: false,
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-3-flash(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        defaultThinkingLevel: 'high',
        supportsVerbosity: false,
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-3-pro(?:[.-]|$)/i.test(normalized)) {
      return {
        thinkingLevels: ['low', 'high'],
        defaultThinkingLevel: 'high',
        supportsVerbosity: false,
        samplingPolicy: 'provider_default',
      };
    }
    if (/^gemini-2\.5-(?:pro|flash(?:-lite)?)(?:[.-]|$)/i.test(normalized)) {
      return EMPTY_CONTROLS;
    }
    return EMPTY_CONTROLS;
  }

  return EMPTY_CONTROLS;
}

export function supportsThinkingLevel(provider: AiProvider, model: string): boolean {
  return getModelRuntimeControls(provider, model).thinkingLevels.length > 0;
}
