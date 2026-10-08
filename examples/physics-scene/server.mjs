import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [path.join(here, 'app.js')],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
});
const files = new Map([
  ['/', ['text/html; charset=utf-8', path.join(here, 'index.html')]],
  ['/app.js', ['text/javascript; charset=utf-8', bundle.outputFiles[0].contents]],
  ['/style.css', ['text/css; charset=utf-8', path.join(here, 'style.css')]],
]);

export async function startServer(port = 0) {
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' || !files.has(request.url)) {
      response.writeHead(404); response.end('Not found'); return;
    }
    try {
      const [type, content] = files.get(request.url);
      const bytes = typeof content === 'string' ? await readFile(content) : content;
      response.writeHead(200, {
        'content-type': type,
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
      });
      response.end(bytes);
    } catch {
      response.writeHead(500); response.end('Could not serve Physics example');
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
