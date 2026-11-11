import { type NextRequest, NextResponse } from 'next/server';
import type { Workspace } from '../../../domain/workspace.ts';
import { acceptsOAuthOrigin, privateHeaders, readSessionId, requestOrigin, setSessionCookie, workspaceRuntime } from '../../../server/auth/runtime.ts';
import { WorkspaceError } from '../../../server/campaigns/service.ts';

export const runtime = 'nodejs';
export const maxDuration = 300;
const maxRequestBytes = 16 * 1024;
const initialSampleActions = new Set(['preview', 'bind', 'unbind', 'remove-draft', 'delete-campaign']);

function failure(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: privateHeaders });
}

function report(error: unknown): NextResponse {
  return error instanceof WorkspaceError
    ? failure(error.status, error.message)
    : failure(500, 'Patchwork could not load this workspace. Try again.');
}

async function respond(request: NextRequest, workspace: Workspace, newId?: string): Promise<NextResponse> {
  const { oauth, store } = workspaceRuntime();
  const configured = Boolean(oauth && acceptsOAuthOrigin(request, oauth.redirectUri));
  const response = NextResponse.json({ ...workspace, configured }, { headers: privateHeaders });
  if (newId) {
    const session = await store.getSession(newId, Date.now());
    if (!session) return failure(401, 'Your workspace session expired. Reload to start again.');
    setSessionCookie(request, response, newId, session.expiresAt);
  }
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { service, prune, lazySample } = workspaceRuntime();
    const id = readSessionId(request);
    if (id || !lazySample) await prune(Date.now());
    if (id) {
      try { return await respond(request, await service.view(id)); }
      catch (error) {
        if (!(error instanceof WorkspaceError) || error.status !== 401) throw error;
      }
    }
    if (lazySample) {
      const response = await respond(request, service.sample());
      if (id) setSessionCookie(request, response, id, 0);
      return response;
    }
    const newId = await service.createSample();
    return await respond(request, await service.view(newId), newId);
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
    const { store, service, prune, lazySample } = workspaceRuntime();
    const id = readSessionId(request);
    if ((!id && !lazySample) || (id && !await store.getSession(id, Date.now()))) {
      return failure(401, 'Your workspace session expired. Reload to start again.');
    }

    const input = await readAction(request);
    if (input instanceof NextResponse) return input;
    if (!id) {
      if (input.action === 'sample') return await respond(request, service.sample());
      if (typeof input.action !== 'string' || !initialSampleActions.has(input.action)) {
        return failure(400, 'Choose a valid sample action.');
      }
      await prune(Date.now());
      const newId = await service.createSample();
      return await respond(request, await service.act(newId, input), newId);
    }
    if (input.action === 'disconnect' || input.action === 'sample') {
      const newId = await service.disconnect(id);
      return await respond(request, await service.view(newId), newId);
    }
    return await respond(request, await service.act(id, input));
  } catch (error) {
    return report(error);
  }
}
