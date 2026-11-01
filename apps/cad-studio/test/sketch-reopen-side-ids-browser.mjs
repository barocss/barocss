// D355 qualification: reopening a finished sketch (rectangle + circle hole) and pressing Finish keeps the walls' side ids (`node.sideTags`), with or without
// an edit, so the downstream Fillet (n2 names n1.side[e2]|n1.side[e3]) keeps pointing at the same two walls. Root must freeze all sources first.
// Run from apps/cad-studio:
// D355_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/sketch-reopen-side-ids-browser.mjs /absolute/artifacts
// Actual Studio UI (Open, history, feature editor, Sketch panel, Finish, Undo/Redo, Save) mutates. Readonly hooks observe only.
// Context 3 (06/07) draws a Bezier first and then a rectangle, so the Bezier takes the first side id; Extrude 10, reopen, Finish unchanged keeps node 0 sideTags (the order that reproduces the defect in the real hook).
// One Chrome WebGPU process, sequential fresh contexts. Independent Python oracle (no product imports) checks the stored sketch, the fillet names and the analytic volume.
// Expected at a base without the D355 fix: the driver FAILS at the first claim, 02 sideTags (outer e1-e4 renamed e6-e9); the failure state is snapshotted before asserting.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent exact check of a filleted box with one circular hole made from a rectangle sketch. Product imports: zero."""
import json, math, sys
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; opened = data['opened']; width = F(data['width'])
nodes = doc['nodes']
sk, ex, fil = nodes[0], nodes[1], nodes[2]
assert [n['kind'] for n in nodes] == ['sketch', 'extrude', 'fillet'] and [n['id'] for n in nodes] == ['n0', 'n1', 'n2'] and doc['nextId'] == 3, 'nodes: sketch, extrude, fillet'
assert ex['sketch'] == 0
# The rectangle: min/max, or the four axis-aligned points of its outline / polygon.
if sk['profile'] == 'rectangle':
    lo = [fr(c) for c in sk['min']]; hi = [fr(c) for c in sk['max']]
else:
    assert sk['profile'] in ('polygon', 'loop'), ('profile', sk['profile'])
    raw = sk['outline']['points'] if sk.get('outline') else (sk['points'] if sk['profile'] == 'polygon' else [s['start'] for s in sk['segments']])
    pts = [[fr(c) for c in p] for p in raw]
    assert len(pts) == 4, 'a rectangle outline has four points'
    xs = sorted({p[0] for p in pts}); ys = sorted({p[1] for p in pts})
    assert len(xs) == 2 and len(ys) == 2, 'axis-aligned'
    lo = [xs[0], ys[0]]; hi = [xs[1], ys[1]]
w = hi[0] - lo[0]; d = hi[1] - lo[1]; h = fr(ex['height'])
assert lo == [0, 0] and d == 40 and h == 10 and abs(float(w - width)) <= 1e-9, ('rectangle', [str(c) for c in lo], str(w), str(d), str(h), str(width))
assert len(sk['holes']) == 1 and not sk.get('regions'), 'one hole, no regions'
loop = sk['holes'][0]; assert len(loop) == 1 and loop[0]['kind'] == 'arc', 'the hole is one full arc'
c = [fr(v) for v in loop[0]['center']]; s0 = [fr(v) for v in loop[0]['start']]
r = math.sqrt(float((s0[0] - c[0]) ** 2 + (s0[1] - c[1]) ** 2))
assert float(c[0]) == 15 and float(c[1]) == 20 and abs(r - 5) <= 1e-9, ('hole', [str(v) for v in c], r)
assert lo[0] < c[0] - 5 and c[1] - 5 > lo[1] and c[1] + 5 < hi[1], 'the hole lies inside the rectangle'
assert fil['parent'] == {'node': 1, 'side': 'solid'} and fil['edges'] == ['n1.side[e2]|n1.side[e3]'] and fil['radius'] == 3, ('fillet node', fil)
assert not (fil.get('rematched') or fil.get('held') or fil.get('suppressed')), 'fillet carries no rematched/held/suppressed mark'
assert sk['sideTags'] == opened['sideTags'], ('sideTags differ from the opened document', sk['sideTags'], opened['sideTags'])
assert sk['sideTags']['outer'] == ['e1', 'e2', 'e3', 'e4'] and sk['sideTags']['holes'] == [['e5']], ('sideTags', sk['sideTags'])
rf = fr(fil['radius'])
volume = float(w * d * h) - math.pi * r * r * float(h) - (float(rf * rf) - math.pi * float(rf * rf) / 4) * float(h)
assert abs(volume - reported) <= 1e-6, ('volume', volume, reported)
print(json.dumps({'status': 'PASS', 'width': str(w), 'depth': str(d), 'height': str(h), 'holeRadius': r, 'filletRadius': str(rf), 'sideTags': sk['sideTags'], 'analyticVolume': volume, 'reportedVolume': reported,
  'delta': abs(volume - reported), 'productImports': 0}, indent=2))
`;
const oracle2Source = String.raw`"""Independent exact check of a plain extruded rectangle (no hole, no fillet) drawn after a Bezier in the same sketch. Product imports: zero."""
import json, sys
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; first = data['first']
nodes = doc['nodes']; sk, ex = nodes[0], nodes[1]
assert [n['kind'] for n in nodes] == ['sketch', 'extrude'] and [n['id'] for n in nodes] == ['n0', 'n1'], 'nodes: sketch, extrude'
assert ex['sketch'] == 0 and fr(ex['height']) == 10, ('extrude', ex.get('sketch'), ex.get('height'))
if sk['profile'] == 'rectangle':
    lo = [fr(c) for c in sk['min']]; hi = [fr(c) for c in sk['max']]
else:
    assert sk['profile'] in ('polygon', 'loop'), ('profile', sk['profile'])
    raw = sk['outline']['points'] if sk.get('outline') else (sk['points'] if sk['profile'] == 'polygon' else [s['start'] for s in sk['segments']])
    pts = [[fr(c) for c in p] for p in raw]
    assert len(pts) == 4, 'a rectangle outline has four points'
    xs = sorted({p[0] for p in pts}); ys = sorted({p[1] for p in pts})
    assert len(xs) == 2 and len(ys) == 2, 'axis-aligned'
    lo = [xs[0], ys[0]]; hi = [xs[1], ys[1]]
assert lo == [0, 0] and hi == [60, 40], ('rectangle', [str(c) for c in lo], [str(c) for c in hi])
assert not sk.get('holes') and not sk.get('regions'), 'no holes, no regions'
assert sk['construction'] == [{'kind': 'bezier', 'poles': [[0, 50], [10, 60], [20, 50]]}], ('construction', sk['construction'])
assert sk['sideTags'] == first['sideTags'], ('sideTags differ from the first Finish', sk['sideTags'], first['sideTags'])
assert len(sk['sideTags']['outer']) == 4 and not sk['sideTags'].get('holes'), ('sideTags shape', sk['sideTags'])
volume = float((hi[0] - lo[0]) * (hi[1] - lo[1]) * fr(ex['height']))
assert volume == 24000 and abs(volume - reported) <= 1e-6, ('volume', volume, reported)
print(json.dumps({'status': 'PASS', 'sideTags': sk['sideTags'], 'analyticVolume': volume, 'reportedVolume': reported, 'productImports': 0}, indent=2))
`;
assert.equal(process.env.D355_SOURCE_FROZEN, '1', 'Root must freeze all writers before D355 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
const fixtureFile = resolve(import.meta.dirname, 'fixtures/d355.bcad');
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'SKETCH_REOPEN_FINISH_KEEPS_SIDE_IDS', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One rectangle sketch with one circle hole, one Extrude, one vertical-edge Fillet; one edit (Edge 1 length 60 to 70 in the Sketch panel).', 'The Python oracle checks the stored sketch, the fillet names, sideTags equality and the analytic volume, not kernel topology.',
    'Product reads (the bundled inspector, evaluateDoc and the facade edge query) are product code, not an independent oracle.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const HOLE = Math.PI * 25 * 10, CORNER = (9 - 9 * Math.PI / 4) * 10, VOLUME = width => width * 40 * 10 - HOLE - CORNER, FILLET_EDGE = ['n1.side[e2]|n1.side[e3]'];
const OPENED_VOLUME = VOLUME(60), EDITED_VOLUME = VOLUME(70);
// Reads (readonly): the evaluated body, and the fillet's named edge on the body before the fillet (the fillet consumes it), by the facade edge query.
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){const key=view.bodies[0].key,body=part('D355 observed',doc).body(key);out.bodyCount=view.bodies.length;out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.massVolume=body.mass({density:1}).volume;}
const fil=doc.nodes[2];out.filletEdges=fil?.edges??null;out.filletMarks={rematched:fil?.rematched??null,held:fil?.held??null,suppressed:fil?.suppressed??null};out.sideTags=doc.nodes[0]?.sideTags??null;
const pre={...doc,nodes:doc.nodes.slice(0,2),outputs:{b1:{node:1,side:'solid'}}},pv=evaluateDoc(pre,0);out.preOk=!!pv.ok;
if(pv.ok){const edges=part('D355 before fillet',pre).body(pv.bodies[0].key).select().edges().list();out.edgeFound=edges.filter(e=>e.names.some(n=>(fil?.edges??[]).includes(n))).map(e=>({names:e.names,a:e.a,b:e.b}));out.sampleEdgeNames=edges.map(e=>e.names[0]);}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;
const doc = () => page.evaluate(() => window.__studioDoc);
const editor = () => page.locator('.node-editor');
const sketchPanel = () => page.getByRole('complementary', { name: 'Sketch', exact: true });
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
async function same(expected) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), expected); }
const bodies = () => page.evaluate(() => window.__studioBodies());
const alerts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent));
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(), selection: window.__studioSelection ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent),
    editor: document.querySelector('.node-editor')?.textContent ?? null, sketchPanel: document.querySelector('.sk-panel')?.textContent ?? null, hud: document.querySelector('.hud')?.textContent ?? null }), label);
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
// The sketch (node 0) is consumed by Extrude n1, whose feature editor offers Edit sketch (NodeEditor.tsx:20 onEditSketch; useSketchActions.ts editSketch reopens it under Select, startPicking turning the rectangle into an outline).
async function reopenSketch(label) {
  phase = `reopen sketch ${label}`; const state = await doc(), consumer = state.nodes.findIndex(n => n.kind === 'extrude' && n.sketch === 0); assert.equal(consumer, 1, 'Sketch 0 is consumed by Extrude node 1');
  await page.locator(`.history .hs[data-node-index="${consumer}"]`).click(); await editor().waitFor(); await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor();
  return page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Point "], .sk-panel input[aria-label^="Edge "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
}
async function finishSketch(label) {
  phase = `Finish sketch ${label}`; await page.locator('.topbar button.finish').click(); await sketchPanel().waitFor({ state: 'hidden' }); await ready();
  return snapshot(label);
}
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
// Product read (bundled inspector, product code) plus the independent Python oracle on the same document and the Studio-reported volume.
async function inspect(label, width, opened) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), studio = await bodies(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  assert.equal(studio.bodies.length, 1, 'Studio reports one body'); const volume = studio.bodies[0].volume;
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  const read = JSON.parse(run.stdout); report.reads.push({ label, studioVolume: volume, ...read }); await persist();
  const input = { doc: accepted, volume, opened: { sideTags: opened.nodes[0].sideTags }, width }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  assert.equal(read.ok, true, `${label}: product evaluation ok (${read.error})`); assert.equal(read.bodyCount, 1); assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6, `product evalVolume ${read.evalVolume} vs Studio ${volume}`); assert.ok(Math.abs(read.massVolume - volume) <= 1e-6, `product massVolume ${read.massVolume} vs Studio ${volume}`);
  assert.deepEqual(read.filletEdges, FILLET_EDGE, `${label}: fillet edge name`); assert.equal(read.preOk, true); assert.equal(read.edgeFound.length, 1, `${label}: the fillet's named edge exists on the body before it (${read.edgeFound.length}; names ${read.sampleEdgeNames})`);
  const [a, b] = read.edgeFound[0].a[2] <= read.edgeFound[0].b[2] ? [read.edgeFound[0].a, read.edgeFound[0].b] : [read.edgeFound[0].b, read.edgeFound[0].a];
  assert.ok(Math.abs(a[0] - width) <= 1e-6 && Math.abs(a[1] - 40) <= 1e-6 && Math.abs(a[2]) <= 1e-6 && Math.abs(b[0] - width) <= 1e-6 && Math.abs(b[1] - 40) <= 1e-6 && Math.abs(b[2] - 10) <= 1e-6, `${label}: fillet edge endpoints ${JSON.stringify([a, b])} at x=${width}`);
  const check = spawnSync('python3', ['-I', join(output, 'sketch-reopen-side-ids-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); const verified = JSON.parse(check.stdout); assert.equal(verified.status, 'PASS'); report.oracles.push({ label, verified });
  assert.deepEqual(await doc(), accepted); return { read, verified };
}
// Context 3 helpers (copied from bezier-sketch-browser.mjs / sketch-reopen-identity-browser.mjs).
const hud = () => page.getByRole('dialog', { name: 'Extrude', exact: true });
async function changed(before) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) !== x, JSON.stringify(before), { timeout: 60000 }); await ready(); }
async function command(label) { await page.keyboard.press('Space'); await page.locator('.palette input').fill(label); await page.keyboard.press('Enter'); }
const screenOf = point => page.evaluate(point => window.__studioScreenOf?.(point), [...point, 0]);
async function worldClick(point) { const pixel = await screenOf(point); assert.ok(pixel?.length === 2, 'screen position of the point'); await page.mouse.click(pixel[0], pixel[1]); await page.waitForTimeout(60); }
async function frame(points) {
  const tries = [];
  for (let i = 0; i < 10; i++) {
    const read = await page.evaluate(points => { const c = document.querySelector('.vp-canvas'), r = c.getBoundingClientRect();
      const px = points.map(p => window.__studioScreenOf([p[0], p[1], 0]));
      const hits = px.map(q => q && q[0] > r.left + 24 && q[0] < r.right - 24 && q[1] > r.top + 24 && q[1] < r.bottom - 24 && !!document.elementFromPoint(q[0], q[1])?.closest('.vp-canvas'));
      return { canvas: [r.left, r.top, r.width, r.height], px, allOnCanvas: hits.every(Boolean) }; }, points);
    tries.push(read); if (read.allOnCanvas) { report.observations.push({ label: 'framing', tries }); await persist(); return read; }
    const [left, top, width, height] = read.canvas; await page.mouse.move(left + width / 2, top + height / 2); await page.mouse.wheel(0, 400); await page.waitForTimeout(400);
  }
  report.observations.push({ label: 'framing-failed', tries }); await persist(); assert.fail('the points could not be framed on the canvas');
}
async function tool(name, key) {
  const b = page.getByRole('button', { name, exact: true }); const count = await b.count(); report.observations.push({ label: `tool-${name}`, buttons: count });
  if (count === 1) await b.click(); else { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press(key); }
  await page.waitForTimeout(100);
}
// Select the finished sketch (node 0) and open the Extrude HUD with E.
async function startExtrude(label) {
  phase = `Extrude HUD ${label}`;
  const selected = await page.evaluate(() => (window.__studioSelection?.selection?.sketches ?? []).includes(0)); report.observations.push({ label: `extrude-${label}-preselected`, selected });
  if (!selected) { await page.locator('.history .hs[data-node-index="0"]').click(); await editor().waitFor(); await editor().getByRole('button', { name: 'Close editor', exact: true }).click(); await editor().waitFor({ state: 'hidden' }); }
  await page.waitForFunction(() => (window.__studioSelection?.selection?.sketches ?? []).includes(0), null, { timeout: 15000 });
  await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('e'); await hud().waitFor();
  await page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 });
}
// Product read (bundled inspector, no fillet in this document) plus the independent second Python oracle. Everything is written before the first assertion.
async function inspect3(label, first) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), studio = await bodies(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const volume = studio.bodies[0]?.volume; const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? '');
  const read = run.status === 0 ? JSON.parse(run.stdout) : null; report.reads.push({ label, studioVolume: volume, ...read });
  const input = { doc: accepted, volume, first: { sideTags: first.nodes[0].sideTags } }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'sketch-reopen-side-ids-oracle2.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stderr: check.stderr, verified: check.stdout ? JSON.parse(check.stdout) : null }); await persist();
  assert.equal(run.status, 0, run.stderr); assert.equal(studio.bodies.length, 1, `${label}: one body`); assert.equal(read.ok, true, `${label}: product evaluation ok (${read.error})`); assert.equal(read.bodyCount, 1);
  assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6 && Math.abs(read.massVolume - volume) <= 1e-6, `${label}: product volumes ${read.evalVolume}/${read.massVolume} vs Studio ${volume}`);
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); assert.equal(JSON.parse(check.stdout).status, 'PASS'); assert.deepEqual(await doc(), accepted);
}
const initialFiles = ['apps/cad-studio/test/sketch-reopen-side-ids-browser.mjs', 'apps/cad-studio/test/fixtures/d355.bcad', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/ui/FeatureHistoryBar.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/app/sketchControls.ts', 'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/select.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
const marks = node => ({ rematched: node.rematched ?? null, held: node.held ?? null, suppressed: node.suppressed ?? null });
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'sketch-reopen-side-ids-oracle.py'), oracleSource); await writeFile(join(output, 'sketch-reopen-side-ids-oracle2.py'), oracle2Source); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  report.fixture = { file: fixtureFile, hash: hash(await readFile(fixtureFile)) }; const fixtureDoc = JSON.parse(await readFile(fixtureFile, 'utf8'));
  const buildInputs = [], sourcefile = 'd355-inspector.ts', virtual = resolve(app, sourcefile);
  const built = await build({ stdin: { contents: inspectSource, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  await writeFile(join(output, 'inspector.ts'), inspectSource); await writeFile(join(output, 'inspector-metafile.json'), JSON.stringify(built.metafile, null, 2));
  // Stdin has no disk path. Its exact source/hash is captured and the virtual input is explicitly excluded.
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual)); report.virtualSources = [{ label: 'inspector', hash: hash(inspectSource), virtualInputExcluded: virtual }];
  inspector = join(output, 'inspector.mjs'); await writeFile(inspector, built.outputFiles[0].contents);
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
  frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts']; report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
  for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' }); server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;

  // Context 1: Open, Finish unchanged, edit the width and Finish, Undo/Redo, Save.
  phase = 'Open fixture'; await newPage(); await openFile(fixtureFile, 3);
  const opened = await doc(); report.openedEqualsFixtureBytes = JSON.stringify(opened) === JSON.stringify(fixtureDoc); report.openedEqualsFixtureSemantically = (() => { try { assert.deepEqual(opened, fixtureDoc); return true; } catch { return false; } })(); await persist();
  assert.deepEqual(opened.nodes.map(n => n.id), ['n0', 'n1', 'n2']); assert.equal(opened.nextId, 3); assert.deepEqual(opened.nodes[0].sideTags, { outer: ['e1', 'e2', 'e3', 'e4'], holes: [['e5']] }); assert.deepEqual(opened.nodes[2].edges, FILLET_EDGE);
  assert.equal((await bodies()).bodies.length, 1); await snapshot('01-opened'); await inspect('01-native', 60, opened); assert.ok(Math.abs((await bodies()).bodies[0].volume - OPENED_VOLUME) <= 1e-6, `opened volume ${OPENED_VOLUME}`);

  const fieldsBefore1 = await reopenSketch('02-reopened'); report.observations.push({ label: '02-reopened', fields: fieldsBefore1 }); await persist(); await snapshot('02-reopened');
  const finished1 = await finishSketch('02-finish-unchanged'), toasts1 = await alerts(), after1 = finished1.doc;
  report.observations.push({ label: '02-finish-unchanged', node0Before: opened.nodes[0], node0After: after1.nodes[0], filletBefore: opened.nodes[2], filletAfter: after1.nodes[2], docEqual: JSON.stringify(after1) === JSON.stringify(opened), toasts: toasts1, volume: finished1.bodies.bodies.map(b => b.volume) }); await persist();
  assert.deepEqual(after1.nodes[0].sideTags, opened.nodes[0].sideTags, `02: Finish without a change keeps node 0 sideTags (THE claim): ${JSON.stringify(after1.nodes[0].sideTags)} vs ${JSON.stringify(opened.nodes[0].sideTags)}`);
  assert.deepEqual(after1.nodes[2].edges, opened.nodes[2].edges, '02: fillet edges unchanged'); assert.deepEqual(marks(after1.nodes[2]), { rematched: null, held: null, suppressed: null }, '02: fillet has no rematched/held/suppressed');
  assert.deepEqual(toasts1, [], '02: no toast'); assert.deepEqual(after1.nodes.map(n => n.id), ['n0', 'n1', 'n2']); assert.equal(after1.nextId, 3); assert.deepEqual(after1.nodes.slice(1), opened.nodes.slice(1), '02: extrude and fillet nodes unchanged'); assert.deepEqual(after1.outputs, opened.outputs);
  assert.equal(finished1.bodies.bodies.length, 1); assert.ok(Math.abs(finished1.bodies.bodies[0].volume - OPENED_VOLUME) <= 1e-6, '02: volume unchanged'); await inspect('02-native', 60, opened);

  const fieldsBefore2 = await reopenSketch('03-reopened'); const beforeEdit = await doc();
  // The panel shows the rectangle as a four-edge outline (startPicking): Edge 1 is the bottom edge (point 1 to 2), 60 mm; typing locks the length (SketchPanel.tsx onChange/onKeyDown Enter lock) and the solver moves points 2 and 3.
  const edge1 = sketchPanel().getByLabel('Edge 1 length', { exact: true }); await edge1.waitFor(); assert.equal(Number(await edge1.inputValue()), 60, 'Edge 1 length shows 60 before the edit');
  await edge1.fill('70'); await edge1.press('Enter'); await page.waitForTimeout(500);
  const fieldsAfter = await page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Point "], .sk-panel input[aria-label^="Edge "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
  report.observations.push({ label: '03-edge-edit', fieldsBefore: fieldsBefore2, fieldsAfter }); await persist();
  const edited = await finishSketch('03-edited'), editedDoc = edited.doc, toasts2 = await alerts();
  report.observations.push({ label: '03-edited', node0: editedDoc.nodes[0], fillet: editedDoc.nodes[2], toasts: toasts2, volume: edited.bodies.bodies.map(b => b.volume) }); await persist();
  assert.notDeepEqual(editedDoc, beforeEdit, '03: the edit changed the document');
  assert.deepEqual(editedDoc.nodes[0].sideTags, opened.nodes[0].sideTags, `03: sideTags kept after an edit: ${JSON.stringify(editedDoc.nodes[0].sideTags)}`);
  assert.deepEqual(editedDoc.nodes[2].edges, FILLET_EDGE, '03: fillet edge name unchanged'); assert.deepEqual(marks(editedDoc.nodes[2]), { rematched: null, held: null, suppressed: null }, '03: fillet has no rematched/held/suppressed');
  assert.deepEqual(toasts2, [], '03: no toast'); assert.deepEqual(editedDoc.nodes.map(n => n.id), ['n0', 'n1', 'n2']); assert.equal(editedDoc.nextId, 3); assert.deepEqual(editedDoc.nodes[1], opened.nodes[1], '03: extrude unchanged');
  assert.equal(edited.bodies.bodies.length, 1); assert.ok(Math.abs(edited.bodies.bodies[0].volume - EDITED_VOLUME) <= 1e-6, `03: volume ${edited.bodies.bodies[0].volume} vs ${EDITED_VOLUME}`); await inspect('03-native', 70, opened);

  phase = 'Undo/Redo edit'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await same(after1); await page.keyboard.press('Meta+Shift+z'); await same(editedDoc);
  const saved = await save('edited'); assert.deepEqual(saved.doc, editedDoc);

  // Context 2: fresh Open of edited.bcad, reopen the sketch and Finish unchanged again.
  await freshOpen(saved.file, saved.doc, '04-fresh-open'); await inspect('04-native', 70, opened);
  const fieldsFresh = await reopenSketch('05-reopened'); report.observations.push({ label: '05-reopened', fields: fieldsFresh }); await persist();
  const finished2 = await finishSketch('05-finish-after-open'), toasts3 = await alerts(), after2 = finished2.doc;
  report.observations.push({ label: '05-finish-after-open', node0Before: editedDoc.nodes[0], node0After: after2.nodes[0], docEqual: JSON.stringify(after2) === JSON.stringify(editedDoc), toasts: toasts3, volume: finished2.bodies.bodies.map(b => b.volume) }); await persist();
  assert.deepEqual(after2.nodes[0].sideTags, opened.nodes[0].sideTags, `05: Finish after Open keeps sideTags: ${JSON.stringify(after2.nodes[0].sideTags)}`);
  assert.deepEqual(after2.nodes.slice(1), editedDoc.nodes.slice(1), '05: extrude and fillet unchanged'); assert.deepEqual(marks(after2.nodes[2]), { rematched: null, held: null, suppressed: null }); assert.deepEqual(toasts3, [], '05: no toast'); assert.equal(after2.nextId, 3);
  assert.equal(finished2.bodies.bodies.length, 1); assert.ok(Math.abs(finished2.bodies.bodies[0].volume - EDITED_VOLUME) <= 1e-6, '05: volume unchanged'); await inspect('05-native', 70, opened);

  // Context 3: another shape takes the first side id before the rectangle (a Bezier drawn first), then Extrude, reopen and Finish unchanged.
  phase = 'bezier-first: new part'; await newPage(); await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0); await ready(); assert.equal((await doc()).nodes.length, 0, '06: the document starts empty');
  phase = 'bezier-first: start XY sketch'; await command('Sketch'); await sketchPanel().waitFor(); await sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
  await frame([[0, 50], [10, 60], [20, 50], [0, 0], [60, 40]]);
  phase = 'bezier-first: Bezier'; await tool('Bézier', 'b'); for (const p of [[0, 50], [10, 60], [20, 50]]) await worldClick(p);
  phase = 'bezier-first: rectangle'; await tool('Rectangle', 'r'); await worldClick([0, 0]); await worldClick([60, 40]);
  const first = await finishSketch('06-bezier-first-finished'), firstDoc = first.doc, firstToasts = await alerts();
  report.observations.push({ label: '06-bezier-first-finished', node0: firstDoc.nodes[0], sideTags: firstDoc.nodes[0]?.sideTags ?? null, nodeCount: firstDoc.nodes.length, toasts: firstToasts }); await persist();
  assert.equal(firstDoc.nodes.length, 1, '06: one sketch node'); assert.equal(firstDoc.nodes[0].kind, 'sketch'); assert.deepEqual(firstDoc.nodes[0].construction, [{ kind: 'bezier', poles: [[0, 50], [10, 60], [20, 50]] }], '06: the Bezier is stored'); assert.deepEqual(firstToasts, [], '06: no toast');
  await startExtrude('bezier-first'); phase = 'bezier-first: Extrude Apply'; const distance = hud().getByLabel('Distance', { exact: true });
  const depth = hud().getByLabel('Depth', { exact: true }); if (await depth.count() === 1) await depth.selectOption('distance');
  await distance.waitFor(); await distance.fill('10'); await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
  await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(firstDoc); await hud().waitFor({ state: 'hidden' }); const extruded = await snapshot('06-bezier-first-extruded'), extrudedDoc = extruded.doc;
  report.observations.push({ label: '06-bezier-first-extruded', nodes: extrudedDoc.nodes.map(n => ({ id: n.id, kind: n.kind, sketch: n.sketch, height: n.height })), volume: extruded.bodies.bodies.map(b => b.volume), toasts: await alerts() }); await persist();
  assert.deepEqual(extrudedDoc.nodes.map(n => n.kind), ['sketch', 'extrude']); assert.deepEqual(extrudedDoc.nodes[0], firstDoc.nodes[0], '06: Extrude leaves the sketch node unchanged'); assert.equal(extrudedDoc.nodes[1].sketch, 0); assert.equal(Math.abs(extrudedDoc.nodes[1].height), 10);
  assert.equal(extruded.bodies.bodies.length, 1, '06: one body'); assert.ok(Math.abs(extruded.bodies.bodies[0].volume - 24000) <= 1e-6, `06: volume ${extruded.bodies.bodies[0].volume} vs 24000`);
  const fieldsBezier = await reopenSketch('07-reopened'); report.observations.push({ label: '07-reopened', fields: fieldsBezier, sideTagsBefore: extrudedDoc.nodes[0].sideTags }); await persist();
  const refinished = await finishSketch('07-bezier-first-refinished'), toasts7 = await alerts(), after7 = refinished.doc;
  report.observations.push({ label: '07-bezier-first-refinished', node0Before: extrudedDoc.nodes[0], node0After: after7.nodes[0], docEqual: JSON.stringify(after7) === JSON.stringify(extrudedDoc), toasts: toasts7, volume: refinished.bodies.bodies.map(b => b.volume) }); await persist();
  await inspect3('07-native', first.doc);
  assert.deepEqual(after7.nodes[0].sideTags, firstDoc.nodes[0].sideTags, `07: Finish without a change keeps node 0 sideTags (THE claim): ${JSON.stringify(after7.nodes[0].sideTags)} vs ${JSON.stringify(firstDoc.nodes[0].sideTags)}`);
  assert.deepEqual(after7.nodes[0].construction, firstDoc.nodes[0].construction, '07: the Bezier is still in construction'); assert.deepEqual(toasts7, [], '07: no toast'); assert.equal(refinished.bodies.bodies.length, 1, '07: one body');
  assert.ok(Math.abs(refinished.bodies.bodies[0].volume - 24000) <= 1e-6, `07: volume ${refinished.bodies.bodies[0].volume} unchanged`);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
