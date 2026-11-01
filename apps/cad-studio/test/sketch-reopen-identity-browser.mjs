// D349 qualification: reopening a sketch drawn on a body (node.on) in the sketcher and pressing Finish keeps the node's `on`, `id` and other fields,
// with or without a geometry change, so Extrude from that sketch still offers Operation (Join / New body / Cut). Root must freeze all sources first.
// Run from apps/cad-studio:
// D349_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/sketch-reopen-identity-browser.mjs /absolute/artifacts
// Actual Studio UI (Open, history, feature editor, Sketch panel, Finish, Extrude HUD, Undo/Redo, Save) mutates. Readonly hooks observe only.
// One Chrome WebGPU process, sequential fresh contexts. Independent Python oracle (no product imports) checks the stored sketch and the analytic volume.
// Expected at a base without the D349 fix: the driver FAILS at the first violated identity claim (the failure state is snapshotted before asserting).
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent exact (Fraction) check of a box with rectangular cuts made from a sketch drawn on its top face. Product imports: zero."""
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
doc = data['doc']; reported = data['volume']; cuts = data['cuts']
nodes = doc['nodes']
base = nodes[0]; ex = nodes[1]; src = nodes[2]
assert base['kind'] == 'sketch' and base['profile'] == 'rectangle' and ex['kind'] == 'extrude' and ex['sketch'] == 0, 'box = rectangle sketch + extrude'
lo = [fr(c) for c in base['min']]; hi = [fr(c) for c in base['max']]; h = fr(ex['height'])
box = (hi[0] - lo[0]) * (hi[1] - lo[1]) * h
assert src['kind'] == 'sketch' and src['profile'] == 'polygon' and src['id'] == 'n2', 'node 2 is the polygon sketch n2'
assert src.get('on') == {'node': 1, 'side': 'solid'}, ('node 2 lost its on reference', src.get('on'))
assert src['plane']['origin'] == [0, 0, 10] and src['plane']['normal'] == [0, 0, 1], 'sketch lies on the top face'
pts = [[fr(c) for c in p] for p in src['points']]
if src.get('outline'):
    assert [[fr(c) for c in p] for p in src['outline']['points']] == pts, 'outline points equal the node points'
assert len(pts) >= 3
for p in pts:
    assert lo[0] <= p[0] <= hi[0] and lo[1] <= p[1] <= hi[1], ('cut outside the top face', [str(c) for c in p])
area = abs(shoelace(pts))
diffs = [n for n in nodes if n['kind'] == 'difference']
assert len(diffs) == cuts, ('difference count', len(diffs), cuts)
removed = F(0)
for d in diffs:
    assert d['parent'] == {'node': 1, 'side': 'solid'}, ('cut parent', d['parent'])
    tool = nodes[d['tool']['node']]
    assert tool['kind'] == 'extrude' and tool['sketch'] == 2, ('cut tool is an extrude of sketch 2', tool)
    depth = abs(fr(tool['height']))
    assert 0 < depth <= h, ('cut depth', str(depth))
    removed += area * depth
volume = float(box - removed)
assert abs(volume - reported) <= 1e-6, ('volume', volume, reported)
print(json.dumps({'status': 'PASS', 'boxVolume': str(box), 'sketchArea': str(area), 'removed': str(removed), 'cuts': len(diffs), 'analyticVolume': volume, 'reportedVolume': reported,
  'delta': abs(volume - reported), 'nodeTwoOn': src['on'], 'productImports': 0}, indent=2))
`;
assert.equal(process.env.D349_SOURCE_FROZEN, '1', 'Root must freeze all writers before D349 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
const fixtureFile = resolve(import.meta.dirname, 'fixtures/d349.bcad');
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'SKETCH_REOPEN_FINISH_KEEPS_ON_AND_IDENTITY', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One box with one sketch drawn on its top face; one geometry edit (Point 2 X, and Point 3 X only if the panel does not move it) and one Cut of depth 5.', 'The Python oracle checks the stored sketch, node 2 on, and the analytic volume, not kernel topology.',
    'Product reads (the bundled inspector) are product code, not an independent oracle.', 'Operation in the final document (09) is recorded, not asserted: a finished cut may legitimately consume the base body.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const BASE = { node: 1, side: 'solid' }, BOX_VOLUME = 24000, CUT_VOLUME = 24000 - 25 * 15 * 5;
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){const key=view.bodies[0].key,p=part('D349 observed',doc),body=p.body(key);
  out.bodyCount=view.bodies.length;out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.massVolume=body.mass({density:1}).volume;}
out.nodeTwoOn=doc.nodes[2]?.on??null;out.nodeTwoId=doc.nodes[2]?.id??null;
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;
/** The object without the named keys (compared apart from fields an edit is expected to rewrite). */
const without = (object, ...keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
const doc = () => page.evaluate(() => window.__studioDoc);
const editor = () => page.locator('.node-editor');
const sketchPanel = () => page.getByRole('complementary', { name: 'Sketch', exact: true });
const hud = () => page.getByRole('dialog', { name: 'Extrude', exact: true });
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
async function same(expected) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), expected); }
async function changed(before) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) !== x, JSON.stringify(before), { timeout: 60000 }); await ready(); }
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
// A history button (sketch buttons are named by profile: "Sketch · polygon"; clicking one picks the sketch as a profile and opens the feature editor).
async function openSketchEditor() {
  phase = 'open sketch editor from history'; const target = page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · polygon', exact: true });
  if (await target.count() === 1) { await target.click(); await editor().waitFor(); return; }
  // A sketch an Extrude consumed has no history entry of its own: its Extrude's editor offers Edit sketch for it.
  const state = await doc(), consumer = state.nodes.findIndex(n => n.kind === 'extrude' && n.sketch === 2); assert.ok(consumer > 2, 'Sketch 2 is consumed by a later Extrude');
  report.observations.push({ label: 'sketch-editor-route', via: `extrude node ${consumer}` }); await page.locator(`.history .hs[data-node-index="${consumer}"]`).click(); await editor().waitFor();
}
async function reopenSketch(label) {
  phase = `reopen sketch ${label}`; await openSketchEditor(); await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor();
  return page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Point "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
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
async function inspect(label, cuts) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), studio = await bodies(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  assert.equal(studio.bodies.length, 1, 'Studio reports one body'); const volume = studio.bodies[0].volume;
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  const read = JSON.parse(run.stdout); report.reads.push({ label, studioVolume: volume, ...read }); await persist();
  const input = { doc: accepted, volume, cuts }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'sketch-reopen-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`);
  const verified = JSON.parse(check.stdout); assert.equal(verified.status, 'PASS'); report.oracles.push({ label, verified });
  assert.equal(read.ok, true, `product evaluation ok (${read.error})`); assert.equal(read.bodyCount, 1); assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6, `product evalVolume ${read.evalVolume} vs Studio ${volume}`); assert.ok(Math.abs(read.massVolume - volume) <= 1e-6, `product massVolume ${read.massVolume} vs Studio ${volume}`);
  assert.deepEqual(read.nodeTwoOn, BASE, `${label}: product read sees node 2 on`); assert.equal(read.nodeTwoId, 'n2');
  assert.deepEqual(await doc(), accepted); return { read, verified };
}
const initialFiles = ['apps/cad-studio/test/sketch-reopen-identity-browser.mjs', 'apps/cad-studio/test/fixtures/d349.bcad', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/ui/FeatureHistoryBar.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/loops.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
const GEOMETRY = ['points', 'outline', 'segments'];
const RECT = [[10, 10], [35, 10], [35, 25], [10, 25]];
// Select sketch n2 through its history button, close the feature editor (the pick stays), then start Extrude with its shortcut E.
async function startExtrude(label) {
  phase = `Extrude HUD ${label}`; await openSketchEditor(); await editor().getByRole('button', { name: 'Close editor', exact: true }).click(); await editor().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => (window.__studioSelection?.selection?.sketches ?? []).includes(2), null, { timeout: 15000 });
  await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('e'); await hud().waitFor();
  await page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 });
}
const operationRead = () => page.evaluate(() => { const s = document.querySelector('.hud select[aria-label="Operation"]'); return s ? { present: true, value: s.value, options: [...s.options].map(o => ({ value: o.value, text: o.textContent })) } : { present: false, options: [] }; });
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'sketch-reopen-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  report.fixture = { file: fixtureFile, hash: hash(await readFile(fixtureFile)) }; const fixtureDoc = JSON.parse(await readFile(fixtureFile, 'utf8'));
  const buildInputs = [], sourcefile = 'd349-inspector.ts', virtual = resolve(app, sourcefile);
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

  // Context 1: Open, Finish unchanged, edit a point and Finish, Extrude with Operation Cut, Undo/Redo, Save.
  phase = 'Open fixture'; await newPage(); await openFile(fixtureFile, 3);
  const opened = await doc(); report.openedEqualsFixtureBytes = JSON.stringify(opened) === JSON.stringify(fixtureDoc); report.openedEqualsFixtureSemantically = (() => { try { assert.deepEqual(opened, fixtureDoc); return true; } catch { return false; } })(); await persist();
  assert.deepEqual(opened.nodes.map(n => n.id), ['n0', 'n1', 'n2']); assert.equal(opened.nextId, 3); assert.deepEqual(opened.nodes[2].on, BASE); assert.equal((await bodies()).bodies.length, 1);
  await snapshot('01-opened'); await inspect('01-native', 0); assert.ok(Math.abs((await bodies()).bodies[0].volume - BOX_VOLUME) <= 1e-6, 'opened volume is 24000');

  const pointsBefore1 = await reopenSketch('02-reopened'); report.observations.push({ label: '02-reopened', pointFields: pointsBefore1 }); await persist(); await snapshot('02-reopened');
  const finished1 = await finishSketch('02-finish-unchanged'), toasts1 = await alerts(), node1 = finished1.doc.nodes[2];
  const differing1 = [...new Set([...Object.keys(node1), ...Object.keys(opened.nodes[2])])].filter(k => JSON.stringify(node1[k]) !== JSON.stringify(opened.nodes[2][k]));
  report.observations.push({ label: '02-finish-unchanged', nodeBefore: opened.nodes[2], nodeAfter: node1, differingKeys: differing1, docEqual: JSON.stringify(finished1.doc) === JSON.stringify(opened), toasts: toasts1 }); await persist();
  assert.deepEqual(node1.on, BASE, '02: Finish without a change keeps node 2 on'); assert.equal(node1.id, 'n2', '02: node 2 id kept');
  assert.ok(differing1.every(k => GEOMETRY.includes(k)), `02: only geometry keys may differ, differing: ${differing1.join(',')}`);
  assert.deepEqual(without(node1, ...GEOMETRY), without(opened.nodes[2], ...GEOMETRY), '02: non-geometry keys (on, id, plane, sideTags, kind) equal');
  assert.deepEqual(finished1.doc.nodes.map(n => n.id), ['n0', 'n1', 'n2']); assert.deepEqual(finished1.doc.nodes.slice(0, 2), opened.nodes.slice(0, 2), '02: other nodes unchanged'); assert.equal(finished1.doc.nextId, 3); assert.deepEqual(finished1.doc.outputs, opened.outputs);
  if (!differing1.length) assert.deepEqual(finished1.doc, opened, '02: document equal to before'); assert.deepEqual(toasts1, [], '02: no toast');
  assert.equal(finished1.bodies.bodies.length, 1); assert.ok(Math.abs(finished1.bodies.bodies[0].volume - BOX_VOLUME) <= 1e-6, '02: volume 24000');

  const pointsBefore2 = await reopenSketch('03-reopened');
  const beforeEdit = await doc(); const x2 = sketchPanel().getByLabel('Point 2 X', { exact: true }); await x2.waitFor(); assert.equal(Number(await x2.inputValue()), 30, 'Point 2 X shows 30 before the edit'); await x2.fill('35'); await page.waitForTimeout(500);
  const afterX2 = await page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Point "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
  const x3 = sketchPanel().getByLabel('Point 3 X', { exact: true }), x3Value = Number(await x3.inputValue()); let filledPoint3 = false;
  if (x3Value !== 35) { await x3.fill('35'); filledPoint3 = true; await page.waitForTimeout(500); }
  const afterAll = await page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Point "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
  report.observations.push({ label: '03-point-edit', pointsBefore: pointsBefore2, afterPoint2X: afterX2, point3XAfterPoint2X: x3Value, filledPoint3, afterAll, note: 'Point 3 X is filled only when the constraints did not move it' }); await persist();
  const edited = await finishSketch('03-edited'), editedDoc = edited.doc, node2 = editedDoc.nodes[2], toasts2 = await alerts();
  const points2 = { points: node2.points, outlinePoints: node2.outline?.points }; report.observations.push({ label: '03-edited', node: node2, points: points2, toasts: toasts2, volume: edited.bodies.bodies.map(b => b.volume) }); await persist();
  assert.notDeepEqual(editedDoc, beforeEdit, '03: the edit changed the document');
  assert.deepEqual(node2.on, BASE, '03: on kept after a geometry edit'); assert.equal(node2.id, 'n2'); assert.deepEqual(node2.plane, opened.nodes[2].plane, '03: plane kept'); assert.deepEqual(node2.sideTags, opened.nodes[2].sideTags, '03: sideTags kept');
  assert.equal(node2.kind, 'sketch'); assert.equal(node2.profile, 'polygon'); assert.ok(node2.points || node2.outline, '03: sketch keeps points or outline');
  if (node2.points) assert.deepEqual(node2.points, RECT, '03: points'); if (node2.outline) assert.deepEqual(node2.outline.points, RECT, '03: outline points');
  assert.deepEqual(editedDoc.nodes.slice(0, 2), opened.nodes.slice(0, 2)); assert.equal(editedDoc.nodes.length, 3); assert.equal(editedDoc.nextId, 3); assert.deepEqual(toasts2, []);
  assert.equal(edited.bodies.bodies.length, 1); assert.ok(Math.abs(edited.bodies.bodies[0].volume - BOX_VOLUME) <= 1e-6, '03: volume 24000'); await inspect('03-native', 0);

  await startExtrude('04'); const operation = await operationRead(), depthField = await page.evaluate(() => ({ depth: !!document.querySelector('.hud select[aria-label="Depth"]'), distance: !!document.querySelector('.hud input[aria-label="Distance"]') }));
  report.observations.push({ label: '04-extrude-hud', operation, depthField, hudText: await page.evaluate(() => document.querySelector('.hud')?.textContent ?? null) }); await snapshot('04-extrude-hud');
  assert.equal(operation.present, true, '04: Operation is offered for the reopened sketch'); assert.deepEqual(operation.options.map(o => o.value), ['join', 'new', 'cut'], '04: Operation options');
  phase = 'Extrude Cut Apply'; await hud().getByLabel('Operation', { exact: true }).selectOption('cut');
  const depth = hud().getByLabel('Depth', { exact: true }); await depth.waitFor(); await depth.selectOption('distance');
  const distance = hud().getByLabel('Distance', { exact: true }); await distance.waitFor(); await distance.fill('5');
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
  await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(editedDoc); await hud().waitFor({ state: 'hidden' }); const cut = await snapshot('05-cut'), cutDoc = cut.doc;
  report.observations.push({ label: '05-cut', nodes: cutDoc.nodes.slice(3), outputs: cutDoc.outputs, volume: cut.bodies.bodies.map(b => b.volume), toasts: await alerts() }); await persist();
  assert.deepEqual(cutDoc.nodes.slice(0, 3), editedDoc.nodes, '05: earlier nodes unchanged'); const extrudeNode = cutDoc.nodes[3], diff = cutDoc.nodes.at(-1);
  assert.equal(extrudeNode.kind, 'extrude'); assert.equal(extrudeNode.sketch, 2, '05: new extrude is from sketch 2'); assert.equal(Math.abs(extrudeNode.height), 5);
  assert.equal(diff.kind, 'difference'); assert.deepEqual(diff.parent, BASE, '05: difference parent is the base body'); assert.deepEqual(diff.tool, { node: 3, side: 'solid' }); assert.equal(cutDoc.nodes.length, 5);
  assert.equal(cut.bodies.bodies.length, 1, '05: one body'); assert.ok(Math.abs(cut.bodies.bodies[0].volume - CUT_VOLUME) <= 1e-6, `05: volume ${cut.bodies.bodies[0].volume} vs ${CUT_VOLUME}`); assert.deepEqual(await alerts(), []);
  await inspect('05-native', 1);

  phase = 'Undo/Redo cut'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await same(editedDoc); await page.keyboard.press('Meta+Shift+z'); await same(cutDoc);
  const cutSaved = await save('cut'); assert.deepEqual(cutSaved.doc, cutDoc);

  // Context 2: fresh Open of cut.bcad, reopen the sketch and Finish unchanged again.
  await freshOpen(cutSaved.file, cutSaved.doc, '06-fresh-open'); await inspect('06-native', 1);
  const pointsFresh = await reopenSketch('07-reopened'); report.observations.push({ label: '07-reopened', pointFields: pointsFresh }); await persist();
  const finished2 = await finishSketch('07-finish-after-open'), toasts3 = await alerts(), node3 = finished2.doc.nodes[2];
  const differing2 = [...new Set([...Object.keys(node3), ...Object.keys(cutDoc.nodes[2])])].filter(k => JSON.stringify(node3[k]) !== JSON.stringify(cutDoc.nodes[2][k]));
  report.observations.push({ label: '07-finish-after-open', nodeBefore: cutDoc.nodes[2], nodeAfter: node3, differingKeys: differing2, docEqual: JSON.stringify(finished2.doc) === JSON.stringify(cutDoc), toasts: toasts3, volume: finished2.bodies.bodies.map(b => b.volume) }); await persist();
  assert.deepEqual(node3.on, BASE, '07: Finish after Open keeps node 2 on'); assert.ok(differing2.every(k => GEOMETRY.includes(k)), `07: only geometry keys may differ, differing: ${differing2.join(',')}`);
  assert.deepEqual(without(node3, ...GEOMETRY), without(cutDoc.nodes[2], ...GEOMETRY), '07: non-geometry keys equal');
  assert.deepEqual(finished2.doc.nodes.map(n => n.id), cutDoc.nodes.map(n => n.id)); assert.equal(finished2.doc.nodes.length, 5); assert.deepEqual(finished2.doc.nodes.slice(3), cutDoc.nodes.slice(3), '07: cut nodes unchanged'); assert.deepEqual(finished2.doc.nodes.slice(0, 2), cutDoc.nodes.slice(0, 2));
  assert.deepEqual(finished2.doc.outputs, cutDoc.outputs); assert.equal(finished2.doc.nextId, cutDoc.nextId); if (!differing2.length) assert.deepEqual(finished2.doc, cutDoc, '07: document equal to before'); assert.deepEqual(toasts3, []);
  assert.equal(finished2.bodies.bodies.length, 1); assert.ok(Math.abs(finished2.bodies.bodies[0].volume - CUT_VOLUME) <= 1e-6, '07: volume 22125');
  await inspect('07-native', 1); const finalSaved = await save('final');

  // Context 3: fresh Open of final.bcad, record the Extrude HUD, cancel it.
  const final = await freshOpen(finalSaved.file, finalSaved.doc, '08-final'); await inspect('08-native', 1); assert.ok(Math.abs(final.bodies.bodies[0].volume - CUT_VOLUME) <= 1e-6, '08: volume 22125'); assert.deepEqual(final.doc.nodes[2].on, BASE, '08: node 2 on in the reopened document');
  const pointsFinal = await reopenSketch('09-reopened-final'); report.observations.push({ label: '09-reopened-final', pointFields: pointsFinal }); await persist(); await snapshot('09-reopened-final');
  phase = 'leave sketch 09 without a change';
  for (let i = 0; i < 3 && await sketchPanel().isVisible(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  await sketchPanel().waitFor({ state: 'hidden' }); await same(finalSaved.doc); await snapshot('09-left-final');

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
