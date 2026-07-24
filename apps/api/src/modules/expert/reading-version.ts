import { createHash } from 'crypto';

type JsonRecord = Record<string, unknown>;

export interface CanonicalReadingSection {
  domain: string;
  title: string;
  content: string;
}

export type CanonicalPdfSection = CanonicalReadingSection;

export interface CanonicalReadingRitual {
  name: string;
  description: string;
  instructions: string[];
}

export interface CanonicalReadingSynthesis {
  archetype: string;
  keywords: string[];
  emotional_state: string;
  key_blockage: string;
}

export interface CanonicalReadingTimelineItem {
  day: number;
  title: string;
  action: string;
  mantra?: string;
  actionType?: 'MANTRA' | 'RITUAL' | 'JOURNALING' | 'MEDITATION' | 'REFLECTION';
}

export interface CanonicalReadingContent {
  pdf_content: {
    introduction: string;
    archetype_reveal: string;
    sections: CanonicalReadingSection[];
    karmic_insights: string[];
    life_mission: string;
    rituals: CanonicalReadingRitual[];
    conclusion: string;
  };
  synthesis: CanonicalReadingSynthesis;
  timeline: CanonicalReadingTimelineItem[];
  lecture: string;
}

export const REQUIRED_DOMAINS = [
  'spirituel',
  'relations',
  'mission',
  'creativite',
  'emotions',
  'travail',
  'sante',
  'finance',
] as const;

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

function parseRituals(input: unknown): CanonicalReadingRitual[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isRecord).map((r) => ({
    name: asString(r.name),
    description: asString(r.description),
    instructions: asStringArray(r.instructions),
  }));
}

function parseTimeline(input: unknown): CanonicalReadingTimelineItem[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isRecord).map((t) => ({
    day: typeof t.day === 'number' ? t.day : 1,
    title: asString(t.title),
    action: asString(t.action),
    mantra: typeof t.mantra === 'string' ? t.mantra : undefined,
    actionType:
      typeof t.actionType === 'string'
        ? (t.actionType as CanonicalReadingTimelineItem['actionType'])
        : undefined,
  }));
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

export function studioHtmlToText(content: string): string {
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

function matchDomain(heading: string): string {
  const norm = heading.toLowerCase();
  if (/spirituel|esprit|[âa]me|guidance|essence/i.test(norm)) return 'spirituel';
  if (/relation|amour|couple|lien|famille/i.test(norm)) return 'relations';
  if (/mission|vocation|destin/i.test(norm)) return 'mission';
  if (/cr[éa]tiv|expression|art/i.test(norm)) return 'creativite';
  if (/[ée]motion|sentiment|ressenti|blocage/i.test(norm)) return 'emotions';
  if (/travail|profession|carri[èe]re|action/i.test(norm)) return 'travail';
  if (/sant[ée]|corps|vitalit[ée]|physiqu/i.test(norm)) return 'sante';
  if (/finance|mat[ée]riel|abondance|argent/i.test(norm)) return 'finance';

  for (const d of REQUIRED_DOMAINS) {
    if (norm.includes(d)) return d;
  }
  return 'spirituel';
}

export function splitStudioContent(content: string): {
  introduction: string;
  archetype_reveal: string;
  sections: CanonicalReadingSection[];
  karmic_insights: string[];
  life_mission: string;
  rituals: CanonicalReadingRitual[];
  conclusion: string;
} {
  const normalizedText = studioHtmlToText(content);

  const parsed = {
    introduction: '',
    archetype_reveal: '',
    sections: [] as CanonicalReadingSection[],
    karmic_insights: [] as string[],
    life_mission: '',
    rituals: [] as CanonicalReadingRitual[],
    conclusion: '',
  };

  const insightsMatch = content.match(
    /<h[1-6][^>]*>\s*Insights\s*Karmiques\s*<\/h[1-6]>([\s\S]*?)(?=<h[1-6]|$)/i,
  );
  if (insightsMatch) {
    const listItems = insightsMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    if (listItems) {
      parsed.karmic_insights = listItems
        .map((item) => item.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean);
    }
  }

  const ritualsMatch = content.match(
    /<h[1-6][^>]*>\s*Rituels\s*(?:Recommand[ée]s)?\s*<\/h[1-6]>([\s\S]*?)(?=<h[1-2]|$)/i,
  );
  if (ritualsMatch) {
    const ritualBlocks = ritualsMatch[1].split(/(?=<h3[^>]*>)/i).filter(Boolean);
    for (const block of ritualBlocks) {
      const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const name = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const description = pMatch ? pMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const instMatches = block.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      const instructions = instMatches
        ? instMatches.map((i) => i.replace(/<[^>]+>/g, '').trim()).filter(Boolean)
        : [];
      if (name || description || instructions.length > 0) {
        parsed.rituals.push({ name, description, instructions });
      }
    }
  }

  const lines = normalizedText
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let currentHeading = '';
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentHeading && currentLines.length > 0) {
      if (!parsed.introduction) {
        parsed.introduction = currentLines.join('\n\n');
      }
    } else if (currentHeading) {
      const headingNorm = currentHeading
        .toLowerCase()
        .replace(/^#+\s*/, '')
        .trim();
      const text = currentLines.join('\n\n').trim();

      if (/\bintroduction\b/i.test(headingNorm)) {
        if (!parsed.introduction) parsed.introduction = text;
      } else if (/r[év]v[év]lation.*arch[ée]type|\barch[ée]type\b/i.test(headingNorm)) {
        if (!parsed.archetype_reveal) parsed.archetype_reveal = text;
      } else if (/\binsights?\s*karmiques?\b/i.test(headingNorm)) {
        if (parsed.karmic_insights.length === 0 && text) {
          parsed.karmic_insights = text
            .split('\n')
            .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
            .filter(Boolean);
        }
      } else if (/\bmission\s*de\s*vie\b/i.test(headingNorm)) {
        if (!parsed.life_mission) parsed.life_mission = text;
      } else if (/\brituels?\b/i.test(headingNorm)) {
        // Handled via HTML parser or fallback
      } else if (/\bconclusion\b|\bint[ée]gration\b/i.test(headingNorm)) {
        if (!parsed.conclusion) parsed.conclusion = text;
      } else {
        const domain = matchDomain(headingNorm);
        parsed.sections.push({
          domain,
          title: currentHeading.replace(/^#+\s*/, ''),
          content: text,
        });
      }
    }
  };

  const isHeadingLine = (line: string) => /^#+\s*/.test(line);

  for (const line of lines) {
    if (isHeadingLine(line)) {
      flush();
      currentHeading = line;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return parsed;
}

export function buildStudioReadingVersion(
  currentGenerated: unknown,
  finalContent: string,
): CanonicalReadingContent {
  const source = isRecord(currentGenerated) ? currentGenerated : {};

  if (
    (finalContent === asString(source.lecture) || !finalContent.trim()) &&
    isRecord(source.pdf_content)
  ) {
    return buildGeneratedReadingVersion(currentGenerated);
  }

  const pdfSource = isRecord(source.pdf_content) ? source.pdf_content : {};
  const synthesisSource = isRecord(source.synthesis) ? source.synthesis : {};
  const parsed = splitStudioContent(finalContent);

  const introduction = parsed.introduction.trim() || asString(pdfSource.introduction);
  const archetype_reveal = parsed.archetype_reveal.trim() || asString(pdfSource.archetype_reveal);
  const life_mission = parsed.life_mission.trim() || asString(pdfSource.life_mission);
  const conclusion = parsed.conclusion.trim() || asString(pdfSource.conclusion);

  const karmic_insights =
    parsed.karmic_insights.length === 4
      ? parsed.karmic_insights
      : asStringArray(pdfSource.karmic_insights);

  const rituals =
    parsed.rituals.length === 2 && parsed.rituals.every((r) => r.instructions?.length >= 4)
      ? parsed.rituals
      : parseRituals(pdfSource.rituals);

  const existingSections = Array.isArray(pdfSource.sections)
    ? pdfSource.sections.filter(isRecord).map((s) => ({
        domain: asString(s.domain, 'spirituel').toLowerCase().trim(),
        title: asString(s.title),
        content: asString(s.content),
      }))
    : [];

  const mergedSections: CanonicalReadingSection[] = [];

  for (let i = 0; i < REQUIRED_DOMAINS.length; i++) {
    const reqDomain = REQUIRED_DOMAINS[i];

    const parsedSec = parsed.sections.find((s) => s.domain.toLowerCase().trim() === reqDomain);

    const existingSec = existingSections.find((s) => s.domain === reqDomain) || existingSections[i];

    if (parsedSec && parsedSec.content.trim()) {
      mergedSections.push({
        domain: reqDomain,
        title: parsedSec.title || existingSec?.title || `Grand axe : ${reqDomain}`,
        content: parsedSec.content.trim(),
      });
    } else if (existingSec && existingSec.content.trim()) {
      mergedSections.push({
        domain: reqDomain,
        title: existingSec.title || `Grand axe : ${reqDomain}`,
        content: existingSec.content.trim(),
      });
    } else {
      mergedSections.push({
        domain: reqDomain,
        title: `Grand axe : ${reqDomain}`,
        content: parsed.introduction || 'Contenu de la section.',
      });
    }
  }

  return {
    pdf_content: {
      introduction,
      archetype_reveal,
      sections: mergedSections,
      karmic_insights,
      life_mission,
      rituals,
      conclusion,
    },
    synthesis: {
      archetype: asString(synthesisSource.archetype, 'Le Guérisseur'),
      keywords: asStringArray(synthesisSource.keywords),
      emotional_state: asString(synthesisSource.emotional_state),
      key_blockage: asString(synthesisSource.key_blockage),
    },
    timeline: parseTimeline(source.timeline),
    lecture: studioHtmlToText(finalContent).trim(),
  };
}

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
          domain: asString(section.domain, 'spirituel'),
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
      rituals: parseRituals(pdf.rituals),
      conclusion: asString(pdf.conclusion),
    },
    synthesis: {
      archetype: asString(synthesis.archetype, 'Le Guérisseur'),
      keywords: asStringArray(synthesis.keywords),
      emotional_state: asString(synthesis.emotional_state),
      key_blockage: asString(synthesis.key_blockage),
    },
    timeline: parseTimeline(currentGenerated.timeline),
    lecture: asString(currentGenerated.lecture),
  };
}

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
    ) &&
    Array.isArray(pdf.karmic_insights) &&
    Array.isArray(pdf.rituals)
  );
}

export function hashReadingContent(content: CanonicalReadingContent): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
