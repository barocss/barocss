<script setup>
// A slot drawn by hand in the studio, solved the way packages/barocss-cad-model/src/sketch/profile.ts (solveOutline)
// builds it for the kernel: each arc its centre point plus two radius segments held equal, a tangent joint a ±90° angle
// between the line and the radius, a radius lock a length on the radius segment. The three solves are the studio's
// (closing with its inferences, then R6, then length 40), each seeded from the one before with the centres rebuilt from
// the bulges as the studio does; the documents and iterates match the studio's own run bit for bit (checked by running
// settleShape / commitDimension against the kernel from a script).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';
import { sci, solveTrace } from './SketchSolve.vue';

const root = ref(null);
const DRAWN = [[0, -6], [36, -6], [37, 7], [1, 6]], BULGE = [0, 1.05, 0, 0.95];
// profile.ts arcOf and the bulge rebuilt from a solved centre (the same arithmetic).
function arcOf(a, b, bulge) {
  const c = Math.hypot(b[0] - a[0], b[1] - a[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = [-(b[1] - a[1]) / c, (b[0] - a[0]) / c];
  const d = (c / 2) * (1 - bulge * bulge) / (2 * bulge), center = [m[0] + n[0] * d, m[1] + n[1] * d];
  return { center, mid: m, radius: Math.hypot(a[0] - center[0], a[1] - center[1]) };
}
function bulgeBack(p, q, c, b) {
  const s0 = [p[0] - c[0], p[1] - c[1]], s1 = [q[0] - c[0], q[1] - c[1]];
  let sweep = Math.atan2(s0[0] * s1[1] - s0[1] * s1[0], s0[0] * s1[0] + s0[1] * s1[1]);
  if (b > 0 && sweep <= 0) sweep += 2 * Math.PI; if (b < 0 && sweep >= 0) sweep -= 2 * Math.PI;
  return Math.tan(sweep / 4);
}
const HALF = Math.PI / 2, POINTS = ['p0', 'p1', 'p2', 'p3', 'c1', 'c3'];
const SEGMENTS = { s0: ['p0', 'p1'], s2: ['p2', 'p3'], ra1: ['c1', 'p1'], rb1: ['c1', 'p2'], ra3: ['c3', 'p3'], rb3: ['c3', 'p0'] };
const TANGENTS = [{ id: 't0', kind: 'signed-angle', segmentA: 'rb3', segmentB: 's0', angle: HALF }, { id: 't1', kind: 'signed-angle', segmentA: 's0', segmentB: 'ra1', angle: -HALF },
  { id: 't2', kind: 'signed-angle', segmentA: 'rb1', segmentB: 's2', angle: HALF }, { id: 't3', kind: 'signed-angle', segmentA: 's2', segmentB: 'ra3', angle: -HALF }];
const R1 = { id: 'r1', kind: 'length', segmentId: 'ra1', length: 6 }, L0 = { id: 'l0', kind: 'length', segmentId: 's0', length: 40 };
// The studio's order: anchor, H/V, lengths, equal ends per arc, radii, equal radii, tangents.
const rows = (p0, { len, rad, inferred = true }) => [{ id: 'anchor', kind: 'fixed', pointId: 'p0', target: p0 }, { id: 'h0', kind: 'horizontal', segmentId: 's0' }, ...(len ? [L0] : []),
  { id: 'e1', kind: 'equal-length', segmentA: 'ra1', segmentB: 'rb1' }, { id: 'e3', kind: 'equal-length', segmentA: 'ra3', segmentB: 'rb3' }, ...(rad ? [R1] : []),
  ...(inferred ? [{ id: 'q1_3', kind: 'equal-length', segmentA: 'ra1', segmentB: 'ra3' }, ...TANGENTS] : [])];
const unknowns = (P, B) => [...P.flat(), ...arcOf(P[1], P[2], B[1]).center, ...arcOf(P[3], P[0], B[3]).center];
const X0 = unknowns(DRAWN, BULGE), ARC1 = arcOf(DRAWN[1], DRAWN[2], BULGE[1]), ARC3 = arcOf(DRAWN[3], DRAWN[0], BULGE[3]);
const EXPLICIT = solveTrace({ points: POINTS, segments: SEGMENTS, constraints: rows(DRAWN[0], { inferred: false }) }, X0);
const SOLVES = [];
{
  let P = DRAWN, B = BULGE;
  for (const opts of [{}, { rad: true }, { rad: true, len: true }]) {
    const r = solveTrace({ points: POINTS, segments: SEGMENTS, constraints: rows(P[0], opts) }, unknowns(P, B)), x = r.its.at(-1).x;
    P = [0, 1, 2, 3].map(i => [x[2 * i], x[2 * i + 1]]);
    B = [0, bulgeBack(P[1], P[2], [x[8], x[9]], B[1]), 0, bulgeBack(P[3], P[0], [x[10], x[11]], B[3])];
    SOLVES.push({ its: r.its, rank: r.rank, rows: r.rows, dof: r.dof, bulges: B });
  }
}
// How far each joint was drawn from tangent (profile.ts tangentTarget's deviation).
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const DEV = (() => {
  const P = DRAWN, c1 = ARC1.center, c3 = ARC3.center, d = (a, b) => [a[0] - b[0], a[1] - b[1]], ang = v => Math.atan2(v[1], v[0]);
  const sides = [[d(P[0], c3), d(P[1], P[0])], [d(P[1], P[0]), d(P[1], c1)], [d(P[2], c1), d(P[3], P[2])], [d(P[3], P[2]), d(P[3], c3)]];
  return sides.map(([a, b]) => { const cur = wrap(ang(b) - ang(a)); return Math.min(Math.abs(wrap(cur - HALF)), Math.abs(wrap(cur + HALF))) * 180 / Math.PI; });
})();

const S = 6, OX = 52, OY = 100;
const V = (x, y) => [OX + S * x, OY - S * y];
const f1 = v => v.toFixed(1);
/** The outline at unknowns x: lines, and each arc counter-clockwise about its centre, its radius blended end to end. */
function outline(x) {
  const p = i => [x[2 * i], x[2 * i + 1]], c1 = [x[8], x[9]], c3 = [x[10], x[11]], out = [];
  const arc = (a, b, c) => {
    const ra = Math.hypot(a[0] - c[0], a[1] - c[1]), rb = Math.hypot(b[0] - c[0], b[1] - c[1]), t0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
    let sw = Math.atan2(b[1] - c[1], b[0] - c[0]) - t0; while (sw <= 0) sw += 2 * Math.PI;
    for (let k = 1; k <= 28; k++) { const u = k / 28, r = ra + (rb - ra) * u; out.push(V(c[0] + r * Math.cos(t0 + sw * u), c[1] + r * Math.sin(t0 + sw * u))); }
  };
  out.push(V(...p(0)), V(...p(1))); arc(p(1), p(2), c1); out.push(V(...p(3))); arc(p(3), p(0), c3);
  return out.map(q => f1(q[0]) + ',' + f1(q[1])).join(' ');
}
const DRAWN_OUTLINE = outline(X0);

const rowsText = n => ['', 'anchor 2 · H 1 · equal ends 2 = 5', 'anchor 2 · H 1 · equal ends 2 · equal radii 1 · tangent 4 = 10', 'anchor 2 · H 1 · equal ends 2 · equal radii 1 · tangent 4 = 10',
  '… + radius 1 = 11', '… + length 1 = 12', '… + length 1 = 12'][n];
const devText = DEV.map(v => num(v, 1) + '°').join(', ');
const steps = [
  { label: 'An outline with two arcs', text: `Segment i runs from point i to point i + 1; a nonzero bulge b makes it an arc, b = tan(sweep / 4), positive counter-clockwise (the DXF convention). Drawn here: b = ${BULGE[1]} and ${BULGE[3]}, radii ${num(ARC1.radius, 2)} and ${num(ARC3.radius, 2)} mm. A centre lies on the perpendicular through the chord's midpoint, at a distance set by b.`, formula: 'd = (c / 2) · (1 − b²) / (2b) &nbsp; centre = midpoint + d · (left normal of the chord), &nbsp; c = chord length' },
  { label: 'What the solver sees', text: `The kernel's line solver knows points and straight segments only. Each arc becomes its centre, a point with two unknowns, and two radius segments, centre → start and centre → end, held equal by one equal-length row. An arc so brings one freedom of its own: on fixed ends, its radius. With only the anchor, the drawn horizontal edge and these rows, rank ${EXPLICIT.rank}: ${EXPLICIT.dof} DOF.`, formula: 'unknowns: 4 points × 2 + 2 centres × 2 = 12 &nbsp; per arc: |c p<sub>start</sub>| − |c p<sub>end</sub>| = 0' },
  { label: 'What closing infers', text: `When the outline closes, the studio keeps the edges drawn exactly horizontal or vertical (here s₀, on the 1 mm snap), makes tangent each joint drawn within 12° of tangent (here ${devText} off), and sets equal radii drawn within 3 % or 0.5 mm. A tangent joint is an angle between the line and the radius, ±90° with the sign nearest the drawing (between two arcs' radii, 0° or 180°). An inferred relation is kept only while the sketch still solves and it adds no redundant row.`, formula: 'tangent: ∠(line, radius) = ±90° &nbsp; equal radii: |c₁p₁| − |c₃p₃| = 0' },
  { label: 'Solve: a slot', text: `The same damped loop, ${SOLVES[0].its.length - 1} iterations: the lines come parallel, both arcs become half circles of one radius. 12 unknowns, rank ${SOLVES[0].rank}: ${SOLVES[0].dof} freedoms are left, the slot's length and its radius.`, formula: `‖r‖ = ${SOLVES[0].its.map(t => sci(t.norm, 2)).join(' → ')}` },
  { label: 'Lock the radius', text: `A radius dimension is a length on the radius segment centre → start: |c₁p₁| = 6 mm. The equal-radii row carries it to the other arc. ${SOLVES[1].its.length - 1} iterations; rank ${SOLVES[1].rank}, ${SOLVES[1].dof} freedom left.`, formula: `|c₁p₁| − 6 = 0 &nbsp; ‖r‖ = ${SOLVES[1].its.map(t => sci(t.norm, 2)).join(' → ')}` },
  { label: 'Lock the length', text: `|s₀| = 40 mm. ${SOLVES[2].its.length - 1} iterations; rank ${SOLVES[2].rank} of 12 unknowns, ${SOLVES[2].dof} DOF: <b>Fully defined</b>.`, formula: `DOF = 12 − ${SOLVES[2].rank} = ${SOLVES[2].dof} &nbsp; ‖r‖ = ${SOLVES[2].its.map(t => sci(t.norm, 2)).join(' → ')}` },
  { label: 'Back to bulges', text: `The studio keeps the outline as points and bulges. Each arc's sweep is measured about its solved centre from start to end, kept turning the way it was drawn, and b = tan(sweep / 4): here b = ${SOLVES[2].bulges[1].toFixed(6)} and ${SOLVES[2].bulges[3].toFixed(6)}, half circles.`, formula: 'sweep = atan2(v₀ × v₁, v₀ · v₁), + 2π when b &gt; 0 and sweep ≤ 0 &nbsp; b = tan(sweep / 4)' },
];
const s = useSteps(steps.length, [3000, 2800, 3600, 3600, 3000, 3200, 2800], root);
const k = computed(() => ease(s.t.value));
const solveOf = n => (n >= 3 && n <= 5 ? SOLVES[n - 3] : null);
const xAt = computed(() => {
  const n = s.step.value, sv = solveOf(n);
  if (n < 3) return X0;
  if (!sv) return SOLVES[2].its.at(-1).x;
  const its = sv.its, f = k.value * (its.length - 1), i = Math.min(its.length - 2, Math.floor(f)), w = Math.min(1, f - i);
  return its[i].x.map((v, j) => v + (its[i + 1].x[j] - v) * w);
});
const P = computed(() => { const x = xAt.value; return [0, 1, 2, 3, 4, 5].map(i => V(x[2 * i], x[2 * i + 1])); });
const path = computed(() => outline(xAt.value));
const readout = computed(() => {
  const sv = solveOf(s.step.value);
  if (!sv) return s.step.value === 6 ? `b = ${SOLVES[2].bulges[1].toFixed(6)} · b = ${SOLVES[2].bulges[3].toFixed(6)}` : s.step.value === 0 ? `drawn: b = ${BULGE[1]}, b = ${BULGE[3]}` : '';
  const i = Math.min(sv.its.length - 1, Math.floor(k.value * (sv.its.length - 1) + 1e-9));
  return `iteration ${i} · ‖r‖ = ${sci(sv.its[i].norm, 2)}`;
});
const dof = computed(() => { const n = s.step.value; return n === 1 ? { rank: EXPLICIT.rank, dof: EXPLICIT.dof } : n >= 3 ? SOLVES[Math.min(2, n - 3)] : null; });
// Step 1: each centre slides from its chord's midpoint along the normal.
const centreSlide = computed(() => [ARC1, ARC3].map(a => { const u = s.step.value === 0 ? k.value : 1; return V(a.mid[0] + (a.center[0] - a.mid[0]) * u, a.mid[1] + (a.center[1] - a.mid[1]) * u); }));
const chords = [[DRAWN[1], DRAWN[2], ARC1], [DRAWN[3], DRAWN[0], ARC3]].map(([a, b, arc]) => ({ a: V(...a), b: V(...b), m: V(...arc.mid) }));
// Radius segments, grown from the centre in step 2.
const radii = computed(() => {
  const g = s.step.value === 1 ? k.value : 1, p = P.value;
  return [[4, 1], [4, 2], [5, 3], [5, 0]].map(([c, e]) => [p[c], [p[c][0] + (p[e][0] - p[c][0]) * g, p[c][1] + (p[e][1] - p[c][1]) * g]]);
});
// Step 3 on: a right-angle mark at each tangent joint (line direction u, radius direction w toward the centre).
const JOINTS = [[0, 1, 5], [1, 0, 4], [2, 3, 4], [3, 2, 5]];
const marks = computed(() => {
  if (s.step.value < 2) return [];
  const p = P.value, shown = s.step.value === 2 ? Math.ceil(k.value * 4) : 4;
  return JOINTS.slice(0, shown).map(([j, along, c], i) => {
    const u = [p[along][0] - p[j][0], p[along][1] - p[j][1]], w = [p[c][0] - p[j][0], p[c][1] - p[j][1]], lu = Math.hypot(...u) || 1, lw = Math.hypot(...w) || 1, m = 6;
    const a = [p[j][0] + u[0] / lu * m, p[j][1] + u[1] / lu * m], b = [p[j][0] + w[0] / lw * m, p[j][1] + w[1] / lw * m];
    return { d: `M${f1(a[0])},${f1(a[1])} L${f1(a[0] + b[0] - p[j][0])},${f1(a[1] + b[1] - p[j][1])} L${f1(b[0])},${f1(b[1])}`, dev: s.step.value === 2 ? num(DEV[i], 1) + '°' : '', at: p[j], up: j >= 2 };
  });
});
// Step 7: each arc's sweep drawn inside it, start to end.
const sweeps = computed(() => {
  if (s.step.value !== 6) return [];
  const x = xAt.value;
  return [[1, 2, 8], [3, 0, 10]].map(([a, b, c]) => {
    const cc = [x[c], x[c + 1]], t0 = Math.atan2(x[2 * a + 1] - cc[1], x[2 * a] - cc[0]);
    let sw = Math.atan2(x[2 * b + 1] - cc[1], x[2 * b] - cc[0]) - t0; while (sw <= 0) sw += 2 * Math.PI;
    const n = Math.max(2, Math.round(24 * k.value)), pts = Array.from({ length: n + 1 }, (_, i) => V(cc[0] + 2.4 * Math.cos(t0 + sw * k.value * i / n), cc[1] + 2.4 * Math.sin(t0 + sw * k.value * i / n)));
    return pts.map(q => f1(q[0]) + ',' + f1(q[1])).join(' ');
  });
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Arcs in the studio's sketch: centres, radius segments, tangent angles" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A hand-drawn slot of two lines and two arcs solved into an exact slot; each arc carried as a centre point and two equal radius segments">
        <text x="12" y="20" class="readout">{{ readout }}</text>
        <polyline v-if="s.step.value >= 3" :points="DRAWN_OUTLINE" class="drawn" />
        <g v-if="s.step.value === 0">
          <line v-for="(c, i) in chords" :key="'ch' + i" :x1="c.a[0]" :y1="c.a[1]" :x2="c.b[0]" :y2="c.b[1]" class="chord" />
          <line v-for="(c, i) in chords" :key="'cn' + i" :x1="c.m[0]" :y1="c.m[1]" :x2="centreSlide[i][0]" :y2="centreSlide[i][1]" class="normal" />
        </g>
        <polyline :points="path" class="shape" />
        <line v-for="(r, i) in (s.step.value >= 1 ? radii : [])" :key="'r' + i" :x1="r[0][0]" :y1="r[0][1]" :x2="r[1][0]" :y2="r[1][1]" class="radius" />
        <polyline v-for="(w, i) in sweeps" :key="'w' + i" :points="w" class="sweep" />
        <path v-for="(m, i) in marks" :key="'m' + i" :d="m.d" class="tangent" />
        <text v-for="(m, i) in marks" :key="'md' + i" :x="m.at[0]" :y="m.at[1] + (m.up ? -9 : 17)" class="dev" text-anchor="middle">{{ m.dev }}</text>
        <circle v-for="i in [0, 1, 2, 3]" :key="'p' + i" :cx="P[i][0]" :cy="P[i][1]" r="3" :class="['pt', { done: s.step.value >= 5 }]" />
        <g v-if="s.step.value >= 1">
          <path v-for="i in [4, 5]" :key="'c' + i" :d="`M${P[i][0] - 4},${P[i][1]} h8 M${P[i][0]},${P[i][1] - 4} v8`" class="centre" />
          <text :x="P[4][0] - 6" :y="P[4][1] - 6" class="cname" text-anchor="end">c₁</text><text :x="P[5][0] + 6" :y="P[5][1] - 5" class="cname">c₃</text>
        </g>
        <g v-else>
          <path v-for="(q, i) in centreSlide" :key="'cs' + i" :d="`M${q[0] - 4},${q[1]} h8 M${q[0]},${q[1] - 4} v8`" class="centre" />
        </g>
        <text v-if="s.step.value >= 2" :x="(P[0][0] + P[1][0]) / 2" :y="P[0][1] + 15" class="mark" text-anchor="middle">H{{ s.step.value >= 5 ? ' · 40' : '' }}</text>
        <text v-if="s.step.value >= 4" :x="P[4][0] - 8" :y="P[4][1] + 4" class="mark" text-anchor="end">R 6</text>
        <g v-if="s.step.value >= 1">
          <text x="12" y="186" class="acct"><tspan class="key">unknowns</tspan> 4 points × 2 + 2 centres × 2 = 12</text>
          <text x="12" y="204" class="acct"><tspan class="key">rows</tspan> {{ rowsText(s.step.value) }}</text>
          <text v-if="dof" x="12" y="224" :class="['acct', 'big', { zero: dof.dof === 0 }]">DOF = 12 − rank {{ dof.rank }} = {{ dof.dof }}{{ dof.dof === 0 ? ' · fully defined' : '' }}</text>
        </g>
      </svg>
      <template #note>Computed in the page with the kernel's loop (the copy in the first figure) on the documents the studio
        builds for this outline; checked against the studio's own run, which gives the same documents and iterates. The
        tangent and equal-radius rows are the studio's inferences on closing this drawing.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.readout { font-weight: 600; fill: var(--vp-c-text-1); }
.drawn { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 3 3; }
.shape { fill: var(--a); fill-opacity: 0.08; stroke: var(--a); stroke-width: 2; stroke-linejoin: round; }
.chord { stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 2 2; }
.normal { stroke: var(--b); stroke-width: 1.3; }
.radius { stroke: var(--b); stroke-width: 1.2; stroke-dasharray: 3 2; }
.sweep { fill: none; stroke: var(--hot); stroke-width: 1.8; }
.tangent { fill: none; stroke: var(--hot); stroke-width: 1.3; }
.dev { font-size: 10px; fill: var(--hot); font-weight: 600; }
.pt { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; } .pt.done { fill: var(--keep); }
.centre { stroke: var(--b); stroke-width: 1.6; }
.cname { font-size: 10px; fill: var(--b); }
.mark { fill: var(--b); font-size: 10px; font-weight: 600; }
.acct { font-size: 11px; } .key { font-weight: 700; fill: var(--vp-c-text-1); }
.big { font-size: 12px; font-weight: 700; fill: var(--vp-c-text-1); } .big.zero { fill: var(--keep); }
</style>
