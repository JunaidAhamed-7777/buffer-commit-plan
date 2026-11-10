import { spawnSync } from 'node:child_process';
import { randomBytes, X509Certificate } from 'node:crypto';
import { createServer } from 'node:https';
import { resolve } from 'node:path';
import next from 'next';

const origin = 'https://localhost:3000';
const port = 3000;

function localCertificate() {
  const env = { ...process.env };
  delete env.BUFFER_CLIENT_ID;
  delete env.BUFFER_CLIENT_SECRET;
  delete env.PATCHWORK_TOKEN_KEY;
  const result = spawnSync(process.env.PATCHWORK_OPENSSL_PATH || 'openssl', [
    'req', '-new', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-sha256',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost',
    '-addext', 'basicConstraints=critical,CA:FALSE', '-keyout', '-', '-out', '-',
  ], { encoding: 'utf8', env, windowsHide: true, timeout: 15_000 });
  const key = result.stdout?.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/)?.[0];
  const cert = result.stdout?.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)?.[0];
  if (result.status !== 0 || !key || !cert) throw new Error('OpenSSL could not generate the localhost certificate.');
  return { key, cert };
}

async function main() {
  if (!process.env.BUFFER_CLIENT_ID?.trim() || !process.env.BUFFER_CLIENT_SECRET?.trim()) {
    throw new Error('Enter the Buffer client credentials through start-buffer-live.ps1.');
  }

  const credentials = localCertificate();
  process.env.BUFFER_REDIRECT_URI = `${origin}/api/buffer/callback`;
  process.env.PATCHWORK_TOKEN_KEY = randomBytes(32).toString('base64url');
  process.env.PATCHWORK_DB_PATH = resolve('.patchwork', 'buffer-live.sqlite');
  process.env.NEXT_TELEMETRY_DISABLED = '1';

  const app = next({ dev: true, hostname: 'localhost', port });
  await app.prepare();
  const handle = app.getRequestHandler();
  const server = createServer(credentials, (request, response) => {
    if (request.headers.host?.toLowerCase() !== 'localhost:3000') {
      response.writeHead(421).end();
      return;
    }
    request.headers['x-forwarded-proto'] = 'https';
    void handle(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  console.log(`Patchwork is ready at ${origin}`);
  console.log(`Local certificate SHA-256 ${new X509Certificate(credentials.cert).fingerprint256}`);
  console.log('Press Ctrl+C to stop. After a restart, disconnect any previous Buffer session and reconnect.');
  process.once('SIGINT', () => {
    server.close();
    server.closeAllConnections();
    void app.close().finally(() => process.exit(0));
  });
}

main().catch((error) => {
  if (error?.code === 'EADDRINUSE') console.error('Port 3000 is in use. Stop the server using it and try again.');
  else if (error?.message === 'OpenSSL could not generate the localhost certificate.'
    || error?.message === 'Enter the Buffer client credentials through start-buffer-live.ps1.') console.error(error.message);
  else console.error('Patchwork could not start the local HTTPS server.');
  process.exit(1);
});
