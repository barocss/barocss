// D351 audit fuzz: closed/open spline fit sets -> settleShape -> checks. Built against worktree ("new") or base src.
import { splineOutline } from 'cadsrc/sketch/spline';
import { arcOf } from 'cadsrc/sketch/profile';
import { settleShape } from 'cadsrc/sketch/settle';
import { profileOf } from 'cadsrc/sketch/loops';
import { evaluateDoc } from 'cadsrc/engine/evaluate';
import { emptyDoc, withNode } from 'cadsrc/engine/doc';

type P2 = [number, number];
const LABEL = process.env.LABEL ?? '?';
const EVAL = process.env.EVAL !== '0';
let seed = Number(process.env.SEED ?? 12345);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const ri = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));

function tangent(pts: P2[], bul: number[], i: number, end: boolean): P2 {
  const n = pts.length, a = pts[i], b = pts[(i + 1) % n], bulge = bul[i] ?? 0;
  if (!bulge) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
  const arc = arcOf(a, b, bulge), p = end ? b : a, sign = Math.sign(arc.sweep);
  return [-sign * (p[1] - arc.center[1]) / arc.radius, sign * (p[0] - arc.center[0]) / arc.radius];
}
function maxTurn(pts: P2[], bul: number[], closed: boolean, onlyJoints?: Set<number>) {
  const n = pts.length; let worst = 0, at = -1;
  for (let j = closed ? 0 : 1; j < (closed ? n : n - 1); j++) {
    if (onlyJoints && !onlyJoints.has(j)) continue;
    // only joints where an arc is involved (line-line corners at fit points are real corners? spline never has them except collinear)
    const a = tangent(pts, bul, (j - 1 + n) % n, true), b = tangent(pts, bul, j, false);
    const t = Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
    if (t > worst) { worst = t; at = j; }
  }
  return { worst, at };
}

type Gen = { name: string; make: () => { fit: P2[]; closed: boolean } };
const grid = (v: number) => Math.round(v);
function star(k: number, R: number, cx: number, cy: number, onGrid: boolean, jitter = 0.35): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < k; i++) {
    const t = 2 * Math.PI * (i + rnd() * 0.6) / k, r = R * (1 - jitter + 2 * jitter * rnd());
    let p: P2 = [cx + r * Math.cos(t), cy + r * Math.sin(t)];
    if (onGrid) p = [grid(p[0]), grid(p[1])];
    out.push(p);
  }
  return out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]);
}
const gens: Gen[] = [
  { name: 'star-grid', make: () => ({ fit: star(ri(3, 40), ri(20, 200), ri(-100, 100), ri(-100, 100), true), closed: true }) },
  { name: 'star-offgrid', make: () => ({ fit: star(ri(3, 40), 20 + rnd() * 180, rnd() * 200 - 100, rnd() * 200 - 100, false), closed: true }) },
  { name: 'star-huge-near1e4', make: () => ({ fit: star(ri(3, 30), ri(50, 2000), (rnd() < 0.5 ? -1 : 1) * 9000, (rnd() < 0.5 ? -1 : 1) * 9000, true), closed: true }) },
  { name: 'star-huge-span', make: () => ({ fit: star(ri(3, 16), ri(4000, 9900), 0, 0, true), closed: true }) },
  { name: 'star-tiny', make: () => ({ fit: star(ri(3, 16), 0.002 + rnd() * 0.05, rnd() * 10, rnd() * 10, false), closed: true }) },
  { name: 'star-small-grid', make: () => ({ fit: star(ri(3, 10), ri(2, 6), 0, 0, true), closed: true }) },
  { name: 'random-grid', make: () => ({ fit: Array.from({ length: ri(3, 25) }, () => [ri(-50, 50), ri(-50, 50)] as P2), closed: true }) },
  { name: 'collinear-runs', make: () => {
    // rectangle-ish with points along straight sides (on grid)
    const w = ri(10, 100), h = ri(10, 100), m = ri(1, 4), fit: P2[] = [];
    for (let i = 0; i < m; i++) fit.push([Math.round(w * i / m), 0]);
    for (let i = 0; i < m; i++) fit.push([w, Math.round(h * i / m)]);
    for (let i = 0; i < m; i++) fit.push([Math.round(w - w * i / m), h]);
    for (let i = 0; i < m; i++) fit.push([0, Math.round(h - h * i / m)]);
    return { fit, closed: true };
  } },
  { name: 'collinear-mixed', make: () => {
    const fit = star(ri(4, 12), ri(30, 80), 0, 0, true);
    // insert a collinear triple after point 0
    const a = fit[0], b = fit[1]; const mid: P2 = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
    const mid2: P2 = [Math.round((2 * a[0] + b[0]) / 3), Math.round((2 * a[1] + b[1]) / 3)];
    fit.splice(1, 0, mid2, mid); return { fit, closed: true };
  } },
  { name: 'near-dup', make: () => {
    const fit = star(ri(4, 20), ri(20, 100), 0, 0, false); const i = ri(0, fit.length - 1), e = [1e-10, 1e-8, 1e-6, 1e-4, 1e-2][ri(0, 4)];
    fit.splice(i + 1, 0, [fit[i][0] + e, fit[i][1] + e * rnd()]); return { fit, closed: true };
  } },
  { name: 'open-grid', make: () => ({ fit: star(ri(3, 40), ri(20, 200), 0, 0, true), closed: false }) },
];

const N = Number(process.env.N ?? 40);
const stats: Record<string, Record<string, number>> = {};
const examples: Record<string, unknown[]> = {};
const ex = (k: string, v: unknown) => { (examples[k] ??= []).length < 2 && examples[k].push(v); };
let rev = 1;
for (const g of gens) {
  const st = stats[g.name] = { n: 0, error: 0, fitMoved: 0, maxFitMove: 0, turnBad: 0, maxTurn: 0, arcRel: 0, profileFail: 0, evalFail: 0, evalRun: 0, rawTurnBad: 0, changedBySettle: 0, tangentsAdded: 0 };
  for (let it = 0; it < N; it++) {
    const { fit, closed } = g.make();
    if (fit.length < 3) continue;
    st.n++;
    const o = splineOutline(fit, closed);
    const shape: any = { kind: 'polygon', points: o.points, bulges: o.bulges, closed, fromSpline: true };
    const raw = maxTurn(o.points, o.bulges, closed);
    if (raw.worst > 1e-9) { st.rawTurnBad++; ex(g.name + ':rawTurn', { fit, turn: raw.worst }); }
    const r = settleShape(shape, { ...shape, closed: false });
    if (r.error) { st.error++; ex(g.name + ':error', { fit, error: r.error }); }
    const out: any = r.shape;
    if (JSON.stringify(out.points) !== JSON.stringify(shape.points) || JSON.stringify(out.bulges) !== JSON.stringify(shape.bulges)) st.changedBySettle++;
    if (out.tangents?.length) st.tangentsAdded++;
    // dedupe fit as splineOutline does
    let moved = 0;
    for (const p of fit) {
      const exact = out.points.some((q: P2) => q[0] === p[0] && q[1] === p[1]);
      if (!exact) { const d = Math.min(...out.points.map((q: P2) => Math.hypot(q[0] - p[0], q[1] - p[1]))); moved = Math.max(moved, d); }
    }
    // near-dup points removed by splineOutline count as not moved if within 1e-9
    if (moved > 1e-9) { st.fitMoved++; st.maxFitMove = Math.max(st.maxFitMove, moved); ex(g.name + ':fitMoved', { fit, moved, eq: out.equalRadii, co: out.concentric, err: r.error }); }
    const t = maxTurn(out.points, out.bulges, closed);
    st.maxTurn = Math.max(st.maxTurn, t.worst);
    if (t.worst > 1e-9) { st.turnBad++; ex(g.name + ':turn', { fit, turn: t.worst, at: t.at, err: r.error }); }
    if ((out.equalRadii?.length ?? 0) + (out.concentric?.length ?? 0)) { st.arcRel++; ex(g.name + ':arcRel', { fit, eq: out.equalRadii?.length, co: out.concentric?.length }); }
    if (closed) {
      const pr = profileOf([out]);
      if (!('node' in pr)) { st.profileFail++; ex(g.name + ':profile', { fit, err: (pr as any).error }); }
      else if (EVAL) {
        let d = withNode(emptyDoc(), pr.node as any); d = withNode(d, { kind: 'extrude', sketch: 0, height: 5 } as any);
        st.evalRun++;
        try { const ev = evaluateDoc(d, rev++); if (!ev.ok) { st.evalFail++; ex(g.name + ':eval', { fit, err: (ev as any).error?.message ?? (ev as any).error }); } }
        catch (e) { st.evalFail++; ex(g.name + ':evalThrow', { fit, err: String(e).slice(0, 200) }); }
      }
    }
  }
}
console.log(LABEL, JSON.stringify(stats, null, 0).replace(/\},/g, '},\n'));
if (process.env.EX !== '0') console.log(JSON.stringify(examples, (k, v) => typeof v === 'number' ? +v.toPrecision(12) : v).slice(0, Number(process.env.EXLEN ?? 6000)));
