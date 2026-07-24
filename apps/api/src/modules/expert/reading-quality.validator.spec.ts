import {
  ReadingQualityValidator,
  assertReadingDeliverable,
} from './reading-quality.validator';
import {
  CanonicalReadingContent,
  isCanonicalReadingContent,
} from './reading-version';
import { BadRequestException } from '@nestjs/common';

function createValidReading(): CanonicalReadingContent {
  const domainTexts: Record<string, string> = {
    spirituel:
      'L’éveil spirituel demande une écoute attentive des ressentis subtils et un ancrage quotidien dans le moment présent. ' +
      'Votre cheminement personnel vous invite à explorer la méditation, la contemplation et le lien avec la nature. ' +
      'En développant cette présence consciente, vous découvrez des ressources intérieures insoupçonnées et une paix durable. '.repeat(15),
    relations:
      'Sur le plan relationnel, la communication bienveillante et l’expression sincère de vos besoins renforcent vos liens. ' +
      'Vous apprenez à poser des limites claires tout en accueillant la sensibilité de vos proches avec compassion. ' +
      'Cette dynamique d’échange authentique permet de construire des partenariats épanouissants et équilibrés. '.repeat(15),
    mission:
      'Votre vocation s’articule autour de la transmission, de l’aide et de la création d’espaces d’expression inspirants. ' +
      'En alignant vos actions sur vos valeurs fondamentales, vous donnez un sens profond à votre engagement quotidien. ' +
      'Cette démarche vous guide vers l’accomplissement personnel et la contribution active à votre communauté. '.repeat(15),
    creativite:
      'L’énergie créative qui vous anime demande à s’exprimer sans jugement ni contrainte formelle excessive. ' +
      'Laissez libre cours à votre intuition artistique, que ce soit à travers l’écriture, le dessin ou l’innovation. ' +
      'Chaque projet entrepris devient alors un vecteur de régénération et de joie partagée avec votre entourage. '.repeat(15),
    emotions:
      'La gestion émotionnelle passe par la reconnaissance et l’accueil de chaque ressenti sans crispation. ' +
      'En cultivant la douceur envers vous-même, vous transformez les périodes d’incertitude en opportunités d’apprentissage. ' +
      'Cette clarté intérieure favorise la stabilité et un bien-être durable au quotidien. '.repeat(15),
    travail:
      'Votre sphère professionnelle s’épanouit lorsque vous combinez rigueur organisationnelle et vision stratégique. ' +
      'La coopération avec vos collaborateurs et la valorisation de vos compétences propres renforcent votre position. ' +
      'Vous avancez vers de nouveaux défis avec assurance et discernement méthodologique. '.repeat(15),
    sante:
      'L’équilibre corporel repose sur une hygiène de vie harmonieuse, un sommeil réparateur et une alimentation adaptée. ' +
      'Écoutez les signaux de votre corps et accordez-vous des pauses régulières pour recharger votre vitalité. ' +
      'L’exercice physique modéré et la relaxation contribuent à maintenir votre tonus général. '.repeat(15),
    finance:
      'La gestion de vos ressources matérielles gagne en sérénité grâce à une planification prudente et éclairée. ' +
      'En structurant vos budgets et vos investissements, vous posez des fondations solides pour l’avenir. ' +
      'Cette sécurité financière soutient vos projets à long terme avec confiance et clarté. '.repeat(15),
  };

  const sections = Object.entries(domainTexts).map(([domain, content]) => ({
    domain,
    title: `Grand axe : ${domain.charAt(0).toUpperCase() + domain.slice(1)}`,
    content,
  }));

  return {
    pdf_content: {
      introduction:
        'Bienvenue dans votre guidance personnelle approfondie et sur mesure. ' +
        'Ce travail propose un éclairage complet sur vos différentes sphères de vie et votre potentiel évolutif. ' +
        'Prenez le temps d’intégrer chaque enseignement avec calme et ouverture de conscience. '.repeat(10),
      archetype_reveal:
        'Votre archétype révélé est Le Guérisseur. ' +
        'Cet archétype symbolise la capacité de canaliser l’énergie, de pacifier les conflits et d’offrir une écoute régénératrice. ' +
        'Il vous invite à honorer votre sensibilité tout en posant des limites protectrices. '.repeat(10),
      sections,
      karmic_insights: [
        'La patience et la persévérance constituent vos meilleurs alliés de transformation.',
        'La sérénité intérieure permet d’éclairer les choix complexes avec discernement.',
        'La bienveillance manifestée envers vous-même renforce votre équilibre vital.',
        'La confiance en votre sagesse intuitive débloque de nouvelles perspectives d’action.',
      ],
      life_mission:
        'Votre mission de vie consiste à accompagner, transmettre et structurer des espaces d’apaisement. ' +
        'Elle se déploie à travers des gestes simples et des engagements sincères au quotidien. '.repeat(10),
      rituals: [
        {
          name: 'Rituel d’Ancrage du Matin',
          description: 'Pratique matinale destinée à harmoniser vos centres énergétiques et votre attention.',
          instructions: [
            'Installez-vous dans un endroit calme et fermez doucement les paupières.',
            'Effectuez cinq cycles de respiration abdominale lente et profonde.',
            'Visualisez des racines de lumière s’enfonçant solidairement dans la terre.',
            'Formulez votre intention claire pour la journée qui débute.',
          ],
        },
        {
          name: 'Rituel de Libération du Soir',
          description: 'Pratique vesperale pour décharger les tensions physiques et mentales de la journée.',
          instructions: [
            'Allumez une bougie naturelle dans un espace paisible.',
            'Consignez dans votre carnet les réussites et apprentissages du jour.',
            'Exprimez une gratitude sincère pour trois événements vécus.',
            'Éteignez la bougie et observez deux minutes de silence régénérateur.',
          ],
        },
      ],
      conclusion:
        'En conclusion, poursuivez votre cheminement avec confiance, clarté et persévérance. ' +
        'Chaque décision consciente contribue à votre épanouissement global et à l’harmonie de vos proches. '.repeat(10),
    },
    synthesis: {
      archetype: 'Le Guérisseur',
      keywords: ['Clarté', 'Ancrage', 'Sagesse', 'Harmonie', 'Transformation'],
      emotional_state: 'En quête d’équilibre et de sérénité',
      key_blockage: 'Peur de la transition',
    },
    timeline: [],
    lecture: 'Texte intégral de la guidance...',
  };
}

describe('ReadingQualityValidator & Canonical Contract', () => {
  let validator: ReadingQualityValidator;

  beforeEach(() => {
    validator = new ReadingQualityValidator();
  });

  it('1. valide une lecture complète et conforme (status PASS)', () => {
    const reading = createValidReading();
    const report = validator.validate(reading);
    expect(report.status).toBe('PASS');
    expect(report.blockingIssues).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
    expect(report.metrics.totalWords).toBeGreaterThan(2200);
    expect(report.metrics.insightsCount).toBe(4);
    expect(report.metrics.ritualsCount).toBe(2);
    expect(report.metrics.instructionsCount).toBe(8);

    expect(() => assertReadingDeliverable(reading)).not.toThrow();
  });

  it('2. bloque une lecture avec une section manquante', () => {
    const reading = createValidReading();
    reading.pdf_content.sections.pop(); // 7 sections au lieu de 8

    const report = validator.validate(reading);
    expect(report.status).toBe('BLOCKED');
    expect(report.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SECTIONS_COUNT_INVALID',
          severity: 'BLOCKING',
        }),
      ]),
    );

    expect(() => assertReadingDeliverable(reading)).toThrow(BadRequestException);
  });

  it('3. bloque une lecture avec un ordre des domaines incorrect', () => {
    const reading = createValidReading();
    // Permuter 'spirituel' et 'relations'
    const temp = reading.pdf_content.sections[0];
    reading.pdf_content.sections[0] = reading.pdf_content.sections[1];
    reading.pdf_content.sections[1] = temp;

    const report = validator.validate(reading);
    expect(report.status).toBe('BLOCKED');
    expect(report.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DOMAINS_ORDER_INVALID',
          severity: 'BLOCKING',
        }),
      ]),
    );
  });

  it('4. bloque une lecture avec un insight manquant', () => {
    const reading = createValidReading();
    reading.pdf_content.karmic_insights.pop(); // 3 insights au lieu de 4

    const report = validator.validate(reading);
    expect(report.status).toBe('BLOCKED');
    expect(report.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INSIGHTS_COUNT_INVALID',
          severity: 'BLOCKING',
        }),
      ]),
    );
  });

  it('5. bloque un rituel sans instructions (ou avec moins de 4 instructions)', () => {
    const reading = createValidReading();
    reading.pdf_content.rituals[0].instructions = [];

    const report = validator.validate(reading);
    expect(report.status).toBe('BLOCKED');
    expect(report.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RITUAL_INSTRUCTIONS_COUNT_INVALID',
          severity: 'BLOCKING',
        }),
      ]),
    );
  });

  it('6. prend en charge un ancien contenu partiel en lecture (isCanonicalReadingContent)', () => {
    const legacyReading = {
      pdf_content: {
        introduction: 'Intro ancienne',
        archetype_reveal: 'Révélation ancienne',
        sections: [
          { domain: 'spirituel', title: 'Titre', content: 'Contenu' },
        ],
        karmic_insights: ['Insight 1'],
        life_mission: 'Mission ancienne',
        rituals: [],
        conclusion: 'Conclusion ancienne',
      },
      synthesis: {
        archetype: 'Le Sage',
      },
      lecture: 'Texte ancien',
    };

    expect(isCanonicalReadingContent(legacyReading)).toBe(true);

    // Toutefois, la tentative de livraison/scellement via le nouveau validateur bloque
    const report = validator.validate(legacyReading);
    expect(report.status).toBe('BLOCKED');
  });

  it('7. émet un avertissement en cas de présence de Markdown', () => {
    const reading = createValidReading();
    reading.pdf_content.sections[0].content += ' **Texte en gras** et ## Titre de section';

    const report = validator.validate(reading);
    expect(report.status).toBe('WARNING');
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MARKDOWN_FORMATTING_DETECTED',
          severity: 'WARNING',
        }),
      ]),
    );
  });

  it('8. émet un avertissement en cas de contenu court (< 2 200 mots)', () => {
    const reading = createValidReading();
    for (const sec of reading.pdf_content.sections) {
      sec.content = 'Court contenu pour le domaine ' + sec.domain;
    }
    reading.pdf_content.introduction = 'Intro courte';
    reading.pdf_content.archetype_reveal = 'Révélation courte';
    reading.pdf_content.life_mission = 'Mission courte';
    reading.pdf_content.conclusion = 'Conclusion courte';

    const report = validator.validate(reading);
    expect(report.status).toBe('WARNING');
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TOTAL_WORDS_TOO_LOW',
          severity: 'WARNING',
        }),
      ]),
    );
  });

  it('9. bloque les domaines dupliqués dans les sections', () => {
    const reading = createValidReading();
    reading.pdf_content.sections[1].domain = 'spirituel'; // Deux sections 'spirituel'

    const report = validator.validate(reading);
    expect(report.status).toBe('BLOCKED');
    expect(report.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DOMAINS_NOT_UNIQUE',
          severity: 'BLOCKING',
        }),
      ]),
    );
  });
});
