// D355: reopening a finished sketch and pressing Finish with no change keeps every side id, so the features built
// on `n<k>.side[e<j>]` keep their walls (a rectangle turned into an outline for picking used to drop its ids).
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import type { SketchNode, StudioDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { rectangleOutline, startPicking } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/select';
import { joinOpen } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/trim';
import type { SketchShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/types';

type Node = Record<string, unknown>;
/** The sketch node Finish writes: the shapes joined, the profile, the construction shapes and curves kept. */
function finish(shape: SketchShape | null, done: SketchShape[], editNode: boolean): Node {
  const shapes = joinOpen((editNode && shape ? [shape, ...done] : [...done, ...(shape ? [shape] : [])]).map(x => x.kind === 'polygon' && !x.closed ? { ...x, pending: false } : x));
  const profile = profileOf(shapes);
  assert.ok('node' in profile, JSON.stringify(profile));
  const refs = shapes.filter(x => x.construction || x.kind === 'bezier');
  return (refs.length ? { ...profile.node, construction: refs } : profile.node) as unknown as Node;
}
/** Reopen the node, switch to Select (as picking does), Finish with no change. */
function reopenFinish(node: Node): Node {
  const { shape, done } = sketchShapes(structuredClone(node) as unknown as SketchNode);
  const s = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0 } as never, 'select');
  return finish(s.shape ?? null, s.done ?? [], true);
}

const rect: SketchShape = { kind: 'rectangle', a: [0, 0], b: [10, 6] };
const circle: SketchShape = { kind: 'circle', c: [5, 3], r: 1 };
const bezier: SketchShape = { kind: 'bezier', poles: [[0, 20], [10, 40], [20, 20]] };
const construction: SketchShape = { kind: 'polygon', points: [[0, 30], [5, 30]], closed: false, construction: true };
const poly = (points: [number, number][]): SketchShape => ({ kind: 'polygon', points, closed: true, bulges: points.map(() => 0) });

const cases: [string, SketchShape | null, SketchShape[]][] = [
  ['rectangle + circle hole', circle, [rect]],
  ['construction line first, then a rectangle', rect, [construction]],
  ['Bezier first, then a rectangle', rect, [bezier]],
  ['rectangle alone', rect, []],
  ['polygon + polygon hole', poly([[2, 2], [4, 2], [4, 4], [2, 4]]), [poly([[0, 0], [10, 0], [10, 8], [0, 8]])]],
  ['slot', { kind: 'slot', a: [0, 0], b: [10, 0], r: 3 }, []],
  ['rectangle drawn from its upper-right corner', { kind: 'rectangle', a: [10, 6], b: [0, 0] }, [circle]],
];
for (const [label, shape, done] of cases) {
  test(`D355: ${label}: reopen then Finish with no change keeps the side ids`, () => {
    const first = finish(shape, done, false), again = reopenFinish(first);
    assert.ok(first.sideTags, 'Finish writes side tags');
    assert.deepEqual(again.sideTags, first.sideTags);
    assert.deepEqual(reopenFinish(again).sideTags, first.sideTags, 'and again');
  });
}

test('D355: rectangleOutline keeps the ids by side and the construction flag', () => {
  const o = rectangleOutline({ kind: 'rectangle', a: [10, 6], b: [0, 0], ids: ['e1', 'e2', 'e3', 'e4'], construction: true })!;
  // Rectangle runs from a=(10,6): e1 (10,6)-(0,6), e2 (0,6)-(0,0), e3 (0,0)-(10,0), e4 (10,0)-(10,6); the outline from (0,0).
  assert.deepEqual(o.ids, ['e3', 'e4', 'e1', 'e2']);
  assert.equal(o.construction, true);
  assert.equal(rectangleOutline({ kind: 'rectangle', a: [0, 0], b: [10, 6] })!.ids, undefined);
});

test('D355: a fillet on a named side edge survives reopen and Finish with no change (same edge, same volume)', () => {
  const first = finish(circle, [rect], false), tags = (first.sideTags as { outer: string[] }).outer;
  const edge = `n1.side[${tags[1]}]|n1.side[${tags[2]}]`; // the corner (10, 6)
  const was = part('d355').extrude(sketch().polygon([[0, 0], [10, 0], [10, 6], [0, 6]]), { h: 5 })
    .fillet(b => b.edges().along('z').where(e => e.a[0] === 10 && e.a[1] === 6), { radius: 1 }).doc;
  const build = (node: Node): StudioDoc => ({ ...was, nodes: was.nodes.map((n, i) => i === 0 ? { ...node, id: (n as { id?: string }).id } as never : i === 2 ? { ...n, edges: [edge] } as never : n) });
  const before = build(first), after = build(reopenFinish(first));
  const edges = (d: StudioDoc) => {
    const r = evaluateDoc(d, 1);
    assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
    // (The named edge on the body before the fillet.)
    return part('x', { ...d, nodes: d.nodes.slice(0, 2) }).select().edges().where(e => e.names.includes(edge)).list().map(e => [e.a, e.b]);
  };
  assert.equal(JSON.stringify((after.nodes[0] as unknown as Node).sideTags), JSON.stringify(first.sideTags));
  const e0 = edges(before), e1 = edges(after);
  assert.ok(e0.length > 0);
  assert.deepEqual(e1, e0);
  assert.equal(part('x', after).mass({ density: 1 }).volume, part('x', before).mass({ density: 1 }).volume);
});
