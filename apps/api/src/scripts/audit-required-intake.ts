import { PrismaClient } from '@prisma/client';
import { evaluateReadingRequirements } from '../modules/users/reading-intake-policy';

type CounterKey =
  | 'scanned'
  | 'complete'
  | 'incomplete'
  | 'missingBirthDate'
  | 'missingBirthPlace'
  | 'missingIntention'
  | 'missingFacePhoto'
  | 'missingPalmPhoto'
  | 'invalidFields'
  | 'delivered'
  | 'activeJobs'
  | 'legacyOrders';

const counters: Record<CounterKey, number> = {
  scanned: 0,
  complete: 0,
  incomplete: 0,
  missingBirthDate: 0,
  missingBirthPlace: 0,
  missingIntention: 0,
  missingFacePhoto: 0,
  missingPalmPhoto: 0,
  invalidFields: 0,
  delivered: 0,
  activeJobs: 0,
  legacyOrders: 0,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function currentProductionActive(value: unknown): boolean {
  const review = asRecord(value);
  const production = asRecord(review.production);
  return production.status === 'QUEUED' || production.status === 'RUNNING';
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'],
        },
      },
      select: {
        status: true,
        intakeRequired: true,
        clientInputs: true,
        expertReview: true,
        readingIntake: {
          select: {
            status: true,
            data: true,
            contentHash: true,
            sealedAt: true,
          },
        },
        user: {
          select: {
            profile: true,
          },
        },
      },
    });

    for (const order of orders) {
      counters.scanned += 1;
      if (order.status === 'COMPLETED') counters.delivered += 1;
      if (currentProductionActive(order.expertReview)) counters.activeJobs += 1;
      if (!order.intakeRequired) counters.legacyOrders += 1;

      const clientInputs = asRecord(order.clientInputs);
      const effective = asRecord(clientInputs.readingIntakeEffective);
      const projected = asRecord(clientInputs.readingIntake);
      const profile =
        Object.keys(asRecord(effective.profile)).length > 0
          ? asRecord(effective.profile)
          : Object.keys(asRecord(projected.profile)).length > 0
            ? asRecord(projected.profile)
            : order.readingIntake?.status === 'SEALED'
              ? asRecord(order.readingIntake.data)
              : asRecord(order.user.profile);

      const result = evaluateReadingRequirements(profile, {
        requireExplicitIntentionMode: false,
        strictIntentionExclusivity: false,
      });
      if (result.complete) counters.complete += 1;
      else counters.incomplete += 1;
      if (result.missingFields.includes('birthDate')) counters.missingBirthDate += 1;
      if (result.missingFields.includes('birthPlace')) counters.missingBirthPlace += 1;
      if (result.missingFields.includes('intention')) counters.missingIntention += 1;
      if (result.missingFields.includes('facePhotoUrl')) counters.missingFacePhoto += 1;
      if (result.missingFields.includes('palmPhotoUrl')) counters.missingPalmPhoto += 1;
      if (result.invalidFields.length > 0) counters.invalidFields += 1;
    }

    process.stdout.write(`${JSON.stringify({ mode: 'READ_ONLY', counters }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown diagnostic error';
  process.stderr.write(`Required-intake audit failed: ${message}\n`);
  process.exitCode = 1;
});
