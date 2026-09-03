import { Router } from 'express';
import { asyncHandler } from '../middleware/async';
import { requireAuth } from '../middleware/auth';
import { pool } from '../../db/pool';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (request, response) => {
  const search = typeof request.query.search === 'string' ? request.query.search.trim().slice(0, 100) : '';
  const value = `%${search}%`;
  const result = await pool.query(
    `SELECT id, uhid, name, phone, data, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM patients
      WHERE lab_id = $1 AND ($2 = '%%' OR name ILIKE $2 OR uhid ILIKE $2 OR phone ILIKE $2)
      ORDER BY updated_at DESC LIMIT 100`,
    [request.user!.labId, value],
  );
  response.json({ patients: result.rows });
}));

export default router;
