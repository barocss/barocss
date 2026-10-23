import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--controls', '--source', '--emitted', '--cold'].includes(mode) && directory, 'Usage: node xy-numerical-sketch-demo.mjs --controls|--source|--emitted|--cold output-directory');
const root = fileURLToPath(new URL('../../', import.meta.url)), output = resolve(directory);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const json = value => JSON.stringify(value, (_, item) => typeof item === 'number' && Object.is(item, -0) ? JSON.rawJSON('-0') : item, 2) + '\n';
async function bundle(entry, name) {
  const result = await require('esbuild').build({ absWorkingDir: root, entryPoints: [resolve(root, entry)], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(result.metafile.inputs).every(p => !p.includes('/dist/')));
  const path = resolve(output, name + '.mjs'); writeFileSync(path, result.outputFiles[0].text); return pathToFileURL(path).href;
}
const p = (id, position) => ({ id, position }), s = (id, startPointId, endPointId) => ({ id, startPointId, endPointId });
const doc = () => ({ format: 'barocss-xy-numerical-sketch', version: 0, profile: 'bounded-length-angle-v0', id: 'brace', lengthUnit: 'mm', angleUnit: 'rad',
  points: [p('A', [.1, -.2]), p('B', [38, .5]), p('C', [23, 17])], segments: [s('AB', 'A', 'B'), s('AC', 'A', 'C'), s('BC', 'B', 'C')],
  constraints: [{ id: 'anchor', kind: 'fixed', pointId: 'A', target: [0, 0] }, { id: 'level', kind: 'horizontal', segmentId: 'AB' },
    { id: 'base_length', kind: 'length', segmentId: 'AB', lengthMM: 40 }, { id: 'brace_length', kind: 'length', segmentId: 'AC', lengthMM: 30 },
    { id: 'brace_angle', kind: 'signed-angle', segmentA: 'AB', segmentB: 'AC', angleRad: 37 * Math.PI / 180 }],
  branchGuards: [{ id: 'forward', kind: 'positive-projection', segmentId: 'AB', direction: [1, 0] }, { id: 'above', kind: 'oriented-triplet', pointA: 'A', pointB: 'B', pointC: 'C', orientation: 'ccw' }] });
if (mode === '--controls') {
  const { qr, evaluate } = await import(await bundle('packages/barocss-cad/src/sketch/xy-numerical-sketch-solver-internal.ts', 'controls'));
  const a = qr([[1, 0], [0, 1], [1, 1]], [2, 3, 5], 2); assert.equal(a.rank, 2); assert.ok(Math.abs(a.solution[0] - 2) < 1e-12 && Math.abs(a.solution[1] - 3) < 1e-12);
  assert.equal(qr([[1, 2], [2, 4]], [0, 0], 2).rank, 1); assert.equal(qr([], [], 4).rank, 0);
  assert.equal(qr([[1, 0], [0, 1e-12]], [0, 0], 2).rank, 1);
  const d = doc(); d.constraints.push({ id: 'vertical_probe', kind: 'vertical', segmentId: 'AC' }, { id: 'coincident_probe', kind: 'coincident', pointA: 'B', pointB: 'C' });
  const x = d.points.flatMap(p => p.position), e = evaluate(d, x), h = 1e-5;
  for (let j = 0; j < x.length; j++) { const plus = [...x], minus = [...x]; plus[j] += h; minus[j] -= h; const ep = evaluate(d, plus), em = evaluate(d, minus);
    for (let i = 0; i < e.residuals.length; i++) assert.ok(Math.abs((ep.residuals[i].residual - em.residuals[i].residual) / (2 * h) - e.jacobian[i][j]) < 1e-8, 'Analytic Jacobian row ' + i + ' column ' + j); }
  console.log('Tiny QR rank/solve and every constraint analytic-Jacobian finite-difference control passed'); process.exit(0);
}
if (mode === '--cold') {
  const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8')), api = await import(manifest.apiURL);
  for (const name of manifest.accepted) { const result = JSON.parse(readFileSync(resolve(output, name + '.result.json'), 'utf8'));
    assert.deepEqual(api.buildXYNumericalSketch(JSON.parse(readFileSync(resolve(output, name + '.document.json'), 'utf8'))), result);
    assert.deepEqual(api.validateXYNumericalSketch(result), result.report); const compiled = api.compileCadModel(readFileSync(resolve(output, name + '.css'), 'utf8'), { sourceVersion: 0 }); assert.ok(compiled.ok); assert.deepEqual(compiled.model, result.solution.model); }
  console.log('Cold document, whole-result and original native source round trips passed'); process.exit(0);
}
const apiURL = mode === '--source' ? await bundle('packages/barocss-cad/src/index.ts', 'source-api') : pathToFileURL(resolve(root, 'packages/barocss-cad/dist/index.js')).href;
const api = await import(apiURL), { buildXYNumericalSketch: build, solveXYNumericalSketch: solve, validateXYNumericalSketch: validate, XYNumericalSketchError: SketchError } = api;
for (const name of ['buildXYNumericalSketch', 'solveXYNumericalSketch', 'validateXYNumericalSketch', 'XYNumericalSketchError']) assert.equal(typeof api[name], 'function');
const accepted = [], refused = [];
function save(name, d) {
  const before = structuredClone(d), result = build(d); assert.deepEqual(d, before); assert.deepEqual(solve(d), result); assert.deepEqual(validate(result), result.report);
  const inputObjects = new Set(), outputObjects = new Set(); const collect = v => { if (v && typeof v === 'object') { inputObjects.add(v); Object.values(v).forEach(collect); } }; collect(d);
  const visit = v => { if (v && typeof v === 'object') { assert.ok(!inputObjects.has(v) && !outputObjects.has(v)); outputObjects.add(v); Object.values(v).forEach(visit); } }; visit(result);
  assert.ok(result.report.residuals.every(r => Math.abs(r.residual) <= r.tolerance));
  const positions = new Map(result.solution.points.map(p => [p.id, p.position]));
  result.solution.model.objects.forEach((curve, i) => { const segment = d.segments[i]; assert.equal(curve.id, segment.id); assert.equal(curve.degree, 1);
    assert.deepEqual(curve.controlPoints, [positions.get(segment.startPointId), positions.get(segment.endPointId)].map(p => [...p, 0])); });
  writeFileSync(resolve(output, name + '.document.json'), json(d)); writeFileSync(resolve(output, name + '.result.json'), json(result)); writeFileSync(resolve(output, name + '.css'), result.solution.source); accepted.push(name); return result;
}
function refusal(name, d, code) { const result = solve(d); assert.deepEqual(Object.keys(result), ['ok', 'diagnostics']); assert.equal(result.ok, false); assert.equal(result.diagnostics[0].code, code); refused.push({ name, code }); }
const first = save('brace37', doc()); assert.equal(first.report.numericalRank, 6); assert.equal(first.report.localDegreesOfFreedom, 0);
const edited = doc(); edited.constraints[3].lengthMM = 35; edited.constraints[4].angleRad = 42 * Math.PI / 180;
const second = save('brace42', edited); assert.equal(second.report.numericalRank, 6); assert.equal(second.report.localDegreesOfFreedom, 0);
assert.deepEqual(first.solution.model.objects.map(c => c.id), second.solution.model.objects.map(c => c.id));
for (const [result, length, degrees] of [[first, 30, 37], [second, 35, 42]]) {
  const [a, b, c] = result.solution.points.map(p => p.position); assert.ok(Math.hypot(...a) < 1e-7); assert.ok(Math.abs(b[0] - 40) < 1e-7 && Math.abs(b[1]) < 1e-7);
  assert.ok(Math.abs(c[0] - length * Math.cos(degrees * Math.PI / 180)) < 1e-7); assert.ok(Math.abs(c[1] - length * Math.sin(degrees * Math.PI / 180)) < 1e-7);
  assert.ok(Math.abs(Math.hypot(c[0] - a[0], c[1] - a[1]) - length) <= 1e-7); assert.ok(Math.abs(Math.atan2(c[1] - a[1], c[0] - a[0]) - degrees * Math.PI / 180) < 1e-9);
}
const under = doc(); under.constraints = []; const u = save('under', under); assert.equal(u.report.numericalRank, 0); assert.equal(u.report.localDegreesOfFreedom, 6);
const redundant = doc(); redundant.constraints.push({ ...redundant.constraints[2], id: 'duplicate_length' }); const r = save('redundant', redundant); assert.equal(r.report.numericalRank, 6); assert.equal(r.report.scalarResidualCount, 7);
const incompatible = doc(); incompatible.constraints.push({ id: 'incompatible_length', kind: 'length', segmentId: 'AB', lengthMM: 45 }); refusal('incompatible-dimensions-not-conflict-proof', incompatible, 'NONCONVERGENCE');
const branch = doc(); branch.points[2].position[1] = -17; refusal('seed-branch', branch, 'BRANCH');
const degenerate = doc(); degenerate.points[1].position = [...degenerate.points[0].position]; refusal('degenerate-seed', degenerate, 'DEGENERATE_GEOMETRY');
const range = doc(); range.points[1].position[0] = 10001; refusal('coordinate-range', range, 'UNSUPPORTED');
const nonfinite = doc(); nonfinite.points[0].position[0] = Infinity; refusal('nonfinite', nonfinite, 'INVALID_DOCUMENT');
const resource = doc(); resource.points = Array.from({ length: 17 }, (_, i) => p('P' + i, [i, i])); refusal('point-cap', resource, 'LIMIT');
const unsupported = doc(); unsupported.angleUnit = 'deg'; refusal('wrong-units', unsupported, 'UNSUPPORTED');
const unknown = doc(); unknown.constraints[0].pointId = 'missing'; refusal('reference', unknown, 'REFERENCE');
const extra = doc(); extra.extra = 1; refusal('extra-field', extra, 'INVALID_DOCUMENT');
const accessor = doc(); let getter = 0; Object.defineProperty(accessor.points[0], 'position', { enumerable: true, get() { getter++; return [0, 0]; } }); refusal('getter', accessor, 'INVALID_DOCUMENT'); assert.equal(getter, 0);
const thrown = new Proxy({}, { getPrototypeOf() { throw new Error('must not inspect thrown cause'); } });
const proxy = new Proxy({}, { ownKeys() { throw thrown; } });
assert.throws(() => build(proxy), e => e instanceof SketchError && e.code === 'INVALID_DOCUMENT' && e.cause === thrown); refusal('hostile-thrown-cause', proxy, 'INVALID_DOCUMENT');
const revoked = Proxy.revocable({}, {}); revoked.revoke(); refusal('revoked-proxy', revoked.proxy, 'INVALID_DOCUMENT');
const tampered = structuredClone(first); tampered.report.numericalRank = 0; assert.throws(() => validate(tampered), e => e instanceof SketchError && e.code === 'OWNED');
const changedPoint = structuredClone(first); changedPoint.solution.points[2].position[0] += 1e-12; assert.throws(() => validate(changedPoint), e => e.code === 'OWNED');
const affine = { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: 'third', lengthUnit: 'mm', points: [p('O', [0, 0]), p('P', [1, 0])], segments: [s('OP', 'O', 'P')], referenceLines: [{ id: 'line', anchor: [0, 1], direction: [1, -3] }], constraints: [{ id: 'fix_o', kind: 'fixed', pointId: 'O', target: [0, 0] }, { id: 'horizontal', kind: 'horizontal', segmentId: 'OP' }, { id: 'on_line', kind: 'point-on-authored-line', pointId: 'P', referenceLineId: 'line' }] };
assert.equal(api.solveXYAffineSketch(affine).diagnostics[0].code, 'REPRESENTABILITY');
writeFileSync(resolve(output, 'manifest.json'), json({ mode, apiURL, accepted, refused, brace: first.report, edited: second.report }));
execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--cold', output], { stdio: 'inherit' });
console.log(JSON.stringify({ mode, accepted, refused, rank: first.report.numericalRank, dof: first.report.localDegreesOfFreedom, iterations: [first.report.iterations, second.report.iterations], evaluations: [first.report.evaluations, second.report.evaluations] }));
