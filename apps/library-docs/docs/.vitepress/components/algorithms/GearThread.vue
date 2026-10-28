<script setup>
// A modelled ISO metric thread (packages/barocss-cad/src/machine/thread-solid.ts, thread-helical.ts) on an M8 × 1.25 rod
// 7.5 mm long. The profile (isoThreadRadius), the phase φ = z/P − θ/2π, the four bands with their breaks, the clip of
// each half turn to the end planes (Sutherland–Hodgman in (θ, φ)) and the helix row's seven poles (helixRow) are the
// kernel's, run here in the page. The surface is drawn as 10° pieces of the exact ruled bands. The built kernel's numbers
// (dist/index.js, threadSolid({ diameter 8, pitch 1.25, length 7.5 })): 56 faces (54 thread faces, 2 ends), 12 edges of
// degree 4, volume 310.284 mm³; the faceted form: 5855 faces, 309.265 mm³.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const D = 8, P = 1.25, H = Math.sqrt(3) / 2 * P, RMAJ = D / 2, RMIN = RMAJ - 5 * H / 8;
/** The kernel's isoThreadRadius: the basic profile's radius at a phase (0: the middle of a crest). */
function isoR(phase) {
  let u = phase - Math.floor(phase); if (u > 0.5) u -= 1;
  const a = Math.abs(u), crest = 1 / 16, flank = 0.3125;
  return a <= crest ? RMAJ : a <= crest + flank ? RMAJ - (RMAJ - RMIN) * (a - crest) / flank : RMIN;
}
const BREAKS = [-0.375, -0.0625, 0.0625, 0.375, 0.625];
const Z0 = -7.5, Z1 = 0, C0 = Z0 / P, C1 = Z1 / P, TWO_PI = 2 * Math.PI, NT = 36;
const HANDLE = 4 / 3 * Math.tan(Math.PI / 8);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
/** Sutherland–Hodgman against g ≥ 0 (the kernel's clip, without its side labels). */
function clip(poly, g) {
  const out = [], eps = 1e-13;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], gp = g(p[0], p[1]), gq = g(q[0], q[1]), pin = gp >= -eps, qin = gq >= -eps;
    const cut = () => { const s = gp / (gp - gq); return [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s]; };
    if (pin && qin) out.push(p); else if (pin) { out.push(p); out.push(cut()); } else if (qin) out.push(cut());
  }
  return out;
}
const below = (t, f) => f + t / TWO_PI - C0, above = (t, f) => C1 - f - t / TWO_PI;
// The view: isometric, from (1, 1, 1); mm → px.
const SC = 18, OX = 116, OY = 73, RV = [-Math.SQRT1_2, Math.SQRT1_2, 0], UV = [-1 / Math.sqrt(6), -1 / Math.sqrt(6), 2 / Math.sqrt(6)], VV = unit([1, 1, 1]), LIGHT = unit([0.15, 0.55, 0.8]);
const proj = p => [OX + SC * dot(p, RV), OY - SC * dot(p, UV)];
const path = pts => pts.map((p, i) => { const q = proj(p); return `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`; }).join('');
const cpath = pts => path(pts) + 'Z';

// The highlighted face: the upper flank (band 2) of period −3, its first half turn.
const HM = -3, HB = 2;
const QUADS = [];
for (let m = Math.floor(C0 - 1) - 1; m <= Math.ceil(C1) + 1; m++) for (let b = 0; b < 4; b++) {
  const f0 = m + BREAKS[b], f1 = m + BREAKS[b + 1], r0 = isoR(f0), r1 = isoR(f1);
  const at = (t, f) => { const r = r0 + (r1 - r0) * (f - f0) / (f1 - f0); return [r * Math.cos(t), r * Math.sin(t), P * (f + t / TWO_PI)]; };
  for (let i = 0; i < NT; i++) {
    const ta = TWO_PI * i / NT, tb = TWO_PI * (i + 1) / NT, poly = clip(clip([[ta, f0], [tb, f0], [tb, f1], [ta, f1]], below), above);
    if (poly.length < 3) continue;
    const pts = poly.map(([t, f]) => at(t, f)), n = [0, 0, 0], c = [0, 0, 0];
    for (let j = 0; j < pts.length; j++) {
      const p = pts[j], q = pts[(j + 1) % pts.length];
      n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]);
      for (let a = 0; a < 3; a++) c[a] += p[a] / pts.length;
    }
    const tm = (ta + tb) / 2, nn = unit(dot(n, [Math.cos(tm), Math.sin(tm), 0]) < 0 ? n.map(x => -x) : n);
    // (Facing away: the inside of the surface, seen only through the open top while the thread is being built.)
    const back = dot(nn, VV) <= 0;
    if (back && dot(c, VV) > 0) continue;
    QUADS.push({ d: cpath(pts), depth: dot(c, VV), tb, back, pct: back ? 0 : Math.round(16 + 64 * Math.max(0, dot(nn, LIGHT))), hl: m === HM && b === HB && ta < Math.PI - 1e-9 });
  }
}
QUADS.sort((a, b) => a.depth - b.depth);
QUADS.forEach((q, i) => { q.key = i; });
const BEHIND_CAP = QUADS.filter(q => q.depth < 0), BEFORE_CAP = QUADS.filter(q => q.depth >= 0);
// The top end: z = 0, r(φ) with φ = −θ/2π; the ghost cylinders; the axis.
const CAP = Array.from({ length: 145 }, (_, i) => { const t = TWO_PI * i / 144, r = isoR(C1 - t / TWO_PI); return [r * Math.cos(t), r * Math.sin(t), Z1]; });
const ring = (r, z) => Array.from({ length: 73 }, (_, i) => { const t = TWO_PI * i / 72; return [r * Math.cos(t), r * Math.sin(t), z]; });
const side = (r, sgn) => { const t = Math.PI / 4 + sgn * Math.PI / 2; return [[r * Math.cos(t), r * Math.sin(t), Z0], [r * Math.cos(t), r * Math.sin(t), Z1]]; };
const GHOST = [RMAJ, RMIN].map(r => ({ r, top: path(ring(r, Z1)), bottom: path(ring(r, Z0)), sides: [path(side(r, 1)), path(side(r, -1))] }));
const AXIS = path([[0, 0, Z0 - 0.8], [0, 0, Z1 + 0.8]]);
// The crest helix (phase 0), six turns from the bottom; its front and back samples.
const HELIX = Array.from({ length: 6 * 48 + 1 }, (_, i) => { const t = TWO_PI * i / 48; return { p: [RMAJ * Math.cos(t), RMAJ * Math.sin(t), Z0 + P * t / TWO_PI], front: Math.cos(t) + Math.sin(t) > 0 }; });
// The highlighted face's two helices (its band's edges) and rulings, and the seven poles of its first row (helixRow).
const HF0 = HM + BREAKS[HB], HF1 = HM + BREAKS[HB + 1];
const bandAt = (t, f) => { const r = isoR(f); return [r * Math.cos(t), r * Math.sin(t), P * (f + t / TWO_PI)]; };
const EDGE0 = Array.from({ length: 49 }, (_, i) => bandAt(Math.PI * i / 48, HF0)), EDGE1 = Array.from({ length: 49 }, (_, i) => bandAt(Math.PI * i / 48, HF1));
const RULINGS = Array.from({ length: 7 }, (_, i) => [bandAt(Math.PI * i / 6, HF0), bandAt(Math.PI * i / 6, HF1)]);
function helixRow(r, f, ta) {
  const at = t => [r * Math.cos(t), r * Math.sin(t), P * (f + t / TWO_PI)], out = [at(ta)];
  for (let s = 0; s < 2; s++) {
    const a = ta + s * Math.PI / 2, b = a + Math.PI / 2, A = at(a), B = at(b), dz = P / 12;
    out.push([A[0] - r * Math.sin(a) * HANDLE, A[1] + r * Math.cos(a) * HANDLE, A[2] + dz], [B[0] + r * Math.sin(b) * HANDLE, B[1] - r * Math.cos(b) * HANDLE, B[2] - dz], B);
  }
  return out;
}
const ROW = helixRow(isoR(HF0), HF0, 0), ROW2D = ROW.map(proj);
const ROW_CURVE = (() => { const q = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`; return `M${q(ROW2D[0])}C${q(ROW2D[1])} ${q(ROW2D[2])} ${q(ROW2D[3])}C${q(ROW2D[4])} ${q(ROW2D[5])} ${q(ROW2D[6])}`; })();
// The cubic quarter circle's largest radius, per unit radius (the handle 4/3 tan(π/8)): 1 + 2.7e-4.
const BULGE = (() => { let mx = 0; for (let i = 0; i <= 400; i++) { const t = i / 400, u = 1 - t, x = u ** 3 + 3 * u * u * t + 3 * u * t * t * HANDLE, y = 3 * u * u * t * HANDLE + 3 * u * t * t + t ** 3; mx = Math.max(mx, Math.hypot(x, y) - 1); } return mx; })();

// The inset: one pitch of the profile, radius across, z up.
const IX = r => 268 + 92 * (r - 3.15), IY = f => 178 - 92 * P * f;
const PROFILE_F = [-0.15, -0.0625, 0.0625, 0.375, 0.625, 0.9375, 1.0625, 1.15];
const PROFILE = PROFILE_F.map(f => [IX(isoR(f)), IY(f)]);
const PROFILE_D = PROFILE.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
const PROFILE_FILL = `${PROFILE_D}L${IX(3.15)},${IY(1.15)}L${IX(3.15)},${IY(-0.15)}Z`;
const BAND_D = `M${IX(RMAJ)},${IY(0.0625)}L${IX(RMIN)},${IY(0.375)}`;

const sup = n => String(n).split('').map(ch => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(ch)]).join('');
const sci = x => { const e = Math.floor(Math.log10(x)); return `${(x / 10 ** e).toFixed(1)} × 10${sup(e)}`; };

const steps = [
  { label: 'The ISO 68-1 basic profile', text: `Seen in a plane through the axis, a metric thread repeats every pitch P: a flat crest P/8 wide at the major diameter d, a flank at 30° to the radial direction, a flat root P/4 wide, the other flank; the two flanks of a groove make 60°. Its depth is 5H/8, H = √3/2 · P the height of the 60° triangle. For M8 × 1.25: H = ${num(H, 4)} mm, the root at r = ${num(RMIN, 4)} mm.`, formula: 'H = √3/2 · P, &nbsp; r<sub>min</sub> = d/2 − 5H/8; &nbsp; crest |u| ≤ 1/16, &nbsp; flank 1/16 … 3/8, &nbsp; root beyond (u the phase within a pitch)' },
  { label: 'A helix round the axis', text: 'A helix climbs one pitch per turn round the axis. Every point of the thread lies on one: the crest\'s middle on the helix at the major radius, every other point of the profile on a helix of its own radius, shifted along the axis.', formula: 'H(θ) = (r cos θ, r sin θ, P θ / 2π)' },
  { label: 'The profile carried along it', text: 'Carry the profile round the axis, raising it one pitch per turn: one turn sweeps the whole thread. So the radius at a point depends only on its phase φ = z/P − θ/2π, the place in the profile it came from.', formula: 'S(θ, φ) = (r(φ) cos θ, &nbsp; r(φ) sin θ, &nbsp; P (φ + θ/2π))' },
  { label: 'Four bands, each between two helices', text: 'Over (θ, φ) the surface is four bands per pitch, cut at φ = −3/8, −1/16, 1/16, 3/8: a flank, the crest, the other flank, the root. Inside a band the radius is linear in φ, so each band is a ruled surface: straight lines join the helices at its two edges. Each band is cut into half-turn faces; this one is an upper flank.' },
  { label: 'Cubic spans, seven poles', text: `Each helix of a face is two cubic Bézier spans, one per quarter turn: seven poles. Round the axis the handles are ${num(HANDLE, 4)} r long (4/3 tan(π/8), the usual cubic quarter circle); along the axis they rise P/12, so z climbs evenly along a span. The cubic quarter circle bulges outward by at most ${sci(BULGE)} r, ${num(BULGE * RMAJ * 1000, 1)} µm on an M8. A face is degree 3 round by 1 across: 7 × 2 poles.`, formula: 'face: degree (3, 1), knots U [0, 0, 0, 0, ½, ½, ½, 1, 1, 1, 1], V [0, 0, 1, 1]' },
  { label: 'The ends', text: 'An end plane z = c cuts each band along a straight line in (θ, φ): φ = c/P − θ/2π. Along such a line a ruled cubic band is a quartic curve, exactly on the face and exactly in the plane, so the faces are trimmed by it and the flat end is bounded by those curves (six a turn). The finished M8 × 1.25 × 7.5 rod: 56 faces (54 helical, 2 ends), 12 quartic edges, 310.284 mm³.' },
];
const s = useSteps(steps.length, [3400, 4200, 5600, 4200, 3600, 4200], root);
const k = computed(() => ease(s.t.value));
const st = computed(() => s.step.value);

const helixPaths = computed(() => {
  const n = st.value < 1 ? 0 : st.value === 1 ? Math.max(1, Math.round(k.value * (HELIX.length - 1))) : HELIX.length - 1;
  let front = '', back = '';
  for (let i = 1; i <= n; i++) {
    const a = proj(HELIX[i - 1].p), b = proj(HELIX[i].p), seg = `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`;
    if (HELIX[i].front) front += seg; else back += seg;
  }
  return { front, back, tip: proj(HELIX[n].p) };
});
const sweep = computed(() => st.value < 2 ? 0 : st.value === 2 ? k.value * TWO_PI : TWO_PI);
const shownBehind = computed(() => st.value < 2 ? [] : st.value === 2 ? BEHIND_CAP.filter(q => q.tb <= sweep.value + 1e-9) : BEHIND_CAP);
const shownFront = computed(() => st.value < 2 ? [] : st.value === 2 ? BEFORE_CAP.filter(q => q.tb <= sweep.value + 1e-9) : BEFORE_CAP);
const section = computed(() => {
  const T = sweep.value, lo = C0 - T / TWO_PI, hi = C1 - T / TWO_PI, fs = [lo];
  for (let m = Math.floor(lo) - 1; m <= Math.ceil(hi) + 1; m++) for (const b of BREAKS) { const f = m + b; if (f > lo && f < hi) fs.push(f); }
  fs.push(hi); fs.sort((a, b) => a - b);
  return { d: path(fs.map(f => { const r = isoR(f); return [r * Math.cos(T), r * Math.sin(T), P * (f + T / TWO_PI)]; })), front: Math.cos(T) + Math.sin(T) > -0.3 };
});
const rulingsShown = computed(() => st.value === 3 ? RULINGS.slice(0, 1 + Math.round(k.value * 6)) : RULINGS);
const capTrace = computed(() => path(CAP.slice(0, st.value === 5 ? Math.max(2, Math.round(k.value * 144) + 1) : 145)));
const fill = q => q.back ? 'color-mix(in srgb, var(--vp-c-text-1) 30%, var(--vp-c-bg))' : q.hl && st.value >= 3 && st.value <= 4 ? `color-mix(in srgb, var(--hot) ${q.pct}%, var(--vp-c-bg))` : `color-mix(in srgb, var(--a) ${q.pct}%, var(--vp-c-bg))`;
</script>

<template>
  <div ref="root">
    <AlgoFigure title="A modelled thread: the profile swept along a helix" :steps="steps" :s="s">
      <svg viewBox="0 0 380 260" role="img" aria-label="An M8 thread drawn in isometric view, built from the ISO profile swept along a helix">
        <!-- Ghost cylinders at the major and minor radius, and the axis. -->
        <g v-if="st <= 2" class="ghost" :style="{ opacity: st === 2 ? 1 - 0.6 * k : 1 }">
          <g v-for="g in GHOST" :key="g.r" :class="{ minor: g.r === RMIN }">
            <path :d="g.top" /><path :d="g.bottom" /><path v-for="(d, i) in g.sides" :key="i" :d="d" />
          </g>
        </g>
        <path :d="AXIS" class="axis" />
        <!-- The thread surface, back to front; the top end in its place. -->
        <path v-for="q in shownBehind" v-show="!(q.back && st === 5)" :key="q.key" :d="q.d" :style="{ fill: fill(q) }" class="facet" />
        <path v-if="st === 5" :d="cpath(CAP)" class="cap" />
        <path v-for="q in shownFront" :key="q.key" :d="q.d" :style="{ fill: fill(q) }" class="facet" />
        <!-- The helix. -->
        <g v-if="st === 1 || st === 2" :style="{ opacity: st === 2 ? 0.55 : 1 }">
          <path :d="helixPaths.back" class="helix back" /><path :d="helixPaths.front" class="helix" />
          <circle v-if="st === 1" :cx="helixPaths.tip[0]" :cy="helixPaths.tip[1]" r="3.5" class="dot" />
        </g>
        <path v-if="st === 2" :d="section.d" class="section" :style="{ opacity: section.front ? 1 : 0.45 }" />
        <!-- One face: its two helices and rulings, then its poles. -->
        <g v-if="st === 3 || st === 4">
          <path :d="path(EDGE0)" class="edge" /><path :d="path(EDGE1)" class="edge" />
          <path v-for="(r, i) in rulingsShown" :key="'r' + i" :d="path(r)" class="ruling" />
        </g>
        <g v-if="st === 4">
          <polyline :points="ROW2D.map(p => p.join(',')).join(' ')" class="polygon" />
          <path :d="ROW_CURVE" class="row" />
          <rect v-for="(p, i) in ROW2D" :key="'p' + i" :x="p[0] - 2.6" :y="p[1] - 2.6" width="5.2" height="5.2" class="pole" :class="{ end: i % 3 === 0 }" />
        </g>
        <path v-if="st === 5" :d="capTrace" class="endcurve" />
        <!-- The profile, one pitch. -->
        <g class="inset" :class="{ strong: st === 0 }">
          <text x="262" y="28" class="small">ISO 68-1 profile, one pitch</text>
          <rect x="262" y="36" width="110" height="168" rx="6" class="panel" />
          <path :d="PROFILE_FILL" class="material" />
          <path :d="PROFILE_D" class="profile" />
          <path v-if="st === 3 || st === 4" :d="BAND_D" class="band" />
          <text :x="IX(RMAJ) - 4" :y="IY(0) + 4" class="small" text-anchor="end">crest P/8</text>
          <text :x="IX(RMIN) + 4" :y="IY(0.5) + 4" class="small">root P/4</text>
          <text :x="IX(3.82)" :y="IY(0.5) + 4" class="small">60°</text>
          <line :x1="IX(RMAJ) + 10" :y1="IY(0)" :x2="IX(RMAJ) + 10" :y2="IY(1)" class="dim" />
          <text :x="IX(RMAJ) + 7" :y="IY(0.5) - 16" class="small" text-anchor="end">P</text>
          <text :x="IX(RMIN)" :y="IY(-0.15) + 2" dy="-3" class="small" text-anchor="middle">Ø{{ num(2 * RMIN, 3) }}</text>
          <text :x="IX(RMAJ)" :y="IY(-0.15) + 2" dy="-3" class="small" text-anchor="middle">Ø8</text>
        </g>
        <!-- Readouts. -->
        <g class="readout">
          <text x="12" y="238">M8 × 1.25 · H = {{ num(H, 4) }} · 5H/8 = {{ num(5 * H / 8, 4) }} mm</text>
          <text v-if="st === 1" x="12" y="252">θ = {{ num(Math.max(0, st === 1 ? k * 6 : 6), 2) }} turns · z rises {{ num(P * (st === 1 ? k * 6 : 6), 3) }} mm</text>
          <text v-if="st === 2" x="12" y="252">profile turned {{ Math.round(sweep * 180 / Math.PI) }}° · raised {{ num(P * sweep / (2 * Math.PI), 3) }} mm</text>
          <text v-if="st === 3" x="12" y="252">band φ ∈ [{{ num(HF0, 4) }}, {{ num(HF1, 4) }}], θ ∈ [0, π]: r {{ num(RMAJ, 3) }} → {{ num(RMIN, 3) }}</text>
          <text v-if="st === 4" x="12" y="252">handle {{ num(HANDLE, 4) }} r · rise P/12 = {{ num(P / 12, 4) }} mm</text>
          <text v-if="st === 5" x="12" y="252">56 faces · 12 quartic edges · 310.284 mm³</text>
        </g>
      </svg>
      <template #note>Computed in the page with the kernel's profile, phase, bands, end clip and helix poles on M8 × 1.25,
        7.5 mm long. The surface is drawn as 10° pieces of the exact ruled bands, in back-to-front order; the face count,
        edge degrees and volume are the built kernel's (threadSolid).</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
svg .small { font-size: 10px; }
.ghost path { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; }
.ghost .minor path { stroke-dasharray: 3 3; }
.axis { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 6 3 1 3; }
.facet { stroke: color-mix(in srgb, var(--vp-c-text-1) 12%, transparent); stroke-width: 0.35; stroke-linejoin: round; }
.cap { fill: color-mix(in srgb, var(--a) 22%, var(--vp-c-bg)); stroke: none; }
.helix { fill: none; stroke: var(--b); stroke-width: 2; stroke-linecap: round; }
.helix.back { opacity: 0.35; stroke-width: 1.4; }
.dot { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.section { fill: none; stroke: var(--hot); stroke-width: 2; stroke-linejoin: round; }
.edge { fill: none; stroke: var(--b); stroke-width: 2.2; stroke-linecap: round; }
.ruling { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1; opacity: 0.7; }
.polygon { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1; }
.row { fill: none; stroke: var(--keep); stroke-width: 2.4; }
.pole { fill: var(--vp-c-bg); stroke: var(--b); stroke-width: 1.4; } .pole.end { fill: var(--b); }
.endcurve { fill: none; stroke: var(--hot); stroke-width: 2.2; stroke-linejoin: round; }
.panel { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.material { fill: color-mix(in srgb, var(--a) 18%, transparent); }
.profile { fill: none; stroke: var(--a); stroke-width: 1.8; stroke-linejoin: round; }
.inset.strong .profile { stroke-width: 2.4; }
.band { stroke: var(--hot); stroke-width: 3.2; stroke-linecap: round; }
.dim { stroke: var(--vp-c-text-3); stroke-width: 1; }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10.5px; fill: var(--vp-c-text-1); }
</style>
