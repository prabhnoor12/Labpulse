import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function integer(name: string, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  if (value > maximum) throw new Error(`${name} must not exceed ${maximum}`);
  return value;
}

function boolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function origins(name: string, fallback: string[]): string[] {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function proxySetting(): boolean | number {
  const value = process.env.TRUST_PROXY?.trim().toLowerCase();
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 1) throw new Error('TRUST_PROXY must be true, false, or a positive integer');
  return hops;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const cookieSecure = boolean('COOKIE_SECURE', nodeEnv === 'production');
const databaseSsl = boolean('DATABASE_SSL', false);
const databaseSslRejectUnauthorized = boolean('DATABASE_SSL_REJECT_UNAUTHORIZED', true);
const metricsToken = process.env.METRICS_TOKEN?.trim() || '';
if (nodeEnv === 'production' && !cookieSecure) {
  throw new Error('COOKIE_SECURE must be true in production');
}
if (nodeEnv === 'production' && databaseSsl && !databaseSslRejectUnauthorized) {
  throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED must be true in production');
}
if (metricsToken && metricsToken.length < 32) {
  throw new Error('METRICS_TOKEN must be at least 32 characters when configured');
}

export const env = {
  nodeEnv,
  host: process.env.HOST?.trim() || '0.0.0.0',
  port: integer('PORT', 3001),
  databaseUrl: required('DATABASE_URL'),
  databasePoolMax: integer('DATABASE_POOL_MAX', 10, 100),
  databaseConnectionTimeoutMs: integer('DATABASE_CONNECTION_TIMEOUT_MS', 10_000, 120_000),
  databaseIdleTimeoutMs: integer('DATABASE_IDLE_TIMEOUT_MS', 30_000, 300_000),
  databaseStatementTimeoutMs: integer('DATABASE_STATEMENT_TIMEOUT_MS', 15_000, 300_000),
  databaseLockTimeoutMs: integer('DATABASE_LOCK_TIMEOUT_MS', 5_000, 60_000),
  databaseIdleInTransactionTimeoutMs: integer('DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS', 30_000, 300_000),
  databaseSsl,
  databaseSslRejectUnauthorized,
  databaseSslCaFile: process.env.DATABASE_SSL_CA_FILE?.trim() || '',
  cookieSecure,
  frontendOrigins: origins('FRONTEND_ORIGINS', ['http://localhost:5173', 'http://127.0.0.1:5173']),
  trustProxy: proxySetting(),
  sessionTtlDays: integer('SESSION_TTL_DAYS', 7),
  maxSessionsPerUser: integer('MAX_SESSIONS_PER_USER', 5, 20),
  publicReportTtlDays: integer('PUBLIC_REPORT_TTL_DAYS', 30),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || '',
  frontendDistDir: process.env.FRONTEND_DIST_DIR?.trim() || '',
  metricsToken,
};
