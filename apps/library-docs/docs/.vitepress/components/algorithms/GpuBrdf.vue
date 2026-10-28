<script setup>
// The direct-light BRDF of packages/barocss-gpu/src/viewer/shaders: ggx, smith and schlick in surface.ts, brdfLayered in
// material-layer.ts (a plain layer: no finish, coat or film). Evaluated here, in the page, with the same formulas: in a
// plane through the normal (left) and on a sphere seen from the front (right).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const PI = Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encode = x => { x = clamp(x, 0, 1); return x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055; };
const hexOf = rgb => '#' + rgb.map(c => Math.round(clamp(encode(c), 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const luma = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// The shader's terms, as written there (a = roughness², ggx squares it again).
function ggx(noh, a) { const a2 = a * a, f = (noh * a2 - noh) * noh + 1; return a2 / (PI * f * f); }
function smith(nov, nol, a) { const a2 = a * a; return 0.5 / Math.max(nol * Math.sqrt(nov * nov * (1 - a2) + a2) + nov * Math.sqrt(nol * nol * (1 - a2) + a2), 1e-5); }
const schlick = (f0, voh) => f0.map(x => x + (1 - x) * (1 - voh) ** 5);
const BASE = [0xc9, 0xa0, 0x5a].map(c => toLinear(c / 255));
/** brdfLayered's terms for unit vectors n, v, l (any dimension), at a roughness and metalness. */
function terms(n, v, l, rough, metal) {
  const dot = (p, q) => p.reduce((s, x, i) => s + x * q[i], 0);
  const hv = v.map((x, i) => x + l[i]), hl = Math.hypot(...hv), h = hl > 1e-9 ? hv.map(x => x / hl) : n;
  const r = clamp(rough, 0.04, 1), a = r * r, nol = Math.max(dot(n, l), 0), nov = Math.max(dot(n, v), 1e-4);
  const f0 = BASE.map(b => 0.04 + (b - 0.04) * metal), voh = Math.max(dot(v, h), 0), noh = Math.max(dot(n, h), 0);
  const D = ggx(noh, a), V = smith(nov, nol, a), F = schlick(f0, voh);
  const diffuse = F.map((f, i) => (1 - f) * (1 - metal) * BASE[i] / PI), spec = F.map(f => D * V * f);
  return { h, noh, nol, D, V, F, diffuse, spec, out: diffuse.map((d, i) => (d + spec[i]) * nol) };
}

// ---- the plane: normal up, the eye 30° to the left, the light anywhere on the right half -------------------------
const O = [128, 200], N = [0, 1], VIEW = -30, R = 150, K = 0.25;
const dirOf = deg => [Math.sin((deg * PI) / 180), Math.cos((deg * PI) / 180)];
const V2 = dirOf(VIEW);
const at = (d, r) => [O[0] + d[0] * r, O[1] - d[1] * r];
const ANGLES = Array.from({ length: 179 }, (_, i) => i - 89);
const polyline = ps => ps.map(p => p.map(x => +x.toFixed(2)).join(',')).join(' ');

// ---- parameters: animated by the steps until a reader takes a slider ----------------------------------------------
const manual = ref({ light: false, rough: false, metal: false });
const user = ref({ light: 30, rough: 0.35, metal: 0 });
const steps = [
  { label: 'Directions', text: 'At a point of a surface: the unit normal n, the direction v toward the eye, the direction l toward a light. Their half vector h lies halfway between v and l. The BRDF f(v, l) says how much of the light arriving along l leaves toward v; every term below is a function of n·h, n·v, n·l and v·h.', formula: 'h = (v + l) / ‖v + l‖' },
  { label: 'D: how many facets face h (GGX)', text: 'A rough surface is treated as tiny mirror facets. Only the facets whose normal is h reflect l into v. The GGX (Trowbridge–Reitz) distribution D gives their density: a peak at n·h = 1, as wide as the roughness. The curve is D for each light direction, scaled to its peak.', formula: 'a = roughness², &nbsp; D = a² / (π ((n·h)² (a² − 1) + 1)²)' },
  { label: 'V: facets hidden by facets (Smith)', text: 'Some facets are shadowed from the light or hidden from the eye by others, more at grazing angles. The shader uses the height-correlated Smith term, already divided by 4 (n·v)(n·l), so the specular part is D · V · F. The curve is G = 4 (n·v)(n·l) V, the share of facets neither shadowed nor hidden: near 1 except at grazing angles.', formula: 'V = 0.5 / (n·l √((n·v)² (1 − a²) + a²) + n·v √((n·l)² (1 − a²) + a²))' },
  { label: 'F: the share reflected (Schlick)', text: 'The Fresnel term is the share of the light a facet reflects rather than lets in: f<sub>0</sub> head-on, rising to 1 at grazing incidence. A dielectric has f<sub>0</sub> = 0.04.', formula: 'F = f<sub>0</sub> + (1 − f<sub>0</sub>) (1 − v·h)<sup>5</sup>' },
  { label: 'The lobe', text: 'The whole BRDF times n·l, for every light direction: the specular lobe round the mirror direction, and the diffuse part (Lambert, less what Fresnel reflected). The shader adds this for each light, times its colour, intensity, π and its shadow.', formula: 'f · n·l = ((1 − F)(1 − m) · base / π + D · V · F) · n·l' },
  { label: 'Metal', text: 'Metalness m blends f<sub>0</sub> from 0.04 to the base colour and removes the diffuse part: a metal\'s colour is in its reflection only.', formula: 'f<sub>0</sub> = mix(0.04, base, m)' },
  { label: 'Roughness', text: 'Roughness is clamped to 0.04 – 1 and squared before D and V use it, so the lobe narrows and its peak climbs fast as roughness falls.', formula: 'peak of D = 1 / (π a²): roughness 0.5 → 5.1, &nbsp; 0.2 → 199' },
];
const s = useSteps(steps.length, [3200, 3800, 3800, 3600, 3400, 3200, 4200], root);
const k = computed(() => ease(s.t.value));
const light = computed(() => (manual.value.light ? user.value.light : s.step.value <= 3 ? -20 + 90 * k.value : 30));
const metal = computed(() => (manual.value.metal ? user.value.metal : s.step.value === 5 ? k.value : s.step.value === 6 ? 1 : 0));
const rough = computed(() => (manual.value.rough ? user.value.rough : s.step.value === 6 ? 0.9 - 0.75 * k.value : 0.35));
function take(which, e) { manual.value = { ...manual.value, [which]: true }; user.value = { ...user.value, [which]: +e.target.value }; }

const sweep = computed(() => ANGLES.map(deg => ({ deg, l: dirOf(deg), ...terms(N, V2, dirOf(deg), rough.value, metal.value) })));
const factor = computed(() => {
  const step = s.step.value, key = step === 1 ? 'D' : step === 2 ? 'G' : step === 3 ? 'F' : null;
  if (!key) return null;
  // (G = 4 (n·v)(n·l) V: the share of facets neither shadowed nor hidden, 0 – 1, drawn to scale; D and F to their peak.)
  const val = q => (key === 'F' ? luma(q.F) : key === 'G' ? 4 * Math.cos(PI / 4) * q.nol * q.V : q.D), max = key === 'G' ? 1 : Math.max(...sweep.value.map(val));
  return { key, label: key === 'G' ? 'G = 4 (n·v)(n·l) V over the light\'s direction (to scale)' : `${key} over the light's direction (scaled to its peak)`, points: polyline(sweep.value.map(q => at(q.l, (R * 0.9 * val(q)) / max))) };
});
const radius = x => (R * x) / (x + K);
const lobe = computed(() => {
  const n = s.step.value === 4 ? Math.max(2, Math.round(k.value * sweep.value.length)) : sweep.value.length, q = sweep.value.slice(0, n);
  return { total: polyline(q.map(p => at(p.l, radius(luma(p.out))))), diffuse: polyline([O, ...q.map(p => at(p.l, radius(luma(p.diffuse) * p.nol))), O]) };
});
const now = computed(() => terms(N, V2, dirOf(light.value), rough.value, metal.value));
const arrows = computed(() => ({ v: at(V2, 64), l: at(dirOf(light.value), 64), h: at(now.value.h, 46), n: at(N, 40) }));
const marker = computed(() => at(dirOf(light.value), s.step.value >= 4 ? radius(luma(now.value.out)) : 0));
const readout = computed(() => {
  const q = now.value;
  return [`n·h ${num(q.noh, 3)}`, `D ${num(q.D, 2)}`, `V ${num(q.V, 3)}`, `F ${num(luma(q.F), 3)}`, `f·n·l ${num(luma(q.out), 3)}`];
});

// ---- the sphere: seen head-on (v = +z), lit from the same angle to the eye as the plane's light ---------------------
const SC = [318, 88], SR = 52, CELL = 4;
const cells = [];
for (let y = -SR; y < SR; y += CELL) for (let x = -SR; x < SR; x += CELL) {
  const cx = (x + CELL / 2) / SR, cy = (y + CELL / 2) / SR, rr = cx * cx + cy * cy;
  if (rr < 1) cells.push({ x: SC[0] + x, y: SC[1] + y, n: [cx, -cy, Math.sqrt(1 - rr)] });
}
const sphere = computed(() => {
  const psi = ((light.value - VIEW) * PI) / 180, l = [Math.sin(psi), 0.35, Math.cos(psi)], ll = Math.hypot(...l), L = l.map(x => x / ll), r = rough.value, m = metal.value;
  return cells.map(c => { const q = terms(c.n, [0, 0, 1], L, r, m); return hexOf(q.out.map((o, i) => o * PI + 0.03 * BASE[i])); });
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="The specular lobe: GGX, Smith and Schlick" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="The BRDF's terms in a plane through the normal, and a sphere lit with them">
        <defs>
          <marker id="gpu-brdf-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="context-stroke" /></marker>
        </defs>
        <line :x1="O[0] - 112" :y1="O[1]" :x2="O[0] + 112" :y2="O[1]" class="surface" />
        <path :d="`M${O[0] - 112},${O[1]} l8,8 M${O[0] - 88},${O[1]} l8,8 M${O[0] - 64},${O[1]} l8,8 M${O[0] - 40},${O[1]} l8,8 M${O[0] - 16},${O[1]} l8,8 M${O[0] + 8},${O[1]} l8,8 M${O[0] + 32},${O[1]} l8,8 M${O[0] + 56},${O[1]} l8,8 M${O[0] + 80},${O[1]} l8,8`" class="ticks" />
        <g v-if="s.step.value >= 4">
          <polygon :points="lobe.diffuse" class="diffuse" />
          <polyline :points="lobe.total" class="lobe" />
        </g>
        <polyline v-if="factor" :points="factor.points" class="factor" />
        <line :x1="O[0]" :y1="O[1]" :x2="arrows.n[0]" :y2="arrows.n[1]" class="vec n" marker-end="url(#gpu-brdf-head)" />
        <line :x1="O[0]" :y1="O[1]" :x2="arrows.v[0]" :y2="arrows.v[1]" class="vec v" marker-end="url(#gpu-brdf-head)" />
        <line :x1="O[0]" :y1="O[1]" :x2="arrows.l[0]" :y2="arrows.l[1]" class="vec l" marker-end="url(#gpu-brdf-head)" />
        <line v-if="s.step.value <= 3" :x1="O[0]" :y1="O[1]" :x2="arrows.h[0]" :y2="arrows.h[1]" class="vec h" marker-end="url(#gpu-brdf-head)" />
        <text :x="arrows.n[0] + 4" :y="arrows.n[1] + 2" class="tag">n</text>
        <text :x="arrows.v[0] - 12" :y="arrows.v[1]" class="tag v">v</text>
        <text :x="arrows.l[0] + 4" :y="arrows.l[1]" class="tag l">l</text>
        <text v-if="s.step.value <= 3" :x="arrows.h[0] + 4" :y="arrows.h[1] - 2" class="tag h">h</text>
        <circle v-if="s.step.value >= 4" :cx="marker[0]" :cy="marker[1]" r="3.2" class="marker" />
        <text v-if="factor" x="14" y="20" class="name">{{ factor.label }}</text>
        <text v-else-if="s.step.value >= 4" x="14" y="20" class="name">f · n·l (radius x / (x + 0.25)) · <tspan class="d">diffuse part</tspan></text>
        <!-- the sphere -->
        <rect v-for="(c, i) in cells" :key="i" :x="c.x" :y="c.y" :width="CELL + 0.3" :height="CELL + 0.3" :fill="sphere[i]" />
        <text :x="SC[0]" :y="SC[1] + SR + 14" text-anchor="middle" class="small">seen from v, lit from l</text>
        <text v-for="(line, i) in readout" :key="'r' + i" x="268" :y="172 + i * 14" class="read">{{ line }}</text>
      </svg>
      <div class="knobs">
        <label>light <input type="range" min="-85" max="85" step="1" :value="light" @input="take('light', $event)"> <span>{{ Math.round(light) }}°</span></label>
        <label>roughness <input type="range" min="0.04" max="1" step="0.01" :value="rough" @input="take('rough', $event)"> <span>{{ num(Math.max(0.04, rough), 2) }}</span></label>
        <label>metallic <input type="range" min="0" max="1" step="0.01" :value="metal" @input="take('metal', $event)"> <span>{{ num(metal, 2) }}</span></label>
      </div>
      <template #note>Computed in the page with the shader's formulas, at a base colour of #c9a05a and one white light of
        intensity 1; values are the luminance of the RGB result. The left curve's radius is x / (x + 0.25) of its value x,
        so a sharp peak fits. The sphere is lit from the same angle to the eye as the light on the left (tilted a little
        upward), with a small ambient term and no tone mapping. Moving a slider holds that value against the animation.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.surface { stroke: var(--vp-c-text-2); stroke-width: 1.5; }
.ticks { stroke: var(--vp-c-text-3); stroke-width: 0.8; fill: none; }
.vec { stroke-width: 1.8; }
.vec.n { stroke: var(--vp-c-text-2); } .vec.v { stroke: var(--a); } .vec.l { stroke: var(--b); } .vec.h { stroke: var(--hot); stroke-dasharray: 3 2; }
.tag { font-weight: 700; } .tag.v { fill: var(--a); } .tag.l { fill: var(--b); } .tag.h { fill: var(--hot); }
.factor { fill: none; stroke: var(--hot); stroke-width: 2; stroke-linejoin: round; }
.lobe { fill: none; stroke: var(--keep); stroke-width: 2.2; stroke-linejoin: round; }
.diffuse { fill: var(--b); fill-opacity: 0.22; stroke: none; }
.marker { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; }
.name { font-weight: 700; font-size: 11px; fill: var(--vp-c-text-1); }
.name .d { fill: var(--b); }
.small { font-size: 10px; fill: var(--vp-c-text-3); }
.read { font-family: var(--vp-font-family-mono); font-size: 10.5px; }
.knobs { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 8px 16px 10px; font-size: 13px; color: var(--vp-c-text-2); border-top: 1px solid var(--vp-c-divider); background: var(--vp-c-bg); }
.knobs label { display: flex; align-items: center; gap: 6px; }
.knobs input { width: 96px; accent-color: var(--vp-c-brand-1); }
.knobs span { min-width: 34px; font-family: var(--vp-font-family-mono); font-size: 12px; }
</style>
