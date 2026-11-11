import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { isAbsolute } from 'node:path';
import type { NextRequest, NextResponse } from 'next/server';
import { BufferAdapter } from '../buffer/adapter.ts';
import type { WorkspaceData } from '../campaigns/model.ts';
import { WorkspaceService } from '../campaigns/service.ts';
import { PostgresWorkspaceStore } from '../storage/postgres.ts';
import { WorkspaceStore } from '../storage/store.ts';
import { bufferAccess } from './access.ts';
import { getOAuthConfig } from './oauth.ts';

const sessionIdFormat = /^[A-Za-z0-9_-]{43}$/;

export const privateHeaders = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function tokenKey(): Buffer | undefined {
  const value = process.env.PATCHWORK_TOKEN_KEY;
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) return undefined;
  const decoded = Buffer.from(value, 'base64url');
  return decoded.length === 32 && decoded.toString('base64url') === value ? decoded : undefined;
}

function createRuntime() {
  const explicitPath = process.env.PATCHWORK_DB_PATH?.trim();
  const vercel = process.env.VERCEL === '1';
  const databaseUrl = (vercel || !explicitPath) ? process.env.DATABASE_URL?.trim() : undefined;
  const store = databaseUrl
    ? new PostgresWorkspaceStore<WorkspaceData>(databaseUrl)
    : new WorkspaceStore<WorkspaceData>(vercel ? ':memory:' : explicitPath || '.patchwork/patchwork.sqlite');
  const key = tokenKey();
  const config = getOAuthConfig();
  const redirect = config ? new URL(config.redirectUri) : undefined;
  const access = redirect ? bufferAccess(redirect) : undefined;
  const hostedProduction = process.env.NODE_ENV === 'production' && redirect && access !== null;
  const oauth = config && key && redirect?.pathname === '/api/buffer/callback' && access !== undefined
    && (!vercel || (databaseUrl && process.env.VERCEL_ENV === 'production'))
    && (databaseUrl || (explicitPath !== ':memory:' && (!hostedProduction || (explicitPath && isAbsolute(explicitPath)))))
    ? config : undefined;

  function seal(value: string, context: string): string {
    if (!key) throw new Error('Credential storage is unavailable.');
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(context));
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `v1.${nonce.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  function unseal(value: string, context: string): string {
    if (!key) throw new Error('Credential storage is unavailable.');
    const parts = value.split('.');
    const [version, nonce, tag, encrypted] = parts;
    if (parts.length !== 4 || version !== 'v1' || !/^[A-Za-z0-9_-]{16}$/.test(nonce)
      || !/^[A-Za-z0-9_-]{22}$/.test(tag) || !/^[A-Za-z0-9_-]+$/.test(encrypted)) {
      throw new Error('Stored credentials are invalid.');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'base64url'), { authTagLength: 16 });
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
  }

  const service = new WorkspaceService(store, (sealedToken, accountId) => {
    if (!oauth) throw new Error('The Buffer connection is unavailable.');
    return new BufferAdapter(unseal(sealedToken, `buffer:${accountId}`));
  }, Boolean(oauth), access ?? undefined);
  let nextPrune = 0;
  async function prune(now: number) {
    if (now < nextPrune) return;
    nextPrune = now + 60_000;
    try { await store.transaction(transaction => transaction.prune(now)); }
    catch (error) { nextPrune = 0; throw error; }
  }

  return { store, service, oauth, access, seal, unseal, prune, lazySample: vercel && Boolean(databaseUrl) };
}

const processRuntime = globalThis as typeof globalThis & { patchworkRuntime?: ReturnType<typeof createRuntime> };

export function workspaceRuntime() {
  return processRuntime.patchworkRuntime ??= createRuntime();
}

function isSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === 'https:';
}

function cookieName(request: NextRequest): string {
  return isSecure(request) ? '__Host-patchwork-session' : 'patchwork-session';
}

export function readSessionId(request: NextRequest): string | undefined {
  const id = request.cookies.get(cookieName(request))?.value;
  return id && sessionIdFormat.test(id) ? id : undefined;
}

export function setSessionCookie(request: NextRequest, response: NextResponse, id: string, expiresAt: number): void {
  response.cookies.set(cookieName(request), id, {
    httpOnly: true,
    secure: isSecure(request),
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  });
}

export function requestOrigin(request: NextRequest): string | undefined {
  const host = request.headers.get('host');
  if (!host) return request.nextUrl.origin;
  try {
    // Next can construct nextUrl with its listen address behind a proxy.
    const url = new URL(`${request.nextUrl.protocol}//${host}`);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function acceptsOAuthOrigin(request: NextRequest, redirectUri: string): boolean {
  return requestOrigin(request) === new URL(redirectUri).origin;
}
