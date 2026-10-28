<script setup>
// A cylinder's silhouette (brep-hidden-line.ts, the silhouette pass in `projectBrepHiddenLines`): left, the wall in
// section (looking along its axis a = z) with its facets and vertex normals; right, the view. The view direction is
// toward = (sin θ cos φ, sin θ sin φ, cos θ): θ the tilt from the axis, φ the turn about it. For each vertex
// s = n·toward / |n|; a facet whose corners differ in sign is crossed at p_i + (p_j − p_i)·s_i / (s_i − s_j); the
// point is then snapped onto the exact surface at c ± r·w, w = unit(a × toward). The figure has 2 facets a quarter
// (the kernel's default is 12, where the snap is too small to see) and draws one row of facets as chords of the section.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const PER_Q = 2, M = 4 * PER_Q, CX = 92, CY = 120, RS = 64;
const alpha = Array.from({ length: M }, (_, i) => 2 * Math.PI * i / M);
const verts = alpha.map(a => [Math.cos(a), Math.sin(a)]);
const SX = p => [CX + RS * p[0], CY - RS * p[1]];
const PHI = -22.5 * Math.PI / 180, TH = 60 * Math.PI / 180;
const polygon = 'M' + verts.map(SX).map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L') + 'Z';

const steps = [
  { label: 'Facets and their normals', text: 'The silhouette is found on the tessellation. Each vertex of a curved face\'s triangles has a normal; on a cylinder they point about straight out from the axis. The left panel looks along the axis: a row of triangles shows as the chords of the section, and a vertex column as one point.', formula: '' },
  { label: 'Toward the viewer or away', text: 'For each vertex, s is how much its normal faces the viewer. Positive (green): the surface there faces the viewer. Negative (red): it faces away. A value within 10⁻⁹ of zero counts as zero, and zero is not negative.', formula: 's = n·toward / |n|' },
  { label: 'Where the sign changes', text: 'A triangle whose corners are not all of one sign is crossed by the silhouette. On each of its two sides that change sign, the crossing is where s, taken as linear along the side, is zero. The crossings of neighbouring triangles are computed in the same order, so they meet exactly; they are then chained end to end.', formula: 'p = p<sub>i</sub> + (p<sub>j</sub> − p<sub>i</sub>) · s<sub>i</sub> / (s<sub>i</sub> − s<sub>j</sub>)' },
  { label: 'Onto the exact surface', text: 'On a cylinder each point is then moved onto the surface, to the generator square to both the axis and the view. Its chain becomes collinear, the interior points are dropped, and the silhouette is an exact straight line from one rim to the other.', formula: 'w = unit(a × toward), p → c + a·((p − c)·a) ± r·w' },
  { label: 'Seen along the axis: none', text: 'Tilt the view toward the axis. Where the view runs along it (|a × toward| &lt; 10⁻⁶) the wall has no silhouette: it projects onto its own rims, which become one circle.', formula: '|a × toward| = sin θ' },
  { label: 'Turning away: they appear', text: 'Turn the view back. At once two silhouette lines stand on the rims\' ends, as long as the wall\'s height h times sin θ. Seen side on, the rims are edge-on and project to lines; the bottom rim\'s back half, hidden behind the wall before, now lies on its front half, and visible lines take precedence.', formula: '' },
];
const s = useSteps(steps.length, [2400, 2600, 2800, 2600, 3200, 3600], root);

const theta = computed(() => s.step.value < 4 ? TH : s.step.value === 4 ? TH * (1 - ease(s.t.value)) : (Math.PI / 2) * ease(s.t.value));
const toward = computed(() => [Math.sin(theta.value) * Math.cos(PHI), Math.sin(theta.value) * Math.sin(PHI), Math.cos(theta.value)]);
const sv = computed(() => verts.map(n => { const x = n[0] * toward.value[0] + n[1] * toward.value[1]; return Math.abs(x) < 1e-9 ? 0 : x; }));
const aw = computed(() => Math.hypot(toward.value[0], toward.value[1]));
const w = computed(() => (aw.value < 1e-6 ? null : [-toward.value[1] / aw.value, toward.value[0] / aw.value]));
// Crossings on the sides between neighbouring columns, and their snapped places.
const crossings = computed(() => {
  if (!w.value) return [];
  const out = [];
  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M, si = sv.value[i], sj = sv.value[j];
    if ((si < 0) === (sj < 0)) continue;
    const f = si / (si - sj), p = [verts[i][0] + (verts[j][0] - verts[i][0]) * f, verts[i][1] + (verts[j][1] - verts[i][1]) * f];
    const sg = p[0] * w.value[0] + p[1] * w.value[1] >= 0 ? 1 : -1;
    out.push({ p, q: [w.value[0] * sg, w.value[1] * sg] });
  }
  return out;
});
const grow = computed(() => s.step.value === 0 ? ease(s.t.value) : 1);
const normals = computed(() => verts.map((n, i) => { const a = SX(n), b = SX([n[0] * (1 + 0.24 * grow.value), n[1] * (1 + 0.24 * grow.value)]); return { a, b, sign: s.step.value < 1 ? 0 : Math.sign(sv.value[i]) }; }));
const showCross = computed(() => s.step.value >= 2);
const snapT = computed(() => s.step.value < 3 ? 0 : s.step.value === 3 ? ease(s.t.value) : 1);
const marks = computed(() => crossings.value.map(c => SX([c.p[0] + (c.q[0] - c.p[0]) * snapT.value, c.p[1] + (c.q[1] - c.p[1]) * snapT.value])));
const ticks = computed(() => s.step.value < 3 ? [] : crossings.value.map(c => ({ a: SX(c.p), b: SX([c.q[0] * 1.12, c.q[1] * 1.12]) })));
const arrow = computed(() => {
  const d = [Math.cos(PHI), Math.sin(PHI)], l = 1.14 + 0.42 * Math.sin(theta.value);
  return { a: SX([d[0] * 1.14, d[1] * 1.14]), b: SX([d[0] * l, d[1] * l]), long: Math.sin(theta.value) > 0.05 };
});

// The view: right = (−sin φ, cos φ, 0), up = toward × right; a rim point at β = α − φ goes to
// (r sin β, z sin θ − r cos θ cos β). Its front half (cos β > 0) faces the viewer.
const VX = 290, VR = 40, VH = 88;
const view = computed(() => {
  const st = Math.sin(theta.value), ct = Math.cos(theta.value), base = CY + (VH * st) / 2 + 6;
  const pt = (b, z) => [VX + VR * Math.sin(b), base - (z * st - VR * ct * Math.cos(b))];
  const arc = (b0, b1, z) => 'M' + Array.from({ length: 41 }, (_, i) => pt(b0 + (b1 - b0) * i / 40, z)).map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L');
  const sil = st >= 1e-6 ? [-1, 1].map(sg => ({ x: VX + sg * VR, y0: base, y1: base - VH * st })) : [];
  const edgeOn = ct < 1e-9, alongAxis = st < 1e-6;
  return { top: arc(0, 2 * Math.PI, VH), front: alongAxis ? null : arc(-Math.PI / 2, Math.PI / 2, 0), back: alongAxis || edgeOn ? null : arc(Math.PI / 2, 3 * Math.PI / 2, 0), sil };
});
const readout = computed(() => `θ = ${num(theta.value * 180 / Math.PI, 1)}°   |a × toward| = ${num(aw.value, 3)}   silhouettes: ${w.value ? 2 : 'none'}`);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="A cylinder's silhouette from its facets" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="Left: a cylinder's wall in section with its vertex normals and the view direction; right: its projected view with the silhouette lines">
        <text x="14" y="22" class="tag">along the axis (section)</text>
        <text x="228" y="22" class="tag">the view</text>
        <line x1="190" y1="30" x2="190" y2="224" class="divider" />
        <path :d="polygon" class="facets" />
        <circle :cx="CX" :cy="CY" :r="RS" class="exact" />
        <line v-for="(n, i) in normals" :key="'n' + i" :x1="n.a[0]" :y1="n.a[1]" :x2="n.b[0]" :y2="n.b[1]" class="normal" :class="{ pos: n.sign > 0, neg: n.sign < 0 }" />
        <circle v-for="(n, i) in normals" :key="'v' + i" :cx="n.a[0]" :cy="n.a[1]" r="2.6" class="vert" :class="{ pos: n.sign > 0, neg: n.sign < 0 }" />
        <g v-if="w">
          <line v-if="arrow.long" :x1="arrow.a[0]" :y1="arrow.a[1]" :x2="arrow.b[0]" :y2="arrow.b[1]" class="toward" marker-end="url(#hlr-arrow)" />
          <text x="184" y="216" text-anchor="end" class="tag">arrow: to the viewer</text>
        </g>
        <text v-else :x="CX" :y="CY + 4" text-anchor="middle" class="tag">view ∥ axis</text>
        <line v-for="(k, i) in ticks" :key="'k' + i" :x1="k.a[0]" :y1="k.a[1]" :x2="k.b[0]" :y2="k.b[1]" class="tick" />
        <g v-if="showCross">
          <circle v-for="(m, i) in marks" :key="'m' + i" :cx="m[0]" :cy="m[1]" r="4.2" class="cross" />
        </g>
        <defs>
          <marker id="hlr-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L8,4L0,8Z" class="head" /></marker>
        </defs>
        <path :d="view.top" class="rim" />
        <path v-if="view.front" :d="view.front" class="rim" />
        <path v-if="view.back" :d="view.back" class="rim hidden" />
        <line v-for="(l, i) in view.sil" :key="'s' + i" :x1="l.x" :y1="l.y0" :x2="l.x" :y2="l.y1" class="sil" />
        <text x="14" y="244" class="readout">{{ readout }}</text>
      </svg>
      <template #note>The section has 2 facets a quarter (the kernel's default is 12) and φ = −22.5°; the view panel is drawn
        exactly, with the bottom rim's back half dashed as the kernel finds it hidden. Off cylinders the same crossings are
        kept as a polyline, with normals first averaged across neighbouring faces (see the text).</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.divider { stroke: var(--vp-c-divider); stroke-width: 1; }
.facets { fill: color-mix(in srgb, var(--a) 10%, transparent); stroke: var(--a); stroke-width: 1.6; }
.exact { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 2 3; }
.normal { stroke: var(--vp-c-text-3); stroke-width: 1.3; }
.normal.pos, .vert.pos { stroke: var(--keep); fill: var(--keep); }
.normal.neg, .vert.neg { stroke: var(--hot); fill: var(--hot); }
.vert { fill: var(--vp-c-text-3); stroke: none; }
.toward { stroke: var(--b); stroke-width: 1.8; }
.head { fill: var(--b); }
.tick { stroke: var(--b); stroke-width: 1; stroke-dasharray: 2 2; }
.cross { fill: var(--vp-c-bg); stroke: var(--b); stroke-width: 2.2; }
.rim { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.6; }
.rim.hidden { stroke: var(--vp-c-text-2); stroke-width: 1.2; stroke-dasharray: 4 3; }
.sil { stroke: var(--keep); stroke-width: 2.2; }
.tag { font-size: 10px; }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
