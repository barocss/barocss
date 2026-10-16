// Starts the chat server (server/chatServer.ts) on 127.0.0.1:52021; the Vite dev server forwards
// /api/chat to it. Each turn runs the `claude` CLI with the studio's tools (server/cadMcp.ts).
//   pnpm chat        (optional: CAD_STUDIO_CHAT_PORT, CAD_STUDIO_CHAT_MODEL, CAD_STUDIO_CLAUDE)
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'cad-studio-chat-server-'));
await build({
  entryPoints: { chatServer: join(root, 'server/chatServer.ts'), cadMcp: join(root, 'server/cadMcp.ts') },
  outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning',
});
const { createChatServer } = await import(pathToFileURL(join(out, 'chatServer.mjs')).href);
const handler = createChatServer({ mcpScript: join(out, 'cadMcp.mjs') });
const port = Number(process.env.CAD_STUDIO_CHAT_PORT ?? 52021);
createServer((req, res) => { void handler(req, res); }).listen(port, '127.0.0.1', () => console.log(`cad-studio chat server on http://127.0.0.1:${port} (claude CLI)`));
