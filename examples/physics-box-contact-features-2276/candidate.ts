/** Private bounded native-box geometry experiment. No production imports. */
export type Vec = [number, number, number];
export interface Box { id: string; positionM: Vec; orientationXYZW: [number, number, number, number]; halfExtentsM: Vec }
export interface Pair { id: string; a: Box; b: Box }
type Q = { n: bigint; d: bigint };
type V = [Q, Q, Q];
type Native = { box: Box; centre: V; half: V; axes: [V, V, V] };
type Feature = { kind: 'FACE'; owner: 'a' | 'b'; axis: number; index: number }
  | { kind: 'EDGE'; axisA: number; axisB: number; index: number };
interface Selected { feature: Feature; normal: Vec; overlap: number }
interface Certificate { a: V; b: V; midpoint: V }
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

const addN = (a: Vec, b: Vec): Vec => a.map((x, i) => x + b[i]) as Vec;
const subN = (a: Vec, b: Vec): Vec => a.map((x, i) => x - b[i]) as Vec;
const scaleN = (a: Vec, s: number): Vec => a.map(x => x * s) as Vec;
const dotN = (a: Vec, b: Vec): number => a.reduce((s, x, i) => s + x * b[i], 0);
const crossN = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rawAxes(box: Box): Vec[] {
  const axis = box.orientationXYZW.slice(0, 3) as Vec, w = box.orientationXYZW[3];
  return ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec[]).map(v => {
    const t = scaleN(crossN(axis, v), 2);
    return addN(v, addN(scaleN(t, w), crossN(axis, t)));
  });
}
function select(pair: Pair, counts: { axisVisits: number }): Selected | null {
  const aa = rawAxes(pair.a), bb = rawAxes(pair.b), delta = subN(pair.b.positionM, pair.a.positionM);
  const axes = [...aa, ...bb, ...aa.flatMap(a => bb.map(b => crossN(a, b)))];
  let selected: Selected | null = null;
  for (let index = 0; index < 15; index++) {
    counts.axisVisits++;
    const length = Math.hypot(...axes[index]);
    if (length < 1e-12) continue;
    const axis = scaleN(axes[index], 1 / length);
    const ra = aa.reduce((sum, basis, i) => sum + pair.a.halfExtentsM[i] * Math.abs(dotN(basis, axis)), 0);
    const rb = bb.reduce((sum, basis, i) => sum + pair.b.halfExtentsM[i] * Math.abs(dotN(basis, axis)), 0);
    const distance = dotN(delta, axis), overlap = ra + rb - Math.abs(distance);
    if (!Number.isFinite(overlap)) throw new Unresolved('NONFINITE_SAT');
    if (overlap < -1e-12) return null;
    if (!selected || overlap < selected.overlap) {
      const feature: Feature = index < 6 ? { kind: 'FACE', owner: index < 3 ? 'a' : 'b', axis: index % 3, index }
        : { kind: 'EDGE', axisA: Math.floor((index - 6) / 3), axisB: (index - 6) % 3, index };
      selected = { feature, overlap, normal: scaleN(axis, distance < 0 ? -1 : 1) };
    }
  }
  if (!selected) throw new Unresolved('NO_SAT_AXIS');
  return selected;
}
function inside(body: Native, p: V): boolean {
  const delta = vminus(p, body.centre);
  return body.axes.every((axis, i) => compare(absolute(dot(delta, axis)), body.half[i]) <= 0);
}
function certificate(a: Native, b: Native, p: V, r: V, normal: V): Certificate {
  if (!inside(a, p) || !inside(b, r)) throw new Unresolved('NATIVE_TWELVE_HALFSPACE_FAILURE');
  if (cross(vminus(r, p), normal).some(x => x.n !== 0n)) throw new Unresolved('NONPARALLEL_NATIVE_WITNESSES');
  return { a: p, b: r, midpoint: vscale(vplus(p, r), over(O, word(2))) };
}
function nativeLineInterval(body: Native, origin: V, direction: V): { lo: Q; hi: Q } | null {
  const offset = vminus(origin, body.centre);
  let lo: Q | null = null, hi: Q | null = null;
  for (let axis = 0; axis < 3; axis++) {
    const start = dot(offset, body.axes[axis]), speed = dot(direction, body.axes[axis]);
    if (speed.n === 0n) {
      if (compare(absolute(start), body.half[axis]) > 0) return null;
      continue;
    }
    const first = over(minus(neg(body.half[axis]), start), speed);
    const second = over(minus(body.half[axis], start), speed);
    const lower = compare(first, second) <= 0 ? first : second;
    const upper = compare(first, second) <= 0 ? second : first;
    if (lo === null || compare(lower, lo) > 0) lo = lower;
    if (hi === null || compare(upper, hi) < 0) hi = upper;
    if (lo !== null && hi !== null && compare(lo, hi) > 0) return null;
  }
  return lo === null || hi === null ? null : { lo, hi };
}
function certifyPresentation(a: Native, b: Native, point: Vec, endpointA: Vec,
  endpointB: Vec, normal: Vec): void {
  const p = vector(point), n = vector(normal);
  const ia = nativeLineInterval(a, p, n), ib = nativeLineInterval(b, p, n);
  if (!ia || !ib) throw new Unresolved('FLOAT_PRESENTATION_LINE_MISSES_NATIVE_BOX');
  const limitSquared = q(1n, 1000000000000000000000000n);
  for (const [endpoint, time] of [[endpointA, ia.hi], [endpointB, ib.lo]] as [Vec, Q][]) {
    const residual = vminus(vector(endpoint), vplus(p, vscale(n, time)));
    if (compare(dot(residual, residual), limitSquared) > 0) {
      throw new Unresolved('FLOAT_PRESENTATION_NATIVE_EXIT_RESIDUAL');
    }
  }
}
function clip(polygon: V[], centre: V, axis: V, half: Q): V[] {
  const result: V[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i], next = polygon[(i + 1) % polygon.length];
    const a = minus(dot(vminus(current, centre), axis), half), b = minus(dot(vminus(next, centre), axis), half);
    if (a.n <= 0n) result.push(current);
    if ((a.n <= 0n) !== (b.n <= 0n)) {
      const t = over(a, minus(a, b));
      if (compare(t, Z) < 0 || compare(t, O) > 0) throw new Unresolved('CLIP_EXTRAPOLATION');
      result.push(vplus(current, vscale(vminus(next, current), t)));
    }
  }
  return result.filter((point, i) => result.findIndex(other => same(point, other)) === i);
}
function face(a: Native, b: Native, selected: Selected, feature: Extract<Feature, { kind: 'FACE' }>): { normal: V; points: Certificate[] } {
  const reference = feature.owner === 'a' ? a : b, incident = feature.owner === 'a' ? b : a;
  const towardIncident = feature.owner === 'a' ? selected.normal : scaleN(selected.normal, -1);
  const side = dotN(numberVector(reference.axes[feature.axis]), towardIncident) < 0 ? -1 : 1;
  const n = vscale(reference.axes[feature.axis], word(side));
  const normal = feature.owner === 'a' ? n : vscale(n, word(-1));
  const centre = vplus(reference.centre, vscale(n, reference.half[feature.axis]));
  let incidentAxis = 0;
  for (let i = 1; i < 3; i++) if (compare(absolute(dot(incident.axes[i], n)), absolute(dot(incident.axes[incidentAxis], n))) > 0) incidentAxis = i;
  const incidentSide = dot(incident.axes[incidentAxis], n).n > 0n ? -1 : 1;
  const incidentCentre = vplus(incident.centre, vscale(incident.axes[incidentAxis], times(word(incidentSide), incident.half[incidentAxis])));
  const tangents = [0, 1, 2].filter(i => i !== incidentAxis);
  let polygon = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) =>
    vplus(vplus(incidentCentre, vscale(incident.axes[tangents[0]], times(word(u), incident.half[tangents[0]]))),
      vscale(incident.axes[tangents[1]], times(word(v), incident.half[tangents[1]]))));
  const referenceTangents = [0, 1, 2].filter(i => i !== feature.axis);
  for (const i of referenceTangents) {
    polygon = clip(polygon, centre, reference.axes[i], reference.half[i]);
    polygon = clip(polygon, centre, vscale(reference.axes[i], word(-1)), reference.half[i]);
  }
  if (!polygon.length) throw new Unresolved('EMPTY_NATIVE_FACE_PATCH');
  const candidates = polygon.map(p => ({ p, separation: dot(vminus(p, centre), n) }));
  const penetrating = candidates.filter(x => x.separation.n <= 0n);
  const minimum = candidates.reduce((best, x) => compare(x.separation, best.separation) < 0 ? x : best);
  const active = penetrating.length ? penetrating : candidates.filter(x => compare(x.separation, minimum.separation) === 0);
  let points = active.map(({ p, separation }) => {
    const referencePoint = vminus(p, vscale(n, separation));
    return feature.owner === 'a' ? certificate(a, b, referencePoint, p, normal) : certificate(a, b, p, referencePoint, normal);
  });
  if (points.length > 4) points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) =>
    points.reduce((best, point) => {
      const score = (x: Certificate): Q => plus(times(word(u), dot(vminus(x.midpoint, centre), reference.axes[referenceTangents[0]])),
        times(word(v), dot(vminus(x.midpoint, centre), reference.axes[referenceTangents[1]])));
      return compare(score(point), score(best)) > 0 ? point : best;
    }));
  points = points.filter((point, i) => points.findIndex(other => same(point.midpoint, other.midpoint)) === i);
  points.sort((p, r) => compare(dot(p.midpoint, reference.axes[referenceTangents[0]]), dot(r.midpoint, reference.axes[referenceTangents[0]])) ||
    compare(dot(p.midpoint, reference.axes[referenceTangents[1]]), dot(r.midpoint, reference.axes[referenceTangents[1]])));
  return { normal, points };
}
function supportEdge(body: Native, axis: number, direction: V): [V, V] {
  let centre = body.centre;
  for (let i = 0; i < 3; i++) if (i !== axis) {
    const sign = dot(body.axes[i], direction).n < 0n ? -1 : 1;
    centre = vplus(centre, vscale(body.axes[i], times(word(sign), body.half[i])));
  }
  const extent = vscale(body.axes[axis], body.half[axis]);
  return [vminus(centre, extent), vplus(centre, extent)];
}
const clamp = (x: Q): Q => compare(x, Z) < 0 ? Z : compare(x, O) > 0 ? O : x;
function edge(a: Native, b: Native, selected: Selected, feature: Extract<Feature, { kind: 'EDGE' }>): { normal: V; points: Certificate[] } {
  let normal = cross(a.axes[feature.axisA], b.axes[feature.axisB]);
  if (dot(normal, normal).n === 0n) throw new Unresolved('ZERO_NATIVE_EDGE_AXIS');
  if (dotN(numberVector(normal), selected.normal) < 0) normal = vscale(normal, word(-1));
  const [p, p1] = supportEdge(a, feature.axisA, normal), [r, r1] = supportEdge(b, feature.axisB, vscale(normal, word(-1)));
  const u = vminus(p1, p), v = vminus(r1, r), w = vminus(p, r);
  const aa = dot(u, u), bb = dot(u, v), cc = dot(v, v), dd = dot(u, w), ee = dot(v, w);
  const determinant = minus(times(aa, cc), times(bb, bb));
  const parameters: [Q, Q][] = [];
  if (determinant.n > 0n) {
    const s = over(minus(times(bb, ee), times(cc, dd)), determinant);
    const t = over(minus(times(aa, ee), times(bb, dd)), determinant);
    if (compare(s, Z) >= 0 && compare(s, O) <= 0 && compare(t, Z) >= 0 && compare(t, O) <= 0) parameters.push([s, t]);
  }
  for (const s of [Z, O]) parameters.push([s, clamp(over(plus(ee, times(bb, s)), cc))]);
  for (const t of [Z, O]) parameters.push([clamp(over(minus(times(bb, t), dd), aa)), t]);
  const pairs = parameters.map(([s, t]) => ({ a: vplus(p, vscale(u, s)), b: vplus(r, vscale(v, t)) }));
  const best = pairs.reduce((old, x) => compare(dot(vminus(x.b, x.a), vminus(x.b, x.a)), dot(vminus(old.b, old.a), vminus(old.b, old.a))) < 0 ? x : old);
  return { normal, points: [certificate(a, b, best.a, best.b, normal)] };
}
const encoded = (a: V): string[] => a.map(x => `${x.n}/${x.d}`);
export function boxContact(pair: Pair): unknown {
  let selected: Selected | null = null;
  let construction: unknown = null;
  let presentationPointId: string | null = null;
  const counts = { axisVisits: 0 };
  try {
    const a = native(pair.a), b = native(pair.b);
    selected = select(pair, counts);
    if (!selected) return { status: 'MISS', points: [], ...counts };
    const result = selected.feature.kind === 'FACE' ? face(a, b, selected, selected.feature) : edge(a, b, selected, selected.feature);
    const normalWord = numberVector(result.normal), length = Math.hypot(...normalWord);
    if (!(length > 0) || !Number.isFinite(length)) throw new Unresolved('INVALID_NORMAL_OUTPUT');
    const normal = scaleN(normalWord, 1 / length);
    const points = result.points.map((p, i) => ({ id: `${selected!.feature.kind}:${selected!.feature.index}:${i}`,
        pointM: numberVector(p.midpoint), aPointM: numberVector(p.a), bPointM: numberVector(p.b),
        exact: { a: encoded(p.a), b: encoded(p.b), midpoint: encoded(p.midpoint) }, nativeHalfspacesCertified: 12 }));
    construction = { exactNormalDirection: encoded(result.normal), normal, points };
    for (const point of points) {
      presentationPointId = point.id;
      certifyPresentation(a, b, point.pointM, point.aPointM, point.bPointM, normal);
    }
    presentationPointId = null;
    return { status: 'HIT', feature: selected.feature, satNormal: selected.normal, satOverlap: selected.overlap,
      normal, exactNormalDirection: encoded(result.normal), points,
      ...counts, geometry: 'EXACT_NORMALIZED_QUATERNION_NATIVE_ENDPOINTS', phase: 'INPUT_POSES_ONLY' };
  } catch (error) {
    if (!(error instanceof Unresolved)) throw error;
    return { status: 'UNRESOLVED', feature: selected?.feature ?? null, reason: error.message, points: [], ...counts,
      phase: 'INPUT_POSES_ONLY', stage: construction ? 'FLOAT_PRESENTATION' : 'NATIVE_CONSTRUCTION', presentationPointId, construction };
  }
}
