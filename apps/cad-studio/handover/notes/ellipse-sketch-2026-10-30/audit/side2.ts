import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { ellipseShape, ellipseSideEdge } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/ellipse';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { checkNode } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/chat/features';
const ellNode = (c: [number, number] = [0, 0], ids = true) => { const s = settleShape(ellipseShape({ center: c, rx: 30, ry: 12, angle: 0 }), null).shape as any; const p: any = profileOf([ids ? { ...s, ids: s.points.map((_: any, i: number) => 'e' + (i + 1)) } : s]); return p.node; };
const rectNode = (a: [number, number] = [100, 0], b: [number, number] = [120, 20]) => { const p: any = profileOf([{ kind: 'rectangle', a, b, ids: ['e1', 'e2', 'e3', 'e4'] } as any]); return p.node; };
const ext = part('a').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 8 }).doc, X = ext.nodes[1] as any;
const doc = (nodes: any[], nextId = nodes.length) => ({ ...ext, nextId, nodes }) as any;
const names = (d: any) => { const r: any = evaluateDoc(d, 1); if (!r.ok) throw new Error(JSON.stringify(r.error).slice(0, 200)); return r.bodies.flatMap((b: any) => b.mesh.edges.flatMap((e: any) => e.names)) as string[]; };
const rep = (label: string, d: any, sel: (n: string) => boolean) => { try { const ns = names(d).filter(sel); console.log(label.padEnd(58), 'refused', ns.filter(n => ellipseSideEdge(d.nodes, n)).length, '/', ns.length, ns[0] ?? ''); } catch (e) { console.log(label, 'EVAL FAIL', (e as Error).message); } };
// B, C (as before)
rep('B ellipse extrude n3 at index 1', doc([{ ...ellNode(), id: 'n2' }, { ...X, id: 'n3', sketch: 0 }], 4), n => n.includes('.side'));
const C = doc([{ ...rectNode(), id: 'n0' }, { ...ellNode([0, 50]), id: 'n5' }, { ...X, id: 'n7', sketch: 1 }, { ...X, id: 'n2', sketch: 0 }], 8);
rep('C rect extrude n2 (index 2 is ellipse extrude)', C, n => n.startsWith('n2.') || n.includes('|n2.'));
rep('C ellipse extrude n7', C, n => n.includes('n7.side'));
// split of a rectangle extrude (#k faces) and of an ellipse extrude
const A = doc([{ ...ellNode(), id: 'n0' }, { ...X, id: 'n1', sketch: 0 }]);
const R = doc([{ ...rectNode([0, 0], [20, 20]), id: 'n0' }, { ...X, id: 'n1', sketch: 0 }]);
const split = (d: any) => doc([...d.nodes, { kind: 'split', parent: { node: 1, side: 'solid' }, at: 4, axis: 'z', id: 'n2' }], 3);
rep('split rect extrude: side edges', split(R), n => n.includes('.side'));
{ const ns = names(split(R)); console.log('   rect split names with #', ns.filter(n => n.includes('#')).slice(0, 3)); }
rep('split ellipse extrude: side edges', split(A), n => n.includes('.side'));
{ const ns = names(split(A)); console.log('   ellipse split names with #', ns.filter(n => n.includes('#')).slice(0, 3)); }
// ellipse main + rectangle region in the same sketch (region sides must not be refused)
{ const s = settleShape(ellipseShape({ center: [0, 0], rx: 30, ry: 12, angle: 0 }), null).shape as any; const p: any = profileOf([{ ...s, ids: s.points.map((_: any, i: number) => 'e' + (i + 1)) }, { kind: 'rectangle', a: [100, 0], b: [120, 20], ids: ['r1', 'r2', 'r3', 'r4'] } as any]);
  const D = doc([{ ...p.node, id: 'n0' }, { ...X, id: 'n1', sketch: 0 }]); console.log('   region sketch sideTags keys', Object.keys(p.node.sideTags));
  rep('ellipse main + rect region: region sides', D, n => /side\[r\d\]/.test(n)); rep('ellipse main + rect region: ellipse sides', D, n => /side\[e\d+\]/.test(n)); }
// sketch without explicit ids: sideTags present?
{ const n = ellNode([0, 0], false); console.log('   unnamed ellipse sketch sideTags.outer length', n.sideTags?.outer?.length); }
// mirror and linear pattern of the ellipse body
rep('mirror of ellipse extrude', doc([...A.nodes, { kind: 'mirror', parent: { node: 1, side: 'solid' }, plane: 'yz', id: 'n2' }], 3), n => n.includes('side'));
rep('linear pattern of ellipse extrude', doc([...A.nodes, { kind: 'linear-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', spacing: 80, count: 2, id: 'n2' }], 3), n => n.includes('side'));
{ const ns = names(doc([...A.nodes, { kind: 'linear-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', spacing: 80, count: 2, id: 'n2' }], 3)); console.log('   pattern side names sample', ns.filter(n => n.includes('side')).filter((_, i) => i % 200 === 0).slice(0, 4)); }
// chat checkNode: fillet on an ellipse side, on a rect side, on the ellipse top cap only
{ const e = names(A).find(n => n.includes('side[e17]') && n.endsWith('top'))!, r = names(R).find(n => n.includes('side[e1]') && n.endsWith('top'))!;
  const chk = (d: any, edge: string) => checkNode({ kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [edge], radius: 1 }, d.nodes, {}, [], []);
  console.log('chat fillet ellipse side', (chk(A, e) ?? 'null').slice(0, 70)); console.log('chat fillet rect side', chk(R, r)); console.log('chat chamfer ellipse side', (checkNode({ kind: 'chamfer', parent: { node: 1, side: 'solid' }, edges: [e], distance: 1 }, A.nodes, {}, [], []) ?? 'null').slice(0, 60)); }
