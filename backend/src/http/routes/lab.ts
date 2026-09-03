import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async';
import { requireAuth, requireRole } from '../middleware/auth';
import { pool, transaction } from '../../db/pool';
import { SettingsVersionConflictError } from '../errors';

const router = Router();
router.use(requireAuth);
const profileSchema = z.record(z.unknown());

router.get('/profile', asyncHandler(async (request, response) => {
  const result = await pool.query(
    `SELECT lp.data, lp.updated_at AS "updatedAt", l.settings_version AS version
       FROM labs l
       LEFT JOIN lab_profiles lp ON lp.lab_id = l.id
      WHERE l.id = $1`,
    [request.user!.labId],
  );
  const row = result.rows[0];
  response.setHeader('ETag', `"${row?.version ?? 0}"`);
  response.json({ profile: row?.data || {}, updatedAt: row?.updatedAt || null, version: row?.version ?? 0 });
}));

router.patch('/profile', requireRole('OWNER'), asyncHandler(async (request, response) => {
  const data = profileSchema.parse(request.body);
  const expectedVersion = request.get('If-Match');
  if (!expectedVersion) throw new SettingsVersionConflictError();
  const result = await transaction(async (client) => {
    const current = await client.query<{ version: number }>('SELECT settings_version AS version FROM labs WHERE id = $1 FOR UPDATE', [request.user!.labId]);
    const currentVersion = current.rows[0]?.version ?? 0;
    if (expectedVersion !== `"${currentVersion}"`) throw new SettingsVersionConflictError();
    const saved = await client.query(
      `INSERT INTO lab_profiles (lab_id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (lab_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
       RETURNING data, updated_at AS "updatedAt"`,
      [request.user!.labId, JSON.stringify(data)],
    );
    await client.query(
      `INSERT INTO audit_events (id, lab_id, user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'LAB_PROFILE_UPDATED', 'LAB_PROFILE', $2, $4)`,
      [crypto.randomUUID(), request.user!.labId, request.user!.id, JSON.stringify({ requestId: request.id })],
    );
    const version = await client.query<{ version: number }>(
      'UPDATE labs SET settings_version = settings_version + 1 WHERE id = $1 RETURNING settings_version AS version',
      [request.user!.labId],
    );
    return { saved, version: version.rows[0].version };
  });
  response.setHeader('ETag', `"${result.version}"`);
  response.json({ profile: result.saved.rows[0].data, updatedAt: result.saved.rows[0].updatedAt, version: result.version });
}));

router.get('/templates', asyncHandler(async (request, response) => {
  const result = await pool.query(
    `SELECT l.settings_version AS version,
            COALESCE(
              json_agg(
                json_build_object('templateKey', t.template_key, 'data', t.data, 'updatedAt', t.updated_at)
                ORDER BY t.template_key
              ) FILTER (WHERE t.id IS NOT NULL),
              '[]'::json
            ) AS templates
       FROM labs l
       LEFT JOIN test_templates t ON t.lab_id = l.id AND t.active = true
      WHERE l.id = $1
      GROUP BY l.settings_version`,
    [request.user!.labId],
  );
  const row = result.rows[0] || { version: 0, templates: [] };
  const version = row.version ?? 0;
  response.setHeader('ETag', `"${version}"`);
  response.json({ templates: row.templates, version });
}));

router.put('/templates', requireRole('OWNER'), asyncHandler(async (request, response) => {
  const templates = z.array(z.object({ id: z.string().min(1).max(128), data: z.record(z.unknown()) })).max(500).parse(request.body);
  const expectedVersion = request.get('If-Match');
  if (!expectedVersion) throw new SettingsVersionConflictError();
  const version = await transaction(async (client) => {
    const current = await client.query<{ version: number }>('SELECT settings_version AS version FROM labs WHERE id = $1 FOR UPDATE', [request.user!.labId]);
    const currentVersion = current.rows[0]?.version ?? 0;
    if (expectedVersion !== `"${currentVersion}"`) throw new SettingsVersionConflictError();
    for (const template of templates) {
      await client.query(
        `INSERT INTO test_templates (id, lab_id, template_key, data, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (lab_id, template_key) DO UPDATE SET data = EXCLUDED.data, active = true, updated_at = now()`,
        [crypto.randomUUID(), request.user!.labId, template.id, JSON.stringify(template.data)],
      );
    }
    if (templates.length > 0) {
      await client.query(
        `UPDATE test_templates SET active = false, updated_at = now()
           WHERE lab_id = $1 AND NOT (template_key = ANY($2::text[]))`,
        [request.user!.labId, templates.map((template) => template.id)],
      );
    } else {
      await client.query('UPDATE test_templates SET active = false, updated_at = now() WHERE lab_id = $1', [request.user!.labId]);
    }
    await client.query(
      `INSERT INTO audit_events (id, lab_id, user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'TEST_TEMPLATES_REPLACED', 'LAB', $2, $4)`,
      [crypto.randomUUID(), request.user!.labId, request.user!.id, JSON.stringify({ requestId: request.id, templateCount: templates.length })],
    );
    const updated = await client.query<{ version: number }>(
      'UPDATE labs SET settings_version = settings_version + 1 WHERE id = $1 RETURNING settings_version AS version',
      [request.user!.labId],
    );
    return updated.rows[0].version;
  });
  response.setHeader('ETag', `"${version}"`);
  response.json({ templates, version });
}));

export default router;
