// B1: the band's identity — Finish → reopen → Finish keeps the node (and every side id) as it was, parameter bindings on the sources
// and on the offset and width survive, the band follows its sources and its parameters, a named side survives a radius change, and
// the construction shapes' ids neither go missing at Finish nor collide on reopen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '../src/api';
import { bandLoops, bandProfile, bandShapes, bandSketchNode, liveBand, makeBand, toggleBandPick } from '../src/sketch/band';
import { withConstructionIds, withIds } from '../src/sketch/entityIds';
import { profileOf } from '../src/sketch/loops';
import { xyPlane } from '../src/sketch/plane';
import { pickShapeAt } from '../src/sketch/select';
import { rebindDims, sketchShapes } from '../src/sketch/reopen';
import { bindParameter, withParameters } from '../src/engine/parameters';
import { editFields } from '../src/app/editFields';
import { checkNode } from '../src/chat/features';
import { partSnapshot } from '../src/engine/part';
import { evaluateDoc } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import type { SketchNode, StudioDoc } from '../src/engine/doc';
import type { SketchShape, SketchState } from '../src/sketch/types';

type P = [number, number];
const circle = (c: P, r: number): SketchShape => ({ kind: 'circle', c, r });
const rect = (a: P, b: P): SketchShape => ({ kind: 'rectangle', a, b });
const empty = (done: SketchShape[]): SketchState => ({ plane: xyPlane(), tool: 'band', shape: null, done });
const bandOf = (s: SketchState) => { assert.ok(s.band); return s.band!; };

/** The Studio's band flow: pick the first two shapes, Make band; Finish = bandSketchNode of the state's shapes. */
function made(done: SketchShape[], offset = 0, width?: number): SketchState {
  let s = empty(done);
  s = toggleBandPick(s, 0); s = toggleBandPick(s, 1);
  const r = makeBand(s, offset, width);
  assert.ok('state' in r, 'error' in r ? r.error : '');
  return r.state;
}
const finish = (s: SketchState): SketchNode => { const r = bandSketchNode(bandShapes(s), bandOf(s)); assert.ok('node' in r, 'error' in r ? r.error : ''); return r.node; };
/** Reopen as the Studio does (sketchShapes → state), Finish again, restore bindings of the stored node. */
function reopen(stored: SketchNode, params: Record<string, number> = {}): SketchNode {
  const { shape, done, band } = sketchShapes(stored, params);
  assert.equal(shape, null); assert.ok(band);
  const next = finish({ plane: xyPlane(), tool: 'band', shape: null, done, band });
  return rebindDims(stored, next, params).node;
}
const docOf = (node: SketchNode, parameters: Record<string, number> = {}, height = 10): StudioDoc => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters, nodes: [{ ...node, id: 'n0' }, { kind: 'extrude', sketch: 0, height, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 } as unknown as StudioDoc);
const sideTags = (d: StudioDoc) => (bandProfile(d.nodes[0] as SketchNode, d.parameters ?? {}) as { sideTags: unknown }).sideTags;
const names = (d: StudioDoc) => part('x', d).select().faces().names().filter(n => /side\[b1/.test(n)).sort();

test('makeBand marks the picks construction, gives every shape ids and refuses fewer than two', () => {
  const s = made([circle([0, 0], 20), circle([70, 10], 12), rect([0, 60], [30, 90])], 0, 3);
  assert.ok(s.done!.every(x => x.ids?.length), 'ids on every shape');
  assert.deepEqual(s.done!.map(x => !!x.construction), [true, true, false]);
  assert.deepEqual(bandOf(s).sources, [s.done![0].ids![0], s.done![1].ids![0]]);
  assert.equal(bandOf(s).width, 3); assert.equal(s.bandPicks, undefined);
  assert.ok('outer' in liveBand(s)! && 'hole' in liveBand(s)!);
  const one = toggleBandPick(empty([circle([0, 0], 20), circle([70, 10], 12)]), 0);
  // (The picked shape keeps the id it was picked by, so the pick is drawn and stays attached when more shapes are drawn.)
  assert.equal(one.done![0].ids![0], one.bandPicks![0]);
  assert.match((makeBand(one, 0) as { error: string }).error, /at least two/);
  assert.equal(liveBand(empty([])), null);
  // Picking twice unpicks; a band refused when made says why and is not made.
  assert.deepEqual(toggleBandPick(toggleBandPick(empty([circle([0, 0], 5)]), 0), 0).bandPicks, []);
  const over = toggleBandPick(toggleBandPick(empty([circle([0, 0], 20), circle([10, 0], 12)]), 0), 1);
  assert.match((makeBand(over, 0) as { error: string }).error, /overlap/);
  assert.match((makeBand(made([circle([0, 0], 20), circle([70, 10], 12)]), 0) as { error: string }).error, /already has a band/);
});

test('Finish refuses any other closed shape: a band sketch holds only the band and its construction', () => {
  const s = made([circle([0, 0], 20), circle([70, 10], 12), rect([0, 60], [30, 90])]);
  const r = bandSketchNode(bandShapes(s), bandOf(s));
  assert.deepEqual(r, { error: 'A band sketch holds only the band and its construction sources: draw other shapes in their own sketch.' });
  // Construction shapes and open curves beside the band are kept.
  const t = made([circle([0, 0], 20), circle([70, 10], 12), { ...rect([0, 60], [30, 90]), construction: true }, { kind: 'bezier', poles: [[0, 0], [5, 5], [9, 0]] }]);
  const node = finish(t) as Extract<SketchNode, { profile: 'band' }>;
  assert.equal(node.construction!.length, 4); assert.ok((node.construction as SketchShape[]).every(x => x.ids?.length));
});

test('Finish → reopen → Finish is the same JSON, again and again', () => {
  const node = finish(made([circle([0, 0], 20), rect([50, -10], [80, 15]), { kind: 'slot', a: [0, 60], b: [30, 70], r: 5, construction: true }, { ...circle([200, 0], 9), construction: true }], 1.5, 4));
  const again = reopen(node), thrice = reopen(again);
  assert.equal(JSON.stringify(again), JSON.stringify(node));
  assert.equal(JSON.stringify(thrice), JSON.stringify(node));
});

test('a band sketch needs its ids: construction ids exist after Finish (the id gap) and reopen seeds fresh ids after them', () => {
  // The plain Finish (not a band): the construction shapes as the sketch stores them carry ids.
  const shapes: SketchShape[] = [rect([0, 0], [10, 6]), { ...circle([20, 0], 3), construction: true }];
  assert.equal(shapes.filter(x => x.construction)[0].ids, undefined, 'the un-numbered list has none');
  const stored = withConstructionIds(shapes);
  assert.equal(stored.length, 1); assert.ok(stored[0].ids?.length === 1);
  const profile = profileOf(shapes); assert.ok('node' in profile);
  // (Numbered as the profile numbers them: the rectangle e1–e4, the construction circle e5.)
  assert.deepEqual(stored[0].ids, ['e5']);
  // A node from before side tags: its fresh ids for the main shape must not take the construction circle's.
  const legacy = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 6], construction: [{ kind: 'circle', c: [20, 0], r: 3, construction: true, ids: ['e1'] }] } as unknown as SketchNode;
  const { shape, done } = sketchShapes(legacy);
  const ids = [...(shape?.ids ?? []), ...done.flatMap(x => x.ids ?? [])];
  assert.equal(new Set(ids).size, ids.length, `no id twice: ${ids.join(',')}`);
});

test('the band follows its sources and its parameters; the sides keep their names', async () => {
  const s = made([circle([0, 0], 20), circle([70, 10], 12)], 0, 3), node = finish(s);
  let doc = docOf(node, { R: 20 });
  doc = bindParameter(doc, { feature: 1, value: 'bs0r', parameter: 'R' });
  assert.deepEqual(((doc.nodes[0] as Extract<SketchNode, { profile: 'band' }>).construction![0] as { r: unknown }).r, { parameter: 'R' });
  const big = withParameters(doc, { R: 25 }), tags = JSON.stringify(sideTags(doc));
  assert.equal(JSON.stringify(sideTags(big)), tags, 'the tags stay while the topology does');
  const v = (d: StudioDoc) => { const r = partSnapshot(d); return r.outputs.length; };
  assert.equal(v(doc), 1); assert.equal(v(big), 1);
  const a = bandProfile(doc.nodes[0] as SketchNode, doc.parameters!) as Extract<SketchNode, { profile: 'loop' }>, b = bandProfile(big.nodes[0] as SketchNode, big.parameters!) as Extract<SketchNode, { profile: 'loop' }>;
  assert.notEqual(JSON.stringify(a.segments), JSON.stringify(b.segments), 'the loop moved with R');
  const n0 = names(doc), n1 = names(big);
  assert.ok(n0.length >= 4, n0.join(','));
  assert.deepEqual(n1, n0, 'the walls keep their names through the radius change');
  // A radius that makes the sources overlap is refused by name, not kept as it was.
  const bad = { ...doc, parameters: { ...doc.parameters, R: 60 } };
  assert.throws(() => partSnapshot(bad), /Sketch 1 band b1: sources .* overlap/);
  const r = await evaluateDoc(bad, 1); assert.ok(!r.ok, 'no stale body');
});

test('bindings on the sources, the offset and the width survive reopen → Finish', () => {
  const s = made([circle([0, 0], 20), circle([70, 10], 12)], 2, 3);
  let doc = docOf(finish(s), { R: 20, G: 2, W: 3, X: 70 });
  doc = bindParameter(doc, { feature: 1, value: 'bs0r', parameter: 'R' });
  doc = bindParameter(doc, { feature: 1, value: 'bo', parameter: 'G' });
  doc = bindParameter(doc, { feature: 1, value: 'bw', parameter: 'W' });
  doc = bindParameter(doc, { feature: 1, value: 'bs1c0', parameter: 'X' });
  const stored = doc.nodes[0] as SketchNode, params = doc.parameters!;
  const out = reopen(stored, params);
  assert.equal(JSON.stringify({ ...out, id: undefined }), JSON.stringify({ ...stored, id: undefined }));
  assert.deepEqual([...new Set(JSON.stringify(out).match(/"parameter":"\w+"/g))].sort(), ['"parameter":"G"', '"parameter":"R"', '"parameter":"W"', '"parameter":"X"']);
  // A source whose radius changed in the sketcher stays a number; the others keep theirs.
  const { done, band } = sketchShapes(stored, params);
  const edited = done.map((x, i) => i === 0 && x.kind === 'circle' ? { ...x, r: 21 } : x);
  const next = finish({ plane: xyPlane(), tool: 'band', shape: null, done: edited, band });
  const r = rebindDims(stored, next, params);
  assert.deepEqual(r.dropped, ['R']);
  assert.ok(!JSON.stringify(r.node).includes('"parameter":"R"') && JSON.stringify(r.node).includes('"parameter":"G"'));
});

test('feature editor fields: offset, width, and each circle source, edited and bound', () => {
  const doc = docOf(finish(made([circle([0, 0], 20), circle([70, 10], 12)], 2, 3)), { R: 20 });
  const fields = editFields(doc.nodes, 1, doc.parameters);
  assert.deepEqual(fields.map(f => f.key).filter(k => /^b/.test(k)), ['bo', 'bw', 'bs0r', 'bs0c0', 'bs0c1', 'bs1r', 'bs1c0', 'bs1c1']);
  const radius = fields.find(f => f.key === 'bs1r');
  assert.ok(radius && radius.kind === 'number' && radius.label === 'Band source 2 radius' && radius.get(doc.nodes) === 12);
  const edited = (radius as { set(n: StudioDoc['nodes'], v: number): StudioDoc['nodes'] }).set(doc.nodes, 14);
  const circ = ((edited[0] as Extract<SketchNode, { profile: 'band' }>).construction as { r: number }[])[1];
  assert.equal(circ.r, 14);
  assert.equal(bindParameter(doc, { feature: 1, value: 'bs0r', parameter: 'R' }).nodes[0] !== doc.nodes[0], true);
});

test('Save → Open evaluates the same; the Undo snapshot is plain JSON', async () => {
  const doc = docOf(finish(made([circle([0, 0], 20), rect([50, -10], [80, 15])], 1, 3)), {});
  const before = structuredClone(doc), read = await readStudioFile(encodeStudioFile(doc));
  assert.ok(!('error' in read), 'error' in read ? read.error : '');
  assert.deepEqual(read.doc.nodes[0], doc.nodes[0]); assert.deepEqual(doc, before);
  const mass = (d: StudioDoc) => part('x', d).mass({ density: 1 }).volume;
  assert.equal(mass(read.doc), mass(doc));
  assert.deepEqual(JSON.parse(JSON.stringify(doc.nodes[0])), doc.nodes[0]);
  assert.deepEqual(sideTags(read.doc), sideTags(doc));
});

test('the agent cannot write a band or construction shapes in v1 (chat refuses them)', () => {
  const node = finish(made([circle([0, 0], 20), circle([70, 10], 12)]));
  assert.match(String(checkNode(node, [], {})), /band sketch and construction shapes are made in the Studio/);
  assert.match(String(checkNode({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5, construction: [] }, [], {})), /made in the Studio/);
  assert.match(String(checkNode({ kind: 'sketch', profile: 'band' }, [], {})), /made in the Studio/);
});

test('pickShapeAt picks a whole closed shape by its outline or its inside, the smallest first', () => {
  const shapes = withIds([circle([0, 0], 50), circle([0, 0], 10), { kind: 'polygon', points: [[100, 0], [120, 0]], closed: false }, rect([200, 0], [240, 30])]);
  const project = (u: number, v: number) => [u, v];
  assert.equal(pickShapeAt(shapes, project, 50, 0), 0, 'on the big circle');
  assert.equal(pickShapeAt(shapes, project, 3, 3), 1, 'inside both: the smaller');
  assert.equal(pickShapeAt(shapes, project, 30, 0), 0, 'between: the one containing');
  assert.equal(pickShapeAt(shapes, project, 110, 0), null, 'an open outline is never picked');
  assert.equal(pickShapeAt(shapes, project, 220, 15), 3);
  assert.equal(pickShapeAt(shapes, project, 400, 400), null);
  assert.equal(pickShapeAt(shapes, project, 55, 0, 3), null, 'outside the pixel tolerance');
  assert.ok('error' in bandLoops(shapes, { version: 1, id: 'b1', sources: [] }));
});
