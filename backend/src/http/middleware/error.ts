import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { IdempotencyConflictError } from '../../db/idempotency';
import { env } from '../../config/env';
import { SettingsVersionConflictError } from '../errors';
import { incrementMetric } from '../../observability/metrics';

function postgresCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  incrementMetric('api_errors_total');
  const requestId = request.id;
  response.setHeader('X-Request-Id', requestId);

  if (error instanceof ZodError) {
    response.status(400).json({ error: 'Invalid request.', issues: error.issues, requestId });
    return;
  }

  if (error instanceof IdempotencyConflictError) {
    response.status(409).json({
      error: error.message === 'IDEMPOTENCY_IN_PROGRESS'
        ? 'The same operation is already being processed. Please retry.'
        : 'This Idempotency-Key was already used with a different request.',
      requestId,
    });
    return;
  }

  if (error instanceof SettingsVersionConflictError) {
    response.status(412).json({ error: 'These settings changed in another session. Reload and try again.', requestId });
    return;
  }

  if (error instanceof Error && (error.message === 'REPORT_DISCOUNT_INVALID' || error.message === 'REPORT_PAYMENT_INVALID')) {
    response.status(400).json({ error: 'Report billing values are invalid.', requestId });
    return;
  }

  if (error instanceof Error && error.message === 'AI_INVALID_RESPONSE') {
    response.status(502).json({ error: 'The AI service returned an invalid response. Please retry.', requestId });
    return;
  }

  const code = postgresCode(error);
  if (code === '23505') {
    response.status(409).json({ error: 'A record with the same unique value already exists.', requestId });
    return;
  }
  if (code === '23503') {
    response.status(400).json({ error: 'The request references a record that does not exist.', requestId });
    return;
  }
  if (code === '40001') {
    response.status(409).json({ error: 'The record changed concurrently. Please retry.', requestId });
    return;
  }
  if (code === '55P03') {
    response.status(409).json({ error: 'The database resource is busy. Please retry.', requestId });
    return;
  }
  if (code === '57014' || code === '25P03' || code === '53300') {
    response.status(503).json({ error: 'The database is temporarily unavailable. Please retry.', requestId });
    return;
  }

  const errorDetails = error instanceof Error ? {
    message: error.message,
    ...(env.nodeEnv !== 'production' && error.stack ? { stack: error.stack } : {}),
  } : { message: 'Unknown error' };
  console.error(JSON.stringify({ event: 'api_error', requestId, ...errorDetails }));
  response.status(500).json({ error: 'Internal server error.', requestId });
};
