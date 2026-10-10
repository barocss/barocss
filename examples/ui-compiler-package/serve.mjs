import http from 'node:http';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileUi } from './.build/consumer.mjs';

export async function createFixtureServer() {
  const source = await fs.readFile(new URL('./app.jsx', import.meta.url), 'utf8');
  const artifact = await compileUi(source, { moduleId: 'counter' });
  const shell = await fs.readFile(new URL('./shell.mjs', import.meta.url));
  const nonce = randomBytes(18).toString('base64');
  const server = http.createServer((req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const url = new URL(req.url, origin);
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    const send = (status, type, body, policy) => {
      res.writeHead(status, { ...headers, 'content-type': type, 'content-security-policy': policy });
      res.end(body);
    };
    const shellPolicy = "default-src 'none'; script-src 'self'; frame-src 'self'; base-uri 'none'";
    const framePolicy = `default-src 'none'; script-src 'self'; style-src 'nonce-${nonce}'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`;
    if (req.method === 'GET' && url.pathname === '/')
      return send(200, 'text/html; charset=utf-8', `<!doctype html><html><meta charset="utf-8"><meta name="bundle-digest" content="${artifact.bundleDigest}"><title>UI compiler fixture</title><div id="frame"></div><script src="/shell.mjs" type="module"></script></html>`, shellPolicy);
    if (req.method === 'GET' && url.pathname === '/shell.mjs') return send(200, 'text/javascript', shell, shellPolicy);
    if (req.method === 'GET' && url.pathname === `/bundle/${artifact.bundleDigest}.js`)
      return send(200, 'text/javascript', artifact.bundle, framePolicy);
    if (req.method === 'GET' && url.pathname === `/frame/${artifact.bundleDigest}.html`
      && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(url.searchParams.get('instanceId') ?? ''))
      return send(200, 'text/html; charset=utf-8', `<!doctype html><html><meta charset="utf-8"><meta name="host-origin" content="${origin}"><meta name="instance-id" content="${url.searchParams.get('instanceId')}"><meta name="bundle-digest" content="${artifact.bundleDigest}"><style nonce="${nonce}">body{font:16px system-ui}${artifact.css}</style><div id="app"></div><script src="/bundle/${artifact.bundleDigest}.js"></script></html>`, framePolicy);
    return send(404, 'text/plain', 'Not found', shellPolicy);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, artifact,
    async close() { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await createFixtureServer();
  console.log(app.url);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
