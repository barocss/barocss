import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, prefixDoc, type LoopSegment, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { isRefusal } from '../src/engine/refusal';
import { partSnapshot, toPartDocument } from '../src/engine/part';
import { evaluatePreview } from '../src/engine/evaluate';
import { editFields } from '../src/app/editFields';
import type { P2 } from '../src/sketch/profile';
import { createRoundedInsetExtrusion, detachRoundedInsetRecipe, resizeRoundedInsetSource, resolveRoundedInsetRecipe, roundedInsetSourceWidth, validateRoundedInsetDocument } from '../src/sketch/internal/roundedInsetRecipe';

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

test('detaching the inset preserves the exact native input and removes only the recipe link', () => {
  for (const distance of [1, 2, 2.5]) {
    const before = fixture(distance);
    const detached = detachRoundedInsetRecipe(before);
    assert.equal(detached.nodes[0], before.nodes[0]);
    assert.equal(detached.nodes[2], before.nodes[2]);
    assert.equal(detached.outputs, before.outputs);
    const sketch = detached.nodes[1];
    assert.equal(sketch.id, 'n11');
    assert.equal(sketch.kind, 'sketch');
    assert.ok(!('association' in sketch) && !('sideMap' in sketch));
    assert.deepEqual(toPartDocument(detached), toPartDocument(before));
    assert.deepEqual(readStudioDoc(JSON.stringify(detached)), { doc: detached, notes: [] });
  }
  assert.throws(() => detachRoundedInsetRecipe(fixture(1.995)), /minimum offset radius/);
});

test('creating the linked inset reserves one map and appends the complete graph without changing the source', () => {
  const source = { ...prefixDoc(fixture(), 1), nextId: 25 };
  const made = createRoundedInsetExtrusion(source, 2.5, 10);
  assert.equal(made.nodes[0], source.nodes[0]);
  assert.equal(made.nextId, 27);
  assert.deepEqual(made.nodes.slice(1), [
    { kind: 'rounded-rectangle-inset', id: 'n25', version: 1, sourceSketch: 0, sourceFeature: 'n7', insetMM: 2.5,
      sideMap: Object.fromEntries(outer.map((id, i) => [id, allInner[i]])) },
    { kind: 'extrude', id: 'n26', sketch: 1, height: 10 },
  ]);
  assert.deepEqual(made.outputs, { b26: { node: 2, side: 'solid' } });
  assert.equal(source.nodes.length, 1);
  assert.deepEqual(source.outputs, {});
  assert.throws(() => createRoundedInsetExtrusion(source, 5, 10), /closes the rectangle/);
  assert.throws(() => createRoundedInsetExtrusion(source, 1, 0), /one direct numeric Extrude/);
  assert.throws(() => createRoundedInsetExtrusion({ ...source, nextId: Number.MAX_SAFE_INTEGER }, 1, 10), /unused side or feature IDs/);
});

test('a cyclic Round outline retains authored geometry, constraints and side identities', () => {
  const doc = fixture(2.5), source = doc.nodes[0];
  assert.ok(source.kind === 'sketch' && source.profile === 'loop');
  const rotate = <T>(values: T[]) => [values[7], ...values.slice(0, 7)];
  const segments = rotate(source.segments);
  const rounded = { ...source, segments, sideTags: { outer: rotate(outer) }, outline: {
    points: segments.map(segment => segment.start) as [number, number][],
    bulges: segments.map(segment => segment.kind === 'arc' ? Math.tan(Math.PI / 8) : 0),
    radii: { 0: 2, 2: 2, 4: 2, 6: 2 }, tangents: [0, 1, 2, 3, 4, 5, 6, 7], hv: { h: [1, 5], v: [3, 7] },
  } };
  doc.nodes[0] = rounded;
  assert.deepEqual(readStudioDoc(JSON.stringify(doc)), { doc, notes: [] });
  const profile = resolveRoundedInsetRecipe(doc, 1);
  assert.ok(profile.profile === 'loop');
  assert.deepEqual(profile.segments, segments);
  assert.deepEqual(profile.sideTags?.outer, rounded.sideTags.outer);
  assert.deepEqual(profile.sideTags?.holes, [['e9', 'e11', 'e13', 'e15']]);
  const [output] = partSnapshot(doc).outputs;
  assert.ok(checkBrep(output.brep, { strict: true }).valid);
  assert.ok(Math.abs(massPropertiesOf(output).volume - 1215.6637061435918) < 1e-7);
  const wider = resizeRoundedInsetSource(rounded, 24);
  const edited = { ...doc, nodes: [wider, ...doc.nodes.slice(1)] };
  assert.equal(roundedInsetSourceWidth(wider), 24);
  assert.ok('id' in wider);
  assert.equal(wider.id, rounded.id);
  assert.equal(wider.sideTags, rounded.sideTags);
  assert.deepEqual(wider.outline?.radii, rounded.outline.radii);
  assert.deepEqual(wider.outline?.tangents, rounded.outline.tangents);
  assert.deepEqual(wider.outline?.hv, rounded.outline.hv);
  assert.deepEqual(readStudioDoc(JSON.stringify(edited)), { doc: edited, notes: [] });
  assert.ok(Math.abs(massPropertiesOf(partSnapshot(edited).outputs[0]).volume - 1415.6637061435918) < 1e-7);
  for (const modify of [
    (outline: typeof rounded.outline) => { outline.radii[0] = 3; },
    (outline: typeof rounded.outline) => { outline.tangents[0] = 1; },
    (outline: typeof rounded.outline) => { outline.hv.h = [1, 3]; },
    (outline: typeof rounded.outline) => { outline.points = [...outline.points.slice(1), outline.points[0]]; },
    (outline: typeof rounded.outline) => { outline.bulges[0] = 0.5; },
  ]) {
    const outline = structuredClone(rounded.outline);
    modify(outline);
    const rejected = readStudioDoc(JSON.stringify({ ...doc, nodes: [{ ...rounded, outline }, ...doc.nodes.slice(1)] }));
    assert.ok('error' in rejected);
    assert.match(rejected.error, /stored Round outline.*must match/);
  }
});

test('a source width edit keeps the recipe and exact tangencies and refuses a closed opening', () => {
  const doc = fixture(2.5), source = doc.nodes[0];
  assert.ok(source.kind === 'sketch' && source.profile === 'loop');
  assert.equal(roundedInsetSourceWidth(source), 20);
  assert.equal(resizeRoundedInsetSource(source, 20), source);
  const wider = resizeRoundedInsetSource(source, 24);
  assert.ok('id' in wider);
  assert.equal(wider.id, source.id);
  assert.equal(wider.sideTags, source.sideTags);
  assert.ok(wider.profile === 'loop');
  assert.deepEqual(wider.segments.slice(1, 5), [
    { kind: 'arc', start: [22, 0], center: [22, 2], direction: 'ccw' },
    { kind: 'line', start: [24, 2] },
    { kind: 'arc', start: [24, 8], center: [22, 8], direction: 'ccw' },
    { kind: 'line', start: [22, 10] },
  ]);
  assert.deepEqual(resizeRoundedInsetSource(wider, 20), source);
  assert.throws(() => resizeRoundedInsetSource(source, 0), /positive finite width/);
  for (const width of [4, 4.01]) assert.throws(() => resizeRoundedInsetSource(source, width),
    error => isRefusal(error, 'BAD_REFERENCE') && error.details?.roundedInsetSourceRadius === 2);
  const rounded = fixture(1.5);
  const barelyWide = resizeRoundedInsetSource(source, 4.010000000000001);
  assert.doesNotThrow(() => validateRoundedInsetDocument({ ...rounded, nodes: [barelyWide, ...rounded.nodes.slice(1)] }, true));
  const closed = { ...doc, nodes: [resizeRoundedInsetSource(source, 5), ...doc.nodes.slice(1)] };
  assert.throws(() => validateRoundedInsetDocument(closed, true), /closes the rectangle/);
});

test('source width admission checks the typed width before rounding it at the source origin', () => {
  const source = fixture().nodes[0];
  assert.ok(source.kind === 'sketch' && source.profile === 'loop');
  for (const x of [0, 25, 100]) {
    const at = ([u, v]: P2): P2 => [x + u, v];
    const translated = { ...source, segments: source.segments.map(segment => segment.kind === 'line'
      ? { ...segment, start: at(segment.start as P2) }
      : { ...segment, start: at(segment.start as P2), center: at(segment.center as P2) }) };
    assert.throws(() => resizeRoundedInsetSource(translated, 4.01),
      error => isRefusal(error, 'BAD_REFERENCE') && error.details?.roundedInsetSourceRadius === 2);
    const changed = resizeRoundedInsetSource(translated, 4.010001);
    assert.ok(Math.abs(roundedInsetSourceWidth(changed) - 4.010001) < 1e-12);
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

test('the current preview explains further features on a linked inset without reclassifying a retired edge', () => {
  const linked = fixture();
  const fillet: Extract<ModelNode, { kind: 'fillet' }> = {
    kind: 'fillet', id: 'n20', parent: { node: 2, side: 'solid' }, edges: ['n19.side[e9]|n19.top'], radius: 0.1,
  };
  const attempted = { ...linked, nodes: [...linked.nodes, fillet] };
  const refused = evaluatePreview(attempted, 301);
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, 'BAD_REFERENCE');
  assert.equal(refused.error.title, 'The linked inset only supports its Extrude');
  assert.match(refused.error.hint, /Detach inset.*removes the link/);
  assert.match(refused.error.detail, /only one direct Extrude/);

  const closedCorner = fixture(2.5);
  const retired = evaluatePreview({ ...closedCorner, nodes: [...closedCorner.nodes, { ...fillet, edges: ['n19.side[e10]|n19.top'] }] }, 302);
  assert.ok(!retired.ok);
  assert.match(retired.error.detail, /retired inset side/);
  assert.notEqual(retired.error.title, refused.error.title);
});
