// D351 qualification: the Spline tool (P) draws a curve through the clicked points kept as tangent arcs. After closing it (clicking the first point again) and finishing the sketch,
// every clicked point lies exactly on the stored outline (bitwise equal to a stored segment start), every joint is tangent within 1e-9 rad, and the stored outline carries no equal-radius
// or concentric relation the user did not draw. Extrude 10 mm: one body whose volume equals an independent exact oracle's area x 10. Save, fresh Open and Edit sketch / Escape keep the document.
// Root must freeze all sources first. Run from apps/cad-studio:
//   D351_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/spline-closing-browser.mjs /absolute/artifacts
// Actual Studio UI (palette Sketch, Sketch plane select, Spline toolbar button + canvas clicks via window.__studioScreenOf, Finish, history button, Extrude HUD, Undo/Redo, Save, Open, Edit sketch, Escape) mutates.
// Readonly hooks (window.__studioDoc / __studioBodies / __studioSelection / __studioScreenOf) observe only. The document starts EMPTY (no fixture).
// Click mapping: Viewport.tsx onClick, sk.tool === 'spline': c = sketchSnap(...).at (nearest live/done snap within 8 px, else the 1 mm grid); the first point clicked again closes it (splineOutline(fit, true)).
// Expected at a base without the D351 fix: FAILS at the first exactness/relation assertion (the document is snapshotted and the oracle input written before asserting).
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent exact check of a closed line-and-arc loop made by the Spline tool: fit points on the outline, arc equidistance, joint tangency, area. Product imports: zero."""
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
fit = [pt(p) for p in data['fit']]
out = {'status': 'PASS', 'productImports': 0, 'segments': n, 'arcs': sum(1 for s in segs if s['kind'] == 'arc'), 'lines': sum(1 for s in segs if s['kind'] == 'line')}

# (1) every fit point equals some segment start exactly
missing = [[str(p[0]), str(p[1])] for p in fit if p not in starts]
assert not missing, ('fit points not on the stored outline as segment starts', missing)
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
worst_tan = 0.0; joints = []
for i in range(n):
    t_in = tangent(i, True); t_out = tangent((i + 1) % n, False)
    assert sq(t_in) > 0 and sq(t_out) > 0, ('zero-length tangent at joint', i)
    cr, dt = cross(t_in, t_out), dot(t_in, t_out)
    ang = abs(math.atan2(float(cr), float(dt))); worst_tan = max(worst_tan, ang)
    joints.append({'joint': (i + 1) % n, 'angle': ang})
    assert ang <= 1e-9, ('joint ' + str((i + 1) % n) + ' is not tangent', ang)
out['worstTangentAngle'] = worst_tan; out['joints'] = len(joints)

# (4) area by the shoelace over the vertices plus each arc's circular-segment area, times the extrude height, against the Studio volume
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

# (5) no equalRadii / concentric relation the user did not draw (the loop sketch's outline field)
outline = node.get('outline') or {}
out['outline'] = {k: outline.get(k) for k in ('equalRadii', 'concentric', 'tangents', 'hv', 'rules', 'radii', 'lengths') if k in outline}
for key in ('equalRadii', 'concentric'):
    assert not outline.get(key), ('outline carries ' + key, outline.get(key))
print(json.dumps(out, indent=2))
`;
assert.equal(process.env.D351_SOURCE_FROZEN, '1', 'Root must freeze all writers before D351 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'SPLINE_CLOSING_EXACT_TANGENT_ARCS', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One closed 12-point spline from an empty document, extruded 10 mm; one XY sketch plane; integer fit points on the 1 mm grid.', 'Clicks go through window.__studioScreenOf pixels; the snapped fit points the sketch ends up with are recorded before the claim is asserted.',
    'Product reads (the bundled inspector) are product code, not an independent oracle.', 'The Python oracle (python3 -I, Fractions, zero product imports) decides point exactness, arc equidistance, tangency, area and volume.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){out.bodyCount=view.bodies.length;if(view.bodies.length){const key=view.bodies[0].key,p=part('D351 observed',doc),body=p.body(key);out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.facadeVolume=body.mass({density:1}).volume;}}
const sk=doc.nodes.find((n:any)=>n.kind==='sketch');out.segments=sk&&sk.profile==='loop'?sk.segments:null;out.outlineKeys=sk?.outline?Object.keys(sk.outline):null;
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
    sketchAlert: document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null, sketchStatus: document.querySelector('.sk-panel [role="status"]')?.textContent ?? null }), label);
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
  report.observations.push({ label: 'framing-failed', tries }); await persist(); assert.fail('all twelve fit points could not be framed on the canvas');
}
const pointsRead = () => page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Point "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
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
// Product read (bundled inspector) and the independent Python oracle on the same document, fit points and Studio volume. The oracle input is written before any assertion on its verdict.
async function inspect(label, fit, volume) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  const read = JSON.parse(run.stdout); report.reads.push({ label, studioVolume: volume ?? null, ...read }); await persist();
  const input = { doc: accepted, node: 0, fit, volume: volume ?? null }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'spline-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stdout: check.stdout ? JSON.parse(check.stdout) : null, stderr: check.stderr }); await persist();
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); assert.equal(JSON.parse(check.stdout).status, 'PASS');
  assert.equal(read.ok, true, `product evaluation ok (${read.error})`);
  if (volume !== undefined) { assert.equal(read.bodyCount, 1); assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6, `product evalVolume ${read.evalVolume} vs Studio ${volume}`); assert.ok(Math.abs(read.facadeVolume - volume) <= 1e-6, `facade volume ${read.facadeVolume} vs Studio ${volume}`); }
  assert.deepEqual(await doc(), accepted); return { read, verified: JSON.parse(check.stdout) };
}
const initialFiles = ['apps/cad-studio/test/spline-closing-browser.mjs', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/app/sketchControls.ts', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/sketch/spline.ts', 'packages/barocss-cad-model/src/sketch/rules.ts', 'packages/barocss-cad-model/src/sketch/profile.ts',
  'packages/barocss-cad-model/src/sketch/outlineFields.ts', 'packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/osnap.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
// The twelve fit points of the claim.
const FIT = Array.from({ length: 12 }, (_, i) => { const t = 2 * Math.PI * i / 12; return [Math.round(40 * Math.cos(t) + 7 * Math.cos(3 * t)), Math.round(25 * Math.sin(t))]; });
const same2 = (a, b) => a[0] === b[0] && a[1] === b[1];
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'spline-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  report.fit = FIT; assert.equal(new Set(FIT.map(p => p.join())).size, 12, 'twelve distinct fit points');
  const buildInputs = [], sourcefile = 'd351-inspector.ts', virtual = resolve(app, sourcefile);
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
  phase = 'click twelve fit points'; for (const p of FIT) await worldClick(p);
  const clicked = await pointsRead(); report.observations.push({ label: '01-clicked', panelPoints: clicked }); await snapshot('01-clicked');
  // The clicks must have landed exactly: each fit point is among the panel's points (none was snapped elsewhere). A mismatch here is a driver/snapping issue, not the claim.
  if (clicked.length) {
    const have = []; for (let i = 0; i + 1 < clicked.length; i += 2) have.push([Number(clicked[i].value), Number(clicked[i + 1].value)]);
    const lost = FIT.filter(p => !have.some(q => same2(p, q))); report.observations.push({ label: '01-clicked-check', lost }); await persist();
    assert.deepEqual(lost, [], 'every clicked point appears in the open spline (no click was snapped elsewhere)');
  }
  phase = 'close spline'; await worldClick(FIT[0]);
  const closedPoints = await pointsRead(); report.observations.push({ label: '02-closed', panelPoints: closedPoints, status: await page.evaluate(() => document.querySelector('.sk-panel [role="status"]')?.textContent ?? null) }); await snapshot('02-closed');
  const done03 = await finishSketch('03-finished'), doc03 = done03.doc; assert.equal(doc03.nodes.length, 1, 'one sketch node'); const node = doc03.nodes[0];
  const starts = node.profile === 'loop' ? node.segments.map(g => g.start) : [], missing = FIT.filter(p => !starts.some(s => same2(s, p)));
  const outline = node.outline ?? {}; report.observations.push({ label: '03-sketch', profile: node.profile, segments: node.segments?.length ?? null, arcs: node.segments?.filter(g => g.kind === 'arc').length ?? null, outlineKeys: Object.keys(outline),
    equalRadii: outline.equalRadii ?? null, concentric: outline.concentric ?? null, tangents: outline.tangents ?? null, tangentsLength: outline.tangents?.length ?? 0, missingFitPoints: missing, sketch: node }); await persist();
  assert.equal(node.kind, 'sketch'); assert.equal(node.profile, 'loop', 'closed spline is a loop profile');
  const read03 = await inspect('03-native', FIT);
  assert.deepEqual(missing, [], 'every clicked point equals the start of a stored segment (bitwise)');
  assert.ok(!outline.equalRadii?.length, `outline.equalRadii: ${JSON.stringify(outline.equalRadii)}`); assert.ok(!outline.concentric?.length, `outline.concentric: ${JSON.stringify(outline.concentric)}`);
  assert.equal(read03.read.bodyCount, 0);

  // Extrude 10 mm.
  await startExtrude('04'); const operation = await page.evaluate(() => { const s = document.querySelector('.hud select[aria-label="Operation"]'); return s ? { value: s.value, options: [...s.options].map(o => o.value) } : null; });
  const depthSelect = await hud().getByLabel('Depth', { exact: true }).count(); report.observations.push({ label: '04-extrude-hud', operation, depthSelect, hudText: await page.evaluate(() => document.querySelector('.hud')?.textContent ?? null) });
  if (operation && operation.options.includes('new') && operation.value !== 'new') await hud().getByLabel('Operation', { exact: true }).selectOption('new');
  if (depthSelect) await hud().getByLabel('Depth', { exact: true }).selectOption('distance');
  const distance = hud().getByLabel('Distance', { exact: true }); await distance.waitFor(); await distance.fill('10');
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
  await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(doc03); await hud().waitFor({ state: 'hidden' }); const done04 = await snapshot('04-extruded'), doc04 = done04.doc;
  assert.deepEqual(doc04.nodes[0], doc03.nodes[0], 'the sketch node is unchanged by the extrude'); assert.equal(doc04.nodes.length, 2); assert.equal(doc04.nodes[1].kind, 'extrude'); assert.equal(Math.abs(doc04.nodes[1].height), 10);
  assert.equal(done04.bodies.bodies.length, 1, 'one body'); const volume = done04.bodies.bodies[0].volume; assert.deepEqual(await alerts(), []);
  await inspect('04-native', FIT, volume);
  phase = 'Undo/Redo'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await same(doc03); await page.keyboard.press('Meta+Shift+z'); await same(doc04);
  const saved = await save('spline'); assert.deepEqual(saved.doc, doc04);

  // Context 2: fresh Open.
  const fresh = await freshOpen(saved.file, saved.doc, '05-fresh-open'); assert.equal(fresh.bodies.bodies.length, 1); assert.ok(Math.abs(fresh.bodies.bodies[0].volume - volume) <= 1e-6, `05: volume ${fresh.bodies.bodies[0].volume} vs ${volume}`);
  await inspect('05-native', FIT, fresh.bodies.bodies[0].volume);
  const reopened = await reopenSketch('06'); report.observations.push({ label: '06-reopened', panelPoints: reopened }); await snapshot('06-reopened'); assert.deepEqual(await doc(), saved.doc, '06: reopening does not change the document');
  await leaveSketch('06-left', saved.doc);
  await inspect('06-native', FIT, fresh.bodies.bodies[0].volume);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
