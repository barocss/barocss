// The ellipse side-edge refusal reads a face's feature by stable id (not by index), covers the features built on an ellipse sketch
// (extrude, revolve, sweep), and leaves other sketches', holes' and joined bodies' sides alone; chat add_features refuses it too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch } from '../src/api';
import { evaluateDoc } from '../src/engine/evaluate';
import type { ModelNode, SketchNode, StudioDoc } from '../src/engine/doc';
import { ELLIPSE_SIDE_EDGE_REFUSAL, ellipseShape, ellipseSideEdge } from '../src/sketch/ellipse';
import { settleShape } from '../src/sketch/settle';
import { profileOf } from '../src/sketch/loops';
import { checkNode } from '../src/chat/features';
import type { SketchShape } from '../src/sketch/types';

type Poly = Extract<SketchShape, { kind: 'polygon' }>;
const ellipse = (c: [number, number] = [0, 0]): Poly => settleShape(ellipseShape({ center: c, rx: 30, ry: 12, angle: 0 }), null).shape as Poly;
const named = (s: Poly): Poly => ({ ...s, ids: s.points.map((_, i) => `e${i + 1}`) });
const nodeOf = (shapes: SketchShape[]): SketchNode => { const p = profileOf(shapes); assert.ok('node' in p); return p.node as unknown as SketchNode; };
const ellNode = (c?: [number, number]) => nodeOf([named(ellipse(c))]);
const rectNode = () => nodeOf([{ kind: 'rectangle', a: [100, 0], b: [120, 20], ids: ['e1', 'e2', 'e3', 'e4'] } as unknown as SketchShape]);
const base = part('a').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 8 }).doc;
const extrude = base.nodes[1] as ModelNode;
const withNodes = (nodes: unknown[], nextId = 20) => ({ ...base, nextId, nodes } as unknown as StudioDoc);
const names = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error).slice(0, 200)); return r.ok ? r.bodies.flatMap(b => b.mesh.edges.flatMap(e => e.names)) : []; };
const refused = (doc: StudioDoc, only: (n: string) => boolean) => { const all = names(doc).filter(only); return { all: all.length, hit: all.filter(n => ellipseSideEdge(doc.nodes, n)).length }; };

test('ids that are not indices: the ellipse extrude n3 over sketch n2 (indices 1 and 0) is refused', () => {
  const doc = withNodes([{ ...ellNode(), id: 'n2' }, { ...extrude, id: 'n3', sketch: 0 }]);
  const r = refused(doc, n => n.includes('n3.side')); assert.ok(r.all > 0); assert.equal(r.hit, r.all);
});

test('ids that are not indices: a rectangle extrude is not refused because its id equals the index of an ellipse extrude', () => {
  const doc = withNodes([{ ...rectNode(), id: 'n0' }, { ...ellNode([0, 50]), id: 'n5' }, { ...extrude, id: 'n7', sketch: 1 }, { ...extrude, id: 'n2', sketch: 0 }], 8);
  const rect = refused(doc, n => n.startsWith('n2.') || n.includes('|n2.')), ell = refused(doc, n => n.includes('n7.side'));
  assert.ok(rect.all > 0 && ell.all > 0);
  assert.equal(rect.hit, 0, 'rectangle extrude edges'); assert.equal(ell.hit, ell.all, 'ellipse extrude edges');
});

test('an ellipse with a circle hole: the hole\'s side edges are not refused, the ellipse\'s are', () => {
  const doc = withNodes([{ ...nodeOf([named(ellipse()), { kind: 'circle', c: [0, 0], r: 4 } as SketchShape]), id: 'n0' }, { ...extrude, id: 'n1', sketch: 0 }], 2);
  const sk = doc.nodes[0] as SketchNode;
  assert.ok((sk as { outline?: { ellipse?: unknown } }).outline?.ellipse, 'main ellipse kept');
  const tags = (sk as { sideTags?: { outer?: string[] } }).sideTags?.outer ?? [];
  const sides = names(doc).filter(n => /\.side\[/.test(n)), holes = sides.filter(n => !n.split('|').some(f => { const m = /\.side\[([^\]]+)\]/.exec(f); return !!m && tags.includes(m[1]); }));
  assert.ok(holes.length > 0 && holes.length < sides.length, `${holes.length}/${sides.length}`);
  assert.ok(holes.every(n => !ellipseSideEdge(doc.nodes, n)), 'hole sides');
  assert.ok(sides.some(n => ellipseSideEdge(doc.nodes, n)), 'ellipse sides');
});

test('a second sketch\'s extrude joined onto the ellipse body: its sides are not refused', () => {
  const doc = withNodes([{ ...ellNode(), id: 'n0' }, { ...extrude, id: 'n1', sketch: 0 }, { ...rectNode(), id: 'n2' }, { ...extrude, id: 'n3', sketch: 2 }], 4);
  const rect = refused(doc, n => n.includes('n3.side')), ell = refused(doc, n => n.includes('n1.side'));
  assert.ok(rect.all > 0 && ell.all > 0); assert.equal(rect.hit, 0); assert.equal(ell.hit, ell.all);
});

test('a partial revolve and a sweep of an ellipse profile refuse their side edges (sweep names carry an .s<j> infix)', () => {
  const rv = part('r').revolve(sketch().polygon([[40, 0], [60, 0], [60, 10], [40, 10]]), { deg: 90 }).doc;
  const D = { ...rv, nodes: rv.nodes.map((n, i) => i === 0 ? { ...ellNode([60, 20]), id: n.id, ...((n as { plane?: unknown }).plane ? { plane: (n as { plane?: unknown }).plane } : {}) } : n) } as unknown as StudioDoc;
  const rr = refused(D, n => /\.side\[/.test(n)); assert.ok(rr.all > 0); assert.equal(rr.hit, rr.all, 'revolve');
  const S = withNodes([{ ...ellNode(), id: 'n0' }, { kind: 'sweep', sketch: 0, path: [{ kind: 'straight', length: 20 }, { kind: 'bend', radius: 80, angle: 30, toward: 'x' }], id: 'n1' }], 2);
  const sn = names(S); assert.ok(sn.some(n => /n1\.s0\.side\[/.test(n)));
  const sr = refused(S, n => /\.side\[/.test(n)); assert.ok(sr.all > 0); assert.equal(sr.hit, sr.all, 'sweep');
});

test('a linear pattern of an ellipse body: the copies\' side edges (named with @<k>) are refused too', () => {
  const doc = withNodes([{ ...ellNode(), id: 'n0' }, { ...extrude, id: 'n1', sketch: 0 }, { kind: 'linear-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', spacing: 80, count: 2, id: 'n2' }], 3);
  const copies = refused(doc, n => /\.side\[[^\]]+\]@\d/.test(n)), all = refused(doc, n => /\.side\[/.test(n));
  assert.ok(copies.all > 0, 'the pattern names its copies with @<k>'); assert.equal(copies.hit, copies.all); assert.equal(all.hit, all.all);
});

test('chat add_features: a fillet or chamfer on an ellipse side edge is refused with the reason', () => {
  const doc = withNodes([{ ...ellNode(), id: 'n0' }, { ...extrude, id: 'n1', sketch: 0 }], 2);
  const edge = names(doc).find(n => n.includes('side[e17]') && n.endsWith('top'))!;
  const plain = withNodes([{ ...rectNode(), id: 'n0' }, { ...extrude, id: 'n1', sketch: 0 }], 2);
  const rectEdge = names(plain).find(n => n.includes('.side[') && n.endsWith('top'))!;
  for (const [kind, key, v] of [['fillet', 'radius', 1], ['chamfer', 'distance', 1]] as const) {
    const node = (e: string) => ({ kind, parent: { node: 1, side: 'solid' }, edges: [e], [key]: v });
    assert.equal(checkNode(node(edge), doc.nodes as ModelNode[], {}, [], []), `${kind}.edges: ${ELLIPSE_SIDE_EDGE_REFUSAL}`);
    assert.equal(checkNode(node(rectEdge), plain.nodes as ModelNode[], {}, [], []), null);
  }
});
