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
        return typeof href === 'string' ? [{ href, text: typeof node.text === 'string' ? node.text : '', blockIndex }] : [];
      })
    : [];
  return [...directLinks, ...childNodes(node).flatMap((child) => linksOf(child, blockIndex))];
}

function linkKind(link: EditorialContentLink) {
  if (link.href.startsWith('/') || link.href.startsWith('#')) return 'internal';
  return /^https?:\/\//i.test(link.href) ? 'external' : 'other';
}

function extractFaq(blocks: EditorialContentBlock[], headings: EditorialContentFacts['headings']) {
  const faqHeading = headings.find((heading) => /\bfaq\b|questions? frequentes?/i.test(heading.text));
  if (!faqHeading) return [];

  const faq: EditorialFaqEntry[] = [];
  const sortedHeadings = headings.filter((heading) => heading.blockIndex > faqHeading.blockIndex);
  for (const question of sortedHeadings.filter((heading) => /\?$/.test(heading.text))) {
    const nextHeading = sortedHeadings.find((heading) => heading.blockIndex > question.blockIndex);
    const answerBlocks = blocks.filter(
      (block) =>
        block.index > question.blockIndex &&
        (nextHeading === undefined || block.index < nextHeading.blockIndex) &&
        ['paragraph', 'list', 'blockquote'].includes(block.type),
    );
    const answer = answerBlocks.map((block) => block.text).filter(Boolean).join('\n').trim();
    faq.push({ question: question.text, answer, questionBlockIndex: question.blockIndex });
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
      const level = Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 6 ? requestedLevel : 1;
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
  const wordCount = blocks.map((block) => block.text).join(' ').split(/\s+/).filter(Boolean).length;
  const questionSections = headings.filter((heading) => /\?$/.test(heading.text));

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
  };
}
