import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRunRecordInput, AiRunStatus } from './ai-execution.types';

@Injectable()
export class AiRunService {
  private readonly logger = new Logger(AiRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * AiRun is operational audit data, not a second copy of the sealed intake.
   * Keep this allow-list at the persistence boundary so a future caller cannot
   * accidentally retain prompt text, personal data, URLs or image bytes.
   */
  private sanitizeInputSnapshot(
    snapshot?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!snapshot) return undefined;
    const technical = snapshot.technical as Record<string, unknown> | undefined;
    return {
      ...(typeof snapshot.inputSha256 === 'string' ? { inputSha256: snapshot.inputSha256 } : {}),
      ...(typeof snapshot.intakeContentHash === 'string'
        ? { intakeContentHash: snapshot.intakeContentHash }
        : {}),
      ...(typeof snapshot.schemaName === 'string' ? { schemaName: snapshot.schemaName } : {}),
      ...(typeof snapshot.imageCount === 'number' ? { imageCount: snapshot.imageCount } : {}),
      ...(Array.isArray(snapshot.imageRoles)
        ? {
            imageRoles: snapshot.imageRoles.filter(
              (role) =>
                role === 'FACE_FRONT' ||
                role === 'PALM_LEFT' ||
                role === 'PALM_RIGHT' ||
                role === 'PALM_UNKNOWN',
            ),
          }
        : {}),
      ...(Array.isArray(snapshot.imageHashes)
        ? {
            imageHashes: snapshot.imageHashes.filter(
              (hash): hash is string => typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash),
            ),
          }
        : {}),
      ...(typeof snapshot.promptVersionId === 'string'
        ? { promptVersionId: snapshot.promptVersionId }
        : {}),
      ...(technical && typeof technical === 'object' && !Array.isArray(technical)
        ? {
            technical: {
              ...(typeof technical.timeoutMs === 'number'
                ? { timeoutMs: technical.timeoutMs }
                : {}),
              ...(typeof technical.maxTokens === 'number'
                ? { maxTokens: technical.maxTokens }
                : {}),
              ...(typeof technical.structured === 'boolean'
                ? { structured: technical.structured }
                : {}),
            },
          }
        : {}),
    };
  }

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
          executionSnapshot: input.executionSnapshot
            ? (input.executionSnapshot as Prisma.InputJsonValue)
            : undefined,
          inputSnapshot: this.sanitizeInputSnapshot(input.inputSnapshot) as
            | Prisma.InputJsonValue
            | undefined,
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
