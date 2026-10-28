import { BarocssError } from '@barocss/cad/api';
import { booleanCurveRegions, CadNumericPolicy, isCurvedArrangementError, locateInRegion, type CurveRegion2, type CurveSegment2 } from '@barocss/cad';
import type { TrueTypeFont, TrueTypeGlyph, TrueTypePoint } from './trueType';

/** Internal, line-only approximation of one static TrueType scalar run. No document node is added. */
export type FontProfileErrorCode = 'FONT_PROFILE_INPUT' | 'FONT_PROFILE_BUDGET' | 'FONT_PROFILE_GEOMETRY' | 'FONT_PROFILE_TOPOLOGY';
export type FontProfileError = BarocssError & { readonly code: FontProfileErrorCode };
export interface FontProfileLine { readonly kind: 'line'; readonly start: [number, number] }
export interface FontProfileComponent { readonly outer: FontProfileLine[]; readonly holes: FontProfileLine[][] }
export interface FontProfileGlyph {
  readonly codePoint: number; readonly glyphId: number;
  readonly origin: [number, number]; readonly advance: number;
  readonly components: FontProfileComponent[];
}
export interface FontProfileRun { readonly advance: number; readonly glyphs: FontProfileGlyph[] }
export interface FontProfileOptions {
  /** Em height in CAD millimetres, not the ink bounding-box height. */
  readonly size: number;
  /** Requested quadratic-to-chord deviation in CAD millimetres. Never used to merge vertices. */
  readonly tolerance: number;
  /** Additional CAD millimetres between scalars; no trailing tracking is added. */
  readonly tracking?: number;
}

// Coordinate, line, loop, and area admission match the existing native loop profile.
const MAX_COORDINATE = CadNumericPolicy.coordinateAbs;
const MIN_LINE = 1e-4;
const MAX_LOOP = 1024;
const MAX_SCALARS = 256;
const MAX_CONTOURS = 4096;
const MAX_RAW_POINTS = 65536;
const MAX_GLYPH_SEGMENTS = 4096;
const MAX_RUN_SEGMENTS = 8192;
const MAX_PAIR_WORK = 1048576;
const MAX_DEPTH = 20;
const ROUND = 64 * Number.EPSILON;
type XY = [number, number];
type Line = Extract<CurveSegment2, { readonly kind: 'line' }>;
interface FlatEdge { a: XY; b: XY; control?: XY; error: number; hullError?: number }
interface Quadratic { a: XY; control: XY; b: XY; depth: number; uncertainty: number }
interface Work { raw: number; segments: number; output: number; pairs: number }

function fail(code: FontProfileErrorCode, message: string): never {
  throw new BarocssError(code, message, undefined, { source: 'font-profile' });
}
export function isFontProfileError(error: unknown): error is FontProfileError {
  return error instanceof BarocssError && error.details?.source === 'font-profile';
}
function coordinate(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE) fail('FONT_PROFILE_INPUT', 'A placed font coordinate exceeds the CAD modeling range.');
  return value;
}
function same(a: XY, b: XY): boolean { return a[0] === b[0] && a[1] === b[1]; }
function distance(a: XY, b: XY): number { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function midpoint(a: XY, b: XY): XY { return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5]; }
function scaleOf(a: XY, b: XY, c?: XY): number {
  return Math.max(1, Math.abs(a[0]), Math.abs(a[1]), Math.abs(b[0]), Math.abs(b[1]), c ? Math.abs(c[0]) : 0, c ? Math.abs(c[1]) : 0);
}
function placed(point: TrueTypePoint, scale: number, origin: number): XY {
  if (!point || typeof point.onCurve !== 'boolean' || !Number.isFinite(point.x) || !Number.isFinite(point.y)) fail('FONT_PROFILE_INPUT', 'An outline point is malformed.');
  return [coordinate(point.x * scale + origin), coordinate(point.y * scale)];
}
function emit(out: FlatEdge[], edge: FlatEdge, work: Work): void {
  if (distance(edge.a, edge.b) < MIN_LINE) fail('FONT_PROFILE_GEOMETRY', 'A flattened font edge is shorter than the native profile minimum.');
  if (out.length >= MAX_GLYPH_SEGMENTS || ++work.segments > MAX_RUN_SEGMENTS) fail('FONT_PROFILE_BUDGET', 'The font exceeds the fixed flattened-segment budget.');
  out.push(edge);
}
function flattenQuadratic(a: XY, control: XY, b: XY, tolerance: number, out: FlatEdge[], work: Work): void {
  if (same(a, control) && same(a, b)) return;
  const stack: Quadratic[] = [{ a, control, b, depth: 0, uncertainty: 0 }];
  while (stack.length) {
    const q = stack.pop()!, arithmetic = ROUND * scaleOf(q.a, q.b, q.control);
    // Q(t)-L(t) = t(1-t)(2C-A-B); this bounds distance to the finite chord, including overshoot.
    const deviation = Math.hypot(q.a[0] - 2 * q.control[0] + q.b[0], q.a[1] - 2 * q.control[1] + q.b[1]) * 0.25;
    const bound = deviation + 2 * q.uncertainty + arithmetic;
    if (bound <= tolerance && !same(q.a, q.b)) {
      emit(out, { a: q.a, b: q.b, control: q.control, error: bound, hullError: q.uncertainty }, work);
      continue;
    }
    if (q.depth >= MAX_DEPTH || stack.length + out.length + 2 > MAX_GLYPH_SEGMENTS) fail('FONT_PROFILE_BUDGET', 'The requested font flatness exceeds the fixed subdivision budget.');
    const ac = midpoint(q.a, q.control), cb = midpoint(q.control, q.b), middle = midpoint(ac, cb), depth = q.depth + 1;
    const uncertainty = q.uncertainty + arithmetic;
    if (same(q.a, middle) && same(middle, q.b)) fail('FONT_PROFILE_GEOMETRY', 'Quadratic subdivision cannot produce distinct CAD points.');
    stack.push({ a: middle, control: cb, b: q.b, depth, uncertainty });
    stack.push({ a: q.a, control: ac, b: middle, depth, uncertainty });
  }
}
function flattenContour(points: readonly TrueTypePoint[], scale: number, origin: number, tolerance: number, work: Work): FlatEdge[] {
  if (points.length < 2) fail('FONT_PROFILE_GEOMETRY', 'An ink contour needs at least two authored points.');
  if (points.length > MAX_RAW_POINTS || (work.raw += points.length) > MAX_RAW_POINTS) fail('FONT_PROFILE_BUDGET', 'The glyph exceeds the fixed outline-point budget.');
  const expanded: { point: XY; on: boolean }[] = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i], next = points[(i + 1) % points.length], p = placed(current, scale, origin), q = placed(next, scale, origin);
    expanded.push({ point: p, on: current.onCurve });
    // The cyclic last-to-first pair follows the same TrueType implied-midpoint rule.
    if (!current.onCurve && !next.onCurve) expanded.push({ point: midpoint(p, q), on: true });
  }
  let start = 0;
  while (!expanded[start].on) start++;
  const first = expanded[start].point, out: FlatEdge[] = [];
  let at = first, index = 1;
  while (index <= expanded.length) {
    const item = expanded[(start + index) % expanded.length];
    if (item.on) {
      if (!same(at, item.point)) emit(out, { a: at, b: item.point, error: 0 }, work);
      at = item.point; index++;
    } else {
      const end = expanded[(start + index + 1) % expanded.length];
      if (!end.on) fail('FONT_PROFILE_INPUT', 'Quadratic contour normalization failed.');
      flattenQuadratic(at, item.point, end.point, tolerance, out, work);
      at = end.point; index += 2;
    }
  }
  if (!same(at, first) || out.length < 3) fail('FONT_PROFILE_GEOMETRY', 'A flattened ink contour is degenerate.');
  return out;
}
function orientation(a: XY, b: XY, c: XY): number {
  const left = (b[0] - a[0]) * (c[1] - a[1]), right = (b[1] - a[1]) * (c[0] - a[0]);
  const cross = left - right, uncertainty = ROUND * (Math.abs(left) + Math.abs(right));
  return cross > uncertainty ? 1 : cross < -uncertainty ? -1 : 0;
}
function pointDistance(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
  const t = (p[0] - a[0]) * ux + (p[1] - a[1]) * uy;
  if (t <= 0) return distance(p, a);
  if (t >= length) return distance(p, b);
  return Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux);
}
function boxesApart(a: FlatEdge, b: FlatEdge, pad: number): boolean {
  return Math.min(a.a[0], a.b[0]) - Math.max(b.a[0], b.b[0]) > pad || Math.min(b.a[0], b.b[0]) - Math.max(a.a[0], a.b[0]) > pad
    || Math.min(a.a[1], a.b[1]) - Math.max(b.a[1], b.b[1]) > pad || Math.min(b.a[1], b.b[1]) - Math.max(a.a[1], a.b[1]) > pad;
}
function segmentDistance(a: FlatEdge, b: FlatEdge): number {
  const a0 = orientation(a.a, a.b, b.a), a1 = orientation(a.a, a.b, b.b), b0 = orientation(b.a, b.b, a.a), b1 = orientation(b.a, b.b, a.b);
  // An uncertain crossing is refused as contact, rather than guessed to be disjoint.
  if (a0 * a1 <= 0 && b0 * b1 <= 0) return 0;
  const measured = Math.min(pointDistance(a.a, b.a, b.b), pointDistance(a.b, b.a, b.b), pointDistance(b.a, a.a, a.b), pointDistance(b.b, a.a, a.b));
  return Math.max(0, measured - ROUND * Math.max(scaleOf(a.a, a.b), scaleOf(b.a, b.b)));
}
function sideOfJoin(point: XY, join: XY, nx: number, ny: number, side: number, uncertainty: number): boolean {
  if (same(point, join)) return uncertainty === 0;
  const x = (point[0] - join[0]) * nx, y = (point[1] - join[1]) * ny;
  return side * (x + y) > ROUND * (Math.abs(x) + Math.abs(y)) + 2 * uncertainty * Math.hypot(nx, ny);
}
function separatedJoin(before: FlatEdge, after: FlatEdge): boolean {
  if (!same(before.b, after.a)) return false;
  const join = before.b, left = distance(before.a, join), right = distance(join, after.b);
  const nx = (join[0] - before.a[0]) / left + (after.b[0] - join[0]) / right;
  const ny = (join[1] - before.a[1]) / left + (after.b[1] - join[1]) / right;
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || Math.hypot(nx, ny) <= ROUND) return false;
  const uncertainty = Math.max(before.hullError ?? 0, after.hullError ?? 0);
  return sideOfJoin(before.a, join, nx, ny, -1, uncertainty) && (!before.control || sideOfJoin(before.control, join, nx, ny, -1, uncertainty))
    && sideOfJoin(after.b, join, nx, ny, 1, uncertainty) && (!after.control || sideOfJoin(after.control, join, nx, ny, 1, uncertainty));
}
function checkRings(rings: readonly (readonly FlatEdge[])[], tolerance: number, work: Work): void {
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let i = 0; i < ring.length; i++) {
      if (!separatedJoin(ring[i], ring[(i + 1) % ring.length])) fail('FONT_PROFILE_TOPOLOGY', 'An adjacent outline join has an uncertain or retracing control hull.');
      for (let s = r; s < rings.length; s++) for (let j = s === r ? i + 1 : 0; j < rings[s].length; j++) {
        if (s === r && (j === i + 1 || i === 0 && j === ring.length - 1)) continue;
        if (++work.pairs > MAX_PAIR_WORK) fail('FONT_PROFILE_BUDGET', 'The font exceeds the fixed boundary-pair work budget.');
        const a = ring[i], b = rings[s][j], clearance = a.error + b.error + 2 * tolerance;
        if (!boxesApart(a, b, clearance) && segmentDistance(a, b) <= clearance) fail('FONT_PROFILE_TOPOLOGY', 'Outline crossing, contact, or insufficient clearance requires a smaller flatness or a different glyph.');
      }
    }
  }
}
function linesOf(ring: readonly FlatEdge[]): Line[] {
  const result: Line[] = [];
  for (let i = 0; i < ring.length; i++) result.push({ kind: 'line', a: ring[i].a, b: ring[i].b });
  return result;
}
function flatOutput(ring: readonly CurveSegment2[], positive: boolean, work: Work): { edges: FlatEdge[]; profile: FontProfileLine[] } {
  if (ring.length < 3) fail('FONT_PROFILE_GEOMETRY', 'A filled font boundary is degenerate.');
  if (ring.length > MAX_LOOP) fail('FONT_PROFILE_BUDGET', 'A filled font boundary exceeds the native loop budget.');
  const edges: FlatEdge[] = [], profile: FontProfileLine[] = [];
  let area = 0, scale = 1;
  const first = ring[0];
  if (first.kind !== 'line') fail('FONT_PROFILE_GEOMETRY', 'A flattened font boundary must contain only lines.');
  for (let i = 0; i < ring.length; i++) {
    const s = ring[i], next = ring[(i + 1) % ring.length];
    if (s.kind !== 'line' || next.kind !== 'line' || !same(s.b, next.a)) fail('FONT_PROFILE_TOPOLOGY', 'A filled font boundary is not exactly closed.');
    coordinate(s.a[0]); coordinate(s.a[1]); coordinate(s.b[0]); coordinate(s.b[1]);
    const a: XY = [s.a[0], s.a[1]], b: XY = [s.b[0], s.b[1]];
    if (distance(a, b) < MIN_LINE) fail('FONT_PROFILE_GEOMETRY', 'A filled font edge is shorter than the native profile minimum.');
    edges.push({ a, b, error: 0 }); profile.push({ kind: 'line', start: [a[0], a[1]] });
    area += (a[0] - first.a[0]) * (b[1] - first.a[1]) - (b[0] - first.a[0]) * (a[1] - first.a[1]);
    scale = Math.max(scale, Math.abs(a[0]), Math.abs(a[1]));
  }
  if ((positive ? area : -area) * 0.5 < 1e-9 * scale * scale) fail('FONT_PROFILE_GEOMETRY', 'A filled font boundary fails native area or orientation admission.');
  if ((work.output += profile.length) > MAX_RUN_SEGMENTS) fail('FONT_PROFILE_BUDGET', 'The font exceeds the fixed result-boundary budget.');
  return { edges, profile };
}
function componentsOf(glyph: TrueTypeGlyph, scale: number, origin: number, flatness: number, work: Work): FontProfileComponent[] {
  if (!Array.isArray(glyph.contours) || glyph.contours.length > MAX_CONTOURS) fail('FONT_PROFILE_BUDGET', 'The glyph exceeds the fixed contour budget.');
  if (!glyph.contours.length) return [];
  const rings: Line[][] = [], flattened: FlatEdge[][] = [];
  const glyphStart = work.segments;
  work.raw = 0;
  let coordinateScale = 1;
  for (let c = 0; c < glyph.contours.length; c++) {
    if (!Array.isArray(glyph.contours[c])) fail('FONT_PROFILE_INPUT', 'A glyph contour must be an array.');
    const flat = flattenContour(glyph.contours[c], scale, origin, flatness, work);
    if (work.segments - glyphStart > MAX_GLYPH_SEGMENTS) fail('FONT_PROFILE_BUDGET', 'The glyph exceeds the fixed flattened-segment budget.');
    for (let i = 0; i < flat.length; i++) coordinateScale = Math.max(coordinateScale, scaleOf(flat[i].a, flat[i].b));
    flattened.push(flat); rings.push(linesOf(flat));
  }
  const tolerance = Math.max(CadNumericPolicy.linearTolerance, CadNumericPolicy.relativeLinearTolerance * coordinateScale);
  // Flatness controls approximation; only the existing CAD tolerance controls arrangement vertex binding.
  checkRings(flattened, tolerance, work);
  let regions: CurveRegion2[];
  try { regions = booleanCurveRegions(rings, [], 'union', tolerance, false); }
  catch (error) {
    if (isCurvedArrangementError(error)) fail('FONT_PROFILE_TOPOLOGY', 'The flattened font arrangement could not form valid regions.');
    throw error;
  }
  if (!regions.length) fail('FONT_PROFILE_GEOMETRY', 'The glyph contours enclose no nonzero-fill material.');
  const result: FontProfileComponent[] = [], output: FlatEdge[][] = [];
  for (let r = 0; r < regions.length; r++) {
    const region = regions[r], outer = flatOutput(region.outer, true, work), holes: FontProfileLine[][] = [];
    output.push(outer.edges);
    for (let h = 0; h < region.holes.length; h++) {
      const hole = flatOutput(region.holes[h], false, work);
      const carrier: CurveRegion2 = { outer: region.outer, holes: [] };
      if (locateInRegion(hole.edges[0].a, carrier, tolerance) !== 'in') fail('FONT_PROFILE_TOPOLOGY', 'A filled font hole is not strictly inside its outer boundary.');
      for (let other = 0; other < h; other++) {
        const a = region.holes[other][0];
        if (a.kind !== 'line' || locateInRegion(hole.edges[0].a, { outer: region.holes[other], holes: [] }, tolerance) !== 'out'
          || locateInRegion(a.a, { outer: region.holes[h], holes: [] }, tolerance) !== 'out') fail('FONT_PROFILE_TOPOLOGY', 'Filled font holes overlap or nest within one component.');
      }
      holes.push(hole.profile); output.push(hole.edges);
    }
    result.push({ outer: outer.profile, holes });
  }
  checkRings(output, tolerance, work);
  for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
    const a = regions[i].outer[0], b = regions[j].outer[0];
    if (a.kind !== 'line' || b.kind !== 'line' || locateInRegion(a.a, regions[j], tolerance) !== 'out' || locateInRegion(b.a, regions[i], tolerance) !== 'out') fail('FONT_PROFILE_TOPOLOGY', 'Filled font components overlap or touch.');
  }
  return result;
}

/**
 * Returns per-glyph connected region profiles, preserving islands inside holes as separate components.
 * Input contours must pass the simple, separated-boundary guards. Adjacent control hulls must be
 * separable at their common endpoint. Composite overlap, contact, and uncertain
 * near-gaps are refused. This is a polygon approximation, not a native quadratic or topology certificate.
 * Unicode scalars are laid out without shaping, kerning, normalization, or hinting. Glyphs are not unioned.
 */
export function buildFontProfiles(font: TrueTypeFont, text: string, options: FontProfileOptions): FontProfileRun {
  if (!font || typeof font.glyph !== 'function' || !font.metrics || !Number.isFinite(font.metrics.unitsPerEm) || font.metrics.unitsPerEm <= 0) fail('FONT_PROFILE_INPUT', 'A parsed static TrueType font is required.');
  if (typeof text !== 'string' || !options || !Number.isFinite(options.size) || options.size <= 0 || options.size > MAX_COORDINATE) fail('FONT_PROFILE_INPUT', 'A bounded scalar string and a positive CAD em size are required.');
  const { size, tolerance } = options, tracking = options.tracking ?? 0;
  if (!Number.isFinite(tolerance) || tolerance < CadNumericPolicy.linearTolerance || tolerance > size / 8) fail('FONT_PROFILE_INPUT', 'Font flatness must be finite, at least the CAD linear floor, and at most one eighth of the em size.');
  if (!Number.isFinite(tracking) || Math.abs(tracking) > MAX_COORDINATE) fail('FONT_PROFILE_INPUT', 'Font tracking must be finite and inside the CAD modeling range.');
  if (text.length > 2 * MAX_SCALARS) fail('FONT_PROFILE_BUDGET', 'The font run exceeds the fixed scalar budget.');
  const glyphs: FontProfileGlyph[] = [], scale = size / font.metrics.unitsPerEm, work: Work = { raw: 0, segments: 0, output: 0, pairs: 0 };
  let origin = 0;
  for (let offset = 0; offset < text.length;) {
    const codePoint = text.codePointAt(offset)!;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff || codePoint < 0x20 || codePoint >= 0x7f && codePoint <= 0x9f) fail('FONT_PROFILE_INPUT', 'Only printable Unicode scalars are accepted in a single font run.');
    if (glyphs.length >= MAX_SCALARS) fail('FONT_PROFILE_BUDGET', 'The font run exceeds the fixed scalar budget.');
    if (glyphs.length) origin = coordinate(origin + tracking);
    const glyph = font.glyph(codePoint), advance = glyph.advance * scale;
    if (!Number.isSafeInteger(glyph.glyphId) || glyph.glyphId < 0 || !Number.isFinite(advance) || advance < 0) fail('FONT_PROFILE_INPUT', 'A glyph has invalid metrics.');
    const components = componentsOf(glyph, scale, origin, tolerance, work);
    glyphs.push({ codePoint, glyphId: glyph.glyphId, origin: [origin, 0], advance, components });
    origin = coordinate(origin + advance);
    offset += codePoint > 0xffff ? 2 : 1;
  }
  return { advance: origin, glyphs };
}
