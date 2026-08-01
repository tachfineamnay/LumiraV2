import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertExecutableAgentModel,
  assertValidatedAgentCapabilities,
  normalizeAiModelConfig,
} from '../factory/ai-model-config';
import { MemoryConfigService } from './memory-config.service';
import { MemoryReadiness } from './memory.types';

/**
 * Small, side-effect-free gate for the MEMORY agent. The worker and automatic
 * enqueue paths use it before touching a job, so a partially configured Desk
 * can never turn into an implicit queue drain.
 */
@Injectable()
export class MemoryReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: MemoryConfigService,
  ) {}

  async getStatus(): Promise<MemoryReadiness> {
    if (!this.config.isEnabled()) return { ready: false, code: 'memory_disabled' };

    let row: { value: string } | null;
    try {
      row = await this.prisma.promptVersion.findFirst({
        where: { key: 'MODEL_CONFIG', isActive: true },
        orderBy: { version: 'desc' },
        select: { value: true },
      });
    } catch {
      return { ready: false, code: 'model_config_unavailable' };
    }
    if (!row?.value) return { ready: false, code: 'model_config_missing' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      return { ready: false, code: 'model_config_invalid' };
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as { providerMode?: unknown }).providerMode !== 'per_agent'
    ) {
      return { ready: false, code: 'provider_mode_invalid' };
    }
    const normalized = normalizeAiModelConfig(parsed);
    if (normalized.config.providerMode !== 'per_agent') {
      return { ready: false, code: 'provider_mode_invalid' };
    }
    const memory = normalized.config.agents.MEMORY;
    if (!memory?.enabled) return { ready: false, code: 'memory_agent_disabled' };
    if (memory.provider !== 'vertex') return { ready: false, code: 'memory_provider_invalid' };

    try {
      assertExecutableAgentModel({
        agent: 'MEMORY',
        provider: memory.provider,
        model: memory.model,
        thinkingLevel: memory.thinkingLevel,
        maxOutputTokens: memory.maxOutputTokens,
      });
    } catch {
      return { ready: false, code: 'memory_model_invalid' };
    }

    try {
      if (memory.needsValidation) throw new Error('validation required');
      assertValidatedAgentCapabilities('MEMORY', memory);
    } catch {
      return { ready: false, code: 'memory_validation_missing' };
    }
    return { ready: true, code: 'ready' };
  }
}
