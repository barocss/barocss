// G18.3: the docs' example screenshots (docs/public/examples) captured again from the built site with the current
// viewer and hosts — each preset opened at /playground#<anchor>, its state set (an amount, a phase), and its element
// shot at the old image's width: the whole example panel ('panel', 2× shots), the canvas ('canvas'), or the owned
// display slot ('owned'). Local only: nothing is published.
//   node scripts/build-*.mjs && vitepress build docs
//   CHROME=… PW_DIR=… node scripts/capture-examples.mjs [--dry] [--only a,b] [out-dir]
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), dist = resolve(app, 'docs/.vitepress/dist');
const args = process.argv.slice(2), dry = args.includes('--dry'), only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',').filter(Boolean) : [];
const out = resolve(args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only')[0] ?? resolve(app, 'docs/public/examples'));
const PHASE = Math.PI / 2;
/** Each image: its preset's anchor, what is shot, the width it had, and the state set first. */
const SHOTS = [
  ...['gpu-scene', 'cad-curve', 'cad-surface', 'cad-extrude', 'cad-parameters', 'gpu-six-shapes', 'viewer-panel']
    .map(anchor => ({ file: `${anchor}.png`, anchor, frame: 'panel', width: 1152 })),
  { file: 'physics-step.png', anchor: 'physics-step', frame: 'panel', width: 1152, click: 'Advance 20 steps' },
  { file: 'gpu-material.png', anchor: 'gpu-material', frame: 'panel', width: 1152, amount: 0 },
  { file: 'gpu-material-amount1.png', anchor: 'gpu-material', frame: 'panel', width: 1152, amount: 1 },
  ...['rgb', 'sin', 'cos', 'radians', 'pow', 'abs', 'min', 'max', 'clamp', 'smoothstep', 'mix']
    .map(f => ({ file: `material-${f}.png`, anchor: `material-${f}`, frame: 'panel', width: 1152, amount: 0.25 })),
  ...['advanced-shader', 'cad-curved-extrude', 'cad-nonunit-curve', 'cad-weighted-parameters', 'gpu-crossed-capsules', 'gpu-rounded-stack', 'material-transition-window']
    .map(anchor => ({ file: `${anchor}.png`, anchor, frame: 'canvas', width: 640 })),
  { file: 'advanced-shader-phase.png', anchor: 'advanced-shader', frame: 'canvas', width: 640, phase: PHASE },
  ...['contour-shader', 'discrete-material', 'generated-scene', 'halftone-shader', 'reusable-shader', 'weave-shader']
    .map(anchor => ({ file: `${anchor}.jpg`, anchor, frame: 'canvas', width: 462 })),
  // (The states their pages describe: the coarser criterion, the default factor 1, the rise 3.6 cm.)
  { file: 'cad-adaptive-sampling.jpg', anchor: 'cad-adaptive-sampling', frame: 'canvas', width: 462, click: 'Coarser display · 0.2 mm' },
  { file: 'cad-quantity-functions.jpg', anchor: 'cad-quantity-functions', frame: 'canvas', width: 462, edit: [['factor: scalar = 2', 'factor: scalar = 1']] },
  { file: 'cad-rational-dome.jpg', anchor: 'cad-rational-dome', frame: 'canvas', width: 462, edit: [['value: 2.4 cm', 'value: 3.6 cm']] },
  { file: 'caustics-shader.jpg', anchor: 'caustics-shader', frame: 'canvas', width: 570 },
  { file: 'caustics-shader-phase.jpg', anchor: 'caustics-shader', frame: 'canvas', width: 570, phase: PHASE },
  { file: 'viewer-display-pose.jpg', anchor: 'viewer-display-pose', frame: 'owned', width: 462, click: 'Apply 90° display pose' },
].filter(s => !only.length || only.includes(s.file) || only.includes(s.anchor));
const SELECTOR = { panel: 'section.visual-examples', canvas: 'canvas[aria-label="Actual example output"]', owned: 'section.visual-examples figure > div' };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.stl': 'model/stl', '.ts': 'text/plain' };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url.includes('..')) { res.writeHead(400); res.end(); return; }
  for (const candidate of [url, url + '.html', join(url, 'index.html')]) {
    const file = join(dist, candidate);
    try { if ((await stat(file)).isFile()) { res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); return; } } catch { /* next */ }
  }
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = createRequire(resolve(process.env.PW_DIR, 'package.json'))('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const rows = [];
/** The page at the preset, ready: its report written, no refusal shown; then its state set. */
async function open(context, shot) {
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${origin}/playground#${shot.anchor}`);
  await page.waitForFunction(() => /^\{/.test(document.querySelector('pre.example-report')?.textContent?.trim() ?? ''), null, { timeout: 60000 });
  // (The site's fixed bar would cover an element scrolled under it: hidden — it is fixed, the layout stays.)
  await page.addStyleTag({ content: '.VPNav, .VPLocalNav { display: none !important; }' });
  // (A range input: its value set and an input event sent, as a drag would — the component's v-model and handler see it.)
  const slide = (label, value) => page.locator(`input[aria-label="${label}"]`).evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  if (shot.amount !== undefined) await slide('Material amount', shot.amount);
  if (shot.phase !== undefined) await slide('Shader phase', shot.phase);
  if (shot.edit) {
    const box = page.locator('textarea[aria-label="Example source"]');
    let text = await box.inputValue();
    for (const [from, to] of shot.edit) { if (!text.includes(from)) throw new Error(`${shot.file}: no "${from}" in its source`); text = text.replace(from, to); }
    await box.fill(text); await page.getByRole('button', { name: 'Run input', exact: true }).click();
  }
  if (shot.click) await page.getByRole('button', { name: shot.click, exact: true }).click();
  await page.waitForTimeout(1200);
  const refused = await page.locator('.example-error').count();
  if (refused || errors.length) throw new Error(`${shot.file}: ${refused ? await page.locator('.example-error').innerText() : ''} ${errors.join('; ')}`);
  return page;
}
try {
  if (!dry) await mkdir(out, { recursive: true });
  const probe = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  for (const shot of SHOTS) {
    // (The element's CSS width at 1×, then the pixel ratio that gives the old image's width.)
    const p0 = await open(probe, shot), css = (await p0.locator(SELECTOR[shot.frame]).first().boundingBox()).width; await p0.close();
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: shot.width / css });
    const page = await open(context, shot), el = page.locator(SELECTOR[shot.frame]).first();
    const report = JSON.parse(await page.locator('pre.example-report').textContent());
    const bytes = await el.screenshot({ type: shot.file.endsWith('.jpg') ? 'jpeg' : 'png', ...(shot.file.endsWith('.jpg') ? { quality: 90 } : {}), animations: 'disabled' });
    if (!dry) await writeFile(join(out, shot.file), bytes);
    rows.push({ file: shot.file, frame: shot.frame, ...(shot.click ? { click: shot.click } : {}), ...(shot.edit ? { edit: shot.edit.map(e => e.join(' → ')) } : {}), css: Math.round(css), ratio: +(shot.width / css).toFixed(4), bytes: bytes.length, backend: report.backend ?? null, ...(shot.amount !== undefined ? { amount: shot.amount } : {}), ...(shot.phase !== undefined ? { phase: +shot.phase.toFixed(4) } : {}) });
    await context.close();
    console.error(`captured ${shot.file}`);
  }
  console.log(JSON.stringify({ status: 'captured', out, shots: rows }, null, 1));
} finally { await browser.close(); server.close(); }
