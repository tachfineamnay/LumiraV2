import { ConfigService } from '@nestjs/config';
import { MemoryConfigService } from './memory-config.service';

describe('MemoryConfigService', () => {
  it('is disabled by default and only accepts a global reasoning engine parent', () => {
    const disabled = new MemoryConfigService(new ConfigService({}));
    expect(disabled.isEnabled()).toBe(false);
    expect(disabled.isReadEnabled()).toBe(false);
    expect(disabled.isWriteEnabled()).toBe(false);
    expect(disabled.parent()).toBeNull();

    const invalid = new MemoryConfigService(
      new ConfigService({
        VERTEX_MEMORY_PARENT: 'projects/x/locations/europe-west1/reasoningEngines/y',
      }),
    );
    expect(invalid.parent()).toBeNull();

    const global = new MemoryConfigService(
      new ConfigService({
        VERTEX_MEMORY_ENABLED: 'true',
        VERTEX_MEMORY_PARENT: 'projects/x/locations/global/reasoningEngines/y',
      }),
    );
    expect(global.isEnabled()).toBe(true);
    expect(global.parent()).toBe('projects/x/locations/global/reasoningEngines/y');
  });

  it('uses separate bounded RPC, LRO and recent-recovery windows', () => {
    const config = new MemoryConfigService(
      new ConfigService({
        VERTEX_MEMORY_REQUEST_TIMEOUT_MS: '9000',
        VERTEX_MEMORY_LRO_TIMEOUT_MS: '70000',
        MEMORY_RECOVERY_LOOKBACK_MS: '7200000',
        MEMORY_RECOVERY_LIMIT: '12',
      }),
    );

    expect(config.requestTimeoutMs()).toBe(9000);
    expect(config.lroTimeoutMs()).toBe(70000);
    expect(config.recoveryLookbackMs()).toBe(7200000);
    expect(config.recoveryLimit()).toBe(12);
  });
});
