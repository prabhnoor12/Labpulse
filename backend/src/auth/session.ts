import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env';
import { pool, one, transaction } from '../db/pool';
import type { AuthenticatedUser } from './types';

// __Host- cookies require HTTPS. Use a normal cookie for local HTTP development.
export const SESSION_COOKIE = env.cookieSecure ? '__Host-labpulse_session' : 'labpulse_session';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieValue(request: Request): string | undefined {
  const header = request.headers.cookie || '';
  const item = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return item?.slice(SESSION_COOKIE.length + 1);
}

export async function createSession(user: AuthenticatedUser, request: Request, response: Response): Promise<void> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);
  await transaction(async (client) => {
    await client.query('DELETE FROM sessions WHERE user_id = $1 AND (expires_at <= now() OR revoked_at IS NOT NULL)', [user.id]);
    await client.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), user.id, hashToken(token), expiresAt, request.ip, request.get('user-agent') || null],
    );
    await client.query(
      `WITH ranked AS (
         SELECT id, row_number() OVER (ORDER BY created_at DESC) AS position
           FROM sessions
          WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
       )
       UPDATE sessions SET revoked_at = now()
        WHERE id IN (SELECT id FROM ranked WHERE position > $2)`,
      [user.id, env.maxSessionsPerUser],
    );
  });
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function getSessionUser(request: Request): Promise<AuthenticatedUser | undefined> {
  const token = cookieValue(request);
  if (!token) return undefined;
  const result = await pool.query<AuthenticatedUser>(
    `SELECT u.id, u.lab_id AS "labId", u.email, u.name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.active = true`,
    [hashToken(token)],
  );
  return one(result);
}

export async function revokeSession(request: Request, response: Response): Promise<void> {
  const token = cookieValue(request);
  if (token) await pool.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [hashToken(token)]);
  response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: env.cookieSecure, sameSite: 'lax', path: '/' });
}
