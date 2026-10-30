// D358 qualification: a sketch whose main profile is a circle with a rectangle region beside it keeps its main profile when reopened and finished unchanged.
// Before the fix the unchanged Finish stored profile 'polygon' (the rectangle) as the main and the circle as a one-arc region: the Extrude editor lost the circle's Diameter/Centre fields and the radius binding {parameter:'R'} was dropped with a "Bindings became numbers" toast.
// Root must freeze all sources first. Run from apps/cad-studio:
// D358_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/sketch-reopen-main-role-browser.mjs /absolute/artifacts
// Actual Studio UI (Open, history entry, feature editor Edit sketch, Finish, Parameters panel, Undo/Redo, Save) mutates. Readonly hooks observe only.
// One Chrome WebGPU process, two sequential fresh contexts. Independent Python oracle (no product imports): null/NaN scan, exact rectangle area, binding resolution, sideTags shape and volume = height x (pi R^2 + 200).
// Expected at a base without the D358 fix: the driver FAILS at the first claim, 03 finish unchanged (n0.profile becomes 'polygon', the radius binding is lost, a toast shows); the failure state is snapshotted before asserting.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent check of an extruded circle (radius may be bound to parameter R) with one rectangle region beside it. Product imports: zero."""
import json, math, sys
from fractions import Fraction as F

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; exp = data['expect']
bad = []
def scan(v, path):
    if v is None or (isinstance(v, float) and not math.isfinite(v)):
        bad.append(path)
    elif isinstance(v, list):
        for i, x in enumerate(v): scan(x, path + '[' + str(i) + ']')
    elif isinstance(v, dict):
        for k, x in v.items(): scan(x, path + '.' + k)
scan(doc, 'doc')
assert bad == [], ('null or non-finite values in the document', bad)
params = doc['parameters']
assert params == {'R': exp['R']}, ('parameters', params)
def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    assert isinstance(x, (int, float)), ('not a plain number', x)
    return F(x)
def resolve(x):
    if isinstance(x, dict):
        assert x == {'parameter': 'R'}, ('binding shape', x)
        return fr(params['R'])
    return fr(x)
nodes = doc['nodes']
sk, ex = nodes[0], nodes[1]
assert [n['kind'] for n in nodes] == ['sketch', 'extrude'] and [n['id'] for n in nodes] == ['n0', 'n1'] and doc['nextId'] == 2, 'nodes: sketch, extrude'
assert ex['sketch'] == 0 and fr(ex['height']) == 10 and doc['outputs'] == {'b1': {'node': 1, 'side': 'solid'}}, ('extrude', ex, doc['outputs'])
assert sk['profile'] == 'circle', ('the main profile stays the circle', sk['profile'])
assert sk['radius'] == {'parameter': 'R'}, ('the radius keeps its R binding', sk['radius'])
assert [resolve(c) for c in sk['center']] == [0, 0], ('centre', sk['center'])
R = resolve(sk['radius']); assert R == fr(exp['R']) and R > 0
assert not sk.get('holes'), 'no holes'
regions = sk.get('regions'); assert regions is not None and len(regions) == 1, ('one region', regions)
loop = regions[0]; nseg = exp.get('segments', 4)
assert len(loop) == nseg and all(s['kind'] == 'line' for s in loop), ('rectangle loop of straight lines', nseg, loop)
pts = [[resolve(c) for c in s['start']] for s in loop]
area = F(0)
for i in range(nseg):
    a, b = pts[i], pts[(i + 1) % nseg]; area += a[0] * b[1] - b[0] * a[1]
area = abs(area) / 2
assert area == 200, ('rectangle area exact', str(area))
xs = sorted({p[0] for p in pts}); ys = sorted({p[1] for p in pts})
assert xs[0] == 20 and xs[-1] == 40 and ys == [-5, 5], ('rectangle extent', [str(x) for x in xs], [str(y) for y in ys])
inner = [p for p in pts if p[0] not in (20, 40)]
assert len(inner) == (1 if nseg == 5 else 0), ('one split point only when split', [[str(c) for c in p] for p in inner])
if nseg == 5: assert inner[0][1] == -5 and abs(inner[0][0] - 30) < 1, ('the bottom edge is split near its middle (a screen click: not exactly 30)', [str(c) for c in inner[0]])
assert R < 20, 'circle and rectangle do not overlap'
tags = sk['sideTags']
assert len(tags['outer']) == 1 and len(tags['regions']) == 1 and len(tags['regions'][0]) == nseg, ('sideTags shape', tags)
ids = tags['outer'] + tags['regions'][0]; assert len(set(ids)) == 1 + nseg, ('distinct side ids', ids)
volume = 10 * (math.pi * float(R) ** 2 + float(area))
assert abs(volume - reported) <= 1e-6 * volume, ('volume', volume, reported)
assert abs(volume - exp['volume']) <= 1e-9 * volume, ('expected volume', volume, exp['volume'])
print(json.dumps({'status': 'PASS', 'R': str(R), 'rectangleArea': str(area), 'analyticVolume': volume, 'reportedVolume': reported, 'delta': abs(volume - reported), 'productImports': 0}, indent=2))
`;
assert.equal(process.env.D358_SOURCE_FROZEN, '1', 'Root must freeze all writers before D358 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
const fixtureFile = resolve(import.meta.dirname, 'fixtures/d358.bcad');
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'SKETCH_REOPEN_KEEPS_MAIN_PROFILE_ROLE', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One circle sketch (radius bound to parameter R) with one rectangle region (x 20..40, y -5..5), one Extrude 10; edits: an unchanged reopen + Finish, and the parameter R (Parameters panel value field, Enter).', 'The Python oracle checks the stored shape, the exact rectangle area, pi R^2 and the volume, not kernel topology.',
    'Product reads (the bundled inspector, evaluateDoc and the facade mass) are product code, not an independent oracle.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const VOLUME = r => 10 * (Math.PI * r * r + 200);
const BOUND = { parameter: 'R' };
// Reads (readonly): the evaluated body and its mass, and the sketch node's stored shape with the parameters.
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error?.detail??(view as any).error?.title??(view as any).error??'evaluation failed')};
if(view.ok){const key=view.bodies[0].key,body=part('D358 observed',doc).body(key);out.bodyCount=view.bodies.length;out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.massVolume=body.mass({density:1}).volume;}
out.sketch=doc.nodes[0]??null;out.extrude=doc.nodes[1]??null;out.parameters=doc.parameters??null;out.hasNull=JSON.stringify(doc).includes('null');
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
// The Extrude's feature editor (history entry of node 1) lists the consumed sketch's outline fields: the circle's Diameter and Centre X/Y (editFields.ts) exist only while the sketch's main profile is the circle.
// Its Edit sketch button reopens the sketch (NodeEditor.tsx onEditSketch; useSketchActions.ts editSketch).
async function openExtrudeEditor() {
  const state = await doc(), consumer = state.nodes.findIndex(n => n.kind === 'extrude' && n.sketch === 0); assert.equal(consumer, 1, 'Sketch 0 is consumed by Extrude node 1');
  await page.locator(`.history .hs[data-node-index="${consumer}"]`).click(); await editor().waitFor();
}
async function editorLabels() {
  return page.evaluate(() => { const root = document.querySelector('.node-editor'); return { text: root?.textContent ?? '', labels: [...(root?.querySelectorAll('input, select, button') ?? [])].map(e => e.getAttribute('aria-label') ?? e.closest('label')?.textContent ?? '').filter(Boolean) }; });
}
const hasCircleFields = e => /Diameter/.test(e.text) && /Centre X/.test(e.text) && /Centre Y/.test(e.text);
async function closeEditor() { if (await editor().isVisible()) { await editor().getByRole('button', { name: 'Close editor', exact: true }).click(); await editor().waitFor({ state: 'hidden' }); } }
async function inspectEditor(label) {
  phase = `Extrude editor ${label}`; await ready(); await openExtrudeEditor(); const found = await editorLabels(); report.observations.push({ label, editorLabels: found.labels, circleFields: hasCircleFields(found) }); await snapshot(label); await closeEditor(); return found;
}
const screenOf = point => page.evaluate(point => window.__studioScreenOf?.(point), [...point, 0]);
async function worldClick(point) { const pixel = await screenOf(point); assert.ok(pixel?.length === 2, 'screen position of the point'); await page.mouse.click(pixel[0], pixel[1]); await page.waitForTimeout(150); return pixel; }
// The reopened sketch is framed by editSketch; scroll out until every wanted model point is on the canvas (as the side-ids driver does).
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
// A sketch tool by its toolbar button (sketchControls.ts: Split, key K), else its key.
async function tool(name, key) {
  const b = page.getByRole('button', { name, exact: true }); const count = await b.count(); report.observations.push({ label: `tool-${name}`, buttons: count });
  if (count === 1) await b.click(); else { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press(key); }
  await page.waitForTimeout(100);
}
const panelText = () => page.evaluate(() => document.querySelector('.sk-panel')?.textContent ?? '');
async function reopenSketch(label) {
  phase = `reopen sketch ${label}`; await ready(); await openExtrudeEditor(); await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor();
  return page.evaluate(() => [...document.querySelectorAll('.sk-panel input')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
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
// The Parameters panel (App.tsx top bar button [aria-label="Parameters"], ParametersPanel.tsx value field `Value of R`; Enter blurs and submits). It is hidden while a feature editor or sketch is active, so the editor is closed first.
async function setParameter(name, value, label) {
  phase = `set parameter ${name} ${label}`; await ready(); await closeEditor();
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
  const input = { doc: accepted, volume, expect: { ...expect, volume: VOLUME(expect.R) } }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'sketch-reopen-main-role-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stderr: check.stderr, verified: check.stdout ? JSON.parse(check.stdout) : null }); await persist();
  assert.equal(run.status, 0, run.stderr); assert.equal(studio.bodies.length, 1, `${label}: one body`); assert.equal(read.ok, true, `${label}: product evaluation ok (${read.error})`); assert.equal(read.bodyCount, 1); assert.equal(read.hasNull, false, `${label}: no null/NaN stored in the document`);
  assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6 && Math.abs(read.massVolume - volume) <= 1e-6, `${label}: product volumes ${read.evalVolume}/${read.massVolume} vs Studio ${volume}`);
  assert.ok(Math.abs(volume - VOLUME(expect.R)) <= 1e-6 * VOLUME(expect.R), `${label}: Studio volume ${volume} vs ${VOLUME(expect.R)}`);
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); assert.equal(JSON.parse(check.stdout).status, 'PASS'); assert.deepEqual(await doc(), accepted); return { read, verified: JSON.parse(check.stdout) };
}
const initialFiles = ['apps/cad-studio/test/sketch-reopen-main-role-browser.mjs', 'apps/cad-studio/test/fixtures/d358.bcad', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/ui/ParametersPanel.tsx',
  'apps/cad-studio/src/ui/FeatureHistoryBar.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/app/sketchControls.ts', 'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/types.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/select.ts', 'packages/barocss-cad-model/src/engine/parameters.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'sketch-reopen-main-role-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  report.fixture = { file: fixtureFile, hash: hash(await readFile(fixtureFile)) }; const fixtureDoc = JSON.parse(await readFile(fixtureFile, 'utf8'));
  const buildInputs = [], sourcefile = 'd358-inspector.ts', virtual = resolve(app, sourcefile);
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

  // Context 1: Open, editor fields, reopen + Finish unchanged, set R = 6, Undo/Redo, Save.
  phase = 'Open fixture'; await newPage(); await openFile(fixtureFile, 2);
  const opened = await doc(); report.openedEqualsFixtureBytes = JSON.stringify(opened) === JSON.stringify(fixtureDoc); report.openedEqualsFixtureSemantically = (() => { try { assert.deepEqual(opened, fixtureDoc); return true; } catch { return false; } })(); await persist();
  assert.deepEqual(opened.nodes.map(n => n.id), ['n0', 'n1']); assert.equal(opened.nextId, 2); assert.deepEqual(opened.parameters, { R: 5 }); assert.equal(opened.nodes[0].profile, 'circle'); assert.deepEqual(opened.nodes[0].radius, BOUND, 'the fixture binds the circle radius to R');
  assert.equal(opened.nodes[0].regions?.length, 1, 'one rectangle region');
  assert.equal((await bodies()).bodies.length, 1); await snapshot('01-opened'); await inspect('01-native', { R: 5 }); assert.ok(Math.abs((await bodies()).bodies[0].volume - VOLUME(5)) <= 1e-6 * VOLUME(5), 'opened volume 10 (pi 25 + 200)');

  // 1. The Extrude editor offers the circle's Diameter and Centre fields.
  const editor1 = await inspectEditor('02-editor-before'); assert.ok(hasCircleFields(editor1), `02: the Extrude editor shows the circle's Diameter and Centre X/Y: ${JSON.stringify(editor1.labels)}`);

  // 2. Reopen, Finish without a change (THE claim): the circle stays the main profile, nothing is dropped, no toast.
  const fields1 = await reopenSketch('03-reopened'); report.observations.push({ label: '03-reopened', fields: fields1 }); await persist(); await snapshot('03-reopened');
  const finished1 = await finishSketch('03-finish-unchanged'), toasts1 = await alerts(), after1 = finished1.doc;
  report.observations.push({ label: '03-finish-unchanged', node0Before: opened.nodes[0], node0After: after1.nodes[0], docEqual: JSON.stringify(after1) === JSON.stringify(opened), node0Equal: JSON.stringify(after1.nodes[0]) === JSON.stringify(opened.nodes[0]), toasts: toasts1, volume: finished1.bodies.bodies.map(b => b.volume) }); await persist();
  await inspect('03-native', { R: 5 });
  assert.equal(after1.nodes[0].profile, 'circle', `03: Finish without a change keeps profile 'circle' (THE claim): ${JSON.stringify(after1.nodes[0])}`); assert.deepEqual(after1.nodes[0].radius, BOUND, '03: the radius keeps its R binding');
  assert.deepEqual(after1.nodes[0].center, opened.nodes[0].center, '03: centre kept'); assert.deepEqual(after1.nodes[0].regions, opened.nodes[0].regions, '03: the rectangle region is kept'); assert.deepEqual(after1.nodes[0].sideTags, opened.nodes[0].sideTags, '03: sideTags kept');
  assert.deepEqual(after1.nodes[0], opened.nodes[0], '03: n0 deep-equals the opened n0'); assert.deepEqual(toasts1, [], '03: no toast (no "Bindings became numbers")');
  assert.deepEqual(after1.nodes.map(n => n.id), ['n0', 'n1']); assert.equal(after1.nextId, 2); assert.deepEqual(after1.nodes[1], opened.nodes[1], '03: extrude unchanged'); assert.deepEqual(after1.outputs, opened.outputs); assert.deepEqual(after1.parameters, { R: 5 });
  assert.equal(finished1.bodies.bodies.length, 1); assert.ok(Math.abs(finished1.bodies.bodies[0].volume - VOLUME(5)) <= 1e-6 * VOLUME(5), '03: volume unchanged');
  const editor2 = await inspectEditor('03-editor-after'); assert.ok(hasCircleFields(editor2), `03: the Extrude editor still shows the circle's Diameter and Centre X/Y: ${JSON.stringify(editor2.labels)}`);

  // 2b. Reopen (Select tool), click the main circle in the viewport (attachCircle attaches it to the rectangle outline), Finish: nothing changes.
  const R45 = [5 * Math.SQRT1_2, 5 * Math.SQRT1_2]; // a point of the circle's ring
  await reopenSketch('03b-reopened'); await frame([R45, [0, 0], [30, -5], [40, 5]]); const panelBefore = await panelText();
  const clickAt = await worldClick(R45); const panelPicked = await panelText(); report.observations.push({ label: '03b-circle-click', clickAt, panelBefore, panelPicked, selection: await page.evaluate(() => JSON.parse(JSON.stringify(window.__studioSelection ?? null))) }); await snapshot('03b-circle-picked');
  assert.ok(/Picked circle 1/.test(panelPicked) && !/Picked circle/.test(panelBefore), `03b: the click picked the circle (the panel says "Picked circle 1"): ${panelPicked}`);
  const finished2 = await finishSketch('03b-finish-after-pick'), toasts2 = await alerts(), after2 = finished2.doc;
  report.observations.push({ label: '03b-finish-after-pick', node0After: after2.nodes[0], toasts: toasts2, volume: finished2.bodies.bodies.map(b => b.volume) }); await persist();
  await inspect('03b-native', { R: 5 });
  assert.equal(after2.nodes[0].profile, 'circle', `03b: the circle is still the main profile: ${JSON.stringify(after2.nodes[0])}`); assert.deepEqual(after2.nodes[0].radius, BOUND, '03b: radius binding kept'); assert.deepEqual(after2.nodes[0].sideTags.outer, ['e1'], '03b: outer id e1');
  assert.deepEqual(after2.nodes[0], opened.nodes[0], '03b: n0 deep-equals the opened n0'); assert.deepEqual(toasts2, [], '03b: no toast'); assert.deepEqual(after2, opened, '03b: document unchanged');
  assert.equal(finished2.bodies.bodies.length, 1); assert.ok(Math.abs(finished2.bodies.bodies[0].volume - VOLUME(5)) <= 1e-6 * VOLUME(5), '03b: volume unchanged');

  // 2c. Reopen, Split the rectangle's bottom edge at its middle (x 30, y -5), Finish: the circle stays main, the region has five lines.
  await reopenSketch('03c-reopened'); await frame([[30, -5], [0, 0], [40, 5]]); await tool('Split', 'k'); const splitAt = await worldClick([30, -5]); await snapshot('03c-split-clicked');
  report.observations.push({ label: '03c-split-click', splitAt, toasts: await alerts() }); await persist();
  const finished3 = await finishSketch('03c-finish-after-split'), toasts3 = await alerts(), after3 = finished3.doc;
  report.observations.push({ label: '03c-finish-after-split', node0After: after3.nodes[0], toasts: toasts3, volume: finished3.bodies.bodies.map(b => b.volume) }); await persist();
  await inspect('03c-native', { R: 5, segments: 5 });
  assert.equal(after3.nodes[0].profile, 'circle', `03c: the circle is still the main profile: ${JSON.stringify(after3.nodes[0])}`); assert.deepEqual(after3.nodes[0].radius, BOUND, '03c: radius binding kept'); assert.deepEqual(after3.nodes[0].sideTags.outer, ['e1'], '03c: outer id e1');
  assert.equal(after3.nodes[0].regions?.length, 1); assert.equal(after3.nodes[0].regions[0].length, 5, '03c: the region now has five lines'); assert.deepEqual(toasts3, [], '03c: no toast');
  assert.deepEqual(after3.nodes[1], opened.nodes[1]); assert.ok(Math.abs(finished3.bodies.bodies[0].volume - VOLUME(5)) <= 1e-6 * VOLUME(5), '03c: volume unchanged');
  phase = 'Undo split'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await same(after1);

  // 3. Parameter R = 6 drives the circle through the binding.
  const param6 = await setParameter('R', 6, '04-param-6'), doc6 = param6.doc, toasts6 = await alerts();
  report.observations.push({ label: '04-param-6', node0: doc6.nodes[0], toasts: toasts6, volume: param6.bodies.bodies.map(b => b.volume) }); await persist();
  await inspect('04-native', { R: 6 });
  assert.deepEqual(doc6.parameters, { R: 6 }, '04: R is 6'); assert.deepEqual(doc6.nodes, after1.nodes, '04: only the parameter changed'); assert.deepEqual(toasts6, [], '04: no toast');
  assert.equal(param6.bodies.bodies.length, 1); assert.ok(Math.abs(param6.bodies.bodies[0].volume - VOLUME(6)) <= 1e-6 * VOLUME(6), `04: volume ${param6.bodies.bodies[0].volume} vs ${VOLUME(6)}`);

  // 4. Undo returns the R = 5 document, Redo the R = 6 document; Save.
  phase = 'Undo/Redo parameter'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await same(after1); await page.keyboard.press('Meta+Shift+z'); await same(doc6);
  const saved = await save('edited'); assert.deepEqual(saved.doc, doc6);

  // Context 2: fresh Open of edited.bcad.
  const fresh = await freshOpen(saved.file, saved.doc, '05-fresh-open'); await inspect('05-native', { R: 6 }); const toastsFresh = await alerts();
  assert.deepEqual(toastsFresh, [], '05: no toast'); assert.equal(fresh.doc.nodes[0].profile, 'circle'); assert.deepEqual(fresh.doc.nodes[0].radius, BOUND);
  assert.equal(fresh.bodies.bodies.length, 1); assert.ok(Math.abs(fresh.bodies.bodies[0].volume - VOLUME(6)) <= 1e-6 * VOLUME(6), `05: volume ${fresh.bodies.bodies[0].volume} vs ${VOLUME(6)}`);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
