import { VertexOracle, UserProfile, OrderContext } from '../../services/factory/VertexOracle';
import { ProductLevel } from '@prisma/client';

describe('Reading Editor Pipeline (SCRIBE → validation → EDITOR → validation finale)', () => {
  let oracle: VertexOracle;

  const mockUserProfile: UserProfile = {
    userId: 'user-123',
    firstName: 'Amal',
    lastName: 'Ben',
    email: 'amal@example.com',
    birthDate: '22/02/1986',
  };

  const mockOrderContext: OrderContext = {
    orderId: 'order-123',
    orderNumber: 'LUM-100',
    level: ProductLevel.INITIE,
    productLevel: ProductLevel.INITIE,
    productName: 'Lumira Initié',
  };

  const sectionTextMap: Record<string, string> = {
    spirituel: (
      "Dans la dimension spirituelle, votre parcours d'âme s'illumine par une quête sincère de sagesse. " +
      "Les symboles perçus témoignent d'une intuition profonde qui cherche à se manifester dans la sérénité du quotidien. " +
      'Prenez le temps de méditer chaque jour pour écouter les messages subtils qui vous parviennent. ' +
      'Cette pratique régulière clarifiera vos doutes et fortifiera votre ancrage intérieur. '
    ).repeat(5),
    relations: (
      'Sur le plan relationnel, la sincérité et le respect mutuel occupent une place centrale dans vos échanges. ' +
      "Vous aspirez à des liens authentiques débarrassés des jeux de pouvoir ou d'illusion. " +
      "Cultiver une communication transparente permettra d'apaiser les malentendus du passé. " +
      "Offrez-vous la liberté d'exprimer vos sentiments les plus profonds sans crainte du jugement. "
    ).repeat(5),
    mission: (
      "Votre mission de vie réside dans la transmission d'une présence apaisante et clarifiante pour autrui. " +
      'En accordant vos actions à vos convictions éthiques, vous devenez un repère pour votre entourage. ' +
      "L'alignement personnel exige du courage mais apporte une satisfaction inégalée. " +
      'Suivez la voix de votre conscience pour orienter vos engagements futurs avec conviction. '
    ).repeat(5),
    creativite: (
      "L'élan créatif représente un canal privilégié pour extérioriser votre richesse émotionnelle. " +
      "Que vous écriviez, dessiniez ou conçouriez de nouveaux projets, votre imagination fait preuve d'une belle vitalité. " +
      "Accordez-vous des plages d'expérimentation sans contrainte d'évaluation externe. " +
      "La création pure régénère votre énergie vitale et apporte un sentiment d'accomplissement. "
    ).repeat(5),
    emotions: (
      'Le paysage émotionnel traversé ces derniers mois montre une maturité croissante et une sensibilité accueillie. ' +
      "Apprendre à observer vos états d'âme sans les juger favorise une paix durable. " +
      "La respiration consciente est un outil précieux lorsque l'intensité s'accroît. " +
      'En accueillant toutes vos facettes, vous gagnez une solidité remarquable. '
    ).repeat(5),
    travail: (
      'Dans la sphère professionnelle, la recherche de sens prévaut sur la simple exécution de tâches. ' +
      "Votre rigueur et votre capacité d'organisation suscitent l'estime de vos partenaires. " +
      'En osant faire valoir vos compétences uniques, vous ouvrirez la voie à des opportunités enrichissantes. ' +
      'Gardez le cap sur vos véritables ambitions à long terme. '
    ).repeat(5),
    sante: (
      'La santé et la vitalité globale nécessitent un équilibre harmonieux entre repos, alimentation et mouvement. ' +
      "Écouter les signaux du corps permet d'anticiper la fatigue avant qu'elle ne s'installe. " +
      'Des promenades régulières au grand air et des moments de déconnexion favorisent la régénération globale. ' +
      'Prenez soin de votre temple physique avec régularité. '
    ).repeat(5),
    finance: (
      'La dimension financière appelle une vision claire et une gestion mesurée de vos avoirs. ' +
      'En canalisant vos dépenses vers ce qui compte vraiment, vous consolidez votre sécurité matérielle. ' +
      "La confiance en votre capacité d'abondance attire des opportunités favorables. " +
      "Structurez vos projets d'investissement avec méthode pour assurer un avenir serein. "
    ).repeat(5),
  };

  const buildValidPdfContent = () => ({
    title: 'Lecture Spirituelle Lumira',
    subtitle: 'Révélation d’âme et conseils d’éveil',
    introduction:
      'Voici l’introduction complète et rigoureusement structurée de votre lecture symbolique Lumira. ' +
      'Ce document unique explore l’ensemble des facettes de votre incarnation et apporte des réponses concrètes à vos interrogations existentielles. ' +
      'Prenez le temps d’accueillir chaque section avec recueillement et bienveillance envers vous-même. '.repeat(
        5,
      ),
    sections: [
      {
        domain: 'spirituel',
        title: 'Éveil Spirituel et Connexion',
        content: sectionTextMap.spirituel,
      },
      {
        domain: 'relations',
        title: 'Harmonie Relationnelle et Affective',
        content: sectionTextMap.relations,
      },
      { domain: 'mission', title: 'Mission de Vie et Alignement', content: sectionTextMap.mission },
      {
        domain: 'creativite',
        title: 'Expression Créative et Élan',
        content: sectionTextMap.creativite,
      },
      {
        domain: 'emotions',
        title: 'Paysage Émotionnel et Intériorité',
        content: sectionTextMap.emotions,
      },
      {
        domain: 'travail',
        title: 'Alignement et Réalisation Professionnelle',
        content: sectionTextMap.travail,
      },
      {
        domain: 'sante',
        title: 'Vitalité Physionomique et Énergie',
        content: sectionTextMap.sante,
      },
      {
        domain: 'finance',
        title: 'Abondance Financière et Prospérité',
        content: sectionTextMap.finance,
      },
    ],
    archetype_reveal:
      'Le Guide est votre archétype d’âme fondamental. Il révèle votre potentiel de sagesse, d’orientation et de bienveillance active.',
    karmic_insights: [
      'Premier insight karmique révélant votre force naturelle de pardon et de réconciliation profonde.',
      'Deuxième insight karmique apportant la sérénité indispensable face aux défis imprévus de l’existence.',
      'Troisième insight karmique clarifiant la lignée transgénérationnelle et l’héritage émotionnel précieux.',
      'Quatrième insight karmique ouvrant la voie lumineuse vers une pleine autonomie décisionnelle.',
    ],
    life_mission:
      'Guider les autres avec bienveillance et clarté en incarnant l’équilibre, l’écoute et la vérité au quotidien.',
    rituals: [
      {
        name: 'Ancrage du Matin',
        description:
          'Rituel quotidien complet pour centrer et équilibrer l’énergie personnelle dès le réveil matinal.',
        instructions: [
          'Respirer profondément pendant 5 minutes en conscience calme',
          'Visualiser une lumière dorée parcourant tout le corps',
          'Répéter le mantra d’ancrage avec conviction et sérénité',
          'Prendre un grand verre d’eau fraîche en toute présence',
        ],
      },
      {
        name: 'Alignement du Soir',
        description:
          'Rituel apaisant du soir pour libérer les tensions et purifier le mental avant le sommeil réparateur.',
        instructions: [
          'Écrire trois gratitudes sincères de la journée écoulée',
          'Éteindre tous les écrans une heure entière avant de dormir',
          'Pratiquer dix minutes de cohérence cardiaque au calme',
          'Sceller la journée dans une pensée de bienveillance globale',
        ],
      },
    ],
    conclusion:
      'En conclusion, cette lecture symbolique éclaire votre cheminement d’âme avec précision et clarté. ' +
      'Avancez en toute confiance en mettant progressivement en pratique ces enseignements précieux et inspirants. '.repeat(
        5,
      ),
  });

  const buildValidSynthesis = () => ({
    archetype: 'Le Guide',
    keywords: ['Clarté', 'Ancrage', 'Éveil', 'Sagesse', 'Sérénité'],
    emotional_state: 'Équilibré et réceptif aux énergies',
    key_blockage: 'Peur irrationnelle du changement rapide',
  });

  beforeEach(() => {
    oracle = new VertexOracle(
      {
        get: (key: string, def?: any) => {
          if (key === 'OPENAI_API_KEY') return 'sk-test';
          return def;
        },
      } as any,
      {} as any,
      {
        resolve: jest.fn().mockResolvedValue({
          provider: 'openai',
          model: 'gpt-5.5-2026-04-23',
          promptVersionId: 'v1.0',
          routingSource: 'test',
        }),
      } as any,
      {} as any,
      { registerInvalidator: jest.fn() } as any,
    );

    jest.spyOn(oracle as any, 'ensureInitialized').mockResolvedValue(undefined);
    jest.spyOn(oracle as any, 'fetchImageAsBase64').mockResolvedValue({
      inlineData: { mimeType: 'image/jpeg', data: 'abc' },
    });
  });

  describe('1. SCRIBE valide sans EDITOR', () => {
    it('retourne qualityStatus PASS et n’invoque pas EDITOR quand SCRIBE est parfait', async () => {
      const scribeCallSpy = jest.spyOn(oracle as any, 'callJson').mockResolvedValueOnce({
        pdf_content: buildValidPdfContent(),
        synthesis: buildValidSynthesis(),
      });

      const result = await oracle.generateCoreReadingWithPipeline(
        mockUserProfile,
        mockOrderContext,
      );

      expect(result.pipeline.qualityStatus).toBe('PASS');
      expect(result.pipeline.editorCompletedAt).toBeNull();
      expect(result.pipeline.blockingIssues).toHaveLength(0);
      expect(result.pipeline.warnings).toHaveLength(0);
      expect(scribeCallSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. SCRIBE avec Markdown (détection et correction par EDITOR)', () => {
    it('déclenche EDITOR pour nettoyer le Markdown résiduel', async () => {
      const markdownPdfContent = buildValidPdfContent();
      markdownPdfContent.sections[0].content += ' Voici du texte avec **gras** et ## titres.';

      const cleanPdfContent = buildValidPdfContent();

      const scribeCallSpy = jest
        .spyOn(oracle as any, 'callJson')
        .mockResolvedValueOnce({
          pdf_content: markdownPdfContent,
          synthesis: buildValidSynthesis(),
        })
        .mockResolvedValueOnce({
          pdf_content: cleanPdfContent,
          synthesis: buildValidSynthesis(),
        });

      const result = await oracle.generateCoreReadingWithPipeline(
        mockUserProfile,
        mockOrderContext,
      );

      expect(scribeCallSpy).toHaveBeenCalledTimes(2); // SCRIBE + EDITOR
      expect(result.pipeline.editorCompletedAt).not.toBeNull();
      expect(result.pipeline.qualityStatus).toBe('PASS');
    });
  });

  describe('3. Rituel incomplet', () => {
    it('déclenche EDITOR lorsque des instructions de rituel sont manquantes', async () => {
      const incompletePdfContent = buildValidPdfContent();
      incompletePdfContent.rituals[0].instructions = []; // Instructions vides -> BLOCKED

      const repairedPdfContent = buildValidPdfContent();

      const scribeCallSpy = jest
        .spyOn(oracle as any, 'callJson')
        .mockResolvedValueOnce({
          pdf_content: incompletePdfContent,
          synthesis: buildValidSynthesis(),
        })
        .mockResolvedValueOnce({
          pdf_content: repairedPdfContent,
          synthesis: buildValidSynthesis(),
        });

      const result = await oracle.generateCoreReadingWithPipeline(
        mockUserProfile,
        mockOrderContext,
      );

      expect(scribeCallSpy).toHaveBeenCalledTimes(2);
      expect(result.pipeline.qualityStatus).toBe('PASS');
      expect(result.pdf_content.rituals[0].instructions.length).toBeGreaterThan(0);
    });
  });

  describe('4. Section manquante', () => {
    it('détecte la section manquante et tente la réparation par EDITOR', async () => {
      const missingSectionPdfContent = buildValidPdfContent();
      missingSectionPdfContent.sections = missingSectionPdfContent.sections.slice(0, 7); // 7 sections -> BLOCKED

      const fullPdfContent = buildValidPdfContent();

      const scribeCallSpy = jest
        .spyOn(oracle as any, 'callJson')
        .mockResolvedValueOnce({
          pdf_content: missingSectionPdfContent,
          synthesis: buildValidSynthesis(),
        })
        .mockResolvedValueOnce({
          pdf_content: fullPdfContent,
          synthesis: buildValidSynthesis(),
        });

      const result = await oracle.generateCoreReadingWithPipeline(
        mockUserProfile,
        mockOrderContext,
      );

      expect(scribeCallSpy).toHaveBeenCalledTimes(2);
      expect(result.pipeline.qualityStatus).toBe('PASS');
      expect(result.pdf_content.sections).toHaveLength(8);
    });
  });

  describe('5 & 6. Réponse EDITOR invalide et réparation ciblée', () => {
    it('exécute 1 tentative de réparation ciblée si le premier JSON de l’EDITOR est invalide', async () => {
      const markdownPdfContent = buildValidPdfContent();
      markdownPdfContent.sections[0].content += ' **Markdown**';

      const cleanPdfContent = buildValidPdfContent();

      const scribeCallSpy = jest
        .spyOn(oracle as any, 'callJson')
        // 1. SCRIBE
        .mockResolvedValueOnce({
          pdf_content: markdownPdfContent,
          synthesis: buildValidSynthesis(),
        })
        // 2. EDITOR pass 1 fails with JSON parse error
        .mockRejectedValueOnce(new Error('SyntaxError: Unexpected token in JSON'))
        // 3. Targeted JSON repair pass succeeds
        .mockResolvedValueOnce({
          pdf_content: cleanPdfContent,
          synthesis: buildValidSynthesis(),
        });

      const result = await oracle.generateCoreReadingWithPipeline(
        mockUserProfile,
        mockOrderContext,
      );

      expect(scribeCallSpy).toHaveBeenCalledTimes(3); // SCRIBE + EDITOR + Repair
      expect(result.pipeline.qualityStatus).toBe('PASS');
    });
  });

  describe('7 & 8. Résultat toujours bloqué et absence de boucle infinie', () => {
    it('s’arrête après 1 passe EDITOR et conserve le statut BLOCKED sans boucler', async () => {
      const invalidPdfContent = buildValidPdfContent();
      invalidPdfContent.sections = invalidPdfContent.sections.slice(0, 5); // 5 sections -> BLOCKED

      const scribeCallSpy = jest
        .spyOn(oracle as any, 'callJson')
        // 1. SCRIBE (BLOCKED)
        .mockResolvedValueOnce({
          pdf_content: invalidPdfContent,
          synthesis: buildValidSynthesis(),
        })
        // 2. EDITOR returns still invalid content (5 sections)
        .mockResolvedValueOnce({
          pdf_content: invalidPdfContent,
          synthesis: buildValidSynthesis(),
        });

      const result = await oracle.generateCoreReadingWithPipeline(
        mockUserProfile,
        mockOrderContext,
      );

      expect(scribeCallSpy).toHaveBeenCalledTimes(2); // SCRIBE + EDITOR (exactement 1 passe EDITOR)
      expect(result.pipeline.qualityStatus).toBe('BLOCKED');
      expect(result.pipeline.blockingIssues.length).toBeGreaterThan(0);
      expect(result.pipeline.blockingIssues[0].code).toBe('SECTIONS_COUNT_INVALID');
    });
  });

  describe('9. Traçabilité des modèles', () => {
    it('enregistre la provenance des modèles et versions de prompt dans le pipeline', async () => {
      const markdownPdfContent = buildValidPdfContent();
      markdownPdfContent.sections[0].content += ' **Markdown**';

      const cleanPdfContent = buildValidPdfContent();

      jest
        .spyOn(oracle as any, 'callJson')
        .mockResolvedValueOnce({
          pdf_content: markdownPdfContent,
          synthesis: buildValidSynthesis(),
        })
        .mockResolvedValueOnce({
          pdf_content: cleanPdfContent,
          synthesis: buildValidSynthesis(),
        });

      const result = await oracle.generateCoreReadingWithPipeline(
        mockUserProfile,
        mockOrderContext,
      );

      expect(result.pipeline.promptVersions).toEqual({
        SCRIBE: 'v1.0',
        EDITOR: 'v1.0',
      });
      expect(result.pipeline.models).toEqual({
        SCRIBE: 'openai:gpt-5.5-2026-04-23',
        EDITOR: 'openai:gpt-5.5-2026-04-23',
      });
    });
  });
});
