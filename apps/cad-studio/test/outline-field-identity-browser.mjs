// D348 qualification: a driving-dimension edit in the feature editor keeps the sketch node's identity (id, sideTags, construction, other fields),
// so the downstream fillet keeps resolving; geometry follows the new value. Root must freeze all sources first.
// Run from apps/cad-studio:
// D348_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/outline-field-identity-browser.mjs /absolute/artifacts
// Actual Studio UI (Open, history, feature editor, Sketch panel, Undo/Redo, Save) mutates. Readonly hooks observe only.
// One Chrome WebGPU process, sequential fresh contexts. Independent Python oracle (no product imports) checks the stored outline and analytic volume.
// Expected at a base without the D348 fix: the driver FAILS at the first violated identity claim (the failure state is snapshotted before asserting).
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent exact (Fraction) check of an L plate with one rectangular hole and a corner fillet. Product imports: zero."""
import json, math, sys
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)

def shoelace(poly):
    s = F(0)
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        s += p[0] * q[1] - q[0] * p[1]
    return s / 2

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; expect = data.get('expectLengths')
nodes = doc['nodes']
sketches = [n for n in nodes if n['kind'] == 'sketch']; extrudes = [n for n in nodes if n['kind'] == 'extrude']; fillets = [n for n in nodes if n['kind'] == 'fillet']
assert len(sketches) == 1 and len(extrudes) == 1 and len(fillets) == 1, 'one sketch, one extrude, one fillet'
sk = sketches[0]; ex = extrudes[0]; fl = fillets[0]
outline = sk['outline']
pts = [[fr(c) for c in p] for p in outline['points']]
n = len(pts); assert n >= 3
# closed: the outline is a closed loop of n edges (edge i runs points[i] -> points[(i+1) % n]); no duplicate closing point, no zero edge
assert pts[0] != pts[-1], 'outline must not repeat its first point'
hv = outline.get('hv') or {'h': [], 'v': []}
H = set(hv.get('h', [])); V = set(hv.get('v', []))
for i in range(n):
    a = pts[i]; b = pts[(i + 1) % n]
    assert a != b, ('zero-length edge', i)
    if i in H: assert a[1] == b[1], ('hv edge not exactly horizontal', i)
    if i in V: assert a[0] == b[0], ('hv edge not exactly vertical', i)
    assert not (i in H and i in V)
lengths = {int(k): fr(v) for k, v in (outline.get('lengths') or {}).items()}
for i, L in lengths.items():
    a = pts[i]; b = pts[(i + 1) % n]
    d2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2
    assert d2 == L * L, ('stored length is not the exact edge length', i, str(L), str(d2))
if expect is not None:
    assert {int(k): fr(v) for k, v in expect.items()} == lengths, ('lengths differ from the expected edit', expect, outline.get('lengths'))
holes = [[[fr(c) for c in seg['start']] for seg in loop] for loop in (sk.get('holes') or [])]
assert len(holes) == 1, 'one hole'
area_outer = abs(shoelace(pts)); area_hole = abs(shoelace(holes[0]))
assert area_hole > 0 and area_outer > area_hole
h = fr(ex['height']); r = fr(fl['radius'])
assert h == 10 and r == 3, ('extrude height / fillet radius', str(h), str(r))
# V = h * (A_outer - A_hole) - h * r^2 * (1 - pi/4); pi enters only at the final float step
base = h * (area_outer - area_hole) - h * r * r
volume = float(base) + float(h * r * r) * math.pi / 4
assert abs(volume - reported) <= 1e-6, ('volume', volume, reported)
print(json.dumps({'status': 'PASS', 'outerArea': str(area_outer), 'holeArea': str(area_hole), 'height': str(h), 'radius': str(r), 'lengths': {str(k): str(v) for k, v in lengths.items()},
  'analyticVolume': volume, 'reportedVolume': reported, 'delta': abs(volume - reported), 'productImports': 0}, indent=2))
`;
assert.equal(process.env.D348_SOURCE_FROZEN, '1', 'Root must freeze all writers before D348 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
const fixtureFile = resolve(import.meta.dirname, 'fixtures/d348.bcad');
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'OUTLINE_FIELD_EDIT_KEEPS_SKETCH_IDENTITY', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One L plate with one rectangular hole and one construction line; two dimension edits (Length of edge 1 = 70, then Length of edge 2 = 25).', 'The Python oracle checks the stored outline and the analytic volume, not kernel topology.', 'Product reads (the bundled inspector) are product code, not an independent oracle.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const FILLET_EDGE = 'n1.side[e2]|n1.side[e3]';
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const EDGE='n1.side[e2]|n1.side[e3]';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){const key=view.bodies[0].key,p=part('D348 observed',doc),body=p.body(key);
  out.bodyCount=view.bodies.length;out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.massVolume=body.mass({density:1}).volume;
  out.sideFaces=body.select().faces().names().filter((n:string)=>n.indexOf('side[')>=0).sort();
  out.edgeNames=body.select().edges().names().sort();
  const filletEdge=body.select().edges().where((e:any)=>e.names.indexOf(EDGE)>=0).list();out.finalBodyHasFilletEdge=filletEdge.length>0;}
// The extrude's body before the fillet consumes the corner edge: the reference the fillet resolves.
try{const pre:any={...doc,nodes:doc.nodes.slice(0,2),outputs:{b1:{node:1,side:'solid'}}};const pv=evaluateDoc(pre,0);
  if(pv.ok){const key=pv.bodies[0].key,b=part('D348 pre-fillet',pre).body(key);const list=b.select().edges().where((e:any)=>e.names.indexOf(EDGE)>=0).list();
    out.preFillet={ok:true,edgeFound:list.length>0,edge:list.map((e:any)=>({names:e.names,a:Array.from(e.a),b:Array.from(e.b)})),sideFaces:b.select().faces().names().filter((n:string)=>n.indexOf('side[')>=0).sort(),volume:pv.bodies[0].volume};}
  else out.preFillet={ok:false,error:String((pv as any).error??'evaluation failed')};}
catch(e){out.preFillet={ok:false,error:e instanceof Error?e.message:String(e)};}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;
/** The object without the named keys (compared apart from fields an edit is expected to rewrite). */
const without = (object, ...keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
const doc = () => page.evaluate(() => window.__studioDoc);
const editor = () => page.locator('.node-editor');
const sketchPanel = () => page.getByRole('complementary', { name: 'Sketch', exact: true });
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
async function same(expected) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), expected); }
async function changed(before) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) !== x, JSON.stringify(before), { timeout: 60000 }); await ready(); }
const bodies = () => page.evaluate(() => window.__studioBodies());
const alerts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent));
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(), selection: window.__studioSelection ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent),
    editor: document.querySelector('.node-editor')?.textContent ?? null, sketchPanel: document.querySelector('.sk-panel')?.textContent ?? null }), label);
  report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2)); await writeFile(join(output, `${label}.html`), await page.content()); await page.screenshot({ path: join(output, `${label}.png`), fullPage: true }); await persist(); return state;
}
async function newPage() {
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.stack ?? String(e))); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('download', d => report.downloads.push({ phase, suggestedFilename: d.suggestedFilename() })); page.on('dialog', d => d.accept());
  await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await ready();
}
async function openFile(file) {
  await page.setInputFiles('input[aria-label="Model file"]', file);
  await page.waitForFunction(() => window.__studioDoc?.nodes?.length === 3, null, { timeout: 60000 }); await ready();
}
async function freshOpen(file, expected, label) { phase = `fresh Open ${label}`; await newPage(); await openFile(file); await same(expected); return snapshot(label); }
async function openEditor(index) { phase = `open editor ${index}`; await page.locator(`.history .hs[data-node-index="${index}"]`).click(); await editor().waitFor(); }
async function applyEditor(before, label) {
  phase = `actual editor Apply ${label}`; await editor().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(before); await editor().waitFor({ state: 'hidden' }); return snapshot(label);
}
async function editField(label, expectedBefore, value) {
  const field = editor().getByLabel(label, { exact: true }); await field.waitFor(); assert.equal(await field.inputValue(), String(expectedBefore), `${label} shows ${expectedBefore} before the edit`); await field.fill(String(value));
}
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
// Product read (bundled inspector, product code) plus the independent Python oracle on the same document and the Studio-reported volume.
async function inspect(label, expectLengths) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), studio = await bodies(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  assert.equal(studio.bodies.length, 1, 'Studio reports one body'); const volume = studio.bodies[0].volume;
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  const read = JSON.parse(run.stdout); report.reads.push({ label, studioVolume: volume, ...read }); await persist();
  const input = { doc: accepted, volume, expectLengths }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'outline-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`);
  const verified = JSON.parse(check.stdout); assert.equal(verified.status, 'PASS'); report.oracles.push({ label, verified });
  assert.equal(read.ok, true, `product evaluation ok (${read.error})`); assert.equal(read.bodyCount, 1); assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6, `product evalVolume ${read.evalVolume} vs Studio ${volume}`); assert.ok(Math.abs(read.massVolume - volume) <= 1e-6, `product massVolume ${read.massVolume} vs Studio ${volume}`);
  assert.deepEqual(await doc(), accepted); return { read, verified };
}
// Identity claims at one accepted state. Everything is recorded (snapshot, observations) before the first assertion.
function identityObservation(state, opened) {
  const nodes = state.nodes, o = opened.nodes;
  return { ids: nodes.map(n => n.id), nextId: state.nextId, sideTags: nodes[0].sideTags, openedSideTags: o[0].sideTags, construction: nodes[0].construction, openedConstruction: o[0].construction, sketchLengths: nodes[0].outline?.lengths, sketchPoints: nodes[0].outline?.points,
    filletEdges: nodes[2].edges, filletSigsBefore: o[2].sigs, filletSigsNow: nodes[2].sigs, flags: nodes.map(n => ({ id: n.id, rematched: 'rematched' in n, held: 'held' in n, suppressed: 'suppressed' in n })) };
}
async function assertEdited(label, opened, lengths, points, expectedVolume, before) {
  const state = await doc(), studio = await bodies(), toasts = await alerts();
  report.observations.push({ label, identity: identityObservation(state, opened), volume: studio.bodies.map(b => b.volume), expectedVolume, toasts }); await persist();
  assert.deepEqual(state.nodes.map(n => n.id), ['n0', 'n1', 'n2'], `${label}: node ids kept`); assert.equal(state.nextId, 3, `${label}: nextId kept`);
  assert.equal(state.nodes[0].id, 'n0'); assert.deepEqual(state.nodes[0].sideTags, opened.nodes[0].sideTags, `${label}: sketch sideTags (outer and holes) kept`);
  assert.deepEqual(state.nodes[0].construction, opened.nodes[0].construction, `${label}: sketch construction shapes kept`);
  const sketchRest = without(state.nodes[0], 'outline', 'segments'), openedRest = without(opened.nodes[0], 'outline', 'segments'); assert.deepEqual(sketchRest, openedRest, `${label}: other sketch node fields kept (holes, profile, ...)`);
  assert.deepEqual(state.nodes[0].outline.lengths, lengths, `${label}: outline lengths`); assert.deepEqual(state.nodes[0].outline.points, points, `${label}: outline points`);
  assert.deepEqual(state.nodes[1], { ...opened.nodes[1] }, `${label}: extrude node unchanged`);
  assert.deepEqual(state.nodes[2].edges, [FILLET_EDGE], `${label}: fillet still names its corner edge`);
  const filletRest = without(state.nodes[2], 'sigs'), openedFillet = without(opened.nodes[2], 'sigs'); assert.deepEqual(filletRest, openedFillet, `${label}: fillet node unchanged apart from sigs`);
  for (const n of state.nodes) { assert.ok(!('rematched' in n), `${label}: ${n.id} rematched`); assert.ok(!('held' in n), `${label}: ${n.id} held`); assert.ok(!('suppressed' in n), `${label}: ${n.id} suppressed`); }
  assert.deepEqual(state.outputs, opened.outputs, `${label}: outputs unchanged`); assert.deepEqual(toasts, [], `${label}: no toast`);
  assert.equal(studio.bodies.length, 1, `${label}: one body`); assert.ok(Math.abs(studio.bodies[0].volume - expectedVolume) <= 1e-6, `${label}: volume ${studio.bodies[0].volume} vs ${expectedVolume}`);
  if (before) assert.notDeepEqual(state, before);
}
// Reopen the sketch in the sketcher from the extrude's editor, read the Sketch panel, and leave through Escape without changing the document.
async function reopenSketch(label, expectedLengths, expectDoc) {
  phase = `reopen sketch ${label}`; await openEditor(1); await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('svg [class*="construction"]').length > 0, null, { timeout: 15000 }).catch(() => {});
  const read = await page.evaluate(() => ({ lengths: [...document.querySelectorAll('.sk-panel input[aria-label$=" length"]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value, locked: i.classList.contains('locked') })),
    constructionShapes: document.querySelectorAll('svg [class*="construction"]').length, status: document.querySelector('.sk-panel .sk-status')?.textContent ?? null, title: document.querySelector('.sk-panel .card-title')?.textContent ?? null }));
  report.observations.push({ label, sketchPanelRead: read, source: 'Sketch panel "Edge N length" inputs (value, .locked) and svg elements whose class contains "construction"' }); await persist();
  const state = await snapshot(label);
  for (const [i, v] of Object.entries(expectedLengths)) { const row = read.lengths.find(x => x.label === `Edge ${Number(i) + 1} length`); assert.ok(row, `${label}: Sketch panel lists Edge ${Number(i) + 1} length`); assert.equal(Number(row.value), v, `${label}: Edge ${Number(i) + 1} length shows ${v}`); assert.ok(row.locked, `${label}: Edge ${Number(i) + 1} length is a locked (driving) constraint`); }
  assert.ok(read.constructionShapes >= 1, `${label}: the construction line is present in the sketcher`);
  assert.deepEqual(state.doc, expectDoc, `${label}: opening the sketcher changed nothing`);
  phase = `leave sketch ${label}`; await page.evaluate(() => document.activeElement?.blur());
  for (let attempt = 0; attempt < 3 && await sketchPanel().count(); attempt++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  assert.equal(await sketchPanel().count(), 0, `${label}: Escape leaves the sketcher`); await same(expectDoc);
  const after = await doc(); assert.deepEqual(after.nodes.map(n => n.id), ['n0', 'n1', 'n2']); assert.deepEqual(after.nodes[0].sideTags, expectDoc.nodes[0].sideTags); assert.deepEqual(after.nodes[0].construction, expectDoc.nodes[0].construction);
  await snapshot(`${label}-left`);
}
const initialFiles = ['apps/cad-studio/test/outline-field-identity-browser.mjs', 'apps/cad-studio/test/fixtures/d348.bcad', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad-model/src/sketch/outlineFields.ts', 'packages/barocss-cad-model/src/sketch/rules.ts', 'packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/loops.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
const L = (a, b) => ({ 0: a, 1: b });
const ptsFor = (a, b) => [[0, 0], [a, 0], [a, b], [20, b], [20, 40], [0, 40]];
const volumeFor = (a, b) => 10 * (a * b + 20 * (40 - b)) - 500 - (90 - 22.5 * Math.PI);
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'outline-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  report.fixture = { file: fixtureFile, hash: hash(await readFile(fixtureFile)) }; const fixtureDoc = JSON.parse(await readFile(fixtureFile, 'utf8'));
  const buildInputs = [], sourcefile = 'd348-inspector.ts', virtual = resolve(app, sourcefile);
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

  // Context 1: Open the fixture, edit Length of edge 1, refuse, undo/redo, reopen the sketch, save.
  phase = 'Open fixture'; await newPage(); await openFile(fixtureFile);
  const opened = await doc(); report.openedEqualsFixtureBytes = JSON.stringify(opened) === JSON.stringify(fixtureDoc); report.openedEqualsFixtureSemantically = (() => { try { assert.deepEqual(opened, fixtureDoc); return true; } catch { return false; } })(); await persist();
  assert.deepEqual(opened.nodes.map(n => n.id), ['n0', 'n1', 'n2']); assert.equal(opened.nextId, 3); assert.equal((await bodies()).bodies.length, 1);
  await snapshot('01-opened'); await inspect('01-native', L(60, 20));
  report.observations.push({ label: '01-opened', filletSigs: opened.nodes[2].sigs, volume: (await bodies()).bodies.map(b => b.volume) });

  phase = 'actual editor edit Length of edge 1'; await openEditor(1); await editField('Length of edge 1', 60, 70); const beforeEdit = await doc(); const edited1 = await applyEditor(beforeEdit, '02-edited'); const edited = edited1.doc;
  await assertEdited('02-edited', opened, L(70, 20), ptsFor(70, 20), volumeFor(70, 20), beforeEdit); await inspect('02-native', L(70, 20));
  const product1 = report.reads.find(r => r.label === '02-native');
  if (product1.preFillet.ok) { assert.ok(product1.preFillet.edgeFound, '02-native: the fillet corner edge exists on the extrude body'); const e = product1.preFillet.edge[0], ends = [e.a, e.b].map(p => p.map(Number)).sort((x, y) => x[2] - y[2]); assert.deepEqual(ends, [[70, 20, 0], [70, 20, 10]], '02-native: the corner edge sits at the moved corner'); }

  phase = 'refusal Length of edge 1 = 0'; await openEditor(1); await editField('Length of edge 1', 70, 0);
  await page.waitForTimeout(800);
  const apply = editor().getByRole('button', { name: 'Apply', exact: true });
  const refusal = { applyCount: await apply.count(), applyDisabled: await apply.count() ? await apply.isDisabled() : null, inputValue: await editor().getByLabel('Length of edge 1', { exact: true }).inputValue(), toasts: await alerts() };
  report.observations.push({ label: '03-refused', refusal, note: 'A refused value leaves the editor draft unchanged (Apply stays disabled); no message is shown unless toasts lists one.' }); await persist(); await snapshot('03-refused');
  assert.deepEqual(await doc(), edited, 'a refused value leaves the document equal to the edited document');
  await editor().getByRole('button', { name: 'Close editor', exact: true }).click();
  await editor().waitFor({ state: 'hidden' }); await same(edited);

  phase = 'Undo/Redo edit'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await same(opened); await page.keyboard.press('Meta+Shift+z'); await same(edited);

  await reopenSketch('04-sketch-reopened', L(70, 20), edited);
  const edited1Saved = await save('edited'); assert.deepEqual(edited1Saved.doc, edited);

  // Context 2: fresh Open of edited.bcad, then Length of edge 2.
  const fresh = await freshOpen(edited1Saved.file, edited1Saved.doc, '05-fresh-open'); await inspect('05-fresh-native', L(70, 20)); assert.deepEqual(fresh.doc.nodes.map(n => n.id), ['n0', 'n1', 'n2']);
  phase = 'actual editor edit Length of edge 2'; await openEditor(1); await editField('Length of edge 2', 20, 25); const before2 = await doc(); const edited2State = await applyEditor(before2, '06-edited-again'); const edited2 = edited2State.doc;
  await assertEdited('06-edited-again', opened, L(70, 25), ptsFor(70, 25), volumeFor(70, 25), before2); await inspect('06-native', L(70, 25));
  const product2 = report.reads.find(r => r.label === '06-native'); if (product2.preFillet.ok) { assert.ok(product2.preFillet.edgeFound, '06-native: the fillet corner edge exists on the extrude body'); const e = product2.preFillet.edge[0], ends = [e.a, e.b].map(p => p.map(Number)).sort((x, y) => x[2] - y[2]); assert.deepEqual(ends, [[70, 25, 0], [70, 25, 10]], '06-native: the corner edge sits at the moved corner'); }
  phase = 'Undo/Redo second edit'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await same(edited1Saved.doc); await page.keyboard.press('Meta+Shift+z'); await same(edited2);
  const twiceSaved = await save('twice'); assert.deepEqual(twiceSaved.doc, edited2);

  // Context 3: fresh Open of twice.bcad.
  await freshOpen(twiceSaved.file, twiceSaved.doc, '07-final'); await inspect('07-final-native', L(70, 25));
  await reopenSketch('07b-final-sketch', L(70, 25), twiceSaved.doc);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
