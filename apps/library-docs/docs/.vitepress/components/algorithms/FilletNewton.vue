<script setup>
// One rolling-ball station solved as packages/barocss-cad/src/blend/rolling-ball.ts (solveStation) solves it: four
// unknowns (each contact's surface parameters), F = (c_A − c_B, (c_A − X)·t), a Jacobian by central differences, a 4 × 4
// solve by partial pivoting, the step halved until |F| falls. Run in the page on the pipe tee (tube radius 10 along x,
// branch radius 5 up z, r = 2) at the station 50° round the branch, seeded as a chain's first station is.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const RA = 10, RB = 5, R = 2, SIGMA = 1, SIZE = 60;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), unit = a => sc(a, 1 / len(a)), norm = f => Math.hypot(...f);
const SA = (th, x) => [x, RA * Math.cos(th), RA * Math.sin(th)], nA = th => [0, Math.cos(th), Math.sin(th)];
const SB = (ph, z) => [RB * Math.cos(ph), RB * Math.sin(ph), z], nB = ph => [Math.cos(ph), Math.sin(ph), 0];
const PSI = 50 * Math.PI / 180;
const X = (() => { const s = Math.sin(PSI); return [RB * Math.cos(PSI), RB * s, Math.sqrt(RA * RA - RB * RB * s * s)]; })();
const T = unit([-RB * Math.sin(PSI), RB * Math.cos(PSI), -RB * RB * Math.sin(PSI) * Math.cos(PSI) / X[2]]);
const HS = [1e-5 * 2 * Math.PI, 1e-5 * 60, 1e-5 * 2 * Math.PI, 1e-5 * 25];
const centres = q => [add(SA(q[0], q[1]), sc(nA(q[0]), SIGMA * R)), add(SB(q[2], q[3]), sc(nB(q[2]), SIGMA * R))];
function residual(q) { const [ca, cb] = centres(q); return [ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2], dot(sub(ca, X), T)]; }
function solve4(M, b) {
  const a = M.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < 4; k++) {
    let p = k; for (let i = k + 1; i < 4; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    if (!(Math.abs(a[p][k]) > 1e-300)) return null;
    [a[k], a[p]] = [a[p], a[k]];
    for (let i = k + 1; i < 4; i++) { const f = a[i][k] / a[k][k]; for (let j = k; j < 5; j++) a[i][j] -= f * a[k][j]; }
  }
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) { let s = a[i][4]; for (let j = i + 1; j < 4; j++) s -= a[i][j] * x[j]; x[i] = s / a[i][i]; }
  return x;
}
// The seeds: X + back·w on each face, back = r / tan(α/2), w square to the edge into the face.
const thX = Math.atan2(X[2], X[1]), phX = Math.atan2(X[1], X[0]);
let wA = unit(cross(T, nA(thX))); if (dot(wA, nB(phX)) < 0) wA = sc(wA, -1);
let wB = unit(cross(T, nB(phX))); if (dot(wB, nA(thX)) < 0) wB = sc(wB, -1);
const ALPHA = Math.acos(dot(wA, wB)), BACK = R / Math.tan(ALPHA / 2);
const gA = add(X, sc(wA, BACK)), gB = add(X, sc(wB, BACK));
const seed = [Math.atan2(gA[2], gA[1]), gA[0], Math.atan2(gB[1], gB[0]), gB[2]];
// The iterates.
const its = [];
{
  let q = seed.slice(), f = residual(q);
  its.push({ q, f: norm(f), lam: 1 });
  for (let it = 0; it < 40 && norm(f) > 1e-12 * SIZE; it++) {
    const J = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    for (let k = 0; k < 4; k++) {
      const qp = q.slice(), qm = q.slice(); qp[k] += HS[k]; qm[k] -= HS[k];
      const fp = residual(qp), fm = residual(qm);
      for (let i = 0; i < 4; i++) J[i][k] = (fp[i] - fm[i]) / (qp[k] - qm[k]);
    }
    const step = solve4(J, f.map(x => -x)); if (!step) break;
    let lam = 1, next = q, fn = f;
    for (let k = 0; k < 20; k++) { next = q.map((x, i) => x + lam * step[i]); fn = residual(next); if (norm(fn) < norm(f)) break; lam /= 2; }
    if (!(norm(fn) < norm(f))) break;
    q = next; f = fn; its.push({ q, f: norm(f), lam });
  }
}
const last = its.at(-1), [cFinal] = centres(last.q);
// The view: the station's plane seen along t, X at the origin, "up" the part of z square to t.
const E2 = unit(sub([0, 0, 1], sc(T, T[2]))), E1 = cross(E2, T);
const to2 = p => { const d = sub(p, X); return [dot(d, E1), dot(d, E2)]; };
const mid2 = to2(sc(add(X, cFinal), 0.5)), SM = 30;
const V = p => { const q = to2(p); return [113 + SM * (q[0] - mid2[0]), 128 - SM * (q[1] - mid2[1])]; };
const poly = ps => ps.map(V).map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
// The faces where the station's plane cuts them: the tube at each θ, the branch at each φ.
const sliceA = Array.from({ length: 121 }, (_, i) => { const th = thX - 0.35 + 0.7 * i / 120; return SA(th, (dot(X, T) - RA * (Math.cos(th) * T[1] + Math.sin(th) * T[2])) / T[0]); });
const sliceB = Array.from({ length: 121 }, (_, i) => { const ph = phX - 0.25 + 0.5 * i / 120; return SB(ph, (dot(X, T) - RB * (Math.cos(ph) * T[0] + Math.sin(ph) * T[1])) / T[2]); });
// Each slice: the face (from X along w, into it) and its surface carried on past the edge (where the other solid is).
const part = (ps, w, face) => ps.filter(p => (dot(sub(p, X), w) >= 0) === face);
const faceA = part(sliceA, wA, true), pastA = part(sliceA, wA, false), faceB = part(sliceB, wB, true), pastB = part(sliceB, wB, false);
const nearestTo = (ps, y) => ps.reduce((b, p) => (len(sub(p, y)) < len(sub(b, y)) ? p : b));
const labelA = nearestTo(faceA, add(X, sc(wA, 3.2))), labelB = nearestTo(faceB, add(X, sc(wB, 3.2)));
const ballRing = Array.from({ length: 73 }, (_, i) => add(cFinal, add(sc(E1, R * Math.cos(i * Math.PI / 36)), sc(E2, R * Math.sin(i * Math.PI / 36)))));
// The magnified view about the final centre (× 8).
const ZOOM = 8, IN = { x: 238, y: 16, w: 134, h: 116 };
const VZ = p => { const q = to2(p), c = to2(cFinal); return [IN.x + IN.w / 2 + SM * ZOOM * (q[0] - c[0]), IN.y + IN.h / 2 - SM * ZOOM * (q[1] - c[1])]; };
const clampIn = v => [Math.max(IN.x + 4, Math.min(IN.x + IN.w - 4, v[0])), Math.max(IN.y + 4, Math.min(IN.y + IN.h - 4, v[1]))];
// The chart: log₁₀ |F| per iterate, 0 down to −16.
const CH = { x: 250, y: 158, w: 118, h: 80 };
const yLog = v => CH.y + CH.h * Math.min(16, Math.max(0, -Math.log10(Math.max(v, 1e-16)))) / 16;
const TOL = 1e-12 * SIZE;
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** x as "a × 10ⁿ" with one decimal. */
const sci = (x, d = 1) => { const [m, e] = x.toExponential(d).split('e'); return `${m} × 10${[...String(+e)].map(c => SUP[c]).join('')}`; };

const steps = [
  { label: 'Four unknowns, from seeds', text: `Each contact is a point of its face, given by the face's own two parameters: (θ, x) on the tube, (φ, z) on the branch. A chain's first station is seeded at X + back · w on each face (w square to the edge, into the face), where a ball would touch two planes at the faces' angle: here α = ${num(ALPHA * 180 / Math.PI, 2)}°, back = ${num(BACK, 3)} mm. Later stations start from the one before.`, formula: `q = (θ, x, φ, z) &nbsp;&nbsp; back = r / tan(α/2) = ${num(BACK, 3)} mm` },
  { label: 'Two candidate centres', text: `From each contact, r along its outward normal (σ = +1: outside, the edge is concave) gives a candidate centre, c<sub>A</sub> and c<sub>B</sub>. The residual F is their difference and c<sub>A</sub>'s distance off the station's plane. At the seeds, |F| = ${num(its[0].f, 3)} mm.`, formula: 'c<sub>A</sub> = S<sub>A</sub> + σ r n<sub>A</sub> &nbsp; c<sub>B</sub> = S<sub>B</sub> + σ r n<sub>B</sub> &nbsp;&nbsp; F(q) = (c<sub>A</sub> − c<sub>B</sub>, (c<sub>A</sub> − X) · t)' },
  { label: 'Linearise', text: 'Each column of the Jacobian is a central difference in one parameter, of 10 × 10⁻⁶ of its range (one-sided where a domain ends). The Newton step solves the 4 × 4 linear system by Gaussian elimination with partial pivoting; a singular system ends the solve with no ball.', formula: 'J<sub>ik</sub> = (F<sub>i</sub>(q + h e<sub>k</sub>) − F<sub>i</sub>(q − h e<sub>k</sub>)) / 2h &nbsp;&nbsp; J Δ = −F' },
  { label: 'Step, halve if worse, repeat', text: `The full step is tried first and halved, up to 20 times, until |F| falls. Here every full step is taken: |F| goes ${its.map(x => sci(x.f)).join(' → ')} mm. The correct digits double each time: Newton's quadratic convergence.`, formula: 'q ← q + λ Δ, &nbsp; λ = 1, ½, ¼, … until |F(q + λ Δ)| &lt; |F(q)| &nbsp; (at most 40 iterations)' },
  { label: 'Converged: the ball', text: `The solve stops at |F| ≤ 10⁻¹² × the model's size (${sci(TOL, 0)} mm here, size 60) and is accepted at ≤ 10⁻⁹ × size; otherwise the station has no ball on this pair of faces. The ball about c<sub>A</sub> touches both faces; its two contacts are the station's.`, formula: '|F| ≤ 10⁻¹² s: stop &nbsp;&nbsp; |F| ≤ 10⁻⁹ s: a ball, c = c<sub>A</sub> &nbsp;&nbsp; else none' },
];
const s = useSteps(steps.length, [2600, 2600, 2400, 5200, 2600], root);
const k = computed(() => ease(s.t.value));
// The iterate drawn: the seed until step 4, then through the iterates, then the last.
const at = computed(() => {
  if (s.step.value < 3) return { u: 0, i: 0, f: 0 };
  if (s.step.value > 3) return { u: its.length - 1, i: its.length - 2, f: 1 };
  const u = s.t.value * (its.length - 1), i = Math.min(its.length - 2, Math.floor(u)); return { u, i, f: ease(Math.min(1, u - i)) };
});
const lerp = (a, b, f) => a.map((v, j) => v + (b[j] - v) * f);
const q = computed(() => { const { i, f } = at.value; return its.length > 1 ? lerp(its[i].q, its[i + 1].q, f) : its[0].q; });
const draw = computed(() => { const [ca, cb] = centres(q.value); return { pA: SA(q.value[0], q.value[1]), pB: SB(q.value[2], q.value[3]), ca, cb }; });
const barsShown = computed(() => (s.step.value < 1 ? 0 : s.step.value < 3 ? 1 : s.step.value > 3 ? its.length : Math.min(its.length, Math.floor(at.value.u + 1e-9) + 1)));
const barX = i => CH.x + 8 + i * ((CH.w - 16) / Math.max(1, its.length - 1));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="One station: Newton on the contacts' parameters" :steps="steps" :s="s">
      <svg viewBox="0 0 380 260" role="img" aria-label="A station's plane seen along the chain: the two faces, the seeded contacts and candidate centres moving together under Newton's iterations, and the residual falling">
        <defs><clipPath id="fillet-newton-view"><rect x="0" y="0" width="228" height="260" /></clipPath></defs>
        <g clip-path="url(#fillet-newton-view)">
          <polyline :points="poly(pastA)" class="past a" /><polyline :points="poly(pastB)" class="past b" />
          <polyline :points="poly(faceA)" class="face a" />
          <polyline :points="poly(faceB)" class="face b" />
          <polyline v-if="s.step.value === 4" :points="poly(ballRing)" class="ball" :style="{ opacity: k }" />
          <g v-if="s.step.value === 0" :style="{ opacity: k }">
            <line :x1="V(X)[0]" :y1="V(X)[1]" :x2="V(gA)[0]" :y2="V(gA)[1]" class="w" /><line :x1="V(X)[0]" :y1="V(X)[1]" :x2="V(gB)[0]" :y2="V(gB)[1]" class="w" />
          </g>
          <g v-if="s.step.value >= 1" :style="{ opacity: s.step.value === 1 ? k : 1 }">
            <line :x1="V(draw.pA)[0]" :y1="V(draw.pA)[1]" :x2="V(draw.ca)[0]" :y2="V(draw.ca)[1]" class="normal a" />
            <line :x1="V(draw.pB)[0]" :y1="V(draw.pB)[1]" :x2="V(draw.cb)[0]" :y2="V(draw.cb)[1]" class="normal b" />
            <circle :cx="V(draw.ca)[0]" :cy="V(draw.ca)[1]" r="3" class="cand a" /><circle :cx="V(draw.cb)[0]" :cy="V(draw.cb)[1]" r="3" class="cand b" />
          </g>
          <circle :cx="V(draw.pA)[0]" :cy="V(draw.pA)[1]" r="3.4" class="contact a" />
          <circle :cx="V(draw.pB)[0]" :cy="V(draw.pB)[1]" r="3.4" class="contact b" />
          <circle :cx="V(X)[0]" :cy="V(X)[1]" r="3.2" class="edge" />
          <text :x="V(X)[0] - 14" :y="V(X)[1] + 14" class="tag x">X</text>
          <text :x="V(labelA)[0] - 12" :y="V(labelA)[1] + 18" class="name a">tube</text>
          <text :x="V(labelB)[0] + 8" :y="V(labelB)[1] + 4" class="name b">branch</text>
        </g>
        <line x1="230" y1="12" x2="230" y2="248" class="split" />
        <rect :x="IN.x" :y="IN.y" :width="IN.w" :height="IN.h" rx="5" class="inset" />
        <text :x="IN.x + 6" :y="IN.y + 14" class="small">near the centre, × 8</text>
        <g v-if="s.step.value >= 1">
          <line :x1="clampIn(VZ(draw.ca))[0]" :y1="clampIn(VZ(draw.ca))[1]" :x2="clampIn(VZ(draw.cb))[0]" :y2="clampIn(VZ(draw.cb))[1]" class="gap" />
          <circle :cx="clampIn(VZ(draw.ca))[0]" :cy="clampIn(VZ(draw.ca))[1]" r="3.4" class="cand a" />
          <circle :cx="clampIn(VZ(draw.cb))[0]" :cy="clampIn(VZ(draw.cb))[1]" r="3.4" class="cand b" />
          <text :x="IN.x + 6" :y="IN.y + IN.h - 8" class="small">|c<tspan baseline-shift="sub" font-size="8">A</tspan> − c<tspan baseline-shift="sub" font-size="8">B</tspan>| = {{ num(len(sub(draw.ca, draw.cb)) * 1000, 3) }} µm</text>
        </g>
        <g>
          <line :x1="CH.x" :y1="CH.y" :x2="CH.x" :y2="CH.y + CH.h" class="axis" />
          <line :x1="CH.x" :y1="CH.y + CH.h" :x2="CH.x + CH.w" :y2="CH.y + CH.h" class="axis" />
          <text v-for="e in [0, 8, 16]" :key="'e' + e" :x="CH.x - 4" :y="CH.y + CH.h * e / 16 + 3.5" class="small end">10<tspan baseline-shift="super" font-size="7">{{ e ? '−' + e : '0' }}</tspan></text>
          <line :x1="CH.x" :y1="yLog(TOL)" :x2="CH.x + CH.w" :y2="yLog(TOL)" class="tol" />
          <text :x="CH.x + CH.w" :y="yLog(TOL) - 3" class="small end hot">stop</text>
          <line v-for="(it, i) in its.slice(0, barsShown)" :key="'b' + i" :x1="barX(i)" :y1="CH.y + CH.h" :x2="barX(i)" :y2="yLog(it.f)" class="bar" />
          <circle v-for="(it, i) in its.slice(0, barsShown)" :key="'d' + i" :cx="barX(i)" :cy="yLog(it.f)" r="3" class="dot" />
          <text v-for="(it, i) in its" :key="'n' + i" :x="barX(i)" :y="CH.y + CH.h + 12" class="small mid">{{ i }}</text>
          <text :x="CH.x" :y="CH.y - 6" class="small">|F| per iteration</text>
        </g>
      </svg>
      <template #note>Computed in the page with the kernel's station solve on the pipe tee (surfaces written by angle and
        height; the kernel's are NURBS patches, so its iterates differ in detail). The station's plane is seen along the
        chain's tangent; the contacts and candidate centres are drawn where they project onto it.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.face { fill: none; stroke-width: 2; } .face.a { stroke: var(--a); } .face.b { stroke: var(--b); }
.past { fill: none; stroke-width: 1; stroke-dasharray: 2 3; opacity: 0.6; } .past.a { stroke: var(--a); } .past.b { stroke: var(--b); }
.ball { fill: none; stroke: var(--keep); stroke-width: 1.6; }
.w { stroke: var(--vp-c-text-3); stroke-width: 1.2; stroke-dasharray: 3 2; }
.normal { stroke-width: 1.1; } .normal.a { stroke: var(--a); } .normal.b { stroke: var(--b); }
.cand { fill: var(--vp-c-bg); stroke-width: 1.8; } .cand.a { stroke: var(--a); } .cand.b { stroke: var(--b); }
.contact { stroke: var(--vp-c-bg); stroke-width: 1; } .contact.a { fill: var(--a); } .contact.b { fill: var(--b); }
.edge { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 2; }
.tag { font-weight: 700; } .tag.x { fill: var(--hot); }
.name { font-weight: 700; } .name.a { fill: var(--a); } .name.b { fill: var(--b); }
.split { stroke: var(--vp-c-divider); }
.inset { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.gap { stroke: var(--hot); stroke-width: 1.5; stroke-dasharray: 3 2; }
.small { font-size: 10px; } .end { text-anchor: end; } .mid { text-anchor: middle; } .hot { fill: var(--hot); }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; }
.tol { stroke: var(--hot); stroke-width: 1; stroke-dasharray: 3 2; }
.bar { stroke: var(--keep); stroke-width: 6; opacity: 0.35; }
.dot { fill: var(--keep); }
</style>
