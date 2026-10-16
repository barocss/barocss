// QA probe (real app): drives the studio in Chromium like a CAD user and reads numbers back from the
// properties panel, the measure card, the HUD and exported files. Each case records expected vs actual
// and a screenshot; nothing here asserts-and-stops, so one finding does not hide the next.
//   PW_DIR=/path/to/node_modules/playwright [CHROME=/path/to/chrome] node test/qa/ui-probe.mjs [out-dir] [case-filter]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '../..');
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const out = resolve(process.argv[2] ?? join(tmpdir(), 'cad-studio-qa'));
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
mkdirSync(out, { recursive: true });

const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52044, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
let errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + String(e).split('\n')[0]));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().split('\n')[0]); });
page.on('dialog', d => d.accept());

const rows = [];
let n = 0;
/** One case: fn returns { expected, actual, ok, note? }; a throw is recorded as the actual result. */
async function probe(id, name, fn) {
  if (only && !only.test(id)) return;
  n++; errors = [];
  let r;
  try { r = await fn(); } catch (e) { r = { ok: false, actual: 'THREW: ' + String(e.message ?? e).split('\n')[0] }; }
  const shot = join(out, `${id}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50)}.png`);
  await page.screenshot({ path: shot }).catch(() => {});
  const row = { id, name, ...r, ...(errors.length ? { consoleErrors: errors.slice(0, 4) } : {}), screenshot: shot };
  if (errors.length) row.ok = false;
  rows.push(row); console.log(JSON.stringify(row));
}

const press = k => page.keyboard.press(k);
const doc = () => page.evaluate(() => window.__studioDoc);
const outliner = () => page.locator('.outliner').innerText();
const idle = () => page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? ''), null, { timeout: 30000 });
const hudReady = async () => { await page.waitForTimeout(250); return page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 }); };
const hudStatus = () => page.locator('.hud .status').innerText().catch(() => null);
const hudError = () => page.locator('.hud-error').innerText().catch(() => '');
const field = label => page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input, select');
const setField = async (label, v) => { await field(label).fill(String(v)); await hudReady(); await page.waitForTimeout(300); await hudReady(); };
const canvasCenter = async () => { const b = await page.locator('canvas').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const clickAt = async (x, y) => { await page.mouse.move(x - 4, y); await page.mouse.move(x, y); await page.mouse.click(x, y); };
const newPart = async () => { await press('Escape'); await page.click('[aria-label="New part"]'); await idle(); };
const bodiesText = async () => (/(\d+) bod/.exec(await outliner()) ?? [])[1];
/** Selects body row k and returns the BODY numbers from the properties panel. */
async function bodyProps(k = 0) {
  await page.locator('.outliner .ol').nth(k).click(); await page.waitForTimeout(150);
  const t = await page.locator('[aria-label="Selection"]').innerText();
  const num = re => { const m = re.exec(t); return m ? Number(m[1].replace(/,/g, '')) : null; };
  const b = /Bounds\s*([\d.\-]+) × ([\d.\-]+) × ([\d.\-]+)/.exec(t);
  return { volume: num(/Volume\s*([\d.,\-]+) mm³/), mass: num(/Mass\s*([\d.,\-]+) g/), faces: num(/Faces\s*(\d+)/), bounds: b ? b.slice(1).map(Number) : null };
}
async function makeBox(w, d, h, x, y, z) {
  await press('b'); await hudReady();
  for (const [l, v] of [['Width X', w], ['Depth Y', d], ['Height Z', h], ['At X', x], ['At Y', y], ['At Z', z]]) if (v !== undefined) await field(l).fill(String(v));
  await hudReady(); await page.waitForTimeout(400); await hudReady();
  const st = await hudStatus(); if (st !== 'preview') return { refused: await hudError() };
  await press('Enter'); await idle(); await page.waitForTimeout(200); return { ok: true };
}
const near = (a, b, tol = 1) => a !== null && Math.abs(a - b) <= tol;
const PI = Math.PI;

try {
  await page.goto(url); await idle();
  await page.waitForSelector('.viewport[data-renderer]', { timeout: 15000 });
  const rendererKind = await page.locator('.viewport').getAttribute('data-renderer');
  console.log(JSON.stringify({ renderer: rendererKind }));

  // ---------------------------------------------------------------------------------------- data
  await probe('U01', 'starter plate properties vs hand values', async () => {
    const p = await bodyProps(0), v = 64 * 32 * 8 - PI * 16 * 8;
    const exp = { volume: Math.round(v), mass: Math.round(v * 2.7 / 100) / 10, faces: 7, bounds: [64, 32, 8] };
    return { ok: p.volume === exp.volume && p.mass === exp.mass && p.faces === 7 && String(p.bounds) === '64,32,8', expected: exp, actual: p };
  });
  await probe('U02', 'measure top↔bottom face and the top face area', async () => {
    await press('Escape');
    await page.evaluate(() => window.__studioSelectFace('n1.top'));
    await press(' '); await page.locator('.palette input').fill('measure'); await press('Enter');
    await page.waitForSelector('[aria-label="Measurement"]'); await page.waitForTimeout(300);
    await page.evaluate(() => window.__studioPickFace('n1.bottom'));
    await page.waitForFunction(() => /Normal distance/.test(document.querySelector('[aria-label="Measurement"]')?.textContent ?? ''), null, { timeout: 5000 });
    const t = await page.locator('[aria-label="Measurement"]').innerText();
    const area = Number((/Area\s*([\d.]+) mm²/.exec(t) ?? [])[1]), dist = Number((/Normal distance\s*([\d.]+) mm/.exec(t) ?? [])[1]);
    const want = 64 * 32 - PI * 16;
    await press('Escape');
    return { ok: Math.abs(area - want) < 0.6 && dist === 8, expected: { topArea: +want.toFixed(2), normalDistance: 8 }, actual: { topArea: area, normalDistance: dist }, note: 'area is from the display mesh (polygonal hole), within 0.6 mm²' };
  });
  await probe('U03', 'measure the hole rim edge: radius 4, length 8π', async () => {
    const r = await page.evaluate(() => { const d = window.__studioDoc; return d.nodes.length; });
    // The rim is the arc edge between the plate top and the hole wall (names from test/qa/names-probe.ts).
    const names = await page.evaluate(() => ['n1.top|n2.side0#1'].map(n => window.__studioSelectEdge(n)));
    await page.waitForTimeout(200);
    const t = await page.locator('[aria-label="Selection"]').innerText().catch(() => '');
    return { ok: /Radius\s*4\b/.test(t) && /Length\s*25\.1\d/.test(t), expected: 'Arc · Length 25.13 · Radius 4', actual: { panel: t.replace(/\s+/g, ' ').slice(0, 200), hooks: names, nodes: r }, };
  });

  // ------------------------------------------------------------------------- HUD numeric edge cases
  await newPart();
  for (const [id, label, value, wantRe] of [
    ['U10', 'Width X', '0', /greater than zero|positive|Enter a value/i],
    ['U11', 'Width X', '-5', /greater than zero|positive|range/i],
    ['U12', 'Height Z', '1000000', /range/i],
    ['U13', 'Height Z', '', /Enter a value/i],
    ['U14', 'Height Z', '0.0001', null],
  ]) {
    await probe(id, `box HUD ${label} = "${value}"`, async () => {
      await press('Escape'); await press('b'); await hudReady();
      await field(label).fill(value); await page.waitForTimeout(400); await hudReady(); await page.waitForTimeout(300);
      const st = await hudStatus(), err = await hudError(), applyDisabled = await page.locator('.hud button.primary').isDisabled();
      await press('Escape');
      if (!wantRe) return { ok: true, expected: 'a 32×32×0.0001 preview or a reasoned refusal', actual: { status: st, error: err.replace(/\s+/g, ' ').slice(0, 160), applyDisabled } };
      return { ok: st === 'refused' && wantRe.test(err) && applyDisabled, expected: `refused, ${wantRe}`, actual: { status: st, error: err.replace(/\s+/g, ' ').slice(0, 200), applyDisabled } };
    });
  }

  // ------------------------------------------------------------------- plate + hole by the HUD (spec case)
  await probe('U20', '64×32×8 box + Ø8 hole through the top face at (32,16)', async () => {
    await newPart(); await makeBox(64, 32, 8, 0, 0, 0);
    await page.click('.views button:text-is("Top")'); await page.waitForTimeout(300);
    const [cx, cy] = await canvasCenter(); await clickAt(cx, cy);
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16'); await hudReady(); await page.waitForTimeout(300); await hudReady();
    await press('Enter'); await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 }); await idle();
    const p = await bodyProps(0), v = 16384 - PI * 16 * 8;
    return { ok: p.volume === Math.round(v) && p.faces === 7, expected: { volume: Math.round(v), faces: 7 }, actual: p };
  });
  await probe('U21', 'feature editor: plate width 64 → 80, hole kept, volume follows', async () => {
    await press('Escape');
    await page.locator('.history .hs', { hasText: 'Extrude 8' }).click();
    const ed = l => page.locator('.node-editor .field', { has: page.locator(`span:text-is("${l}")`) }).locator('input, select');
    await ed('Width').fill('80'); await page.locator('.node-editor button', { hasText: 'Apply' }).click(); await idle(); await page.waitForTimeout(300);
    const p = await bodyProps(0), v = 80 * 32 * 8 - PI * 128;
    return { ok: p.volume === Math.round(v) && String(p.bounds) === '80,32,8', expected: { volume: Math.round(v), bounds: [80, 32, 8] }, actual: p };
  });
  await probe('U22', 'feature editor: width 20 puts the hole off the plate → explained refusal, model kept', async () => {
    await press('Escape');
    await page.locator('.history .hs', { hasText: 'Extrude 8' }).click();
    const ed = l => page.locator('.node-editor .field', { has: page.locator(`span:text-is("${l}")`) }).locator('input, select');
    await ed('Width').fill('20'); await page.locator('.node-editor button', { hasText: 'Apply' }).click(); await page.waitForTimeout(800);
    const toast = await page.locator('.toast[role=alert]').innerText().catch(() => '');
    const d = await doc(), w = d.nodes[0].max[0] - d.nodes[0].min[0];
    await page.locator('[aria-label="Dismiss"]').click().catch(() => {});
    return { ok: /misses/i.test(toast) && w === 80, expected: 'toast "The hole misses the body", document unchanged (80)', actual: { toast: toast.replace(/\s+/g, ' ').slice(0, 160), width: w } };
  });
  await probe('U23', 'feature editor: hole diameter typed negative', async () => {
    await press('Escape');
    await page.locator('.history .hs', { hasText: 'Hole Ø8' }).click();
    const ed = l => page.locator('.node-editor .field', { has: page.locator(`span:text-is("${l}")`) }).locator('input, select');
    await ed('Diameter').fill('-8'); await page.locator('.node-editor button', { hasText: 'Apply' }).click(); await page.waitForTimeout(800);
    const toast = await page.locator('.toast[role=alert]').innerText().catch(() => '');
    await page.locator('[aria-label="Dismiss"]').click().catch(() => {}); await press('Escape');
    const d = await doc();
    return { ok: /greater than zero/i.test(toast) && d.nodes.at(-1).radius === 4, expected: 'refused: sizes must be greater than zero; radius stays 4', actual: { toast: toast.replace(/\s+/g, ' ').slice(0, 160), radius: d.nodes.at(-1).radius } };
  });
  await probe('U24', 'undo/redo restores exact volumes', async () => {
    await press('Escape'); const before = (await bodyProps(0)).volume;
    await press('Escape'); await press('Meta+z'); await idle(); await page.waitForTimeout(300);
    const undone = (await bodyProps(0)).volume;
    await press('Escape'); await press('Meta+Shift+z'); await idle(); await page.waitForTimeout(300);
    const redone = (await bodyProps(0)).volume;
    const wantUndone = Math.round(64 * 32 * 8 - PI * 128);
    return { ok: undone === wantUndone && redone === before, expected: { undone: wantUndone, redone: before }, actual: { before, undone, redone } };
  });

  // ------------------------------------------------------------------------------ fillet / chamfer limits
  for (const [id, kind, size, field_] of [['U30', 'fillet', 20, 'Radius'], ['U31', 'chamfer', 20, 'Distance'], ['U32', 'fillet', 4, 'Radius']]) {
    await probe(id, `${kind} ${size} on a 16-high box top edge`, async () => {
      await newPart(); await makeBox(32, 32, 16, 0, 0, 0);
      const ext = (await doc()).nodes.length - 1;
      const okSel = await page.evaluate(nm => window.__studioSelectEdge(nm), `n${ext}.side0|n${ext}.top`);
      await press(' '); await page.locator('.palette input').fill(kind); await press('Enter'); await hudReady();
      await setField(field_, size);
      const st = await hudStatus(), err = await hudError();
      if (st === 'preview') { await press('Enter'); await idle(); await page.waitForTimeout(300); }
      else await press('Escape');
      const p = st === 'preview' ? await bodyProps(0) : null;
      const fits = size <= 16;
      const want = kind === 'fillet' ? 16384 - (size * size - PI * size * size / 4) * 32 : 16384 - size * size / 2 * 32;
      if (!fits) return { ok: st === 'refused' && /too large/i.test(err), expected: 'refused: "The chamfer or fillet is too large" (wall is 16)', actual: { selected: okSel, status: st, error: err.replace(/\s+/g, ' ').slice(0, 120), applied: p } };
      return { ok: st === 'preview' && near(p.volume, want, 1), expected: { volume: Math.round(want) }, actual: { status: st, ...p } };
    });
  }

  // ------------------------------------------------------------------------------- sketch: shapes in one sketch
  // (A typed dimension keeps the focus in its box, where tool keys are ignored: blur first.)
  const sketchRect = async (x, y, w, h) => {
    await page.evaluate(() => document.activeElement?.blur());
    const [cx, cy] = await canvasCenter(); await press('r'); await clickAt(cx - 60, cy - 40); await clickAt(cx + 60, cy + 40);
    for (const [k, v] of [['x', x], ['y', y], ['width', w], ['height', h]]) { await page.fill('#sk-' + k, String(v)); }
  };
  const sketchCircle = async (x, y, d) => {
    await page.evaluate(() => document.activeElement?.blur());
    const [cx, cy] = await canvasCenter(); await press('c'); await clickAt(cx + 100, cy + 100); await page.mouse.move(cx + 110, cy + 100); await page.mouse.click(cx + 115, cy + 100);
    await page.fill('#sk-cx', String(x)); await page.fill('#sk-cy', String(y)); await page.fill('#sk-diameter', String(d));
  };
  const finishExtrude = async h => {
    await page.evaluate(() => document.activeElement?.blur());
    await page.click('.topbar button.finish'); await page.waitForTimeout(300);
    const hud = await page.locator('.hud').count();
    if (!hud) return { finished: false, toast: (await page.locator('.toast[role=alert]').innerText().catch(() => '')).replace(/\s+/g, ' ') };
    await hudReady(); if (h !== undefined) await setField('Distance', h);
    const st = await hudStatus(); if (st !== 'preview') { const e = await hudError(); await press('Escape'); return { finished: true, status: st, error: e }; }
    await press('Enter'); await idle(); await page.waitForTimeout(300); return { finished: true, status: st };
  };
  await probe('U40', 'one sketch: 40×20 rectangle with a Ø10 circle inside → plate with a hole', async () => {
    await newPart(); await press('s'); await sketchRect(0, 0, 40, 20); await sketchCircle(20, 10, 10);
    const r = await finishExtrude(5); const p = r.status === 'preview' ? await bodyProps(0) : null, want = (800 - PI * 25) * 5;
    return { ok: !!p && near(p.volume, want), expected: { volume: Math.round(want) }, actual: { ...r, ...p } };
  });
  await probe('U41', 'one sketch: rectangle + circle overlapping its TOP edge (centre 20,19)', async () => {
    await newPart(); await press('s'); await sketchRect(0, 0, 40, 20); await sketchCircle(20, 19, 10);
    const r = await finishExtrude(5); const p = r.status === 'preview' ? await bodyProps(0) : null;
    const seg = 25 * Math.acos(0.2) - Math.sqrt(24), union = (800 + PI * 25 - seg) * 5, notch = (800 - (PI * 25 - seg)) * 5;
    return { ok: !!p && near(p.volume, union), expected: { volume: Math.round(union), why: 'two overlapping closed shapes should merge (or be refused); a notch would be ' + Math.round(notch) }, actual: { ...r, ...p, nodes: (await doc()).nodes.map(n => n.kind + (n.holes ? ' holes:' + n.holes.length : '') + (n.regions ? ' regions:' + n.regions.length : '')) } };
  });
  await probe('U42', 'one sketch: rectangle + circle overlapping its RIGHT edge (centre 38,10)', async () => {
    await newPart(); await press('s'); await sketchRect(0, 0, 40, 20); await sketchCircle(38, 10, 10);
    const r = await finishExtrude(5); const p = r.status === 'preview' ? await bodyProps(0) : null;
    const segOut = 25 * Math.acos(0.4) - 2 * Math.sqrt(21), union = (800 + segOut) * 5;
    return { ok: !!p && near(p.volume, union), expected: { volume: Math.round(union), compare: 'U41 is the same situation on another edge' }, actual: { ...r, ...p } };
  });
  await probe('U43', 'one sketch: two overlapping rectangles (0,0 10×10 and 5,5 10×10)', async () => {
    await newPart(); await press('s'); await sketchRect(0, 0, 10, 10); await sketchRect(5, 5, 10, 10);
    const r = await finishExtrude(5); const p = r.status === 'preview' ? await bodyProps(0) : null;
    return { ok: !!p && near(p.volume, 875), expected: { volume: 875, area: 175 }, actual: { ...r, ...p } };
  });
  await probe('U44', 'one sketch: circle Ø20 then a rectangle overlapping it (each first point inside the other)', async () => {
    await newPart(); await press('s'); await sketchCircle(0, 0, 20); await sketchRect(5, -3, 15, 6);
    const r = await finishExtrude(5);
    const p = r.status === 'preview' ? await bodyProps(0) : null;
    return { ok: !!p, expected: 'one merged body (circle ∪ rectangle) or a reasoned refusal', actual: { ...r, ...p, sketchStillOpen: !!(await page.locator('.sk-panel').count()) } };
  });
  await press('Escape');

  // ------------------------------------------------------------------------- sketch on faces, planes
  await probe('U50', 'sketch on the front face, cut through-all 20×10 window on a 32×32×16 box', async () => {
    await newPart(); await makeBox(32, 32, 16, 0, 0, 0);
    await page.click('.views button:text-is("Front")'); await press('f'); await page.waitForTimeout(400);
    const [cx, cy] = await canvasCenter(); await clickAt(cx, cy);
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('s'); await page.waitForFunction(() => /on face/.test(document.querySelector('.sk-panel')?.textContent ?? ''));
    await sketchRect(6, 3, 20, 10);
    await page.evaluate(() => document.activeElement?.blur()); await page.click('.topbar button.finish'); await hudReady();
    await field('Operation').selectOption('cut'); await field('Depth').selectOption('through'); await hudReady(); await page.waitForTimeout(300); await hudReady();
    await press('Enter'); await idle(); await page.waitForTimeout(300);
    const p = await bodyProps(0), want = 16384 - 20 * 10 * 32;
    return { ok: near(p.volume, want) && (await bodiesText()) === '1', expected: { volume: want }, actual: p };
  });
  await probe('U51', 'sketch on XZ plane offset 5: circle Ø10 at (10,8) extruded 12', async () => {
    await newPart(); await press('s'); await page.selectOption('[aria-label="Sketch plane"]', 'xz'); await page.fill('[aria-label="Plane offset"]', '5');
    await sketchCircle(10, 8, 10);
    const r = await finishExtrude(12); const p = r.status === 'preview' ? await bodyProps(0) : null;
    // XZ faces −Y: offset 5 puts the plane at y = −5, the solid grows to y = −17.
    const pl = (await doc()).nodes[0].plane;
    return { ok: !!p && near(p.volume, PI * 25 * 12) && String(p.bounds) === '10,12,10', expected: { volume: Math.round(PI * 300), bounds: [10, 12, 10], plane: 'origin y −5, normal −Y' }, actual: { ...r, ...p, plane: pl } };
  });
  await probe('U52', 'sketch on a 30° plane: 30×20 rectangle extruded 8 (volume is area × height)', async () => {
    await newPart(); await press('s'); await page.fill('[aria-label="Plane angle"]', '30'); await sketchRect(0, 0, 30, 20);
    const r = await finishExtrude(8); const p = r.status === 'preview' ? await bodyProps(0) : null;
    return { ok: !!p && p.volume === 4800 && p.faces === 6, expected: { volume: 4800, faces: 6 }, actual: { ...r, ...p } };
  });
  await probe('U53', 'chamfer a box edge, then sketch on the sloped chamfer face and extrude', async () => {
    await newPart(); await makeBox(32, 32, 16, 0, 0, 0);
    const ext = (await doc()).nodes.length - 1;
    await page.evaluate(nm => window.__studioSelectEdge(nm), `n${ext}.side0|n${ext}.top`);
    await press(' '); await page.locator('.palette input').fill('chamfer'); await press('Enter'); await hudReady(); await setField('Distance', 8); await press('Enter'); await idle(); await page.waitForTimeout(300);
    const before = (await bodyProps(0)).volume;
    const ch = (await doc()).nodes.length - 1;
    const faceName = await page.evaluate(i => { const b = window.__studioDoc; return `n${i}.face`; }, ch);
    const sel = await page.evaluate(nm => window.__studioSelectFace(nm), faceName);
    const panel = await page.locator('[aria-label="Selection"]').innerText();
    await press('s'); await page.waitForTimeout(400);
    const skLabel = await page.locator('.sk-panel .card-title').innerText().catch(() => '');
    await sketchRect(10, 2, 10, 6);
    const r = await finishExtrude(3); const p = r.status === 'preview' ? await bodyProps(0) : null;
    return { ok: !!p && near(p.volume, before + 180), expected: { volume: before + 180, before }, actual: { selectedFace: sel, faceName, faceNormal: (/Normal\s*([^\n]+)/.exec(panel) ?? [])[1], sketch: skLabel, ...r, ...p } };
  });
  await probe('U55', 'fresh box: chamfer 8, select only the chamfer face, press H', async () => {
    await newPart(); await makeBox(32, 32, 16, 0, 0, 0);
    const ext = (await doc()).nodes.length - 1;
    await page.evaluate(nm => window.__studioSelectEdge(nm), `n${ext}.side0|n${ext}.top`);
    await press(' '); await page.locator('.palette input').fill('chamfer'); await press('Enter'); await hudReady(); await setField('Distance', 8); await press('Enter'); await idle(); await page.waitForTimeout(400);
    const ch = (await doc()).nodes.length - 1;
    const sel = await page.evaluate(nm => window.__studioSelectFace(nm), `n${ch}.face`); await page.waitForTimeout(200);
    const panel = (await page.locator('[aria-label="Selection"]').innerText()).replace(/\s+/g, ' ');
    const title = await page.locator('[aria-label="Hole"]').getAttribute('title').catch(() => null);
    await press('h'); await page.waitForTimeout(400);
    const toast = (await page.locator('.toast[role=alert]').innerText().catch(() => '')).replace(/\s+/g, ' ');
    await page.locator('[aria-label="Dismiss"]').click().catch(() => {});
    return { ok: /±X, ±Y or ±Z/.test(toast), expected: 'Hole can’t run here · Holes go into a flat face facing ±X, ±Y or ±Z', actual: { selected: sel, panel: panel.slice(0, 90), toolbarTitle: title, toast } };
  });
  await probe('U56', 'measure the angle between the top face and a side face of a box', async () => {
    await press('Escape'); await newPart(); await makeBox(20, 10, 5, 0, 0, 0);
    const ext = (await doc()).nodes.length - 1;
    await page.evaluate(nm => window.__studioSelectFace(nm), `n${ext}.top`);
    await press(' '); await page.locator('.palette input').fill('measure'); await press('Enter'); await page.waitForSelector('[aria-label="Measurement"]'); await page.waitForTimeout(300);
    await page.evaluate(nm => window.__studioPickFace(nm), `n${ext}.side1`); await page.waitForTimeout(300);
    const t = (await page.locator('[aria-label="Measurement"]').innerText()).replace(/\s+/g, ' ');
    await press('Escape');
    return { ok: /Angle 90°/.test(t) && /Distance 0 mm/.test(t), expected: 'Angle 90°, Distance 0 (they share an edge)', actual: t.slice(0, 260) };
  });
  await probe('U57', 'mirror YZ of a box at x 5..15, then split the result at X=0', async () => {
    await newPart(); await makeBox(10, 10, 10, 5, 0, 0);
    await page.locator('.outliner .ol').first().click(); await press('m'); await hudReady(); await press('Enter'); await idle(); await page.waitForTimeout(300);
    const m = await bodyProps(0);
    await press('Escape'); await page.locator('.outliner .ol').first().click();
    await press(' '); await page.locator('.palette input').fill('split'); await press('Enter'); await hudReady(); await setField('At', 0);
    const st = await hudStatus(), err = (await hudError()).replace(/\s+/g, ' ');
    if (st === 'preview') { await press('Enter'); await idle(); await page.waitForTimeout(300); } else await press('Escape');
    return { ok: m.volume === 2000 && String(m.bounds) === '30,10,10', expected: { mirror: { volume: 2000, bounds: [30, 10, 10] }, splitAt0: 'two bodies of 1000, or a refusal (the plane lies in the gap)' }, actual: { mirror: m, split: { status: st, error: err.slice(0, 160), bodies: await bodiesText() } } };
  });
  await probe('U58', 'cylinder (Y) r8 h24: volume, faces', async () => {
    await newPart(); await press('y'); await hudReady(); await setField('Centre X', 0); await press('Enter'); await idle(); await page.waitForTimeout(300);
    const p = await bodyProps(0), want = PI * 64 * 24;
    return { ok: p.volume === Math.round(want) && p.faces === 3, expected: { volume: Math.round(want), faces: 3 }, actual: p };
  });
  await probe('U59', 'sketch snapping: corners drawn with the mouse land on whole millimetres', async () => {
    await newPart(); await press('s'); const [cx, cy] = await canvasCenter(); await press('r');
    await clickAt(cx - 73.3, cy - 41.7); await clickAt(cx + 58.6, cy + 37.2);
    await page.evaluate(() => document.activeElement?.blur()); await press('Enter'); await hudReady(); await press('Enter'); await idle();
    const s = (await doc()).nodes[0];
    const all = [...s.min, ...s.max];
    return { ok: all.every(v => Number.isInteger(v)), expected: 'integer corner coordinates (Snap 1 mm)', actual: { min: s.min, max: s.max } };
  });
  // ---------------------------------------------------------------------------------- features via UI
  await probe('U60', 'revolve rectangle (10..20, 0..10) about Y, 360° → tube', async () => {
    await newPart(); await press(' '); await page.locator('.palette input').fill('revolve'); await press('Enter');
    await press('r'); await sketchRect(10, 0, 10, 10);
    await page.evaluate(() => document.activeElement?.blur()); await page.click('.topbar button.finish'); await hudReady(); await page.waitForTimeout(300);
    const st = await hudStatus(); if (st === 'preview') { await press('Enter'); await idle(); await page.waitForTimeout(300); }
    const p = st === 'preview' ? await bodyProps(0) : null;
    return { ok: !!p && near(p.volume, PI * 3000), expected: { volume: Math.round(PI * 3000) }, actual: { status: st, error: await hudError(), ...p } };
  });
  await probe('U61', 'revolve with angle typed 0 in the HUD', async () => {
    await newPart(); await press(' '); await page.locator('.palette input').fill('revolve'); await press('Enter');
    await press('r'); await sketchRect(10, 0, 10, 10);
    await page.evaluate(() => document.activeElement?.blur()); await page.click('.topbar button.finish'); await hudReady();
    await setField('Angle', 0);
    const st = await hudStatus(), err = await hudError(); await press('Escape');
    return { ok: st === 'refused' && !/could not build/i.test(err), expected: 'refused with a plain reason (angle must be 1–360°)', actual: { status: st, error: err.replace(/\s+/g, ' ').slice(0, 200) } };
  });
  await probe('U62', 'extrude with a 60° draft that closes the walls', async () => {
    await newPart(); await press('s'); await sketchRect(0, 0, 10, 10);
    await page.evaluate(() => document.activeElement?.blur()); await page.click('.topbar button.finish'); await hudReady();
    await setField('Distance', 20); await setField('Draft', 60);
    const st = await hudStatus(), err = await hudError(); await press('Escape');
    return { ok: st === 'refused' && !/could not build/i.test(err), expected: 'refused with a plain reason (draft too steep for this height)', actual: { status: st, error: err.replace(/\s+/g, ' ').slice(0, 220) } };
  });
  await probe('U63', 'pipe: circle Ø10, run 8, bend R20 90°, run 8', async () => {
    await newPart(); await press(' '); await page.locator('.palette input').fill('pipe'); await press('Enter');
    await sketchCircle(0, 0, 10);
    await page.evaluate(() => document.activeElement?.blur()); await page.click('.topbar button.finish'); await hudReady();
    await setField('Distance', 8); await setField('Pipe bend radius', 20); await setField('Angle', 90);
    const st = await hudStatus(); if (st === 'preview') { await press('Enter'); await idle(); await page.waitForTimeout(300); }
    const p = st === 'preview' ? await bodyProps(0) : null, want = PI * 25 * (16 + 10 * PI);
    return { ok: !!p && near(p.volume, want), expected: { volume: Math.round(want) }, actual: { status: st, ...p, path: (await doc()).nodes.at(-1).path } };
  });
  await probe('U64', 'pipe HUD: the default Angle reads 360° but the bend is built as 90°', async () => {
    await newPart(); await press(' '); await page.locator('.palette input').fill('pipe'); await press('Enter');
    await sketchCircle(0, 0, 10);
    await page.evaluate(() => document.activeElement?.blur()); await page.click('.topbar button.finish'); await hudReady();
    const shown = await field('Angle').inputValue();
    const st = await hudStatus(); if (st === 'preview') { await press('Enter'); await idle(); }
    const built = (await doc()).nodes.at(-1)?.path?.[1]?.angleDegrees;
    return { ok: Number(shown) === built, expected: 'the HUD shows the bend angle that is built', actual: { hudAngle: shown, builtBendAngle: built } };
  });
  await probe('U65', 'loft 20×20 → 50% square over 10 (frustum)', async () => {
    await newPart(); await press(' '); await page.locator('.palette input').fill('loft'); await press('Enter');
    await sketchRect(0, 0, 20, 20);
    await page.evaluate(() => document.activeElement?.blur()); await page.click('.topbar button.finish'); await hudReady();
    await setField('Distance', 10);
    const st = await hudStatus(); if (st === 'preview') { await page.locator('.hud button', { hasText: 'Apply' }).click(); await idle(); await page.waitForTimeout(300); }
    const p = st === 'preview' ? await bodyProps(0) : null, want = 10 / 3 * 700;
    return { ok: !!p && near(p.volume, want), expected: { volume: Math.round(want) }, actual: { status: st, ...p } };
  });
  await probe('U66', 'shell 2 open top on 32×32×16, then the Wall typed 8 (no hollow)', async () => {
    await newPart(); await makeBox(32, 32, 16, 0, 0, 0);
    const ext = (await doc()).nodes.length - 1;
    await page.evaluate(nm => window.__studioSelectFace(nm), `n${ext}.top`);
    await press(' '); await page.locator('.palette input').fill('shell'); await press('Enter'); await hudReady();
    await setField('Wall', 16); const thick = { status: await hudStatus(), error: (await hudError()).replace(/\s+/g, ' ').slice(0, 120) };
    await setField('Wall', 2); await press('Enter'); await idle(); await page.waitForTimeout(300);
    const p = await bodyProps(0);
    return { ok: p.volume === 5408 && thick.status === 'refused' && /too thick/i.test(thick.error), expected: { volume: 5408, wall16: 'refused: too thick' }, actual: { ...p, wall16: thick } };
  });
  await probe('U67', 'linear pattern ×3 with spacing smaller than the body (overlapping copies)', async () => {
    await newPart(); await makeBox(16, 16, 16, 0, 0, 0);
    await page.locator('.outliner .ol').first().click();
    await press('p'); await hudReady(); await setField('Spacing', 8); await setField('Count', 3);
    const st = await hudStatus(); if (st === 'preview') { await press('Enter'); await idle(); await page.waitForTimeout(300); }
    const p = await bodyProps(0);
    return { ok: p.volume === 8192 && String(p.bounds) === '32,16,16', expected: { volume: 8192, bounds: [32, 16, 16] }, actual: { status: st, ...p } };
  });
  await probe('U68', 'Boolean chain: A∪B, then −C, then ∩D; volumes at each step', async () => {
    await newPart();
    await makeBox(20, 20, 10, 0, 0, 0); await makeBox(20, 20, 10, 10, 0, 0); await makeBox(10, 10, 20, 5, 5, -5); await makeBox(40, 40, 6, -5, -5, 2);
    const pick2 = async (a, b) => { const rows = page.locator('.outliner .ol'); await rows.nth(a).click(); await rows.nth(b).click({ modifiers: ['Shift'] }); };
    const steps = [];
    await pick2(0, 1); await press('u'); await idle(); await page.waitForTimeout(300);
    steps.push((await page.evaluate(() => window.__studioDoc.nodes.at(-1).kind)));
    // outliner order: the remaining sources then the new result; find rows by label
    const rowOf = async re => { const t = await page.locator('.outliner .ol').allInnerTexts(); return t.findIndex(x => re.test(x)); };
    let u = await rowOf(/Union/), c = await rowOf(/Extrude 20/);
    await pick2(u, c); await press('d'); await idle(); await page.waitForTimeout(300);
    u = await rowOf(/Subtract/); c = await rowOf(/Extrude 6/);
    await pick2(u, c); await press('i'); await idle(); await page.waitForTimeout(300);
    const p = await bodyProps(0), want = 30 * 20 * 6 - 10 * 10 * 6;
    return { ok: (await bodiesText()) === '1' && p.volume === want, expected: { volume: want, bodies: 1 }, actual: { ...p, bodies: await bodiesText(), history: (await page.locator('.history').innerText()).replace(/\s+/g, ' ') } };
  });
  await probe('U69', 'union of two boxes touching only along an edge', async () => {
    await newPart(); await makeBox(10, 10, 10, 0, 0, 0); await makeBox(10, 10, 10, 10, 10, 0);
    const rows = page.locator('.outliner .ol'); await rows.nth(0).click(); await rows.nth(1).click({ modifiers: ['Shift'] });
    await press('u'); await page.waitForTimeout(1500); await idle();
    const toast = await page.locator('.toast[role=alert]').innerText().catch(() => '');
    const d = await doc();
    await page.locator('[aria-label="Dismiss"]').click().catch(() => {});
    return { ok: d.nodes.at(-1).kind !== 'union' && /touch/i.test(toast), expected: 'refused: "The bodies only touch along an edge or a point"', actual: { lastFeature: d.nodes.at(-1).kind, outliner: (await outliner()).replace(/\s+/g, ' '), toast } };
  });

  // ------------------------------------------------------------------------- files: STEP / STL / bcad
  const download = async (label) => { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click(`[aria-label="${label}"]`)]); const p = join(out, dl.suggestedFilename()); await dl.saveAs(p); return p; };
  await probe('U70', 'STEP export of a torus, reopened: same volume', async () => {
    await newPart(); await press(' '); await page.locator('.palette input').fill('revolve'); await press('Enter');
    await sketchCircle(30, 10, 10);
    await page.evaluate(() => document.activeElement?.blur()); await page.click('.topbar button.finish'); await hudReady(); await press('Enter'); await idle(); await page.waitForTimeout(300);
    const a = await bodyProps(0);
    const f = await download('Export STEP');
    await page.locator('input[aria-label="Model file"]').setInputFiles(f); await page.waitForFunction(() => /Import/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 20000 }); await idle(); await page.waitForTimeout(1500);
    const b = await bodyProps(0);
    return { ok: a.volume === b.volume && a.faces === b.faces, expected: { volume: Math.round(2 * PI * 30 * PI * 25), original: a }, actual: { reopened: b, file: f } };
  });
  await probe('U71', 'STEP export of two separate bodies, reopened: still two bodies', async () => {
    await newPart(); await makeBox(10, 10, 10, 0, 0, 0); await makeBox(10, 10, 10, 30, 0, 0);
    const f = await download('Export STEP');
    const solids = (readFileSync(f, 'utf8').match(/MANIFOLD_SOLID_BREP/g) ?? []).length;
    await page.locator('input[aria-label="Model file"]').setInputFiles(f); await idle(); await page.waitForTimeout(800);
    return { ok: (await bodiesText()) === '2', expected: { bodies: 2, solidsInFile: 2 }, actual: { bodies: await bodiesText(), solidsInFile: solids, outliner: (await outliner()).replace(/\s+/g, ' ') } };
  });
  await probe('U72', 'STL export of the starter plate: binary size and volume', async () => {
    await newPart(); await makeBox(64, 32, 8, 0, 0, 0);
    const f = await download('Export STL'), buf = readFileSync(f), tris = buf.readUInt32LE(80);
    let v = 0; for (let t = 0; t < tris; t++) { const o = 84 + t * 50 + 12, P = [0, 1, 2].map(k => [0, 1, 2].map(c => buf.readFloatLE(o + k * 12 + c * 4))); const [a, b, c] = P; v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; }
    return { ok: buf.length === 84 + 50 * tris && Math.abs(v - 16384) < 0.01, expected: { volume: 16384, bytes: '84 + 50·n' }, actual: { triangles: tris, bytes: buf.length, volume: +v.toFixed(3), file: f } };
  });
  await probe('U73', '.bcad save then open: same document and volume', async () => {
    await newPart(); await makeBox(64, 32, 8, 0, 0, 0);
    const before = await doc(), vb = (await bodyProps(0)).volume;
    const [dl] = await Promise.all([page.waitForEvent('download'), press('Meta+s')]); const f = join(out, dl.suggestedFilename()); await dl.saveAs(f);
    await newPart(); await page.locator('input[aria-label="Model file"]').setInputFiles(f); await idle(); await page.waitForTimeout(500);
    const after = await doc(), va = (await bodyProps(0)).volume;
    const dirty = await page.locator('[aria-label="Unsaved changes"]').count();
    return { ok: JSON.stringify(after.nodes) === JSON.stringify(before.nodes) && va === vb && !dirty, expected: { volume: vb, dirty: false }, actual: { volume: va, sameNodes: JSON.stringify(after.nodes) === JSON.stringify(before.nodes), dirtyDot: !!dirty } };
  });
  await probe('U74', 'open a broken .bcad (not JSON) and a .step that is not STEP', async () => {
    const bad = join(out, 'broken.bcad'); writeFileSync(bad, '{ not json');
    await page.locator('input[aria-label="Model file"]').setInputFiles(bad); await page.waitForTimeout(500);
    const t1 = await page.locator('.toast[role=alert]').innerText().catch(() => ''); await page.locator('[aria-label="Dismiss"]').click().catch(() => {});
    const badStep = join(out, 'garbage.step'); writeFileSync(badStep, 'hello');
    const nodesBefore = (await doc()).nodes.length;
    await page.locator('input[aria-label="Model file"]').setInputFiles(badStep); await page.waitForTimeout(1500); await idle().catch(() => {});
    const t2 = await page.locator('.toast[role=alert]').innerText().catch(() => '');
    const d = await doc();
    await page.locator('[aria-label="Dismiss"]').click().catch(() => {});
    return { ok: /Could not open/i.test(t1) && !!t2 && !/could not build this/i.test(t2), expected: 'both refused with a reason; a bad STEP does not leave a broken Import feature', actual: { bcadToast: t1.replace(/\s+/g, ' ').slice(0, 140), stepToast: t2.replace(/\s+/g, ' ').slice(0, 200), nodesBefore, nodesAfter: d.nodes.length, lastKind: d.nodes.at(-1)?.kind } };
  });

  // ------------------------------------------------------------------------- recovery, rollback, undo storm
  await probe('U80', 'autosave recovery after reload restores the same document', async () => {
    await newPart(); await makeBox(64, 32, 8, 0, 0, 0); await makeBox(10, 10, 10, 100, 0, 0);
    const before = JSON.stringify((await doc()).nodes); await page.waitForTimeout(1200);
    await page.reload(); await page.waitForSelector('[aria-label="Recover unsaved work"]', { timeout: 15000 });
    await page.click('[aria-label="Recover unsaved work"] button:text-is("Restore")'); await idle(); await page.waitForTimeout(400);
    const after = JSON.stringify((await doc()).nodes);
    return { ok: before === after && (await bodiesText()) === '2', expected: '2 bodies, same nodes', actual: { same: before === after, bodies: await bodiesText() } };
  });
  await probe('U81', 'recovery offer after a crash-free reload with a sketch in progress', async () => {
    await press('s'); await sketchRect(0, 0, 10, 10); await page.waitForTimeout(1200);
    await page.reload(); const offered = await page.waitForSelector('[aria-label="Recover unsaved work"]', { timeout: 8000 }).then(() => true).catch(() => false);
    if (offered) await page.click('[aria-label="Recover unsaved work"] button:text-is("Restore")'); await idle();
    return { ok: true, expected: 'informational: an unfinished sketch is not part of the recovery copy', actual: { offered, nodes: (await doc()).nodes.length } };
  });
  await probe('U82', 'adding a feature while rolled back drops later features (toast) and undo restores them', async () => {
    await newPart(); await makeBox(32, 32, 8, 0, 0, 0); await makeBox(8, 8, 8, 0, 0, 8);
    await page.locator('.history .hs').first().dblclick(); await idle();
    const rolled = await page.locator('.history').innerText();
    await makeBox(5, 5, 5, 50, 0, 0);
    const toast = await page.locator('.toast[role=alert]').innerText().catch(() => '');
    const n1 = (await doc()).nodes.length;
    await page.locator('[aria-label="Dismiss"]').click().catch(() => {});
    await press('Meta+z'); await idle(); const n2 = (await doc()).nodes.length;
    return { ok: /Removed 1 later feature/.test(toast) && n2 === 4, expected: 'toast "Removed 1 later feature", undo back to 4 nodes', actual: { rolled: /rolled back/.test(rolled), toast: toast.replace(/\s+/g, ' '), nodesAfterAdd: n1, nodesAfterUndo: n2 } };
  });
  await probe('U83', 'there is a way to delete a feature from the history', async () => {
    await press('Escape');
    const hs = page.locator('.history .hs').first(); await hs.click({ button: 'right' }).catch(() => {});
    const ctx = await page.locator('.ctx-item').allInnerTexts().catch(() => []);
    await press('Escape'); await hs.click(); await press('Delete'); await press('Backspace'); await page.waitForTimeout(300);
    await press(' '); await page.locator('.palette input').fill('delete'); const pal = await page.locator('.palette-list').innerText().catch(() => ''); await press('Escape');
    const editor = await page.locator('.node-editor').innerText().catch(() => '');
    return { ok: /delete|remove/i.test(ctx.join(' ') + pal + editor), expected: 'a Delete/Remove feature action (history context menu, Del key, palette or editor)', actual: { contextMenu: ctx, palette: pal.replace(/\s+/g, ' ').slice(0, 120), editorButtons: (/(Apply|Reset)[^\n]*/.exec(editor) ?? [''])[0] } };
  });
  await probe('U84', 'rapid undo/redo while the kernel is computing ends in a consistent state', async () => {
    await newPart();
    for (let k = 0; k < 4; k++) await makeBox(10, 10, 10, k * 15, 0, 0);
    await page.locator('.outliner .ol').first().click(); await press('p'); await hudReady(); await setField('Count', 24); await press('Enter');
    for (let k = 0; k < 12; k++) { await press('Meta+z'); await page.waitForTimeout(15); }
    for (let k = 0; k < 7; k++) { await press('Meta+Shift+z'); await page.waitForTimeout(15); }
    await idle(); await page.waitForTimeout(800);
    const d = await doc(), shownBodies = Number(await bodiesText());
    const expected = Object.keys(d.outputs).length;
    return { ok: shownBodies === expected, expected: { bodies: expected, nodes: d.nodes.length }, actual: { outlinerBodies: shownBodies, corner: await page.locator('.corner-left').innerText() } };
  });

  // ------------------------------------------------------------------------------------ instances
  await probe('U90', 'insert bracket.bcad as an instance, rotate 45°, STEP holds part + instance', async () => {
    await newPart(); await makeBox(10, 10, 10, 0, 0, 0);
    await page.setInputFiles('input[aria-label="Part file"]', join(root, 'test/fixtures/bracket.bcad'));
    await page.waitForFunction(() => /Bodies\s*1/.test(document.querySelector('[aria-label="Instance"]')?.textContent ?? ''), null, { timeout: 15000 });
    const panel = await page.locator('[aria-label="Instance"]').innerText();
    const f = await download('Export STEP'); const solids = (readFileSync(f, 'utf8').match(/MANIFOLD_SOLID_BREP/g) ?? []).length;
    return { ok: solids === 2, expected: { solids: 2 }, actual: { solids, panel: panel.replace(/\s+/g, ' ').slice(0, 200) } };
  });

  // ===================================================================== merged at 2d9c79bc: constraints and mates
  const pinFile = join(out, 'pin.bcad');
  writeFileSync(pinFile, JSON.stringify({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 }, { kind: 'extrude', sketch: 0, height: 20 }], outputs: { b1: { node: 1, side: 'solid' } } }));
  const blockFile = join(out, 'block.bcad');
  writeFileSync(blockFile, JSON.stringify({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { kind: 'extrude', sketch: 0, height: 4 }], outputs: { b1: { node: 1, side: 'solid' } } }));
  const insert = async (f) => { const n = ((await doc()).instances ?? []).length; await page.setInputFiles('input[aria-label="Part file"]', f); await page.waitForFunction(k => (window.__studioDoc.instances ?? []).length === k + 1, n); await page.waitForSelector('[aria-label="Instance"]'); await page.waitForTimeout(800); return (await doc()).instances.at(-1).id; };
  const addMate = async (picks, kind) => {
    await page.click('[aria-label="Mates"] button:text-is("Add mate")');
    if (kind) await page.selectOption('[aria-label="Mate type"]', kind);
    for (const [part, face] of picks) { if (part === 'base') await page.evaluate(n => window.__studioPickFace(n), face); else await page.evaluate(([i, n]) => window.__studioPickInstanceFace(i, n), [part, face]); await page.waitForTimeout(200); }
    await page.waitForTimeout(500);
    return (await page.locator('[aria-label="Mate refused"]').innerText().catch(() => '')).replace(/\s+/g, ' ');
  };
  const instPos = async id => (await doc()).instances.find(i => i.id === id);

  await probe('UM1', '[assembly-mates] pin seated in the starter plate hole (base face + instance face)', async () => {
    await newPart(); await page.goto(url); await idle();   // fresh starter plate
    await page.evaluate(() => localStorage.clear());
    const pin = await insert(pinFile);
    const e1 = await addMate([['base', 'n1.top'], [pin, 'n1.bottom']]);
    const e2 = await addMate([['base', 'n2.side0'], [pin, 'n1.side0']]);
    await page.waitForTimeout(500); const p = await instPos(pin);
    return { ok: !e1 && !e2 && JSON.stringify(p.position) === '[32,16,8]', expected: [32, 16, 8], actual: { errors: [e1, e2], position: p.position, rotation: p.rotation, mates: (await doc()).mates?.length } };
  });
  await probe('UM2', '[assembly-mates] edit the base plate (8 → 20 thick): the pin follows; Undo brings both back', async () => {
    await page.click('[aria-label="Mates"] button:text-is("Cancel")').catch(() => {}); await press('Escape');
    // (While an instance is selected the feature editor is hidden: clear it with a click on empty space.)
    await page.locator('.history .hs', { hasText: 'Extrude 8' }).click(); await page.waitForTimeout(200);
    const hiddenEditor = !(await page.locator('.node-editor').count());
    await page.mouse.click(250, 160); await page.waitForTimeout(200);
    await page.locator('.history .hs', { hasText: 'Extrude 8' }).click();
    const ed = l => page.locator('.node-editor .field', { has: page.locator(`span:text-is("${l}")`) }).locator('input');
    await ed('Distance').fill('20'); await page.locator('.node-editor button', { hasText: 'Apply' }).click(); await idle(); await page.waitForTimeout(1500);
    const pin = (await doc()).instances[0].id, after = (await instPos(pin)).position;
    await press('Escape'); await page.evaluate(() => document.activeElement?.blur()); await press('Meta+z'); await idle(); await page.waitForTimeout(1500);
    const undone = (await instPos(pin)).position, h = (await doc()).nodes[1].height;
    return { ok: after[2] === 20 && undone[2] === 8 && h === 8, expected: { afterEdit: 20, afterUndo: { plate: 8, pinZ: 8 } }, actual: { afterEdit: after, afterUndo: { plate: h, pin: undone }, editorHiddenWhileInstanceSelected: hiddenEditor } };
  });
  await probe('UM3', '[assembly-mates] roll the hole back: the concentric mate reports its missing face', async () => {
    await press('Escape');
    await page.locator('.history .hs', { hasText: 'Extrude 8' }).dblclick(); await idle(); await page.waitForTimeout(1500);
    await page.locator('.ol.instance').first().click(); await page.waitForTimeout(300);
    const titles = await page.locator('.ol.mate').evaluateAll(els => els.map(e => e.getAttribute('title')));
    await page.click('[aria-label="Roll forward to the end"]'); await idle(); await page.waitForTimeout(800);
    return { ok: titles.some(t => /no longer on the part/.test(t ?? '')), expected: 'Concentric 2 flagged: one of its faces is no longer on the part', actual: titles };
  });
  await probe('UM4', '[assembly-mates] a third, conflicting mate is refused; delete a mate; flip', async () => {
    const pin = (await doc()).instances[0].id;
    await page.locator('.ol.instance').first().click();
    const e = await addMate([['base', 'n1.top'], [pin, 'n1.top']]);
    await page.click('[aria-label="Mates"] button:text-is("Cancel")').catch(() => {});
    await page.locator('.ol.mate', { hasText: 'Coincident 1' }).click();
    await page.click('[aria-label="Edit mate flip"]'); await page.waitForTimeout(800);
    const flipped = await instPos(pin);
    await page.click('[aria-label="Mates"] button:text-is("Delete mate")'); await page.waitForTimeout(500);
    const left = (await doc()).mates.map(m => m.kind);
    return { ok: /Conflicts/.test(e) && flipped.rotation[0] === 180 && JSON.stringify(left) === '["concentric"]', expected: { third: 'refused: Conflicts with…', flip: 'rotation X 180', afterDelete: ['concentric'] }, actual: { third: e, flipped: { p: flipped.position, r: flipped.rotation }, afterDelete: left } };
  });
  await probe('UM5', '[assembly-mates] remove the instance: its mates go with it', async () => {
    await page.locator('.ol.instance').first().click(); await page.click('[aria-label="Instance"] button:text-is("Remove")'); await page.waitForTimeout(400);
    const d = await doc();
    return { ok: !(d.instances ?? []).length && !(d.mates ?? []).length, expected: 'no instances, no mates', actual: { instances: (d.instances ?? []).length, mates: d.mates } };
  });
  await probe('UM6', '[assembly-mates] block flush on a 45° chamfer face of the base (needs a 45° turn about X)', async () => {
    await newPart(); await makeBox(40, 40, 20, 0, 0, 0);
    await page.evaluate(() => window.__studioSelectEdge('n1.side0|n1.top'));
    await press(' '); await page.locator('.palette input').fill('chamfer'); await press('Enter'); await hudReady(); await setField('Distance', 10); await press('Enter'); await idle(); await page.waitForTimeout(400);
    const blk = await insert(blockFile);
    const e = await addMate([['base', 'n2.face'], [blk, 'n1.bottom']]);
    await page.waitForTimeout(1500);
    const toast = (await page.locator('.toast[role=alert]').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const i = await instPos(blk), shown = await page.evaluate(() => document.querySelectorAll('.ol.instance').length);
    const vol = await page.locator('[aria-label="Instance"]').innerText().catch(() => '');
    return { ok: !!e || (!toast && /Bodies\s*1/.test(vol)), expected: 'the block lies on the chamfer, or the mate is refused with the reason', actual: { mateError: e, rotation: i.rotation, position: i.position, toast, instancePanel: vol.replace(/\s+/g, ' ').slice(0, 120), mates: (await doc()).mates?.length } };
  });

  // ---- sketch constraints (line-tool outline) ----
  const drawQuad = async () => {
    await press('s'); await press('l'); const [cx, cy] = await canvasCenter();
    for (const [dx, dy] of [[-150, -80], [150, -80], [150, 80], [-150, 80], [-150, -80]]) await clickAt(cx + dx, cy + dy);
  };
  await probe('UC1', '[sketch-constraints] ⌘Z while sketching undoes the last constraint, not the whole sketch', async () => {
    await newPart(); await makeBox(10, 10, 10, 100, 0, 0);
    await drawQuad();
    await page.fill('#sk-len0', '60'); await page.evaluate(() => document.activeElement?.blur());
    const before = { nodes: (await doc()).nodes.length, sketching: await page.locator('.sk-panel').count() };
    await press('Meta+z'); await page.waitForTimeout(800); await idle();
    const after = { nodes: (await doc()).nodes.length, sketching: await page.locator('.sk-panel').count(), len0: await page.inputValue('#sk-len0').catch(() => null) };
    return { ok: after.sketching === 1, expected: 'still sketching (the width lock undone or kept); the box feature untouched', actual: { before, after } };
  });
  await probe('UC2', '[sketch-constraints] dimension editor in the viewport: 0, text and Escape', async () => {
    await newPart(); await drawQuad();
    await press('d'); const r = await page.evaluate(() => { const o = document.querySelector('.vp-overlay').getBoundingClientRect(); return document.querySelector('.vp-overlay polygon.sk-shape:not(.done)').getAttribute('points').trim().split(/\s+/).map(p => { const [x, y] = p.split(',').map(Number); return [x + o.left, y + o.top]; }); });
    const mid = [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2]; await clickAt(mid[0], mid[1]);
    await page.locator('.dim-edit').fill('0'); await page.locator('.dim-edit').press('Enter'); await page.waitForTimeout(300);
    const zero = (await page.locator('.sk-panel [role=alert]').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const w0 = await page.inputValue('#sk-len0');
    await clickAt(mid[0], mid[1]); const editorOpen = await page.locator('.dim-edit').count();
    if (editorOpen) { await page.locator('.dim-edit').fill('77'); await page.locator('.dim-edit').press('Escape'); }
    await page.waitForTimeout(300);
    const afterEsc = { len0: await page.inputValue('#sk-len0'), sketching: await page.locator('.sk-panel').count() };
    return { ok: /greater than 0/.test(zero) && afterEsc.len0 === w0 && afterEsc.sketching === 1, expected: { zero: 'refused: A dimension must be greater than 0', escape: 'closes the editor only, value unchanged, still sketching' }, actual: { zero, w0, editorOpen, afterEsc } };
  });
  await probe('UC3', '[sketch-constraints] after Finish, the driving dimensions can be edited again', async () => {
    await newPart(); await drawQuad();
    await page.fill('#sk-len0', '60'); await page.fill('#sk-len1', '25'); await page.evaluate(() => document.activeElement?.blur());
    await press('Enter'); await hudReady(); await press('Enter'); await idle();
    await page.locator('.history .hs').first().click();
    const editor = (await page.locator('.node-editor').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const node = (await doc()).nodes[0];
    return { ok: /Width|Length|60/.test(editor), expected: 'the feature editor offers the sketch’s 60 and 25 (or the sketch can be reopened)', actual: { editor: editor.slice(0, 160), sketchNode: node } };
  });
} finally {
  writeFileSync(join(out, 'ui-probe.json'), JSON.stringify(rows, null, 2));
  await browser.close(); await server.close();
}
const bad = rows.filter(r => !r.ok);
console.log(`\n${rows.length - bad.length}/${rows.length} as expected; findings: ${bad.map(r => r.id).join(' ')}`);
console.log(`screenshots: ${out}`);
