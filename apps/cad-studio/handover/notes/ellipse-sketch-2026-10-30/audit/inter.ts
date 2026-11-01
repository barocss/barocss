import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import type { SketchNode, StudioDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { ellipseError, ellipseMatches, ellipseShape, reellipse, wellFormedEllipse, ELLIPSE_MIN_RATIO } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/ellipse';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { profileOf, outlineOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes, reopenedOrder, outlinePolygon } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { offsetShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/offset';
import { trimAt, splitAt, joinOpen } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/trim';
import { roundCorner } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/corner';
import { shapeSnaps } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/osnap';
import { attachCircle, startPicking } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/select';
import { sketchDxf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/dxf';
import { profileRings } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/profiles';
import { xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
const J = (x: unknown) => JSON.stringify(x, (k, v) => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);
const log = (k: string, v: unknown) => console.log(k.padEnd(44), typeof v === 'string' ? v : J(v));
const tryv = (k: string, f: () => unknown) => { try { log(k, f()); } catch (e) { log(k, 'THROW ' + (e as Error).message.slice(0, 200)); } };
const D = (rx: number, ry: number, angle = 0, center: [number, number] = [0, 0]) => ({ center, rx, ry, angle });
const named = (s: any) => ({ ...s, ids: s.points.map((_: unknown, i: number) => 'e' + (i + 10)) });
const settle = (s: any, prev: any = null) => settleShape(s, prev);
// ---- 2. refusal boundaries
for (const [k, d] of [['ratio 0.2 exact', D(10, 2)], ['ratio 0.2-5e-10', D(10, 2 - 5e-9)], ['ratio 0.2-2e-9', D(10, 2 - 2e-8)], ['rx=ry', D(7, 7)], ['curv radius ry2/rx=0.0101', D(0.25, 0.0502)], ['ry2/rx=0.0099 (r .25)', D(0.2475, 0.0495)], ['tiny circle r=0.0101', D(0.0101, 0.0101)], ['tiny circle r=0.0099', D(0.0099, 0.0099)], ['0.06x0.02 (ratio<.2? no .333)', D(0.06, 0.02)],
  ['circle 9999 at 0', D(9999, 9999)], ['circle 10000.0001', D(10000.0001, 10000.0001)], ['9000x8000 at 0', D(9000, 8000)], ['9000x8000 ang 45', D(9000, 8000, 45)], ['5000x2000', D(5000, 2000)], ['3000x600', D(3000, 600)], ['2000x400', D(2000, 400)],
  ['angle -30', D(10, 5, -30)], ['angle 390', D(10, 5, 390)], ['angle 1e20', D(10, 5, 1e20)], ['angle NaN', D(10, 5, NaN)], ['angle -Inf', D(10, 5, -Infinity)], ['rx Inf', D(Infinity, 5)], ['center 1e308', D(10, 5, 0, [1e308, 0])], ['rx 1e-300', D(1e-300, 1e-300)], ['rx 5e-324 ry 5e-324', D(5e-324, 5e-324)]] as const)
  tryv('err ' + k, () => ellipseError(d as any) ?? 'ok');
// equivalence of angle 390 vs 30
{ const a = ellipseShape(D(10, 5, 390)), b = ellipseShape(D(10, 5, 30)); log('angle 390 vs 30 max pt diff', Math.max(...a.points.map((p, i) => Math.hypot(p[0] - b.points[i][0], p[1] - b.points[i][1])))); }
// 1e20 angle: does an accepted shape still match / survive reopen?
tryv('angle 1e20 matches', () => { const s = ellipseShape(D(10, 5, 1e20)); return ellipseMatches(s); });
// ---- 3. identity
const base = named(settle(ellipseShape(D(30, 12, 20))).shape);
const p0 = profileOf([base]) as any; log('profile ok', 'node' in p0); log('node kind/profile', [p0.node.profile, p0.node.segments?.length, p0.node.outline?.points?.length]);
const node0 = { ...p0.node, id: 'n0' };
const edits = [D(35, 12, 20), D(35, 20, 20), D(35, 20, 80), D(35, 20, 80, [3, 4]), D(12, 35, 80, [3, 4])];
let prev = base; let ok = true;
for (const d of edits) { const nx = reellipse(prev, d); const st = settle(nx, prev); if (st.error) log('settle err', st.error); const pp = profileOf([st.shape as any]) as any; if (J(pp.node.sideTags) !== J(p0.node.sideTags)) ok = false; if (!(st.shape as any).ellipse) log('def lost on edit', d); prev = st.shape as any; }
log('sideTags stable across 5 panel edits', ok);
// reopen -> Finish unchanged idempotent, through startPicking (Select)
{ const back = sketchShapes(JSON.parse(JSON.stringify(node0)) as SketchNode); const s = startPicking({ plane: xyPlane(), tool: 'select', shape: back.shape, done: back.done, editNode: 0 } as any, 'select');
  const again = profileOf([s.shape as any, ...(s.done ?? [])]) as any; log('reopen+select+finish same node', J(again.node) === J(p0.node)); log('  ellipse kept after startPicking', !!(s.shape as any)?.ellipse); }
// fillet on top edge across Rx edit: edge between side and top cap
function docOf(node: any, extra?: (p: any) => any) { let p = part('ell').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 8 }); if (extra) p = extra(p); const b = p.doc; return { ...b, nodes: b.nodes.map((n: any, i: number) => i === 0 ? { ...node, id: n.id } : n) } as StudioDoc; }
{ const tags = p0.node.sideTags.outer as string[]; const sideF = 'n0.side[' + tags[7] + ']';
  const was = part('f').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 8 }).fillet(b => b.edges().where((e: any) => e.a[2] === 8 && e.b[2] === 8 && e.a[0] === 10 && e.b[0] === 10), { radius: 1 }).doc;
  log('fillet node template', J(was.nodes[2]).slice(0, 200));
  // name the side-top edge
  const sideName = (was.nodes[1] as any).id;
  const build = (node: any) => ({ ...was, nodes: was.nodes.map((n: any, i: number) => i === 0 ? { ...node, id: n.id } : n) }) as StudioDoc;
  const d0 = build(node0); const pre = part('x', { ...d0, nodes: d0.nodes.slice(0, 2) }).select().edges().list().filter((e: any) => e.names.some((nm: string) => nm.includes(tags[7]))).map((e: any) => e.names.join('/'));
  log('edges named with side tag e(7)', pre.slice(0, 4));
  const topEdge = part('x', { ...d0, nodes: d0.nodes.slice(0, 2) }).select().edges().list().map((e: any) => e.names).flat().find((nm: string) => nm.includes(tags[7]) && /end|top|cap/.test(nm));
  log('picked top edge name', topEdge ?? 'none');
  if (topEdge) {
    const mk = (node: any) => { const d = build(node); return { ...d, nodes: d.nodes.map((n: any, i: number) => i === 2 ? { ...n, edges: [topEdge] } : n) } as StudioDoc; };
    const t0 = performance.now(), r0 = evaluateDoc(mk(node0), 1), t1 = performance.now(); log('fillet top edge ok/ms', [r0.ok, Math.round(t1 - t0), !r0.ok && J((r0 as any).error).slice(0, 200)]);
    const ed = reellipse(sketchShapes(JSON.parse(J(node0)) as SketchNode).shape as any, D(36, 12, 20)); const pe = profileOf([settle(ed, ed).shape as any]) as any;
    const r1 = evaluateDoc(mk({ ...pe.node, id: 'n0' }), 1); log('fillet after Rx 30->36 ok', [r1.ok, !r1.ok && J((r1 as any).error).slice(0, 200)]);
    if (r0.ok && r1.ok) log('volumes before/after', [part('x', mk(node0)).mass({ density: 1 }).volume, part('x', mk({ ...pe.node, id: 'n0' })).mass({ density: 1 }).volume]);
  }
}
// stale def: move one point; settle drops; finish ok; reopen no def
{ const moved = { ...base, points: base.points.map((p: any, i: number) => i === 40 ? [p[0] + 0.2, p[1] - 0.1] : p) }; const st = settle(moved, base); log('stale: error/def/pts', [st.error, !!(st.shape as any).ellipse, (st.shape as any).points.length]);
  const pp = profileOf([st.shape as any]) as any; log('stale finish ok, outline.ellipse', ['node' in pp, pp.node?.outline?.ellipse ?? null]);
  log('stale sideTags kept', J(pp.node.sideTags) === J(p0.node.sideTags));
  // a stale shape whose def is still present (unsettled) through outlineOf
  log('outlineOf(unsettled stale) ellipse', outlineOf(moved as any)?.ellipse ?? null); }
// JSON round trip of doc
{ const d = docOf(node0); const back = JSON.parse(JSON.stringify(d)); log('doc JSON roundtrip eq', J(back) === J(d)); const r = evaluateDoc(back, 1); log('roundtrip evaluates', r.ok); }
// ---- 4. interactions
const ell = settle(ellipseShape(D(30, 12, 20))).shape as any;
tryv('offset +2', () => { const r: any = offsetShape(ell, 2); return 'error' in r ? r.error : [r.shape.kind, r.shape.points.length, !!r.shape.ellipse, !!r.shape.fromEllipse]; });
tryv('offset -2', () => { const r: any = offsetShape(ell, -2); return 'error' in r ? r.error : [r.shape.kind, r.shape.points.length, !!r.shape.ellipse, !!r.shape.fromEllipse]; });
tryv('offset -2 profile+evaluates', () => { const r: any = offsetShape(ell, -2); const s2 = settle(r.shape).shape; const p: any = profileOf([ell, s2]); if (!('node' in p)) return p.error; const e = evaluateDoc(docOf({ ...p.node }), 1); return [e.ok, p.node.holes?.length, p.node.regions?.length]; });
tryv('offset fromEllipse leaks?', () => { const r: any = offsetShape(ell, 2); return Object.keys(r.shape ?? {}); });
const onPt = ell.points[5];
tryv('trimAt on ellipse (alone)', () => { const r: any = trimAt([ell], onPt, 0.5); return 'error' in r ? r.error : r.shapes.map((s: any) => [s.kind, s.closed, s.points?.length, !!s.ellipse, !!s.fromEllipse]); });
const line = { kind: 'polygon', points: [[-40, 0], [40, 0]], closed: false, bulges: [0, 0] };
tryv('trimAt ellipse crossed by a line', () => { const r: any = trimAt([ell, line as any], [0, 12.0], 0.5) ; return 'error' in r ? r.error : r.shapes.map((s: any) => [s.kind, s.closed, s.points?.length, !!s.ellipse, !!s.fromEllipse]); });
tryv('splitAt on ellipse', () => { const r: any = splitAt([ell], onPt, 0.5); return 'error' in r ? r.error : r.shapes.map((s: any) => [s.kind, s.closed, s.points?.length, !!s.ellipse, !!s.fromEllipse]); });
tryv('splitAt then joinOpen -> def?', () => { const r: any = splitAt([ell], onPt, 0.5); if ('error' in r) return r.error; const j = joinOpen(r.shapes); return j.map((s: any) => [s.kind, s.closed, s.points?.length, !!s.ellipse, s.ellipse && ellipseMatches(s)]); });
tryv('roundCorner(0, 1)', () => { const r: any = roundCorner(ell, 0, 1); return 'error' in r ? r.error : [r.shape.points.length, !!r.shape.ellipse, !!r.shape.fromEllipse]; });
tryv('snaps on ellipse (count, kinds)', () => { const sn = shapeSnaps(ell); const k: Record<string, number> = {}; sn.forEach((s: any) => k[s.kind] = (k[s.kind] ?? 0) + 1); return k; });
tryv('attachCircle to ellipse', () => { const st: any = { plane: xyPlane(), tool: 'select', shape: ell, done: [{ kind: 'circle', c: [0, 0], r: 3 }] }; const r: any = attachCircle(st, 0); if (!r) return 'null'; const s2 = settle(r.state.shape, ell); return [s2.error, !!(s2.shape as any).ellipse, (s2.shape as any).circles?.length, ellipseMatches(s2.shape as any)]; });
tryv('attached circle survives reellipse+profile', () => { const s = { ...ell, circles: [{ c: [0, 0], r: 3 }] }; const n = reellipse(s, D(40, 15, 20)); const p: any = profileOf([settle(n, s).shape as any]); return 'node' in p ? [p.node.holes?.length, J(p.node.outline?.circles), !!p.node.outline?.ellipse] : p.error; });
tryv('ellipse + circle hole (separate shape)', () => { const p: any = profileOf([ell, { kind: 'circle', c: [0, 0], r: 3 } as any]); return 'node' in p ? [p.node.profile, p.node.holes?.length, evaluateDoc(docOf(p.node), 1).ok] : p.error; });
tryv('ellipse as hole in rectangle', () => { const p: any = profileOf([{ kind: 'rectangle', a: [-50, -50], b: [50, 50] } as any, ell]); return 'node' in p ? [p.node.profile, p.node.holes?.length, !!p.node.outline?.ellipse, evaluateDoc(docOf(p.node), 1).ok] : p.error; });
tryv('ellipse beside rectangle (region)', () => { const p: any = profileOf([ell, { kind: 'rectangle', a: [100, 0], b: [120, 20] } as any]); return 'node' in p ? [p.node.profile, p.node.regions?.length, !!p.node.outline?.ellipse, evaluateDoc(docOf(p.node), 1).ok] : p.error; });
tryv('rectangle main, ellipse region: def kept?', () => { const p: any = profileOf([{ kind: 'rectangle', a: [100, 0], b: [120, 20] } as any, ell]); return 'node' in p ? [p.node.profile, p.node.regions?.length, J(p.node.outline)?.slice(0, 80)] : p.error; });
tryv('reopen rect+ellipse-hole: ellipse back?', () => { const p: any = profileOf([{ kind: 'rectangle', a: [-50, -50], b: [50, 50] } as any, named(ell)]); const b = sketchShapes(JSON.parse(J({ ...p.node, id: 'n0' }))); return [b.shape?.kind, b.done.map((s: any) => [s.kind, s.points?.length, !!s.ellipse])]; });
tryv('reopenedOrder ellipse main + circle', () => { const e = named(ell), c = { kind: 'circle', c: [100, 0], r: 3, ids: ['c1'] }; const p: any = profileOf([e, c as any]); const b = sketchShapes(JSON.parse(J({ ...p.node, id: 'n0' }))); const ord = reopenedOrder(b.shape, b.done, (p.node as any).mainIds ?? e.ids); const p2: any = profileOf(ord as any); return [J(p2.node.sideTags) === J(p.node.sideTags), !!p2.node.outline?.ellipse, ord.map((s: any) => s.kind)]; });
tryv('profileRings (loft/revolve preview)', () => { const r = profileRings({ ...p0.node, id: 'n0' } as any); return [r.length, r[0]?.length]; });
tryv('DXF export', () => { const r: any = sketchDxf({ ...p0.node, id: 'n0' } as any, {}); const t: string = r.text ?? r.dxf ?? J(r); return [Object.keys(r), (t.match(/\nARC\r?\n/g) ?? []).length, (t.match(/LWPOLYLINE/g) ?? []).length, (t.match(/ELLIPSE/g) ?? []).length, t.length]; });
