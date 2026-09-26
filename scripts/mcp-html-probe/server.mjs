// #198 probe server: an MCP-Apps-style host that renders a model-written HTML resource in a sandboxed iframe under a
// CSP, with one allowlisted "resource domain" (CDN origin) serving the styling runtime.
//   HOST (port P):     /host?arm=&sec=&csp=  → page with <iframe sandbox="allow-scripts" src="/res?...">
//                      /res?arm=&sec=&csp=   → the resource HTML, served with the CSP header
//   CDN  (port P+1):   /baro.js, /baro-boot.js, /twb.js, /ref/<sec>.css, /probe.js?sec=
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = require('tailwindcss');

export const PORT = Number(process.env.PROBE_PORT || 5310);
const CDN = `http://127.0.0.1:${PORT + 1}`;
export const SECTIONS = fs.readdirSync(path.join(HERE, 'sections')).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
const section = (s) => fs.readFileSync(path.join(HERE, 'sections', `${s}.html`), 'utf8');
export const FILES = {
  baro: process.env.BARO_UMD || path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'),
  twb: path.join(process.env.TWB_DIR || '', 'dist/index.global.js'),
};

// The reference "built" stylesheet: Tailwind 4.1.13 (full: theme + preflight + utilities) for the section's classes.
const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
const refCss = {};
async function ref(sec) {
  if (refCss[sec]) return refCss[sec];
  const c = await compile('@import "tailwindcss";', {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  const tokens = [...section(sec).matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  return (refCss[sec] = c.build([...new Set(tokens)]));
}
// Classes added after load. None of them appear in any section, so a build-time stylesheet can't have them.
export const DYNAMIC = 'bg-rose-500 p-7 rounded-3xl -translate-y-2 shadow-lg ring-2 ring-rose-300';

const CSP = {
  // Typical MCP-Apps host policy: inline allowed, runtime scripts only from the allowlisted resource domain, no eval.
  typical: `default-src 'none'; script-src 'unsafe-inline' ${CDN}; style-src 'unsafe-inline' ${CDN}; img-src data: ${CDN}; font-src ${CDN}; connect-src ${CDN}`,
  // Strict: no inline script or style at all; everything from the allowlisted domain.
  strict: `default-src 'none'; script-src ${CDN}; style-src ${CDN}; img-src data: ${CDN}; font-src ${CDN}; connect-src ${CDN}`,
};

const head = (arm, sec) => ({
  ref: `<link rel="stylesheet" href="${CDN}/ref/${sec}.css">`,
  baro: `<script src="${CDN}/baro.js"></script><script src="${CDN}/baro-boot.js"></script>`,
  // Same runtime with preflight turned on (BrowserRuntime's default config has none).
  baropf: `<script src="${CDN}/baro.js"></script><script src="${CDN}/baro-boot-pf.js"></script>`,
  twb: `<script src="${CDN}/twb.js"></script>`,
  none: '',
}[arm]);

function host(q) {
  return `<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="f" sandbox="allow-scripts" style="width:1280px;height:2400px;border:0" src="/res?${q}"></iframe>
<script>window.__r=[];addEventListener('message',e=>{if(e.data&&e.data.probe)window.__r.push(e.data)});</script>`;
}

function resource(arm, sec) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1280">
<script src="${CDN}/probe.js?sec=${sec}&arm=${arm}"></script>${head(arm, sec)}</head>
<body>${section(sec)}</body></html>`;
}

const PROBE = fs.readFileSync(path.join(HERE, 'probe.js'), 'utf8');

export function start() {
  const hostSrv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const arm = u.searchParams.get('arm'), sec = u.searchParams.get('sec'), csp = u.searchParams.get('csp');
    if (u.pathname === '/host') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(host(u.search.slice(1))); }
    if (u.pathname === '/res') {
      res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': CSP[csp] });
      return res.end(resource(arm, sec));
    }
    res.writeHead(404); res.end();
  });
  const cdnSrv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const js = (body) => { res.writeHead(200, { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }); res.end(body); };
    if (u.pathname === '/baro.js') return js(fs.readFileSync(FILES.baro));
    if (u.pathname === '/baro-boot.js') return js('BaroCSS.baroStart();');
    if (u.pathname === '/baro-boot-pf.js') return js('BaroCSS.baroStart({ config: { preflight: true } });');
    if (u.pathname === '/twb.js') return js(fs.readFileSync(FILES.twb));
    if (u.pathname === '/probe.js') return js(`window.__PROBE=${JSON.stringify({ sec: u.searchParams.get('sec'), arm: u.searchParams.get('arm'), dynamic: DYNAMIC })};\n${PROBE}`);
    const m = u.pathname.match(/^\/ref\/(.+)\.css$/);
    if (m) { res.writeHead(200, { 'content-type': 'text/css', 'access-control-allow-origin': '*' }); return res.end(await ref(m[1])); }
    res.writeHead(404); res.end();
  });
  return Promise.all([new Promise((r) => hostSrv.listen(PORT, '127.0.0.1', r)), new Promise((r) => cdnSrv.listen(PORT + 1, '127.0.0.1', r))])
    .then(() => ({ close: () => { hostSrv.close(); cdnSrv.close(); } }));
}
