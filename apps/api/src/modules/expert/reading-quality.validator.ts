import { BadRequestException } from '@nestjs/common';

export interface QualityIssue {
  code: string;
  message: string;
  field?: string;
  severity: 'BLOCKING' | 'WARNING';
}

export interface QualityMetrics {
  totalWords: number;
  sectionWordCounts: Record<string, number>;
  insightsCount: number;
  ritualsCount: number;
  instructionsCount: number;
}

export interface ReadingQualityReport {
  status: 'PASS' | 'WARNING' | 'BLOCKED';
  blockingIssues: QualityIssue[];
  warnings: QualityIssue[];
  metrics: QualityMetrics;
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

export const ALLOWED_ARCHETYPES = [
  'Le Guérisseur',
  'Le Visionnaire',
  'Le Guide',
  'Le Créateur',
  'Le Sage',
] as const;

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function countWords(str: string): number {
  if (!str || typeof str !== 'string') return 0;
  return str
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

const COMMON_FRENCH_STOPWORDS = new Set([
  'dans',
  'pour',
  'avec',
  'cette',
  'votre',
  'leurs',
  'ainsi',
  'tous',
  'tout',
  'plus',
  'être',
  'huit',
  'entre',
  'fait',
  'faire',
  'aussi',
  'sommes',
  'nous',
  'vous',
  'elle',
  'elles',
  'mais',
  'même',
  'meme',
  'sont',
  'notre',
  'nos',
  'celui',
  'celle',
  'ceux',
  'celles',
  'avoir',
  'sera',
  'chaque',
  'votre',
  'vôtres',
  'quand',
  'alors',
  'vers',
  'sous',
  'sans',
  'dont',
]);

export class ReadingQualityValidator {
  validate(content: unknown): ReadingQualityReport {
    const blockingIssues: QualityIssue[] = [];
    const warnings: QualityIssue[] = [];

    if (!isRecord(content)) {
      blockingIssues.push({
        code: 'NULL_VALUE_DISALLOWED',
        message: 'Le contenu de la lecture est nul ou invalide',
        severity: 'BLOCKING',
      });
      return {
        status: 'BLOCKED',
        blockingIssues,
        warnings: [],
        metrics: {
          totalWords: 0,
          sectionWordCounts: {},
          insightsCount: 0,
          ritualsCount: 0,
          instructionsCount: 0,
        },
      };
    }

    const pdf = isRecord(content.pdf_content) ? content.pdf_content : null;
    const synthesis = isRecord(content.synthesis) ? content.synthesis : null;

    if (!pdf || !synthesis) {
      blockingIssues.push({
        code: 'MISSING_STRUCTURE',
        message: "Les structures 'pdf_content' ou 'synthesis' sont absentes",
        severity: 'BLOCKING',
      });
      return {
        status: 'BLOCKED',
        blockingIssues,
        warnings: [],
        metrics: {
          totalWords: 0,
          sectionWordCounts: {},
          insightsCount: 0,
          ritualsCount: 0,
          instructionsCount: 0,
        },
      };
    }

    // 1. Check for NULL or UNDEFINED in required fields
    const requiredTopLevel = [
      { name: 'introduction', value: pdf.introduction },
      { name: 'archetype_reveal', value: pdf.archetype_reveal },
      { name: 'sections', value: pdf.sections },
      { name: 'karmic_insights', value: pdf.karmic_insights },
      { name: 'life_mission', value: pdf.life_mission },
      { name: 'rituals', value: pdf.rituals },
      { name: 'conclusion', value: pdf.conclusion },
      { name: 'synthesis.archetype', value: synthesis.archetype },
      { name: 'synthesis.keywords', value: synthesis.keywords },
      { name: 'synthesis.emotional_state', value: synthesis.emotional_state },
      { name: 'synthesis.key_blockage', value: synthesis.key_blockage },
    ];

    for (const item of requiredTopLevel) {
      if (item.value === null || item.value === undefined) {
        blockingIssues.push({
          code: 'NULL_VALUE_DISALLOWED',
          message: `Le champ obligatoire '${item.name}' est null ou non défini`,
          field: item.name,
          severity: 'BLOCKING',
        });
      }
    }

    // 2. Check structural arrays
    const arrayFields = [
      { name: 'sections', value: pdf.sections },
      { name: 'karmic_insights', value: pdf.karmic_insights },
      { name: 'rituals', value: pdf.rituals },
      { name: 'synthesis.keywords', value: synthesis.keywords },
      { name: 'timeline', value: content.timeline },
    ];

    for (const field of arrayFields) {
      if (!Array.isArray(field.value)) {
        blockingIssues.push({
          code: 'MISSING_ARRAY',
          message: `Le champ '${field.name}' doit être un tableau`,
          field: field.name,
          severity: 'BLOCKING',
        });
      }
    }

    if (
      blockingIssues.some((i) => i.code === 'MISSING_ARRAY' || i.code === 'NULL_VALUE_DISALLOWED')
    ) {
      return {
        status: 'BLOCKED',
        blockingIssues,
        warnings: [],
        metrics: {
          totalWords: 0,
          sectionWordCounts: {},
          insightsCount: 0,
          ritualsCount: 0,
          instructionsCount: 0,
        },
      };
    }

    const sections = (pdf.sections as unknown[]).filter(isRecord);
    const karmicInsights = (pdf.karmic_insights as unknown[]).filter(
      (x): x is string => typeof x === 'string',
    );
    const rituals = (pdf.rituals as unknown[]).filter(isRecord);
    const keywords = (synthesis.keywords as unknown[]).filter(
      (x): x is string => typeof x === 'string',
    );
    const archetype = typeof synthesis.archetype === 'string' ? synthesis.archetype.trim() : '';
    const introduction = typeof pdf.introduction === 'string' ? pdf.introduction.trim() : '';
    const archetypeReveal =
      typeof pdf.archetype_reveal === 'string' ? pdf.archetype_reveal.trim() : '';
    const lifeMission = typeof pdf.life_mission === 'string' ? pdf.life_mission.trim() : '';
    const conclusion = typeof pdf.conclusion === 'string' ? pdf.conclusion.trim() : '';

    // 3. BLOCKING: Exactly 8 sections
    if (sections.length !== 8) {
      blockingIssues.push({
        code: 'SECTIONS_COUNT_INVALID',
        message: `La lecture doit contenir exactement 8 sections (reçu: ${sections.length})`,
        field: 'sections',
        severity: 'BLOCKING',
      });
    }

    // 4. BLOCKING: Exact domain order & uniqueness
    const domains = sections.map((s) =>
      typeof s.domain === 'string' ? s.domain.toLowerCase().trim() : '',
    );
    const domainSet = new Set<string>();
    let hasDuplicateDomains = false;
    for (const d of domains) {
      if (domainSet.has(d)) hasDuplicateDomains = true;
      domainSet.add(d);
    }
    if (hasDuplicateDomains) {
      blockingIssues.push({
        code: 'DOMAINS_NOT_UNIQUE',
        message: 'Les domaines des sections contiennent des doublons',
        field: 'sections.domain',
        severity: 'BLOCKING',
      });
    }

    let isDomainOrderValid = true;
    if (sections.length === 8) {
      for (let i = 0; i < 8; i++) {
        if (domains[i] !== REQUIRED_DOMAINS[i]) {
          isDomainOrderValid = false;
          break;
        }
      }
      if (!isDomainOrderValid) {
        blockingIssues.push({
          code: 'DOMAINS_ORDER_INVALID',
          message: `L'ordre exact des 8 domaines doit être : ${REQUIRED_DOMAINS.join(', ')} (reçu : ${domains.join(', ')})`,
          field: 'sections.domain',
          severity: 'BLOCKING',
        });
      }
    }

    // 5. BLOCKING: Non-empty titles and contents
    if (!introduction) {
      blockingIssues.push({
        code: 'REQUIRED_TEXT_MISSING',
        message: "L'introduction est obligatoire et ne peut pas être vide",
        field: 'introduction',
        severity: 'BLOCKING',
      });
    }
    if (!archetypeReveal) {
      blockingIssues.push({
        code: 'REQUIRED_TEXT_MISSING',
        message: "La révélation d'archétype est obligatoire et ne peut pas être vide",
        field: 'archetype_reveal',
        severity: 'BLOCKING',
      });
    }
    if (!lifeMission) {
      blockingIssues.push({
        code: 'REQUIRED_TEXT_MISSING',
        message: 'La mission de vie est obligatoire et ne peut pas être vide',
        field: 'life_mission',
        severity: 'BLOCKING',
      });
    }
    if (!conclusion) {
      blockingIssues.push({
        code: 'REQUIRED_TEXT_MISSING',
        message: 'La conclusion est obligatoire et ne peut pas être vide',
        field: 'conclusion',
        severity: 'BLOCKING',
      });
    }

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const title = typeof sec.title === 'string' ? sec.title.trim() : '';
      const contentStr = typeof sec.content === 'string' ? sec.content.trim() : '';
      if (!title || !contentStr) {
        blockingIssues.push({
          code: 'SECTION_EMPTY',
          message: `La section ${i + 1} (${sec.domain || 'inconnue'}) a un titre ou un contenu vide`,
          field: `sections[${i}]`,
          severity: 'BLOCKING',
        });
      }
    }

    // 6. BLOCKING: Exactly 4 karmic_insights
    if (karmicInsights.length !== 4 || karmicInsights.some((insight) => !insight.trim())) {
      blockingIssues.push({
        code: 'INSIGHTS_COUNT_INVALID',
        message: `La lecture doit contenir exactement 4 insights karmiques non vides (reçu: ${karmicInsights.length})`,
        field: 'karmic_insights',
        severity: 'BLOCKING',
      });
    }

    // 7. BLOCKING: Exactly 2 rituals
    if (rituals.length !== 2) {
      blockingIssues.push({
        code: 'RITUALS_COUNT_INVALID',
        message: `La lecture doit contenir exactement 2 rituels (reçu: ${rituals.length})`,
        field: 'rituals',
        severity: 'BLOCKING',
      });
    }

    // 8. BLOCKING: Each ritual has 4 to 6 non-empty instructions
    let totalInstructionsCount = 0;
    for (let i = 0; i < rituals.length; i++) {
      const rit = rituals[i];
      const name = typeof rit.name === 'string' ? rit.name.trim() : '';
      const desc = typeof rit.description === 'string' ? rit.description.trim() : '';
      const instrs = Array.isArray(rit.instructions)
        ? rit.instructions.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
      totalInstructionsCount += instrs.length;

      if (!name || !desc || instrs.length < 4 || instrs.length > 6) {
        blockingIssues.push({
          code: 'RITUAL_INSTRUCTIONS_COUNT_INVALID',
          message: `Le rituel ${i + 1} ('${name || 'sans nom'}') doit posséder un nom, une description et entre 4 et 6 instructions non vides (reçu: ${instrs.length})`,
          field: `rituals[${i}].instructions`,
          severity: 'BLOCKING',
        });
      }
    }

    // 9. BLOCKING: Exactly 5 keywords
    if (keywords.length !== 5 || keywords.some((k) => !k.trim())) {
      blockingIssues.push({
        code: 'KEYWORDS_COUNT_INVALID',
        message: `La synthèse doit contenir exactement 5 mots-clés non vides (reçu: ${keywords.length})`,
        field: 'synthesis.keywords',
        severity: 'BLOCKING',
      });
    }

    // 10. BLOCKING: Allowed Archetype
    if (
      !archetype ||
      !ALLOWED_ARCHETYPES.includes(archetype as (typeof ALLOWED_ARCHETYPES)[number])
    ) {
      blockingIssues.push({
        code: 'ARCHETYPE_INVALID',
        message: `L'archétype '${archetype}' est invalide. Valeurs autorisées: ${ALLOWED_ARCHETYPES.join(', ')}`,
        field: 'synthesis.archetype',
        severity: 'BLOCKING',
      });
    }

    // Compute Metrics
    const sectionWordCounts: Record<string, number> = {};
    let totalWords = 0;

    totalWords += countWords(introduction);
    totalWords += countWords(archetypeReveal);
    totalWords += countWords(lifeMission);
    totalWords += countWords(conclusion);
    for (const insight of karmicInsights) {
      totalWords += countWords(insight);
    }
    for (const rit of rituals) {
      totalWords += countWords(typeof rit.name === 'string' ? rit.name : '');
      totalWords += countWords(typeof rit.description === 'string' ? rit.description : '');
      if (Array.isArray(rit.instructions)) {
        for (const inst of rit.instructions) {
          if (typeof inst === 'string') totalWords += countWords(inst);
        }
      }
    }

    for (const sec of sections) {
      const dom = typeof sec.domain === 'string' ? sec.domain : 'unknown';
      const cWords = countWords(typeof sec.content === 'string' ? sec.content : '');
      sectionWordCounts[dom] = cWords;
      totalWords += cWords;
    }

    const metrics: QualityMetrics = {
      totalWords,
      sectionWordCounts,
      insightsCount: karmicInsights.length,
      ritualsCount: rituals.length,
      instructionsCount: totalInstructionsCount,
    };

    // EDITORIAL WARNINGS
    if (totalWords < 2200) {
      warnings.push({
        code: 'TOTAL_WORDS_TOO_LOW',
        message: `Le nombre total de mots (${totalWords}) est inférieur au seuil recommandé de 2 200 mots`,
        severity: 'WARNING',
      });
    } else if (totalWords > 3600) {
      warnings.push({
        code: 'TOTAL_WORDS_TOO_HIGH',
        message: `Le nombre total de mots (${totalWords}) dépasse le seuil recommandé de 3 600 mots`,
        severity: 'WARNING',
      });
    }

    for (const sec of sections) {
      const dom = typeof sec.domain === 'string' ? sec.domain : 'section';
      const secWords = countWords(typeof sec.content === 'string' ? sec.content : '');
      if (secWords < 150) {
        warnings.push({
          code: 'SECTION_WORDS_TOO_LOW',
          message: `La section '${dom}' est trop courte (${secWords} mots, minimum recommandé: 150)`,
          field: `sections.${dom}`,
          severity: 'WARNING',
        });
      }
    }

    const fullProseText = [
      introduction,
      archetypeReveal,
      lifeMission,
      conclusion,
      ...sections.map((s) => (typeof s.content === 'string' ? s.content : '')),
    ].join('\n\n');

    if (/(\*\*|##|###|```)/.test(fullProseText)) {
      warnings.push({
        code: 'MARKDOWN_FORMATTING_DETECTED',
        message: 'Des balises Markdown (**, ##, ```) ont été détectées dans le contenu',
        severity: 'WARNING',
      });
    }

    for (const sec of sections) {
      const title = typeof sec.title === 'string' ? sec.title.trim() : '';
      const contentStr = typeof sec.content === 'string' ? sec.content.trim() : '';
      if (title && contentStr) {
        const firstLine = contentStr
          .split('\n')[0]
          .replace(/^#+\s*/, '')
          .trim();
        if (firstLine.toLowerCase() === title.toLowerCase()) {
          warnings.push({
            code: 'TITLE_REPEATED_IN_CONTENT',
            message: `Le titre de la section '${title}' est recopié au début de son contenu`,
            field: `sections.${sec.domain || title}`,
            severity: 'WARNING',
          });
        }
      }
    }

    for (let i = 0; i < karmicInsights.length; i++) {
      if (karmicInsights[i].trim().length < 30) {
        warnings.push({
          code: 'INSIGHT_TOO_SHORT',
          message: `L'insight karmique ${i + 1} est trop court (< 30 caractères)`,
          field: `karmic_insights[${i}]`,
          severity: 'WARNING',
        });
      }
    }

    for (let i = 0; i < rituals.length; i++) {
      const rit = rituals[i];
      const name = typeof rit.name === 'string' ? rit.name.trim() : '';
      const desc = typeof rit.description === 'string' ? rit.description.trim() : '';
      if (name.length < 5 || desc.length < 20) {
        warnings.push({
          code: 'RITUAL_TOO_VAGUE',
          message: `Le rituel ${i + 1} ('${name}') est trop vague (nom < 5 caractères ou description < 20 caractères)`,
          field: `rituals[${i}]`,
          severity: 'WARNING',
        });
      }
    }

    const words = fullProseText
      .toLowerCase()
      .replace(/[^\w\sàâäéèêëîïôöùûüç]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !COMMON_FRENCH_STOPWORDS.has(w));

    if (words.length > 200) {
      const wordCounts: Record<string, number> = {};
      for (const w of words) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
      for (const [w, count] of Object.entries(wordCounts)) {
        if (count > 35 || count / words.length > 0.035) {
          warnings.push({
            code: 'EXCESSIVE_TERM_REPETITION',
            message: `Répétition excessive du terme '${w}' (${count} occurrences)`,
            severity: 'WARNING',
          });
        }
      }
    }

    const paragraphs = fullProseText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 50);

    const paraSet = new Set<string>();
    let hasDuplicateParagraph = false;
    for (const p of paragraphs) {
      const norm = p.toLowerCase().replace(/\s+/g, ' ');
      if (paraSet.has(norm)) {
        hasDuplicateParagraph = true;
        break;
      }
      paraSet.add(norm);
    }
    if (hasDuplicateParagraph) {
      warnings.push({
        code: 'DUPLICATE_PARAGRAPHS_DETECTED',
        message: 'Un paragraphe en double a été détecté dans le texte',
        severity: 'WARNING',
      });
    }

    const status = blockingIssues.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'WARNING' : 'PASS';

    return {
      status,
      blockingIssues,
      warnings,
      metrics,
    };
  }
}

export function assertReadingDeliverable(content: unknown): void {
  const validator = new ReadingQualityValidator();
  const report = validator.validate(content);

  if (report.status === 'BLOCKED') {
    const issueMessages = report.blockingIssues
      .map((issue) => `[${issue.code}] ${issue.message}`)
      .join(' ; ');
    throw new BadRequestException(
      `La lecture ne respecte pas le contrat canonique bloquant : ${issueMessages}`,
    );
  }
}
