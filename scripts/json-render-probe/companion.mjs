// #222 companion-mode probe: one element carries class A (known to the Tailwind 4.1.13 build) and class B
// (not in the build, delivered by the BaroCSS runtime). Computed style is compared with a reference build
// that knows both classes. Each pair runs in both directions. Rerun (repo root, after building kit + browser):
//   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> [PROBE_PORT=5330] \
//     node scripts/json-render-probe/companion.mjs
// Arms: baro = baroStart(); baroskip = baroStart({ skipExisting: true });
//       barotw / baroskiptw = the same with config.cssVarPrefix: 'tw' (the companion setting).
// Writes scripts/json-render-probe/companion-result.json (gitignored) and prints a per-family summary.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 5330);
const BARO = process.env.BARO_UMD || path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs');

const FAMILIES = {
  'box-shadow': [['ring-2', 'shadow-md'], ['ring-2 ring-red-500', 'shadow-lg'], ['inset-shadow-sm', 'ring-1'], ['shadow-md', 'ring-offset-2 ring-2']],
  transform: [['translate-x-2', 'translate-y-4'], ['translate-x-2', 'rotate-3'], ['scale-x-50', 'scale-y-150'], ['skew-x-3', 'skew-y-6'], ['rotate-x-12', 'skew-x-3']],
  filter: [['blur-sm', 'grayscale'], ['brightness-50', 'contrast-125'], ['backdrop-blur-sm', 'backdrop-grayscale'], ['backdrop-brightness-50', 'backdrop-contrast-125']],
  gradient: [['bg-linear-to-r from-red-500', 'to-blue-500'], ['bg-gradient-to-r to-blue-500', 'from-red-500 via-green-500'], ['from-red-500 to-blue-500', 'bg-linear-to-b']],
  'border-style': [['border-dashed', 'border-2'], ['border-2', 'border-dotted'], ['outline-dashed', 'outline-2'], ['outline-2', 'outline-dotted']],
};
const PROPS = ['box-shadow', 'transform', 'translate', 'scale', 'rotate', 'filter', 'backdrop-filter', 'background-image',
  'border-top-style', 'border-top-width', 'outline-style', 'outline-width'];
const split = (s) => s.split(/\s+/).filter(Boolean);
const cases = [];
for (const [fam, pairs] of Object.entries(FAMILIES)) for (const [a, b] of pairs) { cases.push({ fam, build: a, runtime: b }); cases.push({ fam, build: b, runtime: a }); }

async function build(tokens) {
  const c = await compile('@import "tailwindcss";', {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return c.build([...new Set(tokens)]);
}
// Each case gets its own build (A only) and its own reference (A + B).
const builds = await Promise.all(cases.map((c) => build(split(c.build))));
const refs = await Promise.all(cases.map((c) => build([...split(c.build), ...split(c.runtime)])));

const ARMS = {
  ref: '',
  build: '',
  baro: '<script src="/baro.js"></script><script>BaroCSS.baroStart();</script>',
  baroskip: '<script src="/baro.js"></script><script>BaroCSS.baroStart({ skipExisting: true });</script>',
  barotw: '<script src="/baro.js"></script><script>BaroCSS.baroStart({ config: { cssVarPrefix: "tw" } });</script>',
  baroskiptw: '<script src="/baro.js"></script><script>BaroCSS.baroStart({ skipExisting: true, config: { cssVarPrefix: "tw" } });</script>',
};
const page = (arm, i) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/${arm === 'ref' ? 'ref' : 'build'}${i}.css">${ARMS[arm]}</head>
<body><div id="t" class="${cases[i].build} ${cases[i].runtime}" style="width:100px;height:50px">x</div></body></html>`;
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const send = (type, body) => { r.writeHead(200, { 'content-type': type }); r.end(body); };
  if (u.pathname === '/app') return send('text/html', page(u.searchParams.get('arm'), Number(u.searchParams.get('i'))));
  const m = u.pathname.match(/^\/(ref|build)(\d+)\.css$/); if (m) return send('text/css', (m[1] === 'ref' ? refs : builds)[Number(m[2])]);
  if (u.pathname === '/baro.js') return send('text/javascript', fs.readFileSync(BARO));
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const p = await browser.newPage();
const sig = {};
for (const arm of Object.keys(ARMS)) for (let i = 0; i < cases.length; i++) {
  await p.goto(`http://127.0.0.1:${PORT}/app?arm=${arm}&i=${i}`);
  if (arm.startsWith('baro')) await p.waitForTimeout(300);
  (sig[arm] ||= [])[i] = await p.evaluate((props) => { const cs = getComputedStyle(document.getElementById('t')); return props.map((k) => cs.getPropertyValue(k)); }, PROPS);
}
await browser.close(); srv.close();
const summary = {}, fails = {};
for (const arm of Object.keys(ARMS)) for (let i = 0; i < cases.length; i++) {
  const c = cases[i], s = (summary[c.fam] ||= { n: cases.filter((x) => x.fam === c.fam).length });
  const ok = PROPS.every((_, j) => sig[arm][i][j] === sig.ref[i][j]);
  s[arm] = (s[arm] || 0) + (ok ? 1 : 0);
  if (!ok && arm !== 'build') (fails[arm] ||= []).push([`[${c.build}] + {${c.runtime}}`, ...PROPS.flatMap((k, j) => sig[arm][i][j] !== sig.ref[i][j] ? [`${k}: ${sig[arm][i][j]}  !=  ${sig.ref[i][j]}`] : [])]);
}
fs.writeFileSync(path.join(HERE, 'companion-result.json'), JSON.stringify({ summary, fails, cases, sig }, null, 1));
console.log('pairs matching the reference per family ([build class] + {runtime class}, both directions):');
for (const [f, s] of Object.entries(summary)) console.log(f.padEnd(13), JSON.stringify(s));
for (const [a, l] of Object.entries(fails)) { console.log(`-- ${a} mismatches`); for (const x of l.slice(0, 40)) console.log('  ', x.join(' | ')); }
