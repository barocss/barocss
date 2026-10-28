<script setup>
// The density setting on a curved face: a cylinder of radius 10 mm and height 12 mm (cad.model, circle extruded),
// seen as its circular edge. Its samples are the kernel's angular grid (brep-tessellate.ts `edgeParameters`: step
// π / (2q)). The numbers were measured with the built kernel (packages/barocss-cad/dist, tessellateBrep) at q = 1, 2,
// 3, 4, 8, 16, 32, 64 and agree with the closed forms used here: the largest chord sagitta r(1 − cos(π / 4q)),
// 16q − 4 triangles (two caps of 4q − 2, a wall of 8q), and a volume short by 1 − 4q·sin(π / 2q) / 2π.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const CX = 98, CY = 122, RP = 84;
const sagitta = (r, q) => r * (1 - Math.cos(Math.PI / 4 / q));
const volumeShort = q => 1 - 4 * q * Math.sin(Math.PI / 2 / q) / (2 * Math.PI);
const onCircle = a => [CX + RP * Math.cos(a), CY - RP * Math.sin(a)];
const circlePath = `M${CX + RP},${CY}A${RP},${RP} 0 1 0 ${CX - RP},${CY}A${RP},${RP} 0 1 0 ${CX + RP},${CY}Z`;
// The plot: q from 1 to 64 (log 2) across, sagitta in mm from 100 down to 10⁻⁴ (log 10).
const PX = q => 214 + 25.5 * Math.log2(q), PY = mm => 24 + 29.5 * (2 - Math.log10(mm));
const qTicks = [1, 2, 4, 8, 16, 32, 64], yTicks = [[100, '100'], [10, '10'], [1, '1'], [0.1, '0.1'], [0.01, '0.01'], [0.001, '10⁻³'], [0.0001, '10⁻⁴']];
const curve = r => qTicks.map(q => `${PX(q)},${PY(sagitta(r, q))}`).join(' ');

const steps = [
  { label: 'One chord a quarter', text: 'The edge of a cylinder of radius 10 mm, with q = 1 segment a quarter: four chords. Between each chord and the arc lies a sliver of the solid that the mesh leaves out (red). Its depth is the sagitta, the chord\'s largest distance from the arc.', formula: 'step = π / (2q) = 90° / q · sagitta s = r (1 − cos(π / (4q)))' },
  { label: 'q = 2', text: 'The new grid has a point between each pair of old ones, and the old points stay where they were. Each new point starts on its chord\'s middle and rises to the arc: the chord there was short of the arc by exactly s. Halving the step divides the sagitta by about 4.', formula: 's ≈ π² r / (32 q²) for large q' },
  { label: 'q = 4', text: 'Sixteen chords. The red slivers are now thin. The count of triangles grows linearly with q: here two caps of 4q − 2 triangles and a wall of 8q.', formula: 'triangles = 16q − 4 for this cylinder' },
  { label: 'q = 8, the default', text: '<code>tessellateBrep</code> uses q = 8 when none is given: 32 chords around, 11.25° each, a sagitta under 0.05 mm at this radius. The red slivers are now thinner than the line drawing the circle.', formula: 's = 10 × (1 − cos(π / 32)) = 0.048 mm' },
  { label: 'q = 16, for STL', text: '<code>exportStl</code> uses q = 16 when none is given: s = 0.012 mm here. The kernel\'s test checks that the error shrinks this way: the cylinder\'s volume error falls by more than 12 times from q = 8 to q = 32 (it is 16 times here).', formula: 'volume short by 0.64 % at q = 8, 0.04 % at q = 32' },
  { label: 'A count, not a tolerance', text: 'q counts segments; it does not bound the error in millimetres. The same q gives a sagitta 10 times larger on a circle 10 times larger. The kernel takes the whole part of q and clamps it to 1 … 64. Choose q and the radius below.', formula: 's ∝ r / q² · q = clamp(⌊q⌋, 1, 64)' },
];
const s = useSteps(steps.length, [2600, 3000, 3000, 3000, 3400, 8000], root);
const e = computed(() => ease(s.t.value));
const chosen = ref(8), radius = ref(10);
const q = computed(() => s.step.value < 5 ? 2 ** s.step.value : chosen.value);
const r = computed(() => s.step.value < 5 ? 10 : radius.value);
// The polygon's points: at a step that doubles q, the new (odd) points rise from their chord's middle to the circle.
const points = computed(() => {
  const n = 4 * q.value, k = s.step.value, rising = k >= 1 && k < 5, f = e.value, out = [];
  for (let j = 0; j < n; j++) {
    const a = j * Math.PI / 2 / q.value, p = onCircle(a);
    if (rising && j % 2 === 1) {
      const m0 = onCircle((j - 1) * Math.PI / 2 / q.value), m1 = onCircle((j + 1) * Math.PI / 2 / q.value), m = [(m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2];
      out.push([m[0] + (p[0] - m[0]) * f, m[1] + (p[1] - m[1]) * f]);
    } else out.push(p);
  }
  return out;
});
const polygon = computed(() => 'M' + points.value.map(p => `${p[0]},${p[1]}`).join('L') + 'Z');
const dot = computed(() => Math.max(1.2, Math.min(3.6, 16 / Math.sqrt(4 * q.value))));
// The sagitta of the chord from 0 to one step, marked.
const mark = computed(() => {
  const h = Math.PI / 4 / q.value, a = onCircle(h), d = RP * (1 - Math.cos(h));
  return { x1: a[0], y1: a[1], x2: CX + (RP - d) * Math.cos(h), y2: CY - (RP - d) * Math.sin(h), show: d > 3 };
});
const visited = computed(() => s.step.value < 5 ? qTicks.filter(x => x <= q.value) : qTicks);
const readout = computed(() => `q = ${q.value} · ${4 * q.value} chords · s = ${num(sagitta(r.value, q.value), sagitta(r.value, q.value) < 0.01 ? 5 : 3)} mm · ${16 * q.value - 4} triangles · volume −${num(100 * volumeShort(q.value), 2)} %`);
const setQ = ev => { chosen.value = Math.max(1, Math.min(64, Math.floor(+ev.target.value || 1))); };
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Density: segments per quarter and the chord error" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A circle drawn as a polygon of more and more chords, and a plot of the chord's sagitta against segments per quarter">
        <path :d="circlePath + polygon" fill-rule="evenodd" class="lost" :style="{ opacity: s.step.value === 0 ? e : 1 }" />
        <path :d="polygon" class="poly" :style="{ opacity: s.step.value === 0 ? e : 1 }" />
        <circle :cx="CX" :cy="CY" :r="RP" class="arc" />
        <circle v-for="(p, i) in points" :key="i" :cx="p[0]" :cy="p[1]" :r="dot" class="pt" :class="{ fresh: s.step.value >= 1 && s.step.value < 5 && i % 2 === 1 }" />
        <g v-if="mark.show">
          <line :x1="mark.x1" :y1="mark.y1" :x2="mark.x2" :y2="mark.y2" class="sag" />
          <text :x="mark.x1 + 6" :y="mark.y1 - 3" class="sagl">s</text>
        </g>
        <text :x="CX" :y="CY + 4" text-anchor="middle" class="tag">r = {{ r }} mm</text>
        <!-- the plot -->
        <g class="axes">
          <line v-for="[v] in yTicks" :key="'gy' + v" :x1="PX(1)" :x2="PX(64)" :y1="PY(v)" :y2="PY(v)" class="grid" />
          <text v-for="[v, l] in yTicks" :key="'ly' + v" :x="PX(1) - 4" :y="PY(v) + 3.5" text-anchor="end" class="tick">{{ l }}</text>
          <text v-for="x in qTicks" :key="'lx' + x" :x="PX(x)" :y="PY(1e-4) + 13" text-anchor="middle" class="tick">{{ x }}</text>
          <text :x="PX(8)" :y="PY(1e-4) + 26" text-anchor="middle" class="tick">segments a quarter, q</text>
          <text :x="PX(1)" :y="13" class="tick">sagitta, mm</text>
        </g>
        <polyline v-if="s.step.value === 5 && radius === 100" :points="curve(10)" class="trend faint" />
        <polyline :points="curve(r)" class="trend" :style="{ opacity: s.step.value < 5 ? 0.35 : 1 }" />
        <circle v-for="x in visited" :key="'pq' + x" :cx="PX(x)" :cy="PY(sagitta(r, x))" r="3.4" class="ppt" />
        <circle :cx="PX(q)" :cy="PY(sagitta(r, q))" r="5.5" class="pnow" />
        <text x="12" y="243" class="readout">{{ readout }}</text>
      </svg>
      <div v-if="s.step.value === 5" class="ops">
        <label>q <input type="range" min="1" max="64" step="1" :value="chosen" aria-label="Segments per quarter" @input="setQ" /> {{ chosen }}</label>
        <span role="group" aria-label="Radius">
          <button v-for="x in [10, 100]" :key="x" type="button" :aria-pressed="radius === x" @click="radius = x">r = {{ x }} mm</button>
        </span>
      </div>
      <template #note>The circle is the cylinder's top edge; the wall's rulings and the caps' triangles use the same points.
        The red slivers and the sagitta mark are drawn to scale with the circle. Triangle counts and volumes are this
        cylinder's, as the kernel gives them.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.lost { fill: var(--hot); opacity: 0.85; }
.poly { fill: color-mix(in srgb, var(--a) 18%, transparent); stroke: var(--a); stroke-width: 1.4; stroke-linejoin: round; }
.arc { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 3 3; }
.pt { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; }
.pt.fresh { fill: var(--b); }
.sag { stroke: var(--vp-c-text-1); stroke-width: 1.6; }
.sagl { font-size: 12px; font-style: italic; font-weight: 700; fill: var(--vp-c-text-1); }
.tag { font-size: 11px; fill: var(--a); font-weight: 600; }
.grid { stroke: var(--vp-c-divider); stroke-width: 1; }
.tick { font-size: 10px; fill: var(--vp-c-text-2); }
.trend { fill: none; stroke: var(--hot); stroke-width: 1.4; stroke-dasharray: 4 3; transition: opacity .3s; }
.trend.faint { opacity: 0.3; }
.ppt { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.pnow { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.8; }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
.ops { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 8px 12px 12px; font-size: 12px; }
.ops label { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.ops input { width: 160px; accent-color: var(--vp-c-brand-1); }
.ops span { display: flex; gap: 6px; }
.ops button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 9px; font-size: 12px; font-weight: 600; background: var(--vp-c-bg); }
.ops button[aria-pressed="true"] { background: var(--vp-c-text-1); color: var(--vp-c-bg); }
</style>
