import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Historical migrations that already shipped destructive PromptVersion changes.
 * Any migration with a timestamp AFTER this cutoff must not repeat those patterns.
 */
const ALLOWED_DESTRUCTIVE_MIGRATIONS = new Set([
  '20260720200000_harden_ai_production',
  '20260722123000_enable_all_openai_agents',
]);

const CUTOFF = '20260722123000';

describe('PromptVersion migration guard', () => {
  const migrationsDir = join(__dirname, '../../../../../packages/database/prisma/migrations');

  it('forbids new migrations from mass-deactivating or overwriting Desk PromptVersion rows', () => {
    const folders = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => /^\d{14}/.test(name));

    const violations: string[] = [];

    for (const folder of folders) {
      const stamp = folder.slice(0, 14);
      if (stamp <= CUTOFF) continue;
      if (ALLOWED_DESTRUCTIVE_MIGRATIONS.has(folder)) continue;

      const sqlPath = join(migrationsDir, folder, 'migration.sql');
      let sql = '';
      try {
        sql = readFileSync(sqlPath, 'utf8');
      } catch {
        continue;
      }

      const compact = sql.replace(/\s+/g, ' ');

      if (
        /UPDATE\s+"PromptVersion"[\s\S]{0,200}SET\s+"isActive"\s*=\s*false/i.test(sql) ||
        /UPDATE "PromptVersion".{0,200}SET "isActive" = false/i.test(compact)
      ) {
        violations.push(`${folder}: UPDATE PromptVersion SET isActive = false`);
      }

      if (
        /INSERT\s+INTO\s+"PromptVersion"/i.test(sql) &&
        /MODEL_CONFIG|LUMIRA_DNA|'SCRIBE'|'EDITOR'|'GUIDE'|'NARRATOR'/i.test(sql) &&
        !/NOT EXISTS|WHERE NOT EXISTS|only if missing/i.test(sql)
      ) {
        violations.push(`${folder}: INSERT PromptVersion for Desk keys without NOT EXISTS guard`);
      }

      if (
        /UPDATE\s+"PromptVersion"[\s\S]{0,120}SET\s+"value"/i.test(sql) &&
        /MODEL_CONFIG/i.test(sql)
      ) {
        violations.push(`${folder}: in-place UPDATE PromptVersion.value for MODEL_CONFIG`);
      }
    }

    expect(violations).toEqual([]);
  });
});
