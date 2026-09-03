import crypto from 'node:crypto';
import type { PoolClient } from 'pg';

export interface IdempotencyContext {
  labId: string;
  userId: string;
  key: string;
  requestHash: string;
  requestId?: string;
}

export class IdempotencyConflictError extends Error {
  constructor(message = 'IDEMPOTENCY_CONFLICT') {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export function hashRequest(method: string, path: string, body: unknown): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify({ method, path, body }), 'utf8')
    .digest('hex');
}

export async function executeIdempotent<T>(
  client: PoolClient,
  context: IdempotencyContext | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  if (!context) return operation();

  await client.query(
    `DELETE FROM idempotency_keys
      WHERE lab_id = $1 AND user_id = $2 AND key = $3 AND expires_at <= now()`,
    [context.labId, context.userId, context.key],
  );

  const inserted = await client.query(
    `INSERT INTO idempotency_keys (lab_id, user_id, key, request_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + interval '24 hours')
     ON CONFLICT (lab_id, user_id, key) DO NOTHING
     RETURNING key`,
    [context.labId, context.userId, context.key, context.requestHash],
  );

  if (!inserted.rowCount) {
    const existing = await client.query<{ requestHash: string; responseBody: T | null }>(
      `SELECT request_hash AS "requestHash", response_body AS "responseBody"
         FROM idempotency_keys
        WHERE lab_id = $1 AND user_id = $2 AND key = $3
        FOR UPDATE`,
      [context.labId, context.userId, context.key],
    );
    const record = existing.rows[0];
    if (!record || record.requestHash !== context.requestHash) throw new IdempotencyConflictError();
    if (record.responseBody !== null) return record.responseBody;
    throw new IdempotencyConflictError('IDEMPOTENCY_IN_PROGRESS');
  }

  const result = await operation();
  await client.query(
    `UPDATE idempotency_keys
        SET response_body = $1, completed_at = now()
      WHERE lab_id = $2 AND user_id = $3 AND key = $4`,
    [JSON.stringify(result), context.labId, context.userId, context.key],
  );
  return result;
}
