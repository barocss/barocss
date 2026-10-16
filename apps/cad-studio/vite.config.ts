import { defineConfig, type Connect, type Plugin } from 'vite';
import { connect } from 'node:net';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../..');
// The chat server (`pnpm chat`, scripts/chat-server.mjs) runs the claude CLI for the chat panel.
// The Host is kept (no changeOrigin): the chat server accepts only requests whose Origin or Host is the studio's.
const chatPort = Number(process.env.CAD_STUDIO_CHAT_PORT ?? 52021);
const chat = { target: `http://127.0.0.1:${chatPort}`, changeOrigin: false };

// Without the chat server the proxy answers 502, which the browser logs as an error each time the chat
// panel asks: the dev server answers the status request itself when nothing listens there.
const listening = () => new Promise<boolean>(done => {
  const socket = connect(chatPort, '127.0.0.1'), end = (up: boolean) => { socket.destroy(); done(up); };
  socket.once('connect', () => end(true)); socket.once('error', () => end(false)); socket.setTimeout(500, () => end(false));
});
const chatOff: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url?.split('?')[0] !== '/api/chat/status') return next();
  void listening().then(up => {
    if (up) return next();
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ enabled: false }));
  });
};
const chatStatusOff: Plugin = { name: 'cad-studio-chat-status-off', configureServer: s => { s.middlewares.use(chatOff); }, configurePreviewServer: s => { s.middlewares.use(chatOff); } };

export default defineConfig({
  plugins: [chatStatusOff],
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 52020, strictPort: true, fs: { allow: [repo] }, proxy: { '/api/chat': chat } },
  preview: { proxy: { '/api/chat': chat } },
  build: { target: 'es2022', outDir: 'dist' },
});
