import { createHash } from 'crypto';

type JsonRecord = Record<string, unknown>;

export interface CanonicalPdfSection {
  domain: string;
  title: string;
  content: string;
}

export interface CanonicalReadingContent {
  pdf_content: {
    introduction: string;
    archetype_reveal: string;
    sections: CanonicalPdfSection[];
    karmic_insights: string[];
    life_mission: string;
    rituals: unknown[];
    conclusion: string;
  };
  synthesis: {
    archetype: string;
    keywords: string[];
    emotional_state: string;
    key_blockage: string;
  };
  timeline: unknown[];
  lecture: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[normalized] ?? match;
  });
}

/**
 * Tiptap sends HTML to the API. Convert its safe document subset into plain,
 * structured lines before the canonical reading is sealed. Without this step,
 * literal <h1>/<p> tags were escaped and printed inside the customer PDF.
 */
function studioHtmlToText(content: string): string {
  if (!/<\/?(?:h[1-6]|p|div|li|ul|ol|br|blockquote)\b/i.test(content)) {
    return content;
  }

  const normalized = content
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*h[1-6][^>]*>/gi, '\n# ')
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\s*\/\s*li\s*>/gi, '\n')
    .replace(/<\s*\/?\s*(?:p|div|blockquote|ul|ol)[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '');

  return decodeHtmlEntities(normalized)
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Converts the Studio's text into the document body rendered in the PDF. This
 * deliberately does not reuse the generated draft body: after an expert edit,
 * the Studio input is the sole source of customer-facing prose.
 */
export function splitStudioContent(content: string): {
  introduction: string;
  sections: CanonicalPdfSection[];
  conclusion: string;
} {
  const normalizedContent = studioHtmlToText(content);
  const lines = normalizedContent
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: CanonicalPdfSection[] = [];
  const introduction: string[] = [];
  let current: { title: string; content: string[] } | null = null;

  const isHeading = (line: string) =>
    line.startsWith('#') ||
    (line.length > 3 && line.length < 80 && line === line.toUpperCase()) ||
    /^[A-ZÀ-Ü][^.!?]{0,76}:?$/.test(line);

  const pushCurrent = () => {
    if (current?.content.length) {
      sections.push({
        domain: 'Guidance',
        title: current.title.replace(/^#+\s*/, ''),
        content: current.content.join('\n\n'),
      });
    }
  };

  for (const line of lines) {
    if (isHeading(line)) {
      pushCurrent();
      current = { title: line, content: [] };
    } else if (current) {
      current.content.push(line);
    } else {
      introduction.push(line);
    }
  }
  pushCurrent();

  let conclusion = '';
  const lastSection = sections.at(-1);
  if (lastSection && /conclusion|fin|int[ée]gration/i.test(lastSection.title)) {
    conclusion = lastSection.content;
    sections.pop();
  }

  // A heading-less Studio document is still rendered in full, rather than
  // silently preserving any AI draft text.
  if (sections.length === 0 && introduction.length === 0) {
    sections.push({
      domain: 'Guidance',
      title: 'Votre lecture',
      content: normalizedContent.trim(),
    });
  }

  return { introduction: introduction.join('\n\n'), sections, conclusion };
}

/** Builds the exact customer-facing document persisted when an expert seals it. */
export function buildStudioReadingVersion(
  currentGenerated: unknown,
  finalContent: string,
): CanonicalReadingContent {
  const source = isRecord(currentGenerated) ? currentGenerated : {};
  const synthesis = isRecord(source.synthesis) ? source.synthesis : {};
  const parsed = splitStudioContent(finalContent);

  return {
    pdf_content: {
      introduction: parsed.introduction,
      archetype_reveal: '',
      sections: parsed.sections.length > 0 ? parsed.sections : [],
      karmic_insights: [],
      life_mission: '',
      rituals: [],
      conclusion: parsed.conclusion,
    },
    synthesis: {
      archetype: asString(synthesis.archetype, 'Guidance personnalisée'),
      keywords: asStringArray(synthesis.keywords),
      emotional_state: asString(synthesis.emotional_state),
      key_blockage: asString(synthesis.key_blockage),
    },
    timeline: Array.isArray(source.timeline) ? source.timeline : [],
    lecture: studioHtmlToText(finalContent).trim(),
  };
}

/** Preserves an already structured AI reading when an expert approves it without editing it. */
export function buildGeneratedReadingVersion(currentGenerated: unknown): CanonicalReadingContent {
  if (!isRecord(currentGenerated) || !isRecord(currentGenerated.pdf_content)) {
    throw new Error('La lecture générée ne contient pas de document PDF structuré');
  }

  const pdf = currentGenerated.pdf_content;
  const synthesis = isRecord(currentGenerated.synthesis) ? currentGenerated.synthesis : {};
  const sections = Array.isArray(pdf.sections)
    ? pdf.sections
        .filter(isRecord)
        .map((section) => ({
          domain: asString(section.domain, 'Guidance'),
          title: asString(section.title, 'Votre lecture'),
          content: asString(section.content),
        }))
        .filter((section) => section.content.trim().length > 0)
    : [];

  if (sections.length === 0 && !asString(pdf.introduction).trim()) {
    throw new Error('La lecture générée ne contient aucun contenu livrable');
  }

  return {
    pdf_content: {
      introduction: asString(pdf.introduction),
      archetype_reveal: asString(pdf.archetype_reveal),
      sections,
      karmic_insights: asStringArray(pdf.karmic_insights),
      life_mission: asString(pdf.life_mission),
      rituals: Array.isArray(pdf.rituals) ? pdf.rituals : [],
      conclusion: asString(pdf.conclusion),
    },
    synthesis: {
      archetype: asString(synthesis.archetype, 'Guidance personnalisée'),
      keywords: asStringArray(synthesis.keywords),
      emotional_state: asString(synthesis.emotional_state),
      key_blockage: asString(synthesis.key_blockage),
    },
    timeline: Array.isArray(currentGenerated.timeline) ? currentGenerated.timeline : [],
    lecture: asString(currentGenerated.lecture),
  };
}

/** Runtime guard for JSON read back from PostgreSQL before it reaches the PDF renderer. */
export function isCanonicalReadingContent(value: unknown): value is CanonicalReadingContent {
  if (!isRecord(value) || !isRecord(value.pdf_content) || !isRecord(value.synthesis)) {
    return false;
  }

  const pdf = value.pdf_content;
  return (
    typeof value.lecture === 'string' &&
    typeof value.synthesis.archetype === 'string' &&
    typeof pdf.introduction === 'string' &&
    typeof pdf.archetype_reveal === 'string' &&
    typeof pdf.conclusion === 'string' &&
    Array.isArray(pdf.sections) &&
    pdf.sections.every(
      (section) =>
        isRecord(section) &&
        typeof section.domain === 'string' &&
        typeof section.title === 'string' &&
        typeof section.content === 'string',
    )
  );
}

export function hashReadingContent(content: CanonicalReadingContent): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
