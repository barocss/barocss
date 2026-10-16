// End-to-end flow in a real Chromium: starts the Vite dev server, drives the studio like a user,
// asserts on visible state and writes a screenshot per step.
//   PW_DIR=/path/to/node_modules/playwright [CHROME=/path/to/chrome] [FLOW_RENDERER=webgpu|webgl2] node test/browser-flow.mjs [out-dir]
// The viewport draws with WebGPU when the browser has it; FLOW_RENDERER=webgl2 runs the WebGL2 fallback.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const out = resolve(process.argv[2] ?? join(tmpdir(), 'cad-studio-flow'));
mkdirSync(out, { recursive: true });

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
  try { await fn(); results.push({ step, name, ok: true }); }
  catch (e) { results.push({ step, name, ok: false, error: String(e.message ?? e).split('\n')[0] }); }
  await page.screenshot({ path: join(out, `${String(step).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`) });
}
const outliner = () => page.locator('.outliner').innerText();
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
    assert.match(await history(), /Extrude 16/);
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
    await page.waitForFunction(() => /Extrude 8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Top")'); await page.waitForTimeout(300);
    const [cx, cy] = await canvasCenter(); await page.mouse.move(cx, cy); await page.mouse.click(cx, cy);
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
  });

  await check('feature editor changes the sketch a feature is made from', async () => {
    const bounds = () => page.locator('.props').innerText();
    await page.locator('.history .hs', { hasText: 'Extrude 8' }).click();
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
    await page.waitForFunction(() => /Extrude 5/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Top")'); await page.waitForTimeout(300);
    const [cx, cy] = await canvasCenter(); await page.mouse.move(cx, cy); await page.mouse.click(cx, cy);
    // Ø6 on 100 × 60 used to be refused (non-dyadic chart parameters); numeric policy v1 certifies it.
    await press('h'); await hudReady(); await field('Diameter').fill('6'); await field('Centre X').fill('6'); await field('Centre Y').fill('6');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
    // Crossing the edge makes a notch (B-rep part model); missing the plate is refused with the reason.
    await field('Centre X').fill('2'); await field('Diameter').fill('8');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
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
    await press('Enter'); await hudReady();
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
    await page.click('.topbar button.finish'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
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
    await page.click('.topbar button.finish'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
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
    await press('Enter'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
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
    await page.locator('#sk-len2').evaluate(e => e.blur()); await press('Enter'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
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
    await press('Enter'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const d = await doc(); assert.equal(d.nodes[0].profile, 'loop'); assert.equal(d.nodes[0].segments.filter(x => x.kind === 'arc').length, 1); await iso();
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
    await page.locator('#sk-rad1').evaluate(e => e.blur()); await press('Enter'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
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
    await press('Enter'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
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
    await press('Enter'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
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
    await press('Enter'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
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

  await check('revolve a circle sketch into a torus from the palette', async () => {
    await page.click('[aria-label="New part"]'); await press(' '); await page.locator('.palette input').fill('revolve'); await press('Enter');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx + 160, cy - 40); await page.mouse.move(cx + 190, cy - 40); await page.mouse.move(cx + 200, cy - 40); await page.mouse.click(cx + 200, cy - 40);
    await press('Enter'); await hudReady();
    assert.equal(await field('Make').inputValue(), 'revolve-y');
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const d = await doc(); assert.equal(d.nodes[0].profile, 'circle'); assert.equal(d.nodes[1].kind, 'revolve'); assert.equal(d.nodes[1].axis, 'y');
    assert.match(await history(), /Revolve 360°/); await iso();
  });

  await check('sweep a circle into a bent pipe from the palette', async () => {
    await page.click('[aria-label="New part"]'); await press(' '); await page.locator('.palette input').fill('pipe'); await press('Enter');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx, cy); await page.mouse.move(cx + 20, cy); await page.mouse.move(cx + 30, cy); await page.mouse.click(cx + 30, cy);
    await press('Enter'); await hudReady();
    assert.equal(await field('Make').inputValue(), 'pipe');
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /Pipe 3 steps/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 20000 });
    const last = (await doc()).nodes.at(-1); assert.equal(last.kind, 'sweep'); assert.equal(last.path[1].kind, 'bend'); await iso();
  });

  await check('loft a rectangle to a circle from the palette', async () => {
    await page.click('[aria-label="New part"]'); await press(' '); await page.locator('.palette input').fill('loft'); await press('Enter');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx - 60, cy - 60); await page.mouse.move(cx + 30, cy + 30); await page.mouse.move(cx + 60, cy + 60); await page.mouse.click(cx + 60, cy + 60);
    await press('Enter'); await hudReady();
    assert.equal(await field('Make').inputValue(), 'loft');
    await field('Loft top').selectOption('circle'); await hudReady(); await page.waitForTimeout(300);
    await page.locator('.hud button', { hasText: 'Apply' }).click();
    await page.waitForFunction(() => /Loft 2 sections/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 20000 });
    const d = await doc(), last = d.nodes.at(-1); assert.equal(last.kind, 'loft'); assert.equal(d.nodes[last.sections[1].sketch].profile, 'circle'); await iso();
  });

  await check('fillet a box top edge from the palette', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1, edge = `n${ext}.side0|n${ext}.top`;
    assert.ok(await page.evaluate(n => window.__studioSelectEdge(n), edge), 'the edge exists');
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('4'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /Fillet R4/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 20000 });
    const d = await doc(), last = d.nodes[d.nodes.length - 1];
    assert.equal(last.kind, 'fillet'); assert.deepEqual(last.edges, [edge]);
    assert.match(await outliner(), /1 body/); await iso();
  });

  await check('shell a box open at the top from the palette', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`), 'the top face exists');
    await press(' '); await page.locator('.palette input').fill('shell'); await press('Enter'); await hudReady();
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
    await press(' '); await page.locator('.palette input').fill('fillet'); await press('Enter'); await hudReady();
    await field('Radius').fill('4'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    // (The outliner lists the evaluated bodies: the filleted body is there once the kernel is done.)
    await page.waitForFunction(() => /Fillet R4/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await page.waitForTimeout(300);
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`), 'the top face exists');
    await press(' '); await page.locator('.palette input').fill('shell'); await press('Enter'); await hudReady();
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

  await check('draw a plate: standard views, dimensions that follow the model, SVG and PDF', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Extrude 8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    // (Once the new plate is evaluated — the outliner lists evaluated bodies — its top face can be picked.)
    await page.waitForFunction(() => /Extrude 8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
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
      await page.waitForFunction(() => window.__studioDrawing().dimensions.length === 2, null, { timeout: 5000 });
      assert.deepEqual((await page.evaluate(() => window.__studioDrawing())).dimensions.map(d => d.text), ['64', 'Ø8']);
      assert.equal(await page.locator('.dw svg [data-dim]').count(), 2);
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
      await page.waitForFunction(() => window.__studioDrawing?.()?.dimensions?.map(d => d.text).join() === '64,Ø12', null, { timeout: 20000 });
      const saved = (await doc()).drawing; assert.equal(saved.dimensions.length, 2); assert.equal(saved.sheet, 'A4');
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      assert.match(svgFile.suggestedFilename(), /\.svg$/);
      const svg = fs.readFileSync(await svgFile.path(), 'utf8'); fs.writeFileSync(join(out, 'drawing.svg'), svg);
      assert.match(svg, /width="297mm" height="210mm"/); assert.match(svg, /stroke-dasharray/); assert.match(svg, />Ø12<\/text>/); assert.match(svg, />64<\/text>/); assert.match(svg, />1:1<\/text>/);
      assert.match(svg, /stroke-dasharray="8 1.5 1.5 1.5"/, 'centre lines on the hole');
      const [pdfFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export PDF"]')]);
      const pdf = fs.readFileSync(await pdfFile.path()); fs.writeFileSync(join(out, 'drawing.pdf'), pdf);
      assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  await check('open a STEP file as a new part', async () => {
    const { holedBoxStep } = await import('../../../packages/barocss-cad/test/step-fixtures.mjs');
    const file = join(out, 'holed-box.step'); (await import('node:fs')).writeFileSync(file, holedBoxStep());
    await page.locator('input[aria-label="Model file"]').setInputFiles(file);
    await page.waitForFunction(() => /Import holed-box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 });
    assert.match(await outliner(), /1 body/); await iso();
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
    await page.click('.render-panel [role="tab"]:text-is("Lights")');
    await page.click('.render-panel button:text-is("Add point")');
    await page.click('.render-panel [role="tab"]:text-is("Scene")');
    await page.click('.render-panel button:text-is("Save this view")');
    const r = await page.evaluate(() => window.__studioDoc.render);
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
    // Undo takes the saved view back; Model returns to the modelling look.
    await page.evaluate(() => document.activeElement?.blur());
    for (let k = 0; k < 8; k++) await press('Meta+z');
    await page.waitForFunction(() => !window.__studioDoc.render?.camera);
    await page.click('.mode button:text-is("Model")');
    await page.waitForSelector('[aria-label="Selection"]');
  });

  await check('import a .barocad source and use curve and surface tools', async () => {
    await page.setInputFiles('input[aria-label="Model file"]', join(root, 'test/fixtures/study.barocad'));
    await page.waitForFunction(() => (window.__studioDoc.direct?.objects.length ?? 0) === 4);
    await page.locator('.ol.direct', { hasText: 'panel' }).click();
    await page.click('.direct-panel button:text-is("Iso-curve")');
    await page.locator('.ol.direct', { hasText: 'arc' }).first().click();
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
    await page.evaluate(() => document.activeElement?.blur());
  });

  await check('command palette and light theme', async () => {
    await press('Escape'); await page.waitForFunction(() => !document.querySelector('[aria-label="Measurement"]'));
    await press(' '); await page.locator('.palette input').fill('draft');
    assert.match(await page.locator('.palette-list').innerText(), /isn’t available in the kernel yet/);
    await page.locator('.palette input').fill('fillet');
    assert.match(await page.locator('.palette-list').innerText(), /Select edges of one body to round/);
    await press('Escape'); await page.click('[aria-label="Toggle light or dark theme"]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  });
} finally {
  await browser.close(); await server.close();
}

const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? 'ok' : 'FAIL'} ${r.step} ${r.name}${r.ok ? '' : ' — ' + r.error}`);
if (errors.length) console.log('page errors:', errors.slice(0, 5));
console.log(`screenshots: ${out}`);
process.exit(failed.length || errors.length ? 1 : 0);
