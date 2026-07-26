import { readFileSync } from 'fs';
import { join } from 'path';

describe('AI service log privacy', () => {
  it('does not interpolate client names into DigitalSoul or ContextDispatcher logs', () => {
    const factoryRoot = __dirname;
    const sources = ['DigitalSoulService.ts', 'ContextDispatcher.ts'].map((file) =>
      readFileSync(join(factoryRoot, file), 'utf8'),
    );

    for (const source of sources) {
      expect(source).not.toMatch(/logger\.(?:log|warn|error)\([^\n]*\$\{user\.firstName\}/);
      expect(source).not.toMatch(/logger\.(?:log|warn|error)\([^\n]*\$\{user\.lastName\}/);
    }
  });
});
