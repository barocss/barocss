<script setup>
// A cubic B-spline of five spans against a finite plane, as intersectCubicCurveWideWithAffinePlaneSurface
// (packages/barocss-cad/src/nurbs/source-wide/curve-wide-cubic-plane-intersection.ts) does it: cut into Bézier spans,
// each span solved by the cubic primitive, the events gathered in the whole curve's parameter.
// Every number below is the built kernel's output for this curve and the plane z = 0 with x, y in [−4, 4]:
// the spans' control points, which spans were excluded by the sign test, the evaluation counts and the events.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
// The original curve: degree 3, knots [0,0,0,0,1,2,3,4,5,5,5,5], control points at x = −10 + 20 i / 7 (y = 0).
const Z = [1.8, 2.2, 1.2, 1.0, -1.6, -0.6, 1.4, 0.4];
const POLES = Z.map((z, i) => [-10 + 20 * i / 7, z]);
// Bézier spans [x, z] from the kernel's extractCurveBezierSpans (via the wide cubic operation's report).
const SPANS = [
  { d: [0, 1], p: [[-10, 1.8], [-7.142857142857142, 2.2], [-5.7142857142857135, 1.7000000000000002], [-4.523809523809524, 1.416666666666667]], excluded: true, evals: 0 },
  { d: [1, 2], p: [[-4.523809523809524, 1.416666666666667], [-3.333333333333333, 1.1333333333333333], [-2.380952380952381, 1.0666666666666667], [-1.4285714285714288, 0.6]], excluded: true, evals: 0 },
  { d: [2, 3], p: [[-1.4285714285714288, 0.6], [-0.4761904761904763, 0.1333333333333333], [0.4761904761904763, -0.7333333333333334], [1.428571428571429, -1.0000000000000002]], excluded: false, evals: 43, turns: 0 },
  { d: [3, 4], p: [[1.428571428571429, -1.0000000000000002], [2.3809523809523814, -1.2666666666666666], [3.333333333333334, -0.9333333333333333], [4.523809523809525, -0.26666666666666666]], excluded: true, evals: 0 },
  { d: [4, 5], p: [[4.523809523809525, -0.26666666666666666], [5.714285714285714, 0.39999999999999997], [7.142857142857142, 1.4], [10, 0.4]], excluded: false, evals: 48, turns: 1 },
];
// The kernel's two events: the whole curve's parameter, the point's x, and whether (u, v) is inside the plane's rectangle.
const EVENTS = [
  { t: 2.3531367449863865, x: -0.4196093000388959, span: 2, inside: true },
  { t: 4.127615191901039, x: 4.9936848246934415, span: 4, inside: false },
];

function bern(c, t) {
  let row = c.slice();
  for (let d = row.length - 1; d > 0; d--) { const p = row; row = p.slice(0, d).map((l, i) => (1 - t) * l + t * p[i + 1]); }
  return row[0];
}
function hull(ps) {
  const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => { const h = []; for (const q of list) { while (h.length >= 2 && cross(h.at(-2), h.at(-1), q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  return [...half(p), ...half(p.slice().reverse())];
}
const X = x => 190 + 17 * x, Y = z => 128 - 42 * z, P = q => [X(q[0]), Y(q[1])];
const pts = list => list.map(q => P(q).map(v => v.toFixed(2)).join(',')).join(' ');
const SEG = SPANS.map(sp => {
  const xs = sp.p.map(q => q[0]), zs = sp.p.map(q => q[1]);
  return { line: pts(Array.from({ length: 33 }, (_, i) => [bern(xs, i / 32), bern(zs, i / 32)])), poly: pts(sp.p), hull: pts(hull(sp.p)), mid: (X(xs[0]) + X(xs[3])) / 2 };
});
const KNOTS = SPANS.slice(1).map((sp, i) => ({ q: P(sp.p[0]), t: i + 1 }));
const fx = (x, d) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d);

const steps = [
  { label: 'A B-spline and a finite plane', text: 'A cubic B-spline with eight control points and five spans, against a plane given as an 8 × 8 mm square, seen edge on. A B-spline\'s distance from the plane is a polynomial only span by span, so the kernel works one span at a time.', formula: 'knots [0, 0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 5] &nbsp; domain [0, 5] &nbsp; spans [0, 1], …, [4, 5]' },
  { label: 'Cut into Bézier spans', text: 'On each span the B-spline basis functions are rewritten in that span\'s Bernstein basis (Bézier extraction): five cubic Bézier curves, end to end, with the same shape. Each has its own four control points; the original curve is not changed and stays the authority for every point reported.', formula: 'span j: 4 control points, its own parameter [j, j + 1] &nbsp; (extractCurveBezierSpans)' },
  { label: 'The hull test, span by span', text: 'Each span is handed to the cubic solver. Three spans have all four control points on one side of the plane, beyond the guard: their hull cannot reach it, so they are dismissed with no evaluation at all. Two spans straddle the plane and are searched.', formula: 'spans 0, 1, 3: excluded by sign &nbsp; spans 2, 4: searched' },
  { label: 'Solve the spans that cross', text: 'Span 2 falls all the way: its derivative\'s coefficients are all negative, so it has no turning point and is one monotone piece. Span 4 has one turning point and so two pieces, of which one changes sign. Each crossing is halved to a bracket at most 10⁻¹² wide.', formula: 'span 2: 43 evaluations &nbsp; span 4: 48 evaluations &nbsp; whole curve: 91' },
  { label: 'One list for the whole curve', text: 'Each root is mapped from its span to the original parameter and the original curve is evaluated there. Roots from different spans are kept apart; two contributions with exactly the same parameter (a root on a shared knot, found by both neighbours) become one event, a knot event. Here both are inside their spans.', formula: 't = 2.35314, 4.12762 &nbsp; (span roots)' },
  { label: 'Inside the plane\'s rectangle?', text: 'The plane is finite. Each point\'s (u, v) on the plane is solved from the plane\'s two axes, and the point, with its bracket\'s two ends, must fall all inside the rectangle or all outside one side of it. The first event is on the square; the second lies on the plane\'s support but past its edge: it is reported as outside-domain, with no face point.', formula: `x = ${fx(EVENTS[0].x, 3)}: finite-domain-admitted &nbsp; x = ${fx(EVENTS[1].x, 3)}: outside-domain (the square ends at x = 4)` },
];
const s = useSteps(steps.length, [2600, 3600, 3200, 3400, 2800, 3000], root);
const k = computed(() => ease(s.t.value));
const st = computed(() => s.step.value);
const spanIn = i => (st.value > 1 ? 1 : st.value < 1 ? 0 : Math.max(0, Math.min(1, k.value * 5 - i)));
const dimmed = i => st.value >= 2 && SPANS[i].excluded;
const ringR = computed(() => (st.value === 3 ? 4.5 + 14 * (1 - k.value) : 4.5));
const readout = computed(() => [
  '8 control points · 5 spans',
  'five Bézier spans, end to end',
  '3 spans excluded with no evaluation',
  '2 spans searched: 91 evaluations',
  '2 events on the plane\'s support',
  '1 on the square, 1 outside it',
][st.value]);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="A B-spline against a finite plane, span by span" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A cubic B-spline crossing a finite plane seen edge on, cut into Bézier spans, three of them excluded by their hulls">
        <text x="12" y="18" class="readout">{{ readout }}</text>
        <line x1="14" y1="128" x2="366" y2="128" class="support" />
        <rect :x="X(-4)" y="125" :width="X(4) - X(-4)" height="6" class="plane" />
        <text x="14" y="178" class="name a">plane: x and y in [−4, 4] mm</text>
        <!-- the original control polygon -->
        <g :style="{ opacity: st === 0 ? 1 : st === 1 ? 1 - k : 0 }">
          <polyline :points="pts(POLES)" class="polygon" />
          <circle v-for="(q, i) in POLES" :key="'P' + i" :cx="P(q)[0]" :cy="P(q)[1]" r="3.6" class="pole" />
        </g>
        <!-- hulls -->
        <g v-if="st >= 2">
          <polygon v-for="(sg, i) in SEG" :key="'h' + i" :points="sg.hull" :class="['hull', SPANS[i].excluded ? 'off' : 'on']" :style="{ opacity: st === 2 ? k : 0.8 }" />
        </g>
        <!-- span control polygons -->
        <g v-if="st >= 1">
          <g v-for="(sg, i) in SEG" :key="'s' + i" :style="{ opacity: spanIn(i) * (dimmed(i) ? 0.35 : 1) }">
            <polyline :points="sg.poly" :class="['span-poly', i % 2 ? 'b' : 'a']" />
            <circle v-for="(q, j) in SPANS[i].p" :key="'q' + j" :cx="P(q)[0]" :cy="P(q)[1]" r="2.6" :class="['span-pole', i % 2 ? 'b' : 'a']" />
          </g>
        </g>
        <!-- the curve, span by span -->
        <polyline v-for="(sg, i) in SEG" :key="'c' + i" :points="sg.line" :class="['curve', { dim: dimmed(i) }]" />
        <g v-for="kn in KNOTS" :key="'k' + kn.t">
          <circle :cx="kn.q[0]" :cy="kn.q[1]" r="3" class="knot" />
          <text :x="kn.q[0]" :y="kn.q[1] + (kn.q[1] < 128 ? -8 : 15)" class="tick" text-anchor="middle">t = {{ kn.t }}</text>
        </g>
        <g v-if="st >= 2">
          <text v-for="(sg, i) in SEG" :key="'lab' + i" :x="sg.mid" y="222" :class="['span-tag', SPANS[i].excluded ? 'off' : 'on']" text-anchor="middle">{{ SPANS[i].excluded ? 'skipped' : st >= 3 ? `${SPANS[i].evals} evals` : 'search' }}</text>
        </g>
        <!-- events -->
        <g v-if="st >= 3">
          <g v-for="(e, i) in EVENTS" :key="'e' + i">
            <circle v-if="st === 3" :cx="X(e.x)" cy="128" :r="ringR" class="ring" />
            <circle :cx="X(e.x)" cy="128" r="4.5" :class="['root', st === 5 && !e.inside ? 'out' : '']" :style="{ opacity: st === 3 ? k : 1 }" />
            <text v-if="st >= 4" :x="X(e.x) + (e.inside ? -8 : 0)" :y="e.inside ? 147 : 112" :class="['tag', st === 5 && !e.inside ? 'hot' : 'keep']" :text-anchor="e.inside ? 'end' : 'middle'" :style="{ opacity: st === 4 ? k : 1 }">t = {{ e.t.toFixed(4) }}</text>
            <text v-if="st === 5" :x="X(e.x) + (e.inside ? -10 : 6)" y="163" :class="['tag', e.inside ? 'keep' : 'hot']" :text-anchor="e.inside ? 'end' : 'start'" :style="{ opacity: k }">{{ e.inside ? 'on the square' : 'outside-domain' }}</text>
          </g>
        </g>
      </svg>
      <template #note>Every number is the built kernel's: <code>intersectCubicCurveWideWithAffinePlaneSurface</code> run on this
        curve and plane gave the span control points, the three sign-excluded spans, 43 and 48 scalar evaluations and the
        two events drawn. The curve lies in the plane y = 0, so seen edge on along y it is drawn exactly.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.readout { font-size: 12px; font-weight: 600; fill: var(--vp-c-text-1); }
.tick { font-size: 10px; fill: var(--vp-c-text-3); }
.support { stroke: var(--a); stroke-width: 1; stroke-dasharray: 4 3; stroke-opacity: 0.7; }
.plane { fill: var(--a); fill-opacity: 0.22; stroke: var(--a); stroke-width: 1; }
.name { font-weight: 700; font-size: 10.5px; } .name.a { fill: var(--a); }
.polygon { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 4 3; }
.pole { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.2; }
.span-poly { fill: none; stroke-width: 1; } .span-poly.a { stroke: var(--a); } .span-poly.b { stroke: var(--b); }
.span-pole { stroke: var(--vp-c-bg); stroke-width: 0.8; } .span-pole.a { fill: var(--a); } .span-pole.b { fill: var(--b); }
.hull { stroke-width: 0.8; } .hull.on { fill: var(--keep); fill-opacity: 0.14; stroke: var(--keep); } .hull.off { fill: var(--vp-c-text-3); fill-opacity: 0.12; stroke: var(--vp-c-text-3); }
.curve { fill: none; stroke: var(--vp-c-text-1); stroke-width: 2.4; stroke-linejoin: round; stroke-linecap: round; } .curve.dim { stroke: var(--vp-c-text-3); }
.knot { fill: var(--vp-c-bg); stroke: var(--vp-c-text-2); stroke-width: 1.2; }
.span-tag { font-size: 10.5px; font-weight: 600; } .span-tag.on { fill: var(--keep); } .span-tag.off { fill: var(--vp-c-text-3); }
.ring { fill: none; stroke: var(--keep); stroke-width: 1.2; }
.root { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1.2; } .root.out { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 2; }
.tag { font-size: 10.5px; font-weight: 600; } .tag.keep { fill: var(--keep); } .tag.hot { fill: var(--hot); }
</style>
