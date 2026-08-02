import { Prisma, PrismaClient } from '@packages/database';

interface EffectiveSnapshotRow {
  id: string;
}

/**
 * Compatibility bridge for the historical DigitalSoulService source loader.
 *
 * That loader reconstructs clientInputs from the relational ReadingIntake when
 * it is sealed. For a post-delivery revision this would discard the approved
 * readingIntakeEffective projection and make SCRIBE read V1 again. The bridge
 * only targets the exact generation query shape and leaves every other Order
 * read untouched.
 *
 * It also attaches the exact effective snapshot to the ReadingVersion candidate
 * at insert time. Content is not modified, so its existing contentHash remains
 * byte-for-byte valid.
 */
export function installReadingInputSnapshotMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    if (isDigitalSoulGenerationLoad(params)) {
      const result = await next(params);
      return exposeEffectiveProjection(result);
    }

    if (isReadingVersionCandidateCreate(params)) {
      const data = asRecord(params.args?.data);
      const orderId = nonEmptyString(data.orderId);
      if (orderId && !nonEmptyString(data.inputSnapshotId)) {
        const rows = await prisma.$queryRaw<EffectiveSnapshotRow[]>(Prisma.sql`
          SELECT snapshot."id"
          FROM "Order" AS order_row
          JOIN "ReadingInputSnapshot" AS snapshot
            ON snapshot."id" = NULLIF(
              order_row."clientInputs"->'readingIntakeEffective'->>'snapshotId',
              ''
            )
           AND snapshot."orderId" = order_row."id"
          WHERE order_row."id" = ${orderId}
          LIMIT 1
        `);
        const snapshotId = rows[0]?.id;
        if (snapshotId) {
          params.args = {
            ...params.args,
            data: {
              ...data,
              inputSnapshotId: snapshotId,
            },
          };
        }
      }
    }

    return next(params);
  });
}

function isDigitalSoulGenerationLoad(params: Prisma.MiddlewareParams): boolean {
  if (params.model !== 'Order' || params.action !== 'findUnique') return false;
  const include = asRecord(params.args?.include);
  const user = asRecord(include.user);
  const userInclude = asRecord(user.include);
  return (
    include.readingIntake === true &&
    include.files === true &&
    userInclude.profile === true
  );
}

function exposeEffectiveProjection(result: unknown): unknown {
  const order = asRecord(result);
  const clientInputs = asRecord(order.clientInputs);
  const effective = asRecord(clientInputs.readingIntakeEffective);
  const readingIntake = asRecord(order.readingIntake);
  if (
    !nonEmptyString(effective.snapshotId) ||
    !nonEmptyString(effective.contentHash) ||
    !nonEmptyString(readingIntake.sealedAt)
  ) {
    return result;
  }

  // DigitalSoulService will now keep the original clientInputs object and the
  // ReadingSourceResolver can select EFFECTIVE_SNAPSHOT before SEALED_INTAKE.
  return {
    ...order,
    readingIntake: {
      ...readingIntake,
      sealedAt: null,
    },
  };
}

function isReadingVersionCandidateCreate(params: Prisma.MiddlewareParams): boolean {
  if (params.model !== 'ReadingVersion' || params.action !== 'create') return false;
  const data = asRecord(params.args?.data);
  const content = asRecord(data.content);
  const source = asRecord(content._readingSource);
  return source.source === 'EFFECTIVE_SNAPSHOT';
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
