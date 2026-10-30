// D352 qualification: spline handles. A closed Spline-tool outline keeps its fit points and per-point tangent handles (SketchOutline.spline). The SPLINE section of the sketch panel edits them:
// "Fit point N X", "Fit point N Y", "Fit point N handle" (degrees anticlockwise from +X, direction of travel; empty = automatic, the placeholder shows the automatic angle). A handle that points backwards
// along a neighbouring span is refused with the reason in the panel alert and the shape stays; an accepted one regenerates the outline (always 12 points / 12 segments for 6 fit points).
// Finish stores the definition on node.outline.spline (handles: [100, null, ...]); reopening restores it; an ordinary-outline edit (Edge length) turns it into an ordinary outline (SPLINE section gone) and
// Escape leaves the stored document untouched. Extrude 10 mm: one body whose volume equals an independent exact oracle's area x 10. Undo/Redo, Save, fresh Open and Edit sketch / Escape keep the document.
// Root must freeze all sources first. Run from apps/cad-studio:
//   D352_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/spline-handles-browser.mjs /absolute/artifacts
// Actual Studio UI (palette Sketch, Sketch plane select, Spline toolbar button + canvas clicks via window.__studioScreenOf, SPLINE section inputs, Finish, history button, Extrude HUD, Undo/Redo, Save, Open, Edit sketch, Escape) mutates.
// Readonly hooks (window.__studioDoc / __studioBodies / __studioSelection / __studioScreenOf) observe only. The document starts EMPTY (no fixture).
// Refused handle: fit point 2 = (15,20) with neighbours (30,0) and (-15,20). The handle is the direction from fit point 2 back towards fit point 1, i.e. atan2(-20, 15) = -53.13 deg. splineEditError (spline.ts) refuses a handle
// when dot(tangent, chord to the next point) < 0 for either end of a span that has a handle: here dot((0.6,-0.8), (-30,0)) = -18 < 0 and dot((0.6,-0.8), (-15,20)) = -25 < 0, so span 1 and span 0 are both refused with
// 'That handle or point leaves no arc pair the model can build to the next point.' (after the audit fixes a refusal comes only from a span
// that cannot be built or admitted; the driver uses a fit point moved beyond the kernel's ±10000 mm coordinate limit).
// Note: the automatic tangent at fit point 1 (30,0) is (0,40) i.e. 90 deg, so step 1 sets 100 deg (geometry changes; both neighbouring chords keep a positive dot); step 5 then sets 75 deg (the oracle checks every handle against the outline).
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
assert.equal(process.env.D352_SOURCE_FROZEN, '1', 'Root must freeze all writers before D352 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'SPLINE_HANDLES_EXACT_TANGENT_ARCS', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One closed 12-point spline (six fit points) from an empty document, extruded 10 mm; one XY sketch plane; integer fit points on the 1 mm grid.', 'Clicks go through window.__studioScreenOf pixels; the snapped fit points the sketch ends up with are recorded before the claim is asserted.',
    'Handle 100 at fit point 1 differs from its automatic 90 deg tangent; 75 (step 5) changes it again.', 'Product reads (the bundled inspector) are product code, not an independent oracle.',
    'The Python oracle (python3 -I, Fractions, zero product imports) decides point exactness, arc equidistance, tangency, handle directions, area and volume.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {splineOutline} from '../../packages/barocss-cad-model/src/sketch/spline.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){out.bodyCount=view.bodies.length;if(view.bodies.length){const key=view.bodies[0].key,p=part('D352 observed',doc),body=p.body(key);out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.facadeVolume=body.mass({density:1}).volume;}}
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
// SPLINE inputs apply on Enter or blur (a local draft while typing).
async function setField(label, text) { const input = sketchPanel().getByLabel(label, { exact: true }); await input.fill(text); await input.press('Enter'); await page.waitForTimeout(300); }
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
const initialFiles = ['apps/cad-studio/test/spline-handles-browser.mjs', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/app/sketchControls.ts', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/sketch/spline.ts', 'packages/barocss-cad-model/src/sketch/rules.ts', 'packages/barocss-cad-model/src/sketch/profile.ts',
  'packages/barocss-cad-model/src/sketch/outlineFields.ts', 'packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/osnap.ts',
  'packages/barocss-cad-model/src/sketch/settle.ts', 'packages/barocss-cad-model/src/sketch/types.ts', 'packages/barocss-cad-model/src/sketch/entityIds.ts', 'packages/barocss-cad-model/src/engine/doc.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
// The six fit points of the claim (CCW), clicked in this order; the first is clicked again to close.
const FIT = [[30, 0], [15, 20], [-15, 20], [-30, 0], [-15, -20], [15, -20]];
const FIT2 = FIT.map((p, i) => i === 3 ? [-35, 0] : p);
const H1 = [100, null, null, null, null, null], H2 = [75, null, null, null, null, null];
const same2 = (a, b) => a[0] === b[0] && a[1] === b[1];
const REFUSED = 'That handle or point leaves no arc pair the model can build to the next point.';
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
  report.fit = FIT; report.fit2 = FIT2;
  const buildInputs = [], sourcefile = 'd352-inspector.ts', virtual = resolve(app, sourcefile);
  const built = await build({ stdin: { contents: inspectSource, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  await writeFile(join(output, 'inspector.ts'), inspectSource); await writeFile(join(output, 'inspector-metafile.json'), JSON.stringify(built.metafile, null, 2));
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual)); report.virtualSources = [{ label: 'inspector', hash: hash(inspectSource), virtualInputExcluded: virtual }];
  inspector = join(output, 'inspector.mjs'); await writeFile(inspector, built.outputFiles[0].contents);
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
  frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts']; report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
  for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' }); server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;

  // Context 1: empty document.
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
  phase = 'close spline'; await worldClick(FIT[0]); await selectTool();
  await splineTitle().waitFor({ timeout: 15000 });
  const closedRows = await splineRead(), closedGrid = await pointsRead(); report.observations.push({ label: '01-closed', splineInputs: closedRows, outlinePoints: closedGrid.length / 2 }); await snapshot('01-closed');
  assert.equal(closedRows.length, 18, 'six fit points x (X, Y, handle)'); assert.deepEqual(fitOf(closedRows), FIT, 'SPLINE lists the clicked fit points'); assert.deepEqual(handlesOf(closedRows), [null, null, null, null, null, null], 'no handle set yet (empty = automatic)');
  assert.equal(closedGrid.length / 2, 12, 'twelve outline points'); assert.equal(await alertText(), null, 'no alert after closing');
  const autoPlaceholders = closedRows.filter((_, i) => i % 3 === 2).map(r => Number(r.placeholder)); report.observations.push({ label: '01-placeholders', autoPlaceholders }); assert.ok(autoPlaceholders.every(Number.isFinite), 'every placeholder shows an automatic angle'); assert.equal(autoPlaceholders[0], 90, 'automatic tangent at fit point 1 is 90 deg');

  // 1. A handle at fit point 1.
  phase = 'handle at fit point 1'; await setField('Fit point 1 handle', '100'); await page.waitForFunction(() => document.querySelector('.sk-panel input[aria-label="Fit point 1 handle"]')?.value === '100', null, { timeout: 15000 });
  const handleRows = await splineRead(), handleGrid = await pointsRead(); await snapshot('02-handle');
  assert.equal(handleGrid.length / 2, 12, 'twelve outline points with a handle (two per span)'); assert.equal(handleRows[0].value, '30'); assert.equal(handleRows[1].value, '0'); assert.deepEqual(handlesOf(handleRows), H1); assert.deepEqual(fitOf(handleRows), FIT); assert.equal(await alertText(), null, 'no alert for an accepted handle');
  report.observations.push({ label: '02-handle', jointBefore: closedGrid.slice(2, 4), jointAfter: handleGrid.slice(2, 4), note: 'handle 100 differs from the automatic 90 deg tangent, so the first joint moves' });

  // 2. A refused edit: fit point 2 moved beyond the kernel's ±10000 mm coordinate limit (no admissible arc pair).
  phase = 'refused fit point';
  const beforeRefused = { spline: await splineRead(), grid: await pointsRead(), doc: await doc() };
  await setField('Fit point 2 Y', '20000');
  await page.waitForFunction(() => !!document.querySelector('.sk-panel [role="alert"]'), null, { timeout: 15000 }).catch(() => {});
  const refusedAlert = await alertText(), afterRefused = { spline: await splineRead(), grid: await pointsRead(), doc: await doc() }; await snapshot('03-refused');
  report.observations.push({ label: '03-refused', alert: refusedAlert, inputAfter: afterRefused.spline[4] });
  assert.equal(refusedAlert, REFUSED, 'the refused point shows the reason in the panel alert');
  assert.deepEqual(afterRefused.grid, beforeRefused.grid, 'the outline grid is unchanged by the refused point'); assert.deepEqual(handlesOf(afterRefused.spline), H1); assert.deepEqual(fitOf(afterRefused.spline), FIT, 'the refused point was not applied'); assert.deepEqual(afterRefused.doc, beforeRefused.doc);

  // 3. Finish.
  const done04 = await finishSketch('04-finished'), doc04 = done04.doc; assert.equal(doc04.nodes.length, 1, 'one sketch node'); checkSketch(doc04.nodes[0], FIT, H1, '04');
  report.observations.push({ label: '04-sketch', sketch: doc04.nodes[0] }); await persist();
  const read04 = await inspect('04-native', FIT, H1); assert.equal(read04.read.bodyCount, 0);

  // 4. Extrude 10 mm.
  await startExtrude('05'); const operation = await page.evaluate(() => { const s = document.querySelector('.hud select[aria-label="Operation"]'); return s ? { value: s.value, options: [...s.options].map(o => o.value) } : null; });
  const depthSelect = await hud().getByLabel('Depth', { exact: true }).count(); report.observations.push({ label: '05-extrude-hud', operation, depthSelect, hudText: await page.evaluate(() => document.querySelector('.hud')?.textContent ?? null) });
  if (operation && operation.options.includes('new') && operation.value !== 'new') await hud().getByLabel('Operation', { exact: true }).selectOption('new');
  if (depthSelect) await hud().getByLabel('Depth', { exact: true }).selectOption('distance');
  const distance = hud().getByLabel('Distance', { exact: true }); await distance.waitFor(); await distance.fill('10');
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
  await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(doc04); await hud().waitFor({ state: 'hidden' }); const done05 = await snapshot('05-extruded'), doc05 = done05.doc;
  assert.deepEqual(doc05.nodes[0], doc04.nodes[0], 'the sketch node is unchanged by the extrude'); assert.equal(doc05.nodes.length, 2); assert.equal(doc05.nodes[1].kind, 'extrude'); assert.equal(Math.abs(doc05.nodes[1].height), 10);
  assert.equal(done05.bodies.bodies.length, 1, 'one body'); const volume05 = done05.bodies.bodies[0].volume; assert.deepEqual(await alerts(), []);
  await inspect('05-native', FIT, H1, volume05);

  // 5. Reopen through the consuming Extrude's Edit sketch; edit a fit point and a handle; Finish.
  const reopened = await reopenSketch('06'); const rows06 = await splineRead(); report.observations.push({ label: '06-reopened', panelPoints: reopened.length, splineInputs: rows06 }); await snapshot('06-reopened'); assert.deepEqual(await doc(), doc05, 'reopening does not change the document');
  await splineTitle().waitFor({ timeout: 15000 }); assert.equal(rows06.length, 18); assert.equal(rows06[2].label, 'Fit point 1 handle'); assert.equal(rows06[2].value, '100', 'SPLINE shows handle 100 after reopening'); assert.deepEqual(fitOf(rows06), FIT); assert.deepEqual(handlesOf(rows06), H1);
  phase = 'edit fit point 4 and handle 1'; await setField('Fit point 4 X', '-35'); assert.equal(await alertText(), null, 'fit point edit accepted'); await setField('Fit point 1 handle', '75'); assert.equal(await alertText(), null, 'handle edit accepted');
  await page.waitForFunction(() => document.querySelector('.sk-panel input[aria-label="Fit point 4 X"]')?.value === '-35' && document.querySelector('.sk-panel input[aria-label="Fit point 1 handle"]')?.value === '75', null, { timeout: 15000 });
  const rows07 = await splineRead(), grid07 = await pointsRead(); await snapshot('07-edited'); assert.deepEqual(fitOf(rows07), FIT2); assert.deepEqual(handlesOf(rows07), H2); assert.equal(grid07.length / 2, 12); assert.notDeepEqual(grid07, reopened, 'the outline changed with the edit');
  const done08 = await finishSketch('08-refinished'), doc08 = done08.doc; assert.equal(doc08.nodes.length, 2); checkSketch(doc08.nodes[0], FIT2, H2, '08');
  assert.deepEqual(doc08.nodes[0].sideTags, doc05.nodes[0].sideTags, 'sketch sideTags unchanged by the edit'); assert.deepEqual(doc08.nodes[1], doc05.nodes[1], 'the Extrude node is unchanged');
  assert.equal(done08.bodies.bodies.length, 1, 'one body'); const volume08 = done08.bodies.bodies[0].volume; assert.notEqual(volume08, volume05, 'the edit changed the volume'); assert.deepEqual(await alerts(), []);
  await inspect('08-native', FIT2, H2, volume08);

  // 6. Undo / Redo, Save.
  phase = 'Undo/Redo'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(800); await ready(); const afterUndo = await doc();
  report.observations.push({ label: 'undo-once', equalsDoc05: JSON.stringify(afterUndo) === JSON.stringify(doc05), equalsDoc04: JSON.stringify(afterUndo) === JSON.stringify(doc04), nodes: afterUndo.nodes.length }); await persist();
  assert.deepEqual(afterUndo, doc05, 'one Undo returns the 05-extruded document');
  await page.keyboard.press('Meta+Shift+z'); await same(doc08);
  const saved = await save('handles'); assert.deepEqual(saved.doc, doc08);

  // 7. Consistency: an ordinary-outline edit turns the spline into an ordinary outline; Escape leaves the stored document.
  await reopenSketch('09'); await splineTitle().waitFor({ timeout: 15000 });
  const edge = await page.evaluate(() => { const labels = [...document.querySelectorAll('.sk-panel input[aria-label]')].map(i => i.getAttribute('aria-label')); const pick = labels.find(l => /^Edge \d+ length$/.test(l)) ?? 'Arc 1 radius'; return { pick, labels: labels.filter(l => /^(Edge|Arc) /.test(l)), value: document.querySelector(`.sk-panel input[aria-label="${pick}"]`)?.value ?? null }; });
  report.observations.push({ label: '09-edge-choice', ...edge }); assert.ok(edge.value !== null, 'an ordinary edge input exists'); const edgeValue = String(Math.round((Number(edge.value) + 1) * 1e4) / 1e4);
  await setField(edge.pick, edgeValue); await page.waitForTimeout(500);
  const ordinaryAlert = await alertText(), splineGone = await splineTitle().count() === 0; await snapshot('09-ordinary'); report.observations.push({ label: '09-ordinary', edge: edge.pick, from: edge.value, to: edgeValue, alert: ordinaryAlert, splineSectionGone: splineGone }); await persist();
  assert.equal(splineGone, true, `the SPLINE section disappears after ${edge.pick} = ${edgeValue} (alert: ${ordinaryAlert})`);
  assert.deepEqual(await doc(), doc08, 'nothing is finished yet: the stored document is unchanged');
  await leaveSketch('09-left', doc08); await inspect('09-native', FIT2, H2, volume08);

  // Context 2: fresh Open.
  const fresh = await freshOpen(saved.file, saved.doc, '10-fresh-open'); assert.equal(fresh.bodies.bodies.length, 1); assert.ok(Math.abs(fresh.bodies.bodies[0].volume - volume08) <= 1e-6, `10: volume ${fresh.bodies.bodies[0].volume} vs ${volume08}`);
  await inspect('10-native', FIT2, H2, fresh.bodies.bodies[0].volume);
  await reopenSketch('11'); await splineTitle().waitFor({ timeout: 15000 }); const rows11 = await splineRead(); report.observations.push({ label: '11-reopened', splineInputs: rows11 }); await snapshot('11-reopened');
  assert.deepEqual(fitOf(rows11), FIT2); assert.equal(rows11[9].label, 'Fit point 4 X'); assert.equal(rows11[9].value, '-35'); assert.equal(rows11[2].value, '75'); assert.deepEqual(handlesOf(rows11), H2); assert.deepEqual(await doc(), saved.doc, '11: reopening does not change the document');
  await leaveSketch('11-left', saved.doc); await inspect('11-native', FIT2, H2, fresh.bodies.bodies[0].volume);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
