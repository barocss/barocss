// The site's screenshots: starts the studio's Vite dev server, drives the studio in Chromium and writes each shot to
// docs/public/shots/<page>/<name>.png, with docs/public/shots/manifest.json listing them. Each shot is a named step,
// so one page's shots are retaken alone. Pages read the shots; nothing here is evidence.
//   PW_DIR=/path/to/node_modules/playwright [CHROME=/path/to/chrome] [SHOTS_RENDERER=webgpu|webgl2] [SHOTS_ONLY=regex] [SHOTS_DRY=1] node scripts/capture.mjs
// SHOTS_DRY=1 walks the steps and checks their labels without writing a shot (the WebGL2 walk of Getting started).
// A heavy run: it takes the barocss-lanes-guard gate itself (BAROCSS_GATE, or the mod's gate.sh) and gives it back.
// The studio runs on 127.0.0.1:52820 and its chat port is 52891, where no chat server runs: the chat panel is off.
// The walk steps check the labels Getting started names, and the run fails on the first one that differs.
// The agent pages' step streams scripted turns in the browser (the studio's DEV hook __studioScriptChat: the chat
// server's own events, no server and no model); its proposal is made by the real tool layer, through cad-mcp.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
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
const clickAt = async (x, y) => { await page.mouse.move(x - 4, y); await page.mouse.move(x, y); await page.mouse.click(x, y); };
const iso = async () => { await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500); };
const newPart = async () => { await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc?.nodes.length === 0, null, { timeout: WAIT }); };
const fromPalette = async (words) => { await press(' '); await page.locator('.palette input').fill(words); await page.locator('.palette input').press('Enter'); await hudReady(); };
const boxWithHole = async () => {
  await newPart(); await press('b'); await hudReady(); await press('Enter'); await shows('.outliner', /1 body/, 'a box makes one body'); await idle();
  assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')), 'the top face selects');
  await press('h'); await hudReady(); await page.waitForTimeout(250); await press('Enter');
  await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: WAIT }); await idle();
};
/** A Joints card slider set as a person drags it (turns in radians, slides in mm). */
const slide = (label, v) => page.evaluate(([l, x]) => { const el = document.querySelector(`[aria-label="${l}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [label, v]);
const rad = d => d * Math.PI / 180;
/** The robots page's sample shots: each sample with the pose its motion is played to (its demo motion's main waypoint). */
const ROBOT_SHOTS = [
  ['arm-6r', { 'base~l1': rad(90), 'l1~l2': rad(-30), 'l2~l3': rad(60) }],
  ['scara', { 'base~arm1': rad(45), 'arm1~arm2': rad(-60), 'arm2~quill': -30 }],
  // (The gantry's ram stays up: lowered on this path it meets the X carriage, which the shot isn't about.)
  ['gantry-ppp', { 'base~x': 150, 'x~y': 100 }],
];
/** A file the studio opens, written outside the repository. */
const scratchFile = (name, bytes) => { const dir = join(tmpdir(), 'library-docs-capture'); mkdirSync(dir, { recursive: true }); const f = join(dir, name); writeFileSync(f, bytes); return f; };
const openFile = async (file) => {
  await page.evaluate(() => { window.__captureLastDoc = window.__studioDoc; });
  await page.setInputFiles('input[aria-label="Model file"]', file);
  await page.waitForFunction(() => window.__studioDoc !== window.__captureLastDoc, null, { timeout: WAIT }); await idle();
};
/** The studio loaded again, its unsaved-work offer discarded: a studio page's step starts from nothing left over. */
const fresh = async () => {
  await page.goto(url); await page.waitForSelector(`.viewport[data-renderer="${renderer}"]`, { timeout: WAIT });
  const offer = page.locator('[aria-label="Recover unsaved work"] button:text-is("Discard")');
  if (await offer.count()) await offer.click();
  await idle();
};
/** The Browser's first body picked, its properties shown (a click can land as the list settles: tried again). */
const pickFirstBody = async () => {
  for (let k = 0; k < 3; k++) {
    await page.locator('.outliner .ol').first().click();
    if (await page.waitForFunction(() => /Volume\s*[\d,]+ mm³/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: WAIT }).then(() => true, () => false)) return;
  }
  assert.fail('the first body in the Browser could not be picked');
};
/** The document cad-mcp leaves after one tool call on `doc` (the real tool layer, at autonomy L2; no model). */
async function proposedDoc(doc, args) {
  const file = scratchFile('agent-plate.bcad', JSON.stringify(doc));
  const server = spawn(process.execPath, [join(studio, 'scripts/cad-mcp.mjs'), '--doc', file], { stdio: ['pipe', 'pipe', 'inherit'] });
  try {
    const waiting = new Map(); let id = 0, buffer = '';
    server.stdout.on('data', d => { buffer += d; let k; while ((k = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, k); buffer = buffer.slice(k + 1); const m = JSON.parse(line); waiting.get(m.id)?.(m); } });
    const send = (method, params) => new Promise(done => { const n = ++id; waiting.set(n, done); server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
    await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'docs-capture', version: '0' } });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const r = (await send('tools/call', { name: 'proposals', arguments: args })).result;
    assert.equal(r.isError, false, r.content?.[0]?.text);
    return JSON.parse(readFileSync(file, 'utf8'));
  } finally { server.kill(); }
}
const displayPopover = async () => { const d = page.locator('[aria-label="Display and previews"]'); if (await d.getAttribute('aria-expanded') !== 'true') await d.click(); };
/** A binary STL of a sphere with its top cap off: one hole, for the repair dialog. */
function cupStl() {
  const n = 24, m = 12, P = [[0, 0, -10]], T = [];
  for (let j = 1; j < m; j++) { const phi = -Math.PI / 2 + Math.PI * j / m; for (let i = 0; i < n; i++) { const th = 2 * Math.PI * i / n; P.push([10 * Math.cos(phi) * Math.cos(th), 10 * Math.cos(phi) * Math.sin(th), 10 * Math.sin(phi)]); } }
  const at = (j, i) => 1 + (j - 1) * n + (i % n);
  for (let i = 0; i < n; i++) T.push([0, at(1, i + 1), at(1, i)]);
  for (let j = 1; j < m - 2; j++) for (let i = 0; i < n; i++) T.push([at(j, i), at(j, i + 1), at(j + 1, i + 1)], [at(j, i), at(j + 1, i + 1), at(j + 1, i)]);
  const b = Buffer.alloc(84 + 50 * T.length); b.write('cup', 0); b.writeUInt32LE(T.length, 80);
  T.forEach((t, k) => { const o = 84 + 50 * k; t.forEach((v, c) => P[v].forEach((x, d) => b.writeFloatLE(x, o + 12 + 12 * c + 4 * d))); });
  return b;
}
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
    // (The first step always runs, to load the studio; its shot only when it was asked for.)
    await settle(); if (!only || only.test('home: the starter plate')) await shot('home', 'studio', 'home: the starter plate');
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
  // ——— the studio pages
  ['studio/sketches: a rectangle', async () => {
    await fresh();
    await newPart(); await press('s'); await press('r');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx - 160, cy - 90); await clickAt(cx + 160, cy + 90); await page.waitForTimeout(500);
    await shot('studio/sketches', 'rectangle', 'studio/sketches: a rectangle');
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await shows('.outliner', /1 body/, 'an extruded sketch makes one body');
  }],
  ['studio/features: holes on a circle, a SubD box', async () => {
    await fresh();
    await newPart(); await press('b'); await hudReady();
    await field('Width X').fill('80'); await field('Depth Y').fill('80'); await field('Height Z').fill('10'); await hudReady(); await page.waitForTimeout(300); await press('Enter'); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')), 'the top face selects');
    await press('h'); await hudReady(); await field('Copies').selectOption({ label: 'On a circle' }); await field('Centre X').fill('60'); await hudReady();
    await shows('.hud .status', /^preview$/, 'holes on a circle preview'); await page.waitForTimeout(400);
    await iso(); await shot('studio/features', 'holes-on-a-circle', 'studio/features: holes on a circle, a SubD box');
    await press('Escape'); await press('Escape');
    await newPart(); await fromPalette('subd box'); await shows('.hud .status', /^preview$/, 'SubD box previews'); await press('Enter');
    await shows('.history', /SubD box/, 'the history lists the SubD box'); await idle(); await iso();
    await shot('studio/features', 'subd-box', 'studio/features: holes on a circle, a SubD box');
  }],
  ['studio/display: the popover, a section, zebra', async () => {
    await fresh();
    await boxWithHole(); await press('Escape'); await iso(); await displayPopover(); await page.waitForTimeout(300);
    await shot('studio/display', 'display-popover', 'studio/display: the popover, a section, zebra', { target: page.locator('[aria-label="Previews"]') });
    await page.click('[aria-label="Display and previews"]');
    await page.click('[aria-label="Section view"]'); await page.waitForSelector('[data-handle="section"]', { timeout: WAIT }); await page.waitForTimeout(800);
    await shot('studio/display', 'section', 'studio/display: the popover, a section, zebra');
    await page.click('[aria-label="Section view"]'); await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => window.__studioPickEdge('n1.side0|n1.top')), 'an edge picks');
    await fromPalette('fillet'); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: WAIT }); await idle(); await press('Escape');
    await page.click('[aria-label="Surface analysis"]'); await page.waitForTimeout(800); await iso();
    await shot('studio/display', 'zebra', 'studio/display: the popover, a section, zebra');
    await shot('studio/display', 'preview-analysis', 'studio/display: the popover, a section, zebra', { target: page.locator('[aria-label="Preview & analysis"]') });
    await page.click('[aria-label="Surface analysis"]'); await page.click('[aria-label="Surface analysis"]');
  }],
  ['studio/manufacturing: the thickness map, the CNC preview, print layers', async () => {
    await fresh();
    if (renderer === 'webgpu') {
      const plate = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, process: 'injection', mould: { version: 1, pull: [0, 0, 1], finish: 'smooth' },
        nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }, { kind: 'extrude', sketch: 0, height: 10 }, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [30, 20], radius: 5 }],
        outputs: { b2: { node: 2, side: 'solid' } } };
      await openFile(scratchFile('moulded-plate.bcad', JSON.stringify(plate))); await iso();
      await page.click('[aria-label="Analysis map"]'); await page.waitForSelector('[aria-label="Map legend"]', { timeout: WAIT }); await page.waitForTimeout(800);
      await shot('studio/manufacturing', 'thickness-map', 'studio/manufacturing: the thickness map, the CNC preview, print layers', { caption: 'WebGPU only' });
      await page.click('[aria-label="Analysis map"]').catch(() => {});
    }
    await openFile(join(studio, 'test/fixtures/cnc8-pocket.bcad')); await iso();
    // (One preview at a time, chosen in the dock's Preview & analysis.)
    await page.click('[aria-label="Preview: CNC"]');
    await page.waitForFunction(() => window.__studioCam?.()?.stage === 'ready', null, { timeout: 4 * WAIT });
    await page.click('[aria-label="CNC progress to the end"]'); await page.waitForTimeout(1200);
    await shows('[aria-label="CNC preview"]', /NOT FOR PRODUCTION/, 'the CNC preview opens with `NOT FOR PRODUCTION`');
    await shot('studio/manufacturing', 'cnc-preview', 'studio/manufacturing: the thickness map, the CNC preview, print layers');
    await page.click('[aria-label="Preview: Print"]');
    await page.waitForFunction(() => window.__studioPrint?.()?.stage === 'ready', null, { timeout: 4 * WAIT });
    // (Part way up, where the pocket shows: the range set as a drag sets it, its value then the event React hears.)
    await page.locator('[aria-label="Print layer"]').evaluate(el => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(Math.round(Number(el.max) * 0.7))); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => window.__studioPrint?.()?.stage === 'ready' && window.__studioPrint().display.layer.k > 1, null, { timeout: 4 * WAIT }); await page.waitForTimeout(800);
    await shot('studio/manufacturing', 'print-layers', 'studio/manufacturing: the thickness map, the CNC preview, print layers');
    await page.click('[aria-label="Preview: None"]');
  }],
  ['studio/assemblies: interference', async () => {
    await fresh();
    await newPart(); await press('b'); await hudReady(); await press('Enter'); await shows('.outliner', /1 body/, 'a box makes one body'); await idle();
    await press('Escape'); await press('y'); await hudReady();
    await field('Centre X').fill('16'); await field('Centre Y').fill('16'); await field('Radius').fill('4'); await field('Height').fill('30'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await shows('.outliner', /2 bodies/, 'a cylinder beside a box makes two bodies'); await idle();
    await fromPalette('interference').catch(() => {});
    await page.waitForFunction(() => /∩/.test(document.querySelector('aside[aria-label="Interference"]')?.textContent ?? ''), null, { timeout: WAIT });
    await iso(); await shot('studio/assemblies', 'interference', 'studio/assemblies: interference');
  }],
  ['studio/frames: a table frame, the cut list', async () => {
    await fresh();
    await newPart(); await fromPalette('skeleton');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 4 * WAIT }); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /8 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 8 * WAIT }); await idle(); await iso();
    await shot('studio/frames', 'table-frame', 'studio/frames: a table frame, the cut list');
    await pickFirstBody(); await page.click('[aria-label="Show the cut list"]'); await page.waitForSelector('[aria-label="Cut list"]', { timeout: WAIT });
    await shot('studio/frames', 'cut-list', 'studio/frames: a table frame, the cut list', { target: page.locator('[aria-label="Cut list"]') });
    await press('Escape');
  }],
  ['studio/bom: a shaft and its key', async () => {
    await fresh();
    await newPart();
    for (const [label, pickShaft] of [['Shaft', false], ['Key', true]]) {
      if (pickShaft) { await page.locator('.outliner .ol', { hasText: /^Shaft/ }).first().click(); await page.waitForTimeout(300); }
      await fromPalette(label); await page.waitForTimeout(300); await press('Enter'); await idle();
    }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(n => n.kind === 'key'), null, { timeout: 2 * WAIT });
    await page.click('nav[aria-label="Tools"] [aria-label="BOM"]'); await page.waitForSelector('[aria-label="BOM line 2"]', { timeout: 2 * WAIT }); await iso();
    await shot('studio/bom', 'bom', 'studio/bom: a shaft and its key');
    await page.click('nav[aria-label="Tools"] [aria-label="BOM"]');
  }],
  ['studio/drawings: auto-dimension', async () => {
    await fresh();
    await boxWithHole(); await press('Escape');
    await page.click('.mode button:text-is("Drawing")'); await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 2 * WAIT });
    await page.click('[aria-label="Auto-dimension"]'); await page.waitForFunction(() => window.__studioDrawing().dimensions.length > 2, null, { timeout: WAIT }); await page.waitForTimeout(600);
    await shot('studio/drawings', 'auto-dimension', 'studio/drawings: auto-dimension');
    await page.click('.mode button:text-is("Model")');
  }],
  ['studio/robots: the Joints card', async () => {
    await fresh();
    const c = JSON.parse(readFileSync(join(studio, '../../packages/barocss-cad/conformance/rm/chain-2r/case.json'), 'utf8'));
    await openFile(scratchFile('chain-2r.bcad', JSON.stringify(c.input.document)));
    await page.waitForSelector('[aria-label="Joint a~b value"]', { timeout: 2 * WAIT }); await iso(); await page.waitForTimeout(500);
    await shot('studio/robots', 'joints', 'studio/robots: the Joints card');
  }],
  ...ROBOT_SHOTS.map(([id, pose]) => [`studio/robots: the ${id} sample, its motion paused half-way`, async () => {
    await fresh();
    await openFile(join(studio, `../../packages/barocss-cad-model/samples/robots/${id}.bcad`));
    // (The pose shown is the motion's end: home to it, played and scrubbed to half its time.)
    for (const [key, value] of Object.entries(pose)) {
      await page.waitForSelector(`[aria-label="Joint ${key} value"]`, { timeout: 2 * WAIT });
      await slide(`Joint ${key} value`, value);
    }
    await page.waitForSelector('[aria-label="Motion"] [aria-label="Play motion"]:not([disabled])', { timeout: 2 * WAIT });
    const T = +/\/ ([\d.]+) s$/.exec(await page.locator('[aria-label="Motion time readout"]').innerText())[1];
    await slide('Motion time', T / 2); await iso(); await page.waitForTimeout(500);
    await shot('studio/robots', `${id}-motion`, `studio/robots: the ${id} sample, its motion paused half-way`);
  }]),
  ['studio/files: the mesh repair dialog', async () => {
    await fresh();
    await page.setInputFiles('input[aria-label="Model file"]', scratchFile('cup.stl', cupStl()));
    await page.waitForSelector('[aria-label="Mesh units"]', { timeout: WAIT });
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    await page.waitForSelector('[aria-label="Mesh repair"]', { timeout: WAIT });
    await page.locator('[aria-label="Mesh repair"] button', { hasText: 'Check the repair' }).click();
    await page.waitForSelector('[aria-label="Repair report"]', { timeout: WAIT }); await page.waitForTimeout(300);
    await shot('studio/files', 'mesh-repair', 'studio/files: the mesh repair dialog', { target: page.locator('[aria-label="Mesh repair"]') });
    await page.locator('[aria-label="Mesh repair"] button', { hasText: 'Cancel' }).click().catch(() => press('Escape'));
  }],
  ['studio/parameters: a chamfer bound to C, a configuration', async () => {
    await fresh(); await newPart(); await press('b'); await hudReady(); await press('Enter'); await shows('.outliner', /1 body/, 'a box makes one body'); await idle();
    assert.ok(await page.evaluate(() => window.__studioPickEdge('n1.side0|n1.top')), 'an edge picks');
    await fromPalette('chamfer'); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'chamfer', null, { timeout: WAIT }); await idle(); await press('Escape');
    await page.click('[aria-label="Parameters"]');
    await page.fill('[aria-label="New parameter name"]', 'C'); await page.fill('[aria-label="New parameter value"]', '3'); await page.click('[aria-label="Add parameter"]');
    await page.waitForFunction(() => window.__studioDoc.parameters.C === 3, null, { timeout: WAIT });
    await page.click('[aria-label="Close parameters"]');
    if (await page.locator('.outliner [aria-label="Show its features"]').count()) await page.click('.outliner [aria-label="Show its features"]');
    await page.locator('.outliner .ol-step', { hasText: 'Chamfer' }).click();
    await page.waitForSelector('[aria-label="Distance parameter"]', { timeout: WAIT });
    await page.selectOption('[aria-label="Distance parameter"]', 'C');
    await shot('studio/parameters', 'bind', 'studio/parameters: a chamfer bound to C, a configuration', { target: page.locator('.node-editor') });
    await page.locator('.node-editor button', { hasText: 'Apply' }).click();
    await page.waitForFunction(() => JSON.stringify(window.__studioDoc.nodes.at(-1)?.distance) === '{"parameter":"C"}', null, { timeout: WAIT }); await idle();
    await page.click('[aria-label="Parameters"]');
    await page.fill('[aria-label="Configuration name"]', 'small'); await page.click('[aria-label="Save configuration"]');
    await page.fill('[aria-label="Value of C"]', '6'); await press('Tab');
    await page.waitForFunction(() => window.__studioDoc.parameters.C === 6, null, { timeout: WAIT }); await idle();
    await page.fill('[aria-label="Configuration name"]', 'large'); await page.click('[aria-label="Save configuration"]'); await iso(); await page.waitForTimeout(400);
    await shot('studio/parameters', 'panel', 'studio/parameters: a chamfer bound to C, a configuration');
    await page.click('[aria-label="Apply small"]');
    await page.waitForFunction(() => window.__studioDoc.parameters.C === 3, null, { timeout: WAIT });
    await page.click('[aria-label="Close parameters"]');
  }],
  ['studio/rendering: the Render workspace', async () => {
    await fresh();
    await page.click('.mode button:text-is("Render")'); await page.waitForSelector('aside[aria-label="Render"]', { timeout: WAIT });
    if (renderer === 'webgpu') {
      await page.selectOption('[aria-label="Appearance preset"]', 'look-brass'); await page.waitForTimeout(1500);
      await shot('studio/rendering', 'appearance', 'studio/rendering: the Render workspace', { caption: 'WebGPU only' });
      await page.locator('aside[aria-label="Render"] [role="tab"]', { hasText: 'Lights' }).click(); await page.waitForTimeout(300);
      await shot('studio/rendering', 'lights', 'studio/rendering: the Render workspace', { target: page.locator('aside[aria-label="Render"]') });
      await page.locator('aside[aria-label="Render"] [role="tab"]', { hasText: 'Source' }).click(); await page.waitForTimeout(300);
      await shot('studio/rendering', 'source', 'studio/rendering: the Render workspace', { target: page.locator('aside[aria-label="Render"]') });
      await shot('studio/rendering', 'timeline', 'studio/rendering: the Render workspace', { target: page.locator('[aria-label="Timeline"]') });
    } else await shows('aside[aria-label="Render"]', /Rendering needs a browser with WebGPU/, 'on WebGL2 the Render panel says it needs WebGPU');
    await page.click('.mode button:text-is("Model")');
  }],
  // ——— the agent pages: scripted turns streamed in the browser; the proposal made by the real tool layer
  ['agent: a turn applied, a proposal', async () => {
    const plate = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
      nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 8 }],
      outputs: { b1: { node: 1, side: 'solid' } } };
    const thicker = { tool: 'features', args: { action: 'edit', index: 1, values: { h: 10 } } };
    const hole = { tool: 'features', args: { action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 8, x: 30, y: 20 } } };
    const proposed = await proposedDoc(plate, { action: 'propose', title: 'Thicker, with a hole', ops: [thicker, hole] });
    const turns = [
      [{ type: 'reasoning', delta: 'An empty part, so at L2 the first build applies directly.' },
        { type: 'tool', name: 'features', input: { action: 'command', command: 'box', values: { w: 60, d: 40, h: 8 } }, summary: 'Box → 1 body, 19200 mm³', isError: false },
        { type: 'state', doc: plate }, { type: 'text', delta: 'A 60 × 40 × 8 plate.' }, { type: 'done', doc: plate, session: 'scripted', end: 'done' }],
      [{ type: 'reasoning', delta: 'Two features in one change: at L2 that is a proposal.' },
        { type: 'tool', name: 'features', input: { action: 'batch', ops: [thicker, hole] }, summary: 'At autonomy L2 this turn adds 1 feature: propose it (proposals.propose) instead, and the user accepts it.', isError: true },
        { type: 'tool', name: 'proposals', input: { action: 'propose', title: 'Thicker, with a hole' }, summary: 'P1 proposed: Thicker, with a hole', isError: false },
        { type: 'state', doc: proposed }, { type: 'text', delta: 'Proposed as P1. Preview it, then accept or reject it.' }, { type: 'done', doc: proposed, session: 'scripted', end: 'done' }],
    ];
    await page.route(u => u.pathname === '/api/chat/status', r => r.fulfill({ json: { enabled: true, model: 'scripted', via: 'scripted' } }));
    try {
      await fresh(); await newPart(); await page.click('button[aria-label="Chat"]');
      await page.waitForFunction(() => !!window.__studioScriptChat, null, { timeout: WAIT });
      await page.evaluate(t => window.__studioScriptChat(t), turns);
      const input = page.locator('[aria-label="Chat message"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: WAIT });
      await input.fill('A 60 × 40 plate, 8 thick.'); await press('Enter');
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 2, null, { timeout: 2 * WAIT }); await idle(); await iso();
      await page.waitForTimeout(600);
      await shot('agent', 'turn-applied', 'agent: a turn applied, a proposal');
      await input.fill('Make it 10 thick, with an 8 mm hole in the middle.'); await press('Enter');
      await page.waitForSelector('[aria-label="Proposal P1 from the chat"]', { timeout: 2 * WAIT });
      assert.deepEqual(await page.evaluate(() => window.__studioDoc.nodes.map(n => n.kind)), ['sketch', 'extrude'], 'the part is unchanged until the proposal is accepted');
      await page.waitForTimeout(400);
      await shot('agent/proposals', 'refused-then-proposed', 'agent: a turn applied, a proposal', { target: page.locator('[aria-label="Chat column"]') });
      await page.locator('[aria-label="Proposal P1"] button:text-is("Preview")').click();
      await page.waitForSelector('[aria-label="P1 features"]', { timeout: 2 * WAIT }); await page.waitForTimeout(800);
      await shot('agent/proposals', 'preview', 'agent: a turn applied, a proposal');
      await shot('agent/proposals', 'card', 'agent: a turn applied, a proposal', { target: page.locator('[aria-label="Proposal P1"]') });
    } finally { await page.unroute(u => u.pathname === '/api/chat/status').catch(() => {}); await page.evaluate(() => window.__studioUnscriptChat?.()).catch(() => {}); }
  }],
];

// (A failed step is reported and the run goes on: the studio pages' steps each start from a new part or a file. A
// Getting started step that fails leaves the ones after it to fail too, which the list shows.)
const failures = [];
let failed = null;
try {
  for (const [name, run] of steps) {
    if (only && !only.test(name) && name !== steps[0][0]) continue;
    console.log(`step: ${name}`);
    try { await run(); } catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]}`); console.log(`  FAILED ${failures.at(-1)}`); await press('Escape').catch(() => {}); await press('Escape').catch(() => {}); }
  }
  if (failures.length) failed = `${failures.length} step(s):\n  ${failures.join('\n  ')}`;
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
