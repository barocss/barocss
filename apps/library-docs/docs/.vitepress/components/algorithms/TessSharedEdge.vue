<script setup>
// Shared edge samples (brep-tessellate.ts `tessellate`: each edge sampled once by `edgeParameters`, its ends set to
// its vertices' points, both faces' rings built from those samples). A quarter-circle edge between two faces, drawn
// flat; the faces are triangulated here by ear clipping, as a planar face is. The "each face on its own" counts
// (2 and 5) are a what-if: the kernel never samples an edge per face.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const C0 = [2, 0], R = 7;
const X = x => 60 + 26 * (x - 2), Y = y => 222 - 26 * y;
const arcAt = a => a === 0 ? [9, 0] : a === 90 ? [2, 7] : [C0[0] + R * Math.cos(a * Math.PI / 180), C0[1] + R * Math.sin(a * Math.PI / 180)];
const anglesOf = n => Array.from({ length: n + 1 }, (_, k) => 90 * k / n);

// Ear clipping of one ring (counter-clockwise), first ear in ring order each time.
function earClip(pts) {
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), ring = pts.map((_, i) => i), tris = [];
  for (let clipped = true; clipped && ring.length > 3;) {
    clipped = false;
    for (let k = 0; k < ring.length; k++) {
      const ia = ring[(k - 1 + ring.length) % ring.length], ib = ring[k], ic = ring[(k + 1) % ring.length], a = pts[ia], b = pts[ib], c = pts[ic];
      if (turn(a, b, c) <= 1e-12) continue;
      if (ring.some(j => j !== ia && j !== ib && j !== ic && turn(a, b, pts[j]) >= 0 && turn(b, c, pts[j]) >= 0 && turn(c, a, pts[j]) >= 0)) continue;
      tris.push([a, b, c]); ring.splice(k, 1); clipped = true; break;
    }
  }
  if (ring.length === 3) tris.push(ring.map(i => pts[i]));
  return tris;
}
// Face A: the quarter disc (centre, then the arc from (9, 0) to (2, 7)); face B: the box less the disc, its ring
// reading the same arc the other way.
function facesFor(nA, nB) {
  const a = anglesOf(nA).map(arcAt), b = anglesOf(nB).map(arcAt);
  const ringA = [C0, ...a], ringB = [[9, 0], [12, 0], [12, 8], [2, 8], ...[...b].reverse().slice(0, -1)];
  return { a, b, A: earClip(ringA), B: earClip(ringB) };
}
const own = facesFor(2, 5);
const shared = Object.fromEntries([1, 2, 4, 8].map(q => [q, facesFor(q, q)]));
const tri = t => t.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');
const line = pts => pts.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');
const arcPath = `M${X(9)},${Y(0)} A${26 * R},${26 * R} 0 0 0 ${X(2)},${Y(7)}`;
const gap = line([...own.a, ...[...own.b].reverse()]);
// B's own points that are not on A's chords (T-junctions against A).
const tees = own.b.slice(1, -1).filter((_, i) => (90 * (i + 1) / 5) % 45 !== 0);
const regionA = `M${X(2)},${Y(0)}L${X(9)},${Y(0)}A${26 * R},${26 * R} 0 0 0 ${X(2)},${Y(7)}Z`;
const regionB = `M${X(9)},${Y(0)}L${X(12)},${Y(0)}L${X(12)},${Y(8)}L${X(2)},${Y(8)}L${X(2)},${Y(7)}A${26 * R},${26 * R} 0 0 1 ${X(9)},${Y(0)}Z`;
const offset = (p, q, d) => { const dx = X(q[0]) - X(p[0]), dy = Y(q[1]) - Y(p[1]), l = Math.hypot(dx, dy) || 1, nx = -dy / l * d, ny = dx / l * d; return [X(p[0]) + nx + dx * 0.18, Y(p[1]) + ny + dy * 0.18, X(q[0]) + nx - dx * 0.18, Y(q[1]) + ny - dy * 0.18]; };

const steps = [
  { label: 'Two faces, one edge', text: 'In the B-rep an edge is one curve with two coedges, one in each face\'s loop, running opposite ways. Here a quarter circle separates face A (inside) from face B (outside). Both faces are triangulated separately, each in its own domain. They can only meet without a crack if they agree on the edge\'s points.' },
  { label: 'If each face sampled it alone', text: 'Say A divided the arc into 2 chords and B into 5. Each face\'s mesh would be fine on its own, but between the two polylines lies a sliver no triangle covers: a crack you can see through. B\'s points also lie off A\'s chords (T-junctions). Welding afterwards would have to guess which points are meant to be the same.', formula: 'A: 2 chords, B: 5 chords → a crack between them' },
  { label: 'Sampled once, by the edge', text: 'The kernel samples every edge once, before any face, and keeps the points in a table by edge. A circular arc gets the points of one angular grid, step π / (2q) for q segments a quarter. The grid is measured in a frame fixed by the arc\'s plane, so this quarter arc from 0° to 90° gets exactly q chords. Both faces are then triangulated from those points.', formula: 'arc samples at angles k · π / (2q) · here q = 4: 5 points' },
  { label: 'Read both ways', text: 'A face\'s ring takes each coedge\'s samples in its direction (reversed for a reversed coedge), without the last point. Every chord is then a side of one triangle in A and one in B, used once each way. The mesh is closed by construction: no welding and no tolerance, because the two faces hold the very same numbers.', formula: 'chord Pⱼ → Pⱼ₊₁ in A, Pⱼ₊₁ → Pⱼ in B' },
  { label: 'Ends are the vertices', text: 'Where edges meet, each edge\'s first and last sample is replaced by its vertex\'s stored point. Two curves evaluated at their ends can land a rounding apart, and that would crack the mesh at the corner. With the vertex\'s own point, every face meeting there gets the same position.', formula: 'samples[0] = vertex₀.point, samples[last] = vertex₁.point' },
  { label: 'The model edges', text: 'The same samples go out as the mesh\'s edge polylines (<code>mesh.edges</code>, one per B-rep edge). A viewer draws the real model edges, exactly on the triangles\' sides, instead of guessing creases from the triangles. Change q: both faces and the edge change together, and no crack opens.' },
];
const s = useSteps(steps.length, [2600, 5200, 5200, 5200, 3600, 6000], root);
const e = computed(() => ease(s.t.value));
const q = ref(4);
const cur = computed(() => shared[s.step.value === 5 ? q.value : 4]);
// Step 1: A's samples appear, then B's, then the crack.
const ownView = computed(() => {
  const k = s.step.value, t = s.t.value;
  if (k === 1) return { nA: Math.min(3, Math.floor(t / 0.13)), showA: t > 0.4, nB: t < 0.4 ? 0 : Math.min(6, Math.floor((t - 0.4) / 0.065)), showB: t > 0.8, gap: Math.max(0, Math.min(1, (t - 0.8) / 0.15)), fade: 1 };
  if (k === 2) return { nA: 3, showA: true, nB: 6, showB: true, gap: Math.max(0, 1 - t / 0.25), fade: Math.max(0, 1 - t / 0.3) };
  return null;
});
const sharedView = computed(() => {
  const k = s.step.value, t = s.t.value;
  if (k < 2) return null;
  if (k === 2) return { n: Math.min(5, Math.floor(t / 0.1)), faces: Math.max(0, Math.min(1, (t - 0.55) / 0.3)) };
  return { n: cur.value.a.length, faces: 1 };
});
const chord = computed(() => {
  if (s.step.value !== 3) return null;
  const pts = shared[4].a, j = Math.min(3, Math.floor(s.t.value * 4));
  return { j, A: offset(pts[j], pts[j + 1], -7), B: offset(pts[j + 1], pts[j], -7) };
});
// Step 4: the curve's end, a rounding off the vertex, set onto it (drawn enlarged).
const lens = { x: 312, y: 150, r: 42 };
const snap = computed(() => s.step.value === 4 ? 16 * (1 - e.value) : 0);
const readout = computed(() => {
  const k = s.step.value;
  if (k === 0) return 'one edge: a coedge in A\'s loop, one in B\'s, opposite ways';
  if (k === 1) return ownView.value.gap > 0 ? 'a crack between A\'s 2 chords and B\'s 5 · red rings: T-junctions' : ownView.value.showA ? 'B samples the arc again, on its own' : 'A samples the arc on its own';
  if (k === 2) return sharedView.value.faces > 0 ? 'both faces from the same 5 points: no crack' : 'the edge\'s own samples, on the angular grid';
  if (k === 3) return `chord ${chord.value.j + 1}: in A as P${chord.value.j}→P${chord.value.j + 1}, in B as P${chord.value.j + 1}→P${chord.value.j}`;
  if (k === 4) return snap.value > 0.5 ? 'the arc\'s end evaluated: a rounding off the vertex (enlarged)' : 'set to the vertex\'s point: one position for every face there';
  return `q = ${q.value}: ${cur.value.a.length} samples, read by A, by B and by the edge polyline`;
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="One edge, sampled once, shared by both faces" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A quarter-circle edge between two faces, sampled once and used by both faces' triangles">
        <path :d="regionA" class="face a" /><path :d="regionB" class="face b" />
        <g v-if="ownView" :style="{ opacity: ownView.fade }">
          <g v-if="ownView.showA"><polygon v-for="(t, i) in own.A" :key="'oa' + i" :points="tri(t)" class="tri a" /></g>
          <g v-if="ownView.showB"><polygon v-for="(t, i) in own.B" :key="'ob' + i" :points="tri(t)" class="tri b" /></g>
          <polygon v-if="ownView.gap > 0" :points="gap" class="gap" :style="{ opacity: ownView.gap }" />
          <circle v-for="(p, i) in own.a.slice(0, ownView.nA)" :key="'pa' + i" :cx="X(p[0])" :cy="Y(p[1])" r="4" class="pt a" />
          <circle v-for="(p, i) in own.b.slice(0, ownView.nB)" :key="'pb' + i" :cx="X(p[0])" :cy="Y(p[1])" r="3.2" class="pt b" />
          <g v-if="ownView.gap > 0" :style="{ opacity: ownView.gap }"><circle v-for="(p, i) in tees" :key="'te' + i" :cx="X(p[0])" :cy="Y(p[1])" r="6.5" class="tee" /></g>
        </g>
        <g v-if="sharedView" :style="{ opacity: sharedView.faces }">
          <polygon v-for="(t, i) in cur.A" :key="'sa' + i" :points="tri(t)" class="tri a" />
          <polygon v-for="(t, i) in cur.B" :key="'sb' + i" :points="tri(t)" class="tri b" />
        </g>
        <path :d="arcPath" class="curve" :class="{ faint: s.step.value >= 2 }" />
        <polyline v-if="s.step.value === 5" :points="line(cur.a)" class="model-edge" />
        <g v-if="chord">
          <line :x1="chord.A[0]" :y1="chord.A[1]" :x2="chord.A[2]" :y2="chord.A[3]" class="dir a" marker-end="url(#tess-arrow-a)" />
          <line :x1="chord.B[0]" :y1="chord.B[1]" :x2="chord.B[2]" :y2="chord.B[3]" class="dir b" marker-end="url(#tess-arrow-b)" />
        </g>
        <g v-if="sharedView">
          <circle v-for="(p, i) in cur.a.slice(0, sharedView.n)" :key="'ps' + i" :cx="X(p[0])" :cy="Y(p[1])" r="4" class="pt shared" />
        </g>
        <circle v-for="(p, i) in [[9, 0], [2, 7]]" :key="'v' + i" :cx="X(p[0])" :cy="Y(p[1])" r="4.5" class="vertex" />
        <g v-if="s.step.value === 4">
          <line :x1="X(9)" :y1="Y(0)" :x2="lens.x - lens.r * 0.7" :y2="lens.y + lens.r * 0.7" class="lead" />
          <circle :cx="lens.x" :cy="lens.y" :r="lens.r" class="lens" />
          <line :x1="lens.x" :y1="lens.y" :x2="lens.x + lens.r - 2" :y2="lens.y" class="mag b" />
          <line :x1="lens.x" :y1="lens.y" :x2="lens.x - lens.r + 2" :y2="lens.y" class="mag a" />
          <path :d="`M${lens.x + snap * 0.6},${lens.y - snap * 0.8} Q${lens.x + 2 + snap * 0.6},${lens.y - 20} ${lens.x + 5},${lens.y - lens.r + 3}`" class="mag curve-m" />
          <circle :cx="lens.x" :cy="lens.y" r="5" class="vertex" />
          <circle :cx="lens.x + snap * 0.6" :cy="lens.y - snap * 0.8" r="3.6" class="pt end" />
          <text :x="lens.x" :y="lens.y - lens.r - 6" text-anchor="middle" class="tag">at (9, 0), enlarged</text>
        </g>
        <text :x="X(4.1)" :y="Y(1.6)" class="name a">A</text><text :x="X(10.4)" :y="Y(6.4)" class="name b">B</text>
        <defs>
          <marker id="tess-arrow-a" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L8,4L0,8Z" class="head a" /></marker>
          <marker id="tess-arrow-b" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L8,4L0,8Z" class="head b" /></marker>
        </defs>
        <text x="20" y="243" class="readout">{{ readout }}</text>
      </svg>
      <div v-if="s.step.value === 5" class="ops" role="group" aria-label="Segments per quarter">
        <button v-for="n in [1, 2, 4, 8]" :key="n" type="button" :aria-pressed="q === n" @click="q = n">q = {{ n }}</button>
        <span>dark line: the edge polyline in <code>mesh.edges</code></span>
      </div>
      <template #note>Two faces drawn flat in one plane. In a solid they lie on different surfaces (a cap and a wall, say),
        but they still share the edge's points, which is all the figure shows. The rounding at the vertex is drawn
        enlarged; in the kernel it is a few units in the last digit.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.face.a { fill: color-mix(in srgb, var(--a) 12%, transparent); } .face.b { fill: color-mix(in srgb, var(--b) 12%, transparent); }
.tri { stroke-width: 0.9; stroke-linejoin: round; }
.tri.a { fill: color-mix(in srgb, var(--a) 22%, transparent); stroke: var(--a); }
.tri.b { fill: color-mix(in srgb, var(--b) 22%, transparent); stroke: var(--b); }
.gap { fill: var(--hot); stroke: var(--hot); stroke-width: 1; }
.tee { fill: none; stroke: var(--hot); stroke-width: 1.6; }
.curve { fill: none; stroke: var(--vp-c-text-1); stroke-width: 2.4; transition: opacity .3s; }
.curve.faint { opacity: 0.3; }
.model-edge { fill: none; stroke: var(--vp-c-text-1); stroke-width: 3; stroke-linejoin: round; }
.pt { stroke: var(--vp-c-bg); stroke-width: 1.4; }
.pt.a { fill: var(--a); } .pt.b { fill: var(--b); } .pt.shared { fill: var(--vp-c-text-1); } .pt.end { fill: var(--hot); }
.vertex { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 2; }
.dir { stroke-width: 2.2; } .dir.a { stroke: var(--a); } .dir.b { stroke: var(--b); }
.head.a { fill: var(--a); } .head.b { fill: var(--b); }
.lead { stroke: var(--vp-c-text-3); stroke-dasharray: 3 3; }
.lens { fill: var(--vp-c-bg); stroke: var(--vp-c-text-2); stroke-width: 1.4; }
.mag { stroke-width: 2.2; fill: none; } .mag.a { stroke: var(--a); } .mag.b { stroke: var(--b); }
.curve-m { stroke: var(--vp-c-text-1); }
.tag { font-size: 10px; }
.name { font-weight: 700; font-size: 15px; } .name.a { fill: var(--a); } .name.b { fill: var(--b); }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
.ops { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 12px 12px; font-size: 12px; }
.ops button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 9px; font-size: 12px; font-weight: 600; background: var(--vp-c-bg); }
.ops button[aria-pressed="true"] { background: var(--vp-c-text-1); color: var(--vp-c-bg); }
.ops span { color: var(--vp-c-text-2); }
</style>
