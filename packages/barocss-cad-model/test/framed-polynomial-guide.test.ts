import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch, BarocssError } from '../src/api';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { editFields } from '../src/app/editFields';

type Point = [number, number, number];
const EPS = 1e-9;
const frame = (h: number) => ({ origin: [-2 + h, 3, 4] as Point, xAxis: [0, 1, 0] as Point, yAxis: [0, 0, 1] as Point });
function guide(count: number, degree: number) {
  const knots = [...Array(degree + 1).fill(0), ...Array.from({ length: count - degree - 1 }, (_, i) => (i + 1) / (count - degree)), ...Array(degree + 1).fill(1)];
  const controlPoints: Point[] = Array.from({ length: count }, (_, i) => {
    let t = 0;
    for (let j = 1; j <= degree; j++) t += knots[i + j];
    return [-2 + t / degree, 3, 4];
  });
  return { kind: 'nurbs' as const, degree, knots, controlPoints };
}
function raw(sections: number, count: number, degree: number): StudioDoc {
  const nodes: ModelNode[] = [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [1, 1] },
    { id: 'n1', kind: 'loft', from: Array(sections).fill(0), sections: Array.from({ length: sections }, (_, i) => ({ sketch: 0, frame: frame(i / (sections - 1)) })), guide: guide(count, degree) },
  ];
  return { ...emptyDoc(), nodes, outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
}
function evaluated(doc: StudioDoc, width = 1, depth = 1): void {
  const result = evaluateDoc(doc, 1);
  assert.ok(result.ok, result.ok ? '' : result.error.detail);
  assert.equal(result.bodies.length, 1);
  const body = result.bodies[0];
  assert.equal(body.key, 'b1'); assert.ok(body.volume !== null);
  assert.ok(Math.abs(body.volume - width * depth) < EPS);
  assert.ok(body.centroid?.every((v, i) => Math.abs(v - [-1.5, 3 + width / 2, 4 + depth / 2][i]) < EPS));
  assert.ok(body.mesh.indices.length > 0 && body.mesh.positions.length > 0);
  assert.ok(Array.from(body.mesh.positions).every(Number.isFinite));
  assert.ok(Array.from(body.mesh.normals).every(Number.isFinite));
  assert.ok(Array.from(body.mesh.indices).every(index => index < body.mesh.positions.length / 3));
}

test('D316 raw framed polynomial guides: 2 through 8 sections retain 17/64 controls, world placement and native meshes', () => {
  for (let sections = 2; sections <= 8; sections++) for (const [count, degree] of [[17, 2], [64, 3]]) {
    const doc = raw(sections, count, degree), before = structuredClone(doc);
    evaluated(doc); assert.deepEqual(doc, before);
  }
});

test('D316 generic profile width/depth edits preserve the min-corner guide anchor, frames and current-schema roundtrip', async () => {
  for (const sections of [2, 8]) {
    const doc = raw(sections, 64, 3), before = structuredClone(doc);
    const width = editFields(doc.nodes, 1).find(field => field.label === 'Section 1 · Width');
    assert.ok(width?.kind === 'number');
    const wider = { ...doc, nodes: width.set(doc.nodes, 2) }; evaluated(wider, 2);
    const depth = editFields(wider.nodes, 1).find(field => field.label === 'Section 1 · Depth');
    assert.ok(depth?.kind === 'number');
    const edited = { ...wider, nodes: depth.set(wider.nodes, 3) }; evaluated(edited, 2, 3);
    assert.deepEqual(edited.nodes[1], before.nodes[1], 'only the shared source profile changes; frames and guide remain exact');
    assert.deepEqual(edited.nodes[0], { ...before.nodes[0], max: [2, 3] });
    for (const bytes of [new TextEncoder().encode(JSON.stringify(edited)), encodeStudioFile(edited)]) {
      const opened = await readStudioFile(bytes); assert.ok('doc' in opened, JSON.stringify(opened));
      assert.deepEqual(opened.doc, edited); evaluated(opened.doc, 2, 3);
    }
    evaluated(doc); assert.deepEqual(doc, before, 'edits and codecs do not mutate the accepted source');
  }
});

test('D316 public API: explicit frames and polynomial guides retain authored data and the independent unit-prism mass', async () => {
  for (const sections of [2, 8]) for (const [count, degree] of [[17, 2], [64, 3]]) {
    const input = Array.from({ length: sections }, (_, i) => ({ sketch: sketch().rectangle({ w: 1, d: 1 }), frame: frame(i / (sections - 1)) }));
    const options = { guide: guide(count, degree) }, before = structuredClone(options), frames = input.map(section => structuredClone(section.frame));
    const base = part('framed polynomial'), baseBefore = base.doc, made = base.loft(input, options);
    const mass = made.mass({ density: 1 });
    assert.ok(Math.abs(mass.volume - 1) < EPS); assert.ok(Math.abs(mass.mass - 0.001) < EPS);
    assert.ok(mass.centroid.every((v, i) => Math.abs(v - [-1.5, 3.5, 4.5][i]) < EPS));
    const doc = made.doc, loft = doc.nodes.at(-1); assert.ok(loft?.kind === 'loft');
    assert.deepEqual(loft.guide, before.guide); assert.deepEqual(loft.sections.map(section => section.frame), frames);
    const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened));
    assert.deepEqual(opened.doc, doc);
    const reopened = part('reopened frames', opened.doc).mass({ density: 1 }); assert.deepEqual(reopened, mass);
    assert.deepEqual(base.doc, baseBefore); assert.deepEqual(options, before); assert.deepEqual(input.map(section => section.frame), frames);
  }
});

test('D316 unsupported framed-axis input is typed and leaves the accepted document, guide and mass intact', () => {
  const options = { guide: guide(17, 2) };
  const sections = [{ sketch: sketch().rectangle({ w: 1, d: 1 }), frame: frame(0) }, { sketch: sketch().rectangle({ w: 1, d: 1 }), frame: frame(1) }];
  const accepted = part('accepted frames').loft(sections, options), before = accepted.doc, mass = accepted.mass({ density: 1 });
  const invalid = sections.map(section => ({ ...section, frame: structuredClone(section.frame) }));
  invalid[1].frame.xAxis = [0, -1, 0];
  const invalidBefore = invalid.map(section => structuredClone(section.frame)), optionsBefore = structuredClone(options);
  assert.throws(() => accepted.loft(invalid, options), error => error instanceof BarocssError && error.code === 'GEOMETRY' && error.where === 'evaluate');
  assert.deepEqual(accepted.doc, before); assert.deepEqual(accepted.mass({ density: 1 }), mass);
  assert.deepEqual(invalid.map(section => section.frame), invalidBefore); assert.deepEqual(options, optionsBefore);
});
