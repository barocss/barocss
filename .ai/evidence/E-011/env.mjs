// E-005 environment: serves apps/barocss-site unchanged (arm D = `vite` dev server, arm P = `vite build` + `vite preview`)
// and a forward proxy that is Chromium's only network path. The proxy allows the app's origin (127.0.0.1:<port>) and
// refuses every other host, including other localhost ports (Chromium runs with --proxy-bypass-list=<-loopback>, so
// loopback traffic goes through the proxy too). Refused requests are logged.
import { spawn, execFileSync } from 'node:child_process';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../../..');
// E-011: the site is served from a git worktree pinned at develop bf979c6 (pre-E-008/E-010), so the K10 misses
// still exist. Path-only re-point (AGENTS.md §3): PIN_ROOT is that worktree (default /tmp/e011-pin). Set up with
//   git worktree add /tmp/e011-pin bf979c6 && cd /tmp/e011-pin && pnpm install
export const PIN_ROOT = process.env.PIN_ROOT || '/tmp/e011-pin';
export const SITE = join(PIN_ROOT, 'apps/barocss-site');
export const ARMS = { D: { port: 5190 }, P: { port: 5180 } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startApp(arm) {
  const { port } = ARMS[arm];
  if (arm === 'P') execFileSync('npx', ['vite', 'build'], { cwd: SITE, stdio: 'ignore' });
  const args = arm === 'D' ? ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1']
    : ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'];
  const proc = spawn('npx', args, { cwd: SITE, stdio: 'ignore', detached: true });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) return { url, port, stop: () => { try { process.kill(-proc.pid, 'SIGTERM'); } catch {} } }; } catch {} await sleep(200); }
  throw new Error(`arm ${arm}: app did not start on ${url}`);
}

export function startGuard(allowPort, proxyPort) {
  const allowed = new Set([`127.0.0.1:${allowPort}`, `localhost:${allowPort}`]);
  const refused = [];
  const srv = createServer((rq, rs) => {
    let u; try { u = new URL(rq.url); } catch { rs.writeHead(400); return rs.end(); }
    if (!allowed.has(u.host)) { refused.push({ method: rq.method, url: rq.url.slice(0, 200) }); rs.writeHead(403); return rs.end('blocked by E-005 network guard'); }
    const up = request({ host: '127.0.0.1', port: allowPort, method: rq.method, path: u.pathname + u.search, headers: rq.headers }, (r) => { rs.writeHead(r.statusCode, r.headers); r.pipe(rs); });
    up.on('error', () => { rs.writeHead(502); rs.end(); });
    rq.pipe(up);
  });
  srv.on('connect', (rq, sock, head) => {
    if (!allowed.has(rq.url)) { refused.push({ method: 'CONNECT', url: rq.url }); sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    const up = connect(allowPort, '127.0.0.1', () => { sock.write('HTTP/1.1 200 Connection Established\r\n\r\n'); up.write(head); up.pipe(sock); sock.pipe(up); });
    up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
  });
  return new Promise((ok) => srv.listen(proxyPort, '127.0.0.1', () => ok({ refused, close: () => srv.close() })));
}

export const chromeArgs = (proxyPort) => [`--proxy-server=http://127.0.0.1:${proxyPort}`, '--proxy-bypass-list=<-loopback>'];
