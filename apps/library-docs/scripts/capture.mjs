// The site's screenshots: starts the studio's Vite dev server, drives the studio in Chromium and writes each shot to
// docs/public/shots/<page>/<name>.png, with docs/public/shots/manifest.json listing them. Each shot is a named step,
// so one page's shots are retaken alone. Pages read the shots; nothing here is evidence.
//   PW_DIR=/path/to/node_modules/playwright [CHROME=/path/to/chrome] [SHOTS_RENDERER=webgpu|webgl2] [SHOTS_ONLY=regex] [SHOTS_DRY=1] node scripts/capture.mjs
// SHOTS_DRY=1 walks the steps and checks their labels without writing a shot (the WebGL2 walk of Getting started).
// A heavy run: it takes the barocss-lanes-guard gate itself (BAROCSS_GATE, or the mod's gate.sh) and gives it back.
// The studio runs on 127.0.0.1:52820 and its chat port is 52891, where no chat server runs: the chat panel is off.
// The walk steps check the labels Getting started names, and the run fails on the first one that differs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const STUDIO_PORT = 52820, CHAT_PORT = 52891;
/** The site's budget: a shot at most 250 KB, all of them at most 10 MB. */
const SHOT_MAX = 250 * 1024, TOTAL_MAX = 10 * 1024 * 1024;

const docs = resolve(import.meta.dirname, '..'), studio = resolve(docs, '../cad-studio');
const shotsDir = join(docs, 'docs/public/shots'), manifestPath = join(shotsDir, 'manifest.json');
const renderer = process.env.SHOTS_RENDERER ?? 'webgpu';
const only = process.env.SHOTS_ONLY ? new RegExp(process.env.SHOTS_ONLY) : null, dry = process.env.SHOTS_DRY === '1';
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }

// The gate: one heavy run at a time across sessions. gate.sh owns the lock by its parent's PID, this process.
const gate = process.env.BAROCSS_GATE ?? join(homedir(), '.claude/local-mods/barocss-lanes-guard/bin/gate.sh');
const gated = existsSync(gate);
if (gated) {
  const g = spawnSync(gate, ['acquire', 'heavy', '1800', 'library-docs capture'], { stdio: 'inherit' });
  if (g.status !== 0) { console.error(`capture: the gate said no (exit ${g.status}); nothing ran`); process.exit(g.status ?? 1); }
} else console.warn(`capture: no gate at ${gate}; running ungated`);
const release = () => { if (gated) spawnSync(gate, ['release'], { stdio: 'inherit' }); };

process.env.CAD_STUDIO_CHAT_PORT = String(CHAT_PORT);
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import(pathToFileURL(createRequire(join(studio, 'package.json')).resolve('vite')).href);
const server = await createServer({ root: studio, configFile: join(studio, 'vite.config.ts'), server: { port: STUDIO_PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0] + (renderer === 'webgl2' ? '?renderer=webgl2' : '');
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: renderer === 'webgl2' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('dialog', d => d.accept());

// ——— the studio, as the browser flow drives it
/** How long a wait may take: SwiftShader draws the WebGL2 run on the CPU, several times slower. */
const WAIT = renderer === 'webgl2' ? 60000 : 15000;
const press = k => page.keyboard.press(k);
const field = label => page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input, select');
const text = sel => page.locator(sel).innerText().catch(() => '');
const idle = () => page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? ''), null, { timeout: 2 * WAIT })
  .catch(() => assert.fail('the studio is still computing'));
const hudReady = async () => { await page.waitForTimeout(250); return page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: WAIT })
  .catch(async () => assert.fail(`the HUD did not reach preview or refused; it shows ${JSON.stringify((await text('.hud .status')).slice(0, 80))}`)); };
const settle = async () => { await idle(); await page.waitForTimeout(600); };
const canvasCenter = async () => { const b = await page.locator('canvas.vp-canvas').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
/** The label Getting started names, as the studio shows it. */
const shows = async (sel, re, what) => {
  await page.waitForFunction(([s, src]) => new RegExp(src).test(document.querySelector(s)?.textContent ?? ''), [sel, re.source], { timeout: WAIT })
    .catch(async () => assert.fail(`Getting started says ${what}; the studio shows ${JSON.stringify((await text(sel)).slice(0, 200))}`));
};

const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { shots: [] };
const kept = new Map(manifest.shots.map(s => [s.file, s]));
/**
 * One shot under the page's folder, in the budget: the whole window as a JPEG (the viewport's gradient and shading
 * make a PNG of it too large), or `target`, a panel's locator, as a PNG (its text stays sharp).
 */
async function shot(docPage, name, step, { target, caption } = {}) {
  if (dry) return;
  const file = `${docPage}/${name}.${target ? 'png' : 'jpg'}`, path = join(shotsDir, file);
  mkdirSync(join(shotsDir, docPage), { recursive: true });
  await (target ?? page).screenshot({ path, ...(target ? {} : { type: 'jpeg', quality: 88 }) });
  const bytes = statSync(path).size;
  if (bytes > SHOT_MAX) { rmSync(path); assert.fail(`${file}: ${Math.round(bytes / 1024)} KB, over the ${SHOT_MAX / 1024} KB a shot`); }
  kept.set(file, { file, page: docPage, step, renderer, bytes, ...(caption ? { caption } : {}) });
  console.log(`  shot ${file} ${Math.round(bytes / 1024)} KB`);
}

// ——— the steps: each starts from what the one before left, as Getting started reads
const steps = [
  ['home: the starter plate', async () => {
    await page.goto(url); await page.waitForSelector(`.viewport[data-renderer="${renderer}"]`, { timeout: WAIT });
    await shows('.outliner', /Hole Ø8/, 'the studio opens on a starter plate with one Ø8 hole');
    await settle(); await shot('home', 'studio', 'home: the starter plate');
  }],
  ['tour: the layout and the palette', async () => {
    await shot('studio/tour', 'layout', 'tour: the layout and the palette');
    await press(' '); await page.waitForSelector('.palette input'); await page.locator('.palette input').fill('fillet'); await page.waitForTimeout(300);
    await shot('studio/tour', 'palette', 'tour: the layout and the palette', { target: page.locator('.palette') });
    await press('Escape');
  }],
  ['getting started: a box', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400);
    await shot('guide/getting-started', 'box-hud', 'getting started: a box');
    await press('Enter');
    await shows('.history', /Box 64×32×8/, 'the history shows `Box 64×32×8`');
    await shows('.outliner', /1 body/, 'the outliner shows one body');
  }],
  ['getting started: a hole', async () => {
    await page.click('.views button:text-is("Top")'); await page.waitForTimeout(400);
    const [cx, cy] = await canvasCenter(); await page.mouse.move(cx, cy); await page.mouse.click(cx, cy);
    await shows('.props', /SELECTION · FACE/, 'the properties panel shows `SELECTION · FACE`');
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await shows('.hud .status', /^preview$/, 'the HUD says `preview`'); await page.waitForTimeout(400);
    await shot('guide/getting-started', 'hole-preview', 'getting started: a hole');
    await press('Enter');
    await shows('.outliner', /Hole Ø8/, 'the outliner lists `Hole Ø8`');
  }],
  ['getting started: the tapped hole refused, rows loaded', async () => {
    await settle(); await page.click('.views button:text-is("Top")'); await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')), 'the top face selects');
    await shows('.props', /SELECTION · FACE/, 'the top face can be selected again');
    await press('h'); await hudReady(); await field('Type').selectOption('tapped'); await page.waitForTimeout(400);
    await shows('.hud', /\[FASTENER_SIZE_ROW\] no row for M6/, 'the HUD refuses with `[FASTENER_SIZE_ROW] no row for M6 …`');
    await shot('guide/getting-started', 'tapped-refused', 'getting started: the tapped hole refused, rows loaded', { target: page.locator('.hud') });
    await press('Escape'); await press('Escape');
    await page.click('[aria-label="Library"]');
    await page.click('[aria-label="Load sample fastener sizes"]');
    await shows('[aria-label="Fastener sizes loaded"]', /M3, M4, M5, M6, M8, M10, M12/, '**Fastener sizes loaded** reads `M3, M4, M5, M6, M8, M10, M12`');
    await shot('guide/getting-started', 'library-rows', 'getting started: the tapped hole refused, rows loaded');
    await page.click('[aria-label="Close library"]');
  }],
  ['getting started: the tapped hole', async () => {
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')), 'the top face selects');
    await press('h'); await hudReady(); await field('Type').selectOption('tapped'); await field('Centre X').fill('16'); await hudReady(); await page.waitForTimeout(400);
    await shows('.hud', /M6×1/, 'the tapped hole takes an `M6×1` thread');
    await shows('.hud', /Ø5\b/, 'the tapped hole takes a Ø5 tap drill');
    await shot('guide/getting-started', 'tapped-hole', 'getting started: the tapped hole', { target: page.locator('.hud') });
    await press('Enter'); await settle();
  }],
  ['getting started: chat off, the drawing', async () => {
    await page.click('button[aria-label="Chat"]');
    await shows('aside.chat', /Chat is off/, 'without the chat server the chat panel says **Chat is off**');
    await page.click('button[aria-label="Chat"]');
    await page.click('button:text-is("Drawing")'); await page.waitForTimeout(1500); await idle();
    for (const label of ['Export SVG', 'Export PDF', 'Export DXF'])
      assert.ok(await page.locator(`[aria-label="${label}"]`).count(), `Getting started names **${label}** in the Drawing tab`);
    await shot('guide/getting-started', 'drawing', 'getting started: chat off, the drawing');
    await page.click('button:text-is("Model")');
  }],
];

let failed = null;
try {
  for (const [name, run] of steps) {
    if (only && !only.test(name) && name !== steps[0][0]) continue;
    console.log(`step: ${name}`);
    try { await run(); } catch (e) { failed = `${name}: ${e.message}`; break; }
  }
} finally {
  await browser.close(); await server.close();
  const shots = [...kept.values()].filter(s => existsSync(join(shotsDir, s.file))).sort((a, b) => a.file.localeCompare(b.file));
  const total = shots.reduce((n, s) => n + s.bytes, 0);
  if (!dry) writeFileSync(manifestPath, JSON.stringify({ shots }, null, 1) + '\n');
  console.log(`capture: ${shots.length} shots, ${Math.round(total / 1024)} KB in all (${relative(docs, manifestPath)})`);
  if (total > TOTAL_MAX) failed ??= `the shots are ${Math.round(total / 1024)} KB, over the ${TOTAL_MAX / 1024} KB in all`;
  if (errors.length) console.warn(`page errors:\n  ${errors.slice(0, 5).join('\n  ')}`);
  release();
}
if (failed) { console.error(`capture: FAILED — ${failed}`); process.exit(1); }
