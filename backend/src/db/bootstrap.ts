import crypto from 'node:crypto';
import argon2 from 'argon2';
import { env } from '../config/env';
import { pool, transaction } from './pool';
import { runMigrations } from './migrate';

async function bootstrap(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Lab Owner';
  const labName = process.env.BOOTSTRAP_LAB_NAME?.trim() || 'My Diagnostic Laboratory';
  if (!email || !password) throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD first.');
  if (password.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.');

  await runMigrations();
  const existing = await pool.query('SELECT id FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
  if (existing.rowCount) throw new Error(`A user with ${email} already exists.`);

  const labId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await transaction(async (client) => {
    await client.query('INSERT INTO labs (id, name) VALUES ($1, $2)', [labId, labName]);
    await client.query(
      `INSERT INTO users (id, lab_id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'OWNER')`,
      [userId, labId, email, name, passwordHash],
    );
    await client.query('INSERT INTO lab_profiles (lab_id, data) VALUES ($1, $2)', [labId, JSON.stringify({ name: labName })]);
  });
  console.log(`Created owner ${email} for ${labName}.`);
}

bootstrap().catch((error) => {
  console.error('Database bootstrap failed:', error);
  process.exitCode = 1;
}).finally(() => pool.end());
