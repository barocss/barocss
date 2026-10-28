<script setup>
// The curve arrangement (packages/barocss-cad/src/brep/curved-arrangement.ts, `arrange` and `regions`) on one small
// case: a rectangle A and a circle B. Every number below is worked out from that geometry here, in closed form.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const R = 3, C = [9, 4], S5 = Math.sqrt(5), S8 = Math.sqrt(8);
const P1 = [C[0] - S5, 6], P2 = [10, C[1] - S8];
const deg = p => (Math.atan2(p[1] - C[1], p[0] - C[0]) * 180 / Math.PI + 360) % 360;
const a1 = deg(P1), a2 = deg(P2);
const X = x => 22 + 26 * x, Y = y => 222 - 26 * y;
const pt = p => `${X(p[0])},${Y(p[1])}`;
const at = a => [C[0] + R * Math.cos(a * Math.PI / 180), C[1] + R * Math.sin(a * Math.PI / 180)];
// Segments: lines [a, b] and arcs { from, to } in degrees (counter-clockwise when to > from).
const line = (a, b) => ({ kind: 'line', a, b });
const arc = (from, to) => ({ kind: 'arc', from, to });
const sample = seg => {
  if (seg.kind === 'line') return [seg.a, seg.b];
  const n = Math.max(2, Math.ceil(Math.abs(seg.to - seg.from) / 4)), out = [];
  for (let i = 0; i <= n; i++) out.push(at(seg.from + (seg.to - seg.from) * i / n));
  return out;
};
const pathOf = segs => segs.flatMap((s, i) => sample(s).slice(i ? 1 : 0)).map(pt).join(' ');
const ringA = [line([0, 0], [10, 0]), line([10, 0], [10, 6]), line([10, 6], [0, 6]), line([0, 6], [0, 0])];
const ringB = [arc(0, 180), arc(180, 360)];
// After the split: A's edges and B's edges between consecutive vertices.
const edgesA = [line([0, 0], [10, 0]), line([10, 0], P2), line(P2, [10, 6]), line([10, 6], P1), line(P1, [0, 6]), line([0, 6], [0, 0])];
const edgesB = [arc(0, a1), arc(a1, 180), arc(180, a2), arc(a2, 360)];
const vertices = [[0, 0], [10, 0], P2, [10, 6], P1, [0, 6], at(0), at(180)];
// The bounded faces, each traced as the walk takes it (material on the left).
const faces = {
  aOnly: { segs: [line([0, 0], [10, 0]), line([10, 0], P2), arc(a2, a1), line(P1, [0, 6]), line([0, 6], [0, 0])], w: [1, 0], label: [4, 3] },
  lens: { segs: [line(P2, [10, 6]), line([10, 6], P1), arc(a1, a2)], w: [1, 1], label: [8.3, 3.9] },
  bOnly: { segs: [arc(a2 - 360, a1), line(P1, [10, 6]), line([10, 6], P2)], w: [0, 1], label: [11.1, 4.6] },
};
const outer = [line([0, 6], P1), arc(a1, a2 - 360), line(P2, [10, 0]), line([10, 0], [0, 0]), line([0, 0], [0, 6])];
const fill = segs => `M ${pathOf(segs)} Z`;
// Leaving directions at P1 (degrees): along A's top both ways, along B's circle both ways (its tangent ± 90° from the radius).
const leaving = [
  { to: 'A → (10, 6)', angle: 0 }, { to: 'B, clockwise', angle: a1 - 90 }, { to: 'A → (0, 6)', angle: 180 }, { to: 'B, counter-clockwise', angle: a1 + 90 },
].map(h => ({ ...h, angle: (h.angle + 360) % 360 })).sort((p, q) => p.angle - q.angle);

const op = ref('union');
const keep = { union: w => w[0] !== 0 || w[1] !== 0, intersection: w => w[0] !== 0 && w[1] !== 0, difference: w => w[0] !== 0 && w[1] === 0 };
const rule = { union: 'w<sub>A</sub> ≠ 0 <b>or</b> w<sub>B</sub> ≠ 0', intersection: 'w<sub>A</sub> ≠ 0 <b>and</b> w<sub>B</sub> ≠ 0', difference: 'w<sub>A</sub> ≠ 0 <b>and</b> w<sub>B</sub> = 0' };

const steps = [
  { label: 'Two closed rings', text: 'Each operand is a closed ring of lines and arcs with material on its left: A, a 10 × 6 rectangle; B, a circle of radius 3 about (9, 4). An arc over half a turn is split in two, so no piece starts and ends at one point: B is two half circles.' },
  { label: 'Only pairs whose boxes meet', text: 'Every piece gets a box (an arc\'s box is its circle\'s, padded by the tolerance ε). Two pieces are intersected only when their boxes overlap; the rest are skipped without arithmetic.', formula: 'overlap ⇔ a.min<sub>x</sub> ≤ b.max<sub>x</sub> ∧ b.min<sub>x</sub> ≤ a.max<sub>x</sub> ∧ (the same in y)' },
  { label: 'Crossings in closed form', text: 'A line against a circle is a quadratic. A\'s right side x = 10 meets B at one point inside the side, its top y = 6 at another.', formula: `(x − 9)² + (y − 4)² = 9<br>x = 10 → y = 4 − √8 ≈ ${num(P2[1])} &nbsp;(P<sub>2</sub>)<br>y = 6 → x = 9 − √5 ≈ ${num(P1[0])} &nbsp;(P<sub>1</sub>)` },
  { label: 'Split into edges', text: 'Each piece is cut at its crossings, in parameter order. Points closer than ε become one vertex (a grid of 64 ε cells finds them), so the two pieces meeting at P<sub>1</sub> share exactly one vertex. 8 vertices, 10 edges.' },
  { label: 'Order edges around each vertex', text: 'At every vertex the edges leaving it are sorted by the angle they leave at; two leaving along one tangent are ordered by curvature. At P<sub>1</sub> four edges leave:', formula: leaving.map((h, i) => `${i + 1}. ${num(h.angle, 1)}° &nbsp;${h.to}`).join('<br>') },
  { label: 'Walk the faces', text: 'Each edge is two half-edges, one each way. From a half-edge arriving at a vertex, the walk turns to the next one clockwise of its twin: always the sharpest left. Every closed walk is one face; the one running clockwise is the outside.', formula: 'next(h) = the half-edge before twin(h) in the angular order at h\'s end' },
  { label: 'Winding numbers', text: 'Start outside with (w<sub>A</sub>, w<sub>B</sub>) = (0, 0). Crossing an edge of A from its right to its left adds 1 to w<sub>A</sub>; the same for B. Each face gets its pair once, by a breadth-first walk over the faces.', formula: 'w(face beyond e) = w(face before e) + (count of e, by which way it is crossed)' },
  { label: 'Keep faces by the operation', text: 'The operation is a rule on the pair. The kept faces\' outer boundary, merged where two pieces of one line or circle meet, is the result.', formula: 'A ∪ B: w<sub>A</sub> ≠ 0 or w<sub>B</sub> ≠ 0<br>A ∩ B: w<sub>A</sub> ≠ 0 and w<sub>B</sub> ≠ 0<br>A − B: w<sub>A</sub> ≠ 0 and w<sub>B</sub> = 0' },
];
const s = useSteps(steps.length, [2200, 2600, 2600, 2400, 3800, 6000, 3600, 4200], root);
const k = computed(() => ease(s.t.value));

// Step 2: piece boxes, and which pairs are tested.
const boxOf = seg => { const p = sample(seg); return [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1]))]; };
const boxesA = ringA.map(boxOf), boxesB = ringB.map(() => [C[0] - R, C[1] - R, C[0] + R, C[1] + R]);
const meets = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const tested = computed(() => ringA.map((_, i) => boxesB.some(b => meets(boxesA[i], b))));
const rect = b => ({ x: X(b[0]), y: Y(b[3]), width: 26 * (b[2] - b[0]) || 1.5, height: 26 * (b[3] - b[1]) || 1.5 });
// Step 5: the sweep at P1.
const sweep = computed(() => 360 * k.value);
const arrowEnd = a => [P1[0] + 1.15 * Math.cos(a * Math.PI / 180), P1[1] + 1.15 * Math.sin(a * Math.PI / 180)];
// Step 6: a walker going round each face in turn.
const tour = [faces.aOnly, faces.lens, faces.bOnly, { segs: outer }];
const walkPoints = tour.map(f => f.segs.flatMap((seg, i) => sample(seg).slice(i ? 1 : 0)));
const lengths = walkPoints.map(ps => { const L = [0]; for (let i = 1; i < ps.length; i++) L.push(L[i - 1] + Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][1] - ps[i - 1][1])); return L; });
const walker = computed(() => {
  const u = s.t.value * tour.length, f = Math.min(tour.length - 1, Math.floor(u)), r = u - f, ps = walkPoints[f], L = lengths[f], d = r * L.at(-1);
  let i = 1; while (i < L.length - 1 && L[i] < d) i++;
  const w = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
  return { face: f, p: [ps[i - 1][0] + (ps[i][0] - ps[i - 1][0]) * w, ps[i - 1][1] + (ps[i][1] - ps[i - 1][1]) * w], trail: ps.slice(0, i).concat([[ps[i - 1][0] + (ps[i][0] - ps[i - 1][0]) * w, ps[i - 1][1] + (ps[i][1] - ps[i - 1][1]) * w]]) };
});
const windingShown = computed(() => s.step.value > 6 ? 3 : s.step.value === 6 ? Math.floor(k.value * 3.99) : -1);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Splitting a face: the 2D curve arrangement" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="Rectangle A and circle B, their crossings, edges and faces">
        <defs>
          <marker id="arr-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="head" /></marker>
        </defs>
        <!-- Kept faces (last step) and the winding numbers. -->
        <g v-if="s.step.value === 7">
          <path v-for="(f, key) in faces" :key="key" :d="fill(f.segs)" class="kept" :style="{ opacity: keep[op](f.w) ? 0.85 * k + 0.1 : 0 }" />
        </g>
        <g v-if="s.step.value === 6">
          <path v-for="(f, key, i) in faces" :key="key" :d="fill(f.segs)" class="tint" :style="{ opacity: windingShown > i ? 0.35 : 0 }" />
        </g>
        <!-- The rings (steps 1–3), then the split edges. -->
        <g v-if="s.step.value < 3">
          <polyline :points="pathOf(ringA)" class="ring-a" />
          <polyline :points="pathOf([ringB[0]])" class="ring-b" /><polyline :points="pathOf([ringB[1]])" class="ring-b alt" />
          <circle v-for="(p, i) in [at(0), at(180)]" :key="'h' + i" :cx="X(p[0])" :cy="Y(p[1])" r="3" class="vertex-b" />
        </g>
        <g v-else>
          <polyline v-for="(e, i) in edgesA" :key="'ea' + i" :points="pathOf([e])" class="ring-a" :class="{ dim: s.step.value === 4 }" />
          <polyline v-for="(e, i) in edgesB" :key="'eb' + i" :points="pathOf([e])" class="ring-b" :class="{ dim: s.step.value === 4 }" />
        </g>
        <!-- Step 2: boxes. -->
        <g v-if="s.step.value === 1" :style="{ opacity: Math.min(1, 2 * k) }">
          <rect v-for="(b, i) in boxesA" :key="'ba' + i" v-bind="rect(b)" class="box" :class="{ hit: tested[i] }" />
          <rect v-bind="rect(boxesB[0])" class="box b" />
        </g>
        <!-- Step 3: crossings appear. -->
        <g v-if="s.step.value === 2">
          <line :x1="X(10)" :y1="Y(-0.6)" :x2="X(10)" :y2="Y(7.4)" class="probe" :style="{ opacity: k < 0.5 ? 1 : 0.3 }" />
          <line :x1="X(-0.6)" :y1="Y(6)" :x2="X(13)" :y2="Y(6)" class="probe" :style="{ opacity: k >= 0.5 ? 1 : 0.3 }" />
          <circle :cx="X(P2[0])" :cy="Y(P2[1])" :r="5 * Math.min(1, 3 * k)" class="cross" />
          <circle :cx="X(P1[0])" :cy="Y(P1[1])" :r="5 * Math.max(0, Math.min(1, 3 * k - 1.5))" class="cross" />
        </g>
        <g v-if="s.step.value >= 3">
          <circle v-for="(p, i) in vertices" :key="'v' + i" :cx="X(p[0])" :cy="Y(p[1])" :r="s.step.value === 3 ? 3.4 * Math.max(0, Math.min(1, k * 8 - i)) : 3" class="vertex" :class="{ hot: i === 2 || i === 4 }" />
        </g>
        <g class="labels">
          <text :x="X(P1[0]) - 8" :y="Y(P1[1]) - 8" v-if="s.step.value >= 2">P₁</text>
          <text :x="X(P2[0]) + 7" :y="Y(P2[1]) + 4" v-if="s.step.value >= 2">P₂</text>
          <text :x="X(1)" :y="Y(5.2)" class="name-a">A</text>
          <text :x="X(11.4)" :y="Y(6.6)" class="name-b">B</text>
        </g>
        <!-- Step 5: the angular sweep at P1. -->
        <g v-if="s.step.value === 4">
          <line v-for="(h, i) in leaving" :key="'l' + i" :x1="X(P1[0])" :y1="Y(P1[1])" :x2="X(arrowEnd(h.angle)[0])" :y2="Y(arrowEnd(h.angle)[1])" class="leave" :class="{ on: sweep >= h.angle }" marker-end="url(#arr-head)" />
          <line :x1="X(P1[0])" :y1="Y(P1[1])" :x2="X(P1[0] + 2.3 * Math.cos(sweep * Math.PI / 180))" :y2="Y(P1[1] + 2.3 * Math.sin(sweep * Math.PI / 180))" class="sweep" />
          <text v-for="(h, i) in leaving" :key="'n' + i" v-show="sweep >= h.angle" :x="X(P1[0] + 1.55 * Math.cos(h.angle * Math.PI / 180)) - 4" :y="Y(P1[1] + 1.55 * Math.sin(h.angle * Math.PI / 180)) + 4" class="order">{{ i + 1 }}</text>
        </g>
        <!-- Step 6: the walk. -->
        <g v-if="s.step.value === 5">
          <polyline :points="walker.trail.map(pt).join(' ')" class="trail" :class="{ outside: walker.face === 3 }" />
          <circle :cx="X(walker.p[0])" :cy="Y(walker.p[1])" r="5" class="walker" />
          <text x="22" y="244" class="caption">{{ ['face 1 · counter-clockwise', 'face 2 · counter-clockwise', 'face 3 · counter-clockwise', 'the outside · clockwise'][walker.face] }}</text>
        </g>
        <!-- Step 7–8: (wA, wB). -->
        <g v-if="s.step.value >= 6">
          <text v-for="(f, key, i) in faces" :key="'w' + key" v-show="s.step.value > 6 || windingShown > i" :x="X(f.label[0])" :y="Y(f.label[1])" class="winding" text-anchor="middle">({{ f.w[0] }}, {{ f.w[1] }})</text>
          <text :x="X(1.2)" :y="Y(7.3)" class="winding out">outside (0, 0)</text>
        </g>
      </svg>
      <div v-if="s.step.value === 7" class="ops" role="group" aria-label="Operation">
        <button v-for="o in ['union', 'intersection', 'difference']" :key="o" type="button" :aria-pressed="op === o" @click="op = o">{{ o === 'difference' ? 'A − B' : o === 'union' ? 'A ∪ B' : 'A ∩ B' }}</button>
        <span v-html="rule[op]" />
      </div>
      <template #note>The geometry is fixed and worked out in closed form for the picture; the kernel runs the same steps on
        any lines, arcs and traced curves, with ε = max(10⁻⁷ mm, 10⁻¹¹ × the coordinates' size).</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --keep: #24956d; --hot: #c75351; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --keep: #6dcb9e; --hot: #ef8a87; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.ring-a, .ring-b, .trail { fill: none; stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; transition: opacity .3s; }
.ring-a { stroke: var(--a); } .ring-b { stroke: var(--b); } .ring-b.alt { stroke-dasharray: 6 3; }
.dim { opacity: 0.35; }
.vertex { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.vertex.hot { fill: var(--hot); stroke: var(--hot); }
.vertex-b { fill: var(--b); }
.box { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 3 3; }
.box.hit { stroke: var(--hot); stroke-width: 1.6; stroke-dasharray: none; }
.box.b { stroke: var(--b); }
.probe { stroke: var(--hot); stroke-width: 1; stroke-dasharray: 4 3; transition: opacity .3s; }
.cross { fill: var(--hot); }
.labels text { font-weight: 700; fill: var(--hot); }
.labels .name-a { fill: var(--a); font-size: 15px; } .labels .name-b { fill: var(--b); font-size: 15px; }
.leave { stroke: var(--vp-c-text-3); stroke-width: 1.6; } .leave.on { stroke: var(--hot); stroke-width: 2.4; }
.head { fill: var(--hot); }
.sweep { stroke: var(--vp-c-brand-1); stroke-width: 1; stroke-dasharray: 2 2; }
.order { font-weight: 700; fill: var(--hot); font-size: 12px; }
.trail { stroke: var(--keep); stroke-width: 4; opacity: 0.7; } .trail.outside { stroke: var(--vp-c-text-2); }
.walker { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 2; }
.tint { fill: var(--keep); transition: opacity .4s; }
.kept { fill: var(--keep); transition: opacity .35s; }
.winding { font-weight: 700; fill: var(--vp-c-text-1); font-variant-numeric: tabular-nums; }
.winding.out { fill: var(--vp-c-text-2); font-weight: 600; }
.caption { font-size: 11px; }
.ops { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 12px 12px; font-size: 12px; }
.ops button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 9px; font-size: 12px; font-weight: 600; background: var(--vp-c-bg); }
.ops button[aria-pressed="true"] { background: var(--vp-c-text-1); color: var(--vp-c-bg); }
.ops span { color: var(--vp-c-text-2); }
</style>
