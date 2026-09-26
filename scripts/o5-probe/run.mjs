// #364 O5 end-to-end probe: an embedded chat widget (hand-written, Shadow DOM) on a host page under strict CSP renders
// model-generated UI blocks (frozen real output in blocks/, see generate.sh) plus generic adversarial class shapes,
// using the PUBLISHED @barocss/browser@0.10.0 CDN bundle and @tailwindcss/browser@4.3.3.
// Rerun (repo root; packages unpacked by `npm pack` into scripts/o5-probe/.pkgs/{browser,twb}/package):
//   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> [PROBE_PORT=7164] node scripts/o5-probe/run.mjs
// Host origin 127.0.0.1:PORT, counting endpoint on a second origin localhost:PORT+1 (cross-origin) and /count/* same-origin.
// Page: 5 widget hosts (one per block, each its own shadow root and runtime) + optional adversarial widget.
// Metrics per arm x model:
//   parity   = share of block elements whose computed signature equals ref (tailwindcss compile() of the block classes
//              <link>ed in each root, neutral host, no adversarial widget) - same method as scripts/csp-probe.
//   w->h     = host elements whose signature changed after the widgets loaded (hostile host page).
//   h->w     = block elements whose signature differs between neutral host and hostile host (same arm).
//   advDrop  = parity(no adversarial) - parity(with adversarial widget): did adversarial classes disable other rules?
//   viol     = securitypolicyviolation events; xo = cross-origin requests seen; count = hits on counting endpoints.
//   bytes    = CSS text in the roots (adopted sheets + <style>); ms = insertion -> sentinel utility applied.
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
const PORT = Number(process.env.PROBE_PORT || 7164), CPORT = PORT + 1;
const N = 'o5N0nce364';
const CSP = `default-src 'self'; script-src 'self' 'nonce-${N}'; style-src 'self' 'nonce-${N}'; img-src 'self'; font-src 'self'; connect-src 'self'`;
const MODELS = ['opus', 'haiku'], BLOCKS = ['product-card', 'signup-form', 'order-table', 'warning-alert', 'pricing-snippet'];
const blocks = Object.fromEntries(MODELS.map((m) => [m, BLOCKS.map((b) => fs.readFileSync(path.join(HERE, 'blocks', `${m}-${b}.html`), 'utf8'))]));
const X = `http://localhost:${CPORT}/c`; // cross-origin counting endpoint
// Generic adversarial shapes (#194/#319 families): url()-bearing arbitrary values/properties/variables, unbalanced brackets,
// rule/selector breakout shapes (braces, semicolons, comment openers), document-targeting arbitrary variants, huge values.
const ADV = [
  `bg-[url(${X}/bg)]`, `[background-image:url(${X}/prop)]`, `cursor-[url(${X}/cur),auto]`, `bg-[url(/count/same)]`,
  `[--o5:url(${X}/var)] bg-(image:--o5)`, `bg-[image-set(url(${X}/iset)_1x)]`, `before:content-[url(${X}/content)]`,
  `mask-[url(${X}/mask)]`, 'bg-[red', 'w-[calc(100%-1px]', 'text-[red]]', 'p-[1px]]]', '[color:red;}*{color:blue]',
  'bg-[red]}body{display:none', '[color:red]/*', '[html_&]:hidden', '[body_&]:bg-red-500', '[:root_&]:opacity-0',
  '[:host_&]:outline-8', 'p-[99999px]', 'bg-[red]\\', '[&_*]:hidden',
];
const toks = (h) => [...h.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean));
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
const CHROME_CLS = 'font-sans text-gray-900 text-base leading-normal p-3 bg-white';
const SENT = 'p-[7px]';
const CSS = {};
for (const m of MODELS) CSS['ref-' + m] = (await build([...toks(blocks[m].join('')), ...CHROME_CLS.split(' '), SENT])).replace(/:root, :host|:root,:host/g, ':root, :host');
// Hostile host: aggressive own CSS, utility-named classes with host meanings, inherited props that cross the boundary.
CSS.host = `*{box-sizing:content-box}body{font:18px/2 Georgia,serif;color:#553;letter-spacing:.5px;margin:0}
div{padding:2px}button{background:hotpink;border:3px dashed}h2,h3{font-family:Impact,sans-serif;text-transform:uppercase}
.p-4{padding:40px}.flex{display:block}.hidden{display:inline}.bg-white{background:#fdd}.text-sm{font-size:30px}
.container{max-width:300px}.rounded-lg{border-radius:0}.host-card{border:1px solid #999;margin:10px}
input{border:4px solid red}table{border-collapse:separate}`;
CSS.freeze = '*,*::before,*::after{animation:none!important;transition:none!important}.widget{display:block;width:900px}';
const HOST_BODY = `<header class="flex p-4 bg-white"><h2>Host shop</h2><nav class="hidden">Nav</nav></header>
<main class="container"><div class="host-card p-4 rounded-lg"><h3>Host article</h3><p class="text-sm">Host text <a href="#">link</a></p>
<button>Buy</button><input value="x"><table><tr><td>a</td><td>b</td></tr></table></div></main>`;
const PROPS = ['display', 'margin-top', 'padding-top', 'padding-left', 'width', 'height', 'font-family', 'font-size', 'font-weight', 'line-height', 'color',
  'background-color', 'background-image', 'border-top-width', 'border-top-color', 'border-top-left-radius', 'box-shadow', 'gap', 'grid-template-columns',
  'flex-direction', 'justify-content', 'align-items', 'text-align', 'opacity', 'outline-width', 'cursor', 'letter-spacing', 'text-transform'];
// arm -> runtime
const ARMS = {
  ref: 'ref',
  none: 'none',
  'baro root': 'baro',
  'baro root + nonce': 'baro-nonce',
  'baro root + nonce + prefilter': 'baro-filter',
  twb: 'twb',
};
const S = `nonce="${N}"`;
function page(arm, m, hostile, adv) {
  const rt = ARMS[arm];
  const inner = rt === 'ref' ? `<link rel="stylesheet" href="/ref-${m}.css">` : '';
  const head = rt.startsWith('baro') ? `<script ${S} src="/baro.js"></script>` : rt === 'twb' ? `<script ${S} src="/twb.js"></script>` : '';
  const opts = rt === 'baro' ? {} : { nonce: N };
  const W = blocks[m].map((h) => `<div class="${CHROME_CLS}"><span class="${SENT}"></span><div class="blk">${h}</div></div>`);
  if (adv) W.push(`<div class="${CHROME_CLS}"><div class="adv">${ADV.map((c) => `<div class="${c.replace(/"/g, '&quot;')}">a</div>`).join('')}</div></div>`);
  const cfg = { rt, inner, opts, W, props: PROPS, filter: rt === 'baro-filter' };
  return `<!doctype html><html><head><meta charset="utf-8">
<script ${S}>window.__viol=[];document.addEventListener('securitypolicyviolation',function(e){window.__viol.push(e.violatedDirective+' '+(e.blockedURI||'').slice(0,60))});</script>
${hostile ? '<link rel="stylesheet" href="/host.css">' : ''}<link rel="stylesheet" href="/freeze.css">${head}
<script ${S}>window.__CFG=${JSON.stringify(cfg).replace(/</g, '\\u003c')};</script></head><body>${HOST_BODY}<section id="chat"></section>
<script ${S} src="/widget.js"></script></body></html>`;
}
// Hand-written chat widget: one custom element per assistant message, shadow root, runtime per root.
const WIDGET_JS = `(function(){var C=window.__CFG,P=C.props;
function sig(e){var c=getComputedStyle(e);return P.map(function(p){return c.getPropertyValue(p)})}
function hostSig(){return [].map.call(document.querySelectorAll('header,header *,main,main *'),sig)}
var LOADS=/(url|image-set|image|cross-fade|element|src)\\s*\\(/i;
function clean(html){if(!C.filter)return html;var t=document.createElement('template');t.innerHTML=html;
 t.content.querySelectorAll('[class]').forEach(function(e){e.setAttribute('class',e.getAttribute('class').split(/\\s+/).filter(function(c){return !LOADS.test(c)}).join(' '))});
 var d=document.createElement('div');d.appendChild(t.content);return d.innerHTML}
window.addEventListener('load',function(){setTimeout(function(){
 var before=hostSig(),roots=[],t0=performance.now(),chat=document.getElementById('chat');
 C.W.forEach(function(h){var host=document.createElement('div');host.className='widget';chat.appendChild(host);
  var sr=host.attachShadow({mode:'open'});sr.innerHTML=C.inner+clean(h);roots.push(sr);
  if(C.rt.indexOf('baro')===0)new BaroCSS.BrowserRuntime(Object.assign({root:sr},C.opts));});
 function ready(){return roots.slice(0,5).every(function(r){var s=r.querySelector('span');return s&&getComputedStyle(s).paddingTop==='7px'})}
 var ms=null;(function poll(n){if(ready()){ms=performance.now()-t0;return}if(n<120)requestAnimationFrame(function(){poll(n+1)})})(0);
 setTimeout(function(){var bytes=0;roots.forEach(function(r){(r.adoptedStyleSheets||[]).forEach(function(s){[].forEach.call(s.cssRules,function(x){bytes+=x.cssText.length})});
   r.querySelectorAll('style').forEach(function(s){bytes+=s.textContent.length})});
  var shared=new Set();roots.forEach(function(r){(r.adoptedStyleSheets||[]).forEach(function(s){shared.add(s)})});
  var adv=roots.length>5?[].map.call(roots[5].querySelectorAll('.adv > div'),function(e){return {cls:e.getAttribute('class'),sig:sig(e)}}):[];
  var ctl=roots[0]?sig(roots[0].querySelector('.blk')):null;
  window.__r={blockSig:[].concat.apply([],roots.slice(0,5).map(function(r){return [].map.call(r.querySelectorAll('.blk *'),sig)})),
   hostBefore:before,hostAfter:hostSig(),ms:ms,bytes:bytes,sheets:shared.size,adv:adv,headStyles:document.head.querySelectorAll('style').length}},1500)},100)});})();`;
const hits = [];
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const send = (type, body, csp) => { r.writeHead(200, { 'content-type': type, ...(csp ? { 'content-security-policy': csp } : {}) }); r.end(body); };
  if (u.pathname.startsWith('/count/')) { hits.push('same:' + u.pathname); r.writeHead(204); return r.end(); }
  if (u.pathname === '/p') return send('text/html', page(u.searchParams.get('arm'), u.searchParams.get('m'), u.searchParams.get('h') === '1', u.searchParams.get('a') === '1'), CSP);
  const cm = u.pathname.match(/^\/([\w-]+)\.css$/); if (cm && CSS[cm[1]]) return send('text/css', CSS[cm[1]]);
  if (u.pathname === '/widget.js') return send('text/javascript', WIDGET_JS);
  if (u.pathname === '/baro.js') return send('text/javascript', fs.readFileSync(path.join(HERE, '.pkgs/browser/package/dist/cdn/barocss.umd.cjs')));
  if (u.pathname === '/twb.js') return send('text/javascript', fs.readFileSync(path.join(HERE, '.pkgs/twb/package/dist/index.global.js')));
  r.writeHead(404); r.end();
});
const csrv = http.createServer((q, r) => { hits.push('xo:' + q.url); r.writeHead(204); r.end(); });
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
await new Promise((ok) => csrv.listen(CPORT, 'localhost', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
async function run(arm, m, h, a) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const xo = [], errs = [];
  hits.length = 0;
  p.on('request', (rq) => { if (!rq.url().startsWith(`http://127.0.0.1:${PORT}/`)) xo.push(rq.url()); });
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(`http://127.0.0.1:${PORT}/p?arm=${encodeURIComponent(arm)}&m=${m}&h=${h}&a=${a}`);
  const r = await p.waitForFunction(() => window.__r, null, { timeout: 20000 }).then((x) => x.jsonValue()).catch(() => ({ error: 'no report' }));
  await p.waitForTimeout(300);
  const viol = await p.evaluate(() => window.__viol || []);
  await p.close();
  return { ...r, viol, xo, hits: [...hits], errs };
}
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const parity = (a, b) => (!a || !b || a.length !== b.length ? null : a.filter((row, i) => eq(row, b[i])).length / a.length);
const diffCount = (a, b) => (!a || !b || a.length !== b.length ? null : a.filter((row, i) => !eq(row, b[i])).length);
const WH = [PROPS.indexOf('width'), PROPS.indexOf('height')];
const noBox = (a) => a && a.map((row) => row.filter((_, i) => !WH.includes(i)));
const out = { csp: CSP, adversarial: ADV, arms: {} };
for (const m of MODELS) {
  const ref = await run('ref', m, 0, 0), refH = await run('ref', m, 1, 0);
  for (const arm of Object.keys(ARMS)) {
    const neutral = arm === 'ref' ? ref : await run(arm, m, 0, 0);
    const hostile = arm === 'ref' ? refH : await run(arm, m, 1, 0);
    const adv = await run(arm, m, 1, 1);
    const pN = parity(neutral.blockSig, ref.blockSig), pA = parity(adv.blockSig, hostile.blockSig);
    const row = (out.arms[arm] ||= {});
    // Adversarial outcome: per class, did it style its element at all (sig differs from a class-less sibling = the first plain one)?
    const plain = adv.adv?.find((x) => x.cls === '[&_*]:hidden')?.sig; // parent-targeting shape; its own element stays plain
    row[m] = {
      parity: pN, parityHostile: parity(hostile.blockSig, ref.blockSig), parityVsRefOnHostile: parity(hostile.blockSig, refH.blockSig),
      hostToWidgetNoBox: diffCount(noBox(neutral.blockSig), noBox(hostile.blockSig)), hostToWidget: diffCount(neutral.blockSig, hostile.blockSig),
      widgetToHost: diffCount(hostile.hostBefore, hostile.hostAfter) + diffCount(adv.hostBefore, adv.hostAfter), hostEls: hostile.hostBefore?.length,
      advParityDrop: pA == null ? null : +(1 - pA).toFixed(3),
      viol: neutral.viol.length + hostile.viol.length + adv.viol.length, violSamples: [...new Set([...neutral.viol, ...adv.viol])].slice(0, 6),
      advXO: adv.xo, advHits: adv.hits, advStyled: (adv.adv || []).filter((x) => plain && !eq(x.sig, plain)).map((x) => x.cls),
      bytes: neutral.bytes, sheets: neutral.sheets, ms: neutral.ms, headStyles: neutral.headStyles,
      errs: [...new Set([...neutral.errs, ...adv.errs, ...(neutral.error ? [neutral.error] : [])])].slice(0, 3), blockEls: neutral.blockSig?.length,
    };
  }
}
await browser.close(); srv.close(); csrv.close();
for (const [arm, v] of Object.entries(out.arms)) for (const m of MODELS) {
  const r = v[m];
  console.log(arm.padEnd(30), m.padEnd(5), 'par', r.parity?.toFixed(3), 'parH', r.parityHostile?.toFixed(3), 'parRefH', r.parityVsRefOnHostile?.toFixed(3), 'h->w(noWH)', r.hostToWidgetNoBox, 'h->w', r.hostToWidget, 'w->h', r.widgetToHost,
    'advDrop', r.advParityDrop, 'viol', r.viol, 'xo', r.advXO.length, 'hits', r.advHits.length, 'bytes', r.bytes, 'ms', r.ms?.toFixed(0), r.errs.join('|').slice(0, 80));
}
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
