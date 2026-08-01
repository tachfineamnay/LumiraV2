import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GLOBAL_PARENT = /^projects\/[^/]+\/locations\/global\/reasoningEngines\/[^/]+$/;

@Injectable()
export class MemoryConfigService {
  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.bool('VERTEX_MEMORY_ENABLED');
  }

  isReadEnabled(): boolean {
    return this.isEnabled() && this.bool('VERTEX_MEMORY_READ_ENABLED');
  }

  isWriteEnabled(): boolean {
    return this.isEnabled() && this.bool('VERTEX_MEMORY_WRITE_ENABLED');
  }

  isAutoApproveEnabled(): boolean {
    return this.isEnabled() && this.bool('VERTEX_MEMORY_AUTO_APPROVE');
  }

  isWorkerEnabled(): boolean {
    return this.isEnabled() && this.bool('MEMORY_WORKER_ENABLED');
  }

  parent(): string | null {
    const value = this.config.get<string>('VERTEX_MEMORY_PARENT')?.trim() || '';
    return GLOBAL_PARENT.test(value) ? value : null;
  }

  assertParent(): string {
    const parent = this.parent();
    if (!parent) {
      throw new Error('Memory Bank requires VERTEX_MEMORY_PARENT in location global.');
    }
    return parent;
  }

  pollMs(): number {
    return this.number('MEMORY_WORKER_POLL_MS', 5000, 1000, 300_000);
  }

  concurrency(): number {
    return this.number('MEMORY_WORKER_CONCURRENCY', 1, 1, 8);
  }

  maxAttempts(): number {
    return this.number('MEMORY_JOB_MAX_ATTEMPTS', 5, 1, 20);
  }

  staleMs(): number {
    return this.number('MEMORY_JOB_STALE_MS', 900_000, 60_000, 86_400_000);
  }

  requestTimeoutMs(): number {
    return this.number('VERTEX_MEMORY_REQUEST_TIMEOUT_MS', 8_000, 500, 30_000);
  }

  lroTimeoutMs(): number {
    return this.number('VERTEX_MEMORY_LRO_TIMEOUT_MS', 60_000, 1_000, 300_000);
  }

  recoveryLookbackMs(): number {
    return this.number('MEMORY_RECOVERY_LOOKBACK_MS', 3_600_000, 60_000, 604_800_000);
  }

  recoveryLimit(): number {
    return this.number('MEMORY_RECOVERY_LIMIT', 10, 1, 100);
  }

  pendingMutationLimit(): number {
    return this.number('MEMORY_PENDING_MUTATION_LIMIT', 10, 1, 100);
  }

  diagnosticUsers(): { userAId: string; userBId: string } | null {
    const userAId = this.config.get<string>('VERTEX_MEMORY_DIAGNOSTIC_USER_A')?.trim() || '';
    const userBId = this.config.get<string>('VERTEX_MEMORY_DIAGNOSTIC_USER_B')?.trim() || '';
    return userAId && userBId && userAId !== userBId ? { userAId, userBId } : null;
  }

  private bool(key: string): boolean {
    const raw = this.config.get<string>(key)?.trim().toLowerCase();
    return raw === 'true' || raw === '1';
  }

  private number(key: string, fallback: number, min: number, max: number): number {
    const parsed = Number(this.config.get<string>(key));
    return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
  }
}
