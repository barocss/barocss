// Single polynomial quadratic only. Certified Simpson intervals and inverse queries share one work owner.
import { CadNumericPolicy } from '../numeric-policy.js';
import type { Point } from '../types.js';
import { QuadraticCutWork, type CutDyadic as D, type CutRefuse, type CutWorkCounts } from './quadratic-cut-arithmetic.js';

export interface CurveCutPathPlan { readonly offsets: Point[]; readonly length: { readonly lower: number; readonly upper: number; readonly estimate: number } }
export interface QuadraticCutPlan extends CurveCutPathPlan { readonly work: CutWorkCounts }
interface Speed { readonly q: D; readonly lower: bigint; readonly upper: bigint }
interface Panel { readonly a: D; readonly b: D; readonly depth: number; parent?: Panel; left?: Panel; right?: Panel; lower: bigint; upper: bigint; widest: Panel }
interface Prefix { lower: bigint; upper: bigint; refine: Panel; width: bigint }
const ZERO: D = { n: 0n, e: 0 }, ONE: D = { n: 1n, e: 0 };
function key(t: D): string { return `${t.n}@${t.e}`; }

export function cutNormBounds(w: QuadraticCutWork, coordinates: readonly D[], quantum: number): [D, D] {
  let squared = ZERO;
  for (const value of coordinates) squared = w.add(squared, w.mul(value, value));
  if (w.compare(squared.n, 0n) === 0) return [ZERO, ZERO];
  const relative = Math.floor((w.bits(squared.n) - 1 + squared.e) / 2) - 8;
  return w.sqrt(squared, Math.min(quantum, relative));
}
export function cutLengthNumbers(w: QuadraticCutWork, lower: D, upper: D, estimate?: number): CurveCutPathPlan['length'] {
  let lo = w.number(lower, 'down'), hi = w.number(upper, 'up');
  if (estimate !== undefined) { lo = Math.min(lo, estimate); hi = Math.max(hi, estimate); }
  const middle = estimate ?? lo / 2 + hi / 2;
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(middle) || lo < 0 || lo > hi || middle < lo || middle > hi) w.fail('CAPABILITY', 'quadratic path finite length enclosure is unavailable');
  return { lower: lo, upper: hi, estimate: middle };
}

class QuadraticPlanner {
  readonly w: QuadraticCutWork;
  private readonly p: bigint[][] = [];
  private readonly v: bigint[] = [];
  private readonly d: bigint[] = [];
  private readonly A: bigint;
  private readonly B: bigint;
  private readonly delta: bigint;
  private readonly exponent: number;
  private readonly quantum: number;
  private readonly tolerance: D;
  private readonly goal: D;
  private readonly derivativeBound: D;
  private readonly speeds = new Map<string, Speed>();
  private readonly coarse: [D, D];
  private root?: Panel;
  private critical?: D;
  private partial?: { a: string; b: string; panel: Panel };
  constructor(points: readonly (readonly number[])[], readonly limit: number, fail: CutRefuse, work?: QuadraticCutWork) {
    const w = this.w = work ?? new QuadraticCutWork(fail), captured: D[][] = [];
    let exponent = Infinity;
    for (const point of points) {
      const row: D[] = [];
      for (let axis = 0; axis < 2; axis++) { const value = w.from(point[axis]); row.push(value); if (w.compare(value.n, 0n) !== 0) exponent = Math.min(exponent, value.e); }
      captured.push(row);
    }
    this.exponent = exponent === Infinity ? 0 : exponent;
    for (const row of captured) { const p: bigint[] = []; for (const value of row) p.push(w.shift(value.n, value.e - this.exponent)); this.p.push(p); }
    const x1 = w.minus(this.p[1][0], this.p[0][0]), y1 = w.minus(this.p[1][1], this.p[0][1]), x2 = w.minus(this.p[2][0], this.p[0][0]), y2 = w.minus(this.p[2][1], this.p[0][1]);
    if (w.compare(w.minus(w.times(x1, y2), w.times(y1, x2)), 0n) === 0) fail('CAPABILITY', 'a curved quadratic path needs a noncollinear XY control triangle without a cusp');
    let A = 0n, B = 0n, C = 0n, derivative = 0n;
    for (let axis = 0; axis < 2; axis++) {
      const v = w.shift(w.minus(this.p[1][axis], this.p[0][axis]), 1), end = w.shift(w.minus(this.p[2][axis], this.p[1][axis]), 1), d = w.minus(end, v);
      this.v.push(v); this.d.push(d); A = w.plus(A, w.times(d, d)); B = w.plus(B, w.times(v, d)); C = w.plus(C, w.times(v, v));
      const av = w.abs(v), ae = w.abs(end); derivative = w.plus(derivative, w.compare(av, ae) >= 0 ? av : ae);
    }
    this.A = A; this.B = B; this.delta = w.minus(w.times(A, C), w.times(B, B));
    if (w.compare(A, 0n) <= 0 || w.compare(this.delta, 0n) <= 0) fail('CAPABILITY', 'the curved quadratic derivative must be regular');
    this.tolerance = w.from(CadNumericPolicy.linearTolerance); this.goal = w.scale(this.tolerance, -2);
    const policy = w.floorLogRatio(this.tolerance.n, 128n * 513n) + this.tolerance.e;
    const maxExponent = w.bits(derivative) - 1 + this.exponent;
    this.quantum = Math.min(policy, maxExponent - 8); this.derivativeBound = { n: derivative, e: this.exponent };
    const first: D[] = [], last: D[] = [], chord: D[] = [];
    for (let axis = 0; axis < 2; axis++) { first.push({ n: w.minus(this.p[1][axis], this.p[0][axis]), e: this.exponent }); last.push({ n: w.minus(this.p[2][axis], this.p[1][axis]), e: this.exponent }); chord.push({ n: w.minus(this.p[2][axis], this.p[0][axis]), e: this.exponent }); }
    const firstBounds = cutNormBounds(w, first, this.quantum), lastBounds = cutNormBounds(w, last, this.quantum);
    this.coarse = [cutNormBounds(w, chord, this.quantum)[0], w.add(firstBounds[1], lastBounds[1])];
  }
  private speed(t: D): Speed {
    const w = this.w, own = w.canonical(t), id = key(own), cached = this.speeds.get(id); if (cached) { w.take(); return cached; }
    if (w.counts.speedEvaluations >= 16384) w.fail('CAPABILITY', 'quadratic path speed evaluation budget exhausted'); w.counts.speedEvaluations++;
    let norm = 0n;
    for (let axis = 0; axis < 2; axis++) { const value = w.plus(w.shift(this.v[axis], -own.e), w.times(this.d[axis], own.n)); norm = w.plus(norm, w.times(value, value)); }
    const q: D = { n: norm, e: 2 * (this.exponent + own.e) }, bounds = w.sqrt(q, this.quantum);
    const value = { q, lower: bounds[0].n, upper: bounds[1].n }; this.speeds.set(id, value); return value;
  }
  private minimum(a: D, b: D, sa: Speed, sb: Speed): D {
    const w = this.w, minusB: D = { n: w.minus(0n, this.B), e: 0 }, coefficient: D = { n: this.A, e: 0 };
    if (w.cmp(minusB, w.mul(coefficient, a)) >= 0 && w.cmp(minusB, w.mul(coefficient, b)) <= 0) {
      if (!this.critical) this.critical = w.sqrtRatioLower(this.delta, this.A, 2 * this.exponent); return this.critical;
    }
    const sample = w.cmp(sa.q, sb.q) <= 0 ? sa : sb, power: D = { n: 1n, e: Math.floor((w.bits(sample.q.n) - 1 + sample.q.e) / 2) }, computed: D = { n: sample.lower, e: this.quantum };
    return w.cmp(power, computed) > 0 ? power : computed;
  }
  private measure(a: D, b: D, depth: number, parent?: Panel): Panel {
    const w = this.w, sa = this.speed(a), sb = this.speed(b), sm = this.speed(w.midpoint(a, b)), h = w.sub(b, a), minimum = this.minimum(a, b, sa, sb);
    const sumLo = w.plus(w.plus(sa.lower, w.shift(sm.lower, 2)), sb.lower), sumHi = w.plus(w.plus(sa.upper, w.shift(sm.upper, 2)), sb.upper);
    const h2 = w.times(h.n, h.n), h5 = w.times(w.times(h2, h2), h.n), m3 = w.times(w.times(minimum.n, minimum.n), minimum.n);
    const error = w.ratio(w.times(w.times(15n, w.times(this.A, this.A)), h5), w.times(2880n, m3), 4 * this.exponent + 5 * h.e - 3 * minimum.e - this.quantum, true);
    const low = w.minus(w.ratio(w.times(sumLo, h.n), 6n, h.e, false), error), high = w.plus(w.ratio(w.times(sumHi, h.n), 6n, h.e, true), error);
    const panel = { a, b, depth, parent, lower: w.compare(low, 0n) < 0 ? 0n : low, upper: high } as Panel; panel.widest = panel; return panel;
  }
  private width(panel: Panel): bigint { return this.w.minus(panel.upper, panel.lower); }
  private widest(a: Panel, b: Panel): Panel { return this.w.compare(this.width(a), this.width(b)) >= 0 ? a : b; }
  private split(panel: Panel): void {
    const w = this.w;
    if (panel.depth >= 16 || w.counts.subdivisions >= 512) w.fail('CAPABILITY', 'quadratic path integration subdivision or depth budget exhausted');
    w.counts.subdivisions++; w.counts.integrationDepth = Math.max(w.counts.integrationDepth, panel.depth + 1);
    const mid = w.midpoint(panel.a, panel.b); panel.left = this.measure(panel.a, mid, panel.depth + 1, panel); panel.right = this.measure(mid, panel.b, panel.depth + 1, panel);
    let at: Panel | undefined = panel;
    while (at) { at.lower = w.plus(at.left!.lower, at.right!.lower); at.upper = w.plus(at.left!.upper, at.right!.upper); at.widest = this.widest(at.left!.widest, at.right!.widest); at = at.parent; }
  }
  private prefix(t: D, at: Panel): Prefix {
    const w = this.w;
    if (w.cmp(t, at.b) >= 0) return { lower: at.lower, upper: at.upper, refine: at.widest, width: this.width(at.widest) };
    if (at.left && at.right) {
      if (w.cmp(t, at.left.b) <= 0) return this.prefix(t, at.left);
      const right = this.prefix(t, at.right), left = at.left.widest, width = this.width(left), chooseLeft = w.compare(width, right.width) >= 0;
      return { lower: w.plus(at.left.lower, right.lower), upper: w.plus(at.left.upper, right.upper), refine: chooseLeft ? left : right.refine, width: chooseLeft ? width : right.width };
    }
    const a = key(at.a), b = key(t);
    if (!this.partial || this.partial.a !== a || this.partial.b !== b) this.partial = { a, b, panel: this.measure(at.a, t, at.depth) };
    return { lower: this.partial.panel.lower, upper: this.partial.panel.upper, refine: at, width: this.width(this.partial.panel) };
  }
  private totals(): [D, D] {
    if (!this.root) return this.coarse;
    const w = this.w, lower: D = { n: this.root.lower, e: this.quantum }, upper: D = { n: this.root.upper, e: this.quantum };
    return [w.cmp(lower, this.coarse[0]) > 0 ? lower : this.coarse[0], w.cmp(upper, this.coarse[1]) < 0 ? upper : this.coarse[1]];
  }
  private ensureRoot(): Panel { return this.root ??= this.measure(ZERO, ONE, 0); }
  private offset(t: D, bound: D): Point {
    const w = this.w, own = w.canonical(t), denominator = w.shift(1n, -own.e), square = w.times(own.n, own.n), first = w.shift(w.times(w.minus(denominator, own.n), own.n), 1), result: Point = [0, 0, 0]; let rounding = ZERO;
    for (let axis = 0; axis < 2; axis++) {
      const exact: D = { n: w.plus(w.times(first, w.minus(this.p[1][axis], this.p[0][axis])), w.times(square, w.minus(this.p[2][axis], this.p[0][axis]))), e: this.exponent + 2 * own.e };
      if (w.cmp(w.magnitude(exact), w.from(this.limit)) > 0) w.fail('PARAMETER', 'path cut pattern offsets must be within ±10000 mm');
      const value = w.number(exact); result[axis] = value; rounding = w.add(rounding, w.magnitude(w.sub(exact, w.from(value))));
    }
    if (w.cmp(w.add(bound, rounding), this.tolerance) > 0) w.fail('CAPABILITY', 'quadratic path position and Number rounding exceed the existing linear tolerance');
    return result;
  }
  private inverse(target: D): Point {
    const w = this.w;
    let a = ZERO, b = ONE, proposed: D | undefined;
    const [totalLower, totalUpper] = this.totals(), guess = w.estimate(target) / w.estimate(w.midpoint(totalLower, totalUpper));
    if (Number.isFinite(guess) && guess > 0 && guess < 1) proposed = w.from(guess);
    for (;;) {
      w.take(); w.counts.inverseIterations++;
      const mid = proposed ?? w.midpoint(a, b); proposed = undefined;
      if (w.cmp(mid, a) <= 0 || w.cmp(mid, b) >= 0) w.fail('CAPABILITY', 'quadratic path inverse parameter has no strict interior refinement');
      const bracket = w.mul(this.derivativeBound, w.sub(b, a)); if (w.cmp(bracket, this.goal) <= 0) return this.offset(mid, bracket);
      const p = this.prefix(mid, this.ensureRoot()), lower: D = { n: p.lower, e: this.quantum }, upper: D = { n: p.upper, e: this.quantum };
      if (w.cmp(target, lower) >= 0 && w.cmp(target, upper) <= 0) {
        const x = w.sub(target, lower), y = w.sub(upper, target), bound = w.cmp(x, y) >= 0 ? x : y;
        if (w.cmp(bound, this.goal) <= 0) return this.offset(mid, bound);
        this.split(p.refine); proposed = mid; continue;
      }
      if (w.cmp(target, lower) < 0) b = mid; else a = mid;
      // This proposal is not authority: every accepted position and bracket move is certified above.
      const point = w.estimate(mid), residual = w.estimate(w.sub(target, w.midpoint(lower, upper))), sample = this.speed(mid), speed = w.estimate({ n: sample.lower, e: this.quantum });
      const candidate = point + residual / speed;
      if (Number.isFinite(candidate) && candidate > 0 && candidate < 1) { const next = w.from(candidate); if (w.cmp(next, a) > 0 && w.cmp(next, b) < 0 && w.cmp(next, mid) !== 0) proposed = next; }
    }
  }
  run(spacing: number, count: number): QuadraticCutPlan {
    const w = this.w, requested = w.from((count - 1) * spacing);
    for (;;) {
      const [lower, upper] = this.totals();
      if (w.cmp(requested, lower) <= 0) break;
      if (w.cmp(requested, upper) > 0) w.fail('PARAMETER', 'last cut placement exceeds the open path length');
      this.split(this.ensureRoot().widest);
    }
    const offsets: Point[] = [[0, 0, 0]];
    for (let k = 1; k < count; k++) offsets.push(this.inverse(w.from(k * spacing)));
    const [lower, upper] = this.totals(); return { offsets, length: cutLengthNumbers(w, lower, upper), work: { ...w.counts } };
  }
}

export function planQuadraticCut(points: readonly (readonly number[])[], spacing: number, count: number, limit: number, fail: CutRefuse, work?: QuadraticCutWork): QuadraticCutPlan {
  for (const point of points) if (point[2] !== points[0][2]) return fail('CAPABILITY', 'a curved quadratic CUT path needs a baked constant-Z XY trace');
  return new QuadraticPlanner(points, limit, fail, work).run(spacing, count);
}
