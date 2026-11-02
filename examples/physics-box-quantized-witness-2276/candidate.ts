/** Private finite-cell quantized presentation. No World or production imports. */
import { boxContact } from '../physics-box-contact-features-2276/candidate.js';
export type Vec = [number, number, number];
export interface Box { id: string; positionM: Vec; orientationXYZW: [number, number, number, number]; halfExtentsM: Vec }
export interface Pair { id: string; a: Box; b: Box }
type Q = { n: bigint; d: bigint };
type V = [Q, Q, Q];
type Native = { box: Box; centre: V; half: V; axes: [V, V, V] };
class Unresolved extends Error {}
const BIT_LIMIT = 16384;
const Z: Q = { n: 0n, d: 1n }, O: Q = { n: 1n, d: 1n };
const bits = (x: bigint): number => (x < 0n ? -x : x).toString(2).length;
function check(x: bigint): bigint { if (bits(x) > BIT_LIMIT) throw new Unresolved('EXACT_BIT_LIMIT'); return x; }
function product(a: bigint, b: bigint): bigint {
  if (a !== 0n && b !== 0n && bits(a) + bits(b) > BIT_LIMIT) throw new Unresolved('EXACT_PRODUCT_BIT_LIMIT');
  return check(a * b);
}
function q(n: bigint, d = 1n): Q {
  if (d === 0n) throw new Unresolved('ZERO_EXACT_DENOMINATOR');
  if (n === 0n) return Z;
  if (d < 0n) { n = -n; d = -d; }
  check(n); check(d);
  let a = n < 0n ? -n : n, b = d;
  while (b !== 0n) { const next = a % b; a = b; b = next; }
  return { n: n / a, d: d / a };
}
const neg = (a: Q): Q => ({ n: -a.n, d: a.d });
const plus = (a: Q, b: Q): Q => q(check(product(a.n, b.d) + product(b.n, a.d)), product(a.d, b.d));
const minus = (a: Q, b: Q): Q => plus(a, neg(b));
const times = (a: Q, b: Q): Q => q(product(a.n, b.n), product(a.d, b.d));
const over = (a: Q, b: Q): Q => q(product(a.n, b.d), product(a.d, b.n));
const compare = (a: Q, b: Q): number => { const d = minus(a, b).n; return d < 0n ? -1 : d > 0n ? 1 : 0; };
const absolute = (a: Q): Q => a.n < 0n ? neg(a) : a;
function word(value: number): Q {
  if (!Number.isFinite(value)) throw new Unresolved('NONFINITE_INPUT');
  const data = new DataView(new ArrayBuffer(8)); data.setFloat64(0, value, false);
  const raw = data.getBigUint64(0, false), e = Number((raw >> 52n) & 2047n);
  const m = ((raw & 0xfffffffffffffn) | (e ? 0x10000000000000n : 0n)) * (raw >> 63n ? -1n : 1n);
  const power = e ? e - 1075 : -1074;
  return power < 0 ? q(m, 1n << BigInt(-power)) : q(m << BigInt(power));
}
function numeric(a: Q): number {
  const n = a.n < 0n ? -a.n : a.n;
  if (!n) return 0;
  // Find floor(log2(n/d)) with integer comparisons, then round the integer
  // significand once. Truncating n and d independently is not correct rounding.
  let exponent = bits(n) - bits(a.d);
  const shift = (value: bigint, count: number): bigint => {
    if (bits(value) + count > BIT_LIMIT) throw new Unresolved('PRESENTATION_SHIFT_BIT_LIMIT');
    return check(value << BigInt(count));
  };
  if (exponent >= 0 ? n < shift(a.d, exponent) : shift(n, -exponent) < a.d) exponent--;
  if (exponent > 1023) throw new Unresolved('NONFINITE_OUTPUT');
  const unit = Math.max(-1074, exponent - 52);
  const numerator = unit < 0 ? shift(n, -unit) : n;
  const denominator = unit > 0 ? shift(a.d, unit) : a.d;
  let significand = numerator / denominator;
  const remainder = numerator % denominator;
  const doubled = check(remainder + remainder);
  if (doubled > denominator || doubled === denominator && (significand & 1n) !== 0n) significand++;
  const value = Number(significand) * 2 ** unit;
  if (!Number.isFinite(value)) throw new Unresolved('NONFINITE_OUTPUT');
  return a.n < 0n ? -value : value;
}
const vector = (a: number[]): V => a.map(word) as V;
const vplus = (a: V, b: V): V => a.map((x, i) => plus(x, b[i])) as V;
const vminus = (a: V, b: V): V => a.map((x, i) => minus(x, b[i])) as V;
const vscale = (a: V, t: Q): V => a.map(x => times(x, t)) as V;
const dot = (a: V, b: V): Q => a.reduce((s, x, i) => plus(s, times(x, b[i])), Z);
const cross = (a: V, b: V): V => [minus(times(a[1], b[2]), times(a[2], b[1])),
  minus(times(a[2], b[0]), times(a[0], b[2])), minus(times(a[0], b[1]), times(a[1], b[0]))];
const numberVector = (a: V): Vec => a.map(numeric) as Vec;
const same = (a: V, b: V): boolean => a.every((x, i) => compare(x, b[i]) === 0);
function native(box: Box): Native {
  if (box.positionM.length !== 3 || box.halfExtentsM.length !== 3 || box.orientationXYZW.length !== 4 ||
    box.positionM.some(x => !Number.isFinite(x) || Math.abs(x) > 10000) ||
    box.halfExtentsM.some(x => !Number.isFinite(x) || x < .0001 || x > 1000) ||
    box.orientationXYZW.some(x => !Number.isFinite(x) || Math.abs(x) > 1) ||
    Math.abs(Math.hypot(...box.orientationXYZW) - 1) > 1e-9) throw new Unresolved('OUTSIDE_NATIVE_INPUT_PROFILE');
  const [x, y, z, w] = box.orientationXYZW.map(word);
  const s = plus(plus(times(x, x), times(y, y)), plus(times(z, z), times(w, w))), two = word(2);
  if (s.n === 0n) throw new Unresolved('ZERO_QUATERNION');
  const rows: V[] = [
    [minus(s, times(two, plus(times(y, y), times(z, z)))), times(two, minus(times(x, y), times(z, w))), times(two, plus(times(x, z), times(y, w)))],
    [times(two, plus(times(x, y), times(z, w))), minus(s, times(two, plus(times(x, x), times(z, z)))), times(two, minus(times(y, z), times(x, w)))],
    [times(two, minus(times(x, z), times(y, w))), times(two, plus(times(y, z), times(x, w))), minus(s, times(two, plus(times(x, x), times(y, y))))],
  ];
  return { box, centre: vector(box.positionM), half: vector(box.halfExtentsM),
    axes: [0, 1, 2].map(i => rows.map(row => over(row[i], s)) as V) as [V, V, V] };
}

interface NativePoint {
  id: string; pointM: Vec; aPointM: Vec; bPointM: Vec;
  exact: { a: string[]; b: string[]; midpoint: string[] };
}
interface Construction { exactNormalDirection: string[]; normal: Vec; points: NativePoint[] }
interface GeometryReply extends Construction {
  status: 'HIT' | 'MISS' | 'UNRESOLVED'; feature?: unknown; reason?: string;
  stage?: string; construction?: Construction | null;
}
interface Interval { lo: Q; hi: Q }
const PRESENTATION_SQUARED = q(1n, 1000000000000000000000000n);
const SURFACE = q(1n, 1000000000n);
const NORM_GATE = q(1n, 1000000000000n);
function rational(value: string): Q {
  const [n, d] = value.split('/');
  return q(BigInt(n), d === undefined ? 1n : BigInt(d));
}
const exactVector = (values: string[]): V => values.map(rational) as V;
const squaredDistance = (a: V, b: V): Q => { const delta = vminus(a, b); return dot(delta, delta); };
const fractionString = (a: Q): string => `${a.n}/${a.d}`;
function hex(value: number): string {
  const data = new DataView(new ArrayBuffer(8)); data.setFloat64(0, value, false);
  return data.getBigUint64(0, false).toString(16).padStart(16, '0');
}
function adjacent(value: number, direction: -1 | 1): number {
  if (value === 0) return direction * Number.MIN_VALUE;
  const data = new DataView(new ArrayBuffer(8)); data.setFloat64(0, value, false);
  const raw = data.getBigUint64(0, false);
  data.setBigUint64(0, raw + BigInt(value > 0 ? direction : -direction), false);
  const result = data.getFloat64(0, false);
  if (!Number.isFinite(result)) throw new Unresolved('NONFINITE_CELL_BOUND');
  return result === 0 ? 0 : result;
}
function interval(body: Native, origin: V, direction: V): Interval | null {
  const offset = vminus(origin, body.centre);
  let lo: Q | null = null, hi: Q | null = null;
  for (let axis = 0; axis < 3; axis++) {
    const start = dot(offset, body.axes[axis]), speed = dot(direction, body.axes[axis]);
    if (speed.n === 0n) {
      if (compare(absolute(start), body.half[axis]) > 0) return null;
      continue;
    }
    const first = over(minus(neg(body.half[axis]), start), speed), second = over(minus(body.half[axis], start), speed);
    const lower = compare(first, second) <= 0 ? first : second, upper = compare(first, second) <= 0 ? second : first;
    if (lo === null || compare(lower, lo) > 0) lo = lower;
    if (hi === null || compare(upper, hi) < 0) hi = upper;
    if (lo !== null && hi !== null && compare(lo, hi) > 0) return null;
  }
  return lo === null || hi === null ? null : { lo, hi };
}
function surface(body: Native, point: V, exact: boolean): boolean {
  const local = body.axes.map(axis => dot(vminus(point, body.centre), axis));
  const offsets = local.map((value, axis) => minus(absolute(value), body.half[axis]));
  if (exact) return offsets.every(x => x.n <= 0n) && offsets.some(x => x.n === 0n);
  return offsets.every(x => compare(x, SURFACE) <= 0) && offsets.some(x => compare(absolute(x), SURFACE) <= 0);
}
function confirmNative(a: Native, b: Native, point: NativePoint, exactNormal: V): { pa: V; pb: V; midpoint: V } {
  const pa = exactVector(point.exact.a), pb = exactVector(point.exact.b), midpoint = exactVector(point.exact.midpoint);
  if (!surface(a, pa, true) || !surface(b, pb, true) ||
    !same(vscale(vplus(pa, pb), over(O, word(2))), midpoint) ||
    cross(vminus(pb, pa), exactNormal).some(x => x.n !== 0n)) throw new Unresolved('NATIVE_CERTIFICATE_FAILURE');
  const ia = interval(a, midpoint, exactNormal), ib = interval(b, midpoint, exactNormal);
  if (!ia || !ib || !same(vplus(midpoint, vscale(exactNormal, ia.hi)), pa) ||
    !same(vplus(midpoint, vscale(exactNormal, ib.lo)), pb)) throw new Unresolved('NATIVE_LINE_EXIT_FAILURE');
  return { pa, pb, midpoint };
}
interface CellMember { anchor: Vec; words: string[]; feasible: boolean; reason: string }
function feasibility(a: Native, b: Native, anchor: V, midpoint: V, af: V, bf: V,
  normal: V, nearTouch: boolean): { feasible: boolean; reason: string; intervals?: [Interval, Interval] } {
  if (compare(squaredDistance(anchor, midpoint), PRESENTATION_SQUARED) > 0) return { feasible: false, reason: 'MIDPOINT_DISTANCE' };
  const n2 = dot(normal, normal);
  for (const endpoint of [af, bf]) {
    const delta = vminus(endpoint, anchor), projected = vscale(normal, over(dot(delta, normal), n2));
    if (compare(dot(vminus(delta, projected), vminus(delta, projected)), PRESENTATION_SQUARED) > 0) return { feasible: false, reason: 'NORMAL_LINE_DISTANCE' };
  }
  const ia = interval(a, anchor, normal), ib = interval(b, anchor, normal);
  if (!ia || !ib) return { feasible: false, reason: !ia ? 'NATIVE_LINE_MISS_A' : 'NATIVE_LINE_MISS_B' };
  if (compare(squaredDistance(af, vplus(anchor, vscale(normal, ia.hi))), PRESENTATION_SQUARED) > 0 ||
    compare(squaredDistance(bf, vplus(anchor, vscale(normal, ib.lo))), PRESENTATION_SQUARED) > 0) return { feasible: false, reason: 'NATIVE_EXIT_DISTANCE' };
  if (nearTouch && compare(times(times(minus(ib.lo, ia.hi), minus(ib.lo, ia.hi)), n2), PRESENTATION_SQUARED) > 0) return { feasible: false, reason: 'NATIVE_PAIRED_GAP' };
  return { feasible: true, reason: 'FEASIBLE', intervals: [ia, ib] };
}

export function quantizedContact(pair: Pair): unknown {
  const counts = { geometryCalls: 0, pointsAttempted: 0, anchorChecks: 0 };
  const completedPoints: unknown[] = [];
  let generated: Construction | null = null, currentCell: CellMember[] = [];
  let geometryStatus = '', feature: unknown = null, pointId: string | null = null;
  try {
    counts.geometryCalls++;
    const base = boxContact(pair) as GeometryReply;
    geometryStatus = base.status; feature = base.feature ?? null;
    if (base.status === 'MISS') return { status: 'MISS', points: [], counts, sourceGeometryStatus: geometryStatus };
    generated = base.status === 'HIT' ? base : base.stage === 'FLOAT_PRESENTATION' ? base.construction ?? null : null;
    if (!generated) throw new Unresolved('SOURCE_NATIVE_CONSTRUCTION_UNRESOLVED:' + base.reason);
    if (generated.points.length > 96) throw new Unresolved('POINT_BUDGET');
    const a = native(pair.a), b = native(pair.b), exactNormal = exactVector(generated.exactNormalDirection), normal = vector(generated.normal);
    if (compare(absolute(minus(dot(normal, normal), O)), NORM_GATE) > 0) throw new Unresolved('PUBLIC_NORMAL_NORM');
    for (const original of generated.points) {
      counts.pointsAttempted++; pointId = original.id; currentCell = [];
      const { pa, pb, midpoint } = confirmNative(a, b, original, exactNormal);
      const rounded = numberVector(midpoint).map(x => x === 0 ? 0 : x) as Vec;
      const aPointM = numberVector(pa), bPointM = numberVector(pb), af = vector(aPointM), bf = vector(bPointM);
      if (compare(squaredDistance(af, pa), PRESENTATION_SQUARED) > 0 || compare(squaredDistance(bf, pb), PRESENTATION_SQUARED) > 0 ||
        !surface(a, af, false) || !surface(b, bf, false)) throw new Unresolved('FIXED_ENDPOINT_PRESENTATION');
      const nearTouch = compare(squaredDistance(pa, pb), PRESENTATION_SQUARED) <= 0;
      const grid = rounded.map(x => [adjacent(x, -1), x, adjacent(x, 1)]);
      let best: { anchor: Vec; key: string; score: Q; intervals: [Interval, Interval] } | null = null;
      for (const x of grid[0]) for (const y of grid[1]) for (const z of grid[2]) {
        if (++counts.anchorChecks > 2592) throw new Unresolved('ANCHOR_BUDGET');
        const anchor: Vec = [x, y, z], key = anchor.map(hex).join(':');
        const exactAnchor = vector(anchor), score = squaredDistance(exactAnchor, midpoint);
        const check = feasibility(a, b, exactAnchor, midpoint, af, bf, normal, nearTouch);
        currentCell.push({ anchor, words: anchor.map(hex), feasible: check.feasible, reason: check.reason });
        if (check.feasible && (!best || compare(score, best.score) < 0 || compare(score, best.score) === 0 && key < best.key)) {
          best = { anchor, key, score, intervals: check.intervals! };
        }
      }
      if (!best) throw new Unresolved('CELL_INFEASIBLE');
      completedPoints.push({ id: original.id, pointM: best.anchor, aPointM, bPointM, exact: original.exact,
        nativeHalfspacesCertified: 12, idealRoundedMidpoint: rounded,
        selectedDistanceSquaredExact: fractionString(best.score), selectedWordKey: best.key,
        selectedIntervals: best.intervals.map(i => ({ lower: fractionString(i.lo), upper: fractionString(i.hi) })),
        nearTouch, cell: currentCell, nearestScope: 'COMPLETE_FROZEN_27_MEMBER_CELL_ONLY' });
    }
    return { status: 'HIT', feature, normal: generated.normal, exactNormalDirection: generated.exactNormalDirection,
      points: completedPoints, counts, sourceGeometryStatus: geometryStatus,
      geometry: 'EXACT_NATIVE_WITH_DIRECT_FINITE_CELL_PRESENTATION', phase: 'INPUT_POSES_ONLY',
      oldSingleRoundedMidpointProtocol: 'UNCHANGED_NO_GO', globalNearest: 'NOT_CLAIMED' };
  } catch (error) {
    if (!(error instanceof Unresolved)) throw error;
    return { status: 'UNRESOLVED', feature, pointId, reason: error.message, points: [], counts,
      completedPoints, currentCell, generatedExactConstruction: generated,
      sourceGeometryStatus: geometryStatus, globalInfeasibility: 'NOT_CLAIMED' };
  }
}

