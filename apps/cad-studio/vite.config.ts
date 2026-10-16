import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../..');
// The chat server (`pnpm chat`, scripts/chat-server.mjs) runs the claude CLI for the chat panel.
// The Host is kept (no changeOrigin): the chat server accepts only requests whose Origin or Host is the studio's.
const chat = { target: `http://127.0.0.1:${process.env.CAD_STUDIO_CHAT_PORT ?? 52021}`, changeOrigin: false };

export default defineConfig({
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 52020, strictPort: true, fs: { allow: [repo] }, proxy: { '/api/chat': chat } },
  preview: { proxy: { '/api/chat': chat } },
  build: { target: 'es2022', outDir: 'dist' },
});
