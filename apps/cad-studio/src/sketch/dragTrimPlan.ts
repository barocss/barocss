import { CadNumericPolicy } from '@barocss/cad';
import { cornersOf, nextIdOf, withIds } from '@barocss/cad-model/sketch/entityIds';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import { trimAt, trimPreview } from '@barocss/cad-model/sketch/trim';
import type { SketchShape } from '@barocss/cad-model/sketch/types';

export const DRAG_TRIM_MAX_PATH_POINTS = 256;
const maxPieces = 64, maxCuts = 3;
const { coordinateAbs, linearTolerance } = CadNumericPolicy;
const arithmeticTolerance = 32 * Number.EPSILON * coordinateAbs;
// Trim stores endpoints at 1e-6 mm and joins open ends within 1e-4 mm.
const storedTolerance = 1e-6, safeSeparation = 1e-4 + 2 * storedTolerance;
// Near-parallel directions amplify signed-distance error at the intersection.
const minimumCrossingSine = 4 * arithmeticTolerance / storedTolerance;
const ambiguous = 'Drag Trim needs an unambiguous crossing away from line ends and cutting boundaries.';
const unsupported = 'Drag Trim supports independent straight open lines without dimensions or constraints.';
const twoBoundaries = 'Drag Trim needs two distinct cutting boundaries inside each crossed line.';
const budget = 'Drag Trim supports up to three intervals in a bounded straight sketch.';
const sideIds = 'Drag Trim needs unique sketch side IDs.';

type OpenLine = Extract<SketchShape, { kind: 'polygon' }>;
type Interval = readonly [P2, P2];
type Line = { shape: SketchShape; a: P2; b: P2; direction: P2; length: number };
type Hit = { line: Line; station: number; travel: number };
type Path = { points: P2[]; travel: number[] };

const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const dot = (a: P2, b: P2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: P2, b: P2) => a[0] * b[1] - a[1] * b[0];
const distance = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const inRange = (p: P2) => p.every(x => Number.isFinite(x) && Math.abs(x) <= coordinateAbs);
const at = (line: Line, station: number): P2 => [line.a[0] + line.direction[0] * station, line.a[1] + line.direction[1] * station];
const round = (p: P2): P2 => p.map(x => Math.round(x * 1e6) / 1e6 || 0) as P2;
const position = (line: Line, p: P2) => dot(line.direction, sub(p, line.a));
const side = (line: Line, p: P2) => cross(line.direction, sub(p, line.a));
const sideSign = (side: number) => Math.abs(side) <= arithmeticTolerance ? 0 : Math.sign(side);
const failure = (error: string) => ({ error });

function pathOf(samples: readonly P2[]): Path {
  const points: P2[] = [];
  for (const point of samples) {
    const previous = points.at(-1);
    if (previous && distance(previous, point) === 0) continue;
    // Subdivision along the same forward segment has no effect on crossing order.
    while (points.length > 1) {
      const a = points[points.length - 2], b = points[points.length - 1];
      const first = sub(b, a), second = sub(point, b), whole = distance(a, point);
      if (dot(first, second) <= 0 || Math.abs(cross(first, second)) > arithmeticTolerance * whole) break;
      points.pop();
    }
    points.push(point);
  }
  const travel = [0];
  for (let i = 1; i < points.length; i++) travel.push(travel[i - 1] + distance(points[i - 1], points[i]));
  return { points, travel };
}

function linesOf(shapes: readonly SketchShape[]): Line[] | { error: string } {
  const lines: Line[] = [];
  for (const shape of shapes) {
    if (shape.kind !== 'rectangle' && shape.kind !== 'polygon') return failure(unsupported);
    const count = shape.kind === 'rectangle' ? 4 : shape.points.length;
    if (count < 2 || count > maxPieces + 1 || (shape.ids?.length ?? 0) > count) return failure(budget);
    if (shape.kind === 'polygon' && (shape.pending || shape.fromSpline || shape.spline || shape.fromEllipse || shape.ellipse
      || shape.circles?.length || shape.circleIds?.length || (shape.bulges?.length ?? 0) > count
      || shape.bulges?.some(value => value !== 0))) return failure(unsupported);
    const corners = cornersOf(shape)!;
    if (!corners.every(inRange)) return failure('Drag Trim needs finite sketch coordinates within the supported range.');
    const closed = shape.kind === 'rectangle' || shape.closed;
    for (let i = 0; i < (closed ? count : count - 1); i++) {
      const a = corners[i], b = corners[(i + 1) % count], delta = sub(b, a), length = Math.hypot(...delta);
      if (!(length > linearTolerance)) return failure(unsupported);
      lines.push({ shape, a, b, length, direction: [delta[0] / length, delta[1] / length] });
      if (lines.length > maxPieces) return failure(budget);
    }
  }
  return lines;
}

function isTarget(shape: SketchShape): shape is OpenLine {
  return shape.kind === 'polygon' && !shape.closed && shape.points.length === 2 && !shape.fromRectangle
    && !shape.rules?.length && !shape.tangents?.length && !shape.equalRadii?.length && !shape.concentric?.length
    && !Object.keys(shape.lengths ?? {}).length && !Object.keys(shape.radii ?? {}).length
    && !shape.hv?.h.length && !shape.hv?.v.length;
}

function idsOf(shapes: readonly SketchShape[]): Set<string> | null {
  const ids = new Set<string>();
  for (const shape of shapes) {
    const circles = shape.kind === 'polygon' ? shape.circleIds : undefined;
    for (const list of [shape.ids, circles]) {
      if (list === undefined) continue;
      if (!Array.isArray(list)) return null;
      for (const id of list) {
        if (typeof id !== 'string' || !/^e(?:0|[1-9]\d*)$/.test(id)
          || Number(id.slice(1)) > Number.MAX_SAFE_INTEGER - 2 * maxCuts - 1 || ids.has(id)) return null;
        ids.add(id);
      }
    }
  }
  return ids;
}

/** Crossings on the continuous recorded path, including an interior sample exactly on the line. */
function crossings(line: Line, path: Path): Hit[] | { error: string } {
  const { points, travel } = path;
  const sides = points.map(p => side(line, p)), signs = sides.map(sideSign), hits: Hit[] = [];
  const add = (i: number, t: number) => {
    const a = points[i], b = points[i + 1], span = distance(a, b);
    const q: P2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const station = position(line, q);
    if (station < -linearTolerance || station > line.length + linearTolerance) return true;
    if (station <= linearTolerance || station >= line.length - linearTolerance
      || Math.abs(sides[i + 1] - sides[i]) <= minimumCrossingSine * span) return false;
    hits.push({ line, station, travel: travel[i] + t * span });
    return true;
  };
  for (let i = 0; i < points.length;) {
    if (signs[i]) {
      if (signs[i + 1] === -signs[i] && !add(i, sides[i] / (sides[i] - sides[i + 1]))) return failure(ambiguous);
      i++;
      continue;
    }
    const start = i;
    let lo = position(line, points[i]), hi = lo;
    while (++i < points.length && signs[i] === 0) {
      const station = position(line, points[i]);
      lo = Math.min(lo, station); hi = Math.max(hi, station);
    }
    if (hi < -linearTolerance || lo > line.length + linearTolerance) continue;
    if (i !== start + 1 || start === 0 || i === points.length || signs[start - 1] === signs[i]) return failure(ambiguous);
    const segment = sides[start] * signs[start - 1] > 0 ? start : start - 1;
    if (!add(segment, sides[segment] / (sides[segment] - sides[segment + 1]))) return failure(ambiguous);
  }
  return hits;
}

function intervalOf(hit: Hit, lines: readonly Line[]): Interval | { error: string } {
  const { line, station } = hit, cuts: number[] = [];
  for (const boundary of lines) {
    if (boundary.shape === line.shape) continue;
    const a = side(line, boundary.a), b = side(line, boundary.b), sa = sideSign(a), sb = sideSign(b);
    if (!sa && !sb) {
      const p = position(line, boundary.a), q = position(line, boundary.b);
      if (Math.min(line.length, Math.max(p, q)) - Math.max(0, Math.min(p, q)) > linearTolerance) return failure(ambiguous);
      continue;
    }
    if (sa === sb) continue;
    const t = a / (a - b);
    const u = position(line, at(boundary, t * boundary.length));
    // Keep the same interior-cut range as Model Trim, then require rounded remnants to stay separate.
    if (u <= line.length * 1e-7 || u >= line.length * (1 - 1e-7)) continue;
    if (!sa || !sb || Math.abs(a - b) <= minimumCrossingSine * boundary.length) return failure(ambiguous);
    cuts.push(u);
  }
  cuts.sort((a, b) => a - b);
  if (cuts.some((cut, i) => Math.abs(cut - station) <= storedTolerance || (i > 0 && cut - cuts[i - 1] <= storedTolerance))) return failure(ambiguous);
  const highIndex = cuts.findIndex(cut => cut > station);
  const low = cuts[highIndex - 1], high = cuts[highIndex];
  if (low === undefined || high === undefined || low <= safeSeparation || line.length - high <= safeSeparation || high - low <= safeSeparation) {
    return failure(twoBoundaries);
  }
  return [round(at(line, low)), round(at(line, high))];
}

function sameInterval(a: Interval, b: readonly P2[]) {
  return b.length === 2 && a.every((point, i) => distance(point, b[i]) < storedTolerance / 2);
}

function isRetained(shape: SketchShape, a: P2, b: P2, construction: boolean) {
  return shape.kind === 'polygon' && !shape.closed && !!shape.construction === construction && shape.points.length === 2
    && distance(shape.points[0], a) === 0 && distance(shape.points[1], b) === 0 && shape.ids?.length === 2;
}

/** Plan all cuts against one owned scene, then replay them through the ordinary Model Trim. */
export function planDragTrim(shapes: SketchShape[], path: readonly P2[], protectedShapes?: ReadonlySet<SketchShape>):
  { shapes: SketchShape[]; intervals: readonly Interval[] } | { error: string } {
  if (path.length > DRAG_TRIM_MAX_PATH_POINTS || shapes.length > maxPieces) return failure(budget);
  if (!path.every(inRange)) return failure('Drag Trim needs finite sketch coordinates within the supported range.');
  const stroke = pathOf(path);
  if (stroke.points.length < 2) return { shapes, intervals: [] };
  const lines = linesOf(shapes);
  if ('error' in lines) return lines;
  const hits: Hit[] = [];
  for (const line of lines) {
    if (protectedShapes?.has(line.shape)) continue;
    const found = crossings(line, stroke);
    if ('error' in found) return found;
    hits.push(...found);
  }
  if (!hits.length) return { shapes, intervals: [] };
  hits.sort((a, b) => a.travel - b.travel);
  if (hits.some((hit, i) => i > 0 && hit.line.shape !== hits[i - 1].line.shape && hit.travel - hits[i - 1].travel <= linearTolerance)) return failure(ambiguous);

  const ids = idsOf(shapes), visited = new Set<OpenLine>();
  if (!ids) return failure(sideIds);
  if (new Set(shapes).size !== shapes.length) return failure(ambiguous);
  const cuts: { hit: Hit; target: OpenLine; interval: Interval }[] = [];
  for (const hit of hits) {
    const target = hit.line.shape;
    if (!isTarget(target)) return failure(unsupported);
    if (target.ids !== undefined && target.ids.length !== 2) return failure(sideIds);
    if (visited.has(target)) continue;
    visited.add(target);
    if (visited.size > maxCuts) return failure(budget);
    const interval = intervalOf(hit, lines);
    if ('error' in interval) return interval;
    cuts.push({ hit, target, interval });
  }

  // Each cut needs two endpoint IDs. A fresh target needs two more for its original ends.
  const requiredIds = cuts.reduce((count, { target }) => count + (target.ids === undefined ? 4 : 2), 0);
  if (nextIdOf(shapes) > Number.MAX_SAFE_INTEGER - requiredIds) return failure(sideIds);

  let draft = shapes;
  for (const { hit, target, interval } of cuts) {
    const index = draft.indexOf(target);
    if (index < 0) return failure(ambiguous);
    const current = linesOf(draft);
    if ('error' in current) return current;
    const witness = intervalOf(hit, current);
    if ('error' in witness || !sameInterval(interval, witness)) return failure(twoBoundaries);

    // Seed only the crossed fresh target, so Model Trim allocates its cut IDs after the inherited ends.
    const editable = target.ids === undefined ? withIds([target], nextIdOf(draft))[0] : target;
    const ends = editable.ids;
    if (!ends || ends.length !== 2) return failure(sideIds);
    if (editable !== target) {
      if (ends[0] === ends[1] || ends.some(id => ids.has(id))) return failure(sideIds);
      ends.forEach(id => ids.add(id));
      draft = draft.map((shape, i) => i === index ? editable : shape);
    }

    // Other shapes still supply crossing boundaries. They cannot be picked, joined, or assigned IDs.
    const locked = new Set(draft.filter(shape => shape !== editable));
    const query = at(hit.line, hit.station), preview = trimPreview(draft, query, linearTolerance, locked);
    if (!preview || !sameInterval(interval, preview)) return failure(ambiguous);
    const result = trimAt(draft, query, linearTolerance, locked);
    if ('error' in result) return result;
    const [head, tail] = result.shapes.slice(index, index + 2);
    if (result.shapes.length !== draft.length + 1
      || draft.some((shape, i) => i !== index && result.shapes[i + Number(i > index)] !== shape)
      || !head || !tail || !isRetained(head, hit.line.a, interval[0], !!target.construction)
      || !isRetained(tail, interval[1], hit.line.b, !!target.construction)
      || head.ids![0] !== ends[0] || tail.ids![1] !== ends[1]
      || ids.has(head.ids![1]) || ids.has(tail.ids![0]) || head.ids![1] === tail.ids![0]) return failure(ambiguous);
    ids.add(head.ids![1]); ids.add(tail.ids![0]);
    draft = result.shapes;
  }
  return { shapes: draft, intervals: cuts.map(cut => cut.interval) };
}
