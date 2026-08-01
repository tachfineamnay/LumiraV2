import { Injectable, Logger } from '@nestjs/common';
import { v1beta1 } from '@google-cloud/aiplatform';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  decryptSettingsValue,
  parseVertexServiceAccount,
  VERTEX_CREDENTIALS_KEY,
} from '../factory/llm';
import { MemoryBankError, MemoryCategory, VertexMemory, VertexMemoryBank } from './memory.types';
import { MemoryConfigService } from './memory-config.service';

type MemoryBankClient = InstanceType<typeof v1beta1.MemoryBankServiceClient>;

@Injectable()
export class VertexMemoryBankClient implements VertexMemoryBank {
  private readonly logger = new Logger(VertexMemoryBankClient.name);
  private client: MemoryBankClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly memoryConfig: MemoryConfigService,
  ) {}

  async isConfigured(): Promise<boolean> {
    if (!this.memoryConfig.parent()) return false;
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: VERTEX_CREDENTIALS_KEY },
      select: { value: true },
    });
    return Boolean(setting?.value?.trim());
  }

  isEnabled(): boolean {
    return this.memoryConfig.isEnabled();
  }

  async createMemory(input: {
    userId: string;
    fact: string;
    category: MemoryCategory;
  }): Promise<VertexMemory> {
    const parent = this.parent();
    try {
      const [operation] = await (
        await this.getClient()
      ).createMemory({
        parent,
        memory: {
          displayName: `lumira-${input.category.toLowerCase()}`,
          description: 'Lumira continuity memory',
          fact: input.fact,
          scope: { user_id: input.userId },
        },
      });
      const [memory] = await operation.promise();
      const mapped = this.map(memory);
      this.assertOwned(mapped.name);
      this.assertScope(mapped.scope, input.userId);
      return mapped;
    } catch (error) {
      throw this.normalize(error);
    }
  }

  async retrieveMemories(userId: string, query: string, topK = 8): Promise<VertexMemory[]> {
    const parent = this.parent();
    try {
      const [response] = await (
        await this.getClient()
      ).retrieveMemories({
        parent,
        scope: { user_id: userId },
        similaritySearchParams: {
          searchQuery: query.slice(0, 1000),
          topK: Math.min(Math.max(topK, 1), 8),
        },
      });
      return (response?.retrievedMemories ?? [])
        .map((item) => item.memory)
        .filter((memory): memory is NonNullable<typeof memory> => Boolean(memory))
        .map((memory) => this.map(memory))
        .filter((memory) => {
          this.assertOwned(memory.name);
          return memory.scope.user_id === userId;
        });
    } catch (error) {
      throw this.normalize(error);
    }
  }

  async listUserMemories(userId: string): Promise<VertexMemory[]> {
    const parent = this.parent();
    try {
      const scope = JSON.stringify({ user_id: userId }).replace(/"/g, '\\"');
      const [memories] = await (
        await this.getClient()
      ).listMemories({ parent, filter: `scope="${scope}"` });
      return memories
        .map((memory) => this.map(memory))
        .filter((memory) => {
          this.assertOwned(memory.name);
          return memory.scope.user_id === userId;
        });
    } catch (error) {
      throw this.normalize(error);
    }
  }

  async updateMemory(name: string, fact: string): Promise<VertexMemory> {
    this.assertOwned(name);
    try {
      const [operation] = await (
        await this.getClient()
      ).updateMemory({
        memory: { name, fact },
        updateMask: { paths: ['fact'] },
      });
      const [memory] = await operation.promise();
      const mapped = this.map(memory);
      this.assertOwned(mapped.name);
      return mapped;
    } catch (error) {
      throw this.normalize(error);
    }
  }

  async deleteMemory(name: string): Promise<void> {
    this.assertOwned(name);
    try {
      const [operation] = await (await this.getClient()).deleteMemory({ name });
      await operation.promise();
    } catch (error) {
      throw this.normalize(error);
    }
  }

  async deleteAllUserMemories(userId: string): Promise<number> {
    const memories = await this.listUserMemories(userId);
    for (const memory of memories) await this.deleteMemory(memory.name);
    return memories.length;
  }

  async diagnoseIsolation(userId: string): Promise<{ count: number; isolated: boolean }> {
    const memories = await this.listUserMemories(userId);
    return {
      count: memories.length,
      isolated: memories.every((memory) => memory.scope.user_id === userId),
    };
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = null;
  }

  private parent(): string {
    try {
      return this.memoryConfig.assertParent();
    } catch {
      throw new MemoryBankError('invalid_parent', 'Memory Bank parent must use global.', false);
    }
  }

  private async getClient(): Promise<MemoryBankClient> {
    if (this.client) return this.client;
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: VERTEX_CREDENTIALS_KEY },
    });
    if (!setting?.value)
      throw new MemoryBankError('not_configured', 'Vertex credentials are not configured.', false);
    try {
      const json = decryptSettingsValue(
        setting.value,
        this.config.get<string>('SETTINGS_ENCRYPTION_KEY'),
      );
      const account = parseVertexServiceAccount(json);
      this.client = new v1beta1.MemoryBankServiceClient({
        credentials: {
          client_email: account.client_email,
          private_key: account.private_key,
          project_id: account.project_id,
          type: account.type,
        },
        projectId: account.project_id,
      });
      return this.client;
    } catch (error) {
      this.logger.warn(
        `Memory Bank credentials unavailable: ${error instanceof Error ? error.name : 'unknown'}`,
      );
      throw new MemoryBankError('invalid_credentials', 'Vertex credentials are invalid.', false);
    }
  }

  private map(memory: {
    name?: string | null;
    fact?: string | null;
    scope?: Record<string, string> | null;
  }): VertexMemory {
    if (!memory.name || !memory.fact)
      throw new MemoryBankError(
        'non_retryable',
        'Memory Bank returned an incomplete memory.',
        false,
      );
    return { name: memory.name, fact: memory.fact, scope: memory.scope ?? {} };
  }

  private assertOwned(name: string): void {
    const parent = this.memoryConfig.parent();
    if (!parent || !name.startsWith(`${parent}/memories/`)) {
      throw new MemoryBankError(
        'outside_parent',
        'Memory resource is outside the configured parent.',
        false,
      );
    }
  }

  private assertScope(scope: Record<string, string>, userId: string): void {
    if (Object.keys(scope).length !== 1 || scope.user_id !== userId) {
      throw new MemoryBankError('non_retryable', 'Memory Bank scope mismatch.', false);
    }
  }

  private normalize(error: unknown): MemoryBankError {
    if (error instanceof MemoryBankError) return error;
    const code = String((error as { code?: unknown })?.code ?? '').toLowerCase();
    const message = String((error as Error)?.message ?? 'Memory Bank request failed').toLowerCase();
    if (code === '7' || /permission|forbidden/.test(message))
      return new MemoryBankError('permission_denied', 'Memory Bank permission denied.', false);
    if (code === '8' || /quota|resource exhausted/.test(message))
      return new MemoryBankError('quota', 'Memory Bank quota reached.', true);
    if (code === '4' || /deadline|timeout/.test(message))
      return new MemoryBankError('timeout', 'Memory Bank request timed out.', true);
    if (code === '14' || /unavailable|network|econn/.test(message))
      return new MemoryBankError('unavailable', 'Memory Bank is unavailable.', true);
    return new MemoryBankError('non_retryable', 'Memory Bank request failed.', false);
  }
}
