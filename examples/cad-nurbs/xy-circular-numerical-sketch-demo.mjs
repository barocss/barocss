import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [mode, directory] = process.argv.slice(2);
assert.ok(['--controls', '--source', '--emitted', '--cold'].includes(mode) && directory,
  'Usage: node xy-circular-numerical-sketch-demo.mjs --controls|--source|--emitted|--cold output-directory');
const root = fileURLToPath(new URL('../../', import.meta.url)), output = resolve(directory);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
// Preserve signed zeros structurally, including documents and owned native coefficients.
const json = value => JSON.stringify(value, (_, item) => typeof item === 'number' && Object.is(item, -0) ? JSON.rawJSON('-0') : item, 2) + '\n';
async function bundle(entry, name) {
  const result = await require('esbuild').build({ absWorkingDir: root, entryPoints: [resolve(root, entry)], bundle: true,
    platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(result.metafile.inputs).every(p => !p.includes('/dist/')));
  const path = resolve(output, name + '.mjs'); writeFileSync(path, result.outputFiles[0].text); return pathToFileURL(path).href;
}
const p = (id, position) => ({ id, position }), s = (id, startPointId, endPointId) => ({ id, startPointId, endPointId });
const circle = (id, centerPointId, valueMM) => ({ id, centerPointId, radius: { id: id + '_radius', valueMM }, seamId: id + '_seam' });
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const doc = () => ({ format: 'barocss-xy-circular-numerical-sketch', version: 0, profile: 'bounded-radius-interior-tangent-v0',
  id: 'corner_circle', lengthUnit: 'mm', angleUnit: 'rad',
  points: [p('A', [0, 0]), p('B', [40, 30]), p('D', [-30, 40]), p('C', [1.2, 7.2])],
  segments: [s('AB', 'A', 'B'), s('AD', 'A', 'D')], circles: [circle('round', 'C', 4.8)],
  constraints: [{ id: 'fix_A', kind: 'fixed', pointId: 'A', target: [0, 0] },
    { id: 'fix_B', kind: 'fixed', pointId: 'B', target: [40, 30] }, { id: 'fix_D', kind: 'fixed', pointId: 'D', target: [-30, 40] },
    { id: 'radius_target', kind: 'radius', circleId: 'round', radiusMM: 5 },
    { id: 'tangent_AB', kind: 'line-circle-tangent', segmentId: 'AB', circleId: 'round', side: 'left' },
    { id: 'tangent_AD', kind: 'line-circle-tangent', segmentId: 'AD', circleId: 'round', side: 'right' }], branchGuards: [] });

if (mode === '--controls') {
  const { evaluate } = await import(await bundle('packages/barocss-cad/src/xy-circular-numerical-sketch-solver-internal.ts', 'controls'));
  const d = doc();
  // Both tangent sides, all moving endpoint columns, shared A/C identities, and every old residual kind.
  d.circles.push(circle('second', 'C', 4.9));
  d.constraints.push({ id: 'second_tangent', kind: 'line-circle-tangent', segmentId: 'AB', circleId: 'second', side: 'left' },
    { id: 'horizontal_probe', kind: 'horizontal', segmentId: 'AB' }, { id: 'vertical_probe', kind: 'vertical', segmentId: 'AD' },
    { id: 'coincident_probe', kind: 'coincident', pointA: 'A', pointB: 'C' }, { id: 'length_probe', kind: 'length', segmentId: 'AB', lengthMM: 50 },
    { id: 'angle_probe', kind: 'signed-angle', segmentA: 'AB', segmentB: 'AD', angleRad: Math.PI / 2 });
  const x = [...d.points.flatMap(p => p.position), ...d.circles.map(c => c.radius.valueMM)], e = evaluate(d, x), h = 1e-5;
  for (let j = 0; j < x.length; j++) {
    const plus = [...x], minus = [...x]; plus[j] += h; minus[j] -= h;
    const ep = evaluate(d, plus), em = evaluate(d, minus);
    for (let i = 0; i < e.residuals.length; i++) close((ep.residuals[i].residual - em.residuals[i].residual) / (2 * h), e.jacobian[i][j], 1e-8);
  }
  const tangent = e.residuals.findIndex(r => r.constraintId === 'tangent_AB');
  const n = [-.6, .8], t = (1.2 * 40 + 7.2 * 30) / 2500;
  for (let k = 0; k < 2; k++) { close(e.jacobian[tangent][k], (t - 1) * n[k], 1e-14);
    close(e.jacobian[tangent][2 + k], -t * n[k], 1e-14); close(e.jacobian[tangent][6 + k], n[k], 1e-14); }
  assert.equal(e.jacobian[tangent][8], -1); assert.equal(e.jacobian[tangent][9], 0);
  writeFileSync(resolve(output, 'controls.json'), json({ columns: x.length, rows: e.residuals.length, analyticAndFiniteDifference: true, contacts: e.contacts }));
  console.log('Both sides, moving endpoints, shared identities and all analytic-Jacobian finite-difference controls passed'); process.exit(0);
}
if (mode === '--cold') {
  const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8')), api = await import(manifest.apiURL);
  for (const name of manifest.accepted) {
    const result = JSON.parse(readFileSync(resolve(output, name + '.result.json'), 'utf8'));
    assert.deepEqual(api.buildXYCircularNumericalSketch(JSON.parse(readFileSync(resolve(output, name + '.document.json'), 'utf8'))), result);
    assert.deepEqual(api.validateXYCircularNumericalSketch(result), result.report);
    const compiled = api.compileCadModel(readFileSync(resolve(output, name + '.css'), 'utf8'), { sourceVersion: 0 });
    assert.ok(compiled.ok); assert.deepEqual(compiled.model, result.solution.model); assert.deepEqual(compiled.ir, result.solution.ir);
  }
  console.log('Cold documents, complete owned results and original native sources reconstruct structurally'); process.exit(0);
}
const apiURL = mode === '--source' ? await bundle('packages/barocss-cad/src/index.ts', 'source-api') : pathToFileURL(resolve(root, 'packages/barocss-cad/dist/index.js')).href;
const api = await import(apiURL), { buildXYCircularNumericalSketch: build, solveXYCircularNumericalSketch: solve,
  validateXYCircularNumericalSketch: validate, XYCircularNumericalSketchError: SketchError } = api;
for (const name of ['buildXYCircularNumericalSketch', 'solveXYCircularNumericalSketch', 'validateXYCircularNumericalSketch', 'XYCircularNumericalSketchError']) assert.equal(typeof api[name], 'function');
const accepted = [], refused = [];
function save(name, d) {
  const before = structuredClone(d), result = build(d); assert.equal(result.ok, true); assert.deepEqual(d, before);
  assert.deepEqual(solve(d), result); assert.deepEqual(validate(result), result.report);
  const inputObjects = new Set(), outputObjects = new Set();
  const collect = v => { if (v && typeof v === 'object') { inputObjects.add(v); Object.values(v).forEach(collect); } }; collect(d);
  const visit = v => { if (v && typeof v === 'object') { assert.ok(!inputObjects.has(v) && !outputObjects.has(v)); outputObjects.add(v); Object.values(v).forEach(visit); } }; visit(result);
  assert.ok(result.report.residuals.every(r => Math.abs(r.residual) <= r.tolerance));
  const positions = new Map(result.solution.points.map(p => [p.id, p.position])), objects = result.solution.model.objects;
  assert.deepEqual(objects.map(c => c.id), [...d.segments, ...d.circles].map(c => c.id));
  for (const [i, segment] of d.segments.entries()) {
    const curve = objects[i]; assert.equal(curve.degree, 1); assert.deepEqual(curve.knots, [0, 0, 1, 1]);
    assert.deepEqual(curve.controlPoints, [positions.get(segment.startPointId), positions.get(segment.endPointId)].map(p => [...p, 0]));
  }
  const samples = [];
  for (const [i, c] of d.circles.entries()) {
    const curve = objects[d.segments.length + i], center = positions.get(c.centerPointId), radius = result.solution.radii[i];
    assert.equal(radius.circleId, c.id); assert.equal(radius.radiusId, c.radius.id); assert.equal(curve.degree, 2);
    assert.deepEqual(curve.knots, [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4]);
    assert.deepEqual(curve.weights, [1, Math.SQRT1_2, 1, Math.SQRT1_2, 1, Math.SQRT1_2, 1, Math.SQRT1_2, 1]);
    const offsets = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0]];
    assert.equal(curve.controlPoints.length, 9);
    curve.controlPoints.forEach((pole, j) => { close(pole[0], center[0] + offsets[j][0] * radius.valueMM, 1e-12);
      close(pole[1], center[1] + offsets[j][1] * radius.valueMM, 1e-12); assert.equal(pole[2], 0); });
    assert.deepEqual(curve.controlPoints[0], curve.controlPoints[8]);
    assert.deepEqual(result.solution.bindings[i], { circleId: c.id, centerPointId: c.centerPointId, radiusId: c.radius.id,
      seamId: c.seamId, seamParameters: [0, 4], seamPoleIndices: [0, 8] });
    for (const parameter of [0, .125, .5, .875, 1, 1.375, 2, 2.625, 3, 3.5, 4]) {
      const point = api.evaluateCurve(curve, parameter); close(Math.hypot(point[0] - center[0], point[1] - center[1]), radius.valueMM, 1e-10);
      assert.equal(point[2], 0); samples.push({ circleId: c.id, parameter, point });
    }
  }
  for (const contact of result.report.contacts) {
    const segment = d.segments.find(s => s.id === contact.segmentId), c = d.circles.find(c => c.id === contact.circleId);
    const a = positions.get(segment.startPointId), b = positions.get(segment.endPointId), center = positions.get(c.centerPointId);
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), t = ((center[0] - a[0]) * dx + (center[1] - a[1]) * dy) / (length * length);
    const signedDistance = (-dy * (center[0] - a[0]) + dx * (center[1] - a[1])) / length;
    assert.ok(t > 0 && t < 1); close(contact.contactParameter, t, 1e-12); close(contact.signedDistanceMM, signedDistance, 1e-12);
    close(contact.contactXY[0], a[0] + t * dx, 1e-12); close(contact.contactXY[1], a[1] + t * dy, 1e-12);
    close((contact.side === 'left' ? 1 : -1) * signedDistance, contact.radiusMM);
  }
  writeFileSync(resolve(output, name + '.document.json'), json(d)); writeFileSync(resolve(output, name + '.result.json'), json(result));
  writeFileSync(resolve(output, name + '.samples.json'), json(samples)); writeFileSync(resolve(output, name + '.css'), result.solution.source);
  accepted.push(name); return result;
}
function refusal(name, d, code) {
  const result = solve(d); assert.deepEqual(Object.keys(result), ['ok', 'diagnostics']); assert.equal(result.ok, false, name);
  assert.equal(result.diagnostics[0].code, code, name); refused.push({ name, code });
}
const first = save('radius5', doc()), edited = doc(); edited.constraints[3].radiusMM = 8;
const second = save('radius8', edited);
for (const [result, radius, center, contacts, t] of [[first, 5, [1, 7], [[4, 3], [-3, 4]], .1], [second, 8, [1.6, 11.2], [[6.4, 4.8], [-4.8, 6.4]], .16]]) {
  assert.equal(result.report.numericalRank, 9); assert.equal(result.report.localDegreesOfFreedom, 0); assert.equal(result.report.unknownCount, 9);
  result.solution.points.find(p => p.id === 'C').position.forEach((v, i) => close(v, center[i])); close(result.solution.radii[0].valueMM, radius);
  result.report.contacts.forEach((contact, i) => { close(contact.contactParameter, t, 1e-8); contact.contactXY.forEach((v, j) => close(v, contacts[i][j])); });
}
assert.deepEqual(first.solution.bindings, second.solution.bindings); assert.deepEqual(first.solution.model.objects.map(c => c.id), second.solution.model.objects.map(c => c.id));
const under = doc(); under.constraints.splice(3, 1); const u = save('free_radius', under); assert.equal(u.report.numericalRank, 8); assert.equal(u.report.localDegreesOfFreedom, 1);
const redundant = doc(); redundant.constraints.push({ ...redundant.constraints[3], id: 'duplicate_radius' });
const r = save('redundant', redundant); assert.equal(r.report.numericalRank, 9); assert.equal(r.report.scalarResidualCount, 10);
const zero = doc(); zero.points = [p('C', [-0, -0])]; zero.segments = []; zero.constraints = [];
const z = save('signed_zero', zero); assert.ok(Object.is(z.document.points[0].position[0], -0)); assert.ok(Object.is(z.solution.points[0].position[1], -0));
// Exercise reachable ceilings as well as over-limit refusals. The 64-row ceiling is
// reachable with 32 fixed constraints; exceeding it also exceeds the constraint cap.
const ceilings = doc(); ceilings.points.push(...Array.from({ length: 10 }, (_, i) => p('P' + i, [i, i])));
ceilings.circles = [circle('round', 'C', .001), circle('K1', 'C', 1), circle('K2', 'C', 4.8), circle('K3', 'C', 5)];
ceilings.segments.push(...Array.from({ length: 6 }, (_, i) => s('S' + i, 'A', 'B')));
ceilings.constraints = Array.from({ length: 32 }, (_, i) => ({ id: 'F' + i, kind: 'fixed', pointId: 'A', target: [0, 0] }));
ceilings.branchGuards = Array.from({ length: 16 }, (_, i) => ({ id: 'G' + i, kind: 'positive-projection', segmentId: 'AB', direction: [1, 0] }));
const ceilingResult = save('reachable_caps', ceilings); assert.equal(ceilingResult.report.unknownCount, 32);
assert.equal(ceilingResult.report.scalarResidualCount, 64); assert.equal(ceilingResult.report.numericalRank, 2);
const maxRadius = structuredClone(z.document); maxRadius.points[0].position = [0, 0]; maxRadius.circles[0].radius.valueMM = 10000;
save('maximum_radius', maxRadius);
const conflict = doc(); conflict.constraints.push({ id: 'conflicting_radius', kind: 'radius', circleId: 'round', radiusMM: 8 }); refusal('conflicting-radius-not-inconsistency-proof', conflict, 'NONCONVERGENCE');
const wrongSide = doc(); wrongSide.constraints[4].side = 'right'; refusal('wrong-side', wrongSide, 'BRANCH');
for (const [name, position] of [['endpoint-start', [-3, 4]], ['endpoint-end', [37, 34]], ['outside-start', [-7, 1]], ['outside-end', [41, 37]]]) {
  const d = doc(); d.constraints = [d.constraints[4]]; d.points[3].position = position; refusal(name, d, 'BRANCH');
}
for (const [name, value] of [['zero', 0], ['negative-zero', -0], ['negative', -1], ['below-minimum', .0009], ['above-maximum', 10001]]) {
  const d = doc(); d.circles[0].radius.valueMM = value; refusal('seed-radius-' + name, d, 'UNSUPPORTED');
  const target = doc(); target.constraints[3].radiusMM = value; refusal('target-radius-' + name, target, 'UNSUPPORTED');
}
const degenerate = doc(); degenerate.points[1].position = [0, 0]; refusal('collapsed-segment', degenerate, 'DEGENERATE_GEOMETRY');
const envelope = structuredClone(z.document); envelope.points[0].position = [9999, 0]; refusal('pole-envelope', envelope, 'NUMERICAL');
const reference = doc(); reference.circles[0].centerPointId = 'missing'; refusal('missing-center', reference, 'REFERENCE');
const range = doc(); range.points[0].position[0] = 10001; refusal('coordinate-range', range, 'UNSUPPORTED');
const nonfinite = doc(); nonfinite.circles[0].radius.valueMM = Infinity; refusal('nonfinite', nonfinite, 'INVALID_DOCUMENT');
for (const [name, mutate] of [
  ['points', d => { d.points.push(...Array.from({ length: 13 }, (_, i) => p('P' + i, [i, i]))); }],
  ['segments', d => { d.segments.push(...Array.from({ length: 7 }, (_, i) => s('S' + i, 'A', 'B'))); }],
  ['circles', d => { d.circles.push(...Array.from({ length: 4 }, (_, i) => circle('K' + i, 'C', 1))); }],
  ['unknowns', d => { d.points.push(...Array.from({ length: 12 }, (_, i) => p('P' + i, [i, i]))); }],
  ['constraints', d => { d.constraints = Array.from({ length: 33 }, (_, i) => ({ id: 'F' + i, kind: 'fixed', pointId: 'A', target: [0, 0] })); }],
  ['guards', d => { d.branchGuards = Array.from({ length: 17 }, (_, i) => ({ id: 'G' + i, kind: 'positive-projection', segmentId: 'AB', direction: [1, 0] })); }],
  ['identifier', d => { d.id = 'a'.repeat(49); }], ['string-budget', d => { d.id = 'a'.repeat(129); }],
  ['array-budget', d => { d.points = Array(65).fill(p('C', [0, 0])); }],
  ['depth-budget', d => { d.extra = [[[[[[[[[1]]]]]]]]]; }],
  ['record-budget', d => { for (let i = 0; i < 17; i++) d['extra' + i] = i; }],
  ['value-budget', d => { d.points = Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => 0)); }]
]) { const d = doc(); mutate(d); refusal('cap-' + name, d, 'LIMIT'); }
for (const [name, mutate, code] of [
  ['extra-root', d => { d.extra = 1; }, 'INVALID_DOCUMENT'], ['extra-circle', d => { d.circles[0].kind = 'circle'; }, 'INVALID_DOCUMENT'],
  ['duplicate-id', d => { d.circles[0].seamId = 'A'; }, 'INVALID_DOCUMENT'], ['missing-side', d => { delete d.constraints[4].side; }, 'INVALID_DOCUMENT'],
  ['unsupported-side', d => { d.constraints[4].side = 'either'; }, 'UNSUPPORTED'], ['wrong-units', d => { d.angleUnit = 'deg'; }, 'UNSUPPORTED'],
  ['circle-reference', d => { d.constraints[3].circleId = 'missing'; }, 'REFERENCE'], ['segment-reference', d => { d.constraints[4].segmentId = 'missing'; }, 'REFERENCE']
]) { const d = doc(); mutate(d); refusal(name, d, code); }
const accessor = doc(); let getterCalls = 0;
Object.defineProperty(accessor.circles[0].radius, 'valueMM', { enumerable: true, get() { getterCalls++; return 5; } });
refusal('getter-not-invoked', accessor, 'INVALID_DOCUMENT'); assert.equal(getterCalls, 0);
const thrown = new Proxy({}, { getPrototypeOf() { throw new Error('Opaque cause must not be inspected'); } });
const proxy = new Proxy({}, { ownKeys() { throw thrown; } });
assert.throws(() => build(proxy), e => e instanceof SketchError && e.code === 'INVALID_DOCUMENT' && e.cause === thrown); refusal('opaque-thrown-cause', proxy, 'INVALID_DOCUMENT');
const revoked = Proxy.revocable({}, {}); revoked.revoke(); refusal('revoked-proxy', revoked.proxy, 'INVALID_DOCUMENT');
for (const [name, mutate] of [
  ['rank', d => { d.report.numericalRank = 0; }], ['point', d => { d.solution.points[3].position[0] += 1e-12; }],
  ['radius', d => { d.solution.radii[0].valueMM += 1e-12; }], ['contact', d => { d.report.contacts[0].contactParameter += 1e-12; }],
  ['binding', d => { d.solution.bindings[0].seamPoleIndices[1] = 7; }], ['source', d => { d.solution.source += ' '; }],
  ['native-pole', d => { d.solution.model.objects[2].controlPoints[1][0] += 1e-12; }], ['extra-field', d => { d.extra = 1; }]
]) { const changed = structuredClone(first); mutate(changed); assert.throws(() => validate(changed), e => e instanceof SketchError && e.code === 'OWNED', name); }
const changedZero = structuredClone(z); changedZero.solution.points[0].position[0] = 0;
assert.throws(() => validate(changedZero), e => e.code === 'OWNED');
const affine = { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: 'third', lengthUnit: 'mm',
  points: [p('O', [0, 0]), p('P', [1, 0])], segments: [s('OP', 'O', 'P')], referenceLines: [{ id: 'line', anchor: [0, 1], direction: [1, -3] }],
  constraints: [{ id: 'fix_o', kind: 'fixed', pointId: 'O', target: [0, 0] }, { id: 'horizontal', kind: 'horizontal', segmentId: 'OP' },
    { id: 'on_line', kind: 'point-on-authored-line', pointId: 'P', referenceLineId: 'line' }] };
assert.equal(api.solveXYAffineSketch(affine).diagnostics[0].code, 'REPRESENTABILITY');
const old = { format: 'barocss-xy-numerical-sketch', version: 0, profile: 'bounded-length-angle-v0', id: 'old', lengthUnit: 'mm', angleUnit: 'rad',
  points: [p('A', [0, 0]), p('B', [1, 0])], segments: [s('AB', 'A', 'B')], constraints: [], branchGuards: [] };
assert.equal(api.solveXYNumericalSketch(old).ok, true); old.circles = [circle('round', 'A', 1)];
assert.equal(api.solveXYNumericalSketch(old).diagnostics[0].code, 'INVALID_DOCUMENT');
delete old.circles; old.constraints.push({ id: 'new_radius', kind: 'radius', circleId: 'round', radiusMM: 1 });
assert.equal(api.solveXYNumericalSketch(old).diagnostics[0].code, 'UNSUPPORTED');
writeFileSync(resolve(output, 'manifest.json'), json({ mode, apiURL, accepted, refused, original: first.report, edited: second.report }));
execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--cold', output], { stdio: 'inherit' });
console.log(JSON.stringify({ mode, accepted, refused, rank: first.report.numericalRank, dof: first.report.localDegreesOfFreedom,
  iterations: [first.report.iterations, second.report.iterations], evaluations: [first.report.evaluations, second.report.evaluations] }));
