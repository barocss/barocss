import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { ellipseShape, ellipseSideEdge } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/ellipse';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { commandById } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/commands';
import { checkNode } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/chat/features';
const ellNode = (c: [number, number] = [0, 0]) => { const s = settleShape(ellipseShape({ center: c, rx: 30, ry: 12, angle: 0 }), null).shape as any; const p: any = profileOf([{ ...s, ids: s.points.map((_: any, i: number) => 'e' + (i + 1)) }]); return p.node; };
const rectNode = () => { const p: any = profileOf([{ kind: 'rectangle', a: [100, 0], b: [120, 20], ids: ['e1', 'e2', 'e3', 'e4'] } as any]); return p.node; };
const edgesOf = (doc: any) => { const r: any = evaluateDoc(doc, 1); if (!r.ok) return 'EVAL FAIL ' + JSON.stringify(r.error).slice(0, 150); return r.bodies.flatMap((b: any) => b.mesh.edges.flatMap((e: any) => e.names)); };
const summary = (doc: any, label: string) => { const names = edgesOf(doc); if (typeof names === 'string') { console.log(label, names); return; } const hit = names.filter((n: string) => ellipseSideEdge(doc.nodes, n)); console.log(label.padEnd(40), 'edges', names.length, 'refused', hit.length, 'sample', names.slice(0, 2).join(' ; ')); return names; };
// A: ids == indices, extrude
const ext = part('a').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 8 }).doc;
const A = { ...ext, nodes: [{ ...ellNode(), id: 'n0' }, ext.nodes[1]] }; summary(A, 'A extrude ids=indices');
// B: ids != indices (as after deleting an earlier feature): ellipse sketch n2 at 0, extrude n3 at 1
const B = { ...ext, nextId: 4, nodes: [{ ...ellNode(), id: 'n2' }, { ...ext.nodes[1], id: 'n3', sketch: 0 }] }; summary(B, 'B extrude ids!=indices');
// C: false positive: [rect sketch n0, ellipse sketch n5, ellipse extrude n7 (sketch 1), rect extrude n2 (sketch 0)]
const C = { ...ext, nextId: 8, nodes: [{ ...rectNode(), id: 'n0' }, { ...ellNode([0, 50]), id: 'n5' }, { ...ext.nodes[1], id: 'n7', sketch: 1 }, { ...ext.nodes[1], id: 'n2', sketch: 0 }] } as any;
{ const names = summary(C, 'C mixed ids') as string[]; if (names) console.log('   rect (n2) edges refused:', names.filter(n => n.startsWith('n2.') && ellipseSideEdge(C.nodes, n)).length, ' ellipse (n7) edges refused:', names.filter(n => n.includes('n7.side') && ellipseSideEdge(C.nodes, n)).length, '/', names.filter(n => n.includes('n7.side')).length); }
// D: revolve of an ellipse away from the axis (XZ plane sketch)
const rv = part('r').revolve(sketch().polygon([[40, 0], [60, 0], [60, 10], [40, 10]]), { deg: 90 }).doc;
console.log('revolve nodes', JSON.stringify(rv.nodes.map((n: any) => [n.id, n.kind, n.sketch, n.axis])));
const D = { ...rv, nodes: rv.nodes.map((n: any, i: number) => i === 0 ? { ...ellNode([60, 20]), id: n.id, ...(n.plane ? { plane: n.plane } : {}) } : n) }; summary(D, 'D revolve 90');
const D2 = { ...D, nodes: D.nodes.map((n: any) => n.kind === 'revolve' ? { ...n, angle: 360 } : n) }; summary(D2, 'D2 revolve 360');
// E: sweep straight+bend
const E = { ...ext, nodes: [{ ...ellNode([0, 0]), id: 'n0' }, { kind: 'sweep', sketch: 0, path: [{ kind: 'straight', length: 20 }, { kind: 'bend', radius: 80, angle: 30, toward: 'x' }], id: 'n1' }] }; summary(E, 'E sweep');
// F: chat add_features check of a fillet node naming an ellipse side edge
{ const names = edgesOf(A) as string[]; const e = names.find(n => n.includes('side[e17]') && n.endsWith('top'))!; const node = { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [e], radius: 1 };
  console.log('F chat checkNode(fillet on ellipse side)', JSON.stringify(checkNode(node, A.nodes as any, {}, [], []))); }
// G: command available/build with ids != indices
{ const r: any = evaluateDoc(B as any, 1); const bodies = r.bodies; const ei = bodies[0].mesh.edges.findIndex((e: any) => e.names.some((n: string) => n.includes('side[e17]') && n.endsWith('top')));
  const ctx: any = { doc: B, bodies, selection: { faces: [], edges: [{ body: 0, edge: ei }], bodies: [] } };
  for (const id of ['fillet', 'chamfer']) { const c: any = commandById(id); const av = c.available(ctx); let b = 'built'; try { c.build(ctx, c.defaults(ctx)); } catch (x) { b = 'refused: ' + (x as Error).message.slice(0, 60); } console.log('G', id, 'ids!=indices available', JSON.stringify(av).slice(0, 90), '| build', b); }
  const ra: any = evaluateDoc(A as any, 1); const ej = ra.bodies[0].mesh.edges.findIndex((e: any) => e.names.some((n: string) => n.includes('side[e17]') && n.endsWith('top')));
  const ctxA: any = { doc: A, bodies: ra.bodies, selection: { faces: [], edges: [{ body: 0, edge: ej }], bodies: [] } };
  for (const id of ['fillet', 'chamfer']) { const c: any = commandById(id); let b = 'built'; try { c.build(ctxA, c.defaults(ctxA)); } catch (x) { b = 'refused: ' + (x as Error).message.slice(0, 60); } console.log('G', id, 'ids=indices available', JSON.stringify(c.available(ctxA)).slice(0, 90), '| build', b); } }
