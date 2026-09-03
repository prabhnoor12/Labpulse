import fs from 'node:fs';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from '../config/env';
import { incrementMetric } from '../observability/metrics';

const databaseSsl = env.databaseSsl
  ? {
      rejectUnauthorized: env.databaseSslRejectUnauthorized,
      ...(env.databaseSslCaFile ? { ca: fs.readFileSync(env.databaseSslCaFile, 'utf8') } : {}),
    }
  : undefined;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.databasePoolMax,
  connectionTimeoutMillis: env.databaseConnectionTimeoutMs,
  idleTimeoutMillis: env.databaseIdleTimeoutMs,
  statement_timeout: env.databaseStatementTimeoutMs,
  query_timeout: env.databaseStatementTimeoutMs,
  options: [
    `-c lock_timeout=${env.databaseLockTimeoutMs}ms`,
    `-c idle_in_transaction_session_timeout=${env.databaseIdleInTransactionTimeoutMs}ms`,
  ].join(' '),
  ssl: databaseSsl,
});

pool.on('error', (error) => {
  // Idle-client errors are otherwise emitted as unhandled EventEmitter errors.
  incrementMetric('database_pool_errors_total');
  console.error(JSON.stringify({ event: 'database_pool_error', message: error.message }));
});

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      incrementMetric('database_rollback_errors_total');
      console.error(JSON.stringify({
        event: 'database_rollback_error',
        message: rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error',
      }));
    }
    throw error;
  } finally {
    client.release();
  }
}

export function one<T extends QueryResultRow>(result: { rows: T[] }): T | undefined {
  return result.rows[0];
}
