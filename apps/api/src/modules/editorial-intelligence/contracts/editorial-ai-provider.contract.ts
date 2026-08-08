import { EditorialModelProfile } from '@prisma/client';

export interface ExecuteProfilePromptOptions {
  systemInstruction?: string;
  jsonSchema?: Record<string, unknown>;
  inputHash?: string;
  temperature?: number;
}

export interface ExecuteProfilePromptResult {
  content: string;
  modelUsed: string;
  inputHash: string;
  rawResponse?: unknown;
}

export interface EditorialAiProvider {
  executeProfilePrompt(
    profile: EditorialModelProfile,
    prompt: string,
    options?: ExecuteProfilePromptOptions,
  ): Promise<ExecuteProfilePromptResult>;
}
