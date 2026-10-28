<script setup>
// A pin seated on the starter plate's hole by a coincident and a concentric mate, the case of
// packages/barocss-cad-model/test/mates.test.ts, with the pin started tilted 30° about Y. The stages are those of
// solveOne in packages/barocss-cad-model/src/assembly/mates.ts: the directions fix the rotation (the smallest turn
// from where the part stands), then each position row g·t = h is made orthogonal to the rows before it (Gram–Schmidt)
// and the move is the smallest one. The numbers were checked by running solveAssembly on this case: placed at
// (32, 16, 8), rotation (0, 0, 0); freedom { turns: 1, slides: 2 } with the coincident mate alone and
// { turns: 1, slides: 0 } with both; a third mate (distance 3 mm on the same faces) refused with the message shown;
// a pin turned 40° about Z and typed 5 mm along X, 7 mm up, re-solved to (32, 16, 8) with its 40° turn kept.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const DEG = Math.PI / 180;
// Rotation matrices, row major (x ↦ R x + t).
const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const apply = (R, t, p) => [R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + t[0], R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + t[1], R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + t[2]];
// The view: turned −22° about Z, looked at 30° from above.
const YAW = -22 * DEG, PITCH = 30 * DEG;
const raw = p => { const x1 = p[0] * Math.cos(YAW) - p[1] * Math.sin(YAW), y1 = p[0] * Math.sin(YAW) + p[1] * Math.cos(YAW); return [x1, -(y1 * Math.sin(PITCH) + p[2] * Math.cos(PITCH))]; };
// Fitted once to the plate and the pin's poses.
const FIT = (() => {
  const pts = [[0, 0, 0], [64, 0, 0], [64, 32, 0], [0, 32, 0], [0, 0, 8], [64, 32, 8], [0, 32, 8], [96, -4, 0], [104, 4, 0], [110, 0, 20], [96, 0, 20], [28, 12, 30], [42, 20, 38], [36, 20, 8]].map(raw);
  const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
  const k = Math.min(300 / (x1 - x0), 170 / (y1 - y0));
  return { k, ox: 40 - k * x0 + (300 - k * (x1 - x0)) / 2, oy: 58 - k * y0 };
})();
const V = p => { const q = raw(p); return [FIT.ox + FIT.k * q[0], FIT.oy + FIT.k * q[1]]; };
const pts = ps => ps.map(V).map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
const ring = (f, n = 32) => Array.from({ length: n }, (_, i) => f(2 * Math.PI * i / n));

// The plate (starterDoc: 64 × 32 × 8, a Ø8 hole through at (32, 16)): its faces the viewer sees.
const PLATE = {
  top: pts([[0, 0, 8], [64, 0, 8], [64, 32, 8], [0, 32, 8]]),
  front: pts([[0, 0, 0], [64, 0, 0], [64, 0, 8], [0, 0, 8]]),
  side: pts([[64, 0, 0], [64, 32, 0], [64, 32, 8], [64, 0, 8]]),
  hole: pts(ring(a => [32 + 4 * Math.cos(a), 16 + 4 * Math.sin(a), 8])),
  axis: [V([32, 16, -6]), V([32, 16, 40])],
};
/** Convex hull (monotone chain) of screen points. */
function hull(P) {
  const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const BOTTOM = ring(a => [4 * Math.cos(a), 4 * Math.sin(a), 0], 24), TOP = ring(a => [4 * Math.cos(a), 4 * Math.sin(a), 20], 24);
/** The pin (cylinderPart(4, 20): axis Z through its origin, bottom at 0) drawn at a placement. */
function pinAt(R, t) {
  const b = BOTTOM.map(p => V(apply(R, t, p))), tp = TOP.map(p => V(apply(R, t, p)));
  const str = a => a.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
  return { body: str(hull([...b, ...tp])), top: str(tp), bottom: str(b), mark: [V(apply(R, t, [0, 0, 20])), V(apply(R, t, [4, 0, 20]))], axis: [V(apply(R, t, [0, 0, -6])), V(apply(R, t, [0, 0, 32]))], foot: V(apply(R, t, [0, 0, 0])) };
}

const steps = [
  { label: 'Faces as exact geometry', text: 'Each mate names a face that stays and a face on the part it moves. Their geometry is read exactly from the B-rep, in each part\'s own coordinates: the plate\'s top a plane through z = 8 facing +Z, its hole a cylinder of radius 4 on the vertical axis through (32, 16); the pin\'s bottom a plane facing −Z, its side a cylinder of radius 4 on its own Z axis. Unmated, the pin can turn three ways and slide three ways.', formula: 'coincident: two flat faces flush, facing each other &nbsp; concentric: two round faces on one axis' },
  { label: 'Directions fix the rotation', text: 'Rotation first. Each mate asks the part\'s rotation R to take one of its directions u onto a direction v: the coincident mate, the pin\'s bottom normal onto the opposite of the top\'s normal. One direction is met by the smallest turn from where the part stands, so the 30° tilt is taken out and nothing else turns.', formula: 'R u = v &nbsp; one direction: R = turn(R<sub>0</sub>u → v) · R<sub>0</sub> &nbsp; two: R = F(v<sub>1</sub>, v<sub>2</sub>) F(u<sub>1</sub>, u<sub>2</sub>)ᵀ' },
  { label: 'Concentric agrees: one turn left', text: 'The concentric mate asks the pin\'s axis to lie along the hole\'s, either way round; the sense that fits the coincident mate is taken. It is parallel to the first direction, so it adds no new one: two independent directions would fix R, here one is set and the pin can still turn about it.', formula: 'turns: 3 with no direction · 1 with one (about it) · 0 with two' },
  { label: 'Position: one row from the coincident mate', text: 'Now the move t, with R known. Each mate gives linear conditions g · t = h. Flush faces give one: along the top\'s normal, the pin\'s bottom must reach z = 8. The pin rises 8 mm; it can still slide anywhere in the plane.', formula: 'g = n<sub>top</sub> = (0, 0, 1), &nbsp; h = n · p<sub>top</sub> − n · (R p<sub>bottom</sub>) = 8 &nbsp; slides = 3 − 1' },
  { label: 'Two rows from the concentric mate', text: 'The axis gives two rows, one for each direction across it: the pin\'s axis point on the hole\'s axis. Each row is made orthogonal to the rows kept before it, so the move changes only what the mates hold and keeps the rest of where the part stood. x goes 100 → 32, y 0 → 16.', formula: 'q = (g − Σ (g·q<sub>i</sub>) q<sub>i</sub>) / ‖…‖, &nbsp; s = (h − g·t<sub>0</sub> − Σ (g·q<sub>i</sub>) s<sub>i</sub>) / ‖…‖ &nbsp; t = t<sub>0</sub> + Σ s<sub>i</sub> q<sub>i</sub>' },
  { label: 'Moving along what is free', text: 'The solve reports what is left: one turn, no slide. The gizmo then offers turns only. A 40° turn about Z is kept by the next solve, which starts from where the part now stands; a placement typed 5 mm along X and 7 mm up is put back, because the rows hold X, Y and Z. Nothing is iterated, so a solved assembly solved again stays put.', formula: 'freedom: { turns: 1, slides: 0 } &nbsp; → (32, 16, 8), rotation (0, 0, 40°)' },
  { label: 'A mate too many', text: 'A third mate, the same faces 3 mm apart. Its row g = (0, 0, 1) is already in the basis: made orthogonal it has no length left, and what remains of h is 3 mm, more than 10⁻⁶ mm. It is refused with the reason, and the pin stays where the first two put it. A mate that agrees (0 mm) is accepted.', formula: '"Conflicts with Coincident 1: they hold pin 3 mm from where this mate puts it."' },
];
const s = useSteps(steps.length, [3400, 3000, 2600, 2600, 3000, 4200, 3400], root);
const k = computed(() => ease(s.t.value));
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const pose = computed(() => {
  const n = s.step.value, u = k.value;
  if (n === 0) return { R: rotY(30 * DEG), t: [100, 0, 0] };
  if (n === 1) return { R: rotY(30 * DEG * (1 - u)), t: [100, 0, 0] };
  if (n === 2) return { R: I3, t: [100, 0, 0] };
  if (n === 3) return { R: I3, t: [100, 0, 8 * u] };
  if (n === 4) return { R: I3, t: [100 - 68 * u, 16 * u, 8] };
  if (n === 5) {
    const t = s.t.value, turn = 40 * DEG * ease(Math.min(1, t / 0.4)), off = t < 0.45 ? 0 : t < 0.7 ? ease((t - 0.45) / 0.25) : 1 - ease(Math.min(1, (t - 0.72) / 0.25));
    return { R: rotZ(turn), t: [32 + 5 * off, 16, 8 + 7 * off] };
  }
  return { R: rotZ(40 * DEG), t: [32, 16, 8] };
});
const pin = computed(() => pinAt(pose.value.R, pose.value.t));
const ghost = computed(() => (s.step.value === 6 ? pinAt(rotZ(40 * DEG), [32, 16, 8 + 3 * k.value]) : null));
const freedom = computed(() => {
  const n = s.step.value, late = s.t.value > 0.6;
  if (n === 0) return { turns: 3, slides: 3 };
  if (n === 1) return { turns: late ? 1 : 3, slides: 3 };
  if (n === 2) return { turns: 1, slides: 3 };
  if (n === 3) return { turns: 1, slides: late ? 2 : 3 };
  if (n === 4) return { turns: 1, slides: late ? 0 : 2 };
  return { turns: 1, slides: 0 };
});
const showFaces = computed(() => s.step.value <= 2);
const faceOpacity = computed(() => (s.step.value === 0 ? k.value : 1));
const rowsKept = computed(() => (s.step.value < 3 ? [] : s.step.value === 3 ? ['(0, 0, 1) · t = 8'] : ['(0, 0, 1) · t = 8', '(1, 0, 0) · t = 32', '(0, 1, 0) · t = 16'].slice(0, s.step.value === 4 && s.t.value < 0.3 ? 1 : 3)));
// The free turn about the hinge: an arc round the pin's top.
const hinge = computed(() => {
  const n = s.step.value; if (n !== 2 && n !== 5) return null;
  const t = pose.value.t, a0 = 0.3, a1 = n === 2 ? a0 + 4.4 * k.value : a0 + 4.4;
  if (a1 - a0 < 0.05) return null;
  const P = Array.from({ length: 25 }, (_, i) => V([t[0] + 9 * Math.cos(a0 + (a1 - a0) * i / 24), t[1] + 9 * Math.sin(a0 + (a1 - a0) * i / 24), t[2] + 22]));
  return P.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Mating a pin to a plate: rotation from directions, position from rows" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A pin is turned upright, lifted onto the plate and moved onto the hole's axis; the count of free turns and slides falls from three and three to one and zero">
        <polygon :points="PLATE.front" class="plate face-front" />
        <polygon :points="PLATE.side" class="plate face-side" />
        <polygon :points="PLATE.top" :class="['plate', 'face-top', { lit: showFaces }]" :style="showFaces ? { fillOpacity: 0.12 + 0.2 * faceOpacity } : null" />
        <polygon :points="PLATE.hole" :class="['hole', { lit: showFaces }]" />
        <line v-if="showFaces" :x1="PLATE.axis[0][0]" :y1="PLATE.axis[0][1]" :x2="PLATE.axis[1][0]" :y2="PLATE.axis[1][1]" class="axis a" :style="{ opacity: faceOpacity }" />
        <polygon v-if="ghost" :points="ghost.body" class="ghost" />
        <polygon :points="pin.body" class="pin" />
        <polygon v-if="showFaces" :points="pin.bottom" class="bottom-face" :style="{ opacity: faceOpacity }" />
        <polygon :points="pin.top" class="pin-top" />
        <line :x1="pin.mark[0][0]" :y1="pin.mark[0][1]" :x2="pin.mark[1][0]" :y2="pin.mark[1][1]" class="mark" />
        <line v-if="showFaces" :x1="pin.axis[0][0]" :y1="pin.axis[0][1]" :x2="pin.axis[1][0]" :y2="pin.axis[1][1]" class="axis b" :style="{ opacity: faceOpacity }" />
        <polyline v-if="hinge" :points="hinge" class="hinge" />
        <text x="14" y="20" class="readout">free turns</text>
        <text x="14" y="38" class="readout">free slides</text>
        <g v-for="i in 3" :key="'t' + i">
          <circle :cx="82 + 13 * i" cy="16" r="4.5" :class="['dot', { on: i <= freedom.turns }]" />
          <circle :cx="82 + 13 * i" cy="34" r="4.5" :class="['dot', { on: i <= freedom.slides }]" />
        </g>
        <text x="142" y="20" class="count">{{ freedom.turns }}</text><text x="142" y="38" class="count">{{ freedom.slides }}</text>
        <g v-if="rowsKept.length">
          <text x="366" y="20" class="rows-title" text-anchor="end">rows kept</text>
          <text v-for="(r, i) in rowsKept" :key="r" x="366" :y="36 + 14 * i" class="row" text-anchor="end">{{ r }}</text>
        </g>
        <text v-if="s.step.value === 6" x="14" y="240" class="refused">refused: 3 mm from where the first mates hold it</text>
        <text v-else-if="s.step.value >= 4" x="14" y="240" class="placed">pin at ({{ pose.t.map(v => Math.round(v)).join(', ') }})</text>
      </svg>
      <template #note>The solver's stages on the test case <code>mates: a pin seated in the plate’s hole</code>, with the pin
        started tilted 30°. The motion between the stages is drawn for the eye: the solver jumps straight to each result.
        The readouts are its <code>freedom</code> report; the unmated count (3 and 3) is what the gizmo offers a part no
        mate moves.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.plate { stroke: var(--vp-c-text-3); stroke-width: 1; stroke-linejoin: round; }
.face-front { fill: var(--vp-c-divider); } .face-side { fill: var(--vp-c-bg); }
.face-top { fill: var(--vp-c-bg); } .face-top.lit { fill: var(--a); }
.hole { fill: var(--vp-c-text-3); fill-opacity: 0.35; stroke: var(--vp-c-text-3); stroke-width: 1; }
.hole.lit { stroke: var(--a); stroke-width: 1.8; }
.axis { stroke-width: 1.3; stroke-dasharray: 5 3; } .axis.a { stroke: var(--a); } .axis.b { stroke: var(--b); }
.pin { fill: var(--b); fill-opacity: 0.28; stroke: var(--b); stroke-width: 1.4; stroke-linejoin: round; }
.pin-top { fill: var(--vp-c-bg); fill-opacity: 0.7; stroke: var(--b); stroke-width: 1.4; }
.bottom-face { fill: none; stroke: var(--b); stroke-width: 1.6; stroke-dasharray: 3 2; }
.mark { stroke: var(--b); stroke-width: 2; stroke-linecap: round; }
.ghost { fill: var(--hot); fill-opacity: 0.12; stroke: var(--hot); stroke-width: 1.3; stroke-dasharray: 4 3; }
.hinge { fill: none; stroke: var(--keep); stroke-width: 1.8; stroke-linecap: round; }
.readout { font-size: 11px; }
.dot { fill: var(--vp-c-bg); stroke: var(--vp-c-text-3); stroke-width: 1; } .dot.on { fill: var(--keep); stroke: var(--keep); }
.count { font-weight: 700; fill: var(--vp-c-text-1); }
.rows-title { font-size: 10px; font-weight: 700; }
.row { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--keep); }
.refused { fill: var(--hot); font-weight: 600; }
.placed { fill: var(--vp-c-text-1); font-weight: 600; }
</style>
