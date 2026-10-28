<script setup>
// A differential run (report-kernel-performance-2026-10-28.md §3.3, commit 8cfd1608f): a shortcut — a ray hit whose
// domain point lies outside the face's region box by 20 tolerances is 'out' with no look — run beside the full test
// (`locateInRegion`, the parity of a ray's crossings) on every hit, the disagreements counted. The face is a threaded
// shaft's planar end face; its outline over one turn follows a V profile (depth here illustrative). The hit stream is
// a fixed seeded set (mulberry32, seed 11); the final counts are the commit's.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const R_MAJ = 3, R_MIN = 2.2, GAP = 0.25; // mm; GAP draws the real 0.03 mm about 8× larger
const S = 26, CX = 105, CY = 122;
const X = x => CX + S * x, Y = y => CY - S * y;
// The end face's outline: r(θ) = r_min + (r_maj − r_min)(1 − |θ|/π), its peak at θ = 0.
const M = 240;
const outline = Array.from({ length: M }, (_, k) => { const th = -Math.PI + 2 * Math.PI * k / M, r = R_MIN + (R_MAJ - R_MIN) * (1 - Math.abs(th) / Math.PI); return [r * Math.cos(th), r * Math.sin(th)]; });
const outlinePath = outline.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('') + 'Z';
// The region's own box (as ringBox: the samples' extremes), and the first version's box, short of the peak.
const box = outline.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
const edgeBox = [box[0], box[1], R_MAJ - GAP, box[3]];
const BTOL = 0.04;
function segDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1]], ap = [p[0] - a[0], p[1] - a[1]], l2 = ab[0] * ab[0] + ab[1] * ab[1];
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / (l2 || 1)));
  return Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1]);
}
/** The full test: boundary within BTOL, else the parity of crossings to +x (half-open rule). */
function locate(p) {
  let odd = false, near = Infinity;
  for (let i = 0; i < M; i++) {
    const a = outline[i], b = outline[(i + 1) % M];
    near = Math.min(near, segDist(p, a, b));
    if ((a[1] > p[1]) !== (b[1] > p[1]) && a[0] + (p[1] - a[1]) / (b[1] - a[1]) * (b[0] - a[0]) > p[0]) odd = !odd;
  }
  return near <= BTOL ? 'boundary' : odd ? 'in' : 'out';
}
const outside = (b, p) => p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3];
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(11), hits = [];
while (hits.length < 64) {
  const p = [-2.95 + 7.3 * rnd(), -2.95 + 5.9 * rnd()], full = locate(p);
  // (Kept out of the stream: a point in the thin strip between the two boxes' sides, so the one disagreement shown is the commit's one.)
  if (!outside(edgeBox, p) || outside(box, p) || full === 'out') hits.push({ p, full, skipOld: outside(edgeBox, p), skipNew: outside(box, p) });
}
const TIP = { p: [R_MAJ, 0], full: locate([R_MAJ, 0]), skipOld: true, skipNew: false };
const EX = [-2.6, 2.05], exCross = (() => { const xs = []; for (let i = 0; i < M; i++) { const a = outline[i], b = outline[(i + 1) % M]; if ((a[1] > EX[1]) !== (b[1] > EX[1])) { const x = a[0] + (EX[1] - a[1]) / (b[1] - a[1]) * (b[0] - a[0]); if (x > EX[0]) xs.push(x); } } return xs.sort((u, v) => u - v); })();

const steps = [
  { label: 'A shortcut beside the full test', text: 'A ray from inside a piece meets a face\'s surface; is the hit on the face? The full test locates the hit\'s domain point in the face\'s region: the parity of a ray\'s crossings. The shortcut answers <i>out</i> with no look when the point lies outside a box around the region by more than 20 tolerances. Here the box is the first version\'s: the face\'s box from its edges\' control points.', formula: 'shortcut: q ∉ box ⊕ 20 tol ⇒ out   ·   full: locateInRegion(q) ∈ { in, out, boundary }' },
  { label: 'Run both, count', text: 'Before the shortcut is trusted, both run on every hit of the real workloads, and every hit the shortcut skips is checked against the full test\'s answer. A skip is right only if the full test says <i>out</i>.', formula: 'different = #{ skipped hits whose full answer ≠ out }' },
  { label: 'One disagreement', text: 'On a threaded shaft\'s end face, one hit lies just outside the box, so the shortcut says <i>out</i>. The full test says <i>boundary</i>: the point is on the region\'s outline. That one hit would have been classified wrongly.', formula: 'shortcut: out   ≠   full: boundary' },
  { label: 'Trace it', text: 'The box was made from the edges\' control points. On this face the region reached 0.03 mm past it. The shortcut assumed that box holds the region; on this face it did not.', formula: 'the region reaches 0.03 mm past the edge-control-point box' },
  { label: 'Box from the region itself', text: 'The box is now made from the region, the same way the point test reads it: a line\'s two ends, an arc\'s whole circle, a traced curve\'s samples padded by their longest chord (<code>ringBox</code>, <code>regionBox</code>). The hit is inside it, so the full test runs and answers <i>boundary</i>.', formula: 'regionBox = ∪ ringBox(ring) over the outer ring and the holes' },
  { label: 'Rerun on the whole bench', text: 'Run again on every bench workload: 217,861 hits skipped, every one <i>out</i> by the full test. The ring culling of the same commit (only rings whose box holds the point are read) was run the same way: 85,085 locations, 106,100 rings culled, every answer the same.', formula: '217,861 skipped · 0 different   |   85,085 located · 0 different' },
];
const s = useSteps(steps.length, [3000, 4200, 3200, 3400, 2800, 3600], root);
const fmt = n => Math.round(n).toLocaleString('en-US');
const fixed = computed(() => s.step.value >= 4);
const shownBox = computed(() => {
  if (s.step.value < 4) return edgeBox;
  const u = s.step.value === 4 ? ease(Math.min(1, s.t.value * 1.6)) : 1;
  return [box[0], box[1], edgeBox[2] + (box[2] - edgeBox[2]) * u, box[3]];
});
const shown = computed(() => {
  const st = s.step.value;
  if (st === 0) return [];
  const n = st === 1 ? Math.floor(s.t.value * hits.length) : hits.length;
  const list = hits.slice(0, n);
  if (st >= 2 && (st > 2 || s.t.value > 0.3)) list.push(TIP);
  return list;
});
const isSkip = h => (fixed.value && (s.step.value > 4 || s.t.value > 0.6)) ? h.skipNew : h.skipOld;
const tally = computed(() => {
  if (s.step.value === 5) { const u = ease(s.t.value); return { skipped: fmt(217861 * u), out: fmt(217861 * u), diff: '0', big: true }; }
  let skipped = 0, out = 0, diff = 0;
  for (const h of shown.value) if (isSkip(h)) { skipped++; if (h.full === 'out') out++; else diff++; }
  return { skipped: String(skipped), out: String(out), diff: String(diff), big: false };
});
const last = computed(() => shown.value.at(-1));
// The inset (step 4): ±0.55 mm about the peak, 110 px a mm.
const IS = 110, IX = 310, IY = 176, ix = x => IX + IS * (x - R_MAJ), iy = y => IY - IS * y;
const insetPeak = (() => { const near = outline.filter(p => p[0] > 2.1 && Math.abs(p[1]) < 0.7).sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0])); return near.map((p, i) => `${i ? 'L' : 'M'}${ix(p[0]).toFixed(1)},${iy(p[1]).toFixed(1)}`).join(''); })();
</script>

<template>
  <div ref="root">
    <AlgoFigure title="A differential run: the shortcut and the full test" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A threaded shaft's end face with a box around it, ray hits classified by a box shortcut and by the full point-in-region test, and counters of agreements">
        <path :d="outlinePath" class="region" />
        <rect :x="X(shownBox[0])" :y="Y(shownBox[3])" :width="Math.max(0, S * (shownBox[2] - shownBox[0]))" :height="Math.max(0, S * (shownBox[3] - shownBox[1]))" class="box" :class="{ fixed: fixed }" />
        <text :x="X(box[0])" :y="Y(box[1]) + 13" class="small">{{ fixed ? 'box of the region (ringBox)' : 'box of the edges’ control points' }}</text>
        <g v-if="s.step.value === 0">
          <line :x1="X(EX[0])" :y1="Y(EX[1])" :x2="X(4.5)" :y2="Y(EX[1])" class="ray" />
          <circle v-for="(x, i) in exCross" :key="'x' + i" :cx="X(x)" :cy="Y(EX[1])" r="3.2" class="cross" />
          <circle :cx="X(EX[0])" :cy="Y(EX[1])" r="4.5" class="hit skip" />
          <text :x="X(EX[0]) + 8" :y="Y(EX[1]) - 38" class="small">full: {{ exCross.length }} crossings, even → out</text>
          <text :x="X(EX[0]) + 8" :y="Y(EX[1]) - 26" class="small">shortcut: outside the box → out</text>
        </g>
        <g v-for="(h, i) in shown" :key="'h' + i">
          <circle :cx="X(h.p[0])" :cy="Y(h.p[1])" :r="h === TIP ? 4.2 : 2.8" class="hit" :class="[isSkip(h) ? 'skip' : h.full, { wrong: isSkip(h) && h.full !== 'out' }]" />
        </g>
        <circle v-if="last && s.step.value >= 1 && s.step.value <= 2" :cx="X(last.p[0])" :cy="Y(last.p[1])" r="7" class="ring" />
        <g v-if="s.step.value >= 2 && s.step.value <= 4 && shown.includes(TIP)">
          <circle :cx="X(R_MAJ)" :cy="Y(0)" r="8" class="ring" :class="isSkip(TIP) ? 'hot' : 'keep'" />
          <text x="240" y="113" class="small" :class="isSkip(TIP) ? 'hot' : 'keep'">peak: {{ isSkip(TIP) ? 'skipped ≠ boundary' : 'looked at → boundary' }}</text>
        </g>
        <!-- Counters. -->
        <g class="tally">
          <text x="240" y="40" class="head">{{ tally.big ? 'whole bench' : 'this stream' }}</text>
          <text x="240" y="60">hits skipped</text><text x="372" y="60" text-anchor="end" class="n">{{ tally.skipped }}</text>
          <text x="240" y="78">full test: out</text><text x="372" y="78" text-anchor="end" class="n keep">{{ tally.out }}</text>
          <text x="240" y="96">different</text><text x="372" y="96" text-anchor="end" class="n" :class="tally.diff !== '0' ? 'hot' : 'keep'">{{ tally.diff }}</text>
        </g>
        <!-- The inset. -->
        <g v-if="s.step.value >= 3 && s.step.value <= 4">
          <rect x="248" y="122" width="124" height="104" rx="6" class="inset" />
          <svg x="248" y="122" width="124" height="104" viewBox="248 122 124 104" overflow="hidden">
            <path :d="insetPeak" class="edge-line" />
            <line :x1="ix(shownBox[2])" y1="122" :x2="ix(shownBox[2])" y2="226" class="box-side" :class="{ fixed: fixed }" />
            <circle :cx="ix(R_MAJ)" :cy="iy(0)" r="4" class="hit" :class="fixed ? 'boundary' : 'skip wrong'" />
            <line v-if="!fixed" :x1="ix(edgeBox[2])" :y1="iy(0) + 18" :x2="ix(R_MAJ)" :y2="iy(0) + 18" class="dim" />
          </svg>
          <text x="366" y="136" text-anchor="end" class="small">magnified</text>
          <text v-if="!fixed" x="254" :y="iy(0) + 34" class="small hot">0.03 mm (drawn larger)</text>
        </g>
        <g v-if="s.step.value === 5" class="tally">
          <text x="240" y="132" class="head">ring culling</text>
          <text x="240" y="152">locations</text><text x="372" y="152" text-anchor="end" class="n">{{ fmt(85085 * ease(s.t.value)) }}</text>
          <text x="240" y="170">rings culled</text><text x="372" y="170" text-anchor="end" class="n">{{ fmt(106100 * ease(s.t.value)) }}</text>
          <text x="240" y="188">different</text><text x="372" y="188" text-anchor="end" class="n keep">0</text>
        </g>
        <g class="legend">
          <circle cx="16" cy="230" r="2.8" class="hit skip" /><text x="23" y="234">skipped</text>
          <circle cx="78" cy="230" r="2.8" class="hit in" /><text x="85" y="234">full: in</text>
          <circle cx="135" cy="230" r="2.8" class="hit out" /><text x="142" y="234">full: out</text>
          <circle cx="194" cy="230" r="2.8" class="hit boundary" /><text x="201" y="234">boundary</text>
        </g>
      </svg>
      <template #note>The face is drawn as a V outline over one turn (Ø6 shaft; the depth is illustrative), the 0.03 mm gap
        drawn about eight times larger and placed at the outline's peak, and the stream is 64 seeded points rather than the bench's hits. The final counts
        are those of commit <code>8cfd1608f</code> on the whole bench. The shortcut's pad of 20 tolerances (2 × 10⁻⁵ mm for parts up to 10 m) is
        too small to draw.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --keep: #24956d; --hot: #c75351; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --keep: #6dcb9e; --hot: #ef8a87; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.region { fill: color-mix(in srgb, var(--a) 16%, transparent); stroke: var(--a); stroke-width: 1.6; }
.box { fill: none; stroke: var(--b); stroke-width: 1.4; stroke-dasharray: 5 3; }
.box.fixed { stroke: var(--keep); stroke-dasharray: none; }
.small { font-size: 10px; }
.ray { stroke: var(--hot); stroke-width: 1.3; stroke-dasharray: 4 3; }
.cross { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.hit { stroke-width: 1.2; }
.hit.skip { fill: var(--vp-c-bg); stroke: var(--vp-c-text-3); }
.hit.in { fill: var(--keep); stroke: var(--vp-c-bg); }
.hit.out { fill: var(--vp-c-text-3); stroke: var(--vp-c-bg); }
.hit.boundary { fill: var(--b); stroke: var(--vp-c-bg); }
.hit.wrong { stroke: var(--hot); stroke-width: 2.2; }
.ring { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1; }
.ring.hot { stroke: var(--hot); } .ring.keep { stroke: var(--keep); }
.tally text { font-size: 11px; }
.tally .head { font-weight: 700; fill: var(--vp-c-text-1); }
.tally .n { font-weight: 700; font-variant-numeric: tabular-nums; fill: var(--vp-c-text-1); }
text.keep, .tally .n.keep { fill: var(--keep); }
text.hot, .tally .n.hot { fill: var(--hot); }
.inset { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.edge-line { fill: none; stroke: var(--a); stroke-width: 2; }
.box-side { stroke: var(--b); stroke-width: 1.6; stroke-dasharray: 5 3; }
.box-side.fixed { stroke: var(--keep); stroke-dasharray: none; }
.dim { stroke: var(--hot); stroke-width: 1.2; }
.legend text { font-size: 10px; }
</style>
