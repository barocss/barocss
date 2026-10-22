import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

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
]);
// The GPU package's bundle keeps CAD external (G18.1): served here with CAD's built entry folded in, so the pages
// import one script (their CSP admits no inline import map). Built once, on the first request.
let gpuBundle = null;
const gpuScript = () => gpuBundle ??= build({
  entryPoints: [path.join(repo, 'packages/barocss-gpu/dist/index.js')], bundle: true, format: 'esm', platform: 'browser', write: false,
  alias: { '@barocss/cad': path.join(repo, 'packages/barocss-cad/dist/index.js') }, logLevel: 'silent',
}).then(r => r.outputFiles[0].contents).catch(error => { gpuBundle = null; throw error; });

export async function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' || (!files.has(req.url) && req.url !== '/gpu.js')) {
      res.writeHead(404); res.end('Not found'); return;
    }
    try {
      const [type, bytes] = req.url === '/gpu.js' ? ['text/javascript; charset=utf-8', await gpuScript()] : [files.get(req.url)[0], await readFile(files.get(req.url)[1])];
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store',
        'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'" });
      res.end(bytes);
    } catch {
      res.writeHead(500); res.end('Build the GPU and CAD packages (pnpm build:library in each) before starting the example');
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
