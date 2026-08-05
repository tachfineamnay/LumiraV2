import { readFileSync } from 'fs';
import { join } from 'path';

describe('Reading amendment production contracts', () => {
  const palmService = readFileSync(join(__dirname, './reading-amendment.service.ts'), 'utf8');
  const profileRequest = readFileSync(
    join(__dirname, './profile-field-amendment-request.service.ts'),
    'utf8',
  );
  const profileClient = readFileSync(
    join(__dirname, './profile-field-amendment-client.service.ts'),
    'utf8',
  );
  const profileReview = readFileSync(
    join(__dirname, './profile-field-amendment-review.service.ts'),
    'utf8',
  );
  const profileShared = readFileSync(
    join(__dirname, './profile-field-amendment.shared.ts'),
    'utf8',
  );
  const completeness = readFileSync(
    join(__dirname, './intake-completeness.service.ts'),
    'utf8',
  );
  const profileRevision = readFileSync(
    join(__dirname, './profile-field-revision.service.ts'),
    'utf8',
  );
  const catalog = readFileSync(join(__dirname, './profile-field-catalog.ts'), 'utf8');
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
  const baseMigration = readFileSync(
    join(
      __dirname,
      '../../../../../packages/database/prisma/migrations/20260802123000_add_reading_intake_amendments/migration.sql',
    ),
    'utf8',
  );
  const extensionMigration = readFileSync(
    join(
      __dirname,
      '../../../../../packages/database/prisma/migrations/20260805125000_add_profile_field_amendments/migration.sql',
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
  const profileWorkflow = [profileRequest, profileClient, profileReview, profileShared].join('\n');

  it('never mutates the original sealed ReadingIntake', () => {
    for (const service of [palmService, profileWorkflow, facade]) {
      expect(service).not.toContain('readingIntake.update');
      expect(service).not.toContain('UPDATE "ReadingIntake"');
    }
    expect(profileReview).toContain('readingIntakeEffective');
    expect(profileReview).toContain('ReadingInputSnapshot');
  });

  it('keeps requests order-scoped, owner-scoped and revision-guarded', () => {
    expect(controller).toContain("@Controller('users/reading-amendments')");
    expect(controller).toContain("@Controller('expert/orders/:orderId/amendments')");
    expect(controller).toContain("@Controller('expert/orders/:orderId/intake-completeness')");
    expect(controller).toContain("@Post('required-fields')");
    expect(profileClient).toContain('AND "userId" = ${userId}');
    expect(profileReview).toContain('AND "orderId" = ${orderId}');
    expect(profileWorkflow).toContain('AND "revision" = ${dto.expectedRevision}');
    expect(profileShared).toContain('AMENDMENT_REVISION_CHANGED');
  });

  it('uses a closed server-side field catalog and rejects mass assignment', () => {
    expect(catalog).toContain('REQUESTABLE_FIELD_SET');
    expect(catalog).toContain('Information non demandable');
    expect(catalog).toContain("requested.includes('palmPhotoUrl')");
    expect(profileClient).toContain('Le champ ${key} n’a pas été demandé');
    expect(completeness).toContain('assertRequestable');
    expect(completeness).toContain('L’information « ${field.label} » est déjà présente');
  });

  it('prioritizes the effective snapshot and does not expose photo storage refs', () => {
    expect(completeness).toContain('readingIntakeEffective');
    expect(completeness).toContain("source: 'EFFECTIVE_SNAPSHOT'");
    expect(completeness).toContain("key === 'facePhotoUrl' || key === 'palmPhotoUrl'");
    expect(profileShared).toContain('sanitizePublicAmendmentData');
    expect(profileShared).toContain('delete values[key]');
    expect(controller).toContain('private, no-store, no-cache, must-revalidate');
  });

  it('uses additive migrations and preserves historical delivery tables', () => {
    expect(baseMigration).toContain('CREATE TABLE "ReadingIntakeAmendment"');
    expect(baseMigration).toContain('CREATE TABLE "ReadingInputSnapshot"');
    expect(baseMigration).toContain('ADD COLUMN "inputSnapshotId" TEXT');
    expect(extensionMigration).toContain('DROP CONSTRAINT IF EXISTS');
    expect(extensionMigration).toContain("'PALM_PHOTO', 'PROFILE_FIELDS'");
    expect(extensionMigration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(extensionMigration).not.toContain('DELETE FROM');
    expect(profileWorkflow).not.toContain('deliveryRecord.delete');
    expect(profileWorkflow).not.toContain('readingVersion.delete');
    expect(profileRevision).not.toContain('deliveryRecord.delete');
    expect(profileRevision).not.toContain('readingVersion.delete');
  });

  it('keeps snapshot lineage and retakes coherent', () => {
    expect(baseMigration).toContain('ReadingIntakeAmendment_extend_retake_expiry');
    expect(baseMigration).toContain("CURRENT_TIMESTAMP + INTERVAL '7 days'");
    expect(baseMigration).toContain('ReadingInputSnapshot_sync_amendment_ids');
    expect(profileReview).toContain('parentSnapshotId');
    expect(profileReview).toContain('amendmentIds');
  });

  it('keeps Prisma generation and production migration on the same runtime schema', () => {
    expect(schemaBuilder).toContain('model ReadingIntakeAmendment');
    expect(schemaBuilder).toContain('model ReadingInputSnapshot');
    expect(schemaBuilder).toContain('inputSnapshotId String?');
    expect(schemaBuilder).toContain('ReadingVersionInputSnapshot');
    expect(databasePackage).toContain('db:prepare-schema');
    expect(databasePackage).toContain('schema.runtime.prisma');
    expect(apiEntrypoint).toContain('build-runtime-schema.cjs');
    expect(apiEntrypoint).toContain('schema.runtime.prisma');
  });

  it('routes generation through the effective snapshot and excludes V1 memories', () => {
    expect(resolver).toContain("source: 'EFFECTIVE_SNAPSHOT'");
    expect(resolver).toContain('readingIntakeEffective');
    expect(snapshotMiddleware).toContain('isDigitalSoulGenerationLoad');
    expect(snapshotMiddleware).toContain("source.source === 'EFFECTIVE_SNAPSHOT'");
    expect(snapshotMiddleware).toContain('inputSnapshotId: snapshotId');
    expect(prismaService).toContain('installReadingInputSnapshotMiddleware(this)');
    expect(memory).toContain('readingIntakeEffective');
    expect(memory).toContain('excludedReadingVersionIds');
  });

  it('serializes manual revision launch before generation side effects', () => {
    expect(facade).toContain('revisionClaim');
    expect(facade).toContain('AMENDMENT_REVISION_ALREADY_CLAIMED');
    expect(facade.indexOf('revisionClaim')).toBeLessThan(facade.indexOf('createRevisedReading('));
    expect(facade).toContain("'lastRevisionFailure'");
    expect(profileRevision).toContain('inputSnapshotId');
    expect(profileRevision).toContain('generateReading');
  });

  it('never expires a complement already submitted for expert review', () => {
    expect(facade).toContain("AND \"status\" IN ('REQUESTED', 'DRAFT')");
    expect(completeness).toContain("AND \"status\" IN ('REQUESTED', 'DRAFT')");
    expect(profileRequest).toContain("AND \"status\" IN ('REQUESTED', 'DRAFT')");
    expect(facade).not.toContain(
      "AND \"status\" IN ('REQUESTED', 'DRAFT', 'SUBMITTED')\n          AND \"expiresAt\"",
    );
  });

  it('restricts the destructive client purge to administrators', () => {
    expect(purgeController).toContain("@Roles('ADMIN')");
  });
});
