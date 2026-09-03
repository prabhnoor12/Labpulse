import assert from 'node:assert/strict';
import test from 'node:test';
import { safePath } from './observability';

test('redacts public report bearer tokens from logged paths', () => {
  const token = 'A'.repeat(43);

  assert.equal(
    safePath(`/api/public/reports/${token}`),
    '/api/public/reports/:token',
  );
  assert.equal(
    safePath(`/api/public/reports/${token}/pdf`),
    '/api/public/reports/:token/pdf',
  );
});

test('leaves non-secret paths unchanged', () => {
  assert.equal(safePath('/api/reports/report-123'), '/api/reports/report-123');
});
