<script setup>
// Degrees of freedom as constraints are added one at a time to the quad of SketchSolve.vue. Each stage is solved by the
// kernel's loop (the copy in SketchSolve.vue) from the previous stage's result, as the studio re-solves after an edit;
// DOF = unknowns − rank J with the kernel's rank. The arrows: each point's share of the null space of J at the
// solution (the moves δ with J δ = 0), from an orthonormal basis of J's rows.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';
import { evaluate, solveTrace } from './SketchSolve.vue';

const root = ref(null);
const DEG = Math.PI / 180;
const POINTS = ['p0', 'p1', 'p2', 'p3'], SEGMENTS = { s0: ['p0', 'p1'], s1: ['p1', 'p2'], s2: ['p2', 'p3'], s3: ['p3', 'p0'] };
const ADDED = [
  { c: { id: 'anchor', kind: 'fixed', pointId: 'p0', target: [0, 0] }, label: 'fixed p₀', segs: [] },
  { c: { id: 'h0', kind: 'horizontal', segmentId: 's0' }, label: 's₀ horizontal', segs: ['s0'] },
  { c: { id: 'v3', kind: 'vertical', segmentId: 's3' }, label: 's₃ vertical', segs: ['s3'] },
  { c: { id: 'l0', kind: 'length', segmentId: 's0', length: 40 }, label: '|s₀| = 40', segs: ['s0'] },
  { c: { id: 'l3', kind: 'length', segmentId: 's3', length: 24 }, label: '|s₃| = 24', segs: ['s3'] },
  { c: { id: 'a01', kind: 'signed-angle', segmentA: 's0', segmentB: 's1', angle: 100 * DEG }, label: '∠(s₀, s₁) = 100°', segs: ['s0', 's1'] },
  { c: { id: 'h2', kind: 'horizontal', segmentId: 's2' }, label: 's₂ horizontal', segs: ['s2'] },
  { c: { id: 'par', kind: 'signed-angle', segmentA: 's0', segmentB: 's2', angle: Math.PI }, label: 's₂ ∥ s₀ (180°)', segs: ['s0', 's2'] },
];
const DRAWN = [0, 0, 36, 3, 30, 19, -3, 21];

/** Each point's free moves: the 2 × 2 block of the null-space projector I − Σ b bᵀ, split into its eigen-directions. */
function freedoms(J, n) {
  const basis = [];
  for (const row of J) {
    const l0 = Math.hypot(...row); if (!(l0 > 0)) continue;
    const w = row.map(v => v / l0);
    for (let pass = 0; pass < 2; pass++) for (const b of basis) { let d = 0; for (let i = 0; i < n; i++) d += w[i] * b[i]; for (let i = 0; i < n; i++) w[i] -= d * b[i]; }
    const l = Math.hypot(...w); if (l > 1e-8) basis.push(w.map(v => v / l));
  }
  return Array.from({ length: n / 2 }, (_, i) => {
    let a = 1, c = 0, d = 1;
    for (const b of basis) { a -= b[2 * i] * b[2 * i]; c -= b[2 * i] * b[2 * i + 1]; d -= b[2 * i + 1] * b[2 * i + 1]; }
    const m = (a + d) / 2, r = Math.hypot((a - d) / 2, c), l1 = m + r, l2 = m - r;
    let e = Math.abs(c) > 1e-12 ? [l1 - d, c] : a >= d ? [1, 0] : [0, 1]; const le = Math.hypot(...e); e = [e[0] / le, e[1] / le];
    const dirs = l1 > 1e-6 ? (l2 > 1e-6 ? [e, [-e[1], e[0]]] : [e]) : [];
    return dirs;
  });
}
// The stages, each solved from the one before.
const STAGES = [];
{
  let x = DRAWN;
  ADDED.forEach((_, n) => {
    const sk = { points: POINTS, segments: SEGMENTS, constraints: ADDED.slice(0, n + 1).map(a => a.c) };
    const r = solveTrace(sk, x), end = r.its.at(-1).x;
    STAGES.push({ its: r.its.map(t => t.x), rank: r.rank, rows: r.rows, dof: r.dof, free: freedoms(evaluate(sk, end).jacobian, end.length) });
    x = end;
  });
}

const S = 4.6, OX = 46, OY = 184;
const V = (x, y) => [OX + S * x, OY - S * y];
const P = x => [0, 1, 2, 3].map(i => V(x[2 * i], x[2 * i + 1]));
const poly = ps => ps.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
const drawnPts = P(DRAWN);
const segEnds = id => SEGMENTS[id].map(p => POINTS.indexOf(p));

const say = n => `DOF = unknowns − rank J = 8 − ${STAGES[n].rank} = ${STAGES[n].dof}`;
const steps = [
  { label: 'Anchored: six freedoms', text: 'Eight unknowns, the x and y of four points. The studio fixes point 1 where it was drawn: two equations, rank 2. Every other point can still move both ways. The arrows show, for each point, the moves that keep every constraint so far (to first order).', formula: say(0) },
  { label: 's₀ horizontal', text: 'One more equation, y₁ − y₀ = 0. The solve levels s₀ from the shape before; a point no equation involves has a zero column in J and does not move at all. p₁ can now slide only along x.', formula: say(1) },
  { label: 's₃ vertical', text: 'x₀ − x₃ = 0: p₃ comes above p₀ and can slide only up and down.', formula: say(2) },
  { label: 'Length of s₀', text: '|s₀| − 40 = 0. With p₀ fixed and s₀ level, p₁ has nowhere left to go.', formula: say(3) },
  { label: 'Length of s₃', text: '|s₃| − 24 = 0 locks p₃ in the same way. Only p₂ is free, in both directions.', formula: say(4) },
  { label: 'Angle at p₁', text: 'The direction of s₁, 100° from s₀\'s, leaves p₂ one move: along the line of s₁.', formula: say(5) },
  { label: 's₂ horizontal: fully defined', text: `p₂ must also be level with p₃: the two lines meet in one point. Rank ${STAGES[6].rank} = 8 unknowns, no arrow left. The studio's status reads <b>Fully defined</b>.`, formula: say(6) },
  { label: 'One too many: redundant', text: `A ninth equation, the angle from s₀ to s₂ = 180° (parallel). It already holds and adds nothing new: s₀ and s₂ are both horizontal, so its row is a combination of the others. The rank stays ${STAGES[7].rank} with ${STAGES[7].rows} rows. The studio refuses such an addition: "… is already implied by the other constraints — adding it would over-define the sketch"; an outline that has one reads <b>Over-defined · 1 redundant constraint — remove one</b>.`, formula: `redundant = rows − rank = ${STAGES[7].rows} − ${STAGES[7].rank} = ${STAGES[7].rows - STAGES[7].rank} &nbsp; ${say(7)}` },
];
const s = useSteps(steps.length, [2600, 2600, 2400, 2400, 2400, 2800, 2800, 3400], root);
const stage = computed(() => STAGES[s.step.value]);
// The shape moves along the stage's iterates in the first 55 % of the step; then its arrows grow.
const pts = computed(() => {
  const its = stage.value.its, u = Math.min(1, s.t.value / 0.55), f = ease(u) * (its.length - 1), i = Math.min(its.length - 2, Math.floor(f));
  if (its.length < 2) return P(its[0]);
  const w = Math.min(1, f - i); return P(its[i].map((v, j) => v + (its[i + 1][j] - v) * w));
});
const grow = computed(() => Math.max(0, Math.min(1, (s.t.value - 0.55) / 0.3)));
const ARROW = 14;
function arrow(p, e, L) {
  const a = [p[0] - e[0] * L, p[1] + e[1] * L], b = [p[0] + e[0] * L, p[1] - e[1] * L], n = [e[1], e[0]];
  const head = (q, sgn) => { const t = [q[0] - sgn * e[0] * 4.5, q[1] + sgn * e[1] * 4.5]; return poly([q, [t[0] + n[0] * 2.6, t[1] + n[1] * 2.6], [t[0] - n[0] * 2.6, t[1] - n[1] * 2.6]]); };
  return { line: [a, b], heads: [head(b, 1), head(a, -1)] };
}
const arrows = computed(() => {
  const L = ARROW * ease(grow.value); if (L < 1) return [];
  return stage.value.free.flatMap((dirs, i) => dirs.map(e => arrow(pts.value[i], e, L)));
});
const locked = computed(() => (grow.value > 0 ? stage.value.free.map((d, i) => (d.length ? null : pts.value[i])).filter(Boolean) : []));
const hotSegs = computed(() => ADDED[s.step.value].segs.map(segEnds));
const redundant = computed(() => s.step.value === 7);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Counting the freedom left: the rank of the Jacobian" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="Constraints added one at a time to a quadrilateral; arrows show each point's remaining free motions and the count of degrees of freedom falls to zero">
        <text x="12" y="20" class="readout">8 unknowns − rank {{ stage.rank }} = {{ stage.dof }} DOF</text>
        <polygon :points="poly(drawnPts)" class="drawn" />
        <polygon :points="poly(pts)" class="shape" />
        <line v-for="(e, i) in hotSegs" :key="'h' + i" :x1="pts[e[0]][0]" :y1="pts[e[0]][1]" :x2="pts[e[1]][0]" :y2="pts[e[1]][1]" :class="redundant ? 'hot-seg' : 'new-seg'" />
        <g v-for="(a, i) in arrows" :key="'a' + i">
          <line :x1="a.line[0][0]" :y1="a.line[0][1]" :x2="a.line[1][0]" :y2="a.line[1][1]" class="arrow" />
          <polygon v-for="(hd, j) in a.heads" :key="j" :points="hd" class="head" />
        </g>
        <rect v-for="(q, i) in locked" :key="'k' + i" :x="q[0] - 5" :y="q[1] - 5" width="10" height="10" rx="1.5" class="lock" />
        <circle v-for="(p, i) in pts" :key="'p' + i" :cx="p[0]" :cy="p[1]" r="3.2" :class="['pt', { done: stage.dof === 0 }]" />
        <text v-for="(p, i) in pts" :key="'l' + i" :x="p[0] + (i === 0 || i === 3 ? -9 : 9)" :y="p[1] + (i < 2 ? 14 : -8)" :text-anchor="i === 0 || i === 3 ? 'end' : 'start'" class="name">p{{ ['₀', '₁', '₂', '₃'][i] }}</text>
        <g class="list">
          <text x="262" y="40" class="list-title">constraints</text>
          <text v-for="(a, i) in ADDED.slice(0, s.step.value + 1)" :key="'c' + i" x="262" :y="58 + 16 * i" :class="['item', { now: i === s.step.value, extra: i === 7 }]">{{ a.label }}</text>
          <text x="262" y="206" :class="['dof', { zero: stage.dof === 0 }]">{{ stage.dof }} DOF</text>
          <text x="262" y="222" :class="['rows', { extra: redundant }]">rows {{ stage.rows }} · rank {{ stage.rank }}</text>
        </g>
        <text v-if="redundant" x="12" y="232" class="msg">Over-defined · 1 redundant constraint — remove one</text>
        <text v-else-if="stage.dof === 0" x="12" y="232" class="ok">Fully defined</text>
      </svg>
      <template #note>Each stage solved in the page by the kernel's loop from the stage before, as the studio re-solves after
        an edit. The arrows are first-order moves: a length keeps its value only along the arrow's tangent, not along the
        straight arrow itself.</template>
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
.new-seg { stroke: var(--a); stroke-width: 7; stroke-linecap: round; opacity: 0.25; }
.hot-seg { stroke: var(--hot); stroke-width: 7; stroke-linecap: round; opacity: 0.45; }
.arrow { stroke: var(--b); stroke-width: 1.8; } .head { fill: var(--b); }
.lock { fill: var(--vp-c-bg); stroke: var(--vp-c-text-2); stroke-width: 1.4; }
.pt { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; } .pt.done { fill: var(--keep); }
.name { font-size: 10px; }
.list-title { font-size: 10px; font-weight: 600; fill: var(--vp-c-text-3); }
.item { font-size: 11px; } .item.now { font-weight: 700; fill: var(--b); } .item.extra { fill: var(--hot); }
.dof { font-size: 16px; font-weight: 700; fill: var(--vp-c-text-1); } .dof.zero { fill: var(--keep); }
.rows { font-size: 10px; } .rows.extra { fill: var(--hot); font-weight: 600; }
.msg { fill: var(--hot); font-weight: 600; }
.ok { fill: var(--keep); font-weight: 700; }
</style>
