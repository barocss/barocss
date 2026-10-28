<script setup>
// The orientation flags importStep reads (packages/barocss-cad/src/io/step-import.ts: geoOf, faceOf, surfaceFor), on one
// planar face: a circle of radius 5 mm about +z (#1), vertices A at 200° and B at 340° (#3, #4), an arc edge #5 and a
// chord edge #6, both from A to B. The same records were read by the built kernel (packages/barocss-cad/dist) for all
// eight settings of #5's same_sense, #10's orientation and #11's same_sense: the arc's middle is (0, −5) with .T. and
// (0, 5) with .F. (5 and 7 control points), and checkBrep reports "face sense disagrees with its outer loop" exactly
// when the loop's turning about +z and the face's normal differ — the rule this figure computes.
import { computed, ref, watch } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const DEG = Math.PI / 180, R = 5, SC = 13, CX = 304, CY = 92;
const TA = 200 * DEG, TB = 340 * DEG;
const wrap = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const X = x => CX + SC * x, Y = y => CY - SC * y;
const at = t => [R * Math.cos(t), R * Math.sin(t)];
const A = at(TA), B = at(TB);
/** The arc's sweep from A as the kernel takes it: with the circle (counter-clockwise) or against it. */
const sweepOf = same => (same ? wrap(TB - TA) : -wrap(TA - TB));
const arcPts = (sweep, f = 1) => Array.from({ length: 49 }, (_, j) => at(TA + sweep * f * j / 48));
const poly = ps => ps.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');

const steps = [
  { label: 'An edge\'s curve: same_sense .T.', text: 'A <code>CIRCLE</code> runs counter-clockwise about its axis, here +z. Edge <code>#5</code> runs from vertex A (<code>#3</code>) to B (<code>#4</code>) along it; <i>same_sense</i> <code>.T.</code> says the edge goes the circle\'s way, so from 200° up to 340°: the lower arc, 140°. The kernel writes it as a rational quadratic of 2 spans, at most a quarter turn each.', formula: 'sweep = wrap(θ<sub>B</sub> − θ<sub>A</sub>) = +140° &nbsp; · &nbsp; spans = ⌈|sweep| / 90°⌉ = 2' },
  { label: 'same_sense .F.: the other way round', text: 'With <code>.F.</code> the same two vertices are joined the other way, clockwise: the upper arc, 220°, 3 spans. The flag picks which part of the circle the edge is. A B-spline edge with <code>.F.</code> has its curve reversed; a <code>LINE</code> runs from vertex to vertex either way.', formula: 'sweep = −wrap(θ<sub>A</sub> − θ<sub>B</sub>) = −220° &nbsp; · &nbsp; spans = 3' },
  { label: 'ORIENTED_EDGE: which way the face uses it', text: 'The face\'s loop uses the arc forward (<code>#7</code>, <code>.T.</code>) and the chord <code>#6</code> backwards (<code>#8</code>, <code>.F.</code>), from B to A, so the loop closes. The face on the chord\'s other side would use <code>#6</code> forward: one edge, two coedges running opposite ways.', formula: 'use = { edge, forward = orientation }' },
  { label: 'FACE_BOUND .F.: the loop read backwards', text: 'A bound\'s own flag says whether its loop is to be taken as written. With <code>.F.</code> the kernel reverses the list of uses and turns each one over: the chord forward, then the arc backwards. The loop now runs clockwise.', formula: 'uses′ = reverse(uses), each forward′ = ¬forward' },
  { label: 'ADVANCED_FACE same_sense: which side is out', text: 'The plane\'s own normal is its axis, +z (⊙, out of the page). <i>same_sense</i> <code>.T.</code> keeps it as the face\'s outward normal; <code>.F.</code> turns it over. The face\'s outer loop must run counter-clockwise seen from that normal. Halfway through, the flag flips to <code>.F.</code> and the check fails.', formula: 'sense = forward ⇔ (n<sub>patch</sub> · n<sub>surface</sub> ≥ 0) = same_sense' },
  { label: 'Try the flags', text: 'Set the three flags. Each one turns something over: the arc (which part of the circle), the loop (its direction), the face (its normal). An even number of turns agrees and an odd number does not. The kernel reads the flags as written and does not correct them; <code>checkBrep</code> reports the mismatch.', formula: 'agrees ⇔ loop counter-clockwise about +z = (face same_sense = .T.)' },
];
const s = useSteps(steps.length, [3000, 3000, 3400, 3200, 4200, 12000], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);

// The reader's flags in the last step; the earlier steps set their own.
const user = ref({ edge: true, bound: true, face: true });
watch(() => s.step.value, v => { if (v === 5) user.value = { edge: true, bound: true, face: true }; });
const flags = computed(() => {
  const st = step.value;
  if (st === 1) return { edge: false, bound: true, face: true };
  if (st === 3) return { edge: true, bound: false, face: true };
  if (st === 4) return { edge: true, bound: true, face: s.t.value < 0.5 };
  if (st === 5) return user.value;
  return { edge: true, bound: true, face: true };
});
function toggle(key) { s.pause(); user.value = { ...user.value, [key]: !user.value[key] }; }

const sweep = computed(() => sweepOf(flags.value.edge));
const grow = computed(() => (step.value <= 1 ? Math.max(0.02, k.value) : 1));
const arc = computed(() => poly(arcPts(sweep.value, grow.value)));
const ghost = computed(() => (step.value === 1 ? poly(arcPts(sweepOf(true))) : null));
const region = computed(() => (step.value >= 2 ? poly(arcPts(sweep.value)) : null));
const loopCcw = computed(() => (sweep.value > 0) !== !flags.value.bound);
const agrees = computed(() => loopCcw.value === flags.value.face);

// Arrowheads: on the arc at its middle, on the chord at its middle, each in its use's direction.
function arrow(x, y, dx, dy) {
  const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  return `${x + 5 * ux},${y + 5 * uy} ${x - 4 * ux - 3.4 * uy},${y - 4 * uy + 3.4 * ux} ${x - 4 * ux + 3.4 * uy},${y - 4 * uy - 3.4 * ux}`;
}
const heads = computed(() => {
  if (step.value < 2) {
    const tm = TA + sweep.value * grow.value, sg = Math.sign(sweep.value), [px, py] = at(tm);
    return [{ pts: arrow(X(px), Y(py), -Math.sin(tm) * sg, -Math.cos(tm) * sg), cls: 'arc' }];
  }
  const fwd = flags.value.bound, tm = TA + sweep.value / 2, sg = Math.sign(sweep.value) * (fwd ? 1 : -1), [px, py] = at(tm);
  const out = [{ pts: arrow(X(px), Y(py), -Math.sin(tm) * sg, -Math.cos(tm) * sg), cls: 'arc' }];
  const cy = Y(A[1]), cx = (X(A[0]) + X(B[0])) / 2, dir = fwd ? -1 : 1;
  out.push({ pts: arrow(cx, cy, dir, 0), cls: 'chord' });
  return out;
});
// A dot travelling round the loop in its direction (steps 3 onwards).
const runner = computed(() => {
  if (step.value < 2) return null;
  const sw = sweep.value, lenArc = Math.abs(sw) * R, lenChord = Math.hypot(B[0] - A[0], B[1] - A[1]), u = (s.t.value * 1.6) % 1;
  let d = u * (lenArc + lenChord); const fwd = flags.value.bound;
  if (!fwd) d = lenArc + lenChord - d;
  if (d <= lenArc) { const p = at(TA + sw * d / lenArc); return [X(p[0]), Y(p[1])]; }
  const f = (d - lenArc) / lenChord; return [X(B[0] + (A[0] - B[0]) * f), Y(B[1] + (A[1] - B[1]) * f)];
});
const centre = computed(() => (sweep.value > 0 ? [CX, Y(-3.4)] : [CX, Y(2.2)]));

const flagText = v => (v ? '.T.' : '.F.');
const ROWS = computed(() => [
  { pre: "#1=CIRCLE('',#13,5.)", hot: false },
  { pre: "#2=LINE('',#30,#32)", hot: false },
  { pre: "#5=EDGE_CURVE('',#3,#4,#1,", flag: flagText(flags.value.edge), hot: step.value <= 1 || step.value === 5 },
  { pre: "#6=EDGE_CURVE('',#3,#4,#2,", flag: '.T.', hot: false },
  { pre: "#7=ORIENTED_EDGE('',*,*,#5,", flag: '.T.', hot: step.value === 2 },
  { pre: "#8=ORIENTED_EDGE('',*,*,#6,", flag: '.F.', hot: step.value === 2 },
  { pre: "#9=EDGE_LOOP('',(#7,#8))", hot: false },
  { pre: "#10=FACE_OUTER_BOUND('',#9,", flag: flagText(flags.value.bound), hot: step.value === 3 || step.value === 5 },
  { pre: "#11=ADVANCED_FACE('',(#10),#12,", flag: flagText(flags.value.face), hot: step.value === 4 || step.value === 5 },
  { pre: "#12=PLANE('',#13)", hot: false },
]);
const usesText = computed(() => (flags.value.bound ? 'uses: #5 forward, #6 reversed' : 'uses: #6 forward, #5 reversed'));
const arcText = computed(() => (sweep.value > 0 ? 'arc #5: +140°, 2 spans (5 control points)' : 'arc #5: −220°, 3 spans (7 control points)'));
const loopText = computed(() => `loop: ${loopCcw.value ? 'counter-clockwise' : 'clockwise'} about +z · face normal ${flags.value.face ? '+z' : '−z'}`);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Four flags that turn things over" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A planar face bounded by a circular arc and a chord; its STEP records with their orientation flags beside it">
        <g v-for="(r, i) in ROWS" :key="i">
          <rect v-if="r.hot" x="5" :y="18 + 15 * i - 10" width="222" height="13" rx="2" class="hotrow" />
          <text x="8" :y="18 + 15 * i" class="code">{{ r.pre }}<tspan v-if="r.flag" :class="{ flag: r.hot }">{{ r.flag }}</tspan>{{ r.flag ? ')' : '' }}</text>
        </g>
        <circle :cx="CX" :cy="CY" :r="SC * R" class="circle" />
        <polygon v-if="region" :points="region" class="region" :class="{ bad: !agrees && step >= 4 }" />
        <polyline v-if="ghost" :points="ghost" class="ghost" />
        <polyline :points="arc" class="arc" />
        <line v-if="step >= 2" :x1="X(A[0])" :y1="Y(A[1])" :x2="X(B[0])" :y2="Y(B[1])" class="chord" />
        <polygon v-for="(h, i) in heads" :key="'h' + i" :points="h.pts" class="head" :class="h.cls" />
        <g v-if="step === 2">
          <line :x1="CX - 18" :y1="Y(A[1]) - 7" :x2="CX + 18" :y2="Y(A[1]) - 7" class="neighbour" />
          <polygon :points="arrow(CX + 20, Y(A[1]) - 7, 1, 0)" class="neighbour-head" />
          <text :x="CX" :y="Y(A[1]) - 13" text-anchor="middle" class="small">the other face's use: .T.</text>
        </g>
        <circle v-if="runner" :cx="runner[0]" :cy="runner[1]" r="3" class="runner" />
        <circle :cx="X(A[0])" :cy="Y(A[1])" r="3" class="vertex" /><circle :cx="X(B[0])" :cy="Y(B[1])" r="3" class="vertex" />
        <text :x="X(A[0]) - 6" :y="Y(A[1]) + 4" text-anchor="end" class="small">A</text>
        <text :x="X(B[0]) + 6" :y="Y(B[1]) + 4" class="small">B</text>
        <g v-if="step >= 4">
          <circle :cx="centre[0]" :cy="centre[1]" r="6" class="normal" :class="{ bad: !agrees }" />
          <circle v-if="flags.face" :cx="centre[0]" :cy="centre[1]" r="1.8" class="normal-dot" :class="{ bad: !agrees }" />
          <path v-else :d="`M ${centre[0] - 4} ${centre[1] - 4} L ${centre[0] + 4} ${centre[1] + 4} M ${centre[0] + 4} ${centre[1] - 4} L ${centre[0] - 4} ${centre[1] + 4}`" class="normal-x" :class="{ bad: !agrees }" />
        </g>
        <text x="8" y="186" class="readout">{{ arcText }}</text>
        <text v-if="step >= 2" x="8" y="201" class="readout">{{ usesText }}</text>
        <text v-if="step >= 2" x="8" y="216" class="readout">{{ loopText }}</text>
        <text v-if="step >= 4" x="8" y="236" class="readout verdict" :class="{ bad: !agrees }">{{ agrees ? '→ the loop and the normal agree' : '→ checkBrep: face sense disagrees with its outer loop' }}</text>
      </svg>
      <div v-if="step === 5" class="ops" role="group" aria-label="Flags">
        <span>#5 same_sense</span><button type="button" :aria-pressed="!user.edge" @click="toggle('edge')">{{ flagText(user.edge) }}</button>
        <span>#10 orientation</span><button type="button" :aria-pressed="!user.bound" @click="toggle('bound')">{{ flagText(user.bound) }}</button>
        <span>#11 same_sense</span><button type="button" :aria-pressed="!user.face" @click="toggle('face')">{{ flagText(user.face) }}</button>
      </div>
      <template #note>One planar face drawn alone, seen from +z; in a solid each edge is used by two faces. A button pressed
        shows its flag at <code>.F.</code>. The verdict is the rule above; the kernel gave the same verdict for all eight
        settings of these records.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
svg text.code { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.hotrow { fill: color-mix(in srgb, var(--a) 16%, transparent); }
tspan.flag { font-weight: 700; fill: var(--hot); }
.circle { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 3 3; }
.region { fill: color-mix(in srgb, var(--keep) 16%, transparent); stroke: none; transition: fill .3s; }
.region.bad { fill: color-mix(in srgb, var(--hot) 16%, transparent); }
.ghost { fill: none; stroke: var(--a); stroke-width: 1.2; stroke-dasharray: 4 3; opacity: 0.45; }
.arc { fill: none; stroke: var(--a); stroke-width: 2.6; stroke-linecap: round; }
.chord { stroke: var(--b); stroke-width: 2.2; }
.head.arc { fill: var(--a); stroke: none; } .head.chord { fill: var(--b); stroke: none; }
.neighbour { stroke: var(--b); stroke-width: 1.2; stroke-dasharray: 3 2; }
.neighbour-head { fill: var(--b); opacity: 0.8; }
.runner { fill: var(--vp-c-text-1); stroke: var(--vp-c-bg); stroke-width: 1; }
.vertex { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.5; }
.small { font-size: 10px; }
.normal { fill: var(--vp-c-bg); stroke: var(--keep); stroke-width: 1.6; }
.normal-dot { fill: var(--keep); } .normal-x { stroke: var(--keep); stroke-width: 1.6; }
.normal.bad { stroke: var(--hot); } .normal-dot.bad { fill: var(--hot); } .normal-x.bad { stroke: var(--hot); }
.readout { font-size: 11px; fill: var(--vp-c-text-1); }
.verdict { font-weight: 600; fill: var(--keep); }
.verdict.bad { fill: var(--hot); }
.ops { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 12px 12px; font-size: 12px; }
.ops button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 9px; font-size: 12px; font-weight: 600; font-family: var(--vp-font-family-mono); background: var(--vp-c-bg); }
.ops button[aria-pressed="true"] { background: var(--vp-c-text-1); color: var(--vp-c-bg); }
.ops span { color: var(--vp-c-text-2); margin-left: 4px; }
</style>
