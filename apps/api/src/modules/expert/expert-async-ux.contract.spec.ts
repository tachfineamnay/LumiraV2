import { readFileSync } from 'fs';
import { join } from 'path';

describe('Desk expert fire-and-forget UX contracts', () => {
  const workflow = readFileSync(
    join(__dirname, '../../../../web/components/desk-v2/studio/OrderWorkflow.tsx'),
    'utf8',
  );

  it('acks enqueue without claiming generation is finished', () => {
    expect(workflow).toContain('Lecture en production');
    expect(workflow).not.toMatch(/toast\.success\('Génération terminée !'\)/);
  });

  it('keeps production non-blocking', () => {
    expect(workflow).toContain('SCRIBE');
    expect(workflow).toContain('EDITOR');
  });
});
