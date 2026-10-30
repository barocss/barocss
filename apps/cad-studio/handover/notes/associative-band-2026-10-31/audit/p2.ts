// Targeted edge cases: near-tie false refusals, tag stability (_0/_1 under rotation), boundaries, downstream references.
import { bandLoops, bandProfile } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/band';
import { withIds } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/entityIds';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import type { SketchShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/types';
import { bandOver, checkLoop, piecesOf, type P } from './geo';

const C = (c: P, r: number): SketchShape => ({ kind: 'circle', c, r, construction: true });
const Rc = (a: P, b: P): SketchShape => ({ kind: 'rectangle', a, b, construction: true });
const Pg = (points: P[]): SketchShape => ({ kind: 'polygon', points, closed: true, bulges: points.map(() => 0), construction: true });
function run(name: string, shapes: SketchShape[], extra = {}) {
  const all = withIds(shapes), band = bandOver(all, all.map((_, i) => i), extra), r = bandLoops(all, band);
  if ('error' in r) { console.log(name.padEnd(48), 'REFUSED', r.error); return null; }
  const P = all.map(piecesOf), sc = Math.max(1, ...P.flat().map(g => Math.max(Math.abs(g.c[0]), Math.abs(g.c[1])) + g.r));
  const bad = checkLoop(r.outer, P, ((extra as { offset?: number }).offset ?? 0) + ((extra as { width?: number }).width ?? 0), sc);
  console.log(name.padEnd(48), 'ok', r.outer.length, 'segs', bad.length ? 'BAD ' + bad.slice(0, 3).join(';') : '', r.tags.outer.join(' '));
  return { r, all, band };
}

console.log('--- near-tie false refusal (third source cone endpoint near a transition angle)');
for (const dy of [0, 1e-10, 1e-9, 1e-8, 1e-7, 1e-6]) {
  run(`2 circles dy=${dy}`, [C([0, 0], 10), C([100, dy], 10)]);
  run(`2 circles dy=${dy} + rect below`, [C([0, 0], 10), C([100, dy], 10), Rc([40, -60], [60, -40])]);
  run(`2 circles dy=${dy} + rect inside-ish`, [C([0, 0], 10), C([100, dy], 10), Rc([45, -3], [55, 3])]);
}
console.log('--- near-collinear middle source');
for (const dy of [0, 1e-12, 1e-9, 1e-7, 1e-6, 1e-4, 1e-2]) run(`collinear mid dy=${dy}`, [C([0, 0], 10), C([50, dy], 10), C([100, 0], 10)]);
console.log('--- touch boundary');
for (const g of [1e-4 - 1e-9, 1e-4, 1e-4 + 1e-9, 1.0001e-4]) run(`gap ${g}`, [C([0, 0], 10), C([20 + g, 0], 10)]);
for (const g of [1e-4 - 1e-9, 1e-4 + 1e-9]) run(`rect gap ${g}`, [Rc([0, 0], [10, 10]), Rc([10 + g, 0], [20, 10])]);
console.log('--- containment / boundary');
run('inner tangent', [C([0, 0], 10), C([5, 0], 5)]);
run('rect inside circle', [C([0, 0], 10), Rc([-2, -2], [2, 2])]);
run('equal circles same centre', [C([0, 0], 10), C([0, 0], 10)]);
console.log('--- offset/width limits');
const sq = [Pg([[0, 0], [10, 0], [10, 10], [0, 10]]), Pg([[30, 0], [40, 0], [40, 10], [30, 10]])];
for (const o of [0.005, 0.0099999, 0.01, 1e-6]) run(`polys offset ${o}`, sq, { offset: o });
for (const w of [0.0099999, 0.01]) run(`width ${w}`, [C([0, 0], 10), C([50, 0], 10)], { width: w });
run('width w/ offset 0 polygons', sq, { width: 1 });
console.log('--- coordinate limit');
run('edge at 9999.9999', [C([9979.9999, 0], 20), C([9900, 0], 10)]);
run('edge at 10000', [C([9980, 0], 20), C([9900, 0], 10)]);
run('edge at 10000+1e-9', [C([9980 + 1e-9, 0], 20), C([9900, 0], 10)]);
run('offset pushes beyond', [C([9970, 0], 20), C([9900, 0], 10)], { offset: 10.5 });
console.log('--- tiny arc collapse / tiny tangent');
run('tiny source r=0.01', [C([0, 0], 10), C([100, 0], 0.01)]);
run('tiny source r=0.02 near hull line', [C([0, 0], 10), C([100, 0], 10), C([50, 10.0000001], 0.02)]);
run('near-tangent rect corner', [C([0, 0], 10), C([100, 0], 10), Rc([45, 0], [55, 10 + 1e-7])]);
run('near-tangent rect corner 1e-5', [C([0, 0], 10), C([100, 0], 10), Rc([45, 0], [55, 10 + 1e-5])]);
run('near-tangent rect corner 1e-3', [C([0, 0], 10), C([100, 0], 10), Rc([45, 0], [55, 10 + 1e-3])]);

console.log('--- tag stability: a source winning twice, rotated round the big circle');
let prev: string | null = null;
for (let deg = 0; deg <= 360; deg += 15) {
  const a = deg * Math.PI / 180, p = (r: number, t: number): P => [r * Math.cos(t), r * Math.sin(t)];
  const res = run(`rot ${deg}`, [C([0, 0], 10), C(p(100, a), 1), C(p(100, a + Math.PI), 1)]);
  if (!res) continue;
  // which physical arc (by its middle direction relative to e2's direction) is _0
  const segs = res.r.outer, tags = res.r.tags.outer;
  const desc = tags.map((t, i) => { if (!/_\d$/.test(t)) return null; const s = segs[i], b = segs[(i + 1) % segs.length].start as P, c = (s as { center: P }).center, sa = Math.atan2((s.start as P)[1] - c[1], (s.start as P)[0] - c[0]), sb = Math.atan2(b[1] - c[1], b[0] - c[0]); let mid = (sa + ((sb - sa + 4 * Math.PI) % (2 * Math.PI)) / 2) - a; mid = ((mid % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return `${t}@${mid < Math.PI ? 'left-of-e2' : 'right-of-e2'}`; }).filter(Boolean).join(' ');
  if (prev !== null && prev !== desc) console.log('   !!! TAG MEANING CHANGED:', prev, '->', desc);
  prev = desc;
}

console.log('--- downstream reference to a band side when topology changes');
{
  const mk = (r3: number) => {
    const all = withIds([C([0, 0], 10), C([100, 0], 10), C([50, 30], r3)]), band = bandOver(all, [0, 1, 2]);
    return { kind: 'sketch', profile: 'band', band, construction: all, id: 'n0' };
  };
  const doc = (r3: number, edges: string[]) => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [mk(r3), { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }, ...(edges.length ? [{ kind: 'fillet', parent: { node: 1, side: 'solid' }, edges, radius: 1, id: 'n2' }] : [])], outputs: { b1: { node: edges.length ? 2 : 1, side: 'solid' } }, nextId: 3 }) as never;
  const r0 = await evaluateDoc(doc(5, []), 1);
  const names = r0.ok ? r0.bodies.flatMap(b => b.mesh.edges.flatMap(e => e.names)) : [];
  const e = names.find(n => /side\[b1_e3\]/.test(n) && /top/.test(n));
  console.log('edge picked', e, 'of', names.filter(n => /b1_e3/.test(n)).length);
  if (e) {
    const ok = await evaluateDoc(doc(5, [e]), 1); console.log('fillet on band arc (r3=5):', ok.ok ? 'ok' : JSON.stringify(ok.error).slice(0, 200));
    const ok2 = await evaluateDoc(doc(6, [e]), 1); console.log('after r3 5->6 (same topology):', ok2.ok ? 'ok' : JSON.stringify(ok2.error).slice(0, 200));
    // r3 small enough that e3 no longer reaches -> band refused
    const gone = await evaluateDoc(doc(0.5, [e]), 1); console.log('after r3 -> 0.5 (no tangent):', gone.ok ? 'ok (!!)' : JSON.stringify(gone.error).slice(0, 300));
  }
}
