// Independent bounded quadratic arc-length/inverse oracle. No CAD imports.
// Fixed-point square-root enclosure + rigorous Simpson remainder, not an estimator.
import assert from 'node:assert/strict';
const Q = 1n << 80n, T = 1n << 40n, N = 128n;
function ceil(n, d) { return (n + d - 1n) / d; }
function sqrt(n) { if (n === 0n) return 0n; let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2)); for (;;) { const next = (x + n / x) >> 1n; if (next >= x) return x; x = next; } }
function down(x) { if (x === 0) return -Number.MIN_VALUE; if (!Number.isFinite(x)) return x; const d = new DataView(new ArrayBuffer(8)); d.setFloat64(0, x); d.setBigUint64(0, d.getBigUint64(0) + (x > 0 ? -1n : 1n)); return d.getFloat64(0); }
function up(x) { return -down(-x); }
function display(lo, hi, den) { return [down(down(Number(lo) / Number(den))), up(up(Number(hi) / Number(den)))]; }
function represented(x) {
  assert.ok(Number.isFinite(x)); const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, x); const bits = view.getBigUint64(0), exponent = Number(bits >> 52n & 2047n), fraction = bits & ((1n << 52n) - 1n), m = (exponent ? fraction + (1n << 52n) : fraction) * (bits >> 63n ? -1n : 1n), e = exponent ? exponent - 1075 : -1074;
  return e >= 0 ? [m << BigInt(e), 1n] : [m, 1n << BigInt(-e)];
}
function run(name, points, minimumSpeed, fourthBound) {
  const v = points[0].map((x, k) => 2n * BigInt(points[1][k] - x)), d = points[0].map((x, k) => 2n * BigInt(points[2][k] - 2 * points[1][k] + x));
  const A = d.reduce((s, x) => s + x * x, 0n), B = d.reduce((s, x, k) => s + x * v[k], 0n), C = v.reduce((s, x) => s + x * x, 0n), delta = A * C - B * B;
  assert.ok(delta > 0n); const m = BigInt(minimumSpeed), M = BigInt(fourthBound);
  assert.ok(B < 0n && -B < A); assert.ok(delta >= A * m * m); assert.ok(M * m ** 3n >= 15n * A * A);
  let evaluations = 0, inverseIterations = 0;
  function speed(t) { evaluations++; let numerator = 0n; for (let k = 0; k < v.length; k++) numerator += (v[k] * T + d[k] * t) ** 2n; const floor = sqrt(numerator * Q * Q / (T * T)); return [floor, floor + 1n]; }
  function panel(a, b) { if (a === b) return [0n, 0n]; const fa = speed(a), fm = speed((a + b) / 2n), fb = speed(b), h = b - a; assert.equal((a + b) % 2n, 0n);
    const error = ceil(M * h ** 5n * Q, 2880n * T ** 5n), lo = (fa[0] + 4n * fm[0] + fb[0]) * h / (6n * T) - error;
    return [lo > 0n ? lo : 0n, ceil((fa[1] + 4n * fm[1] + fb[1]) * h, 6n * T) + error]; }
  const prefix = [[0n, 0n]];
  for (let i = 0n; i < N; i++) { const p = panel(i * T / N, (i + 1n) * T / N), prior = prefix.at(-1); prefix.push([prior[0] + p[0], prior[1] + p[1]]); }
  function length(t) { const i = t * N / T, prior = prefix[Number(i)]; if (i === N || t === i * T / N) return prior; const p = panel(i * T / N, t); return [prior[0] + p[0], prior[1] + p[1]]; }
  function point(t) { return points[0].map((_, k) => 2n * (T - t) * t * BigInt(points[1][k] - points[0][k]) + t * t * BigInt(points[2][k] - points[0][k])); }
  const offsets = [];
  for (const distance of [10, 20]) {
    const target = BigInt(distance) * Q; assert.ok(target <= prefix.at(-1)[0]); let a = 0n, b = T;
    for (;;) { inverseIterations++; const mid = (a + b) / 2n, bound = length(mid);
      if (target < bound[0]) b = mid; else if (target > bound[1]) a = mid; else {
        const residual = target - bound[0] > bound[1] - target ? target - bound[0] : bound[1] - target;
        assert.ok(100000000n * residual <= 3n * Q); // <=3e-8 mm, strictly inside the inherited1e-7 world budget.
        const p = point(mid), stored = p.map(x => Number(x) / Number(T * T)); let rounding = 0n;
        for (let axis = 0; axis < p.length; axis++) { const [n, den] = represented(stored[axis]), difference = n * T * T - p[axis] * den; rounding += ceil((difference < 0n ? -difference : difference) * Q, den * T * T); }
        offsets.push({ distance, parameter: Number(mid) / Number(T), exactParameter: { n: String(mid), d: String(T) }, offset: stored, exactOffset: p.map(n => ({ n: String(n), d: String(T * T) })), exactOffsetCurveResidualUpper: display(residual, residual, Q)[1], offsetRoundingL1Upper: display(rounding, rounding, Q)[1], worldEuclideanResidualUpper: display(residual + rounding, residual + rounding, Q)[1] }); break;
      }
      assert.ok(b - a > 2n, 'Independent oracle exhausted its40-bit parameter grid');
    }
  }
  const q = t => Number(A) * t * t + 2 * Number(B) * t + Number(C), primitive = t => (Number(A) * t + Number(B)) * Math.sqrt(q(t)) / (2 * Number(A)) + Number(delta) / (2 * Number(A) ** 1.5) * Math.asinh((Number(A) * t + Number(B)) / Math.sqrt(Number(delta)));
  const result = { name, points, authority: 'exact fixed-point sqrt intervals and Simpson fourth-derivative bound at128 uniform panels; analyticNumber only crosscheck', speedSquared: { A: String(A), B: String(B), C: String(C), delta: String(delta) }, certifiedMinimumSpeed: minimumSpeed, certifiedFourthDerivativeBound: fourthBound, totalLength: display(prefix.at(-1)[0], prefix.at(-1)[1], Q), analyticLengthCrosscheck: primitive(1) - primitive(0), offsets, work: { panels: Number(N), evaluations, inverseIterations } };
  assert.ok(result.analyticLengthCrosscheck >= result.totalLength[0] && result.analyticLengthCrosscheck <= result.totalLength[1]);
  const cx = offsets.reduce((s, o) => s + o.offset[0], 25.5), cy = offsets.reduce((s, o) => s + o.offset[1], 25.5);
  result.stockMinusThreeCutsGuide = { volume: 23550, centroid: [(720000 - 150 * cx) / 23550, (480000 - 150 * cy) / 23550, 5], centroidFromCurvePositionErrorUpper: 150 / 23550 * offsets.reduce((s, o) => s + o.worldEuclideanResidualUpper, 0) };
  return result;
}
console.log(JSON.stringify({ status: 'PASS', productImports: 0, cases: [run('authorable right quadratic', [[0, 0], [20, 0], [20, 20]], 28, 7000), run('asymmetric quadratic', [[0, 0], [20, 0], [24, 18]], 29, 3400), run('live middle-pole edit', [[0, 0], [20, 5], [20, 20]], 26, 3500)] }, null, 2));
