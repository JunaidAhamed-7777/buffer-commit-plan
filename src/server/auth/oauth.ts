import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const SCOPES = ['account:read', 'posts:read', 'posts:write'];
const AUTHORIZATION_URL = 'https://auth.buffer.com/auth';
const TOKEN_URL = 'https://auth.buffer.com/token';
const FLOW_LIFETIME_MS = 10 * 60 * 1000;
const TOKEN_TIMEOUT_MS = 15_000;

export function getOAuthConfig(env: Readonly<Record<string, string | undefined>> = process.env): OAuthConfig | null {
  const clientId = env.BUFFER_CLIENT_ID?.trim();
  const clientSecret = env.BUFFER_CLIENT_SECRET?.trim();
  const redirectUri = env.BUFFER_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;

  try {
    const url = new URL(redirectUri);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) return null;
  } catch {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function beginOAuth(config: OAuthConfig) {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const url = new URL(AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'consent',
  }).toString();
  return { url: url.href, state, verifier, expiresAt: Date.now() + FLOW_LIFETIME_MS };
}

export function matchesOAuthState(expected: string, actual: string | null): boolean {
  const stateFormat = /^[A-Za-z0-9_-]{43}$/;
  return actual !== null && stateFormat.test(expected) && stateFormat.test(actual)
    && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export async function exchangeOAuthCode(
  config: OAuthConfig,
  code: string,
  verifier: string,
  request: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresAt: number; scopes: string[] }> {
  if (!code || code.length > 4096 || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
    throw new Error('The Buffer sign-in link is invalid. Start the connection again.');
  }

  const startedAt = Date.now();
  let token: {
    access_token?: unknown;
    expires_in?: unknown;
    scope?: unknown;
    token_type?: unknown;
    error?: unknown;
  } | null;

  try {
    const response = await request(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        code_verifier: verifier,
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
    token = response.ok ? await response.json() : null;
  } catch {
    token = null;
  }

  if (!token || token.error !== undefined || typeof token.access_token !== 'string'
    || !token.access_token || /\s/.test(token.access_token)
    || typeof token.token_type !== 'string' || token.token_type.toLowerCase() !== 'bearer'
    || typeof token.expires_in !== 'number' || !Number.isSafeInteger(token.expires_in)
    || token.expires_in <= 0 || typeof token.scope !== 'string') {
    throw new Error('Buffer could not complete the connection. Start the connection again.');
  }

  const scopes = [...new Set(token.scope.trim().split(/\s+/))];
  if (scopes.length !== SCOPES.length || !SCOPES.every((scope) => scopes.includes(scope))) {
    throw new Error('Buffer returned different permissions than Patchwork requested. Reconnect and review the permissions.');
  }

  // Use the earlier time so exchange latency never extends the provider's lifetime.
  const expiresAt = startedAt + Math.min(token.expires_in, 3600) * 1000;
  if (expiresAt <= Date.now()) {
    throw new Error('The Buffer connection expired. Start the connection again.');
  }
  return { accessToken: token.access_token, expiresAt, scopes };
}
