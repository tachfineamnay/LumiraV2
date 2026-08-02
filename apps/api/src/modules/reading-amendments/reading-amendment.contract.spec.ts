import { readFileSync } from 'fs';
import { join } from 'path';

describe('Reading amendment production contracts', () => {
  const service = readFileSync(join(__dirname, './reading-amendment.service.ts'), 'utf8');
  const controller = readFileSync(join(__dirname, './reading-amendment.controller.ts'), 'utf8');
  const resolver = readFileSync(
    join(__dirname, '../../services/factory/reading-source.resolver.ts'),
    'utf8',
  );
  const memory = readFileSync(
    join(__dirname, '../../services/memory/memory-context-builder.service.ts'),
    'utf8',
  );
  const migration = readFileSync(
    join(
      __dirname,
      '../../../../../packages/database/prisma/migrations/20260802123000_add_reading_intake_amendments/migration.sql',
    ),
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
  });

  it('uses an additive migration and preserves historical delivery tables', () => {
    expect(migration).toContain('CREATE TABLE "ReadingIntakeAmendment"');
    expect(migration).toContain('CREATE TABLE "ReadingInputSnapshot"');
    expect(migration).toContain('ADD COLUMN "inputSnapshotId" TEXT');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).not.toContain('DELETE FROM "ReadingVersion"');
    expect(migration).not.toContain('DELETE FROM "DeliveryRecord"');
  });

  it('routes generation through the effective snapshot and excludes V1 memories', () => {
    expect(resolver).toContain("source: 'EFFECTIVE_SNAPSHOT'");
    expect(resolver).toContain('readingIntakeEffective');
    expect(memory).toContain('excludedReadingVersionIds');
    expect(memory).toContain('sourceVersionId: { notIn: excludedReadingVersionIds }');
    expect(service).toContain('Conserve les éléments valides de la lecture précédente');
  });

  it('preserves the existing version and delivery lineage during revision', () => {
    expect(service).toContain('reopenForRevision');
    expect(service).toContain('inputSnapshotId');
    expect(service).toContain('generateReading');
    expect(service).not.toContain('deliveryRecord.delete');
    expect(service).not.toContain('readingVersion.delete');
  });
});
