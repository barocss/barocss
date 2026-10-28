<script setup>
// The nearest point of a surface (packages/barocss-cad/src/nurbs/surfaces/surface-closest.ts, closestPointOnSurface),
// in section: one quarter patch of a cylinder R 10 mm is, across its axis, a rational quadratic arc — one span of the
// kernel's circle. The iteration below is the kernel's with v left out: the Gauss–Newton step on exact first
// derivatives, clamped to [0, 1], halved (up to 40 times) while it would take the curve farther; after two slow steps
// (each more than 0.3 of the one before) Newton's step with the second derivative, kept when nearer; done at a step
// below 1e-15 (1 + |u|), at the rounding floor, or after 30 steps. Run here, in the page, for the slider's point.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const R = 10, W = Math.SQRT1_2;
// The arc from 135° (u = 0) to 45° (u = 1): control points and weights of a 90° rational quadratic.
const CP = [[-R * W, R * W], [0, R * Math.SQRT2], [R * W, R * W]], WT = [1, W, 1];
/** The arc's point, first and second derivatives at u (the rational quotient rule). */
function arc(u) {
  const B = [(1 - u) ** 2, 2 * u * (1 - u), u * u], dB = [-2 * (1 - u), 2 - 4 * u, 2 * u], ddB = [2, -4, 2];
  let nx = 0, ny = 0, dnx = 0, dny = 0, ddnx = 0, ddny = 0, w = 0, dw = 0, ddw = 0;
  for (let i = 0; i < 3; i++) {
    const a = WT[i], x = CP[i][0], y = CP[i][1];
    w += B[i] * a; dw += dB[i] * a; ddw += ddB[i] * a;
    nx += B[i] * a * x; ny += B[i] * a * y; dnx += dB[i] * a * x; dny += dB[i] * a * y; ddnx += ddB[i] * a * x; ddny += ddB[i] * a * y;
  }
  const p = [nx / w, ny / w], d = [(dnx - p[0] * dw) / w, (dny - p[1] * dw) / w];
  return { p, d, dd: [(ddnx - 2 * d[0] * dw - p[0] * ddw) / w, (ddny - 2 * d[1] * dw - p[1] * ddw) / w] };
}
const PHI = 106 * Math.PI / 180, F = [R * Math.cos(PHI), R * Math.sin(PHI)];
// The seed grid: three nodes along the arc here (the kernel's has 25 × 25), so the first steps are large enough to see.
const NODES = [0, 0.5, 1];
const dist2 = (q, P) => (q[0] - P[0]) ** 2 + (q[1] - P[1]) ** 2;
const clamp01 = u => Math.min(1, Math.max(0, u));
/** The kernel's iteration in one parameter; `newton` false leaves out the slow-case Newton step (Gauss–Newton alone). */
function run(P, seed, newton) {
  let u = seed, e = arc(u), f2 = dist2(e.p, P), last = Infinity, lastRatio = 0, it = 0;
  const scale = 1 + P[0] * P[0] + P[1] * P[1];
  const path = [{ u, p: e.p, err: Math.hypot(e.p[0] - F[0], e.p[1] - F[1]) }];
  for (; it < 30; it++) {
    const rx = e.p[0] - P[0], ry = e.p[1] - P[1], a = e.d[0] * e.d[0] + e.d[1] * e.d[1], g = rx * e.d[0] + ry * e.d[1];
    if (!(Math.abs(a) > 1e-300)) break;
    const du = -g / a;
    let t = 1, nu = u, next = e, n2 = f2, halves = 0;
    for (let h = 0; h < 40; h++, t /= 2) { nu = clamp01(u + t * du); next = arc(nu); n2 = dist2(next.p, P); if (n2 <= f2 * (1 + 1e-12) + 1e-28 * scale) break; halves++; }
    let su = nu - u, kind = 'gn';
    const size = Math.abs(su), ratio = size / last;
    if (newton && ratio > 0.3 && lastRatio > 0.3 && size > 1e-12) {
      const A = a + rx * e.dd[0] + ry * e.dd[1];
      if (A > 0) { const wu = clamp01(u - g / A), w = arc(wu), w2 = dist2(w.p, P); if (w2 < n2) { su = wu - u; nu = wu; next = w; n2 = w2; kind = 'newton'; } }
    }
    if (ratio > 1 && n2 >= f2 && Math.abs(su) < 1e-8) { it++; break; }
    last = size; lastRatio = ratio;
    path.push({ u: nu, p: next.p, err: Math.hypot(next.p[0] - F[0], next.p[1] - F[1]), lin: [e.p[0] + du * e.d[0], e.p[1] + du * e.d[1]], full: halves ? arc(clamp01(u + du)).p : null, halves, kind });
    u = nu; e = next; f2 = n2;
    if (Math.abs(su) < 1e-15 * (1 + Math.abs(u))) { it++; break; }
  }
  const settled = path.findIndex(q => q.err <= 1e-7);
  return { path, it, settled, newtons: path.filter(q => q.kind === 'newton').length, halves: path.reduce((n, q) => n + (q.halves ?? 0), 0) };
}

const d = ref(5);
const PRESETS = [{ d: 0, label: 'on it' }, { d: 5, label: '5 mm out' }, { d: 15, label: '15 mm out' }, { d: -9, label: '9 mm in' }];
const P = computed(() => [(R + d.value) * Math.cos(PHI), (R + d.value) * Math.sin(PHI)]);
const seed = computed(() => NODES.reduce((b, n) => (dist2(arc(n).p, P.value) < dist2(arc(b).p, P.value) ? n : b), NODES[0]));
const K = computed(() => run(P.value, seed.value, true));
const G = computed(() => run(P.value, seed.value, false));
const dk = computed(() => Math.abs(d.value) / R);
const side = computed(() => (d.value > 0 ? 'out' : d.value < 0 ? 'in' : 'on'));
const settledText = r => (r.settled < 0 ? '> 30' : String(r.settled));
/** x as m × 10ⁿ in HTML (one decimal). */
function sci(x) {
  if (!(x > 1e-16)) return '0';
  const e = Math.floor(Math.log10(x)), m = x / 10 ** e;
  return e === 0 ? m.toFixed(1) : `${m.toFixed(1)} × 10<sup>${e < 0 ? '−' : ''}${Math.abs(e)}</sup>`;
}
const errs = r => r.path.slice(0, 5).map(q => sci(q.err)).join(' → ');
/** The ratio of successive errors of Gauss–Newton alone, measured past its first steps (none when it halved). */
const measured = computed(() => { const p = G.value.path, k = Math.min(6, p.length - 1); return G.value.halves === 0 && k >= 2 && p[k - 1].err > 1e-13 ? p[k].err / p[k - 1].err : null; });

const steps = computed(() => [
  { label: 'The nearest point', text: 'Given a point P, find the parameter u (on a surface, u and v) of the curve\'s point nearest P. There the line from the curve to P is square to the curve: the distance has a minimum. In section, a quarter patch of a cylinder R 10 is an arc; P is set at the slider\'s distance d along the arc\'s normal at 106°, so the answer is known.', formula: 'minimise ½ ‖C(u) − P‖² &nbsp; ⇔ &nbsp; r · C′(u) = 0, &nbsp; r = C(u) − P' },
  { label: 'A seed', text: 'The iteration starts from a seed: one the caller gives (the last answer, the vertex before), else the nearest node of a grid of the domain. The kernel\'s grid is 25 × 25 nodes (n = 24), built once per surface and passed to every query; this arc has three, so the steps are large enough to see.' },
  { label: 'Project onto the tangent', text: 'Replace the curve by its tangent line at the current point and drop P onto that line. In the parameter this is the Gauss–Newton step. On a surface it is the 2 × 2 system of the tangent plane.', formula: 'Δu = −(r · C′) / (C′ · C′)<br>surface: [S<sub>u</sub>·S<sub>u</sub> &nbsp;S<sub>u</sub>·S<sub>v</sub> ; S<sub>u</sub>·S<sub>v</sub> &nbsp;S<sub>v</sub>·S<sub>v</sub>] (Δu, Δv) = −(r·S<sub>u</sub>, r·S<sub>v</sub>)' },
  { label: 'Back onto the curve', text: `u + Δu, clamped to the domain, is evaluated on the curve itself. The step is kept when it brings the curve no farther from P, else halved, up to 40 times. ${K.value.path[1]?.halves ? `Here the whole first step went farther (the hollow mark) and was halved ${K.value.path[1].halves === 1 ? 'once' : K.value.path[1].halves + ' times'}.` : 'Here the whole step is kept; at 15 mm out it is not.'}`, formula: 'u ← clamp(u + t Δu), &nbsp; t = 1, ½, ¼ … &nbsp;until ‖C(u) − P‖² ≤ (1 + 10⁻¹²) × the last' },
  { label: 'Repeat', text: `Each step starts from the point the last one reached. The foot's error, in mm, falls ${errs(K.value)} … (plotted on the right, on a log scale). Exactly on the curve (d = 0) the error is squared each step: quadratic convergence.` },
  { label: 'Off the curve: linear', text: `Newton's method would divide by the whole second derivative of the distance, C′·C′ + r·C″. Gauss–Newton drops r·C″. At the foot r runs along the normal with length d, so the dropped part is about d κ of what is kept (κ = 1/R, the curvature). Each step then leaves about d κ of the error: here d κ = ${num(dk.value, 2)}${measured.value !== null ? `, measured ${num(measured.value, 2)}` : ''}. Outside a convex curve the step is too long by 1 + d κ and the points alternate sides; past the radius (d κ &gt; 1) it would swing away, and halving holds it. Inside, it falls short by 1 − d κ and creeps near the axis.`, formula: 'error<sub>k+1</sub> ≈ ∓ d κ · error<sub>k</sub> &nbsp; (− outside, + inside)' },
  { label: 'Slow: try Newton', text: `When two steps running each shrink by less than 3⅓ (each more than 0.3 of the one before) and are not of rounding's size, Newton's step with the second derivative is tried as well. It is kept when the full second derivative is positive (on a surface, the Hessian positive definite) and it ends nearer. Once the foot is within about 10⁻⁸ d of the true one, the squared distances compared agree to rounding, Newton's step is no longer kept, and Gauss–Newton's steps carry on. Second derivatives cost about 30 first ones, so only then. Here: ${K.value.newtons ? `${K.value.newtons} Newton step${K.value.newtons === 1 ? '' : 's'} (ringed)` : 'no Newton step'}; the foot within 10⁻⁷ mm (the linear tolerance) after ${K.value.settled < 0 ? 'more than 30' : K.value.settled} steps, against ${G.value.settled < 0 ? 'more than 30' : G.value.settled} for Gauss–Newton alone.`, formula: 'Δu = −(r · C′) / (C′ · C′ + r · C″) &nbsp; if C′ · C′ + r · C″ &gt; 0' },
  { label: 'When it stops', text: `Done when a step is below 10⁻¹⁵ of the parameters' size; or at the rounding floor (a step under 10⁻⁸ of the domain that grew and brought nothing nearer: the point before is kept); or after 30 steps, the default. It returns u, v, the point, its distance, the unit normal S<sub>u</sub> × S<sub>v</sub> (zero at a pole) and the steps taken: here ${K.value.it}.`, formula: 'stop: |Δu| + |Δv| &lt; 10⁻¹⁵ (1 + |u| + |v|) · rounding floor · 30 steps' },
]);
const s = useSteps(8, [2400, 2800, 2800, 2800, 4200, 3600, 3200, 2600], root);
const k = computed(() => ease(s.t.value));

// The view: mm, centre of the arc at (100, 212), 7 px a mm; the plot to the right.
const X = x => 100 + 7 * x, Y = y => 212 - 7 * y;
const pt = q => `${X(q[0])},${Y(q[1])}`;
const ARC = Array.from({ length: 61 }, (_, i) => pt(arc(i / 60).p)).join(' ');
const CYL = Array.from({ length: 73 }, (_, i) => { const a = Math.PI * (10 + 160 * i / 72) / 180; return pt([R * Math.cos(a), R * Math.sin(a)]); }).join(' ');
const PX = i => 216 + 5.1 * i, PY = e => 30 + (1 - Math.log10(Math.max(e, 1e-16))) * (166 / 17);
const DECADES = [0, -4, -8, -12, -16];
const LABEL = { 0: '1', '-4': '10⁻⁴', '-8': '10⁻⁸', '-12': '10⁻¹²', '-16': '10⁻¹⁶' };
/** How many iterates of a run are shown now. */
function shownOf(r) {
  const n = r.path.length - 1, st = s.step.value;
  if (st < 1) return -1;
  if (st < 3) return 0;
  if (st === 3) return Math.min(n, k.value > 0.5 ? 1 : 0);
  if (st === 4) return Math.min(n, Math.max(1, Math.round(k.value * n)));
  return n;
}
const shownK = computed(() => shownOf(K.value)), shownG = computed(() => shownOf(G.value));
const plotLine = (r, n) => r.path.slice(0, n + 1).map((q, i) => `${PX(i)},${PY(q.err)}`).join(' ');
const first = computed(() => K.value.path[1] ?? null);
const seedPt = computed(() => arc(seed.value).p);
/** The tangent line at the seed, long enough to hold P's foot on it. */
const tangent = computed(() => {
  const e = arc(seed.value), l = Math.hypot(e.d[0], e.d[1]), t = [e.d[0] / l, e.d[1] / l];
  const reach = first.value ? Math.max(3, 1.4 * Math.hypot(first.value.lin[0] - e.p[0], first.value.lin[1] - e.p[1])) : 3, grow = s.step.value === 2 ? k.value : 1;
  return { a: [e.p[0] - reach * grow * t[0], e.p[1] - reach * grow * t[1]], b: [e.p[0] + reach * grow * t[0], e.p[1] + reach * grow * t[1]] };
});
/** The point moving from the tangent's foot back onto the curve (step 4). */
const moving = computed(() => {
  const f = first.value; if (!f) return seedPt.value;
  const u = s.step.value === 3 ? k.value : 1;
  return [f.lin[0] + (f.p[0] - f.lin[0]) * u, f.lin[1] + (f.p[1] - f.lin[1]) * u];
});
const chain = computed(() => K.value.path.slice(0, shownK.value + 1).map(q => pt(q.p)).join(' '));
const foot = computed(() => K.value.path[K.value.path.length - 1].p);
const normalTip = computed(() => [foot.value[0] + 3 * Math.cos(PHI), foot.value[1] + 3 * Math.sin(PHI)]);
function set(v) { d.value = v; }
function drag(e) { d.value = +e.target.value; }
</script>

<template>
  <div ref="root">
    <AlgoFigure title="The nearest point by Gauss–Newton, in section" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="An arc, a point off it, and Gauss–Newton steps converging to the nearest point, with the error per step plotted">
        <polyline :points="CYL" class="cyl" />
        <polyline :points="ARC" class="patch" />
        <circle :cx="X(0)" :cy="Y(0)" r="2" class="axis" /><text :x="X(0) + 6" :y="Y(0) - 3" class="small">axis</text>
        <text :x="X(7.6)" :y="Y(6.4)" class="name a">patch</text>
        <!-- 1: the foot, square to the curve -->
        <g v-if="s.step.value === 0">
          <line :x1="X(P[0])" :y1="Y(P[1])" :x2="X(P[0] + (F[0] - P[0]) * k)" :y2="Y(P[1] + (F[1] - P[1]) * k)" class="perp" />
          <circle v-if="k > 0.95" :cx="X(F[0])" :cy="Y(F[1])" r="3.6" class="foot" />
        </g>
        <!-- 2: the grid's nodes and the seed -->
        <g v-if="s.step.value === 1">
          <line v-for="n in NODES" :key="'l' + n" :x1="X(P[0])" :y1="Y(P[1])" :x2="X(arc(n).p[0])" :y2="Y(arc(n).p[1])" class="probe" :style="{ opacity: k }" />
        </g>
        <g v-if="s.step.value >= 1">
          <rect v-for="n in NODES" :key="'n' + n" :x="X(arc(n).p[0]) - 2.5" :y="Y(arc(n).p[1]) - 2.5" width="5" height="5" class="node" />
          <circle :cx="X(seedPt[0])" :cy="Y(seedPt[1])" r="5.5" class="seed" :style="{ opacity: s.step.value === 1 ? k : 1 }" />
        </g>
        <!-- 3–4: the first step, tangent and back -->
        <g v-if="(s.step.value === 2 || s.step.value === 3) && first">
          <line :x1="X(tangent.a[0])" :y1="Y(tangent.a[1])" :x2="X(tangent.b[0])" :y2="Y(tangent.b[1])" class="tangent" />
          <line :x1="X(P[0])" :y1="Y(P[1])" :x2="X(first.lin[0])" :y2="Y(first.lin[1])" class="perp" :style="{ opacity: s.step.value === 2 ? k : 1 }" />
          <circle :cx="X(first.lin[0])" :cy="Y(first.lin[1])" r="3" class="lin" :style="{ opacity: s.step.value === 2 ? k : 1 }" />
          <g v-if="s.step.value === 3">
            <circle v-if="first.full" :cx="X(first.full[0])" :cy="Y(first.full[1])" r="4" class="ghost" />
            <circle :cx="X(moving[0])" :cy="Y(moving[1])" r="3.4" class="iter" />
          </g>
        </g>
        <!-- 5–8: the iterates -->
        <g v-if="s.step.value >= 4">
          <polyline :points="chain" class="chain" />
          <circle v-for="(q, i) in K.path.slice(0, shownK + 1)" :key="'i' + i" :cx="X(q.p[0])" :cy="Y(q.p[1])" r="2.4" class="iter" />
        </g>
        <g v-if="s.step.value === 7">
          <line :x1="X(foot[0])" :y1="Y(foot[1])" :x2="X(normalTip[0])" :y2="Y(normalTip[1])" class="normal" />
          <circle :cx="X(foot[0])" :cy="Y(foot[1])" r="3.6" class="foot" />
        </g>
        <circle :cx="X(P[0])" :cy="Y(P[1])" r="4" class="p" /><text :x="X(P[0]) + 7" :y="Y(P[1]) + 4" class="tag">P</text>
        <!-- the error per step -->
        <g class="plot">
          <text x="216" y="18" class="small">foot error, mm</text>
          <line v-for="e in DECADES" :key="'g' + e" x1="216" :x2="PX(30)" :y1="PY(10 ** e)" :y2="PY(10 ** e)" class="grid" />
          <line x1="216" :x2="PX(30)" :y1="PY(1e-7)" :y2="PY(1e-7)" class="grid strong" /><text :x="PX(30)" :y="PY(1e-7) - 3" class="small end">10⁻⁷</text>
          <text v-for="e in DECADES" :key="'t' + e" x="212" :y="PY(10 ** e) + 3" class="small end">{{ LABEL[e] }}</text>
          <text :x="PX(0)" y="206" class="small mid">0</text><text :x="PX(10)" y="206" class="small mid">10</text><text :x="PX(20)" y="206" class="small mid">20</text><text :x="PX(30)" y="206" class="small mid">30</text><text :x="PX(15)" y="206" class="small mid">steps</text>
          <polyline v-if="shownG >= 0" :points="plotLine(G, shownG)" class="series gn" />
          <circle v-for="(q, i) in (shownG >= 0 ? G.path.slice(0, shownG + 1) : [])" :key="'pg' + i" :cx="PX(i)" :cy="PY(q.err)" r="1.8" class="dot gn" />
          <polyline v-if="shownK >= 0" :points="plotLine(K, shownK)" class="series kn" />
          <circle v-for="(q, i) in (shownK >= 0 ? K.path.slice(0, shownK + 1) : [])" :key="'pk' + i" :cx="PX(i)" :cy="PY(q.err)" r="1.8" class="dot kn" />
          <g v-if="s.step.value >= 6">
            <circle v-for="(q, i) in K.path" v-show="q.kind === 'newton'" :key="'nw' + i" :cx="PX(i)" :cy="PY(q.err)" r="4.2" class="ring" />
          </g>
          <line x1="216" x2="228" y1="220" y2="220" class="series gn" /><text x="232" y="223" class="small">Gauss–Newton alone: {{ settledText(G) }}</text>
          <line x1="216" x2="228" y1="233" y2="233" class="series kn" /><text x="232" y="236" class="small">the kernel: {{ settledText(K) }}</text>
        </g>
      </svg>
      <div class="controls">
        <div class="cases" role="group" aria-label="Distance of P">
          <button v-for="o in PRESETS" :key="o.d" type="button" :aria-pressed="d === o.d" @click="set(o.d)">{{ o.label }}</button>
        </div>
        <label>d <input type="range" min="-9.5" max="15" step="0.5" :value="d" aria-label="Distance of P from the arc, mm (negative: inside)" @input="drag"> <span>{{ num(Math.abs(d), 1) }} mm {{ side }} · d κ = {{ num(dk, 2) }}</span></label>
      </div>
      <template #note>Computed in the page with the kernel's iteration, in one parameter: the cylinder's section is a
        rational quadratic arc, so v and the 2 × 2 solve drop out. The legend counts the steps until the foot is within
        10⁻⁷ mm of the true one (the dashed line, the kernel's linear tolerance); the iteration itself goes on until its
        stop test holds. The seed grid has three nodes here,
        the kernel's 25 per direction. A foot on a domain edge, solved along that edge, does not occur on this arc.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.small { font-size: 10px; } .end { text-anchor: end; } .mid { text-anchor: middle; }
.cyl { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 3 3; }
.patch { fill: none; stroke: var(--a); stroke-width: 2.6; stroke-linecap: round; }
.axis { fill: var(--vp-c-text-3); }
.name { font-weight: 700; } .name.a { fill: var(--a); }
.p { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.tag { fill: var(--hot); font-weight: 700; }
.perp { stroke: var(--hot); stroke-width: 1.2; stroke-dasharray: 3 2; }
.probe { stroke: var(--vp-c-text-3); stroke-width: 0.8; }
.foot { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; }
.node { fill: var(--vp-c-bg); stroke: var(--vp-c-text-2); stroke-width: 1.2; }
.seed { fill: none; stroke: var(--b); stroke-width: 1.6; }
.tangent { stroke: var(--b); stroke-width: 1.4; }
.lin { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 1.5; }
.ghost { fill: none; stroke: var(--hot); stroke-width: 1.4; stroke-dasharray: 2 2; }
.iter { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.chain { fill: none; stroke: var(--keep); stroke-width: 0.9; opacity: 0.7; }
.normal { stroke: var(--keep); stroke-width: 1.6; }
.grid { stroke: var(--vp-c-divider); stroke-width: 0.8; } .grid.strong { stroke: var(--vp-c-text-3); stroke-dasharray: 3 2; }
.series { fill: none; stroke-width: 1.4; } .series.gn { stroke: var(--b); } .series.kn { stroke: var(--keep); }
.dot.gn { fill: var(--b); } .dot.kn { fill: var(--keep); }
.ring { fill: none; stroke: var(--hot); stroke-width: 1.3; }
.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 16px; border-top: 1px solid var(--vp-c-divider); font-size: 13px; }
.cases { display: flex; flex-wrap: wrap; gap: 4px; }
.cases button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 10px; font-size: 13px; background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.cases button[aria-pressed='true'] { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: var(--vp-c-white); }
button:focus-visible, input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
label { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--vp-c-text-2); }
label input { width: 140px; }
label span { font-variant-numeric: tabular-nums; color: var(--vp-c-text-1); }
</style>
