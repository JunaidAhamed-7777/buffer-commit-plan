import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { beginOAuth, exchangeOAuthCode, getOAuthConfig, matchesOAuthState } from '../../src/server/auth/oauth.ts';
import { BufferAdapter } from '../../src/server/buffer/adapter.ts';

const account = { id: 'operator', organizations: [{ id: 'org-1', name: 'Workshop' }] };
const bluesky = {
  id: 'draft-1', text: 'Join us at Cedar Hall.', status: 'draft', dueAt: null, sentAt: null,
  isCustomScheduled: false, allowedActions: ['viewPost', 'updatePost'], assets: [], channelId: 'blue',
  channel: {
    id: 'blue', name: 'workshop.example', service: 'bluesky', organizationId: 'org-1',
    isDisconnected: false, isLocked: false,
  },
  metadata: {
    __typename: 'BlueskyPostMetadata', type: 'post', annotations: [], linkAttachment: null,
    threadCount: 0, thread: [],
  },
};
const linkedin = {
  ...bluesky, id: 'draft-2', channelId: 'linked',
  channel: { ...bluesky.channel, id: 'linked', name: 'Workshop', service: 'linkedin' },
  metadata: { __typename: 'LinkedInPostMetadata', type: 'post', annotations: [], linkAttachment: null, firstComment: null },
};

test('Buffer account reads only identity and organization names', async () => {
  const adapter = new BufferAdapter('synthetic-token', async (url, init) => {
    assert.equal(url, 'https://api.buffer.com');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic-token');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.match(JSON.parse(String(init?.body)).query, /account \{ id organizations \{ id name \} \}/);
    return Response.json({ data: { account: { ...account, email: 'private@example.test' } } });
  });
  assert.deepEqual(await adapter.account(), account);
});

test('draft page includes only eligible posts and preserves the opaque cursor', async () => {
  const rows = [
    bluesky, linkedin,
    { ...bluesky, id: 'scheduled', status: 'scheduled' },
    { ...bluesky, id: 'other-org', channel: { ...bluesky.channel, organizationId: 'org-2' } },
    { ...bluesky, id: 'media', assets: [{ __typename: 'Image' }] },
    { ...bluesky, id: 'mention', metadata: { ...bluesky.metadata, annotations: [{ __typename: 'Annotation' }] } },
    { ...bluesky, id: 'thread', metadata: { ...bluesky.metadata, threadCount: 1 } },
    { ...bluesky, id: 'empty-metadata', metadata: null },
    { ...linkedin, id: 'comment', metadata: { ...linkedin.metadata, firstComment: 'A separate comment' } },
    { ...linkedin, id: 'preview', metadata: { ...linkedin.metadata, linkAttachment: { __typename: 'LinkAttachment' } } },
  ];
  const adapter = new BufferAdapter('synthetic-token', async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)).variables, {
      input: { organizationId: 'org-1', filter: { status: ['draft'] } }, first: 20, after: 'cursor+/=',
    });
    return Response.json({ data: { posts: {
      edges: rows.map((node) => ({ node })), pageInfo: { hasNextPage: true, endCursor: 'next+/=' },
    } } });
  });
  const page = await adapter.drafts('org-1', 'cursor+/=');
  assert.deepEqual(page.drafts.map(({ id }) => id), ['draft-1', 'draft-2']);
  assert.equal(page.nextCursor, 'next+/=');
});

test('fresh draft reads distinguish known exclusion from missing eligibility evidence', async () => {
  const read = (post: unknown) => new BufferAdapter('synthetic-token', async () => Response.json({ data: { post } }));
  const baseline = await read(bluesky).draft('org-1', bluesky.id);
  assert.ok(baseline);
  const reordered = await read({ ...bluesky, allowedActions: ['updatePost', 'viewPost'] }).draft('org-1', bluesky.id);
  assert.equal(reordered?.eligibility, baseline.eligibility);
  const changedPermission = await read({ ...bluesky, allowedActions: ['updatePost'] }).draft('org-1', bluesky.id);
  assert.notEqual(changedPermission?.eligibility, baseline.eligibility);
  assert.equal(await read(bluesky).draft('org-2', bluesky.id), null);
  assert.equal(await read({ ...bluesky, status: 'needs_approval' }).draft('org-1', bluesky.id), null);
  await assert.rejects(read({ ...bluesky, metadata: { ...bluesky.metadata, thread: undefined } }).draft('org-1', bluesky.id));
  await assert.rejects(read({ ...bluesky, id: 'different-id' }).draft('org-1', bluesky.id));
});

test('confirmed edit sends only approved id and text even when success carries a warning', async () => {
  const text = 'Join us at Maple Hall. Bring a "friend".';
  const adapter = new BufferAdapter('synthetic-token', async (_url, init) => {
    const request = JSON.parse(String(init?.body));
    assert.deepEqual(request.variables, { input: { id: bluesky.id, text } });
    assert.match(request.query, /editPost\(input: \$input\)/);
    return Response.json({
      data: { editPost: { __typename: 'PostActionSuccess', post: { id: bluesky.id } } },
      errors: [{ message: 'Do not expose provider diagnostics' }],
    });
  });
  const result = await adapter.edit(bluesky.id, text);
  assert.equal(result.kind, 'success');
  assert.doesNotMatch(JSON.stringify(result), /provider diagnostics/);
});

test('edit distinguishes no-write rejections and uncertain responses without replay', async () => {
  const results: [() => Response, string][] = [
    [() => Response.json({ data: { editPost: { __typename: 'InvalidInputError', message: 'private payload' } } }), 'rejected'],
    [() => Response.json({ data: { editPost: { __typename: 'UnexpectedError', message: 'private payload' } } }), 'unknown'],
    [() => Response.json({ data: { editPost: { __typename: 'PostActionSuccess', post: { id: 'other-id' } } } }), 'unknown'],
    [() => Response.json({ data: null, errors: [{ message: 'private payload', extensions: { code: 'UNEXPECTED' } }] }), 'unknown'],
    [() => new Response('not JSON', { status: 500 }), 'unknown'],
  ];
  for (const [respond, kind] of results) {
    let calls = 0;
    const adapter = new BufferAdapter('synthetic-token', async () => {
      calls++;
      return respond();
    });
    const result = await adapter.edit(bluesky.id, 'Another draft text.');
    assert.equal(result.kind, kind);
    assert.equal(calls, 1);
    assert.doesNotMatch(JSON.stringify(result), /private payload/);
  }
  const disconnected = new BufferAdapter('synthetic-token', async () => { throw new Error('private payload'); });
  assert.equal((await disconnected.edit(bluesky.id, 'Another draft text.')).kind, 'unknown');
});

test('a confirmed rate limit rejection carries a wait for a fresh review', async () => {
  const startedAt = Date.now();
  const adapter = new BufferAdapter('synthetic-token', async () => Response.json({
    errors: [{ message: 'Rate limited', extensions: { code: 'RATE_LIMIT_EXCEEDED' } }],
  }, { status: 429, headers: { 'Retry-After': '60' } }));
  const result = await adapter.edit(bluesky.id, 'Another draft text.');
  assert.equal(result.kind, 'rejected');
  assert.ok(result.retryAt && result.retryAt >= startedAt + 60_000);
});

test('an oversized streamed edit response stays unknown and is never replayed', async () => {
  const success = { data: { editPost: { __typename: 'PostActionSuccess', post: { id: bluesky.id } } } };
  const bytes = new TextEncoder().encode(JSON.stringify({ ...success, ignored: 'x'.repeat(2304 * 1024) }));
  let calls = 0;
  let cancelled = false;
  const adapter = new BufferAdapter('synthetic-token', async () => {
    calls++;
    let offset = 0;
    return new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length) controller.close();
        else {
          controller.enqueue(bytes.subarray(offset, offset + 64 * 1024));
          offset += 64 * 1024;
        }
      },
      cancel() { cancelled = true; },
    }), { headers: { 'Content-Type': 'application/json' } });
  });

  assert.equal((await adapter.edit(bluesky.id, 'Meet at Maple Hall.')).kind, 'unknown');
  assert.equal(calls, 1);
  assert.equal(cancelled, true);
});

test('a malformed UTF-8 draft response cannot become the approved baseline', async () => {
  const body = JSON.stringify({ data: { post: { ...bluesky, text: 'room-marker' } } });
  const [before, after] = body.split('room-marker');
  const malformed = Buffer.concat([Buffer.from(before), Buffer.from([0xc3, 0x28]), Buffer.from(after)]);
  const adapter = new BufferAdapter('synthetic-token', async () => new Response(malformed));
  await assert.rejects(adapter.draft('org-1', bluesky.id), /could not confirm/);
});

const oauthEnv = {
  BUFFER_CLIENT_ID: 'test-client', BUFFER_CLIENT_SECRET: 'synthetic-secret',
  BUFFER_REDIRECT_URI: 'https://localhost:3000/api/buffer/callback',
};

test('Buffer authorization requests only the three required scopes and uses S256', () => {
  const config = getOAuthConfig(oauthEnv);
  assert.ok(config);
  assert.equal(getOAuthConfig({ ...oauthEnv, BUFFER_REDIRECT_URI: 'http://example.test/callback' }), null);
  assert.equal(getOAuthConfig({ ...oauthEnv, BUFFER_REDIRECT_URI: 'http://localhost:3000/api/buffer/callback' }), null);
  const attempt = beginOAuth(config);
  const url = new URL(attempt.url);
  assert.equal(url.origin + url.pathname, 'https://auth.buffer.com/auth');
  assert.equal(url.searchParams.get('redirect_uri'), oauthEnv.BUFFER_REDIRECT_URI);
  assert.equal(url.searchParams.get('scope'), 'account:read posts:read posts:write');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(attempt.verifier).digest('base64url'));
  assert.equal(url.searchParams.get('client_secret'), null);
  assert.ok(matchesOAuthState(attempt.state, url.searchParams.get('state')));
  assert.equal(matchesOAuthState(attempt.state, beginOAuth(config).state), false);
  assert.ok(attempt.expiresAt > Date.now());
});

test('code exchange stays server-side and checks the granted permissions', async () => {
  const config = getOAuthConfig(oauthEnv);
  assert.ok(config);
  const { verifier } = beginOAuth(config);
  const token = { access_token: 'synthetic-token', token_type: 'Bearer', expires_in: 3600, scope: 'posts:read account:read posts:write' };
  const session = await exchangeOAuthCode(config, 'synthetic-code', verifier, async (url, init) => {
    assert.equal(url, 'https://auth.buffer.com/token');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.deepEqual(Object.fromEntries(new URLSearchParams(String(init?.body))), {
      client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'authorization_code',
      code: 'synthetic-code', redirect_uri: config.redirectUri, code_verifier: verifier,
    });
    return Response.json(token);
  });
  assert.equal(session.accessToken, 'synthetic-token');
  assert.deepEqual(new Set(session.scopes), new Set(['account:read', 'posts:read', 'posts:write']));
  assert.ok(session.expiresAt > Date.now());
  for (const scope of ['account:read posts:read', token.scope + ' offline_access']) {
    await assert.rejects(exchangeOAuthCode(config, 'synthetic-code', verifier, async () => Response.json({ ...token, scope })), /different permissions/);
  }
});

test('an OAuth response over the token byte budget is rejected without exposing its contents', async () => {
  const config = getOAuthConfig(oauthEnv)!;
  const { verifier } = beginOAuth(config);
  const oversized = Response.json({
    access_token: 'private-token-' + 'x'.repeat(32 * 1024), token_type: 'Bearer', expires_in: 3600,
    scope: 'account:read posts:read posts:write',
  });
  await assert.rejects(
    exchangeOAuthCode(config, 'synthetic-code', verifier, async () => oversized),
    { message: 'Buffer could not complete the connection. Start the connection again.' },
  );
});
