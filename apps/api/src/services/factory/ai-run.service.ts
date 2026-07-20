import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRunRecordInput, AiRunStatus } from './ai-execution.types';

@Injectable()
export class AiRunService {
  private readonly logger = new Logger(AiRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordRun(
    input: AiRunRecordInput & {
      status: AiRunStatus;
      durationMs: number;
      errorCode?: string;
      inputTokens?: number;
      outputTokens?: number;
      estimatedCost?: number;
    },
  ): Promise<void> {
    try {
      await this.prisma.aiRun.create({
        data: {
          orderId: input.orderId,
          agent: input.agent,
          mission: input.mission,
          productLevel: input.productLevel,
          provider: input.provider,
          model: input.model,
          promptVersionId: input.promptVersionId,
          routingSource: input.routingSource,
          status: input.status,
          durationMs: input.durationMs,
          errorCode: input.errorCode,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          estimatedCost: input.estimatedCost,
          startedAt: new Date(Date.now() - input.durationMs),
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Could not persist AiRun: ${error}`);
    }
  }
}
