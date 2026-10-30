// Fuzz: random fit sets + random handles. Accepted defs: check handle direction, joint tangency, fit drift,
// NaN, self-crossing, settle, evaluate (subset). Refused defs: is the generated geometry actually fine (false refusal)?
const M = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src';
import { splineOutline, splineEditError, splineShape, splineMatches, splineAutoHandles, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { arcOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/profile';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
type P2 = [number, number];
let seed = Number(process.argv[2] ?? 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
function tangent(pts: P2[], bulges: number[], closed: boolean, i: number, end: boolean): P2 {
  const n = pts.length, a = pts[i], b = pts[(i + 1) % n], bulge = bulges[i] ?? 0;
  if (!bulge) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
  const arc = arcOf(a, b, bulge), p = end ? b : a, sign = Math.sign(arc.sweep);
  return [-sign * (p[1] - arc.center[1]) / arc.radius, sign * (p[0] - arc.center[0]) / arc.radius];
}
const turn = (a: P2, b: P2) => Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
function maxTurn(pts: P2[], bulges: number[], closed: boolean, only?: (j: number) => boolean) {
  const n = pts.length; let w = 0, at = -1;
  for (let j = closed ? 0 : 1; j < (closed ? n : n - 1); j++) { if (only && !only(j)) continue; const t = turn(tangent(pts, bulges, closed, (j - 1 + n) % n, true), tangent(pts, bulges, closed, j, false)); if (t > w) { w = t; at = j; } }
  return [w, at];
}
function sample(pts: P2[], bulges: number[], closed: boolean): P2[][] { // per segment polylines
  const n = pts.length, segs: P2[][] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n], bu = bulges[i] ?? 0;
    if (!bu) { segs.push([a, b]); continue; }
    const arc = arcOf(a, b, bu), a0 = Math.atan2(a[1] - arc.center[1], a[0] - arc.center[0]), k = 24, s: P2[] = [];
    for (let q = 0; q <= k; q++) { const t = a0 + arc.sweep * q / k; s.push([arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t)]); }
    s[0] = a; s[k] = b; segs.push(s);
  }
  return segs;
}
function segX(p: P2, q: P2, r: P2, s: P2) { const d = (q[0]-p[0])*(s[1]-r[1]) - (q[1]-p[1])*(s[0]-r[0]); if (Math.abs(d) < 1e-14) return false; const t = ((r[0]-p[0])*(s[1]-r[1]) - (r[1]-p[1])*(s[0]-r[0]))/d, u = ((r[0]-p[0])*(q[1]-p[1]) - (r[1]-p[1])*(q[0]-p[0]))/d; return t > 1e-7 && t < 1-1e-7 && u > 1e-7 && u < 1-1e-7; }
function selfCross(pts: P2[], bulges: number[], closed: boolean) {
  const segs = sample(pts, bulges, closed), m = segs.length;
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
    const adj = j === i + 1 || (closed && i === 0 && j === m - 1);
    for (let a = 0; a + 1 < segs[i].length; a++) for (let b = 0; b + 1 < segs[j].length; b++) {
      if (adj && ((j === i + 1 && a === segs[i].length - 2 && b === 0) || (i === 0 && j === m - 1 && a === 0 && b === segs[j].length - 2))) continue;
      if (segX(segs[i][a], segs[i][a + 1], segs[j][b], segs[j][b + 1])) return [i, j];
    }
  }
  return null;
}
function maxSweep(pts: P2[], bulges: number[]) { let w = 0; bulges.forEach(b => { if (b) w = Math.max(w, 4 * Math.atan(Math.abs(b)) * 180 / Math.PI); }); return w; }
const N = Number(process.argv[3] ?? 3000), EVAL = Number(process.argv[4] ?? 150);
const stats: Record<string, number> = {}; const inc = (k: string) => stats[k] = (stats[k] ?? 0) + 1; const ex: Record<string, unknown> = {};
const note = (k: string, v: unknown) => { inc(k); if (!(k in ex)) ex[k] = v; };
let evals = 0;
for (let it = 0; it < N; it++) {
  const closed = rnd() < 0.6, n = (closed ? 3 : 2) + Math.floor(rnd() * 7);
  const MODE = process.argv[5] ?? 'random';
  const angs = Array.from({ length: n }, () => rnd() * 2 * Math.PI).sort((a, b) => a - b);
  const fit: P2[] = MODE === 'star' ? (closed ? angs.map(a => { const r = 20 + rnd() * 30; return [Math.round(r * Math.cos(a) * 1000) / 1000, Math.round(r * Math.sin(a) * 1000) / 1000] as P2; })
    : Array.from({ length: n }, (_, i) => [Math.round((i * 15 + rnd() * 10) * 1000) / 1000, Math.round((rnd() * 30 - 15) * 1000) / 1000] as P2))
    : Array.from({ length: n }, () => [Math.round((rnd() * 100 - 50) * 1000) / 1000, Math.round((rnd() * 100 - 50) * 1000) / 1000]);
  const auto = splineAutoHandles(fit, closed);
  const HM = process.argv[6] ?? 'mixed';
  const handles = HM === 'auto' ? fit.map((_, i) => rnd() < 0.4 ? auto[i] : null) : fit.map((_, i) => rnd() < 0.4 ? (rnd() < 0.5 ? Math.round(auto[i] + (rnd() * 120 - 60)) : Math.round(rnd() * 360 - 180)) : null);
  const def: SplineDef = { fit, closed, handles };
  const err = splineEditError(def), o = splineOutline(fit, closed, handles), pts = o.points as P2[], bl = o.bulges;
  const nan = pts.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1])) || bl.some(b => !Number.isFinite(b));
  const handleOk = handles.every((h, i) => { if (h == null) return true; if (!closed && i === n - 1) { const t = tangent(pts, bl, closed, 2 * i - 1, true); return turn(t, [Math.cos(h*Math.PI/180), Math.sin(h*Math.PI/180)]) <= 1e-9; } return turn(tangent(pts, bl, closed, 2 * i, false), [Math.cos(h*Math.PI/180), Math.sin(h*Math.PI/180)]) <= 1e-9; });
  const [mt, at] = maxTurn(pts, bl, closed);
  const cross = selfCross(pts, bl, closed);
  const drift = fit.some((p, i) => pts[2 * i][0] !== p[0] || pts[2 * i][1] !== p[1]);
  const count = pts.length === (closed ? 2 * n : 2 * n - 1);
  // auto-only def for comparison
  const ao = splineOutline(fit, closed), [amt] = maxTurn(ao.points as P2[], ao.bulges, closed), across = selfCross(ao.points as P2[], ao.bulges, closed);
  if (err === null) {
    inc('accepted');
    if (nan) note('acc_nan', def); if (!count) note('acc_count', def); if (drift) note('acc_drift', def);
    if (!handleOk) note('acc_handle_not_honoured', def);
    if (mt > 1e-9) { note('acc_kink', { def, mt, at }); if (amt <= 1e-9) note('acc_kink_auto_smooth', { def, mt, at }); }
    if (cross) { note('acc_selfcross', { def, cross }); if (!across) note('acc_selfcross_auto_clean', { def, cross }); }
    const sw = maxSweep(pts, bl); if (sw > 270) note('acc_sweep>270', { def, sw });
    if (closed && handles.some(h => h != null)) {
      const shape = splineShape(def), r = settleShape(shape, { ...shape, closed: false }), s = r.shape as any;
      if (r.error) note('acc_settle_error', { def, e: r.error });
      else {
        if (!s.spline) note('acc_settle_dropped_spline', def);
        const [smt] = maxTurn(s.points, s.bulges, true); if (smt > 1e-9) note('acc_settle_kink', { def, smt });
        if (s.spline && s.handles) {}
        if (evals < EVAL && !cross) {
          evals++;
          const pr = profileOf([s]);
          if ('error' in pr) note('acc_profile_error', { def, e: pr.error });
          else {
            const base = part('fz').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 10 }).doc;
            const doc = { ...base, nodes: base.nodes.map((x: any, i: number) => i === 0 ? { ...pr.node, id: x.id } : x) };
            let ok = false; try { const r2 = evaluateDoc(doc as any, 1); ok = r2.ok; if (!r2.ok) note('acc_eval_fail', { def, e: (r2 as any).error }); } catch (e) { note('acc_eval_throw', { def, e: String(e) }); }
            if (ok) inc('acc_eval_ok');
          }
        }
      }
    }
  } else {
    inc('refused');
    // false refusal: geometry would be fine (handles honoured, smooth, no new crossing)
    if (!nan && handleOk && mt <= 1e-9 && !(cross && !across)) note('ref_but_fine', { def, err, mt });
    if (/no smooth/.test(err) && !nan && handleOk && mt <= 1e-9) note('ref_nosmooth_but_smooth', { def });
  }
}
console.log(JSON.stringify(stats));
for (const [k, v] of Object.entries(ex)) console.log(k, JSON.stringify(v));
