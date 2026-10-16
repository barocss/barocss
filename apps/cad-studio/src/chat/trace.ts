// Traces a bitmap (a character, a logo, a silhouette) into outlines the chat can build solids from:
// the background is found (transparency, else the border colour), the foreground is split into a few
// flat colours, and each mask (the whole silhouette and every colour) becomes simplified polygon loops
// with their holes. Pure: pixels in, polygons out (grid pixels, y down); the tool scales them to mm.

export type Pt = [number, number];
export interface TraceRegion { outer: Pt[]; holes: Pt[][] }
export interface TraceLayer { id: string; name: string; color: string; areaFraction: number; regions: TraceRegion[] }
export interface ImageTrace { width: number; height: number; background: string; layers: TraceLayer[] }

export const TRACE_SIDE = 220;
const MAX_COLOURS = 6;

const hex = (c: readonly number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const dist2 = (a: readonly number[], b: readonly number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** RGBA pixels averaged down so the long side is at most `side`. */
function downscale(data: ArrayLike<number>, w: number, h: number, side: number) {
  const k = Math.max(1, Math.max(w, h) / side), W = Math.max(1, Math.round(w / k)), H = Math.max(1, Math.round(h / k));
  const out = new Float32Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.floor(x * w / W), x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / W)), y0 = Math.floor(y * h / H), y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / H));
    let n = 0; const s = [0, 0, 0, 0];
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * w + xx) * 4; for (let c = 0; c < 4; c++) s[c] += data[i + c]; n++; }
    for (let c = 0; c < 4; c++) out[(y * W + x) * 4 + c] = s[c] / n;
  }
  return { px: out, W, H };
}

/** Foreground mask and the background colour. */
function foreground(px: Float32Array, W: number, H: number) {
  const n = W * H, mask = new Uint8Array(n);
  let transparent = 0; for (let i = 0; i < n; i++) if (px[i * 4 + 3] < 128) transparent++;
  if (transparent > n * 0.02) { for (let i = 0; i < n; i++) mask[i] = px[i * 4 + 3] >= 128 ? 1 : 0; return { mask, background: 'transparent' }; }
  // The border's most common colour (coarsely binned) is the background.
  const bins = new Map<string, { n: number; s: number[] }>();
  const add = (x: number, y: number) => { const i = (y * W + x) * 4, c = [px[i], px[i + 1], px[i + 2]], key = c.map(v => v >> 5).join(); const b = bins.get(key) ?? { n: 0, s: [0, 0, 0] }; b.n++; c.forEach((v, k) => { b.s[k] += v; }); bins.set(key, b); };
  for (let x = 0; x < W; x++) { add(x, 0); add(x, H - 1); }
  for (let y = 1; y < H - 1; y++) { add(0, y); add(W - 1, y); }
  const best = [...bins.values()].sort((a, b) => b.n - a.n)[0], bg = best.s.map(v => v / best.n);
  for (let i = 0; i < n; i++) mask[i] = dist2([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]], bg) > 45 * 45 ? 1 : 0;
  // Enclosed background-coloured areas (a white face on a white page) belong to the figure: fill what the border cannot reach.
  const reach = new Uint8Array(n), stack: number[] = [];
  const push = (i: number) => { if (!mask[i] && !reach[i]) { reach[i] = 1; stack.push(i); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (stack.length) { const i = stack.pop()!, x = i % W, y = (i / W) | 0; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W); }
  for (let i = 0; i < n; i++) if (!mask[i] && !reach[i]) mask[i] = 2; // inside, background-coloured
  return { mask, background: hex(bg) };
}

/** A few flat colours of the foreground (k-means, merged when close, small ones dropped). */
function palette(px: Float32Array, mask: Uint8Array) {
  const pts: number[][] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) pts.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
  if (!pts.length) return { centres: [] as number[][], label: new Int8Array(mask.length).fill(-1) };
  // Farthest-point seeds, then a few Lloyd steps.
  let centres = [pts[0]];
  while (centres.length < MAX_COLOURS) {
    let far = pts[0], d = -1;
    for (const p of pts) { const m = Math.min(...centres.map(c => dist2(p, c))); if (m > d) { d = m; far = p; } }
    if (d < 40 * 40) break;
    centres.push(far);
  }
  for (let it = 0; it < 8; it++) {
    const s = centres.map(() => [0, 0, 0, 0]);
    for (const p of pts) { let b = 0; centres.forEach((c, k) => { if (dist2(p, c) < dist2(p, centres[b])) b = k; }); s[b][0] += p[0]; s[b][1] += p[1]; s[b][2] += p[2]; s[b][3]++; }
    centres = s.filter(v => v[3] > 0).map(v => [v[0] / v[3], v[1] / v[3], v[2] / v[3]]);
  }
  const assign = (p: number[]) => { let b = 0; centres.forEach((c, k) => { if (dist2(p, c) < dist2(p, centres[b])) b = k; }); return b; };
  // Drop colours under 0.3 % of the figure (anti-aliasing fringes): their pixels join the nearest kept colour.
  const counts = centres.map(() => 0); for (const p of pts) counts[assign(p)]++;
  centres = centres.filter((_, k) => counts[k] >= pts.length * 0.003);
  const label = new Int8Array(mask.length).fill(-1);
  for (let i = 0; i < mask.length; i++) if (mask[i]) label[i] = assign([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
  return { centres, label };
}

/** Pixels touching only at a corner are joined, so every traced loop is simple. */
function unpinch(m: Uint8Array, W: number, H: number) {
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const a = m[y * W + x], b = m[y * W + x + 1], c = m[(y + 1) * W + x], d = m[(y + 1) * W + x + 1];
    if (a && d && !b && !c) m[y * W + x + 1] = 1;
    else if (b && c && !a && !d) m[y * W + x] = 1;
  }
}

/** Boundary loops of a mask along pixel edges, the inside on the left (y down: outer loops clockwise on screen). */
export function traceLoops(m: Uint8Array, W: number, H: number): Pt[][] {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1;
  // Directed edges keyed by their start vertex.
  const next = new Map<number, number[]>();
  const key = (x: number, y: number) => y * (W + 1) + x;
  const edge = (x0: number, y0: number, x1: number, y1: number) => { const k = key(x0, y0); (next.get(k) ?? next.set(k, []).get(k)!).push(key(x1, y1)); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    if (!inside(x, y - 1)) edge(x + 1, y, x, y);
    if (!inside(x, y + 1)) edge(x, y + 1, x + 1, y + 1);
    if (!inside(x - 1, y)) edge(x, y, x, y + 1);
    if (!inside(x + 1, y)) edge(x + 1, y + 1, x + 1, y);
  }
  const loops: Pt[][] = [];
  for (const [start, list] of next) {
    while (list.length) {
      const loop: Pt[] = []; let at = start, to = list.pop()!;
      for (let guard = 0; guard < 4 * W * H + 8; guard++) {
        loop.push([at % (W + 1), Math.floor(at / (W + 1))]);
        at = to; if (at === start) break;
        const out = next.get(at)!; to = out.pop()!;
      }
      loops.push(loop);
    }
  }
  return loops;
}

const area = (p: Pt[]) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };

/** Pixel stairs softened: each vertex averaged with its neighbours (twice), so diagonals come out straight. */
export function smooth(p: Pt[]): Pt[] {
  let q = p;
  for (let pass = 0; pass < 2; pass++) q = q.map((v, i) => { const a = q[(i + q.length - 1) % q.length], b = q[(i + 1) % q.length]; return [(a[0] + 2 * v[0] + b[0]) / 4, (a[1] + 2 * v[1] + b[1]) / 4]; });
  return q;
}

/** Douglas–Peucker on a closed loop. */
export function simplify(p: Pt[], eps: number): Pt[] {
  if (p.length <= 4) return p;
  const seg = (a: Pt, b: Pt, c: Pt) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; if (!l) return Math.hypot(c[0] - a[0], c[1] - a[1]); const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / l)); return Math.hypot(c[0] - a[0] - t * dx, c[1] - a[1] - t * dy); };
  const run = (pts: Pt[]): Pt[] => {
    let idx = -1, d = eps;
    for (let i = 1; i < pts.length - 1; i++) { const di = seg(pts[0], pts[pts.length - 1], pts[i]); if (di > d) { d = di; idx = i; } }
    return idx < 0 ? [pts[0], pts[pts.length - 1]] : [...run(pts.slice(0, idx + 1)).slice(0, -1), ...run(pts.slice(idx))];
  };
  // Split at the point farthest from the first.
  let far = 0; p.forEach((q, i) => { if (Math.hypot(q[0] - p[0][0], q[1] - p[0][1]) > Math.hypot(p[far][0] - p[0][0], p[far][1] - p[0][1])) far = i; });
  const a = run(p.slice(0, far + 1)), b = run([...p.slice(far), p[0]]);
  const out = [...a.slice(0, -1), ...b.slice(0, -1)];
  // The split points are kept by construction; drop either when it lies on the line of its neighbours.
  for (let i = 0; i < out.length && out.length > 3; i++) {
    const prev = out[(i + out.length - 1) % out.length], nxt = out[(i + 1) % out.length];
    if (seg(prev, nxt, out[i]) <= eps && (i === 0 || out[i] === p[far])) out.splice(i--, 1);
  }
  return out.length >= 3 ? out : p;
}

function inPolygon(pt: Pt, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Regions (outer loops with their holes) of a mask, small specks dropped, at most ~`budget` points. */
export function regionsOf(mask: Uint8Array, W: number, H: number, budget = 500): TraceRegion[] {
  const m = mask.slice();
  for (let pass = 0; pass < 4; pass++) { const before = m.reduce((s, v) => s + v, 0); unpinch(m, W, H); if (m.reduce((s, v) => s + v, 0) === before) break; }
  const minArea = Math.max(6, W * H * 0.0015);
  const raw = traceLoops(m, W, H).filter(l => Math.abs(area(l)) >= minArea);
  for (let eps = 0.7; ; eps *= 1.4) {
    const loops = raw.map(l => simplify(smooth(l), eps)).filter(l => l.length >= 3 && Math.abs(area(l)) >= minArea);
    if (loops.reduce((s, l) => s + l.length, 0) > budget && eps < 6) continue;
    // With the inside on the left and y down, outer loops have negative shoelace area here.
    const outers = loops.filter(l => area(l) < 0), holes = loops.filter(l => area(l) > 0);
    // Largest first, so the smallest outer around a hole is the last match.
    const regions = outers.map(outer => ({ outer, holes: [] as Pt[][] })).sort((a, b) => Math.abs(area(b.outer)) - Math.abs(area(a.outer)));
    for (const h of holes) {
      const probe: Pt = [(h[0][0] + h[1][0]) / 2, (h[0][1] + h[1][1]) / 2];
      // The smallest outer around it.
      const owner = [...regions].reverse().find(r => inPolygon(probe, r.outer) || inPolygon(h[0], r.outer));
      owner?.holes.push(h);
    }
    return regions;
  }
}

/** The trace of an RGBA image. */
export function traceImage(data: ArrayLike<number>, width: number, height: number): ImageTrace {
  const { px, W, H } = downscale(data, width, height, TRACE_SIDE);
  const { mask, background } = foreground(px, W, H);
  const fg = new Uint8Array(mask.length); for (let i = 0; i < mask.length; i++) fg[i] = mask[i] ? 1 : 0;
  const total = fg.reduce((s, v) => s + v, 0);
  const layers: TraceLayer[] = [];
  if (!total) return { width: W, height: H, background, layers };
  layers.push({ id: 'silhouette', name: 'silhouette (the whole figure)', color: '#808080', areaFraction: 1, regions: regionsOf(fg, W, H) });
  // Colour layers: the drawn colours, plus enclosed background-coloured areas as their own colour.
  const colourMask = new Uint8Array(mask.length); for (let i = 0; i < mask.length; i++) colourMask[i] = mask[i] === 1 ? 1 : 0;
  const { centres, label } = palette(px, colourMask);
  const fills: { color: string; m: Uint8Array }[] = centres.map((c, k) => ({ color: hex(c), m: Uint8Array.from(label, v => v === k ? 1 : 0) }));
  const enclosed = Uint8Array.from(mask, v => v === 2 ? 1 : 0);
  if (enclosed.some(v => v)) {
    // Its own average colour (a cream muzzle on a white page is not white).
    const s = [0, 0, 0]; let n = 0;
    enclosed.forEach((v, i) => { if (v) { s[0] += px[i * 4]; s[1] += px[i * 4 + 1]; s[2] += px[i * 4 + 2]; n++; } });
    fills.push({ color: hex(s.map(v => v / n)), m: enclosed });
  }
  fills.map(f => ({ ...f, n: f.m.reduce((s, v) => s + v, 0) })).sort((a, b) => b.n - a.n).forEach(f => {
    const regions = regionsOf(f.m, W, H, 300);
    if (regions.length) layers.push({ id: `color${layers.length}`, name: `colour ${layers.length} (${f.color})`, color: f.color, areaFraction: Math.round(f.n / total * 1000) / 1000, regions });
  });
  return { width: W, height: H, background, layers };
}
