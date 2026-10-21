import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, withNode, type ModelNode, type SketchNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { runTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { featureId } from '@barocss/cad-model/engine/ids';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { splitAt, trimAt } from '@barocss/cad-model/sketch/trim';
import { roundCorner } from '@barocss/cad-model/sketch/corner';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import { renameToTagged, withIds } from '@barocss/cad-model/sketch/entityIds';
import type { SketchShape } from '../src/viewport/Viewport';

// R10a (D86): a sketch's sides have ids of their own, kept as it is edited, and the walls a body makes of it are named by
// them (`side[e<k>]`): a vertex inserted keeps every other side's name; a sketch from before is renamed once, exactly.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
type Poly = Extract<SketchShape, { kind: 'polygon' }>;
const square = (): Poly => ({ kind: 'polygon', closed: true, points: [[0, 0], [10, 0], [10, 10], [0, 10]], bulges: [0, 0, 0, 0] });
const nodeOf = (shapes: SketchShape[]) => { const p = profileOf(shapes); assert.ok('node' in p, JSON.stringify(p)); return p.node; };
const wallNames = (s: ChatState) => [...new Set(s.bodies[0].mesh.faces.flatMap(f => f.name.split('+')).filter(n => /\.side/.test(n)))].sort();
/** A prism of the sketch, its corner at (10, 10) filleted r 2 (the edge named as the kernel names it). */
async function filleted(sketch: SketchNode): Promise<ChatState> {
  let doc = withNode(withNode(emptyDoc(), sketch), { kind: 'extrude', sketch: 0, height: 6 });
  const s = await stateOf(doc), corner = s.bodies[0].mesh.edges.find(e => e.straight && Math.abs(e.a[0] - 10) < 1e-9 && Math.abs(e.a[1] - 10) < 1e-9)!;
  doc = withNode(doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [corner.names[0]], radius: 2 });
  return stateOf(doc);
}

test('R10a ids: each side of a drawn shape one, in order after the highest, kept when present; the node sends them as sideTags and the walls take their names', async () => {
  const shapes = withIds([square(), { kind: 'circle', c: [5, 5], r: 2 }]);
  assert.deepEqual(shapes.map(s => s.ids), [['e1', 'e2', 'e3', 'e4'], ['e5']]);
  assert.deepEqual(withIds(shapes), shapes, 'kept');
  const node = nodeOf(shapes);
  assert.deepEqual(node.sideTags, { outer: ['e1', 'e2', 'e3', 'e4'], holes: [['e5']] });
  const s = await stateOf(withNode(withNode(emptyDoc(), node), { kind: 'extrude', sketch: 0, height: 6 }));
  assert.deepEqual(wallNames(s), ['n1.side[e1]', 'n1.side[e2]', 'n1.side[e3]', 'n1.side[e4]', 'n1.side[e5]']);
});

test('R10a a vertex inserted keeps every other side\'s name: the fillet on the corner at (10, 10) needs no re-match, the split edge\'s first part keeps its id; a kept dimension on another edge stays', async () => {
  const drawn = withIds([{ ...square(), lengths: { 2: 10 } }])[0] as Poly, first = { ...nodeOf([drawn]) }; delete first.outline;
  const s = await filleted(first);
  const was = (s.doc.nodes[2] as { edges: string[] }).edges[0];
  assert.match(was, /^n1\.side\[e2\]\|n1\.side\[e3\]$|^n1\.side\[e3\]\|n1\.side\[e2\]$/);
  // A vertex on the bottom edge, pulled down: as the rematch test's edit, by the sketcher's own split.
  const split = splitAt([drawn], [5, 0], 0.5); assert.ok('shapes' in split, JSON.stringify(split));
  const after = split.shapes[0] as Poly;
  assert.deepEqual(after.ids, ['e1', 'e5', 'e2', 'e3', 'e4']);
  assert.deepEqual(after.lengths, { 3: 10 }, 'the top edge\'s length, renumbered with it');
  after.points[1] = [5, -2];
  // (As the agent writes it: without the outline's constraints, which only the sketcher keeps.)
  const plain = { ...nodeOf([after]) }; delete plain.outline;
  const r = await runTool(s, 'edit_feature', { index: 0, feature: plain }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.equal(parse(r.content).rematched, undefined, 'nothing to re-match');
  assert.deepEqual((r.state.doc.nodes[2] as { edges: string[] }).edges, [was]);
  assert.deepEqual(wallNames(r.state), ['n1.side[e1]', 'n1.side[e2]', 'n1.side[e3]', 'n1.side[e4]', 'n1.side[e5]']);
  assert.ok(Math.abs(r.state.bodies[0].volumeMM3! - (10 * 10 * 6 - (1 - Math.PI / 4) * 4 * 6 + 10 * 6)) < 1e-6);
});

test('R10a a rectangle drawn from its top-right corner: its ids matched to the rectangle node\'s sides by their ends; a rounded corner keeps both edges\' ids, the arc a new one; a trim keeps the pieces\' ids by where they start', () => {
  const rect = withIds([{ kind: 'rectangle', a: [10, 10], b: [0, 0] } as SketchShape])[0];
  assert.deepEqual(rect.ids, ['e1', 'e2', 'e3', 'e4']);
  // (Its own order: a (10, 10) → (0, 10) → b (0, 0) → (10, 0); the node's from (0, 0): (0, 0)→(10, 0) is its e3.)
  assert.deepEqual(nodeOf([rect]).sideTags, { outer: ['e3', 'e4', 'e1', 'e2'] });
  const sq = withIds([square()])[0] as Poly, rounded = roundCorner(sq, 2, 2);
  assert.ok('shape' in rounded, JSON.stringify(rounded));
  assert.deepEqual(withIds([rounded.shape])[0].ids, ['e1', 'e2', 'e5', 'e3', 'e4']);
  // Trimming the top edge's middle third against two construction lines: the outline opens, its pieces keep ids.
  const cut = trimAt([sq, { kind: 'polygon', closed: false, points: [[3, 8], [3, 12]], construction: true }, { kind: 'polygon', closed: false, points: [[7, 8], [7, 12]], construction: true }], [5, 10], 0.5);
  assert.ok('shapes' in cut, JSON.stringify(cut));
  const open = cut.shapes.find(x => x.kind === 'polygon' && !x.construction) as Poly;
  assert.ok(open.ids!.includes('e1') && open.ids!.includes('e2') && open.ids!.includes('e4'), JSON.stringify(open.ids));
});

test('R10a a sketch from before (no ids) reopened: ids in the order its sides were numbered, and Finish renames the features on it from side<k> to side[e<k+1>] — the fillet\'s edge and a face colour — once; a v2 sketch reopens with its own ids', async () => {
  const old: SketchNode = { kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 0], [10, 10], [0, 10]] }, s = await filleted(old);
  const was = (s.doc.nodes[2] as { edges: string[] }).edges[0];
  assert.match(was, /^n1\.side\d\|n1\.side\d$/);
  const doc: StudioDoc = { ...s.doc, bodies: { b2: { faces: { 'n1.side0': '#ff0000' } } } };
  const { shape, positional } = sketchShapes(old);
  assert.deepEqual(shape?.ids, ['e1', 'e2', 'e3', 'e4']);
  assert.deepEqual(positional, { side0: 'side[e1]', side1: 'side[e2]', side2: 'side[e3]', side3: 'side[e4]' });
  const node = nodeOf([shape!]), edited = { ...doc, nodes: doc.nodes.map((n, k) => k === 0 ? node : n) as ModelNode[] };
  const next = renameToTagged(edited, 0, positional!, node.sideTags!, featureId);
  const edge = (next.nodes[2] as { edges: string[] }).edges[0];
  assert.equal(edge, was.replace(/side(\d)/g, (_, k) => `side[e${Number(k) + 1}]`));
  assert.deepEqual(next.bodies, { b2: { faces: { 'n1.side[e1]': '#ff0000' } } });
  const r = await stateOf(next);
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - s.bodies[0].volumeMM3!) < 1e-9);
  // Reopened again: the node's own ids, nothing positional.
  const again = sketchShapes(next.nodes[0] as SketchNode);
  assert.deepEqual(again.shape?.ids, ['e1', 'e2', 'e3', 'e4']); assert.equal(again.positional, undefined);
});
