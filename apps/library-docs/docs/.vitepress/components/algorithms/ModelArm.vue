<script setup>
// Robot kinematics on two sample assemblies of packages/barocss-cad-model/samples/robots, seen from above (every joint
// axis is +Z, so the plane picture is exact).
// arm-2r: the joint tree has base~a at (20, 20) and a~b at (60, 20), both revolute about +Z; the tool point is b's far
//   hole, (100, 20) at the solved pose. Forward kinematics is the product of exponentials of src/robot/fk.ts. The
//   inverse solve is a 2D copy of src/robot/ik.ts `descend` in position mode (three rows in metres, the z row zero; λ
//   from 10⁻², halved on a kept step, × 4 on an undone one; Cholesky on J Jᵀ + λ² I). On this target it gives the same
//   answer as the package's solveIk: q = (−30°, 90°) in 7 iterations, no restart, σmin / σmax at the start 0.
// four-bar: base~crank at (20, 20), crank~coupler at (30, 37.32), base~rocker at (80, 20); the pin C kept out of the
//   tree as the loop closure, at (92.75, 68.35). The closure is a 2D copy of src/robot/loop.ts `closeLoop` (Gauss–Newton
//   on the pin's residual, steps capped at a quarter turn, from the previous solution); its per-degree solutions and
//   iteration counts equal the package's at every 45° checked (e.g. crank 90°: crank~coupler −84.646°, base~rocker
//   35.554°, 3 iterations).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const DEG = Math.PI / 180;
const rot = (p, c, q) => { const s = Math.sin(q), k = Math.cos(q), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + k * x - s * y, c[1] + s * x + k * y]; };

// ——— the 2R arm
const A1 = [20, 20], A2 = [60, 20], TIP = [100, 20], LIM = 150 * DEG;
/** exp([S₁] q₁) · exp([S₂] q₂) applied to the home points. */
function fk2(q) { return { o2: rot(A2, A1, q[0]), tip: rot(rot(TIP, A2, q[1]), A1, q[0]) }; }
const TARGET = fk2([60 * DEG, -90 * DEG]).tip;
/** One LM descent (ik.ts), position rows in metres; every iterate kept for the figure. */
function ikTrace(target, q0) {
  let q = [...q0], lam = 1e-2;
  const ev = x => { const f = fk2(x), e = [(target[0] - f.tip[0]) / 1000, (target[1] - f.tip[1]) / 1000, 0];
    return { e, n: Math.hypot(...e), J: [[-(f.tip[1] - A1[1]) / 1000, -(f.tip[1] - f.o2[1]) / 1000], [(f.tip[0] - A1[0]) / 1000, (f.tip[0] - f.o2[0]) / 1000], [0, 0]] }; };
  let cur = ev(q); const out = [{ q: [...q], err: cur.n }];
  for (let it = 0; it < 200 && cur.n > 1e-12; it++) {
    const M = [0, 1, 2].map(i => [0, 1, 2].map(j => (i === j ? lam * lam : 0) + cur.J[i][0] * cur.J[j][0] + cur.J[i][1] * cur.J[j][1]));
    const L = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], y = [...cur.e]; let ok = true;
    for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) { let v = M[i][j]; for (let m = 0; m < j; m++) v -= L[i][m] * L[j][m]; if (i === j) { if (!(v > 0)) ok = false; L[i][i] = Math.sqrt(Math.max(v, 1e-300)); } else L[i][j] = v / L[j][j]; }
    if (!ok) { lam *= 4; continue; }
    for (let i = 0; i < 3; i++) { let v = y[i]; for (let m = 0; m < i; m++) v -= L[i][m] * y[m]; y[i] = v / L[i][i]; }
    for (let i = 2; i >= 0; i--) { let v = y[i]; for (let m = i + 1; m < 3; m++) v -= L[m][i] * y[m]; y[i] = v / L[i][i]; }
    const dq = [0, 1].map(c => cur.J[0][c] * y[0] + cur.J[1][c] * y[1] + cur.J[2][c] * y[2]);
    const trial = q.map((v, c) => Math.min(LIM, Math.max(-LIM, v + dq[c]))), tr = ev(trial);
    if (tr.n < cur.n) { q = trial; cur = tr; lam = Math.max(lam / 2, 1e-12); out.push({ q: [...q], err: cur.n }); }
    else { lam *= 4; if (lam > 1e6) break; }
  }
  return out;
}
const IK = ikTrace(TARGET, [0, 0]);
const errMM = e => (e * 1000 < 1e-3 ? (e * 1000).toExponential(1) : (e * 1000).toFixed(e * 1000 < 1 ? 3 : 1));

// ——— the four-bar (a 20, b 70, c 50, d 60 mm; assembled at crank 60°)
const A = [20, 20], B0 = [30, 37.32050807568877], D = [80, 20], C0 = [92.74808522685123, 68.34755757066677];
function closeLoop(q1, from) {
  let q2 = from[0], q3 = from[1], res = Infinity, it = 0; const iters = [];
  for (; it < 60; it++) {
    const B = rot(B0, A, q1), pa = rot(rot(C0, B0, q2), A, q1), pb = rot(C0, D, q3), r = [pa[0] - pb[0], pa[1] - pb[1]];
    res = Math.hypot(...r); iters.push({ q2, q3, res });
    if (res <= 1e-12) break;
    // d r / d q: ω × (pin − joint point), + on the coupler's side, − on the rocker's.
    const c1 = [-(pa[1] - B[1]), pa[0] - B[0]], c2 = [pb[1] - D[1], -(pb[0] - D[0])];
    const a = c1[0] * c1[0] + c1[1] * c1[1], b = c1[0] * c2[0] + c1[1] * c2[1], d = c2[0] * c2[0] + c2[1] * c2[1];
    const g0 = c1[0] * r[0] + c1[1] * r[1], g1 = c2[0] * r[0] + c2[1] * r[1], det = a * d - b * b;
    if (!(Math.abs(det) > 1e-18 * Math.max(1, a * d))) break;
    const d0 = (d * g0 - b * g1) / det, d1 = (a * g1 - b * g0) / det, k = Math.min(1, (Math.PI / 4) / Math.max(Math.abs(d0), Math.abs(d1), 1e-300));
    q2 -= k * d0; q3 -= k * d1;
  }
  return { q2, q3, res, it, iters };
}
const JUMP = closeLoop(30 * DEG, [0, 0]);
const TURN = [{ q2: 0, q3: 0, it: 0 }];
for (let deg = 1, f = [0, 0]; deg <= 360; deg++) { const r = closeLoop(deg * DEG, f); f = [r.q2, r.q3]; TURN.push({ q2: r.q2, q3: r.q3, it: r.it }); }
const ITERS = [Math.min(...TURN.slice(1).map(x => x.it)), Math.max(...TURN.slice(1).map(x => x.it))];
function fourBar(q1, q2, q3) { const B = rot(B0, A, q1); return { B, pa: rot(rot(C0, B0, q2), A, q1), pb: rot(C0, D, q3) }; }
const branchOf = (B, pin) => { const la = [pin[0] - B[0], pin[1] - B[1]], lb = [pin[0] - D[0], pin[1] - D[1]]; return la[0] * lb[1] - la[1] * lb[0] >= 0 ? '+1' : '−1'; };

// ——— drawing
const ARM = { k: 2.4, x: 50, y: 212 }, BAR = { k: 2.65, x: 46, y: 238 };
const at = (m, p) => [m.x + m.k * p[0], m.y - m.k * p[1]];
/** A link as a plate round the segment P–Q, `ext` past each end, `hw` to each side (mm). */
function plate(m, P, Q, ext, hw) {
  const d = [Q[0] - P[0], Q[1] - P[1]], l = Math.hypot(...d) || 1, u = [d[0] / l, d[1] / l], n = [-u[1], u[0]];
  return [[-ext, hw], [l + ext, hw], [l + ext, -hw], [-ext, -hw]].map(([s, w]) => at(m, [P[0] + u[0] * s + n[0] * w, P[1] + u[1] * s + n[1] * w])).map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
}
/** A frame at P turned by θ: its x and y axes, 12 mm. */
function frame(m, P, th) { const o = at(m, P); return { o, x: at(m, [P[0] + 12 * Math.cos(th), P[1] + 12 * Math.sin(th)]), y: at(m, [P[0] - 12 * Math.sin(th), P[1] + 12 * Math.cos(th)]) }; }
const BASE_ARM = plate(ARM, [0, 20], [100, 20], 0, 20), BASE_BAR = [at(BAR, [0, 0]), at(BAR, [100, 40])];

const steps = [
  { label: 'Joints from the mates', text: 'Each pair of parts with mates between them becomes one joint. What it lets the child do is read from the mates\' first-order constraints, not from their names: each gives rows on the child\'s twist (ω, v), and the free twists are the rows\' null space. Concentric (4 rows) and coincident (3 rows) here leave one turn: a revolute joint, ±150° from the document\'s limits.', formula: 'rank 5 of 6 → one free twist → revolute &nbsp; (1 slide: prismatic · none: fixed)' },
  { label: 'Screws at the solved pose', text: 'Every joint value is 0 where the mates put the parts. A joint is kept as its axis and a point on it, there: S₁ through (20, 20), S₂ through (60, 20), both +Z. A turn by q about S is the rigid motion x ↦ R(q)(x − p) + p.', formula: 'exp([S] q): R = rotation by q about the axis, &nbsp; t = p − R p' },
  { label: 'First joint: q₁ = 60°', text: 'A link\'s motion is the product of the screws on its path from the base, base first. Turning q₁ moves everything after it: link a, and link b carried with it.', formula: 'D<sub>a</sub> = exp([S<sub>1</sub>] q<sub>1</sub>)' },
  { label: 'Second joint, then carried', text: 'Link b first turns by q₂ = −90° about S₂ where S₂ is at home (faint), then the whole is carried by the first joint\'s motion. Its pose is that motion times where the mates put it. The tool point lands at (74.6, 34.6).', formula: 'D<sub>b</sub> = exp([S<sub>1</sub>] q<sub>1</sub>) · exp([S<sub>2</sub>] q<sub>2</sub>), &nbsp; pose = D<sub>b</sub> · M<sub>b</sub>' },
  { label: 'Inverse: damped least squares', text: `Back to q = 0 and given only the target point. Each step solves (J Jᵀ + λ² I) y = e and moves Δq = Jᵀ y, J the Jacobian of the tool point. It is kept when the error falls (λ halves), undone when not (λ × 4). The arm starts stretched, where J has rank 1 (σmin = 0): the damping still gives a step. Error ${IK.slice(0, 5).map(x => errMM(x.err)).join(' → ')} … mm, reached in ${IK.length - 1} iterations at q = (−30°, 90°): the other elbow, the same point. Up to 15 seeds are tried; the best is kept.`, formula: 'Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ e &nbsp; reached: 10⁻⁴ m and 10⁻³ rad &nbsp; singular: σ<sub>min</sub>/σ<sub>max</sub> &lt; 10⁻⁴' },
  { label: 'A loop: one pin left out', text: `The four-bar's mates join coupler and rocker a second time. The tree keeps three joints (crank, coupler, rocker) and holds the fourth pin C as a closure: both parts must put it at the same place. Turn the crank by 30°: Gauss–Newton moves the two other joints until the coupler's C (filled) meets the rocker's (open). The gap ${JUMP.iters.slice(0, 5).map(x => x.res.toPrecision(3)).join(' → ')} … mm closes in ${JUMP.it} steps.`, formula: 'r = D<sub>coupler</sub> C − D<sub>rocker</sub> C, &nbsp; Δ = (Jᵀ J)⁻¹ Jᵀ r, &nbsp; each step at most a quarter turn' },
  { label: 'Following the branch', text: `Driven a degree at a time, each closure starts from the last (${ITERS[0]}–${ITERS[1]} steps each), so the linkage stays on the branch it was assembled in: the sign of the turn between the two levers meeting at C. A closure on the other branch is refused (BRANCH_FLIP); a crank angle where the loop cannot close is refused (NO_CLOSURE). The test checks the rocker against Freudenstein's equation to 10⁻⁹ rad through a full turn.`, formula: 'branch = sign( z · (C − B) × (C − D) ) = +1, kept' },
];
const s = useSteps(steps.length, [3200, 2600, 2400, 3200, 5200, 4600, 7000], root);
const k = computed(() => ease(s.t.value));

const q = computed(() => {
  const n = s.step.value, u = k.value;
  if (n <= 1) return [0, 0];
  if (n === 2) return [60 * DEG * u, 0];
  if (n === 3) return [60 * DEG, -90 * DEG * u];
  const f = u * (IK.length - 1), i = Math.min(IK.length - 2, Math.floor(f)), w = f - i;
  return [0, 1].map(c => IK[i].q[c] + (IK[i + 1].q[c] - IK[i].q[c]) * w);
});
const ikNow = computed(() => IK[Math.min(IK.length - 1, Math.round(k.value * (IK.length - 1)))]);
const arm = computed(() => {
  const [q1, q2] = q.value, f = fk2(q.value);
  return { a: plate(ARM, A1, f.o2, 10, 10), b: plate(ARM, f.o2, f.tip, 10, 10), o2: at(ARM, f.o2), tip: at(ARM, f.tip), f0: frame(ARM, A1, 0), f1: frame(ARM, f.o2, q1), f2: frame(ARM, f.tip, q1 + q2) };
});
// Step 4's faint b: turned about S₂ at home, before being carried.
const homeTurned = computed(() => (s.step.value === 3 ? plate(ARM, A2, rot(TIP, A2, q.value[1]), 10, 10) : null));
const isArm = computed(() => s.step.value <= 4);

const bar = computed(() => {
  const n = s.step.value;
  let q1 = 0, q2 = 0, q3 = 0;
  if (n === 5) {
    // the 30° turn in the first third, then the iterates
    const t = s.t.value, turn = ease(Math.min(1, t / 0.3)); q1 = 30 * DEG * turn;
    if (t > 0.35) { const f = Math.min(1, (t - 0.35) / 0.55) * (JUMP.iters.length - 1), i = Math.min(JUMP.iters.length - 2, Math.floor(f)), w = f - i; q2 = JUMP.iters[i].q2 + (JUMP.iters[i + 1].q2 - JUMP.iters[i].q2) * w; q3 = JUMP.iters[i].q3 + (JUMP.iters[i + 1].q3 - JUMP.iters[i].q3) * w; }
  } else if (n === 6) {
    // (whole degrees, each one's closure as solved above: nothing interpolated, so the pin stays shared)
    const i = Math.min(360, Math.round(s.t.value * 360)); q1 = i * DEG; q2 = TURN[i].q2; q3 = TURN[i].q3;
  }
  const g = fourBar(q1, q2, q3), gap = Math.hypot(g.pa[0] - g.pb[0], g.pa[1] - g.pb[1]);
  return { q1, q2, q3, gap, branch: branchOf(g.B, g.pa), crank: plate(BAR, A, g.B, 5, 5), coupler: plate(BAR, g.B, g.pa, 5, 5), rocker: plate(BAR, D, g.pb, 5, 5), B: at(BAR, g.B), pa: at(BAR, g.pa), pb: at(BAR, g.pb) };
});
// The rocker's pin through the full turn, drawn as it goes.
const trace = computed(() => {
  if (s.step.value !== 6) return '';
  const n = Math.max(1, Math.round(s.t.value * 360));
  return TURN.slice(0, n + 1).map((x, i) => at(BAR, fourBar(i * DEG, x.q2, x.q3).pb)).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
});
const deg = v => Math.round(v / DEG);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Kinematics: screws multiplied link by link, and a loop closed" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A two-link arm turning joint by joint and solved for a target point, then a four-bar linkage closing its loop as the crank turns">
        <g v-if="isArm">
          <polygon :points="BASE_ARM" class="base" />
          <polygon v-if="homeTurned" :points="homeTurned" class="faint" />
          <polygon :points="arm.a" class="link a" />
          <polygon :points="arm.b" class="link b" />
          <g v-for="(f, i) in [arm.f0, arm.f1, arm.f2]" :key="'f' + i" :style="{ opacity: s.step.value >= 2 ? 1 : 0.35 }">
            <line :x1="f.o[0]" :y1="f.o[1]" :x2="f.x[0]" :y2="f.x[1]" class="fx" /><line :x1="f.o[0]" :y1="f.o[1]" :x2="f.y[0]" :y2="f.y[1]" class="fy" />
          </g>
          <circle :cx="at(ARM, A1)[0]" :cy="at(ARM, A1)[1]" r="5" class="joint" />
          <circle :cx="arm.o2[0]" :cy="arm.o2[1]" r="5" class="joint" />
          <circle :cx="arm.tip[0]" :cy="arm.tip[1]" r="3.2" class="tip" />
          <text :x="at(ARM, A1)[0] - 8" :y="at(ARM, A1)[1] + 18" class="tag" text-anchor="end">S₁</text>
          <text :x="arm.o2[0] + 8" :y="arm.o2[1] + 18" class="tag">S₂</text>
          <g v-if="s.step.value === 4">
            <line :x1="at(ARM, TARGET)[0] - 7" :y1="at(ARM, TARGET)[1]" :x2="at(ARM, TARGET)[0] + 7" :y2="at(ARM, TARGET)[1]" class="target" />
            <line :x1="at(ARM, TARGET)[0]" :y1="at(ARM, TARGET)[1] - 7" :x2="at(ARM, TARGET)[0]" :y2="at(ARM, TARGET)[1] + 7" class="target" />
            <text x="366" y="56" class="read" text-anchor="end">error {{ errMM(ikNow.err) }} mm</text>
          </g>
          <text x="14" y="20" class="read">q₁ = {{ deg(q[0]) }}° &nbsp; q₂ = {{ deg(q[1]) }}°</text>
          <text x="14" y="36" class="read dim">tool point ({{ fk2(q).tip.map(v => v.toFixed(1)).join(', ') }})</text>
          <text x="366" y="20" class="name" text-anchor="end">arm-2r</text>
        </g>
        <g v-else>
          <rect :x="BASE_BAR[0][0]" :y="BASE_BAR[1][1]" :width="BASE_BAR[1][0] - BASE_BAR[0][0]" :height="BASE_BAR[0][1] - BASE_BAR[1][1]" class="base" />
          <polyline v-if="trace" :points="trace" class="trace" />
          <polygon :points="bar.crank" class="link a" />
          <polygon :points="bar.rocker" class="link b" />
          <polygon :points="bar.coupler" class="link c" />
          <circle :cx="at(BAR, A)[0]" :cy="at(BAR, A)[1]" r="4" class="joint" /><circle :cx="at(BAR, D)[0]" :cy="at(BAR, D)[1]" r="4" class="joint" />
          <circle :cx="bar.B[0]" :cy="bar.B[1]" r="4" class="joint" />
          <line v-if="bar.gap > 0.05" :x1="bar.pa[0]" :y1="bar.pa[1]" :x2="bar.pb[0]" :y2="bar.pb[1]" class="gap" />
          <circle :cx="bar.pb[0]" :cy="bar.pb[1]" r="5" class="pin-b" />
          <circle :cx="bar.pa[0]" :cy="bar.pa[1]" r="3" class="pin-a" />
          <text :x="at(BAR, A)[0] - 6" :y="at(BAR, A)[1] + 18" class="tag" text-anchor="end">crank</text>
          <text :x="at(BAR, D)[0] + 8" :y="at(BAR, D)[1] + 18" class="tag">rocker</text>
          <text :x="bar.pb[0] + 9" :y="bar.pb[1] - 6" class="tag">C</text>
          <text x="14" y="20" class="read">crank {{ deg(bar.q1) }}° &nbsp; coupler {{ deg(bar.q2) }}° &nbsp; rocker {{ deg(bar.q3) }}°</text>
          <text x="14" y="36" class="read dim">C apart {{ bar.gap < 1e-9 ? '0' : bar.gap.toPrecision(3) }} mm · branch {{ bar.branch }}</text>
          <text x="366" y="20" class="name" text-anchor="end">four-bar</text>
        </g>
      </svg>
      <template #note>Both run in the page with 2D copies of the package's code (all axes here are +Z, so nothing is lost);
        their results equal the package's on these samples. The links are drawn as plates round their pins; the joint
        values are each joint's own turn from the solved pose.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.base { fill: var(--vp-c-divider); fill-opacity: 0.6; stroke: var(--vp-c-text-3); stroke-width: 1; }
.link { fill-opacity: 0.22; stroke-width: 1.4; stroke-linejoin: round; }
.link.a { fill: var(--a); stroke: var(--a); } .link.b { fill: var(--b); stroke: var(--b); } .link.c { fill: var(--keep); stroke: var(--keep); }
.faint { fill: none; stroke: var(--b); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.7; }
.joint { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.tip { fill: var(--vp-c-text-1); }
.fx { stroke: var(--hot); stroke-width: 1.6; } .fy { stroke: var(--keep); stroke-width: 1.6; }
.target { stroke: var(--hot); stroke-width: 2; }
.trace { fill: none; stroke: var(--b); stroke-width: 1.2; stroke-dasharray: 2 2; }
.gap { stroke: var(--hot); stroke-width: 1.6; stroke-dasharray: 3 2; }
.pin-b { fill: var(--vp-c-bg); stroke: var(--b); stroke-width: 1.8; }
.pin-a { fill: var(--keep); }
.tag { font-size: 10px; fill: var(--vp-c-text-2); }
.read { fill: var(--vp-c-text-1); font-weight: 600; } .read.dim { font-weight: 400; fill: var(--vp-c-text-2); }
.name { font-weight: 700; font-size: 11px; fill: var(--vp-c-text-3); }
</style>
