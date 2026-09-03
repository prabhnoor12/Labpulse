import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';

const { env } = await import('../../config/env');
const { requestSecurity } = await import('./security');

function responseDouble() {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let body: unknown;
  let ended = false;

  return {
    headers,
    get statusCode() { return statusCode; },
    get body() { return body; },
    get ended() { return ended; },
    setHeader(name: string, value: string) { headers.set(name, value); },
    status(value: number) { statusCode = value; return this; },
    json(value: unknown) { body = value; return this; },
    end() { ended = true; return this; },
  };
}

function requestDouble(origin: string | undefined, method = 'OPTIONS', referer?: string) {
  return {
    method,
    get(name: string) {
      const header = name.toLowerCase();
      if (header === 'origin') return origin;
      if (header === 'referer') return referer;
      return undefined;
    },
  };
}

test('allows mutation headers during trusted CORS preflight', () => {
  const response = responseDouble();
  let calledNext = false;

  requestSecurity(requestDouble(env.frontendOrigins[0]) as never, response as never, () => { calledNext = true; });

  assert.equal(response.statusCode, 204);
  assert.equal(response.ended, true);
  assert.equal(calledNext, false);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), env.frontendOrigins[0]);
  assert.match(response.headers.get('Access-Control-Allow-Headers') || '', /Idempotency-Key/);
  assert.match(response.headers.get('Access-Control-Allow-Headers') || '', /X-Request-Id/);
});

test('rejects untrusted CORS origins', () => {
  const response = responseDouble();
  let calledNext = false;

  requestSecurity(requestDouble('https://attacker.example') as never, response as never, () => { calledNext = true; });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: 'Origin is not allowed.' });
  assert.equal(calledNext, false);
});

test('allows a trusted state-changing request', () => {
  const response = responseDouble();
  let calledNext = false;

  requestSecurity(requestDouble(env.frontendOrigins[0], 'POST') as never, response as never, () => { calledNext = true; });

  assert.equal(response.statusCode, 200);
  assert.equal(calledNext, true);
});

test('rejects state-changing requests without a trusted origin', () => {
  const response = responseDouble();
  let calledNext = false;

  requestSecurity(requestDouble(undefined, 'POST') as never, response as never, () => { calledNext = true; });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: 'A trusted origin is required for this request.' });
  assert.equal(calledNext, false);
});

test('accepts a trusted referer when Origin is unavailable', () => {
  const response = responseDouble();
  let calledNext = false;

  requestSecurity(requestDouble(undefined, 'POST', `${env.frontendOrigins[0]}/login`) as never, response as never, () => { calledNext = true; });

  assert.equal(response.statusCode, 200);
  assert.equal(calledNext, true);
});
