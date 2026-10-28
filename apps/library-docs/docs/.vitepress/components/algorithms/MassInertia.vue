<script setup>
// From the ten volume integrals to the inertia tensor (solidMassFromIntegrals, packages/barocss-cad/src/brep/solid-mass.ts),
// its principal axes by cyclic Jacobi rotations (symmetricEigen3InPlace, src/features/section-properties.ts) and the
// moment about another line (momentOfInertiaAboutAxis, src/brep/axis-inertia.ts). The bracket's integrals are its three
// blocks' closed forms; the tensor below equals the built kernel's prismaticMassProperties for it at 2.7 g/cm³
// ([[4633.03125, 75.9375, 1609.875], [75.9375, 6336.5625, 185.625], [1609.875, 185.625, 6766.03125]] g·mm², to 1e-15).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
// The bracket: a plate, a wall and a tab (mm), meeting only in faces.
const BOXES = [[0, 0, 0, 40, 30, 5], [0, 0, 5, 5, 30, 30], [5, 0, 5, 25, 5, 20]];
const RHO = 2.7;
const I10 = Array(10).fill(0);
for (const [x0, y0, z0, x1, y1, z1] of BOXES) {
  const d = [x1 - x0, y1 - y0, z1 - z0], m1 = [(x1 ** 2 - x0 ** 2) / 2, (y1 ** 2 - y0 ** 2) / 2, (z1 ** 2 - z0 ** 2) / 2], m2 = [(x1 ** 3 - x0 ** 3) / 3, (y1 ** 3 - y0 ** 3) / 3, (z1 ** 3 - z0 ** 3) / 3];
  I10[0] += d[0] * d[1] * d[2]; I10[1] += m1[0] * d[1] * d[2]; I10[2] += d[0] * m1[1] * d[2]; I10[3] += d[0] * d[1] * m1[2];
  I10[4] += m2[0] * d[1] * d[2]; I10[5] += d[0] * m2[1] * d[2]; I10[6] += d[0] * d[1] * m2[2];
  I10[7] += m1[0] * m1[1] * d[2]; I10[8] += m1[0] * d[1] * m1[2]; I10[9] += d[0] * m1[1] * m1[2];
}
// solidMassFromIntegrals: the centroid, the moments moved to it, the tensor (products stored as −∫xy dm).
const [V, SX, SY, SZ, XX, YY, ZZ, XY, XZ, YZ] = I10, C = [SX / V, SY / V, SZ / V], KD = RHO * 1e-3, MASS = RHO * V * 1e-3;
const xx = XX - V * C[0] * C[0], yy = YY - V * C[1] * C[1], zz = ZZ - V * C[2] * C[2], xy = XY - V * C[0] * C[1], xz = XZ - V * C[0] * C[2], yz = YZ - V * C[1] * C[2];
const T = [KD * (yy + zz), -KD * xy, -KD * xz, -KD * xy, KD * (xx + zz), -KD * yz, -KD * xz, -KD * yz, KD * (xx + yy)];
// symmetricEigen3InPlace, each rotation kept for the picture.
const TRACE = [];
const EIG = (() => {
  const A = T.slice(), W = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let sweeps = 0;
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = A[1] * A[1] + A[2] * A[2] + A[5] * A[5], scale = A[0] * A[0] + A[4] * A[4] + A[8] * A[8];
    if (!(off > 1e-30 * scale)) break;
    sweeps++;
    for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) {
      const apq = A[3 * p + q];
      if (apq === 0) continue;
      const before = { A: A.slice(), W: W.slice() };
      const th = (A[3 * q + q] - A[3 * p + p]) / (2 * apq), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = A[3 * k + p], akq = A[3 * k + q]; A[3 * k + p] = c * akp - s * akq; A[3 * k + q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = A[3 * p + k], aqk = A[3 * q + k]; A[3 * p + k] = c * apk - s * aqk; A[3 * q + k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = W[3 * k + p], vkq = W[3 * k + q]; W[3 * k + p] = c * vkp - s * vkq; W[3 * k + q] = s * vkp + c * vkq; }
      TRACE.push({ p, q, phi: Math.atan2(s, c), before, after: { A: A.slice(), W: W.slice() }, off: Math.hypot(A[1], A[2], A[5]) });
    }
  }
  const order = [0, 1, 2].sort((i, j) => A[i * 4] - A[j * 4]);
  return { values: order.map(i => A[i * 4]), vectors: order.map(i => [W[i], W[3 + i], W[6 + i]]), sweeps };
})();
const OFF0 = Math.hypot(T[1], T[2], T[5]);
// The moment about the bracket's corner edge: the z axis through the origin.
const CENTRAL = T[8], DIST = Math.hypot(C[0], C[1]), ABOUT_Z = CENTRAL + MASS * DIST * DIST;

// The view: turned 30° about z, tilted 22°, 3.4 px a millimetre, the centroid at (112, 128).
const yaw = -30 * Math.PI / 180, pitch = 22 * Math.PI / 180, S = 3.4;
const view = p => { const x = p[0] - C[0], y = p[1] - C[1], z = p[2] - C[2], x1 = x * Math.cos(yaw) - y * Math.sin(yaw), y1 = x * Math.sin(yaw) + y * Math.cos(yaw); return [112 + S * x1, 128 - S * (y1 * Math.sin(pitch) + z * Math.cos(pitch))]; };
const seg = (a, b) => { const p = view(a), q = view(b); return { x1: p[0], y1: p[1], x2: q[0], y2: q[1] }; };
const EDGES = BOXES.flatMap(([x0, y0, z0, x1, y1, z1]) => {
  const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  return [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].map(([a, b]) => seg(P[a], P[b]));
});
// The tensor's ellipsoid: the unit sphere's image under I, scaled so its longest semi-axis is 20 mm.
const R = 20 / EIG.values[2];
const add3 = (a, b, f = 1) => [a[0] + b[0] * f, a[1] + b[1] * f, a[2] + b[2] * f];
const RINGS = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => Array.from({ length: 73 }, (_, n) => {
  const th = 2 * Math.PI * n / 72, p = add3(add3(C, EIG.vectors[i], R * EIG.values[i] * Math.cos(th)), EIG.vectors[j], R * EIG.values[j] * Math.sin(th));
  return view(p).map(v => v.toFixed(2)).join(',');
}).join(' '));
// Its outline in this view: the projected shape matrix P A² Pᵀ, sampled.
const OUTLINE = (() => {
  const e = [view([C[0] + 1, C[1], C[2]]), view([C[0], C[1] + 1, C[2]]), view([C[0], C[1], C[2] + 1])], o = view(C);
  const Pm = [[0, 1, 2].map(k => e[k][0] - o[0]), [0, 1, 2].map(k => e[k][1] - o[1])];
  const A2 = [0, 1, 2].map(i => [0, 1, 2].map(j => EIG.vectors.reduce((acc, v, k) => acc + (R * EIG.values[k]) ** 2 * v[i] * v[j], 0)));
  const Q = [0, 1].map(a => [0, 1].map(b => { let v = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += Pm[a][i] * A2[i][j] * Pm[b][j]; return v; }));
  const m = (Q[0][0] + Q[1][1]) / 2, r = Math.hypot((Q[0][0] - Q[1][1]) / 2, Q[0][1]), ang = Math.atan2(2 * Q[0][1], Q[0][0] - Q[1][1]) / 2;
  const a = Math.sqrt(Math.max(0, m + r)), b = Math.sqrt(Math.max(0, m - r));
  return Array.from({ length: 97 }, (_, n) => { const th = 2 * Math.PI * n / 96, x = a * Math.cos(th), y = b * Math.sin(th); return `${(o[0] + x * Math.cos(ang) - y * Math.sin(ang)).toFixed(2)},${(o[1] + x * Math.sin(ang) + y * Math.cos(ang)).toFixed(2)}`; }).join(' ');
})();

/** A small number as m × 10ⁿ. */
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sci = v => { const [m, e] = Math.abs(v).toExponential(1).split('e'); return `${v < 0 ? '−' : ''}${m} × 10${String(+e).split('').map(c => SUP[c]).join('')}`; };
const fmt = v => Math.abs(v) >= 0.05 ? v.toFixed(1).replace('-', '−') : Math.abs(v) < 1e-9 * T[8] ? '≈ 0' : v.toExponential(0).replace(/-/g, '−');
const steps = [
  { label: 'Ten integrals', text: `Every method on this page ends with the same ten numbers: V and the integrals of x, y, z, x², y², z², xy, xz and yz over the body. This bracket (a plate, a wall and a tab) has V = ${num(V)} mm³. At 2.7 g/cm³ its mass is ${num(MASS)} g, and its centroid is (${num(C[0])}, ${num(C[1])}, ${num(C[2])}) mm.`, formula: 'c = (∫x dV, ∫y dV, ∫z dV) / V &nbsp; m = ρ V' },
  { label: 'Moved to the centroid', text: 'Second moments about the origin become moments about the centroid by the parallel-axis theorem: subtract V times the product of the centroid\'s coordinates. They make the inertia tensor, in g·mm², with k = ρ × 10⁻³ g/mm³ for ρ in g/cm³. The products of inertia are stored with their minus sign.', formula: 'xx = ∫x² dV − V c<sub>x</sub>² &nbsp; xy = ∫xy dV − V c<sub>x</sub> c<sub>y</sub><br>I = k [[yy + zz, −xy, −xz], [−xy, xx + zz, −yz], [−xz, −yz, xx + yy]]' },
  { label: 'The tensor as an ellipsoid', text: 'Drawn as the image of a sphere under I, the tensor is an ellipsoid. Its axes are the principal axes: in a frame along them the products of inertia are zero. Here they are not zero in x, y, z, so the ellipsoid sits tilted to that frame.' },
  { label: 'One Jacobi rotation', text: `Turning the frame in one coordinate plane by the right angle makes one pair of off-diagonal entries zero. The first turn is in the (x, y) plane, by ${num(TRACE[0].phi * 180 / Math.PI, 2)}°, and clears I<sub>xy</sub>.`, formula: 'θ = (a<sub>qq</sub> − a<sub>pp</sub>) / (2 a<sub>pq</sub>) &nbsp; t = sign θ / (|θ| + √(θ² + 1)) &nbsp; c = 1 / √(t² + 1), s = t c' },
  { label: 'Each pair in turn', text: `The next turns clear (x, z), by ${num(TRACE[1].phi * 180 / Math.PI, 2)}°, then (y, z), by ${num(TRACE[2].phi * 180 / Math.PI, 2)}°. Each turn brings back some of what an earlier one cleared, but less: the size of the off-diagonal part, ${num(OFF0, 0)} at the start, is ${num(TRACE[0].off, 0)}, ${num(TRACE[1].off, 0)} and ${num(TRACE[2].off, 0)} after these three turns.`, formula: '‖off‖ = √(a<sub>xy</sub>² + a<sub>xz</sub>² + a<sub>yz</sub>²)' },
  { label: 'Sweeps until done', text: `A sweep is one turn for each of the three pairs. Each sweep shrinks the rest much more than the last: ${TRACE.slice(3).map(r => r.off >= 1 ? num(r.off, 1) : sci(r.off)).join(' → ')}. The loop stops when the off-diagonal's square is below 10⁻³⁰ of the diagonal's — here after ${TRACE.length} turns in ${EIG.sweeps} sweeps — or after 50 sweeps.`, formula: 'stop: a<sub>xy</sub>² + a<sub>xz</sub>² + a<sub>yz</sub>² ≤ 10⁻³⁰ (a<sub>xx</sub>² + a<sub>yy</sub>² + a<sub>zz</sub>²)' },
  { label: 'Principal axes', text: `The diagonal now holds the principal moments, sorted ascending: ${EIG.values.map(v => num(v, 1)).join(', ')} g·mm². The frame's three columns are their axes. The bracket turns most easily about the first.`, formula: 'I = W Λ Wᵀ &nbsp; Λ = diag(I₁ ≤ I₂ ≤ I₃)' },
  { label: 'About any other line', text: `For a line through a point p along a unit u, the moment is the one about the parallel line through the centroid, plus the mass times the distance squared. About the bracket's corner edge, the z axis through the origin: ${CENTRAL.toFixed(1)} + ${num(MASS)} × ${num(DIST, 2)}² = ${num(ABOUT_Z, 1)} g·mm².`, formula: 'I<sub>line</sub> = uᵀ I u + m ‖d × u‖² &nbsp; d = c − p' },
];
const s = useSteps(steps.length, [2600, 2600, 2600, 2600, 3600, 4600, 2400, 2800], root);
const k = computed(() => ease(s.t.value));
// The frame and the matrix now: identity and T before the first turn, each turn's similarity at a fraction of its angle.
function partway(r, u) {
  const f = r.phi * u, c = Math.cos(f), sn = Math.sin(f), A = r.before.A.slice(), W = r.before.W.slice(), p = r.p, q = r.q;
  for (let i = 0; i < 3; i++) { const ap = A[3 * i + p], aq = A[3 * i + q]; A[3 * i + p] = c * ap - sn * aq; A[3 * i + q] = sn * ap + c * aq; }
  for (let i = 0; i < 3; i++) { const ap = A[3 * p + i], aq = A[3 * q + i]; A[3 * p + i] = c * ap - sn * aq; A[3 * q + i] = sn * ap + c * aq; }
  for (let i = 0; i < 3; i++) { const vp = W[3 * i + p], vq = W[3 * i + q]; W[3 * i + p] = c * vp - sn * vq; W[3 * i + q] = sn * vp + c * vq; }
  return { A, W, turn: r, done: u >= 1 };
}
const state = computed(() => {
  const st = s.step.value, last = TRACE[TRACE.length - 1];
  if (st <= 2) return { A: T, W: [1, 0, 0, 0, 1, 0, 0, 0, 1], turn: null, count: 0 };
  if (st >= 6) return { A: last.after.A, W: last.after.W, turn: null, count: TRACE.length };
  const L = st === 3 ? [0] : st === 4 ? [1, 2] : TRACE.slice(3).map((_, i) => i + 3);
  const x = Math.min(1, Math.max(0, s.t.value)) * L.length, j = Math.min(L.length - 1, Math.floor(x));
  return { ...partway(TRACE[L[j]], ease(Math.min(1, x - j))), count: L[j] + (x - j >= 1 ? 1 : 0) };
});
const offNow = computed(() => { const A = state.value.A; return Math.hypot(A[1], A[2], A[5]); });
// (Once turned, each axis is drawn just past the ellipsoid's semi-axis along it.)
const frame = computed(() => [0, 1, 2].map(i => { const W = state.value.W, v = [W[i], W[3 + i], W[6 + i]], l = s.step.value >= 6 ? R * state.value.A[4 * i] + 5 : 24; return { from: view(C), to: view(add3(C, v, l)), label: view(add3(C, v, l + 4)) }; }));
const MX = [282, 326, 370], MY = [86, 104, 122];
const cells = computed(() => {
  const A = state.value.A, t = state.value.turn, out = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const v = A[3 * i + j], pivot = t && ((i === t.p && j === t.q) || (i === t.q && j === t.p));
    out.push({ x: MX[j], y: MY[i], text: fmt(v), cls: i === j ? 'diag' : pivot ? 'pivot' : Math.abs(v) < 1e-6 * T[8] ? 'zero' : 'off' });
  }
  return out;
});
const zLine = seg([0, 0, -6], [0, 0, 38]);
const foot = view([0, 0, C[2]]), cen = view(C);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="From the integrals to the principal axes" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A bracket's inertia tensor drawn as an ellipsoid, the frame turned by Jacobi rotations onto its principal axes">
        <line v-for="(e, i) in EDGES" :key="'e' + i" v-bind="e" class="block" />
        <g v-if="s.step.value >= 2 && s.step.value <= 6" :style="{ opacity: s.step.value === 2 ? k : 1 }">
          <polyline :points="OUTLINE" class="ellipsoid" />
          <polyline v-for="(r, i) in RINGS" :key="'g' + i" :points="r" class="ring" />
        </g>
        <g v-if="s.step.value >= 1 && s.step.value <= 6">
          <g v-for="(f, i) in frame" :key="'f' + i">
            <line :x1="f.from[0]" :y1="f.from[1]" :x2="f.to[0]" :y2="f.to[1]" :class="['axis', s.step.value >= 6 ? 'done' : '']" />
            <text :x="f.label[0] - 4" :y="f.label[1] + 4" class="axis-name">{{ state.count === 0 ? ['x', 'y', 'z'][i] : ['1', '2', '3'][i] }}</text>
          </g>
        </g>
        <g v-if="s.step.value === 7">
          <line v-bind="zLine" class="line" />
          <line :x1="cen[0]" :y1="cen[1]" :x2="foot[0]" :y2="foot[1]" class="dist" :style="{ opacity: k }" />
          <text :x="(cen[0] + foot[0]) / 2 - 6" :y="(cen[1] + foot[1]) / 2 - 6" class="tag" :style="{ opacity: k }">d</text>
          <text :x="zLine.x2 + 5" :y="zLine.y2 + 10" class="tag">z axis</text>
        </g>
        <circle :cx="cen[0]" :cy="cen[1]" r="3.2" class="centroid" />
        <text v-if="s.step.value === 0" :x="cen[0] + 6" :y="cen[1] + 14" class="tag">c</text>
        <g v-if="s.step.value === 0">
          <text x="250" y="70" class="readout strong">V = {{ num(V) }} mm³</text>
          <text x="250" y="88" class="readout">m = {{ num(MASS) }} g</text>
          <text x="250" y="106" class="readout">c = ({{ num(C[0], 2) }}, {{ num(C[1], 2) }}, {{ num(C[2], 2) }})</text>
        </g>
        <g v-if="s.step.value >= 1 && s.step.value <= 6">
          <text x="370" y="64" class="readout strong" text-anchor="end">I, g·mm²</text>
          <text v-for="(c, i) in cells" :key="'m' + i" :x="c.x" :y="c.y" :class="['cell', c.cls]" text-anchor="end">{{ c.text }}</text>
          <text x="370" y="148" class="readout" text-anchor="end">‖off‖ {{ offNow >= 1 ? num(offNow, 1) : sci(offNow) }}</text>
          <text x="370" y="164" class="readout" text-anchor="end">turns {{ state.count }}</text>
        </g>
        <g v-if="s.step.value === 7">
          <text x="370" y="70" class="readout strong" text-anchor="end">about z: {{ num(ABOUT_Z, 1) }}</text>
          <text x="370" y="88" class="readout" text-anchor="end">central {{ CENTRAL.toFixed(1) }}</text>
          <text x="370" y="106" class="readout" text-anchor="end">m d² {{ num(MASS * DIST * DIST, 1) }}</text>
        </g>
      </svg>
      <template #note>The tensor is worked out in the page from the three blocks' integrals as the kernel's
        solidMassFromIntegrals does (it equals the kernel's closed form for this body), and turned with the kernel's cyclic
        Jacobi rotations. The ellipsoid is the image of a sphere under I, scaled to fit; the bracket is drawn as its three
        blocks. Mass properties hold the tensor, not its principal axes: those are computed where they are needed.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.block { stroke: var(--vp-c-text-3); stroke-width: 1; }
.ellipsoid { fill: color-mix(in srgb, var(--a) 14%, transparent); stroke: var(--a); stroke-width: 1.6; }
.ring { fill: none; stroke: var(--a); stroke-width: 0.8; opacity: 0.7; }
.axis { stroke: var(--b); stroke-width: 2.2; stroke-linecap: round; } .axis.done { stroke: var(--keep); }
.axis-name { font-size: 11px; font-weight: 700; fill: var(--b); }
.centroid { fill: var(--vp-c-text-1); stroke: var(--vp-c-bg); stroke-width: 1; }
.line { stroke: var(--hot); stroke-width: 2; }
.dist { stroke: var(--hot); stroke-width: 1.4; stroke-dasharray: 3 2; }
.tag { font-size: 11px; font-weight: 700; fill: var(--vp-c-text-1); }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-2); } .readout.strong { fill: var(--vp-c-text-1); }
.cell { font-family: var(--vp-font-family-mono); font-size: 10px; }
.cell.diag { fill: var(--vp-c-text-1); font-weight: 600; }
.cell.off { fill: var(--hot); }
.cell.pivot { fill: var(--hot); font-weight: 700; text-decoration: underline; }
.cell.zero { fill: var(--keep); }
</style>
