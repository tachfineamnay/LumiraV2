import {
  buildStudioReadingVersion,
  hashReadingContent,
  isCanonicalReadingContent,
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
});
