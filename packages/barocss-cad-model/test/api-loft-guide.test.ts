import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch, BarocssError, type StudioPart } from '../src/api';
import { evaluateDoc } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { editFields } from '../src/app/editFields';
import { confirmDimension } from '../src/chat/drafts';
import { checkNode } from '../src/chat/features';
import { isRefusal } from '../src/engine/refusal';

// Reuse the fixed Kernel CG1 oracles. Coordinates are mm; no observed result defines an expectation.
type Point = [number, number, number];
type CubicControls = [Point, Point, Point, Point];
type QuadraticControls = [Point, Point, Point];
const EPS = 1e-9;
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= EPS, `${actual} != ${expected}`);
const vector = (actual: readonly number[], expected: readonly number[]) => {
  assert.equal(actual.length, expected.length); expected.forEach((value, i) => close(actual[i], value));
};
const flat = (z: number) => ({ origin: [0, 0, z] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number], yAxis: [0, 1, 0] as [number, number, number] });
const cubic = () => ({ kind: 'cubic-bezier' as const, controlPoints: [[1, 0, 0], [4, 0, 1], [2, 0, 2], [4, 0, 3]] as CubicControls });
const sections = (upperRadius = 4) => [
  { sketch: sketch().circle({ r: 1 }), frame: flat(0) },
  { sketch: sketch().circle({ r: upperRadius }), frame: flat(3) },
];
function massOracle(p: StudioPart, volume: number, centroid: readonly number[]): void {
  const m = p.mass({ density: 1 }); close(m.volume, volume); vector(m.centroid, centroid);
}
async function reopened(p: StudioPart, volume: number, centroid: readonly number[]): Promise<void> {
  const doc = p.doc, before = structuredClone(doc), result = evaluateDoc(doc, 1);
  assert.ok(result.ok, result.ok ? '' : result.error.detail);
  assert.equal(result.bodies.length, 1); assert.ok(result.bodies[0].volume !== null); close(result.bodies[0].volume, volume);
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened));
  assert.deepEqual(opened.doc, doc, 'codec preserves the authored guide, section frames and sketches exactly');
  const continued = part('reopened loft', opened.doc); massOracle(continued, volume, centroid);
  const after = evaluateDoc(opened.doc, 2); assert.ok(after.ok, after.ok ? '' : after.error.detail);
  assert.equal(after.bodies.length, 1); assert.ok(after.bodies[0].volume !== null); close(after.bodies[0].volume, volume);
  assert.deepEqual(doc, before); assert.deepEqual(p.doc, before);
}

test('public loft: cubic guide and explicit section frames reach evaluation and codec reopen with the fixed CG1 oracle', async () => {
  const base = part('cubic loft'), before = base.doc, input = sections(), options = { guide: cubic() };
  const inputBefore = input.map(s => ({ sketch: s.sketch.data, frame: structuredClone(s.frame) })), optionsBefore = structuredClone(options);
  const made = base.loft(input, options), doc = made.doc, loft = doc.nodes.find(n => n.kind === 'loft');
  assert.ok(loft && loft.kind === 'loft'); assert.deepEqual(loft.guide, optionsBefore.guide);
  assert.deepEqual(loft.sections.map(s => s.sketch), [0, 1]);
  for (const [i, section] of loft.sections.entries()) { assert.ok('frame' in section); assert.deepEqual(section.frame, inputBefore[i].frame); }
  const profiles = doc.nodes.filter(n => n.kind === 'sketch'); assert.equal(profiles.length, 2);
  for (const [i, profile] of profiles.entries()) { assert.ok(profile.kind === 'sketch' && profile.profile === 'circle'); assert.equal(typeof profile.radius, 'number'); assert.ok(typeof profile.radius === 'number'); close(profile.radius, i ? 4 : 1); }
  massOracle(made, 21 * Math.PI, [11 / 140, 0, 57 / 28]);
  await reopened(made, 21 * Math.PI, [11 / 140, 0, 57 / 28]);
  // Same base, sections and feature ids: only the guide changes, so a guide-blind cache would retain the bent COM.
  const straightGuide = { kind: 'cubic-bezier' as const, controlPoints: [[1, 0, 0], [2, 0, 1], [3, 0, 2], [4, 0, 3]] as CubicControls };
  const straight = base.loft(input, { guide: straightGuide });
  assert.deepEqual(straight.doc.nodes.map(n => n.id), made.doc.nodes.map(n => n.id));
  massOracle(straight, 21 * Math.PI, [0, 0, 57 / 28]);
  massOracle(made, 21 * Math.PI, [11 / 140, 0, 57 / 28]);
  assert.deepEqual(base.doc, before); assert.deepEqual(options, optionsBefore);
  assert.deepEqual(input.map(s => ({ sketch: s.sketch.data, frame: s.frame })), inputBefore);
});

test('public loft: legacy heights, unguided frames and the quadratic guide retain their existing cylinder oracles', async () => {
  const quadratic = { kind: 'quadratic-bezier' as const, controlPoints: [[1, 0, 0], [3, 0, 1.5], [1, 0, 3]] as QuadraticControls };
  const legacy = part('legacy loft').loft([{ sketch: sketch().circle({ r: 1 }), z: 0 }, { sketch: sketch().circle({ r: 1 }), z: 3 }]);
  const unguided = part('unguided loft').loft(sections(1));
  const guided = part('quadratic loft').loft(sections(1), { guide: quadratic });
  for (const p of [legacy, unguided]) {
    const node = p.doc.nodes.find(n => n.kind === 'loft'); assert.ok(node && node.kind === 'loft'); assert.equal(node.guide, undefined);
    massOracle(p, 3 * Math.PI, [0, 0, 1.5]); await reopened(p, 3 * Math.PI, [0, 0, 1.5]);
  }
  const node = guided.doc.nodes.find(n => n.kind === 'loft'); assert.ok(node && node.kind === 'loft'); assert.deepEqual(node.guide, quadratic);
  massOracle(guided, 3 * Math.PI, [2 / 3, 0, 1.5]); await reopened(guided, 3 * Math.PI, [2 / 3, 0, 1.5]);
});

test('public loft: invalid guide failure leaves the accepted part, inputs and mass results intact and returns document copies', () => {
  const base = part('accepted loft').parameter('H', 0), input = sections(), options = { guide: cubic() }, accepted = base.loft(input, options);
  const before = accepted.doc, baseBefore = base.doc, massBefore = accepted.mass({ density: 1 });
  const inputBefore = input.map(s => ({ sketch: s.sketch.data, frame: structuredClone(s.frame) }));
  const bad = cubic(); bad.controlPoints[1][2] = 1.25; const badBefore = structuredClone(bad);
  assert.throws(() => accepted.loft(input, { guide: bad }), error => {
    assert.ok(error instanceof BarocssError); assert.equal(error.code, 'GEOMETRY'); assert.equal(error.where, 'evaluate'); assert.match(error.message, /cubic guide control 1 must lie exactly on the cap fraction 1\/3 plane/); return true;
  });
  const extra = { guide: cubic(), unsupported: true }, extraBefore = structuredClone(extra);
  assert.throws(() => accepted.loft(input, extra), error => error instanceof BarocssError && error.code === 'VALUE' && error.where === 'facade');
  assert.deepEqual(extra, extraBefore);
  const savedBefore = JSON.stringify(before);
  // Deliberate untyped JS calls: public section z is a finite number, not the document-only Dim encoding.
  for (const z of [{ parameter: 'H' }, NaN, Infinity, -Infinity]) {
    const badSections = [{ sketch: sketch().circle({ r: 1 }), z }, { sketch: sketch().circle({ r: 4 }), z: 3 }];
    const callerBefore = badSections.map(s => ({ sketch: s.sketch.data, z: structuredClone(s.z) }));
    assert.throws(() => Reflect.apply(accepted.loft, accepted, [badSections]), error =>
      error instanceof BarocssError && error.code === 'VALUE' && error.where === 'facade'
      && /a loft section z must be a finite number of mm/.test(error.message));
    assert.deepEqual(badSections.map(s => ({ sketch: s.sketch.data, z: s.z })), callerBefore);
    assert.deepEqual(accepted.doc, before); assert.equal(JSON.stringify(accepted.doc), savedBefore);
    if (typeof z === 'object') { z.parameter = 'changed-after-refusal'; assert.equal(JSON.stringify(accepted.doc), savedBefore); }
  }


  // Deliberate JS accessor boundary: a single snapshot must not read 0, then 0, then a document-only Dim.
  let zReads = 0;
  const getterParameter = { parameter: 'H' }, getterValues = [0, 0, getterParameter];
  const firstSection = { sketch: sketch().circle({ r: 1 }), get z() { return getterValues[Math.min(zReads++, 2)]; } };
  const secondSection = { sketch: sketch().circle({ r: 4 }), z: 3 };
  const descriptorBefore = Object.getOwnPropertyDescriptor(firstSection, 'z');
  const sketchBefore = [firstSection.sketch.data, secondSection.sketch.data];
  const getterPart: StudioPart = Reflect.apply(base.loft, base, [[firstSection, secondSection]]);
  assert.equal(zReads, 1, 'section z is read exactly once before validation and storage');
  const getterDoc = getterPart.doc, stored = getterDoc.nodes.find(n => n.kind === 'loft');
  assert.ok(stored && stored.kind === 'loft'); assert.ok('z' in stored.sections[0]);
  assert.equal(typeof stored.sections[0].z, 'number'); assert.equal(stored.sections[0].z, 0);
  assert.deepEqual(Object.getOwnPropertyDescriptor(firstSection, 'z'), descriptorBefore);
  assert.deepEqual([firstSection.sketch.data, secondSection.sketch.data], sketchBefore); assert.equal(secondSection.z, 3);
  assert.deepEqual(getterValues, [0, 0, { parameter: 'H' }]);
  getterValues[0] = 99; getterParameter.parameter = 'changed-after-call'; secondSection.z = 9;
  assert.deepEqual(getterPart.doc, getterDoc); assert.equal(zReads, 1);
  assert.deepEqual(base.doc, baseBefore); assert.equal(JSON.stringify(accepted.doc), savedBefore);

  assert.deepEqual(bad, badBefore); assert.deepEqual(accepted.doc, before); assert.deepEqual(base.doc, baseBefore);
  assert.deepEqual(accepted.mass({ density: 1 }), massBefore);
  assert.deepEqual(input.map(s => ({ sketch: s.sketch.data, frame: s.frame })), inputBefore);
  // The caller's successful input and the facade's returned document are copies, not live-follow inputs.
  options.guide.controlPoints[1][0] += 1; input[1].frame.origin[2] = 99;
  const copy = accepted.doc; copy.nodes.length = 0;
  assert.deepEqual(accepted.doc, before); assert.deepEqual(accepted.mass({ density: 1 }), massBefore);
});


test('public loft: frame editing, draft depth and chat admission preserve the explicit guide contract', () => {
  const legacy = part('legacy depth guard').loft([{ sketch: sketch().circle({ r: 1 }), z: 0 }, { sketch: sketch().circle({ r: 4 }), z: 3 }]);
  for (const [made, guideOnly] of [[part('frame guard').loft(sections(1)), false], [part('guide guard').loft(sections(), { guide: cubic() }), false], [legacy, true]] as const) {
    const doc = made.doc, original = structuredClone(doc), index = doc.nodes.findIndex(n => n.kind === 'loft');
    assert.ok(index >= 0); const node = doc.nodes[index]; assert.ok(node.kind === 'loft' && node.id);
    // A deliberately invalid legacy+guide edit tests the guide-only refusal before geometry; no success claim.
    if (guideOnly) Reflect.set(node, 'guide', cubic());
    const before = structuredClone(doc);
    assert.equal(checkNode(node, doc.nodes, doc.parameters), null);
    const fields = editFields(doc.nodes, index);
    if (guideOnly) assert.deepEqual(fields.filter(field => /^z[01]$/.test(field.key)).map(field => field.key), ['z0', 'z1']);
    else assert.ok(fields.every(field => !/^z[01]$/.test(field.key)), 'framed sections expose no legacy z field');
    // Synthetic draft metadata exercises the existing confirmation consumer; it is not an image-tracing claim.
    const drafted: typeof doc = { ...doc, drafts: { version: 1, drafts: [{
      id: 'F1', from: { image: 'guide-guard' }, nodes: [node.id],
      dims: [{ name: 'depth', label: 'depth', value: 3, basis: 'scaled', drive: { kind: 'depth', nodes: [node.id] } }],
    }] } };
    const draftedBefore = structuredClone(drafted);
    assert.throws(() => confirmDimension(drafted, 'F1.depth', 6, 'fixture-at'), error =>
      isRefusal(error, 'BOUND') && error.message === '[BOUND] a guided or framed loft depth cannot be scaled: edit its explicit frames and guide instead');
    assert.deepEqual(drafted, draftedBefore);
    const badFrame = structuredClone(node); Reflect.set(badFrame.sections[0], 'frame', flat(0)); Reflect.set(badFrame.sections[0], 'z', 0);
    assert.equal(checkNode(badFrame, doc.nodes, doc.parameters), 'loft.sections: each framed section is {sketch, frame:{origin,xAxis,yAxis}} with finite 3D points and no z');
    const badGuide = structuredClone(node); Reflect.set(badGuide, 'guide', { kind: 'cubic-bezier', controlPoints: [[1, 0, 0]] });
    assert.equal(checkNode(badGuide, doc.nodes, doc.parameters), 'loft.guide: exactly 4 finite world-mm control points');
    assert.deepEqual(doc, before); assert.deepEqual(made.doc, original);
  }
});


test('public loft: polynomial multi-span guide on height sections keeps volume, centroid and file values', async () => {
  // The two quadratic spans have linear height and x = 12u - 6u², then 6 - 6u².
  // Their mean x is 4. Every slice is a translated 10 × 10 square: V = 2000, COM = (9, 5, 10).
  const guide = { kind: 'nurbs' as const, degree: 2, knots: [0, 0, 0, 0.5, 1, 1, 1], controlPoints: [[0, 0, 0], [6, 0, 5], [6, 0, 15], [0, 0, 20]] as Point[] };
  const square = (x: number) => sketch().rectangle({ w: 10, d: 10, x, y: 0 });
  const base = part('general loft'), before = base.doc, options = { guide }, original = structuredClone(options);
  for (const input of [
    [{ sketch: square(0), z: 0 }, { sketch: square(0), z: 20 }],
    [{ sketch: square(0), z: 0 }, { sketch: square(6), z: 10 }, { sketch: square(0), z: 20 }],
  ]) {
    const made = base.loft(input, options), node = made.doc.nodes.at(-1);
    assert.ok(node?.kind === 'loft'); assert.deepEqual(node.guide, guide);
    assert.equal(checkNode(node, made.doc.nodes, made.doc.parameters), null);
    massOracle(made, 2000, [9, 5, 10]); await reopened(made, 2000, [9, 5, 10]);
    const copy = made.doc, stored = copy.nodes.at(-1); assert.ok(stored?.kind === 'loft' && stored.guide?.kind === 'nurbs');
    Reflect.set(stored.guide.knots, 0, -10); Reflect.set(stored.guide.controlPoints[0], 0, 50);
    assert.deepEqual(made.doc.nodes.at(-1), node);
  }
  const accepted = base.loft([{ sketch: square(0), z: 0 }, { sketch: square(0), z: 20 }], options), acceptedBefore = accepted.doc;
  assert.throws(() => accepted.loft([{ sketch: square(0), z: 0 }, { sketch: square(5), z: 10 }, { sketch: square(0), z: 20 }], options), /guide must pass through a vertex of section 1/);
  assert.deepEqual(accepted.doc, acceptedBefore); assert.deepEqual(base.doc, before); assert.deepEqual(options, original);
});


test('public loft: a tapered section follows nonlinear guide height and keeps the closed-form frustum on reopen', async () => {
  const made = part('height parameter').loft([{ sketch: sketch().rectangle({ w: 1, d: 1 }), z: 0 }, { sketch: sketch().rectangle({ w: 2, d: 2 }), z: 1 }], { guide: { kind: 'nurbs', degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[0, 0, 0], [0, 0, 0.1], [0, 0, 1]] } });
  massOracle(made, 7 / 3, [45 / 56, 45 / 56, 17 / 28]);
  const result = evaluateDoc(made.doc, 7); assert.ok(result.ok, result.ok ? '' : result.error.detail);
  assert.equal(result.bodies[0].mesh.faces.length, 6);
  // Display kind describes the patch representation. Check the actual Float32 vertices against the six planes.
  const positions = result.bodies[0].mesh.positions, error = 4 * 2 ** -23;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    assert.ok(z >= -error && z <= 1 + error && x >= -error && y >= -error && x <= 1 + z + error && y <= 1 + z + error, `vertex ${x},${y},${z} is outside the frustum`);
    assert.ok(Math.min(Math.abs(z), Math.abs(z - 1), Math.abs(x), Math.abs(y), Math.abs(x - 1 - z), Math.abs(y - 1 - z)) <= error, `vertex ${x},${y},${z} is off the frustum planes`);
  }
  await reopened(made, 7 / 3, [45 / 56, 45 / 56, 17 / 28]);
});
