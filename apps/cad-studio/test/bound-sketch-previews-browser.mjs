// D357 qualification: free (not yet used) sketches whose sizes are bound to document parameters (`max: [{parameter:'W'}, 40]`) are drawn with finite outlines in the model view, and the Extrude and Loft commands on them
// preview and apply with finite positions and geometry; a Loft of two bound sketches writes no null/NaN into the document and evaluates. Before the fix profiles.ts read bound sizes as NaN (profileMiddle [null,20], rings with NaN, loft sections with null starts).
// Root must freeze all sources first. Run from apps/cad-studio:
// D357_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/bound-sketch-previews-browser.mjs /absolute/artifacts
// Actual Studio UI (Open, Browser Sketch rows, Extrude key, palette Loft, HUD fields and Apply, Undo, Parameters panel, Save) mutates. Readonly hooks (window.__studioDoc/__studioBodies/__studioSelection, the SVG overlay DOM) observe only.
// One Chrome WebGPU process, two sequential fresh contexts. Independent Python oracle (no product imports): null/NaN scan of the saved document, exact Fraction volumes of the extrude (area x height) and of the ruled two-section loft (prismatoid h/6 (A0 + 4 Am + A1)).
// Expected at a base without the D357 fix: the driver FAILS at the first claim, 01 opened (the overlay polygons of the free sketches carry NaN points); the failure state is snapshotted before asserting.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent exact check of D357 documents: a null/NaN scan of the whole document, then (by mode) the two untouched bound sketches, the extruded rectangle, or the ruled loft of two rectangles. Product imports: zero."""
import json, math, sys
from fractions import Fraction as F

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; exp = data['expect']; mode = exp['mode']
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
assert list(params.keys()) == ['W'], ('parameters', params)
def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    # (A parameter value already resolved to a Fraction passes through.)
    assert isinstance(x, (int, float, F)), ('not a plain number', x)
    return F(x)
def resolve(x, W=None):
    """A stored coordinate: a plain finite number, or {'parameter': 'W'} resolved through the document parameters (or the given W)."""
    if isinstance(x, dict):
        assert list(x.keys()) == ['parameter'] and x['parameter'] == 'W', ('binding shape', x)
        return fr(params['W'] if W is None else W)
    return fr(x)
def bound(x):
    return isinstance(x, dict) and x == {'parameter': 'W'}
nodes = doc['nodes']; ids = [n['id'] for n in nodes]
def rect(n, W):
    assert n['kind'] == 'sketch' and n['profile'] == 'rectangle' and not n.get('holes') and not n.get('regions'), ('rectangle sketch', n)
    lo = [resolve(c, W) for c in n['min']]; hi = [resolve(c, W) for c in n['max']]
    return lo, hi
def zof(n):
    return fr(n['plane']['origin'][2]) if n.get('plane') else F(0)
def area(pts):
    s = F(0)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        s += a[0] * b[1] - b[0] * a[1]
    return abs(s) / 2
W0 = fr(exp['W']); out = {'status': 'PASS', 'mode': mode, 'parameter': str(fr(params['W'])), 'nullScan': 'clean', 'productImports': 0}
# The two original sketches stay as authored (bound), in every mode.
n0, n1 = nodes[0], nodes[1]
assert ids[:2] == ['n0', 'n1'] and n0['kind'] == 'sketch' and n1['kind'] == 'sketch', ('the first two nodes are the bound sketches', ids)
assert n0['max'] == [{'parameter': 'W'}, 40] and n0['min'] == [0, 0], ('n0 keeps its binding', n0)
assert n1['max'] == [{'parameter': 'W'}, 30] and n1['min'] == [10, 10] and n1['plane']['origin'] == [0, 0, 30], ('n1 keeps its binding', n1)
if mode == 'open':
    assert len(nodes) == 2 and doc['nextId'] == 2 and doc['outputs'] == {}, 'no features'
    out['bodies'] = 0
elif mode == 'extrude':
    assert ids == ['n0', 'n1', 'n2'] and [n['kind'] for n in nodes] == ['sketch', 'sketch', 'extrude'] and doc['nextId'] == 3, ('nodes', ids)
    ex = nodes[2]; assert ex['sketch'] == 0 and fr(ex['height']) == 10 and not ex.get('draft') and list(doc['outputs'].values()) == [{'node': 2, 'side': 'solid'}], ('extrude', ex, doc['outputs'])
    lo, hi = rect(n0, None); w = hi[0] - lo[0]; d = hi[1] - lo[1]
    assert lo == [0, 0] and w == fr(params['W']) and d == 40, ('rectangle', [str(c) for c in lo + hi])
    volume = float(w * d * fr(ex['height']))
    assert abs(volume - reported) <= 1e-6, ('volume', volume, reported)
    out.update({'width': str(w), 'depth': str(d), 'height': str(fr(ex['height'])), 'analyticVolume': volume, 'reportedVolume': reported, 'delta': abs(volume - reported)})
elif mode == 'loft':
    assert ids == ['n0', 'n1', 'n2', 'n3', 'n4'] and [n['kind'] for n in nodes] == ['sketch', 'sketch', 'sketch', 'sketch', 'loft'] and doc['nextId'] == 5, ('nodes', ids)
    loft = nodes[4]; assert loft['from'] == [0, 1] and not loft.get('smooth') and not loft.get('guide') and len(loft['sections']) == 2, ('ruled two-section loft', loft)
    assert sorted(s['sketch'] for s in loft['sections']) == [2, 3], ('sections use the two section copies', loft['sections'])
    zs = [fr(s['z']) for s in loft['sections']]; assert zs == [0, 30], ('section heights', [str(z) for z in zs])
    def corners(idx):
        n = nodes[idx]; assert n['kind'] == 'sketch' and n['profile'] == 'loop' and not n.get('holes') and not n.get('regions'), ('section copy', n)
        segs = n['segments']; assert len(segs) == 4 and all(s['kind'] == 'line' for s in segs), ('four line segments', segs)
        return [[resolve(c) for c in s['start']] for s in segs]
    A = corners(loft['sections'][0]['sketch']); B = corners(loft['sections'][1]['sketch'])
    def box(pts):
        xs = sorted({p[0] for p in pts}); ys = sorted({p[1] for p in pts}); assert len(xs) == 2 and len(ys) == 2, ('axis-aligned', [[str(c) for c in p] for p in pts]); return xs, ys
    xa, ya = box(A); xb, yb = box(B)
    if exp['originals'] == 'snapshot':
        loA, hiA = rect(n0, W0); loB, hiB = rect(n1, W0)
        assert (xa, ya) == ([loA[0], hiA[0]], [loA[1], hiA[1]]), ('section A is sketch n0 with W', str(W0), [[str(c) for c in p] for p in A])
        assert (xb, yb) == ([loB[0], hiB[0]], [loB[1], hiB[1]]), ('section B is sketch n1 with W', str(W0), [[str(c) for c in p] for p in B])
    for a, b in zip(A, B):
        assert (a[0] == xa[0]) == (b[0] == xb[0]) and (a[1] == ya[0]) == (b[1] == yb[0]), ('straight correspondence of the section corners', [str(c) for c in a], [str(c) for c in b])
    mid = [[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] for a, b in zip(A, B)]
    h = zs[1] - zs[0]; A0, A1, Am = area(A), area(B), area(mid)
    volume = float(h / 6 * (A0 + 4 * Am + A1)); tol = max(float(exp['tol']), 1e-6)
    assert volume > 0 and abs(volume - reported) <= tol * volume, ('ruled loft volume', volume, reported)
    out.update({'sectionAreas': [str(A0), str(Am), str(A1)], 'height': str(h), 'analyticVolume': volume, 'reportedVolume': reported, 'delta': abs(volume - reported), 'relativeTolerance': tol})
else:
    raise AssertionError(('unknown mode', mode))
print(json.dumps(out, indent=2))
`;
assert.equal(process.env.D357_SOURCE_FROZEN, '1', 'Root must freeze all writers before D357 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
const fixtureFile = resolve(import.meta.dirname, 'fixtures/d357.bcad');
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'BOUND_FREE_SKETCHES_DRAW_PREVIEW_AND_APPLY_FINITE', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['Two free rectangle sketches bound to parameter W (n0 on XY, n1 on the plane z = 30); Extrude on n0 (Distance 10), then Undo, then a ruled two-section Loft of both; then the parameter W is changed and the file is saved and reopened.',
    'Overlay finiteness is read from the SVG polygons/paths and gizmo-handle elements the viewport renders (screen pixels); NaN/Infinity/null text or an unparsable number fails. No model-space hook exists for the rings.',
    'The Python oracle checks the document scan, area x height and the ruled-loft prismatoid volume of the stored section copies, not kernel topology. The Loft volume check assumes two sections give a ruled loft (default Ruled, no guide).',
    'Product reads (the bundled inspector, evaluateDoc and the facade mass) are product code, not an independent oracle. Hashes are source provenance, not geometry oracles. Revolve is not driven (Extrude and Loft only).'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const BOUND = { parameter: 'W' };
// Reads (readonly): the evaluated bodies and their mass, and a null/non-finite scan of the whole document (JSON form: NaN becomes null).
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error?.detail??(view as any).error?.title??(view as any).error??'evaluation failed')};
if(view.ok){out.bodyCount=view.bodies.length;out.evalVolumes=view.bodies.map((b:any)=>b.volume);out.massVolumes=view.bodies.map((b:any)=>part('D357 observed',doc).body(b.key).mass({density:1}).volume);}
const nulls:string[]=[];const walk=(v:any,p:string)=>{if(v===null||(typeof v==='number'&&!Number.isFinite(v)))nulls.push(p);else if(Array.isArray(v))v.forEach((x,i)=>walk(x,p+'['+i+']'));else if(v&&typeof v==='object')for(const k of Object.keys(v))walk(v[k],p+'.'+k);};walk(doc,'doc');
out.nulls=nulls;out.nodeKinds=doc.nodes.map((n:any)=>n.kind);out.parameters=doc.parameters??null;
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;
// (JSON form: a key holding undefined, e.g. configurations after a parameter edit, is absent from a saved file.)
const doc = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__studioDoc)));
const editor = () => page.locator('.node-editor');
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
async function same(expected) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), JSON.parse(JSON.stringify(expected))); }
const bodies = () => page.evaluate(() => window.__studioBodies());
const alerts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent));
const blur = () => page.evaluate(() => document.activeElement?.blur());
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: JSON.parse(JSON.stringify(window.__studioDoc)), bodies: window.__studioBodies?.(), selection: window.__studioSelection ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent),
    editor: document.querySelector('.node-editor')?.textContent ?? null, parametersPanel: document.querySelector('aside[aria-label="Parameters panel"]')?.textContent ?? null, hud: document.querySelector('.hud')?.textContent ?? null }), label);
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
// What the viewport draws, read from its SVG overlay (Viewport.tsx ~1628 `g.profile[data-profile]` with `polygon.profile-line` and, when picked, `path.profile-fill`; GizmoMarks.tsx `g.gizmo-handle[data-handle]`). All screen pixels.
const readRings = () => page.evaluate(() => [...document.querySelectorAll('g.profile')].map(g => ({ id: Number(g.getAttribute('data-profile')), picked: g.classList.contains('picked'), polygons: [...g.querySelectorAll('polygon.profile-line')].map(p => p.getAttribute('points')), fill: g.querySelector('path.profile-fill')?.getAttribute('d') ?? null })));
const readHandles = () => page.evaluate(() => [...document.querySelectorAll('g.gizmo-handle')].map(g => ({ id: g.getAttribute('data-handle'), attrs: [...g.querySelectorAll('*')].flatMap(e => ['cx', 'cy', 'x', 'y', 'points', 'd'].map(a => ({ tag: e.tagName, attr: a, value: e.getAttribute(a) })).filter(t => t.value !== null)) })));
const BADTEXT = /NaN|Infinity|null|undefined/i;
const numbersIn = text => String(text ?? '').split(/[\sMLZ,]+/).filter(Boolean);
const finiteText = text => !BADTEXT.test(String(text ?? '')) && numbersIn(text).length > 0 && numbersIn(text).every(token => Number.isFinite(Number(token)));
const pairs = text => { const n = numbersIn(text).map(Number); const out = []; for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]); return out; };
function checkRings(label, rings, ids, pickedIds) {
  assert.deepEqual(rings.map(r => r.id), ids, `${label}: the free sketches drawn`);
  for (const r of rings) {
    assert.equal(r.polygons.length, 1, `${label}: sketch ${r.id} has one outline`);
    for (const points of r.polygons) {
      assert.ok(finiteText(points), `${label}: sketch ${r.id} outline points are finite: ${points}`); const p = pairs(points); assert.equal(p.length, 4, `${label}: a rectangle outline has four corners: ${points}`);
      const xs = p.map(q => q[0]), ys = p.map(q => q[1]); assert.ok(Math.max(...xs) - Math.min(...xs) > 1 && Math.max(...ys) - Math.min(...ys) > 1, `${label}: sketch ${r.id} outline has a real size on screen: ${points}`);
    }
    assert.equal(r.picked, pickedIds.includes(r.id), `${label}: sketch ${r.id} picked state`);
    if (r.picked) assert.ok(r.fill !== null && finiteText(r.fill), `${label}: sketch ${r.id} fill path is finite: ${r.fill}`); else assert.equal(r.fill, null);
  }
}
function checkHandles(label, handles) {
  assert.ok(handles.length >= 1, `${label}: the command shows at least one handle`);
  for (const h of handles) { assert.ok(h.attrs.length > 0, `${label}: handle ${h.id} has geometry`); for (const a of h.attrs) assert.ok(finiteText(a.value), `${label}: handle ${h.id} ${a.tag}.${a.attr} is finite: ${a.value}`); }
}
// The Browser's Sketch rows (App.tsx ~1829 `.outliner button.ol` "Sketch {k+1}", Shift adds) pick free sketches; the selection hook confirms.
async function pickSketches(indices) {
  for (const [k, i] of indices.entries()) await page.locator('.outliner button.ol', { hasText: new RegExp(`^Sketch ${i + 1}$`) }).click({ modifiers: k ? ['Shift'] : [] });
  await page.waitForFunction(want => JSON.stringify(window.__studioSelection?.selection?.sketches) === JSON.stringify(want), indices, { timeout: 10000 }); await blur();
}
const field = label => page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input, select');
const hudStatus = () => page.evaluate(() => document.querySelector('.hud .status')?.textContent ?? null);
async function hudReady() { await page.waitForTimeout(250); await page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 20000 }); }
async function hudPreview() { await page.waitForTimeout(400); await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 20000 }).catch(() => undefined); }
async function applyHud() { await page.locator('.hud button', { hasText: 'Apply' }).click(); await page.locator('.hud').waitFor({ state: 'hidden', timeout: 30000 }); await ready(); }
async function closeEditor() { if (await editor().isVisible()) { await editor().getByRole('button', { name: 'Close editor', exact: true }).click(); await editor().waitFor({ state: 'hidden' }); } }
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
// The Parameters panel (App.tsx top bar button [aria-label="Parameters"], ParametersPanel.tsx value field `Value of W`; Enter blurs and submits). It is hidden while a feature editor is active, so the editor is closed first.
async function setParameter(name, value, label) {
  phase = `set parameter ${name} ${label}`; await ready(); await closeEditor();
  const before = await doc(); await page.click('[aria-label="Parameters"]'); const panel = page.locator('aside[aria-label="Parameters panel"]'); await panel.waitFor();
  const input = panel.getByLabel(`Value of ${name}`, { exact: true }); await input.waitFor(); assert.equal(Number(await input.inputValue()), before.parameters[name], `${label}: the panel shows the current ${name}`);
  await input.fill(String(value)); await input.press('Enter');
  await page.waitForFunction(([n, v]) => window.__studioDoc?.parameters?.[n] === v, [name, value], { timeout: 60000 }); await ready();
  await page.click('[aria-label="Close parameters"]'); await panel.waitFor({ state: 'hidden' });
  return snapshot(label);
}
// Product read (bundled inspector, product code) plus the independent Python oracle on the same document and the Studio-reported volume. Everything is written before the first assertion.
// expect: { mode: 'open'|'extrude'|'loft', W, originals: 'snapshot'|'skip', tol, bodies, volume: number|null (exact analytic volume the Studio must show, else only finite and positive) }
async function inspect(label, expect) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), studio = await bodies(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const volume = studio.bodies[0]?.volume ?? null; const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? '');
  const read = run.status === 0 ? JSON.parse(run.stdout) : null; report.reads.push({ label, studioVolume: volume, ...read });
  const input = { doc: accepted, volume, expect }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'bound-sketch-previews-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stderr: check.stderr, verified: check.stdout ? JSON.parse(check.stdout) : null }); await persist();
  assert.equal(run.status, 0, run.stderr); assert.equal(studio.bodies.length, expect.bodies, `${label}: body count`); assert.equal(read.ok, true, `${label}: product evaluation ok (${read.error})`); assert.equal(read.bodyCount, expect.bodies); assert.deepEqual(read.nulls, [], `${label}: no null/NaN anywhere in the document`);
  if (expect.bodies) {
    assert.ok(Number.isFinite(volume) && volume > 0, `${label}: Studio volume finite and positive: ${volume}`);
    assert.ok(read.evalVolumes.every((v, i) => Math.abs(v - studio.bodies[i].volume) <= 1e-6) && read.massVolumes.every((v, i) => Math.abs(v - studio.bodies[i].volume) <= 1e-6), `${label}: product volumes ${read.evalVolumes}/${read.massVolumes} vs Studio ${studio.bodies.map(b => b.volume)}`);
    if (expect.volume !== null) assert.ok(Math.abs(volume - expect.volume) <= 1e-6, `${label}: Studio volume ${volume} vs ${expect.volume}`);
  }
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); assert.equal(JSON.parse(check.stdout).status, 'PASS'); assert.deepEqual(await doc(), accepted); return { read, verified: JSON.parse(check.stdout) };
}
const initialFiles = ['apps/cad-studio/test/bound-sketch-previews-browser.mjs', 'apps/cad-studio/test/fixtures/d357.bcad', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/viewport/GizmoMarks.tsx', 'apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/src/ui/ParametersPanel.tsx',
  'packages/barocss-cad-model/src/app/profiles.ts', 'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad-model/src/app/editCommand.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/engine/parameters.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'bound-sketch-previews-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  report.fixture = { file: fixtureFile, hash: hash(await readFile(fixtureFile)) }; const fixtureDoc = JSON.parse(await readFile(fixtureFile, 'utf8'));
  const buildInputs = [], sourcefile = 'd357-inspector.ts', virtual = resolve(app, sourcefile);
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

  // Context 1: Open, Extrude on one bound sketch, Undo, Loft of both, change W, Save.
  phase = 'Open fixture'; await newPage(); await openFile(fixtureFile, 2);
  const opened = await doc(); report.openedEqualsFixtureBytes = JSON.stringify(opened) === JSON.stringify(fixtureDoc); report.openedEqualsFixtureSemantically = (() => { try { assert.deepEqual(opened, fixtureDoc); return true; } catch { return false; } })(); await persist();
  assert.deepEqual(opened.nodes.map(n => n.id), ['n0', 'n1']); assert.equal(opened.nextId, 2); assert.deepEqual(opened.parameters, { W: 60 }); assert.deepEqual(opened.outputs, {}); assert.deepEqual(opened.nodes[0].max, [BOUND, 40]); assert.deepEqual(opened.nodes[1].max, [BOUND, 30]); assert.equal((await bodies()).bodies.length, 0);
  // 0. The free bound sketches are drawn with finite outlines (THE first claim).
  await page.waitForFunction(() => document.querySelectorAll('g.profile polygon.profile-line').length === 2, null, { timeout: 20000 });
  const ringsOpened = await readRings(); report.observations.push({ label: '01-opened-rings', rings: ringsOpened }); await persist(); await snapshot('01-opened'); await inspect('01-native', { mode: 'open', W: 60, originals: 'skip', tol: 0, bodies: 0, volume: null });
  checkRings('01', ringsOpened, [0, 1], []);

  // 1. Extrude on sketch n0: HUD preview (not refused), finite handles, Apply gives the 60 x 40 x 10 body.
  phase = 'Extrude n0'; await pickSketches([0]); const ringsPicked0 = await readRings(); report.observations.push({ label: '02-picked-n0-rings', rings: ringsPicked0 }); await persist();
  checkRings('02 picked', ringsPicked0, [0, 1], [0]);
  await page.keyboard.press('e'); await hudReady(); await field('Distance').fill('10'); await hudPreview();
  const handlesExtrude = await readHandles(), statusExtrude = await hudStatus(), hudExtrude = await page.locator('.hud').innerText(); report.observations.push({ label: '02-extrude-hud', status: statusExtrude, hud: hudExtrude, handles: handlesExtrude }); await persist(); await snapshot('02-extrude-hud');
  assert.equal(statusExtrude, 'preview', `02: the Extrude HUD previews, not refused: ${hudExtrude}`); assert.ok(!BADTEXT.test(hudExtrude), `02: HUD text has no NaN/null: ${hudExtrude}`); assert.equal(await field('Distance').inputValue(), '10'); checkHandles('02', handlesExtrude);
  await applyHud(); const extruded = await snapshot('03-extruded'), toastsExtrude = await alerts(), docExtrude = extruded.doc;
  report.observations.push({ label: '03-extruded', nodes: docExtrude.nodes, toasts: toastsExtrude, volumes: extruded.bodies.bodies.map(b => b.volume) }); await persist();
  await inspect('03-native', { mode: 'extrude', W: 60, originals: 'skip', tol: 0, bodies: 1, volume: 60 * 40 * 10 });
  assert.deepEqual(docExtrude.nodes.slice(0, 2), opened.nodes, '03: the two sketches stay as authored (bound)'); assert.equal(docExtrude.nodes[2].kind, 'extrude'); assert.equal(docExtrude.nodes[2].height, 10); assert.deepEqual(toastsExtrude, [], '03: no toast'); assert.deepEqual(docExtrude.parameters, { W: 60 });
  assert.equal(extruded.bodies.bodies.length, 1); assert.ok(Math.abs(extruded.bodies.bodies[0].volume - 24000) <= 1e-6, `03: volume ${extruded.bodies.bodies[0].volume} vs 24000`);

  // 2. Undo, then Loft through both bound sketches (Shift-pick, palette): preview, Apply, no null/NaN, one body.
  phase = 'Undo extrude'; await closeEditor(); await blur(); await page.keyboard.press('Meta+z'); await same(opened); await closeEditor(); await snapshot('03b-undone');
  phase = 'Loft n0 n1'; await page.waitForFunction(() => document.querySelectorAll('g.profile polygon.profile-line').length === 2, null, { timeout: 20000 }); await pickSketches([0, 1]);
  const ringsPicked01 = await readRings(); report.observations.push({ label: '04-picked-both-rings', rings: ringsPicked01 }); await persist(); checkRings('04 picked', ringsPicked01, [0, 1], [0, 1]);
  await page.keyboard.press(' '); await page.locator('.palette input').fill('loft'); await page.keyboard.press('Enter'); await hudReady(); await hudPreview();
  const handlesLoft = await readHandles(), statusLoft = await hudStatus(), hudLoft = await page.locator('.hud').innerText(); report.observations.push({ label: '04-loft-hud', status: statusLoft, hud: hudLoft, handles: handlesLoft }); await persist(); await snapshot('04-loft-hud');
  assert.equal(statusLoft, 'preview', `04: the Loft HUD previews, not refused: ${hudLoft}`); assert.ok(!BADTEXT.test(hudLoft), `04: HUD text has no NaN/null: ${hudLoft}`); assert.ok(hudLoft.includes('Sizes\nCopied at W = 60: later parameter changes do not update this loft.'), `04: the Loft steps name the copied parameter: ${hudLoft}`); for (const h of handlesLoft) for (const a of h.attrs) assert.ok(finiteText(a.value), `04: handle ${h.id} ${a.tag}.${a.attr} is finite: ${a.value}`);
  await applyHud(); await page.waitForFunction(() => window.__studioDoc?.nodes?.length === 5, null, { timeout: 30000 }); await ready();
  const lofted = await snapshot('05-lofted'), toastsLoft = await alerts(), docLoft = lofted.doc;
  report.observations.push({ label: '05-lofted', nodes: docLoft.nodes, outputs: docLoft.outputs, toasts: toastsLoft, volumes: lofted.bodies.bodies.map(b => b.volume) }); await persist();
  // Ruled two-section loft of the 60 x 40 rectangle at z 0 and the 50 x 20 rectangle at z 30: V = h/6 (A0 + 4 Am + A1) = 30/6 (2400 + 4 x 1650 + 1000) = 50000 (Am is the 55 x 30 middle section). The oracle recomputes it from the stored section copies.
  await inspect('05-native', { mode: 'loft', W: 60, originals: 'snapshot', tol: 1e-4, bodies: 1, volume: null });
  assert.deepEqual(docLoft.nodes.slice(0, 2), opened.nodes, '05: the two picked sketches stay as authored (bound)'); assert.deepEqual(docLoft.nodes.map(n => n.kind), ['sketch', 'sketch', 'sketch', 'sketch', 'loft']); assert.deepEqual(toastsLoft, [], '05: no toast'); assert.deepEqual(docLoft.parameters, { W: 60 });
  assert.equal(lofted.bodies.bodies.length, 1); assert.ok(Math.abs(lofted.bodies.bodies[0].volume - 50000) <= 5, `05: Studio loft volume ${lofted.bodies.bodies[0].volume} vs the ruled loft 50000`);

  // 3. Change W to 70: record whether the loft follows (its section copies are numbers, so it may not); assert only no errors and no null/NaN.
  const param70 = await setParameter('W', 70, '06-param-70'), doc70 = param70.doc, toasts70 = await alerts();
  report.observations.push({ label: '06-param-70', loftFollows: JSON.stringify(doc70.nodes[4]) !== JSON.stringify(docLoft.nodes[4]) || param70.bodies.bodies[0]?.volume !== lofted.bodies.bodies[0].volume, nodes: doc70.nodes, toasts: toasts70, volumes: param70.bodies.bodies.map(b => b.volume), loftVolumeBefore: lofted.bodies.bodies[0].volume }); await persist();
  await inspect('06-native', { mode: 'loft', W: 60, originals: 'skip', tol: 1e-4, bodies: 1, volume: null });
  assert.deepEqual(doc70.parameters, { W: 70 }, '06: W is 70'); assert.deepEqual(toasts70, [], '06: no toast'); assert.equal(param70.bodies.bodies.length, 1);
  const saved = await save('loft'); assert.deepEqual(saved.doc, doc70);

  // Context 2: fresh Open of loft.bcad.
  const fresh = await freshOpen(saved.file, saved.doc, '07-fresh-open'); await inspect('07-native', { mode: 'loft', W: 60, originals: 'skip', tol: 1e-4, bodies: 1, volume: null });
  assert.equal(fresh.bodies.bodies.length, 1); assert.ok(Math.abs(fresh.bodies.bodies[0].volume - param70.bodies.bodies[0].volume) <= 1e-6, `07: volume ${fresh.bodies.bodies[0].volume} vs saved ${param70.bodies.bodies[0].volume}`);
  assert.deepEqual(await alerts(), [], '07: no toast');

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
