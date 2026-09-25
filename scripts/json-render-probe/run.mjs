// #182 json-render built-app probe. Rerun (from the repo root, after
//   pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   TWB_DIR=<dir of @tailwindcss/browser@4.1.13> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium binary> \
//     [PROBE_PORT=5320] node scripts/json-render-probe/run.mjs [runs=5]
// A "built" app (Tailwind 4.1.13 compile() over the shell's classes + app.css, linked as a stylesheet) mounts
// model-generated json-render specs (specs.json) whose className strings the build never saw. Arms:
//   ref      built CSS that also includes the spec classes ("if the build had known")
//   build    built CSS only
//   twb      build + @tailwindcss/browser
//   baro     build + BaroCSS.baroStart()
//   baropre  build + baroStart() + the exported preloadJsonRenderClasses before mount
// Writes scripts/json-render-probe/result.json (gitignored) and prints a summary.
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 5320);
const RUNS = Number(process.argv[2] || 5);
const ARMS = ['ref', 'build', 'twb', 'baro', 'baropre'];
const FILES = {
  baro: path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'),
  twb: path.join(process.env.TWB_DIR || '', 'dist/index.global.js'),
};
const SHELL = fs.readFileSync(path.join(HERE, 'shell.html'), 'utf8');
const SPECS = JSON.parse(fs.readFileSync(path.join(HERE, 'specs.json'), 'utf8'));
const PAGE_JS = fs.readFileSync(path.join(HERE, 'page.js'), 'utf8');
const APP_CSS = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8');

const split = (s) => s.split(/\s+/).filter(Boolean);
const shellTokens = [...SHELL.matchAll(/class="([^"]*)"/g)].flatMap((m) => split(m[1]));
const specTokens = Object.values(SPECS).flatMap((s) => Object.values(s.elements).flatMap((e) => split(e.props?.className || '')));
async function build(tokens) {
  const c = await compile(`@import "tailwindcss";\n${APP_CSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return c.build([...new Set(tokens)]);
}
const CSS = { build: await build(shellTokens), ref: await build([...shellTokens, ...specTokens]) };
const newTokens = [...new Set(specTokens)].filter((t) => !shellTokens.includes(t));

const head = {
  ref: '<link rel="stylesheet" href="/ref.css">',
  build: '<link rel="stylesheet" href="/build.css">',
  twb: '<link rel="stylesheet" href="/build.css"><script src="/twb.js"></script>',
  baro: '<link rel="stylesheet" href="/build.css"><script src="/baro.js"></script><script>BaroCSS.baroStart();</script>',
  baropre: '<link rel="stylesheet" href="/build.css"><script src="/baro.js"></script><script>BaroCSS.baroStart();</script>',
};
const page = (arm) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1280">${head[arm]}
<script>window.__PROBE=${JSON.stringify({ arm, specs: SPECS, specNames: Object.keys(SPECS) })};</script><script src="/page.js"></script></head>
<body>${SHELL}</body></html>`;
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const send = (type, body) => { r.writeHead(200, { 'content-type': type }); r.end(body); };
  if (u.pathname === '/app') return send('text/html', page(u.searchParams.get('arm')));
  if (u.pathname === '/build.css') return send('text/css', CSS.build);
  if (u.pathname === '/ref.css') return send('text/css', CSS.ref);
  if (u.pathname === '/page.js') return send('text/javascript', PAGE_JS);
  if (u.pathname === '/baro.js') return send('text/javascript', fs.readFileSync(FILES.baro));
  if (u.pathname === '/twb.js') return send('text/javascript', fs.readFileSync(FILES.twb));
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));

const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const raw = [];
for (const arm of ARMS) for (let i = 0; i < RUNS; i++) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(`http://127.0.0.1:${PORT}/app?arm=${arm}`);
  const r = await p.waitForFunction(() => window.__r, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => ({ error: 'no report' }));
  raw.push({ arm, i, errs, ...r });
  await p.close();
}
await browser.close();
srv.close();

const median = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const refRun = raw.find((r) => r.arm === 'ref' && r.i === 0);
const buildRun = raw.find((r) => r.arm === 'build' && r.i === 0);
function cmp(a, b, ids, props) {
  if (!a || !b || a.length !== b.length) return { parity: null, diffs: [] };
  let same = 0, all = 0; const diffs = [];
  a.forEach((row, i) => row.forEach((v, j) => { all++; if (v === b[i][j]) same++; else if (diffs.length < 400) diffs.push([ids ? ids[i] : i, props[j], v, b[i][j]]); }));
  return { parity: same / all, diffs };
}
const gz = (f) => zlib.gzipSync(fs.readFileSync(f)).length;
const scriptBytes = { twb: [fs.statSync(FILES.twb).size, gz(FILES.twb)], baro: [fs.statSync(FILES.baro).size, gz(FILES.baro)] };
scriptBytes.baropre = scriptBytes.baro;
const summary = ARMS.map((arm) => {
  const rs = raw.filter((r) => r.arm === arm && !r.error);
  const specs = rs.map((r) => cmp(r.specSig, refRun.specSig, r.specIds, r.props));
  // Shell after mount vs the reference (same content, so same heights); shell before mount vs build-only.
  const shells = rs.map((r) => cmp(r.shellSig, refRun.shellSig, null, r.props));
  const shellsBefore = rs.map((r) => cmp(r.shellSigBefore, buildRun.shellSigBefore, null, r.props));
  const a = rs[0]?.audit || {};
  return {
    arm, runs: rs.length + '/' + RUNS,
    specParity: median(specs.map((s) => s.parity)), specParityMin: Math.min(...specs.map((s) => s.parity ?? 0)),
    specDiffSample: specs[0]?.diffs.filter((d) => d[1] !== "box-shadow").slice(0, 8), specDiffProps: Object.fromEntries(Object.entries((specs[0]?.diffs || []).reduce((m, d) => ((m[d[1]] = (m[d[1]] || 0) + 1), m), {}))), shellDiffProps: Object.fromEntries(Object.entries((shells[0]?.diffs || []).reduce((m, d) => ((m[d[1]] = (m[d[1]] || 0) + 1), m), {}))),
    shellParityVsBuild: median(shells.map((s) => s.parity)), shellDiffSample: shells[0]?.diffs.slice(0, 8),
    shellBeforeMountParityVsBuild: median(shellsBefore.map((s) => s.parity)), shellBeforeDiffSample: shellsBefore[0]?.diffs.slice(0, 3),
    preflightRules: a.preflights, injectedRules: a.injectedRules, duplicateClasses: a.duplicateClasses, duplicateSample: a.duplicateSample,
    injectedCssBytes: a.injectedBytes, scriptBytes: scriptBytes[arm] || null,
    mountToFinalMs: median(rs.map((r) => r.mountToFinalMs)), mountToFinalMsAll: rs.map((r) => Math.round(r.mountToFinalMs)),
    pageErrors: [...new Set(rs.flatMap((r) => r.errs))].slice(0, 3),
  };
});
const out = { question: '#182', builtCssBytes: { build: CSS.build.length, ref: CSS.ref.length }, specTokens: new Set(specTokens).size, specTokensNotInShell: newTokens.length, summary, raw: raw.map(({ specSig, shellSig, shellSigBefore, ...r }) => r) };
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ builtCssBytes: out.builtCssBytes, specTokens: out.specTokens, specTokensNotInShell: out.specTokensNotInShell }));
for (const s of summary) console.log(JSON.stringify(s));
