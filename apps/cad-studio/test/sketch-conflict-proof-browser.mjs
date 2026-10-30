// D350 qualification: in the sketcher, a dimension that contradicts horizontal/vertical edges, their lengths and axis distances is refused as a proven Conflict
// ("Conflict: no shape meets all of these constraints"), the sketch and document stay unchanged; a non-rectilinear contradiction keeps the solver's nonconvergence message
// ("this is not an inconsistency proof") without claiming a conflict; a consistent duplicate is still refused as over-defining ("already implied"); a consistent edit is accepted.
// Root must freeze all sources first. Run from apps/cad-studio:
//   D350_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/sketch-conflict-proof-browser.mjs /absolute/artifacts
// Actual Studio UI (Open, history, feature editor, Sketch panel "Edge N length" inputs, Escape, Finish, Undo/Redo, Save) mutates. Readonly hooks observe only.
// Where the refusal text is read: App.tsx updateShape -> settleShape (sketch/settle.ts) -> setSketchError -> SketchPanel.tsx `{error && <div className="sk-status open" role="alert">}`.
// Expected at a base without the D350 fix: FAILS at the first Conflict assertion (the nonconvergence text is shown; the state is snapshotted before asserting).
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent exact (Fraction) decision of probed edge-length edits on an axis-aligned rectangle sketch, and the triangle inequality for a triangle. Product imports: zero."""
import json, sys
from fractions import Fraction as F

TOL = F(4, 10**7)  # D350's per-equation relaxation; the rectangle's x (or y) cycle has 4 equations, so opposite lengths may differ by 4*TOL before it is infeasible

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)

data = json.load(sys.stdin)
results = []
for p in data['probes']:
    doc = p['doc']; node = doc['nodes'][p['node']]
    assert node['kind'] == 'sketch' and node['profile'] == 'polygon', 'polygon sketch'
    o = node['outline']; pts = [[fr(c) for c in q] for q in o['points']]
    assert pts == [[fr(c) for c in q] for q in node['points']], 'outline points equal node points'
    stored = {int(k): fr(v) for k, v in (o.get('lengths') or {}).items()}
    n = len(pts)
    def length(i):
        # exact for axis-aligned edges: |dx| + |dy| with one of them zero
        a = pts[i]; b = pts[(i + 1) % n]
        assert a[0] == b[0] or a[1] == b[1], 'axis-aligned edge'
        return abs(a[0] - b[0]) + abs(a[1] - b[1])
    value = fr(p['value']); e = p['edge']; entry = {'label': p['label'], 'kind': p['kind'], 'edge': e, 'value': str(value)}
    if p['kind'] == 'rect':
        assert n == 4
        hv = o.get('hv'); assert hv and sorted(hv['h']) == [0, 2] and sorted(hv['v']) == [1, 3], ('hv', hv)
        for i in (0, 2): assert pts[i][1] == pts[i + 1][1], ('edge ' + str(i) + ' is horizontal')
        for i in (1, 3): assert pts[i][0] == pts[(i + 1) % n][0], ('edge ' + str(i) + ' is vertical')
        for i, v in stored.items(): assert abs(length(i) - v) <= TOL, ('stored length matches the points', i, str(v), str(length(i)))
        opp = (e + 2) % 4
        if opp in stored:
            diff = abs(value - stored[opp])
            verdict = 'conflict' if diff > 4 * TOL else 'implied'
            entry.update({'opposite': opp, 'oppositeStored': str(stored[opp]), 'difference': str(diff)})
        else:
            verdict = 'new'
        entry['verdict'] = verdict
        if 'volume' in p:
            ext = [m for m in doc['nodes'] if m['kind'] == 'extrude' and m['sketch'] == 0]; assert len(ext) == 1
            vol = length(0) * length(1) * fr(ext[0]['height'])
            assert abs(float(vol) - p['volume']) <= 1e-6, ('volume', float(vol), p['volume']); entry['analyticVolume'] = float(vol)
    else:
        assert n == 3 and 0 in stored and 1 in stored and e == 2
        a, b = stored[0], stored[1]
        entry['verdict'] = 'infeasible' if not (abs(a - b) <= value <= a + b) else 'new'
        entry['note'] = 'triangle inequality: the contradiction is real, the product is expected not to claim a proof for it'
    assert entry['verdict'] == p['expect'], ('oracle verdict', entry, p['expect'])
    results.append(entry)
print(json.dumps({'status': 'PASS', 'results': results, 'productImports': 0}, indent=2))
`;
assert.equal(process.env.D350_SOURCE_FROZEN, '1', 'Root must freeze all writers before D350 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
const fixtureFile = resolve(import.meta.dirname, 'fixtures/d350.bcad');
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'SKETCH_DIMENSION_CONFLICT_PROOF', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One rectangle sketch (n0, consumed by an Extrude) and one triangle sketch (n2); edge lengths 60/50/45/40 and 30 only.', 'Refusal text is read from the Sketch panel alert (settleShape path); the Model reason (commitDimension, product code) is recorded beside it and compared after removing the dimension label.',
    'The Python oracle decides rectangle edits by exact arithmetic and the triangle by the triangle inequality; the triangle contradiction is real but the product must not claim a proof for it.', 'Product reads (the bundled inspector) are product code, not an independent oracle.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const CONFLICT = 'Conflict: no shape meets all of these constraints', NONCONV = 'this is not an inconsistency proof', IMPLIED = 'already implied';
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {commitDimension} from '../../packages/barocss-cad-model/src/sketch/rules.ts';
import {outlinePolygon} from '../../packages/barocss-cad-model/src/sketch/outlineFields.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),probes=JSON.parse(process.argv[3]||'[]'),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){out.bodyCount=view.bodies.length;out.evalVolume=view.bodies[0]?.volume??null;}
out.probes=probes.map((p:any)=>{const poly=outlinePolygon(doc.nodes[p.node].outline);const r:any=commitDimension(poly,p.key,p.value);return {...p,ok:!!r.ok,reason:r.ok?null:r.reason};});
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;
const without = (object, ...keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
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
// n0 is consumed by the Extrude n1 (no history entry of its own): the Extrude's editor offers Edit sketch. n2 is standalone: its history button is "Sketch · polygon".
async function openSketchEditor(which) {
  phase = `open sketch editor ${which}`;
  if (which === 'n2') { const target = page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · polygon', exact: true }); assert.equal(await target.count(), 1, 'one standalone polygon sketch button'); await target.click(); await editor().waitFor(); return; }
  const state = await doc(), consumer = state.nodes.findIndex(n => n.kind === 'extrude' && n.sketch === 0); assert.equal(consumer, 1, 'Sketch 0 is consumed by Extrude node 1');
  await page.locator(`.history .hs[data-node-index="${consumer}"]`).click(); await editor().waitFor();
}
const pointsRead = () => page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Point "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
const edgesRead = () => page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Edge "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
const panelText = sel => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);
async function reopenSketch(which, label) {
  await openSketchEditor(which); phase = `reopen sketch ${which} ${label}`; await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor();
  return { points: await pointsRead(), edges: await edgesRead() };
}
// The panel input: onChange locks a typed length (fill); Enter locks the value as shown. Same-value entries need Enter (no change event fires for an identical value).
async function setEdge(n, value) {
  const input = sketchPanel().getByLabel(`Edge ${n} length`, { exact: true }); await input.waitFor(); const shown = Number(await input.inputValue());
  if (shown === value) { await input.focus(); await page.keyboard.press('Enter'); } else await input.fill(String(value));
  await page.waitForTimeout(600); return { shownBefore: shown, route: shown === value ? 'Enter' : 'fill' };
}
// Probe one edge length; read the refusal from the panel alert (role=alert) or null when none appears.
async function probeEdge(label, n, value) {
  const before = { points: await pointsRead(), edges: await edgesRead(), status: await panelText('.sk-panel [role="status"]') }; const route = await setEdge(n, value);
  const alert = await page.locator('.sk-panel [role="alert"]').count() ? await panelText('.sk-panel [role="alert"]') : null;
  const after = { points: await pointsRead(), edges: await edgesRead(), status: await panelText('.sk-panel [role="status"]') };
  const state = await snapshot(label); const observation = { label, edge: n, value, route, before, after, alert, toasts: await alerts() }; report.observations.push(observation); await persist(); return { observation, state };
}
async function leaveSketch(label, expected) {
  phase = `leave sketch ${label}`; await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < 3 && await sketchPanel().isVisible(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  await sketchPanel().waitFor({ state: 'hidden' }); await same(expected); return snapshot(label);
}
async function finishSketch(label) { phase = `Finish sketch ${label}`; await page.locator('.topbar button.finish').click(); await sketchPanel().waitFor({ state: 'hidden' }); await ready(); return snapshot(label); }
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
// Product read (bundled inspector: evaluateDoc + commitDimension on outlinePolygon) and the independent Python oracle on the same document and probes.
// probes: [{ node, edge (0-based), value, kind: 'rect'|'tri', expect: 'conflict'|'implied'|'infeasible' }]
async function inspect(label, probes, volume) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const keyed = probes.map(p => ({ ...p, key: `len${p.edge}` }));
  const run = spawnSync(process.execPath, [inspector, file, JSON.stringify(keyed)], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  const read = JSON.parse(run.stdout); report.reads.push({ label, ...read }); await persist();
  const input = { probes: probes.map((p, i) => ({ ...p, label: `${label}#${i}`, doc: accepted, ...(volume !== undefined && p.kind === 'rect' ? { volume } : {}) })) }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'sketch-conflict-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); const verified = JSON.parse(check.stdout); assert.equal(verified.status, 'PASS'); report.oracles.push({ label, verified });
  assert.equal(read.ok, true, `product evaluation ok (${read.error})`); if (volume !== undefined) { assert.equal(read.bodyCount, 1); assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6, `product evalVolume ${read.evalVolume} vs ${volume}`); }
  assert.deepEqual(await doc(), accepted); return { read, verified };
}
// The Model reason names the dimension ("Length of edge 3 = 50: ..."); the panel text has the label removed (settleShape strips "That: "). Equal after removing the label.
const modelWithoutLabel = (reason, label) => reason.startsWith(label + ': ') ? reason.slice(label.length + 2) : reason.startsWith(label) ? 'That' + reason.slice(label.length) : reason;
function checkRefusal(tag, observation, kind, modelProbe, label) {
  const text = observation.alert; assert.ok(text, `${tag}: a refusal is shown in the Sketch panel alert`);
  assert.deepEqual(observation.after.points, observation.before.points, `${tag}: sketch points unchanged`); assert.deepEqual(observation.after.edges, observation.before.edges, `${tag}: edge inputs unchanged`);
  assert.ok(modelProbe.reason, `${tag}: the Model refuses too`); assert.ok(modelProbe.reason.includes(label), `${tag}: Model reason names the dimension "${label}": ${modelProbe.reason}`);
  if (kind === 'conflict') { assert.ok(text.includes(CONFLICT), `${tag}: UI text proves a Conflict: ${text}`); assert.ok(modelProbe.reason.includes(CONFLICT), `${tag}: Model reason proves a Conflict: ${modelProbe.reason}`); }
  if (kind === 'implied') assert.ok(text.includes(IMPLIED) && modelProbe.reason.includes(IMPLIED), `${tag}: over-defining refusal: ${text} / ${modelProbe.reason}`);
  if (kind === 'nonconvergence') { assert.ok(text.includes(NONCONV) && !text.includes('Conflict'), `${tag}: nonconvergence without a Conflict claim: ${text}`); assert.ok(modelProbe.reason.includes(NONCONV) && !modelProbe.reason.includes('Conflict'), `${tag}: Model nonconvergence: ${modelProbe.reason}`); }
  assert.equal(modelWithoutLabel(modelProbe.reason, label), text, `${tag}: Model reason equals the UI text apart from the label`);
}
const initialFiles = ['apps/cad-studio/test/sketch-conflict-proof-browser.mjs', 'apps/cad-studio/test/fixtures/d350.bcad', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/ui/SketchMarks.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/sketch/rules.ts', 'packages/barocss-cad-model/src/sketch/settle.ts', 'packages/barocss-cad-model/src/sketch/profile.ts', 'packages/barocss-cad-model/src/sketch/outlineFields.ts', 'packages/barocss-cad-model/src/sketch/reopen.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
const RECT_60_40 = [[0, 0], [60, 0], [60, 40], [0, 40]];
const modelOf = (read, i) => read.probes[i];
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'sketch-conflict-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  report.fixture = { file: fixtureFile, hash: hash(await readFile(fixtureFile)) }; const fixtureDoc = JSON.parse(await readFile(fixtureFile, 'utf8'));
  const buildInputs = [], sourcefile = 'd350-inspector.ts', virtual = resolve(app, sourcefile);
  const built = await build({ stdin: { contents: inspectSource, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  await writeFile(join(output, 'inspector.ts'), inspectSource); await writeFile(join(output, 'inspector-metafile.json'), JSON.stringify(built.metafile, null, 2));
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual)); report.virtualSources = [{ label: 'inspector', hash: hash(inspectSource), virtualInputExcluded: virtual }];
  inspector = join(output, 'inspector.mjs'); await writeFile(inspector, built.outputFiles[0].contents);
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
  frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts']; report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
  for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' }); server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;

  // Context 1.
  phase = 'Open fixture'; await newPage(); await openFile(fixtureFile, 3);
  const opened = await doc(); report.openedEqualsFixtureSemantically = (() => { try { assert.deepEqual(opened, fixtureDoc); return true; } catch { return false; } })(); await persist();
  assert.deepEqual(opened.nodes.map(n => n.id), ['n0', 'n1', 'n2']); assert.equal(opened.nextId, 3); assert.equal((await bodies()).bodies.length, 1);
  const s01 = await snapshot('01-opened'); assert.ok(Math.abs(s01.bodies.bodies[0].volume - 18000) <= 1e-6, 'opened volume is 18000');
  // Model reasons for the probes of the opened document (the receipt shows them next to the UI text).
  const openedRead = (await inspect('01-native', [{ node: 0, edge: 2, value: 50, kind: 'rect', expect: 'conflict' }, { node: 0, edge: 2, value: 60, kind: 'rect', expect: 'implied' }, { node: 2, edge: 2, value: 30, kind: 'tri', expect: 'infeasible' }], 18000)).read;

  // 1. Conflict: Edge 3 = 50 against the pinned Edge 1 = 60.
  const open1 = await reopenSketch('n0', '02'); report.observations.push({ label: '02-reopened', ...open1 }); await persist();
  assert.deepEqual(open1.edges.map(e => e.label), ['Edge 1 length', 'Edge 2 length', 'Edge 3 length', 'Edge 4 length'], '02: four edge inputs');
  const p02 = await probeEdge('02-conflict', 3, 50); checkRefusal('02', p02.observation, 'conflict', modelOf(openedRead, 0), 'Length of edge 3 = 50');
  await leaveSketch('02-left', opened);

  // 2. Redundant duplicate: Edge 3 = 60 (already implied).
  await reopenSketch('n0', '03'); const p03 = await probeEdge('03-redundant', 3, 60); checkRefusal('03', p03.observation, 'implied', modelOf(openedRead, 1), 'Length of edge 3 = 60');
  await leaveSketch('03-left', opened);

  // 3. Accepted: Edge 2 = 40 (height 30 -> 40), then Finish.
  await reopenSketch('n0', '04'); const p04 = await probeEdge('04-accepted', 2, 40);
  assert.equal(p04.observation.alert, null, '04: a consistent edit shows no refusal'); assert.notDeepEqual(p04.observation.after.points, p04.observation.before.points, '04: the panel shape changed');
  const done04 = await finishSketch('04-finished'), doc04 = done04.doc, n0 = doc04.nodes[0];
  assert.deepEqual(n0.outline.lengths, { 0: 60, 1: 40 }, '04: outline lengths {0:60,1:40}'); assert.deepEqual(n0.points, RECT_60_40, '04: points'); assert.deepEqual(n0.outline.points, RECT_60_40, '04: outline points');
  assert.deepEqual(without(n0, 'points', 'outline'), without(opened.nodes[0], 'points', 'outline'), '04: non-geometry keys of n0 unchanged'); assert.deepEqual(doc04.nodes.map(n => n.id), ['n0', 'n1', 'n2']); assert.equal(doc04.nextId, 3); assert.deepEqual(doc04.nodes.slice(1), opened.nodes.slice(1), '04: other nodes unchanged');
  assert.equal(done04.bodies.bodies.length, 1); assert.ok(Math.abs(done04.bodies.bodies[0].volume - 24000) <= 1e-6, '04: volume 24000'); assert.deepEqual(await alerts(), []);
  const read04 = (await inspect('04-native', [{ node: 0, edge: 2, value: 45, kind: 'rect', expect: 'conflict' }], 24000)).read;

  // 4. Conflict again after the edit: Edge 3 = 45 against Edge 1 = 60.
  await reopenSketch('n0', '05'); const p05 = await probeEdge('05-conflict-after-edit', 3, 45); checkRefusal('05', p05.observation, 'conflict', modelOf(read04, 0), 'Length of edge 3 = 45');
  await leaveSketch('05-left', doc04);

  // 5. Non-rectilinear: the triangle's Edge 3 = 30 keeps the nonconvergence message.
  await reopenSketch('n2', '06'); const p06 = await probeEdge('06-nonconvergence', 3, 30); checkRefusal('06', p06.observation, 'nonconvergence', modelOf(openedRead, 2), 'Length of edge 3 = 30');
  await leaveSketch('06-left', doc04);

  // 6. Undo / Redo / Save.
  phase = 'Undo/Redo'; await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Meta+z'); await same(opened); await page.keyboard.press('Meta+Shift+z'); await same(doc04);
  const saved = await save('edited'); assert.deepEqual(saved.doc, doc04);

  // Context 2: fresh Open.
  const fresh = await freshOpen(saved.file, saved.doc, '07-fresh-open'); assert.ok(Math.abs(fresh.bodies.bodies[0].volume - 24000) <= 1e-6, '07: volume 24000');
  const freshRead = (await inspect('07-native', [{ node: 0, edge: 2, value: 50, kind: 'rect', expect: 'conflict' }], 24000)).read;
  await reopenSketch('n0', '08'); const p08 = await probeEdge('08-conflict-after-open', 3, 50); checkRefusal('08', p08.observation, 'conflict', modelOf(freshRead, 0), 'Length of edge 3 = 50');
  await leaveSketch('08-left', saved.doc);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
