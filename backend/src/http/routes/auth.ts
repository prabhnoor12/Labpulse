import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../../auth/password';
import { createSession, revokeSession } from '../../auth/session';
import { pool, one } from '../../db/pool';
import { asyncHandler } from '../middleware/async';
import { requireAuth } from '../middleware/auth';
import type { AuthenticatedUser, UserRole } from '../../auth/types';

const router = Router();
const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});

// Missing accounts still perform an Argon2 verification so login timing does
// not reveal whether an email exists.
const dummyPasswordHash = hashPassword('labpulse-invalid-login-password');

function publicUser(user: AuthenticatedUser) {
  return { id: user.id, labId: user.labId, email: user.email, name: user.name, role: user.role };
}

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
