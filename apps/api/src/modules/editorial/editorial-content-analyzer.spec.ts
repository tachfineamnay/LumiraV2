import { analyzeEditorialContent } from './editorial-content-analyzer';

describe('analyzeEditorialContent', () => {
  it('extracts AST facts and associates each FAQ question with its actual answer', () => {
    const facts = analyzeEditorialContent({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Guide' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Une introduction claire avec 42 % de contexte.' }, { type: 'text', text: ' Source fiable', marks: [{ type: 'link', attrs: { href: 'https://example.org/source' } }] }] },
        { type: 'blockquote', content: [{ type: 'text', text: 'Une citation explicite.' }] },
        { type: 'image', attrs: { src: '/image.jpg', alt: 'Une image' } },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'FAQ' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Quelle réponse ?' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Voici la véritable réponse associée à la question.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Ce bloc ne fait pas partie de la réponse FAQ.' }] },
      ],
    });

    expect(facts.headings).toHaveLength(4);
    expect(facts.paragraphs).toHaveLength(3);
    expect(facts.blockquotes).toHaveLength(1);
    expect(facts.images).toEqual([{ alt: 'Une image', blockIndex: 3 }]);
    expect(facts.externalLinks).toEqual([expect.objectContaining({ href: 'https://example.org/source', text: ' Source fiable' })]);
    expect(facts.faq).toEqual([{ question: 'Quelle réponse ?', answer: 'Voici la véritable réponse associée à la question.', questionBlockIndex: 5 }]);
    expect(facts.wordCount).toBeGreaterThan(0);
  });
});
