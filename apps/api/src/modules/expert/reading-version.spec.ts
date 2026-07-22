import {
  buildStudioReadingVersion,
  hashReadingContent,
  isCanonicalReadingContent,
  splitStudioContent,
} from './reading-version';

describe('reading version canonicalization', () => {
  it('uses the Studio edit instead of the original AI draft for PDF content', () => {
    const finalContent = '# Essence\nTexte validé par l’expert.\n\n# Conclusion\nVersion finale.';
    const version = buildStudioReadingVersion(
      {
        pdf_content: {
          introduction: 'Brouillon IA qui ne doit jamais être livré.',
          sections: [{ domain: 'draft', title: 'Draft', content: 'Ancien texte' }],
        },
        synthesis: { archetype: 'Le Sage' },
      },
      finalContent,
    );

    expect(version.lecture).toBe(finalContent);
    expect(version.pdf_content.introduction).toBe('');
    expect(version.pdf_content.sections).toEqual([
      { domain: 'Guidance', title: 'Essence', content: 'Texte validé par l’expert.' },
    ]);
    expect(version.pdf_content.conclusion).toBe('Version finale.');
    expect(JSON.stringify(version)).not.toContain('Brouillon IA');
    expect(isCanonicalReadingContent(version)).toBe(true);
    expect(hashReadingContent(version)).toHaveLength(64);
  });

  it('does not duplicate an unstructured Studio document in the generated PDF', () => {
    const version = buildStudioReadingVersion({}, 'Texte final sans intertitre.');

    expect(version.pdf_content.introduction).toBe('Texte final sans intertitre.');
    expect(version.pdf_content.sections).toEqual([]);
  });

  it('converts Tiptap HTML headings and paragraphs into canonical sections', () => {
    const parsed = splitStudioContent(`
      <h1>Introduction</h1>
      <p>Une ouverture &amp; une présence.</p>
      <h2>Mission de vie</h2>
      <p>Avancer avec clarté.</p>
      <h2>Conclusion</h2>
      <p>Intégrer le chemin.</p>
    `);

    expect(parsed.introduction).toBe('');
    expect(parsed.sections).toEqual([
      {
        domain: 'Guidance',
        title: 'Introduction',
        content: 'Une ouverture & une présence.',
      },
      {
        domain: 'Guidance',
        title: 'Mission de vie',
        content: 'Avancer avec clarté.',
      },
    ]);
    expect(parsed.conclusion).toBe('Intégrer le chemin.');
  });

  it('never persists literal editor tags as customer-facing lecture text', () => {
    const version = buildStudioReadingVersion(
      { synthesis: { archetype: 'Le Passeur', keywords: ['ancrage'] }, timeline: [] },
      '<h2>Votre lecture</h2><p>Premier axe<br>Deuxième axe</p>',
    );

    expect(version.lecture).toContain('Votre lecture');
    expect(version.lecture).toContain('Premier axe');
    expect(version.lecture).not.toContain('<h2>');
    expect(version.lecture).not.toContain('<p>');
    expect(version.pdf_content.sections[0]).toEqual({
      domain: 'Guidance',
      title: 'Votre lecture',
      content: 'Premier axe\n\nDeuxième axe',
    });
  });
});
