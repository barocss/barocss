import { draggedSpline } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/src/viewport/splineHandles';
import { respline, splineEditError, splineShape, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
type Poly = ReturnType<typeof splineShape>;
const close = (def: SplineDef) => settleShape(splineShape(def), null).shape as Poly;
const bases: SplineDef[] = [
  { fit: [[0, 0], [40, 0], [40, 30], [0, 30]], closed: true },
  { fit: [[0, 0], [30, -10], [60, 0], [50, 30], [10, 35]], closed: true },
  { fit: [[0, 0], [40, 0], [40, 30], [0, 30]], closed: true, handles: [0, 90, 180, -90] },
];
const t0 = Date.now(); const res = { fitTries: 0, fitEditErr: 0, fitRefused: 0, fitDropped: 0, hTries: 0, hEditErr: 0, hRefused: 0, hDropped: 0 }; const ex: unknown[] = [];
for (const base of bases) {
  const start = close(base);
  for (let i = 0; i < base.fit.length; i++) {
    for (let x = -30; x <= 70; x += 2) for (let y = -30; y <= 60; y += 2) {
      const def = draggedSpline(start.spline!, { kind: 'fit', i }, [x, y]); res.fitTries++;
      if (splineEditError(def)) { res.fitEditErr++; continue; }
      const r = settleShape(respline(start, def), start);
      if (r.error) { res.fitRefused++; if (ex.length < 8) ex.push(['fit refused', r.error, def]); }
      else if (!(r.shape as Poly).spline) { res.fitDropped++; if (ex.length < 8) ex.push(['fit dropped', def]); }
    }
    for (let a = -179; a <= 180; a++) for (const sign of [1, -1] as const) {
      const f = start.spline!.fit[i], rad = a * Math.PI / 180;
      const def = draggedSpline(start.spline!, { kind: 'handle', i, sign }, [f[0] + 5 * Math.cos(rad), f[1] + 5 * Math.sin(rad)]); res.hTries++;
      if (splineEditError(def)) { res.hEditErr++; continue; }
      const r = settleShape(respline(start, def), start);
      if (r.error) { res.hRefused++; if (ex.length < 8) ex.push(['handle refused', r.error, def]); }
      else if (!(r.shape as Poly).spline) { res.hDropped++; if (ex.length < 8) ex.push(['handle dropped', def]); }
    }
  }
}
console.log(JSON.stringify(res), 'ms', Date.now() - t0);
for (const e of ex) console.log(JSON.stringify(e));
