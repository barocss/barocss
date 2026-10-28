<script setup>
// Section caps as packages/barocss-gpu draws them (shaders/common.ts regionAlong, capPoint, capFirst; shaders/pick.ts
// fsCapProbe; shaders/surface.ts fsCap, capShade, hatchAcross; viewer.ts drawCapFront, drawCaps): per pixel, where the
// eye's ray comes into the kept region, and whether the first surface after that is a back face. Worked out here, in
// the page, on the cross-section of a tube (axis out of the page) cut by one plane, one ray per row of the picture.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const EYE = [22, 128], C = [172, 128], RO = 60, RI = 34, PLANE = 156; // kept where x ≥ 156: n = (1, 0), d = 156
const ROWS = 25, ROW = 6, Y0 = 128 - ((ROWS - 1) / 2) * ROW;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], dot = (a, b) => a[0] * b[0] + a[1] * b[1];
/** The parameters where the ray o + s·d crosses a circle round C. */
function circle(o, d, rho) {
  const q = sub(o, C), b = dot(q, d), c = dot(q, q) - rho * rho, disc = b * b - c;
  if (disc <= 0) return [];
  const r = Math.sqrt(disc);
  return [-b - r, -b + r];
}
const rays = [];
for (let j = 0; j < ROWS; j++) {
  const target = [PLANE, Y0 + j * ROW], v = sub(target, EYE), l = Math.hypot(...v), d = [v[0] / l, v[1] / l];
  // regionAlong for one plane: the ray meets n·p = d at s = (d − n·o) / (n·dir); it comes in there (n·dir > 0).
  const entry = (PLANE - EYE[0]) / d[0];
  const hits = [];
  for (const [rho, inner] of [[RO, false], [RI, true]]) for (const s of circle(EYE, d, rho)) {
    const p = [EYE[0] + d[0] * s, EYE[1] + d[1] * s], out = [(p[0] - C[0]) / rho * (inner ? -1 : 1), (p[1] - C[1]) / rho * (inner ? -1 : 1)];
    hits.push({ s, p, back: dot(d, out) > 0, n: out });
  }
  hits.sort((a, b) => a.s - b.s);
  const cut = hits.filter(h => h.s < entry), beyond = hits.filter(h => h.s >= entry), first = beyond[0] ?? null;
  const at = s => [EYE[0] + d[0] * s, EYE[1] + d[1] * s];
  const end = first ? first.p : at((238 - EYE[0]) / d[0]);
  rays.push({ j, y: target[1], d, entry: at(entry), cut, first, end, cap: !!first && first.back, light: first && !first.back ? Math.max(0, -dot(first.n, d)) : 0 });
}
const middle = rays.filter(r => r.cap).sort((a, b) => Math.abs(a.y - 82) - Math.abs(b.y - 82))[0] ?? rays[0];
// The cap's rows as runs (for the hatch's clip) and the rows where a cap meets no cap (the edges antialiased per sample).
const capRows = rays.filter(r => r.cap);
const edgesAt = rays.filter((r, i) => i > 0 && r.cap !== rays[i - 1].cap).map(r => r.y - ROW / 2);
// The hatch: 45° lines in the cap plane (hatchAcross: n = x, u = y, v = z), 9 units apart, over the picture panel.
const PX = 266, PW = 104, SPACING = 9;
const hatch = [];
for (let c = -PW; c < 220; c += SPACING) hatch.push([PX + c, Y0 - ROW / 2, PX + c + 160, Y0 - ROW / 2 + 160]);
const annulus = `M${C[0] - RO},${C[1]} a${RO},${RO} 0 1,0 ${2 * RO},0 a${RO},${RO} 0 1,0 ${-2 * RO},0 Z M${C[0] - RI},${C[1]} a${RI},${RI} 0 1,0 ${2 * RI},0 a${RI},${RI} 0 1,0 ${-2 * RI},0 Z`;

const steps = [
  { label: 'The cut', text: 'A section plane keeps the points p with n·p ≥ d. Every fragment of a clipped mesh on the other side is discarded, so the near half of the tube is simply not drawn. Up to six planes can be set: the kept region is the intersection of their kept sides, or for a cut-out, everything but the intersection of their cut-away sides.', formula: 'kept: n<sub>i</sub>·p ≥ d<sub>i</sub> for every plane i' },
  { label: 'Without a cap', text: 'Through the cut, the eye now sees the inside of the solid: a ray that enters the kept region inside the material next meets a back face, the far wall seen from within. A cap must cover exactly the pixels where that happens.' },
  { label: 'Where each ray comes in', text: 'For each pixel, the shader follows the eye\'s ray through the fragment\'s world point and finds where it enters the kept region: the latest crossing of a plane it passes into, before the earliest crossing of one it leaves. One ray per row of the picture here.', formula: 'per plane: s = (d − n·o) / (n·dir); entry = max over n·dir &gt; 0, exit = min over n·dir &lt; 0' },
  { label: 'The probe pass', text: 'A pass before the scene draws the capped meshes again, unclipped, both sides, keeping only fragments beyond their ray\'s entry, nearest first. It stores the nearest one\'s depth and whether it is a back face. A back face is drawn a little nearer (its depth × 10⁻⁵) so that it wins a tie, as where two solids touch.', formula: 'probe = (depth, back) of the first surface after the entry' },
  { label: 'The cap pass', text: 'In the main pass, each capped mesh\'s back faces are drawn once more. A fragment becomes a cap only where it is the probe\'s winner (same depth within 10⁻⁶) and a back face; it is then moved to the entry point: its colour lit there with the normal −n, its depth written there. Where the first surface is a front face, that face is what is seen.', formula: 'cap point q = o + dir · s<sub>entry</sub>, &nbsp; normal −n, &nbsp; frag_depth = depth(q)' },
  { label: 'The hatch', text: 'A cap can carry hatch lines fixed in the world: a coordinate h across them, in units of their spacing, and its change per pixel, so each line is one CSS pixel wide at any angle and zoom. On a line the cap\'s colour is multiplied by 0.45.', formula: 'h = q · across / spacing, &nbsp; d = |fract(h + ½) − ½| / ‖∇h‖, &nbsp; c · (1 − 0.55 · clamp(½ ratio + ½ − d, 0, 1))' },
  { label: 'Edges, picks and shadows', text: 'With 4× multisampling the probe also runs per sample, storing a 16-bit key of the triangle it found (a hash of mesh, vertex and instance, never 0), so a cap\'s edge is antialiased like any face. The same probe and test give the caps in the GPU pick, in the outline mask and, with a probe drawn from the light, in the shadow map.' },
];
const s = useSteps(steps.length, [3000, 3200, 3600, 3600, 4200, 3000, 3200], root);
const k = computed(() => ease(s.t.value));
const shown = computed(() => (s.step.value === 2 ? Math.round(k.value * ROWS) : s.step.value > 2 ? ROWS : 0));
const filled = computed(() => (s.step.value === 4 ? Math.round(k.value * ROWS) : s.step.value > 4 ? ROWS : 0));
const ghost = computed(() => (s.step.value === 0 ? 1 - 0.8 * k.value : 0.2));
const single = computed(() => {
  const r = middle, u = s.step.value === 1 ? k.value : 1, pt = [EYE[0] + (r.end[0] - EYE[0]) * u, EYE[1] + (r.end[1] - EYE[1]) * u];
  return { x2: pt[0], y2: pt[1], end: r.end, done: u >= 1 };
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Capping a section, pixel by pixel" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A tube cut by a plane, rays from the eye, and the picture the caps make">
        <defs>
          <clipPath id="gpu-caps-kept"><rect :x="PLANE" y="0" :width="380 - PLANE" height="250" /></clipPath>
          <clipPath id="gpu-caps-cut"><rect x="0" y="0" :width="PLANE" height="250" /></clipPath>
          <clipPath id="gpu-caps-rows"><rect v-for="r in capRows" :key="r.j" :x="PX" :y="r.y - ROW / 2" :width="PW" :height="ROW" v-show="r.j < filled" /></clipPath>
        </defs>
        <!-- the cross-section -->
        <path :d="annulus" class="solid ghost" fill-rule="evenodd" clip-path="url(#gpu-caps-cut)" :style="{ opacity: ghost }" />
        <path :d="annulus" class="solid" fill-rule="evenodd" clip-path="url(#gpu-caps-kept)" />
        <line :x1="PLANE" y1="40" :x2="PLANE" y2="216" class="plane" />
        <text :x="PLANE + 3" y="38" class="tag">n·p = d</text>
        <path :d="`M${PLANE},226 h18`" class="normal" /><path :d="`M${PLANE + 18},226 l-5,-3 v6 z`" class="normal-head" />
        <text :x="PLANE + 21" y="229" class="small">n (kept side)</text>
        <circle :cx="EYE[0]" :cy="EYE[1]" r="4" class="eye" /><text :x="EYE[0] - 6" :y="EYE[1] + 16" class="small">eye</text>
        <!-- one ray, without caps -->
        <g v-if="s.step.value === 1">
          <line :x1="EYE[0]" :y1="EYE[1]" :x2="single.x2" :y2="single.y2" class="ray one" />
          <circle v-if="single.done" :cx="single.end[0]" :cy="single.end[1]" r="3.5" class="back" />
          <text v-if="single.done" :x="single.end[0] + 6" :y="single.end[1] - 4" class="tag hot">back face</text>
        </g>
        <!-- every ray -->
        <g v-for="r in rays.slice(0, shown)" :key="'r' + r.j">
          <line :x1="EYE[0]" :y1="EYE[1]" :x2="r.entry[0]" :y2="r.entry[1]" class="ray before" />
          <line v-if="s.step.value >= 3" :x1="r.entry[0]" :y1="r.entry[1]" :x2="r.end[0]" :y2="r.end[1]" class="ray after" />
          <circle :cx="r.entry[0]" :cy="r.entry[1]" r="1.8" class="entry" />
          <g v-if="s.step.value >= 3 && r.first"><circle :cx="r.first.p[0]" :cy="r.first.p[1]" r="2.2" :class="r.first.back ? 'back' : 'front'" /></g>
        </g>
        <g v-if="s.step.value >= 4">
          <line v-for="r in rays.filter(q => q.cap && q.j < filled)" :key="'c' + r.j" :x1="PLANE" :y1="r.y - ROW / 2" :x2="PLANE" :y2="r.y + ROW / 2" class="cap" />
        </g>
        <!-- the picture -->
        <rect :x="PX" :y="Y0 - ROW / 2" :width="PW" :height="ROWS * ROW" class="picture" />
        <text :x="PX" :y="Y0 - ROW / 2 - 6" class="small">the picture, a row a ray</text>
        <g v-for="r in rays.slice(0, filled)" :key="'p' + r.j">
          <rect v-if="r.cap" :x="PX" :y="r.y - ROW / 2" :width="PW" :height="ROW + 0.2" class="cap-row" />
          <rect v-else-if="r.first" :x="PX" :y="r.y - ROW / 2" :width="PW" :height="ROW + 0.2" class="face-row" :style="{ fillOpacity: 0.25 + 0.6 * r.light }" />
        </g>
        <g v-if="s.step.value >= 5" clip-path="url(#gpu-caps-rows)" :style="{ opacity: s.step.value === 5 ? k : 1 }">
          <line v-for="(h, i) in hatch" :key="'h' + i" :x1="h[0]" :y1="h[1]" :x2="h[2]" :y2="h[3]" class="hatch" />
        </g>
        <g v-if="s.step.value === 6">
          <line v-for="(y, i) in edgesAt" :key="'e' + i" :x1="PX - 3" :y1="y" :x2="PX + PW + 3" :y2="y" class="edge" :style="{ opacity: k }" />
        </g>
        <text x="8" y="16" class="legend"><tspan class="hot">●</tspan> back face &nbsp;<tspan class="a">●</tspan> front face &nbsp;<tspan class="keep">▮</tspan> cap</text>
      </svg>
      <template #note>Worked out in the page: a tube Ø120 / Ø68 cut 16 units left of its axis, one plane, an eye in the
        plane of the section and 25 rays in place of a row of pixels each. The shader does this for every pixel, with up to
        six planes, in 3D; the picture's columns are the tube's length, the same in every column here.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.solid { fill: var(--b); fill-opacity: 0.22; stroke: var(--b); stroke-width: 1.4; }
.solid.ghost { stroke-dasharray: 3 3; }
.plane { stroke: var(--vp-c-text-1); stroke-width: 1.2; stroke-dasharray: 5 3; }
.normal { stroke: var(--vp-c-text-2); stroke-width: 1.2; } .normal-head { fill: var(--vp-c-text-2); }
.eye { fill: var(--vp-c-text-1); }
.ray { stroke-width: 0.8; } .ray.before { stroke: var(--vp-c-text-3); stroke-dasharray: 2 2; } .ray.after { stroke: var(--vp-c-text-2); }
.ray.one { stroke: var(--vp-c-text-1); stroke-width: 1.2; }
.entry { fill: var(--vp-c-text-1); }
.back { fill: var(--hot); } .front { fill: var(--a); }
.cap { stroke: var(--keep); stroke-width: 4; }
.picture { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.cap-row { fill: var(--keep); fill-opacity: 0.8; }
.face-row { fill: var(--a); }
.hatch { stroke: #000; stroke-opacity: 0.55; stroke-width: 1; }
.edge { stroke: var(--hot); stroke-width: 1.2; }
.tag { font-weight: 700; font-size: 10px; fill: var(--vp-c-text-1); } .tag.hot { fill: var(--hot); }
.small { font-size: 10px; fill: var(--vp-c-text-3); }
.legend { font-size: 10px; } .legend .hot { fill: var(--hot); } .legend .a { fill: var(--a); } .legend .keep { fill: var(--keep); }
</style>
