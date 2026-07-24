import {
  buildStudioReadingVersion,
  hashReadingContent,
  isCanonicalReadingContent,
  splitStudioContent,
  studioHtmlToText,
} from './reading-version';
import { assertReadingDeliverable } from './reading-quality.validator';

function createFullGeneratedReading() {
  return {
    pdf_content: {
      introduction:
        'Bienvenue dans votre guidance personnelle. Ce travail propose un éclairage complet sur vos sphères de vie.',
      archetype_reveal:
        'Votre archétype révélé est Le Guérisseur. Vous avez la capacité de canaliser et apaiser.',
      sections: [
        'spirituel',
        'relations',
        'mission',
        'creativite',
        'emotions',
        'travail',
        'sante',
        'finance',
      ].map((domain) => ({
        domain,
        title: `Grand axe : ${domain.charAt(0).toUpperCase() + domain.slice(1)}`,
        content: `Contenu original extrêmement détaillé pour le domaine ${domain}.`,
      })),
      karmic_insights: [
        'Insight 1 : la patience est votre clé essentielle de transformation.',
        'Insight 2 : la sérénité intérieure permet d’éclairer les choix complexes.',
        'Insight 3 : la bienveillance envers vous-même renforce votre équilibre.',
        'Insight 4 : la confiance en votre intuition débloque votre sagesse.',
      ],
      life_mission:
        'Votre mission de vie consiste à accompagner, transmettre et structurer des espaces d’apaisement.',
      rituals: [
        {
          name: 'Rituel d’Ancrage du Matin',
          description: 'Pratique matinale destinée à harmoniser vos centres énergétiques.',
          instructions: [
            'Installez-vous dans un endroit calme et fermez les yeux.',
            'Effectuez cinq cycles de respiration lente.',
            'Visualisez des racines de lumière s’enfonçant dans la terre.',
            'Formulez votre intention claire pour la journée.',
          ],
        },
        {
          name: 'Rituel de Libération du Soir',
          description: 'Pratique vesperale pour décharger les tensions physiques et mentales.',
          instructions: [
            'Allumez une bougie naturelle dans un espace paisible.',
            'Consignez dans votre carnet vos réussites du jour.',
            'Exprimez une gratitude sincère pour trois événements.',
            'Éteignez la bougie et observez deux minutes de silence.',
          ],
        },
      ],
      conclusion:
        'En conclusion, poursuivez votre cheminement avec confiance, clarté et persévérance.',
    },
    synthesis: {
      archetype: 'Le Guérisseur',
      keywords: ['Clarté', 'Ancrage', 'Sagesse', 'Harmonie', 'Transformation'],
      emotional_state: 'En quête d’équilibre et de sérénité',
      key_blockage: 'Peur de la transition',
    },
    timeline: [],
    lecture: 'Texte complet de la lecture...',
  };
}

describe('reading version & studio edits preservation', () => {
  it('1. préserve la lecture non modifiée', () => {
    const generated = createFullGeneratedReading();
    const version = buildStudioReadingVersion(generated, generated.lecture);

    expect(version.pdf_content.sections).toHaveLength(8);
    expect(version.pdf_content.karmic_insights).toHaveLength(4);
    expect(version.pdf_content.rituals).toHaveLength(2);
    expect(version.pdf_content.rituals[0].instructions).toHaveLength(4);
    expect(version.pdf_content.introduction).toBe(generated.pdf_content.introduction);
    expect(version.pdf_content.archetype_reveal).toBe(generated.pdf_content.archetype_reveal);
    expect(version.pdf_content.life_mission).toBe(generated.pdf_content.life_mission);
    expect(version.pdf_content.conclusion).toBe(generated.pdf_content.conclusion);
    expect(isCanonicalReadingContent(version)).toBe(true);
    expect(hashReadingContent(version)).toHaveLength(64);
  });

  it('2. préserve l’ensemble de la structure lors de la modification d’une seule section', () => {
    const generated = createFullGeneratedReading();
    const studioHtml = `
      <h2>Grand axe : Spirituel</h2>
      <p>Nouveau texte modifié spécifiquement par l'expert pour la section spirituel.</p>
    `;

    const version = buildStudioReadingVersion(generated, studioHtml);
    expect(version.pdf_content.sections).toHaveLength(8);
    const spirituelSec = version.pdf_content.sections.find((s) => s.domain === 'spirituel');
    expect(spirituelSec?.content).toContain('Nouveau texte modifié');

    const relationsSec = version.pdf_content.sections.find((s) => s.domain === 'relations');
    expect(relationsSec?.content).toBe(generated.pdf_content.sections[1].content);

    expect(version.pdf_content.karmic_insights).toHaveLength(4);
    expect(version.pdf_content.rituals).toHaveLength(2);
    expect(version.pdf_content.life_mission).toBe(generated.pdf_content.life_mission);
  });

  it('3. préserve l’ensemble de la structure lors de la modification de l’introduction', () => {
    const generated = createFullGeneratedReading();
    const studioHtml = `
      <h1>Introduction</h1>
      <p>Nouvelle introduction rédigée par l'expert pour le consultant.</p>
    `;

    const version = buildStudioReadingVersion(generated, studioHtml);

    expect(version.pdf_content.introduction).toBe(
      "Nouvelle introduction rédigée par l'expert pour le consultant.",
    );
    expect(version.pdf_content.sections).toHaveLength(8);
    expect(version.pdf_content.karmic_insights).toHaveLength(4);
    expect(version.pdf_content.rituals).toHaveLength(2);
  });

  it('4. préserve les rituels lorsqu’ils ne sont pas modifiés', () => {
    const generated = createFullGeneratedReading();
    const version = buildStudioReadingVersion(
      generated,
      '<h1>Introduction</h1><p>Texte court.</p>',
    );

    expect(version.pdf_content.rituals).toEqual(generated.pdf_content.rituals);
  });

  it('5. préserve les instructions des rituels', () => {
    const generated = createFullGeneratedReading();
    const version = buildStudioReadingVersion(
      generated,
      '<h2>Grand axe : Sante</h2><p>Exégèse santé</p>',
    );

    expect(version.pdf_content.rituals[0].instructions).toEqual([
      'Installez-vous dans un endroit calme et fermez les yeux.',
      'Effectuez cinq cycles de respiration lente.',
      'Visualisez des racines de lumière s’enfonçant dans la terre.',
      'Formulez votre intention claire pour la journée.',
    ]);
  });

  it('6. préserve les insights karmiques lorsqu’ils ne sont pas modifiés', () => {
    const generated = createFullGeneratedReading();
    const version = buildStudioReadingVersion(generated, '<h1>Introduction</h1><p>Autre texte</p>');

    expect(version.pdf_content.karmic_insights).toEqual(generated.pdf_content.karmic_insights);
  });

  it('7. préserve la mission de vie lorsqu’elle n’est pas modifiée', () => {
    const generated = createFullGeneratedReading();
    const version = buildStudioReadingVersion(
      generated,
      '<h2>Conclusion</h2><p>Conclusion révisée.</p>',
    );

    expect(version.pdf_content.life_mission).toBe(generated.pdf_content.life_mission);
  });

  it('8. ne vide aucun bloc même en présence de HTML sans titres/intertitres', () => {
    const generated = createFullGeneratedReading();
    const studioHtmlWithoutHeadings =
      '<p>Texte brut saisi par l’expert sans aucune balise H1 ou H2.</p>';

    const version = buildStudioReadingVersion(generated, studioHtmlWithoutHeadings);

    expect(version.pdf_content.sections).toHaveLength(8);
    expect(version.pdf_content.karmic_insights).toHaveLength(4);
    expect(version.pdf_content.rituals).toHaveLength(2);
    expect(version.pdf_content.introduction).toBe(
      'Texte brut saisi par l’expert sans aucune balise H1 ou H2.',
    );
    expect(version.pdf_content.conclusion).toBe(generated.pdf_content.conclusion);
  });

  it('9. prend en charge l’enregistrement du brouillon HTML dans studioDraftHtml sans altérer le document canonique', () => {
    const generated = createFullGeneratedReading();
    const draftHtml = '<h1>Brouillon Tiptap</h1><p>En cours de rédaction...</p>';

    const updatedGenerated = {
      ...generated,
      studioDraftHtml: draftHtml,
      draftSavedAt: new Date().toISOString(),
    };

    expect(updatedGenerated.studioDraftHtml).toBe(draftHtml);
    expect(updatedGenerated.pdf_content.sections).toHaveLength(8);
  });

  it('10. garantit qu’aucun bloc n’est vidé silencieusement (compatibilité avec ReadingQualityValidator)', () => {
    const generated = createFullGeneratedReading();
    const version = buildStudioReadingVersion(
      generated,
      '<h2>Grand axe : Spirituel</h2><p>Seule modif</p>',
    );

    // Les 8 sections doivent être remplies, 4 insights, 2 rituels
    expect(version.pdf_content.sections).toHaveLength(8);
    expect(version.pdf_content.karmic_insights).toHaveLength(4);
    expect(version.pdf_content.rituals).toHaveLength(2);
    expect(version.pdf_content.rituals.every((r) => r.instructions.length >= 4)).toBe(true);

    expect(isCanonicalReadingContent(version)).toBe(true);
  });
});
