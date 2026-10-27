import test from 'node:test';
import assert from 'node:assert/strict';
import { Robot } from '../src/api/robot';
import { GravityExperimentRecord } from '../src/api/experimentRecord';
import { KEY, options, rodDoc } from './fixtures/static-gravity-rod';

// Source-contract cases for past JSON records, not measured materials or a new dynamics calculation.
function record(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

test('gravity record: a real rod experiment survives JSON serialization with its old report and validated preview', () => {
  const doc = rodDoc(), input = options(60), experiment = new Robot(doc).gravityExperiment(input);
  const original = experiment.report, saved = experiment.record(), reopened = GravityExperimentRecord.parse(JSON.stringify(saved));
  // JSON omits undefined object fields and represents -0 as 0; this is not a bitwise numeric archive.
  const jsonReport: unknown = JSON.parse(JSON.stringify(original));
  assert.deepEqual(reopened.report, jsonReport);
  assert.deepEqual(reopened.toJSON(), { format: 'barocss-gravity-experiment-record', schema: 1, report: jsonReport });
  const preview = reopened.preview;
  assert.equal(preview.joint, KEY); assert.equal(preview.occurrence, 'rod'); assert.equal(preview.angle, 60);
  assert.deepEqual(preview.gravity, input.gravity);
  assert.equal(preview.torque, original.result.torques[KEY]);
  assert.deepEqual(preview.axis, JSON.parse(JSON.stringify(original.scope.axis)));
  assert.equal(preview.coordinateFrame, original.scope.coordinateFrame);
  assert.deepEqual(preview.assumptions, original.assumptions);
  assert.equal(reopened.matches(doc, input), true);
});

test('gravity record: constructor, report, preview and JSON envelope are detached from mutable callers', () => {
  const doc = rodDoc(), input = options(), experiment = new Robot(doc).gravityExperiment(input);
  const supplied = experiment.record().toJSON(), imported = new GravityExperimentRecord(supplied);
  const before = imported.toJSON();
  record(record(supplied).report).assumptions = ['Caller rewrote the source'];
  const report = record(imported.report); record(report.inputs).values = { [KEY]: 123 };
  record(record(report.result).torques)[KEY] = 999;
  const preview = imported.preview;
  assert.equal(Reflect.set(preview.gravity, 0, 100), true); assert.equal(preview.gravity[0], 100);
  assert.equal(Reflect.set(preview.axis.point, 0, 100), true); assert.equal(preview.axis.point[0], 100);
  assert.equal(Reflect.set(preview.assumptions, 0, 'Caller rewrote the preview'), true);
  assert.equal(preview.assumptions[0], 'Caller rewrote the preview');
  const exported = imported.toJSON(); record(exported).report = {};
  assert.equal(Reflect.set(input.gravity, 2, 9810), true); doc.instances![0].position[0] = 42;
  assert.deepEqual(imported.toJSON(), before);
  assert.equal(imported.matches(rodDoc(), options()), true);
});

test('gravity record: matches binds the complete document, explicit angle and gravity direction after reopening', () => {
  const doc = rodDoc(), input = options(), saved = new Robot(doc).gravityExperiment(input).record();
  const reopened = GravityExperimentRecord.parse(JSON.stringify(saved));
  assert.equal(reopened.matches(doc, options()), true);
  assert.equal(reopened.matches(doc, options(1)), false);
  assert.equal(reopened.matches(doc, options(0, [9806.65, 0, 0])), false);
  assert.equal(reopened.matches(doc, options(0, [0, 0, 9806.65])), false);
  for (const mutate of [
    (copy: typeof doc) => { copy.instances![0].position[0] = 1; },
    (copy: typeof doc) => { copy.instances![0].doc.bodies!.b1.material = 'unknown-catalogue-id'; },
    (copy: typeof doc) => { copy.mates![0].a.face = 'origin:xy'; },
    (copy: typeof doc) => { copy.robot!.joints = { [KEY]: { lower: -30, upper: 30 } }; },
  ]) {
    const changed = structuredClone(doc); mutate(changed);
    assert.equal(reopened.matches(changed, input), false);
    assert.deepEqual(reopened.report, saved.report, 'checking a stale document does not overwrite its archived result');
  }
});

test('gravity record: an old JSON result remains readable when the current document is outside experiment admission', () => {
  const doc = rodDoc(), imported = GravityExperimentRecord.parse(JSON.stringify(new Robot(doc).gravityExperiment(options()).record()));
  const before = imported.report, changed = structuredClone(doc);
  changed.instances![0].doc = { ...changed.instances![0].doc, instances: [{ id: 'payload', name: 'Payload', doc: rodDoc().instances![0].doc, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  assert.equal(imported.matches(changed, options()), false);
  assert.deepEqual(imported.report, before);
  assert.equal(imported.preview.joint, KEY);
});

test('gravity record: consistent finite edited results are not authenticated or recalculated by the JSON reader', () => {
  const doc = rodDoc(), envelope = new Robot(doc).gravityExperiment(options()).record().toJSON();
  const archived = record(record(envelope).report), result = record(archived.result);
  record(result.torques)[KEY] = 999; record(result.generalized)[KEY] = 999;
  const imported = GravityExperimentRecord.parse(JSON.stringify(envelope));
  assert.equal(imported.preview.torque, 999, 'validation is structural consistency, not a physics recomputation');
  assert.equal(imported.matches(doc, options()), true, 'input equality is not producer-code/catalogue currentness or authenticity');
  assert.equal(Object.hasOwn(record(imported.report), 'measuredValidation'), false);
  assert.equal(Object.hasOwn(record(imported.report), 'producerVerified'), false);
});
