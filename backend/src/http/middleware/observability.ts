import type { NextFunction, Request, Response } from 'express';
import { recordHttpResponse } from '../../observability/metrics';

export function safePath(path: string): string {
  // Public report tokens are bearer credentials and must never enter logs.
  return path.replace(/^\/api\/public\/reports\/[^/]+(?=\/|$)/, '/api/public/reports/:token');
}

export function requestObservability(request: Request, response: Response, next: NextFunction): void {
  const startedAt = performance.now();
  response.once('finish', () => {
    const requestPath = request.originalUrl.split('?')[0];
    if (requestPath === '/live' || requestPath === '/ready' || requestPath === '/health') return;
    recordHttpResponse(response.statusCode);
    console.info(JSON.stringify({
      event: 'http_request',
      requestId: request.id,
      method: request.method,
      path: safePath(requestPath),
      status: response.statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      userId: request.user?.id,
      labId: request.user?.labId,
    }));
  });
  next();
}
