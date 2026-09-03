import type { Store } from 'express-rate-limit';
import { pool } from './pool';

export class PostgresRateLimitStore implements Store {
  readonly localKeys = false;
  private windowMs = 60_000;
  private operations = 0;

  constructor(private readonly scope: string) {}

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  private key(value: string): string {
    return `${this.scope}:${value}`.slice(0, 512);
  }

  async increment(value: string): Promise<{ totalHits: number; resetTime: Date }> {
    const key = this.key(value);
    const result = await pool.query<{ hits: number; resetAt: Date }>(
      `INSERT INTO rate_limit_buckets (bucket_key, hits, reset_at)
       VALUES ($1, 1, now() + ($2::integer * interval '1 millisecond'))
       ON CONFLICT (bucket_key) DO UPDATE
       SET hits = CASE
           WHEN rate_limit_buckets.reset_at <= now() THEN 1
           ELSE rate_limit_buckets.hits + 1
         END,
         reset_at = CASE
           WHEN rate_limit_buckets.reset_at <= now() THEN EXCLUDED.reset_at
           ELSE rate_limit_buckets.reset_at
         END,
         updated_at = now()
       RETURNING hits, reset_at AS "resetAt"`,
      [key, this.windowMs],
    );

    this.operations += 1;
    if (this.operations % 100 === 0) {
      await pool.query('DELETE FROM rate_limit_buckets WHERE reset_at <= now()');
    }

    const row = result.rows[0];
    return { totalHits: row.hits, resetTime: row.resetAt };
  }

  async decrement(value: string): Promise<void> {
    await pool.query(
      `UPDATE rate_limit_buckets
          SET hits = GREATEST(hits - 1, 0), updated_at = now()
        WHERE bucket_key = $1`,
      [this.key(value)],
    );
  }

  async resetKey(value: string): Promise<void> {
    await pool.query('DELETE FROM rate_limit_buckets WHERE bucket_key = $1', [this.key(value)]);
  }

  async resetAll(): Promise<void> {
    await pool.query('DELETE FROM rate_limit_buckets WHERE bucket_key LIKE $1', [`${this.scope}:%`]);
  }
}
