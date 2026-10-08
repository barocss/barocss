import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const files = new Map([
  ['/', ['text/html; charset=utf-8', path.join(here, 'index.html')]],
  ['/app.js', ['text/javascript; charset=utf-8', path.join(here, 'app.js')]],
  ['/style.css', ['text/css; charset=utf-8', path.join(here, 'style.css')]],
  ['/physics.js', ['text/javascript; charset=utf-8', path.join(repo, 'packages/barocss-physics/dist/index.js')]],
]);

export async function startServer(port = 0) {
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' || !files.has(request.url)) {
      response.writeHead(404); response.end('Not found'); return;
    }
    try {
      const [type, filename] = files.get(request.url);
      const bytes = await readFile(filename);
      response.writeHead(200, {
        'content-type': type,
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
      });
      response.end(bytes);
    } catch {
      response.writeHead(500); response.end('Build @barocss/physics before starting the example');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? '5181');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1..65535');
  const running = await startServer(port);
  console.log(`Physics scene example: ${running.url}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await running.close(); process.exit(0); });
}
