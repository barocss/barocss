import { profileOf, shapeNode, shapeOutline } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { trimAt, extendAt, splitAt, joinOpen, trimPreview } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/trim';
import { offsetShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/offset';
import { sketchDxf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/dxf';
import { shapeSnaps, nearestSnap } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/osnap';
import { startPicking } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/select';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { withIds } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/entityIds';
import { bezierCurve } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/bezier';
import { curvesSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/curveSource';
import { emptyDirect, importSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/direct';
import { copyLoftGuide } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/loftGuides';
import { loadDirect } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/directModule';
import { xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
import { switchTool } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/src/app/sketchControls';
await loadDirect();
const T = (name: string, f: () => unknown) => { try { const r = f(); console.log('OK  ', name, '=>', JSON.stringify(r)?.slice(0, 260)); } catch (e: any) { console.log('THROW', name, '=>', e?.constructor?.name, String(e?.message).slice(0, 160)); } };
const bz: any = { kind: 'bezier', poles: [[0, 20], [10, 40], [20, 20]] }, rect: any = { kind: 'rectangle', a: [0, 0], b: [10, 6] };
// a) side tags with order
T('profileOf([rect]).sideTags', () => (profileOf([rect]) as any).node.sideTags);
T('profileOf([bezier, rect]).sideTags', () => (profileOf([bz, rect]) as any).node.sideTags);
T('profileOf([constrLine, rect]).sideTags (pre-existing construction analogue)', () => (profileOf([{ kind: 'polygon', points: [[0, 30], [5, 30]], closed: false, construction: true } as any, rect]) as any).node.sideTags);
// c) joinOpen with bezier between two open lines whose ends meet the bezier's end poles
const l1: any = { kind: 'polygon', points: [[-10, 20], [0, 20]], closed: false }, l2: any = { kind: 'polygon', points: [[20, 20], [30, 20]], closed: false };
T('joinOpen([l1, bz, l2]) kinds', () => joinOpen([l1, bz, l2]).map(s => s.kind + (s.kind === 'polygon' ? ':' + s.points.length : '')));
// d) trim/extend/split on bezier
T('trimAt on bezier curve (10,30)', () => trimAt([rect, bz], [10, 30], 1));
T('splitAt on bezier curve', () => splitAt([rect, bz], [10, 30], 1));
T('extendAt line toward bezier', () => extendAt([{ kind: 'polygon', points: [[10, 10], [10, 15]], closed: false } as any, bz], [10, 15], 1));
T('trimPreview on bezier', () => trimPreview([rect, bz], [10, 30], 1));
T('trimAt line crossing bezier (line x=10 from 0..50 crosses curve at y=30)', () => trimAt([{ kind: 'polygon', points: [[10, 0], [10, 50]], closed: false } as any, bz], [10, 45], 1));
// e) offset
T('offsetShape(bz)', () => offsetShape(bz, 2));
// f) dxf with bezier in construction
T('sketchDxf with bezier', () => { const r: any = profileOf([rect, bz]); const n = { ...r.node, construction: [bz, { kind: 'polygon', points: [[0, 0], [5, 5]], closed: false, construction: true }] }; const out: any = sketchDxf(n, {}); return { ok: out.ok, ents: (out.text ?? out.dxf ?? '').split('\n').filter((l: string) => /^(LINE|LWPOLYLINE|SPLINE|CIRCLE|ARC)$/.test(l.trim())).length, keys: Object.keys(out) }; });
// g) snaps
T('shapeSnaps(bz)', () => shapeSnaps(bz));
T('shapeSnaps(bz, moving)', () => shapeSnaps(bz, true));
T('nearestSnap with malformed bezier (poles [])', () => nearestSnap(shapeSnaps({ kind: 'bezier', poles: [] } as any), p => p, [0, 0]));
T('shapeSnaps malformed bezier no poles', () => shapeSnaps({ kind: 'bezier' } as any));
// h) startPicking / switchTool
T('startPicking(shape=bezier, done=[rect]) -> current kind', () => { const s: any = startPicking({ plane: xyPlane(), tool: 'bezier', shape: bz, done: [rect] } as any, 'select'); return [s.shape?.kind, s.done.map((d: any) => d.kind)]; });
T('startPicking(shape=circle, done=[rect]) -> current kind (existing analogue)', () => { const s: any = startPicking({ plane: xyPlane(), tool: 'circle', shape: { kind: 'circle', c: [50, 50], r: 3 }, done: [rect] } as any, 'select'); return [s.shape?.kind, s.done.map((d: any) => d.kind)]; });
T('switchTool(bezier current -> rectangle)', () => { const s: any = switchTool({ plane: xyPlane(), tool: 'bezier', shape: bz, done: [rect] } as any, 'rectangle'); return [s.shape, s.done.map((d: any) => d.kind)]; });
T('switchTool(2-pole bezier current -> rectangle)', () => { const s: any = switchTool({ plane: xyPlane(), tool: 'bezier', shape: { kind: 'bezier', poles: [[0, 0], [1, 1]] }, done: [] } as any, 'rectangle'); return [s.shape, s.done]; });
// i) settle
T('settleShape(bz, rect)', () => settleShape(bz, rect));
T('shapeNode(bz), shapeOutline(bz).length', () => [shapeNode(bz), shapeOutline(bz).length]);
// j) malformed construction entries through reopen
const bad = [{ kind: 'bezier' }, { kind: 'bezier', poles: [[0, 0], [1, 1]] }, { kind: 'bezier', poles: [[0, 0], [1, 1], [2, 0], [3, 3], [4, 0]] }, { kind: 'bezier', poles: [[NaN, 0], [1, 1], [2, 0]] }, { kind: 'bezier', poles: 'x' }];
for (const b of bad) {
  const node: any = { ...(profileOf([rect]) as any).node, construction: [b] };
  T('reopen+withIds+profileOf with ' + JSON.stringify(b), () => { const r = sketchShapes(node); const all = [r.shape!, ...r.done]; const p: any = profileOf(withIds(all)); return { doneKinds: r.done.map(d => d.kind), profileOk: 'node' in p }; });
  T('  snaps of it', () => sketchShapes(node).done.flatMap(d => shapeSnaps(d as any)));
  T('  make curves of it', () => { const d: any = sketchShapes(node).done[0]; const curves = d.poles.length >= 3 ? [bezierCurve(xyPlane(), d.poles)] : []; if (!curves.length) return 'skipped'; const dir = importSource(emptyDirect(), curvesSource('sketch', curves), 'S'); const g = copyLoftGuide({ direct: dir }, dir.objects[0].id); return g.ok ? g.guide.kind : g.reason; });
  T('  dxf of it', () => (sketchDxf(node, {}) as any).ok);
}
// o) degenerate beziers
for (const poles of [[[0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [5, 5]], [[0, 0], [5, 5], [0, 0]], [[0, 0], [1, 1], [2, 2], [2, 2]], [[0, 0], [1, 1], [2, 2]]]) {
  T('degenerate ' + JSON.stringify(poles), () => { const dir = importSource(emptyDirect(), curvesSource('sketch', [bezierCurve(xyPlane(), poles as any)]), 'S'); const g = copyLoftGuide({ direct: dir }, dir.objects[0].id); return g.ok ? g.guide.kind : 'refused: ' + g.reason; });
}
