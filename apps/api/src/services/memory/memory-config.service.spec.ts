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
});
