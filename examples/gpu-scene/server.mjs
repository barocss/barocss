import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
// Exact routes only: request paths never become filesystem paths.
const files = new Map([
  ['/scene.css', ['text/css; charset=utf-8', path.join(here,'style.css')]],
  ['/mesh.css', ['text/css; charset=utf-8', path.join(here,'mesh-style.css')]],
  ['/mesh.html', ['text/html; charset=utf-8', path.join(here, 'mesh.html')]],
  ['/mesh.js', ['text/javascript; charset=utf-8', path.join(here, 'mesh.js')]],
  ['/mesh-fixtures.js', ['text/javascript; charset=utf-8', path.join(here, 'mesh-fixtures.mjs')]],
  ['/', ['text/html; charset=utf-8', path.join(here, 'index.html')]],
  ['/app.js', ['text/javascript; charset=utf-8', path.join(here, 'app.js')]],
  ['/gpu.js', ['text/javascript; charset=utf-8', path.join(repo, 'packages/barocss-gpu/dist/index.js')]],
]);

export async function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' || !files.has(req.url)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    try {
      const [type, filename] = files.get(req.url);
      const bytes = await readFile(filename);
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store',
        'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'" });
      res.end(bytes);
    } catch {
      res.writeHead(500); res.end('Build the GPU package before starting the example');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? '5180');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1..65535');
  const running = await startServer(port);
  console.log(`GPU scene example: ${running.url}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await running.close(); process.exit(0); });
}
