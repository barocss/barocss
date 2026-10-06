import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const files = new Map([
  ['/', ['text/html; charset=utf-8', path.join(here, 'gallery.html')]],
  ['/workspace.html', ['text/html; charset=utf-8', path.join(here, 'index.html')]],
  ['/gallery.css', ['text/css; charset=utf-8', path.join(here, 'gallery.css')]],
  ...['cad-edge-overlay.mjs','gallery.mjs','app.mjs','pipeline.mjs','fixtures.mjs','inspector.mjs','parameters.mjs','orbit.mjs','primitives.mjs','project.mjs','history.mjs','box-preview.mjs'].map(name => [`/${name}`, ['text/javascript; charset=utf-8', path.join(here, name)]]),
  ['/body-workspace.css', ['text/css; charset=utf-8', path.join(here,'body-workspace.css')]],
  ['/body-workspace.mjs', ['text/javascript; charset=utf-8', path.join(here,'body-workspace.mjs')]],
  ['/style.css', ['text/css; charset=utf-8', path.join(here,'style.css')]],
  ['/gpu.js', ['text/javascript; charset=utf-8', path.join(repo,'packages/barocss-gpu/dist/index.js')]],
  ['/cad.js', ['text/javascript; charset=utf-8', path.join(repo,'packages/barocss-cad/dist/index.js')]],
  ...['types', 'math', 'iges', 'packet', 'preview', 'extrusion', 'derivatives', 'boundary', 'face', 'adjacency', 'orthogonal-adjacency', 'box-shell', 'box-solid', 'model-compiler', 'source-ast', 'semantic-model', 'lower-model', 'construction-types', 'extrusion-validation', 'expression-parser', 'parameter-semantics', 'data-copy', 'xy-profile', 'curve-source', 'xy-arc', 'axis-rectangle-extrusion', 'axis-rectangle-feature-document', 'xy-linear-sketch'].map(name => [`/${name}.js`, ['text/javascript; charset=utf-8', path.join(repo,`packages/barocss-cad/dist/${name}.js`)]]),
]);
export const csp = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
export async function startServer(port = 0) {
  const server = createServer(async (req,res) => {
    if (!/^(?:127\.0\.0\.1|localhost)(?::[0-9]+)?$/.test(req.headers.host ?? '') || req.method !== 'GET' || !files.has(req.url)) { res.writeHead(404);res.end('Not found');return; }
    try {
      const [type,file] = files.get(req.url), bytes = await readFile(file);
      res.writeHead(200, {'content-type':type,'content-security-policy':csp,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(bytes);
    } catch { res.writeHead(500);res.end('Build the CAD and GPU packages before starting this example.'); }
  });
  await new Promise((resolve,reject) => { server.once('error',reject);server.listen(port,'127.0.0.1',resolve); });
  return { server,url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 5182);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError('PORT must be 1..65535');
  const running = await startServer(port);console.log(`CAD preview: ${running.url}`);
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await running.close();process.exit(0);});
}
