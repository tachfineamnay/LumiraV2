import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONFIRMATION = 'RESET_LUMIRA_CLIENT_DATA';

async function main() {
  if (process.env.CONFIRM_RESET !== CONFIRMATION) {
    throw new Error(
      `Reset refusé. Relance avec CONFIRM_RESET=${CONFIRMATION} pour confirmer explicitement la suppression des données clients.`,
    );
  }

  const before = {
    users: await prisma.user.count(),
    orders: await prisma.order.count(),
    profiles: await prisma.userProfile.count(),
    onboarding: await prisma.onboardingProgress.count(),
    deliveries: await prisma.deliveryRecord.count(),
  };

  console.log('[Lumira reset] Données avant nettoyage:', before);

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "DeliveryRecord",
      "ReadingVersion",
      "OrderFile",
      "Dream",
      "PathStep",
      "SpiritualPath",
      "ChatSession",
      "Insight",
      "AkashicRecord",
      "Notification",
      "ConsentRecord",
      "OnboardingProgress",
      "SanctuaireLoginToken",
      "Subscription",
      "Order",
      "ProductOrder",
      "UserProfile",
      "User",
      "ProcessedEvent",
      "SequenceCounter"
    RESTART IDENTITY CASCADE;
  `);

  const after = {
    users: await prisma.user.count(),
    orders: await prisma.order.count(),
    profiles: await prisma.userProfile.count(),
    onboarding: await prisma.onboardingProgress.count(),
    deliveries: await prisma.deliveryRecord.count(),
  };

  console.log('[Lumira reset] Nettoyage terminé:', after);
  console.log(
    '[Lumira reset] Conservés: migrations Prisma, experts, produits, réglages système, versions de prompts et matrice IA.',
  );
}

main()
  .catch((error) => {
    console.error('[Lumira reset] Échec:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
