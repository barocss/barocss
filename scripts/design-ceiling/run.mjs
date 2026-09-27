// #438: render identical authored markup with the browser runtime and Tailwind 4.3.3.
// DEPS_ROOT=<existing project with tailwindcss 4.3.3> PW_DIR=<existing playwright-core project>
// CHROME=<installed Chromium> BARO_UMD=<built browser bundle> node scripts/design-ceiling/run.mjs
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tiles, tileMarkup, showcases } from './fixtures.mjs';
import { stubScreen } from '../../examples/ai-kiosk/lib/stub.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEPS_ROOT = process.env.DEPS_ROOT || path.join(os.homedir(), '.barocss-ai/v3/integration');
const deps = createRequire(path.join(DEPS_ROOT, 'package.json'));
const { compile } = deps('tailwindcss');
const tailwindVersion = deps('tailwindcss/package.json').version;
if (tailwindVersion !== '4.3.3') throw new Error(`Expected Tailwind 4.3.3, got ${tailwindVersion}`);
const themeFile = path.join(path.dirname(deps.resolve('tailwindcss/package.json')), 'theme.css');
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const UMD = fs.readFileSync(process.env.BARO_UMD || path.join(DEPS_ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/ai-kiosk/menu.json'), 'utf8'));
const kiosk = stubScreen({ facts: { step: 'start', persona: 'regular', cartCount: 0,
  ui: { lang: 'en', contrast: false, mode: 'touch', zoom: false, toast: null } }, menu });
const scenes = [
  { id: 'tiles', width: 1140, height: 900, html: `<div id="grid">${tiles.map(tileMarkup).join('')}</div>` },
  { id: 'kiosk', width: 620, height: 1060, html: `<main class="h-full bg-neutral-100 p-5"><div data-probe class="mx-auto h-[1010px] w-[580px] overflow-hidden rounded-[48px] bg-neutral-900 p-5 shadow-2xl ring-4 ring-neutral-300"><div class="h-full overflow-hidden rounded-[28px] bg-white">${kiosk}</div></div></main>` },
  ...showcases,
];
const tokensFor = html => [...new Set([...html.matchAll(/class="([^"]*)"/g)]
  .flatMap(m => m[1].split(/\s+/)).filter(Boolean))];
const theme = fs.readFileSync(themeFile, 'utf8');
const cssInput = `${theme}\n@custom-variant dark (&:where(.dark, .dark *));\n@theme { --color-brand-500: oklch(65% 0.2 240); --font-display: Georgia, serif; --animate-orbit: orbit 2s linear infinite; @keyframes orbit { to { transform: rotate(360deg); } } }\n@tailwind utilities;`;
const tailwindCss = {};
for (const scene of scenes) tailwindCss[scene.id] = (await compile(cssInput)).build(tokensFor(scene.html));
const commonCss = `*{box-sizing:border-box}html,body{margin:0}body{font-family:Arial,sans-serif;color:#0f172a;background:#f1f5f9}#grid{display:grid;grid-template-columns:repeat(4,260px);gap:20px;padding:20px}.tile{width:260px;height:185px;padding:10px;border:1px solid #cbd5e1;border-radius:20px;background:#fff}.tile-label{display:block;height:23px;font:600 11px Arial,sans-serif;color:#334155}.tile-stage{display:flex;align-items:center;justify-content:center;width:238px;height:140px;overflow:hidden;border-radius:12px;background:repeating-linear-gradient(45deg,#dbeafe 0 12px,#fecdd3 12px 24px)}`;
const config = { preflight: false, darkMode: 'class', darkModeSelector: '&:where(.dark,.dark *)', theme: {
  colors: { brand: { 500: 'oklch(65% 0.2 240)' } }, fontFamily: { display: ['Georgia', 'serif'] },
  animations: { orbit: 'orbit 2s linear infinite' }, keyframes: { orbit: { to: { transform: 'rotate(360deg)' } } },
} };
const pageHtml = (scene, mode) => `<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${commonCss}</style>${mode === 'tailwind' ? `<style>${tailwindCss[scene.id]}</style>` : '<script src="/baro.js"></script>'}</head><body><div id="scene" style="width:${scene.width}px;height:${scene.id === 'tiles' ? 'auto' : `${scene.height}px`}">${scene.html}</div>${mode === 'baro' ? `<script>window.__runtime=new BaroCSS.BrowserRuntime({ config:${JSON.stringify(config)},gc:false });window.__runtime.observe(document.body,{scan:true})</script>` : ''}</body></html>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/baro.js') { res.setHeader('content-type', 'text/javascript'); return res.end(UMD); }
  if (/^\/assets\/[a-z0-9-]+\.svg$/.test(url.pathname)) {
    const file = path.join(ROOT, 'examples/ai-kiosk', url.pathname);
    res.setHeader('content-type', 'image/svg+xml'); return res.end(fs.readFileSync(file));
  }
  const scene = scenes.find(s => s.id === url.searchParams.get('scene'));
  const mode = url.searchParams.get('mode');
  if (!scene || !['baro', 'tailwind'].includes(mode)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('content-type', 'text/html'); res.end(pageHtml(scene, mode));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const outDir = path.join(HERE, 'evidence'); fs.mkdirSync(outDir, { recursive: true });
const failures = [];

async function render(scene, mode) {
  const page = await browser.newPage({ viewport: { width: scene.width, height: scene.height }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference' });
  page.on('pageerror', e => failures.push(`${scene.id}/${mode}: ${e.message}`));
  page.on('requestfailed', r => failures.push(`${scene.id}/${mode}: request ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(`${base}/?scene=${scene.id}&mode=${mode}`, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => img.decode().catch(() => null)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 500; }
    await new Promise(resolve => requestAnimationFrame(resolve));
  });
  const state = await page.evaluate(() => {
    const snap = el => {
      const cs = getComputedStyle(el), o = {};
      for (let i = 0; i < cs.length; i++) if (!cs[i].startsWith('--')) o[cs[i]] = cs.getPropertyValue(cs[i]);
      return o;
    };
    const nodes = document.querySelectorAll('[data-tile]');
    const rects = [...nodes].map(el => { const r = el.getBoundingClientRect(); return { id: el.dataset.tile, x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; });
    const probes = nodes.length ? [...nodes].map(tile => [...tile.querySelectorAll('[data-probe]')].map(snap)) : [...document.querySelectorAll('[data-probe]')].map(el => [snap(el)]);
    const effects = nodes.length ? Object.fromEntries(['aspect-video', 'line-clamp'].map(id => {
      const el = document.querySelector(`[data-tile="${id}"] [data-probe]`);
      const className = id === 'aspect-video' ? 'aspect-video' : 'line-clamp-3';
      const measure = () => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return { width: r.width, height: r.height, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight,
          display: cs.display, aspectRatio: cs.aspectRatio, lineClamp: cs.webkitLineClamp }; };
      const enabled = measure(); el.classList.remove(className);
      const disabled = measure(); el.classList.add(className);
      return [id, { enabled, disabled }];
    })) : {};
    const runtime = window.__runtime?.getCacheStats().runtime ?? null;
    const rules = [...document.styleSheets].flatMap((sheet, sheetIndex) => [...sheet.cssRules].map((r, ruleIndex) => ({ sheetIndex, ruleIndex, css: r.cssText })));
    const darkRuleEvidence = rules.filter(r => /(?:dark\\:text-white|text-slate-900|dark\\:bg-slate-900|bg-white)/.test(r.css)).slice(0, 30);
    return { rects, probes, effects, runtime, cssRuleCount: rules.length, darkRuleEvidence, pageHeight: document.documentElement.scrollHeight,
      images: [...document.images].map(i => ({ src: i.getAttribute('src'), ready: i.complete && i.naturalWidth > 0 })) };
  });
  const screenshot = await page.screenshot({ fullPage: true, animations: 'allow' });
  await page.close();
  return { ...state, screenshot };
}

async function comparePngs(pngA, pngB, rects) {
  const page = await browser.newPage();
  const result = await page.evaluate(async ({ a, b, rects }) => {
    const decode = async base64 => { const img = new Image(); img.src = `data:image/png;base64,${base64}`; await img.decode(); return img; };
    const [ia, ib] = await Promise.all([decode(a), decode(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) throw new Error(`image dimensions differ: ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`);
    const canvas = document.createElement('canvas'); canvas.width = ia.width; canvas.height = ia.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(ia, 0, 0); const aa = ctx.getImageData(0, 0, ia.width, ia.height).data;
    ctx.clearRect(0, 0, ia.width, ia.height); ctx.drawImage(ib, 0, 0); const bb = ctx.getImageData(0, 0, ia.width, ia.height).data;
    return rects.map(r => {
      let changed = 0, sum = 0, count = 0;
      for (let y = r.y; y < Math.min(r.y + r.h, ia.height); y++) for (let x = r.x; x < Math.min(r.x + r.w, ia.width); x++) {
        const i = (y * ia.width + x) * 4;
        const d = Math.max(Math.abs(aa[i] - bb[i]), Math.abs(aa[i + 1] - bb[i + 1]), Math.abs(aa[i + 2] - bb[i + 2]));
        changed += +(d > 8); sum += d; count++;
      }
      return { id: r.id, pixelDiffPct: +(100 * changed / count).toFixed(2), meanMaxChannelDelta: +(sum / count).toFixed(2) };
    });
  }, { a: pngA.toString('base64'), b: pngB.toString('base64'), rects });
  await page.close(); return result;
}

async function sideBySide(scene, left, right) {
  const page = await browser.newPage({ viewport: { width: scene.width * 2, height: scene.height }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;display:flex"><img width="${scene.width}" src="data:image/png;base64,${left.toString('base64')}"><img width="${scene.width}" src="data:image/png;base64,${right.toString('base64')}"></body></html>`);
  await page.locator('img').last().evaluate(img => img.decode());
  await page.screenshot({ path: path.join(outDir, `${scene.id}-side-by-side.png`), fullPage: true });
  await page.close();
}

const sha = value => createHash('sha256').update(value).digest('hex');
const result = { reference: `Tailwind ${tailwindVersion}`, baroBundleSha256: sha(UMD), inputSha256: sha(JSON.stringify(scenes)),
  chromium: await browser.version(), viewportScale: 1, animationTimeMs: 500,
  tileCount: tiles.length, assetsReady: true, tiles: [], showcases: [] };
for (const scene of scenes) {
  const tw = await render(scene, 'tailwind'), baro = await render(scene, 'baro');
  if (tw.images.some(i => !i.ready) || baro.images.some(i => !i.ready)) { result.assetsReady = false; failures.push(`${scene.id}: image failed decode`); }
  if (tw.probes.length !== baro.probes.length) throw new Error(`${scene.id}: probe counts differ`);
  const rects = scene.id === 'tiles' ? tw.rects : [{ id: scene.id, x: 0, y: 0, w: scene.width, h: tw.pageHeight }];
  const diffs = await comparePngs(tw.screenshot, baro.screenshot, rects);
  if (scene.id === 'tiles') {
    result.darkRuleEvidence = { tailwind: tw.darkRuleEvidence, baro: baro.darkRuleEvidence };
    result.tileControls = { tailwindCssRules: tw.cssRuleCount, baroCssRules: baro.cssRuleCount };
    result.tileEffects = { tailwind: tw.effects, baro: baro.effects };
  } else {
    result.showcaseControls ??= [];
    result.showcaseControls.push({ id: scene.id, tailwindCssRules: tw.cssRuleCount, baroCssRules: baro.cssRuleCount });
  }
  const styles = tw.probes.map((group, i) => group.flatMap((ref, j) => Object.keys(ref).filter(p => ref[p] !== baro.probes[i][j]?.[p])
    .map(p => ({ probe: j, property: p, tailwind: ref[p], baro: baro.probes[i][j]?.[p] }))));
  if (scene.id === 'tiles') {
    const observedProps = ['background-color', 'background-image', 'background-blend-mode', 'backdrop-filter', 'mask-image',
      'clip-path', 'perspective', 'transform', 'transform-style', 'animation-name', 'font-family', 'grid-template-areas', 'grid-template-columns',
      'container-type', 'scroll-snap-type', '-webkit-line-clamp', 'display', 'aspect-ratio'];
    const pick = values => Object.fromEntries(observedProps.map(p => [p, values?.[p]]).filter(([, value]) => value !== undefined));
    result.tiles = tiles.map((t, i) => ({ id: t.id, group: t.group, ...diffs[i], computedDiffs: styles[i].slice(0, 12),
      computedDiffCount: styles[i].length, tailwindStyle: pick(tw.probes[i][0]),
      ...(tw.probes[i][1] ? { tailwindNestedStyle: pick(tw.probes[i][1]) } : {}) }));
    fs.writeFileSync(path.join(outDir, 'tiles-tailwind.png'), tw.screenshot);
    fs.writeFileSync(path.join(outDir, 'tiles-baro.png'), baro.screenshot);
  } else {
    result.showcases.push({ id: scene.id, ...diffs[0], computedDiffElements: styles.filter(x => x.length).length,
      computedDiffExamples: styles.flat().slice(0, 20) });
    fs.writeFileSync(path.join(outDir, `${scene.id}-tailwind.png`), tw.screenshot);
    fs.writeFileSync(path.join(outDir, `${scene.id}-baro.png`), baro.screenshot);
    await sideBySide(scene, tw.screenshot, baro.screenshot);
  }
  console.log(`${scene.id}: ${diffs.map(d => `${d.id} ${d.pixelDiffPct}%`).join(', ')}`);
}
result.failures = failures;
fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
await browser.close(); server.close();
if (failures.length) throw new Error(failures.join('\n'));
