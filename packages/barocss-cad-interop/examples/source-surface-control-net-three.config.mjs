import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const families = ['mixed_weighted', 'signed_zero_only', 'no_op_original_spelling',
  'maximum_64_scalar_patches', 'cold_candidate_reedit'];
const originals = new Map(families.flatMap(key => ['original', 'candidate'].map(state => {
  const file = `${key}.complete-${state}.source0.css`;
  return [`/packages/barocss-cad-interop/examples/source-surface-control-net-three-data/${file}`,
    new URL(`./source-surface-control-net-three-data/${file}`, import.meta.url)];
})));

export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  appType: 'mpa',
  server: { port: 5205, strictPort: true },
  optimizeDeps: {
    entries: ['packages/barocss-cad-interop/examples/source-surface-control-net-three.html'],
    include: ['three'],
  },
  plugins: [{ name: 'complete-source-edit-original-http-bytes', configureServer(server) {
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
