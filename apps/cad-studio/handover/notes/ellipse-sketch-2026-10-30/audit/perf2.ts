import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import type { StudioDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { ellipseShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/ellipse';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
const which = process.env.CASE!;
const ell = (rx: number, ry: number, c: [number, number] = [0, 0]) => { const s = settleShape(ellipseShape({ center: c, rx, ry, angle: 20 }), null).shape as any; return { ...s, ids: s.points.map((_: any, i: number) => 'e' + (i + 10 + c[0] * 1000 + 7)) }; };
const nodeOf = (shapes: any[]) => { const p: any = profileOf(shapes); if (!('node' in p)) throw new Error(p.error); return p.node; };
const tmpl = (fillet: boolean) => { let p = part('perf').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 8 }); if (fillet) p = p.fillet(b => b.edges().where((e: any) => e.a[2] === 8 && e.b[2] === 8 && e.a[0] === 10 && e.b[0] === 10), { radius: 1 }); return p.doc; };
function run(node: any, edges: ((names: string[]) => string[]) | null) {
  const t = tmpl(!!edges); let doc: StudioDoc = { ...t, nodes: t.nodes.map((n: any, i: number) => i === 0 ? { ...node, id: n.id } : n) } as StudioDoc;
  if (edges) { const names = part('x', { ...doc, nodes: doc.nodes.slice(0, 2) }).select().edges().list().flatMap((e: any) => e.names); const pick = edges(names); doc = { ...doc, nodes: doc.nodes.map((n: any, i: number) => i === 2 ? { ...n, edges: pick, sigs: undefined } : n) } as StudioDoc; console.log('edges picked', pick.length); }
  const t0 = performance.now(), r: any = evaluateDoc(doc, 1), ms = Math.round(performance.now() - t0);
  const b = r.ok ? r.bodies[0] : null, m = b?.mesh ?? b?.display ?? b;
  const tri = m ? (m.indices?.length ?? m.triangles?.length ?? 0) / 3 : 0;
  console.log("rebuild", JSON.stringify(r.rebuild?.profile).slice(0, 900)); console.log(which, "ok", r.ok, 'ms', ms, 'tris', tri, 'bodyKeys', b ? Object.keys(b).join(',') : J(r.error).slice(0, 300), 'faces', b?.faces?.length ?? r.faceTable?.faces?.length, 'jsonKB', Math.round(JSON.stringify(r.bodies ?? []).length / 1024));
}
const J = (x: unknown) => JSON.stringify(x);
const top = (tag: (n: string) => boolean) => (names: string[]) => [names.find(n => tag(n) && n.endsWith('|n1.top'))!];
if (which === 'circle') run(nodeOf([{ kind: 'circle', c: [0, 0], r: 30, ids: ['c1'] }]), null);
if (which === 'ellipse') run(nodeOf([ell(30, 12)]), null);
if (which === 'ellipse-round') run(nodeOf([ell(30, 30)]), null);
if (which === 'circle-fillet') run(nodeOf([{ kind: 'circle', c: [0, 0], r: 30, ids: ['c1'] }]), (names) => { console.log(names.slice(0, 6)); return [names.find(n => n.includes('top'))!]; });
if (which === 'ellipse-fillet1') run(nodeOf([ell(30, 12)]), top(n => n.includes('side[e17]')));
if (which === 'ellipse-fillet-all') run(nodeOf([ell(30, 12)]), names => names.filter(n => n.endsWith('|n1.top')));
if (which === 'three') run(nodeOf([ell(60, 40), ell(10, 5, [-25, 0]), ell(8, 4, [25, 0])]), null);
