import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AiRuntimeCacheService {
  private readonly logger = new Logger(AiRuntimeCacheService.name);
  private invalidator: (() => void) | null = null;

  registerInvalidator(invalidator: () => void): void {
    this.invalidator = invalidator;
  }

  invalidateAll(reason: string): void {
    this.logger.log(`Invalidating AI runtime cache (${reason})`);
    this.invalidator?.();
  }
}
