// #199 classify + render. Usage (repo root, after `pnpm --filter @barocss/browser build:library`):
//   TWB_DIR=<@tailwindcss/browser@4.1.13 dir> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> \
//     node scripts/mcp-model-outputs/render.mjs
// For each outputs/<id>.html: classifies styling, counts class tokens and how many emit a rule under Tailwind 4.1.13
// compile(), then renders it in a sandboxed iframe under the #198 "typical" CSP in three arms:
//   a = as written, b = + BaroCSS runtime (baroStart preflight:true), c = + @tailwindcss/browser.
// Compares computed styles of every element in b and c against a; writes result.json and shots/ (only where arms differ).
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const H = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(H, '../..');
const require = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = require('tailwindcss');
const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const PORT = 5520, CDN = `http://127.0.0.1:${PORT + 1}`;
const BARO = path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs');
const TWB = path.join(process.env.TWB_DIR, 'dist/index.global.js');
const CSP = `default-src 'none'; script-src 'unsafe-inline' ${CDN}; style-src 'unsafe-inline' ${CDN}; img-src data: ${CDN}; font-src ${CDN}; connect-src ${CDN}`;
const HEAD = { a: '', b: `<script src="${CDN}/baro.js"></script><script src="${CDN}/baro-boot.js"></script>`, c: `<script src="${CDN}/twb.js"></script>` };
const ids = fs.readdirSync(path.join(H, 'outputs')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort();
const src = (id) => fs.readFileSync(path.join(H, 'outputs', id + '.html'), 'utf8');

const tw = await compile('@import "tailwindcss/utilities.css";', {
  base: twDir,
  loadStylesheet: async (id) => { const f = path.join(twDir, id.replace(/^tailwindcss\//, '')); return { path: f, base: path.dirname(f), content: fs.readFileSync(f, 'utf8') }; },
});
let twLen = tw.build([]).length;
// build() is cumulative: a token is a utility iff adding it grows the output (i.e. it emitted a rule).
const isUtil = (t) => { const n = tw.build([t]).length; const grew = n > twLen; twLen = n; return grew; };
function classify(html) {
  const tokens = [...html.matchAll(/class(?:Name)?\s*=\s*["']([^"'$`{}]*)["']/g), ...html.matchAll(/classList\.(?:add|toggle|remove)\(\s*['"]([^'"]+)['"]/g)]
    .flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  const uniq = [...new Set(tokens)];
  const util = uniq.filter(isUtil);
  const ext = [...html.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)|@import\s+url\(["']?(https?:[^"')]+)|url\(["']?(https?:[^"')]+)/g)].map((m) => m[1] || m[2] || m[3]);
  const styleBlocks = (html.match(/<style[\s>]/g) || []).length, inlineStyles = (html.match(/\sstyle\s*=\s*["']/g) || []).length;
  const approach = util.length > uniq.length / 2 ? 'utility classes' : styleBlocks ? (inlineStyles > 5 ? 'style block + inline styles' : 'own <style> block, semantic classes') : inlineStyles ? 'inline styles' : 'none';
  return { approach, classTokens: uniq.length, utilityTokens: util.length, utilities: util, styleBlocks, inlineStyleAttrs: inlineStyles, external: ext };
}

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const id = u.searchParams.get('id'), arm = u.searchParams.get('arm');
  if (u.pathname === '/host') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts" style="width:800px;height:1000px;border:0" src="/res?id=${id}&arm=${arm}"></iframe>`); }
  if (u.pathname === '/res') {
    let h = src(id); const inj = `<script src="${CDN}/probe.js"></script>${HEAD[arm]}`;
    h = /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (m) => m + inj) : inj + h;
    res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': CSP }); return res.end(h);
  }
  res.writeHead(404); res.end();
});
const cdn = http.createServer((req, res) => {
  const js = (b) => { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(b); };
  if (req.url === '/baro.js') return js(fs.readFileSync(BARO));
  if (req.url === '/baro-boot.js') return js('BaroCSS.baroStart({ config: { preflight: true } });');
  if (req.url === '/twb.js') return js(fs.readFileSync(TWB));
  if (req.url === '/probe.js') return js(`window.__v=[];document.addEventListener('securitypolicyviolation',e=>__v.push(e.violatedDirective+' '+(e.blockedURI||'inline')));window.addEventListener('error',e=>__v.push('error '+e.message));
setTimeout(()=>{const P=['display','margin-top','padding-top','padding-left','width','font-size','font-weight','line-height','color','background-color','border-top-width','border-top-color','border-top-left-radius','box-shadow','gap','font-family'];
const s=[...document.body.querySelectorAll('*')].filter(e=>!/SCRIPT|STYLE/.test(e.tagName)).map(e=>{const c=getComputedStyle(e);return [e.tagName,...P.map(p=>c.getPropertyValue(p))]});
parent.postMessage({probe:1,sig:s,props:P,v:__v,h:document.documentElement.scrollHeight},'*')},1500);`);
  res.writeHead(404); res.end();
});
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r)); await new Promise((r) => cdn.listen(PORT + 1, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME });
fs.mkdirSync(path.join(H, 'shots'), { recursive: true });
const out = {};
for (const id of ids) {
  const c = classify(src(id)); const arms = {}; const shots = {};
  for (const arm of ['a', 'b', 'c']) {
    const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
    await page.goto(`http://127.0.0.1:${PORT}/host?id=${id}&arm=${arm}`);
    const r = await page.evaluate(() => new Promise((ok) => { addEventListener('message', (e) => e.data.probe && ok(e.data)); setTimeout(() => ok(null), 8000); }));
    shots[arm] = await page.locator('#f').screenshot({ type: 'png', scale: 'css', clip: undefined }).catch(() => null);
    arms[arm] = r; await page.close();
  }
  const res = { a: { violations: arms.a?.v } };
  for (const arm of ['b', 'c']) {
    const A = arms.a?.sig, B = arms[arm]?.sig; let same = 0, all = 0; const diffs = [];
    if (A && B && A.length === B.length) A.forEach((row, i) => row.forEach((v, j) => { all++; if (v === B[i][j]) same++; else if (diffs.length < 6) diffs.push([row[0], j ? arms.a.props[j - 1] : 'tag', v, B[i][j]]); }));
    res[arm] = { parityVsA: all ? same / all : null, elements: B?.length, diffs, violations: arms[arm]?.v };
  }
  const differ = ['b', 'c'].some((a) => res[a].parityVsA !== 1);
  if (differ) for (const arm of ['a', 'b', 'c']) if (shots[arm]) fs.writeFileSync(path.join(H, 'shots', `${id}-${arm}.png`), shots[arm]);
  out[id] = { ...c, arms: res, armsDiffer: differ };
  console.log(id, c.approach, c.classTokens + '(' + c.utilityTokens + ')', c.external.length ? 'CDN' : '-', 'b=' + res.b.parityVsA?.toFixed(3), 'c=' + res.c.parityVsA?.toFixed(3), JSON.stringify(res.b.diffs.slice(0, 2)), JSON.stringify(res.c.diffs.slice(0, 2)), (arms.a?.v || []).join('|'));
}
await browser.close(); srv.close(); cdn.close();
fs.writeFileSync(path.join(H, 'result.json'), JSON.stringify(out, null, 1));
