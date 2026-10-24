// End-to-end flow in a real Chromium: starts the Vite dev server, drives the studio like a user,
// asserts on visible state and writes a screenshot per step.
//   PW_DIR=/path/to/node_modules/playwright [CHROME=/path/to/chrome] [FLOW_RENDERER=webgpu|webgl2] [FLOW_ONLY=regex] [FLOW_DPR=1..3] node test/browser-flow.mjs [out-dir]
// FLOW_ONLY runs the first step and the steps whose names match (for steps that start from a new part).
// The viewport draws with WebGPU when the browser has it; FLOW_RENDERER=webgl2 runs the WebGL2 fallback.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer as createNetServer } from 'node:net';

// Pure runner contracts, also checked without starting Vite or a browser.
function parseFlowDpr(value = '1') {
  const input = value.trim(), dpr = Number(input);
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(input) || !Number.isFinite(dpr) || dpr < 1 || dpr > 3) {
    throw new RangeError('FLOW_DPR must be a decimal number from 1 to 3 (the viewport pixel-ratio range)');
  }
  return dpr;
}

function flowDisplayMatches(display, dpr) {
  const { devicePixelRatio, cssWidth, cssHeight, backingWidth, backingHeight } = display;
  return [devicePixelRatio, cssWidth, cssHeight, backingWidth, backingHeight].every(Number.isFinite) &&
    Math.abs(devicePixelRatio - dpr) < 1e-6 && cssWidth > 0 && cssHeight > 0 &&
    backingWidth === Math.round(cssWidth * dpr) && backingHeight === Math.round(cssHeight * dpr);
}

const flowDpr = parseFlowDpr(process.env.FLOW_DPR);
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: flowDpr });
const errors = [];
// (With its first stack lines: which code threw, not only what — a page error in a long flow is hard to place by its message.)
page.on('pageerror', e => errors.push(`${String(e)}${e.stack ? `\n${e.stack.split('\n').slice(1, 7).join('\n')}` : ''}`));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
// (Leaving with unsaved work asks first; the flow reloads on purpose.)
page.on('dialog', d => d.accept());

const results = [];
let step = 0;
// (A page load the flow did not ask for — a file under the dev server changed mid-run, so Vite reloaded the page — is
// named in the failing step's line: the step's state is gone and the studio offers the unsaved part back. The flow's own
// reloads say so first, `expectLoad`.)
let loads = 0, expected = 0, sawLoad = 0;
const changedFiles = [];
const expectLoad = () => { expected++; };
page.on('framenavigated', f => { if (f !== page.mainFrame()) return; loads++; if (loads > 1 && expected > 0) expected--; else if (loads > 1) sawLoad++; });
server.watcher.on('change', f => changedFiles.push([step, f]));
async function check(name, fn) {
  step++;
  if (process.env.FLOW_ONLY && step > 1 && !new RegExp(process.env.FLOW_ONLY, 'i').test(name)) return;
  const before = sawLoad, files = changedFiles.length;
  // (G12: each step starts with the columns as a fresh viewer has them — a chat opened or dragged in one step stays in it.)
  await page.evaluate(() => window.__studioLayoutReset?.()).catch(() => {});
  try { await fn(); results.push({ step, name, ok: true }); }
  catch (e) {
    const reloaded = sawLoad > before ? ` [the page reloaded during this step, not by the flow${changedFiles.length > files ? `: ${changedFiles.slice(files).map(x => x[1]).slice(0, 3).join(', ')} changed` : ''}]` : '';
    results.push({ step, name, ok: false, error: String(e.message ?? e).split('\n')[0] + reloaded }); if (process.env.FLOW_DEBUG) console.log(String(e.message ?? e).slice(0, 1500));
  }
  await page.screenshot({ path: join(out, `${String(step).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`) });
}
const outliner = () => page.locator('.outliner').innerText();
// (G12e: a preview chosen in the dock's Preview & analysis switch — its enable; clicked only when not already on, since
// the switch's item clicked again turns it off.)
const preview = async mode => { const b = page.locator(`[aria-label="Preview: ${mode}"]`); if (await b.getAttribute('data-state') !== 'on') await b.click(); };
/** The first body's volume from its properties (a click on its row selects it, or takes it out of the selection: until the body's panel shows). */
// (The inspector and the context panels are read as `.props:not([aria-label$=" panel"])`: the first .props card that is not
// a toolbar card left open across steps — the Variants, Rebuild, BOM, Library and Parameters panels, each "… panel".)
async function bodyVolume() {
  for (let k = 0; k < 3; k++) {
    await page.locator('.outliner .ol').first().click();
    // (O18: read in the same check that sees it, the masses there — "Volume …" is a state of its own while they come.)
    try { const got = await page.waitForFunction(() => { const m = /Volume\s*([\d,]+) mm³/.exec(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''); return m && window.__studioBodies?.().massReady !== false ? m[1] : false; }, null, { timeout: 15000 }); return Number((await got.jsonValue()).replace(/,/g, '')); } catch { /* clicked off: again */ }
  }
  return NaN;
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
// (O18: and the bodies' masses, which the worker posts after its reply — every step that reads a volume waits here.)
const idle = () => page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? '') && window.__studioBodies?.().massReady !== false, null, { timeout: 30000 });
// (O7e: the person's fastener sizes, the shipped sample loaded in the Library panel — none is built in; a new part has none.
// Idempotent: a step that goes on from the one before loads them only when they are not there, so it passes alone too.)
const loadSampleSizes = async () => {
  if (await page.evaluate(() => (window.__studioDoc.fastenerSizes?.rows?.length ?? 0) > 0)) return;
  await page.click('[aria-label="Library"]');
  try { await page.click('[aria-label="Load sample fastener sizes"]'); await page.waitForFunction(() => window.__studioDoc.fastenerSizes?.rows?.length === 7, null, { timeout: 10000 }); }
  finally { await page.click('[aria-label="Close library"]'); }
};
const hudReady = async () => { await page.waitForTimeout(250); return page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 }); };
const field = (label) => page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input, select');
const press = (k) => page.keyboard.press(k);
/** A shape's button from the top bar's strip, or from its More shapes menu when the strip has no room for it. */
const shape = async label => { if (!(await page.locator(`.shapes > [aria-label="${label}"]`).count())) await page.click('[aria-label="More shapes"]'); await page.click(`.shapes [aria-label="${label}"]`); };
const canvasCenter = async () => { const b = await page.locator('canvas').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

try {
  await page.goto(url);
  await check('starter plate loads', async () => {
    await idle(); assert.match(await outliner(), /Hole Ø8/);
    await page.waitForSelector(`.viewport[data-renderer="${renderer}"]`, { timeout: 15000 });
    let display;
    try {
      await page.waitForFunction(dpr => {
        const c = document.querySelector('canvas.vp-canvas');
        return c && c.clientWidth > 0 && c.clientHeight > 0 &&
          c.width === Math.round(c.clientWidth * dpr) && c.height === Math.round(c.clientHeight * dpr);
      }, flowDpr, { timeout: 15000 });
    } finally {
      display = await page.evaluate(() => {
        const c = document.querySelector('canvas.vp-canvas');
        return { renderer: document.querySelector('.viewport')?.dataset.renderer, devicePixelRatio: window.devicePixelRatio,
          cssWidth: c?.clientWidth ?? 0, cssHeight: c?.clientHeight ?? 0, backingWidth: c?.width ?? 0, backingHeight: c?.height ?? 0 };
      });
      const evidence = { requestedDpr: flowDpr, ...display };
      writeFileSync(join(out, 'display.json'), JSON.stringify(evidence, null, 2) + '\n');
      console.log(`flow display: ${JSON.stringify(evidence)}`);
    }
    assert.ok(flowDisplayMatches(display, flowDpr), `requested DPR and canvas backing: ${JSON.stringify(display)}`);
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
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
  });

  await check('feature editor changes the sketch a feature is made from', async () => {
    const bounds = () => page.locator('.props:not([aria-label$=" panel"])').innerText();
    await page.locator('.history .hs', { hasText: 'Box 64' }).click();
    const ed = (label) => page.locator('.node-editor .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input, select');
    assert.equal(await ed('Width').inputValue(), '64');
    await ed('Width').fill(''); await ed('Width').fill('80');
    await page.locator('.node-editor button', { hasText: 'Apply' }).click(); await idle();
    await page.locator('.outliner .ol').nth(0).click();
    await page.waitForFunction(() => /80 × 32 × 8/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    assert.match(await outliner(), /Hole Ø8/);
    await press('Escape'); await press('Meta+z'); await idle(); await page.locator('.outliner .ol').nth(0).click();
    await page.waitForFunction(() => /64 × 32 × 8/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
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
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
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
  // G7: the overlay lines (bounding box, measure line, underlays, the SubD cage's edges) are engine lines on WebGPU, SVG on
  // WebGL2: how many are drawn under a key, either way.
  const drawnLines = (key, svg) => page.evaluate(([key, svg]) => document.querySelector('.viewport')?.dataset.renderer === 'webgpu'
    ? (window.__studioOverlayLines?.()[key] ?? 0) : document.querySelectorAll(svg).length, [key, svg]);
  const iso = async () => { await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(400); };
  /**
   * G2: the open section as the GPU's clip plane draws it against the CPU's clipped and capped meshes (clipMesh), both
   * through the same viewer, the exact section held back: the viewport's pixels that differ by more than 8 (|ΔR|+|ΔG|+|ΔB|),
   * by more than 96 (`strong`: geometry — a cap, a silhouette, an edge line — not shading) and the largest difference. Both
   * shots are kept. On WebGL2: the CPU's path, and no clip plane. (The strong ones are an edge-on cap strip and edge lines
   * at the cut, at most 0.07 % when set; the faint ones the ground's shadow and occlusion, whose frame follows the scene's
   * box — the CPU's path builds its ground from its clipped meshes a frame late — up to 4 % in one view, G2.)
   */
  const sectionAgainstCpu = async (name) => {
    const s = await page.evaluate(() => window.__studioSection());
    if (renderer === 'webgl2') { assert.equal(s.gpu, false, 'WebGL2 clips on the CPU'); assert.equal(s.clip, null); return null; }
    assert.equal(s.gpu, true, 'WebGPU clips on the GPU'); assert.ok(s.clip, 'the clip plane set');
    // (G19.3: the caps compared unhatched — the hatch's own parity is G19.3's step.)
    const hatched = await page.locator('[aria-label="Hatch the cut"][aria-pressed="true"]').count();
    if (hatched) await page.click('[aria-label="Hatch the cut"]');
    const shot = async cpu => { await page.evaluate(c => window.__studioSectionDebug({ hold: true, cpu: c }), cpu); await page.waitForTimeout(500); return page.locator('canvas.vp-canvas').screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-${name}-${cpu ? 'cpu' : 'gpu'}.png`) }); };
    const gpu = await shot(false), cpu = await shot(true);
    const held = await page.evaluate(() => window.__studioSection());
    await page.evaluate(() => window.__studioSectionDebug({ hold: false, cpu: false })); await page.waitForTimeout(300);
    if (hatched) await page.click('[aria-label="Hatch the cut"]');
    assert.equal(held.clip, null, 'the CPU path: no clip plane');
    return page.evaluate(async ([a, b]) => {
      const load = async src => { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height); };
      const A = await load(a), B = await load(b);
      let n = 0, strong = 0, max = 0;
      for (let k = 0; k < A.data.length; k += 4) { const d = Math.abs(A.data[k] - B.data[k]) + Math.abs(A.data[k + 1] - B.data[k + 1]) + Math.abs(A.data[k + 2] - B.data[k + 2]); if (d > 8) n++; if (d > 96) strong++; if (d > max) max = d; }
      return { pixels: A.width * A.height, differ: n, strong, max };
    }, [gpu.toString('base64'), cpu.toString('base64')]);
  };

  await check('sketch on a side face cuts a window through; shapes inside a shape are holes', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Front")'); await press('f'); await page.waitForTimeout(400);
    let [cx, cy] = await canvasCenter(); await clickAt(cx, cy);
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
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
    await page.locator('.outliner .ol').first().click(); assert.match(await page.locator('.props:not([aria-label$=" panel"])').innerText(), /Faces\s*6/); await iso();
  });

  await check('slot sketch extrudes as a curved body', async () => {
    await page.click('[aria-label="New part"]'); await press('s'); await press('o');
    const [cx, cy] = await canvasCenter();
    await clickAt(cx - 120, cy); await clickAt(cx + 120, cy); await page.mouse.move(cx + 120, cy + 20); await page.mouse.move(cx + 120, cy + 40); await page.mouse.click(cx + 120, cy + 40);
    assert.match(await status(), /Slot/); await snap('slot-sketch');
    await press('Enter'); await press('e'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const d = await doc(); assert.equal(d.nodes[0].profile, 'loop'); assert.deepEqual(d.nodes[0].segments.map(x => x.kind), ['line', 'arc', 'line', 'arc']);
    await page.locator('.outliner .ol').first().click(); assert.match(await page.locator('.props:not([aria-label$=" panel"])').innerText(), /Faces\s*6/); await iso();
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
    await page.locator('aside[aria-label="Sketch"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-sketch.png`) });
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
    // (O137: the inline editor stays above the top bar. Moved into the bar's band — a dimension in the top 36 px — the
    // point at its middle is the editor, not the bar, and it still takes the value.)
    const above = await page.evaluate(() => {
      const e = document.querySelector('.dim-edit'), was = e.style.top; e.style.top = '8px';
      const r = e.getBoundingClientRect(), bar = document.querySelector('.topbar').getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const out = { inBar: r.top + r.height / 2 < bar.bottom, hit: hit === e }; e.style.top = was; return out;
    });
    assert.deepEqual(above, { inBar: true, hit: true });
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
    // (Waited for: the outliner is drawn again once the fillet's body is evaluated — read at once it could be empty.)
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await iso();
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
    await page.waitForFunction(() => /2 edges|Edges\s*2/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? '') || true, null, { timeout: 2000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
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
    await page.setInputFiles('input[aria-label="Model file"]', join(root, '../../packages/barocss-cad-model/test/fixtures/block-cm.stl'));
    await page.waitForSelector('[aria-label="Mesh units"]');
    assert.match(await page.locator('[aria-label="Mesh units"]').innerText(), /4 × 2 × 1 mm/);
    await page.selectOption('[aria-label="Mesh unit"]', 'cm');
    assert.match(await page.locator('[aria-label="Mesh units"]').innerText(), /40 × 20 × 10 mm/);
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh', null, { timeout: 15000 });
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    assert.match(await page.locator('.toast').innerText(), /STL opened[\s\S]*7,000 mm³/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => /40 × 20 × 10/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.locator('[aria-label="Mesh repair"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-mesh-repair.png`) });
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
    await page.setInputFiles('input[aria-label="Model file"]', join(root, '../../packages/barocss-cad-model/test/fixtures/block-cm.stl'));
    await page.waitForSelector('[aria-label="Mesh units"]');
    await page.selectOption('[aria-label="Mesh unit"]', 'cm');
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const node = (await doc()).nodes[0];
    assert.ok(node.blob && !node.positions, 'the document names its arrays by hash');
    // Unsaved: the recovery copy, its blobs in IndexedDB, restored after a reload.
    await page.waitForTimeout(1500);
    expectLoad(); await page.reload();
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
    await page.waitForFunction(() => /7000 mm³/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.waitForFunction(() => /4022 mm³/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    assert.equal(await drawnLines('measure', '.measure-line'), 1);
  });

  await check('render a part with an appearance, a light and a saved view', async () => {
    await page.click('.mode button:text-is("Render")');
    await page.waitForSelector('[aria-label="Render"]');
    await page.locator('.outliner .ol').first().click();
    await page.selectOption('[aria-label="Appearance preset"]', 'look-brass');
    await page.check('.render-panel [aria-label="Two-sided"]');
    await page.locator('.render-panel').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-render-look.png`) });
    await page.click('.render-panel [role="tab"]:text-is("Lights")');
    await page.click('.render-panel button:text-is("Add point")');
    await page.locator('.render-panel [aria-label="Range"]').last().fill('200');
    await page.locator('.render-panel').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-render-lights.png`) });
    await page.click('.render-panel [role="tab"]:text-is("Scene")');
    // An environment image lighting the part (and its reflections).
    await page.setInputFiles('.render-panel [aria-label="Environment image"]', join(root, 'test/fixtures/sky.png'));
    await page.waitForFunction(() => /^data:image/.test(window.__studioDoc.render.environment.map?.image ?? ''), null, { timeout: 5000 });
    await page.waitForTimeout(600); await snap('render-environment');
    await page.locator('.render-panel').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-render-scene.png`) });
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
    await page.selectOption('[aria-label="Appearance preset"]', 'look-plastic-white');
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
    await page.locator('.direct-panel').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-direct.png`) });
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
    await page.waitForFunction(() => /Volume\s*1200 mm³/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
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
    await page.waitForFunction(() => /Volume\s*1200 mm³/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
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
    expectLoad(); await page.reload();
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
    const g2 = await sectionAgainstCpu('section-instances');
    if (g2) { console.log(`  G2 section with instances, GPU against CPU: ${JSON.stringify(g2)}`); assert.ok(g2.strong <= 0.001 * g2.pixels, `the GPU's section within 0.1 % of the CPU's pixels (by more than 96): ${JSON.stringify(g2)}`); }
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
    // (G-R32: the gizmo as drawn — its origin the same over two frames — before its handles are read; under load a fixed
    // pause read them where the gizmo had been, and the drag missed. Each wait a condition, under a 30 s ceiling.)
    const settled = () => page.waitForFunction(() => new Promise(done => {
      const at = () => { const c = document.querySelector('.gizmo-origin'); return c ? `${c.getAttribute('cx')},${c.getAttribute('cy')}` : ''; };
      const a = at(); requestAnimationFrame(() => requestAnimationFrame(() => done(a !== '' && a === at())));
    }), null, { timeout: 30000 });
    const drag = async (from, to, steps = 8) => { await page.mouse.move(svg.x + from[0], svg.y + from[1]); await page.mouse.down(); await page.mouse.move(svg.x + to[0], svg.y + to[1], { steps }); await page.mouse.up(); };
    // Along X: as far again as the arrow is long on screen moves it the arrow's length in mm.
    await settled();
    const a0 = await pointOf('[data-gizmo=moveX] line:nth-of-type(2)', 0.5), a1 = await pointOf('[data-gizmo=moveX] line:nth-of-type(2)', 1);
    await drag(a0, [a0[0] + (a1[0] - a0[0]) * 2, a0[1] + (a1[1] - a0[1]) * 2]);
    await page.waitForFunction(x => window.__studioDoc.instances[1].position[0] > x + 1, before.position[0], { timeout: 30000 });
    const moved = await page.evaluate(() => window.__studioDoc.instances[1]);
    assert.deepEqual([moved.position[1], moved.position[2], moved.rotation], [before.position[1], before.position[2], before.rotation]);
    // A quarter sweep round the Z arc: the copy turns about world Z in 15° steps.
    await settled();
    const o = await page.evaluate(() => { const c = document.querySelector('.gizmo-origin'); return [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]; });
    const m = await pointOf('[data-gizmo=turnZ] polyline:nth-of-type(2)', 0.5), r = Math.hypot(m[0] - o[0], m[1] - o[1]), a = Math.atan2(m[1] - o[1], m[0] - o[0]);
    await page.mouse.move(svg.x + m[0], svg.y + m[1]); await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(svg.x + o[0] + r * Math.cos(a - k * Math.PI / 40), svg.y + o[1] + r * Math.sin(a - k * Math.PI / 40));
    await page.mouse.up();
    await page.waitForFunction(z => Math.abs(window.__studioDoc.instances[1].rotation[2] - z) >= 15, before.rotation[2], { timeout: 30000 });
    const turned = await page.evaluate(() => window.__studioDoc.instances[1]);
    assert.equal(Math.abs(turned.rotation[2] - before.rotation[2]) % 15, 0, `a 15° step: ${turned.rotation[2]}`);
    await snap('instance-gizmo');
    await press('Meta+z'); await press('Meta+z');
    await page.waitForFunction(b => JSON.stringify(window.__studioDoc.instances[1].position) === JSON.stringify(b), before.position, { timeout: 30000 });
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
    await page.locator('[aria-label="Instance"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-instance.png`) });
    await page.locator('.ol.instance').nth(1).click();
    assert.match(await page.locator('[aria-label="Freedom"]').innerText(), /free: 2 slides$/);
    // With the instance still selected, a History chip opens the feature editor.
    await page.locator('.history .hs').first().click();
    await page.waitForSelector('.node-editor');
    await page.click('[aria-label="Close editor"]');
    await page.evaluate(() => document.activeElement?.blur());
  });

  await check('chat builds a plate through a scripted chat (createChat)', async () => {
    // The chat's turns are scripted in the browser (O17: shadcn's createChat, no server); the studio's end of each turn —
    // its commit, the design history — runs on them as on the chat server's.
    const empty = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} };
    const docOf = nodes => ({ ...empty, nodes, outputs: { [`b${nodes.length - 1}`]: { node: nodes.length - 1, side: 'solid' } } });
    const nodes = [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [64, 32] }, { kind: 'extrude', sketch: 0, height: 8 }];
    const events = [{ type: 'text', delta: 'Plate first.' }, { type: 'tool', name: 'features', input: { action: 'command', command: 'box' }, summary: 'Box → 1 body, 16384 mm³', isError: false }, { type: 'state', doc: docOf(nodes) }];
    for (const [x, y] of [[6, 6], [58, 6], [6, 26], [58, 26]]) {
      nodes.push({ kind: 'hole', parent: { node: nodes.length - 1, side: 'solid' }, center: [x, y], radius: 4 });
      events.push({ type: 'tool', name: 'features', input: { action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 8, x, y } }, summary: 'Hole', isError: false }, { type: 'state', doc: docOf(nodes) });
    }
    nodes.push({ kind: 'fillet', parent: { node: 5, side: 'solid' }, edges: ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3'], radius: 2 });
    const expected = Math.round(64 * 32 * 8 - 4 * Math.PI * 16 * 8 - 4 * (4 - Math.PI) * 8);
    events.push({ type: 'tool', name: 'features', input: { action: 'command', command: 'fillet' }, summary: `Fillet {"radius":2,"endRadius":0,"shape":"circular"} → 1 body, ${expected} mm³`, isError: false }, { type: 'state', doc: docOf(nodes) },
      { type: 'text', delta: 'Done: a 64 × 32 × 8 plate with four Ø8 holes and R2 vertical edges.' }, { type: 'done', doc: docOf(nodes), session: 'cli-session-1', end: 'done' });
    const statusUrl = u => u.pathname === '/api/chat/status';
    await page.route(statusUrl, r => r.fulfill({ json: { enabled: true, model: 'mock-model', via: 'mock' } }));
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Chat"]');
    await page.waitForFunction(() => !!window.__studioScriptChat);
    await page.evaluate(turns => window.__studioScriptChat(turns), [events, ...['You’re welcome.', 'That drawing shows the same plate.'].map(delta => [{ type: 'text', delta }, { type: 'done', session: 'cli-session-1', end: 'done' }])]);
    /** What each turn sent, as the chat server would have received it. */
    const requests = { get: async k => page.evaluate(k => window.__studioChatSent()[k], k), count: async () => page.evaluate(() => window.__studioChatSent().length) };
    const input = page.locator('[aria-label="Chat message"]');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled);
    await input.fill('a 64×32×8 plate with four Ø8 holes 6 mm from the corners and R2 vertical edges'); await press('Enter');
    await page.waitForSelector('.chat-msg.assistant:has-text("Done:")', { timeout: 30000 });
    await page.waitForFunction(() => /Fillet R2/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    assert.deepEqual(await page.evaluate(() => window.__studioDoc.nodes.map(n => n.kind)), ['sketch', 'extrude', 'hole', 'hole', 'hole', 'hole', 'fillet']);
    assert.equal(await page.locator('.chat-tool').count(), 6);
    assert.match(await page.locator('.chat-tool').last().innerText(), new RegExp(`Fillet .*${expected} mm³`));
    { const r0 = await requests.get(0); assert.equal(r0.doc.nodes.length, 0); assert.equal(r0.session, undefined); }
    // The next message resumes the same CLI conversation and leaves the part as it is.
    await input.fill('thanks'); await press('Enter');
    await page.waitForSelector('.chat-msg.assistant:has-text("welcome")');
    { const r1 = await requests.get(1); assert.equal(r1.session, 'cli-session-1'); assert.equal(r1.doc.nodes.length, 7); }
    // An attached drawing goes with the next message, scaled and as base64, shown as a thumbnail.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');
    await page.setInputFiles('[aria-label="Chat image file"]', { name: 'plate.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('[aria-label="Attached images"] img');
    await page.click('[aria-label="Remove plate.png"]'); assert.equal(await page.locator('[aria-label="Attached images"]').count(), 0);
    await page.setInputFiles('[aria-label="Chat image file"]', { name: 'plate.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('[aria-label="Attached images"] img');
    await page.click('.chat-input button:text-is("Send")');
    await page.waitForFunction(() => document.querySelectorAll('.chat-msg.assistant').length >= 3);
    const r2 = await requests.get(2);
    assert.equal(await requests.count(), 3); assert.equal(r2.images.length, 1);
    assert.equal(r2.images[0].media_type, 'image/png'); assert.ok(r2.images[0].data.length > 40);
    assert.match(r2.text, /image 1 \(plate\.png, traced into \d+ layers/);
    // The traced outlines go with every later turn, for the image tools on the server.
    assert.equal(r2.traces.length, 1); assert.ok(Array.isArray(r2.traces[0].layers));
    assert.equal(await page.locator('.chat-msg.user .chat-thumbs img').count(), 1);
    // One undo takes the whole first turn back.
    await page.evaluate(() => document.activeElement?.blur());
    await press('Meta+z'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await press('Meta+Shift+z'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 7);
    await page.click('[aria-label="Close chat"]');
    await page.evaluate(() => window.__studioUnscriptChat()); await page.unroute(statusUrl);
  });

  await check('chat commits an assembly: a pin part mated into a plate', async () => {
    // A mocked turn whose result is an assembly (the tools that build it are covered by the unit tests).
    const empty = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} };
    const plate = { ...empty, nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [64, 32] }, { kind: 'extrude', sketch: 0, height: 8 }, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [32, 16], radius: 4 }], outputs: { b2: { node: 2, side: 'solid' } } };
    const pin = { ...empty, nodes: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 }, { kind: 'extrude', sketch: 0, height: 20 }], outputs: { b1: { node: 1, side: 'solid' } } };
    const doc = { ...plate, instances: [{ id: 'p1', name: 'Pin', doc: pin, position: [32, 16, 8], rotation: [0, 0, 0] }],
      mates: [{ id: 'm1', kind: 'concentric', a: { part: 'base', face: 'n2.side0' }, b: { part: 'p1', face: 'n1.side0' } }, { id: 'm2', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' } }] };
    const events = [
      { type: 'tool', name: 'assembly', input: { action: 'add_part', name: 'Pin' }, summary: 'added part p1 "Pin"', isError: false },
      { type: 'tool', name: 'assembly', input: { action: 'add_mate', kind: 'concentric' }, summary: 'added Concentric 1 (m1)', isError: false },
      { type: 'tool', name: 'assembly', input: { action: 'add_mate', kind: 'coincident' }, summary: 'added Coincident 2 (m2)', isError: false },
      { type: 'state', doc }, { type: 'text', delta: 'Pin mated into the plate.' }, { type: 'done', doc, session: 's-asm', end: 'done' },
    ];
    const statusUrl = u => u.pathname === '/api/chat/status';
    await page.route(statusUrl, r => r.fulfill({ json: { enabled: true, model: 'mock-model' } }));
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Chat"]');
    // (Scripted in the browser, O17: createChat.)
    await page.waitForFunction(() => !!window.__studioScriptChat); await page.evaluate(turns => window.__studioScriptChat(turns), [events]);
    await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled);
    await page.fill('[aria-label="Chat message"]', 'a plate with a pin in its hole, as two parts'); await press('Enter');
    await page.waitForSelector('.chat-msg.assistant:has-text("Pin mated")');
    await page.waitForSelector('.ol.instance:has-text("Pin")', { timeout: 30000 });
    await idle();
    assert.deepEqual(await page.evaluate(() => [window.__studioDoc.instances.length, window.__studioDoc.mates.length, window.__studioDoc.instances[0].position]), [1, 2, [32, 16, 8]]);
    // The studio's own solver keeps it where the mates put it, and the mate panel lists them.
    await page.locator('.ol.instance', { hasText: 'Pin' }).click();
    assert.match(await page.locator('[aria-label="Mates"]').innerText(), /Concentric 1[\s\S]*Coincident 2/);
    await page.locator('[aria-label="Mates"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-mates.png`) });
    await page.evaluate(() => document.activeElement?.blur());
    await press('Meta+z'); await page.waitForFunction(() => !(window.__studioDoc.instances?.length));
    await press('Meta+Shift+z'); await page.waitForFunction(() => window.__studioDoc.instances?.length === 1);
    await page.click('[aria-label="Close chat"]');
    await page.evaluate(() => window.__studioUnscriptChat()); await page.unroute(statusUrl);
  });

  await check('chat renders a scripted conversation (O17): the thinking collapsed, text runs, a tool ok and one failed, an error notice, Stop, a proposal linked to its card, New conversation', async () => {
    const statusUrl = u => u.pathname === '/api/chat/status';
    await page.route(statusUrl, r => r.fulfill({ json: { enabled: true, model: 'mock-model' } }));
    await page.click('[aria-label="New part"]'); await idle();
    const empty = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} };
    const box = { ...empty, nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { kind: 'extrude', sketch: 0, height: 10 }], outputs: { b1: { node: 1, side: 'solid' } } };
    const risk = level => ({ level, features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] });
    const proposal = (id, title, status, level) => ({ id, title, status, by: { agent: 'chat' }, at: '2026-10-24T00:00:00Z', base: 'not-this-part', ops: [], risk: risk(level), summary: title, ...(status === 'open' ? {} : { decided: { by: 'user', at: '2026-10-24T00:00:00Z' } }) });
    const proposed = { ...box, proposals: [proposal('P1', 'Lighter: a Ø6 hole', 'open', 'low'), proposal('P2', 'Thinner walls', 'rejected', 'high')] };
    await page.click('[aria-label="Chat"]');
    await page.waitForFunction(() => !!window.__studioScriptChat);
    await page.evaluate(turns => window.__studioScriptChat(turns), [
      [{ type: 'reasoning', delta: 'A box is the simplest start.' }, { type: 'text', delta: 'A box first.' }, { type: 'tool', name: 'features', input: { action: 'command', command: 'box' }, summary: 'Box → 1 body, 8000 mm³', isError: false }, { type: 'state', doc: box },
        { type: 'tool', name: 'features', input: { action: 'command', command: 'no-such-command' }, summary: 'Unknown command "no-such-command".', isError: true }, { type: 'text', delta: 'Done: a 40 × 20 × 10 box.' }, { type: 'done', doc: box, end: 'done' }],
      [{ type: 'done', end: 'error', error: 'claude exited with 1' }],
      [{ type: 'tool', name: 'features', input: { action: 'command', command: 'hole' }, summary: 'Hole', isError: false }, { type: 'sleep', ms: 20000 }, { type: 'done', end: 'done' }],
      [{ type: 'tool', name: 'proposals', input: { action: 'propose', title: 'Lighter: a Ø6 hole' }, summary: 'proposed P1 Lighter: a Ø6 hole (low risk)', isError: false }, { type: 'text', delta: 'P1 is ready.' }, { type: 'done', doc: proposed, end: 'done' }],
    ]);
    const say = async text => { await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled); await page.fill('[aria-label="Chat message"]', text); await press('Enter'); };
    await say('a box');
    await page.waitForSelector('.chat-msg.assistant:has-text("Done: a 40")');
    assert.equal(await page.locator('.chat-msg.assistant').count(), 2, 'two text runs, either side of the calls');
    assert.equal(await page.locator('.chat-tool').count(), 2); assert.equal(await page.locator('.chat-tool.err').count(), 1);
    assert.match(await page.locator('.chat-tool').first().innerText(), /features\.command\s+Box → 1 body/);
    // (O17c: the thinking, one collapsed line that opens to its text.)
    assert.equal(await page.locator('.chat-thinking').count(), 1); assert.equal(await page.locator('.chat-thinking[open]').count(), 0);
    assert.equal((await page.locator('.chat-thinking summary').innerText()).trim(), 'Thinking…');
    await page.click('.chat-thinking summary'); assert.match(await page.locator('.chat-thinking').innerText(), /simplest start/);
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2);
    await say('again');
    await page.waitForSelector('.chat-msg.notice:has-text("claude exited with 1")');
    await say('a hole, slowly');
    await page.waitForFunction(() => document.querySelectorAll('.chat-tool').length === 3);
    await page.click('.chat-input button:text-is("Stop")');
    await page.waitForSelector('.chat-msg.notice:has-text("Stopped.")', { timeout: 10000 });
    await say('make it lighter');
    await page.waitForSelector('[aria-label="Proposal P1 from the chat"]');
    const card = await page.locator('[aria-label="Proposal P1 from the chat"]').innerText();
    assert.match(card, /P1[\s\S]*Lighter: a Ø6 hole[\s\S]*low risk/); assert.match(card, /rebase it in Proposals/, 'made on another part: stale, rebased from the list');
    assert.equal(await page.locator('[aria-label="Proposal P2 from the chat"]').count(), 0, 'only the proposal its call made');
    await snap('o17-chat-scripted');
    await page.click('[aria-label="New conversation"]');
    await page.waitForFunction(() => !document.querySelector('.chat-msg') && !document.querySelector('.chat-tool'));
    await page.click('[aria-label="Close chat"]');
    await page.evaluate(() => window.__studioUnscriptChat()); await page.unroute(statusUrl);
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
    assert.deepEqual([Math.abs(turned.angle), turned.pivot.length], [45, 3]);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? '') && !/error/i.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 15000 });
    await snap('rotate-x-45');
  });

  await check('Extrude a picked face: E pulls the box top up, joined to the box', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    // (Once the new box is evaluated: new bodies clear what was picked on the old ones.)
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await page.waitForTimeout(250); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    const nodes = (await doc()).nodes.length;
    await page.click('[aria-label="Section view"]');
    await page.waitForSelector('[data-handle="section"]', { timeout: 10000 });
    await page.waitForTimeout(600); await snap('section');
    const g2 = await sectionAgainstCpu('section');
    if (g2) { console.log(`  G2 section, GPU against CPU: ${JSON.stringify(g2)}`); assert.ok(g2.strong <= 0.001 * g2.pixels, `the GPU's section within 0.1 % of the CPU's pixels (by more than 96): ${JSON.stringify(g2)}`); }
    await page.click('[aria-label="Section across X"]'); await page.waitForTimeout(600);
    await page.click('[aria-label="Flip the section"]'); await page.waitForTimeout(600);
    // Dragging the plane: the clipped, capped meshes follow at once (the exact section after).
    // (R1c (3c): the dragged plane is shown from outside React state and committed on release. The section is a view
    // setting, as before: no undo entry, the document unchanged; its handle follows the drag, and stays where it was let go.)
    const undoState = () => page.evaluate(() => { const b = document.querySelector('[aria-label="Undo"]'); return { tip: b?.getAttribute('data-tip'), off: !!b?.disabled }; });
    const undo0 = await undoState(), docBefore = JSON.stringify(await doc());
    const hb = await page.locator('[data-handle="section"]').boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(hb.x + hb.width / 2 + i * 12, hb.y + hb.height / 2 + i * 4);
    await page.waitForTimeout(40); await snap('section-dragging');
    await page.waitForFunction(b => { const r = document.querySelector('[data-handle="section"]')?.getBoundingClientRect(); return !!r && Math.hypot(r.x - b.x, r.y - b.y) > 4; }, hb, { timeout: 30000 });
    const held = await page.locator('[data-handle="section"]').boundingBox();
    await page.mouse.up(); await page.waitForTimeout(600);
    const after = await page.locator('[data-handle="section"]').boundingBox();
    assert.ok(Math.hypot(after.x - held.x, after.y - held.y) < 2, `the plane committed where it was let go: ${JSON.stringify({ held, after })}`);
    assert.deepEqual(await undoState(), undo0, 'a section drag adds no undo entry');
    assert.equal(JSON.stringify(await doc()), docBefore, 'nor changes the document');
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
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.click('[aria-label="New part"]'); await loadSampleSizes(); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await field('At X').fill('0'); await field('At Y').fill('0');
    await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Centre X').fill('32'); await field('Centre Y').fill('16'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    await press('Escape');
    await shape('Fastener'); await hudReady();
    await field('Size').selectOption('M8'); await field('Length').selectOption('20');
    await field('Axis at X').fill('32'); await field('Axis at Y').fill('16'); await field('Seat at Z').fill('8');
    await hudReady(); await page.waitForTimeout(300); await snap('fastener-preview'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.made?.command === 'fastener', null, { timeout: 15000 }); await idle();
    await page.locator('.outliner .ol', { hasText: 'Bolt M8×20' }).click();
    await page.waitForFunction(() => /M8×1\.25 right/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await snap('fastener');
  });

  await check('fastener at a Ø6.6 through hole: fitted M6, washer and nut under the plate, fit shown', async () => {
    await page.click('[aria-label="New part"]'); await loadSampleSizes(); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await field('At X').fill('0'); await field('At Y').fill('0');
    await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Centre X').fill('32'); await field('Centre Y').fill('16'); await field('Diameter').fill('6.6'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    await press('Escape');
    // (The iso view, framed: the hover points below are the hole's walls on this view, not on a camera an earlier step left.)
    await iso();
    await shape('Fastener'); await hudReady();
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
    await loadSampleSizes();
    const before = await page.evaluate(() => window.__studioDoc.nodes.length);
    await shape('Fastener'); await hudReady();
    await field('Part').selectOption('csk-screw'); await field('Size').selectOption('M5'); await field('Length').selectOption('16');
    await field('Axis at X').fill('10'); await field('Axis at Y').fill('10'); await field('Seat at Z').fill('8'); await field('Insert').selectOption('instance');
    await hudReady(); await page.waitForTimeout(400); await snap('fastener-instance-preview'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.instances?.length === 1, null, { timeout: 15000 });
    const inst = await page.evaluate(() => { const i = window.__studioDoc.instances[0]; return { name: i.name, position: i.position, rotation: i.rotation }; });
    assert.deepEqual(inst, { name: 'Countersunk socket screw ISO 10642 M5×0.8 × 16', position: [10, 10, 8], rotation: [0, 0, 0] });
    assert.equal(await page.evaluate(() => window.__studioDoc.nodes.length), before, 'no features joined the part');
    await idle(); await page.waitForTimeout(800); await snap('fastener-instance');
    // A bolt standing clear of the plate shows its cosmetic thread: rings along its shank.
    await shape('Fastener'); await hudReady();
    await field('Part').selectOption('hex-bolt'); await field('Size').selectOption('M8'); await field('Length').selectOption('30');
    await field('Axis at X').fill('90'); await field('Axis at Y').fill('16'); await field('Seat at Z').fill('30');
    await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.made?.values?.x === 90, null, { timeout: 15000 }); await idle();
    await press('Escape'); await press('f'); await page.waitForTimeout(800); await snap('fastener-threads');
    // Modelled: the thread as helical B-spline faces (one solid), its head and seat named for mates.
    await shape('Fastener'); await hudReady();
    await field('Part').selectOption('hex-bolt'); await field('Size').selectOption('M8'); await field('Length').selectOption('30');
    await field('Axis at X').fill('120'); await field('Axis at Y').fill('16'); await field('Seat at Z').fill('30'); await field('Thread').selectOption('modelled');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'thread', null, { timeout: 30000 }); await idle();
    await page.locator('.outliner .ol', { hasText: 'Bolt M8×30' }).last().click();
    await page.waitForFunction(() => /modelled|M8×1\.25/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__studioDoc.nodes.at(-1).form), 'helical');
    await press('Escape');
    assert.ok(await page.evaluate(() => window.__studioSelectFace(`n${window.__studioDoc.nodes.length - 1}.head`)), 'the bolt head picked by name');
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await shape('Cylinder'); await hudReady();
    await page.mouse.move(sx - 6, sy, { steps: 3 }); await page.mouse.move(sx, sy); await page.waitForTimeout(300); await page.mouse.click(sx, sy);
    await page.waitForFunction(() => /placed/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 5000 });
    await hudReady(); await page.waitForTimeout(250); await snap('side-cylinder'); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'rotate' && window.__studioDoc.nodes.at(-1)?.made?.values.up === '+x', null, { timeout: 15000 });
  });

  await check('each body has its own material, and its mass follows', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    const mass = () => page.evaluate(() => Number((/Mass\s*([\d.]+)/.exec(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? '') ?? [])[1]));
    const before = await mass();
    const steel = await page.evaluate(() => [...document.querySelectorAll('select[aria-label="Material"] option')].find(o => /Steel/.test(o.textContent))?.value);
    await page.selectOption('select[aria-label="Material"]', steel);
    await page.waitForFunction(m => window.__studioDoc.bodies?.b1?.material && Number((/Mass\s*([\d.]+)/.exec(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? '') ?? [])[1]) > m * 2, before, { timeout: 5000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await page.waitForTimeout(250); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    await page.click('.outliner [aria-label="Show its features"]');
    await page.waitForFunction(() => document.querySelectorAll('.outliner .ol-step').length === 2, null, { timeout: 5000 });
    await page.locator('.outliner .ol-step', { hasText: 'Hole' }).click();
    await page.waitForFunction(() => /EDIT FEATURE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? '') && /Diameter/.test(document.querySelector('.node-editor')?.textContent ?? ''), null, { timeout: 5000 });
  });

  await check('hole types: a countersunk hole and a tapped M6 on a box top', async () => {
    await page.click('[aria-label="New part"]'); await loadSampleSizes(); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Type').selectOption('countersink'); await field('Centre X').fill('9'); await hudReady(); await page.waitForTimeout(300);
    await snap('hole-countersink'); await press('Shift+Enter');
    // One history step, a hole of its own with the countersink (the kernel cuts the cone).
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 3 && window.__studioDoc.nodes.at(-1)?.kind === 'hole' && window.__studioDoc.nodes.at(-1)?.countersink > 0, null, { timeout: 15000 });
    // (The step's label in the Browser: the history bar is hidden again at once, the command running on — Shift+Enter —
    // and a wait for it caught it only while the restart was late.)
    await page.waitForFunction(() => /Countersunk Ø/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await page.waitForFunction(() => /Hole/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 10000 });
    await field('Type').selectOption('tapped'); await field('Centre X').fill('23'); await hudReady(); await page.waitForTimeout(300);
    // (A bolt circle of the tapped holes: four round the top's middle.)
    await field('Copies').selectOption('circle'); await field('Count').fill('4'); await hudReady(); await page.waitForTimeout(300); await snap('hole-bolt-circle');
    assert.equal(await field('Diameter').inputValue(), '5');
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.thread === 'M6×1' && window.__studioDoc.nodes.at(-1)?.pattern?.count === 4, null, { timeout: 15000 }); await idle();
    await snap('hole-types');
  });

  await check('O14 / O16: the Library\'s shop rows on shadcn — none of the mount rows built in; Load sample mounts loads the four (its receipt kept), a file adds one', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]');
    try {
      assert.match(await page.textContent('[aria-label="Mounts loaded"]'), /none — a mount needs its row/);
      await page.click('[aria-label="Load sample mounts"]');
      await page.waitForFunction(() => window.__studioDoc.mounts?.rows?.length === 4 && window.__studioDoc.rowSources?.rows?.some(r => r.kind === 'mounts' && r.file.filename === 'cad-model sample mounts.json'), null, { timeout: 10000 });
      assert.match(await page.textContent('[aria-label="Mounts loaded"]'), /nema17, nema23, ucp204, ucfl204/);
      const row = { id: 'my-motor', type: 'motor', holes: { pattern: 'square', spacing: 31, diameter: 3.4 }, shaft: 5, shaftHeight: 0, clearance: 0.5, estimate: true };
      await page.setInputFiles('[aria-label="Mounts file"]', { name: 'my-mounts.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([row])) });
      await page.waitForFunction(() => window.__studioDoc.mounts?.rows?.length === 5, null, { timeout: 10000 });
      assert.match(await page.textContent('[aria-label="Mounts loaded"]'), /my-motor/);
      // (O16: the panel at 1440 in the dock, for the checkpoint.)
      await page.locator('[aria-label="Shop rows"]').screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-shop-rows.png`) });
      await page.locator('[aria-label="Library panel"]').screenshot({ path: join(out, `${String(step).padStart(2, '0')}b-o16-library.png`) });
    } finally { await page.click('[aria-label="Close library"]'); }
  });

  await check('O7e: no fastener sizes loaded — a tapped hole is refused in the HUD with [FASTENER_SIZE_ROW], the Library says none; loading the sample (the person’s click, its receipt kept) gives the seven sizes', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && !window.__studioDoc.fastenerSizes, null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Type').selectOption('tapped'); await page.waitForTimeout(400);
    await page.waitForFunction(() => /\[FASTENER_SIZE_ROW\] no row for M6/.test(document.querySelector('.hud')?.textContent ?? ''), null, { timeout: 10000 });
    await snap('o7e-tapped-refused'); await press('Escape'); await press('Escape');
    await page.click('[aria-label="Library"]');
    try {
      assert.match(await page.textContent('[aria-label="Fastener sizes loaded"]'), /none — fasteners and tapped holes need them/);
      await page.click('[aria-label="Load sample fastener sizes"]');
      await page.waitForFunction(() => window.__studioDoc.fastenerSizes?.rows?.length === 7 && window.__studioDoc.rowSources?.rows?.some(r => r.kind === 'fastener-sizes' && r.file.filename === 'cad-model sample fastener-sizes.json' && r.file.suppliedBy === 'person'), null, { timeout: 10000 });
      assert.match(await page.textContent('[aria-label="Fastener sizes loaded"]'), /M3, M4, M5, M6, M8, M10, M12/);
    } finally { await page.click('[aria-label="Close library"]'); }
  });

  await check('a cross hole whose side touches a vertical hole’s wall from inside goes in', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    // Ø6 down through the top at (13, 16): its wall reaches x = 10.
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Diameter').fill('6'); await field('Centre X').fill('13'); await field('Centre Y').fill('16'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 3, null, { timeout: 15000 }); await idle();
    // Ø4 across from the front at x = 12, z = 8: its side at x = 10 touches that wall at (10, 16, 8).
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.side0')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? '') && /0, -1, 0/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await field('Diameter').fill('4'); await field('Centre X').fill('12'); await field('Centre Z').fill('8'); await hudReady();
    await page.waitForFunction(() => /preview/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 4 && window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 15000 }); await idle();
    // 32 × 32 × 16 less Ø6 × 16 and Ø4 × 32 plus their overlap (integrated): 15594.74 mm³.
    await page.locator('.outliner .ol', { hasText: 'Box' }).first().click();
    await page.waitForFunction(() => /Volume\s*1559[45]/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    await snap('tangent-holes');
  });

  await check('mass: a box body shows its inertia (about its centre or the origin) and its bounding box; the part sums up', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await press('Escape'); await page.waitForTimeout(200);
    assert.match(await page.locator('.props:not([aria-label$=" panel"])').innerText(), /PART · 1 body[\s\S]*Mass/);
    await page.locator('.outliner .ol', { hasText: 'Box' }).first().click();
    await page.waitForSelector('[aria-label="Moments of inertia"]', { timeout: 5000 });
    const centre = await page.locator('[aria-label="Moments of inertia"]').innerText();
    await page.selectOption('[aria-label="Inertia about"]', 'origin');
    assert.notEqual(await page.locator('[aria-label="Moments of inertia"]').innerText(), centre);
    await page.locator('[aria-label="Show the bounding box"]').first().check();
    await page.waitForFunction(() => document.querySelector('.viewport')?.dataset.renderer === 'webgpu' ? window.__studioOverlayLines?.().bbox === 12 : !!document.querySelector('.vp-overlay .bbox-line'), null, { timeout: 5000 }); await snap('mass-box');
  });

  await check('selection filter: Edges skips faces, Bodies picks the whole body, Pick all is back', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle(); await press('Escape');
    const [fx, fy] = await page.evaluate(() => window.__studioScreenOf([16, 16, 16]));
    const filter = page.locator('[aria-label="Selection filter"]'), props = () => page.locator('.props:not([aria-label$=" panel"])').innerText();
    await filter.click(); await filter.click(); assert.match(await filter.innerText(), /Edges/);
    await page.mouse.click(fx, fy); await page.waitForTimeout(300);
    assert.doesNotMatch(await props(), /SELECTION · FACE/, 'a face is not picked with Edges');
    await filter.click(); assert.match(await filter.innerText(), /Bodies/);
    // (A body made by a shape command opens for editing when picked whole.)
    await page.mouse.click(fx, fy); await page.waitForFunction(() => /Edit Box/.test(document.querySelector('.hud')?.textContent ?? '') || /BODY/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await press('Escape'); await page.waitForTimeout(200);
    await filter.click(); assert.match(await filter.innerText(), /Pick all/);
    await page.mouse.click(fx, fy); await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await snap('parameters');
    // (O16: the panel at 1440 in the dock.)
    await page.locator('aside[aria-label="Parameters panel"]').screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-parameters.png`) });
    await page.click('[aria-label="Close parameters"]');
  });

  await check('a cut right through a box leaves two pieces; Separate makes them two bodies', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    const hole = (d, x = 10, y = 10) => ({ tool: 'features', args: { action: 'command', command: 'hole', faces: ['n1.top'], values: { d, x, y } } });
    const box = { tool: 'features', args: { action: 'add', features: [{ kind: 'sketch', profile: 'rectangle', min: [50, 0], max: [60, 10] }, { kind: 'extrude', sketch: 4, height: 5 }] } };
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
    // (O18: the ghost tints the body the proposal changes — told by its key and mesh, not its volume — unless the
    // engine draws the two-colour overlay.)
    const ghostShown = await page.evaluate(() => ({ method: window.__studioProposalOverlay?.()?.method ?? null, colored: window.__studioBodies().colored }));
    console.log(`  O18 ghost (${renderer}): overlay ${ghostShown.method}, tinted ${ghostShown.colored.join(',') || 'none'}`);
    if (ghostShown.method !== 'boolean') assert.equal(ghostShown.colored.length, 1, JSON.stringify(ghostShown));
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
      const firstBox = { tool: 'features', args: { action: 'command', command: 'box', values: { w: 32, d: 32, h: 16, x: 0, y: 0, z: 0 } } };
      await send([firstBox, { tool: 'features', args: { action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 4, x: 8, y: 8 } } }]);
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 3, null, { timeout: 20000 });
      await page.waitForSelector('.toast:has-text("Applied by the agent")', { timeout: 10000 });
      await page.click('.toast button:text-is("Undo")');
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 10000 });
      await send([firstBox]);
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
      // A value of one feature: applied directly, said so with an undo.
      const h0 = (await doc()).nodes[1].height;
      await send([{ tool: 'features', args: { action: 'edit', index: 1, values: { h: h0 + 4 } } }]);
      await page.waitForFunction(h => window.__studioDoc.nodes[1]?.height === h, h0 + 4, { timeout: 20000 }).catch(async e => { throw new Error(`${e.message.split('\n')[0]}: ${JSON.stringify((await doc()).nodes)} ${await page.locator('.chat-panel, .chat').first().innerText().catch(() => '')}`); });
      await page.waitForSelector('.toast:has-text("Applied by the agent")', { timeout: 10000 });
      await snap('l2-applied');
      await page.click('.toast button:text-is("Undo")');
      await page.waitForFunction(h => window.__studioDoc.nodes[1]?.height === h, h0, { timeout: 10000 });
      // Two features in one change: refused (needs_proposal), the part unchanged; proposed, it waits for the user.
      const hole = { tool: 'features', args: { action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 6, x: 10, y: 10 } } }, taller = { tool: 'features', args: { action: 'edit', index: 1, values: { h: h0 + 4 } } };
      await send([{ tool: 'features', args: { action: 'batch', ops: [taller, hole] } }, { tool: 'proposals', args: { action: 'propose', title: 'Taller, with a hole', ops: [taller, hole] } }]);
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
    await page.waitForFunction(() => /Volume/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    await page.evaluate(() => {
      const seen = window.__staleWatch = { evaluating: 0, bad: [] };
      const look = () => {
        const props = document.querySelector('.props:not([aria-label$=" panel"])'), name = props?.querySelector('input[aria-label="Name"]')?.value ?? '', text = props?.textContent ?? '';
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
    await page.waitForFunction(() => /Mesh ring/.test(document.querySelector('.props:not([aria-label$=" panel"]) input')?.value ?? '') && /Volume/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    const vol = Number(/Volume\s*([\d,]+) mm³/.exec(await page.textContent('.props:not([aria-label$=" panel"])'))?.[1].replace(/,/g, ''));
    const ring = 2 * Math.PI * Math.PI * 20 * 25;
    assert.ok(vol < ring && vol > ring - 2 * Math.PI * 4 * 10, `${vol}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('mesh-hole');
  });

  await check('Spur gear (R6a, issue #2167; R12b.1a): from the palette — m 2, 20 teeth; its notes give the dimensions, the flank fit and the root the rack cuts', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('spur gear'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'gear' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    assert.match(await page.textContent('.history'), /Spur gear m2 z20/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /Reference Ø40, tip Ø44, root Ø35/.test(t)) && notes.some(t => /Root cut by the basic rack \(tip radius 0\.76 mm\): the involute from Ø37\.6401 \(the form circle\)/.test(t)) && !notes.some(t => /Schematic root/.test(t)), notes.join(' | '));
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

  await check('Generated root (R12b.1a, D130): a 12-tooth pinion from the palette is cut as the rack cuts it — undercut, said in its notes; the node editor\'s tool tip radius and Root (to the schematic one, on 20 teeth)', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('spur gear'); await press('Enter'); await hudReady();
    await field('Teeth').fill('12'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'gear' && window.__studioDoc.nodes[0].teeth === 12 && window.__studioDoc.nodes[0].generator === 'spur-gear@1' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /Root cut by the basic rack \(tip radius 0\.76 mm\): the involute from Ø22\.6054 \(undercut\)/.test(t)) && notes.some(t => /undercut: the tool's tip cuts the involute away below Ø22\.6054/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Top")'); await press('f'); await page.waitForTimeout(500);
    await snap('gear-generated-root-undercut');
    // The node editor: the tool's tip radius, then the schematic root on 20 teeth.
    await page.locator('.history .hs', { hasText: 'Spur gear' }).click();
    const ed = (label) => page.locator('.node-editor .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input, select');
    assert.equal(await ed('Root').inputValue(), 'spur-gear@1'); assert.equal(await ed('Tool tip radius').inputValue(), '0.76');
    await ed('Tool tip radius').fill(''); await ed('Tool tip radius').fill('0.6');
    await page.locator('.node-editor button', { hasText: 'Apply' }).click(); await idle();
    await page.waitForFunction(() => window.__studioDoc.nodes[0].toolTipRadius === 0.6, null, { timeout: 15000 });
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /tip radius 0\.6 mm/.test(n.textContent ?? '')), null, { timeout: 15000 });
    await page.locator('.history .hs', { hasText: 'Spur gear' }).click();
    await ed('Teeth').fill(''); await ed('Teeth').fill('20'); await ed('Root').selectOption('spur-gear@0');
    await page.locator('.node-editor button', { hasText: 'Apply' }).click(); await idle();
    await page.waitForFunction(() => window.__studioDoc.nodes[0].generator === 'spur-gear@0' && window.__studioDoc.nodes[0].teeth === 20 && window.__studioDoc.nodes[0].toolTipRadius === undefined, null, { timeout: 15000 });
    await page.locator('.outliner .ol').first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /Schematic root/.test(n.textContent ?? '')), null, { timeout: 15000 });
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

  await check('Generated root on a helical gear, the rack\'s root fillet (R12b.1b, D131): a helical gear from the palette is cut by the rack (spur-gear@1); a rack under it has the basic rack\'s fillets (spur-rack@1), the pair clear', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('spur gear'); await press('Enter'); await hudReady();
    await field('Helix angle β').fill('20'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'gear' && window.__studioDoc.nodes[0].helixAngle === 20 && window.__studioDoc.nodes[0].generator === 'spur-gear@1' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /Helical β 20° right hand/.test(t)) && notes.some(t => /^Root cut by the basic rack \(tip radius 0\.76 mm\): the involute from Ø[\d.]+ \(the form circle\)/.test(t)) && !notes.some(t => /Schematic root/.test(t)), notes.join(' | '));
    await press(' '); await page.locator('.palette input').fill('gear rack'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[1]?.kind === 'rack' && window.__studioDoc.nodes[1].generator === 'spur-rack@1' && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    await page.locator('.outliner .ol').nth(1).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /Meshes with n0/.test(n.textContent ?? '')), null, { timeout: 20000 });
    const rack = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(rack.some(t => /^Helical rack β 20° left hand/.test(t)) && rack.some(t => /^Root fillets 0\.76 mm \(the basic rack's\)/.test(t)) && rack.some(t => /Clear over a full tooth period/.test(t)), rack.join(' | '));
    await page.click('.views button:text-is("Front")'); await press('f'); await page.waitForTimeout(500);
    await snap('helical-generated-rack-fillet');
  });

  await check('Internal gear (R12b.2a, D132; R12b.2b, D133): a ring from the palette (x2 0.5, its root cut by a 24-tooth cutter); a pinion inside it by Meshing gear with the ring selected — at the internal distance, the same way, clear, radial assembly clear', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('internal gear'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'internal-gear' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    assert.match(await page.textContent('.history'), /Internal gear m2 z60/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /^Profile shift 0\.5 \(default: clears rack-cut pinions; see D132\): Internal: reference Ø120, tip Ø118 \(inside\), root Ø126\.837/.test(t)) && notes.some(t => /^Root cut by a 24-tooth pinion-type cutter/.test(t)), notes.join(' | '));
    await press(' '); await page.locator('.palette input').fill('meshing gear'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[1]?.kind === 'gear' && window.__studioDoc.nodes[1].mesh?.gear === 0 && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    assert.match(await page.textContent('.history'), /Spur gear m2 z24/);
    await page.locator('.outliner .ol').nth(1).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /Meshes inside n0/.test(n.textContent ?? '')), null, { timeout: 30000 });
    const pin = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(pin.some(t => /^Meshes inside n0: centre distance 36\.9185 mm, ratio \+24:60 \(the same way\)/.test(t)) && pin.some(t => /^Clear over a full tooth period/.test(t)) && pin.some(t => /^Radial assembly clear/.test(t)), pin.join(' | '));
    await page.click('.views button:text-is("Top")'); await press('f'); await page.waitForTimeout(500);
    await snap('internal-gear-pinion');
  });

  await check('Bevel gear (R12b.3, D134): a straight bevel pinion from the palette (spherical involute, z 20 for 40, Σ 90°); its mate by Meshing gear with it selected — the same apex, ratio 20:40, clear on the heel sphere', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('bevel gear'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'bevel-gear' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    assert.match(await page.textContent('.history'), /Bevel gear m2 z20\/40/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /^Straight bevel, spherical involute: reference Ø40 at the heel, pitch cone 26\.5651°/.test(t)) && notes.some(t => /^Tredgold's virtual spur gear: 22\.36 teeth \(an estimate/.test(t)), notes.join(' | '));
    await press(' '); await page.locator('.palette input').fill('meshing gear'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[1]?.kind === 'bevel-gear' && window.__studioDoc.nodes[1].mesh?.gear === 0 && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    assert.match(await page.textContent('.history'), /Bevel gear m2 z40\/20/);
    await page.locator('.outliner .ol').nth(1).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /Meshes with n0/.test(n.textContent ?? '')), null, { timeout: 30000 });
    const mate = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(mate.some(t => /^Meshes with n0: the same apex, shaft angle 90°, ratio 20:40/.test(t)) && mate.some(t => /^Clear over a full tooth period on the heel sphere/.test(t)), mate.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('bevel-pair');
  });

  await check('Spiral bevel gear (R12b.4, D135): from the palette with a spiral angle — labelled and noted an ideal model; its mate by Meshing gear — the other hand, clear on five spheres, the thrust said', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('bevel gear'); await press('Enter'); await hudReady();
    await field('Spiral angle β (0 straight; above 0: an ideal model)').fill('35'); await hudReady();
    await field('Cutter radius (0: the mean cone distance, an estimate)').fill('40'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'bevel-gear' && window.__studioDoc.nodes[0].spiral?.angle === 35 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    assert.match(await page.textContent('.history'), /Spiral bevel gear m2 z20\/40 \(ideal model\)/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    // (A warning note's text begins with its icon's name.)
    assert.ok(/^(warning )?Ideal model: a spiral bevel gear in line contact/.test(notes[0]) && notes.some(t => /^Spiral β_m 35° left hand on a 40 mm cutter radius/.test(t)), notes.join(' | '));
    await press(' '); await page.locator('.palette input').fill('meshing gear'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[1]?.kind === 'bevel-gear' && window.__studioDoc.nodes[1].mesh?.gear === 0 && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    assert.match(await page.textContent('.history'), /Spiral bevel gear m2 z40\/20 \(ideal model\)/);
    await page.locator('.outliner .ol').nth(1).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /Meshes with n0/.test(n.textContent ?? '')), null, { timeout: 30000 });
    const mate = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(mate.some(t => /^Spiral β_m 35° right hand/.test(t)) && mate.some(t => /^Clear over a full tooth period on 5 spheres from the toe to the heel/.test(t)) && mate.some(t => /^Axial thrust: n0 driving clockwise seen from its apex/.test(t)), mate.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('spiral-bevel-pair');
  });

  await check('Worm gear pair (R12b.5, D136): K1\'s pair from the palette — the wheel a helical gear at the lead angle, the ZI worm meshing with it crossed at 90°; its notes, clear in the mid-plane and ±b/3', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('worm gear pair'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[1]?.kind === 'worm' && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    assert.match(await page.textContent('.history'), /Helical gear mn2\.97 z30.*Worm ZI m_x3 ×2 Ø44/);
    await page.locator('.outliner .ol').nth(1).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /Meshes with n0/.test(n.textContent ?? '')), null, { timeout: 30000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /^Worm ZI \(involute helicoid\): reference Ø44, tip Ø50, root Ø36\.5/.test(t)) && notes.some(t => /^Meshes with n0: crossed at 90°, centre distance 67 mm, ratio 30:2 \(15:1\)/.test(t)) && notes.some(t => /^Clear over an axial pitch in the wheel's mid-plane/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('worm-pair');
  });

  await check('Throated worm wheel (R12b.6, D137): K1\'s pair from the palette with the throated wheel — cut by a hob of its ZA worm; the worm meshing with it in contact along lines', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('worm gear pair'); await press('Enter'); await hudReady();
    await field('Wheel').selectOption('throated'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 60000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'worm-wheel' && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 90000 }); await idle();
    assert.match(await page.textContent('.history'), /Throated worm wheel m_x3 z30.*Worm ZA m_x3 ×2 Ø44/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const wheel = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(wheel.some(t => /^Throated worm wheel, cut by a hob of its ZA worm's thread: reference Ø90, throat Ø96/.test(t)), wheel.join(' | '));
    await page.locator('.outliner .ol').nth(1).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(n => /enveloping it/.test(n.textContent ?? '')), null, { timeout: 60000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /^In contact along lines across the face/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('throated-worm-pair');
  });

  await check('Spring (R12c.1a, D153): a compression spring from the palette — closed and ground, steel\'s G an estimate; its notes (sizes, solid heights, the rate flagged), the ground ends flat at Z 0 and L0', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('spring'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'spring' && /1 bod/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    assert.match(await page.textContent('.history'), /Ground spring d2 × Ø20, 6 coils/);
    const node = await page.evaluate(() => window.__studioDoc.nodes[0]);
    assert.ok(node.shearModulus === 79300 && node.shearModulusEstimate === true && node.ends === 'closed-ground', JSON.stringify(node));
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
    assert.ok(notes.some(t => /Compression spring, right hand, ends closed and ground: wire Ø2, mean Ø20/.test(t)) && notes.some(t => /Solid height 16\.0081 mm/.test(t)) && notes.some(t => /^(warning )?Rate 3\.3042 N\/mm .*an estimate for steel/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('spring-ground');
  });


  // ---- O18: mass on request -----------------------------------------------------------------------------------------
  await check('O18: a spring\'s reply comes without its mass, which follows; the inspector reads "…" until then; an undo right after the reply does not wait for the old mass', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    // (Seven coils: not the spring the step before built, whose B-rep's mass the worker still holds.)
    await press(' '); await page.locator('.palette input').fill('spring'); await press('Enter'); await hudReady();
    await field('Active coils').fill('7'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    const t0 = Date.now(); await press('Enter');
    // The reply: its body with a mass ref and no mass yet (the preview's bodies, shown on Apply, carry neither).
    await page.waitForFunction(() => { const b = window.__studioBodies?.()?.bodies; return window.__studioDoc.nodes[0]?.kind === 'spring' && b?.length === 1 && (b[0].massRef !== null || b[0].volume !== null); }, null, { timeout: 60000 });
    const replied = Date.now() - t0, at = await page.evaluate(() => { const b = window.__studioBodies(); return { massReady: b.massReady, bodies: b.bodies }; });
    assert.ok(!at.massReady && at.bodies[0].massRef !== null && at.bodies[0].volume === null, `the reply came before the mass: ${JSON.stringify(at)}`);
    // An undo at once: its reply (an empty part) does not wait for the spring's quadrature, which it drops.
    const t1 = Date.now(); await page.evaluate(() => document.activeElement?.blur?.()); await press('Meta+z');
    await page.waitForFunction(() => { const b = window.__studioBodies?.(); return b?.fresh && b.bodies.length === 0 && window.__studioDoc.nodes.length === 0; }, null, { timeout: 10000 });
    const undone = Date.now() - t1;
    assert.ok(undone < 1500, `the undo's reply took ${undone} ms`);
    // Redo: the spring again, its mass "…" in the inspector, then its value.
    await press('Meta+Shift+z');
    await page.waitForFunction(() => { const b = window.__studioBodies?.()?.bodies; return b?.length === 1 && (b[0].massRef !== null || b[0].volume !== null); }, null, { timeout: 60000 });
    await page.locator('.outliner .ol').first().click();
    const early = await page.locator('.props:not([aria-label$=" panel"])').innerText();
    const shown = await bodyVolume(), mass = await page.evaluate(() => window.__studioBodies().bodies[0].volume);
    assert.ok(mass > 0 && Math.abs(shown - mass) <= 1, `${shown} shown, ${mass}`);
    if (/Volume …/.test(early)) console.log('  O18: the inspector read "…" before the mass');
    else console.log('  O18: the mass came before the inspector was read');
    assert.ok(!/Volume 0 mm³/.test(early), 'never 0 while pending');
    console.log(`  O18 spring (${renderer}): reply ${replied} ms after Apply, the undo's reply ${undone} ms`);
    await press('Escape');
  });
  await check('Spring (R12c.1b, D154): an extension spring with machine loops and a torsion spring with legs from the palette — close-wound, their notes (length inside the hooks, the legs\' angle, the rates flagged)', async () => {
    for (const [type, kind, label, note] of [['extension', 'extension', /Extension spring d2 × Ø20, 6 coils \(machine loops\)/, /^Length inside the hooks 34\.3779 mm/], ['torsion', 'torsion', /Torsion spring d2 × Ø20, 6 coils/, /^Legs 20 and 20 mm along the coil's tangent, 0° apart/]]) {
      await page.click('[aria-label="New part"]'); await idle();
      await press(' '); await page.locator('.palette input').fill('spring'); await press('Enter'); await hudReady();
      await field('Type').selectOption(type); await hudReady();
      await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
      await press('Enter');
      await page.waitForFunction(k => window.__studioDoc.nodes[0]?.kind === 'spring' && window.__studioDoc.nodes[0]?.type === k && /1 bod/.test(document.querySelector('.outliner')?.textContent ?? ''), kind, { timeout: 60000 }); await idle();
      assert.match(await page.textContent('.history'), label);
      await page.locator('.outliner .ol').first().click();
      await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
      const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
      assert.ok(notes.some(t => note.test(t.replace(/^warning /, ''))) && notes.some(t => /^(warning )?Rate .*an estimate for steel/.test(t)), notes.join(' | '));
      await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
      await snap(`spring-${type}`);
    }
  });

  await check('Cam (R12c.6a, D160): a disc cam from the palette — S0\'s roller cam, cycloidal rise and return; its notes (the program, the pressure angle against a rule of thumb, the pitch curve\'s least radius above the roller, the fit and the follower on the built profile)', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('cam'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'cam' && /1 bod/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    assert.match(await page.textContent('.history'), /Cam for a roller follower, base R20, lift 8/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const notes = (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.replace(/^warning /, ''));
    assert.ok(notes.some(t => /^Motion: rise to 8 mm over 0–120° \(cycloidal\), dwell to 180°/.test(t)) && notes.some(t => /^Pressure angle at most 14\.8683° .*a rule of thumb, an estimate/.test(t)) && notes.some(t => /least convex radius 23\.6902 .* no undercut/.test(t)) && notes.some(t => /^Profile within .* the follower found on the built profile/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Top")'); await press('f'); await page.waitForTimeout(500);
    await snap('cam-roller');
  });

  // (The user's bearing, O-ring and fit rows loaded in the Library panel first — none built in, the agent cannot load rows;
  // the second bearing held by the ring, the spring's solid height in its notes.)
  await check('R12c.8 acceptance by the scripted agent in the real chat: a gearbox output shaft (8 bodies) and a spring-loaded plunger (3), one turn each (D163)', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      for (const [name, bodies, at, note] of [['gearbox-shaft', 8, 'Bearing 6204 on step 3', /^On step 3 from 44 to 58, against the Ø25 shoulder \(fillet r 0\.5\); its other side by ring groove 1; no overlap with the shaft$/], ['plunger', 3, 'Ground spring d2', /^Solid height 16\.0081 mm/]]) {
        const fixture = JSON.parse(fs.readFileSync(join(root, `../../packages/barocss-cad-model/test/fixtures/r12c-${name}.calls.json`), 'utf8'));
        await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
        if (fixture.rows.bearings) {
          // (The user's rows, loaded in the Library panel: the agent cannot load rows.)
          const files = [['Bearing rows file', 'bearings', fixture.rows.bearings.rows], ['O-ring rows file', 'orings', fixture.rows.orings.rows], ['Fit table file', 'fits', fixture.rows.fits.tables[0]]];
          await page.click('[aria-label="Library"]');
          try {
            for (const [label, field, data] of files) {
              const file = join(out, `r12c-8-${field}.json`); fs.writeFileSync(file, JSON.stringify(data));
              await page.setInputFiles(`input[aria-label="${label}"]`, file);
              await page.waitForFunction(f => (f === 'fits' ? window.__studioDoc.fits?.tables?.length : window.__studioDoc[f]?.rows?.length) === 1, field, { timeout: 10000 });
            }
          } finally { await page.click('[aria-label="Close library"]'); }
        }
        await page.click('[aria-label="Chat"]');
        await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls: fixture.calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 240000 });
        const line = await page.locator('.chat-tool').last().innerText();
        assert.ok(line.includes('query.interference'), line);
        await page.click('[aria-label="Close chat"]');
        await page.waitForFunction(k => new RegExp(`${k} bodies`).test(document.querySelector('.outliner')?.textContent ?? ''), bodies, { timeout: 120000 }); await idle();
        await page.locator('.outliner .ol').filter({ hasText: at }).first().click();
        await page.waitForFunction(re => [...document.querySelectorAll('[aria-label="Generator note"]')].some(x => new RegExp(re).test((x.textContent ?? '').replace(/^warning\s*/, '').trim())), note.source, { timeout: 60000 });
        await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
        await snap(`r12c-8-${name}`);
      }
    } finally { chat.kill(); }
  });

  await check('R12b.7 the gears\' acceptance by the scripted agent through the real chat: a planetary set (its own mesh checks passing), a right-angle bevel pair, a worm reducer — each in one turn, its pairs clear in their notes (new in D138)', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      // (Each: the bodies, the last tool the agent called, and the body — by its name in the outliner — whose note says its pair is clear.)
      for (const [name, bodies, tool, at, note] of [['planetary', 5, 'requirements.check', 'Spur gear m2 z24', /Meshes with n1: centre distance 42\.928 mm, ratio −18:24/], ['bevel-pair', 2, 'query.summary', 'Bevel gear m3 z40/20', /Clear over a full tooth period on the heel sphere/], ['worm-reducer', 2, 'query.summary', 'Worm ZA m_x3 ×1 Ø44', /In contact along lines across the face/]]) {
        const { calls } = JSON.parse(fs.readFileSync(join(root, `../../packages/barocss-cad-model/test/fixtures/gear-${name}.calls.json`), 'utf8'));
        await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
        await page.click('[aria-label="Chat"]');
        await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 180000 });
        const line = await page.locator('.chat-tool').last().innerText();
        assert.ok(line.includes(tool), line);
        await page.click('[aria-label="Close chat"]');
        await page.waitForFunction(k => new RegExp(`${k} bodies`).test(document.querySelector('.outliner')?.textContent ?? ''), bodies, { timeout: 90000 }); await idle();
        // (The planetary set's sun was checked by the agent against each planet: its requirements all pass.)
        if (name === 'planetary') assert.ok((await page.evaluate(() => window.__studioDoc.requirements?.length)) === 3);
        await page.locator('.outliner .ol').filter({ hasText: at }).first().click();
        await page.waitForFunction(re => [...document.querySelectorAll('[aria-label="Generator note"]')].some(x => new RegExp(re).test(x.textContent ?? '')), note.source, { timeout: 60000 });
        if (name === 'planetary') {
          const notes = await page.locator('[aria-label="Generator note"]').allInnerTexts();
          assert.ok(notes.some(t => /^Clear over a full tooth period/.test(t)), notes.join(' | '));
        }
        await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
        await snap(`r12b-7-${name}`);
      }
    } finally { chat.kill(); }
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
    const vol = await bodyVolume();
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
      await send([{ tool: 'features', args: { action: 'command', command: 'subd-box', values: { w: 30, d: 20, h: 16, n: 2, x: 0, y: 0, z: 0 } } }, { tool: 'subd', args: { action: 'cage', index: 0 } }]);
      await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'subd' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
      const before = (await doc()).nodes[0].cage;
      // A move of the cage: the feature's values — applied, with an undo.
      await send([{ tool: 'subd', args: { action: 'move', index: 0, vertices: [0], delta: [0, 0, 2] } }]);
      await page.waitForFunction(z => window.__studioDoc.nodes[0].cage.positions[2] === z, before.positions[2] + 2, { timeout: 20000 });
      await page.waitForSelector('.toast:has-text("Applied by the agent")', { timeout: 10000 });
      assert.deepEqual((await doc()).nodes[0].cage.faces, before.faces);
      // An extrusion changes the cage's topology: at L2 refused, then proposed; accepted, the cage has four faces more.
      const extrude = { tool: 'subd', args: { action: 'extrude', index: 0, faces: [0], distance: 3 } };
      await send([extrude, { tool: 'proposals', args: { action: 'propose', title: 'A bump', ops: [extrude] } }]);
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
    await page.locator('[aria-label="Cage editor"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-cage.png`) });
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

  // (The calls: packages/barocss-cad-model/test/fixtures/subd-pipe-clamp.calls.json; the cage they make: the kernel's conformance case r8-subd-pipe-clamp.)
  await check('D84 the pipe clamp by the agent through the real chat: its cage-tool calls proposed and accepted; one body, the conformance cage; STEP out and in, the same volume', async () => {
    const { spawn } = await import('node:child_process'), fs = await import('node:fs'), origin = new URL(url).origin;
    const { calls } = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad-model/test/fixtures/subd-pipe-clamp.calls.json'), 'utf8'));
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
      await send([{ tool: 'proposals', args: { action: 'propose', title: 'Pipe clamp', ops: calls.slice(1).map(c => ({ tool: c.tool, args: c.args })) } }], 240000);
      await page.waitForSelector('[aria-label="Proposal P1"]', { timeout: 15000 });
      await page.locator('[aria-label="Proposal P1"] button', { hasText: /^Accept/ }).click();
      await page.waitForFunction(n => window.__studioDoc.nodes[0].cage.faces.length === n && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), want.input.partDocument.features[0].cage.faces.length, { timeout: 120000 }); await idle();
      console.log(`    (the clamp proposed and accepted through the chat in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      assert.deepEqual((await doc()).nodes[0].cage, want.input.partDocument.features[0].cage);
      await page.click('[aria-label="Close chat"]');
      await page.locator('.outliner .ol').first().click();
      await page.waitForFunction(() => /Volume/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 30000 });
      const props = await page.textContent('.props:not([aria-label$=" panel"])'), vol = Number(/Volume\s*([\d,.]+) mm³/.exec(props)?.[1].replace(/,/g, ''));
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
      await page.waitForFunction(() => /Volume/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 30000 });
      const back = Number(/Volume\s*([\d,.]+) mm³/.exec(await page.textContent('.props:not([aria-label$=" panel"])'))?.[1].replace(/,/g, ''));
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
    await page.waitForFunction(() => /Simplified: 10,000 → 1,000 triangles/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    const props = await page.textContent('.props:not([aria-label$=" panel"])');
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
    const props = await page.textContent('.props:not([aria-label$=" panel"])'), vol = Number(/Volume\s*([\d,]+) mm³/.exec(props)?.[1].replace(/,/g, ''));
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

  await check('R11.2b the SubD cube shelled 0.5 with its top opened (a file): the kept faces, their offset and the wall\'s ends along the opening — each kept face\'s normal band (refused before D111)', async () => {
    const fs = await import('node:fs'), file = join(out, 'subd-cube-open.bcad');
    const cube = { positions: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10], faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [
      { id: 'n0', kind: 'subd', name: 'SubD cube', cage: cube }, { id: 'n1', kind: 'shell', parent: { node: 0, side: 'solid' }, thickness: 0.5, open: ['n0.cap1_0', 'n0.cap1_1', 'n0.cap1_2', 'n0.cap1_3'] }] }));
    await openModel(file, 2, 60000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    // (Conformance r11/shell-subd-cube-open-top: 85.040 mm³; the panel rounds to 1 mm³.)
    const vol = await bodyVolume();
    assert.ok(Math.abs(vol - 85.04) <= 1, `${vol}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r11-2b-subd-cube-open');
  });

  await check('R11.2c-1 a filleted pipe tee shelled 1 with its three ends opened (a file): two trimmed cylinders offset exactly and the fillet\'s patches fitted, one smooth region — the kept faces\' normal bands (refused before D112)', async () => {
    const fs = await import('node:fs'), file = join(out, 'pipe-tee-open.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 7, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'n1', kind: 'extrude', sketch: 0, height: 60 },
      { id: 'n2', kind: 'sketch', profile: 'circle', center: [30, 0], radius: 5 }, { id: 'n3', kind: 'extrude', sketch: 2, height: 25 },
      { id: 'n4', kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } },
      { id: 'n5', kind: 'fillet', parent: { node: 4, side: 'solid' }, edges: ['n1.side0#1|n3.side0#2#4'], radius: 2 },
      { id: 'n6', kind: 'shell', parent: { node: 5, side: 'solid' }, thickness: 1, open: ['n1.top', 'n1.bottom', 'n3.top'] }] }));
    await openModel(file, 7, 90000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 90000 }); await idle();
    // (Conformance r11/shell-pipe-tee-open-ends: 3955.21 mm³; the panel rounds to 1 mm³.)
    const vol = await bodyVolume();
    assert.ok(Math.abs(vol - 3955.21) <= 1, `${vol}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r11-2c1-pipe-tee-open');
  });

  await check('R11.2c-2 a box with a conic-filleted edge shelled 2 with its bottom opened (a file): its end faces as bounding planes\' bands, the rounded side as one slab, the body run out through the opening — its section eroded × (40 − 2t) (refused before D113)', async () => {
    const fs = await import('node:fs'), file = join(out, 'conic-box-open.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 4, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
      { id: 'n2', kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 3, section: { kind: 'conic', rho: 0.5 } },
      { id: 'n3', kind: 'shell', parent: { node: 2, side: 'solid' }, thickness: 2, open: ['n1.bottom'] }] }));
    await openModel(file, 4, 90000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 90000 }); await idle();
    // (Conformance r11/shell-conic-box-open-bottom: 7095.52 mm³; the panel rounds to 1 mm³.)
    const vol = await bodyVolume();
    assert.ok(Math.abs(vol - 7095.52) <= 1, `${vol}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r11-2c2-conic-box-open');
  });

  await check('R11.3 a mesh octahedron shelled 3 (a file): its cavity its triangles offset in, each vertex its faces\' planes\' meeting point — (4/3)(a³ − (a − √3t)³) (refused before D114)', async () => {
    const fs = await import('node:fs'), file = join(out, 'mesh-octahedron-shell.bcad');
    const P = [10, 0, 0, -10, 0, 0, 0, 10, 0, 0, -10, 0, 0, 0, 10, 0, 0, -10], I = [0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5];
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [
      { id: 'n0', kind: 'mesh', name: 'octahedron', unit: 'mm', positions: P, indices: I, representation: 'facets' }, { id: 'n1', kind: 'shell', parent: { node: 0, side: 'solid' }, thickness: 3, open: [] }] }));
    await openModel(file, 2, 60000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    // (Conformance r11/shell-mesh-octahedron: 1185.52 mm³; the panel rounds to 1 mm³.)
    const vol = await bodyVolume();
    assert.ok(Math.abs(vol - 1185.52) <= 1, `${vol}`);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r11-3-mesh-octahedron-shell');
  });

  await check('R12.1 a hat-section sheet profile from the palette: its bends at the sheet\'s radius, the textbook volume, its rules and bends in the panel, the K prefill flagged an estimate (new in D116)', async () => {
    await page.click('[aria-label="New part"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await press(' '); await page.locator('.palette input').fill('sheet profile'); await press('Enter'); await hudReady();
    await field('Shape').selectOption('hat'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'sheet-contour', null, { timeout: 30000 });
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    // The defaults (crown 40 × 30, brims 12, width 30, T 1.5, R 1.5): 30 × 1.5 × the middle line 120.137 (the
    // virtual-sharp relations) = 5406.17 mm³; the panel rounds to 1 mm³.
    const vol = await bodyVolume();
    assert.ok(Math.abs(vol - 5406.17) <= 1, `${vol}`);
    const props = await page.textContent('.props:not([aria-label$=" panel"])');
    assert.match(props, /Sheet metal: 1\.5 mm thick, bends of inner radius 1\.5 mm, K-factor 0\.5/);
    assert.match(props, /K 0\.5 is an estimate/);
    assert.match(props, /bend4: 90°, allowance 3\.534 mm/);
    assert.match(await page.textContent('.history'), /Sheet profile T1\.5 · 4 bends/);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r12-1-sheet-hat-profile');
  });

  await check('R12.2 a channel with a hole cut through its base (a file): its flat pattern from the body\'s panel — the textbook length, two bends down — and its DXF exported (layers, a circle, the notes) (new in D117)', async () => {
    const fs = await import('node:fs'), file = join(out, 'sheet-channel-hole.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 4, outputs: {}, nodes: [
      { id: 'n0', kind: 'sheet-contour', path: [[0, 30], [0, 0], [40, 0], [40, 30]], side: 'left', width: 25, thickness: 1.5, bendRadius: 2, kFactor: 0.44 },
      { id: 'n1', kind: 'sketch', profile: 'circle', center: [20, -12.5], radius: 4, plane: { origin: [0, -1, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] } }, { id: 'n2', kind: 'extrude', sketch: 1, height: 3.5 },
      { id: 'n3', kind: 'difference', parent: { node: 0, side: 'solid' }, tool: { node: 2, side: 'solid' } }] }));
    await openModel(file, 4, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await bodyVolume();
    // The flat: 100 − 2·BD long (BD = 2(R + T) − (π/2)(R + K·T), R 2, T 1.5, K 0.44) = 94.357 × 25 mm.
    await page.waitForFunction(() => /Flat pattern 94\.357 × 25 mm, 2 bends/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('[aria-label="Show the flat pattern"]');
    await page.waitForSelector('[aria-label="Flat pattern"]');
    assert.equal(await page.locator('[aria-label="Flat pattern drawing"] [aria-label="Bend down"]').count(), 2);
    assert.match(await page.locator('[aria-label="Flat pattern"]').innerText(), /94\.357 × 25 mm · 2 bends · T 1\.5 mm, K 0\.44/);
    await page.locator('[aria-label="Flat pattern"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-flat-pattern.png`) });
    await snap('r12-2-flat-pattern');
    // (Handled at once: a failed click must fail this step, not leave a waiting promise to end the whole flow.)
    const download = page.waitForEvent('download'); download.catch(() => {});
    await page.click('[aria-label="Export flat DXF"]');
    const d = await download, text = fs.readFileSync(await d.path(), 'latin1');
    assert.match(d.suggestedFilename(), /-flat\.dxf$/);
    for (const layer of ['OUTLINE', 'BEND_UP', 'BEND_DOWN', 'BEND_NOTES']) assert.ok(new RegExp(`\\n${layer}\\r?\\n`).test(text), layer);
    assert.equal(text.match(/\nCIRCLE\r?\n/g)?.length, 1); assert.equal(text.match(/\nTEXT\r?\n/g)?.length, 2);
    await page.click('[aria-label="Close the flat pattern"]');
  });

  await check('R12.3a a flange bent up from a sheet plate\'s edge, picked by its name, from the palette: the textbook volume and flat (new in D118)', async () => {
    const fs = await import('node:fs'), file = join(out, 'sheet-plate.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 50] }, { id: 'n1', kind: 'sheet-base', sketch: 0, thickness: 1.5, bendRadius: 1.5, kFactor: 0.44 }] }));
    await openModel(file, 2, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    assert.ok(await page.waitForFunction(() => window.__studioPickEdge('n1.side1|n1.top'), null, { timeout: 15000 }));
    await press(' '); await page.locator('.palette input').fill('flange'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'sheet-flange', null, { timeout: 30000 }); await idle();
    // The plate less the trim (R + T), plus the bend and a 17 mm leg, times 50: 7315.07 mm³; its flat 80 + 20 − BD = 97.393 mm.
    const vol = await bodyVolume();
    assert.ok(Math.abs(vol - 7315.07) <= 1, `${vol}`);
    await page.waitForFunction(() => /Flat pattern 97\.393 × 50 mm, 1 bend/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    assert.match(await page.textContent('.history'), /Flange 20 · 90°/);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r12-3a-flange');
  });

  await check('R12.3b a corner relief off a sheet plate\'s corner (its edge picked by name) from the palette, then a flange on each of the corner\'s edges: they clear each other (new in D119)', async () => {
    const fs = await import('node:fs'), file = join(out, 'sheet-plate-corner.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 50] }, { id: 'n1', kind: 'sheet-base', sketch: 0, thickness: 1.5, bendRadius: 1.5, kFactor: 0.44 }] }));
    await openModel(file, 2, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    assert.ok(await page.waitForFunction(() => window.__studioPickEdge('n1.side0|n1.side1'), null, { timeout: 15000 }));
    await press(' '); await page.locator('.palette input').fill('corner relief'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'sheet-corner-relief', null, { timeout: 30000 }); await idle();
    // Its default size R + T = 3: the plate less 3 × 3 × 1.5 = 5986.5 mm³ (the panel rounds to 1 mm³).
    const vol = await bodyVolume();
    assert.ok(Math.abs(vol - 5986.5) <= 1, `${vol}`);
    assert.match(await page.textContent('.history'), /Corner relief square 3/);
    // A flange on each edge of that corner, full length: both build, the flat two bends.
    for (const edge of ['n1.side0|n1.top', 'n1.side1|n1.top']) {
      const k = await page.evaluate(() => window.__studioDoc.nodes.length);
      assert.ok(await page.waitForFunction(e => window.__studioPickEdge(e), edge, { timeout: 15000 }));
      await press(' '); await page.locator('.palette input').fill('flange'); await press('Enter'); await hudReady();
      await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
      await page.waitForTimeout(300); await press('Enter');
      await page.waitForFunction(n => window.__studioDoc.nodes.length === n + 1, k, { timeout: 30000 }); await idle();
    }
    await bodyVolume();
    await page.waitForFunction(() => /Flat pattern [\d.]+ × [\d.]+ mm, 2 bends/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('r12-3b-corner-relief');
  });

  await check('R12.4 a sheet L (a file) given the shop\'s bend table from its panel: the notes name the table and the row, the flat 50 + 35 − the row\'s deduction 4.2 (new in D120)', async () => {
    const fs = await import('node:fs'), file = join(out, 'sheet-l.bcad'), tableFile = join(out, 'shop-2mm.json');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 1, outputs: {}, nodes: [
      { id: 'n0', kind: 'sheet-contour', path: [[0, 0], [50, 0], [50, 35]], side: 'left', width: 20, thickness: 2, bendRadius: 3, kFactor: 0.4 }] }));
    fs.writeFileSync(tableFile, JSON.stringify({ id: 'shop-2mm', sources: [{ id: 'shop', label: 'the shop\'s test bends' }], rows: [{ thickness: 2, radius: 3, angle: 90, deduction: 4.2, source: 'shop' }] }));
    await openModel(file, 1, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await bodyVolume();
    await page.setInputFiles('input[aria-label="Bend table file"]', tableFile);
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.bendTable?.id === 'shop-2mm' && window.__studioDoc.nodes[0].kFactor === undefined, null, { timeout: 15000 }); await idle();
    await bodyVolume();
    await page.waitForFunction(() => /K from bend table shop-2mm \(1 rows\)/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    const props = await page.textContent('.props:not([aria-label$=" panel"])');
    assert.match(props, /deduction 4\.2 mm; K [\d.]+ from row 0/);
    assert.match(props, /Flat pattern 80\.8 × 20 mm, 1 bend/);
    await snap('r12-4-bend-table');
  });

  await check('R12.5 RB9 rungs 5 and 10 by the scripted agent through the real chat: a sheet L-bracket, a PCB enclosure; volumes, flats, DXF (new in D121)', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      // (The flats, in the box's order: 30 × 70 − BD and 100 + 2(25 − BD) × 70 + 2(25 − BD), BD = 2(R + T) − (π/2)(R + K·T) at T = R = 1.5, K 0.44.)
      for (const [name, flat, bends, circles, notes] of [['l-bracket', '30 × 67\\.393 mm, 1 bend', ['down', 1], 2, 1], ['pcb-enclosure', '144\\.786 × 114\\.786 mm, 4 bends', ['up', 4], 4, 4]]) {
        const { calls } = JSON.parse(fs.readFileSync(join(root, `../../packages/barocss-cad-model/test/fixtures/sheet-${name}.calls.json`), 'utf8'));
        const want = JSON.parse(fs.readFileSync(join(root, `../../packages/barocss-cad/conformance/r12/accept-${name}.json`), 'utf8')).expect.outputs[0].volumeMM3.value;
        await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
        await page.click('[aria-label="Chat"]');
        await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
        await page.click('[aria-label="Close chat"]');
        await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
        // (The panel rounds to 1 mm³.)
        const vol = await bodyVolume();
        assert.ok(Math.abs(vol - want) <= 1, `${name}: ${vol} vs ${want}`);
        await page.waitForFunction(re => new RegExp(`Flat pattern ${re}`).test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), flat, { timeout: 15000 });
        // (The enclosure's four flanges' bends read apart, each by its feature, D122.)
        if (name === 'pcb-enclosure') assert.equal(new Set((await page.locator('.props:not([aria-label$=" panel"])').textContent()).match(/n\d+\.bend(?=: )/g)).size, 4);
        await page.click('[aria-label="Show the flat pattern"]');
        await page.waitForSelector('[aria-label="Flat pattern"]');
        assert.equal(await page.locator(`[aria-label="Flat pattern drawing"] [aria-label="Bend ${bends[0]}"]`).count(), bends[1]);
        await snap(`r12-5-${name}-flat`);
        const download = page.waitForEvent('download'); download.catch(() => {});
        await page.click('[aria-label="Export flat DXF"]');
        const d = await download, text = fs.readFileSync(await d.path(), 'latin1');
        for (const layer of ['OUTLINE', 'BEND_UP', 'BEND_DOWN', 'BEND_NOTES']) assert.ok(new RegExp(`\\n${layer}\\r?\\n`).test(text), layer);
        assert.equal(text.match(/\nCIRCLE\r?\n/g)?.length, circles, `${name} circles`); assert.equal(text.match(/\nTEXT\r?\n/g)?.length, notes, `${name} notes`);
        await page.click('[aria-label="Close the flat pattern"]');
        await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
        await snap(`r12-5-${name}`);
      }
    } finally { chat.kill(); }
  });

  await check('FR1 two structural members from the palette: a round-cornered rectangular tube and a 20×40 T-slot, A·L each, the section and line in the panel, the prefilled radius and slot sizes flagged estimates (new in D123)', async () => {
    await page.click('[aria-label="New part"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await press(' '); await page.locator('.palette input').fill('structural member'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'frame-member', null, { timeout: 30000 });
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    // The prefill: 40 × 40 × 3, corners ro 6 (bore 3), 300 mm along +Y: A = 1600 − (4 − π)36 − (34² − (4 − π)9) = 420.823 mm²,
    // 126 246.9 mm³ (the panel rounds to 1 mm³).
    const A = 1600 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9), vol = await bodyVolume();
    assert.ok(Math.abs(vol - A * 300) <= 1, `${vol} vs ${A * 300}`);
    let props = await page.textContent('.props:not([aria-label$=" panel"])');
    assert.match(props, /Member: rect-tube 40 × 40 × 3, ro 6, ri 3 \(concentric\) · section 420\.823 mm² · length 300 mm/);
    assert.match(props, /Line through its centroid; section x −X, y \+Z/);
    assert.match(props, /Estimates, not your stock's: outerRadius 6 mm/);
    assert.match(await page.textContent('.history'), /Member RHS 40×40×3 · 300 mm/);
    // A 20 × 40 T-slot beside it: its slot sizes are the library's estimates.
    await press(' '); await page.locator('.palette input').fill('structural member'); await press('Enter'); await hudReady();
    await field('Section').selectOption('tslot'); await hudReady();
    await field('Size').selectOption('2'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await page.locator('.outliner .ol').nth(1).click();
    await page.waitForFunction(() => /Member: tslot/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    props = await page.textContent('.props:not([aria-label$=" panel"])');
    const At = 800 - 6 * (6.2 * 6.1 + 4.8 * 4.8 / 4) - 2 * Math.PI * 2.1 * 2.1;
    assert.ok(props.includes(`section ${+At.toFixed(3)} mm²`), props);
    assert.match(props, /Estimates, not your stock's: opening 6\.2 mm, lip 1\.8 mm, undercut 11 mm, depth 6\.1 mm, bore 4\.2 mm/);
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('fr1-members');
  });

  await check('FR2 a frame from the palette: a table skeleton of round-cornered tubes, 8 members each its own body named by its member, A·L each, the member\'s place in its notes (new in D124)', async () => {
    await page.click('[aria-label="New part"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    // (Only the Frame command answers to "skeleton".)
    await press(' '); await page.locator('.palette input').fill('skeleton'); await press('Enter'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'frame', null, { timeout: 30000 });
    await page.waitForFunction(() => /8 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    // The first body: a leg, 700 mm of the 40 × 40 × 3 tube (A 420.823 mm²) — run on 20 over the rails since FR3b's ordered
    // trim became the palette's default (D126): 302 993 mm³.
    const A = 1600 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9), vol = await bodyVolume();
    assert.ok(Math.abs(vol - A * 720) <= 1, `${vol} vs ${A * 720}`);
    const props = await page.textContent('.props:not([aria-label$=" panel"])');
    assert.match(props, /Frame member 1 of 8: point 1 → point 5/);
    assert.match(props, /the line runs along up, so y follows \+X/);
    const ol = await page.textContent('.outliner');
    assert.match(ol, /Frame RHS 40×40×3 · 8 members · member 8/);
    assert.match(await page.textContent('.history'), /Frame RHS 40×40×3 · 8 members/);
    // (The whole frame in view: nothing picked, then fit. Its corners still overlap: FR3 trims them.)
    await press('Escape'); await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('fr2-table-frame');
  });

  await check('FR3a a mitred rectangle from the palette: four sharp tubes cut on their corners\' halfway planes, A·L each, 45° ends in the notes; the welded look of a frame (new in D125)', async () => {
    await page.click('[aria-label="New part"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await press(' '); await page.locator('.palette input').fill('skeleton'); await press('Enter'); await hudReady();
    await field('Skeleton').selectOption('rectangle'); await hudReady();
    await field('Outer corner radius (estimate)').fill('0'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'frame', null, { timeout: 30000 });
    await page.waitForFunction(() => /4 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    assert.deepEqual(await page.evaluate(() => window.__studioDoc.nodes.at(-1).corners), { default: 'mitre', multi: 'order', tee: 'butt' });
    // The first member: 600 mm of a sharp 40 × 40 × 3 tube (A 444 mm²), mitred at both ends: 266 400 mm³.
    const vol = await bodyVolume();
    assert.ok(Math.abs(vol - 444 * 600) <= 1, `${vol}`);
    assert.match(await page.textContent('.props:not([aria-label$=" panel"])'), /Ends: start mitre 45° with member 4; end mitre 45° with member 2/);
    await press('Escape'); await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('fr3a-mitred-rectangle');
  });

  await check('FRk1 gusset and end cap (D165): a gusset in a mitred rectangle\'s corner (two members picked), a cap over a table leg\'s top', async () => {
    const frameOf = async (skeleton, bodies) => {
      await page.click('[aria-label="New part"]');
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
      await press(' '); await page.locator('.palette input').fill('skeleton'); await press('Enter'); await hudReady();
      await field('Skeleton').selectOption(skeleton); await hudReady();
      await field('Outer corner radius (estimate)').fill('0'); await hudReady();
      await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
      await page.waitForTimeout(300); await press('Enter');
      await page.waitForFunction(n => new RegExp(`${n} bodies`).test(document.querySelector('.outliner')?.textContent ?? ''), bodies, { timeout: 60000 }); await idle();
    };
    const plate = async (word, kind, bodies) => {
      await press(' '); await page.locator('.palette input').fill(word); await press('Enter'); await hudReady();
      await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
      await page.waitForTimeout(300); await press('Enter');
      await page.waitForFunction(k => window.__studioDoc.nodes.at(-1)?.kind === k, kind, { timeout: 30000 });
      await page.waitForFunction(n => new RegExp(`${n} bodies`).test(document.querySelector('.outliner')?.textContent ?? ''), bodies, { timeout: 60000 }); await idle();
      const row = await page.evaluate(k => [...document.querySelectorAll('.outliner .ol')].findIndex(e => new RegExp(k).test(e.textContent ?? '')), kind === 'gusset' ? 'Gusset' : 'End cap');
      await page.locator('.outliner .ol').nth(row).click();
      await page.waitForFunction(() => /Volume\s*[\d,]+ mm³/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
      return { volume: Number(/Volume\s*([\d,.]+) mm³/.exec(await page.textContent('.props:not([aria-label$=" panel"])'))?.[1].replace(/,/g, '')), notes: (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.trim()) };
    };
    await frameOf('rectangle', 4);
    const rows = page.locator('.outliner .ol'); await rows.nth(0).click(); await rows.nth(1).click({ modifiers: ['Shift'] });
    // The palette's gusset: legs 100 and 100, clip 10, 5 thick — (100² − 10²)/2·5 = 24 750 mm³.
    const g = await plate('gusset', 'gusset', 5);
    assert.ok(Math.abs(g.volume - 24750) <= 1, `${g.volume}`);
    assert.ok(g.notes.some(t => /^Seams: 90 on member 1 .*, 90 on member 2/.test(t)), g.notes.join(' | '));
    await press('Escape'); await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('frk1-gusset');
    // A table's first leg runs through at its top (to 720): the cap over it, 40 × 40 × 4.
    await frameOf('table', 8);
    await page.locator('.outliner .ol').nth(0).click();
    const c = await plate('end cap', 'end-cap', 9);
    assert.ok(Math.abs(c.volume - 6400) <= 1, `${c.volume}`);
    assert.ok(c.notes.some(t => /^Seam 160 mm round its outline \(exact\)$/.test(t)), c.notes.join(' | '));
    await press('Escape'); await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('frk1-end-cap');
  });

  await check('FRk2 weld beads (D166): a T and a gusset welded by the kernel\'s beads, opened as STEP', async () => {
    // (The beads come from the person's weld records through the outer lane's mapping; here the kernel's features alone.)
    const { evaluateCadPart, exportStep, outputOf } = await import('../../../packages/barocss-cad/dist/index.js');
    const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, WIDE = { kind: 'rect-tube', width: 80, height: 80, wall: 4, outerRadius: 0 };
    const part = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
      { id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400], [0, 0, 800], [400, 0, 800]], segments: [[0, 1], [2, 3], [4, 5]], section: WIDE, overrides: [{ member: 1, section: SHARP }, { member: 2, section: WIDE }], corners: { tee: 'butt', default: 'butt' } },
      { id: 'w', kind: 'weld-bead', frame: 'f', on: { member: 1, end: 'end' }, leg: 3 },
      { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [150, 150], thickness: 8, clip: 12 },
      { id: 'gw', kind: 'weld-bead', frame: 'f', on: { gusset: 'g' }, leg: 4 }] });
    const bead = outputOf(part, 'w'), gw = outputOf(part, 'gw');
    assert.ok(Math.abs(bead.bead.volume - 756) < 1e-9 && Math.abs(gw.bead.volume - 2 * (138 + 138) * 16 / 2) < 1e-9, `${bead.bead.volume}, ${gw.bead.volume}`);
    const file = join(out, 'frk2-welded.step'); (await import('node:fs')).writeFileSync(file, exportStep(part.outputs.map(o => o.brep), { name: 'frk2-welded' }));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.locator('input[aria-label="Model file"]').setInputFiles(file);
    // Three members, the gusset, the T's bead (one ring) and the gusset's four runs: 9 solids.
    await page.waitForFunction(() => /9 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    await page.locator('.outliner .ol').nth(3).click();
    await page.waitForFunction(() => /Volume\s*[\d,]+ mm³/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    assert.match(await page.textContent('.props:not([aria-label$=" panel"])'), /Volume\s*756 mm³/);
    await press('Escape'); await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('frk2-beads');
  });

  await check('FR3b a table of sharp tubes from the palette, its corners trimmed in order: legs through (A·720), rails between them (A·560, A·360), the order in the notes (new in D126)', async () => {
    await page.click('[aria-label="New part"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await press(' '); await page.locator('.palette input').fill('skeleton'); await press('Enter'); await hudReady();
    await field('Outer corner radius (estimate)').fill('0'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'frame', null, { timeout: 30000 });
    await page.waitForFunction(() => /8 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    assert.deepEqual(await page.evaluate(() => window.__studioDoc.nodes.at(-1).corners), { default: 'mitre', multi: 'order', tee: 'butt' });
    const leg = await bodyVolume();
    assert.ok(Math.abs(leg - 444 * 720) <= 1, `leg ${leg}`);
    // The fifth body: the first top rail, 600 between the legs' faces: 444 × 560.
    await page.locator('.outliner .ol').nth(4).click();
    await page.waitForFunction(() => /Frame member 5 of 8/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 15000 });
    const props = await page.textContent('.props:not([aria-label$=" panel"])'), rail = Number(/Volume\s*([\d,]+) mm³/.exec(props)?.[1].replace(/,/g, ''));
    assert.ok(Math.abs(rail - 444 * 560) <= 1, `rail ${rail}`);
    assert.match(props, /Ends: start trimmed to member 1 \(2 in order\); end trimmed to member 2 \(2 in order\)/);
    await press('Escape'); await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('fr3b-ordered-table');
  });

  await check('FR3b a round-cornered box frame from the palette (the default tube, 12 members, seconds of trims): computed off the main thread — the preview, then the bodies; the page\'s longest frame gap stays short and it answers meanwhile (D126)', async () => {
    await page.click('[aria-label="New part"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    // (The G10 finding, 2026-10-23: the default table's trims got faster — 1.3–1.4 s now — so it no longer is a case of
    // seconds. The box skeleton's 12 members and 8 three-way corners: the case measured, 1.7 s after K13 — a few polls.)
    await press(' '); await page.locator('.palette input').fill('skeleton'); await press('Enter'); await hudReady();
    // A probe of the main thread: the longest gap between 10 ms ticks from here on.
    await page.evaluate(() => { const w = window; w.__gap = 0; w.__last = performance.now(); w.__tick = setInterval(() => { const t = performance.now(); w.__gap = Math.max(w.__gap, t - w.__last); w.__last = t; }, 10); });
    await field('Skeleton').selectOption('box');
    const t0 = Date.now();
    // (The box's preview starts: the HUD leaves the table's preview first.)
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent !== 'preview', null, { timeout: 10000 });
    // While the preview computes (the table's trims, in the worker): the page answers a round trip at once, over and over.
    let slowest = 0, polls = 0; const seen = new Set();
    while (await page.evaluate(() => document.querySelector('.hud .status')?.textContent !== 'preview')) {
      seen.add(await page.evaluate(() => `${document.querySelector('.hud .status')?.textContent ?? '(no HUD)'} | ${document.querySelector('.corner-left')?.textContent ?? ''}`));
      const r0 = Date.now(); await page.evaluate(() => performance.now()); slowest = Math.max(slowest, Date.now() - r0); polls++;
      if (Date.now() - t0 > 120000) throw new Error('no preview in 120 s');
      await page.waitForTimeout(100);
    }
    const preview = Date.now() - t0;
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /12 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 120000 }); await idle();
    const built = Date.now() - t0, gap = await page.evaluate(() => { clearInterval(window.__tick); return window.__gap; });
    // eslint-disable-next-line no-console -- the measurement itself, recorded in D126
    console.log(`FR3b round box frame: preview after ${preview} ms (${polls} polls, the slowest answered in ${slowest} ms); bodies after ${built} ms; longest main-thread gap ${Math.round(gap)} ms; shown meanwhile: ${[...seen].join(' / ')}`);
    // (Meanwhile the HUD says so: "evaluating…".)
    assert.ok([...seen].some(x => /^evaluating…/.test(x)), [...seen].join(' / '));
    // (No wall-time floor: K13 made this preview 1.7 s. What is measured is the page answering while the worker computes,
    // so the case only has to span a few of the 100 ms polls — the HUD seen "evaluating…" between them.)
    assert.ok(polls >= 3, `the preview came after ${preview} ms, ${polls} polls: too quick to measure the page meanwhile`);
    assert.ok(slowest < 500, `the page took ${slowest} ms to answer while computing`);
    assert.ok(gap < 500, `the main thread was blocked ${Math.round(gap)} ms`);
    const A = 1600 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9), leg = await bodyVolume();
    // (A post of the box: through both rails, 700 + 2 · 20 — A · 740, as the table's legs are A · 720.)
    assert.ok(Math.abs(leg - A * 740) <= 1, `post ${leg}`);
  });

  await check('FR4a the cut list of a mitred rectangle from the palette: two rows of two (600 and 400, mitre 45° both ends, mass in aluminium — an estimate), and its CSV (new in D127)', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await press(' '); await page.locator('.palette input').fill('skeleton'); await press('Enter'); await hudReady();
    await field('Skeleton').selectOption('rectangle'); await hudReady();
    await field('Outer corner radius (estimate)').fill('0'); await hudReady();
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /4 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    await bodyVolume();
    await page.click('[aria-label="Show the cut list"]');
    await page.waitForSelector('[aria-label="Cut list"]');
    const rows = await page.locator('[aria-label="Cut list rows"] tbody tr').allInnerTexts();
    assert.equal(rows.length, 2);
    assert.match(rows[0], /^1\s+2\s+rect-tube 40 × 40 × 3\s+Aluminium 6061\s+600\s+640\s+mitre 45°\s+mitre 45°\s+0\.719 kg$/);
    assert.match(rows[1], /^2\s+2\s+rect-tube 40 × 40 × 3\s+Aluminium 6061\s+400\s+440\s+mitre 45°\s+mitre 45°\s+0\.48 kg$/);
    assert.match(await page.textContent('[aria-label="Cut list"]'), /4 pieces in 2 rows · 2000 mm · 2\.398 kg[\s\S]*estimates — not your stock's/);
    await page.locator('[aria-label="Cut list"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-cut-list.png`) });
    await snap('fr4a-cut-list');
    const download = page.waitForEvent('download'); download.catch(() => {});
    await page.click('[aria-label="Export cut list CSV"]');
    const csv = fs.readFileSync(await (await download).path(), 'utf8').trim().split('\n');
    assert.equal(csv.length, 4);
    assert.match(csv[1], /^1,2,rect-tube 40 × 40 × 3,Aluminium 6061,600,640,mitre 45°,mitre 45°,0\.71928,1\.43856,Frame RHS 40×40×3 · 4 members · member 1 Frame RHS 40×40×3 · 4 members · member 3$/);
    await page.click('[aria-label="Close the cut list"]');
  });

  await check('FR4b the welded table frame by the scripted agent through the real chat: 12 members A·L each, its cut list on an A3 drawing by the checkbox — the table clean, in the SVG, PDF and DXF exports (new in D128)', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      const { calls } = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad-model/test/fixtures/frame-welded-table.calls.json'), 'utf8'));
      await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count();
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      // (The agent's cut list: five rows, 9160 mm in all.)
      const line = await page.locator('.chat-tool').last().innerText();
      assert.ok(line.includes('query.cutlist'), line);
      await page.click('[aria-label="Close chat"]');
      await page.waitForFunction(() => /12 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
      // (A sharp 40 × 40 × 3 tube: A = 1600 − 34² = 444 mm²; the first member, the top's front rail, A·1000 — the panel rounds to 1 mm³.)
      const vol = await bodyVolume();
      assert.ok(Math.abs(vol - 444000) <= 1, String(vol));
      await page.click('[aria-label="Show the cut list"]');
      await page.waitForSelector('[aria-label="Cut list"]');
      assert.equal(await page.locator('[aria-label="Cut list rows"] tbody tr').count(), 5);
      assert.match(await page.textContent('[aria-label="Cut list"]'), /12 pieces in 5 rows · 9160 mm/);
      await page.click('[aria-label="Close the cut list"]');
    } finally { chat.kill(); }
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.waitForSelector('[aria-label="Cut list table"]', { timeout: 20000 });
      await page.check('[aria-label="Cut list table"]');
      await page.waitForFunction(() => window.__studioDoc.drawing?.tables?.some(t => t.from === 'cut-list'), null, { timeout: 10000 });
      await page.waitForFunction(() => window.__studioDrawing?.()?.tables?.length === 1 && !window.__studioDrawing().tables[0].error, null, { timeout: 30000 });
      await snap('fr4b-cut-list-drawing');
      const texts = ['CUT LIST', 'LENGTH [mm]', 'LONG POINT [mm]', '1000.0', '1040.0', '730.0', '960.0', 'MITRE 45', 'BUTT 0', 'SQUARE'];
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      const svg = fs.readFileSync(await svgFile.path(), 'utf8');
      for (const t of texts) assert.ok(svg.includes(`>${t}</text>`), `SVG: ${t}`);
      const [pdfFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export PDF"]')]);
      const pdf = fs.readFileSync(await pdfFile.path()).toString('latin1');
      for (const t of texts) assert.ok(pdf.includes(`(${t.replace(/([()\\])/g, '\\$1')}) Tj`), `PDF: ${t}`);
      const [dxfFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export DXF"]')]);
      const dxf = fs.readFileSync(await dxfFile.path()).toString('latin1');
      for (const t of texts) assert.ok(dxf.includes(`\n${t}\r\n`) || dxf.includes(`\n${t}\n`), `DXF: ${t}`);
      // (On A3 the issue list says nothing of the table.)
      const issues = await page.evaluate(() => window.__studioDrawing?.()?.issues ?? []);
      assert.ok(!issues.some(i => (i.tables ?? []).length), JSON.stringify(issues));
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  await check('FRb the welded table\'s cut list nested into the shop\'s stock through the real chat: 6000 and 4000 mm lengths at a 3 mm kerf — one of each, 10 000 mm, the waste 650 (closed forms); in the cut list and its nesting CSV (new in O116)', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      // (FR4b left the table: twelve members.)
      if (!/12 bodies/.test(await page.textContent('.outliner') ?? '')) {
        const { calls } = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad-model/test/fixtures/frame-welded-table.calls.json'), 'utf8'));
        await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
        await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
        const k = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls: calls.slice(0, 1) })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(j => document.querySelectorAll('.chat-msg.assistant').length > j && !document.querySelector('[aria-label="Chat message"]')?.disabled, k, { timeout: 120000 });
        await page.click('[aria-label="Close chat"]');
      }
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count();
      // (Rows rule b: the shop's lengths are the person's file, attached in the chat; the agent loads it by its reference.)
      const rows = [{ id: 'L6', length: 6000, source: 'a test value' }, { id: 'L4', length: 4000, source: 'a test value' }], list = join(out, 'frame-stock.json');
      fs.writeFileSync(list, JSON.stringify(rows)); await page.setInputFiles('input[aria-label="Chat image file"]', list);
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls: [{ tool: 'features', args: { action: 'frame_stock', file: '$file:frame-stock.json', kerf: 3 } }, { tool: 'query', args: { action: 'cutlist' } }] })}`);
      await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      const tools = await page.locator('.chat-tool').allInnerTexts();
      assert.ok(tools.some(t => t.includes('features.frame_stock')) && tools.at(-1).includes('query.cutlist'), tools.slice(-3).join(' | '));
      await page.click('[aria-label="Close chat"]');
      await page.waitForFunction(() => window.__studioDoc.frames?.stock?.length === 2 && window.__studioDoc.frames.kerf === 3, null, { timeout: 30000 }); await idle();
      // (A member selected: its properties carry the cut list's button. FR4b, run before, leaves one selected; alone, this step picks it.)
      if (!await page.locator('[aria-label="Show the cut list"]').count()) { await page.locator('.outliner .ol', { hasText: /^Frame/ }).first().click(); await page.waitForSelector('[aria-label="Show the cut list"]', { timeout: 15000 }); }
      await page.click('[aria-label="Show the cut list"]');
      await page.waitForSelector('[aria-label="Nesting"]');
      // (9320 mm of pieces: no sum of 4000s and 6000s lies in [9330, 10 000); one of each holds them — 10 000 − 9320 − 3 · 10.)
      assert.match(await page.textContent('[aria-label="Nesting"]'), /Nested: 2 bars · 10000 mm of stock · waste 650 mm · kerf 3 mm.*exact, optimal/);
      const download = page.waitForEvent('download', { timeout: 20000 });
      await page.click('[aria-label="Export nesting CSV"]');
      const csv = fs.readFileSync(await (await download).path(), 'utf8').trim().split('\n');
      assert.equal(csv.length, 4); assert.equal(csv[3], 'total,,,10000,,9320,30,650');
      await snap('frb-nesting');
      await page.click('[aria-label="Close the cut list"]');
    } finally { chat.kill(); }
  });

  await check('Shaft (R12c.3a, D156): a stepped shaft from the palette — keyed, shouldered with fillets, a ring groove; its notes (steps, keyseat, groove) and the estimate labels on the key and ring sizes', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await press(' '); await page.locator('.palette input').fill('shaft'); await press('Enter'); await hudReady();
    assert.match(await page.textContent('.hud'), /Keyseat width \(estimate\)/);
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'shaft' && /1 bod/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    assert.match(await page.textContent('.history'), /Shaft 3 steps Ø20–Ø25 × 95, keyed/);
    await page.locator('.outliner .ol').first().click();
    await page.waitForSelector('[aria-label="Generator note"]', { timeout: 10000 });
    const notes = (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.replace(/^warning\s*/, '').trim());
    assert.ok(notes.includes('Shaft 95 mm: Ø20 from 0 to 30; Ø25 from 30 to 70; Ø20 from 70 to 95') && notes.some(t => /^Keyseat 1 \(step 1, end-mill\): 6 wide, 3\.5 deep/.test(t)) && notes.includes('Groove 1 (step 3): Ø19, 1.3 wide from 88'), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('shaft');
  });

  await check('Shaft parts (R12c.3b, D157): the default shaft, a hub over its seat with a keyway, the key and a ring through the scripted chat — the key\'s clearance under the keyway and the ring\'s play in the notes', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), cmd = (command, values, extra = {}) => ({ tool: 'features', args: { action: 'command', command, values, ...extra } });
      // (The shaft n0; the tube a sketch n1 and its revolve n2, whose bore takes the keyway n3.)
      const calls = [cmd('shaft', {}), cmd('tube', { r: 20, ri: 10, h: 22, x: 0, y: 0, z: 4 }), cmd('keyway', { b: 6, t2: 2.8 }, { faces: ['n2.hole0.side0'] }), cmd('key', { h: 6, hub: '3' }, { bodies: ['b0'] }), cmd('retaining-ring', {}, { bodies: ['b0'] })];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`);
      await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(x => x.kind === 'retaining-ring') && /4 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    const keyRow = await page.evaluate(() => [...document.querySelectorAll('.outliner .ol')].findIndex(e => /^\s*Key \d/.test(e.textContent ?? '')));
    await page.locator('.outliner .ol').nth(keyRow).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(x => /under its floor/.test(x.textContent ?? '')), null, { timeout: 30000 });
    const notes = (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.replace(/^warning\s*/, '').trim());
    assert.ok(notes.includes('In the hub\'s keyway: 0 play in its width, 0.3 under its floor'), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('shaft-parts');
  });

  await check('Bearing (R12c.4, D158): the user\'s bearing rows loaded in the Library panel (none built in); a 6204 on the default shaft\'s first shoulder through the scripted chat — its seat and the not-located side in its notes', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const rows = [{ id: '6204', designation: '6204', bore: 20, outside: 47, width: 14, chamfer: 1, daMin: 25, daMax: 26.5, DaMax: 42, raMax: 1, estimate: true }];
    const file = join(out, 'bearing-rows.json'); fs.writeFileSync(file, JSON.stringify(rows));
    await page.click('[aria-label="Library"]');
    try {
      assert.match(await page.textContent('[aria-label="Bearing rows"]'), /No bearing rows: load your own .* None is built in/);
      await page.setInputFiles('input[aria-label="Bearing rows file"]', file);
      await page.waitForFunction(() => window.__studioDoc.bearings?.rows?.length === 1, null, { timeout: 10000 });
      assert.match(await page.textContent('[aria-label="Bearing row 6204"]'), /6204 Ø20 × Ø47 × 14 · estimate/);
    } finally { await page.click('[aria-label="Close library"]'); }
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), cmd = (command, values, extra = {}) => ({ tool: 'features', args: { action: 'command', command, values, ...extra } });
      const calls = [cmd('shaft', { ks: 0, gs: 0, r: 0 }), cmd('bearing', { row: '6204', step: 1, against: 'end' }, { bodies: ['b0'] })];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`);
      await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(x => x.kind === 'bearing') && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    const row = await page.evaluate(() => [...document.querySelectorAll('.outliner .ol')].findIndex(e => /^\s*Bearing 6204/.test(e.textContent ?? '')));
    await page.locator('.outliner .ol').nth(row).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(x => /against the Ø25 shoulder/.test(x.textContent ?? '')), null, { timeout: 30000 });
    const notes = (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.replace(/^warning\s*/, '').trim());
    assert.ok(notes.includes('On step 1 from 16 to 30, against the Ø25 shoulder; its other side not located; no overlap with the shaft') && notes.some(t => /not for structural calculation/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('bearing');
  });

  await check('O-ring gland (R12c.5, D159): the user\'s O-ring rows loaded (none built in); a piston gland on a Ø31 cylinder for AS568-214 at S0\'s sizes through the scripted chat — stretch, squeeze and fill in its notes, the ranges said to be estimates', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const file = join(out, 'oring-rows.json'); fs.writeFileSync(file, JSON.stringify([{ id: '214', dash: '2-214', insideDiameter: 24.99, crossSection: 3.53, estimate: true }]));
    await page.click('[aria-label="Library"]');
    try {
      assert.match(await page.textContent('[aria-label="O-ring rows"]'), /No O-ring rows: load your own .* None is built in/);
      await page.setInputFiles('input[aria-label="O-ring rows file"]', file);
      await page.waitForFunction(() => window.__studioDoc.orings?.rows?.length === 1, null, { timeout: 10000 });
    } finally { await page.click('[aria-label="Close library"]'); }
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), cmd = (command, values, extra = {}) => ({ tool: 'features', args: { action: 'command', command, values, ...extra } });
      const calls = [cmd('cylinder', { r: 15.5, h: 20, x: 0, y: 0, z: 0 }), cmd('oring-gland', { ring: '214', seal: 31.1, dg: 25.5, w: 4.7, at: 6 }, { faces: ['n1.side0'] })];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`);
      await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(x => x.kind === 'oring') && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    const row = await page.evaluate(() => [...document.querySelectorAll('.outliner .ol')].findIndex(e => /O-ring gland/.test(e.textContent ?? '')));
    await page.locator('.outliner .ol').nth(row).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(x => /Stretch 2 %/.test(x.textContent ?? '')), null, { timeout: 30000 });
    const notes = (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.replace(/^warning\s*/, '').trim());
    assert.ok(notes.includes('Stretch 2 %, the section 3.5006 stretched; squeeze 20.7 % (20 % stretched); fill 73.1 %') && notes.some(t => /\(estimates: Fictiv/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('oring-gland');
  });

  await check('Chain drive (R12c.6b, D161): the user\'s drive rows loaded (none built in); two sprockets and a chain on them through the scripted chat — the second moved to the distance for whole links, the links and the tooth form in their notes', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const rows = [{ kind: 'chain', id: 'chain-a', pitch: 12.7, rollerDiameter: 8.51, innerWidth: 7.75, plateHeight: 11.8, estimate: true }];
    const file = join(out, 'drive-rows.json'); fs.writeFileSync(file, JSON.stringify(rows));
    await page.click('[aria-label="Library"]');
    try {
      assert.match(await page.textContent('[aria-label="Drive rows"]'), /No drive rows: load your own .* None is built in/);
      await page.setInputFiles('input[aria-label="Drive rows file"]', file);
      await page.waitForFunction(() => window.__studioDoc.drives?.rows?.length === 1, null, { timeout: 10000 });
      assert.match(await page.textContent('[aria-label="Drive row chain-a"]'), /chain-a chain p 12\.7, roller Ø8\.51 · estimate/);
    } finally { await page.click('[aria-label="Close library"]'); }
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), cmd = (command, values, extra = {}) => ({ tool: 'features', args: { action: 'command', command, values, ...extra } });
      const calls = [cmd('sprocket', { row: 'chain-a', teeth: 17, tip: 75, w: 7, x: 0, y: 0, z: 0 }), cmd('sprocket', { row: 'chain-a', teeth: 34, tip: 145, w: 7, x: 200, y: 0, z: 0 }), cmd('belt-drive', { links: 'whole', snap: 'move' }, { bodies: ['b0', 'b1'] })];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`);
      await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(x => x.kind === 'belt') && /3 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    const moved = await page.evaluate(() => window.__studioDoc.nodes[1].center[0]);
    assert.ok(Math.abs(moved - 203.0145565) < 1e-4, String(moved));
    const row = await page.evaluate(() => [...document.querySelectorAll('.outliner .ol')].findIndex(e => /^\s*chain-a on features 1 and 2/.test(e.textContent ?? '')));
    await page.locator('.outliner .ol').nth(row).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(x => /58 links/.test(x.textContent ?? '')), null, { timeout: 30000 });
    const notes = (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.replace(/^warning\s*/, '').trim());
    assert.ok(notes.some(t => /^Chain chain-a \(an estimate\): length 736\.6 mm/.test(t)) && notes.some(t => /^58 pitches: 58 links/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Top")'); await press('f'); await page.waitForTimeout(500);
    await snap('chain-drive');
  });

  await check('Connector opening (R12c.7, D162): the user\'s connector row loaded (none built in; U1\'s USB-C opening, a test row citing it); the opening in a plate\'s top through the scripted chat — the body seated, its gaps in the notes, the keep-out in the part\'s keep-outs', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const rows = [{ id: 'usb-c', name: 'USB-C receptacle opening', opening: { shape: 'stadium', width: 8.34, height: 2.56, depth: 6.2 }, body: { shape: 'stadium', width: 8.25, height: 2.4, length: 6.51 }, keepOut: { margin: 1, depth: 15 }, source: 'U1 (D139): Wikipedia, "USB hardware"' }];
    const file = join(out, 'connector-rows.json'); fs.writeFileSync(file, JSON.stringify(rows));
    await page.click('[aria-label="Library"]');
    try {
      assert.match(await page.textContent('[aria-label="Connector rows"]'), /No connector rows: load your own .* None is built in/);
      await page.setInputFiles('input[aria-label="Connector rows file"]', file);
      await page.waitForFunction(() => window.__studioDoc.connectors?.rows?.length === 1, null, { timeout: 10000 });
      assert.match(await page.textContent('[aria-label="Connector row usb-c"]'), /USB-C receptacle opening stadium 8\.34 × 2\.56, 6\.2 deep/);
    } finally { await page.click('[aria-label="Close library"]'); }
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), cmd = (command, values, extra = {}) => ({ tool: 'features', args: { action: 'command', command, values, ...extra } });
      const calls = [cmd('box', { w: 40, d: 20, h: 10, x: 0, y: 0, z: 0 }), cmd('connector', { row: 'usb-c', u: 0, v: 0, rot: 0 }, { faces: ['n1.top'] })];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`);
      await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(x => x.kind === 'connector-body') && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    const keepouts = await page.evaluate(() => window.__studioDoc.references?.keepouts ?? []);
    // (From the plug body's front, 0.31 out of the face: the panel is clear of it, the plug only touches its base.)
    assert.ok(keepouts.length === 1 && keepouts[0].shape.size.join() === '10.25,4.4,15' && Math.abs(keepouts[0].frame.origin[2] - 10.31) < 1e-6, JSON.stringify(keepouts));
    const row = await page.evaluate(() => [...document.querySelectorAll('.outliner .ol')].findIndex(e => /Connector opening for usb-c/.test(e.textContent ?? '')));
    await page.locator('.outliner .ol').nth(row).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(x => /gaps 0\.045 and 0\.08/.test(x.textContent ?? '')), null, { timeout: 30000 });
    const notes = (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.replace(/^warning\s*/, '').trim());
    assert.ok(notes.some(t => /^Its body stadium 8\.25 × 2\.4 × 6\.51: gaps 0\.045 and 0\.08 each side, standing 0\.31 out of the face$/.test(t)) && notes.some(t => /^Keep-out in front of it: 10\.25 × 4\.4, 15 out/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('connector-usb-c');
  });

  await check('Fits (R12c.2, D155): a fit table loaded in the Library panel (none built in); a bore and a pin given H7 and g6 and declared a pair through the chat — the limits and the clearance in the notes', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const table = { id: 'shop-fits', rows: [{ class: 'H7', over: 10, upTo: 18, upper: 0.018, lower: 0, estimate: true }, { class: 'g6', over: 10, upTo: 18, upper: -0.006, lower: -0.017, estimate: true }] };
    const file = join(out, 'shop-fits.json'); fs.writeFileSync(file, JSON.stringify(table));
    await page.click('[aria-label="Library"]');
    try {
      assert.match(await page.textContent('[aria-label="Fit tables"]'), /No fit tables: load your own .* None is built in/);
      await page.setInputFiles('input[aria-label="Fit table file"]', file);
      await page.waitForFunction(() => window.__studioDoc.fits?.tables?.length === 1, null, { timeout: 10000 });
      assert.match(await page.textContent('[aria-label="Fit table shop-fits"]'), /shop-fits 2 rows · H7 g6 · 2 estimates/);
    } finally { await page.click('[aria-label="Close library"]'); }
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), cmd = (command, values, faces) => ({ tool: 'features', args: { action: 'command', command, values, ...(faces ? { faces } : {}) } });
      const calls = [cmd('tube', { r: 10, ri: 6, h: 24, x: 0, y: 0, z: 0 }), cmd('cylinder', { r: 6, h: 24, x: 0, y: 0, z: -5 }), cmd('fit-class', { class: 'H7' }, ['n1.hole0.side0']), cmd('fit-class', { class: 'g6' }, ['n3.side0']), cmd('fit-pair', {}, ['n1.hole0.side0', 'n3.side0'])];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`);
      await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => window.__studioDoc.fits?.pairs?.length === 1 && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    await page.locator('.outliner .ol').nth(1).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(x => /^(warning )?\s*Fit n1\.hole0\.side0/.test((x.textContent ?? '').trim())), null, { timeout: 30000 });
    const notes = (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.replace(/^warning\s*/, '').trim());
    assert.ok(notes.some(t => /^n3\.side0: Ø12 g6 −0\.006\/−0\.017 mm — 11\.983 to 11\.994 \(shop-fits row 1, an estimate\)/.test(t)) && notes.some(t => /^Fit n1\.hole0\.side0 \/ n3\.side0: H7\/g6 at Ø12: clearance fit, clearance \+6 to \+35 µm; at MMC clear, at LMC clear/.test(t)), notes.join(' | '));
    await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(500);
    await snap('fit-pin');
  });

  await check('D155 fit callouts: the bore and pin left by the Fits step, auto-dimensioned on A3 — the bore\'s diameter reads Ø12 H7/g6 with both rows\' limits, flagged an estimate, in the SVG; no FIT_ROW_MISSING', async () => {
    const fs = await import('node:fs');
    if (!(await page.evaluate(() => window.__studioDoc.fits?.pairs?.length === 1))) throw new Error('the Fits step left no pair');
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => (window.__studioDrawing?.()?.dimensions ?? []).some(d => /H7\/g6/.test(d.text ?? '')), null, { timeout: 30000 });
      const dims = await page.evaluate(() => window.__studioDrawing().dimensions.map(d => d.text));
      assert.ok(dims.some(t => /Ø12.* H7\/g6 \(\+0\.018\/0, -0\.006\/-0\.017\) \(est\.\)$/.test(t ?? '')), JSON.stringify(dims));
      const issues = await page.evaluate(() => window.__studioDrawing().issues);
      assert.ok(!issues.some(i => i.code === 'FIT_ROW_MISSING'), JSON.stringify(issues));
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      assert.ok(fs.readFileSync(await svgFile.path(), 'utf8').includes('H7/g6 (+0.018/0, -0.006/-0.017) (est.)'), 'in the SVG');
      await snap('d155-fit-callout');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });



  // ---- O144: machine elements' drawing tables — the spring data and the element list ---------------------------------------
  await check('element tables (O144): a spring from the palette; on its A3 drawing the Spring data and Element list tables by their checkboxes — in the SVG', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await press(' '); await page.locator('.palette input').fill('Spring'); await page.locator('.palette input').press('Enter');
    await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'spring' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.waitForSelector('[aria-label="Spring data table"]', { timeout: 20000 });
      assert.equal(await page.locator('[aria-label="Gland table"]').count(), 0, 'no gland, no gland table offered');
      await page.check('[aria-label="Spring data table"]'); await page.check('[aria-label="Element list table"]');
      await page.waitForFunction(() => { const t = window.__studioDrawing?.()?.tables; return t?.length === 2 && t.every(x => !x.error); }, null, { timeout: 30000 });
      await snap('element-tables');
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      const svg = fs.readFileSync(await svgFile.path(), 'utf8');
      for (const t of ['SPRING DATA', 'MACHINE ELEMENTS', 'WIRE Ø [mm]', 'compression', 'closed-ground', 'bought']) assert.ok(svg.includes(`>${t}</text>`), `SVG: ${t}`);
      assert.ok(svg.includes('>n0: its shear modulus G is an estimate</text>'), 'the estimate said under the element list');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });


  // ---- O147 B1: the BOM panel — its lines, the bought/made choice (one undo), the purchase list --------------------------
  await check('BOM panel (O147): a shaft and its key from the palette; the panel lists the part and the key; the key set made leaves it (one Undo back); the purchase list CSV', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    for (const [label, pickShaft] of [['Shaft', false], ['Key', true]]) {
      if (pickShaft) { await page.locator('.outliner .ol', { hasText: /^Shaft/ }).first().click(); await page.waitForTimeout(300); }
      await press(' '); await page.locator('.palette input').fill(label); await page.locator('.palette input').press('Enter');
      await hudReady(); await page.waitForTimeout(300); await press('Enter'); await idle();
    }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(n => n.kind === 'key'), null, { timeout: 30000 });
    // (The BOM is an inspect tool on the left toolbar, not on the top bar: O90's shapes strip keeps its room.)
    await page.click('nav[aria-label="Tools"] [aria-label="BOM"]');
    try {
      await page.waitForSelector('[aria-label="BOM line 2"]', { timeout: 30000 });
      assert.match(await page.textContent('[aria-label="BOM line 1"]'), /Untitled/);
      assert.match(await page.textContent('[aria-label="BOM line 2"]'), /key [\d.]+ × [\d.]+ × [\d.]+/);
      assert.match(await page.textContent('[aria-label="Made elements"]'), /shaft 3 steps/);
      // The key made: its line leaves, it is a made element; one Undo brings it back.
      await page.locator('[aria-label="BOM line 2"] select').selectOption('made');
      await page.waitForFunction(() => window.__studioDoc.nodes.find(n => n.kind === 'key')?.bought === false && !document.querySelector('[aria-label="BOM line 2"]'), null, { timeout: 30000 });
      await page.evaluate(() => document.activeElement?.blur?.()); await press('Meta+z');
      await page.waitForFunction(() => window.__studioDoc.nodes.find(n => n.kind === 'key')?.bought === undefined && !!document.querySelector('[aria-label="BOM line 2"]'), null, { timeout: 30000 });
      await snap('bom-panel');
      // (O16: the table at the dock's width — no wider than the panel, no item name wrapped.)
      const fit = await page.evaluate(() => { const panel = document.querySelector('[aria-label="BOM panel"]'), table = document.querySelector('[aria-label="BOM lines"]'), items = [...table.querySelectorAll('tbody tr td:nth-child(2)')];
        return { over: table.scrollWidth - panel.clientWidth, wrapped: items.filter(td => td.getClientRects().length && td.scrollHeight > td.clientHeight + 1).length, nowrap: items.every(td => getComputedStyle(td).whiteSpace === 'nowrap') }; });
      assert.ok(fit.over <= 0 && fit.wrapped === 0 && fit.nowrap, JSON.stringify(fit));
      await page.locator('[aria-label="BOM panel"]').screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-bom-panel.png`) });
      const [csvFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export purchase list"]')]);
      const rows = fs.readFileSync(await csvFile.path(), 'utf8').trim().split('\n');
      assert.equal(rows[0], 'item no.,item,qty,kind,size,row,catalogue,source,estimate');
      assert.equal(rows.length, 2, rows.join(' | ')); assert.match(rows[1], /^2,key [\d.]+ × [\d.]+ × [\d.]+,1,key,/);
    } finally { if (await page.locator('[aria-label="Close BOM"]').count()) await page.click('[aria-label="Close BOM"]'); }
  });
  // ---- A9-11 (O2): the purchase list downloaded from the app keeps the key's estimate; Save, New, Open; the same bytes again --
  await check('A9-11 purchase list from the app: a shaft and its key; the key line has no row or source and says estimate; saved, a new part, opened — the purchase list downloads byte for byte the same', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    for (const [label, pickShaft] of [['Shaft', false], ['Key', true]]) {
      if (pickShaft) { await page.locator('.outliner .ol', { hasText: /^Shaft/ }).first().click(); await page.waitForTimeout(300); }
      await press(' '); await page.locator('.palette input').fill(label); await page.locator('.palette input').press('Enter');
      await hudReady(); await page.waitForTimeout(300); await press('Enter'); await idle();
    }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(n => n.kind === 'key'), null, { timeout: 30000 });
    const purchase = async () => {
      await page.click('nav[aria-label="Tools"] [aria-label="BOM"]');
      try {
        await page.waitForSelector('[aria-label="BOM line 2"]', { timeout: 30000 });
        // (The panel says what the file says: the key's source is the estimate, not a row.)
        assert.match(await page.textContent('[aria-label="BOM line 2"]'), /key [\d.]+ × [\d.]+ × [\d.]+[\s\S]*estimate/);
        const [file] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export purchase list"]')]);
        assert.match(file.suggestedFilename(), /purchase list\.csv$/);
        return fs.readFileSync(await file.path());
      } finally { if (await page.locator('[aria-label="Close BOM"]').count()) await page.click('[aria-label="Close BOM"]'); }
    };
    const first = await purchase(), rows = first.toString('utf8').trim().split('\n');
    assert.equal(rows[0], 'item no.,item,qty,kind,size,row,catalogue,source,estimate');
    assert.equal(rows.length, 2, rows.join(' | '));
    assert.match(rows[1], /^2,key ([\d.]+ × [\d.]+ × [\d.]+),1,key,\1,,,,estimate$/, rows[1]);
    const [saved] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('[aria-label="Save"]')]);
    const bcad = join(out, 'a9-11-key.bcad'); fs.writeFileSync(bcad, fs.readFileSync(await saved.path()));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.setInputFiles('input[aria-label="Model file"]', bcad);
    await page.waitForFunction(() => window.__studioDoc.nodes.some(n => n.kind === 'key'), null, { timeout: 30000 }); await idle();
    const again = await purchase();
    assert.ok(again.equals(first), `reopened: ${again.toString('utf8')} vs ${first.toString('utf8')}`);
  });
  // ---- O147 B2: the BOM on the drawing — its table and the item balloons, numbered alike -----------------------------------
  await check('BOM table and balloons (O147 B2): a shaft and its key; on A3 the BOM table and 2 balloons numbered as its lines, on the iso view; in the SVG', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    for (const [label, pickShaft] of [['Shaft', false], ['Key', true]]) {
      if (pickShaft) { await page.locator('.outliner .ol', { hasText: /^Shaft/ }).first().click(); await page.waitForTimeout(300); }
      await press(' '); await page.locator('.palette input').fill(label); await page.locator('.palette input').press('Enter');
      await hudReady(); await page.waitForTimeout(300); await press('Enter'); await idle();
    }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(n => n.kind === 'key') && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.waitForSelector('[aria-label="BOM table"]', { timeout: 20000 });
      await page.check('[aria-label="BOM table"]'); await page.check('[aria-label="Balloons"]');
      // (The BOM is worked out in the engine worker: waited for, not read at once.)
      await page.waitForFunction(() => { const d = window.__studioDrawing?.(); return d?.tables?.length === 1 && !d.tables[0].error && d.balloons?.placed.length === 2; }, null, { timeout: 60000 });
      const b = await page.evaluate(() => window.__studioDrawing().balloons);
      assert.deepEqual(b.placed.map(p => [p.no, p.view]), [[1, 'iso'], [2, 'iso']], JSON.stringify(b));
      assert.deepEqual([b.unclear, b.noEdge], [[], []]);
      assert.ok(/(^|\|)n1\./.test(b.placed[1].edge), `balloon 2 on the key's edge: ${b.placed[1].edge}`);
      assert.deepEqual(await page.evaluate(() => (window.__studioDrawing().issues ?? []).filter(x => /^BALLOON_|TEXT_OVER|OFF_SHEET/.test(x.code)).map(x => x.code)), []);
      await snap('bom-balloons');
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      const svg = fs.readFileSync(await svgFile.path(), 'utf8');
      assert.ok(svg.includes('>BILL OF MATERIALS</text>'), 'the BOM table in the SVG');
      assert.equal(svg.split('<g class="balloon"').length - 1, 2, 'two balloons in the SVG');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  // ---- O145: machine elements on their dimensions — a key's leader note by Auto-dimension ------------------------------
  await check('element notes and key dimensions (O145, O146): a shaft and its key from the palette; Auto-dimension on A3 — the key\'s leader note, the keyseat\'s b 6 and d − t1 16.5; in the SVG', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    for (const [label, pickShaft] of [['Shaft', false], ['Key', true]]) {
      if (pickShaft) { await page.locator('.outliner .ol', { hasText: /^Shaft/ }).first().click(); await page.waitForTimeout(300); }
      await press(' '); await page.locator('.palette input').fill(label); await page.locator('.palette input').press('Enter');
      await hudReady(); await page.waitForTimeout(300); await press('Enter'); await idle();
    }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(n => n.kind === 'key') && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
    // (O174: a part's drawing is what it makes — a bought key is not drawn and has no note; set made in the BOM, it is the part's.)
    await page.click('nav[aria-label="Tools"] [aria-label="BOM"]');
    try {
      await page.waitForSelector('[aria-label="BOM line 2"]', { timeout: 30000 });
      await page.locator('[aria-label="BOM line 2"] select').selectOption('made');
      await page.waitForFunction(() => window.__studioDoc.nodes.find(n => n.kind === 'key')?.bought === false, null, { timeout: 30000 });
    } finally { if (await page.locator('[aria-label="Close BOM"]').count()) await page.click('[aria-label="Close BOM"]'); }
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => window.__studioDoc.drawing?.notes?.some(n => n.id.startsWith('el-') && /^key /.test(n.text)), null, { timeout: 60000 });
      const note = await page.evaluate(() => window.__studioDoc.drawing.notes.find(n => n.id.startsWith('el-')));
      assert.ok(note.leader && /^key [\d.]+ × [\d.]+ × [\d.]+$/.test(note.text), JSON.stringify(note));
      assert.deepEqual(await page.evaluate(() => (window.__studioDrawing?.()?.issues ?? []).filter(x => x.code === 'TEXT_OVERLAP').length), 0);
      // (O146: the default shaft's keyseat — b 6, and d − t1 = 20 − 3.5 from the far side of its step.)
      // (The sheet is built after the document changes: waited for, not read at once.)
      await page.waitForFunction(() => { const v = (window.__studioDrawing?.()?.dimensions ?? []).map(d => d.value).filter(x => typeof x === 'number'); return [6, 16.5].every(w => v.some(x => Math.abs(x - w) < 1e-6)); }, null, { timeout: 30000 });
      await snap('element-key-note');
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      assert.ok(fs.readFileSync(await svgFile.path(), 'utf8').includes(`>${note.text}</text>`), 'the note in the SVG');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  // ---- O139: retaining-ring rows loaded in the Library panel (none built in) ---------------------------------------------
  await check('ring rows (O139): a row loaded in the Library panel; a ring on it via the chat cites it, no estimate; the used row stays', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const file = join(out, 'rings.json'); fs.writeFileSync(file, JSON.stringify([{ id: 'r20', designation: '20 × 1.2', shaftDiameter: 20, grooveDiameter: 19, grooveWidth: 1.3, source: 'the maker\'s sheet' }]));
    await page.click('[aria-label="Library"]');
    try {
      assert.match(await page.textContent('[aria-label="Ring rows"]'), /No ring rows: load your own .* None is built in/);
      await page.setInputFiles('input[aria-label="Ring rows file"]', file);
      await page.waitForFunction(() => window.__studioDoc.rings?.rows?.length === 1, null, { timeout: 10000 });
      assert.match(await page.textContent('[aria-label="Ring row r20"]'), /20 × 1\.2 Ø20 shaft · groove Ø19 × 1\.3 · the maker's sheet/);
    } finally { await page.click('[aria-label="Close library"]'); }
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      if (!await page.locator('[aria-label="Chat message"]').count()) await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), cmd = (command, values, sel) => ({ tool: 'features', args: { action: 'command', command, values, ...(sel ?? {}) } });
      const calls = [cmd('shaft', {}), cmd('retaining-ring', { row: 'r20' }, { bodies: ['b0'] })];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      assert.deepEqual(await page.locator('.chat-tool.err').allInnerTexts(), []);
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(n => n.kind === 'retaining-ring' && n.row === 'r20'), null, { timeout: 60000 }); await idle();
    await page.locator('.outliner .ol', { hasText: /^Retaining ring/ }).first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(x => /checked against your ring row/.test(x.textContent ?? '')), null, { timeout: 30000 });
    const notes = (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.trim());
    assert.ok(notes.some(t => t === 'Its groove checked against your ring row (the maker\'s sheet)'), notes.join(' | '));
    assert.ok(!notes.some(t => /an estimate: your ring's row/.test(t)), notes.join(' | '));
    // (The row the ring uses stays: removing it is refused, said.)
    await page.click('[aria-label="Library"]');
    try {
      await page.click('[aria-label="Remove ring row r20"]');
      await page.waitForFunction(() => /used by a retaining ring/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 10000 });
      assert.equal(await page.evaluate(() => window.__studioDoc.rings.rows.length), 1);
    } finally { await page.click('[aria-label="Close library"]'); }
  });

  // ---- O175: Fix all runs its rounds — the section it adds is cut, then the sheet with it fixed; one click ----------------
  await check('O175 Fix all rounds: a shaft and its bought key; Auto-dimension, then one Fix all adds the keyseat\'s section and clears what its view brings; no issue left, no key drawn (O174)', async () => {
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    for (const [label, pickShaft] of [['Shaft', false], ['Key', true]]) {
      if (pickShaft) { await page.locator('.outliner .ol', { hasText: /^Shaft/ }).first().click(); await page.waitForTimeout(300); }
      await press(' '); await page.locator('.palette input').fill(label); await page.locator('.palette input').press('Enter');
      await hudReady(); await page.waitForTimeout(300); await press('Enter'); await idle();
    }
    await page.waitForFunction(() => window.__studioDoc.nodes.some(n => n.kind === 'key') && /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => (window.__studioDrawing?.()?.issues ?? []).some(x => x.code === 'DIM_ON_HIDDEN'), null, { timeout: 60000 });
      // (The bought key is not the part's: no note points at it.)
      assert.deepEqual(await page.evaluate(() => (window.__studioDoc.drawing?.notes ?? []).filter(n => n.id.startsWith('el-')).map(n => n.text)), []);
      await page.click('[aria-label="Fix all issues"]');
      // (One click: the rounds wait for the worker to cut the section, then fix the sheet with its view.)
      await page.waitForFunction(() => (window.__studioDoc.drawing?.sections ?? []).length === 1 && (window.__studioDrawing?.()?.issues ?? []).length === 0, null, { timeout: 90000 });
      await page.waitForFunction(() => /fixes applied/.test(document.body.textContent ?? '') && /The drawing has no issues/.test(document.body.textContent ?? ''), null, { timeout: 30000 });
      assert.equal(await page.locator('[aria-label="Fix all issues"]').count(), 0, 'nothing left to fix');
      await snap('fix-all-rounds');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  // ---- O138: a key's width fit — classes on the key's, keyseat's and keyway's sides -----------------------------------
  await check('key width fit (O138): h9 on the key, N9 on its keyseat, JS9 on the keyway via the chat — both width fits in the key\'s notes', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const table = { id: 'key-fits', rows: [{ class: 'N9', over: 3, upTo: 6, upper: 0, lower: -0.030, estimate: true }, { class: 'JS9', over: 3, upTo: 6, upper: 0.015, lower: -0.015, estimate: true }, { class: 'h9', over: 3, upTo: 6, upper: 0, lower: -0.030, estimate: true }] };
    const file = join(out, 'key-fits.json'); fs.writeFileSync(file, JSON.stringify(table));
    await page.click('[aria-label="Library"]');
    try { await page.setInputFiles('input[aria-label="Fit table file"]', file); await page.waitForFunction(() => window.__studioDoc.fits?.tables?.length === 1, null, { timeout: 10000 }); }
    finally { await page.click('[aria-label="Close library"]'); }
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      if (!await page.locator('[aria-label="Chat message"]').count()) await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), cmd = (command, values, sel) => ({ tool: 'features', args: { action: 'command', command, values, ...(sel ?? {}) } });
      // (Ids as they come: the shaft n0, the tube n1–n2, the keyway n3, the key n4 — its side0 the round-ended key's first straight side.)
      const calls = [cmd('shaft', {}), cmd('tube', { r: 20, ri: 10, h: 22, x: 0, y: 0, z: 4 }), cmd('keyway', { b: 6, t2: 2.8 }, { faces: ['n2.hole0.side0'] }), cmd('key', { h: 6 }, { bodies: ['b0'] }),
        cmd('fit-class', { class: 'h9' }, { faces: ['n4.side0'] }), cmd('fit-class', { class: 'N9' }, { faces: ['n0.keyseat1'] }), cmd('fit-class', { class: 'JS9' }, { faces: ['n3.keyway'] })];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      const errors = await page.locator('.chat-tool.err').allInnerTexts();
      assert.deepEqual(errors, []);
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => window.__studioDoc.fits?.faces?.length === 3, null, { timeout: 60000 }); await idle();
    await page.locator('.outliner .ol', { hasText: /^Key/ }).first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Generator note"]')].some(x => /Width fit in the seat/.test(x.textContent ?? '')), null, { timeout: 30000 });
    const notes = (await page.locator('[aria-label="Generator note"]').allInnerTexts()).map(t => t.replace(/^warning\s*/, '').trim());
    assert.ok(notes.includes('Width fit in the seat: N9/h9 at 6 mm — transition, −0.03 to +0.03 mm clearance (an estimate)'), notes.join(' | '));
    assert.ok(notes.includes('Width fit in the hub\'s keyway: JS9/h9 at 6 mm — transition, −0.015 to +0.045 mm clearance (an estimate)'), notes.join(' | '));
    await snap('key-width-fit');
  });
  await check('FRc the section library in the Library panel: a row, a frame on it via the chat (133 200 mm³), the row edited (172 800), a used row kept (O117)', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const fill = async (dims) => { for (const [k, v] of Object.entries(dims)) await page.fill(`[aria-label="Section ${k}"]`, String(v)); };
    await page.click('[aria-label="Library"]');
    try {
      await page.click('[aria-label="Add section"]');
      await page.fill('[aria-label="Section id"]', 'R40'); await page.fill('[aria-label="Section name"]', 'RHS 40');
      await page.selectOption('[aria-label="Section kind"]', 'rect-tube');
      await fill({ width: 40, height: 40, wall: 3, outerRadius: 0 });
      await page.fill('[aria-label="Section source"]', 'the shop');
      await page.click('[aria-label="Save section"]');
      await page.waitForFunction(() => window.__studioDoc.frames?.sections?.length === 1, null, { timeout: 10000 });
      assert.match(await page.textContent('[aria-label="Section R40"]'), /RHS 40.*RHS 40×40×3 · the shop/);
    } finally { await page.click('[aria-label="Close library"]'); }
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count();
      const frame = { kind: 'frame', points: [[0, 0, 0], [300, 0, 0]], segments: [[0, 1]], section: { kind: 'library', id: 'R40' } };
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls: [{ tool: 'features', args: { action: 'add', features: [frame] } }] })}`);
      await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    // (A sharp RHS: A = wh − (w − 2t)(h − 2t); 40 × 40 × 3 is 444 mm².)
    let vol = await bodyVolume(); assert.ok(Math.abs(vol - 133200) <= 1, String(vol));
    await page.click('[aria-label="Library"]');
    try {
      await page.click('[aria-label="Edit section R40"]');
      assert.ok(await page.isDisabled('[aria-label="Section id"]'), 'an edited row keeps its id');
      await fill({ width: 50, height: 30, wall: 4 });
      await page.click('[aria-label="Save section"]');
      await page.waitForFunction(() => window.__studioDoc.frames.sections[0].section.width === 50, null, { timeout: 10000 });
      assert.ok(await page.isDisabled('[aria-label="Remove section R40"]'), 'a row in use stays');
    } finally { await page.click('[aria-label="Close library"]'); }
    await idle();
    // (50 × 30 × 4: 576 mm², the frame on the row follows.)
    vol = await bodyVolume(); assert.ok(Math.abs(vol - 172800) <= 1, String(vol));
    await snap('frc-section-library');
  });

  await check('FRd1 the welded table\'s welds via the chat: 16 joints, one set to a 4 mm fillet; the weld list on A3, clear, in the SVG (O118)', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      const { calls } = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad-model/test/fixtures/frame-welded-table.calls.json'), 'utf8'));
      await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
      await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      let n = await page.locator('.chat-msg.assistant').count();
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls: [calls[0], { tool: 'query', args: { action: 'welds' } }] })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      assert.ok((await page.locator('.chat-tool').last().innerText()).includes('query.welds'));
      // (The first mitre's id: the frame's members are the bodies b0_part0…, the corner named by its lesser end, b0_part0.start.)
      n = await page.locator('.chat-msg.assistant').count();
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls: [{ tool: 'features', args: { action: 'welds', welds: [{ joint: 'b0_part0.start', kind: 'fillet', size: 4 }] } }] })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      await page.click('[aria-label="Close chat"]');
      await page.waitForFunction(() => window.__studioDoc.frames?.welds?.length === 1 && /12 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    } finally { chat.kill(); }
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.waitForSelector('[aria-label="Weld list table"]', { timeout: 20000 });
      await page.check('[aria-label="Weld list table"]');
      await page.waitForFunction(() => window.__studioDrawing?.()?.tables?.some(t => t.id === 'weld-list' && !t.error), null, { timeout: 30000 });
      const issues = await page.evaluate(() => window.__studioDrawing?.()?.issues ?? []);
      assert.ok(!issues.some(i => (i.tables ?? []).includes('weld-list')), JSON.stringify(issues));
      await snap('frd1-weld-list');
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      const svg = fs.readFileSync(await svgFile.path(), 'utf8');
      for (const t of ['WELD LIST', 'W1', 'W16', 'MITRE', 'ON FACE', 'FILLET', '4', '3*', '?', 'BORE', '16 welds, seams 2692.5 mm in all (the bores marked ? not counted)']) assert.ok(svg.includes(`>${t}</text>`), `SVG: ${t}`);
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  await check('FRd2 the welded table\'s weld symbols on A3 by their checkbox: all 16 shown (O173: a pieced end face is its face, an edge on visible ink is visible), none said unshown; W-numbers and sizes in the SVG (O119)', async () => {
    const fs = await import('node:fs');
    if (!/12 bodies/.test(await page.textContent('.outliner') ?? '')) throw new Error('FRd1 left no welded table');
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.waitForSelector('[aria-label="Weld symbols"]', { timeout: 20000 });
      await page.check('[aria-label="Weld symbols"]');
      await page.waitForFunction(() => window.__studioDrawing?.()?.welds?.placed?.length > 0, null, { timeout: 30000 });
      const w = await page.evaluate(() => window.__studioDrawing().welds);
      // (O173, 35cb1bb82: W8 and W13–W16 had been read as unseen — their seams' end faces come in pieces, or lie on another
      // member's visible outline — and are shown; the model's frame-weld-symbols test changed with it.)
      assert.equal(w.placed.length, 16, JSON.stringify(w)); assert.deepEqual(w.unshown, []);
      const issues = await page.evaluate(() => window.__studioDrawing().issues);
      assert.ok(!issues.some(i => i.code === 'WELD_NOT_SHOWN'), JSON.stringify(issues));
      await snap('frd2-weld-symbols');
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      const svg = fs.readFileSync(await svgFile.path(), 'utf8');
      // (W1, the mitre set to 4 mm in FRd1: its size as set; the rest 3*, estimates.)
      for (const p of w.placed) assert.ok(svg.includes(`>${p.label}</text>`), `SVG: ${p.label}`);
      assert.ok(svg.includes('>4</text>') && svg.includes('>3*</text>'), 'sizes');
      assert.match(svg, /<g class="weld"/);
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  await check('FRe a slot nut on a T-slot frame member via the chat: the member\'s interfaces listed, the nut inserted and snapped 50 along its top slot (proposed, accepted), held by a mate (O120)', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
      await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const send = async (calls, ms = 120000) => {
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: ms });
      };
      const member = { kind: 'frame-member', section: { kind: 'tslot', cells: 1, openSlots: 4, size: 20, opening: 6.2, lip: 1.8, undercut: 11, depth: 6.1, bore: 4.2 }, start: [0, 0, 0], end: [0, 0, 300] };
      // (The first build of an empty part applies; the assembly's change is proposed, then accepted as the user would.)
      await send([{ tool: 'features', args: { action: 'add', features: [member] } }, { tool: 'assembly', args: { action: 'get' } }]);
      await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
      await send([{ tool: 'proposals', args: { action: 'propose', title: 'A slot nut', ops: [{ tool: 'assembly', args: { action: 'insert', library: 'tslot-20', part: 'slot-nut-m5' } },
        { tool: 'assembly', args: { action: 'snap', a: { part: 'base', interface: 'b0.slot-t1' }, b: { part: 'p1', interface: 'seat' }, offset: [50, 0, 0] } }] } }]);
      await page.waitForSelector('[aria-label="Proposal P1"]', { timeout: 15000 });
      await page.locator('[aria-label="Proposal P1"] button', { hasText: /^Accept/ }).click();
      await page.waitForFunction(() => window.__studioDoc.instances?.length === 1 && (window.__studioDoc.mates ?? []).length >= 1, null, { timeout: 60000 }); await idle();
      const mates = await page.evaluate(() => window.__studioDoc.mates);
      assert.ok(mates.some(m => /\.t1\.under0$/.test(m.a.face)), JSON.stringify(mates));
      await page.click('[aria-label="Close chat"]');
      await snap('fre-slot-nut');
    } finally { chat.kill(); }
  });

  await check('FRf two frames on one skeleton via the chat: 8 members; the skeleton\'s points moved, both follow (A · 800); deleting it refused, naming them (O121)', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
      await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const send = async (calls, ms = 120000) => {
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: ms });
      };
      const RHS = (w, t) => ({ kind: 'rect-tube', width: w, height: w, wall: t, outerRadius: 0 });
      const skeleton = { kind: 'skeleton', points: [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0]], segments: [[0, 1], [1, 2], [2, 3], [3, 0]] };
      const frame = section => ({ kind: 'frame', follows: { skeleton: 0 }, section, corners: { default: 'mitre' } });
      await send([{ tool: 'features', args: { action: 'add', features: [skeleton, frame(RHS(40, 3)), frame(RHS(20, 2))] } }]);
      await page.waitForFunction(() => /8 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
      // (A value edit applies at L2: the skeleton's corner points 600 → 800 along x.)
      await send([{ tool: 'features', args: { action: 'edit', index: 0, values: { 'p1.x': 800, 'p2.x': 800 } } }]);
      await page.waitForFunction(() => window.__studioDoc.nodes[0].points[1][0] === 800, null, { timeout: 60000 }); await idle();
      // (Each frame's longest members now 800: the first frame's member 1, A · 800 = 444 · 800, the panel to 1 mm³.)
      await page.click('[aria-label="Close chat"]');
      const vol = await bodyVolume(); assert.ok(Math.abs(vol - 444 * 800) <= 1, String(vol));
      await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      await send([{ tool: 'features', args: { action: 'delete', index: 0 } }]);
      const line = await page.locator('.chat-tool').last().innerText();
      assert.ok(line.includes('features.delete'), line);
      assert.equal(await page.evaluate(() => window.__studioDoc.nodes.length), 3, 'the skeleton kept');
      await page.click('[aria-label="Close chat"]');
      await snap('frf-skeleton');
    } finally { chat.kill(); }
  });

  await check('FRg a constrained 3D skeleton via the chat: a rough rectangle solved to 600 × 400 square on add, a frame on it — its first member 444 · 600 mm³ (O122)', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
      await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const constraints = [{ kind: 'fixed', point: 0 }, { kind: 'along', segment: 0, axis: 'x' }, { kind: 'on-plane', point: 2, plane: { origin: [0, 0, 0], normal: [0, 0, 1] } }, { kind: 'length', segment: 0, value: 600 }, { kind: 'length', segment: 1, value: 400 },
        { kind: 'perpendicular', a: 0, b: 1 }, { kind: 'parallel', a: 0, b: 2 }, { kind: 'parallel', a: 1, b: 3 }];
      const skeleton = { kind: 'skeleton', points: [[0, 0, 0], [590, 10, 0], [610, 390, 5], [-5, 405, 3]], segments: [[0, 1], [1, 2], [2, 3], [3, 0]], constraints };
      const frame = { kind: 'frame', follows: { skeleton: 0 }, section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } };
      const n = await page.locator('.chat-msg.assistant').count();
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls: [{ tool: 'features', args: { action: 'add', features: [skeleton, frame] } }] })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      await page.click('[aria-label="Close chat"]');
      await page.waitForFunction(() => /4 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
      // (Solved: the second corner at (600, 0, 0), the third on z = 0, all square.)
      const pts = await page.evaluate(() => window.__studioDoc.nodes[0].points);
      assert.ok(Math.abs(pts[1][0] - 600) < 1e-6 && Math.abs(pts[1][1]) < 1e-6 && Math.abs(pts[2][2]) < 1e-6, JSON.stringify(pts));
      const vol = await bodyVolume(); assert.ok(Math.abs(vol - 444 * 600) <= 1, String(vol));
      await snap('frg-skeleton-solved');
    } finally { chat.kill(); }
  });


  // ---- O140: FRg's lengths bound to parameters — re-solved when a parameter changes ---------------------------------------
  await check('FRg bound to parameters (O140): sides W and D via the chat, 444 · 600; W 800 in the panel re-solves (444 · 800); D −5 refused naming D', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.click('[aria-label="Parameters"]');
    for (const [name, value] of [['W', '600'], ['D', '400']]) { await page.fill('[aria-label="New parameter name"]', name); await page.fill('[aria-label="New parameter value"]', value); await page.click('[aria-label="Add parameter"]'); }
    await page.waitForFunction(() => window.__studioDoc.parameters.W === 600 && window.__studioDoc.parameters.D === 400, null, { timeout: 5000 });
    await page.click('[aria-label="Close parameters"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      if (!await page.locator('[aria-label="Chat message"]').count()) await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const constraints = [{ kind: 'fixed', point: 0 }, { kind: 'along', segment: 0, axis: 'x' }, { kind: 'on-plane', point: 2, plane: { origin: [0, 0, 0], normal: [0, 0, 1] } }, { kind: 'length', segment: 0, value: { parameter: 'W' } }, { kind: 'length', segment: 1, value: { parameter: 'D' } },
        { kind: 'perpendicular', a: 0, b: 1 }, { kind: 'parallel', a: 0, b: 2 }, { kind: 'parallel', a: 1, b: 3 }];
      const skeleton = { kind: 'skeleton', points: [[0, 0, 0], [590, 10, 0], [610, 390, 5], [-5, 405, 3]], segments: [[0, 1], [1, 2], [2, 3], [3, 0]], constraints };
      const frame = { kind: 'frame', follows: { skeleton: 0 }, section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } };
      const n = await page.locator('.chat-msg.assistant').count();
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls: [{ tool: 'features', args: { action: 'add', features: [skeleton, frame] } }] })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      assert.deepEqual(await page.locator('.chat-tool.err').allInnerTexts(), []);
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => /4 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    const first = async () => { await page.locator('.outliner .ol').first().click(); await page.waitForFunction(() => /Volume/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 30000 }); return bodyVolume(); };
    assert.ok(Math.abs(await first() - 444 * 600) <= 1);
    const setValue = async (name, v) => { await page.click('[aria-label="Parameters"]'); await page.fill(`[aria-label="Value of ${name}"]`, v); await page.locator(`[aria-label="Value of ${name}"]`).press('Enter'); await page.click('[aria-label="Close parameters"]'); };
    await setValue('W', '800');
    await page.waitForFunction(() => Math.abs(window.__studioDoc.nodes[0].points[1][0] - 800) < 1e-6, null, { timeout: 15000 }); await idle();
    assert.ok(Math.abs(await first() - 444 * 800) <= 1);
    await setValue('D', '-5');
    await page.waitForFunction(() => /That value does not hold/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 10000 });
    assert.match(await page.textContent('.toast'), /bound to D = -5/);
    assert.deepEqual(await page.evaluate(() => window.__studioDoc.parameters), { W: 800, D: 400 });
    await snap('frg-bound-parameters');
  });
  await check('FRf2 a base frame on a placed part\'s sketch via the chat: a saved assembly with a 300 × 200 plate at z = 100, a frame following its sketch — 4 members on z = 100, the part\'s revision pinned (O125)', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin, file = join(out, 'plate-assembly.bcad');
    const plate = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: { b1: { node: 1, side: 'solid' } }, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [300, 200] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }] };
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 0, outputs: {}, nodes: [], instances: [{ id: 'p1', name: 'Plate', doc: plate, position: [0, 0, 100], rotation: [0, 0, 0] }] }));
    await openModel(file, 0, 30000); await idle();
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count();
      const frame = { kind: 'frame', follows: { part: 'p1', sketch: 'n0' }, section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } };
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls: [{ tool: 'features', args: { action: 'add', features: [frame] } }] })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 120000 });
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => /^[0-9a-f]{16}$/.test(window.__studioDoc.nodes[0]?.follows?.revision ?? ''), null, { timeout: 60000 }); await idle();
    await page.waitForFunction(() => /4 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 });
    await snap('frf2-part-sketch');
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
      { id: 'n4', kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'y', angle: 10, pivot: [20, 0, 10] },
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
      { id: 'n4', kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'z', angle: 45, pivot: [0, 0, 10] },
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
    const props = await page.textContent('.props:not([aria-label$=" panel"])');
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
    await page.waitForFunction(() => /× 13\b/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 10000 });
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
    await page.waitForFunction(() => /SELECTION · POINT[\s\S]*32, 0, 16/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await page.keyboard.down('Shift'); await page.mouse.click(bx - 1, by + 1); await page.keyboard.up('Shift');
    await page.waitForFunction(() => /2 POINTS[\s\S]*Distance\s*32 mm/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
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
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
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
  // ---- O148 X1: sections as a list on any principal plane -------------------------------------------------------------
  await check('sections (O148 X1): a box drawn on A3; Add section gives B–B square to the top view beside it, its cut hatched; its view changed to the right; B–B alone as DXF; removed', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.click('[aria-label="Add section"]');
      await page.waitForFunction(() => { const d = window.__studioDrawing?.(); return d?.sections?.some(x => x.id === 'B' && x.rings === 1) && d.placedSections?.some(x => x.id === 'B' && x.of === 'top'); }, null, { timeout: 30000 });
      assert.deepEqual((await doc()).drawing.sections.map(x => [x.id, x.view]), [['B', 'top']]);
      assert.deepEqual(await page.evaluate(() => window.__studioDrawing().issues.filter(x => /OVERLAP|OVER_LINES|OFF_SHEET|DONT_FIT/.test(x.code)).map(x => x.code)), []);
      await snap('section-b-top');
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      assert.ok(fs.readFileSync(await svgFile.path(), 'utf8').includes('>SECTION B–B</text>'), 'B–B named in the SVG');
      // Its view changed: square to the right view's depth, through the middle; still one cut face.
      await page.selectOption('[aria-label="Section B view"]', 'right');
      await page.waitForFunction(() => { const d = window.__studioDrawing?.(); return d?.sections?.some(x => x.id === 'B' && x.view === 'right' && x.rings === 1) && d.placedSections?.some(x => x.id === 'B' && x.of === 'right'); }, null, { timeout: 30000 });
      const [dxfFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export section DXF"]')]);
      assert.match(dxfFile.suggestedFilename(), /section-B-B\.dxf$/);
      assert.ok(fs.readFileSync(await dxfFile.path(), 'latin1').includes('\nHATCH\n'), 'its hatch');
      await page.click('[aria-label="Remove section B"]');
      await page.waitForFunction(() => !window.__studioDoc.drawing?.sections && !window.__studioDoc.drawing?.section && !(window.__studioDrawing?.()?.placedSections ?? []).length, null, { timeout: 20000 });
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  await check('detail views (CG5 DR-1): the Detail tool (E) on a box corner in the top view, auto scale, rescaled, dragged, in the SVG, removed', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.waitForFunction(() => document.querySelector('[aria-label="Drawing sheet"]')?.getAttribute('viewBox')?.includes('420'), null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(500);
      const sheetScale = await page.evaluate(() => window.__studioDrawing().scale), auto = [10, 5, 2, 1, 0.5, 0.2, 0.1].filter(x => x >= 2 * sheetScale * (1 - 1e-9)).at(-1) ?? 2 * sheetScale;
      await press('e');
      // (The top view's corner at X 64, Y 32 — snapped — then a point 6 mm along X: the circle's reach.)
      const c = await page.evaluate(() => window.__studioDrawingAt('top', 64, 32)), r = await page.evaluate(() => window.__studioDrawingAt('top', 70, 32));
      await page.mouse.move(c.x, c.y); await page.mouse.click(c.x, c.y);
      await page.mouse.move(r.x, r.y); await page.mouse.click(r.x, r.y);
      await page.waitForFunction(() => window.__studioDrawing?.()?.details?.length === 1, null, { timeout: 20000 });
      const [det] = (await doc()).drawing.details;
      assert.equal(det.id, 'B'); assert.equal(det.view, 'top'); assert.deepEqual(det.center, [64, 32]);
      assert.ok(Math.abs(det.radius - 6) < 0.5, `radius ${det.radius}`);
      let d = await page.evaluate(() => window.__studioDrawing().details[0]);
      // (Auto: the smallest standard scale at least twice the sheet's; the corner's two edges inside the circle.)
      assert.equal(d.scale, auto, `sheet ${sheetScale}`); assert.ok(d.edges >= 2, `${d.edges} edges`);
      assert.ok(Math.abs((d.box[2] - d.box[0]) - 2 * auto * det.radius) < 1e-9);
      assert.deepEqual(await page.evaluate(() => window.__studioDrawing().issues.filter(x => /DETAIL|OVERLAP|OFF_SHEET/.test(x.code)).map(x => x.code)), []);
      const set = [10, 5, 2, 1, 0.5, 0.2, 0.1].find(x => x < auto), label = set >= 1 ? `${set}:1` : `1:${1 / set}`;
      await page.selectOption('[aria-label="Detail B scale"]', String(set));
      await page.waitForFunction(s => window.__studioDrawing?.()?.details?.[0]?.scale === s, set, { timeout: 20000 });
      d = await page.evaluate(() => window.__studioDrawing().details[0]);
      assert.ok(Math.abs((d.box[2] - d.box[0]) - 2 * set * det.radius) < 1e-9 && Math.abs((d.box[3] - d.box[1]) - 2 * set * det.radius) < 1e-9);
      await snap('detail-b');
      // Dragged by its drawing 20 mm left: kept where it was put.
      await press('v');
      const mid = await page.evaluate(([x0, y0, x1]) => { const svg = document.querySelector('[aria-label="Drawing sheet"]'), m = svg.getScreenCTM(); const p = new DOMPoint((x0 + x1) / 2, y0 + 3).matrixTransform(m), q = new DOMPoint((x0 + x1) / 2 - 20, y0 + 3).matrixTransform(m); return [p.x, p.y, q.x, q.y]; }, d.box);
      await page.mouse.move(mid[0], mid[1]); await page.mouse.down(); await page.mouse.move((mid[0] + mid[2]) / 2, mid[1], { steps: 4 }); await page.mouse.move(mid[2], mid[3], { steps: 4 }); await page.mouse.up();
      await page.waitForFunction(() => !!window.__studioDoc.drawing?.details?.[0]?.at, null, { timeout: 20000 });
      const moved = await page.evaluate(() => window.__studioDrawing().details[0].box);
      assert.ok(Math.abs((moved[0] - d.box[0]) + 20) < 0.6, `moved ${moved[0] - d.box[0]}`);
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      assert.ok(fs.readFileSync(await svgFile.path(), 'utf8').includes(`>DETAIL B (${label})</text>`), 'DETAIL B named in the SVG');
      await page.click('[aria-label="Remove detail B"]');
      await page.waitForFunction(() => !window.__studioDoc.drawing?.details && !(window.__studioDrawing?.()?.details ?? []).length, null, { timeout: 20000 });
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  await check('broken views (CG5 DR-2): a 500 mm bar, Add break, its ends typed, the front and top views shortened in projection, removed', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('500'); await field('Depth Y').fill('20'); await field('Height Z').fill('20'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 500×20×20/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.click('[aria-label="Add break"]');
      // (The middle third of the longest axis: X 167 to 333.)
      await page.waitForFunction(() => !!window.__studioDrawing?.()?.breaks?.front, null, { timeout: 20000 });
      assert.deepEqual((await doc()).drawing.breaks, [{ axis: 'x', from: 167, to: 333 }]);
      await page.fill('[aria-label="Break 1 from"]', '100'); await press('Enter');
      await page.waitForFunction(() => window.__studioDoc.drawing?.breaks?.[0]?.from === 100, null, { timeout: 20000 });
      await page.fill('[aria-label="Break 1 to"]', '400'); await press('Enter');
      await page.waitForFunction(() => window.__studioDrawing?.()?.breaks?.front?.[0]?.to === 400, null, { timeout: 20000 });
      const d = await page.evaluate(() => window.__studioDrawing());
      // (Drawn 200 mm of the 500 at the sheet's scale, plus the 6 mm gap; the top view with it, the right view whole.)
      const w = (id) => d.boxes[id][2] - d.boxes[id][0];
      assert.ok(Math.abs(w('front') - (200 * d.scale + 6)) < 1e-9 && Math.abs(w('top') - w('front')) < 1e-9, `${w('front')} at ${d.scale}`);
      assert.ok(!d.breaks.right && Math.abs(w('right') - 20 * d.scale) < 1e-9);
      assert.deepEqual(d.issues.filter(x => /BREAK|OVERLAP|OFF_SHEET/.test(x.code)).map(x => x.code), []);
      await snap('broken-bar');
      await page.click('[aria-label="Remove break 1"]');
      await page.waitForFunction(() => !window.__studioDoc.drawing?.breaks && !window.__studioDrawing?.()?.breaks?.front, null, { timeout: 20000 });
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  await check('section kinds (CG5 DR-3): a block with holes at Y 10 and Y 30; B–B on the front made offset (both holes, 4 faces), half (1 face), full again', async () => {
    const fs = await import('node:fs');
    const block = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40], id: 'n0' }, { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [15, 10], radius: 3, id: 'n2' }, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [45, 30], radius: 4, id: 'n3' }], outputs: { b3: { node: 3, side: 'solid' } }, nextId: 4 };
    const file = join(out, 'dr3-block.bcad'); fs.writeFileSync(file, JSON.stringify(block));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.nodes?.length === 4 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.click('[aria-label="Add section"]');
      await page.waitForFunction(() => window.__studioDoc.drawing?.sections?.some(x => x.id === 'B'), null, { timeout: 20000 });
      await page.selectOption('[aria-label="Section B view"]', 'front');
      await page.waitForFunction(() => window.__studioDoc.drawing.sections.find(x => x.id === 'B')?.view === 'front', null, { timeout: 20000 });
      await page.fill('[aria-label="Section B at"]', '10'); await press('Enter');
      await page.waitForFunction(() => window.__studioDrawing?.()?.sections?.some(x => x.id === 'B' && x.at === 10 && x.rings === 2), null, { timeout: 30000 });
      // Offset: a step at X 30 (the middle) to depth 30.
      await page.selectOption('[aria-label="Section B kind"]', 'offset');
      await page.waitForFunction(() => !!window.__studioDoc.drawing.sections.find(x => x.id === 'B')?.steps, null, { timeout: 20000 });
      await page.fill('[aria-label="Section B step 1 depth"]', '30'); await press('Enter');
      await page.waitForFunction(() => window.__studioDrawing?.()?.sections?.some(x => x.id === 'B' && x.rings === 4), null, { timeout: 30000 });
      assert.deepEqual((await doc()).drawing.sections.find(x => x.id === 'B').steps, [{ past: 30, at: 30 }]);
      assert.deepEqual(await page.evaluate(() => window.__studioDrawing().issues.filter(x => /OVERLAP|OVER_LINES|OFF_SHEET|DONT_FIT/.test(x.code)).map(x => x.code)), []);
      await snap('offset-b');
      // Half: cut right of X 30 — the face X 30–60 alone.
      await page.selectOption('[aria-label="Section B kind"]', 'half');
      await page.waitForFunction(() => window.__studioDrawing?.()?.sections?.some(x => x.id === 'B' && x.rings === 1), null, { timeout: 30000 });
      assert.deepEqual((await doc()).drawing.sections.find(x => x.id === 'B').half, { line: 'vertical', at: 30, cut: 'after' });
      await page.selectOption('[aria-label="Section B kind"]', 'full');
      await page.waitForFunction(() => window.__studioDrawing?.()?.sections?.some(x => x.id === 'B' && x.rings === 2), null, { timeout: 30000 });
      await page.click('[aria-label="Remove section B"]');
      await page.waitForFunction(() => !window.__studioDoc.drawing?.sections, null, { timeout: 20000 });
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  await check('section forms (CG5 DR-4): a bar cut at X 50 removed (2:1, dragged) and revolved onto the front view', async () => {
    const fs = await import('node:fs');
    // (A 100 × 10 × 20 bar with a Ø6 hole along Z at (50, 5): the plane X 50 cuts two faces, y 0–2 and 8–10 by z 0–20.)
    const bar = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [100, 10], id: 'n0' }, { kind: 'extrude', sketch: 0, height: 20, id: 'n1' }, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [50, 5], radius: 3, id: 'n2' }], outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3 };
    const file = join(out, 'dr4-bar.bcad'); fs.writeFileSync(file, JSON.stringify(bar));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.nodes?.length === 3 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.click('[aria-label="Add section"]');
      await page.waitForFunction(() => window.__studioDoc.drawing?.sections?.some(x => x.id === 'B'), null, { timeout: 20000 });
      await page.selectOption('[aria-label="Section B view"]', 'right');
      await page.waitForFunction(() => window.__studioDoc.drawing.sections.find(x => x.id === 'B')?.view === 'right', null, { timeout: 20000 });
      await page.fill('[aria-label="Section B at"]', '-50'); await press('Enter');
      await page.waitForFunction(() => window.__studioDrawing?.()?.sections?.some(x => x.id === 'B' && x.at === -50 && x.rings === 2), null, { timeout: 30000 });
      // Removed: the cut face alone (its eight lines), apart from the views; at 2:1 its box 20 × 40.
      await page.selectOption('[aria-label="Section B kind"]', 'removed');
      await page.waitForFunction(() => window.__studioDrawing?.()?.apartSections?.some(x => x.id === 'B' && x.form === 'removed' && x.edges === 8), null, { timeout: 30000 });
      await page.selectOption('[aria-label="Section B scale"]', '2');
      await page.waitForFunction(() => window.__studioDrawing?.()?.apartSections?.some(x => x.id === 'B' && x.scale === 2), null, { timeout: 30000 });
      let d = await page.evaluate(() => window.__studioDrawing());
      const rb = d.apartSections[0].box;
      assert.ok(Math.abs(rb[2] - rb[0] - 20) < 1e-9 && Math.abs(rb[3] - rb[1] - 40) < 1e-9, JSON.stringify(rb));
      assert.deepEqual(d.placedSections, [], 'no room taken in the rows');
      assert.deepEqual(d.issues.filter(x => /SECTION|OVERLAP|OFF_SHEET|DONT_FIT/.test(x.code)).map(x => x.code), []);
      await snap('removed-b');
      // Dragged 20 mm left: kept where it was put.
      await press('v');
      const mid = await page.evaluate(([x0, y0, x1]) => { const svg = document.querySelector('[aria-label="Drawing sheet"]'), m = svg.getScreenCTM(); const p = new DOMPoint((x0 + x1) / 2, y0 + 5).matrixTransform(m), q = new DOMPoint((x0 + x1) / 2 - 20, y0 + 5).matrixTransform(m); return [p.x, p.y, q.x, q.y]; }, rb);
      await page.mouse.move(mid[0], mid[1]); await page.mouse.down(); await page.mouse.move((mid[0] + mid[2]) / 2, mid[1], { steps: 4 }); await page.mouse.move(mid[2], mid[3], { steps: 4 }); await page.mouse.up();
      await page.waitForFunction(() => !!window.__studioDoc.drawing?.sections?.find(x => x.id === 'B')?.removed?.at, null, { timeout: 20000 });
      const moved = await page.evaluate(() => window.__studioDrawing().apartSections[0].box);
      assert.ok(Math.abs((moved[0] - rb[0]) + 20) < 0.6, `moved ${moved[0] - rb[0]}`);
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      // (Its scale named when not the sheet's.)
      assert.ok(fs.readFileSync(await svgFile.path(), 'utf8').includes(`>SECTION B–B${d.scale === 2 ? '' : ' (2:1)'}</text>`), 'SECTION B–B named in the SVG');
      // Revolved: onto the front view, at X 45–55 there (the front's box starts at X 0), z 0–20.
      await page.selectOption('[aria-label="Section B kind"]', 'revolved');
      await page.waitForFunction(() => window.__studioDrawing?.()?.apartSections?.some(x => x.id === 'B' && x.form === 'revolved' && x.on === 'front'), null, { timeout: 30000 });
      d = await page.evaluate(() => window.__studioDrawing());
      const vb = d.apartSections[0].box, fb = d.boxes.front;
      assert.ok(Math.abs(vb[0] - (fb[0] + 45 * d.scale)) < 1e-9 && Math.abs(vb[2] - (fb[0] + 55 * d.scale)) < 1e-9 && Math.abs(vb[1] - fb[1]) < 1e-9 && Math.abs(vb[3] - fb[3]) < 1e-9, `${vb} in ${fb} at ${d.scale}`);
      await snap('revolved-b');
      await page.selectOption('[aria-label="Section B kind"]', 'full');
      await page.waitForFunction(() => window.__studioDrawing?.()?.placedSections?.some(x => x.id === 'B') && !window.__studioDrawing().apartSections.length, null, { timeout: 30000 });
      await page.click('[aria-label="Remove section B"]');
      await page.waitForFunction(() => !window.__studioDoc.drawing?.sections, null, { timeout: 20000 });
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  await check('drawing metadata (CG5 DR-5): extended title block, two revision records, saved file and SVG/DXF exports', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter'); await idle();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 });
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.waitForSelector('[aria-label="Title block template"]', { timeout: 20000 });
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.selectOption('[aria-label="Title block template"]', 'extended');
      await page.locator('[aria-label="Title block fields"] > summary').click();
      for (const [label, value] of [['Organization', 'Flow shop'], ['Drawing number', 'DR-005'], ['Drawn by', 'Flow author'], ['Checked by', 'Flow checker'], ['Material', 'Flow material'], ['Finish', 'Flow finish']]) {
        await page.fill(`[aria-label="${label}"]`, value); await page.press(`[aria-label="${label}"]`, 'Enter');
      }
      await page.waitForFunction(() => window.__studioDoc.drawing.titleBlock?.finish === 'Flow finish');
      await page.click('[aria-label="Next revision"]');
      await page.locator('[aria-label="Revision history"] > summary').click();
      for (const [date, description] of [['2026-10-24', 'First test entry'], ['2026-10-25', 'Second test entry']]) {
        await page.fill('[aria-label="Revision date"]', date);
        await page.fill('[aria-label="Revision description"]', description);
        await page.fill('[aria-label="Revision by"]', 'Flow author');
        await page.click('[aria-label="Record revision"]');
        await page.waitForFunction(text => [...document.querySelectorAll('[aria-label="Drawing sheet"] text')].some(x => x.textContent === text), description, { timeout: 15000 });
        if (description === 'First test entry') await page.click('[aria-label="Next revision"]');
      }
      assert.equal(await page.isDisabled('[aria-label="Record revision"]'), true, 'no duplicate revision record');
      assert.deepEqual(await page.evaluate(() => window.__studioDoc.drawing.revisions.map(r => [r.revision, r.date, r.description, r.by])), [['A', '2026-10-24', 'First test entry', 'Flow author'], ['B', '2026-10-25', 'Second test entry', 'Flow author']]);
      await page.waitForFunction(() => !window.__studioDrawing().issues.some(x => x.severity === 'error' && x.tables?.includes('revisions')));
      await snap('dr5-extended-title-revisions');
      await page.locator('[aria-label="Drawing sheet"]').screenshot({ path: join(out, 'dr5-sheet.png') });
      for (const [label, name] of [['Export SVG', 'dr5-metadata.svg'], ['Export DXF', 'dr5-metadata.dxf']]) {
        const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click(`[aria-label="${label}"]`)]);
        const file = join(out, name); await download.saveAs(file);
        const text = fs.readFileSync(file, 'utf8');
        for (const value of ['Flow shop', 'DR-005', 'Flow material', 'Flow finish', 'First test entry', 'Second test entry']) assert.ok(text.includes(value), `${value} in ${name}`);
      }
      const [saved] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Save"]')]);
      const file = join(out, 'dr5-saved.bcad'); await saved.saveAs(file);
      const before = await page.evaluate(() => ({ titleBlock: window.__studioDoc.drawing.titleBlock, revisions: window.__studioDoc.drawing.revisions }));
      await page.click('.mode button:text-is("Model")');
      await openModel(file, 2); await idle();
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDoc.drawing?.revisions?.length === 2 && [...document.querySelectorAll('[aria-label="Drawing sheet"] text')].some(x => x.textContent === 'Second test entry'), null, { timeout: 20000 });
      assert.deepEqual(await page.evaluate(() => ({ titleBlock: window.__studioDoc.drawing.titleBlock, revisions: window.__studioDoc.drawing.revisions })), before);
      await page.selectOption('[aria-label="Title block template"]', 'basic');
      await page.waitForFunction(() => ![...document.querySelectorAll('[aria-label="Drawing sheet"] text')].some(x => x.textContent === 'Flow shop'));
      assert.equal(await page.evaluate(() => window.__studioDoc.drawing.titleBlock.organization), 'Flow shop', 'template switches keep metadata');
      await page.selectOption('[aria-label="Title block template"]', 'extended');
      await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Drawing sheet"] text')].some(x => x.textContent === 'Flow shop'));
      await snap('dr5-reopened');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  await check('geometric controls (CG5 DR-6a): fourteen characteristics, modifiers, typed missing datum issues, save and exports', async () => {
    const fs = await import('node:fs');
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter'); await idle();
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.waitForSelector('[aria-label="Auto-dimension"]', { timeout: 20000 });
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForSelector('.dw-dim', { timeout: 30000 }); await page.locator('.dw-dim').filter({ hasText: 'horizontal · front' }).first().click();
      await page.click('[aria-label="Add geometric control"]');
      await page.waitForFunction(() => window.__studioDoc.drawing?.frames?.length === 1);
      const shapes = {};
      // Sheet updates can replace SVG children; retry only a detached screenshot target.
      const controlShot = async name => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await page.locator('[aria-label="Drawing sheet"] g.control').screenshot({ path: join(out, name) });
            return;
          } catch (error) {
            if (attempt === 2 || !String(error?.message ?? error).includes('Element is not attached to the DOM')) throw error;
            console.warn(`DR6a control screenshot attempt ${attempt + 1}/3 failed; retrying ${name}: ${String(error?.message ?? error)}`);
          }
        }
      };
      for (const kind of ['position', 'straightness', 'flatness', 'circularity', 'cylindricity', 'profile-line', 'profile-surface', 'parallelism', 'perpendicularity', 'angularity', 'concentricity', 'symmetry', 'circular-runout', 'total-runout']) {
        await page.selectOption('[aria-label="Geometric characteristic"]', kind);
        await page.waitForFunction(k => window.__studioDoc.drawing.frames[0].characteristic === k && document.querySelector('[aria-label="Drawing sheet"] g.control'), kind);
        shapes[kind] = await page.locator('[aria-label="Drawing sheet"] g.control').innerHTML();
        if (['position', 'flatness', 'profile-surface', 'total-runout'].includes(kind)) await controlShot(`dr6a-${kind}.png`);
      }
      assert.equal(new Set(Object.values(shapes)).size, 14); fs.writeFileSync(join(out, 'dr6a-symbols.json'), JSON.stringify(shapes, null, 2));
      await page.selectOption('[aria-label="Geometric characteristic"]', 'position');
      await page.fill('[aria-label="Geometric tolerance"]', '0.05'); await page.press('[aria-label="Geometric tolerance"]', 'Enter');
      await page.selectOption('[aria-label="Material modifier"]', 'maximum');
      await page.check('[aria-label="Free state modifier"]'); await page.check('[aria-label="Tangent plane modifier"]');
      await page.fill('[aria-label="Projected zone height"]', '12'); await page.press('[aria-label="Projected zone height"]', 'Enter');
      await page.fill('[aria-label="Geometric datums"]', 'A, B'); await page.press('[aria-label="Geometric datums"]', 'Enter');
      await page.selectOption('[aria-label="Datum A modifier"]', 'least'); await page.selectOption('[aria-label="Datum B modifier"]', 'maximum');
      await page.waitForFunction(() => window.__studioDrawing().issues.some(x => x.code === 'DATUM_UNDEFINED'), null, { timeout: 10000 });
      await page.waitForFunction(() => { const t = [...document.querySelectorAll('[aria-label="Drawing sheet"] g.control text')].map(e => e.textContent); return ['Ø0.05', 'M', 'L', 'F', 'T', 'P', '12', 'A', 'B'].every(x => t.includes(x)); });
      await snap('dr6a-control-modifiers');
      await controlShot('dr6a-modifiers.png');
      for (const [label, name] of [['Export SVG', 'dr6a-controls.svg'], ['Export DXF', 'dr6a-controls.dxf']]) {
        const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click(`[aria-label="${label}"]`)]); await download.saveAs(join(out, name));
        const text = fs.readFileSync(join(out, name), 'utf8'); for (const value of ['0.05', 'M', 'L', 'F', 'T', 'P']) assert.ok(text.includes(value), `${value} in ${name}`);
      }
      const [saved] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Save"]')]); const file = join(out, 'dr6a-saved.bcad'); await saved.saveAs(file);
      const frame = await page.evaluate(() => window.__studioDoc.drawing.frames[0]);
      await page.click('.mode button:text-is("Model")'); await openModel(file, 2); await idle(); await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => document.querySelector('[aria-label="Drawing sheet"] g.control') && window.__studioDoc.drawing?.frames?.[0]?.projected === 12);
      assert.deepEqual(await page.evaluate(() => window.__studioDoc.drawing.frames[0]), frame);
      await page.locator('.dw-dim').filter({ hasText: 'horizontal · front' }).first().click();
      await page.fill('[aria-label="Geometric datums"]', ''); await page.press('[aria-label="Geometric datums"]', 'Enter');
      await page.waitForFunction(() => !window.__studioDrawing().issues.some(x => x.code === 'DATUM_UNDEFINED'));
      assert.equal(await page.evaluate(() => window.__studioDoc.drawing.frames[0].datumModifiers), undefined);
      await page.click('[aria-label="Remove geometric control"]');
      await page.waitForFunction(() => !window.__studioDoc.drawing.frames?.length && !document.querySelector('[aria-label="Drawing sheet"] g.control'));
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  await check('dimensions on sections (O148 X2): the shaft-and-hub file; B–B through the keyseat (Z 15); Auto-dimension puts b 6 and d − t1 16.5 on it with no DIM_ON_HIDDEN; the dimension tool snaps on the section', async () => {
    const fs = await import('node:fs');
    await openModel(join(root, '../../packages/barocss-cad-model/test/fixtures/shaft-hub-keyseat.bcad'), 5); await idle();
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.click('[aria-label="Add section"]');
      await page.waitForSelector('[aria-label="Section B at"]', { timeout: 20000 });
      await page.fill('[aria-label="Section B at"]', '-15'); await page.press('[aria-label="Section B at"]', 'Enter');
      await page.waitForFunction(() => window.__studioDrawing?.()?.sections?.some(x => x.id === 'B' && x.at === -15 && x.rings >= 2), null, { timeout: 30000 });
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => (window.__studioDoc.drawing?.dimensions ?? []).filter(d => d.view === 'section:B').length >= 2, null, { timeout: 90000 });
      // (The sheet is built after the document changes: waited for, not read at once.)
      await page.waitForFunction(() => { const on = new Set(window.__studioDoc.drawing.dimensions.filter(d => d.view === 'section:B').map(d => d.id)); const v = (window.__studioDrawing?.()?.dimensions ?? []).filter(d => on.has(d.id)).map(d => d.value); return [6, 16.5].every(w => v.some(x => Math.abs(x - w) < 1e-6)); }, null, { timeout: 30000 });
      assert.deepEqual(await page.evaluate(() => window.__studioDrawing().issues.filter(x => x.code === 'DIM_ON_HIDDEN' || x.code === 'DUPLICATE').map(x => x.code)), []);
      await snap('section-dimensions');
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      const svg = fs.readFileSync(await svgFile.path(), 'utf8');
      assert.ok(svg.includes('>SECTION B–B</text>') && svg.includes('>16.5</text>'), 'B–B and d − t1 in the SVG');
      // (The dimension tool on the section: the shaft's centre there is a snap point.)
      await press('d');
      const p = await page.evaluate(() => window.__studioDrawingAt('section:B', 0, 0));
      await page.mouse.move(p.x - 3, p.y); await page.mouse.move(p.x, p.y);
      await page.waitForFunction(() => !!document.querySelector('.dw-snap'), null, { timeout: 10000 });
      await press('Escape');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  await check('the section a dimension needs (O148 X3): the shaft-and-hub file auto-dimensioned; d − t1 on hidden lines offers Add B–B; applied and auto-dimensioned again, its dimensions on B–B and no DIM_ON_HIDDEN', async () => {
    await openModel(join(root, '../../packages/barocss-cad-model/test/fixtures/shaft-hub-keyseat.bcad'), 5); await idle();
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      await page.selectOption('[aria-label="Sheet size"]', 'A3');
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => (window.__studioDrawing?.()?.issues ?? []).some(x => x.code === 'DIM_ON_HIDDEN' && x.fix === 'add-section'), null, { timeout: 90000 });
      const fix = page.locator('button[aria-label^="Fix: Dimension 16.5 measures to"]').first();
      assert.equal((await fix.textContent()).trim(), 'Add B–B');
      await fix.click();
      await page.waitForFunction(() => JSON.stringify(window.__studioDoc.drawing?.sections) === JSON.stringify([{ id: 'B', view: 'top', at: -15 }]), null, { timeout: 20000 });
      await page.waitForFunction(() => window.__studioDrawing?.()?.placedSections?.some(x => x.id === 'B'), null, { timeout: 30000 });
      await page.click('[aria-label="Auto-dimension"]');
      await page.waitForFunction(() => (window.__studioDoc.drawing?.dimensions ?? []).filter(d => d.view === 'section:B').length >= 2 && !(window.__studioDrawing?.()?.issues ?? []).some(x => x.code === 'DIM_ON_HIDDEN'), null, { timeout: 90000 });
      await snap('section-fix');
    } finally { await page.click('.mode button:text-is("Model")'); }
  });
  await check('R14.1: Auto-dimension places overall sizes, the hole position and its callout; a hand-placed one is kept', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`));
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    try {
      await page.click('.mode button:text-is("Drawing")');
      await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
      const texts = async () => (await page.evaluate(() => window.__studioDrawing())).dimensions.map(d => d.text).sort();
      // One placed by hand first: the overall width.
      const clickView = async (view, u, v) => { const p = await page.evaluate(([view, u, v]) => window.__studioDrawingAt(view, u, v), [view, u, v]); await page.mouse.move(p.x - 3, p.y); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y); };
      // (Placed 30 mm off the front view: once the centre column narrowed, G12b, that is out on the paper, further than 30 mm
      // from any view, where a dimension being placed is still placed — read in its own view, wherever the pointer is.)
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
      // (O16: the drawing's settings at 1440, beside the sheet.)
      await page.locator('[aria-label="Drawing settings"]').screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-drawing-settings.png`) });
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
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
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
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
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
    // (O7b: the hole's position tolerance is worked out from the fastener sizes the person loaded — the sample here.)
    await page.click('[aria-label="New part"]'); await loadSampleSizes(); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Box 64×32×8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    const ext = (await doc()).nodes.length - 1;
    await page.waitForFunction(() => /Box/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(n => window.__studioSelectFace(n), `n${ext}.top`));
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
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
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''));
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
      await send([{ tool: 'model', args: { action: 'run', source } }]);
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 6 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
      assert.deepEqual((await doc()).nodes.map(n => n.kind), ['sketch', 'extrude', 'hole', 'hole', 'hole', 'fillet']);
      await page.waitForSelector('.toast:has-text("Applied by the agent")', { timeout: 10000 });
      await snap('a5-script');
      await page.click('.toast button:text-is("Undo")');
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 10000 });
      // A refused second line: nothing applied, the line named in the tool's result.
      await send([{ tool: 'model', args: { action: 'run', source: 'const p = box({w: 20, d: 20, h: 5})\nbox({w: 10, d: 10, h: 10, q: 1})' } }]);
      assert.match(await page.locator('.chat-tool').last().innerText(), /line 2/);
      assert.equal((await doc()).nodes.length, 0);
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- A5.3 (O11): the consolidated tools ---------------------------------------------------------------------------
  await check('A5.3: the chat server on the v2 tools (the only ones, O105) — describe, model, query and features calls build and read a part; a handler\'s own name is refused', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', c => failed(new Error(`the chat server exited (${c})`))); });
      await page.click('[aria-label="New part"]'); await idle();
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), tools = await page.locator('.chat-tool').count();
      const calls = [
        { tool: 'describe', args: { command: 'hole' } },
        { tool: 'model', args: { source: 'const p = box({w: 60, d: 30, h: 6, x: 0, y: 0, z: 0})\nfor (const i of range(2)) { hole(p.top, {d: 4, x: 15 + 30 * i, y: 15}) }' } },
        { tool: 'features', args: { action: 'edit', index: 1, values: { h: 8 } } },
        { tool: 'query', args: { action: 'mass' } },
        { tool: 'mass_properties', args: {} },
      ];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 4 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
      const d = await doc();
      assert.deepEqual([d.nodes.map(x => x.kind), d.nodes[1].height], [['sketch', 'extrude', 'hole', 'hole'], 8]);
      const shown = await page.locator('.chat-tool').allInnerTexts();
      assert.equal(shown.length - tools, 5, shown.join('\n'));
      assert.ok(!shown.slice(tools, -1).some(t => /error|takes "action"|unknown tool/i.test(t)), shown.join('\n'));
      assert.match(shown.at(-1), /Unknown tool: mass_properties/, shown.join('\n'));
      await snap('a5-v2');
      await page.click('.toast button:text-is("Undo")').catch(() => {});
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- A5.4 (O12): a part made by cad-cli -------------------------------------------------------------------------
  await check('A5.4: a part written by cad-cli from a script opens in the studio — its features, its body and its requirement', async () => {
    const fs = await import('node:fs'), { spawnSync } = await import('node:child_process');
    const script = join(out, 'cli-plate.cad.js'), part = join(out, 'cli-plate.bcad');
    fs.writeFileSync(script, 'const p = box({w: 80, d: 40, h: 8})\nfor (const i of range(3)) { hole(p.top, {d: 5, x: 20 + 20 * i, y: 20}) }\nrequirements([{id: "R1", source: "80 long", hard: true, check: {op: "==", query: {fn: "bbox", axis: "x"}, value: 80, tol: 0.1}}])');
    const r = spawnSync(process.execPath, [join(root, 'scripts/cad-cli.mjs'), 'run', script, '-o', part, '--check'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    await page.setInputFiles('input[aria-label="Model file"]', part);
    await page.waitForFunction(() => window.__studioDoc?.nodes?.length === 5 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const d = await doc();
    assert.deepEqual([d.nodes.map(n => n.kind), d.requirements.map(q => q.id)], [['sketch', 'extrude', 'hole', 'hole', 'hole'], ['R1']]);
    await snap('a5-cli');
  });

  // ---- RM1 (O14): the joint tree -----------------------------------------------------------------------------------
  await check('RM1: an assembly opened — the Joints card reads its mates as a continuous joint about +Z; the base link moved to the arm', async () => {
    const fs = await import('node:fs');
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/revolute/case.json'), 'utf8')), file = join(out, 'revolute.bcad');
    fs.writeFileSync(file, JSON.stringify(c.input.document));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 1, null, { timeout: 20000 }); await idle();
    await page.waitForSelector('[aria-label="Joints"] [aria-label="Joint base~arm"]', { timeout: 20000 });
    assert.match(await page.locator('[aria-label="Joint base~arm"]').innerText(), /Base part → arm\s+Continuous \+Z/);
    await page.selectOption('[aria-label="Base link"]', 'arm');
    await page.waitForFunction(() => window.__studioDoc.robot?.base === 'arm', null, { timeout: 10000 });
    assert.match(await page.locator('[aria-label="Joint base~arm"]').innerText(), /arm → Base part/);
    await snap('rm1-joints');
    // (O16: the panel at 1440 in the dock.)
    await page.locator('[aria-label="Joints"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-joints.png`) });
  });

  // ---- RM2 (O15): forward kinematics and the joint sliders ----------------------------------------------------------
  await check('RM2: the 2R arm posed by its sliders — the second arm swung a half turn, shown moved and not saved; Home puts it back; a joint played', async () => {
    const fs = await import('node:fs');
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/chain-2r/case.json'), 'utf8')), file = join(out, 'chain-2r.bcad');
    fs.writeFileSync(file, JSON.stringify(c.input.document));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 2 && window.__studioInstanceBounds?.().length === 2, null, { timeout: 20000 }); await idle();
    await page.waitForSelector('[aria-label="Joint a~b value"]', { timeout: 20000 });
    const before = await page.evaluate(() => window.__studioInstanceBounds().find(i => i.id === 'b'));
    const placed = JSON.stringify((await doc()).instances);
    // (R1c (3b): the pose lives outside React state — what a slider or a joint played does is still a preview, the history
    // as it was: the Undo button's state is checked around each.)
    const undoState = () => page.evaluate(() => { const b = document.querySelector('[aria-label="Undo"]'); return { tip: b?.getAttribute('data-tip'), off: !!b?.disabled }; });
    const undo0 = await undoState();
    // (A half turn of b about a's far hole at x = 60: its box, x 50…110, swings to 10…70.)
    // (A range input set as a person's drag sets it: the native value, then an input event React hears.)
    await page.evaluate(v => { const el = document.querySelector('[aria-label="Joint a~b value"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }, Math.PI);
    await page.waitForFunction(() => Math.abs(window.__studioInstanceBounds().find(i => i.id === 'b').min[0] - 10) < 1e-3, null, { timeout: 10000 });
    assert.ok(Math.abs(before.min[0] - 50) < 1e-3, JSON.stringify(before));
    assert.equal(JSON.stringify((await doc()).instances), placed, 'a preview: the placements are not changed');
    assert.match(await page.locator('[aria-label="Joint a~b"]').innerText(), /180\.0 °/);
    assert.deepEqual(await undoState(), undo0, 'a slider pose adds no undo entry');
    await snap('rm2-posed');
    // (G2: the posed arm sectioned — the plane in world space through the swung link, as the CPU's moved copies cut.)
    await page.click('[aria-label="Section view"]'); await page.waitForSelector('[data-handle="section"]', { timeout: 10000 });
    await page.click('[aria-label="Section across X"]'); await page.waitForTimeout(600); await snap('rm2-posed-section');
    const g2 = await sectionAgainstCpu('rm2-posed-section');
    if (g2) { console.log(`  G2 posed section, GPU against CPU: ${JSON.stringify(g2)}`); assert.ok(g2.strong <= 0.001 * g2.pixels, `the GPU's section within 0.1 % of the CPU's pixels (by more than 96): ${JSON.stringify(g2)}`); }
    await page.click('[aria-label="Section view"]'); await page.waitForFunction(() => !document.querySelector('[data-handle="section"]'), null, { timeout: 5000 });
    await page.click('[aria-label="Joints home"]');
    await page.waitForFunction(() => Math.abs(window.__studioInstanceBounds().find(i => i.id === 'b').min[0] - 50) < 1e-3, null, { timeout: 10000 });
    // Played: the first arm swings by itself, then stopped.
    const undo1 = await undoState();
    await page.click('[aria-label="Play joint base~a"]');
    await page.waitForFunction(() => Math.abs(window.__studioInstanceBounds().find(i => i.id === 'a').min[0] - 10) > 1, null, { timeout: 10000 });
    await page.click('[aria-label="Play joint base~a"]');
    assert.deepEqual(await undoState(), undo1, 'a joint played adds no undo entry');
    assert.equal(JSON.stringify((await doc()).instances), placed, 'nor changes the placements');
    // Saved while posed and opened again: the pose is not saved, as before (a preview) — the arm opens at home.
    const posed = await page.evaluate(() => window.__studioInstanceBounds().find(i => i.id === 'b'));
    assert.ok(Math.abs(posed.min[0] - 50) > 1, `posed when saved: ${JSON.stringify(posed)}`);
    const [saved] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[aria-label="Save"]')]);
    const again = join(out, 'saved-rm2-posed.bcad'); fs.writeFileSync(again, fs.readFileSync(await saved.path()));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => !window.__studioDoc.instances?.length, null, { timeout: 15000 });
    await page.setInputFiles('input[aria-label="Model file"]', again);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 2 && window.__studioInstanceBounds?.().length === 2, null, { timeout: 20000 }); await idle();
    await page.waitForFunction(() => Math.abs(window.__studioInstanceBounds().find(i => i.id === 'b').min[0] - 50) < 1e-3, null, { timeout: 10000 });
    assert.equal(JSON.stringify((await doc()).instances), placed, 'the placements as saved');
    await page.click('[aria-label="Joints home"]');
  });

  // ---- RM3 (O16): link inertia ------------------------------------------------------------------------------------
  await check('RM3: the 2R arm\'s links with their mass and centre of mass in the link frame, the material said to be assumed', async () => {
    const fs = await import('node:fs');
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/chain-2r/case.json'), 'utf8')), file = join(out, 'chain-2r-mass.bcad');
    fs.writeFileSync(file, JSON.stringify(c.input.document));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 2, null, { timeout: 20000 }); await idle();
    // (O75: one summary line — the links and their total — the list on demand.)
    await page.waitForSelector('[aria-label="Link masses"]', { timeout: 20000 });
    assert.match(await page.locator('[aria-label="Link masses"]').innerText(), /Links\s*3 · 131\.9 g\s*·\s*material assumed/);
    assert.equal(await page.locator('[aria-label="Link a mass"]').count(), 0, 'collapsed: no list');
    await page.click('[aria-label="Show link masses"]');
    await page.waitForSelector('[aria-label="Link a mass"]', { timeout: 5000 });
    // (An arm 60 × 20 × 5 less two Ø10 holes, aluminium: 14.1 g; its centre 20 mm along from its turning hole, 2.5 up.)
    const a = await page.locator('[aria-label="Link a mass"]').innerText();
    assert.match(a, /14\.1 g/); assert.match(a, /CoM \(20\.0, 0\.0, 2\.5\) mm · material assumed/);
    assert.match(await page.locator('[aria-label="Link base mass"]').innerText(), /103\.8 g/);
    await snap('rm3-mass');
    await page.click('[aria-label="Hide link masses"]');
    assert.equal(await page.locator('[aria-label="Link a mass"]').count(), 0);
  });

  // ---- RM4 (O17): URDF export -------------------------------------------------------------------------------------
  await check('RM4: Export URDF from the Joints card — a zip of robot.urdf and each link\'s mesh and convex hull; the same URDF as cad-cli writes', async () => {
    const fs = await import('node:fs');
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/chain-2r/case.json'), 'utf8')), file = join(out, 'chain-2r-urdf.bcad');
    fs.writeFileSync(file, JSON.stringify(c.input.document));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 2, null, { timeout: 20000 }); await idle();
    await page.waitForSelector('[aria-label="Export URDF"]', { timeout: 20000 });
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export URDF"]')]);
    assert.match(d.suggestedFilename(), /-urdf\.zip$/);
    const zip = fs.readFileSync(await d.path());
    assert.equal(zip.readUInt32LE(0), 0x04034b50, 'a zip');
    const names = zip.toString('latin1');
    for (const n of ['robot.urdf', 'meshes/base.stl', 'meshes/a_collision.stl', 'meshes/b.stl']) assert.ok(names.includes(n), n);
    // (The URDF inside, inflated by the browser's own zip reader is not at hand here: python3's zipfile reads it.)
    const { spawnSync } = await import('node:child_process');
    const py = spawnSync('python3', ['-I', '-c', 'import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); print(z.read("robot.urdf").decode())', await d.path()], { encoding: 'utf8' });
    assert.equal(py.status, 0, py.stderr);
    // (The studio's bodies are placed in the world, the CLI's in their parts: the same URDF to rounding, the robot named
    // after the file. Compared with the name set aside and every number to 12 significant figures.)
    const norm = t => t.trim().replace(/<robot name="[^"]*">/, '<robot>').replace(/-?\d+(\.\d+)?(e-?\d+)?/g, x => { const v = Number(x); return Math.abs(v) < 1e-15 ? '0' : String(Number(v.toPrecision(12))); });
    assert.equal(norm(py.stdout), norm(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/urdf-2r/robot.urdf'), 'utf8')), 'the studio\'s URDF is the CLI\'s');
    await snap('rm4-urdf');
  });

  // ---- RM5 (O18): MJCF export -------------------------------------------------------------------------------------
  await check('RM5: the 6R arm opened, Export MJCF — a zip of robot.xml (seven nested bodies, six hinges) and its meshes, the CLI\'s model', async () => {
    const fs = await import('node:fs'), { spawnSync } = await import('node:child_process');
    await page.setInputFiles('input[aria-label="Model file"]', join(root, '../../packages/barocss-cad/conformance/rm/arm-6r/robot.bcad'));
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 6, null, { timeout: 20000 }); await idle();
    await page.waitForSelector('[aria-label="Joint l5~l6"]', { timeout: 30000 });
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('[aria-label="Export MJCF"]')]);
    assert.match(d.suggestedFilename(), /-mjcf\.zip$/);
    const py = spawnSync('python3', ['-I', '-c', 'import sys, zipfile, xml.etree.ElementTree as ET; z = zipfile.ZipFile(sys.argv[1]); r = ET.fromstring(z.read("robot.xml")); print(len(r.findall(".//body")), len(r.findall(".//joint[@type=\'hinge\']")), len([n for n in z.namelist() if n.startswith("meshes/")])); print(z.read("robot.xml").decode())', await d.path()], { encoding: 'utf8' });
    assert.equal(py.status, 0, py.stderr);
    const [counts, ...xml] = py.stdout.split('\n');
    assert.equal(counts, '7 6 14');
    const norm = t => t.trim().replace(/<mujoco model="[^"]*">/, '<mujoco>').replace(/-?\d+(\.\d+)?(e-?\d+)?/g, x => { const v = Number(x); return Math.abs(v) < 1e-15 ? '0' : String(Number(v.toPrecision(12))); });
    assert.equal(norm(xml.join('\n')), norm(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/arm-6r/robot.xml'), 'utf8')), 'the studio\'s MJCF is the CLI\'s');
    await snap('rm5-arm');
  });

  // ---- O12: tool and sensor frames in the Joints card ---------------------------------------------------------------
  await check('O12: the 6R arm with a TCP on l6 and a camera on l3 — the Joints card reads each frame out where MuJoCo puts it; l6 turned a quarter moves the TCP, not the camera', async () => {
    const fs = await import('node:fs'), file = join(out, 'arm-6r-frames.bcad');
    const d = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/arm-6r/robot.bcad'), 'utf8'));
    // (The frames robot-frames.test.ts and conformance/rm/arm-6r/frames use; their zero pose from its expect.json, MuJoCo 3.3.0's sites.)
    d.robot = { version: 1, frames: { tcp: { link: 'l6', position: [5, -3, 40], rotation: [0, 90, 0], kind: 'tool' }, cam: { link: 'l3', position: [10, 20, 5], rotation: [30, -15, 60], kind: 'sensor' } } };
    fs.writeFileSync(file, JSON.stringify(d));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 6 && window.__studioDoc.robot?.frames?.tcp, null, { timeout: 20000 }); await idle();
    const frame = n => page.locator(`[aria-label="Frame ${n}"] b`).evaluate(e => e.textContent);
    await page.waitForSelector('[aria-label="Frame tcp"]', { timeout: 30000 });
    const zero = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/arm-6r/frames/expect.json'), 'utf8')).samples[0];
    assert.ok(Object.values(zero.q).every(v => v === 0));
    const text = f => `(${f.o.map(v => (v * 1000).toFixed(1)).join(', ')}) · Z (${[f.R[2], f.R[5], f.R[8]].map(v => { const t = v.toFixed(3); return t === '-0.000' ? '0.000' : t; }).join(', ')})`;
    assert.equal(await frame('tcp'), text(zero.frames.tcp));
    assert.equal(await frame('cam'), text(zero.frames.cam));
    assert.match(await page.locator('[aria-label="Frame tcp"]').evaluate(e => e.textContent), /^tcp tool · \S/);
    const cam = await frame('cam');
    await page.evaluate(v => { const el = document.querySelector('[aria-label="Joint l5~l6 value"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }, Math.PI / 2);
    await page.waitForFunction(() => /^\(63\.0, 105\.0, 330\.0\)/.test(document.querySelector('[aria-label="Frame tcp"] b')?.textContent ?? ''), null, { timeout: 10000 });
    assert.equal(await frame('tcp'), '(63.0, 105.0, 330.0) · Z (0.000, 1.000, 0.000)');
    assert.equal(await frame('cam'), cam, 'the camera is on l3: l6 does not move it');
    await page.locator('[aria-label="Joints"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o12-frames.png`) });
    await page.click('[aria-label="Joints home"]');
    await page.waitForFunction(() => /^\(45\.0, 97\.0, 330\.0\)/.test(document.querySelector('[aria-label="Frame tcp"] b')?.textContent ?? ''), null, { timeout: 10000 });
  });

  // ---- G13: tool and sensor frames in the viewport --------------------------------------------------------------------
  await check('G13: the 6R arm\'s TCP and camera drawn as triads in the viewport — the TCP\'s at MuJoCo\'s point at the zero pose and after a quarter turn of l6, its Z along +Y then; the camera\'s where it was — on either renderer', async () => {
    const fs = await import('node:fs'), file = join(out, 'g13-arm-6r-frames.bcad');
    const d = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/arm-6r/robot.bcad'), 'utf8'));
    d.robot = { version: 1, frames: { tcp: { link: 'l6', position: [5, -3, 40], rotation: [0, 90, 0], kind: 'tool' }, cam: { link: 'l3', position: [10, 20, 5], rotation: [30, -15, 60], kind: 'sensor' } } };
    fs.writeFileSync(file, JSON.stringify(d));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => (window.__studioFrameTriads?.() ?? []).length === 2, null, { timeout: 30000 }); await idle();
    await page.click('.views button[title="Frame all (F)"]'); await page.waitForTimeout(600);
    const webgpu = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer === 'webgpu');
    const tri = () => page.evaluate(() => Object.fromEntries(window.__studioFrameTriads().map(f => [f.name, f])));
    const near = (a, b, tol) => a.every((v, k) => Math.abs(v - b[k]) < tol);
    const unit = (a, b) => { const v = b.map((x, k) => x - a[k]), n = Math.hypot(...v); return v.map(x => x / n); };
    // (Drawn where it says: on WebGPU the Z axis's middle is the triad's blue on the canvas; on WebGL2 the overlay's Z line
    // runs from the origin's screen point to the end's.)
    const drawn = async f => {
      if (webgpu) {
        // (A quarter, the middle and three quarters along it: a 2 px line's samples, one of them its blue.)
        const along = [0.25, 0.5, 0.75].map(u => f.o.map((v, k) => v + u * (f.z[k] - v)));
        const px = await page.evaluate(p => window.__studioPixels(p), along);
        return px.some(c => c[2] > c[0] + 40 && c[2] > c[1] + 10) ? null : `the ${f.name} Z axis is not blue along it: ${JSON.stringify(px)} at ${JSON.stringify(await page.evaluate(p => p.map(q => window.__studioScreenOf(q)), along))}`;
      }
      const [o, z] = await page.evaluate(f => [window.__studioScreenOf(f.o), window.__studioScreenOf(f.z)], f);
      const line = await page.evaluate(n => { const l = document.querySelectorAll(`.vp-overlay [aria-label="Frame triad ${n}"] line`)[2]; return l && [+l.getAttribute('x1'), +l.getAttribute('y1'), +l.getAttribute('x2'), +l.getAttribute('y2')]; }, f.name);
      return line && near(line, [...o, ...z], 1) ? null : `the ${f.name} Z line ${JSON.stringify(line)} is not from ${JSON.stringify(o)} to ${JSON.stringify(z)}`;
    };
    let t = await tri();
    assert.ok(near(t.tcp.o, [45, 97, 330], 0.05), `the TCP at the zero pose ${JSON.stringify(t.tcp.o)}`);
    assert.equal(t.tcp.kind, 'tool'); assert.equal(t.cam.kind, 'sensor');
    assert.equal(await drawn(t.tcp), null); assert.equal(await drawn(t.cam), null);
    await snap('g13-frames-zero');
    const cam = t.cam.o;
    await page.evaluate(v => { const el = document.querySelector('[aria-label="Joint l5~l6 value"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }, Math.PI / 2);
    await page.waitForFunction(() => { const f = window.__studioFrameTriads().find(x => x.name === 'tcp'); return Math.abs(f.o[0] - 63) < 0.05 && Math.abs(f.o[1] - 105) < 0.05; }, null, { timeout: 10000 });
    await page.waitForTimeout(400);
    t = await tri();
    assert.ok(near(t.tcp.o, [63, 105, 330], 0.05), `the TCP after a quarter turn ${JSON.stringify(t.tcp.o)}`);
    assert.ok(near(unit(t.tcp.o, t.tcp.z), [0, 1, 0], 1e-6), `its Z along +Y ${JSON.stringify(unit(t.tcp.o, t.tcp.z))}`);
    assert.ok(near(t.cam.o, cam, 1e-9), 'the camera is on l3: l6 does not move it');
    await snap('g13-frames-turned');
    assert.equal(await drawn(t.tcp), null);
    await page.click('[aria-label="Joints home"]');
    await page.waitForFunction(() => Math.abs(window.__studioFrameTriads().find(x => x.name === 'tcp').o[0] - 45) < 0.05, null, { timeout: 10000 });
  });

  // ---- O11: the Variants card ---------------------------------------------------------------------------------------
  await check('O11: the Variants card — a variant shown regenerated from the master (the pin moved, the loop\'s mates unmet), modelling waits; values edited, updated, reset and saved as a variant; the master shown edits again; the agent\'s set_variants in the card', async () => {
    // (test/fixtures/o11/variants.bcad: o11-fixtures' plateMaster — "offset" drives the pin's distance above the plate,
    // 5 in the master, high 25, low 1 — and a mate loop a~b whose "gap" input drives m2.)
    await page.setInputFiles('input[aria-label="Model file"]', join(root, 'test/fixtures/o11/variants.bcad'));
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 3 && window.__studioInstanceBounds?.().length === 3, null, { timeout: 20000 }); await idle();
    const pinZ = () => page.evaluate(() => window.__studioInstanceBounds().find(i => i.id === 'pin').min[2]);
    const pinAt = z => page.waitForFunction(z => Math.abs(window.__studioInstanceBounds().find(i => i.id === 'pin').min[2] - z) < 1e-6, z, { timeout: 20000 });
    const card = page.locator('[aria-label="Variants panel"]'), sets = () => card.locator('[aria-label^="Set "]').evaluateAll(ls => ls.map(l => `${l.getAttribute('aria-label').slice(4)}${l.dataset.active ? '*' : ''}`));
    const variants = () => page.evaluate(() => window.__studioDoc.variability.variants.map(v => `${v.name}:${v.values.offset}`).join(' '));
    assert.ok(Math.abs(await pinZ() - 13) < 1e-6, 'the master: the pin 5 above the 8 mm plate');
    await page.click('[aria-label="Variants"]'); await card.waitFor({ timeout: 5000 });
    assert.deepEqual(await sets(), ['Master*', 'high', 'low']);
    assert.equal(await card.locator('[aria-label="Variant shown"]').count(), 0);
    // Show high: the pin 25 above; the banner; the loop's two mates listed unmet; the document's own master untouched.
    const master = await page.evaluate(() => JSON.stringify(window.__studioDoc.instances));
    await card.locator('[aria-label="Show high"]').click(); await pinAt(33); await idle();
    assert.deepEqual(await sets(), ['Master', 'high*', 'low']);
    assert.match(await card.locator('[aria-label="Variant shown"]').innerText(), /Showing high, regenerated from the master/);
    assert.deepEqual(await card.locator('[aria-label^="Unmet mate "]').evaluateAll(ls => ls.map(l => l.getAttribute('aria-label'))), ['Unmet mate m2', 'Unmet mate m3']);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__studioDoc.instances)), master, 'showing writes nothing of the master');
    assert.equal(await page.evaluate(() => window.__studioDoc.variability.active), 'high');
    await page.locator('[aria-label="Variants panel"] .dock-section-head').screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o11-head.png`) });
    await card.screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o11-variants.png`) });
    // Modelling waits while a variant is shown.
    await page.evaluate(() => document.activeElement?.blur?.()); await press('b');
    await page.waitForFunction(() => /Showing high: show the master to edit/.test(document.body.textContent ?? ''), null, { timeout: 5000 });
    assert.equal(await page.locator('.hud .status').count(), 0, 'no command started');
    // Every other edit too — one guard where edits land (App's setDoc): the feature editor's Apply, a placed part moved
    // (the Instance card's X, the commit a gizmo drag makes), a parameter added; each refused, the part as it was.
    const model = () => page.evaluate(() => JSON.stringify({ nodes: window.__studioDoc.nodes, instances: window.__studioDoc.instances, parameters: window.__studioDoc.parameters }));
    const refusedNow = async () => {
      await page.waitForFunction(() => /Showing high: show the master to edit/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 5000 });
      await page.click('.toast [aria-label="Dismiss"]');
    };
    const edits = {
      feature: async v => { await page.locator('.history .hs', { hasText: 'Extrude' }).last().click(); const ed = page.locator('.node-editor .field input[type="number"]').first(); await ed.fill(''); await ed.fill(v); await page.locator('.node-editor button', { hasText: 'Apply' }).click(); },
      instance: async v => { await page.locator('.ol.instance', { hasText: 'pin' }).first().click(); const x = page.locator('[aria-label="Instance"] input[aria-label="Instance X"]').first(); await x.fill(v); await x.press('Enter'); },
      parameter: async v => { await page.click('[aria-label="Parameters"]'); await page.fill('[aria-label="New parameter name"]', 'T'); await page.fill('[aria-label="New parameter value"]', v); await page.click('[aria-label="Add parameter"]'); },
    };
    await page.click('.toast [aria-label="Dismiss"]');
    const kept = await model();
    await edits.feature('9'); await refusedNow(); await press('Escape');
    await edits.instance('21'); await refusedNow();
    await edits.parameter('3'); await refusedNow(); await page.click('[aria-label="Parameters"]');
    assert.equal(await model(), kept, 'nothing of the master written while high is shown');
    assert.equal(await page.evaluate(() => window.__studioDoc.variability.active), 'high');
    // A working value: the pin follows, unsaved; Reset puts high back; Update writes it into high.
    await card.locator('[aria-label="Value of offset"]').fill('15'); await pinAt(23);
    assert.match(await card.locator('[aria-label="Values edited"]').innerText(), /1 value differs from high/);
    assert.match(await card.locator('[aria-label="Variant shown"]').innerText(), /Showing high, edited/);
    assert.equal(await variants(), 'high:25 low:1', 'not saved');
    await card.locator('[aria-label="Reset to high"]').click(); await pinAt(33);
    await card.locator('[aria-label="Value of offset"]').fill('15'); await pinAt(23);
    await card.locator('[aria-label="Update high"]').click();
    await page.waitForFunction(() => window.__studioDoc.variability.variants.find(v => v.name === 'high').values.offset === 15, null, { timeout: 5000 });
    assert.equal(await card.locator('[aria-label="Values edited"]').count(), 0);
    // Saved as a new variant, made active.
    await card.locator('[aria-label="Value of offset"]').fill('7'); await pinAt(15);
    await card.locator('[aria-label="Variant name"]').fill('mid'); await card.locator('[aria-label="Save variant"]').click();
    await page.waitForFunction(() => window.__studioDoc.variability.active === 'mid', null, { timeout: 5000 });
    assert.equal(await variants(), 'high:15 low:1 mid:7');
    assert.deepEqual(await sets(), ['Master', 'high', 'low', 'mid*']);
    // The master shown: the pin back, the banner gone, modelling again.
    await card.locator('[aria-label="Show the master"]').click(); await pinAt(13); await idle();
    assert.equal(await card.locator('[aria-label="Variant shown"]').count(), 0);
    assert.equal(await page.evaluate(() => window.__studioDoc.variability.active), undefined);
    await page.evaluate(() => document.activeElement?.blur?.()); await press('b'); await hudReady();
    await press('Escape'); await page.waitForFunction(() => !document.querySelector('.hud .status'), null, { timeout: 5000 });
    // The same three edits taken now.
    await edits.feature('9'); await page.waitForFunction(() => JSON.stringify(window.__studioDoc.nodes).includes('9'), null, { timeout: 15000 }); await press('Escape'); await idle();
    await edits.instance('21'); await page.waitForFunction(() => window.__studioDoc.instances.find(i => i.id === 'pin').position[0] === 21, null, { timeout: 15000 });
    await edits.parameter('3'); await page.waitForFunction(() => window.__studioDoc.parameters.T === 3, null, { timeout: 15000 }); await page.click('[aria-label="Parameters"]'); await idle();
    // The agent's set_variants (a scripted turn, the chat's own end of it): its variant in the card.
    await page.route(u => u.pathname === '/api/chat/status', r => r.fulfill({ json: { enabled: true, model: 'mock-model', via: 'mock' } }));
    const done = await page.evaluate(() => { const d = window.__studioDoc; return { ...d, variability: { ...d.variability, variants: [...d.variability.variants, { name: 'agent wide', values: { offset: 40 } }] } }; });
    await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !!window.__studioScriptChat);
    await page.evaluate(turn => window.__studioScriptChat([turn]), [{ type: 'tool', name: 'assembly', input: { action: 'variants', variants: { 'agent wide': { offset: 40 } } }, summary: 'variants: defined agent wide', isError: false }, { type: 'text', delta: 'Added agent wide.' }, { type: 'done', doc: done, session: 'cli-session-o11', end: 'done' }]);
    await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled);
    await page.locator('[aria-label="Chat message"]').fill('add a variant with the pin 40 above'); await press('Enter');
    await page.waitForSelector('.chat-msg.assistant:has-text("Added agent wide.")', { timeout: 30000 });
    await page.waitForFunction(() => window.__studioDoc.variability.variants.some(v => v.name === 'agent wide'), null, { timeout: 10000 });
    await page.waitForSelector('[aria-label="Variants panel"] [aria-label="Set agent wide"]', { timeout: 10000 });
    await page.evaluate(() => window.__studioUnscriptChat?.()); await page.click('[aria-label="Close chat"]');
    // (Closed again, as a person would; the steps after read the inspector past any "… panel" card anyway.)
    await card.locator('[aria-label="Close Variants"]').click(); await card.waitFor({ state: 'detached', timeout: 5000 });
  });

  // ---- RM6 (O19): the collision sweep -----------------------------------------------------------------------------
  await check('RM6: the 2R arm swung into a grounded post — Check path reports the contact with the post; a small move is clear', async () => {
    const fs = await import('node:fs');
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/sweep-post/case.json'), 'utf8')), file = join(out, 'sweep-post.bcad');
    fs.writeFileSync(file, JSON.stringify(c.input.document));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 3 && window.__studioInstanceBounds?.().length === 3, null, { timeout: 20000 }); await idle();
    await page.waitForSelector('[aria-label="Joint base~a value"]', { timeout: 20000 });
    const set = v => page.evaluate(x => { const el = document.querySelector('[aria-label="Joint base~a value"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    await set(2);
    await page.click('[aria-label="Check path"]');
    await page.waitForSelector('[aria-label="Path check"]', { timeout: 20000 });
    assert.match(await page.locator('[aria-label="Path check"]').innerText(), /^Contact .*post.* at \d+\.\d % of the move/);
    await snap('rm6-contact');
    await set(-0.5);
    await page.click('[aria-label="Check path"]');
    await page.waitForFunction(() => /^Clear: the whole move certified/.test(document.querySelector('[aria-label="Path check"]')?.textContent ?? ''), null, { timeout: 20000 });
    await page.click('[aria-label="Joints home"]');
  });

  // ---- RD1 (O20): static gravity torques --------------------------------------------------------------------------
  await check('RD1: the planar 3R posed by its sliders — each joint holds the closed form\'s torque against gravity (4 figures)', async () => {
    const fs = await import('node:fs');
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/gravity-3r/case.json'), 'utf8')), file = join(out, 'gravity-3r.bcad');
    fs.writeFileSync(file, JSON.stringify(c.input.document));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 3, null, { timeout: 20000 }); await idle();
    await page.waitForSelector('[aria-label="Joint l2~l3 holding"]', { timeout: 30000 });
    for (const [k, v] of Object.entries(c.input.values)) await page.evaluate(([key, x]) => { const el = document.querySelector(`[aria-label="Joint ${key} value"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [k, v]);
    for (const [k, t] of Object.entries(c.expect.torques_N_m)) {
      await page.waitForFunction(([key, want]) => document.querySelector(`[aria-label="Joint ${key} holding"]`)?.textContent === `holds ${want} N·m against gravity`, [k, String(Number(t.toPrecision(4)))], { timeout: 10000 })
        .catch(async e => { throw new Error(`${e.message.split('\n')[0]}: ${await page.locator(`[aria-label="Joint ${k} holding"]`).innerText()} vs ${t}`); });
    }
    await snap('rd1-holding');
    await page.click('[aria-label="Joints home"]');
  });

  // ---- RD2 (O21): a move's torques -----------------------------------------------------------------------------------
  await check('RD2: motion_torques through the real chat and tool servers on the planar 2R — the S-curve\'s duration and each joint\'s peak as the conformance case has them', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/move-2r/case.json'), 'utf8')), file = join(out, 'move-2r.bcad');
    fs.writeFileSync(file, JSON.stringify(c.input.document));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 2, null, { timeout: 20000 }); await idle();
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [{ tool: 'assembly', args: { action: 'move', to: Object.fromEntries(Object.entries(c.input.to).map(([k, v]) => [k, v * 180 / Math.PI])), profile: c.input.profile, limits: Object.fromEntries(Object.entries(c.input.limits).map(([k, v]) => [k, v * 180 / Math.PI])) } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const line = await page.locator('.chat-tool').last().innerText();
      // (The chat lists a read tool's result as the start of its JSON: the profile and its duration first.)
      assert.ok(line.includes(`"profile":"s-curve","duration":${Number(c.expect.duration_s.toPrecision(10))}`), line);
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- RD3 (O22): actuator sizing --------------------------------------------------------------------------------------
  await check('RD3: size_actuators through the real chat and tool servers on the one-joint case — the cycle\'s times as the conformance case has them, a motor and a reducer chosen with every check passed', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/size-1r/case.json'), 'utf8')), file = join(out, 'size-1r.bcad'), { document, dwell_s, life_h, ...coreArgs } = c.input;
    // This conformance case stores internal radian inputs; the public tool takes degrees and seconds.
    const args = { ...coreArgs, to: Object.fromEntries(Object.entries(coreArgs.to).map(([k, v]) => [k, v * 180 / Math.PI])), limits: Object.fromEntries(Object.entries(coreArgs.limits).map(([k, v]) => [k, v * 180 / Math.PI])), dwell: dwell_s, serviceLife: life_h * 3600 };
    fs.writeFileSync(file, JSON.stringify(document));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(n => window.__studioDoc?.instances?.length === n, document.instances.length, { timeout: 20000 }); await idle();
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [{ tool: 'assembly', args: { action: 'size', ...args } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const line = await page.locator('.chat-tool').last().innerText();
      // (The chat lists a read tool's result as the start of its JSON: the profile and the move's and the cycle's times first.)
      const T = c.input.limits, d = Object.values(c.input.to)[0], move = d / T.velocity + T.velocity / T.acceleration;
      assert.ok(line.includes(`"profile":"trapezoid","moveDuration":${Number(move.toPrecision(10))},"cycleDuration":${Number((2 * move + 2 * c.input.dwell_s).toPrecision(10))}`), line);
      await snap('rd3-sizing');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- A6.1 (O24): the brief ------------------------------------------------------------------------------------------
  await check('A6.1: the scripted agent writes a brief through the real chat and tool servers (conformance a6/briefs/assumed-process); the Browser shows it, one gap; the user confirms the process, which becomes the part\'s', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/a6/briefs/assumed-process.json'), 'utf8'));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && !window.__studioDoc.brief && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = c.input.patches.map(fields => ({ tool: 'requirements', args: { action: 'brief', fields } }));
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
    await page.waitForFunction(() => window.__studioDoc?.brief?.process?.basis === 'assumed', null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__studioDoc.process ?? null), null, 'an assumed process is not applied');
    assert.match(await page.locator('[aria-label="Brief gaps"]').innerText(), /^1 to settle$/i);
    await page.locator('[aria-label="Brief gaps"]').locator('xpath=../..').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-brief.png`) });
    assert.match(await page.locator('[aria-label="Brief process"]').innerText(), /fdm[\s\S]*assumed/);
    await snap('a6-1-brief');
    await page.click('[aria-label="Confirm brief process"]');
    await page.waitForFunction(() => window.__studioDoc?.brief?.process?.confirmed?.by === 'user' && window.__studioDoc.process === 'fdm', null, { timeout: 10000 });
    assert.match(await page.locator('[aria-label="Brief gaps"]').innerText(), /^complete$/i);
    assert.match(await page.locator('[aria-label="Brief process"]').innerText(), /confirmed by user/);
  });

  // ---- A6.2 (O25): the clarifying policy -------------------------------------------------------------------------------
  // (The scripted agent asks two blocking questions; the user answers in the Specify panel — to the chat as their message,
  // into the brief as theirs; a later question on a stated field is refused; a requirement quoting the user is verified.)
  await check('A6.2: two blocking questions answered in the Specify panel as the user\'s; a question on a stated field refused; quotes verified', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && !window.__studioDoc.brief && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    const turn = async (text) => {
      const n = await page.locator('.chat-msg.assistant').count();
      await page.fill('[aria-label="Chat message"]', text); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
    };
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      // (Turn 1: the user's words, then the scripted calls; the purpose quotes the words, the finish is assumed.)
      const calls = [
        { tool: 'requirements', args: { action: 'brief', fields: { purpose: { value: 'a wall bracket for a 30 mm pipe', basis: 'stated', source: 'A wall bracket for a 30 mm pipe' }, finish: { value: 'matte', basis: 'assumed', why: 'a bracket out of sight' } } } },
        { tool: 'requirements', args: { action: 'ask', questions: [{ id: 'q1', text: 'How will it be made?', kind: 'choice', options: ['fdm', 'injection', 'cnc-milling'], blocks: { field: 'process' } }, { id: 'q2', text: 'What material?', kind: 'text', blocks: { field: 'material' } }] } },
      ];
      await turn(`A wall bracket for a 30 mm pipe. script ${JSON.stringify({ calls })}`);
      await page.click('[aria-label="Close chat"]');
      await page.waitForFunction(() => window.__studioDoc?.questions?.batches?.[0]?.status === 'open', null, { timeout: 15000 });
      assert.equal(await page.evaluate(() => window.__studioDoc.brief.purpose.said), 'verified');
      assert.match(await page.locator('[aria-label="Specify counts"]').innerText(), /^2 to answer · 1 to check$/i);
      await page.locator('[aria-label="Specify"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-specify.png`) });
      await page.selectOption('[aria-label="Answer q1"]', 'fdm'); await page.fill('[aria-label="Answer q2"]', 'petg');
      await snap('a6-2-specify');
      await page.click('[aria-label="Send answers"]');
      // (Written as the user's: stated, confirmed, verified; the process the part's; the chat sent their message.)
      await page.waitForFunction(() => { const b = window.__studioDoc?.brief; return b?.material?.value === 'petg' && b.material.confirmed?.by === 'user' && b.material.said === 'verified' && b.process?.confirmed && window.__studioDoc.process === 'fdm' && window.__studioDoc.questions.batches[0].status === 'answered'; }, null, { timeout: 15000 });
      await page.waitForFunction(() => [...document.querySelectorAll('.chat-msg.user')].some(m => /My answers to your questions \(batch 1\)/.test(m.textContent)) && !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 60000 });
      // (Turn 2: asking about the stated material again is refused; a requirement quoting the user is kept, verified.)
      const calls2 = [
        { tool: 'requirements', args: { action: 'ask', questions: [{ id: 'q3', text: 'Which material?', kind: 'text', blocks: { field: 'material' } }] } },
        { tool: 'requirements', args: { action: 'set', requirements: [{ id: 'R1', source: '30 mm pipe', hard: true, check: { op: '>=', query: { fn: 'bbox', axis: 'x' }, value: 40 } }] } },
      ];
      await turn(`Size it for the 30 mm pipe. script ${JSON.stringify({ calls: calls2 })}`);
      const lines = await page.locator('.chat-tool').allInnerTexts();
      assert.ok(lines.some(l => /requirements\.ask/.test(l) && /NOT_BLOCKING/.test(l)), lines.slice(-3).join(' | '));
      await page.waitForFunction(() => window.__studioDoc?.requirements?.[0]?.said === 'verified', null, { timeout: 15000 });
      assert.equal(await page.evaluate(() => window.__studioDoc.questions.batches.length), 1);
      await page.click('[aria-label="Close chat"]');
      // (Accept all: the assumed finish confirmed by the user.)
      await page.click('[aria-label="Accept all assumptions"]');
      await page.waitForFunction(() => window.__studioDoc?.brief?.finish?.confirmed?.by === 'user', null, { timeout: 15000 });
      await page.waitForFunction(() => [...document.querySelectorAll('.chat-msg.user')].some(m => /I accept your 1 assumption as they are: finish/.test(m.textContent)) && !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 60000 });
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- A6.3 (O26): a locked reference body, datums and keep-outs -----------------------------------------------------
  await check('A6.3: a STEP block added as a locked reference (ghosted, not a body of the part); a datum from its underside; an envelope keep-out clear, then violated as the part grows into it', async () => {
    const fs = await import('node:fs');
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/a6/references/block-keepout/case.json'), 'utf8'));
    // (The case's part: a 10 mm cube at the origin.)
    const cubeFile = join(out, 'cube-10.bcad');
    fs.writeFileSync(cubeFile, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }] }));
    await page.setInputFiles('input[aria-label="Model file"]', cubeFile);
    await page.waitForFunction(() => window.__studioDoc?.nodes?.length === 2 && !window.__studioDoc.references && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    await page.setInputFiles('input[aria-label="Add reference"]', join(root, '../../packages/barocss-cad/conformance/a6/references/block-keepout/block.step'));
    await page.waitForFunction(() => window.__studioDoc?.references?.references?.length === 1, null, { timeout: 30000 });
    await page.waitForSelector('[aria-label="Reference ref1"]', { timeout: 15000 });
    // (Placed at z 30, as the case: the Z position typed and entered.)
    await page.fill('[aria-label="ref1 position z"]', '30'); await page.locator('[aria-label="ref1 position z"]').press('Enter');
    await page.waitForFunction(() => window.__studioDoc.references.references[0].at.position[2] === 30, null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__studioDoc.nodes.length), 2, 'not a node of the part');
    assert.match(await page.locator('.outliner').innerText(), /1 body/, 'not a body of the part');
    // (A datum plane from the face facing down.)
    const faceName = await page.evaluate(() => [...document.querySelectorAll('[aria-label="ref1 datum face"] option')].map(o => o.value).filter(Boolean));
    assert.ok(faceName.length >= 7, faceName.join());
    let made = false;
    for (const f of faceName) {
      await page.selectOption('[aria-label="ref1 datum face"]', f); await page.click('[aria-label="ref1 add datum"]');
      await page.waitForTimeout(300);
      const n = await page.evaluate(() => window.__studioDoc.references.datums.at(-1)?.normal);
      if (n && Math.abs(n[2] + 1) < 1e-9) { made = true; break; }
      if (n) await page.click(`[aria-label="Remove ${await page.evaluate(() => window.__studioDoc.references.datums.at(-1).id)}"]`);
      await page.waitForTimeout(200);
    }
    assert.ok(made, 'a datum plane facing down');
    // (The envelope grown 2 mm: clear of the 10 mm cube, 18 mm away; flat faces, chord 0.)
    await page.fill('[aria-label="ref1 envelope offset"]', '2'); await page.click('[aria-label="ref1 add keep-out"]');
    await page.waitForFunction(() => /✓/.test(document.querySelector('[aria-label="Keep-out K1"]')?.textContent ?? ''), null, { timeout: 30000 });
    const k1 = await page.locator('[aria-label="Keep-out K1"]').innerText();
    assert.match(k1, new RegExp(`clear, ${c.expect.keepout_clearance_mm} mm`), k1);
    await snap('a6-3-reference');
    await page.locator('[aria-label="Reference bodies"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-references.png`) });
    // (The part grown into it — the same document with the box 35 tall, saved and opened — enters the envelope: violated.)
    const doc = await page.evaluate(() => window.__studioDoc), file = join(out, 'grown.bcad');
    doc.nodes[1].height = 35;
    fs.writeFileSync(file, JSON.stringify(doc));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => /✗/.test(document.querySelector('[aria-label="Keep-out K1"]')?.textContent ?? ''), null, { timeout: 30000 });
    assert.match(await page.locator('[aria-label="Keep-out K1"]').innerText(), /violated/);
  });

  // ---- A6.4 (O28): drawings and images give drafts --------------------------------------------------------------------
  await check('A6.4: a hand-written DXF in inches added as a sketch draft (3 dimensions to confirm); one confirmed as it is, a hole re-driven to another diameter; an export says it is a draft', async () => {
    const fs = await import('node:fs'), dir = join(root, '../../packages/barocss-cad/conformance/a6/drawings');
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.setInputFiles('input[aria-label="Add drawing"]', join(dir, 'by-hand-inches.dxf'));
    await page.waitForFunction(() => window.__studioDoc?.drafts?.drafts?.length === 1 && window.__studioDoc.nodes.length === 1, null, { timeout: 15000 });
    assert.match(await page.locator('[aria-label="Drafts summary"]').innerText(), /^3 to confirm$/i);
    await page.locator('[aria-label="Drafts"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-drafts.png`) });
    assert.ok(Math.abs(Number(await page.inputValue('[aria-label="F1.width value"]')) - 101.6) < 1e-9);
    // (The width confirmed as it is; the hole set to 15 mm: re-driven, confirmed.)
    await page.click('[aria-label="Confirm F1.width"]');
    await page.waitForFunction(() => window.__studioDoc.drafts.drafts[0].dims[0].confirmed?.by === 'user', null, { timeout: 10000 });
    await page.fill('[aria-label="F1.d1 value"]', '15'); await page.locator('[aria-label="F1.d1 value"]').press('Enter');
    await page.waitForFunction(() => { const d = window.__studioDoc.drafts.drafts[0].dims.find(x => x.name === 'd1'); return d.value === 15 && d.confirmed; }, null, { timeout: 10000 });
    const hole = await page.evaluate(() => window.__studioDoc.nodes[0].holes[0]);
    const r = Math.hypot(hole[0].start[0] - hole[0].center[0], hole[0].start[1] - hole[0].center[1]);
    assert.ok(Math.abs(r - 7.5) < 1e-6, `the hole's radius ${r}`);
    assert.match(await page.locator('[aria-label="Drafts summary"]').innerText(), /^1 to confirm$/i);
    // (Extruded and exported: the STL's note says it is a draft, height unconfirmed.)
    const doc = await page.evaluate(() => window.__studioDoc), file = join(out, 'draft-plate.bcad');
    doc.nodes.push({ id: 'n1', kind: 'extrude', sketch: 0, height: 5 }); doc.nextId = 2;
    fs.writeFileSync(file, JSON.stringify(doc));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.nodes?.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    await snap('a6-4-drafts');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[aria-label="Export STL"]')]);
    await dl.cancel().catch(() => {});
    await page.waitForFunction(() => /This part is a draft: 1 dimension/.test(document.querySelector('.toast[role="alert"]')?.textContent ?? ''), null, { timeout: 10000 });
  });

  // ---- A6.5 (O29): standards data with provenance -------------------------------------------------------------------
  await check('A6.5: standards_lookup through the real chat and tool servers — M6\'s tap drill with its source (derived: d − P)', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await loadSampleSizes();
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [{ tool: 'library', args: { action: 'standards', table: 'fasteners-metric-coarse', row: 'M6', field: 'tap' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const line = await page.locator('.chat-tool').last().innerText();
      assert.ok(line.includes('"table":"fasteners-metric-coarse","row":"M6"'), line);
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- O49: a drawing table — R12's bend table ---------------------------------------------------------------------
  await check('O49: a sheet L-bracket\'s drawing with its bend table (the checkbox): the table on the sheet, clean, and in the SVG, PDF and DXF exports', async () => {
    const fs = await import('node:fs'), file = join(out, 'bend-table.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 1, outputs: {}, nodes: [
      { id: 'n0', kind: 'sheet-contour', path: [[0, 0], [50, 0], [50, 35]], side: 'left', width: 20, thickness: 2, bendRadius: 3, kFactor: 0.4 }] }));
    await openModel(file, 1, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await page.click('.mode button:text-is("Drawing")');
    try {
      await page.waitForSelector('[aria-label="Bend table"]', { timeout: 20000 });
      await page.check('[aria-label="Bend table"]');
      await page.waitForFunction(() => window.__studioDoc.drawing?.tables?.[0]?.from === 'bends', null, { timeout: 10000 });
      // (θ(R + K·T) at 90°, R 3, K 0.4, T 2 is 5.969; BD 2(R + T) − BA is 4.031.)
      await page.waitForFunction(() => window.__studioDrawing?.()?.tables?.length === 1 && !window.__studioDrawing().tables[0].error, null, { timeout: 20000 });
      await snap('o49-bend-table');
      const [svgFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SVG"]')]);
      const svg = fs.readFileSync(await svgFile.path(), 'utf8');
      for (const t of ['BEND TABLE', 'BA [mm]', 'BD [mm]', '5.969', '4.031']) assert.ok(svg.includes(`>${t}</text>`), `SVG: ${t}`);
      assert.match(svg, /<g class="table"/);
      const [pdfFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export PDF"]')]);
      const pdf = fs.readFileSync(await pdfFile.path()).toString('latin1');
      for (const t of ['BEND TABLE', '5.969', '4.031']) assert.ok(pdf.includes(`(${t}) Tj`), `PDF: ${t}`);
      const [dxfFile] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export DXF"]')]);
      const dxf = fs.readFileSync(await dxfFile.path()).toString('latin1');
      for (const t of ['BEND TABLE', 'BA [mm]', '5.969', '4.031']) assert.ok(dxf.includes(`\n${t}\r\n`) || dxf.includes(`\n${t}\n`), `DXF: ${t}`);
      // (The issue list says nothing of the table.)
      const issues = await page.evaluate(() => window.__studioDrawing?.()?.issues ?? []);
      assert.ok(!issues.some(i => (i.tables ?? []).length), JSON.stringify(issues));
    } finally { await page.click('.mode button:text-is("Model")'); }
  });

  // ---- AM6 (O51): a part too big for the bed split, with dowels -------------------------------------------------------
  await check('AM6: a 300 mm bar on the 256 mm FDM printer split to fit the bed from the palette: two pieces and two dowels, undone as one change', async () => {
    const fs = await import('node:fs'), file = join(out, 'long-bar.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, printer: 'fdm-256', process: 'fdm', nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [300, 40] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 20 }] }));
    await openModel(file, 2, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await press(' '); await page.locator('.palette input').fill('fit the bed'); await press('Enter'); await hudReady();
    assert.equal(await field('Connector').inputValue(), 'dowel');
    await page.waitForTimeout(300); await press('Enter');
    // (Two pieces and two dowels: four bodies.)
    await page.waitForFunction(() => /4 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    const d = await doc();
    assert.deepEqual(d.nodes.slice(2).map(n => n.kind), ['split', 'hole', 'hole', 'hole', 'hole', 'sketch', 'extrude', 'sketch', 'extrude']);
    assert.equal(d.nodes[2].at, 150);
    await iso(); await snap('am6-split-bed');
    // (Undone as one change: back to the bar.)
    await press('Meta+z');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2, null, { timeout: 15000 });
  });

  // ---- AM7a (O53): hollowing for printing -------------------------------------------------------------------------
  await check('AM7a: a 40 × 30 × 20 block hollowed for printing from the palette by the kernel\'s exact shell: one body, its cavity drained, the mass the closed form', async () => {
    const fs = await import('node:fs'), file = join(out, 'block.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 20 }] }));
    await openModel(file, 2, 30000);
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 }); await idle();
    await press(' '); await page.locator('.palette input').fill('hollow for printing'); await press('Enter'); await hudReady();
    assert.equal(await field('Wall').inputValue(), '2');
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole', null, { timeout: 60000 }); await idle();
    const kinds = (await doc()).nodes.map(n => n.kind);
    // (The exact route: the kernel's closed shell, then the drain.)
    assert.deepEqual(kinds.slice(-2), ['shell', 'hole']);
    // (abc − (a−4)(b−4)(c−4) − π·2²·2 = 24000 − 36·26·16 − 8π = 9000.87: exact; the panel rounds to 1 mm³.)
    const vol = await bodyVolume();
    if (!Number.isFinite(vol)) console.log(`  O18 AM7a (${renderer}): ${JSON.stringify(await page.evaluate(() => ({ b: window.__studioBodies(), props: document.querySelector('.props:not([aria-label$=" panel"])')?.textContent?.slice(0, 300) })))}`);
    assert.ok(Math.abs(vol - (24000 - 36 * 26 * 16 - 8 * Math.PI)) <= 1, String(vol));
    await snap('am7a-hollow');
  });

  // ---- AM7b (O57): a gyroid lattice infill ------------------------------------------------------------------------
  await check('AM7b: that hollowed block filled with a gyroid lattice from the palette: a separate mesh body beside the exact shell, the shell no fuller than before', async () => {
    await press('Escape');
    await press(' '); await page.locator('.palette input').fill('fill with a lattice'); await press('Enter'); await hudReady();
    assert.equal(await field('Cell').inputValue(), '8');
    await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'mesh' && window.__studioDoc.nodes.at(-1)?.name === 'lattice', null, { timeout: 120000 });
    await page.waitForFunction(() => window.__studioFresh === true && /\d+ bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 120000 }); await idle();
    // (The shell's B-rep first, its volume no more than the hollowed block's 9000.87 mm³: any new drain cuts it.)
    const kinds = (await doc()).nodes.map(n => n.kind), shellAt = kinds.lastIndexOf('shell');
    assert.ok(shellAt >= 0 && kinds.slice(shellAt + 1, -1).every(k => k === 'hole'), kinds.join(' '));
    const vol = await bodyVolume();
    assert.ok(vol <= 24000 - 36 * 26 * 16 - 8 * Math.PI + 1, String(vol));
    await snap('am7b-lattice');
  });

  // ---- RM9a (O62): continuous collision along a timed path -----------------------------------------------------------
  await check('RM9a: the arm out to a waypoint, then back into the post — Check path gives the time of impact on segment 2, the trapezoid\'s closed form', async () => {
    const fs = await import('node:fs');
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/ccd-post/case.json'), 'utf8')), file = join(out, 'ccd-post.bcad');
    fs.writeFileSync(file, JSON.stringify(c.input.document));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 3 && window.__studioInstanceBounds?.().length === 3, null, { timeout: 20000 }); await idle();
    await page.waitForSelector('[aria-label="Joint base~a value"]', { timeout: 20000 });
    const set = v => page.evaluate(x => { const el = document.querySelector('[aria-label="Joint base~a value"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    await set(-Math.PI / 2); await page.click('[aria-label="Add waypoint"]');
    await set(2);
    await page.click('[aria-label="Check path"]');
    await page.waitForFunction(() => /^Contact /.test(document.querySelector('[aria-label="Path check"]')?.textContent ?? ''), null, { timeout: 30000 });
    // (Out a quarter turn and back to 2 rad at 1 rad/s, 2 rad/s² (no limit set): the oracle's 4.773 s, test/robot-ccd.)
    assert.match(await page.locator('[aria-label="Path check"]').innerText(), /^Contact .*post.* at \d+\.\d % of the move, t 4\.773 s \(segment 2 of 2\)/);
    await snap('rm9a-toi');
    await page.click('[aria-label="Clear waypoints"]'); await page.click('[aria-label="Joints home"]');
  });

  // ---- RM9b (O62): a workspace map ---------------------------------------------------------------------------------
  await check('RM9b: the same 2R arm\'s workspace mapped from the Joints card — its voxels drawn, coloured by manipulability; hidden again', async () => {
    await page.waitForSelector('[aria-label="Map workspace"]', { timeout: 20000 });
    await page.click('[aria-label="Map workspace"]');
    await page.waitForSelector('[aria-label="Workspace summary"]', { timeout: 30000 });
    const text = await page.locator('[aria-label="Workspace summary"]').innerText();
    assert.match(text, /^Workspace of 20000 poses: \d+ voxels of 10 mm, reach \d+\.\d mm, best manipulability \d/);
    // (Engine points on WebGPU, G8: one a voxel; SVG paths a band on WebGL2.)
    const voxels = Number(text.match(/(\d+) voxels/)[1]);
    if (await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer === 'webgpu')) assert.equal(await drawnLines('cloud', ''), voxels, 'the voxels drawn, one point each');
    else assert.ok(await page.locator('[aria-label="Workspace map"] path').count() >= 2, 'the voxels drawn in bands');
    await snap('rm9b-workspace');
    await page.click('[aria-label="Hide workspace"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Workspace map"]'));
  });

  // ---- RM9c (O66): SDF and USD export ---------------------------------------------------------------------------------
  await check('RM9c: the same arm exported as SDF (a zip of robot.sdf and its meshes) and as USD (one .usda): read back by our readers, the same links and joints', async () => {
    const fs = await import('node:fs');
    const [ds] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export SDF"]')]);
    assert.match(ds.suggestedFilename(), /-sdf\.zip$/);
    const zip = fs.readFileSync(await ds.path()), names = zip.toString('latin1');
    assert.equal(zip.readUInt32LE(0), 0x04034b50, 'a zip');
    for (const n of ['robot.sdf', 'meshes/base.stl', 'meshes/a_collision.stl', 'meshes/post.stl']) assert.ok(names.includes(n), n);
    const { spawnSync } = await import('node:child_process');
    const py = spawnSync('python3', ['-I', '-c', 'import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); print(z.read("robot.sdf").decode())', await ds.path()], { encoding: 'utf8' });
    assert.equal(py.status, 0, py.stderr);
    assert.match(py.stdout, /<sdf version="1\.11">/); assert.match(py.stdout, /<joint name="base_to_a" type="continuous">/);
    const [du] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Export USD"]')]);
    assert.match(du.suggestedFilename(), /\.usda$/);
    const usda = fs.readFileSync(await du.path(), 'utf8');
    assert.ok(usda.startsWith('#usda 1.0'));
    assert.match(usda, /prepend apiSchemas = \["PhysicsArticulationRootAPI"\]/); assert.match(usda, /def PhysicsRevoluteJoint "base_to_a"/); assert.match(usda, /def Xform "post"/);
  });

  // ---- O68: a DXF's underlay ------------------------------------------------------------------------------------------
  await check('O68: a DXF plate with a block, a spline and a note added from Drafts — its region and hole as before, the rest an underlay drawn grey; hidden and shown', async () => {
    const dir = join(root, '../../packages/barocss-cad/conformance/a6/underlay');
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc && window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.setInputFiles('input[aria-label="Add drawing"]', join(dir, 'plate', 'drawing.dxf'));
    await page.waitForFunction(() => window.__studioDoc?.nodes.length === 1 && window.__studioDoc.underlays?.length === 1, null, { timeout: 15000 });
    const d = await page.evaluate(() => ({ holes: window.__studioDoc.nodes[0].holes?.length ?? 0, counts: window.__studioDoc.underlays[0].counts }));
    assert.deepEqual(d, { holes: 1, counts: { CIRCLE: 1, LINE: 1, SPLINE: 1, TEXT: 1 } });
    // (Its polylines the engine's lines on WebGPU (G7), its texts SVG.)
    const underlayDrawn = () => page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer === 'webgpu' ? (window.__studioOverlayLines?.()['underlay:U1'] ?? 0) > 0 && !!document.querySelector('[aria-label="Underlay drawing U1"]') : !!document.querySelector('[aria-label="Underlay drawing U1"] path'));
    await page.waitForFunction(() => document.querySelector('.viewport')?.dataset.renderer === 'webgpu' ? (window.__studioOverlayLines?.()['underlay:U1'] ?? 0) > 0 : !!document.querySelector('[aria-label="Underlay drawing U1"] path'), null, { timeout: 10000 });
    // (Its texts the engine's labels on WebGPU, G15; SVG on WebGL2.)
    assert.match(await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer === 'webgpu' ? (window.__studioOverlayTexts?.()['underlay:text:U1'] ?? []).join('\n') : document.querySelector('[aria-label="Underlay drawing U1"]')?.innerHTML ?? ''), /PLATE 3MM/);
    await snap('o68-underlay');
    await page.click('[aria-label="Hide underlay U1"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Underlay drawing U1"]') && !window.__studioOverlayLines?.()['underlay:U1']);
    assert.equal(await underlayDrawn(), false);
    await page.click('[aria-label="Show underlay U1"]'); await page.waitForFunction(() => document.querySelector('.viewport')?.dataset.renderer === 'webgpu' ? (window.__studioOverlayLines?.()['underlay:U1'] ?? 0) > 0 : !!document.querySelector('[aria-label="Underlay drawing U1"] path'), null, { timeout: 10000 });
    assert.equal(await underlayDrawn(), true);
  });

  // ---- IM1 (O77): moulding's process rule -----------------------------------------------------------------------
  await check('IM1: injection moulding chosen in the Library panel — the pull and the finish beside it, the finish with its least draft; kept on the document, cleared again', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]');
    await page.selectOption('[aria-label="Process"]', 'injection');
    await page.waitForSelector('[aria-label="Mould finish"]', { timeout: 5000 });
    const finishes = await page.locator('[aria-label="Mould finish"] option').allInnerTexts();
    assert.deepEqual(finishes, ['Not set', 'Smooth (no texture) · ≥ 0.5°', 'Light bead blast (PM-T1) · ≥ 3°', 'Medium bead blast (PM-T2) · ≥ 5°']);
    await page.selectOption('[aria-label="Pull direction"]', '+Z');
    await page.selectOption('[aria-label="Mould finish"]', 'pm-t1');
    await page.waitForFunction(() => JSON.stringify(window.__studioDoc.mould) === JSON.stringify({ version: 1, pull: [0, 0, 1], finish: 'pm-t1' }), null, { timeout: 5000 });
    await snap('im1-mould');
    await page.selectOption('[aria-label="Pull direction"]', ''); await page.selectOption('[aria-label="Mould finish"]', '');
    await page.waitForFunction(() => window.__studioDoc.mould === undefined, null, { timeout: 5000 });
    // (Another process: no moulding settings shown.)
    await page.selectOption('[aria-label="Process"]', 'fdm');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Mould finish"]'), null, { timeout: 5000 });
    await page.click('[aria-label="Close library"]');
  });

  // ---- IM2 (O78): the draft field through the real chat and tool servers ------------------------------------------
  await check('IM2: a cone drafted 3°, moulded along +Z, through the real chat and tool servers — draft gives its side 3° from the exact surface; the report judges it as moulding', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 30, draft: 3, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2, process: 'injection', mould: { version: 1, pull: [0, 0, 1], finish: 'pm-t1' } };
    const file = join(out, 'im2-cone.bcad'); fs.writeFileSync(file, JSON.stringify(doc));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.mould?.finish === 'pm-t1' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [{ tool: 'query', args: { action: 'draft', pull: [0, 0, 1], min_deg: 1 } }, { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const lines = await page.locator('.chat-tool').allInnerTexts(), draft = lines[lines.length - 2], report = lines[lines.length - 1];
      assert.ok(draft.includes('"face":"n1.side0","draft_deg":3,"min_deg":3,"max_deg":3,"class":"drafted"'), draft);
      assert.match(report, /query\.manufacturability\s*injection: pull pass, finish pass, wall pass, wall-material \w+, wall-uniform \w+, rib [\w/]+, boss [\w/]+, inside-radius \w+, sink \w+, size pass, draft pass, undercut pass/, report);
      await snap('im2-cone');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- IM3 (O79): undercuts, through the real chat and tool servers --------------------------------------------
  await check('IM3: a block with a side hole, moulded along +Z, through the real chat and tool servers — the report warns its undercut, freed by a side action', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'command', command: 'hole', values: { d: 6, x: 20, y: 10 }, faces: [{ normal: [0, -1, 0], pick: 'max' }] } },
        { tool: 'query', args: { action: 'manufacturability', direction: [0, 0, 1], finish: 'smooth' } }];
      // (The process is the document's: injection, set in the Library panel first.)
      await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'injection'); await page.click('[aria-label="Close library"]');
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const lines = await page.locator('.chat-tool').allInnerTexts(), report = lines[lines.length - 1];
      assert.match(report, /injection: .*undercut warn/, report);
      await snap('im3-side-hole');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- IM4 (O80): walls and ribs, through the real chat and tool servers ------------------------------------------
  await check('IM4: a shelled box with a 2 mm rib inside it (as thick as its walls), moulded, through the real chat and tool servers — the report warns the rib and the sharp inside corners', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'injection'); await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 60, d: 40, h: 25, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'command', command: 'shell', values: { t: 2 }, faces: ['n1.top'] } },
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 2, d: 36, h: 15, x: 30, y: 2, z: 2 } } },
        { tool: 'features', args: { action: 'command', command: 'union', values: {}, bodies: ['b2', 'b4'] } },
        { tool: 'query', args: { action: 'manufacturability', direction: [0, 0, 1], finish: 'smooth' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const lines = await page.locator('.chat-tool').allInnerTexts(), report = lines[lines.length - 1];
      assert.match(report, /injection: .*wall-uniform pass, rib warn, boss n\/a, inside-radius warn, sink pass/, report);
      await snap('im4-rib');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- IM5 (O81): the parting line, through the real chat and tool servers ----------------------------------------
  await check('IM5: a cylinder lying across the pull, moulded, through the real chat and tool servers — the parting line crosses it (warned, to split); put whole in the + half it passes', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'injection'); await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'add', features: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { kind: 'extrude', sketch: 0, height: 40 }] } },
        { tool: 'query', args: { action: 'manufacturability', direction: [0, 0, 1], finish: 'smooth' } },
        { tool: 'query', args: { action: 'manufacturability', direction: [0, 0, 1], finish: 'smooth', sides: { 'n1.side0': '+' } } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const lines = await page.locator('.chat-tool').allInnerTexts(), split = lines[lines.length - 2], whole = lines[lines.length - 1];
      assert.match(split, /injection: .*parting warn, tooling \w+$/, split); assert.match(whole, /injection: .*parting pass, tooling \w+$/, whole);
      await snap('im5-parting');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- IM6 (O82): the quote package from the Library panel ---------------------------------------------------------
  await check('IM6: an ABS block drafted 3°, 1000 stated, moulded along +Z with PM-T1 — Quote package in the Library panel writes the zip, complete', async () => {
    const fs = await import('node:fs'), file = join(out, 'im6-block.bcad');
    const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40], id: 'n0' }, { kind: 'extrude', sketch: 0, height: 25, draft: 3, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
      process: 'injection', mould: { version: 1, pull: [0, 0, 1], finish: 'pm-t1' }, bodies: { b1: { material: 'abs' } }, brief: { version: 1, quantity: { value: 1000, basis: 'stated', source: '1000 of them' } } };
    fs.writeFileSync(file, JSON.stringify(doc));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc?.mould?.finish === 'pm-t1' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle();
    await page.click('[aria-label="Library"]');
    await page.waitForSelector('[aria-label="Quote package"]', { timeout: 5000 });
    const download = page.waitForEvent('download');
    await page.click('[aria-label="Quote package"]');
    assert.match((await download).suggestedFilename(), /-quote\.zip$/);
    await page.waitForFunction(() => /Quote package written/.test(document.body.textContent ?? ''), null, { timeout: 15000 });
    assert.ok(!/open/.test(await page.locator('text=Quote package written').first().innerText()), 'complete: nothing open');
    await snap('im6-quote');
    await page.click('[aria-label="Close library"]');
  });

  // ---- CNC1 (O84): machining's process rule, through the real chat and tool servers ------------------------------
  await check('CNC1: CNC milling chosen in the Library panel, an aluminium block made and set through the real chat and tool servers — the report judges it as milling (material, wall, size pass; no holes; the later stages said to come)', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'cnc-milling');
    await page.waitForFunction(() => window.__studioDoc.process === 'cnc-milling', null, { timeout: 5000 });
    assert.equal(await page.locator('[aria-label="Mould finish"]').count(), 0, 'no moulding settings for milling');
    await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 100, d: 60, h: 20, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'material', material: 'al6061' } },
        { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const lines = await page.locator('.chat-tool').allInnerTexts(), report = lines[lines.length - 1];
      assert.match(report, /cnc-milling: material pass, wall pass, size pass, hole-depth pass, hole-size pass, thread pass, corners pass, pocket pass, feature pass, tall pass, text pass, access pass, setups pass, drawing pass/, report);
      await snap('cnc1-milling');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- CNC2 (O85): holes and threads, through the real chat and tool servers --------------------------------------
  await check('CNC2: a milled aluminium plate with a counterbored Ø6.6 and an M6 tapped through 20 — hole depth and size pass, the thread warned (20 over 3 × d), its holes in the report', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'cnc-milling'); await page.click('[aria-label="Load sample fastener sizes"]'); await page.click('[aria-label="Close library"]');
    await page.waitForFunction(() => window.__studioDoc.fastenerSizes?.rows?.length === 7, null, { timeout: 10000 });
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 60, d: 40, h: 20, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'command', command: 'hole', values: { type: 'counterbore', d: 6.6, cd: 11, ch: 6, x: 15, y: 20 }, faces: ['n1.top'] } },
        { tool: 'features', args: { action: 'command', command: 'hole', values: { type: 'tapped', thread: 'M6', tend: 'through', x: 45, y: 20 }, faces: ['n1.top'] } },
        { tool: 'features', args: { action: 'material', material: 'al6061' } },
        { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const lines = await page.locator('.chat-tool').allInnerTexts(), report = lines[lines.length - 1];
      assert.match(report, /cnc-milling: material pass, wall pass, size pass, hole-depth pass, hole-size pass, thread warn, corners pass, pocket pass, feature pass/, report);
      const holes = await page.evaluate(() => window.__studioDoc.nodes.filter(x => x.kind === 'hole').map(x => [x.radius, x.thread ?? null]));
      assert.deepEqual(holes, [[3.3, null], [5.5, null], [2.5, 'M6×1']], JSON.stringify(holes));
      await snap('cnc2-holes');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- CNC3 (O86): inside corners and cavities, through the real chat and tool servers -----------------------------
  await check('CNC3: a milled aluminium plate with a 50 × 30 pocket 8 deep — its sharp corners warned (a tool leaves its radius); filleted r 5, they pass (5 ≥ ⅓ × 8)', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'cnc-milling'); await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 120, d: 80, h: 12, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 50, d: 30, h: 20, x: 35, y: 25, z: 4 } } },
        { tool: 'features', args: { action: 'command', command: 'difference', values: {}, bodies: ['b1', 'b3'] } },
        { tool: 'features', args: { action: 'material', material: 'al6061' } },
        { tool: 'query', args: { action: 'manufacturability' } },
        { tool: 'features', args: { action: 'command', command: 'fillet', values: { radius: 5 }, edges: [0, 1, 2, 3].map(k => ({ between: [`n3.side${k}`, `n3.side${(k + 1) % 4}`] })) } },
        { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const reports = (await page.locator('.chat-tool').allInnerTexts()).filter(x => /cnc-milling:/.test(x)).slice(-2);
      assert.equal(reports.length, 2, reports.join(' | '));
      assert.match(reports[0], /corners warn, pocket pass, feature pass/, reports[0]);
      assert.match(reports[1], /corners pass, pocket pass, feature pass/, reports[1]);
      await snap('cnc3-pocket');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- CNC4 (O87): access and setups, through the real chat and tool servers ---------------------------------------
  await check('CNC4: a milled aluminium block with a side slot open to +X — reached, two setups; the slot stopped short of the face, a sealed void — its 760 mm² reached from none of the six, warned', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'cnc-milling'); await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const run = async calls => {
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
        return (await page.locator('.chat-tool').allInnerTexts()).filter(x => /cnc-milling:/.test(x)).pop();
      };
      const slot = (x, w) => [{ tool: 'features', args: { action: 'command', command: 'box', values: { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 } } }, { tool: 'features', args: { action: 'command', command: 'box', values: { w, d: 20, h: 6, x, y: 5, z: 7 } } },
        { tool: 'features', args: { action: 'command', command: 'difference', values: {}, bodies: ['b1', 'b3'] } }, { tool: 'features', args: { action: 'material', material: 'al6061' } }, { tool: 'query', args: { action: 'manufacturability' } }];
      let report = await run(slot(30, 15));
      assert.match(report, /access pass, setups pass/, report);
      await page.click('[aria-label="Close chat"]'); await page.click('[aria-label="New part"]'); await idle();
      await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'cnc-milling'); await page.click('[aria-label="Close library"]');
      await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      report = await run(slot(29, 10));
      assert.match(report, /access warn, setups pass/, report);
      await snap('cnc4-access');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- CNC5 (O88): the drawing a machined part goes with, through the real chat and tool servers -----------------
  await check('CNC5: a milled plate with an M6 tapped hole and no drawing — the drawing failed (threads go on one); Auto-dimension in the Drawing workspace — warned now (no general note, title or material), the thread called out', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'cnc-milling'); await page.click('[aria-label="Load sample fastener sizes"]'); await page.click('[aria-label="Close library"]');
    await page.waitForFunction(() => window.__studioDoc.fastenerSizes?.rows?.length === 7, null, { timeout: 10000 });
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      const run = async calls => {
        await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
        const n = await page.locator('.chat-msg.assistant').count();
        await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
        await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
        const out = (await page.locator('.chat-tool').allInnerTexts()).filter(x => /cnc-milling:/.test(x)).pop(); await page.click('[aria-label="Close chat"]'); return out;
      };
      let report = await run([{ tool: 'features', args: { action: 'command', command: 'box', values: { w: 60, d: 40, h: 20, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'command', command: 'hole', values: { type: 'tapped', thread: 'M6', tend: 'blind', depth: 12, x: 45, y: 20 }, faces: ['n1.top'] } },
        { tool: 'features', args: { action: 'material', material: 'al6061' } }, { tool: 'query', args: { action: 'manufacturability' } }]);
      assert.match(report, /drawing fail/, report);
      try {
        await page.click('.mode button:text-is("Drawing")');
        await page.waitForFunction(() => window.__studioDrawing?.()?.hidden, null, { timeout: 20000 });
        await page.click('[aria-label="Auto-dimension"]');
        await page.waitForFunction(() => window.__studioDrawing().dimensions.some(d => /M6×1/.test(d.text)), null, { timeout: 5000 });
        await snap('cnc5-drawing');
      } finally { await page.click('.mode button:text-is("Model")'); }
      report = await run([{ tool: 'query', args: { action: 'manufacturability' } }]);
      assert.match(report, /drawing warn/, report);
    } finally { chat.kill(); }
  });

  // ---- CNC6 (O89): turning, through the real chat and tool servers -------------------------------------------------
  await check('CNC6: CNC turning chosen; an aluminium bar Ø20 × 30 — every surface turned, passes; a flat milled on it — its 360 mm² not turned, warned (live tools)', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'cnc-turning');
    await page.waitForFunction(() => window.__studioDoc.process === 'cnc-turning', null, { timeout: 5000 }); await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'cylinder', values: { r: 10, h: 30, x: 0, y: 0, z: 0 } } }, { tool: 'features', args: { action: 'material', material: 'al6061' } }, { tool: 'query', args: { action: 'manufacturability' } },
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 10, d: 30, h: 40, x: 8, y: -15, z: -5 } } }, { tool: 'features', args: { action: 'command', command: 'difference', values: {}, bodies: ['b1', 'b3'] } }, { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const reports = (await page.locator('.chat-tool').allInnerTexts()).filter(x => /cnc-turning:/.test(x)).slice(-2);
      assert.equal(reports.length, 2, reports.join(' | '));
      assert.match(reports[0], /cnc-turning: material pass, wall pass, size pass, turning pass, diameter pass, groove pass, holes pass, point pass, corners pass, drawing pass/, reports[0]);
      assert.match(reports[1], /turning warn/, reports[1]);
      await snap('cnc6-turning');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- CNC7a (O101): machining features, through the real chat and tool servers --------------------------------------
  await check('CNC7a: a milled aluminium plate with a pocket and a through hole — the report recognises 1 pocket and 1 hole, each with its setup', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'cnc-milling'); await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 120, d: 80, h: 20, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 30, d: 20, h: 20, x: 10, y: 10, z: 12 } } },
        { tool: 'features', args: { action: 'command', command: 'difference', values: {}, bodies: ['b1', 'b3'] } },
        { tool: 'features', args: { action: 'command', command: 'hole', values: { d: 6.6, x: 90, y: 20 }, faces: ['n1.top'] } },
        { tool: 'features', args: { action: 'material', material: 'al6061' } }, { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const report = (await page.locator('.chat-tool').allInnerTexts()).filter(x => /cnc-milling:/.test(x)).pop();
      assert.match(report, /features pass/, report);
      await snap('cnc7a-features');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- CNC7b (O102): stock from the shop's list, through the real chat and tool servers --------------------------
  await check('CNC7b: a milled aluminium plate, the shop\'s stock list set by the agent — the report picks the 122 × 82 × 22 block (1 mm a face, an estimate)', async () => {
    const fs = await import('node:fs'), { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'cnc-milling'); await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 120, d: 80, h: 20, x: 0, y: 0, z: 0 } } }, { tool: 'features', args: { action: 'material', material: 'al6061' } },
        { tool: 'features', args: { action: 'stock', file: '$file:stock.json' } },
        { tool: 'query', args: { action: 'manufacturability' } }];
      // (Rows rule b: the shop's stock list is the person's file, attached in the chat.)
      const list = join(out, 'stock.json');
      fs.writeFileSync(list, JSON.stringify([{ id: 'P20', kind: 'block', size: [150, 100, 20], source: 'the shop' }, { id: 'B22', kind: 'block', size: [122, 82, 22], source: 'the shop' }]));
      await page.setInputFiles('input[aria-label="Chat image file"]', list);
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const report = (await page.locator('.chat-tool').allInnerTexts()).filter(x => /cnc-milling:/.test(x)).pop();
      assert.match(report, /stock pass/, report);
      const m = await page.evaluate(() => window.__studioDoc.machining);
      assert.deepEqual(m.stock.map(r => r.id), ['P20', 'B22']);
      await snap('cnc7b-stock');
      await page.click('[aria-label="Close chat"]');
    } finally {
      chat.kill();
      // (A failure here must not leave the chat open for the next step: its Chat click would close it, O174.)
      if (await page.locator('[aria-label="Close chat"]').count()) await page.click('[aria-label="Close chat"]');
    }
  });

  // ---- the shapes strip's overflow: a More menu, never a sideways page --------------------------------------------
  await check('three columns (G12a): the chat column full height at the left — opened 360 px, dragged to 480, collapsed to its 44 px strip, collapsed by itself at 1024; nothing in the centre over it; no box with a left border alone and a radius', async () => {
    await openModel(join(root, 'test/fixtures/cnc8-pocket.bcad'), 5, 60000); await idle();
    const rect = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width }; }, sel);
    // (Everything placed in the stage stays right of the column and inside the window.)
    const centreClear = () => page.evaluate(() => {
      const col = document.querySelector('.chat-col').getBoundingClientRect(), bad = [];
      for (const s of ['.topbar', '.toolbar', '.outliner', '.right-col', '.history', '.corner-right', '.corner-left']) {
        const e = document.querySelector(s); if (!e) continue; const b = e.getBoundingClientRect(); if (!b.width) continue;
        if (b.left < col.right - 0.5 || b.right > innerWidth + 0.5) bad.push([s, Math.round(b.left), Math.round(b.right), Math.round(col.right)]);
      }
      return bad;
    });
    // (The owner's rule: no box with a left border alone and a border-radius — a separator without a radius is fine.)
    const leftBorders = () => page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => {
      const c = getComputedStyle(e), w = k => parseFloat(c[k]) || 0;
      return w('borderLeftWidth') > 0 && !w('borderTopWidth') && !w('borderRightWidth') && !w('borderBottomWidth') && ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].some(k => w(k) > 0);
    }).map(e => e.className || e.tagName).slice(0, 5));
    try {
      await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(300);
      if (await page.locator('.chat-col .chat').count()) await page.click('[aria-label="Chat"]');
      assert.equal(Math.round((await rect('.chat-col')).width), 44, 'collapsed to the strip');
      // (The strip takes the pointer only on its buttons: a click on its empty part reaches the viewport — here, off the
      // part, it clears a selection; 92a33dcb2.)
      await page.locator('.outliner .ol').first().click(); await page.waitForTimeout(200);
      const picked = () => page.evaluate(() => { const s = window.__studioSelection.selection; return Object.values(s).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0); });
      assert.ok(await picked() > 0, 'a body selected first');
      const strip = await rect('.chat-col');
      await page.mouse.click(strip.left + strip.width / 2, strip.bottom - 120); await page.waitForTimeout(300);
      assert.equal(await picked(), 0, 'a click on the strip beside its buttons reached the viewport and cleared the selection');
      { const bad = await centreClear(); assert.deepEqual(bad, [], JSON.stringify(bad)); }
      await page.click('[aria-label="Open chat"]'); await page.waitForSelector('.chat-col.open .chat', { timeout: 5000 }); await page.waitForTimeout(300);
      const open = await rect('.chat-col');
      assert.ok(Math.abs(open.width - 360) <= 1 && open.top === 0 && Math.abs(open.bottom - 900) <= 1, JSON.stringify(open));
      { const bad = await centreClear(); assert.deepEqual(bad, [], JSON.stringify(bad)); }
      assert.ok(Math.abs((await rect('.topbar')).left - open.right) <= 1, 'the top bar starts at the column');
      await snap('three-columns-1440');
      // (Dragged at its right edge: 480 px, kept within 320–520.)
      const h = await rect('.chat-resize');
      await page.mouse.move(h.left + 3, 400); await page.mouse.down(); await page.mouse.move(h.left + 123, 400, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
      assert.ok(Math.abs((await rect('.chat-col')).width - 480) <= 2, JSON.stringify(await rect('.chat-col')));
      await page.mouse.move(h.left + 123, 400); await page.mouse.down(); await page.mouse.move(h.left + 400, 400, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
      assert.ok(Math.abs((await rect('.chat-col')).width - 520) <= 2, 'at most 520');
      { const bad = await centreClear(); assert.deepEqual(bad, [], JSON.stringify(bad)); }
      { const bad = await leftBorders(); assert.deepEqual(bad, [], JSON.stringify(bad)); }
      // (1024: chat and dock no longer both fit — the column collapses by itself; opened again, it holds.)
      await page.setViewportSize({ width: 1024, height: 800 }); await page.waitForTimeout(400);
      assert.equal(Math.round((await rect('.chat-col')).width), 44, 'collapsed by itself at 1024');
      { const bad = await centreClear(); assert.deepEqual(bad, [], JSON.stringify(bad)); }
      await snap('three-columns-1024');
      await page.click('[aria-label="Open chat"]'); await page.waitForSelector('.chat-col.open', { timeout: 5000 }); await page.waitForTimeout(300);
      assert.ok((await rect('.chat-col')).width > 300, 'opened again at 1024');
      { const bad = await centreClear(); assert.deepEqual(bad, [], JSON.stringify(bad)); }
      await page.setViewportSize({ width: 800, height: 800 }); await page.waitForTimeout(400);
      { const bad = await centreClear(); assert.deepEqual(bad, [], JSON.stringify(bad)); }
      // (Back to the default width, collapsed: as the other steps expect.)
      await page.evaluate(() => { localStorage.removeItem('studio.chatWidth'); });
      if (await page.locator('.chat-col .chat').count()) await page.click('[aria-label="Chat"]');
    } finally { await page.setViewportSize({ width: 1440, height: 900 }); }
  });

  await check('layout (G12d): at 1440, 1280, 1024 and 800, the chat open and collapsed, each preview mode — no two panels or bars meet, each inside the window; no box with a left border alone and a radius', async () => {
    await openModel(join(root, 'test/fixtures/cnc8-pocket.bcad'), 5, 60000); await idle();
    // (The panels and bars as they show; the dock's sheet and the chat column among them. One inside another — the HUD in the
    // dock — is not a meeting. A toast — the recovery card here — counts except on a cramped stage (an open sheet over a
    // narrow centre), where it runs under the sheet.)
    const problems = label => page.evaluate(label => {
      const sel = ['.chat-col', '.dock', '.dock-strip', '.topbar', '.toolbar', '.history', '.corner-right', '.view-cube', '.hud', '.corner-stack > *',
        ...(document.querySelector('.studio.stage-cramped') ? [] : ['.toast'])];
      const els = [];
      for (const s of sel) for (const e of document.querySelectorAll(s)) {
        const b = e.getBoundingClientRect(), c = getComputedStyle(e);
        if (b.width && b.height && c.display !== 'none' && c.visibility !== 'hidden' && !els.some(x => x.e === e)) els.push({ e, s: s + (e.getAttribute('aria-label') ? `[${e.getAttribute('aria-label')}]` : ''), b });
      }
      const bad = [], meets = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      for (const x of els) if (x.b.left < -0.5 || x.b.right > innerWidth + 0.5 || x.b.top < -0.5 || x.b.bottom > innerHeight + 0.5) bad.push(`${label}: ${x.s} leaves the window`);
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
        const a = els[i], b = els[j];
        if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
        if (meets(a.b, b.b)) bad.push(`${label}: ${a.s} meets ${b.s}`);
      }
      // (G12e: the history bar's chips whole — each one shown entirely inside the bar's box, none under the view bar.)
      const bar = document.querySelector('.history'), corner = document.querySelector('.corner-right');
      if (bar && getComputedStyle(bar).display !== 'none') {
        const r = bar.getBoundingClientRect(), c = corner?.getBoundingClientRect();
        for (const chip of bar.querySelectorAll('.hs, .hs-more')) {
          const b = chip.getBoundingClientRect();
          if (!b.width || getComputedStyle(chip).display === 'none') continue;
          if (b.left < r.left - 0.5 || b.right > r.right + 0.5 || b.top < r.top - 0.5 || b.bottom > r.bottom + 0.5) bad.push(`${label}: the history chip "${chip.textContent}" is cut by the bar's edge`);
          if (c && meets(b, c)) bad.push(`${label}: the history chip "${chip.textContent}" meets the view bar`);
        }
      }
      return bad;
    }, label);
    const leftBorders = () => page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => {
      const c = getComputedStyle(e), n = k => parseFloat(c[k]) || 0;
      return n('borderLeftWidth') > 0 && !n('borderTopWidth') && !n('borderRightWidth') && !n('borderBottomWidth') && ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].some(k => n(k) > 0);
    }).map(e => String(e.className || e.tagName)).slice(0, 5));
    const modes = ['None', 'CNC', 'Print', 'Clearance', 'Analysis'], bad = [];
    try {
      for (const [width, height] of [[1440, 900], [1280, 800], [1024, 800], [800, 800]]) for (const chat of [false, true]) {
        await page.evaluate(() => window.__studioLayoutReset?.());
        await page.setViewportSize({ width, height }); await page.waitForTimeout(300);
        if (chat) { await page.click('[aria-label="Chat"]'); await page.waitForSelector('.chat-col .chat', { timeout: 5000 }); }
        await page.waitForTimeout(300);
        // (Where the dock is a strip its sheet holds the previews.)
        if (await page.locator('[aria-label="Open the dock"]').count()) await page.click('[aria-label="Open the dock"]');
        for (const m of modes) {
          await page.click(`[aria-label="Preview: ${m}"]`); await page.waitForTimeout(400);
          bad.push(...await problems(`${width}${chat ? ' chat' : ''} ${m}`));
          if (width === 1440 && !chat && m === 'Clearance') await snap('layout-1440-clearance');
          if (width === 1024 && m === 'CNC') await snap(`layout-1024-cnc${chat ? '-chat' : ''}`);
        }
        await page.click('[aria-label="Preview: None"]');
        const lb = await leftBorders(); if (lb.length) bad.push(`${width}: left border alone with a radius: ${lb.join(', ')}`);
        // (G12f: a right-click on the plate's top — a face's long menu — opens inside the stage: below the top bar, clear of
        // the dock, its own scroll.)
        if (!chat && (width === 1440 || width === 1024)) {
          const [px, py] = await page.evaluate(() => window.__studioScreenOf([10, 10, 20]));
          await page.mouse.click(px, py, { button: 'right' }); await page.waitForSelector('.ctx-menu', { timeout: 5000 }); await page.waitForTimeout(200);
          const m = await page.evaluate(() => { const r = s => document.querySelector(s)?.getBoundingClientRect(); const menu = r('.ctx-menu'), bar = r('.topbar'), stage = r('.stage'), dock = r('.dock'), strip = r('.dock-strip');
            const meets = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
            return { inStage: menu.left >= stage.left - 0.5 && menu.right <= stage.right + 0.5 && menu.bottom <= stage.bottom + 0.5, bar: meets(menu, bar), dock: meets(menu, dock) || meets(menu, strip) }; });
          if (!m.inStage || m.bar || m.dock) bad.push(`${width}: the right-click menu leaves the stage or meets the top bar or dock: ${JSON.stringify(m)}`);
          await page.keyboard.press('Escape'); await page.waitForTimeout(200);
        }
        // (G12e: where chips are hidden, "+n" opens the bar on more rows — every step shown, whole — and Less closes it. At
        // 1440 the part's steps all fit, stacked above the view bar if not beside it: no "+n".)
        const more = page.locator('.history .hs-more');
        if (width === 1440 && !chat && await more.count()) bad.push(`1440: the history bar hides steps with room for them: ${await more.innerText()}`);
        if (await more.count()) {
          const n = Number((await more.innerText()).replace('+', ''));
          await more.click(); await page.waitForTimeout(200);
          const open = await page.evaluate(() => { const bar = document.querySelector('.history'), r = bar.getBoundingClientRect();
            return [...bar.querySelectorAll('.hs')].map(c => ({ shown: getComputedStyle(c).display !== 'none', inside: (b => b.left >= r.left - 0.5 && b.right <= r.right + 0.5 && b.top >= r.top - 0.5 && b.bottom <= r.bottom + 0.5)(c.getBoundingClientRect()) })); });
          if (!open.every(c => c.shown && c.inside)) bad.push(`${width}${chat ? ' chat' : ''}: +${n} opened, not every step shown whole: ${JSON.stringify(open)}`);
          await page.click('.history .hs-more'); await page.waitForTimeout(200);
          if (await page.locator('.history .hs-more').innerText() !== '+' + n) bad.push(`${width}${chat ? ' chat' : ''}: Less did not come back to +${n}`);
        }
      }
      assert.deepEqual(bad.slice(0, 12), [], bad.slice(0, 12).join('\n'));
    } finally { await page.evaluate(() => window.__studioLayoutReset?.()); await page.setViewportSize({ width: 1440, height: 900 }); }
  });

  await check('bottom row: the history bar and the view bar never overlap at 1440 × 900, 1280 × 800, 1024 and 800 — beside each other with room, else the history stacked above; the Display popover over neither', async () => {
    // (The chat column collapsed: the bar's room is the stage's, beside the column.)
    if (await page.locator('.chat-col .chat').count()) await page.click('[aria-label="Chat"]');
    // (A part with five history steps: CNC8's plate and pocket.)
    await openModel(join(root, 'test/fixtures/cnc8-pocket.bcad'), 5, 60000); await idle();
    const meets = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const rects = () => page.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
      return { history: r('.history'), views: r('.corner-right'), stack: r('.corner-right .corner-stack'), width: innerWidth, stacked: document.querySelector('.studio')?.classList.contains('history-stacked') }; });
    const display = page.locator('[aria-label="Display and previews"]');
    try {
      const seen = [];
      for (const [width, height] of [[1440, 900], [1280, 800], [1024, 800], [800, 800]]) {
        await page.setViewportSize({ width, height }); await page.waitForTimeout(400);
        const r = await rects();
        assert.ok(r.history && r.views, `${width}: ${JSON.stringify(r)}`);
        seen.push(`${width}: ${r.stacked ? 'stacked' : 'beside'}`);
        assert.ok(!meets(r.history, r.views), `${width} × ${height}: the history bar meets the view bar: ${JSON.stringify(r)}`);
        assert.ok(r.history.left >= 0 && r.history.right <= r.width + 0.5, `${width}: the history bar leaves the window: ${JSON.stringify(r)}`);
        if (width === 1280) await snap('bottom-row-1280');
        // (The Display popover stacks above the view bar, clear of the history bar.)
        if (await display.getAttribute('aria-expanded') !== 'true') await display.click();
        await page.waitForTimeout(200);
        const o = await rects();
        assert.ok(!meets(o.history, o.stack), `${width}: the Display popover covers the history bar: ${JSON.stringify(o)}`);
        await display.click();
      }
      console.log(`  bottom row: ${seen.join(', ')}`);
      // (Beside or stacked follows the stage's room — with the dock docked, 1440 has none either; at 800 it always stacks.)
      assert.ok(seen.at(-1).endsWith('stacked'), seen.join(', '));
    } finally { await page.setViewportSize({ width: 1440, height: 900 }); }
  });

  await check('narrow window top bar: at 1024 and 800 the whole bar fits — no sideways page, every mode button in the window, every tool on the bar or under More tools (O127)', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    const TOOLS = ['Chat', 'Undo', 'Redo', 'New part', 'New from a template', 'Library', 'Parameters', 'Open', 'Save', 'Export STL', 'Export 3MF', 'Export STEP', 'Insert part'];
    try {
      for (const width of [1024, 800]) {
        await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(300);
        const w = await page.evaluate(() => ({ page: document.documentElement.scrollWidth - window.innerWidth, scrolled: document.scrollingElement.scrollLeft,
          bar: Math.max(...[...document.querySelectorAll('.topbar > *')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect().right)) - window.innerWidth,
          modes: Math.max(...[...document.querySelectorAll('.mode button')].map(e => e.getBoundingClientRect().right)) - window.innerWidth }));
        assert.ok(w.page <= 0 && w.scrolled === 0 && w.bar <= 0.5 && w.modes <= 0, `${width}: ${JSON.stringify(w)}`);
        const onBar = await page.evaluate(() => [...document.querySelectorAll('.tools-tray > .tool, .tools-tray > span:not(.tools-more-anchor) > .tool')].map(e => e.getAttribute('aria-label')));
        let inMenu = [];
        if (await page.locator('[aria-label="More tools"]').count()) {
          await page.click('[aria-label="More tools"]');
          inMenu = await page.evaluate(() => [...document.querySelectorAll('[role="menu"][aria-label="More tools"] .tool')].map(e => e.getAttribute('aria-label')).filter(l => !/^Remove template/.test(l ?? '')));
          await page.keyboard.press('Escape');
        }
        const reach = new Set([...onBar, ...inMenu]);
        assert.deepEqual(TOOLS.filter(t => !reach.has(t)), [], `${width}: on the bar ${onBar}; in More tools ${inMenu}`);
        assert.ok(width > 1000 || inMenu.length > 0, `${width}: some fold under More tools`);
      }
      // (A tool from the menu works: Parameters opens its panel.)
      await page.click('[aria-label="More tools"]'); await page.click('[role="menu"][aria-label="More tools"] [aria-label="Parameters"]');
      await page.waitForSelector('[aria-label="Parameters panel"], .params', { timeout: 5000 });
      await snap('top-bar-800');
      await page.click('[aria-label="More tools"]'); await page.click('[role="menu"][aria-label="More tools"] [aria-label="Parameters"]');
    } finally { await page.setViewportSize({ width: 1440, height: 900 }); }
  });

  await check('shapes strip: no sideways page scroll at 1440, 1100 or 860; what has no room goes under More shapes, none lost; a pick from it starts', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    // (Nothing wider than the window: the page's own width, and every top-bar control's right edge.)
    const wide = () => page.evaluate(() => ({ page: document.documentElement.scrollWidth - window.innerWidth, scrolled: document.scrollingElement.scrollLeft,
      bar: Math.max(...[...document.querySelectorAll('.topbar > *')].map(e => e.getBoundingClientRect().right)) - window.innerWidth,
      shown: document.querySelectorAll('.shapes > .tool').length, more: !!document.querySelector('[aria-label="More shapes"]') }));
    const inMenu = async () => { if (!(await page.locator('[aria-label="More shapes"]').count())) return 0; await page.click('[aria-label="More shapes"]'); const n = await page.locator('[role="menu"][aria-label="More shapes"] .tool').count(); await page.keyboard.press('Escape'); return n; };
    const seen = [];
    try {
      for (const width of [1440, 1100, 860]) {
        await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(300);
        const w = await wide();
        // (The page never scrolls sideways; the bar itself fits down to 1100 — at 860 its other controls alone are wider than
        // the window and are clipped at its edge, a follow-up beyond the strip.)
        assert.ok(w.page <= 0 && w.scrolled === 0 && (width < 1100 || w.bar <= 0.5), `${width}: ${JSON.stringify(w)}`);
        seen.push([width, w.shown, await inMenu()]);
      }
      const totals = seen.map(([, a, b]) => a + b);
      assert.ok(totals.every(x => x === totals[0]) && totals[0] > 0, `none lost: ${JSON.stringify(seen)}`);
      assert.ok(seen[0][1] > seen[2][1] && seen.every(([, a], k) => k === 0 || a <= seen[k - 1][1]), `no more shown as the window narrows: ${JSON.stringify(seen)}`);
      // A shape from the menu starts its command.
      await page.click('[aria-label="More shapes"]');
      const last = page.locator('[role="menu"][aria-label="More shapes"] .tool:not(.off)').last(), label = await last.getAttribute('aria-label');
      await last.click();
      assert.equal(await page.locator('[role="menu"][aria-label="More shapes"]').count(), 0, 'the menu closes on a pick');
      // (Its command is the active one: its button lit when the menu opens again.)
      await page.click('[aria-label="More shapes"]');
      await page.waitForFunction(l => document.querySelector(`[role="menu"][aria-label="More shapes"] [aria-label="${l}"]`)?.classList.contains('on'), label, { timeout: 5000 });
      await snap('shapes-more');
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    } finally { await page.setViewportSize({ width: 1440, height: 900 }); }
    const w = await wide(); assert.ok(w.page <= 0 && w.scrolled === 0, JSON.stringify(w));
  });

  // ---- IM8a (O106): casting presets, through the Library panel and the real chat and tool servers -----------------
  await check('IM8a: die casting chosen in the Library panel with a +Z pull, a block drafted 0.75° made through the real chat — aluminium (A380) warned under its 1° achievable draft, zinc (Zamak 3) passing; the tolerance from its page', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'die-casting');
    await page.selectOption('[aria-label="Pull direction"]', '+Z');
    await page.waitForFunction(() => window.__studioDoc.process === 'die-casting' && window.__studioDoc.mould?.pull?.[2] === 1, null, { timeout: 5000 });
    // (O7c: the person's casting rules, the sample loaded in the Library panel — none is built in.)
    await page.click('[aria-label="Load sample casting rules"]'); await page.waitForFunction(() => window.__studioDoc.castingRules?.rows?.length === 24, null, { timeout: 10000 });
    assert.equal(await page.locator('[aria-label="Mould finish"]').count(), 0, 'no finishes for casting');
    await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'add', features: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { kind: 'extrude', sketch: 0, height: 20, draft: 0.75 }] } },
        { tool: 'features', args: { action: 'material', material: 'a380' } },
        { tool: 'query', args: { action: 'manufacturability' } },
        { tool: 'features', args: { action: 'material', material: 'zamak3' } },
        { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      const reports = (await page.locator('.chat-tool').allInnerTexts()).filter(x => /die-casting:/.test(x)).slice(-2);
      assert.match(reports[0], /query\.manufacturability\s*die-casting: material pass, pull pass, wall pass, draft warn, shrink unknown, machining-allowance n\/a, hot-spots pass, feeding unknown, section-change unknown, tolerance pass/, reports[0]);
      assert.match(reports[1], /die-casting: material pass, pull pass, wall pass, draft pass, shrink unknown, machining-allowance n\/a, hot-spots pass, feeding unknown, section-change unknown, tolerance pass/, reports[1]);
      await snap('im8a-die-casting');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- IM8b (O108): a sand-cast pattern's allowances, through the real chat and tool servers -------------------------
  await check('IM8b: sand casting chosen in the Library panel, an A356 block 100 × 60 × 20 made through the real chat with its top marked machined — the report scales the pattern 1.012917 (Aluminum, up to 4 ft) and puts 2.286 mm on n1.top, each from NPTEL\'s page', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'sand-casting');
    await page.selectOption('[aria-label="Pull direction"]', '+Z');
    await page.waitForFunction(() => window.__studioDoc.process === 'sand-casting' && window.__studioDoc.mould?.pull?.[2] === 1, null, { timeout: 5000 });
    // (O7c: the person's casting rules, the sample loaded in the Library panel — none is built in.)
    await page.click('[aria-label="Load sample casting rules"]'); await page.waitForFunction(() => window.__studioDoc.castingRules?.rows?.length === 24, null, { timeout: 10000 });
    await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 100, d: 60, h: 20, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'material', material: 'a356' } },
        { tool: 'features', args: { action: 'casting', machined: ['n1.top'] } },
        { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 60000 });
      await page.waitForFunction(() => window.__studioDoc.casting?.machined?.[0] === 'n1.top', null, { timeout: 10000 });
      const report = (await page.locator('.chat-tool').allInnerTexts()).filter(x => /sand-casting:/.test(x)).pop();
      assert.match(report, /sand-casting: material pass, pull pass, wall pass, draft fail, shrink pass, machining-allowance pass, hot-spots pass, feeding unknown, section-change pass, tolerance unknown/, report);
      await snap('im8b-sand-pattern');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- IM8c (O109): hot spots and feeding, through the real chat and tool servers --------------------------------
  await check('IM8c: a 20 mm block on a 4 mm plate, sand-cast in A356, made through the real chat — gated at the plate\'s far end its hot spot is warned [SHRINK_POROSITY] and the 2 : 1 section change warned; gated on the block, fed', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'sand-casting');
    await page.selectOption('[aria-label="Pull direction"]', '+Z');
    await page.waitForFunction(() => window.__studioDoc.process === 'sand-casting', null, { timeout: 5000 });
    // (O7c: the person's casting rules, the sample loaded in the Library panel — none is built in.)
    await page.click('[aria-label="Load sample casting rules"]'); await page.waitForFunction(() => window.__studioDoc.castingRules?.rows?.length === 24, null, { timeout: 10000 });
    await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 100, d: 40, h: 4, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 20, d: 20, h: 20, x: 0, y: 10, z: 0 } } },
        { tool: 'features', args: { action: 'command', command: 'union', values: {}, bodies: ['b1', 'b3'] } },
        { tool: 'features', args: { action: 'material', material: 'a356' } },
        { tool: 'features', args: { action: 'casting', gate: [95, 20, 4] } },
        { tool: 'query', args: { action: 'manufacturability' } },
        { tool: 'features', args: { action: 'casting', gate: [10, 20, 20] } },
        { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 90000 });
      const reports = (await page.locator('.chat-tool').allInnerTexts()).filter(x => /sand-casting:/.test(x)).slice(-2);
      assert.match(reports[0], /hot-spots pass, feeding warn, section-change warn/, reports[0]);
      assert.match(reports[1], /hot-spots pass, feeding pass, section-change warn/, reports[1]);
      await snap('im8c-feeding');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- IM7 S0 (O110): the mould's halves where no face needs a split, through the real chat and tool servers -----------
  await check('IM7: injection moulding with a +Z pull, a plate with a Ø10 through hole made through the real chat — the report\'s tooling: two halves on the flat parting plane z = 10, one shut-off (the hole), no side core', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'injection');
    await page.selectOption('[aria-label="Pull direction"]', '+Z'); await page.selectOption('[aria-label="Mould finish"]', 'smooth');
    await page.waitForFunction(() => window.__studioDoc.process === 'injection' && window.__studioDoc.mould?.pull?.[2] === 1, null, { timeout: 5000 });
    await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 60, d: 40, h: 10, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'command', command: 'hole', values: { d: 10, x: 30, y: 20 }, faces: ['n1.top'] } },
        { tool: 'features', args: { action: 'material', material: 'abs' } },
        { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 90000 });
      const report = (await page.locator('.chat-tool').allInnerTexts()).filter(x => /injection:/.test(x)).pop();
      assert.match(report, /parting pass, tooling pass$/, report);
      await snap('im7-tooling');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- IM7a (O111): a cup's core and a stepped parting line, through the real chat and tool servers -----------------
  await check('IM7a: injection moulding with a +Z pull, a cup (a box shelled open at the top) made through the real chat — the report\'s tooling passes: its inside the moving half\'s core, the parting line stepped at z = 2 and 25 on its inner walls', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    await page.click('[aria-label="New part"]'); await idle();
    await page.click('[aria-label="Library"]'); await page.selectOption('[aria-label="Process"]', 'injection');
    await page.selectOption('[aria-label="Pull direction"]', '+Z'); await page.selectOption('[aria-label="Mould finish"]', 'smooth');
    await page.waitForFunction(() => window.__studioDoc.process === 'injection' && window.__studioDoc.mould?.pull?.[2] === 1, null, { timeout: 5000 });
    await page.click('[aria-label="Close library"]');
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', code => failed(new Error(`the chat server exited (${code})`))); });
      await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const n = await page.locator('.chat-msg.assistant').count(), calls = [
        { tool: 'features', args: { action: 'command', command: 'box', values: { w: 60, d: 40, h: 25, x: 0, y: 0, z: 0 } } },
        { tool: 'features', args: { action: 'command', command: 'shell', values: { t: 2 }, faces: ['n1.top'] } },
        { tool: 'features', args: { action: 'material', material: 'abs' } },
        { tool: 'query', args: { action: 'manufacturability' } }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      await page.waitForFunction(k => document.querySelectorAll('.chat-msg.assistant').length > k && !document.querySelector('[aria-label="Chat message"]')?.disabled, n, { timeout: 90000 });
      const report = (await page.locator('.chat-tool').allInnerTexts()).filter(x => /injection:/.test(x)).pop();
      assert.match(report, /parting \w+, tooling pass$/, report);
      await snap('im7a-cup');
      await page.click('[aria-label="Close chat"]');
    } finally { chat.kill(); }
  });

  // ---- G6: analysis maps -------------------------------------------------------------------------------------------
  await check('G6: the analysis maps — a moulded plate\'s wall thickness with its legend and the value under the pointer; its draft; what a 3-axis mill does not reach; its parting line; its two halves (48,000 mm³ above the parting plane), spread apart; off again', async () => {
    const fs = await import('node:fs'), file = join(out, 'g6-plate.bcad');
    // (IM7's plate: 60 × 40 × 10 with a Ø10 through hole, injection moulded along +Z.)
    const plate = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, process: 'injection', mould: { version: 1, pull: [0, 0, 1], finish: 'smooth' },
      nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }, { kind: 'extrude', sketch: 0, height: 10 }, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [30, 20], radius: 5 }],
      outputs: { b2: { node: 2, side: 'solid' } } };
    fs.writeFileSync(file, JSON.stringify(plate));
    await openModel(file, 3); await idle(); await iso();
    // (G10: on WebGL2 the maps and the mould's view are not drawn — the button says so, disabled, and nothing is turned on.)
    if (renderer === 'webgl2') {
      const b = page.locator('[aria-label="Analysis map"]');
      assert.equal(await b.isDisabled(), true, 'the analysis map is not offered on WebGL2');
      assert.match(await b.getAttribute('data-tip-desc') ?? '', /drawn with WebGPU; this browser draws with WebGL2/);
      assert.equal(await page.locator('[aria-label="Map legend"]').count(), 0);
      return;
    }
    await page.click('[aria-label="Analysis map"]');
    await page.waitForSelector('[aria-label="Map legend"]', { timeout: 10000 });
    await page.locator('[aria-label="Map legend"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-map-legend.png`) });
    assert.match(await page.locator('[aria-label="Map legend"]').innerText(), /Wall thickness/);
    // The value under the pointer: over the plate's top, its 10 mm wall (the inscribed sphere at a top triangle).
    const box = await page.locator('canvas.vp-canvas').boundingBox();
    let value = '—';
    for (let k = 0; k < 12 && value === '—'; k++) { await page.mouse.move(box.x + box.width * (0.4 + 0.02 * k), box.y + box.height * 0.5); await page.waitForTimeout(80); value = await page.locator('[aria-label="Map value"]').innerText(); }
    assert.match(value, /^\d+(\.\d+)? mm$/, `a value under the pointer: ${value}`);
    await snap('g6-thickness');
    // The draft (O-G6's per-vertex exact draft): its walls along the pull under the smooth finish's least draft, red.
    await page.click('[aria-label="Analysis map"]');
    await page.waitForFunction(() => /Draft against the pull/.test(document.querySelector('[aria-label="Map legend"]')?.textContent ?? ''), null, { timeout: 30000 });
    await snap('g6-draft');
    // What a 3-axis mill does not reach (O-G6's per-triangle access): the plate's every face reached.
    await page.click('[aria-label="Analysis map"]');
    await page.waitForFunction(() => /Not reached by a 3-axis mill/.test(document.querySelector('[aria-label="Map legend"]')?.textContent ?? ''), null, { timeout: 30000 });
    await snap('g6-access');
    await page.click('[aria-label="Analysis map"]');
    await page.waitForFunction(() => /\d+ loops?/.test(document.querySelector('[aria-label="Parting loops"]')?.textContent ?? ''), null, { timeout: 30000 });
    await snap('g6-parting');
    await page.click('[aria-label="Analysis map"]');
    await page.waitForSelector('[aria-label="Plus half"]', { timeout: 60000 });
    assert.match(await page.locator('[aria-label="Plus half"]').innerText(), /48,000 mm³/);
    await page.click('[aria-label="Spread the halves"]'); await page.waitForTimeout(400); await snap('g6-halves');
    await page.click('[aria-label="Analysis map"]');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Mould legend"]') && !document.querySelector('[aria-label="Map legend"]'), null, { timeout: 5000 });
  });

  // ---- O133: a chat turn merged onto an edit the person made while it ran ------------------------------------------
  await check('chat turn merged with an edit made during it: a slow scripted turn raises the box to 20 while a second box is added — both kept; one Undo takes the agent\'s change back, the second box stays (O133)', async () => {
    const { spawn } = await import('node:child_process'), origin = new URL(url).origin;
    const chat = spawn(process.execPath, [join(root, 'scripts/chat-server.mjs')], { env: { ...process.env, CAD_STUDIO_CLAUDE: join(root, 'test/fixtures/scripted-claude.mjs'), CAD_STUDIO_CHAT_ORIGINS: [origin, origin.replace('localhost', '127.0.0.1')].join(',') }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      await new Promise((ready, failed) => { chat.stdout.on('data', d => { if (/chat server on/.test(String(d))) ready(); }); chat.on('exit', c => failed(new Error(`the chat server exited (${c})`))); });
      await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter'); await idle();
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
      if (!await page.locator('[aria-label="Chat message"]').count()) await page.click('[aria-label="Chat"]');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 20000 });
      const k = await page.locator('.chat-msg.assistant').count(), tools = await page.locator('.chat-tool').count();
      const calls = [{ tool: 'features', args: { action: 'edit', index: 1, values: { h: 20 } } }, { pause: 6000 }];
      await page.fill('[aria-label="Chat message"]', `script ${JSON.stringify({ calls })}`); await page.locator('[aria-label="Chat message"]').press('Enter');
      // (While the turn pauses, after its edit: the person adds a second box at X 40.)
      await page.waitForFunction(t => document.querySelectorAll('.chat-tool').length > t, tools, { timeout: 30000 });
      await page.evaluate(() => document.activeElement?.blur?.());
      await press('b'); await hudReady(); await field('At X').fill('40'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 4, null, { timeout: 15000 });
      assert.ok(await page.locator('.chat-msg.busy').count(), 'the turn is still running');
      await page.waitForFunction(n => document.querySelectorAll('.chat-msg.assistant').length > n && !document.querySelector('[aria-label="Chat message"]')?.disabled, k, { timeout: 60000 });
      await page.waitForFunction(() => /Chat turn merged with your edits/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 15000 });
      assert.match(await page.textContent('.toast'), /1 of 1 change applied/);
      const heights = () => page.evaluate(() => window.__studioDoc.nodes.filter(n => n.kind === 'extrude').map(n => [n.id, n.height]));
      assert.deepEqual(await heights(), [['n1', 20], ['n3', 16]]);
      await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
      await snap('chat-merge-both-kept');
      // One Undo: the agent's change gone, the person's box kept.
      await page.click('[aria-label="Close chat"]'); await page.evaluate(() => document.activeElement?.blur?.());
      await press('Meta+z');
      await page.waitForFunction(() => window.__studioDoc.nodes.find(n => n.id === 'n1')?.height === 16, null, { timeout: 15000 });
      assert.deepEqual(await heights(), [['n1', 16], ['n3', 16]]);
    } finally { chat.kill(); }
  });

  // ---- PERF3 B13 (O135): mesh blobs no step reaches evicted at idle; nothing reachable dropped -------------------------
  await check('blob eviction: an STL opened, the idle sweeps run (the DEV counter), its arrays kept while undo holds them — undo and redo build it, no dropped blob asked for (O135)', async () => {
    await page.click('[aria-label="New part"]'); await idle();
    await page.setInputFiles('input[aria-label="Model file"]', join(root, '../../packages/barocss-cad-model/test/fixtures/block-cm.stl'));
    await page.waitForSelector('[aria-label="Mesh units"]'); await page.selectOption('[aria-label="Mesh unit"]', 'cm');
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    const sweeps0 = await page.evaluate(() => window.__studioBlobs?.sweeps ?? 0);
    await page.click('[aria-label="New part"]'); await idle();
    // (Two sweeps: two seconds after each change; the mesh's document is an undo step, so its blobs stay.)
    await page.waitForFunction(n => (window.__studioBlobs?.sweeps ?? 0) >= n + 1, sweeps0, { timeout: 15000 });
    await page.waitForTimeout(2500);
    const b = await page.evaluate(() => window.__studioBlobs);
    console.log(`    (blob sweeps ${b.sweeps}, last freed ${b.lastFreed} bytes, ${b.freed} in all, ${b.kept} kept)`);
    assert.deepEqual(b.evictedAsked, []);
    await press('Meta+z');
    await page.waitForFunction(() => window.__studioDoc.nodes[0]?.kind === 'mesh' && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await press('Meta+Shift+z'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await press('Meta+z'); await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    assert.deepEqual(await page.evaluate(() => window.__studioBlobs.evictedAsked), []);
  });

  // ---- G10: copies turned about Z share one tessellation --------------------------------------------------------------
  await check('G10: 24 copies of a bracket turned about Z in 15° steps share one tessellation — the same pixels and picks as each its own mesh; an edited copy gets its own, the others kept', async () => {
    const fs = await import('node:fs');
    const bracket = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [
      { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 12] }, { kind: 'extrude', sketch: 0, height: 6 },
      { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [6, 6], radius: 2 }, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [24, 6], radius: 2 }],
      outputs: { b1: { node: 3, side: 'solid' } } };
    const edited = { ...bracket, nodes: [...bracket.nodes.slice(0, 3), { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [21, 6], radius: 2.5 }] };
    const ring = edit => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {},
      instances: Array.from({ length: 24 }, (_, k) => ({ id: `r${k}`, name: `bracket ${k}`, doc: edit && k === 5 ? edited : bracket,
        position: [70 * Math.cos(k * Math.PI / 12), 70 * Math.sin(k * Math.PI / 12), 0], rotation: [0, 0, 15 * k] })) });
    const file = join(out, 'g10-ring.bcad');
    fs.writeFileSync(file, JSON.stringify(ring(false)));
    await openModel(file, 0);
    await page.waitForFunction(() => window.__studioInstanceBounds?.().length === 24, null, { timeout: 60000 }); await idle(); await page.waitForTimeout(800);
    // (G10 on WebGL2: the same claims through the renderer-neutral probes — its geometries, the frame on a 96 × 96 grid, the
    // copies picked at 400 points on their tops — against each copy its own.)
    if (renderer === 'webgl2') {
      const geo = () => page.evaluate(() => window.__studioInstanceGeometries());
      const shared = await geo();
      assert.deepEqual([shared.copies, shared.geometries], [24, 1], `24 copies on one geometry ${JSON.stringify([shared.copies, shared.geometries])}`);
      const r = await page.evaluate(async () => {
        const bounds = window.__studioInstanceBounds(); let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        const at = Array.from({ length: 400 }, (_, k) => { const b = bounds[k % bounds.length]; return [(b.min[0] + b.max[0]) / 2 + (rand() - 0.5) * 0.6 * (b.max[0] - b.min[0]), (b.min[1] + b.max[1]) / 2 + (rand() - 0.5) * 0.6 * (b.max[1] - b.min[1]), b.max[2]]; });
        const settle = () => new Promise(done => setTimeout(done, 400)), picks = () => at.map(p => JSON.stringify(window.__studioInstanceAt(p)));
        const a = await window.__studioFrame(96), pa = picks();
        window.__studioShareCopies(false); await settle();
        const b = await window.__studioFrame(96), pb = picks(), own = window.__studioInstanceGeometries().geometries;
        window.__studioShareCopies(true); await settle();
        let strong = 0, max = 0;
        for (let i = 0; i < a.length; i += 3) { const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); if (d > 96) strong++; if (d > max) max = d; }
        let hits = 0, differ = 0; for (let i = 0; i < at.length; i++) { if (pa[i] !== 'null') hits++; if (pa[i] !== pb[i]) differ++; }
        return { samples: a.length / 3, strong, max, hits, differ, own };
      });
      console.log(`  G10 oracle (webgl2): ${JSON.stringify(r)}`);
      assert.ok(r.strong <= r.samples * 0.001, `the same frame: ${r.strong} of ${r.samples} samples differ by more than 96 (max ${r.max})`);
      assert.ok(r.hits > 100 && r.differ === 0, `the same picks ${JSON.stringify(r)}`);
      assert.equal(r.own, 24, 'each its own: a geometry a copy');
      await snap('g10-copies');
      fs.writeFileSync(file, JSON.stringify(ring(true)));
      const before = (await geo()).ids;
      await openModel(file, 0);
      await page.waitForFunction(() => window.__studioInstanceBounds?.().length === 24, null, { timeout: 60000 }); await idle(); await page.waitForTimeout(800);
      const after = await geo();
      assert.deepEqual([after.copies, after.geometries], [24, 2], 'the edited copy on its own');
      assert.notDeepEqual(after.ids.r5, after.ids.r0, 'its surface not shared');
      const kept = Object.keys(before).filter(k => k !== 'r5' && JSON.stringify(before[k]) === JSON.stringify(after.ids[k])).length;
      assert.equal(kept, 23, 'the other copies kept their geometry');
      return;
    }
    const geos = () => page.evaluate(() => { const ms = window.__studioViewer.meshList.filter(m => m.name?.startsWith('inst:')); return { meshes: ms.length, geometries: new Set(ms.map(m => m.geometry)).size, ids: Object.fromEntries(ms.filter(m => m.geometry.topology === 'triangles').map(m => [m.name, m.id])), own: ms.filter(m => m.name === 'inst:r5' && m.geometry.topology === 'triangles').map(m => ms.some(o => o !== m && o.geometry === m.geometry)) }; });
    const shared = await geos();
    assert.deepEqual([shared.meshes, shared.geometries], [48, 2], 'a surface and its edges each, on two geometries');
    // The oracle: each copy its own mesh again (as before G10) — the same frame, and the same picks over 400 pointers.
    const r = await page.evaluate(async () => {
      const v = window.__studioViewer, W = v.canvas.clientWidth, H = v.canvas.clientHeight;
      let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      // (Aimed at the copies: a pointer near each one's screen box, 400 in all, whatever the camera.)
      const M = v.camera.viewProjection(v.aspect), boxes = window.__studioInstanceBounds().map(b => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let c = 0; c < 8; c++) { const p = [c & 1 ? b.max[0] : b.min[0], c & 2 ? b.max[1] : b.min[1], c & 4 ? b.max[2] : b.min[2]], w = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15], sx = ((M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12]) / w * 0.5 + 0.5) * W, sy = (0.5 - (M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13]) / w * 0.5) * H; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
        return [x0, y0, x1, y1];
      });
      const at = Array.from({ length: 400 }, (_, k) => { const b = boxes[k % boxes.length]; return [b[0] + rand() * (b[2] - b[0]), b[1] + rand() * (b[3] - b[1])]; });
      const settle = () => new Promise(done => setTimeout(done, 400));
      const picks = () => at.map(([x, y]) => { const h = v.raycast(x, y); return h && { name: h.mesh.name, tri: h.triangle, p: h.point }; });
      // (G8: a curved face's silhouette is a contour geometry, one for each mesh source — counted apart.)
      const contours = () => new Set(v.meshList.filter(m => m.geometry.data.contour).map(m => m.geometry)).size;
      await v.frame(); const a = await v.capture(), pa = picks(), geoA = new Set(v.meshList.map(m => m.geometry)).size, contourA = contours();
      window.__studioShareCopies(false); await settle(); await v.frame();
      const b = await v.capture(), pb = picks(), geoB = new Set(v.meshList.map(m => m.geometry)).size, contourB = contours();
      window.__studioShareCopies(true); await settle();
      let strong = 0, max = 0;
      for (let i = 0; i < a.data.length; i += 4) { const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); if (d > 96) strong++; if (d > max) max = d; }
      let differ = 0, hits = 0, gap = 0;
      for (let i = 0; i < at.length; i++) {
        const x = pa[i], y = pb[i];
        if (x) hits++;
        if (!x !== !y || (x && (x.name !== y.name || x.tri !== y.tri))) { differ++; continue; }
        if (x) gap = Math.max(gap, Math.hypot(x.p[0] - y.p[0], x.p[1] - y.p[1], x.p[2] - y.p[2]));
      }
      return { pixels: a.data.length / 4, strong, max, hits, differ, gap, geoA, geoB, contourA, contourB };
    });
    console.log(`  G10 oracle: ${JSON.stringify(r)}`);
    assert.ok(r.strong <= r.pixels * 0.001, `the same frame: ${r.strong} of ${r.pixels} pixels differ by more than 96 (max ${r.max})`);
    assert.ok(r.hits > 100 && r.differ === 0 && r.gap < 1e-3, `the same picks ${JSON.stringify(r)}`);
    assert.deepEqual([r.contourA, r.contourB], [1, 24], `a silhouette contour for the shared mesh, then one a copy ${JSON.stringify(r)}`);
    assert.ok(r.geoB - r.geoA - (r.contourB - r.contourA) === 46, `each its own: 46 more surface and edge geometries ${JSON.stringify(r)}`);
    await snap('g10-copies');
    // Copy 5 edited (its second hole moved): its own geometries; the other 23 kept as they were.
    fs.writeFileSync(file, JSON.stringify(ring(true)));
    const before = (await geos()).ids;
    await openModel(file, 0);
    await page.waitForFunction(() => window.__studioInstanceBounds?.().length === 24, null, { timeout: 60000 }); await idle(); await page.waitForTimeout(800);
    const after = await geos();
    assert.deepEqual([after.meshes, after.geometries], [48, 4], 'the edited copy on its own two');
    assert.deepEqual(after.own, [false], 'its surface not shared');
    const kept = Object.keys(before).filter(k => k !== 'inst:r5' && before[k] === after.ids[k]).length;
    assert.equal(kept, 23, 'the other copies kept their meshes');
  });

  // ---- G12: a proposal's two-colour overlay ----------------------------------------------------------------------------
  await check('G12: a proposal previewed with what it adds (green) and takes away (red) — a Ø4 hole in a 40 × 20 × 8 plate and a 10 × 10 × 5 block beside it: 500 mm³ added, 100.5 removed, by the Boolean; cleared with the preview', async () => {
    const fs = await import('node:fs');
    const nodes = [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 8 }];
    const risk = { level: 'low', features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] };
    const ops = [{ tool: 'features', args: { action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 4, x: 30, y: 10 } } },
      { tool: 'features', args: { action: 'add', features: [{ kind: 'sketch', profile: 'rectangle', min: [50, 0], max: [60, 10] }, { kind: 'extrude', sketch: 3, height: 5 }] } }];
    const proposals = [{ id: 'P9', title: 'A Ø4 hole and a block', status: 'open', by: { agent: 'chat' }, at: '2026-10-22T00:00:00Z', base: '0', ops, risk, summary: '3 added' }];
    const file = join(out, 'g12-proposal.bcad');
    fs.writeFileSync(file, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes, proposals }));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForSelector('[aria-label="Proposal P9"]', { timeout: 15000 }); await idle();
    await page.locator('[aria-label="Proposal P9"] button', { hasText: 'Rebase & preview' }).click();
    await page.waitForSelector('[aria-label="Proposal P9"] [aria-label="Volume change"]', { timeout: 15000 });
    await page.waitForFunction(() => !!window.__studioProposalOverlay?.(), null, { timeout: 30000 }); await page.waitForTimeout(600);
    const o = await page.evaluate(() => window.__studioProposalOverlay());
    console.log(`  G12 overlay: ${JSON.stringify(o)}`);
    assert.equal(o.method, 'boolean');
    assert.ok(Math.abs(o.added - 500) < 1, `500 mm³ added ${JSON.stringify(o)}`);
    assert.ok(Math.abs(o.removed - Math.PI * 4 * 8) < 1.5, `the hole's π·2²·8 removed ${JSON.stringify(o)}`);
    assert.ok(o.faces > 0);
    // Drawn on either renderer (WebGL2 too, G16): the two materials, their edges and chips; green over the block, red at the
    // hole; no faces tinted, the Boolean drew it.
    assert.equal(o.tinted, false, 'no faces tinted: the Boolean drew it');
    if (await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer === 'webgpu')) {
      const names = await page.evaluate(() => window.__studioViewer.meshList.map(m => m.name).filter(n => n?.startsWith('proposal:')));
      assert.deepEqual(names.sort(), ['proposal:added', 'proposal:removed']);
    } else assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.vp-overlay [aria-label^="Material"]')].map(g => g.textContent).sort()), ['+500 mm³', '−101 mm³'], 'WebGL2: the chips in the overlay');
    // (The two chips stacked, never meeting — they overlapped by the hole in the docs lane's shot. WebGPU draws them as engine
    // labels at one anchor, a chip's step apart; WebGL2's are the overlay's.)
    if (await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer !== 'webgpu')) {
      const [r1, r2] = await page.evaluate(() => [...document.querySelectorAll('.vp-overlay [aria-label^="Material"] rect')].map(r => { const b = r.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; }));
      assert.ok(r1.b <= r2.t + 0.5 || r2.b <= r1.t + 0.5 || r1.r <= r2.l + 0.5 || r2.r <= r1.l + 0.5, `the volume chips meet: ${JSON.stringify([r1, r2])}`);
    }
    const [block, hole] = await page.evaluate(() => window.__studioPixels([[55, 5, 5], [30, 10, 8]]));
    assert.ok(block[1] > block[0] + 20 && block[1] > block[2] + 10, `green over the block ${JSON.stringify(block)}`);
    assert.ok(hole[0] > hole[1] + 20, `red at the hole ${JSON.stringify(hole)}`);
    await snap('g12-proposal');
    // Before and after: the overlay stays; the preview cleared, it goes.
    await page.click('[aria-label="Proposal P9"] [aria-label="Before or after"]'); await page.waitForTimeout(500); await snap('g12-proposal-before');
    assert.ok(await page.evaluate(() => !!window.__studioProposalOverlay()));
    await page.locator('[aria-label="Proposal P9"] button', { hasText: 'Reject' }).click();
    await page.waitForFunction(() => !window.__studioProposalOverlay?.(), null, { timeout: 10000 });
  });

  // ---- G16: WebGL2 parity — the same checks on either renderer --------------------------------------------------------
  await check('G16: curves and surfaces drawn and picked, edges a surface hides not picked, a dragged body drawn turned — on either renderer', async () => {
    const fs = await import('node:fs');
    const renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    // Curves and surfaces: the panel (z = −5, 20 × 20) lit blue and picked; the arc's quarter point cyan and picked.
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.setInputFiles('input[aria-label="Model file"]', join(root, 'test/fixtures/study.barocad'));
    await page.waitForFunction(() => (window.__studioDoc.direct?.objects.length ?? 0) === 4); await idle();
    // (Imported, all four are picked: the arc alone, then the panel from the canvas.)
    await page.locator('.ol.direct', { hasText: 'arc' }).click();
    await press('f'); await page.waitForTimeout(600);
    const ids = await page.evaluate(() => Object.fromEntries(window.__studioDoc.direct.objects.map(o => [o.name.split(' · ')[1], o.id])));
    const P = [15, 15, -5], A = [5, 3.75, 0];
    const [pa, aa] = await page.evaluate(([P, A]) => window.__studioPixels([P, A]), [P, A]);
    assert.ok(pa[2] > pa[0] + 20, `the panel drawn, lit blue: ${JSON.stringify(pa)} (${renderer})`);
    assert.ok(aa[0] > aa[2] + 40, `the arc drawn in the accent, picked: ${JSON.stringify(aa)}`);
    assert.deepEqual(await page.evaluate(([P, A]) => [window.__studioDirectAt(P), window.__studioDirectAt(A)], [P, A]), [ids.panel, ids.arc], 'picked');
    const sp = await page.evaluate(P => window.__studioScreenOf(P), P);
    await page.mouse.click(sp[0], sp[1]);
    await page.waitForFunction(() => /panel/.test(document.querySelector('.ol.direct.sel')?.textContent ?? ''), null, { timeout: 5000 }); await page.waitForTimeout(300);
    const [on] = await page.evaluate(P => window.__studioPixels([P]), P);
    assert.ok(on[0] > on[2] + 40, `selected: the accent ${JSON.stringify(on)}`);
    await snap('g16-direct');
    // Edges: a 40 × 20 × 8 plate; at the midpoints of the three edges at its corner farthest from the eye (hidden) no pick
    // finds them; at the nearest corner's three it finds each.
    const plate = join(out, 'g16-plate.bcad');
    fs.writeFileSync(plate, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 8 }] }));
    await openModel(plate, 2); await idle(); await page.waitForTimeout(600);
    const edges = await page.evaluate(() => {
      const c = i => [i & 1 ? 40 : 0, i & 2 ? 20 : 0, i & 4 ? 8 : 0], e = window.__studioEye(), d = i => Math.hypot(...c(i).map((v, k) => v - e[k]));
      const far = [...Array(8).keys()].reduce((b, i) => d(i) > d(b) ? i : b, 0), near = [...Array(8).keys()].reduce((b, i) => d(i) < d(b) ? i : b, 0);
      const on = (segs, a, b) => segs.length > 0 && segs.every(s => [s.slice(0, 3), s.slice(3)].every(p => { const ab = b.map((v, k) => v - a[k]), ap = p.map((v, k) => v - a[k]), t = ap.reduce((x, v, k) => x + v * ab[k], 0) / ab.reduce((x, v) => x + v * v, 0); return t > -1e-3 && t < 1 + 1e-3 && Math.hypot(...ap.map((v, k) => v - t * ab[k])) < 1e-3; }));
      const test = i => [1, 2, 4].map(bit => { const a = c(i), b = c(i ^ bit), m = a.map((v, k) => (v + b[k]) / 2), hit = window.__studioEdgeAt(m); return hit ? on(hit.segments, a, b) : false; });
      return { hidden: test(far), shown: test(near) };
    });
    assert.deepEqual(edges, { hidden: [false, false, false], shown: [true, true, true] }, `edges a surface hides are passed over (${renderer})`);
    // A dragged body's turn: the frame mid-drag at 45° about X is the frame the turn makes (its move alone, as WebGL2 drew
    // it before, is the frame before the drag).
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await press(' '); await page.locator('.palette input').fill('rotate'); await press('Enter'); await press('e'); await hudReady();
    await page.waitForSelector('[data-gizmo=turnX]', { timeout: 5000 });
    const svg = await page.locator('.vp-overlay').boundingBox();
    const o = await page.evaluate(() => { const c = document.querySelector('.gizmo-origin'); return [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]; });
    const q = await page.evaluate(() => { const ps = document.querySelector('[data-gizmo=turnX] polyline:nth-of-type(2)').getAttribute('points').trim().split(' ').map(p => p.split(',').map(Number)); return ps[ps.length >> 1]; });
    const r = Math.hypot(q[0] - o[0], q[1] - o[1]), a0 = Math.atan2(q[1] - o[1], q[0] - o[0]);
    const before = await page.evaluate(() => window.__studioFrame(32));
    await page.mouse.move(svg.x + q[0], svg.y + q[1]); await page.mouse.down();
    for (let k = 1; k <= 12; k++) await page.mouse.move(svg.x + o[0] + r * Math.cos(a0 - k * Math.PI / 48), svg.y + o[1] + r * Math.sin(a0 - k * Math.PI / 48));
    await page.waitForTimeout(400);
    const during = await page.evaluate(() => window.__studioFrame(32));
    await snap('g16-turning');
    await page.mouse.up();
    await page.waitForFunction(() => [...document.querySelectorAll('.hud input')].some(i => Math.abs(Number(i.value)) === 45), null, { timeout: 5000 });
    await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'rotate', null, { timeout: 15000 }); await idle();
    // (Its top face is picked again once it is made: cleared, as it was not lit while it turned.)
    await press('Escape'); await page.waitForFunction(() => !/SELECTION/.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 }); await page.waitForTimeout(600);
    const after = await page.evaluate(() => window.__studioFrame(32));
    const diff = (x, y) => x.reduce((t, v, i) => t + Math.abs(v - y[i]), 0) / x.length;
    const turned = { toAfter: diff(during, after), toBefore: diff(during, before), moved: diff(before, after) };
    console.log(`  G16 turn (${renderer}): ${JSON.stringify(turned)}`);
    assert.ok(turned.moved > 2 && turned.toAfter < turned.toBefore / 4, `mid-drag drawn as turned ${JSON.stringify(turned)}`);
    await snap('g16-turned');
  });

  // ---- G17: the 3D skeleton sketch in the viewport ---------------------------------------------------------------------
  await check('G17: a 3D sketch — a 40 × 20 loop drawn on XY, constrained to well-defined (a conflict shown, undone), points dragged and solved live, applied as a skeleton; a body corner snapped in 3D — on either renderer', async () => {
    const renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.click('.views button:text-is("Top")'); await page.waitForTimeout(300);
    await press(' '); await page.locator('.palette input').fill('3d sketch'); await press('Enter');
    await page.waitForSelector('aside[aria-label="3D sketch"]', { timeout: 5000 });
    const scr = p => page.evaluate(p => window.__studioScreenOf(p), p);
    const svg = await page.locator('.vp-overlay').boundingBox();
    const mark = () => page.evaluate(() => { const g = document.querySelector('.vp-overlay [aria-label="3D sketch"]'); return g && { points: +g.dataset.points, segments: +g.dataset.segments, status: g.dataset.status }; });
    const pointAt = i => page.evaluate(i => { const c = document.querySelector(`.vp-overlay [aria-label="3D sketch"] circle[data-point="${i}"]`); return [+c.getAttribute('cx'), +c.getAttribute('cy')]; }, i);
    // Drawn: four corners clicked on XY, the last click back on the first closing the loop.
    const corners = [[0, 0, 0], [40, 0, 0], [40, 20, 0], [0, 20, 0]];
    for (const c of [...corners, corners[0]]) { const q = await scr(c); await page.mouse.move(q[0], q[1], { steps: 2 }); await page.mouse.click(q[0], q[1]); await page.waitForTimeout(120); }
    assert.deepEqual(await mark(), { points: 4, segments: 4, status: 'under' }, 'the loop');
    // Constraints by selection: point 0 fixed; sides 0 and 2 along X, 1 and 3 along Y; side 0's length 40, side 1's 20.
    await press('s');
    // (A side picked at its middle as drawn now: the corners move as it is solved.)
    const pick = async (seg, additive = false) => { const a = await pointAt(seg), b = await pointAt((seg + 1) % 4); if (additive) await page.keyboard.down('Shift'); await page.mouse.click(svg.x + (a[0] + b[0]) / 2, svg.y + (a[1] + b[1]) / 2); if (additive) await page.keyboard.up('Shift'); await page.waitForTimeout(100); };
    const add = label => page.click(`aside[aria-label="3D sketch"] button[aria-label="Add ${label}"]`);
    { const q = await pointAt(0); await page.mouse.click(svg.x + q[0], svg.y + q[1]); } await add('Fix');
    await pick(0); await add('Along X'); await pick(0); await add('Length');
    // Live: the free corner 2 dragged — under the pointer through the drag; corner 1 (on its fixed line, 40 long) held.
    const drag = async (i, to) => {
      const from = await pointAt(i); await page.mouse.move(svg.x + from[0], svg.y + from[1]); await page.mouse.down();
      const q = await scr(to); await page.mouse.move((svg.x + from[0] + q[0]) / 2, (svg.y + from[1] + q[1]) / 2, { steps: 4 }); await page.waitForTimeout(100);
      const mid = await pointAt(i), midPtr = [(svg.x + from[0] + q[0]) / 2 - svg.x, (svg.y + from[1] + q[1]) / 2 - svg.y];
      await page.mouse.move(q[0], q[1], { steps: 4 }); await page.waitForTimeout(100); await page.mouse.up(); await page.waitForTimeout(150);
      return { mid, midPtr, end: await pointAt(i), ptr: [q[0] - svg.x, q[1] - svg.y], from };
    };
    const free = await drag(2, [46, 26, 0]);
    assert.ok(Math.hypot(free.mid[0] - free.midPtr[0], free.mid[1] - free.midPtr[1]) < 3, `followed mid-drag ${JSON.stringify(free)}`);
    assert.ok(Math.hypot(free.end[0] - free.ptr[0], free.end[1] - free.ptr[1]) < 3, `at the pointer ${JSON.stringify(free)}`);
    const held = await drag(1, [36, 8, 0]);
    assert.ok(Math.hypot(held.end[0] - held.from[0], held.end[1] - held.from[1]) < 1.5, `held by its constraints ${JSON.stringify(held)}`);
    assert.equal((await mark()).status, 'under');
    // The rest: sides 2 along X, 1 and 3 along Y, side 1 20 long — well-defined, the corners where they were drawn.
    await pick(1); await add('Along Y'); await pick(1); await add('Length');
    await page.fill('aside[aria-label="3D sketch"] [aria-label="Constraint 5 value"]', '20'); await press('Enter');
    await pick(2); await add('Along X'); await pick(3); await add('Along Y');
    await page.waitForFunction(() => document.querySelector('.vp-overlay [aria-label="3D sketch"]')?.dataset.status === 'well', null, { timeout: 5000 });
    assert.match(await page.locator('[aria-label="Sketch status"]').innerText(), /Fully defined/);
    // A conflict: sides 0 and 1 made parallel — shown (the status, the mark in red), Apply refused; undone.
    await pick(0); await pick(1, true); await add('Parallel');
    await page.waitForFunction(() => document.querySelector('.vp-overlay [aria-label="3D sketch"]')?.dataset.status === 'conflict', null, { timeout: 5000 });
    assert.ok(await page.locator('.vp-overlay .skel-mark.bad').count() > 0, 'the unmet marks red');
    assert.ok(await page.locator('aside[aria-label="3D sketch"] button[aria-label="Apply 3D sketch"]').isDisabled());
    await snap('g17-conflict');
    await press('Meta+z');
    await page.waitForFunction(() => document.querySelector('.vp-overlay [aria-label="3D sketch"]')?.dataset.status === 'well', null, { timeout: 5000 });
    await snap('g17-well');
    await page.locator('aside[aria-label="3D sketch"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-skeleton.png`) });
    await page.click('aside[aria-label="3D sketch"] button[aria-label="Apply 3D sketch"]');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'skeleton', null, { timeout: 10000 });
    const node = await page.evaluate(() => window.__studioDoc.nodes.at(-1));
    const r6 = v => Math.round(v * 1e6) / 1e6;
    assert.deepEqual(node.points.map(p => p.map(r6)), [[0, 0, 0], [40, 0, 0], [40, 20, 0], [0, 20, 0]], `solved back to the 40 × 20 (${renderer})`);
    assert.deepEqual(node.segments, [[0, 1], [1, 2], [2, 3], [3, 0]]);
    assert.deepEqual(node.constraints.map(c => c.kind), ['fixed', 'along', 'length', 'along', 'length', 'along', 'along']);
    assert.equal(await page.locator('.vp-overlay [aria-label="Skeletons"] .skel-faint').count(), 4, 'drawn faint once applied');
    // A body corner snapped in 3D: the 40 × 20 × 8 plate, a new 3D sketch's first point on its top corner (40, 20, 8).
    const plate = join(out, 'g17-plate.bcad');
    (await import('node:fs')).writeFileSync(plate, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 8 }] }));
    await openModel(plate, 2); await idle(); await page.click('.views button:text-is("Iso")'); await page.waitForTimeout(400);
    await press(' '); await page.locator('.palette input').fill('3d sketch'); await press('Enter');
    await page.waitForSelector('aside[aria-label="3D sketch"]', { timeout: 5000 });
    { const q = await scr([40, 20, 8]); await page.mouse.move(q[0] + 4, q[1] + 3, { steps: 2 }); await page.mouse.click(q[0] + 4, q[1] + 3); }
    await press('Escape'); await page.waitForTimeout(100);
    const first = await page.evaluate(() => { const c = document.querySelector('.vp-overlay [aria-label="3D sketch"] circle[data-point="0"]'); return c && [+c.getAttribute('cx'), +c.getAttribute('cy')]; });
    const corner = await scr([40, 20, 8]);
    assert.ok(first && Math.hypot(first[0] + svg.x - corner[0], first[1] + svg.y - corner[1]) < 1, `on the corner ${JSON.stringify({ first, corner })}`);
    await snap('g17-corner');
    await page.click('aside[aria-label="3D sketch"] button[aria-label="Cancel 3D sketch"]');
    assert.equal(await page.evaluate(() => window.__studioDoc.nodes.length), 2, 'cancelled: nothing written');
  });

  // ---- O9: a late reply never overwrites a newer one ---------------------------------------------------------------------
  await check('O9: the section plane dragged fast across a plate — the exact section shown is the last plane\'s, and stays so (a late reply never overwrites it)', async () => {
    const fs = await import('node:fs'), plate = join(out, 'o9-plate.bcad');
    fs.writeFileSync(plate, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }] }));
    await openModel(plate, 2); await idle();
    // (Forty planes a frame apart, x from 2.85 to 36: each asks for an exact section; only the last may be shown.)
    await page.evaluate(() => new Promise(done => { let i = 0; const step = () => { ++i; window.__studioDragSection({ axis: 'x', at: 2 + 34 * i / 40, keep: 'positive' }, i >= 40); if (i < 40) requestAnimationFrame(step); else done(null); }; requestAnimationFrame(step); }));
    // (The last plane at x = 36 keeps 4 × 20 × 10 or 36 × 20 × 10, as 'positive' means; any earlier plane keeps neither.)
    const last = [4 * 20 * 10, 36 * 20 * 10], isLast = v => last.some(w => Math.abs(v - w) < 1e-3);
    await page.waitForFunction(([a, b]) => { const s = window.__studioSection(); return s?.exact && [a, b].some(w => Math.abs(s.volume - w) < 1e-3); }, last, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const s = await page.evaluate(() => window.__studioSection());
    assert.ok(s.exact && isLast(s.volume), `still the last plane's section: ${JSON.stringify({ volume: s.volume, planes: s.planes })}`);
    await page.evaluate(() => window.__studioSetSection(null));
  });

  // ---- G19.2: section modes — a box, several planes, a plane from a face -------------------------------------------------
  await check('G19.2: section modes — a box section (six planes, a face dragged), two planes (a quarter), a plane from a face; the exact section\'s volumes; GPU against CPU — on either renderer', async () => {
    const fs = await import('node:fs'), renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    const plate = join(out, 'g19-plate.bcad');
    fs.writeFileSync(plate, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }] }));
    await openModel(plate, 2); await idle(); await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(300);
    const sec = () => page.evaluate(() => window.__studioSection());
    const exactAt = (want, label) => page.waitForFunction(([w]) => { const s = window.__studioSection(); return s?.exact && Math.abs(s.volume - w) < 1e-3; }, [want], { timeout: 30000 }).catch(async e => { throw new Error(`${label}: ${JSON.stringify(await sec())} — ${e.message.split('\n')[0]}`); });
    // (Opened here: closed first should a step before have left it open.)
    if (await page.locator('[aria-label="Section mode"]').count()) await page.click('[aria-label="Section view"]');
    await page.click('[aria-label="Section view"]'); await page.waitForSelector('[aria-label="Section mode"]', { timeout: 5000 });
    // A box: six planes a tenth in from the plate's faces, the inside kept (32 × 16 × 8); a handle on each face.
    await page.click('[aria-label="Section mode"] button:text-is("Box")');
    await exactAt(32 * 16 * 8, 'the box section');
    let s = await sec();
    assert.equal(s.mode, 'box'); assert.equal(s.planes.length, 6);
    assert.equal(await page.locator('.vp-overlay [data-handle^="section"]').count(), 6, 'a handle on each face');
    if (renderer === 'webgpu') assert.equal(s.clip.planes.length, 6);
    const g2 = await sectionAgainstCpu('g19-box');
    if (g2) { console.log(`  G19 box section, GPU against CPU: ${JSON.stringify(g2)}`); assert.ok(g2.strong <= g2.pixels * 0.001, JSON.stringify(g2)); }
    await snap('g19-box');
    // The +X face's handle dragged back toward the middle: the box shorter along X, its volume with it.
    const svg = await page.locator('.vp-overlay').boundingBox();
    const [a, b] = await page.evaluate(() => { const l = document.querySelector('.vp-overlay [data-handle="section1"] line:nth-of-type(2)'); const g = n => Number(l.getAttribute(n)); return [[g('x1'), g('y1')], [g('x2'), g('y2')]]; });
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    await page.mouse.move(svg.x + m[0], svg.y + m[1]); await page.mouse.down();
    await page.mouse.move(svg.x + m[0] - (b[0] - a[0]) * 1.5, svg.y + m[1] - (b[1] - a[1]) * 1.5, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => -window.__studioSection().planes[1].offset < 35.9, null, { timeout: 5000 });
    const x1 = -(await sec()).planes[1].offset;
    await exactAt((x1 - 4) * 16 * 8, 'the dragged box');
    assert.ok(x1 > 4 && x1 < 36, `the +X face moved in to ${x1}`);
    // Two planes: y ≥ 10 and x ≥ 20 — a quarter of the plate.
    await page.click('[aria-label="Section mode"] button:text-is("Planes")');
    await exactAt(20 * 10 * 10, 'two planes');
    s = await sec(); assert.equal(s.mode, 'planes'); assert.equal(s.planes.length, 2);
    assert.ok(await page.locator('[aria-label="Section"] [aria-label="Sketch the section"]').isDisabled(), 'one plane only for a sketch');
    // Plane 2 from the top face (clicked where it is kept): z ≤ 5 kept with y ≥ 10 — 40 × 10 × 5.
    await page.click('[aria-label="Section plane 2 from a face"]');
    await page.waitForSelector('[aria-label="Section"] [role="status"]', { timeout: 3000 });
    const top = await page.evaluate(() => window.__studioScreenOf([30, 15, 10]));
    await page.mouse.click(top[0], top[1]);
    await exactAt(40 * 10 * 5, 'plane 2 from the top face');
    s = await sec();
    assert.deepEqual([s.planes[1].normal.map(v => v || 0), s.planes[1].offset, s.planes[1].face], [[0, 0, -1], -5, 'n1.top']);
    assert.match(await page.locator('[aria-label="Section plane 2 is"]').innerText(), /Z ≤ 5/);
    const g3 = await sectionAgainstCpu('g19-planes');
    if (g3) { console.log(`  G19 two planes, GPU against CPU: ${JSON.stringify(g3)}`); assert.ok(g3.strong <= g3.pixels * 0.001, JSON.stringify(g3)); }
    await snap('g19-planes');
    // Back to one plane: the first kept, a sketch possible again.
    await page.click('[aria-label="Section mode"] button:text-is("Plane")');
    await exactAt(40 * 10 * 10, 'one plane');
    assert.equal(await page.locator('[aria-label="Section"] [aria-label="Sketch the section"]').isDisabled(), false);
    await page.click('[aria-label="Section view"]');
  });

  // ---- G19.3: the hatch on the cut ----------------------------------------------------------------------------------------
  await check('G19.3: the hatch on the cut — on by default at the scene\'s spacing; lines on the exact section\'s cut face; the GPU caps\' hatch and the CPU\'s lines the same ink; off and on — on either renderer', async () => {
    const fs = await import('node:fs'), renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    const plate = join(out, 'g193-plate.bcad');
    fs.writeFileSync(plate, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }] }));
    await openModel(plate, 2); await idle(); await page.click('.views button:text-is("Front")'); await press('f'); await page.waitForTimeout(300);
    const sec = () => page.evaluate(() => window.__studioSection());
    if (await page.locator('[aria-label="Section mode"]').count()) await page.click('[aria-label="Section view"]');
    await page.click('[aria-label="Section view"]'); await page.waitForSelector('[aria-label="Hatch the cut"]', { timeout: 5000 });
    await page.waitForFunction(() => window.__studioSection()?.exact, null, { timeout: 30000 });
    // On by default; the plate's diagonal (45.8 mm) over 60, down to 0.5 mm.
    let s = await sec();
    assert.equal(await page.locator('[aria-label="Hatch the cut"]').getAttribute('aria-pressed'), 'true');
    assert.equal(s.hatch?.spacing, 0.5, JSON.stringify(s.hatch));
    // The exact section's cut face (40 × 10 on y = 10, the lines at 45° 0.5 apart): lines on it, on either renderer.
    assert.equal(s.hatch.lines?.length, 1, JSON.stringify(s.hatch)); assert.ok(s.hatch.lines[0].segments > 40, JSON.stringify(s.hatch));
    const shot = name => page.locator('canvas.vp-canvas').screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-g193-${name}.png`) });
    // The ink of the hatch: how much darker the frame is with it than without (sum over pixels of the luminance lost).
    const ink = (on, off) => page.evaluate(async ([a, b]) => {
      const load = async src => { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const A = await load(a), B = await load(b); let sum = 0, px = 0;
      for (let k = 0; k < A.length; k += 4) { const d = (B[k] + B[k + 1] + B[k + 2] - A[k] - A[k + 1] - A[k + 2]) / 3; if (d > 0) sum += d; if (Math.abs(d) > 8) px++; }
      return { ink: Math.round(sum), pixels: px };
    }, [on.toString('base64'), off.toString('base64')]);
    const toggle = async want => { await page.click('[aria-label="Hatch the cut"]'); await page.waitForFunction(w => !!window.__studioSection().hatch === w, want, { timeout: 5000 }); await page.waitForTimeout(400); };
    const pair = async name => { const on = await shot(name + '-on'); await toggle(false); const off = await shot(name + '-off'); await toggle(true); return ink(on, off); };
    const exact = await pair('exact');
    assert.ok(exact.ink > 0 && exact.pixels > 100, `the exact cut face's lines: ${JSON.stringify(exact)}`);
    const out193 = { renderer, spacing: s.hatch.spacing, exact };
    if (renderer === 'webgpu') {
      // While the plane moves (the exact section held back): the caps' hatch on the GPU, and the CPU's lines — the same ink.
      await page.evaluate(() => window.__studioSectionDebug({ hold: true, cpu: false })); await page.waitForTimeout(500);
      s = await sec(); assert.equal(s.clip?.hatch, 0.5, JSON.stringify(s.clip)); assert.equal(s.hatch.lines, null, 'no lines: the shader hatches');
      out193.gpu = await pair('gpu');
      await page.evaluate(() => window.__studioSectionDebug({ hold: true, cpu: true })); await page.waitForTimeout(500);
      s = await sec(); assert.equal(s.clip, null); assert.ok(s.hatch.lines?.[0]?.segments > 40, JSON.stringify(s.hatch));
      out193.cpu = await pair('cpu');
      await page.evaluate(() => window.__studioSectionDebug({ hold: false, cpu: false })); await page.waitForTimeout(300);
      assert.ok(out193.gpu.ink > 0 && Math.abs(out193.gpu.ink - out193.cpu.ink) <= 0.2 * out193.cpu.ink, `GPU hatch against the CPU's lines: ${JSON.stringify(out193)}`);
    } else {
      // (WebGL2: the planes cut on the CPU; while they move the clipped caps' lines.)
      await page.evaluate(() => window.__studioSectionDebug({ hold: true, cpu: false })); await page.waitForTimeout(500);
      s = await sec(); assert.equal(s.clip, null); assert.ok(s.hatch.lines?.[0]?.segments > 40, JSON.stringify(s.hatch));
      out193.cpu = await pair('cpu');
      await page.evaluate(() => window.__studioSectionDebug({ hold: false, cpu: false })); await page.waitForTimeout(300);
      assert.ok(out193.cpu.ink > 0, JSON.stringify(out193));
    }
    console.log(`  G19.3 hatch: ${JSON.stringify(out193)}`);
    // Off: no hatch, no lines, no shader hatch; on again.
    await toggle(false); s = await sec();
    assert.equal(s.hatch, null); if (s.clip) assert.equal(s.clip.hatch, null);
    await toggle(true); await snap('g193-hatch');
    await page.click('[aria-label="Section view"]');
  });

  // ---- G19.4: a section across a welded frame (FRk's gussets, end caps and beads) ------------------------------------------------
  await check('G19.4: a section across a welded frame — members, a gusset, an end cap and beads (FRk1/2) cut by the exact section at the clipped volume, each cut hatched, GPU against CPU — on either renderer', async () => {
    const renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    const { evaluateCadPart, exportStep, massPropertiesOf } = await import('../../../packages/barocss-cad/dist/index.js');
    const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, WIDE = { kind: 'rect-tube', width: 80, height: 80, wall: 4, outerRadius: 0 };
    const part = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
      { id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400], [0, 0, 800], [400, 0, 800]], segments: [[0, 1], [2, 3], [4, 5]], section: WIDE, overrides: [{ member: 1, section: SHARP }, { member: 2, section: WIDE }], corners: { tee: 'butt', default: 'butt' } },
      { id: 'w', kind: 'weld-bead', frame: 'f', on: { member: 1, end: 'end' }, leg: 3 },
      { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [150, 150], thickness: 8, clip: 12 },
      { id: 'gw', kind: 'weld-bead', frame: 'f', on: { gusset: 'g' }, leg: 4 },
      { id: 'c', kind: 'end-cap', frame: 'f', member: 0, end: 'start', fit: 'over', thickness: 4 }] });
    const file = join(out, 'g194-welded.step'); (await import('node:fs')).writeFileSync(file, exportStep(part.outputs.map(o => o.brep), { name: 'g194-welded' }));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.locator('input[aria-label="Model file"]').setInputFiles(file);
    await page.waitForFunction(() => /10 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    await page.click('.views button:text-is("Front")'); await press('f'); await page.waitForTimeout(300);
    const sec = () => page.evaluate(() => window.__studioSection());
    if (await page.locator('[aria-label="Section mode"]').count()) await page.click('[aria-label="Section view"]');
    // Across Y through the middle (the frame's plane, y = 0): every body cut in two, the +Y halves kept.
    await page.click('[aria-label="Section view"]'); await page.waitForSelector('[aria-label="Hatch the cut"]', { timeout: 5000 });
    await page.waitForFunction(() => window.__studioSection()?.exact, null, { timeout: 60000 }).catch(async e => { throw new Error(`the exact section: ${JSON.stringify(await sec())} — ${e.message.split('\n')[0]}`); });
    let s = await sec();
    const exact = s.volume, lines = s.hatch.lines;
    // The CPU's clipped meshes (the exact section held back): their volume the exact one's.
    await page.evaluate(() => window.__studioSectionDebug({ hold: true, cpu: true })); await page.waitForTimeout(500);
    s = await sec(); const clipped = s.shownVolume, cpuLines = s.hatch.lines;
    await page.evaluate(() => window.__studioSectionDebug({ hold: false, cpu: false })); await page.waitForTimeout(300);
    const total = part.outputs.reduce((v, o) => v + massPropertiesOf(o, 1).volume, 0);
    console.log(`  G19.4 welded frame: ${JSON.stringify({ renderer, total: Math.round(total), exact: Math.round(exact), clipped: Math.round(clipped), lines: lines.length, cpuLines: cpuLines.length })}`);
    assert.ok(Math.abs(exact - clipped) <= 1e-3 * total, `the exact section ${exact} against the clipped meshes ${clipped}`);
    assert.ok(exact > 0.3 * total && exact < 0.7 * total, `about half kept: ${exact} of ${total}`);
    // (The plane crosses six of the ten: the three members, the gusset, the end cap and the T's bead; the gusset's four
    // runs lie off it — two cut away, two wholly kept. At the frame's spacing, 10 mm, every cut of a spacing square or
    // more is hatched — the members', the gusset's, the cap's — and the bead's 9 mm² may get a line or none.)
    for (const [l, what] of [[lines, 'exact'], [cpuLines, 'clipped']]) assert.ok(l.length >= 5 && l.length <= 6, `${what}: the bodies hatched ${JSON.stringify(l)}`);
    const g = await sectionAgainstCpu('g194-frame');
    // (0.2 %, not the 0.1 % of the solid sections: the cut walls are long strips 3–4 mm wide, and a GPU cap's edge is
    // decided once a pixel — at its centre — where the CPU's cut face is antialiased sample by sample: the strips' edges,
    // two a strip, are where they differ.)
    if (g) { console.log(`  G19.4 welded frame, GPU against CPU: ${JSON.stringify(g)}`); assert.ok(g.strong <= g.pixels * 0.002, JSON.stringify(g)); }
    await snap('g194-frame');
    await page.click('[aria-label="Section view"]');
  });

  // ---- G19.5: the section in the Render workspace ------------------------------------------------------------------------
  await check('G19.5: the section in the Render workspace — the planes cut and cap the rendered bodies, the exported image cut, an animated body moved as itself with bodies left out and split', async () => {
    const fs = await import('node:fs'), renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    const { evaluateCadPart, exportStep } = await import('../../../packages/barocss-cad/dist/index.js');
    const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, WIDE = { kind: 'rect-tube', width: 80, height: 80, wall: 4, outerRadius: 0 };
    // (G19.4's welded frame: of its ten bodies the section across Y leaves two out and splits six — by index the bodies
    // after the first left out were others.)
    const part = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
      { id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400], [0, 0, 800], [400, 0, 800]], segments: [[0, 1], [2, 3], [4, 5]], section: WIDE, overrides: [{ member: 1, section: SHARP }, { member: 2, section: WIDE }], corners: { tee: 'butt', default: 'butt' } },
      { id: 'w', kind: 'weld-bead', frame: 'f', on: { member: 1, end: 'end' }, leg: 3 },
      { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [150, 150], thickness: 8, clip: 12 },
      { id: 'gw', kind: 'weld-bead', frame: 'f', on: { gusset: 'g' }, leg: 4 },
      { id: 'c', kind: 'end-cap', frame: 'f', member: 0, end: 'start', fit: 'over', thickness: 4 }] });
    const file = join(out, 'g195-welded.step'); fs.writeFileSync(file, exportStep(part.outputs.map(o => o.brep), { name: 'g195-welded' }));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.locator('input[aria-label="Model file"]').setInputFiles(file);
    await page.waitForFunction(() => /10 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 }); await idle();
    await page.click('.views button:text-is("Front")'); await press('f'); await page.waitForTimeout(300);
    if (await page.locator('[aria-label="Section mode"]').count()) await page.click('[aria-label="Section view"]');
    // The Render workspace; the last body (the end cap) animated 30 mm along X over two seconds.
    await page.click('button:text-is("Render")'); await page.waitForTimeout(500);
    await page.locator('.outliner .ol').nth(9).click();
    await page.fill('[aria-label="Time"]', '0'); await page.click('.timeline button:text-is("Set key")');
    await page.fill('[aria-label="Time"]', '2'); await page.fill('[aria-label="Offset X"]', '30'); await page.click('.timeline button:text-is("Set key")');
    const tracks = await page.evaluate(() => window.__studioDoc.render.animation.tracks), animated = Object.keys(tracks);
    assert.equal(animated.length, 1, JSON.stringify(tracks));
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const shot = name => page.locator('canvas.vp-canvas').screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-g195-${name}.png`) });
    const plain = await shot('whole');
    const before = await page.evaluate(() => window.__studioSection());
    assert.deepEqual(before.offsets?.map(o => o[0]), animated, 'without the section: on the body itself');
    const exported = async () => { if (renderer !== 'webgpu') return null; const d = page.waitForEvent('download'); await page.click('[aria-label="Export image"]'); return fs.readFileSync(await (await d).path()); };
    const imgWhole = await exported();
    // The section view, in the Render workspace.
    await page.click('[aria-label="Section view"]'); await page.waitForSelector('[aria-label="Hatch the cut"]', { timeout: 5000 });
    await page.waitForFunction(() => window.__studioSection()?.exact, null, { timeout: 60000 }); await page.waitForTimeout(500);
    const s = await page.evaluate(() => window.__studioSection());
    if (renderer === 'webgpu') assert.ok(s.clip && s.clip.planes.length === 1, JSON.stringify(s.clip));
    // The animated body's offset on the piece cut from it, nowhere else.
    console.log(`  G19.5 render: ${JSON.stringify({ renderer, offsets: s.offsets, sources: s.sources, animated })}`);
    assert.equal(s.offsets.length, 1, JSON.stringify(s.offsets));
    assert.deepEqual(s.offsets[0][1], [30, 0, 0]);
    assert.equal(s.sources[s.shownKeys.indexOf(s.offsets[0][0])], animated[0], `the offset on a piece of the animated body: ${JSON.stringify(s)}`);
    // The rendered frame cut open, and the exported image with it.
    const cut = await shot('section');
    const changed = await page.evaluate(async ([a, b]) => {
      const load = async src => { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const A = await load(a), B = await load(b); let n = 0;
      for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 24) n++;
      return n;
    }, [plain.toString('base64'), cut.toString('base64')]);
    assert.ok(changed > 2000, `the section changes the rendered frame: ${changed} pixels`);
    const imgCut = await exported();
    if (imgWhole) assert.ok(imgCut && !imgCut.equals(imgWhole), 'the exported image is cut');
    await snap('g195-render-section');
    await page.click('[aria-label="Section view"]');
    await page.click('button:text-is("Model")');
  });

  // ---- G20.2: the cut-out — a quarter and an octant taken out -----------------------------------------------------------
  await check('G20.2: the cut-out — the corner facing the camera taken out (a quarter, then an octant), one body for the part, the exact volumes, GPU against CPU — on either renderer', async () => {
    const fs = await import('node:fs'), renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    const plate = join(out, 'g20-plate.bcad');
    fs.writeFileSync(plate, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: {}, nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }] }));
    await openModel(plate, 2); await idle(); await page.click('.views button:text-is("Iso")'); await press('f'); await page.waitForTimeout(300);
    const sec = () => page.evaluate(() => window.__studioSection());
    const exactAt = (want, label) => page.waitForFunction(([w]) => { const s = window.__studioSection(); return s?.exact && Math.abs(s.volume - w) < 1e-3; }, [want], { timeout: 30000 }).catch(async e => { throw new Error(`${label}: ${JSON.stringify(await sec())} — ${e.message.split('\n')[0]}`); });
    if (await page.locator('[aria-label="Section mode"]').count()) await page.click('[aria-label="Section view"]');
    await page.click('[aria-label="Section view"]'); await page.waitForSelector('[aria-label="Section mode"]', { timeout: 5000 });
    // The Iso camera looks from +X, −Y, +Z: the corner x > 20, y < 10 taken out — 40·20·10 − 20·10·10.
    await page.click('[aria-label="Section mode"] button:text-is("Cut-out")');
    await exactAt(6000, 'the quarter');
    let s = await sec();
    assert.equal(s.mode, 'cutout'); assert.equal(s.planes.length, 2);
    assert.deepEqual(s.planes.map(p => [p.normal.map(v => v || 0), p.offset]), [[[-1, 0, 0], -20], [[0, 1, 0], 10]]);
    assert.equal(s.bodies, 1, 'one body for the part (its pieces merged)');
    assert.match(await page.locator('.corner-left').innerText(), /· 1 solid ·/);
    assert.equal(await page.locator('.vp-overlay [data-handle^="section"]').count(), 2, 'a handle on each plane');
    if (renderer === 'webgpu') assert.equal(s.clip.cutout, true);
    assert.ok(s.hatch?.lines?.length === 1 && s.hatch.lines[0].segments > 20, JSON.stringify(s.hatch));
    const g1 = await sectionAgainstCpu('g20-quarter');
    if (g1) { console.log(`  G20 quarter, GPU against CPU: ${JSON.stringify(g1)}`); assert.ok(g1.strong <= g1.pixels * 0.001, JSON.stringify(g1)); }
    await snap('g20-quarter');
    // An octant: the top too (z > 5) — 40·20·10 − 20·10·5.
    await page.click('[aria-label="Add a section plane"]');
    await exactAt(7000, 'the octant');
    s = await sec(); assert.equal(s.planes.length, 3); assert.equal(s.bodies, 1);
    assert.deepEqual(s.planes[2].normal.map(v => v || 0), [0, 0, -1]); assert.equal(s.planes[2].offset, -5);
    const g2 = await sectionAgainstCpu('g20-octant');
    if (g2) { console.log(`  G20 octant, GPU against CPU: ${JSON.stringify(g2)}`); assert.ok(g2.strong <= g2.pixels * 0.001, JSON.stringify(g2)); }
    await snap('g20-octant');
    // The third plane removed: the quarter again; then Planes mode — the first plane kept, a Y plane through the middle,
    // their intersection kept (x ≤ 20, y ≥ 10).
    await page.click('[aria-label="Remove section plane 3"]');
    await exactAt(6000, 'back to the quarter');
    await page.click('[aria-label="Section mode"] button:text-is("Planes")');
    await exactAt(20 * 10 * 10, 'Planes: the two intersected');
    await page.click('[aria-label="Section view"]');
  });

  // ---- K2 (FRk5, D175/D182): a notched tee in the app — shown, saved and reopened the same, on either renderer -----------------------
  await check('K2 FRk5 notches: a V-notched and a hole-saw-notched tee of Ø30 × 2 tubes — each body to its oracle (volume 1e-9 relative, centroid 1e-6 mm), the same after Save, New and Open; a V notch too deep refused with its reason', async () => {
    const fs = await import('node:fs'), renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    // (The kernel lane's conformance cases, as the studio's frame node: the same points, segments, section and corners.)
    const asStudio = (name) => {
      const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/frk', name), 'utf8')), f = c.input.partDocument.features[0];
      const node = { id: 'n0', kind: 'frame', points: f.points, segments: f.segments, section: f.section, up: f.up, corners: f.corners };
      return { c, file: join(out, name.replace('.json', '.bcad')), doc: { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [node], outputs: {}, nextId: 1 } };
    };
    const canvasShot = async () => (await page.locator('canvas.vp-canvas').screenshot()).toString('base64');
    /** The share of the canvas's pixels that differ (a summed channel difference over 48) between two shots, decoded in the page. */
    const differs = (a, b) => page.evaluate(async ([x, y]) => {
      const load = async src => { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const A = await load(x), B = await load(y); let n = 0;
      for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 48) n++;
      return n / (A.length / 4);
    }, [a, b]);
    const shown = () => page.waitForFunction(() => { const b = window.__studioBodies?.(); return b?.fresh && b.bodies.length > 0 && b.bodies.every(x => x.volume !== null); }, null, { timeout: 120000 }).then(() => page.evaluate(() => window.__studioBodies().bodies));
    const matches = (bodies, expect, label) => {
      assert.equal(bodies.length, expect.outputs.length, `${label}: ${bodies.length} bodies`);
      // (Each expected output found among the bodies by its volume, then its centroid checked.)
      for (const o of expect.outputs) {
        const b = bodies.find(x => Math.abs(x.volume - o.volumeMM3.value) <= o.volumeMM3.relTol * o.volumeMM3.value);
        assert.ok(b, `${label}: no body of ${o.volumeMM3.value} mm³ in ${JSON.stringify(bodies.map(x => x.volume))}`);
        assert.ok(b.centroid && b.centroid.every((v, k) => Math.abs(v - o.centroidMM.value[k]) <= Math.max(o.centroidMM.absTol, 1e-6)), `${label}: centroid ${JSON.stringify(b.centroid)} vs ${JSON.stringify(o.centroidMM.value)}`);
      }
    };
    for (const name of ['notch-v-tee.json', 'notch-holesaw-tee.json']) {
      const { c, file, doc } = asStudio(name);
      fs.writeFileSync(file, JSON.stringify(doc));
      await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
      await iso(); const empty = await canvasShot();
      await page.setInputFiles('input[aria-label="Model file"]', file);
      const first = await shown(); matches(first, c.expect, `${name} opened (${renderer})`);
      assert.equal(await page.locator('.vp-error').count(), 0, await page.locator('.vp-error').allInnerTexts().then(x => x.join(' | ')));
      // (A drawn frame: the canvas is not one flat colour — Codex saw a black first WebGPU canvas with real geometry, D175.)
      await iso();
      // (Against the same viewport with nothing in it: the tee must change a visible share of it — not black, not empty.)
      const share = await differs(empty, await canvasShot());
      assert.ok(share > 0.005, `${name}: the canvas looks blank on ${renderer} (${(100 * share).toFixed(2)} % of pixels differ from the empty view)`);
      await snap(`k2-${name.replace('.json', '')}`);
      // (Saved with the studio's own Save, a new part, the download opened: the same bodies.)
      const [saved] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[aria-label="Save"]')]);
      const again = join(out, `saved-${name.replace('.json', '.bcad')}`); fs.writeFileSync(again, fs.readFileSync(await saved.path()));
      await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
      await page.setInputFiles('input[aria-label="Model file"]', again);
      matches(await shown(), c.expect, `${name} reopened (${renderer})`);
    }
    // (Too deep: the kernel's refusal said, no body made.)
    const { c, file, doc } = asStudio('refuse-notch-v-depth.json');
    fs.writeFileSync(file, JSON.stringify(doc));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.setInputFiles('input[aria-label="Model file"]', file);
    const reason = /v depth must be under the branch width and length/;
    // (The kernel's reason sits in the toast's Details, closed: textContent reads it, innerText would not.)
    await page.waitForFunction(r => [...document.querySelectorAll('.toast')].some(t => new RegExp(r).test(t.textContent ?? '')), reason.source, { timeout: 60000 });
    assert.ok(JSON.stringify(c).includes('NOTCH_CUTTER'));
    assert.equal((await page.evaluate(() => window.__studioBodies().bodies)).length, 0, 'no body from a refused notch');
    await snap('k2-refuse-notch-v-depth');
  });

  // ---- K2 (FRk5, D175): the L gap frame Codex saw black on WebGPU's first canvas — drawn, on either renderer ------------------
  await check('K2 FRk5 L gap: a mitred L of 40 × 40 × 3 tubes with a 2 mm joint gap — two bodies, the first canvas after they arrive drawn (not black), and after Iso; the gap kept after Save, New and Open', async () => {
    const fs = await import('node:fs'), renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, outputs: {}, nextId: 1, nodes: [{ id: 'n0', kind: 'frame', points: [[0, 0, 0], [400, 0, 0], [400, 300, 0]], segments: [[0, 1], [1, 2]], section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre', gap: 2 } }] };
    const file = join(out, 'k2-l-gap.bcad'); fs.writeFileSync(file, JSON.stringify(doc));
    const shot = async () => (await page.locator('canvas.vp-canvas').screenshot()).toString('base64');
    const differs = (a, b) => page.evaluate(async ([x, y]) => {
      const load = async src => { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const A = await load(x), B = await load(y); let n = 0, dark = 0;
      for (let k = 0; k < A.length; k += 4) { if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 48) n++; if (B[k] + B[k + 1] + B[k + 2] < 12) dark++; }
      return { changed: n / (A.length / 4), black: dark / (A.length / 4) };
    }, [a, b]);
    const bodies = () => page.waitForFunction(() => { const b = window.__studioBodies?.(); return b?.fresh && b.bodies.length === 2 && b.bodies.every(x => x.volume > 0); }, null, { timeout: 120000 }).then(() => page.evaluate(() => window.__studioBodies().bodies));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await press('f'); await page.waitForTimeout(300); const empty = await shot();
    await page.setInputFiles('input[aria-label="Model file"]', file);
    const first = await bodies();
    // (The first frame with the bodies: not black, and changed from the empty view.)
    await page.waitForTimeout(250); const firstShot = await differs(empty, await shot());
    console.log(`  K2 L gap (${renderer}): first frame ${(100 * firstShot.changed).toFixed(2)} % changed, ${(100 * firstShot.black).toFixed(2)} % black`);
    assert.ok(firstShot.black < 0.5, `${renderer}: the first canvas is black (${(100 * firstShot.black).toFixed(1)} %)`);
    await iso(); const after = await differs(empty, await shot());
    assert.ok(after.changed > 0.005 && after.black < 0.5, `${renderer}: the L is not drawn after Iso (${JSON.stringify(after)})`);
    await snap('k2-l-gap');
    // (A mitred L with a 2 mm gap: the two members' volumes equal, each less than an ungapped mitre's by its share of the gap.)
    assert.ok(Math.abs(first[0].volume - first[1].volume) / first[0].volume < 0.4, JSON.stringify(first));
    const [saved] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[aria-label="Save"]')]);
    const again = join(out, 'saved-k2-l-gap.bcad'); fs.writeFileSync(again, fs.readFileSync(await saved.path()));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.setInputFiles('input[aria-label="Model file"]', again);
    const reopened = await bodies();
    for (const b of first) assert.ok(reopened.some(r => Math.abs(r.volume - b.volume) <= 1e-9 * b.volume), `reopened: ${JSON.stringify(reopened)} vs ${JSON.stringify(first)}`);
  });

  // ---- G21 rest (roadmap G3): every display mode drawn, picks unchanged, isolate — on either renderer ------------------------
  await check('G3 display modes: a plate and two placed pins — each CAD display mode drawn and the same pick on the plate\'s top face; isolate fades the plate, restore brings it back', async () => {
    const fs = await import('node:fs'), renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    const empty = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, outputs: {} };
    const pin = { ...empty, nodes: [{ id: 'n0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 }, { id: 'n1', kind: 'extrude', sketch: 0, height: 20 }], nextId: 2 };
    const doc = { ...empty, nextId: 2, nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [64, 32] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 8 }],
      instances: [{ id: 'p1', name: 'Pin A', doc: pin, position: [8, 8, 8], rotation: [0, 0, 0] }, { id: 'p2', name: 'Pin B', doc: pin, position: [56, 24, 8], rotation: [0, 0, 0] }] };
    const file = join(out, 'g3-display.bcad'); fs.writeFileSync(file, JSON.stringify(doc));
    const shot = async () => (await page.locator('canvas.vp-canvas').screenshot()).toString('base64');
    const differs = (a, b) => page.evaluate(async ([x, y]) => {
      const load = async src => { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const A = await load(x), B = await load(y); let n = 0;
      for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 48) n++;
      return n / (A.length / 4);
    }, [a, b]);
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    // (Framed by the Frame-all button: a key could start a command on what is selected.)
    const frame = async () => { await page.click('.views button:text-is("Top")'); await page.click('.views button[title="Frame all (F)"]'); await page.waitForTimeout(400); };
    await frame(); const blank = await shot();
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => /Parts placed/.test(document.querySelector('.outliner')?.textContent ?? '') && window.__studioFresh === true, null, { timeout: 60000 }); await idle();
    await snap('g3-opened');
    // (An edit the opened document starts — its last feature's HUD — is cancelled: display modes wait while one is open.)
    for (let k = 0; k < 3 && await page.locator('.hud button:text-is("Cancel")').count(); k++) { await page.locator('.hud button:text-is("Cancel")').click(); await page.waitForTimeout(200); }
    await frame(); await snap('g3-framed');
    await page.waitForFunction(() => !document.querySelector('select[aria-label="CAD display mode"]')?.disabled, null, { timeout: 5000 }).catch(() => {});
    const display = page.locator('[aria-label="Display and previews"]');
    if (await display.getAttribute('aria-expanded') !== 'true') await display.click();
    // (A point of the plate's top away from its centre, where the feature's handle stands: the world point (16, 16, 8) on
    // screen, so the pick holds however wide the centre column is — G12b's dock narrows it.)
    const [cx, cy] = await page.evaluate(() => window.__studioScreenOf([16, 16, 8]));
    // (Off the parts, as a world point too: the canvas's corner is the chat strip's button since G12a.)
    const off = await page.evaluate(() => window.__studioScreenOf([-30, -30, 0]));
    const modes = await page.locator('select[aria-label="CAD display mode"] option').evaluateAll(os => os.map(o => o.value));
    assert.ok(modes.length >= 5, modes.join(','));
    const picks = [];
    for (const mode of modes) {
      await page.selectOption('select[aria-label="CAD display mode"]', mode);
      await page.waitForFunction(m => document.querySelector('select[aria-label="CAD display mode"]')?.dataset.displayModeEffective === m, mode, { timeout: 10000 });
      await page.waitForTimeout(300);
      const share = await differs(blank, await shot());
      assert.ok(share > 0.005, `${mode} on ${renderer}: nothing drawn (${(100 * share).toFixed(2)} %)`);
      await snap(`g3-${mode}`);
      // (A click off the parts clears the selection; then the canvas centre: the plate's top, in every mode.)
      await page.mouse.click(...off); await page.waitForTimeout(150);
      await page.mouse.click(cx, cy); await page.waitForTimeout(250);
      picks.push(JSON.stringify(await page.evaluate(() => window.__studioSelection.selection.faces)));
    }
    console.log(`  G3 (${renderer}): modes ${modes.join(', ')}; centre picks ${[...new Set(picks)].join(' | ')}`);
    assert.equal(new Set(picks).size, 1, `${renderer}: the centre pick changed with the mode: ${picks.join(' | ')}`);
    assert.notEqual(picks[0], '[]', 'the centre pick found the plate');
    await page.selectOption('select[aria-label="CAD display mode"]', 'shaded-with-edges');
    // (Isolate: a pin selected, the plate fades; Restore view brings it back as it was.)
    // (The pin selected first: the shot to come back to is the selected view.)
    await page.mouse.click(...off);
    await page.locator('.ol.instance').first().click(); await page.waitForTimeout(300);
    const before = await shot();
    await page.click('[aria-label="Isolate selection"]');
    await page.waitForSelector('[aria-label="Restore view"][aria-pressed="true"]', { timeout: 5000 }); await page.waitForTimeout(300);
    const faded = await differs(before, await shot());
    assert.ok(faded > 0.005, `${renderer}: isolate changed nothing (${(100 * faded).toFixed(2)} %)`);
    await snap('g3-isolate');
    await page.click('[aria-label="Restore view"]'); await page.waitForSelector('[aria-label="Isolate selection"]', { timeout: 5000 }); await page.waitForTimeout(300);
    const back = await differs(before, await shot());
    assert.ok(back < 0.002, `${renderer}: restore left ${(100 * back).toFixed(2)} % changed`);
    await display.click();
  });

  // ---- G24 (roadmap G5): the drawing's annotations on the model — shown, picked, and the same after Save, New and Open ---------
  await check('G24 3D annotations: the r14 geometric plate\'s drawing on the model — its annotations drawn, a text clicked picks its annotation and selects its targets, the same annotations after Save, New and Open', async () => {
    const fs = await import('node:fs'), renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/r14/tol-plate-geometric/case.json'), 'utf8'));
    const file = join(out, 'g24-plate.bcad'); fs.writeFileSync(file, JSON.stringify({ ...c.input.document, drawing: { ...c.input.drawing, sheet: 'A3' } }));
    const shot = async () => (await page.locator('canvas.vp-canvas').screenshot()).toString('base64');
    const differs = (a, b) => page.evaluate(async ([x, y]) => {
      const load = async src => { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); const k = new OffscreenCanvas(img.width, img.height), g = k.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const A = await load(x), B = await load(y); let n = 0;
      for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 48) n++;
      return n / (A.length / 4);
    }, [a, b]);
    const pmi = () => page.evaluate(() => window.__studioPmi?.());
    const ready = () => page.waitForFunction(() => { const p = window.__studioPmi?.(); return p && !p.reason && !p.busy && p.items?.length > 0; }, null, { timeout: 120000 }).then(pmi);
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioFresh === true && window.__studioDoc.nodes.length > 0, null, { timeout: 60000 }); await idle();
    for (let k = 0; k < 3 && await page.locator('.hud button:text-is("Cancel")').count(); k++) await page.locator('.hud button:text-is("Cancel")').click();
    await page.click('.views button:text-is("Front")'); await page.click('.views button[title="Frame all (F)"]'); await page.waitForTimeout(400);
    const display = page.locator('[aria-label="Display and previews"]');
    if (await display.getAttribute('aria-expanded') !== 'true') await display.click();
    const before = await shot();
    await page.check('input[aria-label="3D annotations"]');
    const shown = await ready();
    await page.waitForTimeout(400);
    const changed = await differs(before, await shot());
    console.log(`  G24 (${renderer}): ${shown.items.length} annotations (${[...new Set(shown.items.map(a => a.kind))].join(', ')}), ${shown.left.length} sheet-only; ${(100 * changed).toFixed(2)} % of the canvas changed`);
    assert.ok(changed > 0.002, `${renderer}: the annotations changed ${(100 * changed).toFixed(3)} % of the canvas`);
    const texts = renderer === 'webgpu' ? await page.evaluate(() => (window.__studioOverlayTexts?.()['pmi:text'] ?? []).length) : await page.locator('.vp-overlay.pmi text').count();
    assert.ok(texts > 0, `${renderer}: no annotation texts drawn`);
    await snap('g24-shown');
    // (A click on an annotation's first text — its baseline point on screen — picks it, and selects what it points at.)
    const target = shown.items.find(a => a.targets.some(t => t.edge)) ?? shown.items[0];
    const at = await page.evaluate(p => window.__studioScreenOf?.(p), target.anchor);
    assert.ok(at, 'the anchor projects onto the screen');
    await page.mouse.click(at[0], at[1]); await page.waitForTimeout(300);
    const picked = await pmi();
    assert.ok(picked.selected, `${renderer}: the click picked no annotation`);
    const sel = await page.evaluate(() => window.__studioSelection.selection);
    assert.ok(sel.edges.length + sel.faces.length > 0, `${renderer}: the pick selected none of its targets`);
    await snap('g24-picked');
    // (Saved, a new part, the download opened: the same annotations — nothing of the display is stored, the drawing is.)
    const [saved] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[aria-label="Save"]')]);
    const again = join(out, 'saved-g24-plate.bcad'); fs.writeFileSync(again, fs.readFileSync(await saved.path()));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await page.setInputFiles('input[aria-label="Model file"]', again);
    const reopened = await ready();
    assert.deepEqual(reopened.items.map(a => [a.id, a.text.join(' ')]), shown.items.map(a => [a.id, a.text.join(' ')]));
    await page.uncheck('input[aria-label="3D annotations"]'); await display.click();
  });

  // ---- G23 CNC (G-R3–G-R5): material removal along the Model's program, on either renderer --------------------------------
  await check('G23 CNC: CNC8\'s pocket from its machining stock — NOT FOR PRODUCTION first; 0, the middle and the end of its program; no overcut, the floor reached; Print layers closes it; reopened, the same', async () => {
    // (The plate and pocket the Model's own commands make, with a stock row the fixture writes: not agent-loaded rows.)
    await openModel(join(root, 'test/fixtures/cnc8-pocket.bcad'), 5, 60000); await idle();
    const cam = () => page.evaluate(() => { const c = window.__studioCam?.(), d = c?.display; return c && { stage: c.stage, error: c.error, reason: c.reason, progress: d?.progress, moves: d?.setup.moves.length, removed: d?.removal.removedMM3, overcut: d?.removal.overcutCells, unc: d?.removal.lateralUncertaintyMM, top: d && 'max' in d.package.stock ? d.package.stock.max[2] : null, banner: d?.package.banner }; });
    const at = (p) => page.waitForFunction(q => { const c = window.__studioCam?.(); return c?.stage === 'ready' && (q === 'end' ? c.display.progress === c.display.setup.moves.length : Math.abs(c.display.progress - q) < 1e-9); }, p, { timeout: 60000 }).then(cam);
    const progressTo = (v) => page.locator('[aria-label="CNC progress"]').evaluate((el, x) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    // (The previews' toggles are in the Display popover over the Views row.)
    const display = page.locator('[aria-label="Display and previews"]');
    if (await display.getAttribute('aria-expanded') !== 'true') await display.click();
    await preview('CNC');
    const start = await at(0);
    assert.equal(start.removed, 0, JSON.stringify(start)); assert.equal(start.overcut, 0); assert.match(start.banner, /NOT FOR PRODUCTION/);
    assert.match(await page.locator('.card[aria-label="CNC preview"]').innerText(), /NOT FOR PRODUCTION/);
    await page.click('[aria-label="CNC progress to the end"]');
    const end = await at('end');
    // (The pocket's 1500 mm² less its four corners a flat Ø6 cannot reach and the field's stated band, cut from the stock's top to the floor.)
    const area = end.removed / (end.top - 12), corners = 4 * (1 - Math.PI / 4) * 9;
    assert.ok(area <= 1500 + 1e-6 && area >= 1500 - corners - 160 * end.unc, JSON.stringify({ area, ...end }));
    assert.equal(end.overcut, 0, `the program enters the part: ${JSON.stringify(end)}`);
    const mid = Math.round(end.moves / 2);
    await progressTo(mid); const half = await at(mid);
    assert.ok(half.removed > 0 && half.removed < end.removed, JSON.stringify({ half, end }));
    assert.equal(await page.locator('.vp-error').count(), 0, await page.locator('.vp-error').allInnerTexts().then(x => x.join(' | ')));
    await iso(); await snap('g23-cnc-middle');
    // (One preview at a time, G12c: Print layers chosen, the CNC preview closes — its panel gone, nothing shown; chosen
    // again, the same end.)
    await preview('Print');
    await page.waitForFunction(() => !window.__studioCam?.().display && !document.querySelector('.card[aria-label="CNC preview"]'), null, { timeout: 15000 });
    await preview('CNC');
    await page.click('[aria-label="CNC progress to the end"]');
    assert.equal((await at('end')).removed, end.removed, 'the same end after the preview closed and came back');
    // (Reopened from the file: the same program and the same removal — nothing of the preview is stored.)
    await openModel(join(root, 'test/fixtures/cnc8-pocket.bcad'), 5, 60000); await idle();
    await page.click('[aria-label="CNC progress to the end"]');
    assert.equal((await at('end')).removed, end.removed, 'reopened: the same removal');
    await snap('g23-cnc-end');
    await preview('None');
    await page.waitForFunction(() => !window.__studioCam?.().display, null, { timeout: 15000 });
    await display.click();
  });

  // ---- G22 / G23 (roadmap G4): the clearance map and print layers on screen, on either renderer, the same after Save and Open ----
  const canvasShot = async () => (await page.locator('canvas.vp-canvas').screenshot()).toString('base64');
  const canvasDiffers = (a, b) => page.evaluate(async ([x, y]) => {
    const load = async src => { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); const k = new OffscreenCanvas(img.width, img.height), g = k.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
    const A = await load(x), B = await load(y); let n = 0;
    for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 48) n++;
    return n / (A.length / 4);
  }, [a, b]);
  const saveAndReopen = async (name, nodes) => {
    const fs = await import('node:fs');
    const [saved] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[aria-label="Save"]')]);
    const file = join(out, name); fs.writeFileSync(file, fs.readFileSync(await saved.path()));
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0, null, { timeout: 15000 });
    await openModel(file, nodes, 60000); await idle();
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  };

  await check('G22 clearance: a shaft and its key (designed) and four pairs of boxes — in contact at once, then touching and overlap; near; clear; drawn on the model and gone when closed; Print layers refuses the assembly; the same after Save, New and Open', async () => {
    // (The fixture: the default shaft and a key in its keyseat at the root, and 20 × 20 × 10 boxes placed side by side
    // (touching), 10 mm into each other (overlap), 0.5 mm apart (near) and 0.8 mm off in x and y (clear: 1.13 mm > 1).)
    const renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    await openModel(join(root, 'test/fixtures/clearance-states.bcad'), 2, 60000); await idle(); await iso();
    const display = page.locator('[aria-label="Display and previews"]');
    if (await display.getAttribute('aria-expanded') !== 'true') await display.click();
    const clearance = () => page.evaluate(() => { const d = window.__studioClearance?.(); return d && { request: d.request, stage: d.stage, error: d.error, pairs: d.pairs.map(p => [p.a, p.b, p.state, p.designed ?? '']), overlays: [...new Set(d.overlays.map(o => o.state))].sort() }; });
    const ready = (after = 0) => page.waitForFunction(n => { const d = window.__studioClearance?.(); return d && d.request > n && (d.stage === 'ready' || d.stage === 'error'); }, after, { timeout: 120000 }).then(clearance);
    const want = [['b0', 'b1', 'designed', 'key n1 in its keyseat'], ['i1/b1', 'i2/b1', 'touching', ''], ['i3/b1', 'i4/b1', 'overlap', ''], ['i5/b1', 'i6/b1', 'near', ''], ['i7/b1', 'i8/b1', 'clear', '']];
    const before = await canvasShot();
    await page.evaluate(() => { window.__studioClearanceLog = []; });
    await preview('Clearance');
    const shown = await ready();
    assert.equal(shown.error, undefined, shown.error);
    assert.deepEqual(shown.pairs, want);
    // (In contact at once — the map before the overlaps are worked out — then touching (0 mm³) and overlap (2000 mm³).)
    const log = await page.evaluate(n => window.__studioClearanceLog.filter(e => e.request === n), shown.request);
    assert.deepEqual(log.find(e => e.stage === 'map')?.states, ['designed', 'contact', 'contact', 'near', 'clear'], JSON.stringify(log));
    assert.deepEqual(await page.locator('li[data-clearance-state]').evaluateAll(l => l.map(x => x.dataset.clearanceState)), ['designed', 'touching', 'overlap', 'near', 'clear']);
    // (Drawn: the bands of the four pairs within near and the overlap's volume; nothing for the clear pair.)
    assert.deepEqual(shown.overlays, ['designed', 'near', 'overlap', 'touching']);
    await page.waitForTimeout(400);
    const changed = await canvasDiffers(before, await canvasShot());
    console.log(`  G22 (${renderer}): ${shown.pairs.map(p => p[2]).join(', ')}; ${(100 * changed).toFixed(2)} % of the canvas changed`);
    // (The overlays alone: 0.09 % here. Before G12c the panel grew over the canvas in the Display popover and the shot, taken
    // of the screen's region, counted it — the 2 % then was mostly the panel.)
    assert.ok(changed > 0.0005, `${renderer}: the clearance map changed ${(100 * changed).toFixed(3)} % of the canvas`);
    await snap('g22-clearance');
    // (One preview at a time, G12c: Print layers chosen, the clearance map closes — and the assembly is refused there;
    // clearance chosen again, the same pairs.)
    await preview('Print');
    await page.waitForFunction(() => /Placed assemblies are not supported/.test(window.__studioPrint?.().reason ?? '') && !window.__studioClearance?.(), null, { timeout: 15000 });
    assert.equal(await page.locator('.card[aria-label="Assembly clearance"]').count(), 0);
    await preview('Clearance');
    const back = await ready(shown.request);
    assert.deepEqual(back.pairs, want);
    // (Closed: the model as it was.)
    await preview('None');
    await page.waitForFunction(() => !window.__studioClearance?.(), null, { timeout: 15000 }); await page.waitForTimeout(400);
    const gone = await canvasDiffers(before, await canvasShot());
    assert.ok(gone < 0.002, `${renderer}: closed, ${(100 * gone).toFixed(3)} % still changed`);
    // (Saved, a new part, the download opened: the same pairs — nothing of the map is stored, the instances are.)
    await preview('Clearance');
    const last = (await ready(back.request)).request;
    await saveAndReopen('saved-g22-clearance.bcad', 2);
    const reopened = await ready(last);
    assert.deepEqual([reopened.pairs, reopened.overlays], [want, shown.overlays]);
    await preview('None'); await display.click();
  });

  await check('G23 print layers: CNC8\'s plate sliced — its layers drawn, the height set and the layer moved changing the view, printed-up-to off; the settings saved, the same layer after Save, New and Open', async () => {
    const renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    await openModel(join(root, 'test/fixtures/cnc8-pocket.bcad'), 5, 60000); await idle(); await iso();
    const display = page.locator('[aria-label="Display and previews"]');
    if (await display.getAttribute('aria-expanded') !== 'true') await display.click();
    const print = () => page.evaluate(() => { const p = window.__studioPrint?.(), d = p?.display; return p && { reason: p.reason, stage: p.stage, count: d?.summary.count, k: d?.layer.k, z: d?.layer.z, top: d?.top, printed: d?.printed, supports: d?.supports }; });
    const at = (q) => page.waitForFunction(([k, n]) => { const p = window.__studioPrint?.(), d = p?.display; return !p?.reason && p?.stage === 'ready' && d?.layer.k === k && (n === null || d.summary.count === n); }, q, { timeout: 60000 }).then(print);
    const rangeTo = (v) => page.locator('[aria-label="Print layer"]').evaluate((el, x) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    const before = await canvasShot();
    await preview('Print');
    const first = await at([0, null]);
    assert.ok(first.count > 1 && first.printed && first.supports, JSON.stringify(first));
    await page.waitForTimeout(400);
    const bottom = await canvasShot(), changed = await canvasDiffers(before, bottom);
    assert.ok(changed > 0.002, `${renderer}: print layers changed ${(100 * changed).toFixed(3)} % of the canvas`);
    // (The height set to 0.5 mm: fewer layers; the layer moved to the middle: another view.)
    await page.check('input[aria-label="Set layer height"]');
    await page.locator('input[aria-label="Print layer height (mm)"]').fill('0.5');
    const coarse = await page.waitForFunction(n => { const d = window.__studioPrint?.()?.display; return d && d.summary.count < n; }, first.count, { timeout: 60000 }).then(print);
    const mid = Math.floor(coarse.count / 2);
    await rangeTo(mid);
    const middle = await at([mid, coarse.count]);
    assert.ok(middle.z > 0 && middle.z < middle.top, JSON.stringify(middle));
    await page.waitForTimeout(400);
    const moved = await canvasDiffers(bottom, await canvasShot());
    console.log(`  G23 print (${renderer}): ${first.count} layers at 0.2 mm, ${coarse.count} at 0.5 mm; layer ${mid + 1} at ${middle.z.toFixed(3)} mm; ${(100 * changed).toFixed(2)} % changed shown, ${(100 * moved).toFixed(2)} % moved`);
    assert.ok(moved > 0.002, `${renderer}: the layer moved changed ${(100 * moved).toFixed(3)} % of the canvas`);
    await page.uncheck('input[aria-label="Printed up to layer"]');
    await page.waitForFunction(() => window.__studioPrint?.()?.display?.printed === false, null, { timeout: 30000 });
    await snap('g23-print-middle');
    // (Saved: the layer settings are the document's; a new part, the download opened: the same layer, the same height.)
    const saved = await saveAndReopen('saved-g23-print.bcad', 5);
    assert.deepEqual([saved.printPreview?.layer, saved.printPreview?.layerHeight, saved.printPreview?.printed], [mid, 0.5, false], JSON.stringify(saved.printPreview));
    const reopened = await at([mid, coarse.count]);
    assert.deepEqual([reopened.z, reopened.top, reopened.printed], [middle.z, middle.top, false]);
    await preview('None');
    await page.waitForFunction(() => !window.__studioPrint?.()?.display, null, { timeout: 15000 });
    await display.click();
  });

  // ---- O10 (GPU part): each body's frame cost by display mode, read from the renderer — the same shape on either ----------
  await check('O10 frame costs: the clearance fixture\'s 10 bodies (8 placed copies) in each display mode — each copy its own draws, x-ray see-through, dashed hidden lines, shares of the primitives; off, nothing more counted', async () => {
    const renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    await openModel(join(root, 'test/fixtures/clearance-states.bcad'), 2, 60000); await idle(); await iso();
    await page.waitForFunction(() => !document.querySelector('select[aria-label="CAD display mode"]')?.disabled, null, { timeout: 5000 }).catch(() => {});
    const display = page.locator('[aria-label="Display and previews"]');
    if (await display.getAttribute('aria-expanded') !== 'true') await display.click();
    const modes = await page.locator('select[aria-label="CAD display mode"] option').evaluateAll(os => os.map(o => o.value));
    await page.evaluate(() => window.__studioFrameCost(true));
    const costs = {};
    for (const mode of modes) {
      await page.selectOption('select[aria-label="CAD display mode"]', mode);
      await page.waitForFunction(m => document.querySelector('select[aria-label="CAD display mode"]')?.dataset.displayModeEffective === m, mode, { timeout: 10000 });
      await page.waitForFunction(m => (window.__studioFrameCost()[m]?.bodies.length ?? 0) >= 10, mode, { timeout: 15000 });
      await page.waitForTimeout(300);
      costs[mode] = await page.evaluate(m => window.__studioFrameCost()[m], mode);
    }
    const by = (mode, key) => costs[mode].bodies.find(b => b.key === key);
    const sum = (b, ...ps) => ps.reduce((n, p) => n + b.passes[p], 0);
    for (const mode of modes) {
      const c = costs[mode], keys = c.bodies.map(b => b.key).sort();
      console.log(`  O10 (${renderer}) ${mode}: ${c.bodies.length} bodies, ${c.bodies.reduce((n, b) => n + b.draws, 0)} body draws, ${c.bodies.reduce((n, b) => n + b.triangles, 0)} triangles, ${c.bodies.reduce((n, b) => n + b.lines, 0)} lines; scene ${c.scene.draws} draws; ${c.cpuTime.toFixed(2)} ms CPU; b0 ${JSON.stringify(by(mode, 'b0').passes)}`);
      assert.deepEqual([c.renderer, c.mode], [renderer, mode], JSON.stringify([c.renderer, c.mode]));
      // (A copy's key is its instance's id and its body's key as the studio evaluates the instance's part.)
      assert.deepEqual(keys.map(k => k.split('/')[0]), ['b0', 'b1', ...[1, 2, 3, 4, 5, 6, 7, 8].map(i => `i${i}`)], keys.join(','));
      assert.equal(new Set(keys.filter(k => k.includes('/')).map(k => k.split('/')[1])).size, 1, keys.join(','));
      // (Each copy counts its own draw and primitives, through one shared geometry or not: the eight boxes the same.)
      const copies = c.bodies.filter(b => b.key.startsWith('i'));
      assert.ok(copies.every(b => b.draws > 0 && b.triangles === copies[0].triangles && b.lines === copies[0].lines), `${mode}: ${JSON.stringify(copies.map(b => [b.key, b.draws, b.triangles, b.lines]))}`);
      const shares = c.bodies.reduce((n, b) => n + b.share, 0);
      assert.ok(shares > 0 && shares <= 1 + 1e-9 && c.bodies.every(b => b.share > 0), `${mode}: shares ${shares}`);
    }
    // (X-ray: the surfaces see-through too — more see-through draws than shaded, whose faint lines are already so on
    // WebGPU. Dashed: the hidden lines drawn again; shaded: not.)
    const copy1 = costs[modes[0]].bodies.find(b => b.key.startsWith('i1/')).key;
    for (const key of ['b0', copy1]) {
      assert.ok(sum(by('x-ray', key), 'transparent', 'oit') > sum(by('shaded-with-edges', key), 'transparent', 'oit'), `x-ray ${key}: ${JSON.stringify([by('x-ray', key), by('shaded-with-edges', key)])}`);
      assert.equal(by('shaded-with-edges', key).passes.hiddenLines, 0);
      assert.ok(by('hidden-lines-dashed', key).passes.hiddenLines > 0, `dashed ${key}: ${JSON.stringify(by('hidden-lines-dashed', key))}`);
      assert.ok(by('wireframe', key).lines > 0);
    }
    // (Off: frames drawn after it are not counted.)
    const last = costs[modes[modes.length - 1]].frame;
    await page.evaluate(() => window.__studioFrameCost(false));
    await page.selectOption('select[aria-label="CAD display mode"]', 'shaded-with-edges'); await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__studioFrameCost());
    assert.ok(Object.values(after).every(c => c.frame <= last), JSON.stringify(Object.values(after).map(c => [c.mode, c.frame, last])));
    await display.click();
  });

  await check('O10 Rebuild panel: a box, then a hole drilled in it — the hole built, the box reused, the sketch an input, each with its time; the clearance fixture\'s copies in its frame costs by their keys; closed, gone', async () => {
    const renderer = await page.evaluate(() => document.querySelector('.viewport')?.dataset.renderer);
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    assert.ok(await page.evaluate(() => window.__studioSelectFace('n1.top')));
    await page.waitForFunction(() => /SELECTION · FACE/i.test(document.querySelector('.props:not([aria-label$=" panel"])')?.textContent ?? ''), null, { timeout: 5000 });
    await press('h'); await hudReady(); await page.waitForTimeout(250); await press('Enter');
    await page.waitForFunction(() => window.__studioDoc.nodes.at(-1)?.kind === 'hole' && window.__studioFresh === true, null, { timeout: 15000 }); await idle();
    const hole = await page.evaluate(() => { const n = window.__studioDoc.nodes; return n.at(-1).id ?? `n${n.length - 1}`; });
    await page.click('[aria-label="Rebuild"]');
    const panel = page.locator('[aria-label="Rebuild panel"]');
    await panel.waitFor({ timeout: 5000 });
    const rows = () => panel.locator('tr[data-rebuild-state]').evaluateAll(rs => rs.map(r => [r.getAttribute('aria-label').slice(8), r.dataset.rebuildState, +r.children[2].textContent]));
    const seen = await rows();
    const state = Object.fromEntries(seen.map(([id, s]) => [id, s]));
    assert.equal(state[hole], 'built', JSON.stringify(seen));
    assert.ok(seen.some(([, s]) => s === 'reused') && seen.some(([, s]) => s === 'input'), JSON.stringify(seen));
    assert.ok(seen.every(([, , t]) => Number.isFinite(t) && t >= 0), JSON.stringify(seen));
    assert.match(await panel.locator('[aria-label="Rebuild totals"]').innerText(), /Evaluation \d+ \(last evaluation\), revision [0-9a-f]{16} · [1-9]\d* built in [\d.]+ ms · [1-9]\d* reused · [\d.]+ ms in all/);
    assert.match(await panel.locator('[aria-label="Rebuild mates"]').innerText(), /No mates/);
    console.log(`  O10 rebuild (${renderer}): ${seen.map(([id, s, t]) => `${id} ${s} ${t} ms`).join(', ')}`);
    // (The clearance fixture: its bodies, the eight copies by their keys, in the frame costs the panel reads every 500 ms.)
    await openModel(join(root, 'test/fixtures/clearance-states.bcad'), 2, 60000); await idle();
    try { await page.waitForFunction(() => document.querySelectorAll('[aria-label="Frame costs"] tr[aria-label^="Frame cost "]').length >= 10, null, { timeout: 15000 }); }
    catch (e) { console.log(`  O10 frame costs (${renderer}): ${JSON.stringify(await page.evaluate(() => ({ rows: [...document.querySelectorAll('[aria-label="Frame costs"] tr[aria-label^="Frame cost "]')].map(r => r.getAttribute('aria-label')), totals: document.querySelector('[aria-label="Frame cost totals"]')?.textContent, status: document.querySelector('[aria-label="Rebuild panel"] [role=status]')?.textContent, bodies: window.__studioBodies(), inst: window.__studioInstanceBounds?.().length })))}`); throw e; }
    const keys = await panel.locator('tr[aria-label^="Frame cost "]').evaluateAll(rs => rs.map(r => r.getAttribute('aria-label').slice(11)).sort());
    assert.deepEqual(keys.filter(k => k.includes('/')), [1, 2, 3, 4, 5, 6, 7, 8].map(i => `i${i}/b1`), keys.join(','));
    assert.match(await panel.locator('[aria-label="Frame cost totals"]').innerText(), new RegExp(`^${renderer}, shaded-with-edges`));
    await snap('o10-rebuild-panel');
    await page.locator('[aria-label="Rebuild panel"]').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-o16-rebuild.png`) });
    await panel.locator('[aria-label="Close Rebuild"]').click();
    await page.waitForFunction(() => !document.querySelector('[aria-label="Rebuild panel"]'), null, { timeout: 5000 });
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

  // (Last, so no step's number moves.) Owner 2026-10-24: `.barocad` is our only curve and surface source; `.cad` is other
  // programs' extension and is not read as one.
  await check('Open: a .cad file is not taken for our source — the file named with what Open reads, the part unchanged; .barocad still offered', async () => {
    assert.equal(await page.locator('input[aria-label="Model file"]').getAttribute('accept'), '.bcad,.json,.step,.stp,.stl,.obj,.igs,.iges,.barocad,.dwg');
    const before = JSON.stringify(await doc());
    const file = join(out, 'bracket.cad'); (await import('node:fs')).writeFileSync(file, 'ISO-10303-21; another program\'s file');
    await page.locator('input[aria-label="Model file"]').setInputFiles(file);
    await page.waitForFunction(() => /Can’t open bracket\.cad/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 10000 });
    assert.match(await page.locator('.toast').innerText(), /Open reads models \(\.bcad, \.json\), STEP \(\.step, \.stp\), STL, OBJ, IGES \(\.igs, \.iges\) and \.barocad curve and surface sources\. Your part is unchanged\./);
    assert.equal(JSON.stringify(await doc()), before, 'the part is unchanged');
    await page.click('.toast [aria-label="Dismiss"]');
  });

  // ---- RS2 (owner 2026-10-24, "관절 움직임"): the motion through the waypoints played in the Joints card ----------------
  await check('RS2: a motion played — the 6R arm\'s TCP at 0, T/2 and T; pause, 2×, loop; the 2R arm into the post marked from the time of impact — either renderer', async () => {
    const fs = await import('node:fs'), file = join(out, 'rs2-arm-6r.bcad');
    const d = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/arm-6r/robot.bcad'), 'utf8'));
    d.robot = { version: 1, frames: { tcp: { link: 'l6', position: [5, -3, 40], rotation: [0, 90, 0], kind: 'tool' } } };
    fs.writeFileSync(file, JSON.stringify(d));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => (window.__studioFrameTriads?.() ?? []).length === 1, null, { timeout: 30000 }); await idle();
    const slide = (label, v) => page.evaluate(([l, x]) => { const el = document.querySelector(`[aria-label="${l}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [label, v]);
    const tcp = () => page.evaluate(() => window.__studioFrameTriads().find(f => f.name === 'tcp').o);
    const clock = async () => { const m = /^t ([\d.]+) \/ ([\d.]+) s$/.exec(await page.locator('[aria-label="Motion time readout"]').innerText()); return m && { t: +m[1], T: +m[2] }; };
    const near = (a, b, tol) => a.every((v, k) => Math.abs(v - b[k]) < tol), dist = (a, b) => Math.hypot(...a.map((v, k) => v - b[k]));
    await slide('Joint l5~l6 value', Math.PI / 2);
    await page.waitForFunction(() => Math.abs(window.__studioFrameTriads().find(x => x.name === 'tcp').o[0] - 63) < 0.05, null, { timeout: 10000 });
    await page.waitForSelector('[aria-label="Motion"] [aria-label="Play motion"]:not([disabled])', { timeout: 20000 });
    const { T } = await clock();
    assert.ok(T > 0.5 && T < 10, `the motion's length ${T} s`);
    // (Played to its end: the pose shown, the TCP at G13's quarter-turn point.)
    await page.click('[aria-label="Play motion"]');
    await page.waitForFunction(() => document.querySelector('[aria-label="Motion"] [aria-label="Play motion"]') && /^t ([\d.]+) \/ \1 s$/.test(document.querySelector('[aria-label="Motion time readout"]')?.textContent ?? ''), null, { timeout: 20000 });
    assert.ok(near(await tcp(), [63, 105, 330], 0.05), `at T the TCP is G13's quarter-turn point: ${JSON.stringify(await tcp())}`);
    // (Scrubbed: at 0 home, G13's zero-pose point; at T/2 halfway round l6 — a symmetric trapezoid's middle — as far from both.)
    await slide('Motion time', 0); await page.waitForTimeout(200);
    assert.ok(near(await tcp(), [45, 97, 330], 0.05), `at 0 the TCP is G13's zero-pose point: ${JSON.stringify(await tcp())}`);
    await slide('Motion time', T / 2); await page.waitForTimeout(200);
    const mid = await tcp();
    assert.ok(Math.abs(dist(mid, [45, 97, 330]) - dist(mid, [63, 105, 330])) < 0.05 && dist(mid, [45, 97, 330]) > 1, `at T/2 the TCP halfway round: ${JSON.stringify(mid)}`);
    assert.ok(Math.abs(mid[2] - 330) < 0.05, 'turning about l6 keeps its height');
    await snap('rs2-motion-mid');
    // (Paused, it holds; at 2× the motion's time runs twice the wall clock's.)
    await slide('Motion time', 0); await page.selectOption('[aria-label="Motion speed"]', '2');
    const rate = async () => { const a = await clock(), w0 = await page.evaluate(() => performance.now()); await page.waitForTimeout(250); const b = await clock(), w1 = await page.evaluate(() => performance.now()); return (b.t - a.t) / ((w1 - w0) / 1000); };
    await page.click('[aria-label="Play motion"]'); await page.waitForTimeout(100);
    const fast = await rate();
    await page.click('[aria-label="Pause motion"]');
    const held = (await clock()).t; await page.waitForTimeout(300);
    assert.equal((await clock()).t, held, 'paused, the time holds');
    assert.ok(fast > 1.4 && fast < 2.6, `at 2× the motion runs about twice as fast: ${fast.toFixed(2)}`);
    // (Looped, past T it wraps to the start.)
    await page.check('[aria-label="Loop motion"]'); await slide('Motion time', T * 0.9); await page.click('[aria-label="Play motion"]');
    await page.waitForFunction(T => { const m = /^t ([\d.]+)/.exec(document.querySelector('[aria-label="Motion time readout"]')?.textContent ?? ''); return m && +m[1] < T * 0.5; }, T, { timeout: 10000 });
    await page.click('[aria-label="Pause motion"]'); await page.uncheck('[aria-label="Loop motion"]');
    await page.click('[aria-label="Joints home"]');
    // (The 2R arm swung into the post, RM6's case: the two links marked from the time of impact on, not before.)
    const c = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/sweep-post/case.json'), 'utf8')), post = join(out, 'rs2-sweep-post.bcad');
    fs.writeFileSync(post, JSON.stringify(c.input.document));
    await page.setInputFiles('input[aria-label="Model file"]', post);
    await page.waitForFunction(() => window.__studioDoc?.instances?.length === 3 && window.__studioInstanceBounds?.().length === 3, null, { timeout: 20000 }); await idle();
    await page.waitForSelector('[aria-label="Joint base~a value"]', { timeout: 20000 });
    // (Its own view, framed: a camera left by an earlier step — New part keeps it — would make the links small.)
    await page.click('.views button:text-is("Iso")'); await page.click('.views button[title="Frame all (F)"]'); await page.waitForTimeout(400);
    await slide('Joint base~a value', 2);
    await page.waitForSelector('[aria-label="Motion"] [aria-label="Play motion"]:not([disabled])', { timeout: 20000 });
    // (A dense grid: WebGPU's mark is a 2 px outline, which a coarse one steps over.)
    const reds = async () => { const px = await page.evaluate(() => window.__studioFrame(320)); let n = 0; for (let i = 0; i < px.length; i += 3) if (px[i] > 170 && px[i + 1] < 120 && px[i + 2] < 120) n++; return n; };
    await page.click('[aria-label="Play motion"]');
    await page.waitForSelector('[aria-label="Motion contact"]', { timeout: 20000 });
    assert.match(await page.locator('[aria-label="Motion contact"]').innerText(), /^Contact .*post.* at t \d+\.\d{2} s$/);
    const toi = +/at t ([\d.]+) s/.exec(await page.locator('[aria-label="Motion contact"]').innerText())[1];
    await page.waitForFunction(() => !document.querySelector('[aria-label="Pause motion"]'), null, { timeout: 20000 });
    await page.waitForTimeout(300);
    assert.equal((await page.evaluate(() => window.__studioContactLinks())).length, 2, 'two links marked after the time of impact');
    const after = await reds(); await snap('rs2-contact');
    await slide('Motion time', toi * 0.5); await page.waitForTimeout(400);
    assert.equal(await page.locator('[aria-label="Motion contact"]').count(), 0, 'before the time of impact, no contact said');
    assert.deepEqual(await page.evaluate(() => window.__studioContactLinks()), [], 'nor marked');
    const before = await reds();
    assert.ok(after > before + 20, `the links marked in the error colour after the time of impact: ${after} red samples, ${before} before`);
    await page.click('[aria-label="Joints home"]');
  });

  // ---- RS2: the draft kept as a saved motion, chosen and played from the document; the save is an undo step ---------
  await check('RS2: Save as motion — the draft kept by name in robot.motions (degrees), chosen and played to its end, undone', async () => {
    const fs = await import('node:fs'), file = join(out, 'rs2-save-6r.bcad');
    const d = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/arm-6r/robot.bcad'), 'utf8'));
    d.robot = { version: 1, frames: { tcp: { link: 'l6', position: [5, -3, 40], rotation: [0, 90, 0], kind: 'tool' } } };
    fs.writeFileSync(file, JSON.stringify(d));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => (window.__studioFrameTriads?.() ?? []).length === 1, null, { timeout: 30000 }); await idle();
    const slide = (label, v) => page.evaluate(([l, x]) => { const el = document.querySelector(`[aria-label="${l}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [label, v]);
    const tcp = () => page.evaluate(() => window.__studioFrameTriads().find(f => f.name === 'tcp').o);
    await slide('Joint l5~l6 value', Math.PI / 2);
    await page.waitForSelector('[aria-label="Save as motion"]:not([disabled])', { timeout: 20000 });
    await page.fill('[aria-label="Motion name"]', 'quarter'); await page.click('[aria-label="Save as motion"]');
    await page.waitForFunction(() => window.__studioDoc?.robot?.motions?.some(m => m.name === 'quarter'), null, { timeout: 10000 });
    const saved = (await doc()).robot.motions.find(m => m.name === 'quarter');
    const last = saved.path.waypoints.at(-1);
    assert.ok(Math.abs((last['l5~l6'] ?? 0) - 90) < 1e-6, `saved in degrees: ${JSON.stringify(saved.path.waypoints)}`);
    assert.equal(await page.locator('[aria-label="Motion choice"]').inputValue(), 'quarter', 'the saved motion chosen');
    // (Home, then the saved one played: it ends at the quarter turn — the document's motion, not the pose shown.)
    await page.click('[aria-label="Joints home"]');
    await page.waitForFunction(() => Math.abs(window.__studioFrameTriads().find(x => x.name === 'tcp').o[0] - 45) < 0.05, null, { timeout: 10000 });
    await page.selectOption('[aria-label="Motion choice"]', 'quarter');
    await page.waitForSelector('[aria-label="Play motion"]:not([disabled])', { timeout: 10000 });
    await page.click('[aria-label="Play motion"]');
    await page.waitForFunction(() => document.querySelector('[aria-label="Play motion"]') && /^t ([\d.]+) \/ \1 s$/.test(document.querySelector('[aria-label="Motion time readout"]')?.textContent ?? ''), null, { timeout: 20000 });
    const end = await tcp();
    assert.ok(Math.abs(end[0] - 63) < 0.05 && Math.abs(end[1] - 105) < 0.05, `the saved motion ends at the quarter turn: ${JSON.stringify(end)}`);
    // (The save is an undo step: undone, the motion is gone and the card back on the draft.)
    await page.click('[aria-label="Joints home"]'); await page.click('[aria-label="Undo"]');
    await page.waitForFunction(() => !window.__studioDoc?.robot?.motions?.length, null, { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('[aria-label="Motion choice"]')?.value === '' || !document.querySelector('[aria-label="Motion choice"]'), null, { timeout: 10000 });
  });

  // ---- RS1: the robot samples in Templates, each opened with its demo motion; the 6R arm's played to its end --------
  await check('RS1: Templates → Samples — each of the 8 robot samples opens with its joints and its demo motion; the 6R arm\'s plays to its end', async () => {
    const index = JSON.parse((await import('node:fs')).readFileSync(join(root, '../../packages/barocss-cad-model/samples/robots/index.json'), 'utf8'));
    assert.equal(index.length, 8);
    for (const r of index) {
      await page.click('[aria-label="New from a template"]');
      await page.click(`[aria-label="Open sample ${r.title}"]`);
      // (Its own demo motion, as the sample's file names it: the document opened is this sample's, not the one before.)
      const name = JSON.parse((await import('node:fs')).readFileSync(join(root, '../../packages/barocss-cad-model/samples/robots', r.file), 'utf8')).robot.motions[0].name;
      await page.waitForFunction(n => window.__studioDoc?.robot?.motions?.length === 1 && window.__studioDoc.robot.motions[0].name === n && !!document.querySelector('[aria-label="Joints"]'), name, { timeout: 30000 });
      await page.waitForFunction(n => [...(document.querySelector('[aria-label="Motion choice"]')?.options ?? [])].some(o => o.value === n), name, { timeout: 20000 });
      assert.equal(await page.locator('.toast').count(), 0, `${r.id} opened without a refusal`);
      if (r.id !== 'arm-6r') continue;
      await page.selectOption('[aria-label="Motion choice"]', name);
      await page.waitForSelector('[aria-label="Play motion"]:not([disabled])', { timeout: 20000 });
      await page.selectOption('[aria-label="Motion speed"]', '2');
      await page.click('[aria-label="Play motion"]');
      await page.waitForFunction(() => document.querySelector('[aria-label="Play motion"]') && /^t ([\d.]+) \/ \1 s$/.test(document.querySelector('[aria-label="Motion time readout"]')?.textContent ?? ''), null, { timeout: 60000 });
      await snap('rs1-arm-6r-motion');
      await page.selectOption('[aria-label="Motion speed"]', '1');
    }
  });

  // ---- RS2 (2): the recorder — the motion's video at its own timing, the Render turntable's over its duration -------
  await check('RS2 video: a motion and a Render turntable exported as WebM — ffprobe reads its codec, its frames at 30 a second and the motion\'s length; not blank', async () => {
    const fs = await import('node:fs'), file = join(out, 'rs2-video-6r.bcad');
    const d = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/arm-6r/robot.bcad'), 'utf8'));
    fs.writeFileSync(file, JSON.stringify(d));
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForSelector('[aria-label="Joint l5~l6 value"]', { timeout: 30000 }); await idle();
    await page.evaluate(() => { const el = document.querySelector('[aria-label="Joint l5~l6 value"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(Math.PI / 2)); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForSelector('[aria-label="Export motion video"]:not([disabled])', { timeout: 20000 });
    const T = +/\/ ([\d.]+) s$/.exec(await page.locator('[aria-label="Motion time readout"]').innerText())[1];
    const webm = async (button, name) => {
      const download = page.waitForEvent('download', { timeout: 60000 }), t0 = Date.now();
      await page.click(`[aria-label="${button}"]`);
      const got = await download, path = join(out, name); await got.saveAs(path);
      const bytes = fs.readFileSync(path);
      assert.match(got.suggestedFilename(), /\.webm$/);
      assert.deepEqual([...bytes.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3], `${name}: a WebM (EBML) file`);
      assert.ok(bytes.length > 4000, `${name}: ${bytes.length} bytes`);
      // (ffprobe, an independent reader: the codec, the frames decoded and the length; ffmpeg's last frame not one colour.)
      const { execFileSync } = await import('node:child_process');
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,nb_read_frames:format=duration', '-of', 'json', path], { encoding: 'utf8' }));
      const st = probe.streams[0], px = execFileSync('ffmpeg', ['-v', 'error', '-sseof', '-0.2', '-i', path, '-frames:v', '1', '-vf', 'scale=32:32', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 20 });
      const mean = px.reduce((a, b) => a + b, 0) / px.length, spread = Math.sqrt(px.reduce((a, b) => a + (b - mean) ** 2, 0) / px.length);
      return { codec: st.codec_name, frames: +st.nb_read_frames, duration: +probe.format.duration, spread, took: (Date.now() - t0) / 1000 };
    };
    const v = await webm('Export motion video', 'rs2-motion.webm');
    console.log(`  RS2 video: ${JSON.stringify(v)} for a ${T} s motion`);
    assert.ok(/^vp[89]$/.test(v.codec), `a VP8 or VP9 stream: ${v.codec}`);
    assert.equal(v.frames, Math.ceil(T * 30) + 1, 'a frame each 1/30 s over the motion, its end included');
    assert.ok(Math.abs(v.duration - (Math.ceil(T * 30) + 1) / 30) < 0.05, `the motion's own length, however long the frames took to draw (${v.took.toFixed(1)} s): ${v.duration}`);
    assert.ok(v.spread > 3, `its last frame shows the model, not one colour: ${v.spread.toFixed(1)}`);
    // (The Render workspace: a 1 s turntable, recorded by the same recorder.)
    await page.click('[aria-label="Joints home"]');
    await page.click('.mode button:text-is("Render")'); await page.waitForSelector('[aria-label="Timeline"]', { timeout: 20000 });
    await page.fill('[aria-label="Duration"]', '1'); if (!(await page.isChecked('[aria-label="Turntable"]'))) await page.check('[aria-label="Turntable"]');
    const r = await webm('Export animation video', 'rs2-turntable.webm');
    assert.equal(r.frames, 31, 'the 1 s turntable at 30 a second'); assert.ok(r.spread > 3, 'not one colour');
    await page.click('.mode button:text-is("Model")');
  });
  await check('G15d.1 post: AgX, a warm grade, contrast, saturation and a vignette from the Render panel\'s Post section — kept in the document, the frame darker at its corners and warmer; neutral again, dropped', async () => {
    await page.click('.mode button:text-is("Render")'); await page.waitForSelector('[aria-label="Render"]');
    await page.click('.render-panel [role="tab"]:text-is("Scene")');
    const env = () => page.evaluate(() => window.__studioDoc.render.environment);
    const N = 9, frame = async () => { await idle(); await page.waitForTimeout(500); return page.evaluate(n => window.__studioFrame(n), N); };
    // (Corners: the grid's four corner samples, the background's; warmth: red over blue across the whole grid.)
    const corners = f => [0, N - 1, N * (N - 1), N * N - 1].map(k => (f[3 * k] + f[3 * k + 1] + f[3 * k + 2]) / 3);
    const warmth = f => { let t = 0; for (let k = 0; k < N * N; k++) t += f[3 * k] - f[3 * k + 2]; return t / (N * N); };
    const slide = async (label, v) => { await page.evaluate(([l, x]) => { const el = document.querySelector(`.render-panel [aria-label="${l}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [label, v]); };
    assert.equal((await env()).post, undefined, 'no post until one is set');
    const gpu = renderer === 'webgpu', before = gpu ? await frame() : null;
    await slide('Vignette', 0.8);
    await page.waitForFunction(() => window.__studioDoc.render.environment.post?.vignette === 0.8);
    const vignetted = gpu ? await frame() : null;
    await page.selectOption('.render-panel [aria-label="Colour grade"]', 'warm');
    await slide('Contrast', 1.2); await slide('Saturation', 1.3);
    await page.selectOption('.render-panel [aria-label="Tone mapping"]', 'agx');
    await page.waitForFunction(() => window.__studioDoc.render.environment.toneMapping === 'agx' && window.__studioDoc.render.environment.post?.saturation === 1.3);
    assert.deepEqual((await env()).post, { grade: 'warm', contrast: 1.2, saturation: 1.3, vignette: 0.8 });
    await page.locator('.render-panel').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-g15d1-post-panel.png`) });
    if (gpu) {
      const warm = await frame(); await snap('g15d1-post');
      const c0 = corners(before), c1 = corners(vignetted);
      console.log(`  G15d.1: corners ${c0.map(Math.round)} → ${c1.map(Math.round)}; warmth ${warmth(before).toFixed(1)} → ${warmth(warm).toFixed(1)}`);
      assert.ok(c1.every((c, i) => c < c0[i] - 8), `the vignette darkens every corner: ${c0.map(Math.round)} → ${c1.map(Math.round)}`);
      assert.ok(warmth(warm) > warmth(vignetted) + 4, `the warm grade lifts red over blue: ${warmth(vignetted).toFixed(1)} → ${warmth(warm).toFixed(1)}`);
    }
    // Undo takes the tone map back; neutral again (each control to its default), the post leaves the document.
    await press('Meta+z');
    await page.waitForFunction(() => window.__studioDoc.render.environment.toneMapping === 'aces');
    await page.selectOption('.render-panel [aria-label="Colour grade"]', 'neutral');
    await slide('Contrast', 1); await slide('Saturation', 1); await slide('Vignette', 0);
    await page.waitForFunction(() => window.__studioDoc.render.environment.post === undefined, null, { timeout: 5000 });
    if (gpu) {
      const back = await frame();
      assert.ok(corners(back).every((c, i) => Math.abs(c - corners(before)[i]) < 4), 'neutral: the frame as before');
    }
    await page.click('.mode button:text-is("Model")');
  });
  await check('G15a finishes: Turned steel, a knurl along Z, a lacquered paint and an oil film from the Render panel — kept on the appearance, the part drawn with its marks; None again, plain', async () => {
    // (A new part, a box: its one body takes the default appearance, whatever the steps before left open.)
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await page.waitForTimeout(300); await press('Enter'); await idle();
    await page.click('.mode button:text-is("Render")'); await page.waitForSelector('[aria-label="Render"]');
    await press('Escape');
    await page.click('.render-panel [role="tab"]:text-is("Appearance")');
    await page.waitForFunction(() => /Every body without/.test(document.querySelector('.render-panel .muted.small')?.textContent ?? ''));
    const look = () => page.evaluate(() => window.__studioDoc.render.defaultAppearance);
    const gpu = renderer === 'webgpu', N = 64;
    // (The marks: how much a sample differs from its neighbours on a dense grid, the whole frame.)
    // (A frame on a dense grid; how far two differ, sample by sample, over the samples either changes — the part's.)
    const marks = async () => { await idle(); await page.waitForTimeout(600); return page.evaluate(n => window.__studioFrame(n), N); };
    const apart = (a, b) => { let d = 0, n = 0; for (let k = 0; k < a.length; k++) { const e = Math.abs(a[k] - b[k]); if (e > 2) { d += e; n++; } } return n ? d / n : 0; };
    await page.selectOption('[aria-label="Appearance preset"]', 'look-steel');
    await page.waitForFunction(() => window.__studioDoc.render.defaultAppearance.color === '#a7abb1');
    const plain = gpu ? await marks() : null;
    await page.selectOption('[aria-label="Appearance preset"]', 'look-turned-steel');
    await page.waitForFunction(() => window.__studioDoc.render.defaultAppearance.finish?.kind === 'turned');
    assert.deepEqual((await look()).finish, { kind: 'turned', scale: 0.3, strength: 0.6, axis: [0, 0, 1] });
    assert.equal(await page.inputValue('[aria-label="Appearance preset"]'), 'look-turned-steel', 'the preset shown as chosen');
    const turned = gpu ? await marks() : null; if (gpu) await snap('g15a-turned');
    // A knurl, coarser, along Z; the preset becomes Custom.
    await page.selectOption('.render-panel [aria-label="Surface finish"]', 'knurled');
    await page.evaluate(() => { const el = document.querySelector('.render-panel [aria-label="Marks"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1.5'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => window.__studioDoc.render.defaultAppearance.finish?.kind === 'knurled' && window.__studioDoc.render.defaultAppearance.finish.scale === 1.5);
    assert.equal(await page.inputValue('.render-panel [aria-label="Finish direction"]'), 'z');
    assert.equal(await page.inputValue('[aria-label="Appearance preset"]'), '');
    const knurled = gpu ? await marks() : null; if (gpu) await snap('g15a-knurled');
    await page.locator('.render-panel').first().screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-g15a-finish-panel.png`) });
    // Paint under a clear coat; an oil film.
    await page.selectOption('[aria-label="Appearance preset"]', 'look-painted-red');
    await page.waitForFunction(() => window.__studioDoc.render.defaultAppearance.clearcoat === 1 && !window.__studioDoc.render.defaultAppearance.finish);
    if (gpu) await snap('g15a-painted');
    await page.selectOption('[aria-label="Appearance preset"]', 'look-oiled-steel');
    await page.waitForFunction(() => window.__studioDoc.render.defaultAppearance.film === 0.7);
    if (gpu) await snap('g15a-oiled');
    // None: the finish leaves the appearance.
    await page.selectOption('.render-panel [aria-label="Surface finish"]', '');
    await page.waitForFunction(() => !window.__studioDoc.render.defaultAppearance.finish);
    if (gpu) {
      const t = apart(plain, turned), k = apart(plain, knurled);
      console.log(`  G15a: frames apart from plain steel — turned ${t.toFixed(1)}, knurled ${k.toFixed(1)}`);
      assert.ok(t > 8, `the turned face drawn (its radial highlight): ${t.toFixed(1)}`);
      assert.ok(k > 8, `the knurl drawn: ${k.toFixed(1)}`);
    }
    await page.selectOption('[aria-label="Appearance preset"]', 'look-steel');
    await page.click('.mode button:text-is("Model")');
  });

  // ---- CG6: a project folder, versions, restore, autosave (DA-4, DA-5) ---------------------------------------------
  await check('CG6 project: open a folder, save into it, two versions, compare, restore the first; autosave kept in the project and offered back after a reload', async () => {
    // (The folder picker is a native dialog a headless browser cannot drive: it hands back a real directory handle from
    // the browser's private file system instead — the same handle calls a picked folder answers.)
    const folder = await page.evaluate(async () => {
      const name = `cg6-flow-${Date.now()}`, dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
      window.showDirectoryPicker = async () => dir; return name;
    });
    const files = () => page.evaluate(async name => {
      const out = [], walk = async (d, at) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, `${at}${n}/`); else out.push(`${at}${n}`); } };
      await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle(name), ''); return out.filter(f => !f.endsWith('.crswap')).sort();
    }, folder);
    const card = page.locator('[aria-label="Versions panel"]');
    const versions = () => card.locator('ul[aria-label="Versions"] > li').evaluateAll(ls => ls.map(l => l.getAttribute('aria-label').slice(8)));
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter'); await idle();
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''));
    await page.click('[aria-label="Project and versions"]'); await card.waitFor({ timeout: 5000 });
    await card.locator('[aria-label="Open folder"]').click();
    await card.locator('[aria-label="Project"]').waitFor({ timeout: 5000 });
    assert.match(await card.locator('[aria-label="Project"]').innerText(), new RegExp(`${folder}\\s*· folder`));
    // A version saves the document into the folder and keeps it.
    await card.locator('[aria-label="Version name"]').fill('First'); await card.locator('[aria-label="Make version"]').click();
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Versions panel"] ul[aria-label="Versions"] > li').length === 1, null, { timeout: 10000 });
    assert.deepEqual(await versions(), ['First']);
    const first = await files();
    assert.ok(first.includes('Untitled.bcad') && first.includes('.barocss/versions/Untitled.bcad.json') && first.filter(f => f.startsWith('.barocss/snapshots/')).length === 1, first.join(', '));
    // A second box; Save writes into the folder (no download); a second version.
    await press('b'); await hudReady(); await field('At X').fill('48'); await hudReady(); await page.waitForTimeout(300); await press('Enter');
    await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    let downloads = 0; const count = () => { downloads++; }; page.on('download', count);
    await page.click('[aria-label="Save"]');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Unsaved changes"]'), null, { timeout: 5000 });
    page.off('download', count); assert.equal(downloads, 0, 'saved into the project, not downloaded');
    await card.locator('[aria-label="Version name"]').fill('Second'); await card.locator('[aria-label="Make version"]').click();
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Versions panel"] ul[aria-label="Versions"] > li').length === 2, null, { timeout: 10000 });
    assert.deepEqual(await versions(), ['Second', 'First']);
    // Compare the first with the working document: the second box's two features, added.
    await card.locator('[aria-label="Compare First"]').click();
    const compared = await card.locator('[aria-label="Compared changes"]').innerText();
    assert.match(compared, /added sketch n2/); assert.match(compared, /added extrude n3/);
    await page.waitForTimeout(1500); await page.screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-cg6-compare.png`) });
    await card.locator('[aria-label="Compare First"]').click();
    // Restore the first: one box again, the history kept (both versions listed), the work unsaved.
    await card.locator('[aria-label="Restore First"]').click();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    assert.deepEqual(await versions(), ['Second', 'First']);
    await page.waitForSelector('[aria-label="Unsaved changes"]');
    // Autosave: kept in the project a moment after the change (the restored work: one box); after a reload, the folder
    // reopened and the work offered back.
    const autosaved = () => page.evaluate(async name => {
      try {
        const d = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle(name)).getDirectoryHandle('.barocss')).getDirectoryHandle('autosave');
        return JSON.parse(await (await (await d.getFileHandle('Untitled.bcad')).getFile()).text()).nodes.length;
      } catch { return null; }
    }, folder);
    for (let k = 0; k < 40 && await autosaved() !== 2; k++) await page.waitForTimeout(250);
    assert.equal(await autosaved(), 2, 'the autosave holds the restored work (one box)');
    expectLoad(); await page.reload(); await idle();
    if (await page.locator('[aria-label="Recover unsaved work"]').count()) await page.click('[aria-label="Recover unsaved work"] button:text-is("Discard")');
    await page.click('[aria-label="Project and versions"]'); await card.waitFor({ timeout: 5000 });
    await card.locator(`[aria-label="Reopen ${folder}"]`).click();
    await card.locator('[aria-label="Open Untitled.bcad"]').click();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 4, null, { timeout: 15000 });
    // (The log is read after the document opens.)
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Versions panel"] ul[aria-label="Versions"] > li').length === 2, null, { timeout: 10000 });
    assert.deepEqual(await versions(), ['Second', 'First'], 'the versions read back from the folder');
    assert.equal(await autosaved(), 2, 'the autosave still holds the restored work after the reopen');
    await card.locator('[aria-label="Autosaved work"]').waitFor({ timeout: 5000 });
    await card.locator('[aria-label="Restore autosaved work"]').click();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await card.screenshot({ path: join(out, `${String(step).padStart(2, '0')}b-cg6-versions.png`) });
    await card.locator('[aria-label="Close project"]').click(); await page.click('[aria-label="Project and versions"]');
    await page.evaluate(async name => (await navigator.storage.getDirectory()).removeEntry(name, { recursive: true }), folder);
  });

  await check('CG6 branches: a branch and the main line each add a box, merged clean; one parameter set two ways is a conflict, answered for the branch; a new part leaves the project file alone; a mesh compared by its faces', async () => {
    const folder = await page.evaluate(async () => {
      const name = `cg6-branch-${Date.now()}`, dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
      window.showDirectoryPicker = async () => dir; return name;
    });
    const card = page.locator('[aria-label="Versions panel"]'), rows = 'ul[aria-label="Versions"] > li';
    const versions = () => card.locator(rows).evaluateAll(ls => ls.map(l => l.getAttribute('aria-label').slice(8)));
    const bodies = n => page.waitForFunction(n => new RegExp(`${n} bod`).test(document.querySelector('.outliner')?.textContent ?? ''), n, { timeout: 15000 });
    const version = async name => {
      const n = await card.locator(rows).count();
      await card.locator('[aria-label="Version name"]').fill(name); await card.locator('[aria-label="Make version"]').click();
      await page.waitForFunction(([sel, n]) => document.querySelectorAll(`[aria-label="Versions panel"] ${sel}`).length > n, [rows, n], { timeout: 10000 });
      assert.equal((await versions())[0], name);
    };
    const onBranch = async name => { await card.locator('[aria-label="Branch"]').selectOption(name); await page.waitForFunction(n => document.querySelector('[aria-label="Versions panel"] [aria-label="Branch"]')?.value === n, name, { timeout: 10000 }); };
    const boxAt = async (axis, v) => { await press('b'); await hudReady(); await field(axis).fill(String(v)); await hudReady(); await page.waitForTimeout(300); await press('Enter'); await idle(); };
    const parameter = async (name, value) => {
      await page.click('[aria-label="Parameters"]');
      await page.fill('[aria-label="New parameter name"]', name); await page.fill('[aria-label="New parameter value"]', String(value)); await page.click('[aria-label="Add parameter"]');
      await page.waitForFunction(([n, v]) => window.__studioDoc.parameters[n] === v, [name, value], { timeout: 5000 });
      await page.click('[aria-label="Close parameters"]'); await card.waitFor({ timeout: 5000 });
    };
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter'); await idle(); await bodies(1);
    await page.click('[aria-label="Project and versions"]'); await card.waitFor({ timeout: 5000 });
    await card.locator('[aria-label="Open folder"]').click(); await card.locator('[aria-label="Project"]').waitFor({ timeout: 5000 });
    await version('Base');
    // A branch "wide" with a box along X; the main line with a box along Y; merged: three boxes, a merge version.
    await card.locator('[aria-label="Branch name"]').fill('wide'); await card.locator('[aria-label="Make branch"]').click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Versions panel"] [aria-label="Branch"] option')].some(o => o.value === 'wide'), null, { timeout: 5000 });
    await onBranch('wide'); await boxAt('At X', 48); await bodies(2); await version('Wide');
    await onBranch('main'); await bodies(1);
    assert.deepEqual(await versions(), ['Base'], "main's own history");
    await boxAt('At Y', 48); await bodies(2); await version('Deep');
    await card.locator('[aria-label="Merge"]').click();
    await bodies(3);
    const ids = await page.evaluate(() => window.__studioDoc.nodes.map(n => n.id));
    assert.equal(new Set(ids).size, 6, `six features, ids unique: ${ids}`);
    assert.match(await card.locator(rows).first().innerText(), /merged from wide/);
    assert.deepEqual((await versions()).slice(1), ['Deep', 'Base']);
    await card.screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-cg6-merged.png`) });
    // One parameter set two ways: a conflict, answered for the branch.
    await card.locator('[aria-label="Branch name"]').fill('thick'); await card.locator('[aria-label="Make branch"]').click();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Versions panel"] [aria-label="Branch"] option')].some(o => o.value === 'thick'), null, { timeout: 5000 });
    await onBranch('thick'); await parameter('T', 5); await version('T5');
    await onBranch('main'); await parameter('T', 3); await version('T3');
    await card.locator('[aria-label="Merge from"]').selectOption('thick'); await card.locator('[aria-label="Merge"]').click();
    await card.locator('[aria-label="Conflict parameter:T"]').waitFor({ timeout: 5000 });
    assert.match(await card.locator('[aria-label="Merge conflicts"]').innerText(), /1 conflict[\s\S]*main \(3\)[\s\S]*thick \(5\)/);
    await card.screenshot({ path: join(out, `${String(step).padStart(2, '0')}b-cg6-conflict.png`) });
    await card.locator('[aria-label="parameter:T theirs"]').check(); await card.locator('[aria-label="Merge with these answers"]').click();
    await page.waitForFunction(() => window.__studioDoc.parameters.T === 5, null, { timeout: 10000 });
    assert.equal(await card.locator('[aria-label="Merge conflicts"]').count(), 0);
    // A new part leaves the project's document: its versions go from the card, and Save writes a new file.
    const saved = await page.evaluate(async name => (await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle(name)).getFileHandle('Untitled.bcad')).getFile()).text(), folder);
    await page.click('[aria-label="New part"]');
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Versions panel"] ul[aria-label="Versions"] > li').length === 0, null, { timeout: 5000 });
    // A mesh and a box: the kernel's Boolean refuses facet bodies, so compare tints the changed faces.
    await page.setInputFiles('input[aria-label="Model file"]', join(root, '../../packages/barocss-cad-model/test/fixtures/block-cm.stl'));
    await page.waitForSelector('[aria-label="Mesh units"]'); await page.selectOption('[aria-label="Mesh unit"]', 'cm');
    await page.click('[aria-label="Mesh units"] button:text-is("Open")'); await bodies(1); await idle();
    await version('Mesh');
    assert.equal(await page.evaluate(async name => (await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle(name)).getFileHandle('Untitled.bcad')).getFile()).text(), folder), saved, 'Untitled.bcad untouched');
    const files = await page.evaluate(async name => { const out = []; for await (const [n] of (await (await navigator.storage.getDirectory()).getDirectoryHandle(name)).entries()) out.push(n); return out.sort(); }, folder);
    assert.ok(files.filter(f => f.endsWith('.bcad')).length === 2, files.join(', '));
    await boxAt('At X', 80); await bodies(2);
    await card.locator('[aria-label="Compare Mesh"]').click();
    await page.waitForFunction(() => window.__studioCompareOverlay?.()?.faces > 0, null, { timeout: 20000 });
    const o = await page.evaluate(() => window.__studioCompareOverlay());
    assert.equal(o.method, 'faces', JSON.stringify(o)); assert.equal(o.tinted, true);
    await page.screenshot({ path: join(out, `${String(step).padStart(2, '0')}c-cg6-faces.png`) });
    await card.locator('[aria-label="Compare Mesh"]').click();
    await card.locator('[aria-label="Close project"]').click(); await page.click('[aria-label="Project and versions"]');
    await page.evaluate(async name => (await navigator.storage.getDirectory()).removeEntry(name, { recursive: true }), folder);
  });

  await check('CG6 linked parts: a part inserted from the project names its file; saved again with a second box, the assembly opened offers it as Revision waiting, accepted the link stays', async () => {
    const folder = await page.evaluate(async () => {
      const name = `cg6-linked-${Date.now()}`, dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
      window.showDirectoryPicker = async () => dir; return name;
    });
    const card = page.locator('[aria-label="Versions panel"]');
    const named = async name => { await page.fill('.doc-tab input', name); };
    const saveIn = async () => { await page.click('[aria-label="Save"]'); await page.waitForFunction(() => !document.querySelector('[aria-label="Unsaved changes"]'), null, { timeout: 5000 }); };
    // The part, arm.bcad: one box.
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter'); await idle();
    await named('arm');
    await page.click('[aria-label="Project and versions"]'); await card.waitFor({ timeout: 5000 });
    await card.locator('[aria-label="Open folder"]').click(); await card.locator('[aria-label="Project"]').waitFor({ timeout: 5000 });
    await saveIn();
    // The assembly: arm.bcad inserted from the project, saved as assembly.bcad.
    await page.click('[aria-label="New part"]'); await named('assembly');
    await card.locator('[aria-label="Insert arm.bcad"]').click();
    await page.waitForFunction(() => window.__studioDoc.instances?.length === 1, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__studioDoc.instances[0].part.source), './arm.bcad');
    await saveIn();
    assert.match(await card.locator('[aria-label="Project documents"]').innerText(), /arm\.bcad[\s\S]*assembly\.bcad/);
    // The part opened, a second box added, saved.
    await card.locator('[aria-label="Open arm.bcad"]').click();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 2 && !window.__studioDoc.instances?.length, null, { timeout: 15000 });
    await press('b'); await hudReady(); await field('At X').fill('48'); await hudReady(); await page.waitForTimeout(300); await press('Enter'); await idle();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 4, null, { timeout: 15000 });
    await saveIn();
    // The assembly opened: the newer file waits, the placed part unchanged until accepted.
    await card.locator('[aria-label="Open assembly.bcad"]').click();
    await page.waitForFunction(() => window.__studioDoc.instances?.length === 1 && !!window.__studioDoc.pendingParts, null, { timeout: 15000 });
    assert.match(await page.locator('.toast').innerText(), /Newer files for 1 placed part/);
    assert.equal(await page.evaluate(() => window.__studioDoc.instances[0].doc.nodes.length), 2);
    assert.equal(await page.evaluate(() => Object.values(window.__studioDoc.pendingParts)[0].name), './arm.bcad');
    await page.locator('.ol.instance').first().click(); await page.waitForSelector('[aria-label="Revision waiting"]');
    await page.screenshot({ path: join(out, `${String(step).padStart(2, '0')}a-cg6-linked.png`) });
    await page.click('[aria-label="Instance"] button:text-is("Accept Rev B")');
    await page.waitForFunction(() => window.__studioDoc.instances[0].doc.nodes.length === 4 && !window.__studioDoc.pendingParts, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__studioDoc.instances[0].part.source), './arm.bcad', 'the link stays');
    // Checked again: the file is the part as placed, nothing more offered.
    await page.keyboard.press('Escape');
    await card.locator('[aria-label="Check placed parts"]').click(); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.__studioDoc.pendingParts), undefined);
    await card.locator('[aria-label="Close project"]').click(); await page.click('[aria-label="Project and versions"]');
    await page.evaluate(async name => (await navigator.storage.getDirectory()).removeEntry(name, { recursive: true }), folder);
  });

  await check('CG6 agent versions: a chat turn carries the project\'s version log (its index, the head\'s document); a version the agent made comes back into the project', async () => {
    const folder = await page.evaluate(async () => {
      const name = `cg6-agent-${Date.now()}`, dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
      window.showDirectoryPicker = async () => dir; return name;
    });
    const card = page.locator('[aria-label="Versions panel"]'), rows = () => card.locator('ul[aria-label="Versions"] > li').evaluateAll(ls => ls.map(l => l.getAttribute('aria-label').slice(8)));
    await page.route(u => u.pathname === '/api/chat/status', r => r.fulfill({ json: { enabled: true, model: 'mock-model', via: 'mock' } }));
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter'); await idle();
    await page.click('[aria-label="Project and versions"]'); await card.waitFor({ timeout: 5000 });
    await card.locator('[aria-label="Open folder"]').click(); await card.locator('[aria-label="Project"]').waitFor({ timeout: 5000 });
    await card.locator('[aria-label="Version name"]').fill('Base'); await card.locator('[aria-label="Make version"]').click();
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Versions panel"] ul[aria-label="Versions"] > li').length === 1, null, { timeout: 10000 });
    // The turn's answer, made from the project's files: the part with a parameter, and the log with the agent's version of it.
    const back = await page.evaluate(async ([name, repo]) => {
      const L = await import(`/@fs${repo}/packages/barocss-cad-model/src/versions/log.ts`);
      const meta = await (await (await navigator.storage.getDirectory()).getDirectoryHandle(name)).getDirectoryHandle('.barocss');
      const text = async (d, f) => (await (await (await meta.getDirectoryHandle(d)).getFileHandle(f)).getFile()).text();
      const index = JSON.parse(await text('versions', 'Untitled.bcad.json')), snapshots = {};
      for (const v of index.versions) snapshots[v.snapshot] = JSON.parse(await text('snapshots', `${v.snapshot}.bcad`));
      const doc = { ...window.__studioDoc, parameters: { ...window.__studioDoc.parameters, agent: 1 } };
      return { doc, versions: L.makeVersion({ ...index, snapshots }, doc, { at: new Date().toISOString(), name: 'Agent', by: 'agent' }).log };
    }, [folder, resolve(root, '../..')]);
    await page.click('[aria-label="Chat"]');
    await page.waitForFunction(() => !!window.__studioScriptChat);
    await page.evaluate(turns => window.__studioScriptChat(turns), [[{ type: 'tool', name: 'history', input: { action: 'version', name: 'Agent' }, summary: 'version Agent', isError: false },
      { type: 'text', delta: 'Kept the part as version Agent.' }, { type: 'done', doc: back.doc, versions: back.versions, session: 'cg6', end: 'done' }]]);
    const input = page.locator('[aria-label="Chat message"]');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled);
    await input.fill('keep this as a version'); await press('Enter');
    await page.waitForSelector('.chat-msg.assistant:has-text("version Agent")', { timeout: 30000 });
    // What the turn sent: the index whole, only the head's document.
    const sent = await page.evaluate(() => window.__studioChatSent()[0].versions);
    assert.deepEqual([sent.versions.length, Object.keys(sent.snapshots).length, sent.current], [1, 1, 'main']);
    // What came back: the agent's version in the card and in the folder's log, the part with its parameter.
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Versions panel"] ul[aria-label="Versions"] > li').length === 2, null, { timeout: 10000 });
    assert.deepEqual(await rows(), ['Agent', 'Base']);
    assert.equal(await page.evaluate(() => window.__studioDoc.parameters.agent), 1);
    const kept = await page.evaluate(async name => {
      const meta = await (await (await navigator.storage.getDirectory()).getDirectoryHandle(name)).getDirectoryHandle('.barocss');
      const file = await (await (await meta.getDirectoryHandle('versions')).getFileHandle('Untitled.bcad.json')).getFile();
      return JSON.parse(await file.text()).versions.map(v => [v.name, v.by ?? null]);
    }, folder);
    assert.deepEqual(kept, [['Base', null], ['Agent', 'agent']]);
    await page.click('[aria-label="Chat"]');
    await card.locator('[aria-label="Close project"]').click(); await page.click('[aria-label="Project and versions"]');
    await page.unroute(u => u.pathname === '/api/chat/status');
    await page.evaluate(async name => (await navigator.storage.getDirectory()).removeEntry(name, { recursive: true }), folder);
  });

  await check('G15b studio light: Softboxes and the Cyclorama from the Render panel light the part (kept as the environment\'s studio, its strength), an image replaces them, Sky and ground again none', async () => {
    await page.click('.mode button:text-is("Render")'); await page.waitForSelector('[aria-label="Render"]');
    await page.click('.render-panel [role="tab"]:text-is("Appearance")');
    await page.selectOption('[aria-label="Appearance preset"]', 'look-machined-steel');
    await page.click('.render-panel [role="tab"]:text-is("Scene")');
    const env = () => page.evaluate(() => window.__studioDoc.render.environment);
    const gpu = renderer === 'webgpu';
    // (Step 48 left an image: Sky and ground first, the image gone.)
    await page.selectOption('.render-panel [aria-label="Studio environment"]', '');
    await page.waitForFunction(() => !window.__studioDoc.render.environment.map && !window.__studioDoc.render.environment.studio);
    const mean = async () => { await idle(); await page.waitForTimeout(700); const f = await page.evaluate(() => window.__studioFrame(48)); return f.reduce((a, b) => a + b, 0) / f.length; };
    const sky = gpu ? await mean() : 0;
    await page.selectOption('.render-panel [aria-label="Studio environment"]', 'softbox');
    await page.waitForFunction(() => window.__studioDoc.render.environment.studio?.kind === 'softbox');
    assert.deepEqual((await env()).studio, { kind: 'softbox', intensity: 1 });
    const softbox = gpu ? await mean() : 0; if (gpu) await snap('g15b-softbox');
    await page.evaluate(() => { const el = document.querySelector('.render-panel [aria-label="Environment strength"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '2'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => window.__studioDoc.render.environment.studio?.intensity === 2);
    const brighter = gpu ? await mean() : 0;
    await page.selectOption('.render-panel [aria-label="Studio environment"]', 'cyclorama');
    await page.waitForFunction(() => window.__studioDoc.render.environment.studio?.kind === 'cyclorama' && window.__studioDoc.render.environment.studio.intensity === 2);
    if (gpu) await snap('g15b-cyclorama');
    // An image replaces the studio (its strength kept); Sky and ground drops both.
    await page.setInputFiles('.render-panel [aria-label="Environment image"]', join(root, 'test/fixtures/sky.png'));
    await page.waitForFunction(() => /^data:image/.test(window.__studioDoc.render.environment.map?.image ?? '') && !window.__studioDoc.render.environment.studio, null, { timeout: 5000 });
    assert.equal((await env()).map.intensity, 2);
    assert.equal(await page.inputValue('.render-panel [aria-label="Studio environment"]'), 'image');
    await page.selectOption('.render-panel [aria-label="Studio environment"]', '');
    await page.waitForFunction(() => !window.__studioDoc.render.environment.map && !window.__studioDoc.render.environment.studio);
    if (gpu) {
      console.log(`  G15b: frame mean sky ${sky.toFixed(1)}, softbox ${softbox.toFixed(1)}, ×2 ${brighter.toFixed(1)}`);
      assert.ok(Math.abs(softbox - sky) > 1, 'the softbox room lights the part differently');
      assert.ok(brighter > softbox + 0.5, `twice as strong, brighter: ${softbox.toFixed(1)} → ${brighter.toFixed(1)}`);
    }
    await page.click('.render-panel [role="tab"]:text-is("Appearance")');
    await page.selectOption('[aria-label="Appearance preset"]', 'look-steel');
    await page.click('.mode button:text-is("Model")');
  });
  await check('G15d.2 bloom: a chrome box under the softboxes at twice the exposure — the Bloom slider keeps post.bloom and glows its highlights; at 0 the post leaves the document', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await page.waitForTimeout(300); await press('Enter'); await idle();
    await page.click('.mode button:text-is("Render")'); await page.waitForSelector('[aria-label="Render"]');
    await press('Escape');
    await page.click('.render-panel [role="tab"]:text-is("Appearance")');
    await page.selectOption('[aria-label="Appearance preset"]', 'look-chrome');
    await page.click('.render-panel [role="tab"]:text-is("Scene")');
    await page.selectOption('.render-panel [aria-label="Studio environment"]', 'softbox');
    const slide = async (label, v) => { await page.evaluate(([l, x]) => { const el = document.querySelector(`.render-panel [aria-label="${l}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [label, v]); };
    await slide('Exposure', 2);
    await page.waitForFunction(() => window.__studioDoc.render.environment.exposure === 2 && window.__studioDoc.render.environment.studio?.kind === 'softbox');
    const gpu = renderer === 'webgpu', N = 64;
    const frame = async () => { await idle(); await page.waitForTimeout(700); return page.evaluate(n => window.__studioFrame(n), N); };
    const before = gpu ? await frame() : null;
    await slide('Bloom', 1);
    await page.waitForFunction(() => window.__studioDoc.render.environment.post?.bloom === 1);
    if (gpu) {
      const after = await frame(); await snap('g15d2-bloom');
      // (The glow: samples brighter with it — round the highlights, onto the background.)
      let up = 0; for (let k = 0; k < after.length; k++) if (after[k] > before[k] + 6) up++;
      console.log(`  G15d.2: ${up} of ${after.length} samples brighter with the bloom`);
      assert.ok(up > 60, `the bloom glows: ${up} samples brighter`);
    }
    await slide('Bloom', 0);
    await page.waitForFunction(() => window.__studioDoc.render.environment.post === undefined, null, { timeout: 5000 });
    await slide('Exposure', 1);
    await page.selectOption('.render-panel [aria-label="Studio environment"]', '');
    await page.click('.mode button:text-is("Model")');
  });
} finally {
  await browser.close(); await server.close();
}

const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? 'ok' : 'FAIL'} ${r.step} ${r.name}${r.ok ? '' : ' — ' + r.error}`);
if (errors.length) console.log('page errors:', errors.slice(0, 5));
if (sawLoad) console.log(`note: the page reloaded ${sawLoad} time${sawLoad > 1 ? 's' : ''} without the flow asking`);
if (changedFiles.length) console.log(`note: ${changedFiles.length} file change${changedFiles.length > 1 ? 's' : ''} under the dev server during the run, the first in step ${changedFiles[0][0]}: ${changedFiles.slice(0, 3).map(x => x[1]).join(', ')}`);
console.log(`screenshots: ${out}`);
process.exit(failed.length || errors.length ? 1 : 0);
