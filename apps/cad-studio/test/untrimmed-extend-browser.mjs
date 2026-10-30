// D347 positive qualification of the existing untrimmed surface Extend in the Direct panel. Root must freeze all sources first.
// Run from apps/cad-studio:
// D347_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/untrimmed-extend-browser.mjs /absolute/artifacts
// Actual Studio UI (Open, outliner, Direct panel, Rename, Undo/Redo, Save) mutates. Readonly hooks observe only.
// One Chrome WebGPU process, sequential fresh contexts. Independent Python oracle (no product imports) checks the stored result.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent exact (Fraction) check of an Extend result against the analytic panel. Product imports: zero."""
import json, sys
from fractions import Fraction as F
from math import isqrt

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)

def sub(a, b): return [x - y for x, y in zip(a, b)]
def l1(a): return sum((abs(x) for x in a), F(0))
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def dot(a, b): return sum((x * y for x, y in zip(a, b)), F(0))

data = json.load(sys.stdin)
case = data['case']; objects = data['objects']
A = [F(7), F(-11), F(13)]; U = [F(3), F(4), F(0)]; V = [F(0), F(0), F(2)]; N = [F(4, 5), F(-3, 5), F(0)]
# T(s,t) = A + a0*V + s*su*U + t*tv*V ; degree after each case
CASES = {'original': (F(0), F(3), F(4), 1), 'u-max': (F(0), F(7, 2), F(4), 3), 'u-max-then-v-min': (F(-5, 4), F(7, 2), F(21, 4), 3)}
assert case in CASES, ('unknown case', case)
a0, su, tv, deg = CASES[case]
def T(s, t): return [A[k] + a0 * V[k] + s * su * U[k] + t * tv * V[k] for k in range(3)]
Ts = [su * x for x in U]; Tt = [tv * x for x in V]

# Hidden source preservation: the original object still holds the fixture exactly.
fixture = {'degreeU': 1, 'degreeV': 1, 'knotsU': [2, 2, 5, 5], 'knotsV': [-1, -1, 3, 3],
           'controlPoints': [[[7, -11, 13], [7, -11, 21]], [[16, 1, 13], [16, 1, 21]]], 'weights': [[1, 1], [1, 1]]}
originals = [o for o in objects if o['name'] == 'd347 · panel']
assert len(originals) == 1, 'exactly one original d347 · panel object'
og = originals[0]['geometry']
assert originals[0]['kind'] == 'surface' and not originals[0]['trims']
assert og['degreeU'] == 1 and og['degreeV'] == 1
assert [fr(x) for x in og['knotsU']] == [fr(x) for x in fixture['knotsU']] and [fr(x) for x in og['knotsV']] == [fr(x) for x in fixture['knotsV']]
assert [[[fr(c) for c in p] for p in row] for row in og['controlPoints']] == [[[fr(c) for c in p] for p in row] for row in fixture['controlPoints']], 'original poles'
assert [[fr(w) for w in row] for row in og['weights']] == [[fr(w) for w in row] for row in fixture['weights']], 'original weights'
if case == 'original': assert not originals[0]['hidden']
else: assert originals[0]['hidden'], 'original must be hidden after Extend'

visible = [o for o in objects if not o['hidden'] and o['kind'] == 'surface']
assert len(visible) == 1, ('exactly one visible surface', len(visible))
surface = visible[0]; g = surface['geometry']
assert not surface['trims'], 'no trims on the result'
du, dv = g['degreeU'], g['degreeV']
assert du == deg and dv == deg, ('degree', du, dv, deg)
ku = [fr(x) for x in g['knotsU']]; kv = [fr(x) for x in g['knotsV']]
P = [[[fr(c) for c in p] for p in row] for row in g['controlPoints']]
W = [[fr(w) for w in row] for row in g['weights']]
nu = len(P); nv = len(P[0]); assert all(len(row) == nv for row in P) and all(len(p) == 3 for row in P for p in row)
assert all(w == 1 for row in W for w in row) and len(W) == nu and all(len(row) == nv for row in W), 'weights exactly 1'
def clamped(k, n, d, name):
    assert len(k) == n + d + 1, (name, 'knot count', len(k), n, d)
    assert all(k[i] <= k[i + 1] for i in range(len(k) - 1)), (name, 'nondecreasing')
    assert len(set(k[:d + 1])) == 1 and len(set(k[-(d + 1):])) == 1, (name, 'clamped ends')
    assert k[0] < k[-1], (name, 'domain')
clamped(ku, nu, du, 'u'); clamped(kv, nv, dv, 'v')
def greville(k, i, d): return sum(k[i + 1:i + d + 1], F(0)) / d
u0, u1, v0, v1 = ku[0], ku[-1], kv[0], kv[-1]

position = F(0)
for i in range(nu):
    s = (greville(ku, i, du) - u0) / (u1 - u0)
    for j in range(nv):
        t = (greville(kv, j, dv) - v0) / (v1 - v0)
        position = max(position, l1(sub(P[i][j], T(s, t))))
assert position <= F(1, 10 ** 7), ('position', float(position))

es = F(0); et = F(0)
for i in range(nu - 1):
    d = ku[i + du + 1] - ku[i + 1]; assert d > 0
    for j in range(nv):
        q = [du * (P[i + 1][j][k] - P[i][j][k]) / d * (u1 - u0) for k in range(3)]
        es = max(es, l1(sub(q, Ts)))
for i in range(nu):
    for j in range(nv - 1):
        d = kv[j + dv + 1] - kv[j + 1]; assert d > 0
        q = [dv * (P[i][j + 1][k] - P[i][j][k]) / d * (v1 - v0) for k in range(3)]
        et = max(et, l1(sub(q, Tt)))
c = cross(Ts, Tt)
n2 = sum((x * x for x in c), F(0))
lower_norm = F(isqrt(int(n2 * 10 ** 40)), 10 ** 20)
jacobian = lower_norm - l1(Ts) * et - l1(Tt) * es - es * et
assert jacobian > 0, ('jacobian lower bound', float(jacobian))
orientation = dot(c, N)
assert orientation > 0, ('orientation', float(orientation))
print(json.dumps({'status': 'PASS', 'case': case, 'object': surface['id'], 'name': surface['name'], 'degree': [du, dv], 'poles': [nu, nv],
  'position': float(position), 'positionExact': str(position), 'derivS': float(es), 'derivT': float(et),
  'jacobianLower': float(jacobian), 'orientationDot': float(orientation), 'productImports': 0}, indent=2))
`;
assert.equal(process.env.D347_SOURCE_FROZEN, '1', 'Root must freeze all writers before D347 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
const fixtureFile = resolve(import.meta.dirname, 'fixtures/d347.barocad');
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'UNTRIMMED_SURFACE_EXTEND_POSITIVE', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], refusals: [], picks: [], selections: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One degree-1 planar panel; u-max then v-min extension at 2.5 mm reach. Other surfaces, edges and reaches are focused-test scope.', 'Python oracle is exact for stored binary64 data; it checks the affine reparameterisation of the plane, not a general surface theorem.', 'Hooks only observe; __studioDirectAt picks are rendering evidence for the extension strip, not an area measure.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
// Analytic panel A + (u-2)U + (v+1)V, with the stored extents of each case (see the oracle).
const A = [7, -11, 13], U = [3, 4, 0], V = [0, 0, 2];
const afterUMax = (s, t) => [0, 1, 2].map(k => A[k] + s * 3.5 * U[k] + 4 * t * V[k]);
const afterVMin = (s, t) => [0, 1, 2].map(k => A[k] - 1.25 * V[k] + s * 3.5 * U[k] + t * 5.25 * V[k]);
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {modelOf} from '../../packages/barocss-cad-model/src/engine/direct.ts';
import {evaluateSurface,surfaceDomain} from '../../packages/barocss-cad/src/index.ts';
const num=(a:any):any=>Array.isArray(a)||ArrayBuffer.isView(a)?Array.from(a as any,num):a;
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc),direct=doc.direct;assert.ok(direct&&Array.isArray(direct.objects));
const objects=direct.objects.map((object:any)=>{const text=direct.sources[object.source];assert.equal(typeof text,'string');
  const matches=modelOf(text).objects.filter((g:any)=>g.id===object.geometry);assert.equal(matches.length,1);const g:any=matches[0];
  const out:any={id:object.id,name:object.name,hidden:!!object.hidden,source:object.source,sourceSha256:createHash('sha256').update(text).digest('hex'),geometryId:object.geometry,trims:object.trims??null,kind:g.kind};
  if(g.kind==='surface'){out.geometry={degreeU:g.degreeU,degreeV:g.degreeV,knotsU:num(g.knotsU),knotsV:num(g.knotsV),controlPoints:num(g.controlPoints),weights:num(g.weights)};
    if(!out.hidden){const d:any=surfaceDomain(g);out.domain={u:num(d.u),v:num(d.v)};out.corners=[[d.u[0],d.v[0]],[d.u[1],d.v[0]],[d.u[0],d.v[1]],[d.u[1],d.v[1]]].map(([u,v])=>({u,v,point:num(evaluateSurface(g,u,v))}));}}
  else out.geometry={degree:g.degree,knots:num(g.knots),controlPoints:num(g.controlPoints),weights:num(g.weights)};
  return out;});
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify({objects}));`;
const doc = () => page.evaluate(() => window.__studioDoc);
const directPanel = () => page.getByRole('complementary', { name: 'Direct geometry', exact: true });
const byId = (state, id) => state.direct.objects.find(o => o.id === id);
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
async function same(expected) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), expected); }
async function changed(before) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) !== x, JSON.stringify(before), { timeout: 60000 }); await ready(); }
// __studioSelection does not expose the direct selection (DirectPanel/App keep it in directSel); the selected outliner rows are the readonly witness.
// Rows ".ol.direct" render in doc.direct.objects order (App.tsx outliner map).
const selectedIds = () => page.evaluate(() => [...document.querySelectorAll('.ol.direct')].map((row, i) => row.classList.contains('sel') ? window.__studioDoc.direct.objects[i]?.id : null).filter(Boolean));
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(), selection: window.__studioSelection ?? null,
    directRows: [...document.querySelectorAll('.ol.direct')].map(row => ({ text: row.textContent, className: row.className, title: row.title })),
    direct: document.querySelector('.direct-panel')?.textContent ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent) }), label);
  state.selectedDirectIds = await selectedIds();
  report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2)); await writeFile(join(output, `${label}.html`), await page.content()); await page.screenshot({ path: join(output, `${label}.png`), fullPage: true }); await persist(); return state;
}
async function newPage() {
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.stack ?? String(e))); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('download', d => report.downloads.push({ phase, suggestedFilename: d.suggestedFilename() })); page.on('dialog', d => d.accept());
  await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await ready();
}
async function freshOpen(file, expected, label) {
  phase = `fresh Open ${label}`; await newPage(); await page.setInputFiles('input[aria-label="Model file"]', file); await same(expected); await snapshot(label);
}
async function selectRow(id) {
  const state = await doc(), index = state.direct.objects.findIndex(o => o.id === id); assert.ok(index >= 0, `object ${id} exists`);
  assert.ok(!state.direct.objects[index].hidden, `Selection must not un-hide ${id}`);
  await page.locator('.ol.direct').nth(index).click(); await directPanel().waitFor();
  await page.waitForFunction(i => document.querySelectorAll('.ol.direct')[i]?.classList.contains('sel'), index); assert.deepEqual(await selectedIds(), [id]);
}
async function dismissNotice() { const toast = page.locator('.toast[role="alert"]'); if (await toast.count()) await toast.getByRole('button', { name: 'Dismiss', exact: true }).click(); await toast.waitFor({ state: 'hidden' }); }
async function setExtend(edge, by) {
  await directPanel().getByLabel('Extend edge', { exact: true }).selectOption(edge);
  await directPanel().getByLabel('Extend by', { exact: true }).fill(String(by));
}
const extendButton = () => directPanel().getByRole('button', { name: 'Extend the surface', exact: true });
// A refusal: error toast, document and selection untouched, no file. If the click instead changes the document, the product accepted what must be refused.
async function refuse(kind, label, expectedText) {
  phase = `refusal ${kind}`; await dismissNotice();
  const before = await doc(), selected = await selectedIds(), downloads = report.downloads.length;
  await extendButton().click();
  await page.waitForFunction(x => document.querySelector('.toast[role="alert"]') || JSON.stringify(window.__studioDoc) !== x, JSON.stringify(before), { timeout: 30000 });
  const toast = page.locator('.toast[role="alert"]');
  if (!(await toast.count())) throw new Error(`PRODUCT DEFECT D347: Extend with reach "${kind}" was accepted (document changed, no refusal toast). The admission must refuse it.`);
  const title = await toast.locator('.toast-title').textContent(), hint = await toast.locator('.toast-hint').textContent();
  assert.equal(title, 'The operation was refused'); if (expectedText) assert.match(hint, expectedText);
  await same(before); assert.deepEqual(await selectedIds(), selected, 'Refusal preserves selection'); assert.equal(report.downloads.length, downloads);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []);
  report.refusals.push({ kind, title, hint, documentUnchanged: true, selectionUnchanged: true, noDownload: true }); await snapshot(label);
}
async function pickAt(label, point, expected) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const raws = []; let hit = null;
  for (let attempt = 0; attempt < 24; attempt++) { hit = await page.evaluate(p => window.__studioDirectAt?.(p) ?? null, point); raws.push(hit); if (hit === expected) break; await page.waitForTimeout(250); }
  report.picks.push({ label, point, expected, raws, attempts: raws.length }); await persist(); assert.equal(hit, expected, `__studioDirectAt ${label} at ${JSON.stringify(point)}`);
}
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
async function inspect(label, caseName) {
  phase = `public native observation ${label}`; await ready(); const accepted = await doc(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout); assert.equal(result.objects.length, accepted.direct.objects.length);
  const input = { case: caseName, objects: result.objects }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'extend-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? ''); assert.equal(check.status, 0, check.stderr);
  const verified = JSON.parse(check.stdout); assert.equal(verified.status, 'PASS'); assert.equal(verified.case, caseName); report.oracles.push({ label, verified });
  assert.deepEqual(await doc(), accepted); report.reads.push({ label, ...result }); await persist(); return { ...result, verified };
}
const initialFiles = ['apps/cad-studio/test/untrimmed-extend-browser.mjs', 'apps/cad-studio/test/fixtures/d347.barocad', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/DirectPanel.tsx', 'apps/cad-studio/src/ui/DirectInspector.tsx',
  'packages/barocss-cad-model/src/engine/direct.ts', 'packages/barocss-cad-model/src/engine/curveSource.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'extend-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  report.fixture = { file: fixtureFile, hash: hash(await readFile(fixtureFile)) };
  const buildInputs = [], sourcefile = 'd347-inspector.ts', virtual = resolve(app, sourcefile);
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

  // Context 1: Open the .barocad fixture, refuse, extend, undo/redo, rename, save.
  phase = 'Open fixture'; await newPage(); await page.setInputFiles('input[aria-label="Model file"]', fixtureFile);
  await page.waitForFunction(() => window.__studioDoc?.direct?.objects?.length === 1, null, { timeout: 60000 }); await ready();
  const opened = await doc(), original = opened.direct.objects[0], originalSource = opened.direct.sources[original.source];
  assert.equal(opened.direct.objects.length, 1); assert.equal(original.name, 'd347 · panel'); assert.ok(!original.hidden); assert.ok(!original.trims?.length); assert.equal(typeof originalSource, 'string');
  await snapshot('01-opened'); await inspect('01-native', 'original');
  phase = 'select original'; await selectRow(original.id); await snapshot('01b-selected');

  await setExtend('u-max', 0); await refuse('nonpositive', '02-zero-refused', /positive/i);
  await setExtend('u-max', 0.000001); await refuse('tiny-reach', '03-tiny-refused');

  phase = 'actual Extend u-max 2.5'; await setExtend('u-max', 2.5); const before = await doc(); await extendButton().click(); await changed(before);
  const after = await doc(), originalAfter = byId(after, original.id), { hidden: originalHidden, ...originalRest } = originalAfter;
  assert.equal(originalHidden, true); assert.deepEqual(originalRest, byId(before, original.id)); assert.equal(after.direct.sources[original.source], originalSource, 'Original source text byte-identical');
  for (const [key, text] of Object.entries(before.direct.sources)) assert.equal(after.direct.sources[key], text, `source ${key} untouched`);
  assert.deepEqual(after.nodes, before.nodes);
  const added = after.direct.objects.filter(o => !before.direct.objects.some(old => old.id === o.id)); assert.equal(added.length, 1, 'exactly one new object'); const result = added[0];
  assert.equal(after.direct.objects.length, before.direct.objects.length + 1); assert.equal(result.name, 'd347 · panel · extended'); assert.notEqual(result.id, original.id); assert.notEqual(result.source, original.source); assert.ok(!(result.source in before.direct.sources)); assert.equal(result.geometry, 's1'); assert.ok(!result.trims?.length); assert.ok(!result.hidden);
  const selectedAfter = await selectedIds(); report.selections.push({ label: 'after-extend', selectedAfter, sourceNote: 'selected outliner rows (readonly)' }); assert.deepEqual(selectedAfter, [result.id]);
  await pickAt('extended-u-max inside original', afterUMax(0.5, 0.5), result.id); await pickAt('extended-u-max inside extension strip', afterUMax(0.97, 0.5), result.id);
  await snapshot('04-extended-u-max'); await inspect('04-native', 'u-max');
  phase = 'Undo/Redo Extend'; await page.keyboard.press('Meta+z'); await same(before); await page.keyboard.press('Meta+Shift+z'); await same(after);

  phase = 'actual Rename'; await selectRow(result.id); const beforeRename = await doc(), renamed = 'd347 extended panel';
  const nameField = directPanel().getByLabel('Object name', { exact: true }); await nameField.fill(renamed); await nameField.press('Enter'); await changed(beforeRename);
  const afterRename = await doc(); assert.deepEqual(afterRename.direct.sources, beforeRename.direct.sources); assert.deepEqual(byId(afterRename, result.id), { ...byId(beforeRename, result.id), name: renamed });
  assert.deepEqual(afterRename.direct.objects.filter(o => o.id !== result.id), beforeRename.direct.objects.filter(o => o.id !== result.id)); assert.deepEqual(afterRename.nodes, beforeRename.nodes); await snapshot('06-renamed');
  // Leave the text field first so Undo/Redo act on the document, not on the input's own text history.
  await page.evaluate(() => document.activeElement?.blur()); await same(afterRename);
  await page.keyboard.press('Meta+z'); await same(beforeRename); assert.equal(byId(await doc(), result.id).name, 'd347 · panel · extended');
  await page.keyboard.press('Meta+Shift+z'); await same(afterRename); assert.equal(byId(await doc(), result.id).name, renamed);
  const extendedSaved = await save('extended'); assert.deepEqual(extendedSaved.doc, afterRename);

  // Context 2: fresh Open of extended.bcad, then a second Extend (v-min).
  await freshOpen(extendedSaved.file, extendedSaved.doc, '08-fresh-open'); await inspect('08-fresh-native', 'u-max');
  await pickAt('fresh renamed result in extension strip', afterUMax(0.97, 0.5), result.id);
  phase = 'actual Extend v-min 2.5'; await selectRow(result.id); await setExtend('v-min', 2.5); const before2 = await doc(); await extendButton().click(); await changed(before2);
  const after2 = await doc(), added2 = after2.direct.objects.filter(o => !before2.direct.objects.some(old => old.id === o.id)); assert.equal(added2.length, 1); const twice = added2[0];
  assert.equal(twice.name, `${renamed} · extended`); assert.notEqual(twice.id, result.id); assert.equal(twice.geometry, 's1'); assert.ok(!twice.trims?.length); assert.ok(!twice.hidden); assert.ok(!(twice.source in before2.direct.sources));
  const { hidden: previousHidden, ...previousRest } = byId(after2, result.id); assert.equal(previousHidden, true); assert.deepEqual(previousRest, byId(before2, result.id));
  for (const [key, text] of Object.entries(before2.direct.sources)) assert.equal(after2.direct.sources[key], text, `source ${key} untouched`);
  assert.deepEqual(after2.direct.objects.filter(o => o.id !== result.id && o.id !== twice.id), before2.direct.objects.filter(o => o.id !== result.id)); assert.deepEqual(after2.nodes, before2.nodes);
  assert.deepEqual(await selectedIds(), [twice.id]); await snapshot('09-extended-v-min'); await inspect('09-native', 'u-max-then-v-min');
  phase = 'Undo/Redo second Extend'; await page.keyboard.press('Meta+z'); await same(before2); await page.keyboard.press('Meta+Shift+z'); await same(after2);
  const twiceSaved = await save('twice'); assert.deepEqual(twiceSaved.doc, after2);

  // Context 3: fresh Open of twice.bcad.
  await freshOpen(twiceSaved.file, twiceSaved.doc, '10-final'); await inspect('10-final-native', 'u-max-then-v-min');
  await pickAt('final v-min strip', afterVMin(0.5, 0.1), twice.id); await pickAt('final u-max strip', afterVMin(0.97, 0.5), twice.id);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
