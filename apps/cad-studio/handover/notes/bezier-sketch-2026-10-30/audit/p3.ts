import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { joinOpen } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/trim';
import { startPicking } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/select';
import { xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
import { rectanglePart, withNode, emptyDoc, type PlanarFaceOutlineInsetAssociation, type SketchNode, type StudioDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { featureId, withIds } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/ids';
import { resolveAssociativeSketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/part';
import { evaluatePart } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { bezierPoint } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/bezier';
const finish = (shape: any, done: any[], editNode: boolean) => {
  const shapes = joinOpen((editNode && shape ? [shape, ...done] : [...done, ...(shape ? [shape] : [])]).map((x: any) => x.kind === 'polygon' && !x.closed ? { ...x, pending: false } : x));
  const profile: any = profileOf(shapes); if ('error' in profile) return profile;
  const refs = shapes.filter((x: any) => x.construction || x.kind === 'bezier');
  return refs.length ? { ...profile.node, construction: refs } : profile.node;
};
const reopenFinish = (node: any) => { const { shape, done } = sketchShapes(JSON.parse(JSON.stringify(node))); const s: any = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0 } as any, 'select'); return finish(s.shape, s.done, true); };
const bz: any = { kind: 'bezier', poles: [[0, 20], [10, 40], [20, 20]] }, bz2: any = { kind: 'bezier', poles: [[30, 0], [35, 10], [40, -5], [45, 3]] };
for (const [label, shape, done] of [['bezier drawn first', { kind: 'rectangle', a: [0, 0], b: [10, 6] }, [bz]], ['bezier after', bz, [{ kind: 'rectangle', a: [0, 0], b: [10, 6] }]], ['polygon+2 beziers', { kind: 'polygon', points: [[0, 0], [10, 0], [10, 8], [0, 8]], closed: true, bulges: [0, 0.3, 0, 0] }, [bz, bz2]]] as any) {
  const n1 = finish(shape, done, false), n2 = reopenFinish(n1), n3 = reopenFinish(n2);
  console.log(label, '| n1==n2', JSON.stringify(n1) === JSON.stringify(n2), '| n2==n3', JSON.stringify(n2) === JSON.stringify(n3));
  if (JSON.stringify(n1) !== JSON.stringify(n2)) console.log('   n1', JSON.stringify(n1).slice(0, 400), '\n   n2', JSON.stringify(n2).slice(0, 400));
}
// startPicking with bezier drawn last in done
const sp: any = startPicking({ plane: xyPlane(), tool: 'rectangle', shape: null, done: [{ kind: 'rectangle', a: [0, 0], b: [10, 6] }, bz] } as any, 'select');
console.log('startPicking(shape null, done [rect, bezier]) -> shape', sp.shape?.kind ?? null);
const sp0: any = startPicking({ plane: xyPlane(), tool: 'rectangle', shape: null, done: [{ kind: 'rectangle', a: [0, 0], b: [10, 6] }] } as any, 'select');
console.log('startPicking(shape null, done [rect]) -> shape', sp0.shape?.kind ?? null);
// associative sketch keeps construction?
const source = withIds(rectanglePart(40, 24, 8));
const association: PlanarFaceOutlineInsetAssociation = { kind: 'planar-face-outline-inset', version: 1, source: { node: 1, side: 'solid' }, sourceFeature: featureId(source.nodes, 1), face: featureId(source.nodes, 1) + '.top', insetMM: 2 };
const lines = (p: [number, number][]) => p.map(start => ({ kind: 'line' as const, start }));
let doc: StudioDoc = withNode(source, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24], holes: [lines([[2, 2], [38, 2], [38, 22], [2, 22]])], plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] }, on: { node: 1, side: 'solid' }, association, construction: [bz] } as any);
try { const r: any = resolveAssociativeSketch(doc, 2); console.log('associative stored construction', JSON.stringify((doc.nodes[2] as any).construction).slice(0, 80), '-> resolved construction', JSON.stringify(r.construction)); } catch (e: any) { console.log('assoc THROW', e.message); }
// evaluatePart with bezier construction vs none, and with malformed entries
const base = profileOf([{ kind: 'rectangle', a: [0, 0], b: [10, 6] } as any]) as any;
for (const c of [undefined, [bz], [{ kind: 'bezier' }, { kind: 'bezier', poles: 'x' }, { kind: 'bezier', poles: [[1e300, 0]] }]]) {
  let d: StudioDoc = withNode(emptyDoc(), { ...base.node, ...(c ? { construction: c } : {}) });
  d = withNode(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: 5 } as any);
  const r: any = evaluatePart(d, 1);
  console.log('evaluatePart construction=' + JSON.stringify(c)?.slice(0, 60), '-> ok', r.ok, r.ok ? 'bodies ' + r.bodies?.length + ' vol ' + (r.bodies?.[0]?.volume ?? r.bodies?.[0]?.mass?.volume ?? '?') : JSON.stringify(r.error).slice(0, 120));
}
// non-dyadic error relative to pole magnitude
let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let worst = 0;
for (let i = 0; i < 2000; i++) { const poles = Array.from({ length: 4 }, () => [(rnd() - 0.5) * 200 / 3, (rnd() - 0.5) * 200 / 7] as [number, number]); const t = rnd(); const p = bezierPoint(poles, t); const s = 1 - t, b = [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t]; const m = Math.max(...poles.flat().map(Math.abs)); for (const k of [0, 1]) { const e = poles.reduce((a, q, j) => a + b[j] * q[k], 0); worst = Math.max(worst, Math.abs(p[k] - e) / (Number.EPSILON * m)); } }
console.log('de Casteljau vs float Bernstein, worst |diff| in units of eps*max|pole|:', worst.toFixed(2));
