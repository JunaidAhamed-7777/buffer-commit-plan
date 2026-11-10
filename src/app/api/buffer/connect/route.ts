import { type NextRequest, NextResponse } from 'next/server';
import { beginOAuth } from '../../../../server/auth/oauth.ts';
import { acceptsOAuthOrigin, privateHeaders, readSessionId, requestOrigin, setSessionCookie, workspaceRuntime } from '../../../../server/auth/runtime.ts';

export const runtime = 'nodejs';

function fromWorkspace(request: NextRequest): boolean {
  const mode = request.headers.get('sec-fetch-mode');
  if (mode && mode !== 'navigate') return false;
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';

  const referer = request.headers.get('referer');
  try {
    return Boolean(referer && new URL(referer).origin === requestOrigin(request));
  } catch {
    return false;
  }
}

export function GET(request: NextRequest): NextResponse {
  const failure = () => new NextResponse(null, { status: 303, headers: { ...privateHeaders, Location: '/?connection=error' } });
  if (!fromWorkspace(request)) return failure();

  try {
    const { store, service, oauth, seal } = workspaceRuntime();
    if (!oauth || !acceptsOAuthOrigin(request, oauth.redirectUri)) return failure();

    const now = Date.now();
    const id = readSessionId(request);
    const session = id ? store.getSession(id, now) : undefined;
    if (session?.accountId) return failure();
    const sessionId = session && id ? id : service.createSample();
    const active = store.getSession(sessionId, now);
    if (!active) return failure();

    const attempt = beginOAuth(oauth);
    store.putOAuth(sessionId, {
      state: attempt.state,
      verifier: seal(attempt.verifier, `oauth:${sessionId}`),
      expiresAt: Math.min(attempt.expiresAt, active.expiresAt),
    });
    const response = NextResponse.redirect(attempt.url, { status: 303, headers: privateHeaders });
    if (!session) setSessionCookie(request, response, sessionId, active.expiresAt);
    return response;
  } catch {
    return failure();
  }
}
