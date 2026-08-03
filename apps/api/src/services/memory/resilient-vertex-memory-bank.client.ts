import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryConfigService } from './memory-config.service';
import { MemoryBankError, MemoryCategory, VertexMemory } from './memory.types';
import { VertexMemoryBankClient } from './vertex-memory-bank.client';

/**
 * Memory Bank create operations are long-running and can briefly return
 * NOT_FOUND while the global operation/resource becomes visible. Retry that
 * single transient case once with the same deterministic memory id. The base
 * client then reconciles ALREADY_EXISTS safely on the second attempt.
 */
@Injectable()
export class ResilientVertexMemoryBankClient extends VertexMemoryBankClient {
  private readonly resilienceLogger = new Logger(ResilientVertexMemoryBankClient.name);

  constructor(
    prisma: PrismaService,
    config: ConfigService,
    memoryConfig: MemoryConfigService,
  ) {
    super(prisma, config, memoryConfig);
  }

  override async createMemory(input: {
    memoryId: string;
    userId: string;
    fact: string;
    category: MemoryCategory;
  }): Promise<VertexMemory> {
    try {
      return await super.createMemory(input);
    } catch (error) {
      if (!(error instanceof MemoryBankError) || error.code !== 'not_found') throw error;

      this.resilienceLogger.warn('Memory create visibility delay; retrying once.');
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      return super.createMemory(input);
    }
  }
}
