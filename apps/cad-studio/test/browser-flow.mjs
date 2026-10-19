// End-to-end flow in a real Chromium: starts the Vite dev server, drives the studio like a user,
// asserts on visible state and writes a screenshot per step.
//   PW_DIR=/path/to/node_modules/playwright [CHROME=/path/to/chrome] [FLOW_RENDERER=webgpu|webgl2] [FLOW_ONLY=regex] node test/browser-flow.mjs [out-dir]
// FLOW_ONLY runs the first step and the steps whose names match (for steps that start from a new part).
// The viewport draws with WebGPU when the browser has it; FLOW_RENDERER=webgl2 runs the WebGL2 fallback.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer as createNetServer } from 'node:net';

const root = resolve(import.meta.dirname, '..');
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const out = resolve(process.argv[2] ?? join(tmpdir(), 'cad-studio-flow'));
mkdirSync(out, { recursive: true });

// (The chat server's port, read when the config loads: the L2 step starts the real one there, other chat steps mock it.
// The first free one from 52091 up, unless CAD_STUDIO_CHAT_PORT says: another tool's server on 52091 failed the chat
// steps once, D86.)
/** Whether nothing listens on 127.0.0.1:port (a listen there succeeds). */
const portFree = port => new Promise(ok => { const s = createNetServer(); s.once('error', () => ok(false)); s.listen(port, '127.0.0.1', () => s.close(() => ok(true))); });
if (!process.env.CAD_STUDIO_CHAT_PORT) {
  let port = 52091; while (port < 52191 && !(await portFree(port))) port++;
  process.env.CAD_STUDIO_CHAT_PORT = String(port);
}
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52031, strictPort: false }, logLevel: 'error' });
await server.listen();
const renderer = process.env.FLOW_RENDERER ?? 'webgpu';
const url = server.resolvedUrls.local[0] + (renderer === 'webgl2' ? '?renderer=webgl2' : '');
// WebGPU on the machine's adapter; the WebGL2 run uses SwiftShader (which offers no WebGPU adapter).
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: (process.env.FLOW_RENDERER ?? 'webgpu') === 'webgl2' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
// (Leaving with unsaved work asks first; the flow reloads on purpose.)
page.on('dialog', d => d.accept());

const results = [];
let step = 0;
async function check(name, fn) {
  step++;
  if (process.env.FLOW_ONLY && step > 1 && !new RegExp(process.env.FLOW_ONLY, 'i').test(name)) return;
  try { await fn(); results.push({ step, name, ok: true }); }
  catch (e) { results.push({ step, name, ok: false, error: String(e.message ?? e).split('\n')[0] }); if (process.env.FLOW_DEBUG) console.log(String(e.message ?? e).slice(0, 1500)); }
  await page.screenshot({ path: join(out, `${String(step).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`) });
}
const outliner = () => page.locator('.outliner').innerText();
/** The first body's volume from its properties (a click on its row selects it, or takes it out of the selection: until the body's panel shows). */
async function bodyVolume() {
  for (let k = 0; k < 3; k++) {
    await page.locator('.outliner .ol').first().click();
    try { await page.waitForFunction(() => /Volume\s*[\d,]+ mm³/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 15000 }); break; } catch { /* clicked off: again */ }
  }
  return Number(/Volume\s*([\d,]+) mm³/.exec(await page.textContent('.props'))?.[1].replace(/,/g, ''));
}
/**
 * A model file opened: until the studio shows the bodies computed for this document — not the last one's. (Waiting only
 * for its node count let a step read the previous step's body as its own when both had the same count and the machine
 * was loaded: R10.3c's "before" was R10.3b's filleted boss, 39 603 mm³, D109.)
 */
async function openModel(file, nodes, timeout = 30000) {
  await page.evaluate(() => { window.__flowLastDoc = window.__studioDoc; });
  await page.setInputFiles('input[aria-label="Model file"]', file);
  await page.waitForFunction(n => window.__studioDoc !== window.__flowLastDoc && window.__studioDoc.nodes.length === n && window.__studioFresh === true, nodes, { timeout });
}
const history = () => page.locator('.history').innerText().catch(() => '');
const idle = () => page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? ''), null, { timeout: 30000 });
const hudReady = async () => { await page.waitForTimeout(250); return page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 }); };
const field = (label) => page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input, select');
const press = (k) => page.keyboard.press(k);
const canvasCenter = async () => { const b = await page.locator('canvas').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

try {
  await page.goto(url);
  await check('starter plate loads', async () => {
    await idle(); assert.match(await outliner(), /Hole Ø8/);
    await page.waitForSelector(`.viewport[data-renderer="${renderer}"]`, { timeout: 15000 });
  });

  await check('new part and box', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter'); await idle();
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''));
    assert.match(await history(), /Box 32×32×16/);
  });

  await check('second box and union', async () => {
    await press('b'); await hudReady(); await field('At X').fill('16'); await field('At Y').fill('16'); await hudReady();
    await page.waitForTimeout(400); await press('Enter'); await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''));
    const rows = page.locator('.outliner .ol'); await rows.nth(0).click(); await rows.nth(1).click({ modifiers: ['Shift'] });
    await press('u'); await page.waitForFunction(() => /Union/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    assert.match(await outliner(), /1 body/);
  });

  await check('undo and redo', async () => {
    await press('Meta+z'); await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await press('Meta+Shift+z'); await page.waitForFunction(() => /Union/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
  });

  await check('hole on a supported plate', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Top")'); await page.waitForTimeout(300);
    const [cx, cy] = await canvasCenter(); await page.mouse.move(cx, cy); await page.mouse.click(cx, cy);
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
  });

  await check('feature editor changes the sketch a feature is made from', async () => {
    const bounds = () => page.locator('.props').innerText();
    await page.locator('.history .hs', { hasText: 'Box 64' }).click();
    const ed = (label) => page.locator('.node-editor .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input, select');
    assert.equal(await ed('Width').inputValue(), '64');
    await ed('Width').fill(''); await ed('Width').fill('80');
    await page.locator('.node-editor button', { hasText: 'Apply' }).click(); await idle();
    await page.locator('.outliner .ol').nth(0).click();
    await page.waitForFunction(() => /80 × 32 × 8/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 15000 });
    assert.match(await outliner(), /Hole Ø8/);
    await press('Escape'); await press('Meta+z'); await idle(); await page.locator('.outliner .ol').nth(0).click();
    await page.waitForFunction(() => /64 × 32 × 8/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 15000 });
    assert.ok(!/80 ×/.test(await bounds()));
  });

  await check('any hole size works; a hole off the body explains itself', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('100'); await field('Depth Y').fill('60'); await field('Height Z').fill('5'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 100×60×5/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Top")'); await page.waitForTimeout(300);
    const [cx, cy] = await canvasCenter(); await page.mouse.move(cx, cy); await page.mouse.click(cx, cy);
    // Ø6 on 100 × 60 used to be refused (non-dyadic chart parameters); numeric policy v1 certifies it.
    await press('h'); await hudReady(); await field('Diameter').fill('6'); await field('Centre X').fill('6'); await field('Centre Y').fill('6');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
    // Crossing the edge makes a notch (B-rep part model); missing the plate is refused with the reason.
    await field('Centre X').fill('2'); await field('Diameter').fill('8');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
    // Its whole cylinder shows see-through beside the notch.
    await page.click('.views button:text-is("Iso")'); await page.waitForTimeout(500); await page.screenshot({ path: join(out, '07a-hole-region-edge.png') });
    await field('Centre X').fill('300');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'refused', null, { timeout: 15000 });
    assert.match(await page.locator('.hud-error').innerText(), /misses the body/);
    await press('Escape');
  });

  await check('pattern from the context menu', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''));
    await page.locator('.outliner .ol').first().click();
    const [cx, cy] = await canvasCenter(); await page.mouse.click(cx, cy + 300, { button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Linear pattern' }).click(); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    // The pattern is one feature result holding the original and its copies.
    await page.waitForFunction(() => /Pattern ×3/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    assert.match(await outliner(), /1 body/);
  });

  await check('Boolean chains and a hole on the result (no feature limits)', async () => {
    await page.click('[aria-label="New part"]');
    for (const [x, y] of [[0, 0], [24, 8], [48, 0]]) {
      await press('b'); await hudReady(); await field('At X').fill(String(x)); await field('At Y').fill(String(y)); await hudReady(); await page.waitForTimeout(300); await press('Enter');
      await page.waitForTimeout(300);
    }
    await page.waitForFunction(() => /3 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    for (let k = 0; k < 2; k++) {
      const rows = page.locator('.outliner .ol'); await rows.nth(0).click(); await rows.nth(1).click({ modifiers: ['Shift'] });
      await press('u'); await page.waitForFunction(n => document.querySelectorAll('.outliner .ol').length === n, 2 - k, { timeout: 15000 });
    }
    assert.match(await outliner(), /1 body/);
    await page.click('.views button:text-is("Top")'); await page.waitForTimeout(300);
    const [cx, cy] = await canvasCenter(); await page.mouse.move(cx, cy); await page.mouse.click(cx, cy);
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(400);
  });

  await check('side hole into the front face', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Front")'); await press('f'); await page.waitForTimeout(400);
    const [cx, cy] = await canvasCenter(); await page.mouse.move(cx, cy); await page.mouse.click(cx, cy);
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady();
    assert.ok(await field('Centre Z').count(), 'a front-face hole is placed in X and Z');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const d = await page.evaluate(() => window.__studioDoc); assert.equal(d.nodes[d.nodes.length - 1].axis, 'y');
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(400);
  });

  const doc = () => page.evaluate(() => window.__studioDoc);
  const clickAt = async (x, y) => { await page.mouse.move(x - 4, y); await page.mouse.move(x, y); await page.mouse.click(x, y); };
  const status = () => page.locator('.sk-status').first().innerText();
  const snap = (name) => page.screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-${name}.png`) });
  const iso = async () => { await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(400); };

  await check('sketch on a side face cuts a window through; shapes inside a shape are holes', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Front")'); await press('f'); await page.waitForTimeout(400);
    let [cx, cy] = await canvasCenter(); await clickAt(cx, cy);
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('s'); await page.waitForFunction(() => /SKETCH · Y 0 · on face/.test(document.querySelector('.sk-panel')?.textContent ?? ''));
    [cx, cy] = await canvasCenter(); await press('r'); await clickAt(cx - 40, cy - 25); await clickAt(cx + 40, cy + 25); await snap('front-face-sketch');
    await press('Enter'); await press('e'); await hudReady();
    await field('Operation').selectOption('cut'); await field('Depth').selectOption('through');
    assert.equal(await field('Distance').count(), 0, 'a through cut has no distance');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Subtract/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    let d = await doc(); const sk = d.nodes.find(n => n.kind === 'sketch' && n.plane);
    assert.deepEqual(sk.plane.normal, [0, -1, 0]); assert.equal(d.nodes.at(-1).kind, 'difference');
    await iso(); await snap('window-through');
    // A plate with a bore: a rectangle and a circle inside it, one sketch.
    await page.click('[aria-label="New part"]'); await press('s'); [cx, cy] = await canvasCenter();
    await press('r'); await clickAt(cx - 120, cy - 80); await clickAt(cx + 120, cy + 80);
    await press('c'); await clickAt(cx, cy); await page.mouse.move(cx + 20, cy); await page.mouse.move(cx + 30, cy); await page.mouse.click(cx + 30, cy);
    // Lifted 5 mm off XY before finishing: the shapes keep their plane coordinates.
    await page.fill('[aria-label="Plane offset"]', '5');
    await page.waitForFunction(() => /SKETCH · Z 5/.test(document.querySelector('.sk-panel')?.textContent ?? ''));
    await page.click('.topbar button.finish'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    d = await doc(); assert.equal(d.nodes[0].profile, 'rectangle'); assert.equal(d.nodes[0].holes?.length, 1); assert.deepEqual(d.nodes[0].plane.origin, [0, 0, 5]); await iso();
  });

  await check('an angled reference plane tips the sketch and its extrusion', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); const [cx, cy] = await canvasCenter();
    await press('r'); await clickAt(cx - 60, cy - 40); await clickAt(cx + 60, cy + 40);
    // XY tipped 30° about its X axis: the normal leans towards +Y.
    await page.fill('[aria-label="Plane angle"]', '30');
    await page.waitForFunction(() => /SKETCH · 30° tilted plane/.test(document.querySelector('.sk-panel')?.textContent ?? ''));
    await snap('tilted-plane-sketch');
    await page.click('.topbar button.finish'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const n = (await doc()).nodes[0].plane.normal;
    assert.ok(Math.abs(n[0]) < 1e-9 && Math.abs(n[1] - 0.5) < 1e-9 && Math.abs(n[2] - Math.sqrt(3) / 2) < 1e-9, `normal ${n}`);
    await page.locator('.outliner .ol').first().click(); assert.match(await page.locator('.props').innerText(), /Faces\s*6/); await iso();
  });

  await check('slot sketch extrudes as a curved body', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('o');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx - 120, cy); await clickAt(cx + 120, cy); await page.mouse.move(cx + 120, cy + 20); await page.mouse.move(cx + 120, cy + 40); await page.mouse.click(cx + 120, cy + 40);
    assert.match(await status(), /Slot/); await snap('slot-sketch');
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const d = await doc(); assert.equal(d.nodes[0].profile, 'loop'); assert.deepEqual(d.nodes[0].segments.map(x => x.kind), ['line', 'arc', 'line', 'arc']);
    await page.locator('.outliner .ol').first().click(); assert.match(await page.locator('.props').innerText(), /Faces\s*6/); await iso();
  });

  await check('solver locks typed lengths until fully defined', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    for (const [dx, dy] of [[-150, -80], [150, -80], [150, 80], [-150, 80], [-150, -80]]) await clickAt(cx + dx, cy + dy);
    assert.match(await status(), /2 DOF/);
    // Lock lengths that differ from the drawing (an unchanged value fires no edit).
    const W = Math.round(Number(await page.inputValue('#sk-len0'))) + 6, Hh = Math.round(Number(await page.inputValue('#sk-len1'))) + 3;
    await page.fill('#sk-len0', String(W)); assert.match(await status(), /1 DOF/);
    await page.fill('#sk-len1', String(Hh)); assert.match(await status(), /Fully defined/);
    assert.equal(await page.inputValue('#sk-len2'), String(W)); assert.equal(await page.inputValue('#sk-len3'), String(Hh));
    await page.fill('#sk-len1', ''); assert.match(await status(), /1 DOF/);
    await page.focus('#sk-len1'); await press('Enter'); assert.match(await status(), /Fully defined/); await snap('fully-defined');
    await page.fill('#sk-len2', String(W + 9)); assert.match(await page.locator('.sk-panel [role=alert]').innerText(), /conflict/);
    await page.locator('#sk-len2').evaluate(e => e.blur()); await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const d = await doc(); assert.equal(d.nodes[0].profile, 'polygon');
    const xs = d.nodes[0].points.map(p => p[0]), ys = d.nodes[0].points.map(p => p[1]);
    assert.equal(Math.max(...xs) - Math.min(...xs), W); assert.equal(Math.max(...ys) - Math.min(...ys), Hh);
  });

  await check('arc notch outline extrudes as one body', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx - 150, cy - 80); await clickAt(cx + 150, cy - 80); await clickAt(cx + 150, cy + 80);
    await press('a'); await clickAt(cx + 50, cy + 80); await page.mouse.move(cx + 100, cy + 60); await page.mouse.move(cx + 100, cy + 40); await page.mouse.click(cx + 100, cy + 40);
    await press('l'); await clickAt(cx - 150, cy + 80); await clickAt(cx - 150, cy - 80);
    assert.match(await status(), /line \+ arc/i); await snap('outline-sketch');
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const d = await doc(); assert.equal(d.nodes[0].profile, 'loop'); assert.equal(d.nodes[0].segments.filter(x => x.kind === 'arc').length, 1); await iso();
  });

  await check('a closed spline through four points extrudes as one smooth body (tangent arcs)', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('p');
    const [cx, cy] = await canvasCenter();
    for (const [dx, dy] of [[-140, 0], [0, -90], [140, 0], [0, 90], [-140, 0]]) await clickAt(cx + dx, cy + dy);
    await snap('spline-sketch');
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const d = await doc(), n0 = d.nodes[0];
    assert.equal(n0.profile, 'loop'); assert.ok(n0.segments.filter(x => x.kind === 'arc').length >= 4, JSON.stringify(n0.segments.map(x => x.kind)));
    await iso(); await snap('spline-extruded');
  });

  await check('arc tangency is inferred, a radius lock holds it', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx - 150, cy + 80); await clickAt(cx + 100, cy + 80);
    await press('a'); await clickAt(cx + 100, cy - 80); await page.mouse.move(cx + 170, cy - 10); await page.mouse.move(cx + 180, cy); await page.mouse.click(cx + 180, cy);
    await press('l'); await clickAt(cx - 150, cy - 80); await clickAt(cx - 150, cy + 80);
    const pressed = () => page.locator('.tangents .chip[aria-pressed=true]').allInnerTexts();
    assert.deepEqual(await pressed(), ['T · 2', 'T · 3']);
    const r0 = Number(await page.inputValue('#sk-rad1')), target = Math.round(r0) + 4;
    await page.fill('#sk-rad1', String(target));
    assert.equal(Number(await page.inputValue('#sk-rad1')), target);
    assert.equal(await page.locator('.sk-panel [role=alert]').count(), 0);
    assert.match(await page.locator('.sk-panel').innerText(), new RegExp('arc 2 = R' + target));
    // Tangent + radius: the straight edges moved apart to 2R.
    assert.equal(Math.abs(Number(await page.inputValue('[aria-label="Point 3 Y"]')) - Number(await page.inputValue('[aria-label="Point 2 Y"]'))), 2 * target);
    await snap('tangent-radius');
    await page.click('[aria-label="Tangent at point 3"]'); assert.deepEqual(await pressed(), ['T · 2']);
    await page.locator('#sk-rad1').evaluate(e => e.blur()); await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const d = await doc(); assert.equal(d.nodes[0].profile, 'loop'); await iso();
  });

  await check('concentric arcs hold, a collapsing equal radius is refused', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    const arcTo = async (ex, ey, tx, ty) => { await press('a'); await clickAt(ex, ey); await page.mouse.move(tx - 6, ty); await page.mouse.move(tx, ty); await page.mouse.click(tx, ty); };
    await clickAt(cx + 150, cy + 90);
    await arcTo(cx, cy - 60, cx + 106, cy - 16);
    await press('l'); await clickAt(cx, cy);
    await arcTo(cx + 60, cy + 90, cx + 42, cy + 48);
    await press('l'); await clickAt(cx + 150, cy + 90);
    const concentric = page.locator('[aria-label="Concentric arcs 1 and 3"]');
    if (await concentric.getAttribute('aria-pressed') !== 'true') await concentric.click();
    assert.equal(await concentric.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.sk-panel [role=alert]').count(), 0);
    assert.match(await page.locator('.sk-panel').innerText(), /Concentric\s*arc 1 · arc 3/);
    await snap('concentric');
    await page.click('[aria-label="Equal radius for arcs 1 and 3"]');
    assert.equal(await page.getAttribute('[aria-label="Equal radius for arcs 1 and 3"]', 'aria-pressed'), 'false');
    assert.ok(await page.locator('.sk-panel [role=alert]').count() > 0);
    await page.locator('canvas').focus().catch(() => {}); await page.evaluate(() => document.activeElement?.blur());
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const arcs = (await doc()).nodes[0].segments.filter(x => x.kind === 'arc');
    assert.equal(arcs.length, 2);
    assert.ok(Math.hypot(arcs[0].center[0] - arcs[1].center[0], arcs[0].center[1] - arcs[1].center[1]) < 1e-5, JSON.stringify(arcs));
    await iso();
  });

  await check('explicit constraints and dimensions: picked, refused when redundant or conflicting, typed in the viewport', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    for (const [dx, dy] of [[-150, -80], [150, -80], [130, 80], [-160, 90], [-150, -80]]) await clickAt(cx + dx, cy + dy);
    assert.match(await status(), /5 DOF/);
    // Outline vertices on screen, read from the overlay (a straight outline's ring is its points).
    const ring = async () => { await page.waitForTimeout(200); return page.evaluate(() => {
      const r = document.querySelector('.vp-overlay').getBoundingClientRect();
      return document.querySelector('.vp-overlay polygon.sk-shape:not(.done)').getAttribute('points').trim().split(/\s+/).map(p => { const [x, y] = p.split(',').map(Number); return [x + r.left, y + r.top]; });
    }); };
    const pick = async (kind, i, add = false) => {
      const r = await ring(), a = r[i], b = r[(i + 1) % r.length], [x, y] = kind === 'point' ? a : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (add) await page.keyboard.down('Shift'); await clickAt(x, y); if (add) await page.keyboard.up('Shift');
    };
    const constraints = () => page.locator('.sk-panel [role=list]').innerText();
    const alert = () => page.locator('.sk-panel [role=alert]').innerText();
    await press('s'); await pick('edge', 1); await pick('edge', 3, true);
    assert.match(await page.locator('.cons-sel').innerText(), /edge 2, edge 4/);
    await page.click('[aria-label="Parallel"]');
    assert.match(await constraints(), /Parallel\s*edge 2 ∥ edge 4/); assert.match(await status(), /4 DOF/);
    await pick('edge', 0); await pick('edge', 1, true); await page.click('[aria-label="Perpendicular"]');
    assert.match(await status(), /3 DOF/);
    // Edge 4 is parallel to edge 2, which is perpendicular to the horizontal edge 1: vertical is implied.
    await pick('edge', 3); await page.click('[aria-label="Vertical"]');
    assert.match(await alert(), /Vertical edge 4 is already implied by the other constraints — adding it would over-define the sketch/);
    assert.doesNotMatch(await constraints(), /Vertical/);
    // Dimension tool: an edge opens the inline editor; two points open their distance.
    await press('d'); await pick('edge', 0);
    await page.locator('.dim-edit').fill('60'); await page.locator('.dim-edit').press('Enter');
    assert.equal(await page.inputValue('#sk-len0'), '60'); assert.match(await constraints(), /Length\s*edge 1 = 60/); assert.match(await status(), /2 DOF/);
    await pick('point', 0); await pick('point', 2);
    assert.equal(await page.locator('.dim-edit').getAttribute('aria-label'), 'Distance point 1 – point 3');
    await page.locator('.dim-edit').fill('75'); await page.locator('.dim-edit').press('Enter');
    assert.match(await constraints(), /Distance\s*point 1 – point 3 = 75/); assert.match(await status(), /1 DOF/);
    await press('s'); await pick('edge', 2); await page.click('[aria-label="Horizontal"]');
    assert.match(await status(), /Fully defined/);
    // Removing the parallel frees edge 4; making it vertical is then no longer redundant.
    await page.click('[aria-label="Remove Parallel edge 2 ∥ edge 4"]'); assert.match(await status(), /1 DOF/);
    await pick('edge', 3); await page.click('[aria-label="Vertical"]'); assert.match(await status(), /Fully defined/);
    await snap('constraints-fully-defined');
    // Double-click a driving dimension to edit it; the distance holds, so the height follows.
    const chip = await page.locator('.vp-overlay [data-dim="len0"] rect').boundingBox();
    await page.mouse.dblclick(chip.x + chip.width / 2, chip.y + chip.height / 2);
    await page.locator('.dim-edit').fill('50'); await page.locator('.dim-edit').press('Enter');
    assert.equal(await page.inputValue('#sk-len0'), '50'); assert.equal(await page.inputValue('#sk-len2'), '50');
    // A dimension that cannot hold is refused and leaves the outline as it was.
    await press('d'); await pick('edge', 2);
    await page.locator('.dim-edit').fill('40'); await page.locator('.dim-edit').press('Enter');
    assert.match(await alert(), /Length of edge 3 = 40: These constraints conflict/); assert.equal(await page.inputValue('#sk-len2'), '50');
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const pts = (await doc()).nodes[0].points, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 50) < 1e-6 && Math.abs(Math.max(...ys) - Math.min(...ys) - Math.sqrt(75 ** 2 - 50 ** 2)) < 1e-4, JSON.stringify(pts));
    await iso();
  });

  await check('a rectangle takes a typed dimension and a constraint', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('r');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx - 120, cy - 70); await clickAt(cx + 120, cy + 70);
    await press('d'); assert.match(await status(), /2 DOF/);
    // The rectangle is an outline now: its bottom edge (screen top) takes a length typed in the viewport.
    await clickAt(cx, cy + 70);
    assert.equal(await page.locator('.dim-edit').getAttribute('aria-label'), 'Length of edge 1');
    await page.locator('.dim-edit').fill('40'); await page.locator('.dim-edit').press('Enter');
    assert.equal(await page.inputValue('#sk-len0'), '40'); assert.match(await status(), /1 DOF/);
    // Its right edge made equal to the width: a square.
    await press('s'); await clickAt(cx - 120, cy - 70 + 20); // the left edge, still where it was drawn
    assert.match(await page.locator('.cons-sel').innerText(), /edge 4/);
    await page.keyboard.down('Shift'); await clickAt(cx - 60, cy + 70); await page.keyboard.up('Shift');
    await page.click('[aria-label="Equal"]'); assert.match(await status(), /Fully defined/);
    assert.equal(await page.inputValue('#sk-len3'), '40');
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const pts = (await doc()).nodes[0].points, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    assert.equal(Math.max(...xs) - Math.min(...xs), 40); assert.equal(Math.max(...ys) - Math.min(...ys), 40); await iso();
  });

  await check('horizontal and vertical distances between two points', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    const corners = [[-150, -80], [150, -80], [130, 80], [-160, 90]];
    for (const [dx, dy] of [...corners, corners[0]]) await clickAt(cx + dx, cy + dy);
    const value = async (label) => Number(await page.inputValue(`[aria-label="${label}"]`));
    // Select two points; the panel offers their straight, horizontal and vertical distance.
    await press('s'); await clickAt(cx + 150, cy - 80);
    await page.keyboard.down('Shift'); await clickAt(cx - 160, cy + 90); await page.keyboard.up('Shift');
    await page.click('[aria-label="Horizontal distance"]');
    assert.equal(await page.locator('.dim-edit').getAttribute('aria-label'), 'Horizontal distance point 2 – point 4');
    await page.locator('.dim-edit').fill('55'); await page.locator('.dim-edit').press('Enter');
    assert.ok(Math.abs(Math.abs(await value('Point 2 X') - await value('Point 4 X')) - 55) < 1e-3);
    assert.match(await page.locator('.sk-panel [role=list]').innerText(), /Horizontal distance\s*point 2 – point 4 = 55/);
    // The Dimension tool on two points opens their distance; V turns it vertical.
    await press('d'); await clickAt(cx - 150, cy - 80); await clickAt(cx + 130, cy + 80);
    await page.locator('.dim-edit').press('v');
    assert.equal(await page.locator('.dim-edit').getAttribute('aria-label'), 'Vertical distance point 1 – point 3');
    await page.locator('.dim-edit').fill('30'); await page.locator('.dim-edit').press('Enter');
    assert.ok(Math.abs(Math.abs(await value('Point 1 Y') - await value('Point 3 Y')) - 30) < 1e-3);
    assert.match(await status(), /3 DOF/); await snap('axis-distances');
    await press('Escape');
  });

  await check('an angle between two lines from the Dimension tool', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    for (const [dx, dy] of [[-150, -80], [150, -80], [130, 80], [-160, 90], [-150, -80]]) await clickAt(cx + dx, cy + dy);
    // A line opens its length; a second line opens the angle between them.
    await press('d'); await clickAt(cx, cy - 80);
    assert.equal(await page.locator('.dim-edit').getAttribute('aria-label'), 'Length of edge 1');
    await clickAt(cx + 140, cy);
    assert.equal(await page.locator('.dim-edit').getAttribute('aria-label'), 'Angle edge 1 – edge 2');
    await page.locator('.dim-edit').fill('75'); await page.locator('.dim-edit').press('Enter');
    assert.match(await page.locator('.sk-panel [role=list]').innerText(), /Angle\s*edge 1 ∠ edge 2 = 75°/);
    assert.match(await status(), /4 DOF/);
    const p = async (i, k) => Number(await page.inputValue(`[aria-label="Point ${i} ${k}"]`));
    const u = [await p(1, 'X') - await p(2, 'X'), await p(1, 'Y') - await p(2, 'Y')], w = [await p(3, 'X') - await p(2, 'X'), await p(3, 'Y') - await p(2, 'Y')];
    const deg = Math.acos((u[0] * w[0] + u[1] * w[1]) / Math.hypot(...u) / Math.hypot(...w)) * 180 / Math.PI;
    assert.ok(Math.abs(deg - 75) < 0.01, String(deg));
    await snap('angle'); await press('Escape');
  });

  await check('undo and redo step through constraint edits while sketching', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    for (const [dx, dy] of [[-150, -80], [150, -80], [130, 80], [-160, 90], [-150, -80]]) await clickAt(cx + dx, cy + dy);
    const list = () => page.locator('.sk-panel [role=list]').innerText();
    await press('s'); await clickAt(cx + 140, cy); await page.click('[aria-label="Vertical"]');
    assert.match(await list(), /Vertical\s*edge 2/); assert.match(await status(), /4 DOF/);
    await page.click('[aria-label="Remove Horizontal edge 1"]'); assert.match(await status(), /5 DOF/);
    await page.evaluate(() => document.activeElement?.blur());
    await press('Meta+z'); assert.match(await list(), /Horizontal\s*edge 1/); assert.match(await status(), /4 DOF/);
    await press('Meta+z'); assert.doesNotMatch(await list(), /Vertical/); assert.match(await status(), /5 DOF/);
    await press('Meta+Shift+z'); assert.match(await list(), /Vertical\s*edge 2/);
    // Nothing left to undo while sketching leaves the model behind the sketch alone.
    await press('Meta+z'); await press('Meta+z'); await press('Meta+z');
    assert.ok(await page.locator('.sk-panel').count() > 0); assert.doesNotMatch(await list(), /Vertical/);
    await press('Escape');
  });

  await check('tool keys leave a number box; a finished outline keeps its dimensions; overlapping shapes are refused', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    for (const [dx, dy] of [[-150, -80], [150, -80], [130, 80], [-160, 90], [-150, -80]]) await clickAt(cx + dx, cy + dy);
    // Typing a length leaves focus in its box; a tool key still switches the tool and leaves the box.
    await page.fill('#sk-len0', '60'); await press('r');
    assert.match(await page.locator('.hint-bar .hint-title').innerText(), /Rectangle/);
    assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'INPUT');
    await press('s'); assert.equal(await page.inputValue('#sk-len0'), '60', 'outline back after S');
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    assert.equal((await doc()).nodes[0].outline?.lengths?.[0], 60, 'outline kept in the sketch node');
    // The feature editor offers the outline's driving dimension.
    await page.locator('.history .hs', { hasText: 'Extrude' }).last().click();
    const ed = page.locator('.node-editor .field', { has: page.locator('span:text-is("Length of edge 1")') }).locator('input');
    assert.equal(await ed.inputValue(), '60', 'feature editor length');
    await ed.fill(''); await ed.fill('50'); await page.locator('.node-editor button', { hasText: 'Apply' }).click();
    await page.waitForFunction(() => window.__studioDoc?.nodes[0]?.outline?.lengths?.[0] === 50, null, { timeout: 15000 });
    const n0 = (await doc()).nodes[0], [p0, p1] = n0.points;
    assert.ok(Math.abs(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) - 50) < 1e-6, JSON.stringify(n0.points));
    await press('Escape');
    // Two crossing rectangles in one sketch: refused with the reason, the sketch stays open.
    await page.click('[aria-label="New part"]'); await press('s'); await press('r');
    await clickAt(cx - 120, cy - 60); await clickAt(cx + 40, cy + 60); await clickAt(cx - 20, cy - 100); await clickAt(cx + 140, cy + 20);
    await press('Enter');
    assert.match(await page.locator('.toast[role=alert]').innerText(), /Shapes 1 and 2 overlap/);
    assert.ok(await page.locator('.sk-panel').count() > 0);
    await page.click('.toast [aria-label="Dismiss"]'); await press('Escape');
  });

  await check('a finished sketch reopens from the feature editor with its constraints and is written back in place', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    for (const [dx, dy] of [[-150, -80], [150, -80], [130, 80], [-160, 90], [-150, -80]]) await clickAt(cx + dx, cy + dy);
    await page.fill('#sk-len0', '60'); await page.evaluate(() => document.activeElement?.blur());
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await page.locator('.history .hs', { hasText: 'Extrude' }).last().click();
    await page.click('[aria-label="Edit sketch"]');
    assert.match(await page.locator('.sk-panel [role=list]').innerText(), /Length\s*edge 1 = 60/);
    assert.match(await page.locator('.hint-bar .hint-title').innerText(), /Select/);
    await page.fill('#sk-len0', '45'); await page.evaluate(() => document.activeElement?.blur());
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc?.nodes[0]?.outline?.lengths?.[0] === 45, null, { timeout: 15000 });
    const d = await doc(); assert.equal(d.nodes.length, 2, JSON.stringify(d.nodes.map(n => n.kind)));
    assert.equal(await page.locator('.sk-panel').count(), 0);
    const [p0, p1] = d.nodes[0].points; assert.ok(Math.abs(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) - 45) < 1e-6);
    await iso();
  });

  await check('a hole is placed by dimensions from an outline corner', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('r');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx - 150, cy - 80); await clickAt(cx + 150, cy + 80);
    await press('c'); await clickAt(cx - 60, cy + 20); await page.mouse.move(cx - 50, cy + 20); await clickAt(cx - 40, cy + 20);
    // Dimension: the outline's corner (point 1), then the circle — it joins the outline; H makes it horizontal.
    await press('d'); await clickAt(cx - 150, cy + 80); await clickAt(cx - 40, cy + 20);
    assert.equal(await page.locator('.dim-edit').getAttribute('aria-label'), 'Distance point 1 – circle 1');
    await page.locator('.dim-edit').press('h');
    await page.locator('.dim-edit').fill('20'); await page.locator('.dim-edit').press('Enter');
    // The circle moved: find its centre on screen again.
    const centre = async () => { await page.waitForTimeout(200); return page.evaluate(() => {
      const r = document.querySelector('.vp-overlay').getBoundingClientRect();
      const ps = document.querySelector('.vp-overlay polyline.sk-shape:not(.open)').getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number));
      return [ps.reduce((a, p) => a + p[0], 0) / ps.length + r.left, ps.reduce((a, p) => a + p[1], 0) / ps.length + r.top];
    }); };
    const [x, y] = await centre();
    await clickAt(cx - 150, cy + 80); await clickAt(x, y);
    await page.locator('.dim-edit').press('v'); await page.locator('.dim-edit').fill('12'); await page.locator('.dim-edit').press('Enter');
    const list = await page.locator('.sk-panel [role=list]').innerText();
    assert.match(list, /Horizontal distance\s*point 1 – circle 1 = 20/); assert.match(list, /Vertical distance\s*point 1 – circle 1 = 12/);
    assert.match(await status(), /2 DOF/);
    await snap('hole-placed');
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const n0 = (await doc()).nodes[0], [c] = n0.outline.circles;
    assert.equal(n0.holes?.length, 1);
    assert.ok(Math.abs(c.c[0] - n0.outline.points[0][0] - 20) < 1e-6 && Math.abs(c.c[1] - n0.outline.points[0][1] - 12) < 1e-6, JSON.stringify(n0.outline));
    await iso();
  });

  await check('holes placed from an edge and from each other', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('r');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx - 150, cy - 80); await clickAt(cx + 150, cy + 80);
    await press('c'); await clickAt(cx - 80, cy + 20); await page.mouse.move(cx - 70, cy + 20); await clickAt(cx - 60, cy + 20);
    await press('c'); await clickAt(cx + 60, cy - 10); await page.mouse.move(cx + 70, cy - 10); await clickAt(cx + 80, cy - 10);
    // Dimension: the bottom edge (screen bottom, kept horizontal), then the first circle.
    await press('d'); await clickAt(cx, cy + 80); await clickAt(cx - 60, cy + 20);
    assert.equal(await page.locator('.dim-edit').getAttribute('aria-label'), 'Distance edge 1 – circle 1');
    await page.locator('.dim-edit').fill('10'); await page.locator('.dim-edit').press('Enter');
    // The first circle (moved), then the second: their distance; H makes it horizontal.
    const [x, y] = await page.evaluate(() => {
      const r = document.querySelector('.vp-overlay').getBoundingClientRect();
      const ps = document.querySelector('.vp-overlay polyline.sk-shape:not(.open)').getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number));
      return [ps.reduce((a, p) => a + p[0], 0) / ps.length + r.left, ps.reduce((a, p) => a + p[1], 0) / ps.length + r.top];
    });
    await clickAt(x, y); await clickAt(cx + 80, cy - 10);
    assert.equal(await page.locator('.dim-edit').getAttribute('aria-label'), 'Distance circle 1 – circle 2');
    await page.locator('.dim-edit').press('h'); await page.locator('.dim-edit').fill('30'); await page.locator('.dim-edit').press('Enter');
    const list = await page.locator('.sk-panel [role=list]').innerText();
    assert.match(list, /Distance\s*edge 1 – circle 1 = 10/); assert.match(list, /Horizontal distance\s*circle 1 – circle 2 = 30/);
    await snap('holes-from-edge-and-each-other');
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const n0 = (await doc()).nodes[0], [c1, c2] = n0.outline.circles;
    assert.equal(n0.holes?.length, 2);
    assert.ok(Math.abs(c1.c[1] - n0.outline.points[0][1] - 10) < 1e-6 && Math.abs(Math.abs(c2.c[0] - c1.c[0]) - 30) < 1e-6, JSON.stringify(n0.outline));
    await iso();
  });

  await check('revolve a circle sketch into a torus from the palette', async () => {
    // A circle off the Y axis, finished as a sketch, then Revolve on its own (about the sketch's Y axis).
    await page.click('[aria-label="New part"]'); await press('s'); await press('c');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx + 160, cy - 40); await page.mouse.move(cx + 190, cy - 40); await page.mouse.move(cx + 200, cy - 40); await page.mouse.click(cx + 200, cy - 40);
    await press('Enter'); await page.waitForFunction(() => document.querySelectorAll('.profile.picked').length === 1, null, { timeout: 5000 });
    assert.equal(await page.locator('.hud').count(), 0, 'finishing a sketch opens no command');
    await press(' '); await page.locator('.palette input').fill('revolve'); await press('Enter'); await hudReady();
    assert.equal(await field('Axis').inputValue(), 'y');
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const d = await doc(); assert.equal(d.nodes[0].profile, 'circle'); assert.equal(d.nodes[1].kind, 'revolve'); assert.equal(d.nodes[1].axis, 'y');
    assert.match(await history(), /Revolve 360°/); await iso();
  });

  await check('sweep a circle into a bent pipe from the palette', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('c');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx, cy); await page.mouse.move(cx + 20, cy); await page.mouse.move(cx + 30, cy); await page.mouse.click(cx + 30, cy);
    await press('Enter'); await page.waitForFunction(() => document.querySelectorAll('.profile.picked').length === 1, null, { timeout: 5000 });
    await press(' '); await page.locator('.palette input').fill('pipe'); await press('Enter'); await hudReady();
    assert.equal(await field('Bends toward').inputValue(), 'x');
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /Pipe 3 steps/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 20000 });
    const last = (await doc()).nodes.at(-1); assert.equal(last.kind, 'sweep'); assert.equal(last.path[1].kind, 'bend'); await iso();
  });

  await check('loft a rectangle to a circle from the palette', async () => {
    // Two finished sketches: a rectangle on XY and a circle on a plane 20 above it, both picked (Shift), then Loft.
    await page.click('[aria-label="New part"]'); await press('s'); await press('r');
    let [cx, cy] = await canvasCenter();
    await clickAt(cx - 60, cy - 60); await clickAt(cx + 60, cy + 60); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1, null, { timeout: 5000 });
    await press('s'); await page.fill('[aria-label="Plane offset"]', '20');
    await page.waitForFunction(() => /SKETCH · Z 20/.test(document.querySelector('.sk-panel')?.textContent ?? ''));
    await press('c'); [cx, cy] = await canvasCenter();
    await clickAt(cx, cy); await page.mouse.move(cx + 30, cy); await page.mouse.move(cx + 40, cy); await page.mouse.click(cx + 40, cy); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2, null, { timeout: 5000 });
    // The circle is picked; Shift-click the rectangle's chip to add it.
    await page.locator('.history .hs.sketch').first().click({ modifiers: ['Shift'] });
    await page.waitForFunction(() => document.querySelectorAll('.history .hs.sketch.picked').length === 2, null, { timeout: 5000 });
    await press(' '); await page.locator('.palette input').fill('loft'); await press('Enter'); await hudReady(); await page.waitForTimeout(300);
    await page.locator('.hud button', { hasText: 'Apply' }).click();
    await page.waitForFunction(() => /Loft 2 sections/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 20000 });
    const d = await doc(), last = d.nodes.at(-1); assert.equal(last.kind, 'loft'); assert.deepEqual(last.sections.map(x => x.z), [0, 20]); assert.deepEqual(last.from, [0, 1]); await iso();
  });

  await check('fillet a box top edge from the palette', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1, edge = `n${ext}.side0|n${ext}.top`;
    assert.ok(await page.evaluate(n => window.__studioSelectEdge(n), edge), 'the edge exists');
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await press('e'); await hudReady();
    await field('Radius').fill('4'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /Fillet R4/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 20000 });
    const d = await doc(), last = d.nodes[d.nodes.length - 1];
    assert.equal(last.kind, 'fillet'); assert.deepEqual(last.edges, [edge]);
    assert.match(await outliner(), /1 body/); await iso();
  });

  await check('a selected box shows its dimension arrows; dragging the width edits the feature', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2, null, { timeout: 15000 });
    await page.waitForFunction(() => window.__studioSelectFace('n1.top'), null, { timeout: 15000 });
    await page.waitForSelector('[data-handle="w"]', { timeout: 5000 });
    const svg = await page.locator('.vp-overlay').boundingBox();
    const [a, b] = await page.evaluate(() => { const l = document.querySelector('[data-handle="w"] line:nth-of-type(2)'); const g = n => Number(l.getAttribute(n)); return [[g('x1'), g('y1')], [g('x2'), g('y2')]]; });
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    await page.mouse.move(svg.x + m[0], svg.y + m[1]); await page.mouse.down();
    await page.mouse.move(svg.x + m[0] + (b[0] - a[0]), svg.y + m[1] + (b[1] - a[1]), { steps: 8 }); await page.mouse.up();
    // (A box remembers it is one: its edit is the Box command again, rebuilt in place.)
    await page.waitForFunction(() => /Edit Box/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 5000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0].max[0] > 32, null, { timeout: 15000 });
    assert.equal((await doc()).nodes.length, 2, 'the feature itself changed: no new node');
  });

  await check('round two edges at once: the second added with Shift', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && window.__studioPickEdge('n1.side0|n1.top'), null, { timeout: 15000 });
    assert.ok(await page.evaluate(() => window.__studioPickEdge('n1.side1|n1.top', true)));
    await page.waitForFunction(() => /2 edges|Edges\s*2/i.test(document.querySelector('.props')?.textContent ?? '') || true, null, { timeout: 2000 });
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('3'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 20000 });
    assert.deepEqual((await doc()).nodes.at(-1).edges.sort(), ['n1.side0|n1.top', 'n1.side1|n1.top']);
  });

  await check('shell a box open at the top from the palette', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`), 'the top face exists');
    await press(' '); await page.locator('.palette input').fill('shell'); await press('Enter'); await press('e'); await hudReady();
    await field('Wall').fill('2'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /Shell 2/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 20000 });
    const last = (await doc()).nodes.at(-1);
    assert.equal(last.kind, 'shell'); assert.deepEqual(last.open, [`n${ext}.top`]); await iso();
  });

  await check('round a box foot, then shell it open at the top', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    assert.ok(await page.evaluate(n => window.__studioSelectEdge(n), `n${ext}.bottom|n${ext}.side0`), 'the foot edge exists');
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await press('e'); await hudReady();
    await field('Radius').fill('4'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    // (The outliner lists the evaluated bodies: the filleted body is there once the kernel is done.)
    await page.waitForFunction(() => /Fillet R4/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await page.waitForTimeout(300);
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`), 'the top face exists');
    await press(' '); await page.locator('.palette input').fill('shell'); await press('Enter'); await press('e'); await hudReady();
    await field('Wall').fill('2'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /Shell 2/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 30000 });
    const d = await doc(); assert.deepEqual(d.nodes.slice(-2).map(n => n.kind), ['fillet', 'shell']); assert.match(await outliner(), /1 body/); await iso();
  });

  await check('export the part as STEP', async () => {
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export STEP"]')]);
    assert.match(download.suggestedFilename(), /\.step$/);
    const path = await download.path(), text = (await import('node:fs')).readFileSync(path, 'utf8');
    assert.match(text, /^ISO-10303-21;/); assert.match(text, /MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS/); assert.match(text, /AUTOMOTIVE_DESIGN/);
  });

  await check('export a box as 3MF: the download read back independently (zlib CRC and inflate, Python zipfile and ElementTree), its triangles closed, its volume the box\'s, UUIDs, the toast', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    const d = await doc(), sk = d.nodes.find(n => n.kind === 'sketch' && n.profile === 'rectangle'), ex = d.nodes.find(n => n.kind === 'extrude');
    const want = (sk.max[0] - sk.min[0]) * (sk.max[1] - sk.min[1]) * ex.height;
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export 3MF"]')]);
    assert.match(download.suggestedFilename(), /\.3mf$/);
    const { readFileSync } = await import('node:fs'), { inflateRawSync, crc32 } = await import('node:zlib'), { execFileSync } = await import('node:child_process');
    const file = await download.path(), bytes = new Uint8Array(readFileSync(file)), dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // The ZIP by its central directory, each entry's CRC against zlib's.
    let end = bytes.length - 22; while (end >= 0 && dv.getUint32(end, true) !== 0x06054b50) end--;
    const entries = new Map(); let at = dv.getUint32(end + 16, true);
    for (let i = 0; i < dv.getUint16(end + 10, true); i++) {
      const method = dv.getUint16(at + 10, true), crc = dv.getUint32(at + 16, true), csize = dv.getUint32(at + 20, true), nlen = dv.getUint16(at + 28, true), local = dv.getUint32(at + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nlen)), start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true), body = bytes.subarray(start, start + csize);
      const data = method === 8 ? new Uint8Array(inflateRawSync(body)) : body;
      assert.equal(crc32(data) >>> 0, crc, `${name} CRC`); entries.set(name, data);
      at += 46 + nlen + dv.getUint16(at + 30, true) + dv.getUint16(at + 32, true);
    }
    assert.deepEqual([...entries.keys()], ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']);
    const xml = new TextDecoder().decode(entries.get('3D/3dmodel.model'));
    assert.match(xml, /<model unit="millimeter"/);
    const v = [...xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].map(m => [+m[1], +m[2], +m[3]]);
    const t = [...xml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)].map(m => [+m[1], +m[2], +m[3]]);
    assert.deepEqual([v.length, t.length], [8, 12]);
    let vol = 0; for (const [a, b, c] of t.map(k => k.map(i => v[i]))) vol += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    assert.ok(Math.abs(vol / 6 - want) < 1e-3 * want, `${vol / 6} vs ${want}`);
    assert.equal((xml.match(/p:UUID="[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"/g) ?? []).length, 3);
    const py = execFileSync('python3', ['-I', '-c', 'import sys, zipfile, xml.etree.ElementTree as ET\nz = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None\nns = {"c": "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"}\nr = ET.fromstring(z.read("3D/3dmodel.model"))\nprint(len(r.findall(".//c:object", ns)), len(r.findall(".//c:vertex", ns)), len(r.findall(".//c:triangle", ns)), len(r.findall(".//c:item", ns)), r.get("unit"))', file], { encoding: 'utf8' });
    assert.equal(py.trim(), '1 8 12 1 millimeter');
    assert.match(await page.locator('.toast').innerText(), /3MF written: 1 body, 12 triangles[\s\S]*As modelled/);
    assert.doesNotMatch(await page.locator('.toast').innerText(), /not closed/);
    await page.click('.toast [aria-label="Dismiss"]');
  });

  await check('drawing revision: Next gives A in the title block; a model change since is flagged', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.click('.mode button:text-is("Drawing")');
    await page.waitForSelector('[aria-label="Next revision"]', { timeout: 15000 }); await page.click('[aria-label="Next revision"]');
    await page.waitForFunction(() => { const t = [...document.querySelectorAll('[aria-label="Drawing sheet"] text')].map(e => e.textContent); return t.includes('REV') && t.includes('A'); }, null, { timeout: 10000 });
    assert.equal(await page.locator('[aria-label="Revision"]').inputValue(), 'A');
    await page.click('.mode button:text-is("Model")'); await press('Escape'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.click('.mode button:text-is("Drawing")');
    assert.equal(await page.locator('[aria-label="Revision"]').inputValue(), 'A', 'the revision is kept through a model change');
    await page.waitForSelector('[aria-label="Revision out of date"]', { timeout: 10000 });
    await page.click('[aria-label="Next revision"]'); assert.equal(await page.locator('[aria-label="Revision"]').inputValue(), 'B');
    assert.equal(await page.locator('[aria-label="Revision out of date"]').count(), 0);
    await page.click('.mode button:text-is("Model")');
  });

  await check('draw a plate: standard views, dimensions that follow the model, SVG and PDF', async () => {
    const fs = await import('node:fs');
    // An empty part: the sheet says there is nothing to draw, and no error is raised.
    await page.click('[aria-label="New part"]'); await page.click('.mode button:text-is("Drawing")');
    await page.waitForFunction(() => /no body to draw/.test(document.querySelector('.dw-paper')?.textContent ?? ''), null, { timeout: 15000 });
    assert.ok(!/Could not draw/.test(await page.locator('.toast').allInnerTexts().then(t => t.join(' '))), 'no error toast for an empty part');
    await page.click('.mode button:text-is("Model")');
    await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    // (Once the new plate is evaluated — the outliner lists evaluated bodies — its top face can be picked.)
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`), 'the top face exists');
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      const sheet = await page.evaluate(() => window.__studioDrawing());
      assert.equal(sheet.scale, 1); assert.equal(sheet.hidden.front, 2, 'the hole is two hidden lines in the front view'); assert.equal(sheet.hidden.top, 0);
      const clickView = async (view, u, v) => {
        const p = await page.evaluate(([view, u, v]) => window.__studioDrawingAt(view, u, v), [view, u, v]);
        await page.mouse.move(p.x - 3, p.y); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y);
      };
      // The width between two corners of the front view, placed below it; the hole's diameter from the top view.
      await press('d'); await clickView('front', 0, 0); await clickView('front', 64, 0); await clickView('front', 32, -12);
      await press('o'); await clickView('top', 36, 16); await clickView('top', 52, 40);
      // The front view's lower right corner: its bottom and right edges, the angle placed inside.
      await press('a'); await clickView('front', 40, 0); await clickView('front', 64, 5); await clickView('front', 58, 3);
      await page.waitForFunction(() => window.__studioDrawing().dimensions.length === 3, null, { timeout: 5000 });
      assert.deepEqual((await page.evaluate(() => window.__studioDrawing())).dimensions.map(d => d.text), ['64', 'Ø8 THRU', '90°'], 'the hole\'s diameter reads as its callout');
      assert.equal(await page.locator('.dw svg [data-dim]').count(), 3);
      // A dimension in the isometric view is refused with the reason.
      await press('d'); await clickView('iso', 0, 0);
      assert.match(await page.locator('.dw-hint').innerText(), /front, top and right views/);
      await press('Escape');
      // A bigger hole in the model: the diameter follows it.
      await page.click('.mode button:text-is("Model")');
      await page.locator('.history .hs', { hasText: 'Hole Ø8' }).click();
      const ed = (label) => page.locator('.node-editor .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input, select');
      await ed('Diameter').fill(''); await ed('Diameter').fill('12');
      await page.locator('.node-editor button', { hasText: 'Apply' }).click(); await idle();
      await page.waitForFunction(() => /Hole Ø12/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.dimensions?.map(d => d.text).join() === '64,Ø12 THRU,90°', null, { timeout: 20000 });
      // A ± tolerance on the width (picked from the list), and a note typed on the paper.
      await page.locator('.dw-dim', { hasText: 'horizontal' }).click();
      await page.selectOption('[aria-label="Tolerance"]', 'symmetric');
      await page.waitForFunction(() => window.__studioDoc.drawing.dimensions[0].tol?.value === 0.1, null, { timeout: 5000 });
      await press('n'); await clickView('front', 0, -45);
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Note text', null, { timeout: 5000 });
      await page.keyboard.type('ALL EDGES BROKEN 0.5'); await press('Meta+Enter');
      await page.waitForFunction(() => window.__studioDoc.drawing.notes?.[0]?.text === 'ALL EDGES BROKEN 0.5', null, { timeout: 5000 });
      // Section A–A through the hole (the middle of the plate by default): two cut faces either side of it.
      await page.click('[aria-label="Section A–A"]');
      await page.waitForFunction(() => window.__studioDrawing?.()?.section?.rings === 2, null, { timeout: 20000 });
      assert.equal((await doc()).drawing.section.y, 16);
      const saved = (await doc()).drawing; assert.equal(saved.dimensions.length, 3); assert.equal(saved.sheet, 'A4');
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      assert.match(svgFile.suggestedFilename(), /\.svg$/);
      const svg = fs.readFileSync(await svgFile.path(), 'utf8'); fs.writeFileSync(join(out, 'drawing.svg'), svg);
      assert.match(svg, /width="297mm" height="210mm"/); assert.match(svg, /stroke-dasharray/); assert.match(svg, />Ø12 THRU<\/text>/); assert.match(svg, />1:1<\/text>/);
      assert.match(svg, /stroke-dasharray="8 1.5 1.5 1.5"/, 'centre lines on the hole');
      assert.ok(svg.includes('>SECTION A–A</text>'), 'the section on the sheet');
      assert.ok(svg.includes('>64 ±0.1</text>') && svg.includes('>ALL EDGES BROKEN 0.5</text>'), 'the tolerance and the note');
      const [pdfFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export PDF"]')]);
      const pdf = fs.readFileSync(await pdfFile.path()); fs.writeFileSync(join(out, 'drawing.pdf'), pdf);
      assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  await check('delete a feature from its editor; undo brings it back', async () => {
    const nodes = (await doc()).nodes.length;
    // A feature a later one uses (the plate, under the hole) asks first, naming what goes with it; cancelled, nothing goes.
    await page.locator('.history .hs', { hasText: 'Box' }).first().click();
    await page.locator('.node-editor button[aria-label="Delete feature"]').click();
    await page.waitForSelector('[aria-label="Delete with dependents"]', { timeout: 5000 });
    assert.match(await page.locator('[aria-label="Delete with dependents"]').innerText(), /Hole Ø12/);
    await page.locator('[aria-label="Delete with dependents"] button', { hasText: 'Cancel' }).click();
    assert.equal((await doc()).nodes.length, nodes);
    // The hole the drawing measured: the hole and its Ø dimension go, the plate and the other dimensions stay.
    await page.locator('.history .hs', { hasText: 'Hole Ø12' }).click();
    await page.locator('.node-editor button[aria-label="Delete feature"]').click(); await idle();
    await page.waitForFunction(n => window.__studioDoc.nodes.length === n - 1, nodes, { timeout: 15000 });
    assert.doesNotMatch(await page.locator('.history').innerText(), /Hole/);
    await page.waitForFunction(() => /Removed 1 drawing dimension/.test(document.body.textContent ?? ''), null, { timeout: 5000 });
    assert.deepEqual((await doc()).drawing.dimensions.map(d => d.kind), ['linear', 'angle']);
    await press('Escape'); await press('Meta+z'); await idle();
    await page.waitForFunction(n => window.__studioDoc.nodes.length === n, nodes, { timeout: 15000 });
    assert.match(await page.locator('.history').innerText(), /Hole Ø12/);
  });

  await check('open an STL in centimetres: the unit asked for, the block in mm with its hole, its flat faces merged', async () => {
    await page.setInputFiles('input[aria-label="Model file"]', join(root, 'test/fixtures/block-cm.stl'));
    await page.waitForSelector('[aria-label="Mesh units"]');
    assert.match(await page.locator('[aria-label="Mesh units"]').innerText(), /4 × 2 × 1 mm/);
    await page.selectOption('[aria-label="Mesh unit"]', 'cm');
    assert.match(await page.locator('[aria-label="Mesh units"]').innerText(), /40 × 20 × 10 mm/);
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh', null, { timeout: 15000 });
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    assert.match(await page.locator('.toast').innerText(), /STL opened[\s\S]*7,000 mm³/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => /40 × 20 × 10/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    // (F0: a new import is facet faces, its regions named by the mesh.)
    assert.equal((await doc()).nodes[0].representation, 'facets');
    await snap('stl-open');
  });

  await check('a mesh in pieces opens as a body each (a floater said so); a long Boolean on a mesh can be stopped, the change taken back', async () => {
    const fs = await import('node:fs'), { encodeBinaryStl } = await import('../../../packages/barocss-cad/dist/index.js');
    /** A UV sphere's triangles (outward), centred at c. */
    const sphere = (r, n, m, c) => {
      const P = [c[0], c[1], c[2] - r], I = [];
      for (let j = 1; j < m; j++) { const phi = -Math.PI / 2 + Math.PI * j / m; for (let i = 0; i < n; i++) { const th = 2 * Math.PI * i / n; P.push(c[0] + r * Math.cos(phi) * Math.cos(th), c[1] + r * Math.cos(phi) * Math.sin(th), c[2] + r * Math.sin(phi)); } }
      P.push(c[0], c[1], c[2] + r);
      const top = P.length / 3 - 1, at = (j, i) => 1 + (j - 1) * n + (i % n);
      for (let i = 0; i < n; i++) I.push(0, at(1, i + 1), at(1, i));
      for (let j = 1; j < m - 1; j++) for (let i = 0; i < n; i++) I.push(at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j, i), at(j + 1, i + 1), at(j + 1, i));
      for (let i = 0; i < n; i++) I.push(at(m - 1, i), at(m - 1, i + 1), top);
      return { P, I };
    };
    const a = sphere(10, 24, 12, [0, 0, 0]), b = sphere(0.5, 8, 4, [30, 0, 0]);
    const file = join(out, 'kit.stl');
    fs.writeFileSync(file, encodeBinaryStl([...a.P, ...b.P], [...a.I, ...b.I.map(i => i + a.P.length / 3)], 'kit'));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForSelector('[aria-label="Mesh units"]');
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    // (The floater is a finding: the repair gate offers to drop it; opened as it is, both pieces come in.)
    await page.waitForSelector('[aria-label="Mesh repair"]', { timeout: 15000 });
    assert.match(await page.textContent('[aria-label="Mesh repair"]'), /2 pieces[\s\S]*1 tiny piece/);
    await page.locator('[aria-label="Mesh repair"] button', { hasText: 'Open as it is' }).click();
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    assert.equal((await doc()).nodes[0].pieces, 2);
    assert.match(await page.locator('.toast').innerText(), /2 pieces, each a body of its own[\s\S]*1 of the pieces is tiny/);
    const before = await doc();
    // A part file uniting two meshes, one a 15.9k-triangle sphere (a Boolean of two meshes: F0's planar path, under its
    // 16k limit): seconds; stopped, the open is taken back.
    const big = sphere(10, 112, 72, [0, 0, 0]), small = sphere(4, 24, 12, [9, 0, 0]), part = join(out, 'big-union.bcad');
    fs.writeFileSync(part, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 3, outputs: {},
      nodes: [{ id: 'n0', kind: 'mesh', name: 'ball', unit: 'mm', positions: big.P, indices: big.I, representation: 'facets' }, { id: 'n1', kind: 'mesh', name: 'bump', unit: 'mm', positions: small.P, indices: small.I, representation: 'facets' },
        { id: 'n2', kind: 'union', left: { node: 0, side: 'solid' }, right: { node: 1, side: 'solid' } }] }));
    await page.setInputFiles('input[aria-label="Model file"]', part);
    await page.waitForSelector('[aria-label="Cancel the computation"]', { timeout: 15000 });
    await page.click('[aria-label="Cancel the computation"]');
    await page.waitForFunction(() => /Stopped/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 5000 });
    assert.deepEqual((await doc()).nodes.map(n => n.id), before.nodes.map(n => n.id));
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
  });

  await check('a mesh saved as the container opens again the same; unsaved, its copy (blobs in IndexedDB) comes back after a reload', async () => {
    const fs = await import('node:fs');
    await page.setInputFiles('input[aria-label="Model file"]', join(root, 'test/fixtures/block-cm.stl'));
    await page.waitForSelector('[aria-label="Mesh units"]');
    await page.selectOption('[aria-label="Mesh unit"]', 'cm');
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const node = (await doc()).nodes[0];
    assert.ok(node.blob && !node.positions, 'the document names its arrays by hash');
    // Unsaved: the recovery copy, its blobs in IndexedDB, restored after a reload.
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForSelector('[aria-label="Recover unsaved work"]', { timeout: 15000 });
    await page.click('[aria-label="Recover unsaved work"] button:text-is("Restore")');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    // Saved: the container (BCADPACK), opened again as the same body.
    const [saved] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('[aria-label="Save"]')]);
    const bytes = fs.readFileSync(await saved.path());
    assert.equal(bytes.subarray(0, 8).toString('latin1'), 'BCADPACK');
    await page.click('[aria-label="New part"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 5000 });
    const file = join(out, 'block.bcad'); fs.writeFileSync(file, bytes);
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => /7000 mm³/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
  });

  await check('a mesh with a hole: checked, the repair gate (steps, holes, its numbers before it is applied), applied as a recorded step, its badge shows the fill and opens it again', async () => {
    const fs = await import('node:fs'), { encodeBinaryStl } = await import('../../../packages/barocss-cad/dist/index.js');
    // A sphere with its top cap off: one hole of 24 edges.
    const n = 24, m = 12, P = [0, 0, -10], I = [];
    for (let j = 1; j < m; j++) { const phi = -Math.PI / 2 + Math.PI * j / m; for (let i = 0; i < n; i++) { const th = 2 * Math.PI * i / n; P.push(10 * Math.cos(phi) * Math.cos(th), 10 * Math.cos(phi) * Math.sin(th), 10 * Math.sin(phi)); } }
    const at = (j, i) => 1 + (j - 1) * n + (i % n);
    for (let i = 0; i < n; i++) I.push(0, at(1, i + 1), at(1, i));
    for (let j = 1; j < m - 2; j++) for (let i = 0; i < n; i++) I.push(at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j, i), at(j + 1, i + 1), at(j + 1, i));
    const file = join(out, 'cup.stl'); fs.writeFileSync(file, encodeBinaryStl(P, I, 'cup'));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForSelector('[aria-label="Mesh units"]');
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    await page.waitForSelector('[aria-label="Mesh repair"]', { timeout: 15000 });
    assert.match(await page.textContent('[aria-label="Mesh repair"]'), /1 hole/);
    assert.equal(await page.locator('[aria-label="Mesh repair"] button', { hasText: 'Open as it is' }).count(), 0, 'not closed: no opening as it is');
    // Coarser fill, checked: its numbers before anything changes.
    await page.check('[aria-label="Coarser fill"]');
    await page.locator('[aria-label="Mesh repair"] button', { hasText: 'Check the repair' }).click();
    await page.waitForSelector('[aria-label="Repair report"]', { timeout: 15000 });
    assert.match(await page.textContent('[aria-label="Repair report"]'), /1 hole filled with \d+ triangles[\s\S]*Closed: it opens as a solid/);
    await page.locator('[aria-label="Mesh repair"] button', { hasText: 'Apply the repair' }).click();
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.repair?.report.holesFilled === 1 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const node = (await doc()).nodes[0];
    assert.ok(node.blob && node.repair.result.fill && node.repair.steps.fill.coarseness === 2, 'the import kept, the repair recorded');
    // The badge: the fill shown (its faces selected) and the repair open again, as it was.
    await page.click('[aria-label="Mesh repair"]:not([role])');
    await page.waitForSelector('[role="dialog"][aria-label="Mesh repair"]', { timeout: 15000 });
    assert.ok(await page.locator('[aria-label="Coarser fill"]').isChecked());
    await snap('mesh-repair');
    await page.locator('[role="dialog"][aria-label="Mesh repair"] button', { hasText: 'Cancel' }).click();
  });

  await check('STEP and meshes: asked how mesh bodies go out (tessellated AP242 or planar); a tessellated file reads back; a mesh-only STEP that does not close goes through the repair gate', async () => {
    const fs = await import('node:fs');
    // The repaired cup from the last step is a mesh body: Export STEP asks.
    await page.click('[aria-label="Export STEP"]');
    await page.waitForSelector('[aria-label="STEP mesh bodies"]', { timeout: 5000 });
    const [tess] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.locator('[aria-label="STEP mesh bodies"] button', { hasText: 'Tessellated' }).click()]);
    const text = fs.readFileSync(await tess.path(), 'utf8');
    assert.match(text, /AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF/); assert.match(text, /TRIANGULATED_FACE/);
    // Read back: a closed mesh imports as it is.
    const file = join(out, 'cup-tess.step'); fs.writeFileSync(file, text);
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'import' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 });
    // (The same body: its volume as before, 4022 mm³.)
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => /4022 mm³/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    // Size caps (D49): past 32 MiB in its meshes it still opens, and past 64 MiB (the owner's 128 MiB); past 128 MiB
    // it is refused, pointing to .bcad (the coordinates list padded with spaces; in memory below Playwright's 50 MB,
    // else a file removed once read).
    const padded = n => ({ name: 'cup-big.step', mimeType: 'model/step', buffer: Buffer.from(text.replace('COORDINATES_LIST(', `COORDINATES_LIST(${' '.repeat(n)}`)) });
    await page.setInputFiles('input[aria-label="Model file"]', padded(33 << 20));
    await page.waitForFunction(() => /Import cup-big/.test(document.querySelector('.outliner')?.textContent ?? '') && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 });
    for (const [n, name] of [[65 << 20, 'cup-large'], [129 << 20, 'cup-huge']]) {
      const big = join(out, `${name}.step`); fs.writeFileSync(big, padded(n).buffer);
      await page.setInputFiles('input[aria-label="Model file"]', big); fs.unlinkSync(big);
      if (name === 'cup-large') await page.waitForFunction(() => /Import cup-large/.test(document.querySelector('.outliner')?.textContent ?? '') && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 120000 });
    }
    await page.waitForFunction(() => /larger than 128 MiB; a mesh that large opens from a \.bcad file/.test(document.body.innerText), null, { timeout: 60000 });
    assert.match(await outliner(), /Import cup-large/);
    // A mesh-only STEP whose shell does not close: the gate, as for an STL.
    const open = join(out, 'sheet.step');
    fs.writeFileSync(open, `ISO-10303-21;\nHEADER;FILE_DESCRIPTION((''),'2;1');FILE_NAME('a.stp','',(''),(''),'','','');FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF { 1 0 10303 442 1 1 4 }'));ENDSEC;\nDATA;\n#1=COORDINATES_LIST('',5,((0.,0.,0.),(10.,0.,0.),(10.,10.,0.),(0.,10.,0.),(5.,5.,8.)));\n#2=TRIANGULATED_FACE('sides',#1,5,(),$,(),((1,2,5),(2,3,5),(3,4,5),(4,1,5)));\n#3=TESSELLATED_SHELL('pyramid',(#2),$);\nENDSEC;\nEND-ISO-10303-21;\n`);
    await page.setInputFiles('input[aria-label="Model file"]', open);
    await page.waitForSelector('[aria-label="Mesh repair"]', { timeout: 15000 });
    assert.match(await page.textContent('[aria-label="Mesh repair"]'), /1 hole/);
    await page.locator('[aria-label="Mesh repair"] button', { hasText: 'Check the repair' }).click();
    await page.waitForSelector('[aria-label="Repair report"]', { timeout: 15000 });
    await page.locator('[aria-label="Mesh repair"] button', { hasText: 'Apply the repair' }).click();
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh' && window.__studioDoc.nodes[0].repair?.report.closed, null, { timeout: 15000 });
  });

  await check('open a STEP file as a new part', async () => {
    const { holedBoxStep } = await import('../../../packages/barocss-cad/test/step-fixtures.mjs');
    const file = join(out, 'holed-box.step'); (await import('node:fs')).writeFileSync(file, holedBoxStep());
    await page.locator('input[aria-label="Model file"]').setInputFiles(file);
    // (The bodies follow the name once evaluated: wait for both.)
    await page.waitForFunction(() => /Import holed-box/.test(document.querySelector('.outliner')?.textContent ?? '') && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 });
    await iso();
    assert.match(await page.evaluate(() => document.body.innerText), /STEP opened[\s\S]*1 solid, in millimetres/);
    // A file holding two solids opens as two bodies.
    const { evaluateCadPart, exportStep } = await import('../../../packages/barocss-cad/dist/index.js');
    const box = (id, x, w, h) => [{ id: id + 's', kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + w, w] }, { id, kind: 'extrude', sketch: id + 's', height: h }];
    const pair = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [...box('a', 0, 10, 5), ...box('b', 20, 6, 4)] });
    const twoFile = join(out, 'two-boxes.step'); (await import('node:fs')).writeFileSync(twoFile, exportStep(pair.outputs.map(o => o.brep), { name: 'two-boxes' }));
    await page.locator('input[aria-label="Model file"]').setInputFiles(twoFile);
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 });
    assert.match(await outliner(), /solid 1[\s\S]*solid 2/);
    await page.locator('input[aria-label="Model file"]').setInputFiles(file);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 });
    // A .step file the kernel cannot read is refused with its reason, and the open part stays.
    const garbage = join(out, 'garbage.step'); (await import('node:fs')).writeFileSync(garbage, 'hello');
    const before = (await doc()).nodes.length;
    await page.locator('input[aria-label="Model file"]').setInputFiles(garbage);
    await page.waitForFunction(() => /Could not open this file/.test(document.body.textContent ?? ''), null, { timeout: 20000 });
    assert.equal((await doc()).nodes.length, before); assert.match(await outliner(), /Import holed-box/);
  });

  await check('measure between two faces of a box', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`));
    await press(' '); await page.locator('.palette input').fill('measure'); await press('Enter');
    await page.waitForSelector('[aria-label="Measurement"]'); await page.waitForTimeout(300);
    assert.ok(await page.evaluate(n => window.__studioPickFace(n), `n${ext}.bottom`));
    const card = page.locator('[aria-label="Measurement"]');
    await page.waitForFunction(() => /Normal distance/.test(document.querySelector('[aria-label="Measurement"]')?.textContent ?? ''));
    const text = await card.innerText();
    const h = (await doc()).nodes[ext].height;
    assert.match(text, new RegExp(`Distance\\s*${h} mm`)); assert.match(text, /Angle\s*0°/);
    assert.equal(await page.locator('.measure-line').count(), 1);
  });

  await check('render a part with an appearance, a light and a saved view', async () => {
    await page.click('.mode button:text-is("Render")');
    await page.waitForSelector('[aria-label="Render"]');
    await page.locator('.outliner .ol').first().click();
    await page.selectOption('[aria-label="Appearance preset"]', 'brass');
    await page.check('.render-panel [aria-label="Two-sided"]');
    await page.click('.render-panel [role="tab"]:text-is("Lights")');
    await page.click('.render-panel button:text-is("Add point")');
    await page.locator('.render-panel [aria-label="Range"]').last().fill('200');
    await page.click('.render-panel [role="tab"]:text-is("Scene")');
    // An environment image lighting the part (and its reflections).
    await page.setInputFiles('.render-panel [aria-label="Environment image"]', join(root, 'test/fixtures/sky.png'));
    await page.waitForFunction(() => /^data:image/.test(window.__studioDoc.render.environment.map?.image ?? ''), null, { timeout: 5000 });
    await page.waitForTimeout(600); await snap('render-environment');
    await page.locator('.render-panel [aria-label="Field of view"]').fill('50');
    await page.click('.render-panel button:text-is("Save this view")');
    const r = await page.evaluate(() => window.__studioDoc.render);
    assert.equal(Object.values(r.appearances)[0].twoSided, true); assert.equal(r.lights.at(-1).range, 200);
    assert.ok(Math.abs(r.camera.fovY - 50 * Math.PI / 180) < 1e-6, 'the field of view is saved with the view');
    assert.equal(Object.values(r.appearances)[0].color, '#d6b25a');
    assert.equal(r.lights.at(-1).kind, 'point');
    assert.ok(r.camera && r.camera.distance > 0);
    if (renderer === 'webgpu') {
      const download = page.waitForEvent('download');
      await page.click('[aria-label="Export image"]');
      assert.match((await download).suggestedFilename(), /\.png$/);
    }
    // An animation: the body moves 30 mm along X over two seconds.
    await page.fill('[aria-label="Time"]', '0');
    await page.click('.timeline button:text-is("Set key")');
    await page.fill('[aria-label="Time"]', '2');
    await page.fill('[aria-label="Offset X"]', '30');
    await page.click('.timeline button:text-is("Set key")');
    const track = await page.evaluate(() => Object.values(window.__studioDoc.render.animation.tracks)[0]);
    assert.deepEqual(track.map(k => [k.t, k.offset[0]]), [[0, 0], [2, 30]]);
    await page.click('[aria-label="Play"]'); await page.waitForTimeout(400); await page.click('[aria-label="Pause"]');
    assert.ok(Number(await page.inputValue('[aria-label="Time"]')) > 0, 'time ran while playing');
    // Props from a CSS scene, and an authored @shader material on the body.
    await page.click('.render-panel [role="tab"]:text-is("Source")');
    await page.click('.render-panel button:text-is("Example")');
    await page.click('.render-panel button:text-is("Apply props")');
    await page.click('.render-panel button:text-is("Add material")');
    await page.fill('[aria-label="Material material1 source"]', '@shader #red { @fragment { color: #ff0000; } }');
    await page.click('.render-panel button:text-is("Apply material1")');
    await page.fill('[aria-label="Material material1 source"]', '@shader #bad { @fragment { color: nope; } }');
    await page.click('.render-panel button:text-is("Apply material1")');
    await page.waitForSelector('.render-panel .diag');
    await page.click('.render-panel [role="tab"]:text-is("Appearance")');
    await page.selectOption('[aria-label="Appearance preset"]', 'plastic-white');
    await page.selectOption('[aria-label="Shader material"]', 'material1');
    const shaded = await page.evaluate(() => window.__studioDoc.render);
    assert.match(shaded.scene, /#plinth/);
    assert.match(shaded.materials.material1, /#ff0000/, 'the refused draft did not replace the applied source');
    assert.equal(Object.values(shaded.appearances)[0].shader, 'material1');
    // A colour map: an image, repeated every 16 mm across the faces.
    await page.selectOption('[aria-label="Shader material"]', '');
    await page.setInputFiles('.render-panel [aria-label="Texture image"]', join(root, 'test/fixtures/checker.png'));
    await page.waitForFunction(() => /^data:image\/png/.test(Object.values(window.__studioDoc.render.appearances)[0].texture?.image ?? ''), null, { timeout: 5000 });
    await page.fill('.render-panel [aria-label="Texture repeat"]', '16');
    await page.waitForFunction(() => Object.values(window.__studioDoc.render.appearances)[0].texture?.scale === 16);
    await page.waitForTimeout(600); await snap('render-texture');
    // A texture with holes cut out where its alpha is low.
    await page.setInputFiles('.render-panel [aria-label="Texture image"]', join(root, 'test/fixtures/holes.png'));
    await page.waitForFunction(() => /^data:image\/png/.test(Object.values(window.__studioDoc.render.appearances)[0].texture?.image ?? '') && Object.values(window.__studioDoc.render.appearances)[0].texture.image.length < 3000, null, { timeout: 5000 });
    await page.locator('.render-panel [aria-label="Cut out below"]').fill('0.5');
    await page.waitForFunction(() => Object.values(window.__studioDoc.render.appearances)[0].cutout === 0.5);
    await page.waitForTimeout(600); await snap('render-cutout');
    // Undo takes the saved view back; Model returns to the modelling look.
    await page.evaluate(() => document.activeElement?.blur());
    for (let k = 0; k < 20 && await page.evaluate(() => !!window.__studioDoc.render?.camera); k++) await press('Meta+z');
    await page.waitForFunction(() => !window.__studioDoc.render?.camera);
    await page.click('.mode button:text-is("Model")');
    await page.waitForSelector('[aria-label="Selection"]');
  });

  await check('import a .barocad source and use curve and surface tools', async () => {
    await page.setInputFiles('input[aria-label="Model file"]', join(root, 'test/fixtures/study.barocad'));
    await page.waitForFunction(() => (window.__studioDoc.direct?.objects.length ?? 0) === 4);
    await page.locator('.ol.direct', { hasText: 'panel' }).click(); await page.waitForTimeout(300); await snap('direct-isocurves');
    await page.click('.direct-panel button:text-is("Iso-curve")');
    await page.locator('.ol.direct', { hasText: 'arc' }).first().click();
    // Where the arc crosses X = 10: once, at its top.
    await page.selectOption('[aria-label="Crossing plane"]', 'x'); await page.fill('.direct-panel [aria-label="At"]', '10'); await page.click('[aria-label="Find crossings"]');
    assert.match(await page.locator('[aria-label="Crossing"]').innerText(), /10, 5, 0/);
    await page.click('.direct-panel button:text-is("Split")');
    await page.waitForSelector('.direct-panel .card-title:has-text("2 OBJECTS")');
    await page.locator('.ol.direct', { hasText: 'top' }).click();
    await page.locator('.ol.direct', { hasText: 'base' }).click({ modifiers: ['Shift'] });
    await page.click('.direct-panel button:text-is("Ruled surface")');
    const names = await page.evaluate(() => window.__studioDoc.direct.objects.map(o => o.name + (o.hidden ? ' (hidden)' : '')));
    assert.deepEqual(names.slice(4), ['study · panel · u = 0.5', 'study · arc · lower', 'study · arc · upper', 'Ruled surface']);
    assert.equal(names[0], 'study · arc (hidden)');
    // A refusal explains itself: a degree-2 arc piece and a line cannot make a ruled surface.
    await page.locator('.ol.direct', { hasText: 'lower' }).click();
    await page.locator('.ol.direct', { hasText: 'top' }).click({ modifiers: ['Shift'] });
    await page.click('.direct-panel button:text-is("Ruled surface")');
    await page.waitForSelector('[role="alert"], .toast');
    await press('Escape');
    // Move, rename and duplicate a curve.
    await page.locator('.ol.direct', { hasText: 'top' }).click();
    await page.click('.direct-panel button:text-is("Move")');
    await page.fill('[aria-label="Object name"]', 'rail'); await press('Enter');
    await page.click('.direct-panel button:text-is("Duplicate")');
    const moved = await page.evaluate(() => window.__studioDoc.direct.objects.filter(o => o.name.startsWith('rail')).map(o => o.name));
    assert.deepEqual(moved, ['rail', 'rail copy']);
    // The visible curves and surfaces as IGES.
    const download = page.waitForEvent('download');
    await page.click('[aria-label="Export IGES"]');
    assert.match((await download).suggestedFilename(), /\.igs$/);
  });

  await check('drag a surface pole with its gizmo; undo puts it back', async () => {
    const id = await page.evaluate(() => window.__studioDoc.direct.objects.find(o => o.name === 'study · panel').id);
    await page.click('.ol.direct[title="study · panel"]');
    await page.waitForFunction(() => document.querySelectorAll('.vp-overlay .pole-mark').length === 4, null, { timeout: 5000 });
    const svg = await page.locator('.vp-overlay').boundingBox();
    const at = await page.evaluate(() => { const c = document.querySelectorAll('.vp-overlay .pole-mark')[3]; return [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]; });
    await page.mouse.click(svg.x + at[0], svg.y + at[1]);
    await page.waitForSelector('.vp-overlay .pole-mark.picked'); await page.waitForSelector('[data-gizmo=moveZ]', { timeout: 5000 });
    const end = n => page.evaluate(([sel, n]) => { const el = document.querySelector(sel), g = k => Number(el.getAttribute(k)); return [g('x1') + (g('x2') - g('x1')) * n, g('y1') + (g('y2') - g('y1')) * n]; }, ['[data-gizmo=moveZ] line:nth-of-type(2)', n]);
    const a0 = await end(0.5), a1 = await end(1), sources = await page.evaluate(() => Object.keys(window.__studioDoc.direct.sources).length);
    await page.mouse.move(svg.x + a0[0], svg.y + a0[1]); await page.mouse.down();
    await page.mouse.move(svg.x + a0[0] + (a1[0] - a0[0]) * 2, svg.y + a0[1] + (a1[1] - a0[1]) * 2, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(n => Object.keys(window.__studioDoc.direct.sources).length > n, sources, { timeout: 5000 });
    const src = await page.evaluate(i => { const d = window.__studioDoc.direct, o = d.objects.find(x => x.id === i); return d.sources[o.source]; }, id);
    const pts = [...src.matchAll(/\[(-?[\d.e-]+),(-?[\d.e-]+),(-?[\d.e-]+)\]/g)].map(m => m.slice(1).map(Number));
    assert.ok(pts.some(p => p[2] > -4), `one pole raised above z = -5: ${JSON.stringify(pts)}`);
    assert.equal(pts.filter(p => p[2] === -5).length, 3, 'the other poles stay');
    await snap('direct-pole-drag');
    await press('Meta+z');
    await page.waitForFunction(n => Object.keys(window.__studioDoc.direct.sources).length === n, sources, { timeout: 5000 });
  });

  await check('thicken a surface into a body: the flat panel 3 mm thick', async () => {
    await page.click('.ol.direct[title="study · panel"]');
    await page.fill('.direct-panel [aria-label="Thickness"]', '3'); await page.locator('.direct-panel [aria-label="Thickness"]').blur();
    await page.click('.direct-panel [aria-label="Thicken into a body"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'thicken', null, { timeout: 10000 });
    await page.waitForFunction(() => /Thicken study · panel 3/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.locator('.outliner .ol', { hasText: 'Thicken' }).first().click();
    await page.waitForFunction(() => /Volume\s*1200 mm³/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 15000 });
    await snap('thicken'); await press('Meta+z');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind !== 'thicken', null, { timeout: 5000 });
  });

  await check('sew six surfaces into a body: a domed lid on ruled walls, 1200 mm³', async () => {
    await page.setInputFiles('input[aria-label="Model file"]', join(root, 'test/fixtures/lid.barocad'));
    await page.waitForFunction(() => (window.__studioDoc.direct?.objects ?? []).filter(o => o.name.startsWith('lid · ')).length === 6, null, { timeout: 5000 });
    const names = ['dome', 'floor', 'front', 'back', 'left', 'right'];
    for (const [k, n] of names.entries()) await page.click(`.ol.direct[title="lid · ${n}"]`, k ? { modifiers: ['Shift'] } : {});
    await page.waitForSelector('.direct-panel .card-title:has-text("6 OBJECTS")');
    await page.click('.direct-panel [aria-label="Sew into a body"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'sew', null, { timeout: 10000 });
    await page.waitForFunction(() => /Sew 6 surfaces/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.locator('.outliner .ol', { hasText: 'Sew' }).first().click();
    await page.waitForFunction(() => /Volume\s*1200 mm³/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__studioDoc.direct.objects.filter(o => o.name.startsWith('lid · ') && o.hidden).length), 6, 'the sewn surfaces are hidden');
    await snap('sew'); await press('Meta+z');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind !== 'sew', null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => window.__studioDoc.direct.objects.filter(o => o.name.startsWith('lid · ') && o.hidden).length), 0, 'undo shows them again');
  });

  await check('trim a warped sheet by an oval above it: a hole along the projected loop, untrim restores it', async () => {
    await page.setInputFiles('input[aria-label="Model file"]', join(root, 'test/fixtures/warp.barocad'));
    await page.waitForFunction(() => (window.__studioDoc.direct?.objects ?? []).filter(o => o.name.startsWith('warp · ')).length === 2, null, { timeout: 5000 });
    await page.click('.ol.direct[title="warp · sheet"]'); await page.click('.ol.direct[title="warp · oval"]', { modifiers: ['Shift'] });
    await page.click('.direct-panel [aria-label="Trim by the curve"]');
    await page.waitForFunction(() => window.__studioDoc.direct.objects.find(o => o.name === 'warp · sheet')?.trims?.length === 1, null, { timeout: 5000 });
    await page.click('.ol.direct[title="warp · sheet"]');
    await page.waitForSelector('.direct-panel .kv:has-text("Trimmed 1 loop")');
    await snap('trim-loop');
    await page.click('.direct-panel [aria-label="Untrim"]');
    await page.waitForFunction(() => !window.__studioDoc.direct.objects.find(o => o.name === 'warp · sheet')?.trims, null, { timeout: 5000 });
    await press('Meta+z');
    await page.waitForFunction(() => window.__studioDoc.direct.objects.find(o => o.name === 'warp · sheet')?.trims?.length === 1, null, { timeout: 5000 });
  });

  await check('extend a surface past an edge: the panel run on 5 mm along u', async () => {
    const before = await page.evaluate(() => window.__studioDoc.direct.objects.length);
    await page.click('.ol.direct[title="study · panel"]');
    await page.selectOption('.direct-panel [aria-label="Extend edge"]', 'u-max');
    await page.click('.direct-panel [aria-label="Extend the surface"]');
    await page.waitForFunction(n => window.__studioDoc.direct.objects.length === n + 1, before, { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__studioDoc.direct.objects.at(-1).name), 'study · panel · extended');
    await snap('surface-extend'); await press('Meta+z');
    await page.waitForFunction(n => window.__studioDoc.direct.objects.length === n, before, { timeout: 5000 });
  });

  await check('refit a curve with fewer poles: the arc refitted, its largest gap in its name', async () => {
    const before = await page.evaluate(() => window.__studioDoc.direct.objects.length);
    await page.click('.ol.direct[title="rail"]');
    await page.fill('.direct-panel [aria-label="Poles"]', '4'); await page.locator('.direct-panel [aria-label="Poles"]').blur();
    await page.click('.direct-panel [aria-label="Refit the curve"]');
    await page.waitForFunction(n => window.__studioDoc.direct.objects.length === n + 1, before, { timeout: 10000 });
    assert.match(await page.evaluate(() => window.__studioDoc.direct.objects.at(-1).name), /rail · 4 poles \(±0(\.\d+)?\)/);
    await press('Meta+z');
    await page.waitForFunction(n => window.__studioDoc.direct.objects.length === n, before, { timeout: 5000 });
  });

  await check('unsaved work comes back after a reload', async () => {
    const before = await page.evaluate(() => window.__studioDoc.direct.objects.length);
    await page.waitForTimeout(1200);
    await page.reload();
    await page.waitForSelector('[aria-label="Recover unsaved work"]', { timeout: 15000 });
    await page.click('[aria-label="Recover unsaved work"] button:text-is("Restore")');
    await page.waitForFunction(n => window.__studioDoc.direct?.objects.length === n, before);
    await idle();
  });

  await check('place another part as an instance', async () => {
    await page.setInputFiles('input[aria-label="Part file"]', join(root, 'test/fixtures/bracket.bcad'));
    await page.waitForSelector('[aria-label="Instance"]');
    await page.waitForFunction(() => /Bodies\s*1/.test(document.querySelector('[aria-label="Instance"]')?.textContent ?? ''), null, { timeout: 15000 });
    await page.fill('[aria-label="Instance Z"] >> nth=1', '45'); await press('Enter');
    await page.click('[aria-label="Instance"] button:text-is("Duplicate")');
    const inst = await page.evaluate(() => window.__studioDoc.instances.map(i => ({ name: i.name, rot: i.rotation[2], x: i.position[0] })));
    assert.deepEqual(inst.map(i => [i.name, i.rot]), [['bracket', 45], ['bracket copy', 45]]);
    assert.equal(inst[1].x, inst[0].x + 20);
    const download = page.waitForEvent('download');
    await page.click('[aria-label="Export STEP"]');
    const text = await (await download).createReadStream().then(s => new Promise(r => { let t = ''; s.on('data', c => t += c); s.on('end', () => r(t)); }));
    const solids = (text.match(/MANIFOLD_SOLID_BREP/g) ?? []).length, own = await page.evaluate(() => Object.keys(window.__studioDoc.outputs).length);
    assert.equal(solids, own + 2, `the part's ${own} bodies and both instances in the STEP file (${solids})`);
    // The exploded view spreads them for display only: the placements stay; three more clicks and it is off.
    const placed = JSON.stringify(await page.evaluate(() => window.__studioDoc.instances.map(i => i.position)));
    await page.click('[aria-label="Explode"]'); assert.match(await page.locator('[aria-label="Explode"]').innerText(), /×0\.5/);
    await page.click('[aria-label="Explode"]'); await page.waitForTimeout(300); await snap('exploded');
    assert.equal(JSON.stringify(await page.evaluate(() => window.__studioDoc.instances.map(i => i.position))), placed);
    await page.click('[aria-label="Explode"]'); await page.click('[aria-label="Explode"]');
    assert.doesNotMatch(await page.locator('[aria-label="Explode"]').innerText(), /×/);
    // The section view cuts the placed parts with the part.
    await page.click('[aria-label="Section view"]'); await page.waitForSelector('[data-handle="section"]', { timeout: 10000 });
    await page.click('[aria-label="Section across X"]'); await page.waitForTimeout(500); await snap('section-instances');
    await page.click('[aria-label="Section view"]'); await page.waitForFunction(() => !document.querySelector('[data-handle="section"]'), null, { timeout: 5000 });
  });

  await check('drag a part instance with its gizmo: along X, then a turn about Z; undo puts it back', async () => {
    // (The copy is selected after Duplicate.)
    await page.waitForSelector('[data-gizmo=moveX]', { timeout: 10000 });
    const before = await page.evaluate(() => window.__studioDoc.instances[1]);
    const svg = await page.locator('.vp-overlay').boundingBox();
    const pointOf = (sel, at) => page.evaluate(([sel, at]) => {
      const el = document.querySelector(sel);
      if (el.tagName === 'line') { const g = n => Number(el.getAttribute(n)); return [g('x1') + (g('x2') - g('x1')) * at, g('y1') + (g('y2') - g('y1')) * at]; }
      const ps = el.getAttribute('points').trim().split(' ').map(q => q.split(',').map(Number)); return ps[Math.round((ps.length - 1) * at)];
    }, [sel, at]);
    const drag = async (from, to, steps = 8) => { await page.mouse.move(svg.x + from[0], svg.y + from[1]); await page.mouse.down(); await page.mouse.move(svg.x + to[0], svg.y + to[1], { steps }); await page.mouse.up(); };
    // Along X: as far again as the arrow is long on screen moves it the arrow's length in mm.
    const a0 = await pointOf('[data-gizmo=moveX] line:nth-of-type(2)', 0.5), a1 = await pointOf('[data-gizmo=moveX] line:nth-of-type(2)', 1);
    await drag(a0, [a0[0] + (a1[0] - a0[0]) * 2, a0[1] + (a1[1] - a0[1]) * 2]);
    await page.waitForFunction(x => window.__studioDoc.instances[1].position[0] > x + 1, before.position[0], { timeout: 5000 });
    const moved = await page.evaluate(() => window.__studioDoc.instances[1]);
    assert.deepEqual([moved.position[1], moved.position[2], moved.rotation], [before.position[1], before.position[2], before.rotation]);
    // A quarter sweep round the Z arc: the copy turns about world Z in 15° steps.
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => { const c = document.querySelector('.gizmo-origin'); return [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]; });
    const m = await pointOf('[data-gizmo=turnZ] polyline:nth-of-type(2)', 0.5), r = Math.hypot(m[0] - o[0], m[1] - o[1]), a = Math.atan2(m[1] - o[1], m[0] - o[0]);
    await page.mouse.move(svg.x + m[0], svg.y + m[1]); await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(svg.x + o[0] + r * Math.cos(a - k * Math.PI / 40), svg.y + o[1] + r * Math.sin(a - k * Math.PI / 40));
    await page.mouse.up();
    await page.waitForFunction(z => Math.abs(window.__studioDoc.instances[1].rotation[2] - z) >= 15, before.rotation[2], { timeout: 5000 });
    const turned = await page.evaluate(() => window.__studioDoc.instances[1]);
    assert.equal(Math.abs(turned.rotation[2] - before.rotation[2]) % 15, 0, `a 15° step: ${turned.rotation[2]}`);
    await snap('instance-gizmo');
    await press('Meta+z'); await press('Meta+z');
    await page.waitForFunction(b => JSON.stringify(window.__studioDoc.instances[1].position) === JSON.stringify(b), before.position, { timeout: 5000 });
  });

  await check('shared part definition: a new revision waits, then both copies take it where they are; a copy made independent keeps its own', async () => {
    const list = () => page.evaluate(() => window.__studioDoc.instances.map(i => ({ part: i.part?.id, rev: i.part?.rev, h: i.doc.nodes.find(n => n.kind === 'extrude')?.height, x: i.position[0] })));
    const before = await list();
    assert.equal(before[0].part, before[1].part, 'the copy shares the definition');
    await page.locator('.ol.instance').first().click();
    await page.waitForSelector('[aria-label="Instance"]');
    assert.match(await page.locator('[aria-label="Instance"]').innerText(), /Rev A · shared by 2/);
    await page.setInputFiles('[aria-label="Instance"] [aria-label="New revision file"]', join(root, 'test/fixtures/bracket-rev-b.bcad'));
    await page.waitForSelector('[aria-label="Revision waiting"]');
    assert.deepEqual((await list()).map(i => i.h), before.map(i => i.h), 'nothing changes before it is accepted');
    await snap('revision-waiting');
    await page.click('[aria-label="Instance"] button:text-is("Accept Rev B")');
    await page.waitForFunction(() => window.__studioDoc.instances.every(i => i.part?.rev === 'B'));
    const after = await list();
    assert.deepEqual(after.map(i => [i.rev, i.h === before[0].h * 2, i.x]), before.map(i => ['B', true, i.x]));
    // Made independent, a copy no longer shares later revisions.
    await page.click('[aria-label="Instance"] button:text-is("Make independent")');
    await page.waitForFunction(() => new Set(window.__studioDoc.instances.map(i => i.part?.id)).size === 2);
    for (let k = 0; k < 2; k++) await press('Meta+z');
    await page.waitForFunction(() => window.__studioDoc.instances.every(i => i.part?.rev === 'A' && !window.__studioDoc.pendingParts), null, { timeout: 5000 }).catch(() => {});
    await idle();
  });

  await check('mate the copy to the fixed bracket by its faces', async () => {
    const ids = await page.evaluate(() => window.__studioDoc.instances.map(i => i.id));
    const placed = () => page.evaluate(() => window.__studioDoc.instances.map(i => ({ p: i.position, r: i.rotation, fixed: !!i.grounded })));
    const mates = () => page.evaluate(() => window.__studioDoc.mates ?? []);
    const pickFace = (id, name) => page.evaluate(([i, n]) => window.__studioPickInstanceFace(i, n), [id, name]);
    // (side0: the plane y = 0 through the part's origin, facing −Y, turned about Z with the part.)
    const gap = (a, b) => { const t = a.r[2] * Math.PI / 180, n = [Math.sin(t), -Math.cos(t)]; return (b.p[0] - a.p[0]) * n[0] + (b.p[1] - a.p[1]) * n[1]; };
    await page.locator('.ol.instance').first().click();
    await page.click('[aria-label="Instance"] button:text-is("Fix in place")');
    await page.waitForFunction(() => window.__studioDoc.instances[0].grounded === true);
    // The copy's bottom flush on the bracket's top: it rises onto it and keeps its turn and its X, Y.
    const before = (await placed())[1];
    await page.click('[aria-label="Mates"] button:text-is("Add mate")');
    assert.ok(await pickFace(ids[0], 'n1.top')); assert.ok(await pickFace(ids[1], 'n1.bottom'));
    await page.waitForFunction(() => window.__studioDoc.mates?.length === 1);
    await page.waitForFunction(() => window.__studioDoc.instances[1].position[2] === 6);
    let [br, copy] = await placed();
    assert.deepEqual([copy.p[0], copy.p[1], copy.r[2]], [before.p[0], before.p[1], 45]);
    // A side face 5 mm off the bracket's side, facing it: the copy turns half round.
    await page.click('[aria-label="Mates"] button:text-is("Add mate")');
    await page.selectOption('[aria-label="Mate type"]', 'distance');
    await page.fill('[aria-label="Mate distance"]', '5'); await press('Enter');
    assert.ok(await pickFace(ids[0], 'n1.side0')); assert.ok(await pickFace(ids[1], 'n1.side0'));
    await page.waitForFunction(() => window.__studioDoc.mates?.length === 2);
    [br, copy] = await placed();
    assert.equal(copy.r[2], -135); assert.equal(copy.p[2], 6);
    assert.ok(Math.abs(gap(br, copy) - 5) < 1e-9, `gap ${gap(br, copy)}`);
    // The copy's top flush on the bracket's top as well cannot be met: refused with the reason.
    await page.click('[aria-label="Mates"] button:text-is("Add mate")');
    assert.ok(await pickFace(ids[0], 'n1.top')); assert.ok(await pickFace(ids[1], 'n1.top'));
    assert.match(await page.locator('[aria-label="Mate refused"]').innerText(), /Conflicts with Coincident 1/);
    assert.equal((await mates()).length, 2);
    await page.click('[aria-label="Mates"] button:text-is("Cancel")');
    // Edit the distance: re-solved.
    await page.locator('.ol.mate', { hasText: 'Distance 2' }).click();
    await page.fill('[aria-label="Mate distance"]', '10'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.mates[1].distance === 10);
    [br, copy] = await placed();
    assert.ok(Math.abs(gap(br, copy) - 10) < 1e-9, `gap ${gap(br, copy)}`);
    // Lift the fixed bracket 5 mm: the copy follows, still flush on it and 10 mm off its side.
    await page.locator('.ol.instance').first().click();
    await page.fill('[aria-label="Instance Z"] >> nth=0', '5'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.instances[1].position[2] === 11);
    [br, copy] = await placed();
    assert.ok(Math.abs(gap(br, copy) - 10) < 1e-9, `gap ${gap(br, copy)}`);
    // Delete the distance mate (still open from the edit); the coincident one stays.
    assert.match(await page.locator('.ol.mate.sel').innerText(), /Distance 2/);
    await page.click('[aria-label="Mates"] button:text-is("Delete mate")');
    assert.deepEqual((await mates()).map(m => m.kind), ['coincident']);
    // An angle between the two side faces turns the copy about Z only (it stays flush on top).
    await page.click('[aria-label="Mates"] button:text-is("Add mate")');
    await page.selectOption('[aria-label="Mate type"]', 'angle');
    await page.fill('[aria-label="Mate angle"]', '30'); await press('Enter');
    assert.ok(await pickFace(ids[0], 'n1.side0')); assert.ok(await pickFace(ids[1], 'n1.side0'));
    await page.waitForFunction(() => window.__studioDoc.mates?.length === 2);
    [br, copy] = await placed();
    const turn = (a, b) => ((b.r[2] - a.r[2]) % 360 + 540) % 360 - 180;
    // Facing each other at 0°, so 30° away from that is 150° between the two parts' turns.
    assert.equal(Math.abs(turn(br, copy)), 150, `${br.r} ${copy.r}`);
    assert.deepEqual([copy.r[0], copy.r[1], copy.p[2]], [0, 0, 11]);
    // Turn the fixed bracket: the copy turns with it and keeps the angle.
    await page.locator('.ol.instance').first().click();
    await page.fill('[aria-label="Instance Z"] >> nth=1', '90'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.instances[0].rotation[2] === 90);
    await page.waitForFunction(t => { const [a, b] = window.__studioDoc.instances; return Math.abs(((b.rotation[2] - a.rotation[2]) % 360 + 540) % 360 - 180 - t) < 1e-9; }, turn(br, copy));
    // What each part can still do: the bracket is fixed; flush and at an angle, the copy only slides.
    assert.match(await page.locator('[aria-label="Freedom"]').innerText(), /fixed in place/);
    await page.locator('.ol.instance').nth(1).click();
    assert.match(await page.locator('[aria-label="Freedom"]').innerText(), /free: 2 slides$/);
    // With the instance still selected, a History chip opens the feature editor.
    await page.locator('.history .hs').first().click();
    await page.waitForSelector('.node-editor');
    await page.click('[aria-label="Close editor"]');
    await page.evaluate(() => document.activeElement?.blur());
  });

  await check('chat builds a plate through a mocked chat server', async () => {
    // The chat server's replies are scripted (it runs the claude CLI with the studio's tools for real).
    const sse = events => events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
    const empty = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} };
    const docOf = nodes => ({ ...empty, nodes, outputs: { [`b${nodes.length - 1}`]: { node: nodes.length - 1, side: 'solid' } } });
    const nodes = [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [64, 32] }, { kind: 'extrude', sketch: 0, height: 8 }];
    const events = [{ type: 'text', delta: 'Plate first.' }, { type: 'tool', name: 'run_command', input: { command: 'box' }, summary: 'Box → 1 body, 16384 mm³', isError: false }, { type: 'state', doc: docOf(nodes) }];
    for (const [x, y] of [[6, 6], [58, 6], [6, 26], [58, 26]]) {
      nodes.push({ kind: 'hole', parent: { node: nodes.length - 1, side: 'solid' }, center: [x, y], radius: 4 });
      events.push({ type: 'tool', name: 'run_command', input: { command: 'hole', faces: ['n1.top'], values: { d: 8, x, y } }, summary: 'Hole', isError: false }, { type: 'state', doc: docOf(nodes) });
    }
    nodes.push({ kind: 'fillet', parent: { node: 5, side: 'solid' }, edges: ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3'], radius: 2 });
    const expected = Math.round(64 * 32 * 8 - 4 * Math.PI * 16 * 8 - 4 * (4 - Math.PI) * 8);
    events.push({ type: 'tool', name: 'run_command', input: { command: 'fillet' }, summary: `Fillet {"radius":2,"endRadius":0,"shape":"circular"} → 1 body, ${expected} mm³`, isError: false }, { type: 'state', doc: docOf(nodes) },
      { type: 'text', delta: 'Done: a 64 × 32 × 8 plate with four Ø8 holes and R2 vertical edges.' }, { type: 'done', doc: docOf(nodes), session: 'cli-session-1', end: 'done' });
    const requests = [];
    const statusUrl = u => u.pathname === '/api/chat/status', turnUrl = u => u.pathname === '/api/chat/turn';
    await page.route(statusUrl, r => r.fulfill({ json: { enabled: true, model: 'mock-model', via: 'mock' } }));
    await page.route(turnUrl, r => {
      const body = r.request().postDataJSON(); requests.push(body);
      const reply = requests.length === 1 ? events : [{ type: 'text', delta: requests.length === 2 ? 'You’re welcome.' : 'That drawing shows the same plate.' }, { type: 'done', session: body.session, end: 'done' }];
      return r.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(reply) });
    });
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Chat"]');
    const input = page.locator('[aria-label="Chat message"]');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled);
    await input.fill('a 64×32×8 plate with four Ø8 holes 6 mm from the corners and R2 vertical edges'); await press('Enter');
    await page.waitForSelector('.chat-msg.assistant:has-text("Done:")', { timeout: 30000 });
    await page.waitForFunction(() => /Fillet R2/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    assert.deepEqual(await page.evaluate(() => window.__studioDoc.nodes.map(n => n.kind)), ['sketch', 'extrude', 'hole', 'hole', 'hole', 'hole', 'fillet']);
    assert.equal(await page.locator('.chat-tool').count(), 6);
    assert.match(await page.locator('.chat-tool').last().innerText(), new RegExp(`Fillet .*${expected} mm³`));
    assert.equal(requests[0].doc.nodes.length, 0); assert.equal(requests[0].session, undefined);
    // The next message resumes the same CLI conversation and leaves the part as it is.
    await input.fill('thanks'); await press('Enter');
    await page.waitForSelector('.chat-msg.assistant:has-text("welcome")');
    assert.equal(requests[1].session, 'cli-session-1'); assert.equal(requests[1].doc.nodes.length, 7);
    // An attached drawing goes with the next message, scaled and as base64, shown as a thumbnail.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');
    await page.setInputFiles('[aria-label="Chat image file"]', { name: 'plate.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('[aria-label="Attached images"] img');
    await page.click('[aria-label="Remove plate.png"]'); assert.equal(await page.locator('[aria-label="Attached images"]').count(), 0);
    await page.setInputFiles('[aria-label="Chat image file"]', { name: 'plate.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('[aria-label="Attached images"] img');
    await page.click('.chat-input button:text-is("Send")');
    await page.waitForFunction(() => document.querySelectorAll('.chat-msg.assistant').length >= 3);
    assert.equal(requests.length, 3); assert.equal(requests[2].images.length, 1);
    assert.equal(requests[2].images[0].media_type, 'image/png'); assert.ok(requests[2].images[0].data.length > 40);
    assert.match(requests[2].text, /image 1 \(plate\.png, traced into \d+ layers/);
    // The traced outlines go with every later turn, for the image tools on the server.
    assert.equal(requests[2].traces.length, 1); assert.ok(Array.isArray(requests[2].traces[0].layers));
    assert.equal(await page.locator('.chat-msg.user .chat-thumbs img').count(), 1);
    // One undo takes the whole first turn back.
    await page.evaluate(() => document.activeElement?.blur());
    await press('Meta+z'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await press('Meta+Shift+z'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 7);
    await page.click('[aria-label="Close chat"]');
    await page.unroute(statusUrl); await page.unroute(turnUrl);
  });

  await check('chat commits an assembly: a pin part mated into a plate', async () => {
    // A mocked turn whose result is an assembly (the tools that build it are covered by the unit tests).
    const empty = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} };
    const plate = { ...empty, nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [64, 32] }, { kind: 'extrude', sketch: 0, height: 8 }, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [32, 16], radius: 4 }], outputs: { b2: { node: 2, side: 'solid' } } };
    const pin = { ...empty, nodes: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 }, { kind: 'extrude', sketch: 0, height: 20 }], outputs: { b1: { node: 1, side: 'solid' } } };
    const doc = { ...plate, instances: [{ id: 'p1', name: 'Pin', doc: pin, position: [32, 16, 8], rotation: [0, 0, 0] }],
      mates: [{ id: 'm1', kind: 'concentric', a: { part: 'base', face: 'n2.side0' }, b: { part: 'p1', face: 'n1.side0' } }, { id: 'm2', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' } }] };
    const events = [
      { type: 'tool', name: 'add_part', input: { name: 'Pin' }, summary: 'added part p1 "Pin"', isError: false },
      { type: 'tool', name: 'add_mate', input: { kind: 'concentric' }, summary: 'added Concentric 1 (m1)', isError: false },
      { type: 'tool', name: 'add_mate', input: { kind: 'coincident' }, summary: 'added Coincident 2 (m2)', isError: false },
      { type: 'state', doc }, { type: 'text', delta: 'Pin mated into the plate.' }, { type: 'done', doc, session: 's-asm', end: 'done' },
    ];
    const statusUrl = u => u.pathname === '/api/chat/status', turnUrl = u => u.pathname === '/api/chat/turn';
    await page.route(statusUrl, r => r.fulfill({ json: { enabled: true, model: 'mock-model' } }));
    await page.route(turnUrl, r => r.fulfill({ status: 200, contentType: 'text/event-stream', body: events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('') }));
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Chat"]');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled);
    await page.fill('[aria-label="Chat message"]', 'a plate with a pin in its hole, as two parts'); await press('Enter');
    await page.waitForSelector('.chat-msg.assistant:has-text("Pin mated")');
    await page.waitForSelector('.ol.instance:has-text("Pin")', { timeout: 30000 });
    await idle();
    assert.deepEqual(await page.evaluate(() => [window.__studioDoc.instances.length, window.__studioDoc.mates.length, window.__studioDoc.instances[0].position]), [1, 2, [32, 16, 8]]);
    // The studio's own solver keeps it where the mates put it, and the mate panel lists them.
    await page.locator('.ol.instance', { hasText: 'Pin' }).click();
    assert.match(await page.locator('[aria-label="Mates"]').innerText(), /Concentric 1[\s\S]*Coincident 2/);
    await page.evaluate(() => document.activeElement?.blur());
    await press('Meta+z'); await page.waitForFunction(() => !(window.__studioDoc.instances?.length));
    await press('Meta+Shift+z'); await page.waitForFunction(() => window.__studioDoc.instances?.length === 1);
    await page.click('[aria-label="Close chat"]');
    await page.unroute(statusUrl); await page.unroute(turnUrl);
  });

  await check('drag a dimension handle (box width), and turn a body 45° about X with the Rotate gizmo', async () => {
    // Placed with a click first (the arrows come once it stands somewhere).
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    { const c = await page.locator('canvas').boundingBox(); await page.mouse.move(c.x + c.width * 0.45, c.y + c.height * 0.55, { steps: 3 }); await page.mouse.click(c.x + c.width * 0.45, c.y + c.height * 0.55); }
    await page.waitForSelector('[data-handle="w"]', { timeout: 5000 }); await hudReady();
    const svg = await page.locator('.vp-overlay').boundingBox();
    const ends = sel => page.evaluate(sel => { const l = document.querySelector(sel); const g = n => Number(l.getAttribute(n)); return [[g('x1'), g('y1')], [g('x2'), g('y2')]]; }, sel);
    const [a, b] = await ends('[data-handle="w"] line:nth-of-type(2)'), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    await page.mouse.move(svg.x + m[0], svg.y + m[1]); await page.mouse.down();
    await page.mouse.move(svg.x + m[0] + (b[0] - a[0]) * 1.5, svg.y + m[1] + (b[1] - a[1]) * 1.5, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => Number(document.querySelector('.hud input')?.value) > 32, null, { timeout: 5000 });
    await press('Enter'); await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    // The box's top face picks its body for Rotate.
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && window.__studioSelectFace('n1.top'), null, { timeout: 15000 });
    await press(' '); await page.locator('.palette input').fill('rotate'); await press('Enter'); await press('e'); await hudReady();
    await page.waitForSelector('[data-gizmo=turnX]', { timeout: 5000 });
    const o = await page.evaluate(() => { const c = document.querySelector('.gizmo-origin'); return [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]; });
    const q = await page.evaluate(() => { const ps = document.querySelector('[data-gizmo=turnX] polyline:nth-of-type(2)').getAttribute('points').trim().split(' ').map(p => p.split(',').map(Number)); return ps[ps.length >> 1]; });
    const r = Math.hypot(q[0] - o[0], q[1] - o[1]), a0 = Math.atan2(q[1] - o[1], q[0] - o[0]);
    await page.mouse.move(svg.x + q[0], svg.y + q[1]); await page.mouse.down();
    for (let k = 1; k <= 12; k++) await page.mouse.move(svg.x + o[0] + r * Math.cos(a0 - k * Math.PI / 48), svg.y + o[1] + r * Math.sin(a0 - k * Math.PI / 48));
    await page.mouse.up();
    await page.waitForFunction(() => [...document.querySelectorAll('.hud input')].some(i => Math.abs(Number(i.value)) === 45), null, { timeout: 5000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'rotate' && window.__studioDoc.nodes.at(-1).axis === 'x', null, { timeout: 15000 });
    const turned = await page.evaluate(() => window.__studioDoc.nodes.at(-1));
    assert.deepEqual([Math.abs(turned.angleDegrees), turned.pivot.length], [45, 3]);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? '') && !/error/i.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 15000 });
    await snap('rotate-x-45');
  });

  await check('Extrude a picked face: E pulls the box top up, joined to the box', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    // (Once the new box is evaluated: new bodies clear what was picked on the old ones.)
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    const seen = await page.evaluate(() => JSON.stringify(window.__studioSelection));
    await press('e'); await hudReady().catch(e => { throw new Error(`${e.message.split('\n')[0]} — before E: ${seen}`); });
    await page.waitForFunction(() => /Extrude/.test(document.querySelector('.hud')?.textContent ?? '') && /picked face/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 5000 });
    await page.waitForSelector('[data-handle="h"]', { timeout: 5000 });
    await field('Distance').fill('5'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'union', null, { timeout: 15000 });
    const nodes = (await doc()).nodes;
    assert.deepEqual(nodes.map(n => n.kind), ['sketch', 'extrude', 'sketch', 'extrude', 'union']);
    assert.deepEqual([nodes[2].on, nodes[3].height], [{ node: 1, side: 'solid' }, 5]);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await snap('extrude-face');
  });

  await check('Hole: drag its centre puck on the face, then round the bottom face’s edges with Fillet', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady();
    await page.waitForSelector('[data-handle="x+y"]', { timeout: 5000 });
    const before = await page.evaluate(() => [...document.querySelectorAll('.hud input')].map(i => Number(i.value)));
    const svg = await page.locator('.vp-overlay').boundingBox();
    const c = await page.evaluate(() => { const e = document.querySelector('[data-handle="x+y"] circle:nth-of-type(2)'); return [Number(e.getAttribute('cx')), Number(e.getAttribute('cy'))]; });
    await page.mouse.move(svg.x + c[0], svg.y + c[1]); await page.mouse.down();
    await page.mouse.move(svg.x + c[0] + 40, svg.y + c[1], { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(b => { const v = [...document.querySelectorAll('.hud input')].map(i => Number(i.value)); return v[1] !== b[1] && v[2] !== b[2]; }, before, { timeout: 5000 });
    await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 });
    const hole = (await doc()).nodes.at(-1);
    assert.notDeepEqual(hole.center, [before[1], before[2]], 'the centre moved with the puck');
    await snap('hole-puck');
    // A face picked for Fillet rounds every edge round it: the bottom's four and the hole's rim.
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.bottom')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => /5 edges round the picked face/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 5000 });
    await field('Radius').fill('2'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 20000 });
    // (The rim is a circle in halves: one edge, two names.)
    const names = (await doc()).nodes.at(-1).edges;
    assert.equal(names.filter(n => /^n1\.bottom\|n1\.side\d$/.test(n)).length, 4); assert.ok(names.some(n => n.includes('n2.')), names.join(' '));
  });

  await check('primitives: a sphere and a hex prism from the palette', async () => {
    await page.click('[aria-label="New part"]');
    for (const [name, kind] of [['sphere', 'revolve'], ['polygon prism', 'extrude']]) {
      await press(' '); await page.locator('.palette input').fill(name); await press('Enter'); await hudReady(); await press('Enter');
      await page.waitForFunction(k => window.__studioDoc.nodes.at(-1)?.kind === k, kind, { timeout: 15000 });
    }
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await snap('primitives');
  });

  await check('place shapes with the pointer: a click for a box, a drag from the shapes bar for a cylinder; Delete removes one', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    const vp = await page.locator('canvas').boundingBox(), at = (fx, fy) => [vp.x + vp.width * fx, vp.y + vp.height * fy];
    await press('b'); await hudReady();
    const start = await page.evaluate(() => [...document.querySelectorAll('.hud input')].map(i => Number(i.value)));
    const [px, py] = at(0.4, 0.6); await page.mouse.move(px, py, { steps: 4 }); await page.waitForTimeout(150);
    await page.waitForFunction(s => { const v = [...document.querySelectorAll('.hud input')].map(i => Number(i.value)); return v[3] !== s[3] || v[4] !== s[4]; }, start, { timeout: 5000 });
    await page.mouse.click(px, py);
    await page.waitForFunction(() => /placed/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 5000 });
    await hudReady(); await page.waitForTimeout(250); await snap('preview-tint'); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    // The cylinder dragged from the shapes bar onto the ground beside the box.
    await page.dragAndDrop('.shapes [aria-label="Cylinder"]', 'canvas', { targetPosition: { x: vp.width * 0.7, y: vp.height * 0.45 } });
    await page.waitForFunction(() => /Cylinder/.test(document.querySelector('.hud')?.textContent ?? '') && /placed/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 5000 });
    await hudReady(); await page.waitForTimeout(250); await press('Enter');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await snap('placed');
    // Pick the cylinder in the outliner and press Delete: its sketch and extrude go.
    await page.locator('.outliner .ol').nth(1).click(); await press('Delete');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? '') && window.__studioDoc.nodes.length === 2, null, { timeout: 15000 });
  });

  await check('a box under a fillet keeps up while its width is dragged, then the fillet follows', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('Shift+F'); await hudReady(); await page.waitForTimeout(250); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 20000 }); await idle();
    // Pick the box's side (the box feature), drag its width arrow.
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.side0')));
    await page.waitForSelector('[data-handle="w"]', { timeout: 5000 });
    const svg = await page.locator('.vp-overlay').boundingBox();
    const [a, b] = await page.evaluate(() => { const l = document.querySelector('[data-handle="w"] line:nth-of-type(2)'); const g = n => Number(l.getAttribute(n)); return [[g('x1'), g('y1')], [g('x2'), g('y2')]]; });
    await page.mouse.move(svg.x + a[0], svg.y + a[1]); await page.mouse.down();
    const t0 = Date.now();
    await page.mouse.move(svg.x + a[0] + (b[0] - a[0]) * 1.5, svg.y + a[1] + (b[1] - a[1]) * 1.5, { steps: 10 });
    // While held: the preview is the box alone (fast), still shown as evaluating.
    await page.waitForFunction(() => /evaluating/.test(document.querySelector('.hud .status')?.textContent ?? '') || /preview/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 5000 });
    await page.mouse.up(); const held = Date.now() - t0;
    await page.waitForFunction(() => /preview/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0].max[0] > 32 && window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 15000 });
    assert.ok(held < 5000, `drag took ${held} ms`);
  });

  await check('Align: a box’s bottom put on another box’s top with a click', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.evaluate(() => window.__studioSelectFace('nothing')); await press('Escape');
    await press('y'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n3.bottom')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('a'); await hudReady();
    assert.ok(await page.evaluate(() => window.__studioPickFace('n1.top')));
    await page.waitForFunction(() => /face n1\.top/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 5000 });
    await hudReady(); await page.waitForTimeout(250); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'translate', null, { timeout: 15000 });
    const t = (await doc()).nodes.at(-1);
    assert.equal(t.offset[2], 16, 'up onto the 16 mm box');
    await snap('align');
  });

  await check('the browser: rename a body, colour it, hide and show it', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.locator('.outliner .ol').first().dblclick();
    await page.locator('.ol-name-edit').fill('Base'); await press('Enter');
    await page.waitForFunction(() => /Base/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 5000 });
    await page.locator('.outliner .ol').first().click();
    await page.locator('.swatch[aria-label="Colour #4a90d9"]').click();
    await page.waitForFunction(() => window.__studioDoc.bodies?.b1?.color === '#4a90d9', null, { timeout: 5000 });
    await snap('coloured');
    await page.locator('.ol-eye').first().click();
    await page.waitForFunction(() => window.__studioDoc.bodies?.b1?.hidden === true && document.querySelector('.ol-row.hidden-obj'), null, { timeout: 5000 });
    await page.locator('.ol-eye').first().click();
    await page.waitForFunction(() => !window.__studioDoc.bodies?.b1?.hidden, null, { timeout: 5000 });
    assert.deepEqual((await doc()).bodies, { b1: { name: 'Base', color: '#4a90d9' } });
  });

  await check('the view cube turns the view: a face looks straight at it, a corner from that corner', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    const labels = () => page.evaluate(() => [...document.querySelectorAll('.view-cube .vc-label')].map(t => t.textContent).sort().join(' '));
    await page.locator('.view-cube polygon.face[data-view="0-0"]').click(); await page.waitForTimeout(450);
    assert.equal(await labels(), 'FRONT', 'straight at the front: only it shows');
    await snap('cube-front');
    // The front's top right corner: from front, right and top at once.
    await page.locator('.view-cube polygon[data-view="+-+"]').first().click(); await page.waitForTimeout(450);
    assert.equal(await labels(), 'FRONT RIGHT TOP');
  });

  await check('right-click a body: show only it, then show all; ? lists the keys', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await press('y'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    const box = await page.locator('canvas').boundingBox(); await page.mouse.click(box.x + 20, box.y + box.height - 60, { button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Show only this' }).click();
    await page.waitForFunction(() => Object.values(window.__studioDoc.bodies ?? {}).filter(l => l.hidden).length === 1, null, { timeout: 5000 });
    await page.mouse.click(box.x + 20, box.y + box.height - 60, { button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Show all bodies' }).click();
    await page.waitForFunction(() => !Object.values(window.__studioDoc.bodies ?? {}).some(l => l.hidden), null, { timeout: 5000 });
    assert.ok(!(await page.locator('.ctx-menu').count()) || !(await page.locator('.ctx-item', { hasText: 'Sphere' }).count()), 'no shapes in the menu');
    await press('Escape'); await press('?');
    await page.waitForSelector('.help', { timeout: 3000 });
    assert.match(await page.locator('.help').innerText(), /Duplicate a body[\s\S]*Orbit/);
    await press('Escape'); await page.waitForFunction(() => !document.querySelector('.help'));
  });

  await check('section view: a box with a hole cut open across Y, its cut faces lit; the plane drags', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await page.waitForTimeout(250); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    const nodes = (await doc()).nodes.length;
    await page.click('[aria-label="Section view"]');
    await page.waitForSelector('[data-handle="section"]', { timeout: 10000 });
    await page.waitForTimeout(600); await snap('section');
    await page.click('[aria-label="Section across X"]'); await page.waitForTimeout(600);
    await page.click('[aria-label="Flip the section"]'); await page.waitForTimeout(600);
    // Dragging the plane: the clipped, capped meshes follow at once (the exact section after).
    const hb = await page.locator('[data-handle="section"]').boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(hb.x + hb.width / 2 + i * 12, hb.y + hb.height / 2 + i * 4);
    await page.waitForTimeout(40); await snap('section-dragging'); await page.mouse.up(); await page.waitForTimeout(600);
    assert.equal((await doc()).nodes.length, nodes, 'the model is not changed');
    // Its outline as a sketch on the section plane: the box's cut with the hole's, one profile with a hole.
    await page.click('[aria-label="Section across Y"]'); await page.waitForTimeout(1500);
    await page.click('[aria-label="Sketch the section"]');
    await page.waitForFunction(() => document.querySelectorAll('.vp-overlay .sk-shape.done').length >= 1, null, { timeout: 10000 });
    await snap('section-sketch'); await press('Enter');
    await page.waitForFunction(n => window.__studioDoc.nodes.length === n + 1, nodes, { timeout: 10000 });
    const sk = (await doc()).nodes.at(-1);
    assert.equal(sk.kind, 'sketch'); assert.ok(Math.abs(Math.abs(sk.plane.normal[1]) - 1) < 1e-9, JSON.stringify(sk.plane));
    await press('Meta+z'); await page.waitForFunction(n => window.__studioDoc.nodes.length === n, nodes, { timeout: 10000 });
    assert.equal(await page.locator('[data-handle="section"]').count(), 0, 'the section closed for the sketch');
  });

  await check('interference: a cylinder through a box is found, with its overlap', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await press('Escape'); await press('y'); await hudReady();
    await field('Centre X').fill('16'); await field('Centre Y').fill('16'); await field('Radius').fill('4'); await field('Height').fill('30');
    await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await press(' '); await page.locator('.palette input').fill('interference'); await press('Enter');
    await page.waitForFunction(() => /∩/.test(document.querySelector('aside[aria-label="Interference"]')?.textContent ?? ''), null, { timeout: 20000 });
    const text = await page.locator('aside[aria-label="Interference"]').innerText();
    assert.match(text, /Box ∩ Cylinder[\s\S]*804\.2 mm³/, text);
    await page.locator('.ol.clash').click();
    await page.waitForFunction(() => /2 selected/.test(document.querySelector('.props[aria-label="Selection"]')?.textContent ?? ''), null, { timeout: 5000 });
  });

  await check('arrow keys nudge a body (one move for the run); copy and paste a body', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'Shift+ArrowUp']) { await press(k); await page.waitForTimeout(120); }
    await page.waitForFunction(() => JSON.stringify(window.__studioDoc.nodes.at(-1)?.offset) === '[3,10,0]', null, { timeout: 10000 });
    assert.equal((await doc()).nodes.length, 3, 'one move for the run');
    await idle(); await press('Meta+c'); await press('Meta+v');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
  });

  await check('construction: a dashed reference line is snapped to, kept out of the profile and kept with the sketch', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('x');
    await page.waitForSelector('[aria-label="Construction"].on', { timeout: 3000 });
    const [cx, cy] = await canvasCenter();
    await press('l'); await clickAt(cx - 120, cy - 60); await clickAt(cx + 120, cy + 60);
    await press('x'); await press('r'); await clickAt(cx - 80, cy - 40); await clickAt(cx + 80, cy + 40);
    await page.waitForFunction(() => document.querySelectorAll('.vp-overlay .sk-shape.construction').length >= 1, null, { timeout: 5000 });
    await snap('construction');
    // Hidden, the reference is not drawn; shown again, it is.
    await page.click('[aria-label="Hide construction"]');
    await page.waitForFunction(() => !document.querySelector('.vp-overlay .sk-shape.construction'), null, { timeout: 3000 });
    await page.click('[aria-label="Show construction"]');
    await page.waitForFunction(() => !!document.querySelector('.vp-overlay .sk-shape.construction'), null, { timeout: 3000 });
    await page.evaluate(() => document.activeElement?.blur()); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1, null, { timeout: 10000 });
    const node = (await doc()).nodes[0];
    assert.equal(node.profile, 'rectangle'); assert.equal(node.construction?.length, 1);
  });

  await check('history: right-click a step to roll back to it, roll on, or delete it', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await page.waitForTimeout(250); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    await page.locator('.history .hs', { hasText: 'Box' }).click({ button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Roll back to here' }).click();
    await page.waitForFunction(() => /rolled back/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 5000 });
    await page.locator('.history .hs', { hasText: 'Box' }).click({ button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Roll to the end' }).click();
    await page.waitForFunction(() => !/rolled back/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 5000 });
    // The hole cannot move before the box it is drilled in.
    await page.locator('.history .hs', { hasText: 'Hole' }).click({ button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Move earlier' }).click();
    await page.waitForFunction(() => /Cannot move Hole/.test(document.body.innerText), null, { timeout: 5000 });
    await page.click('[aria-label="Dismiss"]');
    // Suppressed, the hole is left out (struck through in the history); unsuppressed, it is back.
    await page.locator('.history .hs', { hasText: 'Hole' }).click({ button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Suppress' }).click();
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.suppressed === true && !!document.querySelector('.history .hs.suppressed'), null, { timeout: 10000 }); await idle();
    await page.locator('.history .hs', { hasText: 'Hole' }).click({ button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Unsuppress' }).click();
    await page.waitForFunction(() => !window.__studioDoc.nodes.at(-1)?.suppressed, null, { timeout: 10000 }); await idle();
    // The box has the hole built on it: deleting it asks first, listing the hole, then takes both.
    await page.locator('.history .hs', { hasText: 'Box' }).click({ button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Delete' }).click();
    await page.waitForSelector('[aria-label="Delete with dependents"]', { timeout: 5000 });
    assert.match(await page.locator('[aria-label="Delete with dependents"]').innerText(), /Hole Ø8/);
    await page.locator('[aria-label="Delete with dependents"] button', { hasText: 'Cancel' }).click();
    assert.equal((await doc()).nodes.length, 3);
    await page.locator('.history .hs', { hasText: 'Hole' }).click({ button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Delete' }).click();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2, null, { timeout: 15000 });
  });

  await check('double-click a body picks all of it; F frames what is picked', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(300);
    const [cx, cy] = await canvasCenter(); await page.mouse.dblclick(cx, cy);
    await page.waitForFunction(() => window.__studioSelection?.selection.bodies.length === 1 && !window.__studioSelection.selection.faces.length, null, { timeout: 5000 });
    await press('f'); await page.waitForTimeout(300);
  });

  await check('fastener: an M8 bolt dropped into the starter plate’s hole, its thread cosmetic', async () => {
    // A 64 × 32 × 8 plate with a Ø8 hole at (32, 16).
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await field('At X').fill('0'); await field('At Y').fill('0');
    await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Centre X').fill('32'); await field('Centre Y').fill('16'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    await press('Escape');
    await page.click('.shapes [aria-label="Fastener"]'); await hudReady();
    await field('Size').selectOption('M8'); await field('Length').selectOption('20');
    await field('Axis at X').fill('32'); await field('Axis at Y').fill('16'); await field('Seat at Z').fill('8');
    await hudReady(); await page.waitForTimeout(300); await snap('fastener-preview'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.made?.command === 'fastener', null, { timeout: 15000 }); await idle();
    await page.locator('.outliner .ol', { hasText: 'Bolt M8×20' }).click();
    await page.waitForFunction(() => /M8×1\.25 right/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await snap('fastener');
  });

  await check('fastener at a Ø6.6 through hole: fitted M6, washer and nut under the plate, fit shown', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await field('At X').fill('0'); await field('At Y').fill('0');
    await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Centre X').fill('32'); await field('Centre Y').fill('16'); await field('Diameter').fill('6.6'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    await press('Escape');
    await page.click('.shapes [aria-label="Fastener"]'); await hudReady();
    // Over the hole's wall (whichever side faces the eye): the fitted bolt follows.
    let fitted = false;
    for (const p of [[32 - 3.2, 16, 4], [32 + 3.2, 16, 4], [32, 16 - 3.2, 4], [32, 16 + 3.2, 4]]) {
      const [sx, sy] = await page.evaluate(q => window.__studioScreenOf(q), p);
      await page.mouse.move(sx - 3, sy); await page.mouse.move(sx, sy); await page.waitForTimeout(250);
      if (await field('Joint').inputValue().catch(() => '') === 'nut') { await page.mouse.click(sx, sy); fitted = true; break; }
    }
    assert.ok(fitted, 'a hole wall under the pointer');
    await hudReady(); await page.waitForTimeout(300);
    const hud = await page.evaluate(() => document.body.innerText);
    assert.match(hud, /ISO 273 medium/); assert.match(hud, /M6×1 /); assert.match(hud, /washer \+ nut: needs 16\.8 mm/);
    await snap('fastener-joint'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.made?.command === 'fastener', null, { timeout: 15000 }); await idle();
    await page.waitForFunction(() => /4 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 10000 });
    assert.match(await page.locator('.outliner').innerText(), /Nut ISO 4032 M6/);
  });

  await check('a countersunk screw inserted as a part of its own: an assembly instance, the part unchanged', async () => {
    const before = await page.evaluate(() => window.__studioDoc.nodes.length);
    await page.click('.shapes [aria-label="Fastener"]'); await hudReady();
    await field('Part').selectOption('csk-screw'); await field('Size').selectOption('M5'); await field('Length').selectOption('16');
    await field('Axis at X').fill('10'); await field('Axis at Y').fill('10'); await field('Seat at Z').fill('8'); await field('Insert').selectOption('instance');
    await hudReady(); await page.waitForTimeout(400); await snap('fastener-instance-preview'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.instances?.length === 1, null, { timeout: 15000 });
    const inst = await page.evaluate(() => { const i = window.__studioDoc.instances[0]; return { name: i.name, position: i.position, rotation: i.rotation }; });
    assert.deepEqual(inst, { name: 'Countersunk socket screw ISO 10642 M5×0.8 × 16', position: [10, 10, 8], rotation: [0, 0, 0] });
    assert.equal(await page.evaluate(() => window.__studioDoc.nodes.length), before, 'no features joined the part');
    await idle(); await page.waitForTimeout(800); await snap('fastener-instance');
    // A bolt standing clear of the plate shows its cosmetic thread: rings along its shank.
    await page.click('.shapes [aria-label="Fastener"]'); await hudReady();
    await field('Part').selectOption('hex-bolt'); await field('Size').selectOption('M8'); await field('Length').selectOption('30');
    await field('Axis at X').fill('90'); await field('Axis at Y').fill('16'); await field('Seat at Z').fill('30');
    await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.made?.values?.x === 90, null, { timeout: 15000 }); await idle();
    await press('Escape'); await press('f'); await page.waitForTimeout(800); await snap('fastener-threads');
    // Modelled: the thread as helical B-spline faces (one solid), its head and seat named for mates.
    await page.click('.shapes [aria-label="Fastener"]'); await hudReady();
    await field('Part').selectOption('hex-bolt'); await field('Size').selectOption('M8'); await field('Length').selectOption('30');
    await field('Axis at X').fill('120'); await field('Axis at Y').fill('16'); await field('Seat at Z').fill('30'); await field('Thread').selectOption('modelled');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'thread', null, { timeout: 30000 }); await idle();
    await page.locator('.outliner .ol', { hasText: 'Bolt M8×30' }).last().click();
    await page.waitForFunction(() => /modelled|M8×1\.25/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__studioDoc.nodes.at(-1).form), 'helical');
    await press('Escape');
    assert.ok(await page.evaluate(() => window.__studioSelectFace(`n${window.__studioDoc.nodes.length - 1}.head`)), 'the bolt head picked by name');
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('Escape'); await press('f'); await page.waitForTimeout(1000); await snap('fastener-modelled-thread');
  });

  await check('split a bar across a mitre plane (normal 1, 1, 0): two bodies, the history says the plane', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('40'); await field('Depth Y').fill('20'); await field('Height Z').fill('10'); await field('At X').fill('0'); await field('At Y').fill('0');
    await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    await press(' '); await page.locator('.palette input').fill('split'); await press('Enter'); await hudReady();
    await field('Normal').selectOption('n'); await hudReady();
    assert.equal(await field('At').inputValue(), '30', 'x + y through the middle');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
    await snap('split-mitre-preview'); await press('Enter');
    await page.waitForFunction(() => /Split X\+Y = 30/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await snap('split-mitre');
  });

  await check('a mesh past the explode limit splits on its own triangles (F1): previewed, applied, two capped bodies', async () => {
    const { encodeBinaryStl } = await import('../../../packages/barocss-cad/dist/index.js');
    // A torus of 30,000 triangles (the planar path took 16,000 at most).
    const n = 150, m = 100, P = [], I = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m; P.push((20 + 5 * Math.cos(v)) * Math.cos(u), (20 + 5 * Math.cos(v)) * Math.sin(u), 5 * Math.sin(v)); }
    const at = (i, j) => (i % n) * m + (j % m);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) I.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
    await page.setInputFiles('input[aria-label="Model file"]', { name: 'ring.stl', mimeType: 'model/stl', buffer: Buffer.from(encodeBinaryStl(P, I, 'ring')) });
    await page.waitForSelector('[aria-label="Mesh units"]');
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
    assert.match(await page.evaluate(() => document.body.innerText), /Splits, sections, holes and Booleans with modelled bodies work at any size/);
    await idle();
    await page.locator('.outliner .ol').first().click();
    await press(' '); await page.locator('.palette input').fill('split'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
    await snap('split-mesh');
  });

  await check('double-click an edge of a rounded plate picks its tangent rim; Fillet takes them all', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    for (const [i, e] of ['n1.side0|n1.side1', 'n1.side1|n1.side2', 'n1.side2|n1.side3', 'n1.side0|n1.side3'].entries()) assert.ok(await page.evaluate(([n, add]) => window.__studioPickEdge(n, add), [e, i > 0]));
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 20000 }); await idle();
    const ok = await page.evaluate(() => window.__studioChainTop?.());
    assert.equal(ok, 8, 'four lines and four arcs');
  });

  await check('a cylinder clicked onto a box’s side face stands out of it', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('At X').fill('0'); await field('At Y').fill('0'); await hudReady(); await page.waitForTimeout(250); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(400);
    // The box's +X face (x = 32): its middle, on screen.
    const [sx, sy] = await page.evaluate(() => window.__studioScreenOf([32, 16, 8]));
    await page.click('.shapes [aria-label="Cylinder"]'); await hudReady();
    await page.mouse.move(sx - 6, sy, { steps: 3 }); await page.mouse.move(sx, sy); await page.waitForTimeout(300); await page.mouse.click(sx, sy);
    await page.waitForFunction(() => /placed/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 5000 });
    await hudReady(); await page.waitForTimeout(250); await snap('side-cylinder'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'rotate' && window.__studioDoc.nodes.at(-1)?.made?.values.up === '+x', null, { timeout: 15000 });
  });

  await check('each body has its own material, and its mass follows', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    const mass = () => page.evaluate(() => Number((/Mass\s*([\d.]+)/.exec(document.querySelector('.props')?.textContent ?? '') ?? [])[1]));
    const before = await mass();
    const steel = await page.evaluate(() => [...document.querySelectorAll('select[aria-label="Material"] option')].find(o => /Steel/.test(o.textContent))?.value);
    await page.selectOption('select[aria-label="Material"]', steel);
    await page.waitForFunction(m => window.__studioDoc.bodies?.b1?.material && Number((/Mass\s*([\d.]+)/.exec(document.querySelector('.props')?.textContent ?? '') ?? [])[1]) > m * 2, before, { timeout: 5000 });
  });

  await check('the snap step cycles and the sketch grid follows it', async () => {
    await page.click('[aria-label="New part"]'); await page.click('[aria-label="Snap"]');
    await page.waitForFunction(() => /Snap 0.5 mm/.test(document.querySelector('[aria-label="Snap"]')?.textContent ?? ''));
    await press('s'); await press('r'); const [cx, cy] = await canvasCenter();
    await clickAt(cx - 67, cy - 31); await clickAt(cx + 53, cy + 29);
    await page.evaluate(() => document.activeElement?.blur()); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1, null, { timeout: 10000 });
    const s = (await doc()).nodes[0];
    assert.ok([...s.min, ...s.max].every(v => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9), JSON.stringify(s));
    // Back to 1 mm for the rest (0.1, 5, 10, off, 1).
    for (let k = 0; k < 5; k++) await page.click('[aria-label="Snap"]');
    await page.waitForFunction(() => /Snap 1 mm/.test(document.querySelector('[aria-label="Snap"]')?.textContent ?? ''));
  });

  await check('the browser lists a body’s features under it; a click opens one in the editor', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await page.waitForTimeout(250); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    await page.click('.outliner [aria-label="Show its features"]');
    await page.waitForFunction(() => document.querySelectorAll('.outliner .ol-step').length === 2, null, { timeout: 5000 });
    await page.locator('.outliner .ol-step', { hasText: 'Hole' }).click();
    await page.waitForFunction(() => /EDIT FEATURE/.test(document.querySelector('.props')?.textContent ?? '') && /Diameter/.test(document.querySelector('.node-editor')?.textContent ?? ''), null, { timeout: 5000 });
  });

  await check('hole types: a countersunk hole and a tapped M6 on a box top', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Type').selectOption('countersink'); await field('Centre X').fill('9'); await hudReady(); await page.waitForTimeout(300);
    await snap('hole-countersink'); await press('Shift+Enter');
    // One history step, a hole of its own with the countersink (the kernel cuts the cone).
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 3 && window.__studioDoc.nodes.at(-1)?.kind === 'hole' && window.__studioDoc.nodes.at(-1)?.countersink > 0, null, { timeout: 15000 });
    await page.waitForFunction(() => /Countersunk Ø/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.waitForFunction(() => /Hole/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 10000 });
    await field('Type').selectOption('tapped'); await field('Centre X').fill('23'); await hudReady(); await page.waitForTimeout(300);
    // (A bolt circle of the tapped holes: four round the top's middle.)
    await field('Copies').selectOption('circle'); await field('Count').fill('4'); await hudReady(); await page.waitForTimeout(300); await snap('hole-bolt-circle');
    assert.equal(await field('Diameter').inputValue(), '5');
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.thread === 'M6×1' && window.__studioDoc.nodes.at(-1)?.pattern?.count === 4, null, { timeout: 15000 }); await idle();
    await snap('hole-types');
  });

  await check('a cross hole whose side touches a vertical hole’s wall from inside goes in', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    // Ø6 down through the top at (13, 16): its wall reaches x = 10.
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Diameter').fill('6'); await field('Centre X').fill('13'); await field('Centre Y').fill('16'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 3, null, { timeout: 15000 }); await idle();
    // Ø4 across from the front at x = 12, z = 8: its side at x = 10 touches that wall at (10, 16, 8).
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.side0')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? '') && /0, -1, 0/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Diameter').fill('4'); await field('Centre X').fill('12'); await field('Centre Z').fill('8'); await hudReady();
    await page.waitForFunction(() => /preview/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 4 && window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    // 32 × 32 × 16 less Ø6 × 16 and Ø4 × 32 plus their overlap (integrated): 15594.74 mm³.
    await page.locator('.outliner .ol', { hasText: 'Box' }).first().click();
    await page.waitForFunction(() => /Volume\s*1559[45]/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 15000 });
    await snap('tangent-holes');
  });

  await check('mass: a box body shows its inertia (about its centre or the origin) and its bounding box; the part sums up', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await press('Escape'); await page.waitForTimeout(200);
    assert.match(await page.locator('.props').innerText(), /PART · 1 body[\s\S]*Mass/);
    await page.locator('.outliner .ol', { hasText: 'Box' }).first().click();
    await page.waitForSelector('[aria-label="Moments of inertia"]', { timeout: 5000 });
    const centre = await page.locator('[aria-label="Moments of inertia"]').innerText();
    await page.selectOption('[aria-label="Inertia about"]', 'origin');
    assert.notEqual(await page.locator('[aria-label="Moments of inertia"]').innerText(), centre);
    await page.locator('[aria-label="Show the bounding box"]').first().check();
    await page.waitForSelector('.vp-overlay .bbox-line', { state: 'attached', timeout: 5000 }); await snap('mass-box');
  });

  await check('selection filter: Edges skips faces, Bodies picks the whole body, Pick all is back', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle(); await press('Escape');
    const [fx, fy] = await page.evaluate(() => window.__studioScreenOf([16, 16, 16]));
    const filter = page.locator('[aria-label="Selection filter"]'), props = () => page.locator('.props').innerText();
    await filter.click(); await filter.click(); assert.match(await filter.innerText(), /Edges/);
    await page.mouse.click(fx, fy); await page.waitForTimeout(300);
    assert.doesNotMatch(await props(), /SELECTION · FACE/, 'a face is not picked with Edges');
    await filter.click(); assert.match(await filter.innerText(), /Bodies/);
    // (A body made by a shape command opens for editing when picked whole.)
    await page.mouse.click(fx, fy); await page.waitForFunction(() => /Edit Box/.test(document.querySelector('.hud')?.textContent ?? '') || /BODY/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('Escape'); await page.waitForTimeout(200);
    await filter.click(); assert.match(await filter.innerText(), /Pick all/);
    await page.mouse.click(fx, fy); await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
  });

  await check('parameters: a chamfer bound to C follows it; a configuration saves and applies values', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioPickEdge('n1.side0|n1.top')));
    await press(' '); await page.locator('.palette input').fill('chamfer'); await press('Enter'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'chamfer', null, { timeout: 15000 }); await idle(); await press('Escape');
    await page.click('[aria-label="Parameters"]');
    await page.fill('[aria-label="New parameter name"]', 'C'); await page.fill('[aria-label="New parameter value"]', '3'); await page.click('[aria-label="Add parameter"]');
    await page.waitForFunction(() => window.__studioDoc.parameters.C === 3, null, { timeout: 5000 });
    await page.click('[aria-label="Close parameters"]');
    // (The features list may be open already from before.)
    if (await page.locator('.outliner [aria-label="Show its features"]').count()) await page.click('.outliner [aria-label="Show its features"]');
    await page.locator('.outliner .ol-step', { hasText: 'Chamfer' }).click();
    await page.waitForSelector('[aria-label="Distance parameter"]', { timeout: 5000 });
    await page.selectOption('[aria-label="Distance parameter"]', 'C');
    await page.locator('.node-editor button', { hasText: 'Apply' }).click();
    await page.waitForFunction(() => JSON.stringify(window.__studioDoc.nodes.at(-1)?.distance) === '{"parameter":"C"}', null, { timeout: 10000 }); await idle();
    await page.click('[aria-label="Parameters"]');
    await page.fill('[aria-label="Configuration name"]', 'small'); await page.click('[aria-label="Save configuration"]');
    await page.fill('[aria-label="Value of C"]', '6'); await press('Tab');
    await page.waitForFunction(() => window.__studioDoc.parameters.C === 6, null, { timeout: 5000 }); await idle();
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'chamfer', null, { timeout: 5000 });
    await page.click('[aria-label="Apply small"]');
    await page.waitForFunction(() => window.__studioDoc.parameters.C === 3, null, { timeout: 5000 });
    assert.match(await page.locator('aside[aria-label="Parameters panel"]').innerText(), /small · now/);
    await snap('parameters'); await page.click('[aria-label="Close parameters"]');
  });

  await check('a cut right through a box leaves two pieces; Separate makes them two bodies', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('s'); await page.waitForTimeout(300);
    const [cx, cy] = await canvasCenter(); await press('r'); await clickAt(cx - 300, cy - 8); await clickAt(cx + 300, cy + 8);
    await press('Enter'); await press('e'); await hudReady();
    await field('Operation').selectOption('cut'); await field('Depth').selectOption('through');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'difference', null, { timeout: 15000 }); await idle();
    await page.locator('.outliner .ol', { hasText: 'Box' }).first().click();
    await page.waitForSelector('[aria-label="Separate the pieces"]', { timeout: 5000 });
    await page.click('[aria-label="Separate the pieces"]');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    assert.equal((await doc()).nodes.at(-1).kind, 'separate');
  });

  await check('templates: a part from the plate template, kept as a template, started again from it; an older file opens with a note', async () => {
    await page.click('[aria-label="New from a template"]'); await page.click('[aria-label="New from Plate with a hole"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    await page.click('[aria-label="New from a template"]'); await page.fill('[aria-label="Template name"]', 'My plate'); await page.click('[aria-label="Save as a template"]');
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 5000 });
    await page.click('[aria-label="New from a template"]'); await page.click('[aria-label="New from My plate"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 3, null, { timeout: 15000 });
    await page.click('[aria-label="New from a template"]'); await page.click('[aria-label="Remove template My plate"]');
    // A file saved before schemas: opened, with what was filled in.
    const old = join(out, 'old-model.bcad'); (await import('node:fs')).writeFileSync(old, JSON.stringify({ format: 'barocss-cad-model', nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10] }, { kind: 'extrude', sketch: 0, height: 5 }], outputs: {} }));
    await page.setInputFiles('input[aria-label="Model file"]', old);
    await page.waitForFunction(() => /Opened an older model/.test(document.body.innerText), null, { timeout: 10000 });
    // (Read as the current schema, its features given stable ids n0, n1 — their names as they were, A1.)
    const opened = await doc(); assert.equal(opened.schema, 3); assert.deepEqual(opened.nodes.map(n => n.id), ['n0', 'n1']);
    await page.click('[aria-label="Dismiss"]');
  });

  await check('references: a file whose fillet edge a kernel would name otherwise opens with it matched again, shown, confirmed; one gone is held and the rest builds', async () => {
    const fs = await import('node:fs');
    const box = [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 6 }];
    const file = (fillet) => JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 3, outputs: {}, nodes: [...box, { id: 'n2', kind: 'fillet', parent: { node: 1, side: 'solid' }, radius: 2, ...fillet }] });
    // The corner at (10, 10) stored under the name of the one at (10, 0), as a renumbering kernel would read it.
    const moved = join(out, 'renumbered.bcad');
    fs.writeFileSync(moved, file({ edges: ['n1.side0|n1.side1'], sigs: { 'n1.side0|n1.side1': { k: 'line', p: [10, 10, 3], d: [0, 0, 1], s: 6 } } }));
    await page.setInputFiles('input[aria-label="Model file"]', moved);
    await page.waitForSelector('[aria-label="References"]', { timeout: 15000 });
    assert.match(await page.textContent('[aria-label="References"]'), /1 matched again/);
    let d = await doc(); assert.equal(Object.keys(d.nodes[2].rematched ?? {}).length, 1);
    assert.ok(await page.locator('.history .hs.rematched').count() >= 1, 'the step is marked');
    await page.click('[aria-label="References"] button:has-text("Confirm")');
    await page.waitForFunction(() => !window.__studioDoc.nodes[2].rematched, null, { timeout: 15000 });
    assert.equal(await page.locator('[aria-label="References"]').count(), 0, 'nothing left to settle');
    // Gone: nothing alike left (a curved edge on a box): the file opens, the fillet held, the box built.
    const gone = join(out, 'gone.bcad');
    fs.writeFileSync(gone, file({ edges: ['n1.side1|n1.side2'], sigs: { 'n1.side1|n1.side2': { k: 'curve', p: [10, 10, 3], s: 6 } } }));
    await page.setInputFiles('input[aria-label="Model file"]', gone);
    await page.waitForSelector('[aria-label="References"]', { timeout: 15000 });
    assert.match(await page.textContent('[aria-label="References"]'), /1 needs a choice/);
    d = await doc(); assert.deepEqual([d.nodes[2].suppressed, d.nodes[2].held], [true, '"n1.side1|n1.side2" is gone']);
    await page.waitForFunction(() => /1 solid/.test(document.body.innerText), null, { timeout: 15000 });
  });

  await check('requirements: the panel checks the brief, an assumption confirmed by the user is stated, a person\'s edit breaking a hard one is kept and said', async () => {
    const fs = await import('node:fs');
    const nodes = [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 5 },
      { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [30, 10] }, { id: 'n3', kind: 'extrude', sketch: 2, height: 5 }];
    const requirements = [
      { id: 'W', source: 'at least 25 wide', hard: true, basis: 'stated', check: { op: '>=', query: { fn: 'bbox', axis: 'x' }, value: 25, unit: 'mm' } },
      { id: 'H', source: 'about 4 tall', hard: true, basis: 'assumed', check: { op: '==', query: { fn: 'bbox', axis: 'z' }, value: 4, tol: 0.01, unit: 'mm' } },
    ];
    const file = join(out, 'brief.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 4, outputs: {}, nodes, requirements }));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForSelector('[aria-label="Requirement H"]', { timeout: 15000 });
    await page.waitForFunction(() => /1 ✓ · 1 ✗ · 0 \?/.test(document.querySelector('.req-head')?.textContent ?? ''), null, { timeout: 15000 });
    assert.match(await page.textContent('[aria-label="Requirement H"]'), /assumed/);
    // The user sets the assumption to what the part has, and confirms it.
    await page.fill('[aria-label="H value"]', '5');
    await page.click('[aria-label="Confirm H"]');
    await page.waitForFunction(() => window.__studioDoc.requirements?.[1]?.basis === 'stated' && window.__studioDoc.requirements[1].confirmed?.by === 'user', null, { timeout: 15000 });
    await page.waitForFunction(() => /2 ✓ · 0 ✗/.test(document.querySelector('.req-head')?.textContent ?? ''), null, { timeout: 15000 });
    // The second box moved 10 left: the part is 20 wide, W fails; the move is kept, and said.
    const before = (await doc()).nodes.length;
    await page.locator('.outliner .ol-row button.ol').nth(1).click();
    await page.keyboard.press('Shift+ArrowLeft');
    await page.waitForFunction(() => /W now fails/.test(document.body.innerText), null, { timeout: 15000 });
    assert.equal((await doc()).nodes.length, before + 1, 'the move is kept');
  });

  await check('proposals: a stale one rebased and previewed (ghost, before/after, volume change) before it can be accepted; one accepted in part; one rejected (kept); the history saved with the part, stripped from a shared copy', async () => {
    const fs = await import('node:fs');
    const nodes = [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 8 }];
    const risk = { level: 'low', features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] };
    const hole = (d, x = 10, y = 10) => ({ tool: 'run_command', args: { command: 'hole', faces: ['n1.top'], values: { d, x, y } } });
    const box = { tool: 'add_features', args: { features: [{ kind: 'sketch', profile: 'rectangle', min: [50, 0], max: [60, 10] }, { kind: 'extrude', sketch: 4, height: 5 }] } };
    const sse = events => events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
    // (Made on another part, base '0': stale from the start.)
    const proposals = [
      { id: 'P1', title: 'A Ø6 hole', status: 'open', by: { agent: 'chat', model: 'test' }, at: '2026-10-18T00:00:00Z', plan: 'Lighter by a through hole.', base: '0', ops: [hole(6)], risk, summary: '1 added' },
      { id: 'P2', title: 'A Ø12 hole', status: 'open', by: { agent: 'chat' }, at: '2026-10-18T00:00:00Z', prompt: 'private words', base: '0', ops: [hole(12, 30)], risk: { ...risk, level: 'high', approval: ['drawing'] }, summary: '1 added' },
      { id: 'P3', title: 'A Ø4 hole and a block', status: 'open', by: { agent: 'chat' }, at: '2026-10-18T00:00:00Z', base: '0', ops: [hole(4, 30), box], risk, summary: '3 added' },
    ];
    const history = [{ id: 'h1', at: '2026-10-18T00:00:00Z', kind: 'prompt', by: { agent: 'chat', model: 'test' }, prompt: 'make it lighter' }];
    const file = join(out, 'proposals.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes, proposals, history }));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForSelector('[aria-label="Proposal P1"]', { timeout: 15000 }); await idle();
    assert.match(await page.textContent('.history-note'), /Saved with the part/);
    // Stale: no blind accept, rebase and preview first. The ghost: the part with the hole, 226 mm³ (3.53 %) off.
    assert.match(await page.textContent('[aria-label="Proposal P1"]'), /stale/);
    assert.equal(await page.locator('[aria-label="Proposal P1"] button', { hasText: /^Accept/ }).count(), 0);
    await page.locator('[aria-label="Proposal P1"] button', { hasText: 'Rebase & preview' }).click();
    await page.waitForSelector('[aria-label="Proposal P1"] [aria-label="Volume change"]', { timeout: 15000 });
    assert.match(await page.textContent('[aria-label="Proposal P1"] [aria-label="Volume change"]'), /^−226(\.\d+)? mm³ \(−3\.53%\)$/);
    assert.match(await page.textContent('[aria-label="Proposal P1"]'), /rebased/);
    await snap('proposal-ghost');
    await page.click('[aria-label="Proposal P1"] [aria-label="Before or after"]');
    assert.equal(await page.textContent('[aria-label="Proposal P1"] [aria-label="Before or after"]'), 'Before');
    // Accepted: the hole made, the proposal kept as accepted, the rebase and the decision in the history.
    await page.locator('[aria-label="Proposal P1"] button', { hasText: /^Accept/ }).click();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 3 && window.__studioDoc.proposals[0].status === 'accepted', null, { timeout: 15000 });
    assert.deepEqual((await doc()).history.map(h => h.kind), ['prompt', 'rebase', 'accept']);
    // One that always needs the user says so. Rejected: kept, nothing built.
    assert.match(await page.textContent('[aria-label="Proposal P2"]'), /needs you \(drawing\)/);
    await page.locator('[aria-label="Proposal P2"] button', { hasText: 'Reject' }).click();
    await page.waitForFunction(() => window.__studioDoc.proposals[1].status === 'rejected', null, { timeout: 5000 });
    assert.equal((await doc()).nodes.length, 3);
    // In part: P3 rebased, its block unticked (the ghost rebuilt), the hole accepted alone.
    await page.locator('[aria-label="Proposal P3"] button', { hasText: 'Rebase & preview' }).click();
    await page.waitForSelector('[aria-label="P3 features"]', { timeout: 15000 });
    const boxId = await page.evaluate(() => [...document.querySelectorAll('[aria-label="P3 features"] .proposal-part')].find(l => /Extrude/.test(l.textContent))?.querySelector('.mono')?.textContent);
    assert.ok(boxId, 'the block is one of the parts');
    await page.click(`[aria-label="Keep ${boxId}"]`);
    await page.waitForFunction(() => /Accept 1 of 2/.test(document.querySelector('[aria-label="Proposal P3"]')?.textContent ?? ''), null, { timeout: 15000 });
    await snap('proposal-partial');
    await page.locator('[aria-label="Proposal P3"] button', { hasText: /^Accept/ }).click();
    await page.waitForFunction(() => window.__studioDoc.proposals[2].status === 'accepted', null, { timeout: 15000 });
    const after = await doc();
    assert.deepEqual([after.nodes.filter(n => n.kind === 'hole').length, after.nodes.filter(n => n.kind === 'extrude').length, after.proposals[2].decided.left_out], [2, 1, [boxId]]);
    await page.click('[aria-label="Show decided proposals"]'); await page.click('[aria-label="Show design history"]');
    assert.equal(await page.locator('.hist').count(), 6);
    // A copy to share: no history, no prompts or plans.
    const [shared] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('.history-note .link')]);
    const text = fs.readFileSync(await shared.path(), 'utf8');
    assert.match(shared.suggestedFilename(), /-shared\.bcad$/);
    assert.ok(!/"history"|private words|Lighter by/.test(text) && /"proposals"/.test(text));
    // The chat: the autonomy level and the selection offered as context chips, sent with the message.
    const statusUrl = u => u.pathname === '/api/chat/status', turnUrl = u => u.pathname === '/api/chat/turn', sent = [];
    await page.route(statusUrl, r => r.fulfill({ json: { enabled: true, model: 'mock-model', via: 'mock' } }));
    await page.route(turnUrl, r => { sent.push(r.request().postDataJSON()); return r.fulfill({ status: 200, contentType: 'text/event-stream', body: sse([{ type: 'text', delta: 'Noted.' }, { type: 'done', end: 'done' }]) }); });
    await page.click('[aria-label="Chat"]');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled);
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForSelector('.chat-chip', { timeout: 5000 });
    assert.match(await page.textContent('.chat-chips'), /n1\.top/);
    await snap('chat-chips');
    await page.selectOption('[aria-label="Autonomy"]', '1');
    await page.fill('[aria-label="Chat message"]', 'round this face'); await page.locator('[aria-label="Chat message"]').press('Enter');
    await page.waitForSelector('.chat-msg.assistant:has-text("Noted.")', { timeout: 10000 });
    assert.equal(sent[0].autonomy, 1);
    assert.match(sent[0].text, /round this face\n\n\[Selected in the viewport: face n1\.top\]/);
    await page.selectOption('[aria-label="Autonomy"]', '2');
    await page.unroute(statusUrl); await page.unroute(turnUrl); await page.click('[aria-label="Chat"]');
    // A new part starts clean: nothing of this one (history, proposals, looks) carried into it.
    await page.click('[aria-label="New part"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 5000 });
    const fresh = await doc();
    assert.deepEqual([fresh.history, fresh.proposals, fresh.bodies, fresh.requirements], [undefined, undefined, undefined, undefined]);
  });

  await check('autonomy L2 (the owner\'s option b) through the real chat server and tool server: the first build of an empty part applies (one Undo takes it back); a value edit applies with an undo toast; a two-feature change is refused, then proposed', async () => {
    // A scripted stand-in for the claude CLI makes the calls; the gate is the tool server's own (D41).
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', c => failed(new Error(`the chat server exited (${c})`))); });
      await page.click('[aria-label="New part"]'); await idle();
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      assert.equal(await page.inputValue('[aria-label="Autonomy"]'), '2');
      const send = async calls => {
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      };
      // The owner's exception: on an empty part the first turn builds directly (a box and a hole); one Undo takes the
      // whole build back.
      const firstBox = { tool: 'run_command', args: { command: 'box', values: { w: 32, d: 32, h: 16, x: 0, y: 0, z: 0 } } };
      await send([firstBox, { tool: 'run_command', args: { command: 'hole', faces: ['n1.top'], values: { d: 4, x: 8, y: 8 } } }]);
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 3, null, { timeout: 20000 });
      await page.waitForSelector('.toast:has-text("Applied by the agent")', { timeout: 10000 });
      await page.click('.toast button:text-is("Undo")');
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 10000 });
      await send([firstBox]);
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
      // A value of one feature: applied directly, said so with an undo.
      const h0 = (await doc()).nodes[1].height;
      await send([{ tool: 'edit_feature', args: { index: 1, values: { h: h0 + 4 } } }]);
      await page.waitForFunction(h => window.__studioDoc.nodes[1]?.height === h, h0 + 4, { timeout: 20000 }).catch(async e => { throw new Error(`${e.message.split('\n')[0]}: ${JSON.stringify((await doc()).nodes)} ${await page.locator('.chat-panel, .chat').first().innerText().catch(() => '')}`); });
      await page.waitForSelector('.toast:has-text("Applied by the agent")', { timeout: 10000 });
      await snap('l2-applied');
      await page.click('.toast button:text-is("Undo")');
      await page.waitForFunction(h => window.__studioDoc.nodes[1]?.height === h, h0, { timeout: 10000 });
      // Two features in one change: refused (needs_proposal), the part unchanged; proposed, it waits for the user.
      const hole = { tool: 'run_command', args: { command: 'hole', faces: ['n1.top'], values: { d: 6, x: 10, y: 10 } } }, taller = { tool: 'edit_feature', args: { index: 1, values: { h: h0 + 4 } } };
      await send([{ tool: 'apply_ops', args: { ops: [taller, hole] } }, { tool: 'propose', args: { title: 'Taller, with a hole', ops: [taller, hole] } }]);
      assert.match(await page.locator('.chat-tool').nth(-2).innerText(), /L2|propos/i);
      await page.waitForSelector('[aria-label="Proposal P1"]', { timeout: 15000 });
      assert.deepEqual((await doc()).nodes.map(n => n.kind), ['sketch', 'extrude']);
      await snap('l2-proposed');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  await check('F2: a hole through a 30k-triangle mesh, its wall exact — opened from a part file, the mesh near the hole alone through the exact Boolean', async () => {
    const fs = await import('node:fs');
    const n = 150, m = 100, P = [], I = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m; P.push((20 + 5 * Math.cos(v)) * Math.cos(u), (20 + 5 * Math.cos(v)) * Math.sin(u), 5 * Math.sin(v)); }
    const at = (i, j) => (i % n) * m + (j % m);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) I.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
    const part = join(out, 'ring-hole.bcad');
    fs.writeFileSync(part, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {},
      nodes: [{ id: 'n0', kind: 'mesh', name: 'ring', unit: 'mm', positions: P, indices: I, representation: 'facets' }, { id: 'n1', kind: 'hole', parent: { node: 0, side: 'solid' }, center: [20, 0.37], radius: 2 }] }));
    // While the ring evaluates, the panel must never show the box before it under the ring's name (it once showed
    // 16,384 mm³, a 32 × 32 × 16 box, as "Mesh ring", its row clicked while the ring evaluated). Watched on every DOM change.
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => /Volume/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 15000 });
    await page.evaluate(() => {
      const seen = window.__staleWatch = { evaluating: 0, bad: [] };
      const look = () => {
        const props = document.querySelector('.props'), name = props?.querySelector('input[aria-label="Name"]')?.value ?? '', text = props?.textContent ?? '';
        const vol = Number(/Volume\s*([\d,]+) mm³/.exec(text)?.[1]?.replace(/,/g, '') ?? NaN);
        if (/evaluating…/.test(document.querySelector('.outliner .card-title')?.textContent ?? '')) seen.evaluating++;
        if (/Mesh ring/.test(name) && Number.isFinite(vol) && !(vol < 9870 && vol > 9600)) seen.bad.push(`props: ${name} with ${vol} mm³`);
        for (const row of document.querySelectorAll('.outliner .ol-row.stale')) if (/Mesh ring/.test(row.textContent ?? '')) seen.bad.push('a stale row named Mesh ring');
      };
      window.__staleObs = new MutationObserver(look); window.__staleObs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    });
    await page.setInputFiles('input[aria-label="Model file"]', part);
    // (The document is the ring now; its body may not be: the first row clicked at once, as a person might.)
    await page.waitForFunction(() => window.__studioDoc.nodes[1]?.kind === 'hole', null, { timeout: 60000 });
    await page.locator('.outliner .ol').first().click({ timeout: 5000 }).catch(() => { /* no row yet */ });
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    const watch = await page.evaluate(() => { window.__staleObs.disconnect(); return window.__staleWatch; });
    assert.deepEqual(watch.bad, []); assert.ok(watch.evaluating > 0, 'the evaluating state was seen while the ring evaluated');
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => /Mesh ring/.test(document.querySelector('.props input')?.value ?? '') && /Volume/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 15000 });
    const vol = Number(/Volume\s*([\d,]+) mm³/.exec(await page.textContent('.props'))?.[1].replace(/,/g, ''));
    const ring = 2 * Math.PI * Math.PI * 20 * 25;
    assert.ok(vol < ring && vol > ring - 2 * Math.PI * 4 * 10, `${vol}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('mesh-hole');
  });

  await check('Spur gear (R6a, issue #2167): from the palette — m 2, 20 teeth; its notes give the dimensions, the flank fit and the schematic root\'s warning', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('spur gear'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'gear' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    assert.match(await page.textContent('.history'), /Spur gear m2 z20/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /Reference Ø40, tip Ø44, root Ø35/.test(t)) && notes.some(t => /Schematic root/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Top")'); await press('f'); await page.waitForTimeout(500);
    await snap('spur-gear');
    // A gear meshing with it (R6a.4b): the gear selected, the command beside it; its notes give the pair's verdict.
    await press(' '); await page.locator('.palette input').fill('meshing gear'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[1]?.kind === 'gear' && window.__studioDoc.nodes[1].mesh?.gear === 0 && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    assert.match(await page.textContent('.history'), /Spur gear m2 z40/);
    await page.locator('.outliner .ol').nth(1).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /Meshes with n0/.test(n.textContent ?? '')), null, { timeout: 15000 });
    const pair = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(pair.some(t => /centre distance 60 mm, ratio −20:40/.test(t)) && pair.some(t => /Clear over a full tooth period \(checked in \d+ ms\)/.test(t)), pair.join(' | '));
    await press('f'); await page.waitForTimeout(500);
    await snap('spur-gear-pair');
    // A rack under the first gear (R6a.5b): meshing, its verdict in the notes.
    await page.locator('.outliner .ol').first().click();
    await press(' '); await page.locator('.palette input').fill('gear rack'); await press('Enter'); await hudReady();
    // (On the far side from the other gear: its pitch line left of the axis.)
    await field('Direction').fill('180'); await field('Teeth').fill('10'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[2]?.kind === 'rack' && window.__studioDoc.nodes[2].mesh?.gear === 0 && /3 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await page.locator('.outliner .ol').nth(2).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /Meshes with n0: pitch line 20 mm/.test(n.textContent ?? '')), null, { timeout: 15000 });
    const rackNotes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(rackNotes.some(t => /Clear over a full tooth period/.test(t)), rackNotes.join(' | '));
    await press('f'); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.__studioDoc.nodes[2].mesh.direction), 180);
    await snap('spur-gear-rack');
  });

  await check('Helical gear (R6a.5c): β 20° from the Spur gear command, then a meshing gear of the opposite hand; the twist and the pair in the notes', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('spur gear'); await press('Enter'); await hudReady();
    await field('Helix angle β').fill('20'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'gear' && window.__studioDoc.nodes[0].helixAngle === 20 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    await press(' '); await page.locator('.palette input').fill('meshing gear'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    await page.locator('.outliner .ol').nth(1).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /Meshes with n0/.test(n.textContent ?? '')), null, { timeout: 20000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /Helical β 20° left hand/.test(t)) && notes.some(t => /\+ overlap/.test(t)) && notes.some(t => /Clear over a full tooth period/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('helical-pair');
  });

  await check('Library (LIB4): the T-slot 20 series with its licence and estimates; a 20×20 profile inserted into the part, its notes from the library; a slot nut placed as a part', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]');
    await page.waitForSelector('[aria-label="Library tslot-20"]', { timeout: 10000 });
    assert.match(await page.textContent('[aria-label="Licence of tslot-20"]'), /CC0-1\.0.*· \d+ estimates/);
    await page.selectOption('[aria-label="Process"]', 'fdm');
    await page.waitForFunction(() => window.__studioDoc.process === 'fdm', null, { timeout: 5000 });
    await page.click('[aria-label="Library tslot-20"] [aria-label="Insert profile"]');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'library' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    assert.match(await page.textContent('.history'), /T-slot profile 20 20×20/);
    await page.click('[aria-label="Library tslot-20"] [aria-label="Place slot-nut-m5"]');
    await page.waitForFunction(() => window.__studioDoc.instances?.length === 1 && window.__studioDoc.instances[0].doc.nodes[0]?.kind === 'library', null, { timeout: 30000 }); await idle();
    await page.click('[aria-label="Close library"]');
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /From tslot-20 0\.1\.0: profile \(2020\)/.test(n.textContent ?? '')), null, { timeout: 15000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /is an estimate/.test(t)) && notes.some(t => /not for structural calculation/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('library-tslot');
    // AM2: with FDM chosen, the analysis button's third look is the overhang map.
    for (let k = 0; k < 3; k++) await page.click('[aria-label="Surface analysis"]');
    assert.equal(await page.textContent('[aria-label="Surface analysis"]'), 'Overhang');
    await page.waitForTimeout(400); await snap('overhang-map');
    await page.click('[aria-label="Surface analysis"]');
  });

  await check('SubD box (SD2): a box cage whose eight corners are extraordinary — one body of G1 caps and exact patches, inside its box', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('subd box'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'subd' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    assert.match(await page.textContent('.history'), /SubD box \(54 quads\)/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => /Volume/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 15000 });
    const props = await page.textContent('.props'), vol = Number(/Volume\s*([\d,]+) mm³/.exec(props)?.[1].replace(/,/g, ''));
    assert.ok(vol > 0.6 * 30 * 20 * 16 && vol < 30 * 20 * 16, String(vol));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('subd-box');
  });

  await check('R8.2 the agent\'s SubD cage tools through the real chat and tool servers: a SubD box built, a cage vertex moved (a value edit, applied), a face extruded (topology: refused at L2, proposed, accepted in the studio)', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', c => failed(new Error(`the chat server exited (${c})`))); });
      await page.click('[aria-label="New part"]'); await idle();
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const send = async calls => {
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      };
      await send([{ tool: 'run_command', args: { command: 'subd-box', values: { w: 30, d: 20, h: 16, n: 2, x: 0, y: 0, z: 0 } } }, { tool: 'subd_cage', args: { index: 0 } }]);
      await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'subd' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
      const before = (await doc()).nodes[0].cage;
      // A move of the cage: the feature's values — applied, with an undo.
      await send([{ tool: 'subd_move', args: { index: 0, vertices: [0], delta: [0, 0, 2] } }]);
      await page.waitForFunction(z => window.__studioDoc.nodes[0].cage.positions[2] === z, before.positions[2] + 2, { timeout: 20000 });
      await page.waitForSelector('.toast:has-text("Applied by the agent")', { timeout: 10000 });
      assert.deepEqual((await doc()).nodes[0].cage.faces, before.faces);
      // An extrusion changes the cage's topology: at L2 refused, then proposed; accepted, the cage has four faces more.
      const extrude = { tool: 'subd_extrude', args: { index: 0, faces: [0], distance: 3 } };
      await send([extrude, { tool: 'propose', args: { title: 'A bump', ops: [extrude] } }]);
      assert.match(await page.locator('.chat-tool').nth(-2).innerText(), /L2|propos/i);
      await page.waitForSelector('[aria-label="Proposal P1"]', { timeout: 15000 });
      assert.equal((await doc()).nodes[0].cage.faces.length, 24);
      await page.locator('[aria-label="Proposal P1"] button', { hasText: /^Accept/ }).click();
      await page.waitForFunction(() => window.__studioDoc.nodes[0].cage.faces.length === 28 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
      await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
      await snap('subd-agent-bump');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- R8.3 (D84): the cage editor by hand, end to end; the owner's pipe clamp by the agent and by hand ----------
  const cageNow = () => page.evaluate(() => window.__studioCage());
  // (The view framed by its button: F is Fill while a cage is edited.)
  const frameAll = () => page.click('.views button[title="Frame all (F)"]');
  const centreOf = (c, vs) => [0, 1, 2].map(a => vs.reduce((s, v) => s + c.positions[3 * v + a], 0) / vs.length);
  /** A click where a model point is drawn (Shift held: added to the pick). */
  const clickModel = async (p, shift = false, dbl = false) => {
    const q = await page.evaluate(p => window.__studioScreenOf(p), p);
    if (shift) await page.keyboard.down('Shift');
    if (dbl) await page.mouse.dblclick(q[0], q[1]); else await page.mouse.click(q[0], q[1]);
    if (shift) await page.keyboard.up('Shift');
  };
  /**
   * A click on cage face k halfway from its middle to its lower-left corner on the screen (Shift: added): clear of the
   * gizmo, whose arrows point up and right from the picked faces' middle.
   */
  const clickFace = async (c, k, shift = false) => {
    const q = await page.evaluate(([c, k]) => {
      const ps = c.faces[k].map(v => window.__studioScreenOf([c.positions[3 * v], c.positions[3 * v + 1], c.positions[3 * v + 2]]));
      const m = [0, 1].map(a => ps.reduce((t, p) => t + p[a], 0) / ps.length), ll = ps.reduce((b, p) => p[1] - p[0] > b[1] - b[0] ? p : b);
      return [(m[0] + ll[0]) / 2, (m[1] + ll[1]) / 2];
    }, [c, k]);
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.click(q[0], q[1]);
    if (shift) await page.keyboard.up('Shift');
  };
  /** The gizmo's arrow along `axis` dragged k times its length (Shift held as it starts: extrude first). */
  const dragArrow = async (axis, k, shift) => {
    await page.waitForSelector(`[data-gizmo=move${axis}]`, { timeout: 5000 });
    const svg = await page.locator('.vp-overlay').boundingBox();
    const end = n => page.evaluate(([sel, n]) => { const el = document.querySelector(sel), g = k => Number(el.getAttribute(k)); return [g('x1') + (g('x2') - g('x1')) * n, g('y1') + (g('y2') - g('y1')) * n]; }, [`[data-gizmo=move${axis}] line:nth-of-type(2)`, n]);
    const a0 = await end(0.5), a1 = await end(1);
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.move(svg.x + a0[0], svg.y + a0[1]); await page.mouse.down();
    await page.mouse.move(svg.x + a0[0] + (a1[0] - a0[0]) * k, svg.y + a0[1] + (a1[1] - a0[1]) * k, { steps: 8 }); await page.mouse.up();
    if (shift) await page.keyboard.up('Shift');
  };
  const editCage = async () => { await press(' '); await page.locator('.palette input').fill('edit cage'); await press('Enter'); await page.waitForSelector('[aria-label="Cage editor"]', { timeout: 10000 }); };

  await check('R8.3 the cage editor by hand: a SubD box\'s face extruded (Shift-drag), a loop (L) creased (C), mirrored across X and undone (⌘Z), Done; document undo and redo', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('subd box'); await press('Enter'); await hudReady();
    await page.locator('.hud .field', { has: page.locator('span:text-is("Quads along a side")') }).locator('input').fill('4'); await hudReady();
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.cage?.faces.length === 96 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    await page.click('.views button:text-is("Iso")'); await frameAll(); await page.waitForTimeout(400);
    await editCage();
    let c = (await cageNow()).cage;
    // (The box where the command put it: its middle in x and y.)
    const mid = [0, 1].map(k => { const xs = c.positions.filter((_, i) => i % 3 === k); return (Math.min(...xs) + Math.max(...xs)) / 2; });
    // Face mode: a top face (the one at +x, +y of the middle), extruded up by a Shift-drag of the Z arrow.
    await press('3');
    const top = c.faces.findIndex(f => { const p = centreOf(c, f); return Math.abs(p[2] - 16) < 1e-9 && Math.abs(p[0] - mid[0] - 3.75) < 1e-9 && Math.abs(p[1] - mid[1] - 2.5) < 1e-9; });
    assert.ok(top >= 0, 'the top face');
    await clickModel(centreOf(c, c.faces[top]));
    await page.waitForFunction(() => window.__studioCage().faces === 1, null, { timeout: 5000 });
    await dragArrow('Z', 1.5, true);
    await page.waitForFunction(() => window.__studioCage().cageFaces === 100 && window.__studioCage().undo === 1, null, { timeout: 10000 });
    c = (await cageNow()).cage;
    assert.ok(Math.max(...c.positions.filter((_, k) => k % 3 === 2)) > 17, 'the face went up');
    await page.waitForTimeout(800); await snap('cage-extrude');
    // Edge mode: a vertical edge of the front side; L puts a loop round the box across it, C creases the new loop.
    await press('2');
    const nv = c.positions.length / 3, P = v => [c.positions[3 * v], c.positions[3 * v + 1], c.positions[3 * v + 2]];
    let edge = null;
    for (const f of c.faces) for (let i = 0; i < 4 && !edge; i++) { const a = P(f[i]), b = P(f[(i + 1) % 4]); if (Math.abs(a[1] - mid[1] + 10) < 1e-9 && Math.abs(b[1] - mid[1] + 10) < 1e-9 && a[0] === b[0] && Math.abs(a[0] - mid[0] + 7.5) < 1e-9 && Math.min(a[2], b[2]) === 4) edge = [a, b]; }
    assert.ok(edge, 'the front edge');
    await clickModel(edge[0].map((x, k) => (x + edge[1][k]) / 2));
    await page.waitForFunction(() => window.__studioCage().edges === 1, null, { timeout: 5000 });
    await press('l');
    await page.waitForFunction(() => window.__studioCage().cageFaces === 116, null, { timeout: 10000 });
    assert.ok((await cageNow()).cage.positions.length / 3 > nv);
    await press('c');
    await page.waitForFunction(() => window.__studioCage().creases === 16, null, { timeout: 10000 });
    await page.waitForTimeout(800); await snap('cage-loop-crease');
    // Mirrored across X: the + side kept (the extruded face is on it), the body the half and its image.
    await page.selectOption('select[aria-label="Mirror"]', 'x');
    await page.waitForFunction(() => window.__studioCage().mirror === 'x' && window.__studioCage().cageFaces < 116, null, { timeout: 10000 });
    const half = await cageNow();
    assert.ok(half.cage.positions.filter((_, k) => k % 3 === 0).every(x => x >= -1e-9), 'the half on + x');
    await page.waitForTimeout(1200); await snap('cage-mirror');
    // ⌘Z in the session: the mirror undone (the whole cage again, the loop and crease kept).
    await press('Meta+z');
    await page.waitForFunction(() => window.__studioCage().mirror === null && window.__studioCage().cageFaces === 116 && window.__studioCage().creases === 16, null, { timeout: 5000 });
    assert.equal((await cageNow()).undo, 3);
    // Done: one node edit — the document's cage the session's; one ⌘Z of the document puts the box back, ⇧⌘Z again.
    await page.click('[aria-label="Done editing cage"]');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Cage editor"]') && window.__studioDoc.nodes[0].cage.faces.length === 116, null, { timeout: 10000 });
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    assert.equal((await doc()).nodes.length, 1);
    assert.equal((await doc()).nodes[0].cage.creases.length, 16);
    await press('Meta+z');
    await page.waitForFunction(() => window.__studioDoc.nodes[0].cage.faces.length === 96 && !window.__studioDoc.nodes[0].cage.creases, null, { timeout: 10000 });
    await press('Meta+Shift+z');
    await page.waitForFunction(() => window.__studioDoc.nodes[0].cage.faces.length === 116, null, { timeout: 10000 }); await idle();
    await page.waitForTimeout(600); await snap('cage-done');
  });

  // (The calls: test/fixtures/subd-pipe-clamp.calls.json; the cage they make: the kernel's conformance case r8-subd-pipe-clamp.)
  await check('D84 the pipe clamp by the agent through the real chat: its cage-tool calls proposed and accepted; one body, the conformance cage; STEP out and in, the same volume', async () => {
    const { spawn } = await import('node:child_process'), fs = await import('node:fs'), origin = new URL(url).origin;
    const { calls } = JSON.parse(fs.readFileSync(join(root, 'test/fixtures/subd-pipe-clamp.calls.json'), 'utf8'));
    const want = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/r8/subd-pipe-clamp.json'), 'utf8'));
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', c => failed(new Error(`the chat server exited (${c})`))); });
      await page.click('[aria-label="New part"]'); await idle();
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const send = async (calls, ms = 60000) => {
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: ms });
      };
      await send([{ tool: calls[0].tool, args: calls[0].args }]);
      await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'subd' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
      // The rest changes the cage's topology: at L2 one proposal of them all, accepted.
      const t0 = Date.now();
      await send([{ tool: 'propose', args: { title: 'Pipe clamp', ops: calls.slice(1).map(c => ({ tool: c.tool, args: c.args })) } }], 240000);
      await page.waitForSelector('[aria-label="Proposal P1"]', { timeout: 15000 });
      await page.locator('[aria-label="Proposal P1"] button', { hasText: /^Accept/ }).click();
      await page.waitForFunction(n => window.__studioDoc.nodes[0].cage.faces.length === n && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), want.input.partDocument.features[0].cage.faces.length, { timeout: 120000 }); await idle();
      console.log(`    (the clamp proposed and accepted through the chat in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      assert.deepEqual((await doc()).nodes[0].cage, want.input.partDocument.features[0].cage);
      await page.click('[aria-label="Close chat"]');
      await page.locator('.outliner .ol').first().click();
      await page.waitForFunction(() => /Volume/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 30000 });
      const props = await page.textContent('.props'), vol = Number(/Volume\s*([\d,.]+) mm³/.exec(props)?.[1].replace(/,/g, ''));
      assert.ok(Math.abs(vol / want.expect.outputs[0].volumeMM3.value - 1) < 1e-3, `${vol} mm³ shown`);
      await page.click('.views button:text-is("Iso")'); await frameAll(); await page.waitForTimeout(800);
      await snap('clamp-agent');
      await page.click('.views button:text-is("Front")'); await frameAll(); await page.waitForTimeout(800);
      await snap('clamp-agent-front');
      // STEP out and in again: one body, the same volume.
      const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('[aria-label="Export STEP"]')]);
      const file = join(out, 'clamp.step'); await download.saveAs(file);
      assert.match(fs.readFileSync(file, 'utf8').slice(0, 200), /ISO-10303-21/);
      await page.click('[aria-label="New part"]'); await idle();
      await page.setInputFiles('input[aria-label="Model file"]', file);
      await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 120000 }); await idle();
      await page.locator('.outliner .ol').first().click();
      await page.waitForFunction(() => /Volume/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 30000 });
      const back = Number(/Volume\s*([\d,.]+) mm³/.exec(await page.textContent('.props'))?.[1].replace(/,/g, ''));
      assert.ok(Math.abs(back / vol - 1) < 1e-4, `${back} mm³ after STEP, ${vol} before`);
      await page.click('.views button:text-is("Iso")'); await frameAll(); await page.waitForTimeout(800);
      await snap('clamp-step-reopened');
    } finally { chat.kill(); }
  });

  await check('D84 the pipe clamp by hand in the cage editor: a SubD tube, a rim loop, the lug Shift-dragged with its step, a hole through both sides, its rims double-clicked and bridged; one body of genus 2', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('subd tube'); await press('Enter'); await hudReady();
    for (const [label, v] of [['Outer radius', 20], ['Inner radius', 17], ['Length', 40], ['Quads round', 24], ['Quads along', 7], ['Centre X', 0], ['Centre Y', 0], ['At Z', 0]]) await page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input').fill(String(v));
    await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.cage?.faces.length === 384 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    await page.click('.views button:text-is("Front")'); await frameAll(); await page.waitForTimeout(400);
    await editCage();
    let c = (await cageNow()).cage;
    const P = v => [c.positions[3 * v], c.positions[3 * v + 1], c.positions[3 * v + 2]];
    // A holding loop near the top rim: across a vertical edge of the front's outer wall in its top row.
    await press('2');
    const front = c.faces.map((f, k) => k).filter(k => { const p = centreOf(c, c.faces[k]); return p[1] < -19 && p[2] > 34.3; });
    const f0 = c.faces[front[0]], e = [0, 1, 2, 3].map(i => [f0[i], f0[(i + 1) % 4]]).find(([a, b]) => Math.abs(P(a)[2] - P(b)[2]) > 1);
    await clickModel(centreOf(c, e));
    await page.waitForFunction(() => window.__studioCage().edges === 1, null, { timeout: 5000 });
    await press('l');
    await page.waitForFunction(() => window.__studioCage().cageFaces === 408, null, { timeout: 10000 });
    // The lug: column 0's outer faces in rows 1–5 (the +X side, seen edge on from the front: picked from the top).
    await press('3');
    c = (await cageNow()).cage;
    // (Picked in the Right view, square to the strip.)
    await page.click('.views button:text-is("Right")'); await frameAll(); await page.waitForTimeout(400);
    const strip = c.faces.map((f, k) => k).filter(k => { const f = c.faces[k], p = centreOf(c, f); return p[0] > 19 && Math.abs(p[1]) < 1 && p[2] > 40 / 7 && p[2] < 6 * 40 / 7; });
    assert.equal(strip.length, 5);
    // (Top to bottom: each next face below the gizmo's middle.)
    strip.sort((a, b) => centreOf(c, c.faces[b])[2] - centreOf(c, c.faces[a])[2]);
    for (const [i, k] of strip.entries()) await clickFace(c, k, i > 0);
    await page.waitForFunction(() => window.__studioCage().faces === 5, null, { timeout: 5000 });
    await page.click('.views button:text-is("Front")'); await frameAll(); await page.waitForTimeout(400);
    await dragArrow('X', 1, true);
    await page.waitForFunction(() => window.__studioCage().undo === 2, null, { timeout: 10000 });
    await dragArrow('X', 1, true);
    await page.waitForFunction(() => window.__studioCage().undo === 3, null, { timeout: 10000 });
    // The step: the lowest face taken out of the pick (Shift-click), the other four out twice more.
    c = (await cageNow()).cage;
    const picked = (await cageNow()).sel.faces;
    const low = picked.reduce((m, k) => centreOf(c, c.faces[k])[2] < centreOf(c, c.faces[m])[2] ? k : m, picked[0]);
    await page.click('.views button:text-is("Right")'); await frameAll(); await page.waitForTimeout(400);
    await clickFace(c, low, true);
    await page.waitForFunction(() => window.__studioCage().faces === 4, null, { timeout: 5000 });
    await page.click('.views button:text-is("Front")'); await frameAll(); await page.waitForTimeout(400);
    await dragArrow('X', 1, true);
    await page.waitForFunction(() => window.__studioCage().undo === 4, null, { timeout: 10000 });
    await dragArrow('X', 1, true);
    await page.waitForFunction(() => window.__studioCage().undo === 5, null, { timeout: 10000 });
    await page.waitForTimeout(800); await snap('clamp-hand-lug');
    // The hole: on the side facing the front (−Y), the 2 × 2 faces at the second and third levels of the middle
    // columns deleted; the same clicks then take the faces behind them (+Y), deleted too.
    c = (await cageNow()).cage;
    const sideFaces = c.faces.map((f, k) => k).filter(k => { const f = c.faces[k], ys = f.map(v => c.positions[3 * v + 1]); return ys.every(y => y < -2) && centreOf(c, f)[0] > 21; });
    const xs = [...new Set(sideFaces.map(k => Math.round(centreOf(c, c.faces[k])[0] * 1e6)))].sort((a, b) => a - b), zs = [...new Set(sideFaces.map(k => Math.round(centreOf(c, c.faces[k])[2] * 1e6)))].sort((a, b) => a - b);
    assert.deepEqual([xs.length, zs.length], [4, 5], `the lug's front side: ${xs.length} levels, ${zs.length} columns`);
    const block = sideFaces.filter(k => { const p = centreOf(c, c.faces[k]); return [xs[1], xs[2]].includes(Math.round(p[0] * 1e6)) && [zs[2], zs[3]].includes(Math.round(p[2] * 1e6)); });
    assert.equal(block.length, 4);
    // (Orthographic: the faces behind the deleted ones fill the same place on the screen, nothing in front of them.
    // From the top right: each next face left of or below the gizmo's middle; the front view looks along +Y, +X right.)
    await page.click('.views button:text-is("Ortho")'); await page.waitForTimeout(300);
    block.sort((a, b) => { const p = centreOf(c, c.faces[a]), q = centreOf(c, c.faces[b]); return q[2] - p[2] || q[0] - p[0]; });
    for (const side of ['front', 'back']) {
      if ((await cageNow()).faces) await press('Escape');
      const now = (await cageNow()).cage;
      // (The faces at those places now: behind the deleted ones, the other side's.)
      const at = block.map(k => centreOf(c, c.faces[k])).map(p => now.faces.findIndex(f => { const q = centreOf(now, f); return Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[2] - p[2]) < 1e-6 && Math.sign(q[1]) === (side === 'front' ? -1 : 1); }));
      assert.ok(at.every(k => k >= 0), JSON.stringify(at));
      for (const [i, k] of at.entries()) await clickFace(now, k, i > 0);
      await page.waitForFunction(() => window.__studioCage().faces === 4, null, { timeout: 5000 });
      const ys = await page.evaluate(() => { const s = window.__studioCage(), c = s.cage; return s.sel.faces.map(k => c.faces[k].reduce((t, v) => t + c.positions[3 * v + 1], 0) / 4); });
      assert.ok(ys.every(y => side === 'front' ? y < 0 : y > 0), `${side}: the faces picked at y ${ys}`);
      const before = (await cageNow()).cageFaces;
      await press('Delete');
      await page.waitForFunction(n => window.__studioCage().cageFaces === n, before - 4, { timeout: 10000 });
    }
    await page.click('.views button:text-is("Ortho")');
    // The two rims, double-clicked (Shift: the second added) in an iso view: an open edge each, where it is clear
    // of every other edge on the screen; B bridges them.
    await page.click('.views button:text-is("Iso")'); await frameAll(); await page.waitForTimeout(400);
    await press('2');
    const rims = await page.evaluate(() => {
      const c = window.__studioCage().cage, n = c.positions.length / 3, q = [];
      for (let v = 0; v < n; v++) q.push(window.__studioScreenOf([c.positions[3 * v], c.positions[3 * v + 1], c.positions[3 * v + 2]]));
      const count = new Map(), all = [];
      for (const f of c.faces) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = a < b ? `${a}_${b}` : `${b}_${a}`; if (!count.has(k)) all.push([Math.min(a, b), Math.max(a, b)]); count.set(k, (count.get(k) ?? 0) + 1); }
      const dist = (p, [a, b]) => { const A = q[a], B = q[b], dx = B[0] - A[0], dy = B[1] - A[1], t = Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(A[0] + t * dx - p[0], A[1] + t * dy - p[1]); };
      const best = side => {
        let out = null, clear = -1;
        for (const e of all) {
          if (count.get(`${e[0]}_${e[1]}`) !== 1 || Math.sign(c.positions[3 * e[0] + 1]) !== side) continue;
          const m = [(q[e[0]][0] + q[e[1]][0]) / 2, (q[e[0]][1] + q[e[1]][1]) / 2], d = Math.min(...all.filter(x => x !== e).map(x => dist(m, x)));
          if (d > clear) { clear = d; out = m; }
        }
        return { at: out, clear };
      };
      return [best(-1), best(1)];
    });
    assert.ok(rims.every(r => r.clear > 3), JSON.stringify(rims));
    await page.mouse.dblclick(rims[0].at[0], rims[0].at[1]);
    await page.waitForFunction(() => window.__studioCage().edges === 8, null, { timeout: 5000 });
    await page.keyboard.down('Shift'); await page.mouse.dblclick(rims[1].at[0], rims[1].at[1]); await page.keyboard.up('Shift');
    await page.waitForFunction(() => window.__studioCage().edges === 16, null, { timeout: 5000 });
    const open = (await cageNow()).cageFaces;
    await press('b');
    await page.waitForFunction(n => window.__studioCage().cageFaces === n, open + 8, { timeout: 10000 });
    await page.waitForTimeout(1500); await snap('clamp-hand-hole');
    await page.click('[aria-label="Done editing cage"]');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Cage editor"]'), null, { timeout: 10000 });
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    // One closed body of genus 2 (the kernel's own check of the cage the studio wrote).
    const made = (await doc()).nodes[0].cage, kernel = await import('../../../packages/barocss-cad/dist/index.js');
    const v = kernel.validateCage(made); assert.equal(v.valid, true); assert.equal(v.boundaryEdges.length, 0);
    const r = kernel.checkBrep(kernel.subdBrep(made, { id: 'clamp' }));
    assert.equal(r.valid, true, r.issues[0]); assert.deepEqual(r.topology.map(t => [t.shells, t.genus]), [[1, 2]]);
    await page.click('.views button:text-is("Iso")'); await frameAll(); await page.waitForTimeout(800);
    await snap('clamp-hand');
  });

  await check('R9 Simplify mesh: a lumpy 10 000-triangle torus STL opened, simplified to 10% from the palette — the report in its panel (the counts, the distance measured both ways), its faces\' names kept; undone', async () => {
    const fs = await import('node:fs'), { encodeBinaryStl } = await import('../../../packages/barocss-cad/dist/index.js');
    const n = 100, m = 50, P = [], I = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m, r = 8 * (1 + 0.15 * Math.sin(3 * u) * Math.cos(2 * v));
      P.push((25 + r * Math.cos(v)) * Math.cos(u), (25 + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v));
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = ((i + 1) % n) * m + j, c = ((i + 1) % n) * m + (j + 1) % m, d = i * m + (j + 1) % m; I.push(a, b, c, a, c, d); }
    const file = join(out, 'lumpy-torus.stl');
    fs.writeFileSync(file, encodeBinaryStl(P, I, 'lumpy'));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForSelector('[aria-label="Mesh units"]');
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const before = await page.evaluate(() => window.__studioDoc.nodes.length);
    await page.locator('.outliner .ol').first().click();
    await press(' '); await page.locator('.palette input').fill('simplify mesh'); await press('Enter'); await hudReady();
    await page.locator('.hud .field', { has: page.locator('span:text-is("Keep %")') }).locator('input').fill('10'); await hudReady();
    await press('Enter');
    await page.waitForFunction(k => window.__studioDoc.nodes.length === k + 1 && window.__studioDoc.nodes[k].kind === 'decimate', before, { timeout: 30000 });
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => /Simplified: 10,000 → 1,000 triangles/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 15000 });
    const props = await page.textContent('.props');
    assert.match(props, /Measured distance from the original: at most [\d.]+ mm/);
    assert.match(await page.textContent('.history'), /Simplify mesh to 10%/);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(600);
    await snap('decimate-torus');
    await press('Escape'); await press('Meta+z');
    await page.waitForFunction(k => window.__studioDoc.nodes.length === k, before, { timeout: 15000 }); await idle();
  });

  await check('R10a a sketch drawn by hand names its walls by its edges\' ids: a corner filleted, the sketch reopened and an edge split (K) — the fillet keeps its edge, nothing re-matched, every other wall\'s name kept', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('l');
    const [cx, cy] = await canvasCenter();
    for (const [dx, dy] of [[-150, -80], [150, -80], [130, 80], [-160, 90], [-150, -80]]) await clickAt(cx + dx, cy + dy);
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    let d = await doc();
    const tags = d.nodes[0].sideTags.outer, wall = k => `n1.side[${tags[k]}]`;
    assert.deepEqual(tags, ['e1', 'e2', 'e3', 'e4']);
    // The corner between the first two edges, filleted by its name.
    const corner = `${wall(0)}|${wall(1)}`;
    assert.ok(await page.evaluate(n => window.__studioPickEdge(n) || window.__studioPickEdge(n.split('|').reverse().join('|')), corner), corner);
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('3'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 20000 }); await idle();
    d = await doc(); const edges = d.nodes.at(-1).edges;
    assert.equal(edges.length, 1); assert.deepEqual(edges[0].split('|').sort(), corner.split('|').sort());
    // Reopened: the Split tool puts a point in the middle of the edge opposite (the third), and Finish.
    await page.locator('.history .hs', { hasText: 'Extrude' }).last().click();
    await page.click('[aria-label="Edit sketch"]');
    await page.waitForSelector('.sk-panel', { timeout: 5000 });
    const P = d.nodes[0].points.map(p => p.map(Number)), mid = [(P[2][0] + P[3][0]) / 2, (P[2][1] + P[3][1]) / 2, 0];
    await press('k');
    const q = await page.evaluate(p => window.__studioScreenOf(p), mid);
    await page.mouse.move(q[0] - 3, q[1]); await page.mouse.move(q[0], q[1]);
    await page.waitForSelector('.vp-overlay .sk-split', { state: 'attached', timeout: 5000 });
    await page.mouse.click(q[0], q[1]);
    await page.waitForTimeout(300); await snap('r10a-split');
    await page.evaluate(() => document.activeElement?.blur()); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0].sideTags?.outer.length === 5, null, { timeout: 15000 });
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    d = await doc();
    assert.deepEqual(d.nodes[0].sideTags.outer, ['e1', 'e2', 'e3', 'e5', 'e4'], 'the new piece after e3 has e5');
    assert.deepEqual(d.nodes.at(-1).edges, edges, 'the fillet keeps its edge'); assert.equal(d.nodes.at(-1).rematched, undefined, 'nothing re-matched');
    for (const k of [0, 1, 2, 3]) assert.ok(await page.evaluate(n => window.__studioSelectFace(n), wall(k)), wall(k));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10a-after');
  });

  await check('R10.1 a rod on a plate (a file): the junction filleted in the studio — a plane and a cylinder along the edge, its volume the closed form; a radius past the plate\'s reach refused by name', async () => {
    const fs = await import('node:fs'), file = join(out, 'rod-on-plate.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [40, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
      { id: 'n2', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 5, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'n3', kind: 'extrude', sketch: 2, height: 40 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } }] }));
    await openModel(file, 5, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const junction = await page.evaluate(() => ['n1.top#1|n3.side0', 'n1.top#2|n3.side0', 'n3.side0|n1.top#1', 'n3.side0|n1.top#2'].find(n => window.__studioPickEdge(n)));
    assert.ok(junction, 'the junction is picked by its name');
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('2'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 20000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    const props = await page.textContent('.props'), vol = Number(/Volume\s*([\d,]+) mm³/.exec(props)?.[1].replace(/,/g, ''));
    const yc = Math.sqrt(45), section = yc - 2 * Math.atan2(yc, 2) - 12.5 * Math.atan2(2, yc), exact = 16000 + 500 * Math.PI + 40 * section;
    assert.ok(Math.abs(vol - exact) <= 1, `${vol} vs ${exact}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10-1-rod-on-plate');
    // The other junction at 40: the ball would touch the top 15.6 mm out, past its 15.
    const other = await page.evaluate(j => ['n1.top#1|n3.side0', 'n1.top#2|n3.side0', 'n3.side0|n1.top#1', 'n3.side0|n1.top#2'].find(n => n !== j && window.__studioPickEdge(n)), junction);
    assert.ok(other, 'the other junction');
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('40');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'refused', null, { timeout: 20000 });
    assert.match(await page.locator('.hud-error').innerText(), /too large/i);
    await press('Escape');
  });

  await check('R11.1a a rod on a plate shelled (a file): the wall 1 thick throughout — the junctions beside the rod filled with the sharp join, its volume the closed form (1.1 % over before, D105)', async () => {
    const fs = await import('node:fs'), file = join(out, 'rod-on-plate-shell.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 6, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [40, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
      { id: 'n2', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 5, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'n3', kind: 'extrude', sketch: 2, height: 40 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } },
      { id: 'n5', kind: 'shell', parent: { node: 4, side: 'solid' }, thickness: 1, open: [] }] }));
    await openModel(file, 6, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    // (Conformance r11/shell-rod-on-plate-sharp-join: the body less the plate's box eroded and the rod's offset disc above
    // the plate's offset, × 38: 4762.95 mm³.)
    const vol = await bodyVolume(), rho = 4, seg = Math.PI * rho * rho - (rho * rho * Math.acos(1 / rho) - Math.sqrt(rho * rho - 1));
    const exact = 16000 + 12.5 * Math.PI * 40 - (38 * 8 + seg) * 38;
    assert.ok(Math.abs(vol - exact) <= 1, `${vol} vs ${exact}`);
    assert.match(await page.textContent('.history'), /Shell 1/);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r11-1a-rod-on-plate-shell');
  });

  await check('R11.1b a box with a notched corner shelled (a file): three concave edges meet at a vertex, the planes\' growth mitred there — its volume the cube erosion (the vertex under-filled before, D106)', async () => {
    const fs = await import('node:fs'), file = join(out, 'notched-box-shell.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 6, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
      { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [18, 12], max: [35, 25], plane: { origin: [25, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'n3', kind: 'extrude', sketch: 2, height: 40 },
      { id: 'n4', kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } },
      { id: 'n5', kind: 'shell', parent: { node: 4, side: 'solid' }, thickness: 2, open: [] }] }));
    await openModel(file, 6, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    // (Conformance r11/shell-notched-corner: 22 560 − (36 · 26 · 16 − 15 · 12 · 8) = 9 024 mm³.)
    const vol = await bodyVolume();
    assert.ok(Math.abs(vol - 9024) <= 1, `${vol}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r11-1b-notched-box-shell');
  });

  await check('R11.1c a box edge rounded 2 → 4 then shelled 1 open at the bottom (a file): the hollow\'s edge rounded r(s) − 1 on the same spine — its volume the closed form (refused before, D107)', async () => {
    const fs = await import('node:fs'), file = join(out, 'variable-radius-shell.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 4, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
      { id: 'n2', kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 2, radii: [{ at: [0, 0, 20], radius: 2 }, { at: [40, 0, 20], radius: 4 }] },
      { id: 'n3', kind: 'shell', parent: { node: 2, side: 'solid' }, thickness: 1, open: ['n1.bottom'] }] }));
    await openModel(file, 4, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    // (Conformance r11/shell-variable-radius-box-edge: the box less its round, (1 − π/4) ∫ r², less the hollow box less its round, (1 − π/4) ∫ (r − 1)².)
    const k = 1 - Math.PI / 4, I = (a, b, x0, x1) => { const m = (b - a) / 40; return ((a + m * x1) ** 3 - (a + m * x0) ** 3) / (3 * m); };
    const exact = 24000 - k * I(2, 4, 0, 40) - (38 * 28 * 19 - k * I(1, 3, 1, 39)), vol = await bodyVolume();
    assert.ok(Math.abs(vol - exact) <= 1, `${vol} vs ${exact}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r11-1c-variable-radius-shell');
  });

  await check('R11.2a a SubD cube shelled 0.5 (a file): its cavity its faces offset and fitted, no Boolean — the shell Steiner\'s At − Mt² + (2πχ/3)t³ (refused before D110)', async () => {
    const fs = await import('node:fs'), file = join(out, 'subd-cube-shell.bcad');
    const cube = { positions: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10], faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [
      { id: 'n0', kind: 'subd', name: 'SubD cube', cage: cube }, { id: 'n1', kind: 'shell', parent: { node: 0, side: 'solid' }, thickness: 0.5, open: [] }] }));
    await openModel(file, 2, 60000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    // (Conformance r11/shell-subd-cube: 102.047 mm³; the panel rounds to 1 mm³.)
    const vol = await bodyVolume();
    assert.ok(Math.abs(vol - 102.05) <= 1, `${vol}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r11-2a-subd-cube-shell');
  });

  await check('R10.2a a pipe tee (a file): its junction filleted in the studio — a rolling-ball fillet round the whole loop from one of its edges, between two cylinders', async () => {
    const fs = await import('node:fs'), file = join(out, 'pipe-tee.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'n1', kind: 'extrude', sketch: 0, height: 60 },
      { id: 'n2', kind: 'sketch', profile: 'circle', center: [30, 0], radius: 5 }, { id: 'n3', kind: 'extrude', sketch: 2, height: 25 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } }] }));
    await openModel(file, 5, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const before = await bodyVolume();
    // (Polled: just after a file opens, the bodies shown can still be the last part's.)
    const edge = await (await page.waitForFunction(() => { for (const a of ['n1.side0#1', 'n1.side0#2', 'n1.side0']) for (const b of ['n3.side0#1', 'n3.side0#2']) for (let k = 1; k <= 8; k++) for (const n of [`${a}|${b}#${k}`, `${b}#${k}|${a}`]) if (window.__studioPickEdge(n)) return n; return null; }, null, { timeout: 30000 })).jsonValue();
    assert.ok(edge, 'a junction edge picked by its name');
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('2');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 60000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 60000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 60000 });
    const after = await bodyVolume();
    // (The kernel's fillet adds 15.71 mm³ — conformance r10/general-tee; the panel rounds to 1 mm³.)
    assert.ok(Math.abs(after - before - 15.71) <= 1, `${before} → ${after}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10-2-pipe-tee');
  });

  await check('R10.2b an oblique groove (a file): a rod tilted 10° cut from a plate, one rim (an open chain of ellipse arcs) filleted in the studio — the rolling-ball tool run past both ends of the plate', async () => {
    const fs = await import('node:fs'), file = join(out, 'oblique-groove.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 6, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [8, -20], max: [32, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
      { id: 'n2', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'n3', kind: 'extrude', sketch: 2, height: 60, from: -10 },
      { id: 'n4', kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'y', angleDegrees: 10, pivot: [20, 0, 10] },
      { id: 'n5', kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 4, side: 'solid' } }] }));
    await openModel(file, 6, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const before = await bodyVolume();
    const edge = await (await page.waitForFunction(() => { for (const a of ['n1.top#1', 'n1.top#2']) for (const b of ['n3.side0#1', 'n3.side0#2']) for (const n of [`${a}|${b}`, `${b}|${a}`]) if (window.__studioPickEdge(n)) return n; return null; }, null, { timeout: 30000 })).jsonValue();
    assert.ok(edge, 'a rim picked by its name');
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('1');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 90000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    const after = await bodyVolume();
    // (A convex fillet removes material: 8983.23 mm³ after it — conformance r10/general-oblique-groove; the panel rounds to 1 mm³.)
    assert.ok(after < before && Math.abs(after - 8983.23) <= 1, `${before} → ${after}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10-2b-oblique-groove');
  });

  await check('R10.3a a box boss (a file): its whole foot filleted in the studio, four edges picked — the ball rolling round the boss\'s upright edges at its corners', async () => {
    const fs = await import('node:fs'), file = join(out, 'box-boss.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
      { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [-10, -6], max: [10, 6] }, { id: 'n3', kind: 'extrude', sketch: 2, height: 15, from: 10 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } }] }));
    await openModel(file, 5, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const before = await bodyVolume();
    const picked = await (await page.waitForFunction(() => { let n = 0; for (let k = 0; k < 4; k++) for (const e of [`n1.top|n3.side${k}`, `n3.side${k}|n1.top`]) if (window.__studioPickEdge(e, n > 0)) { n++; break; } return n === 4 ? n : null; }, null, { timeout: 30000 })).jsonValue();
    assert.equal(picked, 4, 'the four foot edges picked by name');
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('2');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 90000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => window.__studioDoc.nodes.at(-1).edges.length), 4);
    const after = await bodyVolume();
    // (The fillet adds 57.35 mm³ — conformance r10/corner-box-boss-foot, in closed form; the panel rounds to 1 mm³.)
    assert.ok(Math.abs(after - before - 57.35) <= 1, `${before} → ${after}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10-3a-box-boss');
  });

  await check('R10.3b a box boss (a file): its foot and its four upright edges filleted in one feature, eight edges picked — the uprights rounded first, then the foot round them', async () => {
    const fs = await import('node:fs'), file = join(out, 'box-boss-all.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
      { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [-10, -6], max: [10, 6] }, { id: 'n3', kind: 'extrude', sketch: 2, height: 15, from: 10 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } }] }));
    await openModel(file, 5, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const before = await bodyVolume();
    const picked = await (await page.waitForFunction(() => {
      let n = 0;
      for (let k = 0; k < 4; k++) for (const e of [`n1.top|n3.side${k}`, `n3.side${k}|n1.top`]) if (window.__studioPickEdge(e, n > 0)) { n++; break; }
      for (let k = 0; k < 4; k++) { const a = `n3.side${k}`, b = `n3.side${(k + 1) % 4}`; for (const e of [`${a}|${b}`, `${b}|${a}`]) if (window.__studioPickEdge(e, true)) { n++; break; } }
      return n === 8 ? n : null;
    }, null, { timeout: 30000 })).jsonValue();
    assert.equal(picked, 8, 'the foot and the four upright edges picked by name');
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('2');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 90000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    const after = await bodyVolume();
    // (+2.90 mm³ — conformance r10/corner-boss-uprights-and-foot, in closed form; the panel rounds to 1 mm³.)
    assert.ok(Math.abs(after - before - 2.9) <= 1, `${before} → ${after}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10-3b-box-boss-all');
  });

  await check('R10.3c a rod across a round plate (a file): both feet filleted in the studio — the translational tools cut by the plate\'s rim at their ends', async () => {
    const fs = await import('node:fs'), file = join(out, 'rod-on-disc.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 6, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
      { id: 'n2', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'n3', kind: 'extrude', sketch: 2, height: 60, from: -30 },
      { id: 'n4', kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'z', angleDegrees: 45, pivot: [0, 0, 10] },
      { id: 'n5', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 4, side: 'solid' } }] }));
    await openModel(file, 6, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const before = await bodyVolume();
    // (Each foot once, by the first of its names found: picking an edge again would take it out of the selection.)
    const picked = await (await page.waitForFunction(() => { const got = []; for (const b of ['n1.top#1', 'n1.top#2', 'n1.top']) { let done = false; for (const a of ['n3.side0#1', 'n3.side0#2', 'n3.side0']) { for (const e of [`${a}|${b}`, `${b}|${a}`]) if (!done && window.__studioPickEdge(e, got.length > 0)) { got.push(e); done = true; } } } return got.length === 2 ? got : null; }, null, { timeout: 30000 })).jsonValue();
    assert.equal(picked.length, 2, `both feet picked by name: ${picked.join(' ')}`);
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('1');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 90000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    const after = await bodyVolume();
    // (+12.04 mm³ — conformance r10/translational-rod-across-disc, by quadrature of the section across the disc; it stopped
    // square before, +12.24; the panel rounds to 1 mm³.)
    assert.ok(Math.abs(after - before - 12.04) <= 1, `${before} → ${after}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10-3c-rod-on-disc');
  });

  await check('D109 files of one node count opened back to back: each volume read is the file\'s own, never the last one\'s (R10.3c once read R10.3b\'s boss)', async () => {
    const fs = await import('node:fs'), plate = join(out, 'd109-plate.bcad'), bar = join(out, 'd109-bar.bcad');
    const two = (w, d, h) => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] }, { id: 'n1', kind: 'extrude', sketch: 0, height: h }] });
    fs.writeFileSync(plate, JSON.stringify(two(40, 30, 10))); fs.writeFileSync(bar, JSON.stringify(two(50, 5, 4)));
    for (let k = 0; k < 6; k++) {
      const [file, expected] = k % 2 ? [bar, 1000] : [plate, 12000];
      await openModel(file, 2);
      assert.equal(await bodyVolume(), expected, `open ${k}`);
    }
  });

  await check('R10.4a a boss with a rounded top (a file): its foot filleted larger than the wall below the round — the ball rolls over onto the round', async () => {
    const fs = await import('node:fs'), file = join(out, 'boss-rounded-top.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 6, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
      { id: 'n2', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 8 }, { id: 'n3', kind: 'extrude', sketch: 2, height: 6, from: 10 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } }] }));
    await openModel(file, 5, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    // The top edge rounded 2, then the foot 5 (the wall below the round is 4 high).
    let roundedVolume = NaN;
    for (const [names, radius] of [[['n3.side0#1|n3.top', 'n3.top|n3.side0#1', 'n3.side0|n3.top'], 2], [['n1.top|n3.side0#1', 'n3.side0#1|n1.top', 'n1.top|n3.side0'], 5]]) {
      await (await page.waitForFunction(ns => ns.find(n => window.__studioPickEdge(n)) ?? null, names, { timeout: 30000 })).jsonValue();
      await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
      await field('Radius').fill(String(radius));
      await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
      await page.waitForTimeout(300); await press('Enter');
      await page.waitForFunction(n => window.__studioDoc.nodes.filter(x => x.kind === 'fillet').length === n, radius === 2 ? 1 : 2, { timeout: 90000 }); await idle();
      await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
      if (radius === 2) roundedVolume = await bodyVolume();
    }
    const after = await bodyVolume();
    // (+289.0 mm³ — conformance r10/overflow-boss-rounded-top, by Pappus; the panel rounds to 1 mm³.)
    assert.ok(Math.abs(after - roundedVolume - 289.0) <= 1, `${roundedVolume} → ${after}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10-4a-boss-rounded-top');
  });

  await check('R10.4b a pipe tee with a short branch (a file): its junction filleted 3 — where the ball would run off the branch, it rolls along the branch\'s top rim', async () => {
    const fs = await import('node:fs'), file = join(out, 'tee-short-branch.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'n1', kind: 'extrude', sketch: 0, height: 60 },
      { id: 'n2', kind: 'sketch', profile: 'circle', center: [30, 0], radius: 5 }, { id: 'n3', kind: 'extrude', sketch: 2, height: 12 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } }] }));
    await openModel(file, 5, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const before = await bodyVolume();
    const edge = await (await page.waitForFunction(() => { for (const a of ['n1.side0#1', 'n1.side0#2', 'n1.side0']) for (const b of ['n3.side0#1', 'n3.side0#2']) for (let k = 1; k <= 8; k++) for (const n of [`${a}|${b}#${k}`, `${b}#${k}|${a}`]) if (window.__studioPickEdge(n)) return n; return null; }, null, { timeout: 30000 })).jsonValue();
    assert.ok(edge, 'a junction edge picked by its name');
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('3');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 90000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    const after = await bodyVolume();
    // (+32.34 mm³ — conformance r10/cliff-tee-short-branch; the panel rounds to 1 mm³.)
    assert.ok(Math.abs(after - before - 32.34) <= 1, `${before} → ${after}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10-4b-tee-short-branch');
  });

  await check('D97 a step with oblique ends (a file): its riser\'s top rounded 4, then its foot filleted 12 — more than the flat riser below the round: the ball rolls over onto the round', async () => {
    const fs = await import('node:fs'), file = join(out, 'step-oblique.bcad'), t = Math.tan(Math.PI / 18), q = d => [[0, 0], [40, 0], [40 + d * t, d], [d * t, d]];
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'polygon', points: q(30) }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
      { id: 'n2', kind: 'sketch', profile: 'polygon', points: q(15) }, { id: 'n3', kind: 'extrude', sketch: 2, height: 10, from: 10 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } }] }));
    await openModel(file, 5, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    let roundedVolume = NaN;
    for (const [names, radius] of [[['n3.side2|n3.top', 'n3.top|n3.side2'], 4], [['n1.top|n3.side2', 'n3.side2|n1.top', 'n1.top|n3.side2#1', 'n3.side2#1|n1.top'], 12]]) {
      await (await page.waitForFunction(ns => ns.find(n => window.__studioPickEdge(n)) ?? null, names, { timeout: 30000 })).jsonValue();
      await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
      await field('Radius').fill(String(radius));
      await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
      await page.waitForTimeout(300); await press('Enter');
      await page.waitForFunction(n => window.__studioDoc.nodes.filter(x => x.kind === 'fillet').length === n, radius === 4 ? 1 : 2, { timeout: 90000 }); await idle();
      await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
      if (radius === 4) roundedVolume = await bodyVolume();
    }
    const after = await bodyVolume();
    // (+839.83 mm³ — conformance r10/overflow-step-concave-fillet, a closed form; +1853 before, the riser carried on.)
    assert.ok(Math.abs(after - roundedVolume - 839.83) <= 1, `${roundedVolume} → ${after}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('d97-step-oblique-foot');
  });

  await check('D98 a step with ends turned 25° (a file): its foot chamfered 5 — the filling wedge ends in the end faces\' plane', async () => {
    const fs = await import('node:fs'), file = join(out, 'step-25.bcad'), t = Math.tan(25 * Math.PI / 180), q = d => [[0, 0], [40, 0], [40 + d * t, d], [d * t, d]];
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'polygon', points: q(30) }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
      { id: 'n2', kind: 'sketch', profile: 'polygon', points: q(15) }, { id: 'n3', kind: 'extrude', sketch: 2, height: 10, from: 10 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } }] }));
    await openModel(file, 5, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const before = await bodyVolume();
    await (await page.waitForFunction(ns => ns.find(n => window.__studioPickEdge(n)) ?? null, ['n1.top|n3.side2', 'n3.side2|n1.top'], { timeout: 30000 })).jsonValue();
    await press(' '); await page.locator('.palette input').fill('chamfer'); await press('Enter'); await hudReady();
    await field('Distance').fill('5');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'chamfer', null, { timeout: 90000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    const after = await bodyVolume();
    // (+500 mm³ — conformance r10/wedge-chamfer-oblique-ends, 5²/2 × 40; +585.5 before, stopped square.)
    assert.ok(Math.abs(after - before - 500) <= 1, `${before} → ${after}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('d98-step-25-chamfer');
  });

  await check('R10.B a step with square ends (a file): its riser\'s top rounded 4, then its foot filleted 8 — the ball over the round, its tool capped in the end faces (refused before)', async () => {
    const fs = await import('node:fs'), file = join(out, 'step-square.bcad'), q = d => [[0, 0], [40, 0], [40, d], [0, d]];
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'polygon', points: q(30) }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
      { id: 'n2', kind: 'sketch', profile: 'polygon', points: q(15) }, { id: 'n3', kind: 'extrude', sketch: 2, height: 10, from: 10 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } }] }));
    await openModel(file, 5, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    let roundedVolume = NaN;
    for (const [names, radius] of [[['n3.side2|n3.top', 'n3.top|n3.side2'], 4], [['n1.top|n3.side2', 'n3.side2|n1.top', 'n1.top|n3.side2#1', 'n3.side2#1|n1.top'], 8]]) {
      await (await page.waitForFunction(ns => ns.find(n => window.__studioPickEdge(n)) ?? null, names, { timeout: 30000 })).jsonValue();
      await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
      await field('Radius').fill(String(radius));
      await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
      await page.waitForTimeout(300); await press('Enter');
      await page.waitForFunction(n => window.__studioDoc.nodes.filter(x => x.kind === 'fillet').length === n, radius === 4 ? 1 : 2, { timeout: 90000 }); await idle();
      await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
      if (radius === 4) roundedVolume = await bodyVolume();
    }
    const after = await bodyVolume();
    // (+503.14 mm³ — conformance r10/overflow-step-square-ends, a closed form.)
    assert.ok(Math.abs(after - roundedVolume - 503.14) <= 1, `${roundedVolume} → ${after}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10b-step-square');
  });

  await check('R10.5 a variable-radius fillet (a file): a box\'s top edge from 1 mm to 3 mm — Radius and End radius in the HUD, the history reads the two', async () => {
    const fs = await import('node:fs'), file = join(out, 'box-variable.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }] }));
    await openModel(file, 2, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const before = await bodyVolume();
    await (await page.waitForFunction(ns => ns.find(n => window.__studioPickEdge(n)) ?? null, ['n1.side0|n1.top', 'n1.top|n1.side0'], { timeout: 30000 })).jsonValue();
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('1'); await field('End radius (0: same)').fill('3');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet' && !!window.__studioDoc.nodes.at(-1)?.radii, null, { timeout: 90000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    const after = await bodyVolume();
    // (−37.20 mm³ — conformance r10/variable-radius-linear, (1 − π/4) · 40 · (1 + 3 + 9) / 3.)
    assert.ok(Math.abs(before - after - 37.20) <= 1, `${before} → ${after}`);
    assert.match(await page.textContent('.history'), /Fillet R1→3/);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10-5-variable-radius');
  });

  await check('R10.5b a conic fillet (a file): a box\'s top edge r 3, Section Conic, Rho 0.5 — a parabola, r² L / 6 off; the history reads it', async () => {
    const fs = await import('node:fs'), file = join(out, 'box-conic.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }] }));
    await openModel(file, 2, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const before = await bodyVolume();
    await (await page.waitForFunction(ns => ns.find(n => window.__studioPickEdge(n)) ?? null, ['n1.side0|n1.top', 'n1.top|n1.side0'], { timeout: 30000 })).jsonValue();
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('3'); await field('Section').selectOption('conic'); await field('Rho').fill('0.5');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 90000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet' && window.__studioDoc.nodes.at(-1)?.section?.kind === 'conic', null, { timeout: 90000 }); await idle();
    await page.waitForFunction(() => !/Working/.test(document.body.innerText), null, { timeout: 90000 });
    const after = await bodyVolume();
    // (−60 mm³ — conformance r10/conic-parabola-box-edge: the parabola's segment is 2/3 of its triangle, r² L / 6.)
    assert.ok(Math.abs(before - after - 60) <= 0.5, `${before} → ${after}`);
    assert.match(await page.textContent('.history'), /Fillet R3 conic ρ0\.5/);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r10-5b-conic');
  });

  await check('SubD torus (SD1): a regular cage as its exact limit surface — B-spline faces, a smooth ring, a split of it', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('subd torus'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'subd' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    assert.match(await page.textContent('.history'), /SubD torus \(128 quads\)/);
    await page.locator('.outliner .ol').first().click();
    const props = await page.textContent('.props');
    const vol = Number(/Volume\s*([\d,]+) mm³/.exec(props)?.[1].replace(/,/g, '')), exact = 2 * Math.PI * Math.PI * 20 * 36;
    assert.ok(Math.abs(vol / exact - 1) < 0.03, `${vol} vs ${exact}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('subd-torus');
    // A split across Z through it (the analytic path: B-spline faces).
    await press(' '); await page.locator('.palette input').fill('split'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 });
    await snap('subd-torus-split');
  });

  await check('face colour: the top of a box coloured on its own, kept by the face name; cleared again', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForSelector('[aria-label="Face colour"]', { timeout: 5000 });
    await page.locator('[aria-label="Face colour"] .swatch').nth(1).click();
    await page.waitForFunction(() => Object.values(window.__studioDoc.bodies ?? {}).some(l => l.faces?.['n1.top']), null, { timeout: 5000 });
    await press('Escape'); await page.waitForTimeout(300); await snap('face-colour');
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.click('[aria-label="No face colour"]');
    await page.waitForFunction(() => !Object.values(window.__studioDoc.bodies ?? {}).some(l => l.faces), null, { timeout: 5000 });
  });

  await check('sweep a circle along a sketched path: an L of lines made a curve, the profile carried along it', async () => {
    await page.click('[aria-label="New part"]'); const [cx, cy] = await canvasCenter();
    await press('s'); await press('l'); await clickAt(cx - 160, cy + 60); await clickAt(cx + 40, cy + 60); await clickAt(cx + 40, cy - 100);
    await page.click('[aria-label="Make curves"]');
    await page.waitForFunction(() => (window.__studioDoc.direct?.objects.length ?? 0) === 1, null, { timeout: 10000 });
    await press('s'); await press('c'); await clickAt(cx + 200, cy + 100); await clickAt(cx + 215, cy + 100); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1, null, { timeout: 5000 });
    await page.locator('.ol.direct').first().click();
    await press(' '); await page.locator('.palette input').fill('sweep-curve'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'sweep-curve', null, { timeout: 20000 });
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 });
    assert.match(await page.locator('.history').innerText(), /Sweep along Sketch curve 1/);
    await iso(); await press('f'); await page.waitForTimeout(600); await snap('sweep-along-curve');
  });

  await check('draft a side face of a box 10°, then offset its top face 3 mm out', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('20'); await field('Depth Y').fill('20'); await field('Height Z').fill('10'); await field('At X').fill('0'); await field('At Y').fill('0');
    await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.side0')));
    await press(' '); await page.locator('.palette input').fill('draft'); await press('Enter'); await hudReady();
    await field('Angle').fill('10'); await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'draft', null, { timeout: 20000 }); await idle();
    assert.match(await page.locator('.history').innerText(), /Draft 10° × 1/);
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await press(' '); await page.locator('.palette input').fill('offset-face'); await press('Enter'); await hudReady();
    await field('Offset').fill('3'); await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'union', null, { timeout: 20000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => /× 13\b/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 10000 });
    await iso(); await snap('draft-offset');
  });

  await check('surface analysis: zebra stripes, then the curvature map, on a filleted box; no shader errors', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioPickEdge('n1.side0|n1.top')));
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'fillet', null, { timeout: 20000 }); await idle(); await press('Escape');
    const errors = []; const listen = m => { if (m.type() === 'error' || /WGSL|shader/i.test(m.text())) errors.push(m.text()); }; page.on('console', listen);
    await page.click('[aria-label="Surface analysis"]'); await page.waitForTimeout(800); await iso(); await snap('analysis-zebra');
    await page.click('[aria-label="Surface analysis"]'); await page.waitForTimeout(800); await snap('analysis-curvature');
    await page.click('[aria-label="Surface analysis"]'); page.off('console', listen);
    assert.match(await page.locator('[aria-label="Surface analysis"]').innerText(), /Analyse/);
    assert.deepEqual(errors, []);
  });

  await check('corners: a click at a box corner picks the point; Shift adds another and their distance shows', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle(); await press('Escape');
    const [ax, ay] = await page.evaluate(() => window.__studioScreenOf([32, 0, 16])), [bx, by] = await page.evaluate(() => window.__studioScreenOf([0, 0, 16]));
    await page.mouse.move(ax + 2, ay + 1); await page.waitForSelector('.vp-overlay .vertex-mark', { state: 'attached', timeout: 5000 });
    await page.mouse.click(ax + 2, ay + 1);
    await page.waitForFunction(() => /SELECTION · POINT[\s\S]*32, 0, 16/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await page.keyboard.down('Shift'); await page.mouse.click(bx - 1, by + 1); await page.keyboard.up('Shift');
    await page.waitForFunction(() => /2 POINTS[\s\S]*Distance\s*32 mm/.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await snap('corners'); await press('Escape');
  });

  await check('curves made in the studio: two sketched circles as curves, lofted into a surface; an edge as a curve', async () => {
    await page.click('[aria-label="New part"]'); const [cx, cy] = await canvasCenter();
    for (const [z, r] of [[0, 60], [20, 30]]) {
      await press('s'); if (z) await page.fill('[aria-label="Plane offset"]', String(z));
      await press('c'); await clickAt(cx, cy); await clickAt(cx + r, cy);
      await page.click('[aria-label="Make curves"]');
      await page.waitForFunction(n => (window.__studioDoc.direct?.objects.length ?? 0) === n, z ? 2 : 1, { timeout: 10000 });
    }
    await page.locator('.ol.direct').nth(0).click(); await page.locator('.ol.direct').nth(1).click({ modifiers: ['Shift'] });
    await page.click('.direct-panel button:text-is("Loft")');
    await page.waitForFunction(() => window.__studioDoc.direct.objects.some(o => /Lofted/.test(o.name)), null, { timeout: 10000 });
    await snap('curves-loft');
    // A box's edge as a curve.
    await press('Escape'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1 || /body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    const ext = (await doc()).nodes.length - 1;
    assert.ok(await page.evaluate(n => window.__studioPickEdge(`n${n}.side0|n${n}.top`), ext));
    await page.click('[aria-label="Edge as a curve"]');
    await page.waitForFunction(() => window.__studioDoc.direct.objects.some(o => /Edge curve/.test(o.name)), null, { timeout: 10000 });
  });

  await check('Shift-Enter applies a hole and starts another on the same face', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Centre X').fill('8'); await hudReady(); await page.waitForTimeout(300); await press('Shift+Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 });
    await page.waitForFunction(() => /Hole/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 10000 });
    await field('Centre X').fill('24'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.filter(n => n.kind === 'hole').length === 2, null, { timeout: 15000 });
  });

  await check('sketch offset: a rectangle offset 2 mm in makes a frame profile', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('r'); const [cx, cy] = await canvasCenter();
    await clickAt(cx - 100, cy - 60); await clickAt(cx + 100, cy + 60);
    await page.fill('[aria-label="Offset distance"]', '2'); await page.click('[aria-label="Offset inward"]');
    await page.waitForFunction(() => document.querySelectorAll('.vp-overlay .sk-shape.done').length >= 2, null, { timeout: 5000 });
    await page.evaluate(() => document.activeElement?.blur()); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1, null, { timeout: 10000 });
    const n = (await doc()).nodes[0];
    assert.equal(n.holes?.length, 1, 'the inner rectangle is the profile’s hole');
  });

  await check('sketch trim: a rectangle and a circle on its edge trimmed into one keyhole outline', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('r'); const [cx, cy] = await canvasCenter();
    await clickAt(cx - 100, cy - 60); await clickAt(cx + 100, cy + 60);
    await press('c'); await clickAt(cx + 100, cy); await clickAt(cx + 140, cy);
    await press('t'); await page.mouse.move(cx + 100, cy + 4);
    await page.waitForSelector('.vp-overlay .sk-trim', { timeout: 5000 }); await snap('sketch-trim-hover');
    await clickAt(cx + 100, cy + 4);
    await page.waitForFunction(() => document.querySelectorAll('.vp-overlay .sk-shape.done.open').length === 1, null, { timeout: 5000 });
    await clickAt(cx + 62, cy);
    await page.waitForFunction(() => document.querySelectorAll('.vp-overlay .sk-shape.done').length === 1 && !document.querySelector('.vp-overlay .sk-shape.done.open'), null, { timeout: 5000 });
    await snap('sketch-trimmed'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1, null, { timeout: 10000 });
    const n = (await doc()).nodes[0];
    assert.equal(n.profile, 'loop'); assert.equal(n.segments.filter(x => x.kind === 'arc').length, 1); assert.ok(!n.holes && !n.regions);
  });

  await check('sketch extend and split: a line runs on to the rectangle; an edge gets a point', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('r'); const [cx, cy] = await canvasCenter();
    await clickAt(cx - 100, cy - 60); await clickAt(cx + 100, cy + 60);
    await press('l'); await clickAt(cx - 40, cy); await clickAt(cx + 40, cy); await press('e');
    await page.mouse.move(cx + 36, cy + 2); await page.waitForSelector('.vp-overlay .sk-extend', { state: 'attached', timeout: 5000 }); await snap('sketch-extend-hover');
    await clickAt(cx + 36, cy + 2);
    const line = () => page.evaluate(() => [...document.querySelectorAll('.vp-overlay .sk-shape.done.open')].map(e => e.getAttribute('points')));
    await page.waitForFunction(() => { const l = document.querySelector('.vp-overlay .sk-shape.done.open'); return !!l && Number(l.getAttribute('points').split(' ').at(-1).split(',')[0]) > 0; }, null, { timeout: 5000 });
    const ends = (await line())[0].split(' ').map(p => p.split(',').map(Number));
    assert.ok(Math.abs(ends.at(-1)[0] - (cx + 100 - (await page.locator('canvas').boundingBox()).x)) < 6, 'reaches the right edge: ' + JSON.stringify(ends));
    await press('k'); await page.mouse.move(cx + 100, cy + 30); await page.waitForSelector('.vp-overlay .sk-split', { state: 'attached', timeout: 5000 });
    await clickAt(cx + 100, cy + 30);
    await press('s'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1, null, { timeout: 10000 });
    const n = (await doc()).nodes[0];
    assert.equal(n.profile, 'polygon'); assert.equal(n.points.length, 5, 'the split edge has a point: ' + JSON.stringify(n.points));
  });

  await check('sketch centre arc: centre, start, turn to the end; a line across its ends closes a D profile', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('q'); const [cx, cy] = await canvasCenter();
    await clickAt(cx, cy); await clickAt(cx + 60, cy);
    for (let k = 1; k <= 12; k++) { const t = k * Math.PI / 12; await page.mouse.move(cx + 60 * Math.cos(t), cy - 60 * Math.sin(t)); }
    await snap('sketch-centre-arc'); await page.mouse.click(cx - 60, cy);
    await page.waitForFunction(() => document.querySelectorAll('.vp-overlay .sk-shape.open').length >= 1, null, { timeout: 5000 });
    // The line from the arc's end back to its start (the points as drawn, on screen).
    const b = await page.locator('canvas').boundingBox(), arc = await page.evaluate(() => document.querySelector('.vp-overlay .sk-shape.open').getAttribute('points').split(' ').map(p => p.split(',').map(Number)));
    await press('l'); await clickAt(b.x + arc.at(-1)[0], b.y + arc.at(-1)[1]); await clickAt(b.x + arc[0][0], b.y + arc[0][1]);
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1, null, { timeout: 10000 });
    const n = (await doc()).nodes[0];
    assert.equal(n.profile, 'loop'); assert.deepEqual(n.segments.map(x => x.kind).sort(), ['arc', 'line']);
  });

  await check('sketch: pick a rectangle corner with Select and round it', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('r'); const [cx, cy] = await canvasCenter();
    await clickAt(cx - 100, cy - 60); await clickAt(cx + 100, cy + 60);
    await press('s'); await page.waitForTimeout(200); await clickAt(cx + 100, cy + 60);
    await page.waitForSelector('[aria-label="Round the corner"]', { timeout: 5000 });
    await page.fill('[aria-label="Corner radius"]', '3'); await page.click('button[aria-label="Round the corner"]');
    await page.evaluate(() => document.activeElement?.blur()); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 1, null, { timeout: 10000 });
    const n = (await doc()).nodes[0];
    assert.equal(n.profile, 'loop'); assert.equal(n.segments.filter(x => x.kind === 'arc').length, 1);
  });

  await check('sketch on a face: use its outline, offset it in, and the ring is the profile', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props')?.textContent ?? ''), null, { timeout: 5000 });
    await press('s'); await page.waitForSelector('[aria-label="Use the face outline"]', { timeout: 5000 });
    await page.click('[aria-label="Use the face outline"]');
    await page.fill('[aria-label="Offset distance"]', '3'); await page.click('[aria-label="Offset inward"]');
    await page.evaluate(() => document.activeElement?.blur()); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'sketch', null, { timeout: 10000 });
    const n = (await doc()).nodes.at(-1);
    assert.equal(n.holes?.length, 1); assert.deepEqual(n.on, { node: 1, side: 'solid' });
  });

  // ---- R11b (O1): the drawing, its section and a sketch as DXF ---------------------------------------------------
  await check('R11b: the drawing, section A–A and a sketch export as DXF (2000 and R12)', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`));
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const read = async (label) => { const [f] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click(`[aria-label="${label}"]`)]); return { name: f.suggestedFilename(), bytes: fs.readFileSync(await f.path()) }; };
    const groups = (bytes) => { const l = bytes.toString('latin1').split('\n'); const out = []; for (let i = 0; i + 1 < l.length; i += 2) out.push([Number(l[i]), l[i + 1]]); return out; };
    const count = (g, type) => g.filter(([c, v]) => c === 0 && v === type).length;
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      const clickView = async (view, u, v) => { const p = await page.evaluate(([view, u, v]) => window.__studioDrawingAt(view, u, v), [view, u, v]); await page.mouse.move(p.x - 3, p.y); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y); };
      await press('d'); await clickView('front', 0, 0); await clickView('front', 64, 0); await clickView('front', 32, -12);
      await press('o'); await clickView('top', 36, 16); await clickView('top', 52, 40);
      await page.waitForFunction(() => window.__studioDrawing().dimensions.length === 2, null, { timeout: 5000 });
      await press('Escape'); await page.click('[aria-label="Section A–A"]');
      await page.waitForFunction(() => window.__studioDrawing?.()?.section?.rings === 2, null, { timeout: 20000 });
      // DXF 2000: the sheet in mm, its layers, two dimensions with their blocks, the section's hatch, ellipses in the isometric view.
      const a = await read('Export DXF'); fs.writeFileSync(join(out, 'drawing.dxf'), a.bytes);
      assert.match(a.name, /\.dxf$/); const g = groups(a.bytes);
      assert.deepEqual(g.slice(0, 4), [[0, 'SECTION'], [2, 'HEADER'], [9, '$ACADVER'], [1, 'AC1015']]);
      assert.equal(g[g.findIndex(([c, v]) => c === 9 && v === '$INSUNITS') + 1][1], '4');
      for (const layer of ['VISIBLE', 'HIDDEN', 'CENTER', 'DIMENSIONS', 'HATCH']) assert.ok(g.some(([c, v], i) => c === 0 && v === 'LAYER' && g.slice(i, i + 12).some(([c2, v2]) => c2 === 2 && v2 === layer)), `layer ${layer}`);
      assert.equal(count(g, 'DIMENSION'), 2); assert.equal(count(g, 'HATCH') >= 1, true); assert.ok(count(g, 'ELLIPSE') >= 1, 'the isometric hole');
      assert.ok(g.some(([c, v]) => c === 1 && v === '%%c8 THRU'), 'the callout as the dimension text');
      assert.equal(g.at(-1)[1], 'EOF');
      // R12: no HATCH, ELLIPSE or LWPOLYLINE; a toast says what changed.
      await page.selectOption('[aria-label="DXF version"]', 'AC1009');
      const b = await read('Export DXF'), g12 = groups(b.bytes);
      assert.equal(g12[3][1], 'AC1009'); assert.equal(count(g12, 'HATCH') + count(g12, 'ELLIPSE') + count(g12, 'LWPOLYLINE'), 0); assert.ok(count(g12, 'POLYLINE') >= 1);
      await page.waitForFunction(() => /DXF R12 written/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 5000 });
      await page.selectOption('[aria-label="DXF version"]', 'AC1015');
      // Section A–A alone at 1:1: its two cut faces in one hatch, 64 mm across.
      const c = await read('Export section DXF'), gs = groups(c.bytes);
      assert.match(c.name, /section-A-A\.dxf$/); assert.equal(count(gs, 'HATCH'), 1);
      assert.equal(gs[gs.findIndex(([k, v]) => k === 9 && v === '$EXTMAX') + 1][1], '64.0');
    } finally { await page.click('.mode button:text-is("Model")'); }
    // The box's sketch from its history menu: the 64 × 32 rectangle as one closed polyline, 1:1 in its plane.
    await page.locator('.history .hs', { hasText: 'Box' }).click({ button: 'right' });
    const [sk] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.locator('.ctx-item', { hasText: 'Export sketch DXF' }).click()]);
    const gk = groups(fs.readFileSync(await sk.path()));
    assert.equal(count(gk, 'LWPOLYLINE'), 1); assert.equal(gk[gk.findIndex(([k, v]) => k === 9 && v === '$EXTMAX') + 1][1], '64.0');
  });

  // ---- R14.1 (O2): Auto-dimension -------------------------------------------------------------------------------
  await check('R14.1: Auto-dimension places overall sizes, the hole position and its callout; a hand-placed one is kept', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`));
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      const texts = async () => (await page.evaluate(() => window.__studioDrawing())).dimensions.map(d => d.text).sort();
      // One placed by hand first: the overall width.
      const clickView = async (view, u, v) => { const p = await page.evaluate(([view, u, v]) => window.__studioDrawingAt(view, u, v), [view, u, v]); await page.mouse.move(p.x - 3, p.y); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y); };
      await press('d'); await clickView('front', 0, 0); await clickView('front', 64, 0); await clickView('front', 32, -30);
      await page.waitForFunction(() => window.__studioDrawing().dimensions.length === 1, null, { timeout: 5000 }); await press('Escape');
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => window.__studioDrawing().dimensions.length === 6, null, { timeout: 5000 });
      assert.deepEqual(await texts(), ['16', '32', '32', '64', '8', 'Ø8 THRU']);
      await page.waitForFunction(() => /5 dimensions placed/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 5000 });
      const saved = (await doc()).drawing.dimensions;
      assert.equal(saved.filter(d => d.auto).length, 5); assert.equal(saved.filter(d => !d.auto).length, 1);
      // Again: the same set (its own replaced, yours kept).
      await page.click('[aria-label="Auto-dimension"]'); await page.waitForTimeout(300);
      assert.deepEqual(await texts(), ['16', '32', '32', '64', '8', 'Ø8 THRU']);
      await snap('r14-auto-dimension');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  // ---- R14.2 (O3): the drawing's issue list ------------------------------------------------------------------------
  await check('R14.2: the issue list names what is missing and what repeats; Fix all and a single fix clear them', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`));
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const issues = async () => (await page.evaluate(() => window.__studioDrawing())).issues.map(x => x.code).sort();
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.issues?.length === 3, null, { timeout: 20000 });
      assert.deepEqual(await issues(), ['HOLE_NOT_LOCATED', 'HOLE_SIZE_MISSING', 'OVERALL_MISSING']);
      await page.click('[aria-label="Fix all issues"]');
      await page.waitForFunction(() => window.__studioDrawing().issues.length === 0 && window.__studioDrawing().dimensions.length === 6, null, { timeout: 10000 });
      assert.match(await page.locator('[aria-label="Drawing issues"]').innerText(), /No issues/);
      // The width again by hand in the top view: listed as given twice; its fix removes the auto one.
      const clickView = async (view, u, v) => { const p = await page.evaluate(([view, u, v]) => window.__studioDrawingAt(view, u, v), [view, u, v]); await page.mouse.move(p.x - 3, p.y); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y); };
      await press('d'); await clickView('top', 0, 32); await clickView('top', 64, 32); await clickView('top', 32, 60);
      await page.waitForFunction(() => window.__studioDrawing().issues.some(x => x.code === 'DUPLICATE'), null, { timeout: 5000 }); await press('Escape');
      await page.locator('.dw-issue', { hasText: 'given twice' }).locator('button').click();
      await page.waitForFunction(() => window.__studioDrawing().issues.length === 0, null, { timeout: 5000 });
      const dims = (await doc()).drawing.dimensions;
      assert.equal(dims.length, 6); assert.equal(dims.filter(d => !d.auto).length, 1, 'yours kept, the auto width gone');
      await snap('r14-issues');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  // ---- R14.3 (O4): views and layout for the dimensions ---------------------------------------------------------------
  await check('R14.3: Auto lays the plate out without its right view (it adds nothing), clean; the right view comes back on its switch', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`));
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => window.__studioDrawing().dimensions.length === 6 && window.__studioDrawing().issues.length === 0, null, { timeout: 10000 });
      await page.waitForFunction(() => /without the right view/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 5000 });
      const d = (await doc()).drawing;
      assert.deepEqual(d.views, ['front', 'top', 'iso']); assert.equal(await page.locator('[aria-label="Right view"]').isChecked(), false);
      assert.equal(await page.locator('[aria-label="Drawing sheet"] text', { hasText: /^RIGHT$/ }).count(), 0, 'no right view drawn');
      await snap('r14-auto-layout');
      await page.click('[aria-label="Right view"]');
      await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Drawing sheet"] text')].some(t => t.textContent === 'RIGHT'), null, { timeout: 10000 });
      assert.equal((await doc()).drawing.views, undefined, 'all four views again');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  // ---- R14.4 (O5): tolerance and GD&T suggestions ------------------------------------------------------------------
  await check('R14.4: geometric tolerancing suggested — datums A B C, the hole’s position frame, basic locations — and accepted all, cleanly', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`));
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('6.6'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø6.6/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => window.__studioDrawing().dimensions.length === 6, null, { timeout: 10000 });
      // ± mode: the general note (an estimate) and ±0.21 on the hole's positions (M6 clearance, floating: Ø0.6 / 2√2).
      await page.waitForFunction(() => window.__studioDrawing().suggestions.map(x => x.kind).sort().join() === 'general-note,hole-plus-minus', null, { timeout: 5000 });
      assert.match(await page.locator('[aria-label="Tolerance suggestions"]').innerText(), /±0\.21 on 2 location dimensions/);
      await page.selectOption('[aria-label="Tolerancing"]', 'geometric');
      await page.waitForFunction(() => window.__studioDrawing().suggestions.map(x => x.kind).sort().join() === 'datum,datum,datum,general-note,position', null, { timeout: 5000 });
      assert.match(await page.locator('[aria-label="Tolerance suggestions"]').innerText(), /position Ø0\.6 to A, B, C/);
      await page.click('[aria-label="Accept all suggestions"]');
      await page.waitForFunction(() => window.__studioDrawing().suggestions.length === 0, null, { timeout: 10000 });
      assert.deepEqual((await page.evaluate(() => window.__studioDrawing())).issues, []);
      const d = (await doc()).drawing;
      assert.deepEqual(d.datums.map(x => x.letter).sort(), ['A', 'B', 'C']); assert.equal(d.frames.length, 1); assert.equal(d.frames[0].value, 0.6);
      assert.equal(d.dimensions.filter(x => x.basic).length, 2); assert.equal(d.tolerancing, 'geometric');
      const texts = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Drawing sheet"] text')].map(t => t.textContent));
      assert.ok(texts.includes('Ø0.6') && ['A', 'B', 'C'].every(l => texts.filter(t => t === l).length >= 2), 'the frame and the datum letters on the sheet');
      await snap('r14-geometric');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  // ---- R14.5 (O6): pitch circles --------------------------------------------------------------------------------------
  await check('R14.5: a flange’s bolt circle is dimensioned by its pitch circle, located by its bore; clean; in the DXF', async () => {
    const fs = await import('node:fs');
    // The conformance case's flange: a Ø20 bore and four Ø6 holes evenly round it on a Ø60 circle.
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/r14/pcd-flange/case.json'), 'utf8')), file = join(out, 'flange.bcad');
    fs.writeFileSync(file, JSON.stringify(c.input.document));
    await openModel(file, 4);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => window.__studioDrawing().dimensions.some(d => d.text === 'Ø60 PCD · 4× EQ SP'), null, { timeout: 10000 });
      const s = await page.evaluate(() => window.__studioDrawing());
      assert.deepEqual(s.issues, []);
      assert.ok(s.dimensions.some(d => d.text === '4× Ø6 THRU') && s.dimensions.some(d => d.text === 'Ø20 THRU'), JSON.stringify(s.dimensions));
      assert.equal(s.dimensions.filter(d => d.text === '50').length, 2, 'the bore (and the circle’s centre) located once each way');
      const [f] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export DXF"]')]);
      assert.ok(fs.readFileSync(await f.path()).toString('latin1').includes('\n%%c60 PCD'), 'the pitch circle in the DXF');
      await snap('r14-pcd');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  // ---- R14.3b (O7): the front view's side ----------------------------------------------------------------------------
  await check('R14.3b: the drawing turned to a front from +X and back — annotations re-mapped, every value kept; a section across refused', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`));
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const read = async () => (await page.evaluate(() => window.__studioDrawing())).dimensions.map(d => d.text).sort();
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => window.__studioDrawing().dimensions.length === 6, null, { timeout: 10000 });
      const before = await read();
      await page.selectOption('[aria-label="Front view side"]', 'x+');
      await page.waitForFunction(() => window.__studioDoc.drawing.orientation === 'x+' && window.__studioDrawing?.()?.dimensions?.length === 6, null, { timeout: 20000 });
      assert.deepEqual(await read(), before, 'every value kept');
      assert.deepEqual((await page.evaluate(() => window.__studioDrawing())).issues.filter(x => x.severity === 'error'), []);
      const d = (await doc()).drawing;
      assert.ok(d.dimensions.filter(x => x.view === 'right').length === 2 && (!d.views || d.views.includes('right')), 'the old front’s dimensions in the right view, shown');
      await snap('r14-front-x-plus');
      // Back to −Y: the drawing as it was. Then with section A–A on, turning to +X is refused and nothing changes.
      await page.selectOption('[aria-label="Front view side"]', 'y-');
      await page.waitForFunction(() => window.__studioDoc.drawing.orientation === undefined && window.__studioDrawing?.()?.dimensions?.length === 6, null, { timeout: 20000 });
      assert.deepEqual(await read(), before);
      await page.click('[aria-label="Section A–A"]');
      await page.waitForFunction(() => window.__studioDrawing?.()?.section?.rings >= 1, null, { timeout: 20000 });
      await page.selectOption('[aria-label="Front view side"]', 'x+');
      await page.waitForFunction(() => /was not turned/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 10000 });
      assert.equal((await doc()).drawing.orientation, undefined);
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  // ---- A5.2 (O10): run_script ---------------------------------------------------------------------------------------
  await check('A5.2: run_script through the real chat and tool servers — a plate with a loop of holes and a fillet in one call, one Undo takes it back; a refused line applies nothing and names its line', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', c => failed(new Error(`the chat server exited (${c})`))); });
      await page.click('[aria-label="New part"]'); await idle();
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const send = async calls => {
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      };
      const source = 'const p = box({w: 80, d: 40, h: 8, x: 0, y: 0, z: 0})\nfor (const i of range(3)) { hole(p.top, {d: 5, x: 20 + 20 * i, y: 20}) }\nfillet([edge(p.top, p.side0)], {radius: 1})';
      await send([{ tool: 'run_script', args: { source } }]);
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 6 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
      assert.deepEqual((await doc()).nodes.map(n => n.kind), ['sketch', 'extrude', 'hole', 'hole', 'hole', 'fillet']);
      await page.waitForSelector('.toast:has-text("Applied by the agent")', { timeout: 10000 });
      await snap('a5-script');
      await page.click('.toast button:text-is("Undo")');
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 10000 });
      // A refused second line: nothing applied, the line named in the tool's result.
      await send([{ tool: 'run_script', args: { source: 'const p = box({w: 20, d: 20, h: 5})\nbox({w: 10, d: 10, h: 10, q: 1})' } }]);
      assert.match(await page.locator('.chat-tool').last().innerText(), /line 2/);
      assert.equal((await doc()).nodes.length, 0);
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  await check('command palette and light theme', async () => {
    await press('Escape'); await page.waitForFunction(() => !document.querySelector('[aria-label="Measurement"]'));
    await press(' '); await page.locator('.palette input').fill('draft');
    assert.match(await page.locator('.palette-list').innerText(), /Pick side faces of one body to draft/);
    await page.locator('.palette input').fill('fillet');
    assert.match(await page.locator('.palette-list').innerText(), /Select edges of one body to round/);
    await press('Escape'); await page.click('[aria-label="Toggle light or dark theme"]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    // A light look at a part with a selection, the browser open, the cube and a command running.
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top'))); await page.waitForTimeout(300); await snap('light-selected');
    await press('h'); await hudReady(); await page.waitForTimeout(300); await snap('light-command'); await press('Escape');
  });
} finally {
  await browser.close(); await server.close();
}

const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? 'ok' : 'FAIL'} ${r.step} ${r.name}${r.ok ? '' : ' — ' + r.error}`);
if (errors.length) console.log('page errors:', errors.slice(0, 5));
console.log(`screenshots: ${out}`);
process.exit(failed.length || errors.length ? 1 : 0);
