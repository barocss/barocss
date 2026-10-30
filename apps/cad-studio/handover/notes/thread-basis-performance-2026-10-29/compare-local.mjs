import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import * as K from '../../../../../packages/barocss-cad/dist/index.js';
import { readNativeSIInertia } from '../../../../../packages/barocss-cad/dist/internal/native-si-mass.js';
const dist = new URL('../../../../../packages/barocss-cad/dist/brep/', import.meta.url);
function moduleURL(source, base, replacements = {}) {
  return `data:text/javascript;base64,${Buffer.from(source.replace(/from '([^']+)'/g, (_, path) => `from '${replacements[path] ?? new URL(path, base).href}'`)).toString('base64')}`;
}
async function variant(filename) {
  let source = readFileSync(new URL(filename, import.meta.url), 'utf8');
  source = source.replace('function nearBoundary(', 'function originalNearBoundary(');
  source += `
export const boundaryTrace = [];
function nearBoundary(at, U, V, sides, p, near) {
  const entry = { p: [...p], near, evaluations: [] }; boundaryTrace.push(entry);
  const traced = (u, v) => { entry.evaluations.push([u, v]); return at(u, v); };
  try { entry.returned = originalNearBoundary(traced, U, V, sides, p, near); return entry.returned; }
  catch (e) { entry.threw = { name: e.name, message: e.message }; throw e; }
}
`;
  const url = moduleURL(source, new URL('brep-mass-quadrature.js', dist));
  const q = await import(url);
  const mass = await import(moduleURL(readFileSync(new URL('solid-mass.js', dist), 'utf8'), new URL('solid-mass.js', dist), { './brep-mass-quadrature.js': url }));
  return { q, mass };
}
const before = await variant('./original-brep-mass-quadrature.mjs');
const after = await variant(process.argv[2] ?? './candidate-brep-mass-quadrature.mjs');
const bits = n => { const b = Buffer.alloc(8); b.writeDoubleBE(n); return b.toString('hex'); };
function bitTree(value) {
  if (typeof value === 'number') return bits(value);
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value, bitTree);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, bitTree(child)]));
  return value;
}
const doc = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
function model(features, id) { return K.outputOf(K.evaluateCadPart(doc(features)), id).brep; }
function shaft(length, height = length + 18, hand) { return model([
  { id: 'c', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 3 },
  { id: 'sh', kind: 'extrude', sketch: 'c', height },
  { id: 'th', kind: 'face-thread', target: 'sh', face: 'sh.side0', pitch: 1, length, ...(hand ? { hand } : {}) },
], 'th'); }
function hole(height) { return model([
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 30] },
  { id: 'p', kind: 'extrude', sketch: 's', height },
  { id: 'h', kind: 'hole', target: 'p', center: [15, 15], radius: 2.5 },
  { id: 'th', kind: 'face-thread', target: 'h', face: 'h.side0', pitch: 1, diameter: 6 },
], 'th'); }
function bump({ rational = false, range = [0, 1], multi = false, negativeZero = false } = {}) {
  const count = multi ? 5 : 4, knots = [0, 0, 0, 0, ...(multi ? [0.4] : []), 1, 1, 1, 1];
  const zs = Array.from({ length: count }, (_, i) => Array.from({ length: 4 }, (_, j) => i && i < count - 1 && j && j < 3 ? 10 + i + j : 10));
  const top = { kind: 'surface', id: 't', degreeU: 3, degreeV: 3, knotsU: knots.map(k => range[0] + (range[1] - range[0]) * k), knotsV: [0, 0, 0, 0, 1, 1, 1, 1].map(k => negativeZero && k === 0 ? -0 : k), controlPoints: zs.map((r, i) => r.map((z, j) => [40 * i / (count - 1), 30 * j / 3, z])), weights: zs.map((r, i) => r.map((_, j) => rational && i && i < count - 1 && j && j < 3 ? 1.3 : 1)) };
  const bil = (a, b, c, d) => ({ kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[a, b], [c, d]], weights: [[1, 1], [1, 1]] });
  return K.sewSolid({ id: 'n', surfaces: [top, bil([0, 0, 0], [40, 0, 0], [0, 30, 0], [40, 30, 0]), bil([0, 0, 0], [0, 0, 10], [40, 0, 0], [40, 0, 10]), bil([40, 0, 0], [40, 0, 10], [40, 30, 0], [40, 30, 10]), bil([40, 30, 0], [40, 30, 10], [0, 30, 0], [0, 30, 10]), bil([0, 30, 0], [0, 30, 10], [0, 0, 0], [0, 0, 10])] });
}
const cases = [
  ['shaft-thread', () => shaft(12, 30)], ['tapped-hole', () => hole(10)],
  ['shaft-thread-long', () => shaft(60, 90)], ['tapped-hole-long', () => hole(40)],
  ['direct-thread-long', () => K.threadSolid({ id: 'th', diameter: 6, pitch: 1, seat: 60, length: 60, form: 'helical' })],
  ['left-thread', () => shaft(6, 24, 'left')], ['polynomial-bump', () => bump()],
  ['rational-bump', () => bump({ rational: true })], ['multi-span-shifted-domain', () => bump({ range: [2, 5], multi: true })],
  ['signed-zero-domain', () => bump({ negativeZero: true })],
  ['partial-trim-frozen-bevel-pair', () => JSON.parse(readFileSync(new URL('../../../../../packages/barocss-cad/test/fixtures/frk8b-bevel-pair-4deg.brep.json', import.meta.url), 'utf8'))],
];
const receipt = { status: 'running', variant: process.argv[2] ?? 'candidate-brep-mass-quadrature.mjs', node: process.version, cases: [] };
function outcome(action) { try { return { returned: action() }; } catch (e) { return { threw: { name: e.name, code: e.code, message: e.message } }; } }
for (const [name, make] of cases) {
  const b = make(), saved = structuredClone(b), rows = [];
  before.q.boundaryTrace.length = 0; after.q.boundaryTrace.length = 0;
  writeFileSync(new URL(`geometry-${name}.json.gz`, import.meta.url), gzipSync(JSON.stringify({ brep: b, binary64: bitTree(b) }) + '\n', { level: 9 }));
  for (const segments of [8, 16]) {
    const a = before.q.brepQuadratureIntegrals(structuredClone(b), segments), z = after.q.brepQuadratureIntegrals(structuredClone(b), segments);
    assert.deepEqual(bitTree(z), bitTree(a), `${name} raw11 ${segments}`); rows.push({ segments, before: bitTree(a), after: bitTree(z), values: z });
  }
  const summaries = [];
  for (const impl of [before, after]) {
    const fresh = structuredClone(b), mass = outcome(() => impl.mass.brepMassProperties(fresh, 7.85)), area = outcome(() => impl.mass.brepSurfaceArea(fresh));
    const native = mass.returned ? readNativeSIInertia(mass.returned) : null;
    const reverse = structuredClone(b), firstArea = outcome(() => impl.mass.brepSurfaceArea(reverse)), nextMass = outcome(() => impl.mass.brepMassProperties(reverse, 7.85));
    summaries.push({ mass, area, native, firstArea, nextMass });
  }
  assert.deepEqual(bitTree(summaries[1]), bitTree(summaries[0]), `${name} mass/area/nativeSI`); assert.deepEqual(b, saved);
  const trace = bitTree(before.q.boundaryTrace); assert.deepEqual(bitTree(after.q.boundaryTrace), trace, `${name} actual boundary/refinement trace`);
  if (name.includes('partial-trim')) writeFileSync(new URL('./partial-trim-boundary-trace.json.gz', import.meta.url), gzipSync(JSON.stringify(trace) + '\n', { level: 9 }));
  receipt.cases.push({ name, boundaryCalls: before.q.boundaryTrace.length, surfaceEvaluations: before.q.boundaryTrace.reduce((n, x) => n + x.evaluations.length, 0), boundaryTraceSHA256: createHash('sha256').update(JSON.stringify(trace)).digest('hex'), faces: b.faces.length, strictValid: K.checkBrep(b, { strict: true }).valid, geometrySHA256: createHash('sha256').update(JSON.stringify(bitTree(b))).digest('hex'), rows, summaries: summaries.map(bitTree) });
  writeFileSync(new URL('./equivalence.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n'); console.log(`SAME ${name} raw11/mass/area/nativeSI`);
}
const mutated = bump({ multi: true }); before.q.brepQuadratureIntegrals(mutated, 8); after.q.brepQuadratureIntegrals(mutated, 8);
const top = mutated.faces.find(f => f.surface.degreeU === 3).surface; top.controlPoints[1][1][2] += 2; top.knotsU[4] = 0.6; top.weights[1][1] = 1.3;
assert.deepEqual(bitTree(after.q.brepQuadratureIntegrals(mutated, 8)), bitTree(before.q.brepQuadratureIntegrals(mutated, 8)));
receipt.mutationIsolation = 'PASS: direct raw integration after in-place pole, knot and weight edits; public comparisons use fresh clones';
receipt.status = 'passed'; writeFileSync(new URL('./equivalence.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n');
