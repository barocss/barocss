// The AI evaluation's picture of a run's result (the gallery's render, roadmap Later): the placed bodies' display meshes
// drawn in Node with no GPU — an isometric view, a z-buffer, flat shading by the triangle's normal — and written as a
// PNG. It shows what the agent built; it judges nothing.
import { deflateSync } from 'node:zlib';
import type { PlacedBody } from '@barocss/cad-model/team/clearanceMap';

const MARGIN = 24;
/** A saved camera (the gallery keeps it beside each still): orthographic, looking along `direction` (toward the model), `up` up the picture. */
export interface Camera { view: View; projection: 'orthographic'; direction: [number, number, number]; up: [number, number, number]; width: number; height: number; pxPerMM: number; centre: [number, number] }
export type View = 'iso' | 'iso-back' | 'front' | 'side' | 'top';
/** Each view's screen axes in world terms: right, down, and toward the viewer (depth). */
const VIEWS: Record<View, { r: number[]; d: number[]; t: number[] }> = (() => {
  const n = (v: number[]) => { const l = Math.hypot(...v); return v.map(x => x / l); }, cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const of = (toViewer: number[]) => { const t = n(toViewer), r = Math.abs(t[2]) > 0.99 ? [1, 0, 0] : n(cross([0, 0, 1], t)), u = cross(t, r); return { r, d: u.map(x => -x), t }; };
  // (iso: the studio's, from +X+Y+Z, x to the right and down; iso-back from −X−Y+Z; front from −Y; side from +X; top from +Z.)
  return { iso: of([1, 1, 1]), 'iso-back': of([-1, -1, 1]), front: of([0, -1, 0]), side: of([1, 0, 0]), top: of([0, 0, 1]) };
})();
/** The light, in world coordinates, toward the viewer's upper left. */
const LIGHT = (() => { const l = [-0.3, -0.5, 0.8], n = Math.hypot(...l); return l.map(v => v / n); })();
const PALETTE: [number, number, number][] = [[96, 140, 196], [196, 140, 96], [120, 176, 120], [176, 120, 176], [200, 184, 96], [96, 184, 184]];

let crcTable: Uint32Array | null = null;
function crc32(b: Uint8Array): number {
  if (!crcTable) { crcTable = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), v = new DataView(out.buffer);
  v.setUint32(0, data.length); out.set(new TextEncoder().encode(type), 4); out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
/** RGB pixels as a PNG file. */
export function png(rgb: Uint8Array, w: number, h: number): Uint8Array {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1); }
  const ihdr = new Uint8Array(13), v = new DataView(ihdr.buffer);
  v.setUint32(0, w); v.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** A body's colour as #rrggbb (its look), or none. */
export type ColourOf = (key: string) => string | undefined;
const hex = (c: string): [number, number, number] | null => { const m = /^#?([0-9a-f]{6})$/i.exec(c.trim()); return m ? [0, 2, 4].map(k => parseInt(m[1].slice(k, k + 2), 16)) as [number, number, number] : null; };
/** The bodies' world triangles, projected: [sx, sy, depth] × 3, a shade and a colour index each (`colours` the palette). */
function worldTriangles(bodies: readonly PlacedBody[], v: (typeof VIEWS)[View], colourOf?: ColourOf): { p: Float64Array; shade: Float32Array; colour: Uint16Array; colours: [number, number, number][] } {
  let n = 0; for (const b of bodies) n += b.mesh.indices.length / 3;
  const p = new Float64Array(n * 9), shade = new Float32Array(n), colour = new Uint16Array(n), colours: [number, number, number][] = [];
  let t = 0;
  bodies.forEach((b, k) => {
    const own = colourOf ? hex(colourOf(b.key) ?? '') : null;
    colours.push(own ?? PALETTE[k % PALETTE.length]);
    const P = b.mesh.positions, I = b.mesh.indices, m = b.pose.m, o = b.pose.t;
    for (let i = 0; i < I.length; i += 3, t++) {
      const w: number[] = [];
      for (let j = 0; j < 3; j++) {
        const x = P[3 * I[i + j]], y = P[3 * I[i + j] + 1], z = P[3 * I[i + j] + 2];
        w.push(m[0] * x + m[1] * y + m[2] * z + o[0], m[3] * x + m[4] * y + m[5] * z + o[1], m[6] * x + m[7] * y + m[8] * z + o[2]);
      }
      const ux = w[3] - w[0], uy = w[4] - w[1], uz = w[5] - w[2], vx = w[6] - w[0], vy = w[7] - w[1], vz = w[8] - w[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
      shade[t] = 0.35 + 0.65 * Math.abs(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      colour[t] = k;
      for (let j = 0; j < 3; j++) { const x = w[3 * j], y = w[3 * j + 1], z = w[3 * j + 2]; p.set([x * v.r[0] + y * v.r[1] + z * v.r[2], x * v.d[0] + y * v.d[1] + z * v.d[2], x * v.t[0] + y * v.t[1] + z * v.t[2]], t * 9 + 3 * j); }
    }
  });
  return { p, shade, colour, colours };
}

/** The placed bodies as a PNG from a view (orthographic, flat shaded) and its camera, or null when there is nothing to draw. */
export function renderBodies(bodies: readonly PlacedBody[], view: View = 'iso', o: { width?: number; height?: number; colourOf?: ColourOf } = {}): { png: Uint8Array; camera: Camera } | null {
  const W = o.width ?? 960, H = o.height ?? 720, v = VIEWS[view];
  const { p, shade, colour, colours } = worldTriangles(bodies, v, o.colourOf);
  if (!shade.length) return null;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
  const s = Math.min((W - 2 * MARGIN) / Math.max(x1 - x0, 1e-9), (H - 2 * MARGIN) / Math.max(y1 - y0, 1e-9));
  const ox = (W - s * (x1 - x0)) / 2 - s * x0, oy = (H - s * (y1 - y0)) / 2 - s * y0;
  const rgb = new Uint8Array(W * H * 3).fill(244), depth = new Float64Array(W * H).fill(-Infinity);
  for (let t = 0; t < shade.length; t++) {
    const a = t * 9, X = [p[a] * s + ox, p[a + 3] * s + ox, p[a + 6] * s + ox], Y = [p[a + 1] * s + oy, p[a + 4] * s + oy, p[a + 7] * s + oy], D = [p[a + 2], p[a + 5], p[a + 8]];
    const area = (X[1] - X[0]) * (Y[2] - Y[0]) - (X[2] - X[0]) * (Y[1] - Y[0]);
    if (Math.abs(area) < 1e-12) continue;
    const c = colours[colour[t]], f = shade[t];
    const minX = Math.max(0, Math.floor(Math.min(...X))), maxX = Math.min(W - 1, Math.ceil(Math.max(...X))), minY = Math.max(0, Math.floor(Math.min(...Y))), maxY = Math.min(H - 1, Math.ceil(Math.max(...Y)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((X[1] - px) * (Y[2] - py) - (X[2] - px) * (Y[1] - py)) / area, w1 = ((X[2] - px) * (Y[0] - py) - (X[0] - px) * (Y[2] - py)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const d = w0 * D[0] + w1 * D[1] + w2 * D[2], k = y * W + x;
      if (d <= depth[k]) continue;
      depth[k] = d; rgb[3 * k] = c[0] * f; rgb[3 * k + 1] = c[1] * f; rgb[3 * k + 2] = c[2] * f;
    }
  }
  const camera: Camera = { view, projection: 'orthographic', direction: v.t.map(x => -x) as Camera['direction'], up: v.d.map(x => -x) as Camera['up'], width: W, height: H, pxPerMM: s, centre: [(x0 + x1) / 2, (y0 + y1) / 2] };
  return { png: png(rgb, W, H), camera };
}
