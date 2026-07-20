import { AiRuntimeCacheService } from './ai-runtime-cache.service';

describe('AiRuntimeCacheService', () => {
  it('calls registered invalidator', () => {
    const cache = new AiRuntimeCacheService();
    const invalidator = jest.fn();
    cache.registerInvalidator(invalidator);
    cache.invalidateAll('test');
    expect(invalidator).toHaveBeenCalled();
  });
});
