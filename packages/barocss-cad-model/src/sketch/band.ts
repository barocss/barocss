// B1: the associative 2D band — the closed hull (a belt, a pulley run) round ≥ 2 convex construction shapes of a sketch, made exactly:
// every source is a convex loop of lines and ccw arcs, whose support function is, on each cone of outward directions, that of one
// "generator" (an arc's circle, or a vertex as a circle of radius 0); the hull is the upper envelope of the sources' support functions
// (+ the offset, which grows every generator's radius alike), so its outline is arcs of the winning generators joined by the common
// outer tangents where the winner changes. Closed-form crossings and support values, no sampling.
import type { LoopSegment, SketchBand, SketchNode } from '../engine/doc';
import type { SketchShape, SketchState } from './types';
import { loopOf, shapeNode } from './loops';
import { tagsOf, withIds } from './entityIds';
import { resolveSketchDims } from './reopen';
import { isRefusal, refusal } from '../engine/refusal';

type Params = Readonly<Record<string, number>>;
type P2 = [number, number];
type Segs = LoopSegment[];
/** The band's loops: the hull (`outer`; with a `width` the hull at offset + width) and, for a strip, the hull at the offset as `hole`; the side tags in the same order. */
export interface BandLoops { outer: Segs; hole?: Segs; tags: { outer: string[]; holes?: string[][] } }

const TAU = 2 * Math.PI, HALF = Math.PI / 2;
const MAX_SOURCES = 32, MAX_GENERATORS = 256;
const MIN_ARC = 0.01, MIN_LINE = 1e-4, MERGE = 1e-7, ANGLE = 1e-12, COORD = 10000;
const ONLY = 'A band sketch holds only the band and its construction sources: draw other shapes in their own sketch.';
const norm = (a: number) => { const t = a % TAU; return t < 0 ? t + TAU : t; };

/** One piece of a source's support function: on the cone of directions [a0, a0 + len] it is c·u + r (+ the offset). */
interface Gen { src: number; id: string; c: P2; r: number; a0: number; len: number }
/** A source: its label (the side id the band names it by), its loop made ccw as plain numbers, its sides' tags and its generators. */
interface Seg { arc: boolean; a: P2; c: P2; ccw: boolean }
interface Src { ref: string; gens: Gen[] }
interface Piece { g: Gen; a: number; b: number }

const num = (p: readonly unknown[]): P2 => [Number(p[0]), Number(p[1])];
function toSegs(loop: Segs): Seg[] | null {
  const out = loop.map((s): Seg => s.kind === 'arc' ? { arc: true, a: num(s.start), c: num(s.center), ccw: s.direction === 'ccw' } : { arc: false, a: num(s.start), c: [0, 0], ccw: true });
  return out.every(s => [...s.a, ...s.c].every(Number.isFinite)) ? out : null;
}
/** A loop's signed area (ccw positive): the chord polygon plus each arc's circular segment. */
function loopArea(segs: Seg[]): number {
  const n = segs.length;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const s = segs[i], e = segs[(i + 1) % n].a;
    a += (s.a[0] * e[1] - e[0] * s.a[1]) / 2;
    if (s.arc) {
      const as = Math.atan2(s.a[1] - s.c[1], s.a[0] - s.c[0]), ae = Math.atan2(e[1] - s.c[1], e[0] - s.c[0]), r = Math.hypot(s.a[0] - s.c[0], s.a[1] - s.c[1]);
      const sw = n === 1 ? TAU : norm(s.ccw ? ae - as : as - ae), t = s.ccw ? sw : -sw;
      a += r * r * (t - Math.sin(t)) / 2;
    }
  }
  return a;
}
/** The loop the other way round (each segment from the old one's end, arcs turning the other way). */
function reverseSegs(segs: Seg[]): Seg[] {
  const n = segs.length;
  return segs.map((_, j) => { const s = segs[n - 1 - j]; return { ...s, a: segs[(n - j) % n].a, ccw: s.arc ? !s.ccw : true }; });
}
/** The generators of a ccw loop; 'closed' when it is degenerate, 'convex' when it turns the wrong way anywhere or does not turn once round. */
function gensOf(src: number, segs: Seg[], tags: string[]): Gen[] | 'closed' | 'convex' {
  const n = segs.length, gens: Gen[] = [], ts: number[] = [], te: number[] = [];
  let turned = 0;
  for (let i = 0; i < n; i++) {
    const s = segs[i], e = segs[(i + 1) % n].a;
    if (s.arc) {
      if (!s.ccw) return 'convex';
      const r = Math.hypot(s.a[0] - s.c[0], s.a[1] - s.c[1]);
      if (!(r > 1e-9)) return 'closed';
      const as = Math.atan2(s.a[1] - s.c[1], s.a[0] - s.c[0]), ae = Math.atan2(e[1] - s.c[1], e[0] - s.c[0]), sweep = n === 1 ? TAU : norm(ae - as);
      if (sweep < ANGLE || (n > 1 && sweep > TAU - ANGLE)) return 'closed';
      gens.push({ src, id: tags[i], c: s.c, r, a0: norm(as), len: sweep });
      ts.push(as + HALF); te.push(as + sweep + HALF); turned += sweep;
    } else {
      const dx = e[0] - s.a[0], dy = e[1] - s.a[1];
      if (!(Math.hypot(dx, dy) > 1e-9)) return 'closed';
      const t = Math.atan2(dy, dx); ts.push(t); te.push(t);
    }
  }
  if (n > 1) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, cr = Math.sin(ts[j] - te[i]), dt = Math.cos(ts[j] - te[i]);
    if (cr < -1e-9 || (dt < 0 && cr < 1e-9)) return 'convex';
    const turn = Math.atan2(Math.max(cr, 0), dt);
    turned += turn;
    // (A vertex is a generator of radius 0 over the directions it turns through; a tangent joint turns through none.)
    if (turn > ANGLE) gens.push({ src, id: tags[j], c: segs[j].a, r: 0, a0: norm(te[i] - HALF), len: turn });
  }
  return Math.abs(turned - TAU) < 1e-6 ? gens : 'convex';
}
function sourceOf(shape: SketchShape, ref: string, k: number): Src | 'closed' | 'convex' {
  const node = shapeNode(shape);
  if (!node) return 'closed';
  const loop = loopOf(node), tags = tagsOf(shape, loop), raw = toSegs(loop);
  if (!tags || !raw || !raw.length) return 'closed';
  const flip = loopArea(raw) < 0, segs = flip ? reverseSegs(raw) : raw, g = gensOf(k, segs, flip ? [...tags].reverse() : tags);
  return typeof g === 'string' ? g : { ref, gens: g };
}

/** The generator active in direction t (the one whose cone holds it; the nearest when rounding leaves a gap). */
function genAt(gens: readonly Gen[], t: number): Gen {
  let best = gens[0], by = Infinity;
  for (const g of gens) {
    const o = norm(t - g.a0), ex = o <= g.len ? 0 : Math.min(o - g.len, TAU - o);
    if (ex < by) { by = ex; best = g; }
  }
  return best;
}
const supp = (g: Gen, t: number) => g.c[0] * Math.cos(t) + g.c[1] * Math.sin(t) + g.r;
const active = (g: Gen, t: number) => { const o = norm(t - g.a0); return o <= g.len + 1e-9 || o >= TAU - 1e-9; };
/** Sorted distinct angles in [0, 2π), those within 1e-12 merged (wrapping round). */
function breakpoints(angles: number[]): number[] {
  const s = angles.map(norm).sort((x, y) => x - y), out: number[] = [];
  for (const a of s) if (!out.length || a - out[out.length - 1] > ANGLE) out.push(a);
  if (out.length > 1 && out[0] + TAU - out[out.length - 1] <= ANGLE) out.pop();
  return out;
}
/** The maximum over [t0, t1] of wx·cos t + wy·sin t + K (closed form: the peak if inside, else an end). */
function maxTerm(wx: number, wy: number, K: number, t0: number, t1: number): number {
  const phi = Math.atan2(wy, wx), at = (t: number) => wx * Math.cos(t) + wy * Math.sin(t) + K;
  return norm(phi - t0) <= t1 - t0 ? Math.hypot(wx, wy) + K : Math.max(at(t0), at(t1));
}
const spanOf = (bp: number[], i: number): [number, number] => [bp[i], i + 1 < bp.length ? bp[i + 1] : bp[0] + TAU];
/** The distance between two sources (d = 0): max over u of −h_A(u) − h_B(−u); negative when they overlap. */
function separation(A: Src, B: Src): number {
  const bp = breakpoints([...A.gens.map(g => g.a0), ...B.gens.map(g => g.a0 + Math.PI)]);
  let best = -Infinity;
  for (let i = 0; i < bp.length; i++) {
    const [t0, t1] = spanOf(bp, i), mid = (t0 + t1) / 2, ga = genAt(A.gens, mid), gb = genAt(B.gens, mid + Math.PI);
    best = Math.max(best, maxTerm(gb.c[0] - ga.c[0], gb.c[1] - ga.c[1], -ga.r - gb.r, t0, t1));
  }
  return best;
}
/** max over directions of h_X − h_Y (≤ 0: X lies inside Y). */
function excess(X: Src, Y: Src): number {
  const bp = breakpoints([...X.gens.map(g => g.a0), ...Y.gens.map(g => g.a0)]);
  let best = -Infinity;
  for (let i = 0; i < bp.length; i++) {
    const [t0, t1] = spanOf(bp, i), mid = (t0 + t1) / 2, gx = genAt(X.gens, mid), gy = genAt(Y.gens, mid);
    best = Math.max(best, maxTerm(gx.c[0] - gy.c[0], gx.c[1] - gy.c[1], gx.r - gy.r, t0, t1));
  }
  return best;
}
function pairProblem(srcs: Src[], scale: number): string | null {
  for (let i = 0; i < srcs.length; i++) for (let j = i + 1; j < srcs.length; j++) {
    const A = srcs[i], B = srcs[j];
    if (excess(B, A) <= 1e-9 * scale) return `source ${B.ref} lies inside ${A.ref}`;
    if (excess(A, B) <= 1e-9 * scale) return `source ${A.ref} lies inside ${B.ref}`;
    const d = separation(A, B);
    if (d < 0) return `sources ${A.ref} and ${B.ref} overlap`;
    if (d < MIN_LINE) return `sources ${A.ref} and ${B.ref} touch or are closer than 0.0001 mm`;
  }
  return null;
}

/** The upper envelope of the sources' support functions: the generator winning each interval of directions, in order round the circle (the winners do not depend on the offset). */
function envelope(srcs: Src[]): Piece[] | string {
  const all = srcs.flatMap(s => s.gens), cand: number[] = [];
  for (const g of all) cand.push(g.a0, g.a0 + g.len);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const g = all[i], k = all[j];
    if (g.src === k.src) continue;
    const dx = g.c[0] - k.c[0], dy = g.c[1] - k.c[1], D = Math.hypot(dx, dy);
    if (D < 1e-12) continue;
    const q = (k.r - g.r) / D;
    if (Math.abs(q) > 1 + 1e-12) continue;
    const phi = Math.atan2(dy, dx), da = Math.acos(Math.max(-1, Math.min(1, q)));
    for (const t of [phi + da, phi - da]) if (active(g, t) && active(k, t)) cand.push(t);
  }
  const bp = breakpoints(cand), items: Piece[] = [];
  for (let i = 0; i < bp.length; i++) {
    const [t0, t1] = spanOf(bp, i), mid = (t0 + t1) / 2, last = items[items.length - 1];
    // (An interval narrower than rounding is the neighbour's. A tie goes to the lower source: two sources cannot share outline, the separation check refuses that.)
    if (t1 - t0 < ANGLE) { if (last) last.b = t1; continue; }
    let bg: Gen | null = null, bh = -Infinity;
    for (let k = 0; k < srcs.length; k++) {
      const g = genAt(srcs[k].gens, mid), h = supp(g, mid);
      if (h > bh) { bh = h; bg = g; }
    }
    if (last && last.g === bg) last.b = t1; else items.push({ g: bg!, a: t0, b: t1 });
  }
  if (items.length > 1 && items[0].g === items[items.length - 1].g) {
    const first = items[0], last = items[items.length - 1];
    items.splice(0, 1); items[items.length - 1] = { g: last.g, a: last.a, b: first.b + TAU };
  }
  const won = new Set(items.map(p => p.g.src));
  if (items.length < 2 || won.size < 2) return 'one source encloses the others';
  for (let k = 0; k < srcs.length; k++) if (!won.has(k)) return `source ${srcs[k].ref} does not reach the band's outline (no tangent): remove it from the band`;
  return items;
}

const at = (g: Gen, t: number, d: number): P2 => { const rho = g.r + d; return [g.c[0] + rho * Math.cos(t), g.c[1] + rho * Math.sin(t)]; };
/** The hull at offset d as a loop with its side tags: arcs of the winners joined by common outer tangents. */
function hullLoop(items: Piece[], d: number, id: string, L: string): { segs: Segs; tags: string[] } | string {
  const m = items.length, segs: Segs = [], tags: string[] = [], prevs: string[] = [], S: P2[] = [], E: P2[] = [], arc: boolean[] = [];
  for (let j = 0; j < m; j++) {
    const { g, a, b } = items[j], rho = g.r + d, wide = rho > 0 && rho * (b - a) >= MIN_LINE;
    arc.push(wide);
    if (wide) {
      if (rho < MIN_ARC) return `an arc of radius ${Number(rho.toPrecision(6))} mm is smaller than ${MIN_ARC} mm: use an offset of 0 or at least ${MIN_ARC}`;
      S.push(at(g, a, d)); E.push(at(g, b, d));
    } else { const p = at(g, rho > 0 ? (a + b) / 2 : 0, d); S.push(p); E.push(p); }
    if (Math.max(Math.abs(g.c[0]), Math.abs(g.c[1])) + rho > COORD) return `its outline goes beyond ±${COORD} mm`;
  }
  for (let j = 0; j < m; j++) {
    const g = items[j].g, h = items[(j + 1) % m].g;
    const p = items[(j + m - 1) % m].g;
    if (arc[j]) { segs.push({ kind: 'arc', start: S[j], center: g.c, direction: 'ccw' }); tags.push(`${id}${L}_${g.id}`); prevs.push(p.id); }
    const T = S[(j + 1) % m], len = Math.hypot(E[j][0] - T[0], E[j][1] - T[1]);
    if (len <= MERGE) continue;
    if (len < MIN_LINE) return g.src === h.src ? 'a source has an edge shorter than 0.0001 mm' : 'the tangent points of two sources are closer than 0.0001 mm (a coincident tangent)';
    segs.push({ kind: 'line', start: E[j] }); tags.push(`${id}${L}_${g.id}_${h.id}`); prevs.push(p.id);
  }
  if (segs.length < 3) return 'the sources make no closed outline';
  // (The same piece repeated — a source winning twice — is named also by the generator before it, after a `-` (so the name is no other side's): two disjoint convex sources cannot alternate a-b-a-b, so that pair is unique and, unlike a count from where the loop starts, moves with the piece.)
  const count = new Map<string, number>();
  for (const t of tags) count.set(t, (count.get(t) ?? 0) + 1);
  const named = tags.map((t, i) => count.get(t)! < 2 ? t : `${t}-${prevs[i]}`);
  if (new Set(named).size < named.length) return 'two sides of the outline cannot be told apart by name: move the sources apart';
  if (named.some(t => !/^[A-Za-z0-9_-]{1,32}$/.test(t))) return 'a side name is longer than 32 characters: shorten the sketch ids';
  return { segs, tags: named };
}

/** Resolves the band's references to the construction shapes holding them, as sources; or says why not. */
function sourcesOf(shapes: readonly SketchShape[], refs: readonly unknown[]): Src[] | string {
  const used = new Map<number, string>(), srcs: Src[] = [];
  for (let k = 0; k < refs.length; k++) {
    const ref = refs[k];
    const holders = typeof ref === 'string' ? shapes.flatMap((s, i) => s.construction && s.ids?.includes(ref) ? [i] : []) : [];
    if (!holders.length) return `source ${String(ref)} is not in the sketch (deleted, or no longer construction); pick the sources again`;
    if (holders.length > 1) return `source ${ref} is ambiguous (two construction shapes carry it); pick the sources again`;
    const prev = used.get(holders[0]);
    if (prev !== undefined) return `sources ${prev} and ${ref} are sides of the same shape`;
    used.set(holders[0], ref as string);
    let s: ReturnType<typeof sourceOf>;
    // (A file edited by hand can hold a shape without its numbers: that is a refusal, not a crash.)
    try { s = sourceOf(shapes[holders[0]], ref as string, k); } catch (e) {
      if (e instanceof TypeError) return `source ${ref} is malformed`;
      throw e;
    }
    if (s === 'closed') return `source ${ref} is not a closed shape`;
    if (s === 'convex') return `source ${ref} is not convex (v1 bands wrap convex shapes only)`;
    srcs.push(s);
  }
  return srcs;
}

/**
 * The band's loops from the sketch's shapes (numbers, or with `params` for `{ parameter }` values) or the reason it cannot be made,
 * named like "Sketch 2 band b1: …" (`index`: that sketch's index; without it "Sketch band b1: …").
 */
export function bandLoops(shapes: readonly SketchShape[], band: SketchBand, params: Params = {}, index?: number): BandLoops | { error: string } {
  const pre = `${index === undefined ? 'Sketch' : `Sketch ${index + 1}`} band ${band?.id ?? 'b1'}: `, fail = (m: string) => ({ error: pre + m });
  let r: { band: SketchBand; construction: SketchShape[] };
  try { r = resolveSketchDims({ kind: 'sketch', profile: 'band', band, construction: [...shapes] } as SketchNode, params) as never; } catch (e) {
    if (isRefusal(e, 'PARAMETER_UNKNOWN')) return fail(e.message.replace(/^\[\w+\] /, ''));
    throw e;
  }
  const b = r.band;
  if (!b || typeof b !== 'object') return fail('band data is missing');
  const d = b.offset ?? 0, w = b.width;
  if (!Array.isArray(b.sources) || b.sources.length < 2) return fail('pick at least two sources');
  if (b.sources.length > MAX_SOURCES) return fail(`a band wraps at most ${MAX_SOURCES} sources`);
  if (typeof d !== 'number' || !Number.isFinite(d) || d < 0) return fail('the offset must be a finite number, 0 or more');
  if (w !== undefined && (typeof w !== 'number' || !Number.isFinite(w) || w <= 0)) return fail('the width must be a finite number above 0');
  if (w !== undefined && w < MIN_ARC) return fail(`a strip must be at least ${MIN_ARC} mm wide`);
  const srcs = sourcesOf(r.construction.filter(s => s && typeof s === 'object'), b.sources);
  if (typeof srcs === 'string') return fail(srcs);
  if (srcs.reduce((n, s) => n + s.gens.length, 0) > MAX_GENERATORS) return fail(`the sources have more than ${MAX_GENERATORS} arcs and corners`);
  const scale = Math.max(1, ...srcs.flatMap(s => s.gens.map(g => Math.max(Math.abs(g.c[0]), Math.abs(g.c[1])) + g.r)));
  const problem = pairProblem(srcs, scale);
  if (problem) return fail(problem);
  const items = envelope(srcs);
  if (typeof items === 'string') return fail(items);
  const outer = hullLoop(items, w === undefined ? d : d + w, b.id, w === undefined ? '' : 'o');
  if (typeof outer === 'string') return fail(outer);
  if (w === undefined) return { outer: outer.segs, tags: { outer: outer.tags } };
  const inner = hullLoop(items, d, b.id, 'i');
  if (typeof inner === 'string') return fail(inner);
  return { outer: outer.segs, hole: inner.segs, tags: { outer: outer.tags, holes: [inner.tags] } };
}

/**
 * A band sketch node as the plain loop sketch it makes, from its construction sources (parameters resolved with `params`): the
 * outline (with a width, the strip's hole), its side tags and the node's plane and placement; refused (a thrown refusal) when it
 * cannot be made. Any other node is returned as it is.
 */
export function bandProfile(node: SketchNode, params: Params = {}, index?: number): SketchNode {
  if (node.profile !== 'band') return node;
  const pre = index === undefined ? 'Sketch' : `Sketch ${index + 1}`;
  if (node.association !== undefined) throw refusal('VALUE', `${pre} band ${node.band?.id ?? 'b1'}: a band in a linked sketch is not supported`);
  if (node.regions?.length || node.holes?.length) throw refusal('VALUE', ONLY);
  if (!node.band || typeof node.band !== 'object') throw refusal('VALUE', `${pre}: band data is missing`);
  let v: SketchNode;
  try { v = resolveSketchDims(node, params); } catch (e) {
    if (index === undefined || !isRefusal(e, 'PARAMETER_UNKNOWN')) throw e;
    throw refusal('PARAMETER_UNKNOWN', e.message.replace(/^\[\w+\] the sketch/, pre));
  }
  const band = (v as Extract<SketchNode, { profile: 'band' }>).band;
  const r = bandLoops((v.construction ?? []) as SketchShape[], band, {}, index);
  if ('error' in r) throw refusal('VALUE', r.error);
  const rest: Record<string, unknown> = { ...v };
  delete rest.band; delete rest.outline; delete rest.regions;
  return { ...rest, kind: 'sketch', profile: 'loop', segments: r.outer, ...(r.hole ? { holes: [r.hole] } : {}), sideTags: r.tags } as SketchNode;
}

/** The sketch's closed shapes in the order the band tool numbers them: the current shape, then the finished ones. */
export const bandShapes = (s: SketchState): SketchShape[] => [...(s.shape ? [s.shape] : []), ...(s.done ?? [])];

/** The shape at `index` of `bandShapes(s)` picked, or unpicked when it was (by its first side id, which the shape gets here when it has none yet). */
export function toggleBandPick(s: SketchState, index: number): SketchState {
  const all = withIds(bandShapes(s)), shape = all[index];
  if (!shape?.ids?.length || !shapeNode(shape) || s.band) return s;
  const id = shape.ids[0], picks = s.bandPicks ?? [];
  // (The shapes keep the ids just given, so the picks stay attached to them and the picked ones can be drawn as picked.)
  const ided = s.shape ? { shape: all[0], done: all.slice(1) } : { shape: null, done: all };
  return { ...s, ...ided, bandPicks: picks.includes(id) ? picks.filter(x => x !== id) : [...picks, id] };
}

/**
 * The picked shapes (`bandPicks`) made the band's sources: they become construction and every shape gets its side ids, so
 * the band can name them. Refused when it has fewer than two, or the band cannot be made from them (the reason is returned).
 */
export function makeBand(s: SketchState, offset: number, width?: number): { state: SketchState } | { error: string } {
  if (s.band) return { error: 'This sketch already has a band: remove it first.' };
  const picks = s.bandPicks ?? [];
  if (picks.length < 2) return { error: 'Pick at least two closed shapes for the band.' };
  const all = withIds(bandShapes(s)).map(x => x.ids?.[0] !== undefined && picks.includes(x.ids[0]) ? { ...x, construction: true as const } : x);
  const band: SketchBand = { version: 1, id: 'b1', sources: [...picks], ...(offset ? { offset } : {}), ...(width === undefined ? {} : { width }) };
  const r = bandLoops(all, band);
  if ('error' in r) return { error: r.error };
  const state: SketchState = { ...s, shape: s.shape ? all[0] : null, done: s.shape ? all.slice(1) : all, band };
  delete state.bandPicks;
  return { state };
}

/** The band's loops now, from the state's shapes: for drawing it; the reason when it cannot be made; null without a band. */
export function liveBand(s: SketchState): { outer: Segs; hole?: Segs } | { error: string } | null {
  if (!s.band) return null;
  const r = bandLoops(bandShapes(s), s.band);
  return 'error' in r ? r : { outer: r.outer, ...(r.hole ? { hole: r.hole } : {}) };
}

/**
 * Finish of a band sketch: the sketch node holding the band and its construction sources (every shape given its ids,
 * construction included), or the reason it cannot be made. Any other closed shape is refused (v1: one band per sketch).
 */
export function bandSketchNode(shapes: readonly SketchShape[], band: SketchBand): { node: SketchNode } | { error: string } {
  const all = withIds(shapes);
  if (all.some(s => !s.construction && s.kind !== 'bezier' && shapeNode(s))) return { error: ONLY };
  const r = bandLoops(all, band);
  if ('error' in r) return { error: r.error };
  return { node: { kind: 'sketch', profile: 'band', band: structuredClone(band), construction: all.filter(s => s.construction || s.kind === 'bezier') } };
}
