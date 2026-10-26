import test from 'node:test';
import assert from 'node:assert/strict';
import { BarocssError } from '../src/api/refusal';
import { GravityExperimentDefinition } from '../src/api/experimentDefinition';
import { canonical, fnv64 } from '../src/util/revision';
import { KEY, options, rodDoc } from './fixtures/static-gravity-rod';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);
const code = (expected: string) => (error: unknown) => error instanceof BarocssError && error.code === expected;
function object(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

// Source-contract tests: opening a definition is not a calculation or measured validation.
test('gravity definition: create and JSON roundtrip preserve exactly the explicit input contract', () => {
  const doc = rodDoc(), input = options(60), definition = GravityExperimentDefinition.create(doc, input);
  const data = definition.toJSON(), reopened = GravityExperimentDefinition.parse(JSON.stringify(data));
  assert.deepEqual(Object.keys(data).sort(), ['binding', 'format', 'inputs', 'profile', 'schema', 'units']);
  assert.equal(data.format, 'barocss-gravity-experiment-definition'); assert.equal(data.schema, 1);
  assert.equal(data.profile, 'static-gravity-v1'); assert.deepEqual(data.units, { angle: 'degree', gravity: 'mm/s²' });
  assert.deepEqual(data.inputs, input);
  assert.deepEqual(data.binding, { document: canonical(doc), revision: fnv64(canonical(doc)), inputs: canonical(input) });
  assert.deepEqual(reopened.toJSON(), data); assert.deepEqual(reopened.options, input);
  assert.equal(reopened.matches(doc), true);
  const optionalDoc = structuredClone(doc);
  optionalDoc.drawing = undefined;
  const optionalDefinition = GravityExperimentDefinition.create(optionalDoc, input);
  assert.deepEqual(optionalDefinition.toJSON().binding, data.binding);
  assert.equal(reopened.matches(optionalDoc), true);
  assert.equal(optionalDefinition.matches(doc), true);
  for (const field of ['report', 'result', 'torque', 'inertia', 'materialSnapshot']) assert.equal(Object.hasOwn(data, field), false);
});

test('gravity definition: caller inputs, constructor data and every exported copy are detached', () => {
  const doc = rodDoc(), input = options(), original = GravityExperimentDefinition.create(doc, input);
  const supplied = original.toJSON(), imported = new GravityExperimentDefinition(supplied), before = imported.toJSON();
  assert.equal(Reflect.set(input.values, KEY, 123), true); assert.equal(Reflect.set(input.gravity, 2, 9810), true);
  doc.instances![0].position[0] = 7;
  object(object(supplied).inputs).values = { [KEY]: 99 };
  const returned = imported.options;
  assert.equal(Reflect.set(returned.values, KEY, 80), true); assert.equal(Reflect.set(returned.gravity, 0, 1), true);
  const exported = imported.toJSON(); object(exported).binding = {};
  assert.deepEqual(original.toJSON(), before); assert.deepEqual(imported.toJSON(), before);
  assert.deepEqual(imported.options, options()); assert.equal(imported.matches(rodDoc()), true);
});

test('gravity definition: matching uses the complete current document without changing the stored angle or gravity', () => {
  const doc = rodDoc(), definition = GravityExperimentDefinition.create(doc, options(60)), before = definition.toJSON();
  for (const mutate of [
    (copy: typeof doc) => { copy.instances![0].position[0] = 1; },
    (copy: typeof doc) => { copy.instances![0].doc.bodies!.b1.material = 'unknown-fixture-material'; },
    (copy: typeof doc) => { copy.instances![0].doc.nodes[1] = { id: 'n1', kind: 'extrude', sketch: 0, height: 12 }; },
    (copy: typeof doc) => { copy.robot!.joints = { [KEY]: { lower: -30, upper: 30 } }; },
  ]) {
    const changed = structuredClone(doc); mutate(changed);
    assert.equal(definition.matches(changed), false); assert.deepEqual(definition.toJSON(), before);
  }
  assert.deepEqual(definition.options, options(60));
});

test('gravity definition: explicit rebind returns a separate definition and leaves the original binding unchanged', () => {
  const doc = rodDoc(), original = GravityExperimentDefinition.create(doc, options(60)), before = original.toJSON();
  const changed = structuredClone(doc); changed.instances![0].position[0] = 7;
  const rebound = original.rebind(changed);
  assert.notEqual(rebound, original); assert.equal(rebound.matches(changed), true); assert.equal(rebound.matches(doc), false);
  assert.equal(original.matches(doc), true); assert.equal(original.matches(changed), false);
  assert.deepEqual(rebound.options, original.options); assert.deepEqual(original.toJSON(), before);
  assert.equal(rebound.toJSON().binding.document, canonical(changed));
});

test('gravity definition: only explicit run creates fresh zero and sixty degree holding-torque results', () => {
  const doc = rodDoc(), beforeDoc = structuredClone(doc), zero = GravityExperimentDefinition.create(doc, options());
  const first = zero.run(doc), firstRecord = first.record(), old = firstRecord.toJSON();
  for (const angle of [0, 60]) {
    const definition = GravityExperimentDefinition.parse(JSON.stringify(GravityExperimentDefinition.create(doc, options(angle))));
    const before = definition.toJSON(), result = definition.run(doc), report = result.report;
    assert.notEqual(result, first);
    // Pure 100×10×10 mm rod, authored catalogue density 2.7 g/cm³: 27 g; this is not measured material evidence.
    near(report.result.torques[KEY], -0.027 * 9.80665 * 50 * Math.cos(angle * Math.PI / 180));
    assert.equal(report.result.units[KEY], 'N·mm'); assert.equal(report.inputs.values[KEY], angle);
    assert.deepEqual(report.inputs.gravity, [0, 0, -9806.65]);
    assert.deepEqual(definition.toJSON(), before); assert.deepEqual(firstRecord.toJSON(), old);
  }
  assert.deepEqual(doc, beforeDoc);
});

test('gravity definition: stale and unsupported nested runs refuse without replacing a previous result', () => {
  const doc = rodDoc(), definition = GravityExperimentDefinition.create(doc, options());
  let previous = definition.run(doc); const original = previous, oldRecord = previous.record().toJSON();
  const changed = structuredClone(doc); changed.instances![0].position[0] = 1;
  assert.throws(() => { previous = definition.run(changed); }, code('VALUE'));
  const nested = rodDoc(); nested.instances![0].doc.instances = [{ id: 'payload', name: 'Payload',
    doc: rodDoc().instances![0].doc, position: [0, 0, 0], rotation: [0, 0, 0] }];
  // Create, rebind and parse perform no admission/evaluation; the existing profile refuses only at explicit run.
  const nestedDefinition = GravityExperimentDefinition.parse(JSON.stringify(definition.rebind(nested)));
  assert.equal(nestedDefinition.matches(nested), true);
  assert.deepEqual(GravityExperimentDefinition.create(nested, options()).toJSON(), nestedDefinition.toJSON());
  assert.throws(() => { previous = nestedDefinition.run(nested); }, code('ROBOT'));
  assert.equal(previous, original); assert.deepEqual(previous.record().toJSON(), oldRecord);
});
