import { draggedSpline } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/src/viewport/splineHandles';
import { respline, splineEditError, splineShape, splineMatches, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
type Poly = ReturnType<typeof splineShape>;
const close = (def: SplineDef) => { const s = splineShape(def); const r = settleShape(s, null); return r.shape as Poly; };
const stats = { tries: 0, editErr: 0, ok: 0, dropped: 0, refused: 0, changed: 0, examples: [] as unknown[] };
const bases: SplineDef[] = [
  { fit: [[0, 0], [40, 0], [40, 30], [0, 30]], closed: true },
  { fit: [[0, 0], [30, -10], [60, 0], [50, 30], [10, 35]], closed: true },
  { fit: Array.from({ length: 8 }, (_, i) => [Math.round(40 * Math.cos(i * Math.PI / 4)), Math.round(25 * Math.sin(i * Math.PI / 4))] as [number, number]), closed: true },
];
for (const base of bases) {
  let start = close(base);
  if (!start.spline) { console.log('base lost spline at close', JSON.stringify(base.fit)); continue; }
  console.log('base n', base.fit.length, 'tangents after close', JSON.stringify(start.tangents), 'matches', splineMatches(start));
  for (let t = 0; t < 400; t++) {
    const n = start.spline!.fit.length, i = Math.floor(rnd() * n), isFit = rnd() < 0.5;
    const f = start.spline!.fit[i];
    const p: [number, number] = isFit ? [f[0] + (rnd() - 0.5) * 30, f[1] + (rnd() - 0.5) * 30] : [f[0] + (rnd() - 0.5) * 20, f[1] + (rnd() - 0.5) * 20];
    const hit = isFit ? { kind: 'fit' as const, i } : { kind: 'handle' as const, i, sign: (rnd() < 0.5 ? 1 : -1) as 1 | -1 };
    const def = draggedSpline(start.spline!, hit, p, { fine: rnd() < 0.3 });
    stats.tries++;
    if (splineEditError(def)) { stats.editErr++; continue; }
    const next = respline(start, def), r = settleShape(next, start);
    const out = r.shape as Poly;
    if (r.error) { stats.refused++; if (stats.examples.length < 6) stats.examples.push({ kind: 'refused', err: r.error, fit: def.fit, handles: def.handles, tangents: start.tangents }); continue; }
    if (!out.spline) { stats.dropped++; if (stats.examples.length < 6) stats.examples.push({ kind: 'dropped', fit: def.fit, handles: def.handles, tangents: start.tangents }); start = close(base); continue; }
    if (JSON.stringify(out.points) !== JSON.stringify(next.points)) stats.changed++;
    stats.ok++; start = out; // chain drags like a user would
  }
}
console.log(JSON.stringify({ ...stats, examples: undefined }));
for (const e of stats.examples) console.log(JSON.stringify(e));
