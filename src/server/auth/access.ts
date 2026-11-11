export type BufferAccess = { accountId: string; organizationId: string };
export type BufferAccount = { id: string; organizations: { id: string; name: string }[] };

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export function bufferAccess(
  redirect: URL,
  env: Readonly<Record<string, string | undefined>> = process.env,
): BufferAccess | null | undefined {
  if (loopbackHosts.has(redirect.hostname)) return null;
  const accountId = env.PATCHWORK_BUFFER_ACCOUNT_ID?.trim();
  const organizationId = env.PATCHWORK_BUFFER_ORGANIZATION_ID?.trim();
  if (!accountId || !organizationId) return undefined;
  return { accountId, organizationId };
}

export function admitBufferAccount(account: BufferAccount, access: BufferAccess | null | undefined): BufferAccount | undefined {
  if (access === null) return account;
  if (account.id !== access?.accountId) return undefined;
  const organization = account.organizations.find(org => org.id === access.organizationId);
  return organization ? { id: account.id, organizations: [organization] } : undefined;
}
