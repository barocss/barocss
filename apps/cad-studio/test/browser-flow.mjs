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
  if (process.env.FLOW_ONLY && step > 1 && !new RegExp(process.env.FLOW_ONLY, 'i').test(name)) return;
  try { await fn(); results.push({ step, name, ok: true }); }
  catch (e) { results.push({ step, name, ok: false, error: String(e.message ?? e).split('\n')[0] }); if (process.env.FLOW_DEBUG) console.log(String(e.message ?? e).slice(0, 1500)); }
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
    await snap('stl-open');
  });

  await check('open a STEP file as a new part', async () => {
    const { holedBoxStep } = await import('../../../packages/barocss-cad/test/step-fixtures.mjs');
    const file = join(out, 'holed-box.step'); (await import('node:fs')).writeFileSync(file, holedBoxStep());
    await page.locator('input[aria-label="Model file"]').setInputFiles(file);
    await page.waitForFunction(() => /Import holed-box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 });
    assert.match(await outliner(), /1 body/); await iso();
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
    events.push({ type: 'tool', name: 'run_command', input: { command: 'fillet' }, summary: `Fillet {"radius":2} → 1 body, ${expected} mm³`, isError: false }, { type: 'state', doc: docOf(nodes) },
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
    const opened = await doc(); assert.equal(opened.schema, 2); assert.deepEqual(opened.nodes.map(n => n.id), ['n0', 'n1']);
    await page.click('[aria-label="Dismiss"]');
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
