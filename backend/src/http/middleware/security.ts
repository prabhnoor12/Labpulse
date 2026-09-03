import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';

const allowedMethods = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
// Keep this list in sync with browser headers emitted by the frontend. In
// particular, report mutations require Idempotency-Key to survive retries.
const allowedHeaders = 'Content-Type, Idempotency-Key, If-Match, X-Requested-With, X-Request-Id';

function originFromReferer(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export function requestSecurity(request: Request, response: Response, next: NextFunction): void {
  const origin = request.get('origin');
  response.setHeader('Vary', 'Origin');

  if (origin) {
    if (!env.frontendOrigins.includes(origin)) {
      response.status(403).json({ error: 'Origin is not allowed.' });
      return;
    }
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Methods', allowedMethods);
    response.setHeader('Access-Control-Allow-Headers', allowedHeaders);
    response.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, ETag');
  }

  if (request.method === 'OPTIONS') {
    if (!origin) {
      response.status(400).json({ error: 'Origin is required for preflight requests.' });
      return;
    }
    response.status(204).end();
    return;
  }

  // Cookie-authenticated mutations must prove that they originated from the
  // configured frontend. CORS blocks readable cross-origin responses, but it
  // does not by itself prevent a forged state-changing request.
  if (!safeMethods.has(request.method)) {
    const requestOrigin = origin || originFromReferer(request.get('referer'));
    if (!requestOrigin || !env.frontendOrigins.includes(requestOrigin)) {
      response.status(403).json({ error: 'A trusted origin is required for this request.' });
      return;
    }
  }

  next();
}
