import { PrismaClient, ProductLevel, ExpertRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;
const CANONICAL_ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase()
  || 'expert@oraclelumira.com';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Refusing to seed a production credential with a default password.`);
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
      name: 'Accès Lumira',
      description: 'Offre unique de lancement',
      amountCents: 900,
      features: [
        'Lecture personnalisée validée par un expert',
        'Audio et PDF privés',
        'Accès au Sanctuaire',
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

async function main(): Promise<void> {
  console.log('🌟 Oracle Lumira V2 — safe database seed');
  await seedAdmin();
  await seedProducts();
  await seedOptionalTestClient();
}

main()
  .catch((error) => {
    console.error('❌ Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
