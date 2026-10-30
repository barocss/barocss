// (b)-class oracle: affine parallelogram images (any degree, nonuniform knots/poles, separable rational weights, oblique frames,
// offsets, scales). The exact extension is the parallelogram run on by D along the edge's axis. Dense samples of the stored result
// are checked against plane, region bounds and the four boundary lines. Any ACCEPT with dev > 1e-7 is a (b) failure.
import { directOps, emptyDirect, geometryOf, importSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/src/engine/direct';
import { evaluateSurface, surfaceDomain, type Surface } from '@barocss/cad';
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const f = (x: number) => { const s = x.toFixed(12); return s.replace(/\.?0+$/, '') || '0'; };
type V = number[]; const sub = (a: V, b: V) => a.map((x, k) => x - b[k]), dot = (a: V, b: V) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: V, b: V) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], len = (a: V) => Math.hypot(a[0],a[1],a[2]);
function knots(deg: number, n: number, lo: number, hi: number, uniform: boolean) {
  const inner: number[] = []; for (let k = 1; k < n - deg; k++) inner.push(uniform ? k / (n - deg) : 0); 
  if (!uniform) { let acc = 0; const w = Array.from({ length: n - deg }, () => 0.1 + rnd() * 3), tot = w.reduce((a, b) => a + b); for (let k = 0; k < inner.length; k++) { acc += w[k]; inner[k] = acc / tot; } }
  return [...Array(deg + 1).fill(lo), ...inner.map(x => lo + (hi - lo) * x), ...Array(deg + 1).fill(hi)];
}
function monotone(n: number, warp: number) { const w = Array.from({ length: n - 1 }, () => 1 + warp * rnd() * 5), tot = w.reduce((a, b) => a + b); const out = [0]; let s = 0; for (const x of w) { s += x; out.push(s / tot); } out[n - 1] = 1; return out; }
const rows: string[] = [], fails: any[] = []; let worstAccepted = 0, accepts = 0, refusals = 0, other = 0;
for (let trial = 0; trial < 160; trial++) {
  const scale = [1e-3, 0.05, 1, 30, 800, 5000][trial % 6], off = [0, 0, 1e3, 1e5, 3e5][Math.floor(trial / 6) % 5];
  const du = 1 + (trial % 3), dv = 1 + (Math.floor(trial / 3) % 3), nu = du + 1 + (trial % 4), nv = dv + 1 + (Math.floor(trial / 4) % 3);
  const U = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5].map(x => x * scale * (1 + 3 * rnd())), W0 = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5].map(x => x * scale * (0.2 + rnd()));
  const O = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5].map(x => x * 2 * off);
  const rational = trial % 2 === 1, warp = trial % 5 / 2;
  const a = monotone(nu, warp), b = monotone(nv, warp), al = a.map(() => rational ? 0.3 + 2 * rnd() : 1), be = b.map(() => rational ? 0.3 + 2 * rnd() : 1);
  const [ul, uh] = [[0, 1], [2, 5], [-1e3, 1e3], [1e-4, 2e-4]][trial % 4], [vl, vh] = [[0, 1], [-3, 7], [0, 1e-3], [5, 900]][(trial >> 2) % 4];
  const KU = knots(du, nu, ul, uh, trial % 7 < 3), KV = knots(dv, nv, vl, vh, trial % 5 < 2);
  const P = a.map(s => b.map(t => [0, 1, 2].map(k => O[k] + s * U[k] + t * W0[k])));
  const src = `@model p { version:0; length-unit:mm; @surface #s { type:nurbs; degree-u:${du}; degree-v:${dv}; knots-u:[${KU.map(f)}]; knots-v:[${KV.map(f)}];
 control-points:[${P.map(r => `[${r.map(p => `[${p.map(f)}]`)}]`)}]; weights:[${al.map(x => `[${be.map(y => f(x * y))}]`)}]; } }`;
  let d; try { d = importSource(emptyDirect(), src, 'P'); } catch (e: any) { rows.push(`trial ${trial} IMPORT-FAIL ${e.message.slice(0, 80)}`); continue; }
  const id = d.objects[0].id, g0 = geometryOf(d, d.objects[0]) as Surface, dm0 = surfaceDomain(g0);
  const o = evaluateSurface(g0, dm0.u[0], dm0.v[0]), eu = sub(evaluateSurface(g0, dm0.u[1], dm0.v[0]), o), ev = sub(evaluateSurface(g0, dm0.u[0], dm0.v[1]), o);
  const nrm = cross(eu, ev), nl = len(nrm), nn = nrm.map(x => x / nl);
  // in-plane coordinates via the dual basis
  const g11 = dot(eu, eu), g12 = dot(eu, ev), g22 = dot(ev, ev), det = g11 * g22 - g12 * g12;
  const st = (p: V) => { const r = sub(p, o), x = dot(r, eu), y = dot(r, ev); return [(g22 * x - g12 * y) / det, (g11 * y - g12 * x) / det]; };
  for (const edge of ['u-max', 'u-min', 'v-max', 'v-min'] as const) for (const rf of [0.01, 0.3, 3]) {
    const D = rf * scale * 2;
    let out; try { out = directOps.extendSurface(d, id, edge, D); } catch (e: any) { if (e?.code === 'DIRECT_VALUE') refusals++; else { other++; rows.push(`trial ${trial} ${edge} D=${D} UNCODED ${e?.constructor?.name} ${e?.message}`); } continue; }
    accepts++;
    const g = geometryOf(out, out.objects.at(-1)!) as Surface, dm = surfaceDomain(g), Lu = len(eu), Lv = len(ev);
    const s0 = edge === 'u-min' ? -D / Lu : 0, s1 = edge === 'u-max' ? 1 + D / Lu : 1, t0 = edge === 'v-min' ? -D / Lv : 0, t1 = edge === 'v-max' ? 1 + D / Lv : 1;
    let plane = 0, bound = 0, outside = 0;
    const N = 60;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const p = evaluateSurface(g, i === N ? dm.u[1] : dm.u[0] + (dm.u[1] - dm.u[0]) * i / N, j === N ? dm.v[1] : dm.v[0] + (dm.v[1] - dm.v[0]) * j / N), [s, t] = st(p);
      plane = Math.max(plane, Math.abs(dot(sub(p, o), nn)));
      // distance outside the expected parallelogram (mm, along each axis)
      outside = Math.max(outside, (s0 - s) * Lu, (s - s1) * Lu, (t0 - t) * Lv, (t - t1) * Lv);
      if (i === 0) bound = Math.max(bound, Math.abs(s - s0) * Lu); if (i === N) bound = Math.max(bound, Math.abs(s - s1) * Lu);
      if (j === 0) bound = Math.max(bound, Math.abs(t - t0) * Lv); if (j === N) bound = Math.max(bound, Math.abs(t - t1) * Lv);
    }
    const dev = Math.max(plane, bound, outside); worstAccepted = Math.max(worstAccepted, dev);
    if (dev > 1e-8) rows.push(`trial ${trial} ${edge} D=${D.toPrecision(3)} scale=${scale} off=${off} deg=${du}x${dv} rational=${rational} dom=${JSON.stringify(dm)} plane=${plane.toExponential(2)} bound=${bound.toExponential(2)} outside=${outside.toExponential(2)} ${dev > 1e-7 ? 'FAIL>1e-7' : ''}`);
    if (dev > 1e-7) fails.push({ trial, edge, D, src, dev });
  }
}
console.log(rows.join('\n'));
(await import('node:fs')).writeFileSync('/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-compassionate-turing-e88276/0fddd342-b409-4074-aa06-d8dff804f568/scratchpad/audit/para-fails.json', JSON.stringify(fails, null, 1));
console.log(`accepts=${accepts} refusals=${refusals} uncoded=${other} worstAcceptedDev=${worstAccepted.toExponential(3)}`);
