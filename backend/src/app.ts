import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { pool } from './db/pool';
import authRoutes from './http/routes/auth';
import labRoutes from './http/routes/lab';
import patientsRoutes from './http/routes/patients';
import reportsRoutes from './http/routes/reports';
import aiRoutes from './http/routes/ai';
import publicReportsRoutes from './http/routes/publicReports';
import { errorHandler } from './http/middleware/error';
import { requestSecurity } from './http/middleware/security';
import { PostgresRateLimitStore } from './db/rateLimitStore';
import { requestObservability } from './http/middleware/observability';
import { metricsSnapshot } from './observability/metrics';
import './http/types';

export const app = express();
app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');
app.use(helmet());
app.use((request, response, next) => {
  const suppliedId = request.get('x-request-id')?.trim();
  request.id = suppliedId && /^[A-Za-z0-9._-]{1,128}$/.test(suppliedId) ? suppliedId : crypto.randomUUID();
  response.setHeader('X-Request-Id', request.id);
  next();
});
app.use(requestObservability);
app.use(requestSecurity);
app.use(express.json({ limit: '1mb' }));
app.use('/api', (_request, response, next) => {
  // Reports and patient data must not be cached by browsers or intermediaries.
  response.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/live', (_request, response) => {
  response.json({ status: 'ok', service: 'labpulse-api', timestamp: new Date().toISOString() });
});

const readiness = async (request: express.Request, response: express.Response): Promise<void> => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ready', service: 'labpulse-api', timestamp: new Date().toISOString() });
  } catch {
    response.status(503).json({ status: 'not_ready', service: 'labpulse-api', requestId: request.id, timestamp: new Date().toISOString() });
  }
};

app.get('/ready', readiness);
app.get('/health', readiness);

app.get('/metrics', (request, response) => {
  if (!env.metricsToken) {
    response.status(404).json({ error: 'Not found.' });
    return;
  }
  const authorization = request.get('authorization') || '';
  const suppliedToken = authorization.replace(/^Bearer\s+/i, '');
  const expected = Buffer.from(env.metricsToken, 'utf8');
  const supplied = Buffer.from(suppliedToken, 'utf8');
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    response.status(401).json({ error: 'Metrics authorization required.' });
    return;
  }
  response.setHeader('Cache-Control', 'no-store');
  response.json(metricsSnapshot());
});

const sharedLimiter = (scope: string, windowMs: number, limit: number) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  passOnStoreError: false,
  store: new PostgresRateLimitStore(scope),
});

app.use('/api/auth', sharedLimiter('auth', 60_000, 20), authRoutes);
app.use('/api/ai', sharedLimiter('ai', 60_000, 20), aiRoutes);
app.use('/api/public/reports', sharedLimiter('public-reports', 60_000, 60), publicReportsRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/reports', reportsRoutes);

if (env.frontendDistDir) {
  app.use(express.static(env.frontendDistDir, { index: 'index.html', maxAge: env.nodeEnv === 'production' ? '1h' : 0 }));
  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api/')) {
      next();
      return;
    }
    response.sendFile('index.html', { root: env.frontendDistDir }, (error) => {
      if (error) next(error);
    });
  });
}

app.use((_request, response) => response.status(404).json({ error: 'Route not found.' }));
app.use(errorHandler);
