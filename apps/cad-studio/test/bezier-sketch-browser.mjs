// D354 qualification: Bezier control-point authoring in the sketcher (GitHub #2051 section 2). The Bezier tool (button "Bézier", key B) collects control points: the third click makes a quadratic, the fourth a cubic and ends it.
// The viewport draws the dashed control polygon (polyline.sk-guide), the solid curve (polyline.sk-shape with 33 sampled points) and the control points as dots (circle.sk-point while drawn, circle.sk-end once kept in the done list).
// The BÉZIER panel section lists "Control point N X/Y" inputs (Enter or blur applies). Finish keeps a Bezier in the sketch node's construction array (stored { kind: 'bezier', poles }, no construction: true); reopening restores it.
// "Make curves" (sketch panel button) turns every shape, Beziers included, into exact direct curves named "Sketch curve N · cK": degree = poles - 1, clamped knots, unit weights. Undo / Redo of that step are recorded.
// Root must freeze all sources first. Run from apps/cad-studio:
//   D354_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/bezier-sketch-browser.mjs /absolute/artifacts
// Actual Studio UI (New part, palette Sketch, Sketch plane select, Rectangle and Bézier toolbar buttons with canvas clicks via window.__studioScreenOf, Control point inputs, Finish, Save, Open, history Sketch button + Edit sketch,
// Make curves, Undo / Redo buttons) mutates. Readonly hooks (window.__studioDoc / __studioBodies / __studioSelection / __studioScreenOf) observe only. The document starts EMPTY.
// Product read: a bundled inspector reads every direct source through the product's reader (direct.ts geometryOf / modelOf) and evaluates the curves with the kernel's evaluateCurve / evaluateCurveD1 (@barocss/cad). It is product code,
// not an oracle. The Python oracle (python3 -I, Fractions, zero product imports) decides the exact poles, clamped knots, unit weights, B(1/2) = (10, 45, 0), the end tangents and the Bernstein values; the product evaluation must match within 1e-12.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent exact check of the direct curves made from two Bezier curves: poles, degree, clamped knots, unit weights, Bernstein values, end tangents, product evaluation. Product imports: zero."""
import json, sys
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)
def v3(p): return tuple(fr(c) for c in p)
def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def mul(a, s): return tuple(x * s for x in a)

data = json.load(sys.stdin)
curves = data['curves']
def bernstein(poles, t):
    n = len(poles) - 1; from math import comb
    acc = (F(0), F(0), F(0))
    for i, p in enumerate(poles): acc = add(acc, mul(p, comb(n, i) * t ** i * (1 - t) ** (n - i)))
    return acc
def find(degree, poles):
    hits = [c for c in curves if c['degree'] == degree and [v3(p) for p in c['controlPoints']] == poles]
    assert len(hits) == 1, ('curves of degree ' + str(degree) + ' with these exact poles', len(hits), [c['name'] for c in curves])
    return hits[0]
out = {'status': 'PASS', 'productImports': 0, 'curveCount': len(curves), 'names': [c['name'] for c in curves], 'checks': {}}
worst_point = 0.0; worst_tangent = 0.0
def clamped(c):
    d = c['degree']; want = [F(0)] * (d + 1) + [F(1)] * (d + 1)
    assert [fr(k) for k in c['knots']] == want, ('clamped knots', c['knots'])
    assert [fr(w) for w in c['weights']] == [F(1)] * (d + 1), ('unit weights', c['weights'])
def product_at(c, t):
    hit = [e for e in c['evals'] if fr(e['t']) == t]; assert len(hit) == 1, ('product evaluation at', t); return hit[0]['point']
def compare(c, poles, t):
    global worst_point
    exact = bernstein(poles, t); got = product_at(c, t)
    for a, b in zip(exact, got):
        d = abs(float(a) - float(b)); worst_point = max(worst_point, d)
        assert d <= 1e-12, ('product point differs from Bernstein', c['name'], str(t), float(a), float(b), d)
    return [float(a) for a in exact]
quad = [v3(p) for p in data['quad']]; cub = [v3(p) for p in data['cubic']]
q = find(2, quad); clamped(q)
half = F(1, 2); exact_half = bernstein(quad, half)
assert exact_half == (F(10), F(45), F(0)), ('B(1/2) of the quadratic', exact_half)
t0 = mul(sub(quad[1], quad[0]), 2); t1 = mul(sub(quad[2], quad[1]), 2)
assert t0 == (F(20), F(20), F(0)) and t1 == (F(20), F(-20), F(0)), ('end tangents', t0, t1)
out['checks']['quadratic'] = {'name': q['name'], 'halfExact': [float(c) for c in exact_half], 'startTangent': [float(c) for c in t0], 'endTangent': [float(c) for c in t1], 'half': compare(q, quad, half)}
compare(q, quad, F(0)); compare(q, quad, F(1))
for key, want, t in (('start', t0, F(0)), ('end', t1, F(1))):
    got = q['d1'].get(key); assert got is not None, ('product derivative at ' + key)
    for a, b in zip(want, got):
        d = abs(float(a) - float(b)); worst_tangent = max(worst_tangent, d); assert d <= 1e-9, ('product derivative at ' + key, float(a), float(b), d)
c3 = find(3, cub); clamped(c3)
out['checks']['cubic'] = {'name': c3['name'], 'values': {}}
for t in (F(1, 4), F(1, 2), F(3, 4)): out['checks']['cubic']['values'][str(t)] = compare(c3, cub, t)
compare(c3, cub, F(0)); compare(c3, cub, F(1))
assert q['name'] != c3['name'], 'two distinct curves'
out['worstProductPointDifference'] = worst_point; out['worstProductTangentDifference'] = worst_tangent
print(json.dumps(out, indent=2))
`;
assert.equal(process.env.D354_SOURCE_FROZEN, '1', 'Root must freeze all writers before D354 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'BEZIER_CONTROL_POINT_AUTHORING', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One XY sketch plane; a rectangle profile (0,0)-(40,30), one quadratic Bezier and one cubic Bezier on the 1 mm grid; default snap step 1 mm.', 'Canvas clicks are real mouse events at pixels from window.__studioScreenOf.',
    'Overlay marks are read from svg.vp-overlay (polyline.sk-guide, polyline.sk-shape, circle.sk-point / circle.sk-end) and mapped by the svg bounding rect; what is found is recorded before it is asserted.',
    'The stored form of the Bezier in the sketch node is recorded before it is asserted.', 'The product read (the bundled inspector) is product code, not an independent oracle.', 'The Python oracle (python3 -I, Fractions, zero product imports) decides exact poles, knots, weights, Bernstein values and end tangents.',
    'Undo / Redo of Make curves use the toolbar Undo / Redo buttons; the document before Make curves is recorded and compared.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {geometryOf} from '../../packages/barocss-cad-model/src/engine/direct.ts';
import {evaluateCurve,evaluateCurveD1,curveDomain} from '@barocss/cad';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const out:any={objects:(doc.direct?.objects??[]).length,curves:[]};
const ts=[0,0.25,0.5,0.75,1];
for(const o of doc.direct?.objects??[]){const g:any=geometryOf(doc.direct,o);if(g.kind!=='curve')continue;
const dom=curveDomain(g);const c:any={id:o.id,name:o.name,degree:g.degree,knots:g.knots,controlPoints:g.controlPoints,weights:g.weights,domain:dom,evals:ts.map(t=>({t,point:evaluateCurve(g,t)})),d1:{}};
try{c.d1.start=evaluateCurveD1(g,0).derivative;c.d1.end=evaluateCurveD1(g,1).derivative;}catch(e){c.d1.error=String(e);}
out.curves.push(c);}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;
const doc = () => page.evaluate(() => window.__studioDoc);
const editor = () => page.locator('.node-editor');
const sketchPanel = () => page.getByRole('complementary', { name: 'Sketch', exact: true });
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
async function same(expected) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), expected); }
const alerts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent));
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(), selection: window.__studioSelection ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent),
    editor: document.querySelector('.node-editor')?.textContent ?? null, sketchPanel: document.querySelector('.sk-panel')?.textContent ?? null, hud: document.querySelector('.hud')?.textContent ?? null,
    sketchAlert: document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null, sketchStatus: document.querySelector('.sk-panel [role="status"]')?.textContent ?? null,
    bezierInputs: [...document.querySelectorAll('.sk-panel input[aria-label^="Control point "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })),
    history: [...document.querySelectorAll('.history .hs')].map(b => b.getAttribute('aria-label')) }), label);
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
// Every point must be on the canvas (not under a panel) before the first click; zoom out with the wheel until they are.
async function frame(points) {
  const tries = [];
  for (let i = 0; i < 10; i++) {
    const read = await page.evaluate(points => { const c = document.querySelector('.vp-canvas'), r = c.getBoundingClientRect();
      const px = points.map(p => window.__studioScreenOf([p[0], p[1], 0])), z = window.__studioScreenOf([0, 0, 0]), o = window.__studioScreenOf([1, 0, 0]);
      const hits = px.map(q => q && q[0] > r.left + 24 && q[0] < r.right - 24 && q[1] > r.top + 24 && q[1] < r.bottom - 24 && !!document.elementFromPoint(q[0], q[1])?.closest('.vp-canvas'));
      return { canvas: [r.left, r.top, r.width, r.height], px, pxPerMm: z && o ? Math.hypot(o[0] - z[0], o[1] - z[1]) : null, allOnCanvas: hits.every(Boolean) }; }, points);
    tries.push(read); if (read.allOnCanvas) { report.observations.push({ label: 'framing', tries }); await persist(); return read; }
    const [left, top, width, height] = read.canvas; await page.mouse.move(left + width / 2, top + height / 2); await page.mouse.wheel(0, 400); await page.waitForTimeout(400);
  }
  report.observations.push({ label: 'framing-failed', tries }); await persist(); assert.fail('the points could not be framed on the canvas');
}
// A sketch tool by its toolbar button name, else its key (input blurred first).
async function tool(name, key) {
  const b = page.getByRole('button', { name, exact: true }); const count = await b.count(); report.observations.push({ label: `tool-${name}`, buttons: count });
  if (count === 1) await b.click(); else { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press(key); }
  await page.waitForTimeout(100);
}
const bezierRows = () => page.evaluate(() => [...document.querySelectorAll('.sk-panel input[aria-label^="Control point "]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
const polesOf = rows => { const out = []; for (let i = 0; i + 1 < rows.length; i += 2) out.push([Number(rows[i].value), Number(rows[i + 1].value)]); return out; };
const bezierTitle = () => page.locator('.sk-panel .card-title').filter({ hasText: /^BÉZIER$/ });
const alertText = () => page.evaluate(() => document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null);
// The overlay marks in page pixels: the dashed control polygons (polyline.sk-guide), the solid polylines (polyline.sk-shape) and the control-point dots.
const overlay = () => page.evaluate(() => {
  const svgs = [...document.querySelectorAll('svg.vp-overlay')]; const out = { svgs: svgs.length, guides: [], shapes: [], dots: [], otherClasses: [] };
  for (const svg of svgs) {
    const r = svg.getBoundingClientRect(), at = (x, y) => [r.left + x, r.top + y];
    const pts = el => (el.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean).map(s => { const [x, y] = s.split(',').map(Number); return at(x, y); });
    for (const el of svg.querySelectorAll('polyline')) { const cls = el.getAttribute('class') ?? ''; const entry = { class: cls, dash: getComputedStyle(el).strokeDasharray, points: pts(el) };
      if (/\bsk-guide\b/.test(cls)) out.guides.push(entry); else if (/\bsk-shape\b/.test(cls)) out.shapes.push(entry); else out.otherClasses.push({ tag: 'polyline', class: cls, count: entry.points.length }); }
    for (const el of svg.querySelectorAll('circle')) { const cls = el.getAttribute('class') ?? ''; if (/\bsk-(point|end)\b/.test(cls)) out.dots.push({ class: cls, at: at(Number(el.getAttribute('cx')), Number(el.getAttribute('cy'))) }); }
    out.otherClasses.push(...[...svg.querySelectorAll('line,path')].map(el => ({ tag: el.tagName, class: el.getAttribute('class') ?? '' })).slice(0, 40));
  }
  return out;
});
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// The Bezier curves drawn: solid polylines of 33 sampled points (bezierSamples n = 32).
const curvePolylines = o => o.shapes.filter(s => s.points.length === 33);
async function openSketchEditor() {
  // (A standalone sketch is listed in History by its label, "Sketch · rectangle", as in the D345/D349 drivers.)
  phase = 'open sketch editor'; const target = page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · rectangle', exact: true }); assert.equal(await target.count(), 1, 'one history button for the sketch');
  report.observations.push({ label: 'history-label', label0: await target.getAttribute('aria-label') }); await target.click(); await editor().waitFor();
}
async function reopenSketch(label) { await openSketchEditor(); phase = `reopen sketch ${label}`; await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor(); }
async function finishSketch(label) { phase = `Finish sketch ${label}`; await page.locator('.topbar button.finish').click(); await sketchPanel().waitFor({ state: 'hidden' }); await ready(); return snapshot(label); }
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
const QUAD = [[0, 40, 0], [10, 50, 0], [20, 40, 0]], CUBIC = [[30, 40, 0], [35, 55, 0], [45, 55, 0], [50, 40, 0]];
// Product read (bundled inspector) and the independent Python oracle on the same document. The oracle input is written before any assertion on its verdict.
async function inspect(label) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  const read = JSON.parse(run.stdout); report.reads.push({ label, ...read }); await persist();
  const input = { curves: read.curves, quad: QUAD, cubic: CUBIC }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'bezier-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stdout: check.stdout ? JSON.parse(check.stdout) : null, stderr: check.stderr }); await persist();
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); assert.equal(JSON.parse(check.stdout).status, 'PASS');
  assert.deepEqual(await doc(), accepted); return { read, verified: JSON.parse(check.stdout) };
}
const initialFiles = ['apps/cad-studio/test/bezier-sketch-browser.mjs', 'packages/barocss-cad-model/test/sketch-bezier.test.ts', 'packages/barocss-cad-model/src/sketch/bezier.ts', 'apps/cad-studio/src/styles.css', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/app/sketchControls.ts', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/sketch/types.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/osnap.ts',
  'packages/barocss-cad-model/src/sketch/trim.ts', 'packages/barocss-cad-model/src/sketch/offset.ts', 'packages/barocss-cad-model/src/sketch/dxf.ts', 'packages/barocss-cad-model/src/sketch/entityIds.ts', 'packages/barocss-cad-model/src/engine/curveSource.ts', 'packages/barocss-cad-model/src/engine/direct.ts', 'packages/barocss-cad-model/src/engine/doc.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'bezier-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  const buildInputs = [], sourcefile = 'd354-inspector.ts', virtual = resolve(app, sourcefile);
  const built = await build({ stdin: { contents: inspectSource, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  await writeFile(join(output, 'inspector.ts'), inspectSource); await writeFile(join(output, 'inspector-metafile.json'), JSON.stringify(built.metafile, null, 2));
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual)); report.virtualSources = [{ label: 'inspector', hash: hash(inspectSource), virtualInputExcluded: virtual }];
  inspector = join(output, 'inspector.mjs'); await writeFile(inspector, built.outputFiles[0].contents);
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
  frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts']; report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
  for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  for (const need of ['packages/barocss-cad-model/src/sketch/bezier.ts', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx']) assert.ok(report.sourceFrozen[need], `${need} is in the frozen capsule`);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' }); server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;
  const ALL = [[0, 0], [40, 30], [0, 40], [10, 60], [20, 40], [30, 40], [35, 55], [45, 55], [50, 40]];

  // Context 1: empty document, rectangle profile, one quadratic Bezier.
  phase = 'empty document'; await newPage(); await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0); await ready(); const empty = await doc(); assert.equal(empty.nodes.length, 0, 'the document starts empty'); await snapshot('00-empty');
  phase = 'start XY sketch'; await command('Sketch'); await sketchPanel().waitFor(); await sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
  await frame(ALL);
  phase = 'rectangle'; await tool('Rectangle', 'r'); await worldClick([0, 0]); await worldClick([40, 30]);
  phase = 'quadratic Bezier'; await tool('Bézier', 'b'); for (const p of [[0, 40], [10, 60], [20, 40]]) await worldClick(p);
  await page.mouse.move(5, 5); await page.waitForTimeout(250);
  await bezierTitle().waitFor({ timeout: 15000 }); const rows01 = await bezierRows(), marks01 = await overlay(); await snapshot('01-quadratic');
  report.observations.push({ label: '01-quadratic', rows: rows01, overlay: { svgs: marks01.svgs, guides: marks01.guides.map(g => ({ class: g.class, dash: g.dash, points: g.points })), shapes: marks01.shapes.map(s => ({ class: s.class, count: s.points.length })), dots: marks01.dots, otherClasses: marks01.otherClasses } }); await persist();
  assert.equal(rows01.length, 6, 'three control points x (X, Y)'); assert.deepEqual(rows01.map(r => r.label), ['Control point 1 X', 'Control point 1 Y', 'Control point 2 X', 'Control point 2 Y', 'Control point 3 X', 'Control point 3 Y']);
  assert.deepEqual(polesOf(rows01), [[0, 40], [10, 60], [20, 40]], 'BÉZIER lists the clicked control points'); assert.equal(await alertText(), null);
  assert.ok(marks01.guides.some(g => g.points.length === 3), `a dashed control polygon of three points: ${JSON.stringify(marks01.guides.map(g => g.points.length))}`);
  const curves01 = curvePolylines(marks01); assert.ok(curves01.length >= 1, `a solid curve polyline of 33 samples: ${JSON.stringify(marks01.shapes.map(s => s.points.length))}`);
  const px01 = await Promise.all([[0, 40], [10, 60], [20, 40]].map(screenOf)), curve01 = curves01[curves01.length - 1].points;
  const minToMiddle = Math.min(...curve01.map(q => dist(q, px01[1]))), startGap = dist(curve01[0], px01[0]), endGap = dist(curve01[32], px01[2]);
  report.observations.push({ label: '01-geometry', poleScreen: px01, minDistanceToMiddlePole: minToMiddle, startGap, endGap }); await persist();
  assert.ok(minToMiddle > 3, `the curve does not pass through the middle pole (min ${minToMiddle} px)`); assert.ok(startGap <= 2 && endGap <= 2, `the curve runs through the end poles (${startGap}, ${endGap} px)`);
  px01.forEach((p, i) => assert.ok(marks01.dots.some(d => dist(d.at, p) <= 2), `a control point dot at pole ${i + 1}`));

  // Edit control point 2 Y to 50 with Enter.
  phase = 'edit control point 2 Y'; const docBefore02 = await doc(); const y2 = page.locator('.sk-panel input[aria-label="Control point 2 Y"]'); await y2.fill('50'); await y2.press('Enter'); await page.waitForTimeout(400); await page.mouse.move(5, 5); await page.waitForTimeout(200);
  const rows02 = await bezierRows(), marks02 = await overlay(); await snapshot('02-edited'); report.observations.push({ label: '02-edited', rows: rows02, guides: marks02.guides.map(g => g.points), alert: await alertText() });
  assert.deepEqual(polesOf(rows02), [[0, 40], [10, 50], [20, 40]], 'Control point 2 Y = 50, nothing else changed'); assert.equal(await sketchPanel().isVisible(), true, 'Enter applied the value; the sketch is still open'); assert.deepEqual(await doc(), docBefore02, 'the document is untouched until Finish');
  const g02 = marks02.guides.find(g => g.points.length === 3), pole2 = await screenOf([10, 50]); assert.ok(g02 && dist(g02.points[1], pole2) <= 2, 'the control polygon follows the edited pole');
  const curve02 = curvePolylines(marks02); assert.ok(curve02.length >= 1);

  // Finish.
  const done03 = await finishSketch('03-finished'), doc03 = done03.doc; assert.equal(doc03.nodes.length, 1, 'one sketch node'); const node03 = doc03.nodes[0]; report.observations.push({ label: '03-sketch', node: node03 }); await persist();
  assert.equal(node03.kind, 'sketch'); assert.ok(Array.isArray(node03.construction), `the node has a construction array: ${JSON.stringify(Object.keys(node03))}`);
  assert.deepEqual(node03.construction, [{ kind: 'bezier', poles: [[0, 40], [10, 50], [20, 40]] }], 'exactly one stored Bezier, without construction: true'); assert.ok(node03.construction.every(c => c.construction !== true));
  assert.deepEqual(await alerts(), []);
  const saved1 = await save('bezier'); assert.deepEqual(saved1.doc, doc03);

  // Context 2: fresh Open, reopen, cubic, Make curves.
  const fresh04 = await freshOpen(saved1.file, saved1.doc, '04-fresh-open'); assert.deepEqual(fresh04.doc, saved1.doc);
  await reopenSketch('05'); await page.waitForTimeout(300); await frame(ALL); await page.mouse.move(5, 5); await page.waitForTimeout(250);
  const marks05 = await overlay(), rows05 = await bezierRows(); await snapshot('05-reopened');
  report.observations.push({ label: '05-reopened', rows: rows05, guides: marks05.guides.map(g => g.points.length), shapes: marks05.shapes.map(s => s.points.length), dots: marks05.dots, otherClasses: marks05.otherClasses });
  assert.ok(marks05.guides.some(g => g.points.length === 3), 'the reopened Bezier shows its dashed control polygon'); assert.ok(curvePolylines(marks05).length >= 1, 'the reopened Bezier shows its solid curve');
  assert.deepEqual(await doc(), saved1.doc, 'reopening does not change the document');
  phase = 'cubic Bezier'; await tool('Bézier', 'b'); for (const p of [[30, 40], [35, 55], [45, 55], [50, 40]]) await worldClick(p);
  await page.mouse.move(5, 5); await page.waitForTimeout(250); await bezierTitle().waitFor({ timeout: 15000 });
  const rows06 = await bezierRows(), marks06 = await overlay(); await snapshot('06-cubic'); report.observations.push({ label: '06-cubic', rows: rows06, guides: marks06.guides.map(g => g.points.length), curves: curvePolylines(marks06).length, dots: marks06.dots.length });
  assert.deepEqual(polesOf(rows06), [[30, 40], [35, 55], [45, 55], [50, 40]], 'BÉZIER lists the cubic control points'); assert.ok(curvePolylines(marks06).length >= 2, 'the quadratic and the cubic are both drawn'); assert.ok(marks06.guides.some(g => g.points.length === 4), 'a dashed control polygon of four points');
  assert.equal(await alertText(), null);
  phase = 'Make curves'; const docBeforeCurves = await doc(), directBefore = docBeforeCurves.direct?.objects?.length ?? 0; report.observations.push({ label: '07-before', directObjects: directBefore, nodes: docBeforeCurves.nodes.length });
  await sketchPanel().getByRole('button', { name: 'Make curves', exact: true }).click();
  await page.waitForFunction(n => (window.__studioDoc.direct?.objects?.length ?? 0) > n, directBefore, { timeout: 60000 }); await ready(); await sketchPanel().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => report.observations.push({ label: '07-panel-still-visible' }));
  const done07 = await snapshot('07-curves'), doc07 = done07.doc; const names07 = doc07.direct.objects.map(o => o.name); report.observations.push({ label: '07-curves', names: names07, directObjects: doc07.direct.objects.length, sketchPanelVisible: await sketchPanel().isVisible(), nodesEqualBefore: JSON.stringify(doc07.nodes) === JSON.stringify(docBeforeCurves.nodes) }); await persist();
  assert.ok(doc07.direct.objects.length > directBefore, 'the direct geometry gained curves'); assert.ok(doc07.direct.objects.slice(directBefore).every(o => o.name.startsWith('Sketch curve 1')), `new objects are named Sketch curve 1: ${names07}`);
  assert.equal(await sketchPanel().isVisible(), false, 'Make curves closes the sketch'); assert.deepEqual(await alerts(), []);
  const read07 = await inspect('07-native'); assert.ok(read07.read.curves.some(c => c.degree === 2) && read07.read.curves.some(c => c.degree === 3));
  // Undo / Redo.
  phase = 'undo redo Make curves'; await page.evaluate(() => document.activeElement?.blur());
  const undo = page.getByRole('button', { name: 'Undo', exact: true }); if (await undo.count() === 1 && await undo.isEnabled()) await undo.click(); else await page.keyboard.press('Meta+z');
  await page.waitForFunction(n => (window.__studioDoc.direct?.objects?.length ?? 0) === n, directBefore, { timeout: 15000 }); await ready(); const undone = await snapshot('07a-undone');
  report.observations.push({ label: '07a-undone', equalsDocBeforeCurves: JSON.stringify(undone.doc) === JSON.stringify(docBeforeCurves), directObjects: undone.doc.direct?.objects?.length ?? 0, nodes: undone.doc.nodes.length }); await persist();
  assert.deepEqual(undone.doc.direct ?? { sources: {}, objects: [] }, docBeforeCurves.direct ?? { sources: {}, objects: [] }, 'Undo removes the made curves');
  const redo = page.getByRole('button', { name: 'Redo', exact: true }); if (await redo.count() === 1 && await redo.isEnabled()) await redo.click(); else await page.keyboard.press('Meta+Shift+z');
  await same(doc07); await snapshot('07b-redone');
  const saved2 = await save('curves'); assert.deepEqual(saved2.doc, doc07);

  // Context 3: fresh Open of curves.bcad.
  const fresh08 = await freshOpen(saved2.file, saved2.doc, '08-final'); assert.deepEqual(fresh08.doc.direct, doc07.direct);
  await inspect('08-native');

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
