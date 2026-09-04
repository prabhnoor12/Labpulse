import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../../auth/password';
import { pool, transaction } from '../../db/pool';
import { asyncHandler } from '../middleware/async';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const idSchema = z.string().uuid();
const staffRole = z.enum(['PATHOLOGIST', 'TECHNICIAN', 'RECEPTIONIST', 'VIEWER']);
const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(256),
  role: staffRole,
});
const updateStaffSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  password: z.string().min(12).max(256).optional(),
  role: staffRole.optional(),
  active: z.boolean().optional(),
}).refine((input) => Object.keys(input).length > 0, { message: 'At least one staff field is required.' });

router.use(requireAuth, requireRole('OWNER'));

router.get('/', asyncHandler(async (request, response) => {
  const result = await pool.query(
    `SELECT id, name, email, role, active, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE lab_id = $1 ORDER BY active DESC, name ASC`,
    [request.user!.labId],
  );
  response.json({ users: result.rows });
}));

router.post('/', asyncHandler(async (request, response) => {
  const input = createStaffSchema.parse(request.body);
  const email = input.email.toLowerCase();
  const existing = await pool.query('SELECT id FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
  if (existing.rowCount) {
    response.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO users (id, lab_id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, request.user!.labId, email, input.name, passwordHash, input.role],
    );
    await client.query(
      `INSERT INTO audit_events (id, lab_id, user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'STAFF_CREATED', 'USER', $4, $5)`,
      [crypto.randomUUID(), request.user!.labId, request.user!.id, userId, JSON.stringify({ role: input.role, requestId: request.id })],
    );
  });
  response.status(201).json({ user: { id: userId, name: input.name, email, role: input.role, active: true } });
}));

router.patch('/:id', asyncHandler(async (request, response) => {
  const userId = idSchema.parse(request.params.id);
  if (userId === request.user!.id) {
    response.status(400).json({ error: 'Use your account settings to change your own account.' });
    return;
  }
  const input = updateStaffSchema.parse(request.body);
  const existing = await pool.query<{ id: string; name: string; email: string; role: string; active: boolean }>(
    'SELECT id, name, email, role, active FROM users WHERE id = $1 AND lab_id = $2 AND role <> \'OWNER\'',
    [userId, request.user!.labId],
  );
  const current = existing.rows[0];
  if (!current) {
    response.status(404).json({ error: 'Staff account not found.' });
    return;
  }

  const name = input.name ?? current.name;
  const role = input.role ?? current.role;
  const active = input.active ?? current.active;
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const updated = await transaction(async (client) => {
    const result = await client.query(
      `UPDATE users SET name = $1, role = $2, active = $3,
              password_hash = COALESCE($4, password_hash), updated_at = now()
         WHERE id = $5 AND lab_id = $6
       RETURNING id, name, email, role, active, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, role, active, passwordHash || null, userId, request.user!.labId],
    );
    await client.query(
      `INSERT INTO audit_events (id, lab_id, user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'STAFF_UPDATED', 'USER', $4, $5)`,
      [crypto.randomUUID(), request.user!.labId, request.user!.id, userId, JSON.stringify({ changedPassword: Boolean(passwordHash), role, active, requestId: request.id })],
    );
    return result.rows[0];
  });
  response.json({ user: updated });
}));

export default router;
