import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../../auth/password';
import { createSession, revokeSession } from '../../auth/session';
import { pool, one, transaction } from '../../db/pool';
import { asyncHandler } from '../middleware/async';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedUser, UserRole } from '../../auth/types';

const router = Router();
const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});
const signupSchema = z.object({
  labName: z.string().trim().min(2).max(200),
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(256),
});

// Missing accounts still perform an Argon2 verification so login timing does
// not reveal whether an email exists.
const dummyPasswordHash = hashPassword('labpulse-invalid-login-password');

function publicUser(user: AuthenticatedUser) {
  return { id: user.id, labId: user.labId, email: user.email, name: user.name, role: user.role };
}

router.post('/signup', asyncHandler(async (request, response) => {
  const input = signupSchema.parse(request.body);
  const email = input.email.toLowerCase();

  const existing = await pool.query('SELECT id FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
  if (existing.rowCount) {
    response.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    return;
  }

  const labId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);
  const user: AuthenticatedUser = {
    id: userId,
    labId,
    email,
    name: input.name,
    role: 'OWNER',
  };

  await transaction(async (client) => {
    await client.query('INSERT INTO labs (id, name) VALUES ($1, $2)', [labId, input.labName]);
    await client.query(
      `INSERT INTO users (id, lab_id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'OWNER')`,
      [userId, labId, email, input.name, passwordHash],
    );
    await client.query('INSERT INTO lab_profiles (lab_id, data) VALUES ($1, $2)', [labId, JSON.stringify({ name: input.labName })]);
    await client.query(
      `INSERT INTO audit_events (id, lab_id, user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'SIGNUP', 'USER', $3, $4)`,
      [crypto.randomUUID(), labId, userId, JSON.stringify({ requestId: request.id })],
    );
  });

  await createSession(user, request, response);
  response.status(201).json({ user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (request, response) => {
  const input = loginSchema.parse(request.body);
  const result = await pool.query<AuthenticatedUser & { passwordHash: string; active: boolean }>(
    `SELECT id, lab_id AS "labId", email, name, role, password_hash AS "passwordHash", active
       FROM users WHERE lower(email) = $1 LIMIT 1`,
    [input.email.toLowerCase()],
  );
  const user = one(result);
  let passwordValid = false;
  try {
    passwordValid = await verifyPassword(user?.passwordHash || await dummyPasswordHash, input.password);
  } catch {
    // A malformed stored hash must behave like invalid credentials, not a 500.
    passwordValid = false;
  }
  if (!user || !user.active || !passwordValid) {
    if (user) {
      await pool.query(
        `INSERT INTO audit_events (id, lab_id, user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, $3, 'LOGIN_FAILED', 'USER', $3, $4)`,
        [crypto.randomUUID(), user.labId, user.id, JSON.stringify({ requestId: request.id })],
      );
    }
    response.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  await createSession(user, request, response);
  await pool.query(
    `INSERT INTO audit_events (id, lab_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, 'LOGIN', 'USER', $3, $4)`,
    [crypto.randomUUID(), user.labId, user.id, JSON.stringify({ requestId: request.id })],
  );
  response.json({ user: publicUser(user) });
}));

router.post('/logout', asyncHandler(async (request, response) => {
  await revokeSession(request, response);
  response.status(204).send();
}));

router.get('/me', requireAuth, (request, response) => {
  response.json({ user: publicUser(request.user!) });
});

router.get('/roles', requireAuth, (_request, response) => {
  const roles: UserRole[] = ['OWNER', 'PATHOLOGIST', 'TECHNICIAN', 'RECEPTIONIST', 'VIEWER'];
  response.json({ roles });
});

export default router;
