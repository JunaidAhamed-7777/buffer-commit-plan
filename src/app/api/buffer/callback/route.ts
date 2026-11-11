import { type NextRequest, NextResponse } from 'next/server';
import { admitBufferAccount } from '../../../../server/auth/access.ts';
import { exchangeOAuthCode } from '../../../../server/auth/oauth.ts';
import { acceptsOAuthOrigin, privateHeaders, readSessionId, setSessionCookie, workspaceRuntime } from '../../../../server/auth/runtime.ts';
import { BufferAdapter } from '../../../../server/buffer/adapter.ts';

export const runtime = 'nodejs';

function redirect(connection: 'denied' | 'error' | 'connected' | 'restricted'): NextResponse {
  return new NextResponse(null, { status: 303, headers: { ...privateHeaders, Location: `/?connection=${connection}` } });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { store, service, oauth, access, seal, unseal } = workspaceRuntime();
    if (!oauth || !acceptsOAuthOrigin(request, oauth.redirectUri)) return redirect('error');
    const id = readSessionId(request);
    const states = request.nextUrl.searchParams.getAll('state');
    if (!id || states.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(states[0])) return redirect('error');

    const attempt = await store.transaction(transaction => transaction.takeOAuth(id, states[0], Date.now()));
    if (!attempt) return redirect('error');
    const errors = request.nextUrl.searchParams.getAll('error');
    if (errors.length) return redirect(errors.length === 1 && errors[0] === 'access_denied' ? 'denied' : 'error');
    const codes = request.nextUrl.searchParams.getAll('code');
    if (codes.length !== 1) return redirect('error');

    const verifier = unseal(attempt.verifier, `oauth:${id}`);
    const token = await exchangeOAuthCode(oauth, codes[0], verifier);
    const account = admitBufferAccount(await new BufferAdapter(token.accessToken).account(), access);
    if (!account) return redirect('restricted');
    const newId = await service.connect(id, seal(token.accessToken, `buffer:${account.id}`), token.expiresAt, account);
    const session = await store.getSession(newId, Date.now());
    if (!session) return redirect('error');
    const response = redirect('connected');
    setSessionCookie(request, response, newId, session.expiresAt);
    return response;
  } catch {
    return redirect('error');
  }
}
