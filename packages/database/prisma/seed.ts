import { PrismaClient, ProductLevel, ExpertRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;
const CANONICAL_ADMIN_EMAIL =
  process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() || 'expert@oraclelumira.com';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Refusing to seed a production credential with a default password.`,
    );
  }
  return value;
}

async function seedAdmin(): Promise<void> {
  const password = requiredEnv('ADMIN_BOOTSTRAP_PASSWORD');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const admin = await prisma.expert.upsert({
    where: { email: CANONICAL_ADMIN_EMAIL },
    update: {
      password: passwordHash,
      name: process.env.ADMIN_BOOTSTRAP_NAME?.trim() || 'Grégory Tordjman',
      role: ExpertRole.ADMIN,
      isActive: true,
    },
    create: {
      email: CANONICAL_ADMIN_EMAIL,
      password: passwordHash,
      name: process.env.ADMIN_BOOTSTRAP_NAME?.trim() || 'Grégory Tordjman',
      role: ExpertRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.expert.updateMany({
    where: {
      email: { not: CANONICAL_ADMIN_EMAIL },
      role: ExpertRole.ADMIN,
    },
    data: { isActive: false },
  });

  console.log(`✅ Canonical Desk admin: ${admin.email}`);
}

async function seedProducts(): Promise<void> {
  const products = [
    {
      id: 'initie',
      level: ProductLevel.INITIE,
      name: 'Cercle des Initiés',
      description: 'Offre early — accès Sanctuaire 3 mois',
      amountCents: 1700,
      features: [
        'Dossier client sécurisé',
        'Lecture personnalisée révisée par un expert',
        'PDF et audio privés',
        'Accès Sanctuaire 3 mois (early)',
      ],
      isActive: true,
    },
    {
      id: 'mystique',
      level: ProductLevel.MYSTIQUE,
      name: 'Mystique',
      description: 'Offre archivée',
      amountCents: 4700,
      features: [],
      isActive: false,
    },
    {
      id: 'profond',
      level: ProductLevel.PROFOND,
      name: 'Profond',
      description: 'Offre archivée',
      amountCents: 6700,
      features: [],
      isActive: false,
    },
    {
      id: 'integrale',
      level: ProductLevel.INTEGRALE,
      name: 'Intégrale',
      description: 'Offre archivée',
      amountCents: 9700,
      features: [],
      isActive: false,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        description: product.description,
        amountCents: product.amountCents,
        features: product.features,
        isActive: product.isActive,
      },
      create: product,
    });
  }

  console.log('✅ Product catalogue aligned with the single active offer');
}

async function seedOptionalTestClient(): Promise<void> {
  if (process.env.SEED_TEST_DATA !== 'true') return;

  const password = requiredEnv('TEST_CLIENT_PASSWORD');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.upsert({
    where: { email: 'client@test.com' },
    update: {
      firstName: 'Test',
      lastName: 'Client',
      phone: '+33612345678',
      dateOfBirth: new Date('1990-05-15'),
    },
    create: {
      email: 'client@test.com',
      firstName: 'Test',
      lastName: 'Client',
      phone: '+33612345678',
      dateOfBirth: new Date('1990-05-15'),
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      birthDate: '1990-05-15',
      birthTime: '14:30',
      birthPlace: 'Paris',
      profileCompleted: true,
      submittedAt: new Date(),
    },
    create: {
      userId: user.id,
      birthDate: '1990-05-15',
      birthTime: '14:30',
      birthPlace: 'Paris',
      profileCompleted: true,
      submittedAt: new Date(),
    },
  });

  // The user model currently authenticates through application flows; the hash is deliberately
  // computed only to ensure TEST_CLIENT_PASSWORD is explicit when test data is requested.
  void passwordHash;
  console.log('✅ Optional test client seeded');
}

async function seedEditorialTaxonomy(): Promise<void> {
  const categories = [
    {
      name: 'Relations & amour',
      slug: 'relations-amour',
      description:
        'Lectures et accompagnements axés sur les relations sentimentales, de couple et les liens d’âme.',
      seoTitle: 'Relations & Amour — Guide Lumira',
      seoDescription:
        'Découvrez des articles et conseils spirituels sur les relations amoureuses et la vie affective.',
      sortOrder: 1,
    },
    {
      name: 'Connaissance de soi',
      slug: 'connaissance-de-soi',
      description:
        'Introspection, personnalité profonde, alignement personnel et symbolique de soi.',
      seoTitle: 'Connaissance de soi — Explorer son univers intérieur',
      seoDescription:
        'Articles d’accompagnement pour mieux se comprendre, accepter son chemin et éveiller sa conscience.',
      sortOrder: 2,
    },
    {
      name: 'Décisions & choix',
      slug: 'decisions-choix',
      description: 'Clarté dans les moments d’hésitation, arbitrages de vie et prise de hauteur.',
      seoTitle: 'Décisions & Choix de vie — Éclairages spirituels',
      seoDescription:
        'Retrouvez des repères intérieurs pour choisir votre voie avec sérénité et justesse.',
      sortOrder: 3,
    },
    {
      name: 'Émotions & blocages',
      slug: 'emotions-blocages',
      description:
        'Compréhension des peurs, blocages émotionnels, schémas répétitifs et libération.',
      seoTitle: 'Émotions & Blocages — Comprendre et libérer',
      seoDescription:
        'Décryptez vos schémas émotionnels et découvrez des pistes pour dépasser vos blocages.',
      sortOrder: 4,
    },
    {
      name: 'Intuition & perception',
      slug: 'intuition-perception',
      description:
        'Écoute des ressentis, synchronicités, développement de l’intuition et sensibilité.',
      seoTitle: 'Intuition & Perception — Éveiller sa sensibilité',
      seoDescription:
        'Conseils pour affiner son intuition, interpréter les signes et écouter sa voix intérieure.',
      sortOrder: 5,
    },
    {
      name: 'Cycles & transitions de vie',
      slug: 'cycles-transitions-de-vie',
      description: 'Changements de cap, grands tournants, nouveaux départs et étapes initiatiques.',
      seoTitle: 'Cycles & Transitions — Naviguer les changements',
      seoDescription: 'Accompagnement dans les périodes de transition, renouveau et cycles de vie.',
      sortOrder: 6,
    },
    {
      name: 'Travail & accomplissement',
      slug: 'travail-accomplissement',
      description: 'Vocation, évolution professionnelle, création, mission de vie et réalisation.',
      seoTitle: 'Travail & Vocation — Trouver son accomplissement',
      seoDescription:
        'Réflexions et guidances pour aligner sa vie professionnelle avec sa trajectoire personnelle.',
      sortOrder: 7,
    },
    {
      name: 'Famille & héritages',
      slug: 'famille-heritages',
      description:
        'Dynamiques familiales, ancêtres, poids des transmissions et nœuds transgénérationnels.',
      seoTitle: 'Famille & Héritages — Comprendre son histoire',
      seoDescription:
        'Éclairages sur les schémas familiaux et la libération des mémoires héritées.',
      sortOrder: 8,
    },
    {
      name: 'Équilibre intérieur',
      slug: 'equilibre-interieur',
      description: 'Ancrage, sérénité au quotidien, hygiène de vie énergétique et harmonie.',
      seoTitle: 'Équilibre intérieur — Cultiver la sérénité',
      seoDescription:
        'Pratiques et lectures pour retrouver son centre, réguler son énergie et s’ancrer.',
      sortOrder: 9,
    },
    {
      name: 'Oracle Lumira & lecture',
      slug: 'oracle-lumira-lecture',
      description:
        'Guide des lectures Lumira, méthode, éthique et utilisation de votre espace Sanctuaire.',
      seoTitle: 'Oracle Lumira — Comprendre vos lectures',
      seoDescription:
        'Tout savoir sur les lectures intuitives Lumira et l’utilisation de votre dossier Sanctuaire.',
      sortOrder: 10,
    },
  ];

  for (const category of categories) {
    await prisma.editorialCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
        sortOrder: category.sortOrder,
        isActive: true,
      },
    });
  }

  console.log(`✅ Seeded ${categories.length} editorial categories`);

  const initialTags = [
    {
      name: "Peur de l'abandon",
      slug: 'peur-de-labandon',
      family: 'Émotions & blocages',
      aliases: ['peur abandon', 'abandonnique', 'crainte abandon'],
    },
    {
      name: 'Dépendance affective',
      slug: 'dependance-affective',
      family: 'Relations & amour',
      aliases: ['dependance affective', 'attachement anxieux'],
    },
    {
      name: 'Mission de vie',
      slug: 'mission-de-vie',
      family: 'Travail & accomplissement',
      aliases: ['mission de vie', 'vocation spirituelle'],
    },
    {
      name: 'Lâcher-prise',
      slug: 'lacher-prise',
      family: 'Équilibre intérieur',
      aliases: ['lacher prise', 'lacher-prise mental'],
    },
    {
      name: 'Synchronicités',
      slug: 'synchronicites',
      family: 'Intuition & perception',
      aliases: ['synchronicites', 'signes du destin'],
    },
  ];

  for (const tagData of initialTags) {
    const tag = await prisma.editorialTag.upsert({
      where: { slug: tagData.slug },
      update: {
        name: tagData.name,
        family: tagData.family,
        isActive: true,
      },
      create: {
        name: tagData.name,
        slug: tagData.slug,
        family: tagData.family,
        isActive: true,
      },
    });

    for (const aliasStr of tagData.aliases) {
      await prisma.editorialTagAlias.upsert({
        where: { alias: aliasStr },
        update: { tagId: tag.id },
        create: {
          alias: aliasStr,
          tagId: tag.id,
        },
      });
    }
  }

  console.log(`✅ Seeded ${initialTags.length} baseline editorial tags & aliases`);
}

async function main(): Promise<void> {
  console.log('🌟 Oracle Lumira V2 — safe database seed');
  await seedAdmin();
  await seedProducts();
  await seedOptionalTestClient();
  await seedEditorialTaxonomy();
}

main()
  .catch((error) => {
    console.error('❌ Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
