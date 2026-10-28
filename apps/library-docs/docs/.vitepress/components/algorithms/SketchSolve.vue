<script>
// The kernel's 2D sketch solver (packages/barocss-cad/src/sketch/xy-numerical-sketch-solver-internal.ts), copied line by
// line for the figures of /how/sketch-solver: qr (column-pivoted Householder least squares), evaluate (residuals and
// their hand-written Jacobian rows) and the damped loop of solve. Run on the figures' sketches, its iterates are
// bit-identical to the kernel's own (checked by running both from a script against packages/barocss-cad/dist). The
// admission checks, branch guards and the report are left out. SketchFreedom.vue and SketchArcs.vue import these.
const wrap = a => { const w = Math.atan2(Math.sin(a), Math.cos(a)); return w === -Math.PI ? Math.PI : w; };
export function qr(matrix, rhs, n) {
  const a = matrix.map(row => [...row]), b = [...rhs], m = a.length, order = Array.from({ length: n }, (_, i) => i), diagonals = [];
  for (let k = 0; k < Math.min(m, n); k++) {
    let pivot = k, largest = -1;
    for (let j = k; j < n; j++) { const norm = Math.hypot(...a.slice(k).map(row => row[j])); if (norm > largest) { largest = norm; pivot = j; } }
    if (pivot !== k) { for (const row of a) [row[k], row[pivot]] = [row[pivot], row[k]]; [order[k], order[pivot]] = [order[pivot], order[k]]; }
    const norm = Math.hypot(...a.slice(k).map(row => row[k]));
    if (norm === 0) { diagonals.push(0); continue; }
    const alpha = a[k][k] >= 0 ? -norm : norm, v = a.slice(k).map(row => row[k]); v[0] -= alpha;
    const length = Math.hypot(...v); for (let i = 0; i < v.length; i++) v[i] /= length;
    for (let j = k; j < n; j++) { let dot = 0; for (let i = 0; i < v.length; i++) dot += v[i] * a[k + i][j]; for (let i = 0; i < v.length; i++) a[k + i][j] -= 2 * v[i] * dot; }
    let dot = 0; for (let i = 0; i < v.length; i++) dot += v[i] * b[k + i]; for (let i = 0; i < v.length; i++) b[k + i] -= 2 * v[i] * dot;
    a[k][k] = alpha; for (let i = k + 1; i < m; i++) a[i][k] = 0; diagonals.push(Math.abs(alpha));
  }
  const threshold = Math.max(1, ...diagonals) * 1e-10, rank = diagonals.filter(d => d > threshold).length, z = Array(n).fill(0);
  for (let i = rank - 1; i >= 0; i--) { let value = b[i]; for (let j = i + 1; j < rank; j++) value -= a[i][j] * z[j]; z[i] = value / a[i][i]; }
  const solution = Array(n).fill(0); for (let i = 0; i < n; i++) solution[order[i]] = z[i];
  return { solution, rank };
}
/**
 * A sketch here: `points` (ids in order, x then y of each in the unknowns), `segments` { id: [startId, endId] } and
 * `constraints` in the kernel's document form. Null where the kernel refuses a candidate (a segment under 0.001 mm).
 */
export function evaluate(sk, x) {
  const n = x.length, at = id => 2 * sk.points.indexOf(id);
  const seg = id => { const [s, e] = sk.segments[id], a = at(s), b = at(e); return { a, b, dx: x[b] - x[a], dy: x[b + 1] - x[a + 1] }; };
  for (const id in sk.segments) { const v = seg(id); if (!(Math.hypot(v.dx, v.dy) >= 0.001)) return null; }
  const jacobian = [], residuals = [], owner = [];
  const add = (c, actual, target, rad, terms) => {
    const row = Array(n).fill(0); for (const [i, v] of terms) row[i] += v;
    jacobian.push(row); residuals.push(rad ? wrap(actual - target) : actual - target); owner.push({ id: c.id, rad });
  };
  for (const c of sk.constraints) {
    if (c.kind === 'fixed') { const a = at(c.pointId); for (let k = 0; k < 2; k++) add(c, x[a + k], c.target[k], false, [[a + k, 1]]); }
    else if (c.kind === 'coincident') { const a = at(c.pointA), b = at(c.pointB); for (let k = 0; k < 2; k++) add(c, x[b + k] - x[a + k], 0, false, [[b + k, 1], [a + k, -1]]); }
    else if (c.kind === 'equal-length') {
      const a = seg(c.segmentA), b = seg(c.segmentB), la = Math.hypot(a.dx, a.dy), lb = Math.hypot(b.dx, b.dy);
      add(c, la - lb, 0, false, [[a.a, -a.dx / la], [a.a + 1, -a.dy / la], [a.b, a.dx / la], [a.b + 1, a.dy / la], [b.a, b.dx / lb], [b.a + 1, b.dy / lb], [b.b, -b.dx / lb], [b.b + 1, -b.dy / lb]]);
    } else if (c.kind === 'signed-angle') {
      const a = seg(c.segmentA), b = seg(c.segmentB), aa = a.dx * a.dx + a.dy * a.dy, bb = b.dx * b.dx + b.dy * b.dy;
      add(c, wrap(Math.atan2(b.dy, b.dx) - Math.atan2(a.dy, a.dx)), c.angle, true,
        [[a.a, -a.dy / aa], [a.a + 1, a.dx / aa], [a.b, a.dy / aa], [a.b + 1, -a.dx / aa], [b.a, b.dy / bb], [b.a + 1, -b.dx / bb], [b.b, -b.dy / bb], [b.b + 1, b.dx / bb]]);
    } else {
      const v = seg(c.segmentId);
      if (c.kind === 'length') { const l = Math.hypot(v.dx, v.dy); add(c, l, c.length, false, [[v.a, -v.dx / l], [v.a + 1, -v.dy / l], [v.b, v.dx / l], [v.b + 1, v.dy / l]]); }
      else { const k = c.kind === 'horizontal' ? 1 : 0; add(c, k === 1 ? v.dy : v.dx, 0, false, [[v.b + k, 1], [v.a + k, -1]]); }
    }
  }
  return { jacobian, residuals, owner, objective: residuals.reduce((s, r) => s + r * r, 0) };
}
const satisfied = e => e.residuals.every((r, i) => Math.abs(r) <= (e.owner[i].rad ? 1e-9 : 1e-7));
/** The kernel's damped loop, keeping each accepted iterate (x, ‖r‖, λ after it, tries), then the rank of J there. */
export function solveTrace(sk, x0) {
  let x = [...x0], current = evaluate(sk, x), damping = 1e-3, iterations = 0;
  const its = [{ x, norm: Math.sqrt(current.objective), damping, tries: 0 }];
  while (!satisfied(current) && iterations < 100) {
    iterations++; let accepted = false, tries = 0;
    for (let trial = 0; trial < 12; trial++) {
      tries++;
      const matrix = [...current.jacobian.map(row => [...row]), ...x.map((_, i) => x.map((__, j) => i === j ? Math.sqrt(damping) : 0))];
      const step = qr(matrix, [...current.residuals.map(r => -r), ...x.map(() => 0)], x.length).solution;
      const candidate = x.map((v, i) => v + step[i]), next = evaluate(sk, candidate);
      if (next && next.objective < current.objective) { x = candidate; current = next; damping = Math.max(1e-12, damping / 3); accepted = true; break; }
      damping = Math.min(1e12, damping * 10);
    }
    its.push({ x, norm: Math.sqrt(current.objective), damping, tries });
    if (!accepted && damping === 1e12) break;
  }
  const rank = qr(current.jacobian, current.residuals.map(() => 0), x.length).rank;
  return { its, ok: satisfied(current), rank, rows: current.residuals.length, dof: x.length - rank, final: current };
}
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** 3.9×10⁻¹⁰ style, for the figures' readouts. */
export function sci(v, d = 2) {
  if (v === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(v))), m = +(v / 10 ** e).toFixed(d - 1);
  if (Math.abs(m) >= 10) { m /= 10; e += 1; }
  if (e >= -2 && e <= 2) return (+v.toPrecision(d + 1)).toString();
  return `${m.toFixed(d - 1)}×10${String(e).split('').map(c => SUP[c]).join('')}`;
}
</script>

<script setup>
// The figure: a hand-drawn quad and seven constraints, solved by the copy above.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const DEG = Math.PI / 180;
const SK = {
  points: ['p0', 'p1', 'p2', 'p3'],
  segments: { s0: ['p0', 'p1'], s1: ['p1', 'p2'], s2: ['p2', 'p3'], s3: ['p3', 'p0'] },
  constraints: [
    { id: 'anchor', kind: 'fixed', pointId: 'p0', target: [0, 0] },
    { id: 'h0', kind: 'horizontal', segmentId: 's0' },
    { id: 'v3', kind: 'vertical', segmentId: 's3' },
    { id: 'l0', kind: 'length', segmentId: 's0', length: 40 },
    { id: 'l3', kind: 'length', segmentId: 's3', length: 24 },
    { id: 'a01', kind: 'signed-angle', segmentA: 's0', segmentB: 's1', angle: 100 * DEG },
    { id: 'h2', kind: 'horizontal', segmentId: 's2' },
  ],
};
const DRAWN = [0, 0, 36, 3, 30, 19, -3, 21];
const run = solveTrace(SK, DRAWN), ITS = run.its, LAST = ITS.length - 1;
// Evaluations as the kernel counts them: the start, one per try, the final check.
const EVALS = 2 + ITS.reduce((n, t) => n + t.tries, 0), FIRST_TRIES = ITS.every((t, i) => i === 0 || t.tries === 1);
const start = evaluate(SK, DRAWN);
// Each constraint's residual at the drawing, for step 2 (the anchor's two rows read together).
const r0 = start.residuals;
const RES = [
  { seg: null, pt: 0, text: `fixed p₀: (x₀ − 0, y₀ − 0) = (${num(r0[0])}, ${num(r0[1])}) mm` },
  { seg: 's0', text: `s₀ horizontal: y₁ − y₀ = ${num(r0[2])} mm` },
  { seg: 's3', text: `s₃ vertical: x₀ − x₃ = ${num(r0[3])} mm` },
  { seg: 's0', text: `|s₀| − 40 = ${num(r0[4])} mm` },
  { seg: 's3', text: `|s₃| − 24 = ${num(r0[5])} mm` },
  { seg: 's1', text: `∠(s₀, s₁) − 100° = ${num(r0[6])} rad (${num(r0[6] / DEG, 1)}°)` },
  { seg: 's2', text: `s₂ horizontal: y₃ − y₂ = ${num(r0[7])} mm` },
];

// The view: millimetres to the picture, y up.
const S = 4.6, OX = 46, OY = 178;
const V = (x, y) => [OX + S * x, OY - S * y];
const P = x => [0, 1, 2, 3].map(i => V(x[2 * i], x[2 * i + 1]));
const poly = ps => ps.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
const drawnPts = P(DRAWN);
// The convergence plot: log₁₀ ‖r‖ from 10¹ down to 10⁻¹⁰.
const PX = i => 282 + i * 13.5, PY = v => 58 + (1 - Math.log10(Math.max(v, 1e-12))) / 11 * 132;
const TICKS = [0, -3, -6, -9].map(e => ({ y: PY(10 ** e), label: e === 0 ? '1' : `10${String(e).split('').map(c => ({ '-': '⁻', 3: '³', 6: '⁶', 9: '⁹' })[c]).join('')}` }));

const steps = [
  { label: 'A rough drawing, seven constraints', text: 'Four points p₀ … p₃, joined by segments s₀ … s₃, drawn by hand. The constraints: p₀ fixed where it was drawn (the studio always anchors point 1), s₀ and s₂ horizontal, s₃ vertical, |s₀| = 40 mm, |s₃| = 24 mm, and s₁ turned 100° from the direction of s₀. The unknowns are the eight coordinates of the points.', formula: 'x = (x₀, y₀, x₁, y₁, x₂, y₂, x₃, y₃) &nbsp; 8 unknowns · 2 + 1 + 1 + 1 + 1 + 1 + 1 = 8 equations' },
  { label: 'Each constraint, a residual', text: `Each constraint is written as an equation r(x) = 0: its value is zero when the constraint holds and says how far off it is when not. The kernel also writes each row's derivatives by hand: together they are the Jacobian J. At the drawing ‖r‖ = ${num(ITS[0].norm, 2)}.`, formula: 'horizontal: y<sub>b</sub> − y<sub>a</sub> &nbsp; vertical: x<sub>b</sub> − x<sub>a</sub> &nbsp; length: ‖b − a‖ − L<br>angle: wrap(atan2(s<sub>B</sub>) − atan2(s<sub>A</sub>) − θ) &nbsp; fixed: p − target' },
  { label: 'One damped step', text: `Linearise r about x and choose the step δ that makes J δ + r smallest, plus a penalty λ‖δ‖² that keeps the step short. The kernel stacks J over √λ I and solves that by Householder QR with column pivoting. λ starts at 10⁻³. All four points move at once; even the fixed p₀ moves a little (x₀ = ${num(ITS[1].x[0], 4)}), because "fixed" is two equations like the others, not a removed unknown.`, formula: `min ‖J δ + r‖² + λ ‖δ‖² &nbsp;⇔&nbsp; [J ; √λ I] δ ≈ [−r ; 0] &nbsp; x ← x + δ<br>‖r‖: ${num(ITS[0].norm, 2)} → ${num(ITS[1].norm, 3)}` },
  { label: 'Accept it, trust the model more', text: 'The step is kept only if the sum of squares Σ rᵢ² falls; λ is then divided by 3. A step that does not lower it is thrown away and λ multiplied by 10, up to 12 tries in one iteration. ' + (FIRST_TRIES ? 'On this sketch every first try is accepted, so λ only shrinks and the steps approach plain Gauss–Newton.' : ''), formula: 'accept: λ ← max(10⁻¹², λ / 3) &nbsp; reject: λ ← min(10¹², 10 λ)<br>stop trying when no step is accepted and λ = 10¹²' },
  { label: 'Until every residual is small', text: `The loop ends when every residual is within its own tolerance, 10⁻⁷ mm for a length row or 10⁻⁹ rad for an angle row (not on the norm). Here after ${LAST} iterations, in ${EVALS} evaluations of r. After the third the moves are too small to see; the plot shows them. A sketch the loop cannot satisfy in 100 iterations or 1200 evaluations is refused.`, formula: `stop: |rᵢ| ≤ tolᵢ for every row &nbsp; ‖r‖ = ${ITS.map(t => sci(t.norm, 2)).join(' → ')}` },
  { label: 'Check again, count the freedom', text: `The result is evaluated once more from scratch and must pass the same test. Then J at the solution is factored again, without the damping rows; its rank is the number of independent equations. Here rank ${run.rank} = ${DRAWN.length} unknowns: no motion keeps every constraint, so the solution is fixed locally (the studio reads <b>Fully defined</b>).`, formula: `DOF = unknowns − rank J = ${DRAWN.length} − ${run.rank} = ${run.dof} &nbsp; rank: |R<sub>kk</sub>| &gt; max(1, max |R<sub>kk</sub>|) · 10⁻¹⁰` },
];
const s = useSteps(steps.length, [2600, 4200, 2800, 2800, 4200, 2600], root);
const k = computed(() => ease(s.t.value));
// The iterate shown: a float index along the accepted iterates.
const u = computed(() => {
  const i = s.step.value;
  return i <= 1 ? 0 : i === 2 ? k.value : i === 3 ? 1 + k.value : i === 4 ? 2 + k.value * (LAST - 2) : LAST;
});
const xAt = computed(() => { const i = Math.min(LAST - 1, Math.floor(u.value)), f = Math.min(1, u.value - i); return ITS[i].x.map((v, j) => v + (ITS[i + 1].x[j] - v) * f); });
const pts = computed(() => P(xAt.value));
const shown = computed(() => Math.min(LAST, Math.floor(u.value + 1e-9)));
const plotted = computed(() => ITS.slice(0, shown.value + 1).map((t, i) => [PX(i), PY(t.norm)]));
const readout = computed(() => { const t = ITS[shown.value]; return `iteration ${shown.value} · ‖r‖ = ${sci(t.norm, 2)} · λ = ${sci(t.damping, 2)}`; });
const res = computed(() => (s.step.value === 1 ? RES[Math.min(RES.length - 1, Math.floor(s.t.value * RES.length))] : null));
const segPts = id => { const [a, b] = SK.segments[id].map(p => SK.points.indexOf(p)); return [pts.value[a], pts.value[b]]; };
const mid = (id, dx = 0, dy = 0) => { const [a, b] = segPts(id); return [(a[0] + b[0]) / 2 + dx, (a[1] + b[1]) / 2 + dy]; };
// The 100° angle at p₁: from s₀'s direction carried on past p₁ to s₁'s.
const angleArc = computed(() => {
  const p = pts.value, a0 = Math.atan2(-(p[1][1] - p[0][1]), p[1][0] - p[0][0]), a1 = Math.atan2(-(p[2][1] - p[1][1]), p[2][0] - p[1][0]);
  let sw = a1 - a0; while (sw < 0) sw += 2 * Math.PI;
  const R = 12, pt = t => [p[1][0] + R * Math.cos(a0 + sw * t), p[1][1] - R * Math.sin(a0 + sw * t)];
  return { d: poly(Array.from({ length: 17 }, (_, i) => pt(i / 16))), ext: [p[1], [p[1][0] + 18 * Math.cos(a0), p[1][1] - 18 * Math.sin(a0)]], label: pt(0.5) };
});
// The first step's moves, drawn as it is taken.
const P1 = P(ITS[1].x), STEP01 = P(ITS[0].x).map((a, i) => [a, P1[i]]);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Solving a sketch: damped Newton steps on the residuals" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A hand-drawn quadrilateral moved by the solver's iterations onto its constraints, with the residual norm falling per iteration">
        <text x="12" y="20" class="readout">{{ readout }}</text>
        <polygon :points="poly(drawnPts)" class="drawn" />
        <polygon :points="poly(pts)" class="shape" />
        <line v-if="res && res.seg" :x1="segPts(res.seg)[0][0]" :y1="segPts(res.seg)[0][1]" :x2="segPts(res.seg)[1][0]" :y2="segPts(res.seg)[1][1]" class="hot-seg" />
        <circle v-if="res && res.pt === 0" :cx="pts[0][0]" :cy="pts[0][1]" r="7" class="hot-ring" />
        <line v-for="(st, i) in (s.step.value === 2 ? STEP01 : [])" :key="'st' + i" :x1="st[0][0]" :y1="st[0][1]" :x2="st[0][0] + (st[1][0] - st[0][0]) * Math.min(1, k * 2)" :y2="st[0][1] + (st[1][1] - st[0][1]) * Math.min(1, k * 2)" class="step" />
        <polyline :points="poly(angleArc.ext)" class="ext" />
        <polyline :points="angleArc.d" class="mark-line" />
        <text :x="angleArc.label[0] + 4" :y="angleArc.label[1] - 3" class="mark">100°</text>
        <text :x="mid('s0')[0]" :y="mid('s0')[1] + 13" class="mark" text-anchor="middle">H · 40</text>
        <text :x="mid('s2')[0]" :y="mid('s2')[1] - 6" class="mark" text-anchor="middle">H</text>
        <text :x="mid('s3')[0] - 6" :y="mid('s3')[1] + 4" class="mark" text-anchor="end">V · 24</text>
        <path :d="`M${pts[0][0] - 6},${pts[0][1] + 9} L${pts[0][0] + 6},${pts[0][1] + 9} L${pts[0][0]},${pts[0][1] + 1} Z`" class="anchor" />
        <circle v-for="(p, i) in pts" :key="'p' + i" :cx="p[0]" :cy="p[1]" r="3.2" :class="['pt', { done: s.step.value === 5 }]" />
        <text v-for="(p, i) in pts" :key="'l' + i" :x="p[0] + (i === 0 || i === 3 ? -8 : 7)" :y="p[1] + (i < 2 ? 12 : -6)" :text-anchor="i === 0 || i === 3 ? 'end' : 'start'" class="name">p{{ ['₀', '₁', '₂', '₃'][i] }}</text>
        <text v-if="res" x="12" y="228" class="res">{{ res.text }}</text>
        <g class="plot">
          <text x="276" y="46" class="axis-title">‖r‖ per iteration</text>
          <line x1="276" :y1="PY(10)" x2="276" :y2="PY(1e-10)" class="axis" />
          <line x1="276" :y1="PY(1e-10)" x2="370" :y2="PY(1e-10)" class="axis" />
          <g v-for="t in TICKS" :key="t.label"><line x1="273" :y1="t.y" x2="370" :y2="t.y" class="grid" /><text x="270" :y="t.y + 3.5" class="tick" text-anchor="end">{{ t.label }}</text></g>
          <text v-for="(_, i) in ITS" :key="'x' + i" :x="PX(i)" :y="PY(1e-10) + 12" class="tick" text-anchor="middle">{{ i }}</text>
          <polyline :points="poly(plotted)" class="conv" />
          <circle v-for="(q, i) in plotted" :key="'c' + i" :cx="q[0]" :cy="q[1]" r="2.8" class="conv-pt" />
        </g>
        <text v-if="s.step.value === 5" x="12" y="228" class="ok">rank {{ run.rank }} of {{ DRAWN.length }} · 0 DOF · fully defined</text>
      </svg>
      <template #note>Computed in the page with a line-by-line copy of the kernel's residuals, QR and damped loop; on this
        sketch its iterates are bit-identical to the kernel's own (checked by running both). The studio would build the
        same equations for this outline; its own inferences (horizontal and vertical edges as drawn) are left out here.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
.drawn { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 3 3; }
.shape { fill: var(--a); fill-opacity: 0.08; stroke: var(--a); stroke-width: 2; stroke-linejoin: round; }
.hot-seg { stroke: var(--hot); stroke-width: 3.2; stroke-linecap: round; }
.hot-ring { fill: none; stroke: var(--hot); stroke-width: 2; }
.step { stroke: var(--hot); stroke-width: 1.6; }
.ext { fill: none; stroke: var(--b); stroke-width: 1; stroke-dasharray: 2 2; }
.mark-line { fill: none; stroke: var(--b); stroke-width: 1.3; }
.mark { fill: var(--b); font-size: 10px; font-weight: 600; }
.anchor { fill: var(--vp-c-text-2); }
.pt { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; } .pt.done { fill: var(--keep); }
.name { font-size: 10px; fill: var(--vp-c-text-2); }
.res { fill: var(--hot); font-weight: 600; }
.ok { fill: var(--keep); font-weight: 700; }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; } .grid { stroke: var(--vp-c-divider); stroke-width: 0.8; }
.tick { font-size: 10px; fill: var(--vp-c-text-3); }
.axis-title { font-size: 10px; font-weight: 600; }
.conv { fill: none; stroke: var(--keep); stroke-width: 1.8; }
.conv-pt { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; }
</style>
