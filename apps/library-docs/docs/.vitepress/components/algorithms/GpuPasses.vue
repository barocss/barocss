<script setup>
// One frame of packages/barocss-gpu/src/viewer/viewer.ts (drawFrame), pass by pass, on a small part: a box with a round
// boss, a key and a fill light (the default rig's intensities, lights.ts defaultLights) and a shadow catcher under it. Each image is worked out in
// the page with the viewer's own formulas: the shadow map's orthographic light view and depth range (shadowFrame), the
// camera's fitted clip planes (camera.ts clip), reversed depth, the metal–roughness shading of shaders/surface.ts
// (shadeLayered, brdfLayered) with the hemisphere ambient, and the output pass's ACES curve and sRGB encoding
// (shaders/output-color.ts). Faces are drawn flat (box) or blended between their edges (boss), not per pixel.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
// ---- vectors -------------------------------------------------------------------------------------------------------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = a => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
const clamp01 = x => Math.min(1, Math.max(0, x));
const mix = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k);
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
// sRGB as math.ts srgbToLinear and output-color.ts encode; ACES as output-color.ts aces.
const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encode = x => { x = clamp01(x); return x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055; };
const aces = x => clamp01((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
const hexOf = rgb => '#' + rgb.map(c => Math.round(clamp01(c) * 255).toString(16).padStart(2, '0')).join('');
const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

// ---- the part ------------------------------------------------------------------------------------------------------
const BX = 1.1, BY = 0.7, BZ = 0.5, CX = 0.35, CR = 0.42, CZ = 1.2, SEG = 28;
const boxV = [];
for (let i = 0; i < 8; i++) boxV.push([i & 1 ? BX : -BX, i & 2 ? BY : -BY, i & 4 ? BZ : 0]);
// Faces as vertex indices, counter-clockwise from outside, with their normals.
const boxF = [
  { v: [4, 5, 7, 6], n: [0, 0, 1] }, { v: [0, 2, 3, 1], n: [0, 0, -1] }, { v: [1, 3, 7, 5], n: [1, 0, 0] },
  { v: [0, 4, 6, 2], n: [-1, 0, 0] }, { v: [0, 1, 5, 4], n: [0, -1, 0] }, { v: [2, 6, 7, 3], n: [0, 1, 0] },
];
const ring = z => Array.from({ length: SEG }, (_, i) => { const a = (2 * Math.PI * i) / SEG; return [CX + CR * Math.cos(a), CR * Math.sin(a), z]; });
const cylLow = ring(BZ), cylTop = ring(CZ);
const angleOf = i => (2 * Math.PI * i) / SEG;
const allPoints = [...boxV, ...cylLow, ...cylTop];
const sceneMin = [-BX, -BY, 0], sceneMax = [BX, BY, CZ];
const center = mul(add(sceneMin, sceneMax), 0.5), radius = Math.hypot(...sub(sceneMax, sceneMin)) / 2; // bounds.ts boxRadius

// ---- the camera (orthographic) and two directional lights -------------------------------------------------------------
const E = unit([1.0, -1.6, 1.1]); // toward the eye; v = −forward in an orthographic view
const Fw = mul(E, -1), Rt = unit(cross(Fw, [0, 0, 1])), Up = cross(Rt, Fw);
// (The default rig's intensities, 1.1 and 0.35; their directions turned so the shadows fall toward the eye.)
const KEY = unit([0.45, -0.35, -0.82]), FILL = unit([-0.5, 0.6, -0.45]);
const lights = [{ d: KEY, i: 1.1 }, { d: FILL, i: 0.35 }];
const sky = [0.85, 0.9, 1].map(toLinear), ground = [0.45, 0.42, 0.4].map(toLinear), AMB = 0.3;
const base = rgbOf('#c0c4cc').map(toLinear), ROUGH = 0.5, METAL = 0;

// ---- shading: shadeLayered with a plain layer, no environment map --------------------------------------------------
const PI = Math.PI;
function ggx(noh, a) { const a2 = a * a, f = (noh * a2 - noh) * noh + 1; return a2 / (PI * f * f); }
function smith(nov, nol, a) { const a2 = a * a; return 0.5 / Math.max(nol * Math.sqrt(nov * nov * (1 - a2) + a2) + nov * Math.sqrt(nol * nol * (1 - a2) + a2), 1e-5); }
function brdf(v, l, n) {
  const h = unit(add(v, l)), nol = Math.max(dot(n, l), 0), nov = Math.max(dot(n, v), 1e-4), a = ROUGH * ROUGH;
  const f0 = mix([0.04, 0.04, 0.04], base, METAL), vh = Math.max(dot(v, h), 0);
  const F = f0.map(x => x + (1 - x) * (1 - vh) ** 5), s = ggx(Math.max(dot(n, h), 0), a) * smith(nov, nol, a);
  return F.map((f, i) => ((1 - f) * (1 - METAL) * base[i] / PI + s * f) * nol);
}
function shade(n, keyLit = 1) {
  const v = E, up = [0, 0, 1], rough = ROUGH;
  const ambient = mix(mul(ground, AMB), mul(sky, AMB), dot(n, up) * 0.5 + 0.5);
  const nov = Math.max(dot(n, v), 0), f0 = mix([0.04, 0.04, 0.04], base, METAL);
  const mirrored = sub(mul(n, 2 * dot(n, v)), v);
  const reflected = mix(mix(mul(ground, AMB), mul(sky, AMB), smooth(-0.3, 0.3, dot(mirrored, up))), ambient, rough);
  const fresnel = f0.map(x => x + (Math.max(1 - rough, x) - x) * (1 - nov) ** 5);
  let c = ambient.map((x, i) => x * base[i] * (1 - METAL) + reflected[i] * fresnel[i]);
  lights.forEach((L, k) => { const b = brdf(v, mul(L.d, -1), n), lit = k === 0 ? keyLit : 1; c = c.map((x, i) => x + b[i] * L.i * PI * lit); });
  return c;
}
const show = c => hexOf(c.map(encode));            // the scene target, sRGB-encoded so it can be seen
const shown = c => hexOf(c.map(x => encode(aces(x)))); // the output pass: exposure 1, ACES, sRGB

// ---- projection into an image rectangle ----------------------------------------------------------------------------
const IMG = { x: 10, y: 54, w: 240, h: 190 };
function fitter(project, pts) {
  const q = pts.map(project), x0 = Math.min(...q.map(p => p[0])), x1 = Math.max(...q.map(p => p[0]));
  const y0 = Math.min(...q.map(p => p[1])), y1 = Math.max(...q.map(p => p[1]));
  const s = Math.min((IMG.w - 24) / (x1 - x0), (IMG.h - 24) / (y1 - y0));
  const ox = IMG.x + IMG.w / 2 - s * (x0 + x1) / 2, oy = IMG.y + IMG.h / 2 - s * (y0 + y1) / 2;
  return p => { const r = project(p); return [ox + s * r[0], oy + s * r[1]]; };
}
const pts = ps => ps.map(p => p.map(x => +x.toFixed(2)).join(',')).join(' ');

// ---- shadows: the box and the boss projected along the key light (they are convex: each one's hull) ----------------
function hull(ps) {
  const p = [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]), turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length > 1 && turn(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length > 1 && turn(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
const along = (p, z) => { const t = (p[2] - z) / -KEY[2]; return [p[0] + KEY[0] * t, p[1] + KEY[1] * t]; };
function clipRect(poly, x0, x1, y0, y1) {
  const edges = [[0, x0, 1], [0, x1, -1], [1, y0, 1], [1, y1, -1]];
  let out = poly;
  for (const [k, c, s] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], ia = s * (a[k] - c) >= 0, ib = s * (b[k] - c) >= 0;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (c - a[k]) / (b[k] - a[k]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
  }
  return out;
}
const groundShadows = [hull(boxV.map(p => along(p, 0))), hull([...cylLow, ...cylTop].map(p => along(p, 0)))].map(h => h.map(q => [q[0], q[1], 0]));
const topShadow = clipRect(hull([...cylLow, ...cylTop].map(p => along(p, BZ))), -BX, BX, -BY, BY).map(q => [q[0], q[1], BZ]);

// ---- the camera's image ---------------------------------------------------------------------------------------------
const cam = fitter(p => [dot(p, Rt), -dot(p, Up)], [...allPoints, ...groundShadows.flat()]);
const near = dot(center, Fw) - 1.05 * radius, far = dot(center, Fw) + 1.05 * radius; // camera.ts clip, orthographic
const reversed = p => (far - dot(p, Fw)) / (far - near);                              // near 1, far 0
const visBox = boxF.filter(f => dot(f.n, E) > 0);
const strips = [];
for (let i = 0; i < SEG; i++) {
  const j = (i + 1) % SEG, mid = (angleOf(i) + angleOf(i) + 2 * Math.PI / SEG) / 2;
  if (dot([Math.cos(mid), Math.sin(mid), 0], E) > 0) strips.push({ i, j, poly: [cylLow[i], cylLow[j], cylTop[j], cylTop[i]] });
}
const nAt = i => [Math.cos(angleOf(i)), Math.sin(angleOf(i)), 0];

/** A linear gradient across a planar polygon in screen space for a value given at its vertices (exact for a plane). */
function gradient(id, screen, values, colour) {
  const [p, q, r] = screen, [a, b, c] = values;
  const det = (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]);
  let gx = 0, gy = 0;
  if (Math.abs(det) > 1e-9) {
    gx = ((b - a) * (r[1] - p[1]) - (c - a) * (q[1] - p[1])) / det;
    gy = ((c - a) * (q[0] - p[0]) - (b - a) * (r[0] - p[0])) / det;
  }
  const g = Math.hypot(gx, gy);
  if (g < 1e-9) return { id, x1: p[0], y1: p[1], x2: p[0] + 1, y2: p[1], c1: colour(a), c2: colour(a) };
  const ux = gx / g, uy = gy / g, s = screen.map(v => (v[0] - p[0]) * ux + (v[1] - p[1]) * uy), s0 = Math.min(...s), s1 = Math.max(...s);
  return { id, x1: p[0] + ux * s0, y1: p[1] + uy * s0, x2: p[0] + ux * s1, y2: p[1] + uy * s1, c1: colour(a + g * s0), c2: colour(a + g * s1) };
}
const grey = d => hexOf([d, d, d]);
const grads = [];
/** A layer of polygons: their screen points and fill (a colour or a gradient's url). */
function layer(project, polys) { return polys.map(({ poly, fill }) => ({ points: pts(poly.map(project)), fill })); }

// Depth (reversed) as the camera sees it: every visible face of the part (the shadow catcher writes no depth).
const depthPolys = [];
visBox.forEach((f, k) => { const poly = f.v.map(i => boxV[i]), id = `gpu-pass-d${k}`; grads.push(gradient(id, poly.map(cam), poly.map(reversed), grey)); depthPolys.push({ poly, fill: `url(#${id})` }); });
strips.forEach((s, k) => { const id = `gpu-pass-ds${k}`; grads.push(gradient(id, s.poly.map(cam), s.poly.map(reversed), grey)); depthPolys.push({ poly: s.poly, fill: `url(#${id})` }); });
{ const id = 'gpu-pass-dt'; grads.push(gradient(id, cylTop.slice(0, 3).map(cam), cylTop.slice(0, 3).map(reversed), grey)); depthPolys.push({ poly: cylTop, fill: `url(#${id})` }); }

// Colour: the faces lit, the boss's shadow on the box top, the shadow catcher on the ground.
function colourPolys(tone, tag) {
  const out = [];
  visBox.forEach(f => out.push({ poly: f.v.map(i => boxV[i]), fill: tone(shade(f.n)) }));
  out.push({ poly: topShadow, fill: tone(shade([0, 0, 1], 0)) });
  strips.forEach((s, k) => {
    const id = `gpu-pass-${tag}${k}`, a = cam(s.poly[0]), b = cam(s.poly[1]);
    grads.push({ id, x1: a[0], y1: a[1], x2: b[0], y2: b[1], c1: tone(shade(nAt(s.i))), c2: tone(shade(nAt(s.j))) });
    out.push({ poly: s.poly, fill: `url(#${id})` });
  });
  out.push({ poly: cylTop, fill: tone(shade([0, 0, 1])) });
  return out;
}
const camDepth = layer(cam, depthPolys);
const camColour = layer(cam, colourPolys(show, 'cs'));
const camFinal = layer(cam, colourPolys(shown, 'cf'));
const camShadow = groundShadows.map(h => pts(h.map(cam)));
const camSilhouette = [...visBox.map(f => pts(f.v.map(i => cam(boxV[i])))), ...strips.map(s => pts(s.poly.map(cam))), pts(cylTop.map(cam))];
// Display edges: the box's edges next to a visible face, the boss's rims (the lower one where it faces the eye) and
// its contour, the two lines where its normal turns square to the view (shaders/line.ts vsContour finds them per frame).
const bossHull = hull([...cylLow, ...cylTop].map(cam));
const inHull = (q, h) => h.every((a, i) => { const b = h[(i + 1) % h.length]; return (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) >= 0; });
/** A box edge's runs not behind the boss (every box edge lies below the boss, so the boss is in front where they meet). */
function visibleRuns(a, b) {
  const runs = []; let run = [];
  for (let i = 0; i <= 40; i++) {
    const q = cam(add(a, mul(sub(b, a), i / 40)));
    if (inHull(q, bossHull)) { if (run.length > 1) runs.push(run); run = []; } else run.push(q);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}
const edgeLines = [];
for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
  const diff = [0, 1, 2].filter(k => boxV[a][k] !== boxV[b][k]);
  if (diff.length !== 1) continue;
  const faces = boxF.filter(f => f.v.includes(a) && f.v.includes(b));
  if (faces.some(f => dot(f.n, E) > 0)) for (const r of visibleRuns(boxV[a], boxV[b])) edgeLines.push(pts(r));
}
edgeLines.push(pts([...cylTop, cylTop[0]].map(cam)));
const e0 = Math.atan2(E[1], E[0]);
for (const a of [e0 + Math.PI / 2, e0 - Math.PI / 2]) { const p = [CX + CR * Math.cos(a), CR * Math.sin(a)]; edgeLines.push(pts([[p[0], p[1], BZ], [p[0], p[1], CZ]].map(cam))); }
const rimFront = Array.from({ length: 33 }, (_, i) => { const a = e0 - Math.PI / 2 + (Math.PI * i) / 32; return cam([CX + CR * Math.cos(a), CR * Math.sin(a), BZ]); });
edgeLines.push(pts(rimFront));
const rimPoints = pts(rimFront);

// ---- the light's image: shadowFrame's orthographic view along the key light, its standard depth --------------------
const LF = KEY, LU0 = Math.abs(LF[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], LR = unit(cross(LF, LU0)), LU = cross(LR, LF);
const leye = sub(center, mul(LF, 2 * radius)), lnear = radius * 0.9, lfar = radius * 3.1;
const lightDepth = p => (dot(sub(p, leye), LF) - lnear) / (lfar - lnear);     // near 0, far 1 (cleared to 1)
const lview = fitter(p => [dot(p, LR), -dot(p, LU)], allPoints);
const lgrey = d => grey(0.12 + 0.82 * d);
const lightPolys = [];
boxF.filter(f => dot(f.n, LF) < 0).forEach((f, k) => { const poly = f.v.map(i => boxV[i]), id = `gpu-pass-l${k}`; grads.push(gradient(id, poly.map(lview), poly.map(lightDepth), lgrey)); lightPolys.push({ poly, fill: `url(#${id})` }); });
for (let i = 0; i < SEG; i++) {
  const j = (i + 1) % SEG, mid = angleOf(i) + Math.PI / SEG;
  if (dot([Math.cos(mid), Math.sin(mid), 0], LF) >= 0) continue;
  const poly = [cylLow[i], cylLow[j], cylTop[j], cylTop[i]], id = `gpu-pass-ls${i}`;
  grads.push(gradient(id, poly.map(lview), poly.map(lightDepth), lgrey)); lightPolys.push({ poly, fill: `url(#${id})` });
}
{ const id = 'gpu-pass-lt'; grads.push(gradient(id, cylTop.slice(0, 3).map(lview), cylTop.slice(0, 3).map(lightDepth), lgrey)); lightPolys.push({ poly: cylTop, fill: `url(#${id})` }); }
const lightImage = layer(lview, lightPolys);
const lightClear = lgrey(1);

// ---- the frame graph ------------------------------------------------------------------------------------------------
const nodes = [
  { k: 'shadow', label: 'shadow' }, { k: 'probe', label: 'probe', opt: true }, { k: 'surface', label: 'surface' }, { k: 'oit', label: 'OIT', opt: true },
  { k: 'mask', label: 'mask', opt: true }, { k: 'bloom', label: 'bloom', opt: true }, { k: 'dof', label: 'DoF', opt: true }, { k: 'output', label: 'output' },
].map((n, i) => ({ ...n, x: 7 + i * 46.5 }));
const active = [['shadow'], ['surface'], ['surface'], ['surface'], ['mask'], ['bloom', 'dof'], ['output']];
const panel = [
  ['shadow maps', 'depth32float array,', '2048², a layer a light', 'cleared to 1, test <', 'redrawn on change'],
  ['scene depth', 'depth32float', '4 samples', 'cleared to 0, test ≥', '(reversed)'],
  ['scene colour', 'rgba16float', '4× MSAA, linear,', 'premultiplied', 'cleared to 0'],
  ['scene colour', 'lines: a quad a', 'segment, tested,', 'not written to', 'the depth'],
  ['outline mask', 'r32uint', 'outline number,', '0 for none', ''],
  ['bloom chain', 'rgba16float,', '½ down to 1/32;', 'focus: ½ size,', '16 taps'],
  ['canvas', 'preferred format', 'sRGB-encoded,', 'premultiplied', ''],
];
const chain = [];
for (let i = 0, x = 262; i < 5; i++) { const w = 48 / 2 ** i, h = 32 / 2 ** i; chain.push({ x, w, h }); x += w + 4; }

const steps = [
  { label: 'Shadow maps', text: 'For each shadow-casting light, the casters are drawn from the light into one layer of a depth texture array. A directional light looks along its direction with an orthographic box fitted to the scene: centre c, radius r, eye c − 2r·d, depth from 0.9 r to 3.1 r. A layer is drawn again only when the light\'s view or a caster changed.', formula: 'depth = (d·(p − eye) − 0.9 r) / (2.2 r) &nbsp; (near: small; shown dark)' },
  { label: 'Surface pass: depth', text: 'The main pass clears a 4-sample depth buffer to 0 and keeps what is nearer with a ≥ test: depth is <em>reversed</em>, near 1 and far 0, which keeps float precision far away. Before it, while a section caps a mesh, the caps\' probe pass runs; with see-through surfaces, a weighted transparency pass follows it.', formula: 'orthographic: d = (far − z) / (far − near), near = c<sub>z</sub> − 1.05 r, far = c<sub>z</sub> + 1.05 r' },
  { label: 'Surface pass: colour', text: 'Opaque meshes are drawn sorted by pipeline. Each fragment is lit by the metal–roughness model below, its shadow looked up in the map, and written as linear, premultiplied half-float colour. The shadow catcher under the part writes only the shadow, as dark as its opacity.', formula: 'c = ambient · base · (1 − m) + reflected · F<sub>amb</sub> + Σ<sub>lights</sub> f(v, l) · E · π · lit' },
  { label: 'Same pass: lines and caps', text: 'After the opaque surfaces come the caps and the grid, then lines, points, labels and the transparent meshes far to near. A line segment is a screen-space quad of the set width; it tests depth but does not write it, and faces are drawn with a depth bias (−2, slope −1.5) that sets them just behind, so an edge on a face shows. A curved face\'s contour is found per triangle in the vertex shader, where n·v changes sign.', formula: 'contour point on edge (i, j): p<sub>i</sub> + (p<sub>j</sub> − p<sub>i</sub>) · f<sub>i</sub> / (f<sub>i</sub> − f<sub>j</sub>), &nbsp; f = n̂ · v̂' },
  { label: 'Outline mask', text: 'With an outlined (selected) mesh, a further pass draws every opaque surface into a 32-bit integer target: 0 where a plain surface hides what is behind, the outline\'s number (1 – 8) where an outlined mesh is in front. It is scissored to the outlined meshes\' screen box, widened by the outline\'s reach.' },
  { label: 'Bloom and depth of field', text: 'Both are off unless set. Bloom keeps the light above a threshold (1 by default, a soft knee of a quarter of it), prefilters it at half size with 13 taps, halves it four times (5 taps each) and adds it back up (8 taps each). Here the brightest value is 0.90, inside the knee, so it would pass 2.4 % of itself, then times the strength 0.05. Depth of field gathers 16 taps at half size, over a radius blur · |1 − focus / z|.', formula: 'bloom weight = max(soft² / 4k, b − threshold) / b, &nbsp; soft = clamp(b − threshold + k, 0, 2k)' },
  { label: 'Output pass', text: 'One full-screen triangle into the canvas: ambient occlusion and contact shadows from the depth buffer, exposure, tone mapping (none, ACES or AgX), the background gradient under it, grading and vignette, the outline where the mask changes within the outline\'s width, and sRGB encoding.', formula: 'ACES: x(2.51x + 0.03) / (x(2.43x + 0.59) + 0.14)' },
];
const s = useSteps(steps.length, [3400, 3400, 3600, 3600, 3000, 3600, 3800], root);
const k = computed(() => ease(s.t.value));
const reveal = computed(() => IMG.h * k.value);
const on = computed(() => new Set(active[s.step.value]));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="One frame, pass by pass" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="The viewer's render passes in order and the image each one writes">
        <defs>
          <linearGradient v-for="g in grads" :id="g.id" :key="g.id" gradientUnits="userSpaceOnUse" :x1="g.x1" :y1="g.y1" :x2="g.x2" :y2="g.y2">
            <stop offset="0" :stop-color="g.c1" /><stop offset="1" :stop-color="g.c2" />
          </linearGradient>
          <linearGradient id="gpu-pass-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e3035" /><stop offset="1" stop-color="#18191b" /></linearGradient>
          <pattern id="gpu-pass-check" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#9a9a9a" /><rect width="6" height="6" fill="#bdbdbd" /><rect x="6" y="6" width="6" height="6" fill="#bdbdbd" /></pattern>
          <clipPath id="gpu-pass-reveal"><rect :x="IMG.x" :y="IMG.y" :width="IMG.w" :height="reveal" /></clipPath>
          <clipPath id="gpu-pass-frame"><rect :x="IMG.x" :y="IMG.y" :width="IMG.w" :height="IMG.h" rx="4" /></clipPath>
          <filter id="gpu-pass-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
        </defs>
        <!-- the frame graph -->
        <g v-for="(n, i) in nodes" :key="n.k">
          <line v-if="i" :x1="n.x - 6.5" :y1="21" :x2="n.x - 1" :y2="21" class="arrow" />
          <rect :x="n.x" y="10" width="40" height="22" rx="4" class="node" :class="{ opt: n.opt, on: on.has(n.k) }" />
          <text :x="n.x + 20" y="25" text-anchor="middle" class="node-label" :class="{ on: on.has(n.k) }">{{ n.label }}</text>
        </g>
        <text x="7" y="45" class="hint">dashed: only when needed</text>
        <!-- the image -->
        <rect :x="IMG.x" :y="IMG.y" :width="IMG.w" :height="IMG.h" rx="4" class="frame" />
        <g clip-path="url(#gpu-pass-frame)">
          <g clip-path="url(#gpu-pass-reveal)">
            <g v-if="s.step.value === 0">
              <rect :x="IMG.x" :y="IMG.y" :width="IMG.w" :height="IMG.h" :fill="lightClear" />
              <polygon v-for="(p, i) in lightImage" :key="'l' + i" :points="p.points" :fill="p.fill" :stroke="p.fill" class="face" />
            </g>
            <g v-else-if="s.step.value === 1">
              <rect :x="IMG.x" :y="IMG.y" :width="IMG.w" :height="IMG.h" fill="#000" />
              <polygon v-for="(p, i) in camDepth" :key="'d' + i" :points="p.points" :fill="p.fill" :stroke="p.fill" class="face" />
            </g>
            <g v-else-if="s.step.value <= 3 || s.step.value === 5">
              <rect :x="IMG.x" :y="IMG.y" :width="IMG.w" :height="IMG.h" fill="url(#gpu-pass-check)" />
              <polygon v-for="(p, i) in camShadow" :key="'s' + i" :points="p" fill="#000" fill-opacity="0.5" />
              <polygon v-for="(p, i) in camColour" :key="'c' + i" :points="p.points" :fill="p.fill" :stroke="p.fill" class="face" />
              <g v-if="s.step.value >= 3"><polyline v-for="(e, i) in edgeLines" :key="'e' + i" :points="e" class="edge" /></g>
            </g>
            <g v-else-if="s.step.value === 4">
              <rect :x="IMG.x" :y="IMG.y" :width="IMG.w" :height="IMG.h" fill="#1d1d1f" />
              <polygon v-for="(p, i) in camSilhouette" :key="'m' + i" :points="p" class="mask" />
            </g>
            <g v-else>
              <rect :x="IMG.x" :y="IMG.y" :width="IMG.w" :height="IMG.h" fill="url(#gpu-pass-bg)" />
              <polygon v-for="(p, i) in camShadow" :key="'s' + i" :points="p" fill="#000" fill-opacity="0.5" />
              <polygon v-for="(p, i) in camSilhouette" :key="'o' + i" :points="p" class="outline" />
              <polygon v-for="(p, i) in camFinal" :key="'f' + i" :points="p.points" :fill="p.fill" :stroke="p.fill" class="face" />
              <polyline :points="rimPoints" class="crease" filter="url(#gpu-pass-soft)" />
              <polyline v-for="(e, i) in edgeLines" :key="'e' + i" :points="e" class="edge" />
            </g>
          </g>
          <line :x1="IMG.x" :x2="IMG.x + IMG.w" :y1="IMG.y + reveal" :y2="IMG.y + reveal" class="scan" :style="{ opacity: k < 1 ? 1 : 0 }" />
        </g>
        <!-- what the pass writes -->
        <text v-for="(line, i) in panel[s.step.value]" :key="'p' + i" x="262" :y="70 + i * 15" :class="i === 0 ? 'panel-title' : 'panel'">{{ line }}</text>
        <g v-if="s.step.value === 5">
          <rect v-for="(c, i) in chain" :key="'b' + i" :x="c.x" :y="160" :width="c.w" :height="c.h" class="level" :style="{ opacity: Math.min(1, Math.max(0, k * 5 - i)) }" />
          <text x="262" y="236" class="panel">each level half the last</text>
        </g>
      </svg>
      <template #note>Worked out in the page with the viewer's formulas on a 2.2 × 1.4 × 0.5 box with a Ø0.84 boss, a key light
        (casting the shadow) and a fill light at the default rig's intensities, turned so the shadows face the eye, and a
        shadow catcher at opacity 0.5. Depth is shown as grey (the light's view
        brightened a little); faces are shaded at their corners and blended, where the viewer shades every pixel; the
        crease darkening in the last image stands in for the ambient occlusion, which the output pass computes from the
        depth buffer. The colour target is shown sRGB-encoded over a checkerboard where it is empty.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 10px; fill: var(--vp-c-text-2); }
.node { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); stroke-width: 1; }
.node.opt { stroke-dasharray: 3 2; }
.node.on { fill: var(--a); stroke: var(--a); }
.node-label { font-weight: 600; }
.node-label.on { fill: var(--vp-c-bg); }
.arrow { stroke: var(--vp-c-text-3); stroke-width: 1; }
.hint { font-size: 10px; fill: var(--vp-c-text-3); }
.frame { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.scan { stroke: var(--hot); stroke-width: 1.2; }
.face { stroke-width: 0.6; stroke-linejoin: round; }
.edge { fill: none; stroke: #111111; stroke-width: 1.1; stroke-linejoin: round; }
.mask { fill: var(--keep); stroke: var(--keep); stroke-width: 0.6; }
.outline { fill: #e8c25a; stroke: #e8c25a; stroke-width: 4; stroke-linejoin: round; }
.crease { fill: none; stroke: #000; stroke-opacity: 0.45; stroke-width: 3; }
.panel-title { font-size: 11px; font-weight: 700; fill: var(--vp-c-text-1); }
.panel { font-size: 10px; }
.level { fill: var(--b); fill-opacity: 0.35; stroke: var(--b); }
</style>
