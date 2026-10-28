<script setup>
// A Boolean of two upright extrusions, slab by slab (packages/barocss-cad/src/features/prismatic-solid.ts,
// `booleanPrismatic` and `normalize`). A is a 10 × 6 box from z = 0 to 4; B a circle of radius 2 from z = 2 to 6, either
// across A's right side (centre (10, 3)) or inside A (centre (6, 3)). Every section, area, merge test and volume below
// was computed by the built kernel (packages/barocss-cad/dist/index.js) from a script: prismaticFromProfile for A and B,
// booleanCurveRegions for each interval's sections, its 'xor' of neighbouring sections for the merge test, and
// booleanPrismatic, prismaticVolume and brepFromPrismatic for the result. Paths are the sections' own lines and arcs, in mm.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const DATA = {"placements":{"across":{"a":"M0 0L10 0L10 6L0 6L0 0Z","b":"M12 3A2 2 0 0 1 8 3A2 2 0 0 1 12 3Z","levels":[0,2,4,6],"ops":{"union":{"intervals":[{"z0":0,"z1":2,"hasA":true,"hasB":false,"path":"M0 0L10 0L10 6L0 6L0 0Z","area":60,"x":[0,10]},{"z0":2,"z1":4,"hasA":true,"hasB":true,"path":"M0 0L10 0L10 1A2 2 0 0 1 10 5L10 6L0 6L0 0Z","area":66.283,"x":[0,12]},{"z0":4,"z1":6,"hasA":false,"hasB":true,"path":"M12 3A2 2 0 0 1 8 3A2 2 0 0 1 12 3Z","area":12.566,"x":[8,12]}],"merges":[{"z":2,"equal":false,"empty":false,"xor":"M10 5L10 1A2 2 0 0 1 10 5Z","xorArea":6.283},{"z":4,"equal":false,"empty":false,"xor":"M0 0L10 0L10 1A2 2 0 0 0 10 5L10 6L0 6L0 0Z","xorArea":53.717}],"slabs":[{"z0":0,"z1":2,"area":60,"x":[0,10],"path":"M0 0L10 0L10 6L0 6L0 0Z"},{"z0":2,"z1":4,"area":66.283,"x":[0,12],"path":"M0 0L10 0L10 1A2 2 0 0 1 10 5L10 6L0 6L0 0Z"},{"z0":4,"z1":6,"area":12.566,"x":[8,12],"path":"M12 3A2 2 0 0 1 8 3A2 2 0 0 1 12 3Z"}],"volume":277.699,"faces":14},"difference":{"intervals":[{"z0":0,"z1":2,"hasA":true,"hasB":false,"path":"M0 0L10 0L10 6L0 6L0 0Z","area":60,"x":[0,10]},{"z0":2,"z1":4,"hasA":true,"hasB":true,"path":"M0 0L10 0L10 1A2 2 0 0 0 10 5L10 6L0 6L0 0Z","area":53.717,"x":[0,10]},{"z0":4,"z1":6,"hasA":false,"hasB":true,"path":"","area":0,"x":null}],"merges":[{"z":2,"equal":false,"empty":false,"xor":"M10 1L10 5A2 2 0 0 1 10 1Z","xorArea":6.283},{"z":4,"equal":false,"empty":true,"xor":""}],"slabs":[{"z0":0,"z1":2,"area":60,"x":[0,10],"path":"M0 0L10 0L10 6L0 6L0 0Z"},{"z0":2,"z1":4,"area":53.717,"x":[0,10],"path":"M0 0L10 0L10 1A2 2 0 0 0 10 5L10 6L0 6L0 0Z"}],"volume":227.434,"faces":10},"intersection":{"intervals":[{"z0":0,"z1":2,"hasA":true,"hasB":false,"path":"","area":0,"x":null},{"z0":2,"z1":4,"hasA":true,"hasB":true,"path":"M10 1L10 5A2 2 0 0 1 10 1Z","area":6.283,"x":[8,10]},{"z0":4,"z1":6,"hasA":false,"hasB":true,"path":"","area":0,"x":null}],"merges":[{"z":2,"equal":false,"empty":true,"xor":""},{"z":4,"equal":false,"empty":true,"xor":""}],"slabs":[{"z0":2,"z1":4,"area":6.283,"x":[8,10],"path":"M10 1L10 5A2 2 0 0 1 10 1Z"}],"volume":12.566,"faces":4}}},"inside":{"a":"M0 0L10 0L10 6L0 6L0 0Z","b":"M8 3A2 2 0 0 1 4 3A2 2 0 0 1 8 3Z","levels":[0,2,4,6],"ops":{"union":{"intervals":[{"z0":0,"z1":2,"hasA":true,"hasB":false,"path":"M0 0L10 0L10 6L0 6L0 0Z","area":60,"x":[0,10]},{"z0":2,"z1":4,"hasA":true,"hasB":true,"path":"M0 0L10 0L10 6L0 6L0 0Z","area":60,"x":[0,10]},{"z0":4,"z1":6,"hasA":false,"hasB":true,"path":"M8 3A2 2 0 0 1 4 3A2 2 0 0 1 8 3Z","area":12.566,"x":[4,8]}],"merges":[{"z":2,"equal":true,"empty":false,"xor":"","xorArea":0},{"z":4,"equal":false,"empty":false,"xor":"M0 0L10 0L10 6L0 6L0 0ZM4 3A2 2 0 0 0 8 3A2 2 0 0 0 4 3Z","xorArea":47.434}],"slabs":[{"z0":0,"z1":4,"area":60,"x":[0,10],"path":"M0 0L10 0L10 6L0 6L0 0Z"},{"z0":4,"z1":6,"area":12.566,"x":[4,8],"path":"M8 3A2 2 0 0 1 4 3A2 2 0 0 1 8 3Z"}],"volume":265.133,"faces":9},"difference":{"intervals":[{"z0":0,"z1":2,"hasA":true,"hasB":false,"path":"M0 0L10 0L10 6L0 6L0 0Z","area":60,"x":[0,10]},{"z0":2,"z1":4,"hasA":true,"hasB":true,"path":"M0 0L10 0L10 6L0 6L0 0ZM4 3A2 2 0 0 0 8 3A2 2 0 0 0 4 3Z","area":47.434,"x":[0,10]},{"z0":4,"z1":6,"hasA":false,"hasB":true,"path":"","area":0,"x":null}],"merges":[{"z":2,"equal":false,"empty":false,"xor":"M8 3A2 2 0 0 1 4 3A2 2 0 0 1 8 3Z","xorArea":12.566},{"z":4,"equal":false,"empty":true,"xor":""}],"slabs":[{"z0":0,"z1":2,"area":60,"x":[0,10],"path":"M0 0L10 0L10 6L0 6L0 0Z"},{"z0":2,"z1":4,"area":47.434,"x":[0,10],"path":"M0 0L10 0L10 6L0 6L0 0ZM4 3A2 2 0 0 0 8 3A2 2 0 0 0 4 3Z"}],"volume":214.867,"faces":9},"intersection":{"intervals":[{"z0":0,"z1":2,"hasA":true,"hasB":false,"path":"","area":0,"x":null},{"z0":2,"z1":4,"hasA":true,"hasB":true,"path":"M8 3A2 2 0 0 1 4 3A2 2 0 0 1 8 3Z","area":12.566,"x":[4,8]},{"z0":4,"z1":6,"hasA":false,"hasB":true,"path":"","area":0,"x":null}],"merges":[{"z":2,"equal":false,"empty":true,"xor":""},{"z":4,"equal":false,"empty":true,"xor":""}],"slabs":[{"z0":2,"z1":4,"area":12.566,"x":[4,8],"path":"M8 3A2 2 0 0 1 4 3A2 2 0 0 1 8 3Z"}],"volume":25.133,"faces":4}}}}};

const root = ref(null);
const place = ref('across'), op = ref('union');
const S = 15, X = x => 25 + S * (x + 0.5), Z = z => 112 - S * z;
const PLAN = `translate(${X(0)} 234) scale(${S} ${-S})`;
const AXIS = 250, A_AREA = 60, B_AREA = 12.566;
const SYM = { union: '∪', difference: '−', intersection: '∩' };
const OPS = { union: 'A ∪ B', difference: 'A − B', intersection: 'A ∩ B' };
const P = computed(() => DATA.placements[place.value]);
const R = computed(() => P.value.ops[op.value]);
const cx = computed(() => (place.value === 'across' ? 10 : 6));

const sectionWord = (has, which) => (has ? (which === 'a' ? 'the rectangle (60 mm²)' : 'the circle (4π ≈ 12.566 mm²)') : 'empty');
const intervalStep = i => {
  const iv = R.value.intervals[i], both = iv.hasA && iv.hasB;
  return {
    label: `Interval ${iv.z0}–${iv.z1}`,
    text: `The plane rises from z = ${iv.z0} to ${iv.z1}. Here A's section is ${sectionWord(iv.hasA, 'a')} and B's is ${sectionWord(iv.hasB, 'b')}. `
      + (both ? 'Both are present, so the two sections go through the 2D Boolean of <a href="/how/boolean#_2-splitting-a-face">the curve arrangement</a>: crossings, faces, winding numbers, selection. ' : 'With one side empty, the 2D Boolean keeps the other or drops it. ')
      + (iv.area > 0 ? `The interval's section is ${iv.area} mm².` : 'Nothing is kept: the interval drops out of the stack.'),
    formula: `section(${iv.z0}, ${iv.z1}) = A(z) ${SYM[op.value]} B(z)<br>area: A ${iv.hasA ? A_AREA : '∅'}, B ${iv.hasB ? B_AREA : '∅'} → ${OPS[op.value]} ${iv.area > 0 ? iv.area + ' mm²' : '∅'}`,
  };
};
const mergeLine = m => (m.empty ? `z = ${m.z}: one side is empty (an empty section is not a slab), nothing to join`
  : m.equal ? `z = ${m.z}: below and above are equal, their xor is empty → one slab`
    : `z = ${m.z}: they differ by ${m.xorArea} mm² → the level stays`);
const steps = computed(() => [
  { label: 'Two stacks of slabs', text: `A prismatic solid is a stack of slabs: height intervals, each with one XY section of lines and arcs (holes allowed). A is one slab, a 10 × 6 rectangle from z = 0 to 4. B is one slab too, a circle of radius 2 about (${cx.value}, 3), from z = 2 to 6.` },
  { label: 'Collect the levels', text: 'Every slab bottom and top of both operands, each height once, sorted. Neighbouring levels bound the intervals; inside one interval neither section changes.', formula: `levels = sort(unique{z<sub>0</sub>, z<sub>1</sub> of every slab of A and B}) = ${P.value.levels.join(', ')}` },
  intervalStep(0), intervalStep(1), intervalStep(2),
  { label: 'Merge equal neighbours', text: 'Slabs are kept sorted and touching slabs with equal sections are joined, so no level is left where nothing changes. Two sections are equal when the 2D Boolean <i>xor</i> of them is empty.', formula: R.value.merges.map(mergeLine).join('<br>') },
  { label: 'The result', text: `The result is ${R.value.slabs.length === 1 ? 'one slab' : R.value.slabs.length + ' slabs'}, still a prismatic solid, so its volume comes in closed form: each section's area (lines exactly, arcs in closed form, by Green's theorem) times its height. As a B-rep it has ${R.value.faces} faces. The next figure builds the faces of A ∪ B with B across.`, formula: `V = ${R.value.slabs.map(s => `${s.area} × ${s.z1 - s.z0}`).join(' + ')} = ${R.value.volume} mm³` },
]);
const s = useSteps(7, [2600, 2800, 3200, 3600, 3200, 4400, 3600], root);
const k = computed(() => ease(s.t.value));
const at = computed(() => s.step.value);

// Elevation: the interval blocks built so far (steps 3–5), the merge separators (step 6), the final slabs (step 7).
const blockRect = (x, z0, z1) => ({ x: X(x[0]), y: Z(z1), width: S * (x[1] - x[0]), height: Math.max(0, S * (z1 - z0)) });
const blocks = computed(() => {
  if (at.value < 2) return [];
  if (at.value === 6) return R.value.slabs.map(sl => ({ ...blockRect(sl.x, sl.z0, sl.z1), label: sl.area }));
  const upto = at.value >= 5 ? 2 : at.value - 2;
  return R.value.intervals.slice(0, upto + 1).filter(iv => iv.x).map(iv => {
    const grow = iv === R.value.intervals[upto] && at.value < 5 ? k.value : 1;
    return blockRect(iv.x, iv.z0, iv.z0 + (iv.z1 - iv.z0) * grow);
  });
});
const mergeIndex = computed(() => Math.min(R.value.merges.length - 1, Math.floor(s.t.value * R.value.merges.length)));
const mergePhase = computed(() => Math.min(1, Math.max(0, s.t.value * R.value.merges.length - mergeIndex.value)));
// Lines between touching blocks at a level: they fade where the sections are equal.
const separators = computed(() => {
  if (at.value !== 5) return [];
  return R.value.merges.map((m, i) => {
    if (m.empty) return null;
    const lo = R.value.intervals[i].x, hi = R.value.intervals[i + 1].x, x0 = Math.max(lo[0], hi[0]), x1 = Math.min(lo[1], hi[1]);
    if (x1 <= x0) return null;
    const fade = !m.equal ? 1 : i < mergeIndex.value ? 0 : i === mergeIndex.value ? 1 - ease(Math.min(1, mergePhase.value * 1.6)) : 1;
    return { x1: X(x0), x2: X(x1), y: Z(m.z), opacity: fade };
  }).filter(Boolean);
});
const plane = computed(() => {
  if (at.value < 2 || at.value > 4) return null;
  const iv = R.value.intervals[at.value - 2], z = iv.z0 + (iv.z1 - iv.z0) * k.value;
  return { y: Z(z), band: { x: X(-0.5), y: Z(z), width: S * 13, height: Math.max(0, Z(iv.z0) - Z(z)) } };
});
// Step 2: each operand's levels fly to the shared axis.
const flying = computed(() => {
  const g = at.value === 1 ? k.value : 1;
  return [[0, 10, 'a'], [4, 10, 'a'], [2, cx.value + 2, 'b'], [6, cx.value + 2, 'b']].map(([z, x, c]) => ({ x: X(x) + (AXIS - X(x)) * g, y: Z(z), c }));
});

// Plan: what the current step shows.
const plan = computed(() => {
  const st = at.value, ivs = R.value.intervals;
  if (st <= 1) return { a: P.value.a, b: P.value.b, draw: st === 0 ? k.value : 1 };
  if (st <= 4) { const iv = ivs[st - 2]; return { a: iv.hasA ? P.value.a : null, b: iv.hasB ? P.value.b : null, result: iv.path, fill: Math.max(0, Math.min(1, (k.value - 0.35) / 0.45)), draw: 1 }; }
  if (st === 5) { const i = mergeIndex.value, m = R.value.merges[i]; return { lower: ivs[i].path, upper: ivs[i + 1].path, xor: m.xor, phase: mergePhase.value }; }
  const n = R.value.slabs.length, i = Math.min(n - 1, Math.floor(s.t.value * n));
  return { result: R.value.slabs[i].path, fill: 1, slab: i };
});
const readout = computed(() => {
  const st = at.value, r = R.value;
  if (st === 0) return ['A: z 0 → 4', '60 mm²', 'B: z 2 → 6', '12.566 mm²'];
  if (st === 1) return ['levels', P.value.levels.join(', '), `${P.value.levels.length - 1} intervals`];
  if (st <= 4) { const iv = r.intervals[st - 2]; return [`z ${iv.z0} → ${iv.z1}`, `A: ${iv.hasA ? A_AREA : '—'}`, `B: ${iv.hasB ? B_AREA : '—'}`, `${OPS[op.value]}: ${iv.area > 0 ? iv.area : '—'}`]; }
  if (st === 5) { const i = mergeIndex.value, m = r.merges[i]; return [`level z = ${m.z}`, `below: ${r.intervals[i].area || '—'}`, `above: ${r.intervals[i + 1].area || '—'}`, m.empty ? 'one side empty' : m.equal ? 'xor ∅ → merge' : `xor ${m.xorArea} → keep`]; }
  const i = plan.value.slab, sl = r.slabs[i];
  return [`slab ${i + 1} of ${r.slabs.length}`, `z ${sl.z0} → ${sl.z1}`, `${sl.area} mm²`, `V = ${r.volume} mm³`];
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Slab by slab: levels, sections, merging" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="Side view and plan of two prisms: their levels, each interval's 2D Boolean, and merged slabs">
        <text x="25" y="13" class="panel">side view (x, z)</text>
        <text x="25" y="139" class="panel">section in the interval (x, y)</text>
        <!-- Elevation: ground, levels, operands, blocks. -->
        <line :x1="X(-0.5)" :y1="Z(0)" :x2="X(12.5)" :y2="Z(0)" class="ground" />
        <g v-if="at >= 1" :style="{ opacity: at === 1 ? Math.min(1, k * 1.5) : 1 }">
          <line v-for="z in P.levels" :key="'lv' + z" :x1="X(-0.5)" :y1="Z(z)" :x2="AXIS" :y2="Z(z)" class="level" :class="{ hot: at === 5 && R.merges[mergeIndex]?.z === z }" />
        </g>
        <rect v-for="(b, i) in blocks" :key="'bk' + i" :x="b.x" :y="b.y" :width="b.width" :height="b.height" class="block" />
        <text v-for="(b, i) in blocks" v-show="at === 6 && b.height >= 22 && b.width >= 48" :key="'bl' + i" :x="b.x + b.width / 2" :y="b.y + b.height / 2 + 4" class="block-label" text-anchor="middle">{{ b.label }} mm²</text>
        <line v-for="(l, i) in separators" :key="'sp' + i" :x1="l.x1" :x2="l.x2" :y1="l.y" :y2="l.y" class="separator" :style="{ opacity: l.opacity }" />
        <g v-if="at === 6">
          <line v-for="(sl, i) in R.slabs.slice(1)" v-show="sl.z0 === R.slabs[i].z1" :key="'fs' + i" :x1="X(Math.max(sl.x[0], R.slabs[i].x[0]))" :x2="X(Math.min(sl.x[1], R.slabs[i].x[1]))" :y1="Z(sl.z0)" :y2="Z(sl.z0)" class="separator" />
          <rect :x="X(R.slabs[plan.slab].x[0])" :y="Z(R.slabs[plan.slab].z1)" :width="S * (R.slabs[plan.slab].x[1] - R.slabs[plan.slab].x[0])" :height="S * (R.slabs[plan.slab].z1 - R.slabs[plan.slab].z0)" class="block-now" />
        </g>
        <rect v-if="plane" v-bind="plane.band" class="band" />
        <line v-if="plane" :x1="X(-0.5)" :x2="AXIS" :y1="plane.y" :y2="plane.y" class="plane" />
        <g :style="{ opacity: at === 6 ? 1 - Math.min(1, 3 * k) : 1 }">
          <rect :x="X(0)" :y="Z(at === 0 ? 4 * k : 4)" :width="S * 10" :height="S * (at === 0 ? 4 * k : 4)" class="op-a" />
          <rect :x="X(cx - 2)" :y="Z(2 + (at === 0 ? 4 * k : 4))" :width="S * 4" :height="S * (at === 0 ? 4 * k : 4)" class="op-b" />
          <text :x="X(0) + 4" :y="Z(4) + 13" class="name-a">A</text>
          <text :x="X(cx + 2) - 12" :y="Z(6) + 13" class="name-b">B</text>
        </g>
        <!-- The shared level axis. -->
        <line :x1="AXIS" :y1="Z(0) + 4" :x2="AXIS" :y2="Z(6) - 4" class="axis" />
        <g v-if="at >= 1">
          <circle v-for="(f, i) in flying" :key="'fl' + i" :cx="f.x" :cy="f.y" r="3.2" :class="'mark-' + f.c" />
          <text v-for="z in P.levels" v-show="at > 1 || k > 0.75" :key="'lt' + z" :x="AXIS + 8" :y="Z(z) + 4" class="tick">z = {{ z }}</text>
        </g>
        <!-- Plan: the sections of the current step. -->
        <g :transform="PLAN">
          <rect x="-0.5" y="0" width="13" height="6" class="plan-bg" />
          <path v-if="plan.lower" :d="plan.lower" class="fill-keep" style="opacity: 0.4" />
          <path v-if="plan.xor" :d="plan.xor" class="fill-hot" :style="{ opacity: 0.75 * Math.min(1, plan.phase * 3) }" />
          <path v-if="plan.upper" :d="plan.upper" class="line-keep" :style="{ opacity: Math.min(1, plan.phase * 3) }" />
          <path v-if="plan.result" :d="plan.result" class="fill-keep" :style="{ opacity: 0.75 * plan.fill }" />
          <path v-if="plan.result" :d="plan.result" class="line-keep" :style="{ opacity: plan.fill }" />
          <path v-if="plan.a" :d="plan.a" class="line-a" pathLength="1" :style="plan.draw < 1 ? { strokeDasharray: 1, strokeDashoffset: 1 - plan.draw } : null" />
          <path v-if="plan.b" :d="plan.b" class="line-b" pathLength="1" :style="plan.draw < 1 ? { strokeDasharray: 1, strokeDashoffset: 1 - plan.draw } : null" />
        </g>
        <text :x="X(0)" y="246" class="caption">0</text>
        <text :x="X(10) - 6" y="246" class="caption">10</text>
        <!-- Readout. -->
        <text v-for="(line, i) in readout" :key="'ro' + i" x="246" :y="160 + 17 * i" class="readout" :class="{ head: i === 0 }">{{ line }}</text>
      </svg>
      <div class="ops">
        <div role="group" aria-label="Operation">
          <button v-for="(label, o) in OPS" :key="o" type="button" :aria-pressed="op === o" @click="op = o">{{ label }}</button>
        </div>
        <div role="group" aria-label="Where B stands">
          <button type="button" :aria-pressed="place === 'across'" @click="place = 'across'">B across A's side</button>
          <button type="button" :aria-pressed="place === 'inside'" @click="place = 'inside'">B inside A</button>
        </div>
      </div>
      <template #note>Every section, area and merge is the kernel's result for these two solids, computed from the built
        package and embedded; the side view draws each slab's x extent only (a hole does not show in it). Try
        <b>B inside A</b> with <b>A ∪ B</b> for a merge, and <b>A − B</b> for a section with a hole.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --keep: #24956d; --hot: #c75351; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --keep: #6dcb9e; --hot: #ef8a87; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.panel { font-size: 10px; letter-spacing: 0.02em; fill: var(--vp-c-text-3); }
.ground { stroke: var(--vp-c-text-3); stroke-width: 1; }
.level { stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 3 3; }
.level.hot { stroke: var(--hot); stroke-width: 1.4; stroke-dasharray: none; }
.block { fill: var(--keep); fill-opacity: 0.55; }
.block-now { fill: none; stroke: var(--keep); stroke-width: 2; }
.block-label { font-size: 10px; font-weight: 700; fill: var(--vp-c-bg); }
.separator { stroke: var(--vp-c-bg); stroke-width: 2.5; transition: opacity .2s; }
.band { fill: var(--vp-c-brand-1); fill-opacity: 0.1; }
.plane { stroke: var(--vp-c-brand-1); stroke-width: 1.4; }
.op-a, .op-b { fill: none; stroke-width: 1.8; }
.op-a { stroke: var(--a); } .op-b { stroke: var(--b); }
.name-a, .name-b { font-size: 13px; font-weight: 700; }
.name-a { fill: var(--a); } .name-b { fill: var(--b); }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; }
.mark-a { fill: var(--a); } .mark-b { fill: var(--b); }
.tick { font-size: 10px; font-variant-numeric: tabular-nums; }
.plan-bg { fill: none; }
.fill-keep { fill: var(--keep); stroke: none; fill-rule: evenodd; }
.fill-hot { fill: var(--hot); stroke: none; fill-rule: evenodd; }
.line-keep, .line-a, .line-b { fill: none; stroke-width: 0.14; stroke-linejoin: round; }
.line-keep { stroke: var(--keep); stroke-width: 0.17; }
.line-a { stroke: var(--a); } .line-b { stroke: var(--b); }
.caption { font-size: 10px; fill: var(--vp-c-text-3); }
.readout { font-size: 11px; font-variant-numeric: tabular-nums; fill: var(--vp-c-text-1); }
.readout.head { font-weight: 700; }
.ops { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 8px 12px 12px; font-size: 12px; }
.ops div { display: flex; gap: 4px; flex-wrap: wrap; }
.ops button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 9px; font-size: 12px; font-weight: 600; background: var(--vp-c-bg); }
.ops button[aria-pressed="true"] { background: var(--vp-c-text-1); color: var(--vp-c-bg); }
button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
</style>
