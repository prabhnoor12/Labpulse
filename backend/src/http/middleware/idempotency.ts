import type { NextFunction, Request, Response } from 'express';
import { hashRequest, type IdempotencyContext } from '../../db/idempotency';

export function requireIdempotencyKey(request: Request, response: Response, next: NextFunction): void {
  const key = request.get('idempotency-key')?.trim();
  if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
    response.status(400).json({ error: 'An Idempotency-Key header is required for this operation.' });
    return;
  }

  request.idempotency = {
    key,
    requestHash: hashRequest(request.method, request.originalUrl, request.body || {}),
  };
  next();
}

export function idempotencyContext(request: Request): IdempotencyContext | undefined {
  if (!request.user || !request.idempotency) return undefined;
  return { ...request.idempotency, labId: request.user.labId, userId: request.user.id, requestId: request.id };
}
