import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { chatProxy } from './server/chatProxy';

const repo = resolve(import.meta.dirname, '../..');

export default defineConfig({
  plugins: [chatProxy()],
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 52020, strictPort: true, fs: { allow: [repo] } },
  build: { target: 'es2022', outDir: 'dist' },
});
