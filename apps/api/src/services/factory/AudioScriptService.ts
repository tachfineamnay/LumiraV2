import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { VertexOracle } from './VertexOracle';

export interface AudioScriptInput {
  text: string;
  type: 'synthesis' | 'insight';
  category?: string;
  orderId?: string;
  productLevel?: import('@prisma/client').ProductLevel;
}

@Injectable()
export class AudioScriptService {
  private readonly logger = new Logger(AudioScriptService.name);

  constructor(
    @Inject(forwardRef(() => VertexOracle))
    private readonly vertexOracle: VertexOracle,
  ) {}

  async reformulate(input: AudioScriptInput): Promise<string> {
    try {
      const reformulated = await this.vertexOracle.narrateScript(input.text, {
        orderId: input.orderId,
        productLevel: input.productLevel,
      });

      if (!reformulated || reformulated.length < input.text.length * 0.3) {
        this.logger.warn(
          '⚠️ AudioScript returned suspiciously short output — fallback to raw text',
        );
        return input.text;
      }

      this.logger.log(`🖊️ [NARRATOR] Script: ${input.text.length} → ${reformulated.length} chars`);
      return reformulated;
    } catch (error) {
      this.logger.warn(
        `❌ AudioScript error — fallback to raw text: ${error instanceof Error ? error.message : String(error)}`,
      );
      return input.text;
    }
  }
}
