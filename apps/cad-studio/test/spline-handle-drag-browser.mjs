// D353 qualification: dragging spline handles and fit points in the viewport. A closed Spline-tool outline (six fit points) shows, with the Select tool, a handle line per fit point (30 px each way along its tangent, a
// circle.sk-handle-end at each end, class "sk-handle-end") and the fit points as dots. Pointer-down within 8 px of a handle end (preferred) or a fit point starts a drag (cursor grab on hover, grabbing while dragging).
// A handle end turns the tangent to point at the pointer (whole degrees, Shift = 0.1 deg; the back end adds 180); a fit point moves to the pointer on the 1 mm grid (Shift = 0.01 mm). The drag previews live without an emit (the
// SPLINE inputs still show the old values), emits ONE shape on release (one sketch-history step: one Meta+z undoes it, Meta+Shift+z redoes it), and Escape (capture phase) cancels it. A target the model refuses
// (coincident neighbours: splineEditError) keeps the last valid preview. Finish stores outline.spline; Extrude 10 mm gives volume = oracle area x 10; Save, fresh Open and Edit sketch / Escape keep the document.
// Root must freeze all sources first. Run from apps/cad-studio:
//   D353_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/spline-handle-drag-browser.mjs /absolute/artifacts
// Actual Studio UI (palette Sketch, Sketch plane select, Spline toolbar button + canvas clicks via window.__studioScreenOf, Select tool, real mouse down/move/up drags on the handle ends and fit points, Escape, SPLINE section
// inputs, sketch undo/redo keys, Finish, Extrude HUD, Save, Open, Edit sketch) mutates. Readonly hooks (window.__studioDoc / __studioBodies / __studioSelection / __studioScreenOf) observe only. The document starts EMPTY.
// Fit points are numbered 1..6 as in the panel labels: fit point 1 = (30,0), 2 = (15,20), 3 = (-15,20), 4 = (-30,0), 5 = (-15,-20), 6 = (15,-20).
// Handle-end screen points are read from the drawn marks (svg.vp-overlay circle.sk-handle-end, back end then forward end per fit point, mapped by the svg bounding rect) and cross-checked against a projection with
// window.__studioScreenOf of fit + (cos h, sin h) scaled to 30 px (mirrors splineHandleGeometry); both are recorded, the drawn marks are the drag source.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent exact check of a closed spline outline with handles (line-and-arc loop): fit points on the outline at even indices, arc equidistance, joint tangency, handle directions, area. Product imports: zero."""
import json, sys, math
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)
def pt(p): return (fr(p[0]), fr(p[1]))
def sub(a, b): return (a[0] - b[0], a[1] - b[1])
def cross(a, b): return a[0] * b[1] - a[1] * b[0]
def dot(a, b): return a[0] * b[0] + a[1] * b[1]
def sq(a): return dot(a, a)

data = json.load(sys.stdin)
doc = data['doc']; node = doc['nodes'][data['node']]
assert node['kind'] == 'sketch' and node['profile'] == 'loop', 'loop sketch'
segs = node['segments']; n = len(segs); assert n >= 3, 'at least three segments'
starts = [pt(s['start']) for s in segs]
fit = [pt(p) for p in data['fit']]; handles = data['handles']
assert n == 2 * len(fit), ('two segments per span', n, len(fit))
out = {'status': 'PASS', 'productImports': 0, 'segments': n, 'arcs': sum(1 for s in segs if s['kind'] == 'arc'), 'lines': sum(1 for s in segs if s['kind'] == 'line')}

# (0) the stored definition equals the expected one
outline = node.get('outline') or {}; sp = outline.get('spline'); assert sp, 'outline.spline stored'
assert sp['closed'] is True and [pt(p) for p in sp['fit']] == fit, 'stored fit points'
assert (sp.get('handles') or [None] * len(fit)) == handles, ('stored handles', sp.get('handles'), handles)
# (1) fit points equal outline.points[2i] and segments[2i].start exactly
opts = [pt(p) for p in outline['points']]; assert len(opts) == n, 'outline points count'
for i, p in enumerate(fit):
    assert opts[2 * i] == p, ('outline.points[2i] is not the fit point', i)
    assert starts[2 * i] == p, ('segments[2i].start is not the fit point', i)
out['fitPoints'] = len(fit)

# (2) every arc: start and end equidistant from the centre
worst_gap = F(0); worst_rel = 0.0
for i, s in enumerate(segs):
    if s['kind'] != 'arc': continue
    c = pt(s['center']); a = starts[i]; b = starts[(i + 1) % n]
    da, db = sq(sub(a, c)), sq(sub(b, c)); assert da > 0, ('degenerate arc', i)
    gap = abs(db - da) / da
    rel = abs(math.sqrt(float(db)) - math.sqrt(float(da))) / math.sqrt(float(da))
    worst_gap = max(worst_gap, gap); worst_rel = max(worst_rel, rel)
    assert rel <= 1e-9, ('arc ' + str(i) + ' start/end distances from the centre differ', rel, float(gap))
out['worstRadiusGapRelative'] = worst_rel; out['worstSquaredGapRelative'] = float(worst_gap)

# (3) tangency at every joint (cross and dot of the incoming and outgoing directions, exact)
def tangent(i, at_end):
    s = segs[i]; a = starts[i]; b = starts[(i + 1) % n]
    if s['kind'] == 'line': return sub(b, a)
    c = pt(s['center']); r = sub(b if at_end else a, c)
    perp = (-r[1], r[0])
    return perp if s['direction'] == 'ccw' else (-perp[0], -perp[1])
worst_tan = 0.0
for i in range(n):
    t_in = tangent(i, True); t_out = tangent((i + 1) % n, False)
    assert sq(t_in) > 0 and sq(t_out) > 0, ('zero-length tangent at joint', i)
    cr, dt = cross(t_in, t_out), dot(t_in, t_out)
    ang = abs(math.atan2(float(cr), float(dt))); worst_tan = max(worst_tan, ang)
    assert ang <= 1e-9, ('joint ' + str((i + 1) % n) + ' is not tangent', ang)
out['worstTangentAngle'] = worst_tan; out['joints'] = n

# (4) at each fit point with a handle, the outgoing tangent direction equals the handle angle
worst_handle = 0.0; checked = 0; autos = []
for i, h in enumerate(handles):
    t = tangent(2 * i, False); ang = math.atan2(float(t[1]), float(t[0]))
    if h is None: autos.append({'fit': i, 'outgoingDegrees': ang * 180 / math.pi}); continue
    want = h * math.pi / 180; d = abs(math.atan2(math.sin(ang - want), math.cos(ang - want)))
    worst_handle = max(worst_handle, d); checked += 1
    assert d <= 1e-9, ('handle of fit point ' + str(i + 1) + ' differs from the outgoing tangent', h, ang * 180 / math.pi, d)
    # the incoming tangent at the same fit point (end of segment 2i-1) must point the same way (smooth through the fit point)
    t2 = tangent((2 * i - 1) % n, True); d2 = abs(math.atan2(float(cross(t, t2)), float(dot(t, t2)))); assert d2 <= 1e-9, ('incoming tangent at fit point ' + str(i + 1), d2)
out['handlesChecked'] = checked; out['worstHandleAngle'] = worst_handle; out['automaticOutgoing'] = autos

# (5) area by the shoelace over the vertices plus each arc's circular-segment area, times the extrude height, against the Studio volume
shoe = F(0)
for i in range(n):
    a = starts[i]; b = starts[(i + 1) % n]; shoe += cross(a, b)
shoe = shoe / 2
seg_area = 0.0
for i, s in enumerate(segs):
    if s['kind'] != 'arc': continue
    c = pt(s['center']); ra = sub(starts[i], c); rb = sub(starts[(i + 1) % n], c)
    th = math.atan2(float(cross(ra, rb)), float(dot(ra, rb)))
    if s['direction'] == 'ccw' and th < -1e-7: th += 2 * math.pi
    if s['direction'] == 'cw' and th > 1e-7: th -= 2 * math.pi
    seg_area += float(sq(ra)) / 2 * (th - math.sin(th))
area = abs(float(shoe) + seg_area); out['area'] = area; out['shoelaceArea'] = float(shoe)
if data.get('volume') is not None:
    ext = [m for m in doc['nodes'] if m['kind'] == 'extrude' and m['sketch'] == data['node']]; assert len(ext) == 1, 'one extrude of the sketch'
    h = abs(float(ext[0]['height'])); assert h == 10, ('extrude height', h)
    vol = area * h; rel = abs(vol - data['volume']) / data['volume']
    out['oracleVolume'] = vol; out['studioVolume'] = data['volume']; out['volumeRelativeDifference'] = rel
    assert rel <= 1e-6, ('volume', vol, data['volume'], rel)
for key in ('equalRadii', 'concentric'):
    assert not outline.get(key), ('outline carries ' + key, outline.get(key))
print(json.dumps(out, indent=2))
`;
assert.equal(process.env.D353_SOURCE_FROZEN, '1', 'Root must freeze all writers before D353 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'SPLINE_VIEWPORT_HANDLE_AND_FIT_DRAG', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One closed 12-point spline (six fit points) from an empty document, extruded 10 mm; one XY sketch plane; integer fit points on the 1 mm grid; default snap step 1 mm.', 'Handle ends and fit points are dragged with real mouse events at pixels from the drawn marks / window.__studioScreenOf.',
    'The drag onto a coincident neighbour keeps the last valid preview; what fit point 5 became is recorded before any claim about it.', 'The sketch undo/redo claim is the App SketchHistory key path (Meta+z / Meta+Shift+z while sketching, input blurred).',
    'Product reads (the bundled inspector) are product code, not an independent oracle.', 'The Python oracle (python3 -I, Fractions, zero product imports) decides point exactness, arc equidistance, tangency, handle directions, area and volume.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {splineOutline} from '../../packages/barocss-cad-model/src/sketch/spline.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){out.bodyCount=view.bodies.length;if(view.bodies.length){const key=view.bodies[0].key,p=part('D353 observed',doc),body=p.body(key);out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.facadeVolume=body.mass({density:1}).volume;}}
const sk=doc.nodes.find((n:any)=>n.kind==='sketch');out.segments=sk&&sk.profile==='loop'?sk.segments:null;out.outlineKeys=sk?.outline?Object.keys(sk.outline):null;out.spline=sk?.outline?.spline??null;
const o=sk?.outline;if(o?.spline){const g=splineOutline(o.spline.fit,o.spline.closed,o.spline.handles);let mp=0,mb=0;g.points.forEach((p:any,i:number)=>{const q=o.points[i];mp=Math.max(mp,Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]));mb=Math.max(mb,Math.abs(g.bulges[i]-(o.bulges?.[i]??0)));});
out.regen={count:g.points.length,storedCount:o.points.length,maxPointDifference:mp,maxBulgeDifference:mb};}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;
const doc = () => page.evaluate(() => window.__studioDoc);
const editor = () => page.locator('.node-editor');
const sketchPanel = () => page.getByRole('complementary', { name: 'Sketch', exact: true });
const hud = () => page.getByRole('dialog', { name: 'Extrude', exact: true });
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
async function same(expected) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), expected); }
async function changed(previous) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) !== x, JSON.stringify(previous), { timeout: 60000 }); await ready(); }
const alerts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent));
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(), selection: window.__studioSelection ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent),
    editor: document.querySelector('.node-editor')?.textContent ?? null, sketchPanel: document.querySelector('.sk-panel')?.textContent ?? null, hud: document.querySelector('.hud')?.textContent ?? null,
    sketchAlert: document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null, sketchStatus: document.querySelector('.sk-panel [role="status"]')?.textContent ?? null,
    splineInputs: [...document.querySelectorAll('.sk-panel input[aria-label^="Fit point "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value, placeholder: i.placeholder })) }), label);
  report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2)); await writeFile(join(output, `${label}.html`), await page.content()); await page.screenshot({ path: join(output, `${label}.png`), fullPage: true }); await persist(); return state;
}
async function newPage() {
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.stack ?? String(e))); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('download', d => report.downloads.push({ phase, suggestedFilename: d.suggestedFilename() })); page.on('dialog', d => d.accept());
  await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await ready();
}
async function openFile(file, nodeCount) {
  await page.setInputFiles('input[aria-label="Model file"]', file);
  await page.waitForFunction(n => window.__studioDoc?.nodes?.length === n, nodeCount, { timeout: 60000 }); await ready();
}
async function freshOpen(file, expected, label) { phase = `fresh Open ${label}`; await newPage(); await openFile(file, expected.nodes.length); await same(expected); return snapshot(label); }
async function command(label) { await page.keyboard.press('Space'); await page.locator('.palette input').fill(label); await page.keyboard.press('Enter'); }
const screenOf = point => page.evaluate(point => window.__studioScreenOf?.(point), [...point, 0]);
async function worldClick(point) { const pixel = await screenOf(point); assert.ok(pixel?.length === 2, 'screen position of the point'); await page.mouse.click(pixel[0], pixel[1]); await page.waitForTimeout(60); }
// Every fit point must be on the canvas (not under a panel) before the first click; zoom out with the wheel until they are. Records the pixel scale.
async function frameFit(fit) {
  const tries = [];
  for (let i = 0; i < 10; i++) {
    const read = await page.evaluate(fit => { const c = document.querySelector('.vp-canvas'), r = c.getBoundingClientRect();
      const px = fit.map(p => window.__studioScreenOf([p[0], p[1], 0])), z = window.__studioScreenOf([0, 0, 0]), o = window.__studioScreenOf([1, 0, 0]);
      const hits = px.map(q => q && q[0] > r.left + 24 && q[0] < r.right - 24 && q[1] > r.top + 24 && q[1] < r.bottom - 24 && !!document.elementFromPoint(q[0], q[1])?.closest('.vp-canvas'));
      return { canvas: [r.left, r.top, r.width, r.height], px, pxPerMm: z && o ? Math.hypot(o[0] - z[0], o[1] - z[1]) : null, allOnCanvas: hits.every(Boolean) }; }, fit);
    tries.push(read); if (read.allOnCanvas) { report.observations.push({ label: 'framing', tries }); await persist(); return read; }
    const [left, top, width, height] = read.canvas; await page.mouse.move(left + width / 2, top + height / 2); await page.mouse.wheel(0, 400); await page.waitForTimeout(400);
  }
  report.observations.push({ label: 'framing-failed', tries }); await persist(); assert.fail('all fit points could not be framed on the canvas');
}
const pointsRead = () => page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Point "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
const splineRead = () => page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Fit point "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value, placeholder: i.placeholder })));
const splineTitle = () => page.locator('.sk-panel .card-title').filter({ hasText: /^SPLINE$/ });
const alertText = () => page.evaluate(() => document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null);
const fitOf = rows => { const out = []; for (let i = 0; i < rows.length; i += 3) out.push([Number(rows[i].value), Number(rows[i + 1].value)]); return out; };
const handlesOf = rows => { const out = []; for (let i = 2; i < rows.length; i += 3) out.push(rows[i].value === '' ? null : Number(rows[i].value)); return out; };
// The SPLINE section shows only once the Spline tool is put down: the Select tool.
async function selectTool() { const b = page.getByRole('button', { name: 'Select', exact: true }); if (await b.count() === 1) await b.click(); else { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('s'); } }
async function openSketchEditor() {
  phase = 'open sketch editor'; const state = await doc(), consumer = state.nodes.findIndex(n => n.kind === 'extrude' && n.sketch === 0);
  if (consumer >= 0) { report.observations.push({ label: 'sketch-editor-route', via: `extrude node ${consumer}` }); await page.locator(`.history .hs[data-node-index="${consumer}"]`).click(); await editor().waitFor(); return; }
  const target = page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · outline', exact: true }); assert.equal(await target.count(), 1, 'one standalone outline sketch button'); await target.click(); await editor().waitFor();
}
async function reopenSketch(label) { await openSketchEditor(); phase = `reopen sketch ${label}`; await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor(); return pointsRead(); }
async function leaveSketch(label, expected) {
  phase = `leave sketch ${label}`; await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < 3 && await sketchPanel().isVisible(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  await sketchPanel().waitFor({ state: 'hidden' }); await same(expected); return snapshot(label);
}
async function finishSketch(label) { phase = `Finish sketch ${label}`; await page.locator('.topbar button.finish').click(); await sketchPanel().waitFor({ state: 'hidden' }); await ready(); return snapshot(label); }
async function startExtrude(label) {
  phase = `Extrude HUD ${label}`; await openSketchEditor(); await editor().getByRole('button', { name: 'Close editor', exact: true }).click(); await editor().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => (window.__studioSelection?.selection?.sketches ?? []).includes(0), null, { timeout: 15000 });
  await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('e'); await hud().waitFor();
  await page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 });
}
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
// Product read (bundled inspector) and the independent Python oracle on the same document, fit points, handles and Studio volume. The oracle input is written before any assertion on its verdict.
async function inspect(label, fit, handles, volume) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  const read = JSON.parse(run.stdout); report.reads.push({ label, studioVolume: volume ?? null, ...read }); await persist();
  const input = { doc: accepted, node: 0, fit, handles, volume: volume ?? null }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'spline-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stdout: check.stdout ? JSON.parse(check.stdout) : null, stderr: check.stderr }); await persist();
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); assert.equal(JSON.parse(check.stdout).status, 'PASS');
  assert.equal(read.ok, true, `product evaluation ok (${read.error})`);
  assert.ok(read.regen, 'the product regenerates the stored spline'); assert.equal(read.regen.count, read.regen.storedCount); assert.ok(read.regen.maxPointDifference <= 1e-8, `regenerated points differ by ${read.regen.maxPointDifference}`); assert.ok(read.regen.maxBulgeDifference <= 1e-9, `regenerated bulges differ by ${read.regen.maxBulgeDifference}`);
  if (volume !== undefined) { assert.equal(read.bodyCount, 1); assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6, `product evalVolume ${read.evalVolume} vs Studio ${volume}`); assert.ok(Math.abs(read.facadeVolume - volume) <= 1e-6, `facade volume ${read.facadeVolume} vs Studio ${volume}`); }
  assert.deepEqual(await doc(), accepted); return { read, verified: JSON.parse(check.stdout) };
}
const cursor = () => page.evaluate(() => document.querySelector('.vp-canvas')?.style.cursor ?? null);
// The drawn handle marks in page pixels: per fit point the back end then the forward end (circle.sk-handle-end), the handle lines and the fit dots.
const marks = () => page.evaluate(() => {
  const svg = [...document.querySelectorAll('svg.vp-overlay')].find(s => s.querySelector('.sk-handle-end')); if (!svg) return null; const r = svg.getBoundingClientRect(), at = c => [r.left + Number(c.getAttribute('cx')), r.top + Number(c.getAttribute('cy'))];
  const ends = [...svg.querySelectorAll('circle.sk-handle-end')];
  return { rect: [r.left, r.top, r.width, r.height], ends: ends.map(at), endClasses: ends.map(c => c.getAttribute('class')), endRadii: ends.map(c => c.getAttribute('r')), lines: [...svg.querySelectorAll('line.sk-handle')].map(l => l.getAttribute('class')),
    dots: [...svg.querySelectorAll('circle.sk-point')].map(at) };
});
// Handle ends two ways: the drawn marks and a projection of fit + (cos h, sin h) with __studioScreenOf scaled to 30 px (h = the handle, else the automatic placeholder).
async function handleEnds(label) {
  const rows = await splineRead(), fit = fitOf(rows), angle = rows.filter((_, i) => i % 3 === 2).map(r => Number(r.value !== '' ? r.value : r.placeholder)), drawn = await marks(); assert.ok(drawn, 'the handle marks are drawn');
  const math = await page.evaluate(({ fit, angle }) => fit.map((f, i) => { const h = angle[i] * Math.PI / 180, c = window.__studioScreenOf([f[0], f[1], 0]), t = window.__studioScreenOf([f[0] + Math.cos(h), f[1] + Math.sin(h), 0]);
    const l = Math.hypot(t[0] - c[0], t[1] - c[1]) || 1, dx = (t[0] - c[0]) / l * 30, dy = (t[1] - c[1]) / l * 30; return { c, fwd: [c[0] + dx, c[1] + dy], back: [c[0] - dx, c[1] - dy] }; }), { fit, angle });
  const diffs = []; math.forEach((m, i) => { const b = drawn.ends[2 * i], f = drawn.ends[2 * i + 1]; if (b && f) diffs.push(Math.hypot(b[0] - m.back[0], b[1] - m.back[1]), Math.hypot(f[0] - m.fwd[0], f[1] - m.fwd[1])); });
  const worst = diffs.length ? Math.max(...diffs) : Infinity; report.observations.push({ label: `${label}-handle-ends`, fit, angle, drawn, math, worstDifferencePx: worst }); await persist(); return { rows, fit, angle, drawn, math, worst };
}
const fwdEnd = (ends, i) => ends.drawn.ends[2 * i + 1];
const initialFiles = ['apps/cad-studio/test/spline-handle-drag-browser.mjs', 'apps/cad-studio/test/spline-handle-drag.test.ts', 'apps/cad-studio/src/viewport/splineHandles.ts', 'apps/cad-studio/src/styles.css', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/app/sketchControls.ts', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/sketch/spline.ts', 'packages/barocss-cad-model/src/sketch/rules.ts',
  'packages/barocss-cad-model/src/sketch/profile.ts', 'packages/barocss-cad-model/src/sketch/outlineFields.ts', 'packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/osnap.ts',
  'packages/barocss-cad-model/src/sketch/settle.ts', 'packages/barocss-cad-model/src/sketch/types.ts', 'packages/barocss-cad-model/src/sketch/entityIds.ts', 'packages/barocss-cad-model/src/engine/doc.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
// The six fit points of the claim (CCW), clicked in this order; the first is clicked again to close.
const FIT = [[30, 0], [15, 20], [-15, 20], [-30, 0], [-15, -20], [15, -20]];
const same2 = (a, b) => a[0] === b[0] && a[1] === b[1];
// The sketch node's checks shared by the Finish states: loop profile, stored definition, fit points at even outline indices (bitwise), 12 segments, 12 outer side ids.
function checkSketch(node, fit, handles, label) {
  assert.equal(node.kind, 'sketch'); assert.equal(node.profile, 'loop', `${label}: loop profile`); assert.ok(node.outline, `${label}: outline stored`);
  assert.deepEqual(node.outline.spline, { fit, closed: true, handles }, `${label}: outline.spline`);
  assert.equal(node.outline.points.length, 12, `${label}: 12 outline points`); assert.equal(node.segments.length, 12, `${label}: 12 segments`);
  fit.forEach((p, i) => { assert.ok(same2(node.outline.points[2 * i], p), `${label}: outline.points[${2 * i}] is fit point ${i + 1}`); assert.ok(same2(node.segments[2 * i].start, p), `${label}: segments[${2 * i}].start is fit point ${i + 1}`); });
  assert.ok(node.sideTags && Array.isArray(node.sideTags.outer), `${label}: sideTags.outer`); assert.equal(node.sideTags.outer.length, 12, `${label}: 12 outer side ids`); assert.equal(new Set(node.sideTags.outer).size, 12, `${label}: distinct side ids`);
}
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'spline-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  report.fit = FIT;
  const buildInputs = [], sourcefile = 'd353-inspector.ts', virtual = resolve(app, sourcefile);
  const built = await build({ stdin: { contents: inspectSource, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  await writeFile(join(output, 'inspector.ts'), inspectSource); await writeFile(join(output, 'inspector-metafile.json'), JSON.stringify(built.metafile, null, 2));
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual)); report.virtualSources = [{ label: 'inspector', hash: hash(inspectSource), virtualInputExcluded: virtual }];
  inspector = join(output, 'inspector.mjs'); await writeFile(inspector, built.outputFiles[0].contents);
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
  frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts']; report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
  for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  for (const need of ['apps/cad-studio/src/viewport/splineHandles.ts', 'apps/cad-studio/src/styles.css', 'apps/cad-studio/src/viewport/Viewport.tsx']) assert.ok(report.sourceFrozen[need], `${need} is in the frozen capsule`);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' }); server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;

  // Context 1: empty document, closed spline, Select tool.
  phase = 'empty document'; await newPage(); await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0); await ready(); const empty = await doc(); assert.equal(empty.nodes.length, 0, 'the document starts empty'); await snapshot('00-empty');
  phase = 'start XY sketch'; await command('Sketch'); await sketchPanel().waitFor(); await sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
  const spline = page.getByRole('button', { name: 'Spline', exact: true }); report.observations.push({ label: 'spline-button', count: await spline.count() });
  if (await spline.count() === 1) await spline.click(); else { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('p'); }
  await frameFit(FIT);
  phase = 'click six fit points'; for (const p of FIT) await worldClick(p);
  const clicked = await pointsRead(); report.observations.push({ label: 'clicked', panelPoints: clicked }); await persist();
  if (clicked.length) {
    const have = []; for (let i = 0; i + 1 < clicked.length; i += 2) have.push([Number(clicked[i].value), Number(clicked[i + 1].value)]);
    const lost = FIT.filter(p => !have.some(q => same2(p, q))); report.observations.push({ label: 'clicked-check', lost }); await persist();
    assert.deepEqual(lost, [], 'every clicked point appears in the open spline (no click was snapped elsewhere)');
  }
  phase = 'close spline'; await worldClick(FIT[0]); await selectTool(); await splineTitle().waitFor({ timeout: 15000 });
  await frameFit(FIT); await page.mouse.move(5, 5); await page.waitForTimeout(150);
  const closedRows = await splineRead(), closedGrid = await pointsRead(), closedMarks = await marks(); report.observations.push({ label: '01-closed', splineInputs: closedRows, outlinePoints: closedGrid.length / 2, marks: closedMarks }); await snapshot('01-closed');
  assert.equal(closedRows.length, 18, 'six fit points x (X, Y, handle)'); assert.deepEqual(fitOf(closedRows), FIT, 'SPLINE lists the clicked fit points'); assert.deepEqual(handlesOf(closedRows), [null, null, null, null, null, null], 'no handle set yet (empty = automatic)');
  assert.equal(closedGrid.length / 2, 12, 'twelve outline points'); assert.equal(await alertText(), null, 'no alert after closing');
  assert.ok(closedMarks, 'handle marks drawn'); assert.equal(closedMarks.ends.length, 12, '6 x 2 handle ends'); assert.ok(closedMarks.endClasses.every(c => c === 'sk-handle-end'), `handle end class names: ${closedMarks.endClasses}`); assert.equal(closedMarks.lines.length, 6, 'six handle lines'); assert.ok(closedMarks.lines.every(c => c === 'sk-handle'), 'handle line class names');
  const ends01 = await handleEnds('01'); assert.ok(ends01.worst <= 2, `drawn handle ends vs the 30 px projection differ by ${ends01.worst} px`);
  const startRows = closedRows;

  // 1. Hover over fit point 1's forward handle end: cursor grab.
  phase = 'hover handle end'; const fwd1 = fwdEnd(ends01, 0); await page.mouse.move(fwd1[0] - 12, fwd1[1] - 12); await page.mouse.move(fwd1[0], fwd1[1], { steps: 4 }); await page.waitForTimeout(150);
  const hoverCursor = await cursor(); await snapshot('02-hover'); report.observations.push({ label: '02-hover', end: fwd1, cursor: hoverCursor });
  assert.equal(hoverCursor, 'grab', 'cursor over a handle end is grab');
  const centre = await screenOf([0, 0]); await page.mouse.move(centre[0], centre[1], { steps: 4 }); await page.waitForTimeout(150); const awayCursor = await cursor(); report.observations.push({ label: '02-away', cursor: awayCursor }); assert.notEqual(awayCursor, 'grab', 'cursor away from every mark is not grab');

  // 1b. A click (no movement) on a fit point still picks it (D353 audit F1: a press only arms a drag; a release before
  // 3 px of movement is an ordinary pick). The picked point is drawn as circle.sk-pick-point.on; nothing changes.
  phase = 'click picks a fit point'; const docBeforePick = await doc(), rowsBeforePick = await splineRead(), fit1 = await screenOf(FIT[0]);
  await page.mouse.click(fit1[0], fit1[1]); await page.waitForTimeout(300);
  const picked = await page.evaluate(() => document.querySelectorAll('circle.sk-pick-point.on').length);
  report.observations.push({ label: '02b-click-pick', pickedPointMarks: picked }); await snapshot('02b-click-pick');
  assert.ok(picked >= 1, 'a click on a fit point picks it'); assert.deepEqual(await splineRead(), rowsBeforePick, 'a click changes no spline value'); assert.deepEqual(await doc(), docBeforePick);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  if (!(await sketchPanel().isVisible())) throw new Error('Escape after the pick left the sketch: the driver must clear picks another way');

  // 2. Drag fit point 1's forward handle end to fit1 + 10 (cos 60, sin 60).
  phase = 'drag handle'; const docBefore03 = await doc(), target1 = await screenOf([FIT[0][0] + 10 * Math.cos(Math.PI / 3), FIT[0][1] + 10 * Math.sin(Math.PI / 3)]); report.observations.push({ label: '03-plan', from: fwd1, to: target1 });
  await page.mouse.move(fwd1[0], fwd1[1]); await page.mouse.down(); await page.mouse.move(target1[0], target1[1], { steps: 14 }); await page.waitForTimeout(250);
  await snapshot('03a-dragging'); const draggingRows = await splineRead(), draggingCursor = await cursor(), draggingMarks = await marks();
  report.observations.push({ label: '03a-dragging', rows: draggingRows, cursor: draggingCursor, forwardEndNow: draggingMarks?.ends?.[1] ?? null, note: 'drawn forward end during the drag, recorded only' });
  assert.equal(draggingRows[2].label, 'Fit point 1 handle'); assert.equal(draggingRows[2].value, '', 'no emit during the drag: the SPLINE input still shows the old (empty) handle'); assert.equal(draggingCursor, 'grabbing', 'cursor while dragging is grabbing'); assert.deepEqual(await doc(), docBefore03, 'the document is untouched during the drag');
  await page.mouse.up(); await page.waitForTimeout(400);
  const rows03 = await splineRead(), grid03 = await pointsRead(), cursor03 = await cursor(); await snapshot('03-handle-dragged'); report.observations.push({ label: '03-handle-dragged', rows: rows03, cursor: cursor03, alert: await alertText() });
  const h1 = Number(rows03[2].value); assert.ok(rows03[2].value !== '' && Math.abs(h1 - 60) <= 1, `Fit point 1 handle = ${rows03[2].value} (expected 60)`); assert.deepEqual(fitOf(rows03), FIT, 'the fit points did not move'); assert.equal(grid03.length / 2, 12, 'the outline still has 12 points');
  assert.deepEqual(handlesOf(rows03), [h1, null, null, null, null, null]); assert.equal(await alertText(), null); assert.notEqual(cursor03, 'grabbing', 'the grabbing cursor ends with the drag');
  // Undo / redo: ONE history step.
  phase = 'sketch undo redo'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(500);
  const undone = await splineRead(), undoneGrid = await pointsRead(); await snapshot('04a-undone'); report.observations.push({ label: '04a-undone', rows: undone, key: 'Meta+z (App.tsx onKey: sketchHistory.current.undo(liveShape.current))' });
  assert.deepEqual(handlesOf(undone), [null, null, null, null, null, null], 'one Meta+z returns the handle to empty (automatic)'); assert.deepEqual(fitOf(undone), FIT); assert.equal(undoneGrid.length / 2, 12); assert.deepEqual(undone.map(r => r.value), startRows.map(r => r.value), 'one Meta+z restores exactly the closed state');
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(500); const redone = await splineRead(); await snapshot('04-undo-redo'); report.observations.push({ label: '04-undo-redo', rows: redone, key: 'Meta+Shift+z' });
  assert.deepEqual(redone, rows03, 'one Meta+Shift+z brings the handle back'); assert.equal(redone[2].value, rows03[2].value); assert.equal(await alertText(), null);

  // 3. Drag fit point 4 (-30, 0) to (-36, 2).
  phase = 'drag fit point 4'; const from4 = await screenOf(FIT[3]), to4 = await screenOf([-36, 2]); report.observations.push({ label: '05-plan', from: from4, to: to4 });
  await page.mouse.move(from4[0] - 10, from4[1]); await page.mouse.move(from4[0], from4[1], { steps: 3 }); await page.waitForTimeout(120); const fitHover = await cursor(); report.observations.push({ label: '05-hover-fit', cursor: fitHover });
  await page.mouse.down(); await page.mouse.move(to4[0], to4[1], { steps: 14 }); await page.waitForTimeout(200); const fitDragRows = await splineRead(); report.observations.push({ label: '05-mid-drag', rows: fitDragRows }); await page.mouse.up(); await page.waitForTimeout(400);
  const rows05 = await splineRead(), grid05 = await pointsRead(); await snapshot('05-fit-dragged');
  assert.equal(fitDragRows[9].value, '-30', 'fit point 4 X unchanged until release'); assert.equal(rows05[9].label, 'Fit point 4 X'); assert.equal(rows05[9].value, '-36', 'Fit point 4 X = -36'); assert.equal(rows05[10].label, 'Fit point 4 Y'); assert.equal(rows05[10].value, '2', 'Fit point 4 Y = 2 (1 mm grid)');
  assert.equal(grid05.length / 2, 12); assert.deepEqual(handlesOf(rows05), [h1, null, null, null, null, null]); assert.equal(await alertText(), null);
  const fit05 = fitOf(rows05); assert.deepEqual(fit05.filter((_, i) => i !== 3), FIT.filter((_, i) => i !== 3), 'the other fit points did not move');

  // 4. Escape cancels a handle drag of fit point 2.
  phase = 'escape cancel'; const doc06before = await doc(), ends05 = await handleEnds('05'), fwd2 = fwdEnd(ends05, 1), away2 = [fwd2[0] + 30, fwd2[1] - 25]; report.observations.push({ label: '06-plan', from: fwd2, to: away2 });
  await page.mouse.move(fwd2[0], fwd2[1]); await page.mouse.down(); await page.mouse.move(away2[0], away2[1], { steps: 10 }); await page.waitForTimeout(150); const beforeEscape = { rows: await splineRead(), cursor: await cursor() };
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.mouse.move(away2[0] + 6, away2[1] + 4, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(400);
  const rows06 = await splineRead(); await snapshot('06-escaped'); report.observations.push({ label: '06-escaped', beforeEscape, rows: rows06, cursor: await cursor(), panelVisible: await sketchPanel().isVisible(), alert: await alertText() });
  assert.equal(beforeEscape.cursor, 'grabbing', 'the drag was running before Escape'); assert.deepEqual(rows06, rows05, 'Escape: the SPLINE values equal the values before the drag'); assert.equal(await sketchPanel().isVisible(), true, 'Escape cancelled the drag only: the sketch is still open'); assert.deepEqual(await doc(), doc06before); assert.notEqual(await cursor(), 'grabbing');

  // 5. Drag fit point 5 onto fit point 4: coincident neighbours are refused; the last valid preview stays.
  phase = 'refused drag'; const from5 = await screenOf(FIT[4]), to5 = await screenOf(fit05[3]); report.observations.push({ label: '07-plan', from: from5, to: to5 });
  await page.mouse.move(from5[0], from5[1]); await page.mouse.down(); await page.mouse.move(to5[0], to5[1], { steps: 16 }); await page.waitForTimeout(250); await page.mouse.up(); await page.waitForTimeout(400);
  const rows07 = await splineRead(), grid07 = await pointsRead(); await snapshot('07-refused-drag'); const fit07 = fitOf(rows07), p5 = fit07[4];
  report.observations.push({ label: '07-refused-drag', rows: rows07, fitPoint5: p5, movedFromStart: !same2(p5, FIT[4]), alert: await alertText() });
  assert.deepEqual(fit07[3], [-36, 2], 'fit point 4 is where it was'); assert.ok(!same2(p5, fit07[3]), 'fit point 5 did not land on fit point 4'); assert.deepEqual(fit07.filter((_, i) => i !== 4), fit05.filter((_, i) => i !== 4), 'the other fit points did not move');
  assert.ok(p5.every(Number.isFinite)); assert.equal(grid07.length / 2, 12, 'the outline is still valid (12 points)'); assert.deepEqual(handlesOf(rows07), [h1, null, null, null, null, null]);

  // 6. Finish, oracle, Extrude 10, Save.
  const FITF = [FIT[0], FIT[1], FIT[2], [-36, 2], p5, FIT[5]], HF = [h1, null, null, null, null, null];
  const done08 = await finishSketch('08-finished'), doc08 = done08.doc; assert.equal(doc08.nodes.length, 1, 'one sketch node'); checkSketch(doc08.nodes[0], FITF, HF, '08');
  assert.deepEqual(doc08.nodes[0].outline.spline, { fit: FITF, closed: true, handles: HF }, 'node 0 outline.spline is the expected definition'); report.observations.push({ label: '08-sketch', sketch: doc08.nodes[0] }); await persist();
  const read08 = await inspect('08-native', FITF, HF); assert.equal(read08.read.bodyCount, 0);
  await startExtrude('09'); const operation = await page.evaluate(() => { const s = document.querySelector('.hud select[aria-label="Operation"]'); return s ? { value: s.value, options: [...s.options].map(o => o.value) } : null; });
  const depthSelect = await hud().getByLabel('Depth', { exact: true }).count(); report.observations.push({ label: '09-extrude-hud', operation, depthSelect, hudText: await page.evaluate(() => document.querySelector('.hud')?.textContent ?? null) });
  if (operation && operation.options.includes('new') && operation.value !== 'new') await hud().getByLabel('Operation', { exact: true }).selectOption('new');
  if (depthSelect) await hud().getByLabel('Depth', { exact: true }).selectOption('distance');
  const distance = hud().getByLabel('Distance', { exact: true }); await distance.waitFor(); await distance.fill('10');
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
  await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(doc08); await hud().waitFor({ state: 'hidden' }); const done09 = await snapshot('09-extruded'), doc09 = done09.doc;
  assert.deepEqual(doc09.nodes[0], doc08.nodes[0], 'the sketch node is unchanged by the extrude'); assert.equal(doc09.nodes.length, 2); assert.equal(doc09.nodes[1].kind, 'extrude'); assert.equal(Math.abs(doc09.nodes[1].height), 10);
  assert.equal(done09.bodies.bodies.length, 1, 'one body'); const volume09 = done09.bodies.bodies[0].volume; assert.deepEqual(await alerts(), []);
  const read09 = await inspect('09-native', FITF, HF, volume09); assert.ok(read09.verified.oracleVolume > 0);
  const saved = await save('drag'); assert.deepEqual(saved.doc, doc09);

  // Context 2: fresh Open.
  const fresh = await freshOpen(saved.file, saved.doc, '10-fresh-open'); assert.equal(fresh.bodies.bodies.length, 1); assert.ok(Math.abs(fresh.bodies.bodies[0].volume - volume09) <= 1e-6, `10: volume ${fresh.bodies.bodies[0].volume} vs ${volume09}`);
  await inspect('10-native', FITF, HF, fresh.bodies.bodies[0].volume);
  await reopenSketch('11'); await splineTitle().waitFor({ timeout: 15000 }); const rows11 = await splineRead(); report.observations.push({ label: '11-reopened', splineInputs: rows11 }); await snapshot('11-reopened');
  assert.deepEqual(fitOf(rows11), FITF); assert.equal(rows11[2].label, 'Fit point 1 handle'); assert.equal(rows11[2].value, String(h1), 'SPLINE shows the dragged handle after reopening'); assert.equal(rows11[9].label, 'Fit point 4 X'); assert.equal(rows11[9].value, '-36'); assert.equal(rows11[10].value, '2'); assert.deepEqual(handlesOf(rows11), HF);
  assert.deepEqual(await doc(), saved.doc, '11: reopening does not change the document');
  await leaveSketch('11-left', saved.doc); await inspect('11-native', FITF, HF, fresh.bodies.bodies[0].volume);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
