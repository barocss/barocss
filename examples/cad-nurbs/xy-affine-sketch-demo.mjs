import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold'].includes(mode) && directory, 'Usage: node xy-affine-sketch-demo.mjs --source|--emitted output-directory');
const repo = fileURLToPath(new URL('../../', import.meta.url)), output = resolve(directory);
mkdirSync(output, { recursive: true });
const json = value => JSON.stringify(value, (_, item) => typeof item === 'number' && Object.is(item, -0) ? JSON.rawJSON('-0') : item, 2) + '\n';
let api;
if (mode === '--source') {
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
  const bundle = await require('esbuild').build({ absWorkingDir: repo, entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true,
    platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  const inputs = Object.keys(bundle.metafile.inputs);
  for (const leaf of ['xy-affine-sketch.ts', 'sketch/xy-affine-sketch-internal.ts', 'section-rational-internal.ts']) assert.ok(inputs.some(path => path.endsWith('/' + leaf)));
  assert.ok(!inputs.some(path => path.includes('/dist/')));
  writeFileSync(resolve(output, 'source-api.mjs'), bundle.outputFiles[0].text);
  api = await import(pathToFileURL(resolve(output, 'source-api.mjs')).href);
} else if (mode === '--cold') {
  const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8'));
  api = await import(manifest.apiURL);
  for (const name of manifest.accepted) {
    const document = JSON.parse(readFileSync(resolve(output, name + '.document.json'), 'utf8'));
    const saved = JSON.parse(readFileSync(resolve(output, name + '.result.json'), 'utf8'));
    assert.deepEqual(api.buildXYAffineSketch(document), saved);
    assert.deepEqual(api.validateXYAffineSketch(saved), saved.report);
    const source = readFileSync(resolve(output, name + '.source0.css'), 'utf8');
    assert.equal(source, saved.solution.source);
    const compiled = api.compileCadModel(source, { sourceVersion: 0 });
    assert.equal(compiled.ok, true); assert.deepEqual(compiled.model, saved.solution.model);
  }
  console.log('Cold original-document/native-source/complete-result reconstruction passed');
  process.exit(0);
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')).href);
const { buildXYAffineSketch: build, solveXYAffineSketch: solve, validateXYAffineSketch: validate, XYAffineSketchError: AffineError } = api;
for (const name of ['buildXYAffineSketch', 'solveXYAffineSketch', 'validateXYAffineSketch', 'XYAffineSketchError']) assert.equal(typeof api[name], 'function');
assert.equal(typeof api.XYAffineSketchDiagnosticCode, 'object');
const accepted = [], refusals = [], summaries = [];
const clone = value => structuredClone(value);
const point = (id, position) => ({ id, position }), segment = (id, startPointId, endPointId) => ({ id, startPointId, endPointId });
const document = (id, points, segments, referenceLines, constraints) => ({ format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id, lengthUnit: 'mm', points, segments, referenceLines, constraints });
const line = (id, anchor, direction) => ({ id, anchor, direction });
const fixed = (id, pointId, target) => ({ id, kind: 'fixed', pointId, target });
const parallel = (id, segmentId, referenceLineId) => ({ id, kind: 'segment-parallel-to-fixed-direction', segmentId, referenceLineId });
const incidence = (id, pointId, referenceLineId) => ({ id, kind: 'point-on-authored-line', pointId, referenceLineId });
const midpoint = (id, midpointId, pointA, pointB) => ({ id, kind: 'midpoint', midpointId, pointA, pointB });
function noAliases(input, result) {
  const inputObjects = new Set(), outputObjects = new Set();
  const collect = v => { if (v && typeof v === 'object') { inputObjects.add(v); Object.values(v).forEach(collect); } }; collect(input);
  const visit = v => { if (v && typeof v === 'object') { assert.ok(!inputObjects.has(v) && !outputObjects.has(v)); outputObjects.add(v); Object.values(v).forEach(visit); } }; visit(result);
}
function save(name, input) {
  const before = clone(input), result = build(input);
  assert.deepEqual(input, before); assert.deepEqual(solve(input), result); assert.deepEqual(validate(result), result.report); noAliases(input, result);
  const solved = new Map(result.solution.points.map(p => [p.id, p.position]));
  assert.deepEqual(result.solution.model.objects.map(o => o.id), input.segments.map(s => s.id));
  for (const [i, s] of input.segments.entries()) {
    const curve = result.solution.model.objects[i];
    assert.equal(curve.kind, 'curve'); assert.equal(curve.degree, 1); assert.deepEqual(curve.knots, [0, 0, 1, 1]); assert.deepEqual(curve.weights, [1, 1]);
    const a = [...solved.get(s.startPointId), 0], b = [...solved.get(s.endPointId), 0];
    assert.deepEqual(curve.controlPoints, [a, b]);
    // Evaluator may canonicalize signed zero; coefficient equality above preserves bits.
    assert.ok(api.evaluateCurve(curve, 0).every((value, axis) => value === a[axis]));
    assert.ok(api.evaluateCurve(curve, 1).every((value, axis) => value === b[axis]));
  }
  writeFileSync(resolve(output, name + '.document.json'), json(input));
  writeFileSync(resolve(output, name + '.result.json'), json(result));
  writeFileSync(resolve(output, name + '.source0.css'), result.solution.source);
  accepted.push(name); summaries.push({ name, report: result.report }); return result;
}
function refuse(name, input, code) {
  const result = solve(input);
  assert.deepEqual(Object.keys(result).sort(), ['diagnostics', 'ok']); assert.equal(result.ok, false, name);
  assert.equal(result.diagnostics[0].code, code, name + ': ' + json(result));
  assert.throws(() => build(input), error => error instanceof AffineError && error.code === code);
  refusals.push({ name, ...result }); return result.diagnostics[0];
}

const bracket = document('rotatedBracket', [point('A', [0, 0]), point('B', [9, 9]), point('C', [9, 7]), point('D', [-2, 2]), point('M', [1, 1])],
  [segment('AB', 'A', 'B'), segment('BC', 'B', 'C'), segment('CD', 'C', 'D'), segment('DA', 'D', 'A')],
  [line('longAxis', [0, 0], [3, 4]), line('transverse', [6, 8], [-4, 3]), line('upperRail', [2, 11], [3, 4])],
  [fixed('pinA', 'A', [0, 0]), fixed('pinB', 'B', [6, 8]), incidence('CTransverse', 'C', 'transverse'), incidence('CUpperRail', 'C', 'upperRail'),
    parallel('CDLong', 'CD', 'longAxis'), parallel('DATransverse', 'DA', 'transverse'), midpoint('middleAB', 'M', 'A', 'B'), midpoint('middleAgain', 'M', 'A', 'B')]);
const result = save('rotated-bracket', bracket);
assert.deepEqual(result.solution.points.map(p => p.position), [[0, 0], [6, 8], [2, 11], [-4, 3], [3, 4]]);
assert.equal(result.report.rank, 10); assert.equal(result.report.degreesOfFreedom, 0); assert.equal(result.report.equationCount, 12);
assert.deepEqual(result.report.redundantConstraintIds, ['middleAgain']);
// Independent integer equations for this rotated bracket, not solver internals.
const [A, B, C, D, M] = result.solution.points.map(p => p.position);
assert.deepEqual(M.map((v, axis) => 2 * v - A[axis] - B[axis]), [0, 0]);
assert.equal(3 * (D[1] - C[1]) - 4 * (D[0] - C[0]), 0);
assert.equal(-4 * (A[1] - D[1]) - 3 * (A[0] - D[0]), 0);
assert.equal(-4 * (C[1] - 8) - 3 * (C[0] - 6), 0);
assert.deepEqual(result.document.referenceLines, bracket.referenceLines);

const free = document('underconstrained', [point('P', [0, 0]), point('Q', [99, 8]), point('construction', [-0, 7])],
  [segment('PQ', 'P', 'Q')], [line('slope', [123, 456], [3, 4])], [fixed('pinP', 'P', [0, 0]), parallel('alongSlope', 'PQ', 'slope')]);
const freeResult = save('free-seeds', free);
assert.deepEqual(freeResult.solution.points.map(p => p.position), [[0, 0], [6, 8], [-0, 7]]);
assert.equal(freeResult.report.rank, 3); assert.equal(freeResult.report.degreesOfFreedom, 3);
assert.deepEqual(freeResult.report.freeCoordinates, [{ pointId: 'Q', axis: 'y' }, { pointId: 'construction', axis: 'x' }, { pointId: 'construction', axis: 'y' }]);
const seedEdit = clone(free); seedEdit.points[1].position[1] = 12;
assert.deepEqual(save('free-seed-edit', seedEdit).solution.points[1].position, [9, 12]);

const thirds = document('thirds', [point('P', [0, 0]), point('Q', [2, 1])], [segment('PQ', 'P', 'Q')],
  [line('thirdSlope', [0, 0], [1, 3])], [fixed('pinP', 'P', [0, 0]), incidence('oneThird', 'Q', 'thirdSlope')]);
const third = refuse('exact-one-third', thirds, 'REPRESENTABILITY');
assert.deepEqual(third.coordinate, { pointId: 'Q', axis: 'x' }); assert.deepEqual(third.exactFraction, { numerator: '1', denominator: '3' });
assert.match(third.message, /Q.*x.*1\/3/);
const conflict = clone(bracket); conflict.constraints.push(fixed('wrongMidpoint', 'M', [4, 4]));
const conflictDiagnostic = refuse('nonminimal-conflict', conflict, 'CONFLICT');
assert.deepEqual(conflictDiagnostic.constraintIds, ['pinA', 'pinB', 'middleAB', 'wrongMidpoint']);
const samePoint = clone(free); samePoint.constraints.push({ id: 'samePoint', kind: 'coincident', pointA: 'Q', pointB: 'Q' });
assert.deepEqual(save('self-coincidence', samePoint).report.redundantConstraintIds, ['samePoint']);
// Midpoint role aliases must accumulate coefficients rather than overwrite them.
const aliasedMidpoint = clone(free); aliasedMidpoint.constraints.push(midpoint('aliasMid', 'construction', 'Q', 'construction'));
// The new relation pivots Q.y; the later construction.y remains free at 7.
const aliasResult = save('aliased-midpoint', aliasedMidpoint);
assert.deepEqual(aliasResult.solution.points[1].position, [5.25, 7]);
assert.deepEqual(aliasResult.solution.points[2].position, [5.25, 7]);
const hv = document('horizontalVertical', [point('P', [1, 2]), point('Q', [8, 9]), point('R', [7, 3]), point('S', [3, 4])],
  [segment('PQ', 'P', 'Q'), segment('QR', 'Q', 'R')], [], [fixed('pin', 'P', [1, 2]), { id: 'h', kind: 'horizontal', segmentId: 'PQ' },
    { id: 'v', kind: 'vertical', segmentId: 'QR' }, { id: 'co', kind: 'coincident', pointA: 'R', pointB: 'S' }]);
assert.deepEqual(save('hv-coincidence', hv).solution.points.map(p => p.position), [[1, 2], [3, 2], [3, 4], [3, 4]]);

for (const [name, change, code] of [
  ['old-profile', d => { d.format = 'barocss-xy-linear-sketch'; }, 'UNSUPPORTED'],
  ['unsupported-angle', d => { d.constraints[0] = { id: 'angle', kind: 'angle', radians: 1 }; }, 'UNSUPPORTED'],
  ['extra-field', d => { d.extra = 1; }, 'INVALID_DOCUMENT'],
  ['bad-reference', d => { d.constraints[0].pointId = 'missing'; }, 'REFERENCE'],
  ['global-id', d => { d.referenceLines[0].id = 'P'; }, 'INVALID_DOCUMENT'],
  ['zero-direction', d => { d.referenceLines[0].direction = [0, -0]; }, 'INVALID_DOCUMENT'],
  ['nonfinite', d => { d.points[0].position[0] = Infinity; }, 'INVALID_DOCUMENT'],
  ['input-bound', d => { d.points[0].position[0] = 10001; }, 'UNSUPPORTED'],
  ['direction-bound', d => { d.referenceLines[0].direction[0] = 10001; }, 'UNSUPPORTED'],
  ['solved-bound', d => { d.points[1].position[1] = 10000; d.referenceLines[0].direction = [3, 1]; }, 'UNSUPPORTED'],
  ['collapsed', d => { d.points[1].position[1] = 0; }, 'DEGENERATE_GEOMETRY'],
  ['sparse', d => { delete d.points[0]; }, 'INVALID_DOCUMENT'],
  ['symbol', d => { d[Symbol('bad')] = 1; }, 'INVALID_DOCUMENT'],
  ['hidden', d => { Object.defineProperty(d, 'hidden', { value: 1 }); }, 'INVALID_DOCUMENT'],
  ['cycle', d => { d.points[0].position = d; }, 'INVALID_DOCUMENT'],
  ['foreign-prototype', d => { Object.setPrototypeOf(d, { inherited: 1 }); }, 'INVALID_DOCUMENT'],
  ['points-limit', d => { d.points = Array.from({ length: 17 }, (_, i) => point('p' + i, [i, 0])); }, 'LIMIT'],
  ['segments-limit', d => { d.segments = Array.from({ length: 9 }, (_, i) => segment('s' + i, 'P', 'Q')); }, 'LIMIT'],
  ['reference-lines-limit', d => { d.referenceLines = Array.from({ length: 9 }, (_, i) => line('l' + i, [0, 0], [1, 1])); }, 'LIMIT'],
  ['constraints-limit', d => { d.constraints = Array.from({ length: 33 }, (_, i) => fixed('f' + i, 'P', [0, 0])); }, 'LIMIT'],
]) { const data = clone(free); change(data); refuse(name, data, code); }
let reads = 0; const accessor = clone(free); Object.defineProperty(accessor.points[0], 'position', { enumerable: true, get() { reads++; return [0, 0]; } });
refuse('accessor-without-invocation', accessor, 'INVALID_DOCUMENT'); assert.equal(reads, 0);
// Throwing/revoked reflection targets never execute hostile exception getters.
for (const trap of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) {
  const evil = new Error('hostile'); Object.defineProperty(evil, 'message', { get() { reads++; throw new Error('getter executed'); } });
  refuse('throwing-proxy-' + trap, new Proxy(clone(free), { [trap]() { throw evil; } }), 'INVALID_DOCUMENT');
}
const revoked = Proxy.revocable({}, {}); revoked.revoke(); refuse('revoked-proxy', revoked.proxy, 'INVALID_DOCUMENT');
const hostileError = new AffineError('CONFLICT', 'external'); Object.defineProperty(hostileError, 'code', { get() { reads++; throw new Error('getter executed'); } });
refuse('external-typed-error-proxy', new Proxy(clone(free), { getPrototypeOf() { throw hostileError; } }), 'INVALID_DOCUMENT');
assert.equal(reads, 0);
const maximal = document('maximal', Array.from({ length: 16 }, (_, i) => point('p' + i, [i, i * 2])),
  Array.from({ length: 8 }, (_, i) => segment('s' + i, 'p' + (2 * i), 'p' + (2 * i + 1))),
  Array.from({ length: 8 }, (_, i) => line('l' + i, [i, i], [1, 2])),
  Array.from({ length: 32 }, (_, i) => fixed('f' + i, 'p' + (i % 16), [i % 16, (i % 16) * 2])));
const maximalResult = save('maximum-capacities', maximal);
assert.equal(maximalResult.report.rank, 32); assert.equal(maximalResult.report.equationCount, 64);
assert.deepEqual(maximalResult.report.redundantConstraintIds, Array.from({ length: 16 }, (_, i) => 'f' + (i + 16)));
// Full result binding: changing any layer, not only source, is detected.
for (const [name, change] of [
  ['document', r => { r.document.referenceLines[2].anchor[0]++; }],
  ['points', r => { r.solution.points[0].position[0]++; }],
  ['model', r => { r.solution.model.objects[0].controlPoints[0][0]++; }],
  ['source', r => { r.solution.source += ' '; }],
  ['sourceVersion', r => { r.solution.sourceVersion = 1; }],
  ['ir', r => { r.solution.ir.schemaVersion = 2; }],
  ['rank', r => { r.report.rank--; }],
  ['counts', r => { r.report.rationalWork.operations++; }],
  ['extra', r => { r.extra = 1; }],
]) { const changed = clone(result); change(changed); assert.throws(() => validate(changed), error => error instanceof AffineError && error.code === 'OWNED', name); }
const ownedAccessor = clone(result); Object.defineProperty(ownedAccessor, 'report', { enumerable: true, get() { reads++; return result.report; } });
assert.throws(() => validate(ownedAccessor), error => error instanceof AffineError && error.code === 'OWNED'); assert.equal(reads, 0);
// Caller mutation is isolated after completion.
const retained = clone(result); bracket.points[0].position[0] = 123; assert.deepEqual(result, retained);
// Existing V0/V1 remain their actual old API, including V1 anchored integer distance.
for (const version of [0, 1]) {
  const old = { format: 'barocss-xy-linear-sketch', version, id: 'legacy', lengthUnit: 'mm', points: [point('A', [0, 0]), point('B', [4, 0])],
    segments: [segment('AB', 'A', 'B')], constraints: [fixed('pinA', 'A', [0, 0]), { id: 'horizontal', kind: 'horizontal', segmentId: 'AB' }] };
  if (version === 1) old.constraints.push({ id: 'distance', kind: 'distance-x', pointA: 'A', pointB: 'B', distanceMM: 4 });
  const legacy = api.solveXYLinearSketch(old); assert.equal(legacy.ok, true); assert.deepEqual(legacy.solution.points.map(p => p.position), [[0, 0], [4, 0]]);
}
const apiURL = mode === '--source' ? pathToFileURL(resolve(output, 'source-api.mjs')).href : pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')).href;
writeFileSync(resolve(output, 'manifest.json'), json({ apiURL, accepted }));
writeFileSync(resolve(output, 'refusals.json'), json(refusals));
const cold = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--cold', output], { encoding: 'utf8', env: process.env });
writeFileSync(resolve(output, 'cold.log'), cold);
writeFileSync(resolve(output, 'summary.json'), json({ mode, accepted, refusalCount: refusals.length, summaries, cold: cold.trim() }));
console.log(json({ mode, accepted, refusalCount: refusals.length, cold: cold.trim(), topologyCertified: false, commercialCAD: false }));
