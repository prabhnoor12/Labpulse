import assert from 'node:assert/strict';
import test from 'node:test';
import type { CurrentUser } from '@/services/apiClient';
import { can } from './permissions';

function user(role: CurrentUser['role']): CurrentUser {
  return { id: 'user-1', labId: 'lab-1', email: 'user@example.com', name: 'Test User', role };
}

test('matches backend report permissions for each role', () => {
  assert.equal(can(user('OWNER'), 'createReport'), true);
  assert.equal(can(user('OWNER'), 'manageLab'), true);
  assert.equal(can(user('PATHOLOGIST'), 'verifyReport'), true);
  assert.equal(can(user('PATHOLOGIST'), 'dispatchReport'), true);
  assert.equal(can(user('TECHNICIAN'), 'editReport'), true);
  assert.equal(can(user('TECHNICIAN'), 'verifyReport'), false);
  assert.equal(can(user('RECEPTIONIST'), 'dispatchReport'), true);
  assert.equal(can(user('RECEPTIONIST'), 'createPublicLink'), true);
  assert.equal(can(user('RECEPTIONIST'), 'archiveReport'), false);
  assert.equal(can(user('VIEWER'), 'editReport'), false);
  assert.equal(can(user('VIEWER'), 'dispatchReport'), false);
});

test('does not grant permissions without an authenticated user', () => {
  assert.equal(can(null, 'createReport'), false);
  assert.equal(can(undefined, 'manageLab'), false);
});
