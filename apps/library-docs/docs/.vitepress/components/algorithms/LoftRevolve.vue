<script setup>
// Revolve (packages/barocss-cad/src/features/revolve.ts, revolveProfile): the profile's (ρ, h) control points, each
// turned about the axis on the kernel's own rational quadratic arcs (unitArc: spans of at most 90°, middle weight
// cos(Δ/2), middle point at ρ / cos(Δ/2)), on the kernel's stations (a full turn is two halves; a partial turn above
// 180° two equal parts; below, one). The face is the product: U round the axis, V along the profile, weights multiplied.
// The profile below, revolved by the built kernel (revolveProfile, axis x = 0), gives the same nets: the torus face's
// weights are 1, 0.7071, 0.5 for a full turn; volume 207.030 mm³ (revolveMassProperties).
import { computed, ref, watch } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const SQ = Math.SQRT1_2, TAU = 2 * Math.PI;
// The profile in the sketch plane, (ρ, y): ρ off the axis (x = 0), y along it. A closed loop of lines and one arc.
const LOOP = [
  { kind: 'line', a: [0, -2.5], b: [4, -2.5] }, // bottom: a planar disc
  { kind: 'line', a: [4, -2.5], b: [4, 0] }, // a cylinder
  { kind: 'arc', c: [2, 0], r: 2, t0: 0, dt: Math.PI / 2 }, // a torus patch
  { kind: 'line', a: [2, 2], b: [0, 2] }, // top: a planar disc
  { kind: 'line', a: [0, 2], b: [0, -2.5] }, // on the axis: bounds no wall
];
// The two curved walls' profile poles, (ρ, y) and weight: the cylinder's line, the arc as one rational quadratic.
const WALLS = [
  { name: 'cylinder', poles: [[4, -2.5], [4, 0]], w: [1, 1] },
  { name: 'torus', poles: [[4, 0], [4, 2], [2, 2]], w: [1, SQ, 1] },
];
const POLES = [[4, -2.5, 1], [4, 0, 1], [4, 2, SQ], [2, 2, 1]];
const loopPts = LOOP.flatMap(s => s.kind === 'line' ? [s.a] : Array.from({ length: 16 }, (_, k) => [s.c[0] + s.r * Math.cos(s.t0 + s.dt * k / 16), s.c[1] + s.r * Math.sin(s.t0 + s.dt * k / 16)]));

/** The kernel's unitArc: the unit circle from 0 through `sweep` as rational quadratic poles (x, y) and weights. */
function unitArc(sweep) {
  const spans = Math.max(1, Math.ceil(sweep / (Math.PI / 2) - 1e-12)), dt = sweep / spans, wm = Math.cos(dt / 2);
  const pts = [[1, 0]], w = [1];
  for (let s = 0; s < spans; s++) { const a = dt * (s + 0.5), b = dt * (s + 1); pts.push([Math.cos(a) / wm, Math.sin(a) / wm], [Math.cos(b), Math.sin(b)]); w.push(wm, 1); }
  return { pts, w, spans, dt, wm };
}
/** The kernel's stations: a full turn in two halves, a turn above 180° in two equal parts, else one. */
const stationsOf = alpha => (alpha >= TAU - 1e-12 ? [0, Math.PI, TAU] : alpha <= Math.PI ? [0, alpha] : [0, alpha / 2, alpha]);
// World: the sketch plane is z = 0, the axis is y; turning moves +x towards +z.
const world = (rho, y, X, Y) => [rho * X, y, rho * Y];
const yaw = 0.38, pitch = 0.36, S = 19, CX = 125, CY = 128;
const view = p => { const x1 = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), z1 = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw); return [CX + S * x1, CY - S * (p[1] * Math.cos(pitch) - z1 * Math.sin(pitch))]; };
const poly = ps => ps.map(view).map(q => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(' ');
const turned = (pts, phi) => pts.map(([r, y]) => [r * Math.cos(phi), y, r * Math.sin(phi)]);
const circleArc = (rho, y, phi, n = 64) => Array.from({ length: n + 1 }, (_, k) => { const a = phi * k / n; return [rho * Math.cos(a), y, rho * Math.sin(a)]; });

/** Everything that depends on the turn angle α: the parts, each part's arc, the rings of control points, the surface's curves. */
function build(alphaDeg) {
  const alpha = Math.max(1, Math.min(360, alphaDeg)) * Math.PI / 180, st = stationsOf(alpha), parts = [];
  for (let k = 0; k + 1 < st.length; k++) {
    const arc = unitArc(st[k + 1] - st[k]), c0 = Math.cos(st[k]), s0 = Math.sin(st[k]);
    parts.push({ ...arc, xy: arc.pts.map(([x, y]) => [x * c0 - y * s0, x * s0 + y * c0]) });
  }
  // A ring of control points for a profile pole: every part's arc poles, ρ times the unit ones (shared ends once).
  const ring = ([rho, y, wp]) => {
    const pts = [], w = [];
    parts.forEach((pa, k) => pa.xy.forEach((q, a) => { if (k > 0 && a === 0) return; pts.push(world(rho, y, q[0], q[1])); w.push(pa.w[a] * wp); }));
    return { pts, w };
  };
  const rings = POLES.map(ring);
  // The surface's own curves, evaluated on each Bézier patch of the net: S = Σ Σ B B w P / Σ Σ B B w.
  const curves = [];
  for (const wall of WALLS) for (const pa of parts) for (let sp = 0; sp < pa.spans; sp++) {
    const net = [0, 1, 2].map(a => wall.poles.map(([r, y], j) => ({ p: world(r, y, pa.xy[2 * sp + a][0], pa.xy[2 * sp + a][1]), w: pa.w[2 * sp + a] * wall.w[j] })));
    const at = (u, v) => {
      const Bu = [(1 - u) ** 2, 2 * u * (1 - u), u * u], Bv = wall.poles.length === 2 ? [1 - v, v] : [(1 - v) ** 2, 2 * v * (1 - v), v * v];
      let W = 0; const P = [0, 0, 0];
      net.forEach((row, a) => row.forEach((q, j) => { const c = Bu[a] * Bv[j] * q.w; W += c; for (let i = 0; i < 3; i++) P[i] += c * q.p[i]; }));
      return P.map(x => x / W);
    };
    for (const v of wall.poles.length === 2 ? [0, 0.5, 1] : [0.33, 0.67, 1]) curves.push(Array.from({ length: 13 }, (_, k) => at(k / 12, v)));
    for (const u of [0, 0.5, 1]) curves.push(Array.from({ length: 13 }, (_, k) => at(u, k / 12)));
  }
  const first = parts[0];
  return { alpha, st, parts, rings, curves, spans: first.spans, dt: first.dt, wm: first.wm };
}

const steps = [
  { label: 'A profile beside an axis', text: 'A closed loop of lines and arcs in the sketch plane, and an axis in that plane. Each point is written as (h, ρ): h along the axis, ρ off it. The profile must lie on one side (ρ &gt; 0). It may meet the axis at a vertex or run along it, as the left edge here does; that edge bounds no face.', formula: 'h = (p − o) · d, &nbsp; ρ = (p − o) · s, &nbsp; s ⟂ d in the sketch plane' },
  { label: 'Turn it: every point draws a circle', text: 'Turning by φ carries a point (h, ρ) to o + h d + ρ (cos φ s + sin φ z), z the sketch plane\'s normal. Each vertex off the axis draws a circle about it; each segment draws a face. A line parallel to the axis gives a cylinder, one square to it a flat ring or disc, any other line a cone, an arc a torus patch (a sphere zone when its centre is on the axis).', formula: 'P(h, ρ, φ) = o + h d + ρ cos φ s + ρ sin φ z' },
  { label: 'A circle as rational quadratic pieces', text: 'Each circle is exact: pieces of at most 90°, each a rational quadratic. A full turn is two halves, 0–180° and 180–360°, each two 90° pieces. A piece of angle Δ has its middle control point at ρ / cos(Δ/2) and weight cos(Δ/2), here cos 45° = 0.7071.', formula: 'spans = ⌈Δ<sub>part</sub> / 90°⌉, &nbsp; w = cos(Δ/2), &nbsp; middle at ρ / cos(Δ/2), angle ½Δ' },
  { label: 'Every profile pole gets that ring', text: 'The same arc, scaled by ρ, is laid round every control point of the profile, its ends and an arc\'s middle pole included. The rings are the face\'s rows. The weights multiply: the torus\'s middle row, weight 0.7071 on the profile, gets 0.7071 × 0.7071 = 0.5 at the arc\'s middle points.', formula: 'P<sub>a j</sub> = ring<sub>a</sub>(h<sub>j</sub>, ρ<sub>j</sub>), &nbsp; w<sub>a j</sub> = w<sub>a</sub><sup>arc</sup> · w<sub>j</sub><sup>profile</sup>' },
  { label: 'The surface: rows times columns', text: 'Each face is one NURBS patch: degree 2 round the axis, the profile segment\'s degree along it. The curves drawn are evaluated from the net with the rational formula; they are the exact circles and the turned profile.', formula: 'S(u, v) = Σ<sub>a</sub> Σ<sub>j</sub> N<sub>a</sub>(u) N<sub>j</sub>(v) w<sub>a j</sub> P<sub>a j</sub> / Σ<sub>a</sub> Σ<sub>j</sub> N<sub>a</sub>(u) N<sub>j</sub>(v) w<sub>a j</sub>' },
  { label: 'A partial turn: fewer pieces, end caps', text: 'Below 180° the turn is one part; above, two equal parts. Each part takes as many pieces as 90° needs, so the weight changes with the angle: 135° is two pieces of 67.5°, w = cos 33.75° = 0.8315. A partial turn is closed by two flat end caps, the profile itself at 0 and at α. Try the slider.', formula: 'parts: α = 360°: 2 halves · α &gt; 180°: 2 × α/2 · α ≤ 180°: 1' },
];
const s = useSteps(steps.length, [2600, 3600, 4000, 3400, 2800, 4200], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);

const userA = ref(null);
watch(() => s.step.value, () => { userA.value = null; });
function onSlide(e) { s.pause(); userA.value = Math.max(1, Math.min(360, Math.round(+e.target.value))); }
const scheduled = computed(() => (step.value === 5 ? 360 + (135 - 360) * k.value : 360));
const alphaDeg = computed(() => userA.value ?? scheduled.value);
const B = computed(() => build(alphaDeg.value));

// Step 2: the profile turning, the vertices' circles traced behind it.
const phiNow = computed(() => (step.value === 1 ? B.value.alpha * k.value : step.value === 0 ? 0 : B.value.alpha));
const turning = computed(() => poly(turned(loopPts, phiNow.value)));
const traced = computed(() => (step.value >= 1 && step.value <= 2 ? [[4, -2.5], [4, 0], [2, 2]].map(([r, y]) => poly(circleArc(r, y, phiNow.value))) : []));
// Step 3: one ring's control polygon (ρ = 4 at y = 0) appears piece by piece.
const ringShown = computed(() => {
  const r = B.value.rings[1], n = r.pts.length - 1, m = step.value === 2 ? Math.max(1, Math.ceil(k.value * n / 2) * 2) : n;
  return { line: poly(r.pts.slice(0, m + 1)), pts: r.pts.slice(0, m + 1).map((p, i) => ({ q: view(p), mid: i % 2 === 1, w: r.w[i] })) };
});
const net = computed(() => {
  if (step.value < 3) return null;
  const rs = B.value.rings, cols = rs[0].pts.map((_, a) => poly(rs.map(r => r.pts[a])));
  return { rows: rs.map(r => poly(r.pts)), cols, dots: rs.flatMap((r, j) => r.pts.map((p, a) => ({ q: view(p), w: r.w[a], key: `${j}_${a}` }))) };
});
const surface = computed(() => (step.value >= 4 ? B.value.curves.map(poly) : []));
const caps = computed(() => (B.value.alpha < TAU - 1e-9 && step.value >= 4 ? [0, B.value.alpha].map(phi => poly(turned(loopPts, phi))) : []));
const label05 = computed(() => { const r = B.value.rings[2]; return { q: view(r.pts[1]), w: r.w[1] }; });
const partsText = computed(() => { const n = B.value.st.length - 1; return B.value.alpha >= TAU - 1e-9 ? '2 halves' : n === 1 ? '1 part' : '2 parts of α/2'; });
const axisTop = view([0, 3.4, 0]), axisBottom = view([0, -3.6, 0]);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Revolve: a profile turned on exact rational arcs" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A profile of lines and an arc turned about a vertical axis, with the rings of rational control points that make its surfaces">
        <line :x1="axisTop[0]" :y1="axisTop[1]" :x2="axisBottom[0]" :y2="axisBottom[1]" class="axis" />
        <text :x="axisTop[0] + 5" :y="axisTop[1] + 4" class="small">axis</text>
        <polygon v-for="(c, i) in caps" :key="'c' + i" :points="c" class="cap" />
        <polyline v-for="(c, i) in surface" :key="'s' + i" :points="c" class="surf" />
        <g v-if="net">
          <polyline v-for="(r, i) in net.rows" :key="'nr' + i" :points="r" class="net" />
          <polyline v-for="(c, i) in net.cols" :key="'nc' + i" :points="c" class="net thin" />
          <circle v-for="d in net.dots" :key="'nd' + d.key" :cx="d.q[0]" :cy="d.q[1]" :r="1.4 + 1.6 * d.w" class="pole" :class="{ light: d.w < 0.99 }" />
          <text v-if="step === 3" :x="label05.q[0] - 6" :y="label05.q[1] - 6" class="tag" text-anchor="end">w = {{ num(label05.w, 4) }}</text>
        </g>
        <polyline v-for="(t, i) in traced" :key="'t' + i" :points="t" class="trace" />
        <g v-if="step === 2">
          <polyline :points="ringShown.line" class="ringpoly" />
          <circle v-for="(d, i) in ringShown.pts" :key="'rp' + i" :cx="d.q[0]" :cy="d.q[1]" :r="d.mid ? 3.4 : 2.8" :class="d.mid ? 'mid' : 'end'" />
          <text v-if="ringShown.pts.length > 1" :x="ringShown.pts[1].q[0] - 6" :y="ringShown.pts[1].q[1] + 14" class="tag" text-anchor="end">w = {{ num(B.wm, 4) }}</text>
        </g>
        <polygon :points="turning" class="profile" :class="{ ghost: step >= 3 }" />
        <polygon v-if="step >= 1 && step <= 2" :points="poly(turned(loopPts, 0))" class="profile ghost" />
        <g class="readout">
          <text x="252" y="22">α = {{ num(alphaDeg, 1) }}°</text>
          <text x="252" y="38">{{ partsText }}</text>
          <text x="252" y="54">{{ B.spans }} piece{{ B.spans > 1 ? 's' : '' }} a part</text>
          <text x="252" y="70">Δ = {{ num(B.dt * 180 / Math.PI, 2) }}°</text>
          <text x="252" y="86">w = cos(Δ/2)</text>
          <text x="264" y="102">= {{ num(B.wm, 4) }}</text>
          <text x="252" y="118">middle at ρ / w</text>
          <text x="252" y="134">{{ B.rings[0].pts.length }} poles a ring</text>
          <text v-if="step >= 3" x="252" y="154" class="b">torus middle row</text>
          <text v-if="step >= 3" x="252" y="170" class="b">{{ num(B.wm, 4) }} × 0.7071</text>
          <text v-if="step >= 3" x="264" y="186" class="b">= {{ num(B.wm * SQ, 4) }}</text>
        </g>
      </svg>
      <div class="controls">
        <label>turn angle α <input type="range" min="1" max="360" step="1" :value="alphaDeg" aria-label="Turn angle in degrees" @input="onSlide"> <span>{{ num(alphaDeg, 1) }}°</span></label>
        <div class="cases" role="group" aria-label="Preset angles">
          <button v-for="a in [90, 135, 270, 360]" :key="a" type="button" :aria-pressed="Math.abs(alphaDeg - a) < 1e-9" @click="s.pause(); userA = a">{{ a }}°</button>
        </div>
      </div>
      <template #note>Computed in the page with the kernel's arc pieces and stations (<code>unitArc</code>, <code>revolveProfile</code>).
        The built kernel, given this profile, makes the same rows and weights. The flat bottom and top discs are planar faces;
        they are drawn only as their rims. The slider holds until the next step.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
svg .small { font-size: 10px; }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.readout .b { fill: var(--b); }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 5 3; }
.profile { fill: var(--a); fill-opacity: 0.16; stroke: var(--a); stroke-width: 2; stroke-linejoin: round; }
.profile.ghost { fill-opacity: 0.06; stroke-width: 1; stroke-dasharray: 3 2; }
.cap { fill: var(--b); fill-opacity: 0.18; stroke: var(--b); stroke-width: 1.2; }
.trace { fill: none; stroke: var(--keep); stroke-width: 1.6; }
.ringpoly { fill: none; stroke: var(--hot); stroke-width: 1.2; stroke-dasharray: 3 2; }
.mid { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.end { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; }
.net { fill: none; stroke: var(--b); stroke-width: 1; opacity: 0.75; } .net.thin { stroke-width: 0.7; opacity: 0.5; }
.pole { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 0.8; } .pole.light { fill: var(--hot); }
.surf { fill: none; stroke: var(--keep); stroke-width: 1.1; opacity: 0.85; }
.tag { fill: var(--hot); font-weight: 600; font-size: 11px; }
.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 16px; border-top: 1px solid var(--vp-c-divider); font-size: 13px; }
.cases { display: flex; flex-wrap: wrap; gap: 4px; }
.cases button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 10px; font-size: 13px; background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.cases button[aria-pressed='true'] { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: var(--vp-c-white); }
button:focus-visible, input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
label { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--vp-c-text-2); }
label input { width: 140px; accent-color: var(--vp-c-brand-1); }
label span { font-variant-numeric: tabular-nums; color: var(--vp-c-text-1); }
</style>
