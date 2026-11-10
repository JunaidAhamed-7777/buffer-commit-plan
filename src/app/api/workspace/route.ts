import { type NextRequest, NextResponse } from 'next/server';
import type { Workspace } from '../../../domain/workspace.ts';
import { acceptsOAuthOrigin, privateHeaders, readSessionId, requestOrigin, setSessionCookie, workspaceRuntime } from '../../../server/auth/runtime.ts';
import { WorkspaceError } from '../../../server/campaigns/service.ts';

export const runtime = 'nodejs';
const maxRequestBytes = 16 * 1024;

function failure(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: privateHeaders });
}

function report(error: unknown): NextResponse {
  return error instanceof WorkspaceError
    ? failure(error.status, error.message)
    : failure(500, 'Patchwork could not load this workspace. Try again.');
}

function respond(request: NextRequest, workspace: Workspace, newId?: string): NextResponse {
  const { oauth, store } = workspaceRuntime();
  const configured = Boolean(oauth && acceptsOAuthOrigin(request, oauth.redirectUri));
  const response = NextResponse.json({ ...workspace, configured }, { headers: privateHeaders });
  if (newId) {
    const session = store.getSession(newId, Date.now());
    if (!session) return failure(401, 'Your workspace session expired. Reload to start again.');
    setSessionCookie(request, response, newId, session.expiresAt);
  }
  return response;
}

export function GET(request: NextRequest): NextResponse {
  try {
    const { store, service } = workspaceRuntime();
    const now = Date.now();
    store.prune(now);
    const id = readSessionId(request);
    if (id && store.getSession(id, now)) return respond(request, service.view(id));
    const newId = service.createSample();
    return respond(request, service.view(newId), newId);
  } catch (error) {
    return report(error);
  }
}

async function readAction(request: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return failure(415, 'Send the workspace action as JSON.');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxRequestBytes)) {
    return failure(413, 'This workspace action is too large.');
  }
  if (!request.body) return failure(400, 'Choose a workspace action.');

  const reader = request.body.getReader();
  const bytes = new Uint8Array(maxRequestBytes);
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > maxRequestBytes) {
        void reader.cancel().catch(() => {});
        return failure(413, 'This workspace action is too large.');
      }
      bytes.set(value, offset);
      offset += value.length;
    }
    const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset)));
    if (input && typeof input === 'object' && !Array.isArray(input)) return input as Record<string, unknown>;
  } catch {
    return failure(400, 'The workspace action is not valid JSON.');
  } finally {
    reader.releaseLock();
  }
  return failure(400, 'Choose a workspace action.');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (request.headers.get('origin') !== requestOrigin(request)) {
    return failure(403, 'Open Patchwork to change this workspace.');
  }
  try {
    const { store, service } = workspaceRuntime();
    const id = readSessionId(request);
    if (!id || !store.getSession(id, Date.now())) return failure(401, 'Your workspace session expired. Reload to start again.');

    const input = await readAction(request);
    if (input instanceof NextResponse) return input;
    if (input.action === 'disconnect' || input.action === 'sample') {
      const newId = service.disconnect(id);
      return respond(request, service.view(newId), newId);
    }
    return respond(request, await service.act(id, input));
  } catch (error) {
    return report(error);
  }
}
