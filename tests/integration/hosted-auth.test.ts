import assert from 'node:assert/strict';
import { test } from 'node:test';
import { admitBufferAccount, bufferAccess } from '../../src/server/auth/access.ts';

const localhost = new URL('https://localhost:3000/api/buffer/callback');
const hosted = new URL('https://patchwork.example/api/buffer/callback');
const allowed = {
  PATCHWORK_BUFFER_ACCOUNT_ID: 'operator-account',
  PATCHWORK_BUFFER_ORGANIZATION_ID: 'operator-org',
};
const operator = {
  id: 'operator-account',
  organizations: [
    { id: 'other-org', name: 'Other organization' },
    { id: 'operator-org', name: 'Selected organization' },
  ],
};

test('hosted OAuth fails closed when the operator or organization is missing', () => {
  assert.equal(bufferAccess(hosted, {}), undefined);
  assert.equal(bufferAccess(hosted, { PATCHWORK_BUFFER_ACCOUNT_ID: allowed.PATCHWORK_BUFFER_ACCOUNT_ID }), undefined);
  assert.equal(bufferAccess(hosted, { ...allowed, PATCHWORK_BUFFER_ACCOUNT_ID: ' ' }), undefined);
  assert.equal(admitBufferAccount(operator, bufferAccess(hosted, {})), undefined);
  assert.equal(admitBufferAccount(operator, bufferAccess(localhost, {})), operator);
});

test('hosted OAuth admits only the configured account and its configured organization', () => {
  const access = bufferAccess(hosted, allowed);
  assert.equal(admitBufferAccount({ ...operator, id: 'different-account' }, access), undefined);
  assert.equal(admitBufferAccount({ ...operator, organizations: [operator.organizations[0]] }, access), undefined);
  assert.deepEqual(admitBufferAccount(operator, access), { id: operator.id, organizations: [operator.organizations[1]] });
});
