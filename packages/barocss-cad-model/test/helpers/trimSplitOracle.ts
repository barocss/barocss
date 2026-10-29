// Test-only exact slab integration. No product geometry, clipping or arrangement imports.
export interface Fraction { numerator: string; denominator: string }
interface Q { n: bigint; d: bigint }
interface Line { slope: Q; offset: Q }
interface OracleComponent { areaUV: Fraction; areaWorld: Fraction; centroidWorld: Fraction[] }
interface OracleInput { uv: readonly (readonly number[])[]; domain: { u: number[]; v: number[] }; axis: 'u' | 'v'; parameter: number; keep: 'inside' | 'outside' }
const ZERO: Q = { n: 0n, d: 1n };
function rational(n: bigint, d = 1n): Q {
  if (d === 0n) throw new Error('Zero oracle denominator.');
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n, b = d;
  while (b !== 0n) { const remainder = a % b; a = b; b = remainder; }
  return { n: n / a, d: d / a };
}
function fromNumber(value: number): Q {
  if (!Number.isFinite(value)) throw new Error('The oracle needs finite binary64 input.');
  const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, value);
  const bits = bytes.getBigUint64(0), exponent = Number((bits >> 52n) & 0x7ffn), fraction = bits & ((1n << 52n) - 1n);
  const mantissa = exponent === 0 ? fraction : (1n << 52n) | fraction;
  const sign = bits >> 63n ? -1n : 1n, power = exponent === 0 ? -1074 : exponent - 1023 - 52;
  return power >= 0 ? rational(sign * (mantissa << BigInt(power))) : rational(sign * mantissa, 1n << BigInt(-power));
}
const add = (a: Q, b: Q): Q => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q): Q => rational(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q): Q => rational(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q): Q => rational(a.n * b.d, a.d * b.n);
const cmp = (a: Q, b: Q): number => { const difference = a.n * b.d - b.n * a.d; return difference < 0n ? -1 : difference > 0n ? 1 : 0; };
const min = (a: Q, b: Q): Q => cmp(a, b) <= 0 ? a : b;
const max = (a: Q, b: Q): Q => cmp(a, b) >= 0 ? a : b;
const value = (line: Line, t: Q): Q => add(mul(line.slope, t), line.offset);
const text = (q: Q): Fraction => ({ numerator: String(q.n), denominator: String(q.d) });
function integral(lo: Q, hi: Q, coefficients: Q[]): Q {
  let sum = ZERO, loPower = rational(1n), hiPower = rational(1n);
  for (let i = 0; i < coefficients.length; i++) {
    loPower = mul(loPower, lo); hiPower = mul(hiPower, hi);
    sum = add(sum, div(mul(coefficients[i], sub(hiPower, loPower)), rational(BigInt(i + 1))));
  }
  return sum;
}
/** Integrate interval slabs and join only through positive-width overlaps at shared levels. */
export function trimSplitOracle(input: OracleInput): { lower: OracleComponent[]; upper: OracleComponent[] } {
  const selected = input.axis === 'u' ? 0 : 1, cut = fromNumber(input.parameter);
  const points = input.uv.map(p => [fromNumber(p[selected]), fromNumber(p[1 - selected])]);
  const td = input.domain[input.axis].map(fromNumber), od = input.domain[input.axis === 'u' ? 'v' : 'u'].map(fromNumber);
  const unique = new Map<string, Q>();
  for (const q of [...td, cut, ...points.map(p => p[0])]) if (cmp(q, td[0]) >= 0 && cmp(q, td[1]) <= 0) unique.set(`${q.n}/${q.d}`, q);
  const levels = [...unique.values()].sort(cmp), parents: number[] = [];
  const nodes: { side: 'lower' | 'upper'; area: Q; momentT: Q; momentO: Q }[] = [];
  type Boundary = { index: number; right: Line; left: Line; hi: Q };
  let previous: Boundary[] = [];
  function root(index: number): number {
    while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; }
    return index;
  }
  for (let slab = 0; slab + 1 < levels.length; slab++) {
    const lo = levels[slab], hi = levels[slab + 1], middle = div(add(lo, hi), rational(2n));
    const side = cmp(middle, cut) < 0 ? 'lower' : 'upper', crossing: Line[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if (cmp(min(a[0], b[0]), middle) < 0 && cmp(middle, max(a[0], b[0])) < 0) {
        const slope = div(sub(b[1], a[1]), sub(b[0], a[0]));
        crossing.push({ slope, offset: sub(a[1], mul(slope, a[0])) });
      }
    }
    crossing.sort((a, b) => cmp(value(a, middle), value(b, middle)));
    if (crossing.length % 2 !== 0) throw new Error('Odd oracle slab crossing count.');
    const intervals: [Line, Line][] = [];
    if (input.keep === 'inside') {
      for (let i = 0; i < crossing.length; i += 2) intervals.push([crossing[i], crossing[i + 1]]);
    } else {
      let left: Line = { slope: ZERO, offset: od[0] };
      for (let i = 0; i < crossing.length; i += 2) { intervals.push([left, crossing[i]]); left = crossing[i + 1]; }
      intervals.push([left, { slope: ZERO, offset: od[1] }]);
    }
    const current: Boundary[] = [];
    for (const [left, right] of intervals) {
      if (cmp(value(right, middle), value(left, middle)) <= 0) continue;
      const da = sub(right.slope, left.slope), db = sub(right.offset, left.offset);
      const area = integral(lo, hi, [db, da]), momentT = integral(lo, hi, [ZERO, db, da]);
      const momentO = integral(lo, hi, [
        div(sub(mul(right.offset, right.offset), mul(left.offset, left.offset)), rational(2n)),
        sub(mul(right.slope, right.offset), mul(left.slope, left.offset)),
        div(sub(mul(right.slope, right.slope), mul(left.slope, left.slope)), rational(2n)),
      ]);
      const index = nodes.length; nodes.push({ side, area, momentT, momentO }); parents.push(index);
      for (const old of previous) {
        if (cmp(old.hi, lo) !== 0 || nodes[old.index].side !== side) continue;
        const overlap = sub(min(value(right, lo), value(old.right, lo)), max(value(left, lo), value(old.left, lo)));
        if (cmp(overlap, ZERO) > 0) parents[root(index)] = root(old.index);
      }
      current.push({ index, right, left, hi });
    }
    previous = current;
  }
  const sums = new Map<number, { side: 'lower' | 'upper'; area: Q; momentT: Q; momentO: Q }>();
  nodes.forEach((node, index) => {
    const key = root(index), old = sums.get(key);
    sums.set(key, old ? { side: node.side, area: add(old.area, node.area), momentT: add(old.momentT, node.momentT), momentO: add(old.momentO, node.momentO) } : { ...node });
  });
  const output: { lower: OracleComponent[]; upper: OracleComponent[] } = { lower: [], upper: [] };
  for (const sum of sums.values()) {
    const ct = div(sum.momentT, sum.area), co = div(sum.momentO, sum.area), u = selected === 0 ? ct : co, v = selected === 0 ? co : ct;
    output[sum.side].push({ areaUV: text(sum.area), areaWorld: text(mul(rational(25n), sum.area)), centroidWorld: [text(add(rational(20n), mul(rational(5n), u))), text(add(rational(-11n), mul(rational(5n), v))), text(rational(3n))] });
  }
  return output;
}
