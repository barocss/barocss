import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, prefixDoc, type LoopSegment, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { partSnapshot } from '../src/engine/part';
import { editFields } from '../src/app/editFields';
import { resolveRoundedInsetRecipe, validateRoundedInsetDocument } from '../src/sketch/internal/roundedInsetRecipe';

const outer = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'];
const allInner = ['e9', 'e10', 'e11', 'e12', 'e13', 'e14', 'e15', 'e16'];
const points: [number, number][] = [[2, 0], [18, 0], [20, 2], [20, 8], [18, 10], [2, 10], [0, 8], [0, 2]];
const centers: [number, number][] = [[18, 2], [18, 8], [2, 8], [2, 2]];

function fixture(insetMM = 1): StudioDoc {
  const segments: LoopSegment[] = points.map((point, i) => i % 2 === 0
    ? { kind: 'line', start: [...point] }
    : { kind: 'arc', start: [...point], center: [...centers[(i - 1) / 2]], direction: 'ccw' });
  return {
    ...emptyDoc(), nextId: 20,
    nodes: [
      { kind: 'sketch', id: 'n7', profile: 'loop', segments, sideTags: { outer: [...outer] } },
      { kind: 'rounded-rectangle-inset', id: 'n11', version: 1, sourceSketch: 0, sourceFeature: 'n7', insetMM,
        sideMap: Object.fromEntries(outer.map((id, i) => [id, allInner[i]]).reverse()) },
      { kind: 'extrude', id: 'n19', sketch: 1, height: 10 },
    ],
    outputs: { b19: { node: 2, side: 'solid' } },
  };
}

test('a saved rounded inset resolves the current native source and preserves its reserved side IDs', () => {
  for (const [inset, holeArea] of [[1, 140 + Math.PI], [2, 96], [2.5, 75], [1, 140 + Math.PI]]) {
    const doc = fixture(inset), before = structuredClone(doc);
    const read = readStudioDoc(JSON.stringify(doc));
    if ('error' in read) assert.fail(read.error);
    assert.deepEqual(read.doc, doc);
    const native = resolveRoundedInsetRecipe(read.doc, 1);
    assert.equal(native.profile, 'loop');
    const source = doc.nodes[0];
    assert.ok(source.kind === 'sketch' && source.profile === 'loop');
    assert.deepEqual(native.segments, source.segments);
    const inner = inset < 2 ? allInner : ['e9', 'e11', 'e13', 'e15'];
    assert.deepEqual(native.sideTags, { outer, holes: [inner] });
    assert.equal(native.holes?.[0].filter(edge => edge.kind === 'arc').length, inset < 2 ? 4 : 0);
    const [body] = partSnapshot(read.doc).outputs;
    assert.ok(body && checkBrep(body.brep, { strict: true }).valid);
    assert.ok(Math.abs(massPropertiesOf(body).volume - 10 * (184 + 4 * Math.PI - holeArea)) <= 1e-7);
    for (const tag of [...outer, ...inner]) assert.ok(body.brep.faces.some(face => face.name === `n19.side[${tag}]`), tag);
    for (const tag of allInner.filter(tag => !inner.includes(tag))) {
      assert.ok(!body.brep.faces.some(face => face.name === `n19.side[${tag}]`), tag);
    }
    assert.deepEqual(doc, before);
  }

  const doc = fixture();
  for (const count of [1, 2]) {
    const prefix = prefixDoc(doc, count);
    assert.doesNotThrow(() => validateRoundedInsetDocument(prefix, false));
    assert.deepEqual(partSnapshot(prefix).outputs, []);
  }
  assert.throws(() => validateRoundedInsetDocument(prefixDoc(doc, 2), true), /one direct numeric Extrude/);
});

test('the stored inset editor exposes only the numeric distance and preserves the rest of the graph', () => {
  const doc = fixture();
  assert.deepEqual(editFields(doc.nodes, 0), []);
  assert.deepEqual(editFields(doc.nodes, 1), []);
  const fields = editFields(doc.nodes, 2, { Width: 20 });
  assert.equal(fields.length, 1);
  const [field] = fields;
  assert.ok(field.kind === 'number' && !('bind' in field));
  assert.equal(field.label, 'Inset distance');
  assert.equal(field.get(doc.nodes), 1);
  const nodes = field.set(doc.nodes, 2.5);
  assert.equal(nodes[0], doc.nodes[0]);
  assert.equal(nodes[2], doc.nodes[2]);
  assert.deepEqual(nodes, fixture(2.5).nodes);
  assert.equal(field.get(doc.nodes), 1);
  assert.equal(field.get(nodes), 2.5);
  for (const [distance, reason] of [[1.995, /minimum offset radius/], [5, /closes the rectangle/]] as const) {
    const rejected = { ...doc, nodes: field.set(doc.nodes, distance) };
    assert.throws(() => validateRoundedInsetDocument(rejected, true), reason);
  }
});

test('stored rounded insets reject malformed geometry, ownership and consumers', () => {
  type RawDocument = {
    nodes: [
      { id?: string; sideTags?: unknown; holes?: unknown; segments: { start: unknown[]; center: number[] }[] },
      { sourceSketch: number; sourceFeature: string; sideMap: Record<string, string>; profile?: string },
      { id: string; sketch: number; height: number; draft?: number },
    ];
    parameters: Record<string, number>;
    outputs: unknown;
    nextId?: unknown;
    instances?: unknown;
  };
  const refuses = (change: (raw: RawDocument) => void, reason: RegExp) => {
    const doc = JSON.parse(JSON.stringify(fixture(2.5))) as RawDocument;
    change(doc);
    const result = readStudioDoc(JSON.stringify(doc));
    assert.ok('error' in result);
    assert.match(result.error, reason);
  };
  refuses(doc => { doc.nodes[0].segments[1].center[0] += 0.1; }, /same source circle/);
  // Same circle radius at both ends, but the changed center breaks quarter-arc tangency.
  refuses(doc => { doc.nodes[0].segments[1].center = [17.75, 2.25]; }, /CCW tangent rounded rectangle/);
  refuses(doc => { doc.nodes[0].segments[0].start[0] = '2'; }, /native straight sides/);
  refuses(doc => { delete doc.nodes[0].sideTags; }, /explicit outer side tags/);
  refuses(doc => { delete doc.nodes[0].id; }, /source feature ID/);
  refuses(doc => { doc.nodes[0].holes = []; }, /standalone numeric XY/);
  refuses(doc => { doc.nodes[1].sourceSketch = 2; }, /stored recipe is malformed/);
  refuses(doc => { doc.nodes[1].sourceFeature = 'n8'; }, /source feature ID/);
  refuses(doc => { doc.nodes[1].sideMap.e1 = 'e10'; }, /distinct safe side IDs/);
  refuses(doc => { doc.nodes[1].profile = 'rectangle'; }, /stored recipe is malformed/);
  refuses(doc => { doc.nodes[2].id = 'n7'; }, /distinct explicit feature ID/);
  refuses(doc => { doc.nodes[2].draft = 1; }, /direct numeric Extrude/);
  refuses(doc => { doc.nodes[2].height = 10001; }, /direct numeric Extrude/);
  refuses(doc => { doc.nodes[2].sketch = 0; }, /direct numeric Extrude/);
  refuses(doc => { doc.outputs = { b7: { node: 0, side: 'solid' } }; }, /stored output/);
  refuses(doc => { doc.parameters.Width = 20; }, /cannot contain parameters/);
  refuses(doc => { doc.instances = []; }, /standalone/);
  refuses(doc => { doc.nextId = 'invalid'; }, /next feature ID/);
});

test('a direct retired inset edge has a typed loss before generic matching', () => {
  const documentWithFillet = (edge: string) => {
    const doc = fixture(2.5);
    doc.nodes.push({ kind: 'fillet', id: 'n20', parent: { node: 2, side: 'solid' }, edges: [edge], radius: 0.2 });
    return doc;
  };
  const retired = documentWithFillet('n19.side[e10]|n19.top');
  assert.throws(() => validateRoundedInsetDocument(retired, false), /\[BAD_REFERENCE\].*e10.*retired inset side.*cannot be rematched/);
  const read = readStudioDoc(JSON.stringify(retired));
  assert.ok('error' in read);
  assert.match(read.error, /e10.*retired inset side/);
  for (const edge of ['n19.side[e2]|n19.top', 'n7.side[e10]|n19.top', 'n19.side[e100]|n19.top']) {
    assert.throws(() => validateRoundedInsetDocument(documentWithFillet(edge), false), /only one direct Extrude/);
  }
});
