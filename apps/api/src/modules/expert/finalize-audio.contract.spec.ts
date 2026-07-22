import { readFileSync } from 'fs';
import { join } from 'path';

describe('Post-seal audio + Sanctuaire delivery contracts', () => {
  const expertService = readFileSync(join(__dirname, './expert.service.ts'), 'utf8');
  const digitalSoul = readFileSync(
    join(__dirname, '../../services/factory/DigitalSoulService.ts'),
    'utf8',
  );
  const sanctuaireHome = readFileSync(
    join(__dirname, '../../../../web/app/sanctuaire/page.tsx'),
    'utf8',
  );

  it('queues managed audio after studio finalize', () => {
    expect(expertService).toContain('enqueueAudioBestEffort');
    expect(expertService).toContain('await this.enqueueAudioBestEffort(orderId, expert)');
  });

  it('does not fire-and-forget generateAllAudio from DigitalSoul finalize', () => {
    expect(digitalSoul).not.toMatch(/generateAllAudio\(orderId\)\.catch/);
  });

  it('embeds onboarding inline on Sanctuaire home', () => {
    expect(sanctuaireHome).toContain('variant="inline"');
    expect(sanctuaireHome).toContain('Narration en préparation');
    expect(sanctuaireHome).toContain('/sanctuaire/lecture/');
    expect(sanctuaireHome).not.toContain('setShowPreparation');
  });
});
