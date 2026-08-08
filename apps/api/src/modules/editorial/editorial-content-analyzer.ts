export type EditorialContentBlock = {
  index: number;
  type: 'heading' | 'paragraph' | 'list' | 'blockquote' | 'image';
  text: string;
};

export type EditorialContentLink = {
  href: string;
  text: string;
  blockIndex: number;
};

export type EditorialFaqEntry = {
  question: string;
  answer: string;
  questionBlockIndex: number;
};

export type EditorialContentEvidence = {
  text: string;
  blockIndex: number;
};

export type EditorialContentFacts = {
  headings: Array<{ level: number; text: string; blockIndex: number }>;
  paragraphs: Array<{ text: string; blockIndex: number }>;
  lists: Array<{ text: string; blockIndex: number }>;
  blockquotes: Array<{ text: string; blockIndex: number }>;
  images: Array<{ alt: string; blockIndex: number }>;
  links: EditorialContentLink[];
  internalLinks: EditorialContentLink[];
  externalLinks: EditorialContentLink[];
  anchors: string[];
  wordCount: number;
  firstParagraph: string;
  questionSections: Array<{ level: number; text: string; blockIndex: number }>;
  faq: EditorialFaqEntry[];
  numericClaims: EditorialContentEvidence[];
  quotations: EditorialContentEvidence[];
};

type TiptapNode = {
  type?: unknown;
  text?: unknown;
  attrs?: unknown;
  marks?: unknown;
  content?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function asNode(value: unknown): TiptapNode {
  return isRecord(value) ? value : {};
}

function childNodes(node: TiptapNode) {
  return Array.isArray(node.content) ? node.content.map(asNode) : [];
}

function textOf(node: TiptapNode): string {
  const ownText = typeof node.text === 'string' ? node.text : '';
  return ownText + childNodes(node).map(textOf).join('');
}

function linksOf(node: TiptapNode, blockIndex: number): EditorialContentLink[] {
  const directLinks = Array.isArray(node.marks)
    ? node.marks.flatMap((mark) => {
        if (!isRecord(mark) || mark.type !== 'link' || !isRecord(mark.attrs)) return [];
        const href = mark.attrs.href;
        return typeof href === 'string'
          ? [{ href, text: typeof node.text === 'string' ? node.text : '', blockIndex }]
          : [];
      })
    : [];
  return [...directLinks, ...childNodes(node).flatMap((child) => linksOf(child, blockIndex))];
}

function linkKind(link: EditorialContentLink) {
  if (link.href.startsWith('/') || link.href.startsWith('#')) return 'internal';
  return /^https?:\/\//i.test(link.href) ? 'external' : 'other';
}

function normalizeForMatch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractFaq(blocks: EditorialContentBlock[], headings: EditorialContentFacts['headings']) {
  const faqHeadings = headings.filter((heading) =>
    /\bfaq\b|questions? frequentes?/i.test(normalizeForMatch(heading.text)),
  );
  const faq: EditorialFaqEntry[] = [];

  for (const faqHeading of faqHeadings) {
    const sectionEnd = headings.find(
      (heading) => heading.blockIndex > faqHeading.blockIndex && heading.level <= faqHeading.level,
    )?.blockIndex;
    const questions = headings.filter(
      (heading) =>
        heading.blockIndex > faqHeading.blockIndex &&
        (sectionEnd === undefined || heading.blockIndex < sectionEnd) &&
        heading.level > faqHeading.level &&
        /\?$/.test(heading.text),
    );

    for (const question of questions) {
      const answerEnd =
        headings.find(
          (heading) =>
            heading.blockIndex > question.blockIndex &&
            (sectionEnd === undefined || heading.blockIndex < sectionEnd) &&
            heading.level <= question.level,
        )?.blockIndex ?? sectionEnd;
      const answer = blocks
        .filter(
          (block) =>
            block.index > question.blockIndex &&
            (answerEnd === undefined || block.index < answerEnd) &&
            ['paragraph', 'list', 'blockquote'].includes(block.type),
        )
        .map((block) => block.text)
        .filter(Boolean)
        .join('\n')
        .trim();
      faq.push({ question: question.text, answer, questionBlockIndex: question.blockIndex });
    }
  }

  return faq;
}

/** Deterministic structural analysis of the canonical Tiptap document. */
export function analyzeEditorialContent(contentJson: unknown): EditorialContentFacts {
  const document = asNode(contentJson);
  const topLevelNodes = childNodes(document);
  const headings: EditorialContentFacts['headings'] = [];
  const paragraphs: EditorialContentFacts['paragraphs'] = [];
  const lists: EditorialContentFacts['lists'] = [];
  const blockquotes: EditorialContentFacts['blockquotes'] = [];
  const images: EditorialContentFacts['images'] = [];
  const links: EditorialContentLink[] = [];
  const blocks: EditorialContentBlock[] = [];

  topLevelNodes.forEach((node, index) => {
    const type = typeof node.type === 'string' ? node.type : '';
    const text = textOf(node).replace(/\s+/g, ' ').trim();
    links.push(...linksOf(node, index));
    if (type === 'heading') {
      const attrs = isRecord(node.attrs) ? node.attrs : {};
      const requestedLevel = Number(attrs.level ?? 1);
      const level =
        Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 6
          ? requestedLevel
          : 1;
      headings.push({ level, text, blockIndex: index });
      blocks.push({ index, type: 'heading', text });
    } else if (type === 'paragraph') {
      paragraphs.push({ text, blockIndex: index });
      blocks.push({ index, type: 'paragraph', text });
    } else if (type === 'bulletList' || type === 'orderedList') {
      lists.push({ text, blockIndex: index });
      blocks.push({ index, type: 'list', text });
    } else if (type === 'blockquote') {
      blockquotes.push({ text, blockIndex: index });
      blocks.push({ index, type: 'blockquote', text });
    } else if (type === 'image') {
      const attrs = isRecord(node.attrs) ? node.attrs : {};
      const alt = typeof attrs.alt === 'string' ? attrs.alt : '';
      images.push({ alt, blockIndex: index });
      blocks.push({ index, type: 'image', text: alt });
    }
  });

  const internalLinks = links.filter((link) => linkKind(link) === 'internal');
  const externalLinks = links.filter((link) => linkKind(link) === 'external');
  const wordCount = blocks
    .map((block) => block.text)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  const questionSections = headings.filter((heading) => /\?$/.test(heading.text));
  const evidenceBlocks = blocks.filter((block) =>
    ['paragraph', 'list', 'blockquote'].includes(block.type),
  );
  const numericClaims = evidenceBlocks
    .filter((block) => /\b\d+(?:[\s.,]\d+)*(?:\s?%|\b)/u.test(block.text))
    .map(({ text, index }) => ({ text, blockIndex: index }));
  const quotations = evidenceBlocks
    .filter((block) => /[«»“”]|(?:^|\s)"[^"\n]+"/u.test(block.text))
    .map(({ text, index }) => ({ text, blockIndex: index }));

  return {
    headings,
    paragraphs,
    lists,
    blockquotes,
    images,
    links,
    internalLinks,
    externalLinks,
    anchors: links.map((link) => link.text).filter(Boolean),
    wordCount,
    firstParagraph: paragraphs[0]?.text ?? '',
    questionSections,
    faq: extractFaq(blocks, headings),
    numericClaims,
    quotations,
  };
}
