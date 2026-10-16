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

  await check('open a STEP file as a new part', async () => {
    const { holedBoxStep } = await import('../../../packages/barocss-cad/test/step-fixtures.mjs');
    const file = join(out, 'holed-box.step'); (await import('node:fs')).writeFileSync(file, holedBoxStep());
    await page.locator('input[type=file]').setInputFiles(file);
    await page.waitForFunction(() => /Import holed-box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 });
    assert.match(await outliner(), /1 body/); await iso();
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
