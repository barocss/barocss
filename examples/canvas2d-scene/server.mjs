import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/examples/canvas2d-scene/oversize-url-test.png') {
      response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      response.write(Buffer.alloc(5 * 1024 * 1024));
      response.end(Buffer.alloc(4 * 1024 * 1024));
      return;
    }
    const filePath = pathname === '/' ? '/examples/canvas2d-scene/index.html' :
      pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const path = resolve(root, `.${filePath}`);
    if (!path.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
    const bytes = await readFile(path);
    response.writeHead(200, { 'content-type': `${mime[extname(path)] || 'application/octet-stream'}; charset=utf-8`,
      'cache-control': 'no-store' }).end(bytes);
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(Number(process.env.PORT || 0), '127.0.0.1', () => {
  console.log(`Canvas2D scene: http://127.0.0.1:${server.address().port}/examples/canvas2d-scene/`);
});
