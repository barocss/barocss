import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const data = new URL('./solid-mass-principal-three-data/', import.meta.url);
const css = readdirSync(data).filter(name => name.endsWith('.source0.css'));
if (css.length !== 31) throw new Error('The complete Boolean example requires its 31 original CSS files');
const originals = new Map(css.map(name => [
  `/packages/barocss-cad-interop/examples/solid-mass-principal-three-data/${name}`, new URL(name, data),
]));

export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  appType: 'mpa',
  server: { port: 5231, strictPort: true },
  optimizeDeps: { entries: ['packages/barocss-cad-interop/examples/solid-mass-principal-three.html'], include: ['three'] },
  plugins: [{ name: 'solid-mass-principal-original-source-bytes', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const original = originals.get(new URL(request.url, 'http://localhost').pathname);
      if (!original || !['GET', 'HEAD'].includes(request.method)) { next(); return; }
      const bytes = readFileSync(original);
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.setHeader('Content-Length', bytes.length);
      response.setHeader('Cache-Control', 'no-store');
      response.end(request.method === 'HEAD' ? undefined : bytes);
    });
  } }],
});
