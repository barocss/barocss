// D356 qualification: a sketch whose rectangle Width is bound to a document parameter (`max: [{parameter:'W'}, 40]`, as the Extrude editor's ƒ binding writes it) can be reopened
// (the Sketch panel shows finite values, not NaN) and finished: an unchanged Finish keeps the W binding; changing the height keeps it; changing the parameter W still drives the width afterwards.
// Root must freeze all sources first. Run from apps/cad-studio:
// D356_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/sketch-reopen-parameters-browser.mjs /absolute/artifacts
// Actual Studio UI (Open, history, feature editor Edit sketch, Sketch panel, Finish, Parameters panel, Undo/Redo, Save) mutates. Readonly hooks observe only.
// One Chrome WebGPU process, two sequential fresh contexts. Independent Python oracle (no product imports) resolves the stored Dims with the document parameters and checks area x height and the binding positions.
// Expected at a base without the D356 fix: the driver FAILS at the first claim, 02 reopen (the panel shows an empty/NaN value, Finish would store null coordinates); the failure state is snapshotted before asserting.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent exact check of an extruded axis-aligned rectangle whose Width may be bound to a document parameter. Product imports: zero."""
import json, math, sys
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    assert isinstance(x, (int, float)), ('not a plain number', x)
    return F(x)

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; exp = data['expect']
params = doc['parameters']
assert params == {'W': exp['W']}, ('parameters', params)
W = fr(params['W'])
def resolve(x):
    """A stored coordinate: a plain finite number, or {'parameter': name} resolved through the document parameters."""
    if isinstance(x, dict):
        assert list(x.keys()) == ['parameter'], ('binding shape', x)
        return fr(params[x['parameter']])
    return fr(x)
def bound(x):
    return isinstance(x, dict) and x == {'parameter': 'W'}
nodes = doc['nodes']
sk, ex = nodes[0], nodes[1]
assert [n['kind'] for n in nodes] == ['sketch', 'extrude'] and [n['id'] for n in nodes] == ['n0', 'n1'] and doc['nextId'] == 2, 'nodes: sketch, extrude'
assert ex['sketch'] == 0 and fr(ex['height']) == 10 and doc['outputs'] == {'b1': {'node': 1, 'side': 'solid'}}, ('extrude', ex, doc['outputs'])
assert not sk.get('holes') and not sk.get('regions'), 'no holes, no regions'
if sk['profile'] == 'rectangle':
    raw = [[sk['min'][0], sk['min'][1]], [sk['max'][0], sk['max'][1]]]
    corners = [raw[0], raw[1]]
else:
    assert sk['profile'] in ('polygon', 'loop'), ('profile', sk['profile'])
    pts = sk['outline']['points'] if sk.get('outline') else (sk['points'] if sk['profile'] == 'polygon' else [s['start'] for s in sk['segments']])
    assert len(pts) == 4, 'a rectangle outline has four points'
    corners = pts
res = [[resolve(c) for c in p] for p in corners]
xs = sorted({p[0] for p in res}); ys = sorted({p[1] for p in res})
assert len(xs) == 2 and len(ys) == 2, ('axis-aligned', [[str(c) for c in p] for p in res])
lo = [xs[0], ys[0]]; hi = [xs[1], ys[1]]
w = hi[0] - lo[0]; d = hi[1] - lo[1]; h = fr(ex['height'])
assert lo == [0, 0], ('the rectangle starts at the origin', [str(c) for c in lo])
assert w == fr(exp['w']) and d == fr(exp['d']) and h == fr(exp['h']), ('dims', str(w), str(d), str(h), exp)
# Binding positions: every stored x on the far side is {parameter:'W'} (and equals W), every x on the near side and every y is a plain finite number.
for raw_point, point in zip(corners, res):
    x, y = raw_point
    assert isinstance(y, (int, float)) and not isinstance(y, bool) and math.isfinite(float(y)), ('y is a plain number', raw_point)
    if point[0] == hi[0]:
        assert bound(x) and point[0] == W, ('far x keeps the W binding', raw_point, str(W))
    else:
        assert isinstance(x, (int, float)) and not isinstance(x, bool) and point[0] == 0, ('near x is a plain 0', raw_point)
assert sum(1 for p in corners for c in p if bound(c)) >= 1 and w == W, ('width equals the parameter', str(w), str(W))
volume = float(w * d * h)
assert abs(volume - reported) <= 1e-6, ('volume', volume, reported)
print(json.dumps({'status': 'PASS', 'parameter': str(W), 'width': str(w), 'depth': str(d), 'height': str(h), 'boundCoordinates': sum(1 for p in corners for c in p if bound(c)), 'analyticVolume': volume, 'reportedVolume': reported,
  'delta': abs(volume - reported), 'productImports': 0}, indent=2))
`;
assert.equal(process.env.D356_SOURCE_FROZEN, '1', 'Root must freeze all writers before D356 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
const fixtureFile = resolve(import.meta.dirname, 'fixtures/d356.bcad');
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'SKETCH_REOPEN_KEEPS_PARAMETER_BINDING', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One rectangle sketch with Width bound to parameter W, one Extrude 10; edits: height (Edge 2 length 40 to 30 in the Sketch panel) and the parameter W (Parameters panel value field, Enter).', 'The Python oracle resolves the stored Dims with the document parameters and checks area x height and the binding positions, not kernel topology.',
    'Product reads (the bundled inspector, evaluateDoc and the facade mass) are product code, not an independent oracle.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const VOLUME = (w, d) => w * d * 10;
const BOUND = { parameter: 'W' };
// Reads (readonly): the evaluated body and its mass, and the sketch node's stored Dims with the parameters.
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error?.detail??(view as any).error?.title??(view as any).error??'evaluation failed')};
if(view.ok){const key=view.bodies[0].key,body=part('D356 observed',doc).body(key);out.bodyCount=view.bodies.length;out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.massVolume=body.mass({density:1}).volume;}
out.sketch=doc.nodes[0]??null;out.extrude=doc.nodes[1]??null;out.parameters=doc.parameters??null;out.hasNull=JSON.stringify(doc.nodes[0]??null).includes('null');
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;
// (JSON form: a key holding undefined, e.g. configurations after a parameter edit, is absent from a saved file.)
const doc = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__studioDoc)));
const editor = () => page.locator('.node-editor');
const sketchPanel = () => page.getByRole('complementary', { name: 'Sketch', exact: true });
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
async function same(expected) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), JSON.parse(JSON.stringify(expected))); }
const bodies = () => page.evaluate(() => window.__studioBodies());
const alerts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent));
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: JSON.parse(JSON.stringify(window.__studioDoc)), bodies: window.__studioBodies?.(), selection: window.__studioSelection ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent),
    editor: document.querySelector('.node-editor')?.textContent ?? null, sketchPanel: document.querySelector('.sk-panel')?.textContent ?? null, parametersPanel: document.querySelector('aside[aria-label="Parameters panel"]')?.textContent ?? null, hud: document.querySelector('.hud')?.textContent ?? null }), label);
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
const panelFields = () => page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Point "], .sk-panel input[aria-label^="Edge "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
async function reopenSketch(label) {
  phase = `reopen sketch ${label}`; const state = await doc(), consumer = state.nodes.findIndex(n => n.kind === 'extrude' && n.sketch === 0); assert.equal(consumer, 1, 'Sketch 0 is consumed by Extrude node 1');
  await page.locator(`.history .hs[data-node-index="${consumer}"]`).click(); await editor().waitFor(); await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor();
  return panelFields();
}
// Every Point/Edge input of the reopened panel shows a finite number (an empty value is what a number input shows for NaN).
const finiteFields = fields => fields.length > 0 && fields.every(f => f.value !== '' && !/nan|infinity/i.test(f.value) && Number.isFinite(Number(f.value)));
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
// The Parameters panel (App.tsx top bar button [aria-label="Parameters"], ParametersPanel.tsx value field `Value of W`; Enter blurs and submits, App.tsx onChange accepts the candidate). It is hidden while a feature editor or sketch is active, so the editor is closed first.
async function setParameter(name, value, label) {
  phase = `set parameter ${name} ${label}`; await ready();
  if (await editor().isVisible()) { await editor().getByRole('button', { name: 'Close editor', exact: true }).click(); await editor().waitFor({ state: 'hidden' }); }
  const before = await doc(); await page.click('[aria-label="Parameters"]'); const panel = page.locator('aside[aria-label="Parameters panel"]'); await panel.waitFor();
  const field = panel.getByLabel(`Value of ${name}`, { exact: true }); await field.waitFor(); assert.equal(Number(await field.inputValue()), before.parameters[name], `${label}: the panel shows the current ${name}`);
  report.observations.push({ label: `${label}-parameters-panel`, text: await panel.innerText() }); await persist();
  await field.fill(String(value)); await field.press('Enter');
  await page.waitForFunction(([n, v]) => window.__studioDoc?.parameters?.[n] === v, [name, value], { timeout: 60000 }); await ready();
  await page.click('[aria-label="Close parameters"]'); await panel.waitFor({ state: 'hidden' });
  return snapshot(label);
}
// Product read (bundled inspector, product code) plus the independent Python oracle on the same document and the Studio-reported volume. Everything is written before the first assertion.
async function inspect(label, expect) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), studio = await bodies(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const volume = studio.bodies[0]?.volume; const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? '');
  const read = run.status === 0 ? JSON.parse(run.stdout) : null; report.reads.push({ label, studioVolume: volume, ...read });
  const input = { doc: accepted, volume, expect }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'sketch-reopen-parameters-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stderr: check.stderr, verified: check.stdout ? JSON.parse(check.stdout) : null }); await persist();
  assert.equal(run.status, 0, run.stderr); assert.equal(studio.bodies.length, 1, `${label}: one body`); assert.equal(read.ok, true, `${label}: product evaluation ok (${read.error})`); assert.equal(read.bodyCount, 1); assert.equal(read.hasNull, false, `${label}: no null coordinate stored`);
  assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6 && Math.abs(read.massVolume - volume) <= 1e-6, `${label}: product volumes ${read.evalVolume}/${read.massVolume} vs Studio ${volume}`);
  assert.ok(Math.abs(volume - VOLUME(expect.w, expect.d)) <= 1e-6, `${label}: Studio volume ${volume} vs ${VOLUME(expect.w, expect.d)}`);
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); assert.equal(JSON.parse(check.stdout).status, 'PASS'); assert.deepEqual(await doc(), accepted); return { read, verified: JSON.parse(check.stdout) };
}
const boundCount = node => (JSON.stringify(node).match(/\{"parameter":"W"\}/g) ?? []).length;
const initialFiles = ['apps/cad-studio/test/sketch-reopen-parameters-browser.mjs', 'apps/cad-studio/test/fixtures/d356.bcad', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/ui/ParametersPanel.tsx',
  'apps/cad-studio/src/ui/FeatureHistoryBar.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/app/sketchControls.ts', 'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/select.ts', 'packages/barocss-cad-model/src/engine/parameters.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'sketch-reopen-parameters-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  report.fixture = { file: fixtureFile, hash: hash(await readFile(fixtureFile)) }; const fixtureDoc = JSON.parse(await readFile(fixtureFile, 'utf8'));
  const buildInputs = [], sourcefile = 'd356-inspector.ts', virtual = resolve(app, sourcefile);
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

  // Context 1: Open, reopen + Finish unchanged, change W, reopen + change the height + Finish, Undo/Redo, Save.
  phase = 'Open fixture'; await newPage(); await openFile(fixtureFile, 2);
  const opened = await doc(); report.openedEqualsFixtureBytes = JSON.stringify(opened) === JSON.stringify(fixtureDoc); report.openedEqualsFixtureSemantically = (() => { try { assert.deepEqual(opened, fixtureDoc); return true; } catch { return false; } })(); await persist();
  assert.deepEqual(opened.nodes.map(n => n.id), ['n0', 'n1']); assert.equal(opened.nextId, 2); assert.deepEqual(opened.parameters, { W: 60 }); assert.deepEqual(opened.nodes[0].max, [BOUND, 40], 'the fixture binds the rectangle Width to W');
  assert.equal((await bodies()).bodies.length, 1); await snapshot('01-opened'); await inspect('01-native', { W: 60, w: 60, d: 40, h: 10 }); assert.ok(Math.abs((await bodies()).bodies[0].volume - 24000) <= 1e-6, 'opened volume 24000');

  // 1. Reopen: every panel value is finite (the width shows 60), then Finish without a change.
  const fields1 = await reopenSketch('02-reopened'); report.observations.push({ label: '02-reopened', fields: fields1 }); await persist(); await snapshot('02-reopened');
  const edge1Shown = await sketchPanel().getByLabel('Edge 1 length', { exact: true }).inputValue().catch(() => null), edge2Shown = await sketchPanel().getByLabel('Edge 2 length', { exact: true }).inputValue().catch(() => null);
  report.observations.push({ label: '02-reopened-edges', edge1Shown, edge2Shown }); await persist();
  assert.ok(finiteFields(fields1), `02: every Point/Edge value is finite: ${JSON.stringify(fields1)}`); assert.equal(Number(edge1Shown), 60, `02: Edge 1 length (the width) shows 60, not ${edge1Shown}`); assert.equal(Number(edge2Shown), 40, `02: Edge 2 length shows 40, not ${edge2Shown}`);
  const finished1 = await finishSketch('03-finish-unchanged'), toasts1 = await alerts(), after1 = finished1.doc;
  report.observations.push({ label: '03-finish-unchanged', node0Before: opened.nodes[0], node0After: after1.nodes[0], docEqual: JSON.stringify(after1) === JSON.stringify(opened), node0Equal: JSON.stringify(after1.nodes[0]) === JSON.stringify(opened.nodes[0]), toasts: toasts1, volume: finished1.bodies.bodies.map(b => b.volume) }); await persist();
  await inspect('03-native', { W: 60, w: 60, d: 40, h: 10 });
  assert.ok(boundCount(after1.nodes[0]) >= 1, `03: Finish without a change keeps the W binding (THE claim): ${JSON.stringify(after1.nodes[0])}`); assert.ok(!JSON.stringify(after1.nodes[0]).includes('null'), '03: no null coordinate');
  assert.deepEqual(toasts1, [], '03: no toast'); assert.deepEqual(after1.nodes.map(n => n.id), ['n0', 'n1']); assert.equal(after1.nextId, 2); assert.deepEqual(after1.nodes[1], opened.nodes[1], '03: extrude unchanged'); assert.deepEqual(after1.outputs, opened.outputs); assert.deepEqual(after1.parameters, { W: 60 });
  assert.equal(finished1.bodies.bodies.length, 1); assert.ok(Math.abs(finished1.bodies.bodies[0].volume - 24000) <= 1e-6, '03: volume unchanged 24000');

  // 2. Change the parameter W to 70: the binding drives the sketch.
  const param70 = await setParameter('W', 70, '04-param-70'), doc70 = param70.doc, toasts70 = await alerts();
  report.observations.push({ label: '04-param-70', node0: doc70.nodes[0], toasts: toasts70, volume: param70.bodies.bodies.map(b => b.volume) }); await persist();
  await inspect('04-native', { W: 70, w: 70, d: 40, h: 10 });
  assert.deepEqual(doc70.parameters, { W: 70 }, '04: W is 70'); assert.deepEqual(doc70.nodes, after1.nodes, '04: only the parameter changed'); assert.deepEqual(toasts70, [], '04: no toast');
  assert.equal(param70.bodies.bodies.length, 1); assert.ok(Math.abs(param70.bodies.bodies[0].volume - 28000) <= 1e-6, `04: volume ${param70.bodies.bodies[0].volume} vs 28000 (the binding drives the width)`);

  // 3. Reopen, change the height (Edge 2 length 40 to 30, Enter locks it: SketchPanel.tsx Edge ${i + 1} length input), Finish.
  const fields2 = await reopenSketch('05-reopened'); report.observations.push({ label: '05-reopened', fields: fields2 }); await persist();
  const edge1b = sketchPanel().getByLabel('Edge 1 length', { exact: true }), edge2b = sketchPanel().getByLabel('Edge 2 length', { exact: true }); await edge1b.waitFor(); await edge2b.waitFor();
  const shown1 = await edge1b.inputValue(), shown2 = await edge2b.inputValue(); report.observations.push({ label: '05-reopened-edges', shown1, shown2 }); await persist();
  assert.ok(finiteFields(fields2), `05: every Point/Edge value is finite: ${JSON.stringify(fields2)}`); assert.equal(Number(shown1), 70, `05: Edge 1 length shows the current W 70, not ${shown1}`); assert.equal(Number(shown2), 40, `05: Edge 2 length shows 40, not ${shown2}`);
  await edge2b.fill('30'); await edge2b.press('Enter'); await page.waitForTimeout(500); const fieldsEdited = await panelFields(); report.observations.push({ label: '05-edge-edit', fieldsBefore: fields2, fieldsAfter: fieldsEdited }); await persist();
  const edited = await finishSketch('05-height-30'), doc30 = edited.doc, toasts30 = await alerts();
  report.observations.push({ label: '05-height-30', node0: doc30.nodes[0], toasts: toasts30, volume: edited.bodies.bodies.map(b => b.volume) }); await persist();
  await inspect('05-native', { W: 70, w: 70, d: 30, h: 10 });
  assert.notDeepEqual(doc30, doc70, '05: the edit changed the document'); assert.ok(boundCount(doc30.nodes[0]) >= 1, `05: the W binding is still stored: ${JSON.stringify(doc30.nodes[0])}`); assert.ok(!JSON.stringify(doc30.nodes[0]).includes('null'), '05: no null coordinate');
  assert.deepEqual(doc30.parameters, { W: 70 }); assert.deepEqual(toasts30, [], '05: no toast'); assert.deepEqual(doc30.nodes.map(n => n.id), ['n0', 'n1']); assert.equal(doc30.nextId, 2); assert.deepEqual(doc30.nodes[1], opened.nodes[1], '05: extrude unchanged'); assert.deepEqual(doc30.outputs, opened.outputs);
  assert.equal(edited.bodies.bodies.length, 1); assert.ok(Math.abs(edited.bodies.bodies[0].volume - 21000) <= 1e-6, `05: volume ${edited.bodies.bodies[0].volume} vs 21000`);

  // 4. Undo returns the 04 document, Redo the 05 document; Save.
  phase = 'Undo/Redo edit'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await same(doc70); await page.keyboard.press('Meta+Shift+z'); await same(doc30);
  const saved = await save('edited'); assert.deepEqual(saved.doc, doc30);

  // Context 2: fresh Open of edited.bcad, then change W to 50.
  const fresh = await freshOpen(saved.file, saved.doc, '06-fresh-open'); await inspect('06-native', { W: 70, w: 70, d: 30, h: 10 });
  assert.equal(fresh.bodies.bodies.length, 1); assert.ok(Math.abs(fresh.bodies.bodies[0].volume - 21000) <= 1e-6, `06: volume ${fresh.bodies.bodies[0].volume} vs 21000`);
  const param50 = await setParameter('W', 50, '07-param-50'), doc50 = param50.doc, toasts50 = await alerts();
  report.observations.push({ label: '07-param-50', node0: doc50.nodes[0], toasts: toasts50, volume: param50.bodies.bodies.map(b => b.volume) }); await persist();
  await inspect('07-native', { W: 50, w: 50, d: 30, h: 10 });
  assert.deepEqual(doc50.parameters, { W: 50 }, '07: W is 50'); assert.deepEqual(doc50.nodes, doc30.nodes, '07: only the parameter changed'); assert.deepEqual(toasts50, [], '07: no toast');
  assert.equal(param50.bodies.bodies.length, 1); assert.ok(Math.abs(param50.bodies.bodies[0].volume - 15000) <= 1e-6, `07: volume ${param50.bodies.bodies[0].volume} vs 15000`);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
