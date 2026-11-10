import { createHash } from 'node:crypto';
import { readBoundedJson } from './read-json.ts';

export type EligibleDraft = { id: string; channel: string; text: string; eligibility: string };

export type EditResult =
  | { kind: 'success'; reason?: string }
  | { kind: 'rejected'; reason: string; retryAt?: number }
  | { kind: 'unknown'; reason: string };

type JsonObject = Record<string, unknown>;
type GraphError = { code?: string; path?: readonly unknown[] };
type GraphResponse = { status: number; retryAfter: string | null; body: JsonObject };
type Eligibility = { kind: 'eligible'; draft: EligibleDraft } | { kind: 'unsupported' | 'incomplete' };

const API_URL = 'https://api.buffer.com';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const PAGE_SIZE = 20;

const ACCOUNT_QUERY = `query PatchworkAccount {
  account { id organizations { id name } }
}`;

// Read the same fields at import, final preflight and verification.
const DRAFT_FIELDS = `
  id text status dueAt sentAt isCustomScheduled allowedActions channelId
  channel { id name service organizationId isDisconnected isLocked }
  assets { __typename }
  metadata {
    __typename
    ... on BlueskyPostMetadata {
      type annotations { __typename } linkAttachment { __typename }
      threadCount thread { __typename }
    }
    ... on LinkedInPostMetadata {
      type annotations { __typename } linkAttachment { __typename } firstComment
    }
  }
`;

const DRAFTS_QUERY = `query PatchworkDrafts($input: PostsInput!, $first: Int!, $after: String) {
  posts(input: $input, first: $first, after: $after) {
    edges { node { ${DRAFT_FIELDS} } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const DRAFT_QUERY = `query PatchworkDraft($input: PostInput!) {
  post(input: $input) { ${DRAFT_FIELDS} }
}`;

const EDIT_MUTATION = `mutation PatchworkEdit($input: EditPostInput!) {
  editPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id } }
    ... on MutationError { message }
  }
}`;

const REJECTIONS = new Map([
  ['InvalidInputError', 'Buffer rejected this draft text. Review the change before trying again.'],
  ['UnauthorizedError', 'Buffer denied permission to edit this draft. Check the connection and draft access.'],
  ['NotFoundError', 'Buffer could not find the draft. Check it in Buffer before making a new review.'],
]);

const SYSTEM_ERRORS = new Set(['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'UNEXPECTED', 'RATE_LIMIT_EXCEEDED']);

function object(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function readErrors(body: JsonObject): GraphError[] | null {
  if (body.errors === undefined) return [];
  if (!Array.isArray(body.errors)) return null;

  const errors: GraphError[] = [];
  for (const value of body.errors) {
    const error = object(value);
    if (!error || !nonempty(error.message)) return null;
    if (error.path !== undefined && !Array.isArray(error.path)) return null;
    const code = object(error.extensions)?.code;
    errors.push({ code: typeof code === 'string' ? code : undefined, path: error.path });
  }
  return errors;
}

function classifyDraft(value: unknown, organizationId: string): Eligibility {
  const post = object(value);
  const channel = object(post?.channel);
  if (!post || !channel || !nonempty(post.id) || !nonempty(post.channelId)
    || !nonempty(channel.id) || !nonempty(channel.organizationId) || !nonempty(channel.service)
    || !nonempty(channel.name) || typeof post.status !== 'string' || typeof post.text !== 'string'
    || typeof channel.isDisconnected !== 'boolean' || typeof channel.isLocked !== 'boolean'
    || typeof post.isCustomScheduled !== 'boolean' || post.dueAt === undefined || post.sentAt === undefined
    || !stringArray(post.allowedActions) || !Array.isArray(post.assets)) return { kind: 'incomplete' };

  if (post.channelId !== channel.id) return { kind: 'incomplete' };
  if (channel.organizationId !== organizationId || channel.isDisconnected || channel.isLocked
    || post.status !== 'draft' || post.dueAt !== null || post.sentAt !== null || post.isCustomScheduled
    || !post.allowedActions.includes('updatePost') || post.assets.length || !post.text.trim()) {
    return { kind: 'unsupported' };
  }

  const service = channel.service;
  if (service !== 'bluesky' && service !== 'linkedin') return { kind: 'unsupported' };

  const metadata = object(post.metadata);
  if (!metadata || !nonempty(metadata.__typename)) return { kind: 'incomplete' };
  const expectedType = service === 'bluesky' ? 'BlueskyPostMetadata' : 'LinkedInPostMetadata';
  if (metadata.__typename !== expectedType) return { kind: 'unsupported' };
  if (typeof metadata.type !== 'string' || !Array.isArray(metadata.annotations)
    || metadata.linkAttachment === undefined) return { kind: 'incomplete' };
  if (metadata.type !== 'post' || metadata.annotations.length || metadata.linkAttachment !== null) {
    return { kind: 'unsupported' };
  }

  if (service === 'bluesky') {
    if (!Number.isSafeInteger(metadata.threadCount) || !Array.isArray(metadata.thread)) {
      return { kind: 'incomplete' };
    }
    if (metadata.threadCount !== 0 || metadata.thread.length) return { kind: 'unsupported' };
  } else {
    if (metadata.firstComment === undefined) return { kind: 'incomplete' };
    if (metadata.firstComment !== null) return { kind: 'unsupported' };
  }

  // The classifier fixes every other required eligibility field to its safe value.
  const eligibility = createHash('sha256').update(JSON.stringify([
    'draft-v1', organizationId, post.id, channel.id, service, [...new Set(post.allowedActions)].sort(),
  ])).digest('base64url');
  const serviceName = service === 'bluesky' ? 'Bluesky' : 'LinkedIn';
  return {
    kind: 'eligible',
    draft: { id: post.id, channel: `${serviceName} · ${channel.name}`, text: post.text, eligibility },
  };
}

function retryTime(header: string | null): number | undefined {
  if (!header || !/^\d+$/.test(header)) return undefined;
  const retryAt = Date.now() + Number(header) * 1000;
  return Number.isFinite(new Date(retryAt).getTime()) ? retryAt : undefined;
}

function unavailable(): Error {
  return new Error('Buffer could not confirm the requested data. Check the connection and try again.');
}

export class BufferAdapter {
  readonly #accessToken: string;
  readonly #request: typeof fetch;

  constructor(accessToken: string, request: typeof fetch = fetch) {
    this.#accessToken = accessToken;
    this.#request = request;
  }

  async account(): Promise<{ id: string; organizations: { id: string; name: string }[] }> {
    const data = await this.#read(ACCOUNT_QUERY, {});
    const account = object(data.account);
    if (!account || !nonempty(account.id) || !Array.isArray(account.organizations)) throw unavailable();
    const organizations = account.organizations.map((value: unknown) => {
      const organization = object(value);
      if (!organization || !nonempty(organization.id) || !nonempty(organization.name)) throw unavailable();
      return { id: organization.id, name: organization.name };
    });
    return { id: account.id, organizations };
  }

  async drafts(organizationId: string, after?: string): Promise<{ drafts: EligibleDraft[]; nextCursor?: string }> {
    const data = await this.#read(DRAFTS_QUERY, {
      input: { organizationId, filter: { status: ['draft'] } }, first: PAGE_SIZE, after,
    });
    const posts = object(data.posts);
    const pageInfo = object(posts?.pageInfo);
    if (!posts || !Array.isArray(posts.edges) || !pageInfo || typeof pageInfo.hasNextPage !== 'boolean') {
      throw unavailable();
    }

    const drafts: EligibleDraft[] = [];
    for (const edge of posts.edges) {
      const result = classifyDraft(object(edge)?.node, organizationId);
      if (result.kind === 'eligible') drafts.push(result.draft);
    }
    if (!pageInfo.hasNextPage) return { drafts };
    if (!nonempty(pageInfo.endCursor) || pageInfo.endCursor === after) throw unavailable();
    return { drafts, nextCursor: pageInfo.endCursor };
  }

  async draft(organizationId: string, id: string): Promise<EligibleDraft | null> {
    const response = await this.#send(DRAFT_QUERY, { input: { id } });
    const data = object(response.body.data);
    const errors = readErrors(response.body);
    if (response.status !== 200 || !errors) throw unavailable();
    if (errors.length === 1 && errors[0].code === 'NOT_FOUND' && data?.post == null
      && (!errors[0].path || (errors[0].path.length === 1 && errors[0].path[0] === 'post'))) return null;
    if (!data || errors.length || object(data.post)?.id !== id) throw unavailable();

    const result = classifyDraft(data.post, organizationId);
    if (result.kind === 'incomplete') throw unavailable();
    return result.kind === 'eligible' ? result.draft : null;
  }

  async edit(id: string, text: string): Promise<EditResult> {
    const unknown: EditResult = { kind: 'unknown', reason: 'Buffer could not confirm whether this edit finished.' };
    if (!id || !text.trim()) return { kind: 'rejected', reason: 'An edit needs a draft and some text.' };

    let response: GraphResponse;
    try {
      response = await this.#send(EDIT_MUTATION, { input: { id, text } });
    } catch {
      return unknown;
    }

    const errors = readErrors(response.body);
    if (!errors) return unknown;
    if (response.status === 429 && response.body.data == null
      && errors.length === 1 && errors[0].code === 'RATE_LIMIT_EXCEEDED') {
      const retryAt = retryTime(response.retryAfter);
      if (retryAt !== undefined) {
        return { kind: 'rejected', reason: 'Buffer reached its request limit.', retryAt };
      }
    }
    if (response.status !== 200 || errors.some(({ code }) => code && SYSTEM_ERRORS.has(code))) return unknown;

    const result = object(object(response.body.data)?.editPost);
    if (result?.__typename === 'PostActionSuccess' && object(result.post)?.id === id) {
      return errors.length ? { kind: 'success', reason: 'Buffer included a warning. Check the saved draft.' } : { kind: 'success' };
    }
    if (!errors.length && typeof result?.__typename === 'string' && nonempty(result.message)) {
      const reason = REJECTIONS.get(result.__typename);
      if (reason) return { kind: 'rejected', reason };
    }
    return unknown;
  }

  async #read(query: string, variables: JsonObject): Promise<JsonObject> {
    const response = await this.#send(query, variables);
    const data = object(response.body.data);
    if (response.status !== 200 || readErrors(response.body)?.length !== 0 || !data) throw unavailable();
    return data;
  }

  async #send(query: string, variables: JsonObject): Promise<GraphResponse> {
    try {
      const response = await this.#request(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.#accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = object(await readBoundedJson(response, MAX_RESPONSE_BYTES));
      if (body) return { status: response.status, retryAfter: response.headers.get('Retry-After'), body };
    } catch {
      // Provider bodies and transport errors can contain private inputs.
    }
    throw unavailable();
  }
}
