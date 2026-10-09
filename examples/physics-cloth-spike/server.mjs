import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const metadata = { gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceTreeDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0 };
const bundle = await build({ entryPoints: [new URL('browser.mjs', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const html = await readFile(new URL('index.html', import.meta.url));
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    if (request.method === 'POST' && path === '/result') {
      let body = '';
      for await (const chunk of request) {
        body += chunk.toString();
        if (body.length > 65536) { response.writeHead(413).end(); return; }
      }
      const report = { ...JSON.parse(body), ...metadata };
      if (process.env.CLOTH_SPIKE_EVIDENCE) await writeFile(process.env.CLOTH_SPIKE_EVIDENCE,
        JSON.stringify(report, null, 2) + '\n');
      response.writeHead(204).end(); return;
    }
    if (request.method !== 'GET' || !['/', '/bundle.js'].includes(path)) {
      response.writeHead(404).end(); return;
    }
    response.writeHead(200, { 'content-type': path === '/' ? 'text/html' : 'text/javascript',
      'cache-control': 'no-store' }).end(path === '/' ? html : bundle.outputFiles[0].contents);
  } catch (error) { response.writeHead(500).end(String(error)); }
});
const port = Number(process.env.CLOTH_SPIKE_PORT || 52991);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
server.listen(port, '127.0.0.1', () => console.log(`Cloth CPU trial: http://127.0.0.1:${port}/`));
