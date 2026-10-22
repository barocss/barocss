// Text labels (G15): glyphs as signed distance fields in one atlas, and labels laid out as glyph quads. The glyphs are
// drawn once each by the browser's own 2D canvas in a font the page already has (no font file of ours), then turned into
// a distance field by our own transform (Felzenszwalb–Huttenlocher's exact squared Euclidean distance, in two passes of
// 1D lower envelopes), so a label stays sharp at any size: the shader cuts its edge at the field's middle, a pixel wide.

/** A glyph's cell: its distance field is GLYPH_CELL² bytes; the em is drawn GLYPH_EM pixels high, the field spreads GLYPH_SPREAD each way. */
export const GLYPH_CELL = 64, GLYPH_EM = 44, GLYPH_SPREAD = 8;
/** The atlas: ATLAS_CELLS × ATLAS_CELLS cells. */
export const ATLAS_CELLS = 32, ATLAS_SIZE = GLYPH_CELL * ATLAS_CELLS;
/** Where a glyph's baseline sits in its cell (from the top), and the line height, in em-pixels. */
const ASCENT = 0.8 * GLYPH_EM, LINE = 1.25 * GLYPH_EM;
const INF = 1e20;

/** Scratch for the 1D transform (sized to a cell). */
const env = { v: new Int32Array(GLYPH_CELL), z: new Float64Array(GLYPH_CELL + 1), f: new Float64Array(GLYPH_CELL), d: new Float64Array(GLYPH_CELL) };

/** The 1D squared distance transform of f (n samples) into d: min over q of (p − q)² + f(q). */
function edt1(n: number): void {
  const { v, z, f, d } = env;
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = q - v[k]; d[q] = r * r + f[v[k]]; }
}

/** The exact squared Euclidean distance (pixels²) from each pixel of a w × h grid to the nearest pixel where `seed` is set. */
export function squaredDistances(seed: ArrayLike<boolean | number>, w: number, h: number, out: Float64Array = new Float64Array(w * h)): Float64Array {
  for (let i = 0; i < w * h; i++) out[i] = seed[i] ? 0 : INF;
  const { f, d } = env;
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = out[y * w + x]; edt1(h); for (let y = 0; y < h; y++) out[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = out[y * w + x]; edt1(w); for (let x = 0; x < w; x++) out[y * w + x] = d[x]; }
  return out;
}

const inside = new Uint8Array(GLYPH_CELL * GLYPH_CELL), outside = new Uint8Array(GLYPH_CELL * GLYPH_CELL);
const dIn = new Float64Array(GLYPH_CELL * GLYPH_CELL), dOut = new Float64Array(GLYPH_CELL * GLYPH_CELL);
/**
 * A cell's distance field from its coverage (0–255 a pixel): 128 on the edge, up inside, down outside, GLYPH_SPREAD pixels
 * to either end. The edge is where the coverage crosses a half; each side's distance is to the nearest pixel of the other.
 */
export function distanceField(coverage: ArrayLike<number>, out: Uint8Array = new Uint8Array(GLYPH_CELL * GLYPH_CELL)): Uint8Array {
  const n = GLYPH_CELL * GLYPH_CELL;
  for (let i = 0; i < n; i++) { const c = coverage[i] >= 128; inside[i] = c ? 1 : 0; outside[i] = c ? 0 : 1; }
  squaredDistances(inside, GLYPH_CELL, GLYPH_CELL, dOut);
  squaredDistances(outside, GLYPH_CELL, GLYPH_CELL, dIn);
  for (let i = 0; i < n; i++) {
    // (Half a pixel either side of the boundary between them: a pixel's distance is to the other side's nearest centre.)
    const sd = inside[i] ? Math.sqrt(dIn[i]) - 0.5 : 0.5 - Math.sqrt(dOut[i]);
    out[i] = Math.max(0, Math.min(255, Math.round(128 + (sd / GLYPH_SPREAD) * 127)));
  }
  return out;
}

/** A glyph in the atlas: its cell, its advance (em-pixels). */
export interface Glyph { cell: number; advance: number }
/** Draws one character into a GLYPH_CELL² coverage (0–255) and measures its advance; null when the page has no 2D canvas. */
export type GlyphRaster = (ch: string, font: string) => { coverage: Uint8Array; advance: number } | null;

/**
 * A label font ("500 'IBM Plex Mono', monospace": style and weight words, then families) as a CSS font at the em size —
 * the size between them, where CSS wants it (a string the canvas cannot read is ignored, leaving its 10 px default).
 */
export function cssFont(font: string): string {
  const m = /^((?:(?:normal|italic|oblique|small-caps|bold|bolder|lighter|\d{3})\s+)*)(.*)$/.exec(font.trim())!;
  return `${m[1]}${GLYPH_EM}px ${m[2] || 'monospace'}`;
}
/** The browser's 2D canvas as the glyph rasteriser (one canvas, reused). */
let rasterCanvas: { ctx: OffscreenCanvasRenderingContext2D } | null = null;
export const canvasRaster: GlyphRaster = (ch, font) => {
  if (!rasterCanvas) {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const ctx = new OffscreenCanvas(GLYPH_CELL, GLYPH_CELL).getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    rasterCanvas = { ctx };
  }
  const { ctx } = rasterCanvas;
  ctx.clearRect(0, 0, GLYPH_CELL, GLYPH_CELL);
  ctx.font = cssFont(font); ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
  ctx.fillText(ch, GLYPH_SPREAD, GLYPH_SPREAD + ASCENT);
  const img = ctx.getImageData(0, 0, GLYPH_CELL, GLYPH_CELL).data, coverage = new Uint8Array(GLYPH_CELL * GLYPH_CELL);
  for (let i = 0; i < coverage.length; i++) coverage[i] = img[i * 4 + 3];
  return { coverage, advance: ctx.measureText(ch).width };
};

/**
 * The glyphs drawn so far, by character, and their fields (kept, to upload again after a lost device). `added` lists the
 * cells made since it was last emptied — the viewer uploads those. A full atlas draws no new glyph (it says so once).
 */
export class GlyphAtlas {
  readonly glyphs = new Map<string, Glyph | null>();
  readonly fields: Uint8Array[] = [];
  added: number[] = [];
  full = false;
  constructor(readonly font: string, private readonly raster: GlyphRaster = canvasRaster) {}
  glyph(ch: string): Glyph | null {
    const have = this.glyphs.get(ch);
    if (have !== undefined) return have;
    if (this.fields.length >= ATLAS_CELLS * ATLAS_CELLS) { this.full = true; this.glyphs.set(ch, null); return null; }
    const r = this.raster(ch, this.font);
    if (!r) { this.glyphs.set(ch, null); return null; }
    const g: Glyph = { cell: this.fields.length, advance: r.advance };
    this.fields.push(distanceField(r.coverage)); this.added.push(g.cell); this.glyphs.set(ch, g);
    return g;
  }
}

/** A label to lay out (Viewer.addLabels' input, see viewer.ts). */
export interface LabelInput {
  text: string;
  at: ArrayLike<number>;
  size?: number;
  color?: readonly number[];
  align?: readonly [number, number];
  offset?: readonly [number, number];
  background?: { color: readonly number[]; opacity?: number; padding?: number; radius?: number; border?: readonly number[] | null } | null;
  plane?: { right: ArrayLike<number>; up: ArrayLike<number> } | null;
}

/** Floats an instance: anchor (3), colour (1, RGBA8), rect (4), uv (4), right (3), kind (1), up (3), radius (1). */
export const LABEL_FLOATS = 20;
/** Instance kinds: a glyph, or a box (with a border colour in the next instance's colour); plus PLANE when laid on a plane. */
export const LABEL_GLYPH = 0, LABEL_BOX = 1, LABEL_PLANE = 2;

/**
 * Labels as glyph and box instances (LABEL_FLOATS each) through an atlas: each line's glyphs at their advances, the lines
 * 1.25 em apart, the whole box placed at its anchor by `align` (0–1 across and down) and `offset` (CSS pixels); a screen
 * label in CSS pixels (y down), a plane label in world units along its plane's right and up (y up). Colours are linear
 * RGBA8, packed by `pack` (sRGB to linear is the caller's). Returns the instances and their count.
 */
export function layoutLabels(labels: readonly LabelInput[], atlas: GlyphAtlas, pack: (c: readonly number[] | undefined, a: number) => number): { data: Float32Array; count: number } {
  let n = 0;
  for (const l of labels) n += l.text.length + (l.background ? 2 : 0);
  const data = new Float32Array(n * LABEL_FLOATS), u = new Uint32Array(data.buffer);
  let k = 0;
  for (const l of labels) {
    const size = l.size ?? 12, s = size / GLYPH_EM, lines = l.text.split('\n');
    let wide = 0;
    const widths = lines.map(line => { let w = 0; for (const ch of line) w += atlas.glyph(ch)?.advance ?? GLYPH_EM * 0.5; wide = Math.max(wide, w); return w; });
    const W = wide * s, H = lines.length * LINE * s, [ax, ay] = l.align ?? [0.5, 0.5], [ox, oy] = l.offset ?? [0, 0];
    // (The box's top-left, from the anchor: across by −ax·W, down by −ay·H; a plane label's y points up.)
    const plane = !!l.plane, x0 = -ax * W + ox, y0 = -ay * H + oy;
    const put = (kind: number, rx0: number, ry0: number, rx1: number, ry1: number, uv: readonly number[], color: number, radius: number) => {
      const o = k * LABEL_FLOATS;
      data[o] = l.at[0]; data[o + 1] = l.at[1]; data[o + 2] = l.at[2]; u[o + 3] = color;
      // (A plane label's rectangle in its own y-up units: the text's top at the box's top.)
      if (plane) { data[o + 4] = rx0; data[o + 5] = -ry1; data[o + 6] = rx1; data[o + 7] = -ry0; } else { data[o + 4] = rx0; data[o + 5] = ry0; data[o + 6] = rx1; data[o + 7] = ry1; }
      // (A plane label's rectangle runs up the plane, so its cell's rows the other way.)
      if (plane && uv[0] >= 0) { data[o + 8] = uv[0]; data[o + 9] = uv[3]; data[o + 10] = uv[2]; data[o + 11] = uv[1]; } else { data[o + 8] = uv[0]; data[o + 9] = uv[1]; data[o + 10] = uv[2]; data[o + 11] = uv[3]; }
      const r = l.plane?.right ?? ZERO, up = l.plane?.up ?? ZERO;
      data[o + 12] = r[0]; data[o + 13] = r[1]; data[o + 14] = r[2]; data[o + 15] = kind + (plane ? LABEL_PLANE : 0);
      data[o + 16] = up[0]; data[o + 17] = up[1]; data[o + 18] = up[2]; data[o + 19] = radius;
      k++;
    };
    if (l.background) {
      const b = l.background, p = (b.padding ?? 4) * (plane ? s : 1), r = (b.radius ?? 4) * (plane ? s : 1);
      // (The box, then its border's colour riding in a second instance of the same box.)
      put(LABEL_BOX, x0 - p, y0 - p, x0 + W + p, y0 + H + p, NO_UV, pack(b.color, b.opacity ?? 1), r);
      put(LABEL_BOX, x0 - p, y0 - p, x0 + W + p, y0 + H + p, BORDER_UV, b.border ? pack(b.border, 1) : 0, r);
    }
    lines.forEach((line, li) => {
      let pen = x0 + (W - widths[li] * s) * ax;
      const top = y0 + li * LINE * s, baseline = top + ((LINE - GLYPH_EM) / 2 + ASCENT) * s;
      for (const ch of line) {
        const g = atlas.glyph(ch);
        if (g) {
          const cx = g.cell % ATLAS_CELLS, cy = Math.floor(g.cell / ATLAS_CELLS), q = 1 / ATLAS_CELLS;
          const gx = pen - GLYPH_SPREAD * s, gy = baseline - (GLYPH_SPREAD + ASCENT) * s;
          put(LABEL_GLYPH, gx, gy, gx + GLYPH_CELL * s, gy + GLYPH_CELL * s, [cx * q, cy * q, (cx + 1) * q, (cy + 1) * q], pack(l.color, 1), 0);
        } else { put(LABEL_GLYPH, 0, 0, 0, 0, NO_UV, 0, 0); }
        pen += (g?.advance ?? GLYPH_EM * 0.5) * s;
      }
    });
  }
  return { data, count: k };
}
const ZERO = [0, 0, 0], NO_UV = [0, 0, 0, 0], BORDER_UV = [-1, -1, -1, -1];
