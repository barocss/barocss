import test from 'node:test';
import assert from 'node:assert/strict';
import { Robot } from '../src/api/robot';
import { GravityExperimentRecord } from '../src/api/experimentRecord';
import { MATERIALS } from '../src/library/materials';
import { canonical, fnv64 } from '../src/util/revision';
import { KEY, options, rodDoc } from './fixtures/static-gravity-rod';

function object(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function body(report: unknown): Record<string, unknown> {
  const links = object(object(report).inertia).links; assert.ok(Array.isArray(links));
  const moving = links.find(link => object(link).link === 'rod'); assert.ok(moving);
  const bodies = object(moving).bodies; assert.ok(Array.isArray(bodies)); assert.equal(bodies.length, 1);
  return object(bodies[0]);
}
function produced() { return new Robot(rodDoc()).gravityExperiment(options()).record().toJSON(); }
const page = { url: 'https://example.invalid/authored-density', read: '2026-10-26', label: 'Authored test source', note: 'Not fetched or authenticated.' };

/** An authored schema-one reader fixture, not captured evidence from an older producer. */
function legacy(inertia: Record<string, unknown>) {
  const document = canonical(rodDoc()), inputs = options();
  return { format: 'barocss-gravity-experiment-record', schema: 1, report: {
    profile: 'static-gravity-v1', binding: { document, revision: fnv64(document), inputs: canonical(inputs) }, inputs,
    units: { angle: 'degree', length: 'mm', mass: 'g', inertia: 'g·mm²', gravity: 'mm/s²', torque: 'N·mm' }, inertia,
    result: { torques: { [KEY]: -13.2389775 }, generalized: { [KEY]: -13.2389775 }, units: { [KEY]: 'N·mm' }, gravity: 9806.65 },
    scope: { joint: KEY, occurrence: 'rod', axis: { point: [0, 0, 0], direction: [0, 1, 0] }, coordinateFrame: 'Authored world-axis fixture.' },
    assumptions: ['Reader compatibility shape only; not measured or authenticated.'],
  } };
}

test('material preview: recorded density, source page and public units are preserved without conversion or fetching', () => {
  const supplied = produced(), snapshot = object(body(supplied.report).materialSnapshot);
  snapshot.densityPage = structuredClone(page); snapshot.unrecognizedSourceDetail = { retained: true };
  const imported = GravityExperimentRecord.parse(JSON.stringify(supplied)), preview = imported.materialPreview;
  assert.ok(preview);
  const moving = preview.bodies.find(item => item.link === 'rod'); assert.ok(moving?.materialSnapshot);
  assert.equal(moving.body, body(imported.report).key);
  assert.equal(moving.materialSnapshot.densityGPerCm3, 2.7);
  assert.equal(moving.materialSnapshot.catalogueDensityGPerCm3, 2.7);
  assert.deepEqual(moving.materialSnapshot.densityPage, page);
  assert.equal(moving.materialSnapshot.basis, 'builtin-catalogue-not-measured');
  assert.equal(moving.inertiaSource, 'mmgs-density-scaled');
  assert.equal(Object.hasOwn(moving.materialSnapshot, 'unrecognizedSourceDetail'), false);
  assert.deepEqual(object(body(imported.report).materialSnapshot).unrecognizedSourceDetail, { retained: true });
  assert.deepEqual(object(imported.report).units, { angle: 'degree', length: 'mm', mass: 'g', inertia: 'g·mm²', gravity: 'mm/s²', torque: 'N·mm' });
});

test('material preview: a recorded used-versus-declared density difference is displayed without certifying or recalculating it', () => {
  const supplied = produced(), oldTorque = new GravityExperimentRecord(supplied).preview.torque;
  const snapshot = object(body(supplied.report).materialSnapshot);
  snapshot.densityGPerCm3 = 5.4; snapshot.catalogueDensityGPerCm3 = 2.7;
  snapshot.densitySourceText = null; snapshot.rowEstimate = null;
  const imported = new GravityExperimentRecord(supplied);
  const moving = imported.materialPreview?.bodies.find(item => item.link === 'rod'); assert.ok(moving?.materialSnapshot);
  assert.equal(moving.materialSnapshot.densityGPerCm3, 5.4);
  assert.equal(moving.materialSnapshot.catalogueDensityGPerCm3, 2.7);
  assert.equal(moving.materialSnapshot.densitySourceId, 'S-DENS');
  assert.equal(moving.materialSnapshot.densitySourceText, null);
  assert.equal(moving.materialSnapshot.rowEstimate, null);
  assert.equal(imported.preview.torque, oldTorque, 'metadata projection does not recalculate a synthetic edited report');
  assert.equal(imported.matches(rodDoc(), options()), true, 'document/input equality is not material authenticity or current catalogue compatibility');
});

test('material preview: old missing metadata and missing links remain absent without invented fallback', () => {
  const missing = new GravityExperimentRecord(legacy({}));
  assert.equal(missing.materialPreview, null);
  assert.deepEqual(new GravityExperimentRecord(legacy({ links: [] })).materialPreview, { bodies: [] });
  assert.deepEqual(new GravityExperimentRecord(legacy({ links: [{ link: 'empty', bodies: [] }] })).materialPreview, { bodies: [] });
  const supplied = legacy({ links: [{ link: 'old-link', bodies: [{ key: 'old-body' }, { key: 'other-body' }] }] });
  const imported = new GravityExperimentRecord(supplied), before = imported.toJSON();
  assert.deepEqual(imported.materialPreview, { bodies: [
    { link: 'old-link', body: 'old-body', materialSnapshot: null, inertiaSource: null },
    { link: 'old-link', body: 'other-body', materialSnapshot: null, inertiaSource: null },
  ] });
  assert.deepEqual(imported.toJSON(), before);
});

test('material preview: repeated getters detach nested source data and ignore later catalogue edits', { concurrency: false }, () => {
  const supplied = produced(); object(body(supplied.report).materialSnapshot).densityPage = structuredClone(page);
  const imported = new GravityExperimentRecord(supplied), before = imported.toJSON(), expected = imported.materialPreview;
  const returned = imported.materialPreview; assert.ok(returned);
  const moving = returned.bodies.find(item => item.link === 'rod'); assert.ok(moving?.materialSnapshot?.densityPage);
  assert.equal(Reflect.set(moving.materialSnapshot.densityPage, 'label', 'Caller changed page'), true);
  assert.equal(Reflect.set(moving.materialSnapshot, 'densityGPerCm3', 99), true);
  returned.bodies.length = 0;
  object(body(supplied.report).materialSnapshot).resolvedMaterialId = 'caller-replaced';
  const material = MATERIALS.find(row => row.id === 'al6061'); assert.ok(material);
  const density = material.density;
  try {
    material.density = density * 2;
    assert.deepEqual(imported.materialPreview, expected);
    assert.deepEqual(imported.toJSON(), before);
  } finally { material.density = density; }
});

test('material preview: an inertia callback label is independent of a missing or recorded mass-density snapshot', () => {
  const noSnapshot = new GravityExperimentRecord(legacy({ links: [{ link: 'rod', bodies: [{ key: 'authored', inertiaSource: 'callback-override' }] }] }));
  assert.deepEqual(noSnapshot.materialPreview, { bodies: [{ link: 'rod', body: 'authored', materialSnapshot: null, inertiaSource: 'callback-override' }] });
  const supplied = produced(), original = structuredClone(object(body(supplied.report).materialSnapshot));
  body(supplied.report).inertiaSource = 'callback-override';
  const imported = new GravityExperimentRecord(supplied), moving = imported.materialPreview?.bodies.find(item => item.link === 'rod');
  assert.ok(moving); assert.equal(moving.inertiaSource, 'callback-override');
  assert.deepEqual(moving.materialSnapshot, original, 'a source label does not replace the recorded mass-density metadata or prove an applied callback');
});
