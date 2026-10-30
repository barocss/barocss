// Roadmap 20 (2) qualification: the Fillet radius drag handle no longer jumps. While a command handle is dragged the kernel evaluates previews asynchronously; a late failure of an abandoned value used to reset the
// shown value and a sign-only wall clamped every value past the last good one forever. Now a stale failure only records a bound (`bad`), the value is held only at or beyond it, and a bisect preview converges on the real limit.
// Fixture apps/cad-studio/test/fixtures/fillet-drag.bcad: a 40 x 30 x 20 box whose edge side1|top (30 long) already has a fillet R8 (n2). A second Fillet on the top edge n1.side0|n1.top (40 long) follows its tangent chain
// (32 straight, a quarter arc of the R8 round, 12 straight down), and the kernel refuses a radius that does not fit inside the R8 circle: every radius >= 8 is refused, 7.9 is the largest accepted (0.1 scan), so on the
// handle's 0.5 mm grid 7.5 is the last good value (the handle's own cap is 19.5, far above it: the wall is the kernel's, not the handle's).
// Root must freeze all sources first. Run from apps/cad-studio:
//   FILLET_DRAG_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/fillet-drag-wall-browser.mjs /absolute/artifacts
// Actual Studio UI (Open of the fixture, readonly window.__studioSelectEdge hook to pick the edge by its persistent name, palette Fillet, REAL pointer drags on the radius arrow g.gizmo-handle[data-handle="radius"] with page.mouse
// down / many small moves / up, HUD Radius field and status read, Apply, Undo / Redo, Save, Open) mutates. Readonly hooks (window.__studioDoc / __studioBodies / __studioSelection) observe only.
// One Chrome WebGPU process, two sequential fresh contexts. Product read: a bundled inspector (product code, not an oracle) evaluates the saved documents and probes the refusal radius (7.5 accepted, 8 refused).
// The independent Python oracle (python3 -I, zero product imports) decides the document structure and the volume from a closed form: box - R8 round (1 - pi/4) R^2 x 30 - the second round along the chain
// ((1 - pi/4) r^2 x (32 + 12) + (pi/2) (R A(r) - r^3 (5/6 - pi/4)) for the quarter arc by Pappus on the cross section), 1e-9 relative.
//
// Design of the pointer mapping. The handle value is start + mm along the arrow, mm = screen px along the arrow / (px per mm), linear in the pointer. px/mm is calibrated by a first drag (1 px steps until the HUD reads 7.5,
// i.e. the pointer is at mm = 4.25 from the start value 3) which is released back at the start; every later target is placed at the CENTRE of its 0.5 mm snap bin.
// What is asserted about the shown values (design-faithful, see useCommandPreview.ts):
//  * A value past the limit may be SHOWN for a moment (pointer driven, busy) until its failure arrives, never with the status "preview" (= accepted), and never in the settled tail.
//  * Moving inward (B, D): every shown value is at most the pointer's (+ half a step); one unchecked probe above the previous shown value is allowed, only while evaluating and not above the pointer; no more than one increase (no oscillation).
//  * A VALID shown value never goes back to a lower one while the pointer moves outward (no revert to an older value).
//  * After the hold the value is within one step of the limit (7.0 .. 7.5), steady; moving back inward gives exactly the pointer's value (4.0) with nothing above it afterwards; moving out again reaches 6.5.
//  * A second drag goes out fast and straight back while failing previews are in flight: the final value is the pointer's value (4.0), never higher.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent check of the box with two fillets (R8 on the 30 mm edge, r on the 40 mm top edge following its tangent chain): document structure and volume in closed form. Product imports: zero."""
import json, math, sys

data = json.load(sys.stdin)
doc = data['doc']; shown = data['shown']; reported = data['volume']
assert isinstance(shown, (int, float)) and not isinstance(shown, bool) and math.isfinite(shown), ('shown radius', shown)

def finite(v, path):
    if isinstance(v, bool): return
    if isinstance(v, (int, float)): assert math.isfinite(v), ('non-finite', path)
    elif isinstance(v, list):
        for i, x in enumerate(v): finite(x, path + '[' + str(i) + ']')
    elif isinstance(v, dict):
        for k, x in v.items(): finite(x, path + '.' + k)
    elif v is None: raise AssertionError(('null', path))
finite(doc, 'doc')
nodes = doc['nodes']; assert len(nodes) == 4, ('four nodes: sketch, extrude, fillet R8, fillet r', len(nodes))
sk, ex, f1, f2 = nodes
assert sk['kind'] == 'sketch' and sk['profile'] == 'rectangle' and sk['min'] == [0, 0] and sk['max'] == [40, 30], ('rectangle 40 x 30', sk)
assert ex['kind'] == 'extrude' and ex['sketch'] == 0 and abs(ex['height']) == 20, ('extrude 20', ex)
assert f1['kind'] == 'fillet' and f1['edges'] == ['n1.side1|n1.top'] and f1['radius'] == 8, ('first fillet R8 on the 30 mm edge', f1)
assert f2['kind'] == 'fillet' and f2['edges'] == ['n1.side0|n1.top'], ('second fillet on the 40 mm top edge', f2)
r = f2['radius']; R = f1['radius']
assert r == shown, ('stored radius equals the value shown at release', r, shown)
assert 0.1 <= r < R, ('radius below the R8 circle (the kernel refuses r >= 8)', r)
A = lambda x: (1 - math.pi / 4) * x * x
box = 40 * 30 * 20
first = A(R) * 30
second = A(r) * (32 + 12) + (math.pi / 2) * (R * A(r) - r ** 3 * (5 / 6 - math.pi / 4))
expected = box - first - second
rel = abs(expected - reported) / expected
assert rel <= 1e-9, ('Studio volume against the closed form', expected, reported, rel)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'radius': r, 'boxVolume': box, 'firstRound': first, 'secondRound': second, 'expectedVolume': expected, 'studioVolume': reported, 'relativeDifference': rel}, indent=2))
`;
assert.equal(process.env.FILLET_DRAG_SOURCE_FROZEN, '1', 'Root must freeze all writers before the fillet drag driver runs');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const fixture = join(import.meta.dirname, 'fixtures', 'fillet-drag.bcad');
const hash = value => createHash('sha256').update(value).digest('hex');
// The numbers of the scenario (LIMIT found by scanning the kernel: largest accepted 7.9, first refused 8.0 = the R8 round's radius).
const EDGE = 'n1.side0|n1.top', START = 3, STEP = 0.5, LIMIT_OK = 7.9, LIMIT_GRID = 7.5, REFUSED_AT = 8, BACK = 4, AGAIN = 6.5;
const report = { status: 'RUNNING', qualification: 'FILLET_RADIUS_DRAG_WALL', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', constants: { EDGE, START, STEP, LIMIT_OK, LIMIT_GRID, REFUSED_AT, BACK, AGAIN }, states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], samples: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['Real pointer events (page.mouse down / many 8-16 ms moves / up) on the radius arrow; the kernel and the preview queue are the product ones (no stubs).', 'px per mm is calibrated by a first drag released back at the start; targets sit at the centre of their 0.5 mm snap bin.',
    'A value past the limit may be shown while its preview is pending: asserted only as never accepted (status preview), never in the settled tail, and never a revert of a valid value.', 'The handle position is the circle at the arrow root (g.gizmo-handle[data-handle="radius"] circle), the press point the arrow head polygon centre.',
    'Product reads (the bundled inspector) are product code, not an independent oracle. The Python oracle (python3 -I, zero product imports) decides structure and volume from a closed form.', 'Hashes are source provenance, not geometry oracles.',
    'The Undo / Redo / Save / Open tail saves the applied (redone) document, which is more than a saved undone one.'] };
let phase = 'source preparation', server, browser, context, page, inspector, pressed = false;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error?.detail??(view as any).error?.title??(view as any).error??'evaluation failed'),probes:{}};
if(view.ok){out.bodyCount=view.bodies.length;out.evalVolume=view.bodies[0]?.volume??null;}
out.hasNull=JSON.stringify(doc).includes('null');out.last=doc.nodes[doc.nodes.length-1];
// The refusal radius at run time: the last fillet at 7.5 (accepted) and 8 (refused).
if(doc.nodes[doc.nodes.length-1]?.kind==='fillet'){for(const r of [0.5,7.5,7.9,8,8.5]){const d=JSON.parse(before);d.nodes[d.nodes.length-1].radius=r;const v=evaluateDoc(d,0);out.probes[String(r)]=v.ok?'ok':String((v as any).error?.code??(v as any).error?.title??'refused');}}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;
// (JSON form: a key holding undefined is absent from a saved file.)
const doc = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__studioDoc)));
const hud = () => page.locator('.hud');
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
async function same(expected) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), JSON.parse(JSON.stringify(expected))); }
async function changed(previous) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) !== x, JSON.stringify(previous), { timeout: 60000 }); await ready(); }
const alerts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent));
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: JSON.parse(JSON.stringify(window.__studioDoc)), bodies: window.__studioBodies?.(), selection: window.__studioSelection ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent),
    hud: document.querySelector('.hud')?.textContent ?? null, history: [...document.querySelectorAll('.history .hs')].map(b => b.getAttribute('aria-label')) }), label);
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
async function command(label) { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Space'); await page.locator('.palette input').fill(label); await page.keyboard.press('Enter'); }
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
// Product read (bundled inspector) and the independent Python oracle on the same document and the Studio-reported volume. Everything is written before the first assertion.
async function inspect(label, shown, volume) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? '');
  assert.equal(run.status, 0, run.stderr); const read = JSON.parse(run.stdout); report.reads.push({ label, studioVolume: volume, ...read }); await persist();
  const input = { doc: accepted, shown, volume }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'fillet-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stdout: check.stdout ? JSON.parse(check.stdout) : null, stderr: check.stderr }); await persist();
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); assert.equal(JSON.parse(check.stdout).status, 'PASS');
  assert.equal(read.ok, true, `${label}: product evaluation ok (${read.error})`); assert.equal(read.hasNull, false, `${label}: no null stored in the document`); assert.equal(read.bodyCount, 1, `${label}: one body`);
  assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6 * volume, `${label}: product evalVolume ${read.evalVolume} vs Studio ${volume}`);
  // The refusal limit at run time: 7.5 accepted, 8 (the R8 circle) refused.
  assert.equal(read.probes['7.5'], 'ok', `${label}: radius 7.5 is accepted`); assert.equal(read.probes['7.9'], 'ok', `${label}: radius 7.9 is accepted`); assert.notEqual(read.probes['8'], 'ok', `${label}: radius 8 is refused`); assert.notEqual(read.probes['8.5'], 'ok', `${label}: radius 8.5 is refused`);
  assert.deepEqual(await doc(), accepted); return { read, verified: JSON.parse(check.stdout) };
}
// ---- the pointer drag -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const sleep = ms => new Promise(done => setTimeout(done, ms));
// One reading of the page: the HUD Radius value and status, the arrow root (circle centre) and the head (polygon box centre) in page pixels.
const read = () => page.evaluate(() => {
  const f = [...document.querySelectorAll('.hud .field')].find(x => [...x.querySelectorAll('span')].some(s => s.textContent.trim() === 'Radius')), input = f?.querySelector('input');
  const g = document.querySelector('g.gizmo-handle[data-handle="radius"]'), c = g?.querySelector('circle'), p = g?.querySelector('polygon');
  const mid = e => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  return { value: input ? Number(input.value) : NaN, raw: input?.value ?? null, status: document.querySelector('.hud .status')?.textContent?.trim() ?? null, root: mid(c), head: mid(p), handles: document.querySelectorAll('g.gizmo-handle').length };
});
const t0 = Date.now();
async function point(label, [x, y], extra = {}) { await page.mouse.move(x, y); const s = await read(); const sample = { label, t: Date.now() - t0, pointer: [x, y], ...s, ...extra }; report.samples.push(sample); return sample; }
const upto = async (start, ms) => { const wait = ms - (Date.now() - start); if (wait > 0) await sleep(wait); };
// A path of pointer positions: each move, then a reading, with 8-16 ms between moves.
async function moves(label, points) { const out = []; for (let i = 0; i < points.length; i++) { const s0 = Date.now(); out.push(await point(label, points[i], { i })); await upto(s0, 8 + (i % 3) * 4); } return out; }
// A still pointer: a reading every 100 ms.
async function hold(label, at, ms) { const out = []; for (let k = 0; k < ms / 100; k++) { await sleep(100); out.push(await point(label, at, { k })); } return out; }
const along = (p0, u, mm, ppm) => [p0[0] + u[0] * mm * ppm, p0[1] + u[1] * mm * ppm];
const ramp = (p0, u, ppm, a, b, n) => Array.from({ length: n }, (_, i) => along(p0, u, a + (b - a) * (i + 1) / n - START, ppm));
const values = ss => ss.map(s => s.value);
function revertFree(ss, label) { // a valid shown value never goes back to a lower one
  for (let i = 1; i < ss.length; i++) if (ss[i].value < ss[i - 1].value && ss[i - 1].value <= LIMIT_OK) assert.fail(`${label}: a valid shown value ${ss[i - 1].value} went back to ${ss[i].value} at sample ${i} (${JSON.stringify(ss.slice(Math.max(0, i - 3), i + 2).map(s => [s.t, s.value, s.status]))})`);
}
function never(ss, test, label, why) { const bad = ss.filter(test); assert.equal(bad.length, 0, `${label}: ${why}: ${JSON.stringify(bad.slice(0, 4).map(s => [s.t, s.value, s.status]))}`); }
// Moving inward with the pointer: a value can only be checked by being shown, so one probe above the previous shown value is allowed, but only at or below the pointer's own value (+ half a step) and only while evaluating;
// every shown value is at most the pointer's value (+ half a step); one past the limit is never "preview" (accepted); at most one increase in the move (no oscillation).
function inward(ss, pointer, label, before) {
  let ups = 0;
  for (let i = 0; i < ss.length; i++) {
    const s = ss[i], prev = i ? ss[i - 1].value : before.value, at = `${label}: sample ${i} ${JSON.stringify([s.t, s.value, s.status])} pointer ${pointer[i].toFixed(2)}`;
    // (The field shows the value of the move before it a frame late: compare with the larger of this pointer and the one before.)
    const reach = Math.max(pointer[i], i ? pointer[i - 1] : pointer[i]);
    assert.ok(s.value <= reach + STEP / 2 + 1e-9, `${at}: the shown value is above the pointer's`);
    if (s.value > LIMIT_OK) assert.ok(s.status !== 'preview', `${at}: a value past the limit was accepted`);
    if (s.value > prev) { ups++; assert.ok(/evaluating/.test(s.status ?? ''), `${at}: an increase shown as ${s.status}, not evaluating (from ${prev})`); }
  }
  assert.ok(ups <= 1, `${label}: ${ups} increases while moving inward: ${JSON.stringify(ss.map(s => s.value))}`);
}
const nonDecreasing = (ss, label) => { for (let i = 1; i < ss.length; i++) assert.ok(ss[i].value >= ss[i - 1].value, `${label}: value decreased ${ss[i - 1].value} -> ${ss[i].value} at ${i}`); };
// The arrow root is drawn at the shown value: it moves along the arrow with it (same value, same place; a higher value, further out).
function handleFollows(ss, u, label) {
  for (let i = 1; i < ss.length; i++) {
    const a = ss[i - 1], b = ss[i]; if (!a.root || !b.root) continue; const d = (b.root[0] - a.root[0]) * u[0] + (b.root[1] - a.root[1]) * u[1];
    if (a.value === b.value) assert.ok(Math.hypot(b.root[0] - a.root[0], b.root[1] - a.root[1]) <= 1.5, `${label}: same value ${a.value} but the handle moved ${JSON.stringify([a.root, b.root])}`);
    else assert.ok(Math.sign(d) === Math.sign(b.value - a.value) || Math.abs(d) <= 1.5, `${label}: the handle did not follow the value ${a.value} -> ${b.value} (moved ${d.toFixed(2)} px along the arrow)`);
  }
}
const settled = (ss, n = 5) => { const tail = ss.slice(-n); assert.ok(tail.every(s => s.value === tail[0].value && s.status === 'preview'), `not settled: ${JSON.stringify(tail.map(s => [s.value, s.status]))}`); return tail[0].value; };
const hudStatus = () => page.evaluate(() => document.querySelector('.hud .status')?.textContent?.trim() ?? null);
const initialFiles = ['apps/cad-studio/test/fillet-drag-wall-browser.mjs', 'apps/cad-studio/test/fixtures/fillet-drag.bcad', 'apps/cad-studio/test/command-drag-wall.test.ts', 'apps/cad-studio/src/state/useCommandPreview.ts', 'apps/cad-studio/src/viewport/useCommandGizmos.ts',
  'apps/cad-studio/src/viewport/gizmo.ts', 'apps/cad-studio/src/viewport/GizmoMarks.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/Hud.tsx', 'packages/barocss-cad-model/src/app/commands.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'fillet-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  const buildInputs = [], sourcefile = 'fillet-inspector.ts', virtual = resolve(app, sourcefile);
  const built = await build({ stdin: { contents: inspectSource, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  await writeFile(join(output, 'inspector.ts'), inspectSource); await writeFile(join(output, 'inspector-metafile.json'), JSON.stringify(built.metafile, null, 2));
  // Stdin has no disk path. Its exact source/hash is captured and the virtual input is explicitly excluded.
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual)); report.virtualSources = [{ label: 'inspector', hash: hash(inspectSource), virtualInputExcluded: virtual }];
  inspector = join(output, 'inspector.mjs'); await writeFile(inspector, built.outputFiles[0].contents);
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
  frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts']; report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
  for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  for (const need of ['apps/cad-studio/src/state/useCommandPreview.ts', 'apps/cad-studio/src/viewport/useCommandGizmos.ts', 'apps/cad-studio/test/fixtures/fillet-drag.bcad']) assert.ok(report.sourceFrozen[need], `${need} is in the frozen capsule`);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' }); server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;

  // Context 1. 1: open the fixture, pick the edge, start Fillet.
  phase = 'open fixture'; await newPage(); await openFile(fixture, 3); await page.waitForTimeout(700); await ready(); const opened = await doc(); assert.equal(opened.nodes.length, 3); assert.equal(opened.nodes[2].radius, 8); assert.deepEqual(await alerts(), []); await snapshot('00-opened');
  phase = 'pick the edge, start Fillet'; assert.ok(await page.evaluate(n => window.__studioSelectEdge(n), EDGE), `the edge ${EDGE} exists in the evaluated body`);
  await page.waitForTimeout(300); await command('Fillet'); await hud().waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('g.gizmo-handle[data-handle="radius"]') && /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 30000 });
  await page.mouse.move(5, 5); await page.waitForTimeout(400);
  const first = await read(); report.observations.push({ label: '01-fillet-hud', ...first, hudText: await page.locator('.hud').innerText(), toasts: await alerts() }); await snapshot('01-fillet-hud');
  assert.equal(first.value, START, `the Fillet HUD starts at Radius ${START} (read ${first.raw})`); assert.equal(first.status, 'preview', 'the start radius previews'); assert.ok(first.root && first.head, 'the radius arrow is drawn'); assert.equal(first.handles, 1, 'one handle (the radius arrow)');
  const arrow = p => { const l = Math.hypot(p.head[0] - p.root[0], p.head[1] - p.root[1]); assert.ok(l > 10, `the arrow is long enough on screen (${l.toFixed(1)} px)`); return [(p.head[0] - p.root[0]) / l, (p.head[1] - p.root[1]) / l]; };
  const u = arrow(first), P0 = first.head;
  const under = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return { tag: e?.tagName, cls: e?.getAttribute?.('class'), inHud: !!e?.closest('.hud'), inViewport: !!e?.closest('.viewport') }; }, P0);
  report.observations.push({ label: '01-press-point', P0, u, under }); await persist(); assert.ok(under.inViewport && !under.inHud, `the press point is on the viewport, not under a panel: ${JSON.stringify(under)}`);
  assert.ok(P0[0] > 0 && P0[1] > 0 && P0[0] < 1440 && P0[1] < 1000, 'press point inside the window');

  // Calibration drag: 1 px steps until the HUD reads 7.5 (mm = 4.25 from the start), then back to the start and release; the value returns to 3.
  phase = 'calibration drag'; await page.mouse.move(P0[0], P0[1]); await page.waitForTimeout(150); await page.mouse.down(); pressed = true; let dA = null; const calib = [];
  for (let d = 1; d <= 260 && dA === null; d++) { const s = await point('calibrate', [P0[0] + u[0] * d, P0[1] + u[1] * d], { d }); calib.push(s); if (s.value >= LIMIT_GRID) { await sleep(40); const again = await point('calibrate-settle', [P0[0] + u[0] * d, P0[1] + u[1] * d], { d }); assert.ok(again.value >= LIMIT_GRID, `calibration reading ${again.value}`); dA = d; } else await sleep(30); }
  assert.ok(dA !== null, 'the HUD reached 7.5 within 260 px'); const ppm = dA / (LIMIT_GRID - START - STEP / 2), cal = { dA, ppm, pxPerMm: ppm }; report.observations.push({ label: '02-calibration', ...cal, samples: calib.length }); await persist();
  assert.ok(ppm > 1.5 && ppm < 120, `plausible px per mm ${ppm}`); await moves('calibrate-back', [...Array.from({ length: 8 }, (_, i) => [P0[0] + u[0] * dA * (7 - i) / 8, P0[1] + u[1] * dA * (7 - i) / 8]), P0]);
  await page.waitForTimeout(500); await page.mouse.up(); pressed = false; await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview', null, { timeout: 30000 }); await page.mouse.move(5, 5); await page.waitForTimeout(400);
  const back0 = await read(); assert.equal(back0.value, START, 'after the calibration drag the radius is back at 3'); assert.ok(Math.hypot(back0.head[0] - P0[0], back0.head[1] - P0[1]) <= 2, `the arrow is back where it was ${JSON.stringify([back0.head, P0])}`);
  assert.deepEqual(await alerts(), []); await snapshot('02-calibrated');
  const target = (mm) => along(P0, u, mm - START, ppm);

  // 2. One pointer-down: outward past the limit (40 small moves, to 15 mm, 15 - 3 = 12 mm), hold 1.5 s.
  phase = 'drag A: outward past the limit'; await page.mouse.move(P0[0], P0[1]); await page.waitForTimeout(150); await page.mouse.down(); pressed = true;
  const A = await moves('A-move', ramp(P0, u, ppm, START, 15, 40)); const aEnd = target(15), holdStart = Date.now() - t0; const Ah = await hold('A-hold', aEnd, 1500); await writeFile(join(output, 'samples-A.json'), JSON.stringify({ A, Ah }, null, 2));
  await snapshot('03-out-and-held'); const Aall = [...A, ...Ah];
  report.observations.push({ label: '03-A', maxShown: Math.max(...values(Aall)), overLimit: Aall.filter(s => s.value > LIMIT_OK).map(s => [s.t, s.value, s.status]), final: Ah.at(-1).value, holdStart });
  never(Aall, s => s.status === 'preview' && s.value > LIMIT_OK, 'A', 'a value past the limit was accepted/previewed');
  revertFree(A, 'A moves'); revertFree(Ah, 'A hold'); handleFollows(Aall, u, 'A');
  never(Ah.filter(s => s.t - holdStart >= 1000), s => s.value > LIMIT_OK, 'A', 'a value past the limit shown in the last 0.5 s of the hold'); nonDecreasing(Ah.slice(-8), 'A tail');
  const valueA = settled(Ah); assert.ok(valueA <= LIMIT_GRID && valueA >= LIMIT_GRID - STEP, `after the hold the value ${valueA} is within one step of the limit (${LIMIT_GRID - STEP} .. ${LIMIT_GRID})`); assert.equal(await hudStatus(), 'preview');
  assert.ok(Math.abs(Aall.at(-1).root[0] - Aall.at(-8).root[0]) <= 1.5, 'the handle rests at the limit');

  // 3. Back inward to 4.0 (15 moves, same press), hold 1.5 s: exactly the pointer's value, never above it afterwards.
  phase = 'drag A: back inward'; const B = await moves('B-move', ramp(P0, u, ppm, 15, BACK, 15)); const bEnd = target(BACK), Bh = await hold('B-hold', bEnd, 1500); await snapshot('04-back-inside');
  report.observations.push({ label: '04-B', moveValues: values(B), holdValues: values(Bh) }); inward(B, B.map((_, i) => 15 + (BACK - 15) * (i + 1) / 15), 'B moves', Ah.at(-1)); handleFollows([...B, ...Bh], u, 'B');
  never(Bh, s => s.value !== BACK, 'B', `the value after the move is the pointer's ${BACK}`); assert.equal(settled(Bh), BACK);

  // 4. Out again to 6.5 (between 4 and the limit): reached, not stuck.
  phase = 'drag A: out again to a valid value'; const C = await moves('C-move', ramp(P0, u, ppm, BACK, AGAIN, 12)); const cEnd = target(AGAIN), Ch = await hold('C-hold', cEnd, 1500); await snapshot('05-out-again');
  report.observations.push({ label: '05-C', moveValues: values(C), holdValues: values(Ch) }); nonDecreasing([Bh.at(-1), ...C], 'C moves'); never([...C, ...Ch], s => s.value > AGAIN, 'C', `nothing above the pointer's ${AGAIN}`);
  never(Ch, s => s.value !== AGAIN, 'C', `the value after the move is the pointer's ${AGAIN}`); assert.equal(settled(Ch), AGAIN); handleFollows([...C, ...Ch], u, 'C');
  await page.mouse.up(); pressed = false; await page.waitForTimeout(300); const rel1 = await read(); assert.equal(rel1.value, AGAIN, 'the value at release is kept'); await page.mouse.move(5, 5); await page.waitForTimeout(300); const rel1b = await read(); assert.equal(rel1b.value, AGAIN); assert.equal(rel1b.status, 'preview');
  assert.deepEqual(await doc(), opened, 'nothing is stored until Apply'); await writeFile(join(output, 'samples-BC.json'), JSON.stringify({ B, Bh, C, Ch }, null, 2));

  // 4b. A second drag: fast out past the limit and straight back to 4.0 while the failing previews are still running; the late failures must not change the value.
  phase = 'drag 2: out and straight back'; const h2 = await read(); const P1 = h2.head, u1 = arrow(h2), startValue = h2.value; assert.equal(startValue, AGAIN);
  const at1 = mm => [P1[0] + u1[0] * (mm - startValue) * ppm, P1[1] + u1[1] * (mm - startValue) * ppm];
  await page.mouse.move(P1[0], P1[1]); await page.waitForTimeout(150); await page.mouse.down(); pressed = true;
  const out2 = []; for (let i = 0; i < 6; i++) { const s0 = Date.now(); out2.push(await point('D-out', at1(startValue + (14 - startValue) * (i + 1) / 6), { i })); await upto(s0, 8); }
  const in2 = []; for (let i = 0; i < 6; i++) { const s0 = Date.now(); in2.push(await point('D-in', at1(14 + (BACK - 14) * (i + 1) / 6), { i })); await upto(s0, 8); }
  const dEnd = at1(BACK), Dh = await hold('D-hold', dEnd, 1500); await writeFile(join(output, 'samples-D.json'), JSON.stringify({ out2, in2, Dh }, null, 2)); await snapshot('06-stale-final');
  report.observations.push({ label: '06-D', outValues: values(out2), inValues: values(in2), holdValues: values(Dh) }); inward(in2, in2.map((_, i) => 14 + (BACK - 14) * (i + 1) / 6), 'D back moves', out2.at(-1)); never(Dh, s => s.value !== BACK, 'D', `late failures changed the value away from the pointer's ${BACK}`); assert.equal(settled(Dh), BACK);
  never([...out2, ...in2, ...Dh], s => s.status === 'preview' && s.value > LIMIT_OK, 'D', 'a value past the limit was accepted');
  await page.mouse.up(); pressed = false; await page.waitForTimeout(300); await page.mouse.move(5, 5); await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview', null, { timeout: 30000 });
  const shown = (await read()).value; assert.equal(shown, BACK, 'the value shown at release is the pointer\'s'); assert.deepEqual(await doc(), opened, 'nothing is stored until Apply'); assert.deepEqual(await alerts(), []);

  // 5. Apply: the stored radius is the shown one; the body evaluates; the oracle checks structure, the limit and the volume.
  phase = 'Apply'; await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(opened); await hud().waitFor({ state: 'hidden', timeout: 15000 });
  const applied = await snapshot('07-applied'), docApplied = applied.doc; assert.equal(docApplied.nodes.length, 4); const last = docApplied.nodes[3]; assert.equal(last.kind, 'fillet'); assert.equal(last.radius, shown, 'the document radius equals the value shown at release');
  assert.ok(last.radius <= LIMIT_OK && last.radius < REFUSED_AT, 'the radius is within the kernel limit'); assert.ok(last.edges.includes(EDGE), `the fillet is on ${EDGE}: ${JSON.stringify(last.edges)}`);
  assert.equal(applied.bodies.bodies.length, 1, 'one body'); const volume = applied.bodies.bodies[0].volume; assert.deepEqual(await alerts(), []); await inspect('07-native', shown, volume);

  // 6. Undo (the fixture again), Redo, Save, fresh Open.
  phase = 'Undo/Redo'; await page.evaluate(() => document.activeElement?.blur());
  const undo = page.getByRole('button', { name: 'Undo', exact: true }); if (await undo.count() === 1 && await undo.isEnabled()) await undo.click(); else await page.keyboard.press('Meta+z');
  await same(opened); await snapshot('08-undone'); const redo = page.getByRole('button', { name: 'Redo', exact: true }); if (await redo.count() === 1 && await redo.isEnabled()) await redo.click(); else await page.keyboard.press('Meta+Shift+z');
  await same(docApplied); const saved = await save('fillet-drag'); assert.deepEqual(saved.doc, docApplied);
  const fresh = await freshOpen(saved.file, saved.doc, '09-fresh-open'); assert.deepEqual(fresh.doc, saved.doc, 'the opened document equals the saved one'); assert.deepEqual(await alerts(), [], 'no toast on Open');
  assert.equal(fresh.bodies.bodies.length, 1); const volumeFresh = fresh.bodies.bodies[0].volume; assert.ok(Math.abs(volumeFresh - volume) <= 1e-6 * volume, `09: volume ${volumeFresh} vs ${volume}`); await inspect('09-native', shown, volumeFresh);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (pressed && page) try { await page.mouse.up(); } catch { /* released with the context */ } if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await writeFile(join(output, 'samples-all.json'), JSON.stringify(report.samples)); delete report.samples; report.samplesFile = join(output, 'samples-all.json');
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
