import { defineConfig, type Connect, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
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
// (So too the team libraries' list, LIB4: none without the chat server.)
const chatOff: Connect.NextHandleFunction = (req, res, next) => {
  const path = req.url?.split('?')[0];
  if (path !== '/api/chat/status' && !(path === '/api/chat/libraries' && req.method === 'GET')) return next();
  void listening().then(up => {
    if (up) return next();
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(path === '/api/chat/status' ? { enabled: false } : { libraries: [], note: 'No chat server: no team libraries.' }));
  });
};
const chatStatusOff: Plugin = { name: 'cad-studio-chat-status-off', configureServer: s => { s.middlewares.use(chatOff); }, configurePreviewServer: s => { s.middlewares.use(chatOff); } };

export default defineConfig({
  // (G12b: Tailwind v4 for the shadcn/ui components; `@/` is src/, as components.json has it.)
  plugins: [tailwindcss(), chatStatusOff],
  // Linked workspace dependencies must share the app's React dispatcher.
  resolve: { alias: [{ find: /^@\//, replacement: resolve(import.meta.dirname, 'src') + '/' }], dedupe: ['react', 'react-dom'] },
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 52020, strictPort: true, fs: { allow: [repo] }, proxy: { '/api/chat': chat } },
  preview: { proxy: { '/api/chat': chat } },
  build: {
    target: 'es2022', outDir: 'dist',
    // The kernel's modules have no side effects at load (checked: no top-level statements but declarations),
    // so its parts that only lazily loaded code uses (the direct curve and surface tools) stay out of the
    // first load instead of riding along in the chunk the app shares with them.
    rolldownOptions: { treeshake: { moduleSideEffects: (id: string) => !/[\\/]packages[\\/]barocss-cad[\\/]src[\\/]/.test(id) } },
  },
});
