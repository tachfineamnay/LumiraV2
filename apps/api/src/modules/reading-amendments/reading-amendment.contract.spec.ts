import { readFileSync } from 'fs';
import { join } from 'path';

describe('Reading amendment production contracts', () => {
  const service = readFileSync(join(__dirname, './reading-amendment.service.ts'), 'utf8');
  const facade = readFileSync(join(__dirname, './reading-amendment.facade.ts'), 'utf8');
  const controller = readFileSync(join(__dirname, './reading-amendment.controller.ts'), 'utf8');
  const resolver = readFileSync(
    join(__dirname, '../../services/factory/reading-source.resolver.ts'),
    'utf8',
  );
  const memory = readFileSync(
    join(__dirname, '../../services/memory/memory-context-builder.service.ts'),
    'utf8',
  );
  const snapshotMiddleware = readFileSync(
    join(__dirname, '../../prisma/reading-input-snapshot.middleware.ts'),
    'utf8',
  );
  const prismaService = readFileSync(join(__dirname, '../../prisma/prisma.service.ts'), 'utf8');
  const purgeController = readFileSync(
    join(__dirname, '../expert/client-purge.controller.ts'),
    'utf8',
  );
  const migration = readFileSync(
    join(
      __dirname,
      '../../../../../packages/database/prisma/migrations/20260802123000_add_reading_intake_amendments/migration.sql',
    ),
    'utf8',
  );
  const schemaBuilder = readFileSync(
    join(__dirname, '../../../../../packages/database/prisma/build-runtime-schema.cjs'),
    'utf8',
  );
  const databasePackage = readFileSync(
    join(__dirname, '../../../../../packages/database/package.json'),
    'utf8',
  );
  const apiEntrypoint = readFileSync(
    join(__dirname, '../../../../../scripts/api-entrypoint.sh'),
    'utf8',
  );

  it('never updates the original ReadingIntake row', () => {
    expect(service).not.toContain('readingIntake.update');
    expect(service).not.toContain('UPDATE "ReadingIntake"');
    expect(service).toContain('readingIntakeEffective');
    expect(service).toContain('ReadingInputSnapshot');
  });

  it('keeps amendments order-scoped, owner-scoped and revision-guarded', () => {
    expect(controller).toContain("@Controller('users/reading-amendments')");
    expect(controller).toContain("@Controller('expert/orders/:orderId/amendments')");
    expect(service).toContain('AND "userId" = ${userId}');
    expect(service).toContain('AND "orderId" = ${orderId}');
    expect(service).toContain('AND "revision" = ${dto.expectedRevision}');
    expect(service).toContain('AMENDMENT_REVISION_CHANGED');
    expect(facade).toContain("['COMPLETED', 'AWAITING_VALIDATION']");
  });

  it('uses an additive migration and preserves historical delivery tables', () => {
    expect(migration).toContain('CREATE TABLE "ReadingIntakeAmendment"');
    expect(migration).toContain('CREATE TABLE "ReadingInputSnapshot"');
    expect(migration).toContain('ADD COLUMN "inputSnapshotId" TEXT');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).not.toContain('DELETE FROM "ReadingVersion"');
    expect(migration).not.toContain('DELETE FROM "DeliveryRecord"');
  });

  it('keeps snapshot lineage and retakes coherent at database level', () => {
    expect(migration).toContain('ReadingIntakeAmendment_extend_retake_expiry');
    expect(migration).toContain("CURRENT_TIMESTAMP + INTERVAL '7 days'");
    expect(migration).toContain('ReadingInputSnapshot_sync_amendment_ids');
    expect(migration).toContain('NEW."data"->\'amendmentIds\'');
    expect(migration).toContain('ON DELETE SET NULL ON UPDATE CASCADE');
  });

  it('keeps Prisma generation and production migration on the same runtime schema', () => {
    expect(schemaBuilder).toContain('model ReadingIntakeAmendment');
    expect(schemaBuilder).toContain('model ReadingInputSnapshot');
    expect(schemaBuilder).toContain('inputSnapshotId String?');
    expect(schemaBuilder).toContain('ReadingVersionInputSnapshot');
    expect(schemaBuilder).toContain('ReadingInputSnapshotLineage');
    expect(databasePackage).toContain('db:prepare-schema');
    expect(databasePackage).toContain('schema.runtime.prisma');
    expect(apiEntrypoint).toContain('build-runtime-schema.cjs');
    expect(apiEntrypoint).toContain('schema.runtime.prisma');
    expect(apiEntrypoint).not.toContain('SCHEMA="packages/database/prisma/schema.prisma"');
  });

  it('routes generation through the effective snapshot and excludes V1 memories', () => {
    expect(resolver).toContain("source: 'EFFECTIVE_SNAPSHOT'");
    expect(resolver).toContain('readingIntakeEffective');
    expect(snapshotMiddleware).toContain('isDigitalSoulGenerationLoad');
    expect(snapshotMiddleware).toContain('sealedAt: null');
    expect(snapshotMiddleware).toContain("source.source === 'EFFECTIVE_SNAPSHOT'");
    expect(snapshotMiddleware).toContain('inputSnapshotId: snapshotId');
    expect(prismaService).toContain('installReadingInputSnapshotMiddleware(this)');
    expect(memory).toContain('readingIntakeEffective');
    expect(memory).toContain('excludedReadingVersionIds');
    expect(memory).toContain('sourceVersionId: { notIn: excludedReadingVersionIds }');
    expect(service).toContain('Conserve les éléments valides de la lecture précédente');
  });

  it('serializes revision launch before any generation side effect', () => {
    expect(facade).toContain('revisionClaim');
    expect(facade).toContain('AMENDMENT_REVISION_ALREADY_CLAIMED');
    expect(facade.indexOf('revisionClaim')).toBeLessThan(
      facade.indexOf('this.amendments.createRevisedReading'),
    );
    expect(facade).toContain("'lastRevisionFailure'");
  });

  it('never expires a complement already submitted for expert review', () => {
    const code = service + facade;
    expect(code).toContain('AND "status" = \'SUBMITTED\'');
    expect(code).toContain("AND \"status\" IN ('REQUESTED', 'DRAFT')");
    expect(code).not.toContain(
      "AND \"status\" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')\n          AND \"expiresAt\"",
    );
  });

  it('supports relational-only intakes without modifying the sealed row', () => {
    expect(facade).toContain('ensureOriginalInputProjection');
    expect(facade).toContain("version: 'relational-reading-intake-v1'");
    expect(facade).not.toContain('readingIntake.update');
  });

  it('preserves the existing version and delivery lineage during revision', () => {
    expect(service).toContain('reopenForRevision');
    expect(service).toContain('inputSnapshotId');
    expect(service).toContain('generateReading');
    expect(service).not.toContain('deliveryRecord.delete');
    expect(service).not.toContain('readingVersion.delete');
  });

  it('restricts the destructive client purge to administrators', () => {
    expect(purgeController).toContain("@Roles('ADMIN')");
  });
});
