import { splineHandleGeometry } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/src/viewport/splineHandles';
import { splineShape, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { arcOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/profile';
type Poly = ReturnType<typeof splineShape>;
for (const [name, base] of [['square', { fit: [[0, 0], [40, 0], [40, 30], [0, 30]], closed: true }], ['pentagon', { fit: [[0, 0], [30, -10], [60, 0], [50, 30], [10, 35]], closed: true }]] as const)
for (const scale of [4, 2, 1]) {
  const P = (u: number, v: number) => [400 + scale * u, 300 - scale * v] as const;
  const s = settleShape(splineShape(base as SplineDef), null).shape as Poly, n = s.points.length;
  const chips: [number, number][] = [];
  for (let i = 0; i < n; i++) { const b = s.bulges?.[i] ?? 0; if (!b) continue; const a = arcOf(s.points[i] as any, s.points[(i + 1) % n] as any, b), t = a.start + a.sweep / 2, m = P(a.center[0] + a.radius * Math.cos(t), a.center[1] + a.radius * Math.sin(t)); chips.push([m[0], m[1] - 18]); }
  const inChip = (x: number, y: number) => chips.some(c => x >= c[0] - 26 && x <= c[0] + 26 && y >= c[1] - 11 && y <= c[1] + 11);
  const ends = splineHandleGeometry(s.spline!, P).flatMap(g => [g.fwd, g.back, g.c]);
  const covered = ends.map(e => { let k = 0, tot = 0; for (let dx = -8; dx <= 8; dx++) for (let dy = -8; dy <= 8; dy++) { if (dx * dx + dy * dy > 64) continue; tot++; if (inChip(e[0] + dx, e[1] + dy)) k++; } return k / tot; });
  console.log(name, 'scale', scale, 'R chips', chips.length, '| handle ends+fit points whose centre is under a chip:', ends.filter(e => inChip(e[0], e[1])).length, '/', ends.length, '| mean fraction of 8px pick disc under chips', (covered.reduce((a, b) => a + b, 0) / covered.length).toFixed(2));
}
