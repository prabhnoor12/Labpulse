import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { pool } from './pool';

const MIGRATION_LOCK_KEY = 915730421;

function getMigrationsDirectory(): string {
  return process.env.MIGRATIONS_DIR
    ? path.resolve(process.env.MIGRATIONS_DIR)
    : path.resolve(process.cwd(), 'backend/src/db/migrations');
}

function checksum(sql: string): string {
  return crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
}

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    // A session-level advisory lock prevents two API instances from applying
    // the same migration concurrently.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        checksum char(64),
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Existing installations created before checksums were introduced are
    // upgraded without losing their migration history.
    await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum char(64)');

    const migrationsDirectory = getMigrationsDirectory();
    const files = (await fs.readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsDirectory, file), 'utf8');
      const currentChecksum = checksum(sql);
      const existing = await client.query<{ checksum: string | null }>(
        'SELECT checksum FROM schema_migrations WHERE id = $1',
        [file],
      );

      if (existing.rows[0]) {
        const appliedChecksum = existing.rows[0].checksum;
        if (!appliedChecksum) {
          // Backfill legacy rows once; future changes to applied SQL fail fast.
          await client.query('UPDATE schema_migrations SET checksum = $1 WHERE id = $2', [currentChecksum, file]);
        } else if (appliedChecksum !== currentChecksum) {
          throw new Error(`Migration checksum mismatch for ${file}; restore the original migration or create a new migration.`);
        }
        continue;
      }

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)',
          [file, currentChecksum],
        );
        await client.query('COMMIT');
        console.log(`Applied migration ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    if (lockAcquired) await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    client.release();
  }
}
