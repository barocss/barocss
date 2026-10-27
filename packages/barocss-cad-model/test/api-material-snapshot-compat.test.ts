import test from 'node:test';
import assert from 'node:assert/strict';
import { GravityExperimentRecord } from '../src/api/experimentRecord';
import { bodiesOf } from '../src/api/core';
import { linkInertia, type Frame, type Mat3 } from '../src/robot/inertia';
import { canonical, fnv64 } from '../src/util/revision';
import { KEY, options, rodDoc } from './fixtures/static-gravity-rod';

function object(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function countedBody(report: unknown): Record<string, unknown> {
  const links = object(object(report).inertia).links; assert.ok(Array.isArray(links));
  const moving = links.find(link => object(link).link === 'rod'); assert.ok(moving);
  const bodies = object(moving).bodies; assert.ok(Array.isArray(bodies)); assert.equal(bodies.length, 1);
  return object(bodies[0]);
}

/** Authored old-schema compatibility shape, not a relabelled new producer output or captured runtime receipt.
 * The importer intentionally retains inertia as unknown JSON; this fixture does not certify an inertia tensor.
 */
function oldSchemaShape() {
  const document = canonical(rodDoc()), input = options();
  return { format: 'barocss-gravity-experiment-record', schema: 1, report: {
    profile: 'static-gravity-v1', binding: { document, revision: fnv64(document), inputs: canonical(input) }, inputs: input,
    units: { angle: 'degree', length: 'mm', mass: 'g', inertia: 'g·mm²', gravity: 'mm/s²', torque: 'N·mm' },
    inertia: { links: [{ link: 'rod', part: 'rod', mass: 27,
      bodies: [{ key: 'b2', material: 'Aluminium 6061', assumed: false, mass: 27 }] }] },
    result: { torques: { [KEY]: -13.2389775 }, generalized: { [KEY]: -13.2389775 }, units: { [KEY]: 'N·mm' }, gravity: 9806.65 },
    scope: { joint: KEY, occurrence: 'rod', axis: { point: [0, 0, 0], direction: [0, 1, 0] },
      coordinateFrame: 'Joint axis and gravity: document world XYZ; inertia: each reported link frame.' },
    assumptions: ['Authored compatibility shape; not measured or authenticated producer evidence.'],
  } };
}

test('material snapshot compatibility: old schema-one records keep absent metadata absent without current-catalogue backfill', () => {
  const source = oldSchemaShape(), before = structuredClone(source);
  const imported = GravityExperimentRecord.parse(JSON.stringify(source));
  assert.deepEqual(imported.toJSON(), before);
  const body = countedBody(imported.report);
  assert.equal(Object.hasOwn(body, 'materialSnapshot'), false);
  assert.equal(Object.hasOwn(body, 'inertiaSource'), false);
  assert.deepEqual(countedBody(GravityExperimentRecord.parse(JSON.stringify(imported)).report), body);
  assert.equal(imported.preview.torque, -13.2389775);
  assert.equal(imported.matches(rodDoc(), options()), true, 'matching old inputs does not supply missing past density or provenance');
  assert.deepEqual(source, before);
});

test('material snapshot compatibility: optional finite JSON metadata survives the unknown report without extending the typed preview', () => {
  const source = oldSchemaShape();
  const metadata = { bodyMaterialId: 'al6061', inputMaterialId: 'al6061', resolvedMaterialId: 'al6061', fallback: 'none',
    densityGPerCm3: 2.7, libraryVersion: '0.7.0', densitySourceId: 'S-DENS',
    densitySourceText: 'Authored compatibility metadata, not an authenticated catalogue capture.',
    rowEstimate: true, basis: 'builtin-catalogue-not-measured' };
  const body = countedBody(source.report); body.materialSnapshot = metadata; body.inertiaSource = 'mmgs-density-scaled';
  const imported = new GravityExperimentRecord(source), full: unknown = imported.report;
  assert.deepEqual(countedBody(full).materialSnapshot, metadata);
  assert.equal(countedBody(full).inertiaSource, 'mmgs-density-scaled');
  assert.deepEqual(imported.toJSON(), source);
  assert.equal(Object.hasOwn(imported.preview, 'materialSnapshot'), false);
  assert.equal(Object.hasOwn(imported.preview, 'inertiaSource'), false);
  assert.deepEqual(imported.preview.gravity, [0, 0, -9806.65]);
  assert.equal(imported.preview.torque, -13.2389775);
  assert.equal(imported.matches(rodDoc(), options()), true, 'retaining optional data is not authenticating it');
});

test('material snapshot compatibility: an actually applied inertia callback changes its source but not the mass-density snapshot', () => {
  const doc = rodDoc().instances![0].doc, bodies = bodiesOf(doc);
  assert.equal(bodies.length, 1);
  const frame: Frame = { origin: [0, 0, 0], R: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
  const ordinary = linkInertia('rod', 'rod', doc, bodies, frame);
  const override: Mat3 = [1, 0, 0, 0, 2, 0, 0, 0, 3];
  const calls: string[] = [];
  const replaced = linkInertia('rod', 'rod', doc, bodies, frame, body => { calls.push(body.key); return override; });
  const notReplaced = linkInertia('rod', 'rod', doc, bodies, frame, () => undefined);
  assert.deepEqual(calls, [bodies[0].key]);
  assert.deepEqual(replaced.inertia, override);
  assert.notDeepEqual(replaced.inertia, ordinary.inertia);
  assert.equal(replaced.massKg, ordinary.massKg); assert.deepEqual(replaced.comM, ordinary.comM);
  assert.deepEqual(replaced.issues, ordinary.issues);
  const originalBody = object(ordinary.bodies[0]), replacedBody = object(replaced.bodies[0]), unchangedBody = object(notReplaced.bodies[0]);
  assert.equal(originalBody.inertiaSource, 'mmgs-density-scaled');
  assert.equal(replacedBody.inertiaSource, 'callback-override');
  assert.equal(unchangedBody.inertiaSource, 'mmgs-density-scaled', 'merely supplying a callback does not claim an override');
  assert.ok(originalBody.materialSnapshot, 'the actual mass evaluation captures its selected density');
  assert.deepEqual(replacedBody.materialSnapshot, originalBody.materialSnapshot);
  assert.deepEqual(unchangedBody.materialSnapshot, originalBody.materialSnapshot);
  assert.equal(replacedBody.massKg, originalBody.massKg);
  assert.equal(object(replacedBody.materialSnapshot).densityGPerCm3, 2.7);
  assert.equal(object(replacedBody.materialSnapshot).basis, 'builtin-catalogue-not-measured');
  // A callback supplies a tensor, not measured density, native-SI provenance or physical certification.
});
