// #379 launch demos (unpublished, unlisted): generates apps/barocss-docs/docs/public/demos/ from recorded model output
// (scripts/cms-probe/blocks, frozen #253 opus blocks). No model calls. Pages load @barocss/browser@0.10.1 from the CDN.
// Rerun (repo root, after pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/server build:library):
//   node scripts/launch-demos/build.mjs      then   node scripts/launch-demos/serve.mjs [--local]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SHELL, SITE_CSS, SITE_THEME_CSS, BRAND, ACCENT, FONTS } from '../cms-probe/site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'apps/barocss-docs/docs/public/demos');
// In the workspace @barocss/kit exports its src; resolve it to the built dist, as the published 0.10.1 package does.
const KIT_DIST = new URL('../../packages/barocss/dist/index.js', import.meta.url).href;
register(`data:text/javascript,export async function resolve(s,c,n){return s==='@barocss/kit'?{url:${JSON.stringify(KIT_DIST)},shortCircuit:true}:n(s,c)}`);
const { ServerRuntime, ssrStyleTag } = await import('../../packages/barocss-server/dist/index.es.js');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const BARO_CDN = 'https://cdn.jsdelivr.net/npm/@barocss/browser@0.10.1/dist/cdn/barocss.umd.cjs';
const TWB_CDN = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.13/dist/index.global.js';
const EV = 'https://github.com/barocss/barocss/blob/develop/scripts';
const AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%236366f1"/><circle cx="20" cy="16" r="7" fill="%23e0e7ff"/><path d="M6 38c2-9 26-9 28 0" fill="%23e0e7ff"/></svg>').replaceAll('%2523', '%23');
const BLOCKS = ['hero', 'feature-grid', 'callout', 'comparison-table', 'testimonial', 'cta'];
const blockHtml = (b) => fs.readFileSync(path.join(ROOT, 'scripts/cms-probe/blocks', `opus-${b}.html`), 'utf8').trim().replaceAll('/img/avatar.jpg', AVATAR);
const DATA = BLOCKS.map((b) => ({ type: b, html: blockHtml(b) }));
const toks = (h) => [...h.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean));
async function build(tokens) {
  const c = await compile(`@import "tailwindcss";\n${SITE_CSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return c.build([...new Set(tokens)]);
}
const THEME_EXT = { colors: { brand: BRAND, accent: ACCENT }, fontFamily: { display: FONTS.display.split(', '), sans: FONTS.sans.split(', ') } };
const BARO_CONFIG = { cssVarPrefix: 'tw', theme: { extend: THEME_EXT } };
const write = (rel, s) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

// shared demo chrome (plain CSS, not part of what is measured)
write('demo.css', `.demo-bar{font:14px/1.5 system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:12px 20px}
.demo-bar h1{all:unset;display:block;font-weight:700;font-size:16px;color:#fff}
.demo-bar p{all:unset;display:block;margin-top:4px;max-width:960px}
.demo-bar a{color:#93c5fd}.demo-bar nav{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.demo-bar nav a{all:unset;cursor:pointer;padding:3px 10px;border-radius:999px;border:1px solid #475569;color:#e2e8f0}
.demo-bar nav a[aria-current]{background:#e2e8f0;color:#0f172a}.demo-bar output{margin-left:8px;color:#fde68a}
`);
const bar = (title, text, links, extra = '') => `<div class="demo-bar"><h1>${title}</h1><p>${text}</p><nav>${links}${extra}</nav></div>`;
const rtLinks = () => [['baro', 'BaroCSS 0.10.1'], ['twb', '@tailwindcss/browser'], ['none', 'nothing']].map(([k, l]) => `<a data-rt="${k}" href="./?rt=${k}">${l}</a>`).join('');
const rtPick = `var rt = new URLSearchParams(location.search).get('rt') || 'baro';
  document.querySelectorAll('[data-rt]').forEach(function (a) { if (a.dataset.rt === rt) a.setAttribute('aria-current', 'true'); });
  function load(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = cb; document.head.appendChild(s); }`;

// ---------- 1. CMS content next to a Tailwind build ----------
const buildCss = await build(toks(SHELL).concat(['prose']));
write('cms/site.css', buildCss);
write('cms/blocks.js', `window.CMS_BLOCKS=${JSON.stringify(DATA)};\n`);
write('cms/cms.js', `// #379 CMS demo: the site ships a Tailwind build of its own templates; CMS blocks (recorded model output) arrive at runtime.
(function () {
  ${rtPick}
  function insert() {
    document.getElementById('blocks').innerHTML = window.CMS_BLOCKS.map(function (b) { return '<div data-block="' + b.type + '">' + b.html + '</div>'; }).join('\\n');
    setTimeout(function () {
      var hero = document.querySelector('[data-block="hero"] > *');
      var styled = !!hero && getComputedStyle(hero).backgroundImage !== 'none';
      document.getElementById('status').textContent = 'runtime: ' + rt + ' | hero block styled: ' + (styled ? 'yes' : 'no');
      window.__demo = { rt: rt, styled: styled };
    }, 300);
  }
  if (rt === 'baro') load(${JSON.stringify(BARO_CDN)}, function () {
    BaroCSS.getRuntime({ skipExisting: true, config: ${JSON.stringify(BARO_CONFIG)} }).observe(document.body, { scan: true });
    insert();
  });
  else if (rt === 'twb') { var st = document.createElement('style'); st.type = 'text/tailwindcss'; st.textContent = ${JSON.stringify(SITE_THEME_CSS)}; document.head.appendChild(st); load(${JSON.stringify(TWB_CDN)}, insert); }
  else insert();
})();
`);
write('cms/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo: CMS content styled at runtime</title><meta name="robots" content="noindex"><link rel="icon" href="data:,"><link rel="stylesheet" href="../demo.css"><link rel="stylesheet" href="site.css"></head><body>
${bar('CMS content next to a Tailwind build',
  `The site CSS is a Tailwind 4 build of its own templates. The six blocks in the article are recorded model output (Claude Opus, #253), inserted after load, so their classes are not in the build. Measured (#253, 223 block elements, share equal to a full build): build only 0.026, @tailwindcss/browser 1.000 (68.7K gz script), BaroCSS 0.938 (41.4K gz, 0 shell damage; the misses are one sm/lg order conflict). <a href="${EV}/cms-probe/run.mjs">evidence</a>`,
  rtLinks(), '<output id="status">loading…</output>')}
${SHELL}
<script src="blocks.js"></script><script src="cms.js"></script></body></html>`);

// ---------- 2. embedded widget: Shadow DOM + strict CSP ----------
write('widget/host.css', `/* deliberately hostile host CSS: element selectors and utility-like names that collide with Tailwind */
html{background:#fdf6e3}body{font-family:Georgia,serif;color:#5b3a1a;margin:0}
.host{max-width:900px;margin:0 auto;padding:24px}
h1{font-size:40px;color:#8b0000;text-transform:uppercase;letter-spacing:4px}
p{margin:40px 0;font-size:19px;line-height:2}
button{background:#8b4513;color:#fff;border:4px dashed #000;padding:14px}
a{color:#b8860b}
.flex{display:block!important}.hidden{display:block!important;outline:3px solid red}.container{border:5px double #8b4513;padding:10px}
chat-widget{display:block;margin-top:24px}
`);
write('widget/blocks.js', `window.WIDGET_BLOCKS=${JSON.stringify(DATA)};\n`);
write('widget/widget.js', `// #379 widget demo: a Shadow DOM chat widget on a strict-CSP host (no inline script or style allowed).
(function () {
  ${rtPick}
  var violations = 0, status = document.getElementById('status'), done = false, sr;
  document.addEventListener('securitypolicyviolation', function () { violations++; report(); });
  var PROPS = ['font-family', 'color', 'margin-top', 'font-size', 'display', 'background-color', 'border-top-style', 'letter-spacing', 'box-sizing', 'line-height'];
  var hostEls = Array.prototype.slice.call(document.querySelectorAll('.host, .host *:not(chat-widget)'));
  function snap() { return hostEls.map(function (el) { var cs = getComputedStyle(el); return PROPS.map(function (p) { return cs.getPropertyValue(p); }).join('|'); }); }
  var before = snap();
  function report() {
    var now = snap(), changed = now.filter(function (v, i) { return v !== before[i]; }).length;
    var hero = sr && sr.querySelector('.bg-indigo-600');
    var styled = !!hero && getComputedStyle(hero).backgroundColor !== 'rgba(0, 0, 0, 0)';
    status.textContent = 'runtime: ' + rt + ' | widget styled: ' + (styled ? 'yes' : 'no') + ' | host elements changed: ' + changed + '/' + hostEls.length + ' | CSP violations: ' + violations;
    window.__demo = { rt: rt, styled: styled, hostChanged: changed, hostEls: hostEls.length, violations: violations, done: done };
  }
  function start() {
    sr = document.querySelector('chat-widget').attachShadow({ mode: 'open' });
    sr.innerHTML = '<div class="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"><div class="flex items-center gap-3 bg-indigo-600 px-5 py-3 text-white"><span class="size-2.5 rounded-full bg-emerald-400"></span><span class="font-semibold">Assistant</span><span class="ml-auto text-xs text-indigo-100">recorded replies</span></div><div id="log" class="space-y-6 p-5"><div class="w-fit rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-800">Build me a landing page for our spring release.</div></div></div>';
    if (rt === 'baro') new BaroCSS.BrowserRuntime({ root: sr, config: {} });
    var log = sr.getElementById('log'), i = 0, B = window.WIDGET_BLOCKS;
    (function next() {
      if (i >= B.length) { done = true; setTimeout(report, 200); return; }
      var d = document.createElement('div'); d.setAttribute('data-block', B[i].type); d.innerHTML = B[i].html; log.appendChild(d); i++;
      report(); setTimeout(next, 250);
    })();
  }
  if (rt === 'baro') load(${JSON.stringify(BARO_CDN)}, start);
  else if (rt === 'twb') load(${JSON.stringify(TWB_CDN)}, start);
  else start();
})();
`);
write('widget/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' data:">
<title>Demo: embedded widget, Shadow DOM + strict CSP</title><meta name="robots" content="noindex"><link rel="icon" href="data:,"><link rel="stylesheet" href="../demo.css"><link rel="stylesheet" href="host.css"></head><body>
${bar('Embedded AI widget: Shadow DOM on a strict-CSP host',
  `The host forbids inline styles (style-src 'self', no nonce, no 'unsafe-inline') and ships hostile CSS (h1/p/button rules, .flex/.hidden/.container overrides). The widget renders recorded model blocks (#253) in an open shadow root. BaroCSS runs as <code>new BrowserRuntime({ root: shadowRoot })</code>: a constructable sheet adopted by the root, which CSP allows and which never reaches the host. Measured (#320/#327/#364): root mode 0/9 host damage and one shared sheet for 20 widgets; @tailwindcss/browser is document-only and does not style shadow roots. The bar counts CSP violations and host elements whose computed style changed. Known gap in 0.10.1: the hero's <code>bg-gradient-to-b</code> background does not render inside the shadow root. <a href="${EV}/embed-probe/run.mjs">evidence</a>`,
  rtLinks(), '<output id="status">loading…</output>')}
<div class="host"><h1>Harbor Hardware Co.</h1><p>Family-run since 1952. This page's CSS is old, global, and not written for embedding.</p>
<p><button>Order parts</button> <a href="#">Store hours</a></p><div class="container flex hidden">Host container</div>
<chat-widget></chat-widget></div>
<script src="blocks.js"></script><script src="widget.js"></script></body></html>`);

// ---------- 3. SSR first paint ----------
const srt = new ServerRuntime(BARO_CONFIG);
const blocksHtml = DATA.map((b) => `<div data-block="${b.type}">${b.html}</div>`).join('\n');
const body = SHELL.replace('<div id="blocks"></div>', `<div id="blocks">${blocksHtml}</div>`);
const srvCss = srt.generateCssForHtml(blocksHtml, { skip: buildCss });
write('ssr/boot.js', `// #379 SSR demo: start the client runtime after ?delay= ms (default 1500) so the first paint stays visible.
(function () {
  var delay = Number(new URLSearchParams(location.search).get('delay') || 1500), t = document.getElementById('status');
  setTimeout(function () {
    var s = document.createElement('script'); s.src = ${JSON.stringify(BARO_CDN)};
    s.onload = function () { BaroCSS.getRuntime({ skipExisting: true, config: ${JSON.stringify(BARO_CONFIG)} }).observe(document.body, { scan: true }); t.textContent = 'client runtime started after ' + delay + ' ms'; window.__demoHydrated = true; };
    document.head.appendChild(s);
  }, delay);
})();
`);
for (const arm of ['with', 'without']) {
  write(`ssr/${arm}.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo: SSR first paint (${arm} generateCssForHtml)</title><meta name="robots" content="noindex"><link rel="icon" href="data:,"><link rel="stylesheet" href="../demo.css"><link rel="stylesheet" href="../cms/site.css">${arm === 'with' ? ssrStyleTag(srvCss) : ''}</head><body>
${bar(`SSR first paint: ${arm} @barocss/server`,
  `The server renders recorded CMS blocks (#253) into the page; the Tailwind build covers only the templates. ${arm === 'with' ? `Here <code>generateCssForHtml(html, { skip: buildCss })</code> ran on the server (${(srvCss.length / 1024).toFixed(1)}K) and <code>ssrStyleTag()</code> inlined it, so the first paint is styled; the client runtime adopts it later.` : 'Here nothing is inlined, so the blocks paint unstyled until the client runtime starts (delayed so the flash is visible).'} Measured (#266/#268, Fast 3G + 4x CPU): share of block elements matching at first contentful paint .19 without, 1.00 with; server cost 0.18 ms warm. This page was pre-rendered by scripts/launch-demos/build.mjs with the same call a request handler makes. <a href="${EV}/ssr-probe/run.mjs">evidence</a>`,
  `<a href="with.html"${arm === 'with' ? ' aria-current="true"' : ''}>with generateCssForHtml</a><a href="without.html"${arm === 'without' ? ' aria-current="true"' : ''}>without</a><a href="${arm}.html?delay=4000">replay slower</a>`, '<output id="status">client runtime not started yet</output>')}
${body}
<script src="boot.js"></script></body></html>`);
}

write('index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BaroCSS demos (unlisted)</title><meta name="robots" content="noindex"><link rel="icon" href="data:,"><link rel="stylesheet" href="demo.css"></head><body>
${bar('BaroCSS demos (unlisted)', 'Each demo uses recorded model output (no live model calls) and @barocss/browser 0.10.1 from the CDN.',
  '<a href="cms/">CMS content at runtime</a><a href="widget/">Embedded widget: Shadow DOM + strict CSP</a><a href="ssr/with.html">SSR first paint</a>')}
</body></html>`);
console.log('wrote', path.relative(ROOT, OUT), '| server css', srvCss.length, 'B');
