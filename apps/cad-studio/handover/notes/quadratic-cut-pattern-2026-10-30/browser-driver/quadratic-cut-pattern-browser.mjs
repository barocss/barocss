// D346 approved bounded quadratic profile. Root must freeze all sources before this actual UI flow.
// D346_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
// node test/quadratic-cut-pattern-browser.mjs /absolute/artifacts
// Actual UI authors the curve. Readonly hooks observe; no source/selection mutation hooks.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

// Root adopted existing tolerances; Decimal is an independent crosscheck, not a certified interval.
const numericContract = { status: 'FROZEN', api: 'planCurveFeaturePatternPath(raw,spacing,count)', family: 'one quadratic3poles/unitweights/samefiniteZ/actualXYtrace; arbitrary clamped domain supported by API, browser authors unit domain', positionTolerance: 1e-7, volumeTolerance: 1e-7, centroidTolerance: 1e-7, positionalAuthority: 'Reviewed exact dyadic sqrt/Simpson inverse+joint output rounding certificate; independent Decimal80 analytic ordinary-fixture crosscheck,6certified10/20referenceballs;12/24 are additional highprecisioncrosschecks, notcertifiedDecimalintervals', scope: 'ordinary polynomial quadratic; spacing10/12, live P1(20,5), fixed-orientation original3x5 CUT and translation control; too-long request refuses atomically as VALUE', refusalContract: 'Known public input/capability/parameter refusals map to VALUE; unexpected internal errors propagate; no chord or estimate-admission fallback' };
const oracleSource = String.raw`"""Independent Decimal80 polynomial quadratic length/inverse and fixed-prism material cross-check.
Product imports: zero. Decimal results are not certified intervals. Root adopted existing 1e-7 budgets.
"""
import json, sys
from decimal import Decimal as D, localcontext

def number(value):
    if isinstance(value, bool): raise AssertionError('boolean is not a scalar')
    return D.from_float(value) if isinstance(value, float) else D(value)

def checked_budget(contract, key):
    value = contract[key]
    assert value is not None, ('PENDING_HIGH_CONTRACT', key)
    result = number(value)
    assert result.is_finite() and result > 0
    return result

with localcontext() as ctx:
    ctx.prec = 80
    data = json.load(sys.stdin)
    contract = data['numericContract']
    assert contract['status'] == 'FROZEN', 'PENDING_HIGH_CONTRACT'
    position_limit = checked_budget(contract, 'positionTolerance')
    volume_limit = checked_budget(contract, 'volumeTolerance')
    centroid_limit = checked_budget(contract, 'centroidTolerance')
    curve = data['curve']
    assert curve['degree'] == 2 and curve['knots'] == [0, 0, 0, 1, 1, 1]
    assert curve['weights'] == [1, 1, 1] and len(curve['controlPoints']) == 3
    poles = [[number(x) for x in p] for p in curve['controlPoints']]
    assert all(len(p) == 3 and p[2] == 0 for p in poles)
    p0, p1, p2 = poles
    v = [2 * (p1[k] - p0[k]) for k in range(3)]
    d = [2 * (p2[k] - 2 * p1[k] + p0[k]) for k in range(3)]
    A = sum(x * x for x in d)
    B = 2 * sum(x * y for x, y in zip(v, d))
    C = sum(x * x for x in v)
    K = 4 * A * C - B * B
    assert A > 0 and K > 0, 'Only the ordinary noncollinear polynomial cross-check is implemented'
    sqrt_A = A.sqrt()
    def primitive(t):
        speed = (A * t * t + B * t + C).sqrt()
        z = 2 * A * t + B
        logarithm = 2 * sqrt_A * speed + z
        assert logarithm > 0
        return z * speed / (4 * A) + K * logarithm.ln() / (8 * A * sqrt_A)
    start = primitive(D(0))
    def length(t): return primitive(t) - start
    total = length(D(1))
    feature = data['feature']
    count = feature['count']; spacing = number(feature['spacing'])
    assert isinstance(count, int) and 1 <= count <= 64 and spacing > 0
    assert (count - 1) * spacing < total, 'This driver uses interior requests, not a rounded full-length endpoint'
    offsets, parameters, residuals = [], [], []
    for k in range(count):
        distance = k * spacing
        low, high = D(0), D(1)
        if k:
            for _ in range(320):
                mid = (low + high) / 2
                if mid == low or mid == high: break
                if length(mid) < distance: low = mid
                else: high = mid
            t = (low + high) / 2
        else: t = D(0)
        point = [(1 - t) ** 2 * p0[a] + 2 * (1 - t) * t * p1[a] + t * t * p2[a] for a in range(3)]
        offsets.append([point[a] - p0[a] for a in range(3)])
        parameters.append(str(t)); residuals.append(str(abs(length(t) - distance)))
    plan = data['plan']
    assert len(plan['offsets']) == count
    bounds = plan['length']
    assert number(bounds['lower']) <= total <= number(bounds['upper']), 'Independent Decimal length lies inside reported bounds (cross-check, not interval proof)'
    plan_errors = []
    for actual, expected in zip(plan['offsets'], offsets):
        assert len(actual) == 3
        error = sum((number(x) - y) ** 2 for x, y in zip(actual, expected)).sqrt()
        assert error <= position_limit, ('planned true-curve offset cross-check', str(error))
        plan_errors.append(str(error))
    stock = data['originalStock']; tool = data['originalCutter']
    lo, hi = [number(x) for x in stock['min']], [number(x) for x in stock['max']]
    tl, th = [number(x) for x in tool['min']], [number(x) for x in tool['max']]
    stock_volume = (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2])
    tool_volume = (th[0] - tl[0]) * (th[1] - tl[1]) * (th[2] - tl[2])
    boxes = [([tl[a] + offset[a] for a in range(3)], [th[a] + offset[a] for a in range(3)]) for offset in offsets]
    for i, (a, b) in enumerate(boxes):
        assert all(lo[k] <= a[k] < b[k] <= hi[k] for k in range(3)), 'Fixture cuts must stay inside stock'
        for c, e in boxes[:i]: assert any(b[k] <= c[k] or e[k] <= a[k] for k in range(3)), 'Fixture cut interiors must be disjoint'
    volume = stock_volume - count * tool_volume
    centroid = [(stock_volume * (lo[a] + hi[a]) / 2 - tool_volume * sum((x[a] + y[a]) / 2 for x, y in boxes)) / volume for a in range(3)]
    target = data['target']; brep = target['brep']
    assert target['check']['valid'] and len(brep['bodies']) == 1 and brep['bodies'][0]['kind'] == 'solid'
    assert brep['shells'] and all(s['closed'] for s in brep['shells'])
    for label, mass in [('public', target['mass']), ('native', target['nativeMass']), ('Model', target['model']), ('actualStudio', data['studio'])]:
        assert abs(number(mass['volume']) - volume) <= volume_limit, (label, 'volume')
        assert all(abs(number(actual) - expected) <= centroid_limit for actual, expected in zip(mass['centroid'], centroid)), (label, 'centroid')
    names = target['names']; assert len(set(names)) == len(names)
    for k in range(1, count):
        for side in range(4): assert any(n.endswith('.side%d@%d' % (side, k)) for n in names), ('fixed source wall name', k, side)
    assert not any(n.endswith('@%d' % count) for n in names), 'No unrequested placement suffix'
    worst_corner = D(0)
    for a, b in boxes:
        for x in (a[0], b[0]):
            for y in (a[1], b[1]):
                for z in (a[2], b[2]):
                    expected = (x, y, z)
                    error = min(sum((number(v['point'][axis]) - expected[axis]) ** 2 for axis in range(3)).sqrt() for v in brep['vertices'])
                    worst_corner = max(worst_corner, error)
                    assert error <= position_limit, ('fixed-orientation native cutter corner', str(error))
    print(json.dumps({'status': 'PASS', 'method': 'Decimal80 closed-form sqrt-quadratic primitive and independent bisection',
      'quality': 'High-precision ordinary-fixture cross-check; not a certified interval or universal error theorem',
      'length': str(total), 'reportedLength': bounds, 'plannedOffsetErrors': plan_errors, 'parameters': parameters, 'analyticArcResiduals': residuals,
      'offsets': [[str(x) for x in p] for p in offsets], 'volume': str(volume), 'centroid': [str(x) for x in centroid],
      'worstNativeCornerError': str(worst_corner), 'fixedOrientation': True, 'productImports': 0}, indent=2))
`;
assert.equal(process.env.D346_SOURCE_FROZEN, '1', 'Root must freeze all writers before D346 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
assert.equal(numericContract.status, 'FROZEN', 'Root must adopt and freeze the D346 numerical contract before generation');
assert.equal(typeof numericContract.positionalAuthority, 'string', 'High/root positional authority must be adopted before generation');
for (const key of ['positionTolerance', 'volumeTolerance', 'centroidTolerance']) assert.ok(typeof numericContract[key] === 'number' && Number.isFinite(numericContract[key]) && numericContract[key] > 0, `${key} must be a finite positive adopted budget`);
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'SINGLE_QUADRATIC_FIXED_ORIENTATION_CUT', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', numericContract, states: [], reads: [], oracles: [], files: [], downloads: [], refusals: [], selections: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One ordinary unit-domain quadratic browser fixture; arbitrary-domain and bounded work admission are focused-test scope. Decimal length/inverse is a highprecision crosscheck, not a certified interval.', 'Original asymmetric CUT is replayed by translation with fixed orientation; no tangent rotation or clipping.', 'Witness420 follows target in seed, so output-reorder selection aliases cannot be hidden.', 'Actual Sketch/Make curves/Control point UI authors coefficients; hooks only observe.', 'Hashes are source provenance, not geometry or curve-length oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const seedSource = `import {writeFileSync} from 'node:fs';import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
const p=part('D346 curved CUT').box({w:60,d:40,h:10}).subtract(p=>p.box({w:3,d:5,h:10,x:7,y:6})).box({w:12,d:7,h:5,x:80,y:-3,z:1});
writeFileSync(process.argv[2],JSON.stringify(p.doc,null,2));`;
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {partBreps,evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {modelOf} from '../../packages/barocss-cad-model/src/engine/direct.ts';import {checkBrep,brepMassProperties} from '../../packages/barocss-cad/src/index.ts';
import {planCurveFeaturePatternPath} from '../../packages/barocss-cad/src/api/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc),p=part('D346 observed',doc),view=evaluateDoc(doc,0);assert.ok(view.ok);
const bodies=partBreps(doc).map(({key,brep})=>({key,brep,check:checkBrep(brep,{strict:true}),mass:p.body(key).mass({density:1}),nativeMass:brepMassProperties(brep,1),names:p.body(key).select().faces().names().sort(),model:view.bodies.find(b=>b.key===key)}));
const curves=(doc.direct?.objects??[]).map(object=>{const model=modelOf(doc.direct.sources[object.source]),matches=model.objects.filter(g=>g.id===object.geometry);assert.equal(matches.length,1);return{object,geometry:matches[0]};});
const plans=doc.nodes.flatMap((node,index)=>{if(node.kind!=='curve-feature-pattern')return[];const geometry='objectId' in node.path?curves.find(c=>c.object.id===node.path.objectId)?.geometry:node.path;assert.ok(geometry);const raw={degree:geometry.degree,knots:geometry.knots,controlPoints:geometry.controlPoints,weights:geometry.weights},rawBefore=JSON.stringify(raw),plan=planCurveFeaturePatternPath(raw,node.spacing,node.count);assert.equal(JSON.stringify(raw),rawBefore);return[{index,plan}];});
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify({bodies,curves,plans}));`;
const doc = () => page.evaluate(() => window.__studioDoc);
const hud = () => page.getByRole('dialog', { name: 'Path cut pattern', exact: true });
const directPanel = () => page.getByRole('complementary', { name: 'Direct geometry', exact: true });
const sketchPanel = () => page.getByRole('complementary', { name: 'Sketch', exact: true });
const editor = () => page.locator('.node-editor');
async function ready() { await page.waitForFunction(() => { const b = window.__studioBodies?.(); return window.__studioFresh === true && b?.fresh && b.massReady && b.bodies.length === 2; }, null, { timeout: 60000 }); }
async function same(before) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(before), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), before); }
async function changed(before) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) !== x, JSON.stringify(before), { timeout: 60000 }); await ready(); }
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(), selection: window.__studioSelection,
    hud: document.querySelector('.hud')?.textContent ?? null, editor: document.querySelector('.node-editor')?.textContent ?? null, direct: document.querySelector('.direct-panel')?.textContent ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent) }), label);
  report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2)); await writeFile(join(output, `${label}.html`), await page.content()); await page.screenshot({ path: join(output, `${label}.png`), fullPage: true }); await persist();
}
async function freshOpen(file, expected, label) {
  phase = `fresh Open ${label}`; if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.stack ?? String(e))); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); }); page.on('download', d => report.downloads.push({ phase, suggestedFilename: d.suggestedFilename() })); page.on('dialog', d => d.accept());
  await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await page.setInputFiles('input[aria-label="Model file"]', file); await same(expected); await snapshot(label);
}
async function command(label) { await page.keyboard.press('Space'); await page.locator('.palette input').fill(label); await page.keyboard.press('Enter'); }
async function worldClick(point) { const pixel = await page.evaluate(point => window.__studioScreenOf?.(point), point); assert.ok(pixel?.length === 2); await page.mouse.click(pixel[0], pixel[1]); }
async function selectTarget() {
  await ready(); const state = await page.evaluate(() => window.__studioBodies()), index = state.bodies.findIndex(b => b.key !== report.witness.key); assert.ok(index >= 0);
  await page.locator('.outliner .ol:not(.ol-step)').nth(index).click(); await page.waitForFunction(i => window.__studioSelection?.selection.bodies.length === 1 && window.__studioSelection.selection.bodies[0] === i, index);
}
async function selectPath() { const object = (await doc()).direct.objects.find(o => o.id === report.pathObjectId); assert.ok(object); await page.locator('.outliner .ol.direct').filter({ hasText: object.name }).click(); await directPanel().waitFor(); }
async function editPole(axis, value, label) {
  phase = `actual control-pole ${label}`; await selectPath(); await directPanel().getByLabel('Control point', { exact: true }).selectOption('1');
  const before = await doc(), input = directPanel().getByLabel(axis, { exact: true }); await input.fill(String(value)); await input.press('Enter'); await changed(before); await snapshot(label); return { before, after: await doc() };
}
async function inspect(label) {
  phase = `public native observation ${label}`; await ready(); const accepted = await doc(), file = join(output, `${label}.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout); assert.equal(result.bodies.length, 2);
  const witness = report.witness ? result.bodies.find(b => b.key === report.witness.key) : result.bodies.find(b => Math.abs(b.mass.volume - 420) < 1e-7 && b.mass.centroid.every((v, k) => Math.abs(v - [86, .5, 3.5][k]) < 1e-7)); assert.ok(witness);
  report.witness ??= { key: witness.key, names: witness.names }; assert.deepEqual(witness.names, report.witness.names); assert.equal(witness.check.valid, true); assert.ok(Math.abs(witness.mass.volume - 420) < 1e-7); witness.mass.centroid.forEach((v, k) => assert.ok(Math.abs(v - [86, .5, 3.5][k]) < 1e-7));
  const target = result.bodies.find(b => b.key !== witness.key); assert.ok(target); assert.equal(target.check.valid, true); assert.equal(target.brep.bodies.length, 1); assert.equal(target.brep.bodies[0].kind, 'solid'); assert.ok(target.brep.shells.every(s => s.closed));
  const feature = accepted.nodes.findLast(n => n.kind === 'curve-feature-pattern'), curve = report.pathObjectId ? result.curves.find(c => c.object.id === report.pathObjectId)?.geometry : null;
  if (curve) { assert.equal(curve.kind, 'curve'); assert.equal(curve.degree, 2); assert.deepEqual(curve.knots, [0, 0, 0, 1, 1, 1]); assert.equal(curve.controlPoints.length, 3); assert.deepEqual(curve.weights, [1, 1, 1]); }
  if (feature) {
    const state = await page.evaluate(() => window.__studioBodies()), studio = state.bodies.find(b => b.key === target.key); assert.ok(studio); assert.ok(curve);
    const plan = result.plans.find(p => p.index === accepted.nodes.lastIndexOf(feature))?.plan; assert.ok(plan);
    const input = { feature, curve, target, studio, plan, numericContract, originalStock: { min: [0, 0, 0], max: [60, 40, 10] }, originalCutter: { min: [7, 6, 0], max: [10, 11, 10] } };
    await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
    const check = spawnSync('python3', [join(output, 'curve-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? ''); assert.equal(check.status, 0, check.stderr);
    // Final High-approved oracle must check true-curve length/inverse/position, independent V/C, native corners,
    // stable @k exclusions and the asymmetric cutter's fixed orientation. No chord or product-mass oracle substitute.
    const verified = JSON.parse(check.stdout); assert.equal(verified.status, 'PASS'); report.oracles.push({ label, verified });
  }
  assert.deepEqual(await doc(), accepted); report.reads.push({ label, ...result }); await persist(); return { ...result, target, curve };
}
async function selectionAfterApply(label) {
  const state = await page.evaluate(() => ({ selection: window.__studioSelection.selection, order: window.__studioBodies().bodies.map(b => b.key) }));
  const indices = [...state.selection.bodies, ...['faces', 'edges', 'vertices'].flatMap(key => (state.selection[key] ?? []).map(p => p.body))], selectedKeys = indices.map(i => state.order[i]); report.selections.push({ label, ...state, selectedKeys }); await persist();
  assert.ok(!selectedKeys.includes(report.witness.key), 'Successful Path Apply must not alias the consumed target pick to witness420');
}
async function configure(spacing) { await hud().getByLabel('Path', { exact: true }).selectOption(report.pathObjectId); await hud().getByLabel('Spacing', { exact: true }).fill(String(spacing)); await hud().getByLabel('Count', { exact: true }).fill('3'); }
async function preview(status) { await page.waitForFunction(status => document.querySelector('.hud .status')?.textContent === status, status, { timeout: 60000 }); }
async function save(label) { await ready(); const accepted = await doc(); const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]); const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted); report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted }; }
async function editable(index, spacing) { await page.locator(`.history .hs[data-node-index="${index}"]`).click(); await editor().waitFor(); assert.equal(await editor().getByLabel('Path', { exact: true }).inputValue(), report.pathObjectId); assert.equal(await editor().getByLabel('Spacing', { exact: true }).inputValue(), String(spacing)); assert.equal(await editor().getByLabel('Count', { exact: true }).inputValue(), '3'); }
const initialFiles = ['apps/cad-studio/test/quadratic-cut-pattern-browser.mjs', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/DirectPanel.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/app/directCurveCandidate.ts',
  'packages/barocss-cad-model/src/engine/curveFeaturePattern.ts', 'packages/barocss-cad-model/src/engine/curveSource.ts', 'packages/barocss-cad-model/src/app/commands.ts', 'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad/src/features/curve-cut-pattern.ts', 'packages/barocss-cad/src/api/index.ts', 'packages/barocss-cad/src/api/spec.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'curve-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0, status: numericContract.status };
  const buildInputs = [];
  async function compile(label, contents) {
    const sourcefile = `d346-${label}.ts`, virtual = resolve(app, sourcefile); const result = await build({ stdin: { contents, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true }); await writeFile(join(output, `${label}.ts`), contents); await writeFile(join(output, `${label}-metafile.json`), JSON.stringify(result.metafile, null, 2));
    // Stdin has no disk path. Its exact source/hash is captured and the virtual input is explicitly excluded.
    buildInputs.push(...Object.keys(result.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual)); report.virtualSources ??= []; report.virtualSources.push({ label, hash: hash(contents), virtualInputExcluded: virtual }); const file = join(output, `${label}.mjs`); await writeFile(file, result.outputFiles[0].contents); return file;
  }
  const generator = await compile('seed', seedSource); inspector = await compile('inspector', inspectSource); const seedFile = join(output, 'seed.bcad'), generated = spawnSync(process.execPath, [generator, seedFile], { encoding: 'utf8' }); await writeFile(join(output, 'seed.stdout.txt'), generated.stdout ?? ''); await writeFile(join(output, 'seed.stderr.txt'), generated.stderr ?? ''); assert.equal(generated.status, 0, generated.stderr); const seed = JSON.parse(await readFile(seedFile, 'utf8'));
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file)); frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts']; report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length; for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' }); server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen(); const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;
  await freshOpen(seedFile, seed, '01-original-seed'); await inspect('01-original-native');
  phase = 'actual Sketch single line'; await page.keyboard.press('Escape'); await command('Sketch'); await sketchPanel().waitFor(); await sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy'); await page.getByRole('button', { name: 'Line', exact: true }).click(); await worldClick([0, 0, 0]); await worldClick([20, 20, 0]); await page.getByRole('button', { name: 'Select', exact: true }).click();
  for (const [i, point] of [[0, 0], [20, 20]].entries()) for (const [axis, value] of point.entries()) await sketchPanel().getByLabel(`Point ${i + 1} ${'XY'[axis]}`, { exact: true }).fill(String(value));
  const beforeCurves = await doc(); await page.getByRole('button', { name: 'Make curves', exact: true }).click(); await changed(beforeCurves); await sketchPanel().waitFor({ state: 'hidden' });
  const made = await doc(); assert.equal(made.direct.objects.length, 1); report.pathObjectId = made.direct.objects[0].id; const line = await inspect('02-made-quadratic-line'); assert.deepEqual(line.curve.controlPoints, [[0, 0, 0], [10, 10, 0], [20, 20, 0]]);
  await editPole('X', 20, '03-pole-X'); const poleEdit = await editPole('Y', 0, '04-real-quadratic-authored'), curved = poleEdit.after; const curvedRead = await inspect('04-curved-native'); assert.deepEqual(curvedRead.curve.controlPoints, [[0, 0, 0], [20, 0, 0], [20, 20, 0]]); assert.deepEqual(curved.nodes, seed.nodes);
  await selectTarget(); const selected = await page.evaluate(() => window.__studioSelection.selection); await command('Path cut pattern'); await hud().waitFor(); await configure(10); await preview('preview'); assert.deepEqual(await doc(), curved); await snapshot('05-preview');
  await hud().getByLabel('Spacing', { exact: true }).fill('100'); await preview('refused'); assert.equal(await hud().getByRole('button', { name: 'Apply', exact: true }).isDisabled(), true); assert.deepEqual(await doc(), curved); assert.deepEqual(await page.evaluate(() => window.__studioSelection.selection), selected); report.refusals.push({ kind: 'distance-too-long', acceptedDocUnchanged: true, selectionUnchanged: true }); await snapshot('06-distance-refused');
  await hud().getByLabel('Spacing', { exact: true }).fill('10'); await preview('preview'); await hud().getByRole('button', { name: 'Cancel', exact: true }).click(); await same(curved); await page.keyboard.press('Meta+z'); await same(poleEdit.before); await page.keyboard.press('Meta+Shift+z'); await same(curved);
  await selectTarget(); await command('Path cut pattern'); await hud().waitFor(); await configure(10); await preview('preview'); phase = 'actual Path Apply'; await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(curved); await hud().waitFor({ state: 'hidden' }); await selectionAfterApply('07-applied-selection');
  const accepted = await doc(), index = accepted.nodes.length - 1, feature = accepted.nodes[index]; assert.equal(feature.kind, 'curve-feature-pattern'); assert.deepEqual(feature.path, { objectId: report.pathObjectId }); assert.deepEqual(accepted.nodes.slice(0, -1), curved.nodes); report.featureId = feature.id; await snapshot('07-applied'); const base = await inspect('07-curved-cuts-native');
  await page.keyboard.press('Meta+z'); await same(curved); await page.keyboard.press('Meta+Shift+z'); await same(accepted); const saved = await save('curved-cuts'); await freshOpen(saved.file, saved.doc, '08-fresh-open'); const reopened = await inspect('08-fresh-native'); assert.deepEqual(reopened.target.names, base.target.names);
  await editable(index, 10); const beforeSpacing = await doc(); await editor().getByLabel('Spacing', { exact: true }).fill('12'); await editor().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(beforeSpacing); await editor().waitFor({ state: 'hidden' }); const spaced = await doc(); assert.equal(spaced.nodes[index].id, feature.id); await snapshot('09-spacing-edited'); await inspect('09-spacing-native');
  const live = await editPole('Y', 5, '10-live-P1-edit'); assert.deepEqual(live.after.nodes, spaced.nodes); const liveRead = await inspect('10-live-native');
  const beforeMove = await doc(); await selectPath(); for (const [axis, value] of [['ΔX', 3], ['ΔY', 4], ['ΔZ', 0]]) await directPanel().getByLabel(axis, { exact: true }).fill(String(value)); await directPanel().getByRole('button', { name: 'Move', exact: true }).click(); await changed(beforeMove); const moved = await doc(); assert.deepEqual(moved.nodes, beforeMove.nodes); const movedRead = await inspect('11-path-translation-native'); await snapshot('11-path-translation'); report.translationControl = { before: { curve: liveRead.curve, mass: liveRead.target.mass }, after: { curve: movedRead.curve, mass: movedRead.target.mass }, authority: 'Independent oracle recomputes offsets relative to each current P0; compare within final adopted contract' };
  await page.keyboard.press('Meta+z'); await same(beforeMove); await page.keyboard.press('Meta+Shift+z'); await same(moved);
  const finalSaved = await save('live-quadratic'); await freshOpen(finalSaved.file, finalSaved.doc, '12-final-fresh-open'); const finalRead = await inspect('12-final-native'); assert.deepEqual(finalRead.curve, movedRead.curve); assert.deepEqual(finalRead.target.names, movedRead.target.names); await editable(index, 12); await snapshot('13-final-editable');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []); report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
