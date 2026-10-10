import http from 'node:http';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = new URL('.', import.meta.url);
const child = await fs.readFile(new URL('fixture-child.js', here), 'utf8');
const source = (price) => `const UNIT_PRICE = ${price};\n${child}`;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const artifacts = new Map();
if (process.env.COMPOSED_ARTIFACTS) {
  const values = JSON.parse(await fs.readFile(process.env.COMPOSED_ARTIFACTS, 'utf8'));
  for (const variant of ['base', 'different']) {
    const value = values[variant];
    if (!value || typeof value.bundle !== 'string') throw new Error('Missing composed artifact');
    artifacts.set(variant, { ...value, bundle: Buffer.from(value.bundle, 'base64') });
  }
} else {
  for (const [variant, price] of [['base', 1800], ['different', 2200]]) {
    const text = source(price);
    const bundle = Buffer.from(text);
    const item = { version: 1, moduleId: 'counter', sourceDigest: hash(text), bundleDigest: hash(bundle),
      bundle, css: 'body{font:16px system-ui}button,input{font:inherit}',
      versions: { react: 'fixture', reactDom: 'fixture', esbuild: 'fixture' } };
    artifacts.set(variant, item);
  }
}
artifacts.set('error', artifacts.get('base'));
const byDigest = new Map([...artifacts.values()].map((item) => [item.bundleDigest, item]));
const html = '<!doctype html><html><meta charset="utf-8"><title>UI Runtime fixture</title><div id="frames"></div><script type="module" src="/host.mjs"></script></html>';
const server = http.createServer(async (req, res) => {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = new URL(req.url, origin);
  const send = (status, type, body, policy = "default-src 'none';script-src 'self';frame-src 'self';connect-src 'self';style-src 'self'") => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': policy });
    res.end(body);
  };
  if (req.method !== 'GET' || req.headers.host !== new URL(origin).host) return send(403, 'text/plain', 'Denied');
  if (url.pathname === '/') return send(200, 'text/html', html);
  if (url.pathname === '/host.mjs') return send(200, 'text/javascript', await fs.readFile(new URL('host.mjs', here)));
  if (url.pathname === '/runtime.js') return send(200, 'text/javascript', await fs.readFile(new URL('../../packages/barocss-ui-runtime/dist/index.js', here)));
  const manifest = url.pathname.match(/^\/manifest\/(base|different|error)\.json$/);
  if (manifest) {
    const { bundle, css, versions, ...record } = artifacts.get(manifest[1]);
    return send(200, 'application/json', JSON.stringify(record));
  }
  const resource = url.pathname.match(/^\/(artifact|bundle|frame)\/([a-f0-9]{64})\.(json|js|html)$/);
  if (!resource || !byDigest.has(resource[2])) return send(404, 'text/plain', 'Missing');
  const item = byDigest.get(resource[2]);
  if (resource[1] === 'artifact' && resource[3] === 'json') return send(200, 'application/json', JSON.stringify({
    ...item, bundle: item.bundle.toString('base64'),
  }));
  if (resource[1] === 'bundle' && resource[3] === 'js') return send(200, 'text/javascript', item.bundle);
  if (resource[1] === 'frame' && resource[3] === 'html') {
    const instanceId = url.searchParams.get('instanceId');
    const hostOrigin = url.searchParams.get('hostOrigin');
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(instanceId ?? '') || hostOrigin !== origin)
      return send(400, 'text/plain', 'Invalid frame identity');
    const frame = `<!doctype html><html><meta name="host-origin" content="${origin}"><meta name="instance-id" content="${instanceId}"><meta name="bundle-digest" content="${item.bundleDigest}"><style>${item.css}</style><div id="app"></div><script src="/bundle/${item.bundleDigest}.js"></script></html>`;
    return send(200, 'text/html', frame, "default-src 'none';script-src 'self';style-src 'unsafe-inline';connect-src 'none';frame-ancestors 'self'");
  }
  return send(404, 'text/plain', 'Missing');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
export const url = `http://127.0.0.1:${server.address().port}`;
export const close = () => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); };
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(url);
