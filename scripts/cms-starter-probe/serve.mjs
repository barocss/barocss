// Static server for a built `dist`: node serve.mjs <distDir> <port>  (dir/ -> dir/index.html)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const [dir, port] = process.argv.slice(2);
const T = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
http.createServer((q, r) => {
  let f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(+port, '127.0.0.1');
