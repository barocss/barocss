<script setup>
// Classifying pieces (analytic-boolean.ts: the far-face broad phase, then `classify`), in a section: a plate A and a
// boss B. The rays' directions are the first two of the kernel's six; their crossings are solved here in closed form.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const C = [4, 5], R = 2.5, W = 16, H = 5;
const X = x => 20 + 21 * x, Y = y => 200 - 21 * y;
const deg = Math.PI / 180;
const unit2 = v => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
const RAYS = [unit2([0.5377, 0.3138]), unit2([-0.2961, 0.8573])];
const arcPts = (a0, a1) => Array.from({ length: 41 }, (_, i) => { const a = (a0 + (a1 - a0) * i / 40) * deg; return [C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)]; });
// The pieces: A's faces (the top cut in three by B) and B's circle (cut in two by A's top).
const pieces = [
  { id: 'A.top · left', solid: 'A', pts: [[0, 5], [1.5, 5]], key: [0.75, 5], cut: true },
  { id: 'A.top · middle', solid: 'A', pts: [[1.5, 5], [6.5, 5]], key: [4, 5], cut: true },
  { id: 'A.top · right', solid: 'A', pts: [[6.5, 5], [16, 5]], key: [11.25, 5], cut: true },
  { id: 'A.side (left)', solid: 'A', pts: [[0, 0], [0, 5]], key: [0, 2.5], cut: false },
  { id: 'A.bottom', solid: 'A', pts: [[0, 0], [16, 0]], key: [8, 0], cut: false },
  { id: 'A.side (right)', solid: 'A', pts: [[16, 0], [16, 5]], key: [16, 2.5], cut: false },
  { id: 'B, upper arc', solid: 'B', pts: arcPts(0, 180), key: [4, 7.5], cut: true },
  { id: 'B, lower arc', solid: 'B', pts: arcPts(180, 360), key: [4, 2.5], cut: true },
];
const boxB = [C[0] - R, C[1] - R, C[0] + R, C[1] + R];
// Ray crossings with the other solid's boundary (t > 0).
function hits(p, d, other) {
  const out = [];
  if (other === 'B') {
    const w = [p[0] - C[0], p[1] - C[1]], b = 2 * (w[0] * d[0] + w[1] * d[1]), c = w[0] ** 2 + w[1] ** 2 - R * R, disc = b * b - 4 * c;
    if (disc > 0) for (const t of [(-b - Math.sqrt(disc)) / 2, (-b + Math.sqrt(disc)) / 2]) if (t > 1e-9) out.push(t);
  } else {
    for (const [a, q] of [[[0, 0], [W, 0]], [[W, 0], [W, H]], [[W, H], [0, H]], [[0, H], [0, 0]]]) {
      const e = [q[0] - a[0], q[1] - a[1]], den = d[0] * e[1] - d[1] * e[0]; if (Math.abs(den) < 1e-12) continue;
      const t = ((a[0] - p[0]) * e[1] - (a[1] - p[1]) * e[0]) / den, u = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den;
      if (t > 1e-9 && u >= 0 && u <= 1) out.push(t);
    }
  }
  return out.sort((x, y) => x - y);
}
const classed = pieces.map(pc => {
  if (!pc.cut) return { ...pc, where: 'out', far: true, rays: [] };
  const other = pc.solid === 'A' ? 'B' : 'A', rays = RAYS.map(d => ({ d, ts: hits(pc.key, d, other) }));
  return { ...pc, where: rays[0].ts.length % 2 ? 'in' : 'out', far: false, rays };
});
const rayed = classed.filter(p => !p.far);
const steps = [
  { label: 'Pieces after the cuts', text: 'The surface intersections have split the faces: A\'s top is in three pieces, B\'s wall in two. Each piece is now wholly inside or wholly outside the other solid, and one point decides which.' },
  { label: 'Far faces need no ray', text: 'A face with no cut whose box lies more than 1000 tolerances clear of the other solid\'s box is outside it, whole: it is kept or dropped without a ray. Its point inside is found only if something asks for it.', formula: 'no cut ∧ box(f) ⊕ 1000 ε ∩ box(other) = ∅ ⇒ out' },
  { label: 'A point inside each piece', text: 'Each remaining piece gets a point strictly inside its region: on a few horizontal lines across the region, the middle of the widest inside interval, the one farthest from the boundary.' },
  { label: 'Rays decide', text: 'From that point, rays in fixed directions count crossings with the other solid\'s faces: odd is inside. Two rays that agree decide; a ray that grazes an edge or a surface is not counted, and if rays disagree the majority of six does.', formula: 'in ⇔ #{ hits with t &gt; 0 } odd &nbsp;(two agreeing rays of six)' },
  { label: 'Keep by the operation', text: 'Union keeps what lies outside the other solid; intersection what lies inside; A − B keeps A\'s outside pieces and B\'s inside pieces, B\'s turned over so the hole\'s wall faces into the hole.' },
];
const s = useSteps(steps.length, [2400, 2800, 2400, 8000, 3600], root);
const k = computed(() => ease(s.t.value));
const op = ref('difference');
const keep = (pc, o) => o === 'union' ? pc.where === 'out' : o === 'intersection' ? pc.where === 'in' : pc.solid === 'A' ? pc.where === 'out' : pc.where === 'in';
// Step 4: one piece at a time, its two rays growing.
const active = computed(() => { const u = s.t.value * rayed.length; return { i: Math.min(rayed.length - 1, Math.floor(u)), r: u - Math.floor(u) }; });
const decided = pc => s.step.value > 3 || (s.step.value === 3 && rayed.indexOf(pc) < active.value.i) || (pc.far && s.step.value >= 1);
const pts = ps => ps.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');
const rayEnd = (p, d, L) => [p[0] + d[0] * L, p[1] + d[1] * L];
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Which pieces to keep: far faces, then rays" :steps="steps" :s="s">
      <svg viewBox="0 0 380 230" role="img" aria-label="A plate A and a boss B in section, their pieces and the rays that classify them">
        <rect :x="X(0)" :y="Y(H)" :width="21 * W" :height="21 * H" class="solid-a" />
        <circle :cx="X(C[0])" :cy="Y(C[1])" :r="21 * R" class="solid-b" />
        <rect v-if="s.step.value === 1" :x="X(boxB[0] - 0.2)" :y="Y(boxB[3] + 0.2)" :width="21 * (boxB[2] - boxB[0] + 0.4)" :height="21 * (boxB[3] - boxB[1] + 0.4)" class="box" :style="{ opacity: Math.min(1, 3 * k) }" />
        <polyline v-for="pc in classed" :key="pc.id" :points="pts(pc.pts)" class="piece"
          :class="[pc.solid, decided(pc) ? pc.where : '', s.step.value === 4 ? (keep(pc, op) ? 'kept' : 'gone') : '', pc.far && s.step.value === 1 ? 'flash' : '']" />
        <g v-if="s.step.value >= 2 && s.step.value <= 3">
          <circle v-for="pc in rayed" :key="'k' + pc.id" :cx="X(pc.key[0])" :cy="Y(pc.key[1])" r="3.6" class="key" :style="{ opacity: s.step.value === 2 ? Math.min(1, k * 6 - rayed.indexOf(pc)) : 1 }" />
        </g>
        <g v-if="s.step.value === 3">
          <template v-for="(ray, j) in rayed[active.i].rays" :key="'r' + j">
            <line :x1="X(rayed[active.i].key[0])" :y1="Y(rayed[active.i].key[1])" :x2="X(rayEnd(rayed[active.i].key, ray.d, 12 * Math.min(1, active.r * 1.6))[0])" :y2="Y(rayEnd(rayed[active.i].key, ray.d, 12 * Math.min(1, active.r * 1.6))[1])" class="ray" />
            <circle v-for="(t, q) in ray.ts" :key="q" v-show="t < 12 * active.r * 1.6" :cx="X(rayEnd(rayed[active.i].key, ray.d, t)[0])" :cy="Y(rayEnd(rayed[active.i].key, ray.d, t)[1])" r="3.4" class="hit" />
          </template>
          <text x="20" y="224" class="readout">{{ rayed[active.i].id }}: {{ rayed[active.i].rays.map(r => r.ts.length).join(' and ') }} crossings → {{ rayed[active.i].where === 'in' ? 'inside' : 'outside' }} {{ rayed[active.i].solid === 'A' ? 'B' : 'A' }}</text>
        </g>
        <g v-if="s.step.value === 1"><text x="20" y="224" class="readout">A's side, bottom and far side: no cut, clear of B's box → outside, no ray</text></g>
        <text :x="X(14.6)" :y="Y(2.2)" class="name a">A</text><text :x="X(C[0] + 1.9)" :y="Y(C[1] + 2.1)" class="name b">B</text>
      </svg>
      <div v-if="s.step.value === 4" class="ops" role="group" aria-label="Operation">
        <button v-for="o in ['union', 'intersection', 'difference']" :key="o" type="button" :aria-pressed="op === o" @click="op = o">{{ o === 'difference' ? 'A − B' : o === 'union' ? 'A ∪ B' : 'A ∩ B' }}</button>
        <span>bold: kept · faint: dropped · green: outside the other · red: inside</span>
      </div>
      <template #note>A section through a plate and a boss, for the picture; in the kernel the pieces are trimmed faces and the
        rays run in 3D against the other solid's planes, cylinders and NURBS patches.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.solid-a { fill: color-mix(in srgb, var(--a) 10%, transparent); stroke: none; }
.solid-b { fill: color-mix(in srgb, var(--b) 10%, transparent); stroke: none; }
.piece { fill: none; stroke-width: 3; stroke-linecap: round; transition: stroke .3s, opacity .3s, stroke-width .3s; }
.piece.A { stroke: var(--a); } .piece.B { stroke: var(--b); }
.piece.out { stroke: var(--keep); } .piece.in { stroke: var(--hot); }
.piece.kept { stroke-width: 5; } .piece.gone { opacity: 0.18; }
.piece.flash { animation: flash 0.7s ease-in-out 2; }
@keyframes flash { 50% { stroke-width: 7; } }
.box { fill: none; stroke: var(--b); stroke-dasharray: 4 3; }
.key { fill: var(--vp-c-text-1); stroke: var(--vp-c-bg); stroke-width: 1.5; }
.ray { stroke: var(--vp-c-text-1); stroke-width: 1.2; stroke-dasharray: 4 3; }
.hit { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.6; }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
.name { font-weight: 700; font-size: 15px; } .name.a { fill: var(--a); } .name.b { fill: var(--b); }
.ops { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 12px 12px; font-size: 12px; }
.ops button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 9px; font-size: 12px; font-weight: 600; background: var(--vp-c-bg); }
.ops button[aria-pressed="true"] { background: var(--vp-c-text-1); color: var(--vp-c-bg); }
.ops span { color: var(--vp-c-text-2); }
@media (prefers-reduced-motion: reduce) { .piece.flash { animation: none; } }
</style>
