import { CadNumericPolicy } from '@barocss/cad';
import { arcOf, type Arc, type P2 } from '../profile';
import type { SketchShape } from '../types';

type Polygon = Extract<SketchShape, { kind: 'polygon' }>;
type Direction = 1 | -1;
type Carrier = { anchor: P2; corner: P2; end: P2; last: P2; source: Arc; direction: Direction };
type Plan = { points: P2[]; bulges: number[]; center: P2; carrier: Carrier; radius: number };
const arcRefusal = 'Round corners between two straight edges (this one has an arc).';
const tolerance = CadNumericPolicy.linearTolerance;
const minimumSegment = 0.001; // The native numerical sketch solver's minimum segment and radius.
const angularTolerance = 1e-9;
const delta = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const distance = (a: P2, b: P2) => Math.hypot(...delta(a, b));
const tangent = ([x, y]: P2, direction: Direction): P2 => [-direction * y, direction * x];
const turn = (a: P2, b: P2) => Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
const inRange = (v: number) => Number.isFinite(v) && Math.abs(v) <= CadNumericPolicy.coordinateAbs;
const pointInRange = (p: P2) => inRange(p[0]) && inRange(p[1]);
const minorDirection = (bulge: number): Direction | null =>
  Math.abs(bulge) > 0 && Math.abs(bulge) < 1 ? (bulge > 0 ? 1 : -1) : null;
// Negation reflects a clockwise outline into the CCW calculation and exactly back.
const reflected = (p: P2, direction: Direction): P2 => direction === 1 ? p : [p[0], -p[1]];
const near = (a: number, b: number) => Math.abs(a - b) <= tolerance;
const at = (a: P2, b: P2) => distance(a, b) <= tolerance;
const atTangent = (a: P2, b: P2) => Math.abs(turn(a, b)) <= angularTolerance;
const noFit = (r: number) => `R${r} does not fit on both finite sides of this corner.`;
const validRadius = (r: number) => inRange(r) && r > minimumSegment;
const badRadius = 'Give the round a finite radius greater than 0.001 mm.';

function ordinaryOutline(s: Polygon, count: number) {
  return s.closed && !s.pending && s.points.length === count && s.points.every(pointInRange)
    && !s.construction && !s.fromRectangle && !s.fromSpline && !s.spline && !s.fromEllipse && !s.ellipse
    && !s.circles?.length && !s.circleIds?.length;
}

function supportedIds(ids: string[] | undefined, count: 4 | 5) {
  // Creation leaves room for the new fillet ID. An existing round needs no new ID.
  const maxId = count === 4 ? Number.MAX_SAFE_INTEGER - 1 : Number.MAX_SAFE_INTEGER;
  return ids?.length === count && new Set(ids).size === count && ids.every((id, i) =>
    (count === 5 && i === 1 && id === '') || /^e[1-9]\d*$/.test(id)
    && Number.isSafeInteger(Number(id.slice(1))) && Number(id.slice(1)) <= maxId);
}

function supportedPins(s: Polygon, endIndex: number) {
  const fix = s.rules?.[0];
  if (Object.keys(s.lengths ?? {}).length || s.equalRadii?.length || s.concentric?.length
    || s.rules?.length !== 1 || fix?.kind !== 'fix' || fix.point !== endIndex
    || s.hv?.h.length !== 2 || !s.hv.h.includes(0) || !s.hv.h.includes(endIndex)
    || s.hv.v.length !== 1 || s.hv.v[0] !== endIndex + 1) return null;
  return fix;
}

/** The authored pins determine the two carriers and the finite original corner. */
function carrierOf(a: P2, b: P2, radius: number, direction: Direction): Carrier | null {
  const anchor = reflected(a, direction), end = reflected(b, direction);
  if (!validRadius(radius) || !pointInRange(end) || end[0] - anchor[0] <= minimumSegment
    || end[1] - anchor[1] <= minimumSegment) return null;
  const center: P2 = [end[0], end[1] - radius], dy = anchor[1] - center[1];
  const margin = radius - Math.abs(dy);
  if (!pointInRange(center) || margin <= tolerance) return null;
  const dx = Math.sqrt(margin * (radius + Math.abs(dy)));
  const corner: P2 = [center[0] + dx, anchor[1]], last: P2 = [anchor[0], end[1]];
  const start = Math.atan2(dy, dx), sweep = Math.PI / 2 - start;
  if (!pointInRange(corner) || !(sweep > angularTolerance && Math.PI - sweep > angularTolerance)
    || corner[0] - anchor[0] <= minimumSegment) return null;
  return { anchor, corner, end, last, source: { center, radius, start, sweep }, direction };
}

function planRound(carrier: Carrier, radius: number): Plan | null {
  const { anchor, corner, end, last, source, direction } = carrier;
  const centerY = anchor[1] + radius, dy = centerY - source.center[1], innerRadius = source.radius - radius;
  // The inward offset line intersects the concentric circle of radius R − r.
  const margin = innerRadius - Math.abs(dy);
  if (margin <= tolerance) return null;
  const dx = Math.sqrt(margin * (innerRadius + Math.abs(dy)));
  const candidates = [-dx, dx].flatMap(x => {
    const center: P2 = [source.center[0] + x, centerY], lineTouch: P2 = [center[0], anchor[1]];
    const radial = delta(center, source.center);
    const arcTouch: P2 = [source.center[0] + radial[0] * source.radius / innerRadius,
      source.center[1] + radial[1] * source.radius / innerRadius];
    const trimmedSweep = turn(delta(corner, source.center), radial), remainingSweep = source.sweep - trimmedSweep;
    const roundSweep = turn([0, -1], radial);
    // Both contacts must be interior. The forward tangent turns through (0, π), so the two arcs
    // rise monotonically to the top edge and the rounded outline remains convex.
    if (![center, lineTouch, arcTouch].every(pointInRange) || lineTouch[0] - anchor[0] <= minimumSegment
      || corner[0] - lineTouch[0] <= minimumSegment || arcTouch[0] - anchor[0] <= minimumSegment
      || arcTouch[1] - anchor[1] <= minimumSegment || end[1] - arcTouch[1] <= tolerance
      || trimmedSweep * source.radius <= minimumSegment || remainingSweep * source.radius <= minimumSegment
      || roundSweep <= angularTolerance || Math.PI - roundSweep <= angularTolerance
      || distance(lineTouch, arcTouch) <= minimumSegment || distance(arcTouch, end) <= minimumSegment) return [];
    return [{
      points: [anchor, lineTouch, arcTouch, end, last].map(p => reflected(p, direction)),
      bulges: [0, direction * Math.tan(roundSweep / 4), direction * Math.tan(remainingSweep / 4), 0, 0],
      center: reflected(center, direction), carrier, radius,
    }];
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function roundDirection(b?: number[]): Direction | null {
  if (b?.length !== 5 || b[0] !== 0 || b[3] !== 0 || b[4] !== 0) return null;
  const direction = minorDirection(b[1]);
  return direction === minorDirection(b[2]) ? direction : null;
}

/** Check the solved coefficients and forward tangents against the same finite branch. */
export function matchesPinnedRound(s: Polygon, plan: Plan): boolean {
  const { direction, source } = plan.carrier, bulges = s.bulges;
  if (s.points.length !== 5 || !bulges || roundDirection(bulges) !== direction
    || !s.points.every((p, k) => at(p, plan.points[k]))) return false;
  const [a, p, q, b, d] = s.points;
  const round = arcOf(p, q, bulges[1]), retained = arcOf(q, b, bulges[2]);
  const alongArc = (point: P2, center: P2) => tangent(delta(point, center), direction);
  return at(round.center, plan.center) && at(retained.center, reflected(source.center, direction))
    && near(round.radius, plan.radius) && near(retained.radius, source.radius)
    && atTangent(delta(p, a), alongArc(p, round.center))
    && atTangent(alongArc(q, round.center), alongArc(q, retained.center))
    && atTangent(alongArc(b, retained.center), delta(d, b));
}

export function preparePinnedLineArcRound(s: Polygon, i: number, radius: number): { shape: Polygon; plan: Plan } | { error: string } {
  const bulges = s.bulges;
  const direction = minorDirection(bulges?.[1] ?? 0);
  if (i !== 1 || !ordinaryOutline(s, 4) || bulges?.length !== 4
    || bulges[0] !== 0 || !direction || bulges[2] !== 0 || bulges[3] !== 0) return { error: arcRefusal };
  if (s.lengths?.[0] !== undefined) return { error: 'Remove the trimmed line’s length lock before rounding this corner.' };
  if (s.rules?.some(rule => rule.kind === 'fix' && rule.point === i)) {
    return { error: 'Remove the fixed point at the corner before rounding it.' };
  }
  const fix = supportedPins(s, 2);
  if (!fix || s.tangents?.length !== 1 || s.tangents[0] !== 2 || !s.radii || Object.keys(s.radii).length !== 1
    || !validRadius(s.radii[1])) return { error: 'This line–arc round requires pinned supports and no other constraints.' };
  if (!s.ids || !supportedIds(s.ids, 4)) return { error: 'This line–arc round requires four distinct side IDs.' };
  const [a, p, b, d] = s.points;
  const carrier = carrierOf(a, fix.at, s.radii[1], direction);
  if (!carrier || a[1] !== p[1] || d[0] !== a[0] || d[1] !== b[1]
    || !at(reflected(p, direction), carrier.corner) || !at(reflected(b, direction), carrier.end)
    || !at(reflected(d, direction), carrier.last)) {
    return { error: 'This line–arc round requires a convex outline with horizontal sides.' };
  }
  const source = arcOf(p, b, bulges[1]);
  if (!at(reflected(source.center, direction), carrier.source.center) || !near(source.radius, carrier.source.radius)
    || !atTangent(tangent(delta(b, source.center), direction), delta(d, b))) {
    return { error: 'This line–arc round requires a convex arc tangent to the retained horizontal side.' };
  }
  if (!validRadius(radius)) return { error: badRadius };
  const plan = planRound(carrier, radius);
  if (!plan) return { error: noFit(radius) };
  return {
    shape: {
      ...s, points: plan.points, bulges: plan.bulges, ids: [s.ids[0], '', ...s.ids.slice(1)],
      radii: { 1: radius, 2: s.radii[1] }, tangents: [1, 2, 3], hv: { h: [0, 3], v: [4] }, rules: [{ ...fix, point: 3 }],
    },
    plan,
  };
}

function roundRecipe(s: Polygon, allowUnlockedSource = false) {
  if (!ordinaryOutline(s, 5) || !supportedIds(s.ids, 5)
    || s.tangents?.length !== 3 || ![1, 2, 3].every(j => s.tangents!.includes(j))
    || !s.radii || typeof s.radii[1] !== 'number') return null;
  const unlocked = allowUnlockedSource && s.radii[2] === undefined && Object.keys(s.radii).length === 1;
  if (!unlocked && (Object.keys(s.radii).length !== 2 || typeof s.radii[2] !== 'number')) return null;
  const fix = supportedPins(s, 3);
  if (!fix) return null;
  const direction = roundDirection(s.bulges);
  // An unlocked source can be re-locked only after its actual arc proves the prior finite branch.
  const sourceRadius = unlocked && direction ? arcOf(s.points[2], s.points[3], s.bulges![2]).radius : s.radii[2];
  return { end: fix.at, radius: s.radii[1], sourceRadius, direction };
}

/** Recognize the persisted pinned geometry before guarding a radius-only edit. */
export function planPinnedLineArcRadiusEdit(candidate: Polygon, prev: Polygon): { plan: Plan } | { error: string } | null {
  const filletChanged = candidate.radii?.[1] !== prev.radii?.[1];
  const sourceChanged = candidate.radii?.[2] !== prev.radii?.[2];
  if (filletChanged === sourceChanged || !candidate.ids?.every((id, i) => id === prev.ids?.[i])) return null;
  const old = roundRecipe(prev, sourceChanged), next = roundRecipe(candidate);
  if (!old?.direction || !next || distance(next.end, old.end) !== 0 || !validRadius(old.radius)) return null;
  const carrier = carrierOf(prev.points[0], old.end, old.sourceRadius, old.direction);
  const current = carrier && planRound(carrier, old.radius);
  if (!current || !matchesPinnedRound(prev, current)) return null;
  if (next.direction !== old.direction) return { error: 'The radius edit must keep both arcs in their original direction.' };
  const changedRadius = sourceChanged ? next.sourceRadius : next.radius;
  if (!validRadius(changedRadius)) return { error: badRadius };
  // The source radius moves its center along the perpendicular through the fixed end.
  const target = sourceChanged ? carrierOf(prev.points[0], old.end, next.sourceRadius, old.direction) : current.carrier;
  const plan = target && planRound(target, next.radius);
  if (!plan) return { error: noFit(changedRadius) };
  // The panel supplies the current coefficients. The inline path can have already applied this plan.
  if (!matchesPinnedRound(candidate, current) && !matchesPinnedRound(candidate, plan)) {
    return { error: 'The radius edit would move the pinned line or source arc.' };
  }
  return { plan };
}
