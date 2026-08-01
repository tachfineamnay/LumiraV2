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
type MemoryOperation = { promise(): Promise<[unknown, ...unknown[]]> };

/**
 * The only Vertex Memory Bank boundary. It constrains every request to the
 * configured global reasoning engine and turns provider errors into a small,
 * explicit retry contract for callers.
 */
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
      ).createMemory(
        {
          parent,
          memory: {
            displayName: `lumira-${input.category.toLowerCase()}`,
            description: 'Lumira continuity memory',
            fact: input.fact,
            scope: { user_id: input.userId },
          },
        },
        this.callOptions(),
      );
      const [memory] = await this.awaitOperation(operation as unknown as MemoryOperation);
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
      ).retrieveMemories(
        {
          parent,
          scope: { user_id: userId },
          similaritySearchParams: {
            searchQuery: query.slice(0, 1000),
            topK: Math.min(Math.max(topK, 1), 8),
          },
        },
        this.callOptions(),
      );
      return (response?.retrievedMemories ?? [])
        .map((item) => item.memory)
        .filter((memory): memory is NonNullable<typeof memory> => Boolean(memory))
        .map((memory) => this.map(memory))
        .map((memory) => {
          this.assertOwned(memory.name);
          this.assertScope(memory.scope, userId);
          return memory;
        });
    } catch (error) {
      throw this.normalize(error);
    }
  }

  async listUserMemories(userId: string): Promise<VertexMemory[]> {
    const parent = this.parent();
    try {
      const scope = JSON.stringify({ user_id: userId }).replace(/"/g, '\\"');
      const memories: VertexMemory[] = [];
      const client = await this.getClient();
      for await (const memory of client.listMemoriesAsync(
        { parent, filter: `scope="${scope}"`, pageSize: 100 },
        this.callOptions(),
      )) {
        const mapped = this.map(memory);
        this.assertOwned(mapped.name);
        this.assertScope(mapped.scope, userId);
        memories.push(mapped);
      }
      return memories;
    } catch (error) {
      throw this.normalize(error);
    }
  }

  async updateMemory(name: string, fact: string): Promise<VertexMemory> {
    this.assertOwned(name);
    try {
      const [operation] = await (
        await this.getClient()
      ).updateMemory(
        { memory: { name, fact }, updateMask: { paths: ['fact'] } },
        this.callOptions(),
      );
      const [memory] = await this.awaitOperation(operation as unknown as MemoryOperation);
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
      const [operation] = await (await this.getClient()).deleteMemory({ name }, this.callOptions());
      await this.awaitOperation(operation as unknown as MemoryOperation);
    } catch (error) {
      // Deletion is idempotent: a resource that no longer exists has reached
      // the desired state and must not block purge or an expert decision.
      const normalized = this.normalize(error);
      if (normalized.code !== 'not_found') throw normalized;
    }
  }

  async deleteAllUserMemories(userId: string): Promise<number> {
    const memories = await this.listUserMemories(userId);
    for (const memory of memories) await this.deleteMemory(memory.name);

    const remaining = await this.listUserMemories(userId);
    if (remaining.length > 0) {
      throw new MemoryBankError('unavailable', 'Memory Bank deletion could not be verified.', true);
    }
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

  private callOptions(): { timeout: number } {
    return { timeout: this.memoryConfig.requestTimeoutMs() };
  }

  private async awaitOperation(operation: MemoryOperation): Promise<[unknown, ...unknown[]]> {
    return this.withDeadline(operation.promise());
  }

  private async withDeadline<T>(promise: Promise<T>): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(
            () => reject(new MemoryBankError('timeout', 'Memory Bank request timed out.', true)),
            this.memoryConfig.requestTimeoutMs(),
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
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

  private map(memory: unknown): VertexMemory {
    const value = memory as {
      name?: string | null;
      fact?: string | null;
      scope?: Record<string, string> | null;
    };
    if (!value?.name || !value.fact) {
      throw new MemoryBankError(
        'invalid_argument',
        'Memory Bank returned an incomplete memory.',
        false,
      );
    }
    return { name: value.name, fact: value.fact, scope: value.scope ?? {} };
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
      throw new MemoryBankError('invalid_argument', 'Memory Bank scope mismatch.', false);
    }
  }

  private normalize(error: unknown): MemoryBankError {
    if (error instanceof MemoryBankError) return error;
    const code = String((error as { code?: unknown })?.code ?? '').toLowerCase();
    const message = String((error as Error)?.message ?? 'Memory Bank request failed').toLowerCase();
    if (code === '5' || code === 'not_found' || /not found/.test(message))
      return new MemoryBankError('not_found', 'Memory Bank resource was not found.', false);
    if (code === '7' || code === 'permission_denied' || /permission|forbidden/.test(message))
      return new MemoryBankError('permission_denied', 'Memory Bank permission denied.', false);
    if (
      code === '16' ||
      code === 'unauthenticated' ||
      /unauthenticated|authentication/.test(message)
    )
      return new MemoryBankError('unauthenticated', 'Memory Bank authentication failed.', false);
    if (code === '3' || code === 'invalid_argument' || /invalid argument/.test(message))
      return new MemoryBankError('invalid_argument', 'Memory Bank rejected the request.', false);
    if (code === '8' || code === 'resource_exhausted' || /quota|resource exhausted/.test(message))
      return new MemoryBankError('quota', 'Memory Bank quota reached.', true);
    if (code === '4' || code === 'deadline_exceeded' || /deadline|timeout/.test(message))
      return new MemoryBankError('timeout', 'Memory Bank request timed out.', true);
    if (code === '14' || code === 'unavailable' || /unavailable|network|econn/.test(message))
      return new MemoryBankError('unavailable', 'Memory Bank is unavailable.', true);
    return new MemoryBankError('non_retryable', 'Memory Bank request failed.', false);
  }
}
