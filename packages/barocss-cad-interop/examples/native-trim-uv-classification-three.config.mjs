import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const originals = new Map(['dyadic', 'primary', 'edited'].flatMap(prefix =>
  ['actual-trim-model8', 'original-support-whole', 'original-plane-whole'].map(suffix => {
    const name = `${prefix}.${suffix}.source0.css`;
    return [`/packages/barocss-cad-interop/examples/native-trim-uv-classification-three-data/${name}`,
      new URL(`./native-trim-uv-classification-three-data/${name}`, import.meta.url)];
  })));

export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  appType: 'mpa',
  server: { port: 5206, strictPort: true },
  optimizeDeps: {
    entries: ['packages/barocss-cad-interop/examples/native-trim-uv-classification-three.html'],
    include: ['three'],
  },
  plugins: [{ name: 'original-trim-source-http-bytes', configureServer(server) {
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
