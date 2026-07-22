import { readFileSync } from 'fs';
import { join } from 'path';

describe('Desk expert fire-and-forget UX contracts', () => {
  const workflow = readFileSync(
    join(__dirname, '../../../../web/components/desk-v2/studio/OrderWorkflow.tsx'),
    'utf8',
  );
  const briefing = readFileSync(
    join(__dirname, '../../../../web/components/desk-v2/studio/StepBriefing.tsx'),
    'utf8',
  );

  it('acks enqueue without claiming generation is finished', () => {
    expect(workflow).toContain("toast.success('Lecture lancée — vous pouvez quitter'");
    expect(workflow).not.toMatch(/toast\.success\('Génération terminée !'\)/);
    expect(workflow).toContain("router.push('/admin/board')");
  });

  it('announces audio queue after seal', () => {
    expect(workflow).toContain("toast.success('Lecture scellée — PDF envoyé, audio en file'");
  });

  it('keeps briefing usable with a non-blocking production banner', () => {
    expect(briefing).toContain('Estimation : 2 à 5 minutes');
    expect(briefing).toContain('Retour au board');
    expect(briefing).not.toContain('L&apos;Oracle crée la lecture...');
  });
});
