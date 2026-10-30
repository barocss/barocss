import test from 'node:test';
import assert from 'node:assert/strict';
import { brepMassProperties, checkBrep, massPropertiesOf, type Brep } from '@barocss/cad';
import { part } from '../src/api/index';
import { offsetFaceCommand } from '../src/app/profileCommands';
import { resolveNativeOffsetFace, validateNativeOffsetDistance } from '../src/app/nativeOffsetFace';
import type { Ctx } from '../src/app/commands';
import { cylinderPart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { partSnapshot } from '../src/engine/part';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';

// Independent represented-number arithmetic. No production rational or mass formula supplies expectations.
type Q = { n: bigint; d: bigint };
function rational(n: bigint, d = 1n): Q {
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n, b = d;
  while (b) { const r = a % b; a = b; b = r; }
  return { n: n / a, d: d / a };
}
function q(value: number): Q {
  assert.ok(Number.isFinite(value)); const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value);
  const bits = view.getBigUint64(0), e = Number((bits >> 52n) & 2047n), m = (bits & ((1n << 52n) - 1n)) | (e ? 1n << 52n : 0n), n = (bits >> 63n ? -1n : 1n) * m, power = e ? e - 1075 : -1074;
  return power < 0 ? rational(n, 1n << BigInt(-power)) : rational(n << BigInt(power));
}
const add = (a: Q, b: Q): Q => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q): Q => rational(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q): Q => rational(a.n * b.n, a.d * b.d);
const text = (a: Q) => ({ numerator: String(a.n), denominator: String(a.d) });
function within(actual: number, expected: Q, tolerance: Q): void {
  assert.ok(Number.isFinite(actual)); const error = sub(q(actual), expected);
  assert.ok((error.n < 0n ? -error.n : error.n) * tolerance.d <= tolerance.n * error.d, `${actual} vs ${JSON.stringify(text(expected))}`);
}
function freeze(value: unknown): void { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } }
function levels(brep: Brep): [number, number] { return [Math.min(...brep.vertices.map(v => v.point[2])), Math.max(...brep.vertices.map(v => v.point[2]))]; }
function native(doc: StudioDoc): Brep { const bodies = partBreps(doc); assert.equal(bodies.length, 1); return bodies[0].brep; }
function context(doc: StudioDoc): Ctx {
  const result = evaluateDoc(doc, 0); assert.ok(result.ok, JSON.stringify(result));
  const face = result.bodies[0].mesh.faces.findIndex(f => f.kind === 'plane' && f.normal[2] === 1); assert.ok(face >= 0);
  return { doc, bodies: result.bodies, selection: { faces: [{ body: 0, face }], edges: [], bodies: [] } };
}
function footprint(brep: Brep): number[][] { return [0, 1].map(axis => { const values = brep.edges.flatMap(edge => edge.curve.controlPoints.map(p => p[axis])); return [Math.min(...values), Math.max(...values)]; }); }
function verify(doc: StudioDoc, lo: number, hi: number, expectedFootprint: number[][]) {
  const before = structuredClone(doc), b = native(doc), stored = levels(b); assert.deepEqual(stored, [lo, hi]); const actualFootprint = footprint(b); actualFootprint.forEach((range, axis) => range.forEach((value, i) => assert.ok(Math.abs(value - expectedFootprint[axis][i]) <= 1e-7)));
  assert.equal(b.bodies.length, 1); assert.equal(b.bodies[0].kind, 'solid'); assert.equal(b.shells.length, 1); assert.equal(b.shells[0].closed, true); assert.equal(checkBrep(b, { strict: true }).valid, true);
  const capLevels = b.faces.filter(f => f.surface.kind === 'surface').flatMap(f => {
    if (f.surface.kind !== 'surface') return []; const points = f.surface.controlPoints.flat();
    assert.ok(points.every(p => p[2] >= lo && p[2] <= hi), 'Every native normal pole is inside the stored interval');
    return points.every(p => p[2] === points[0][2]) ? [points[0][2]] : [];
  });
  assert.ok(capLevels.includes(lo) && capLevels.includes(hi), 'Both actual native cap supports have exact constant stored normal coefficients');
  const snapshot = partSnapshot(doc), kernel = massPropertiesOf(snapshot.outputs[0], 1), model = evaluateDoc(doc, 1); assert.ok(model.ok, JSON.stringify(model));
  const facade = part('D343 public mass', doc), publicMass = facade.body(facade.bodies()[0]).mass({ density: 1 }), midpoint = mul(add(q(lo), q(hi)), rational(1n, 2n));
  const pipelines = { kernel, model: { volume: model.bodies[0].volume, centroid: model.bodies[0].centroid }, publicMass };
  for (const [name, mass] of Object.entries(pipelines)) {
    assert.ok(mass.volume !== null && mass.volume > 0 && Number.isFinite(mass.volume), `${name}: finite positive volume`); assert.ok(mass.centroid);
    assert.ok(mass.centroid[2] >= lo && mass.centroid[2] <= hi, `${name}: centroid lies in the exact native interval`);
    within(mass.centroid[2], midpoint, q(8 * 2 ** -54));
    assert.ok(Math.abs(mass.volume / (Math.PI * 9 * (hi - lo)) - 1) < 1e-10, `${name}: rounded circle analytic volume guide`);
  }
  assert.equal(kernel.method, 'closed-form');
  const faces = facade.body(facade.bodies()[0]).select().faces(), publicNames = faces.names().sort();
  assert.equal(b.faces.length, 4, 'This native cylinder retains two physical side patches and two cap faces');
  assert.equal(faces.count, 3, 'Public selection has two cap groups and one merged side group');
  assert.equal(new Set(publicNames).size, 3, 'Distinct public groups must not alias the two physical cap levels');
  const lower = faces.facing('-z'), upper = faces.facing('+z'); assert.equal(lower.count, 1); assert.equal(upper.count, 1);
  const lowerName = lower.names()[0], upperName = upper.names()[0]; assert.notEqual(lowerName, upperName);
  assert.equal(faces.where(face => face.name === lowerName).count, 1, 'Lower cap name selects exactly one public group');
  assert.equal(faces.where(face => face.name === upperName).count, 1, 'Upper cap name selects exactly one public group');
  let nativeQuadrature: unknown;
  try { nativeQuadrature = brepMassProperties(b, 1); } catch (error) { nativeQuadrature = { error: error instanceof Error ? error.message : String(error) }; }
  assert.deepEqual(doc, before, 'Mass queries cannot change authored recipes or geometry');
  return { nativeBrep: b, nativePhysicalFaceCount: b.faces.length, publicFaceGroups: { names: publicNames, lowerName, upperName }, tangentFootprint: actualFootprint, kernelRepresentation: snapshot.outputs[0].representation, levels: stored, expectedNormalMidpoint: text(midpoint), normalTolerance: text(q(8 * 2 ** -54)), pipelines, nativeQuadrature, nativeQuadratureScope: 'Separate native B-rep provider observation; no tiny relative-volume or centroid accuracy claim from longitudinal formula repair' };
}

test('longitudinal mass: captured translated upright cylinder reaches Model/public mass through preserved distance admission and actual result validation', async t => {
  const source = withNode(cylinderPart(3, 5.00009), { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [.1234567, -.2345678, .3456789] }), before = structuredClone(source), ctx = context(source), pick = structuredClone(ctx.selection);
  const originalBrep = native(source), expectedFootprint = footprint(originalBrep);
  const profile = resolveNativeOffsetFace(ctx), distance = -5.00009; assert.equal(profile.opposite, .3456789); assert.equal(profile.coordinate + distance, .34567890000000023); freeze(source);
  validateNativeOffsetDistance(profile, distance); const result = offsetFaceCommand.build!(ctx, { d: distance }); assert.deepEqual(result.nodes.slice(0, source.nodes.length), source.nodes);
  const evidence = verify(result, .3456789, .34567890000000023, expectedFootprint); assert.deepEqual(source, before); assert.deepEqual(ctx.selection, pick);
  freeze(result); const encoded = encodeStudioFile(result), loaded = await readStudioFile(encoded); assert.ok(!('error' in loaded)); assert.deepEqual(loaded.doc, result);
  const reopened = verify(loaded.doc, .3456789, .34567890000000023, expectedFootprint); assert.deepEqual(result.nodes.slice(0, source.nodes.length), source.nodes);
  assert.deepEqual(reopened.publicFaceGroups, evidence.publicFaceGroups, 'Fresh native file reopen preserves distinct unambiguous public cap names');
  t.diagnostic(JSON.stringify({ distance, expectedGap: text(sub(q(.34567890000000023), q(.3456789))), evidence, reopened, scope: 'Actual existing Offset composition; Z-upright repaired provider only, circle pi is a rounded guide' }));
});
