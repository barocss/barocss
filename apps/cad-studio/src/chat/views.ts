// The part as engineering views for an agent to look at (A2.3): front, top, right and isometric on one 2 × 2
// sheet, from the kernel's exact hidden-line projection (visible edges solid, hidden ones thin and dashed), a
// light fill where a face shows (a z-buffer of the display mesh in the same projection), and Set-of-Mark
// labels — a number on each face that shows enough, with the legend saying which face it is. Drawn and
// encoded as PNG in our own code (CompressionStream for the deflate: no dependency, in Node and the browser).
// Rendered only when asked, and cached by the model and the options.
import { projectBrepHiddenLines, type Brep, type BrepProjection, type ProjectedCurve } from '@barocss/cad';
import { withNode, type StudioDoc } from '../engine/doc';
import { partBreps, type BodyResult, type EvalResult } from '../engine/evaluate';
import { bodyKeyFor } from '../engine/ids';
import { refOf } from '../app/bodyRef';
import { VIEWS } from '../drawing/views';
import { VIEW_IDS, type ViewId } from '../drawing/types';
import type { DisplayMesh } from '../engine/mesh';
import { crc32, deflateZlib } from '../io/zip';

const CELL = 500, MARGIN = 28, W = CELL * 2, H = CELL * 2;
/** Faces showing fewer pixels than this get no label (too small to point at). */
const LABEL_MIN_PIXELS = 60;

// ---- raster (module level: the loops run per pixel) ----------------------------------------------------------
let img = new Uint8ClampedArray(0);
function blend(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 4, k = Math.min(1, a);
  img[i] = img[i] * (1 - k) + r * k; img[i + 1] = img[i + 1] * (1 - k) + g * k; img[i + 2] = img[i + 2] * (1 - k) + b * k;
}
/** An antialiased segment `width` px wide; `dash`: on/off lengths in px (0: solid), `phase` the length drawn before it. */
function segment(x0: number, y0: number, x1: number, y1: number, width: number, r: number, g: number, b: number, dash: number, phase: number): number {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, l = Math.sqrt(l2), h = width / 2 + 1;
  const xa = Math.floor(Math.min(x0, x1) - h), xb = Math.ceil(Math.max(x0, x1) + h), ya = Math.floor(Math.min(y0, y1) - h), yb = Math.ceil(Math.max(y0, y1) + h);
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const px = x + 0.5 - x0, py = y + 0.5 - y0, t = l2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / l2)) : 0;
    if (dash > 0 && ((phase + t * l) % (2 * dash)) > dash) continue;
    const ex = px - t * dx, ey = py - t * dy, d = Math.sqrt(ex * ex + ey * ey);
    blend(x, y, r, g, b, width / 2 + 0.5 - d);
  }
  return phase + l;
}
/** 3 × 5 digits, a row of bits per line (high bit left). */
const DIGITS = [[7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 7, 1, 7], [5, 5, 7, 1, 1], [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 1, 1, 1], [7, 5, 7, 5, 7], [7, 5, 7, 1, 7]];
/** A label: the number in dark digits on a white box with a dark rim, centred on (x, y). */
function label(x: number, y: number, n: number, hot: boolean): void {
  const text = String(n), S = 2, w = text.length * 4 * S + S, h = 5 * S + 2 * S, x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
  for (let yy = -1; yy <= h; yy++) for (let xx = -1; xx <= w; xx++) {
    const rim = yy === -1 || xx === -1 || yy === h || xx === w;
    if (rim) blend(x0 + xx, y0 + yy, hot ? 200 : 40, hot ? 30 : 40, hot ? 30 : 40, 1); else blend(x0 + xx, y0 + yy, 255, 255, 255, 1);
  }
  for (let c = 0; c < text.length; c++) {
    const g = DIGITS[text.charCodeAt(c) - 48];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) if (g[row] & (4 >> col))
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) blend(x0 + S + c * 4 * S + col * S + sx, y0 + S + row * S + sy, 20, 20, 20, 1);
  }
}
// The id buffer of one cell: the nearest face at each pixel (−1: none), and its depth.
const ids = new Int32Array(CELL * CELL), depth = new Float32Array(CELL * CELL);
function triangle(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, id: number): void {
  const xa = Math.max(0, Math.floor(Math.min(ax, bx, cx))), xb = Math.min(CELL - 1, Math.ceil(Math.max(ax, bx, cx)));
  const ya = Math.max(0, Math.floor(Math.min(ay, by, cy))), yb = Math.min(CELL - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(area) < 1e-12) return;
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area, w2 = 1 - w0 - w1;
    if (w0 < 0 || w1 < 0 || w2 < 0) continue;
    const z = w0 * az + w1 * bz + w2 * cz, k = y * CELL + x;
    if (z > depth[k]) { depth[k] = z; ids[k] = id; }
  }
}

/**
 * Each pixel's distance (chamfer 1, √2) to the nearest pixel of another face or of none: a label goes where its
 * face's is largest, the point deepest inside what shows (not the centre of a face with a hole in it).
 */
const dist = new Float32Array(CELL * CELL);
function distanceTransform(): void {
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const k = y * CELL + x, f = ids[k];
    dist[k] = f < 0 || x === 0 || y === 0 || x === CELL - 1 || y === CELL - 1 || ids[k - 1] !== f || ids[k + 1] !== f || ids[k - CELL] !== f || ids[k + CELL] !== f ? 0 : Infinity;
  }
  for (let y = 1; y < CELL; y++) for (let x = 1; x < CELL - 1; x++) {
    const k = y * CELL + x;
    dist[k] = Math.min(dist[k], dist[k - 1] + 1, dist[k - CELL] + 1, dist[k - CELL - 1] + Math.SQRT2, dist[k - CELL + 1] + Math.SQRT2);
  }
  for (let y = CELL - 2; y >= 0; y--) for (let x = CELL - 2; x >= 1; x--) {
    const k = y * CELL + x;
    dist[k] = Math.min(dist[k], dist[k + 1] + 1, dist[k + CELL] + 1, dist[k + CELL + 1] + Math.SQRT2, dist[k + CELL - 1] + Math.SQRT2);
  }
}

// ---- PNG -----------------------------------------------------------------------------------------------------
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8); dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
/** The RGBA image as a PNG (RGB, filter 0 rows). */
async function png(rgba: Uint8ClampedArray, w: number, h: number): Promise<Uint8Array> {
  const raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) { raw[y * (1 + w * 3)] = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, o = y * (1 + w * 3) + 1 + x * 3; raw[o] = rgba[i]; raw[o + 1] = rgba[i + 1]; raw[o + 2] = rgba[i + 2]; } }
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer); dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', await deflateZlib(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const base64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

// ---- the sheet -----------------------------------------------------------------------------------------------
/** Points along a projected curve (an arc by 64 steps a turn). */
function curvePoints(c: ProjectedCurve): [number, number][] {
  if (c.kind === 'line') return [[c.a[0], c.a[1]], [c.b[0], c.b[1]]];
  if (c.kind === 'polyline') return c.points.map(p => [p[0], p[1]]);
  const n = Math.max(4, Math.ceil(Math.abs(c.t1 - c.t0) / (Math.PI / 32))), out: [number, number][] = [];
  for (let k = 0; k <= n; k++) { const t = c.t0 + (c.t1 - c.t0) * k / n; out.push([c.center[0] + c.u[0] * Math.cos(t) + c.v[0] * Math.sin(t), c.center[1] + c.u[1] * Math.cos(t) + c.v[1] * Math.sin(t)]); }
  return out;
}

export interface ViewsResult { image: string; legend: Record<string, string>; views: Record<string, { visible_faces: string[]; mm_per_px: number }>; layout: string; notes: string[] }
const cache = new Map<string, ViewsResult>();

/**
 * The part's 2 × 2 sheet of views: `highlight` names faces to fill red (and ring their labels), `section` cuts
 * the part across an axis first (the kept side, its cut faces showing). Cached by model and options.
 */
export async function renderViews(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: (doc: StudioDoc) => Promise<EvalResult | null>, options: { highlight?: readonly string[]; section?: { axis: 'x' | 'y' | 'z'; at: number } } = {}): Promise<ViewsResult | string> {
  const key = JSON.stringify([doc.nodes, doc.parameters, options]);
  const hit = cache.get(key); if (hit) return hit;
  let shown: readonly BodyResult[] = bodies, model = doc;
  if (options.section) {
    const { axis, at } = options.section, k = 'xyz'.indexOf(axis);
    // (The side whose cut faces look at the views: y > at for the front, x < at for the right, z < at for the top.)
    const side = axis === 'y' ? 'positive' : 'negative', kept = (b: BodyResult) => side === 'positive' ? b.mesh.bounds.min[k] >= at - 1e-6 : b.mesh.bounds.max[k] <= at + 1e-6;
    let probe = doc; const keep: string[] = [];
    for (const b of bodies) {
      if (b.mesh.bounds.min[k] < at - 1e-6 && b.mesh.bounds.max[k] > at + 1e-6) { probe = withNode(probe, { kind: 'split', parent: refOf(b), axis, at }); keep.push(bodyKeyFor(probe.nodes, probe.nodes.length - 1, side)); }
      else if (kept(b)) keep.push(b.key);
    }
    const r = await evaluate(probe); if (!r?.ok) return 'the section could not be cut';
    shown = r.bodies.filter(b => keep.includes(b.key)); model = probe;
    if (!shown.length) return `nothing lies on the kept side of ${axis} = ${at}`;
  }
  if (!shown.length) return 'there is no body to show';
  const keys = new Set(shown.map(b => b.key)), breps: Brep[] = partBreps(model).filter(b => keys.has(b.key)).map(b => b.brep);
  const hot = new Set(options.highlight ?? []), faceName = (bi: number, fi: number) => shown[bi].mesh.faces[fi]?.name.split('+')[0] ?? '';
  const faceBase: number[] = []; let nFaces = 0; for (const b of shown) { faceBase.push(nFaces); nFaces += b.mesh.faces.length; }
  const owner = new Int32Array(nFaces); shown.forEach((b, bi) => { for (let f = 0; f < b.mesh.faces.length; f++) owner[faceBase[bi] + f] = bi; });
  img = new Uint8ClampedArray(W * H * 4).fill(255);
  const numbers = new Map<string, number>(), out: ViewsResult['views'] = {};
  VIEW_IDS.forEach((id: ViewId, v) => {
    const pr: BrepProjection = projectBrepHiddenLines(breps, VIEWS[id]), ox = (v % 2) * CELL, oy = Math.floor(v / 2) * CELL;
    const sx = (CELL - 2 * MARGIN) / Math.max(1e-9, pr.max[0] - pr.min[0]), sy = (CELL - 2 * MARGIN) / Math.max(1e-9, pr.max[1] - pr.min[1]), s = Math.min(sx, sy);
    const cx = MARGIN + ((CELL - 2 * MARGIN) - (pr.max[0] - pr.min[0]) * s) / 2, cy = MARGIN + ((CELL - 2 * MARGIN) - (pr.max[1] - pr.min[1]) * s) / 2;
    const X = (x: number) => cx + (x - pr.min[0]) * s, Y = (y: number) => CELL - cy - (y - pr.min[1]) * s;
    // Faces: the nearest at each pixel.
    ids.fill(-1); depth.fill(-Infinity);
    shown.forEach((b, bi) => {
      const m: DisplayMesh = b.mesh, P = m.positions, I = m.indices, R = pr.right, U = pr.up, T = pr.toward;
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t] * 3, c = I[t + 1] * 3, d = I[t + 2] * 3;
        triangle(X(P[a] * R[0] + P[a + 1] * R[1] + P[a + 2] * R[2]), Y(P[a] * U[0] + P[a + 1] * U[1] + P[a + 2] * U[2]), P[a] * T[0] + P[a + 1] * T[1] + P[a + 2] * T[2],
          X(P[c] * R[0] + P[c + 1] * R[1] + P[c + 2] * R[2]), Y(P[c] * U[0] + P[c + 1] * U[1] + P[c + 2] * U[2]), P[c] * T[0] + P[c + 1] * T[1] + P[c + 2] * T[2],
          X(P[d] * R[0] + P[d + 1] * R[1] + P[d + 2] * R[2]), Y(P[d] * U[0] + P[d + 1] * U[1] + P[d + 2] * U[2]), P[d] * T[0] + P[d + 1] * T[1] + P[d + 2] * T[2], faceBase[bi] + m.faceOfVertex[I[t]]);
      }
    });
    const count = new Float64Array(nFaces);
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const f = ids[y * CELL + x]; if (f < 0) continue;
      count[f]++;
      const name = faceName(owner[f], f - faceBase[owner[f]]);
      if (hot.has(name)) blend(ox + x, oy + y, 255, 205, 205, 1); else blend(ox + x, oy + y, 236, 238, 242, 1);
    }
    // Edges: hidden first (thin, dashed), visible over them.
    for (const pass of [false, true]) for (const e of pr.edges) for (const piece of e.pieces) {
      if (piece.visible !== pass) continue;
      const pts = curvePoints(piece.curve); let phase = 0;
      for (let k = 0; k + 1 < pts.length; k++) phase = pass
        ? segment(ox + X(pts[k][0]), oy + Y(pts[k][1]), ox + X(pts[k + 1][0]), oy + Y(pts[k + 1][1]), 1.6, 30, 32, 38, 0, phase)
        : segment(ox + X(pts[k][0]), oy + Y(pts[k][1]), ox + X(pts[k + 1][0]), oy + Y(pts[k + 1][1]), 0.9, 150, 155, 165, 4, phase);
    }
    // Labels: on each face showing enough, at its pixel deepest inside what shows of it.
    distanceTransform();
    // (Of the pixels nearly as deep — a long face has a ridge of them — the one nearest the face's centre.)
    const deepest = new Float64Array(nFaces).fill(-1), at = new Int32Array(nFaces).fill(-1), mx = new Float64Array(nFaces), my = new Float64Array(nFaces), near = new Float64Array(nFaces).fill(Infinity);
    for (let k = 0; k < CELL * CELL; k++) { const f = ids[k]; if (f < 0) continue; mx[f] += k % CELL; my[f] += Math.floor(k / CELL); if (dist[k] > deepest[f]) deepest[f] = dist[k]; }
    for (let k = 0; k < CELL * CELL; k++) {
      const f = ids[k]; if (f < 0 || dist[k] < 0.85 * deepest[f]) continue;
      const d = (k % CELL - mx[f] / count[f]) ** 2 + (Math.floor(k / CELL) - my[f] / count[f]) ** 2;
      if (d < near[f]) { near[f] = d; at[f] = k; }
    }
    const visible: string[] = [];
    for (let f = 0; f < nFaces; f++) {
      if (count[f] < 1) continue;
      const name = faceName(owner[f], f - faceBase[owner[f]]); if (!visible.includes(name)) visible.push(name);
      if (count[f] < LABEL_MIN_PIXELS || at[f] < 0) continue;
      if (!numbers.has(name)) numbers.set(name, numbers.size + 1);
      label(ox + at[f] % CELL, oy + Math.floor(at[f] / CELL), numbers.get(name)!, hot.has(name));
    }
    // A thin frame round the cell.
    segment(ox + 0.5, oy + CELL - 0.5, ox + CELL - 0.5, oy + CELL - 0.5, 1, 200, 200, 205, 0, 0); segment(ox + CELL - 0.5, oy + 0.5, ox + CELL - 0.5, oy + CELL - 0.5, 1, 200, 200, 205, 0, 0);
    out[id] = { visible_faces: visible, mm_per_px: Math.round(1e4 / s) / 1e4 };
  });
  const result: ViewsResult = {
    image: base64(await png(img, W, H)), legend: Object.fromEntries([...numbers].map(([name, n]) => [String(n), name])), views: out,
    layout: 'one 1000 × 1000 PNG, four views: front (top left), top (top right), right (bottom left), isometric (bottom right); third-angle',
    notes: ['edges by the kernel\'s exact hidden-line projection: solid visible, thin dashed hidden', 'face fill and labels from the display mesh (to its chord error); a face showing under 60 px is listed but not labelled', ...(options.section ? [`cut at ${options.section.axis} = ${options.section.at}, the side ${options.section.axis === 'y' ? 'beyond (y > at)' : `below (${options.section.axis} < at)`} kept: its cut faces look at the ${options.section.axis === 'y' ? 'front' : options.section.axis === 'x' ? 'right' : 'top'} view`] : []), ...(hot.size ? ['highlighted faces filled red, their labels ringed red'] : [])],
  };
  cache.set(key, result); if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return result;
}
