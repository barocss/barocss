import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSurface, surfaceDomain, type Surface } from '@barocss/cad';
import { directOps, emptyDirect, geometryOf, importSource, type DirectGeometry } from '../src/engine/direct';
import { isRefusal } from '../src/engine/refusal';

// Exact rational arithmetic (BigInt) for the oracle: the stored poles are compared with the true affine plane without rounding.
type Q = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const q = (n: bigint, d = 1n): Q => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; };
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const abs = (a: Q) => (a.n < 0n ? q(-a.n, a.d) : a);
const le = (a: Q, b: Q) => a.n * b.d <= b.n * a.d;
const lt = (a: Q, b: Q) => a.n * b.d < b.n * a.d;
const toNum = (a: Q) => Number(a.n) / Number(a.d);
/** The binary64 value exactly, as a rational. */
function exact(x: number): Q {
  if (!Number.isFinite(x)) throw new RangeError('not finite');
  if (x === 0) return q(0n);
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, x);
  const bits = view.getBigUint64(0), sign = bits >> 63n ? -1n : 1n, e = Number((bits >> 52n) & 0x7ffn), f = bits & ((1n << 52n) - 1n);
  const m = e === 0 ? f : f | (1n << 52n), p = (e === 0 ? 1 : e) - 1075;
  return p >= 0 ? q(sign * m * (1n << BigInt(p))) : q(sign * m, 1n << BigInt(-p));
}
const dec = (s: string): Q => { const [i, f = ''] = s.split('.'); return q(BigInt(i + f), 10n ** BigInt(f.length)); };
type V3 = [Q, Q, Q];
const vadd = (a: V3, b: V3): V3 => [add(a[0], b[0]), add(a[1], b[1]), add(a[2], b[2])];
const vscale = (a: V3, k: Q): V3 => [mul(a[0], k), mul(a[1], k), mul(a[2], k)];
const vsub = (a: V3, b: V3): V3 => [sub(a[0], b[0]), sub(a[1], b[1]), sub(a[2], b[2])];
const l1 = (a: V3) => add(add(abs(a[0]), abs(a[1])), abs(a[2]));
const maxQ = (a: Q, b: Q) => (lt(a, b) ? b : a);
/** Greville abscissae of a knot vector, degree p. */
function greville(U: readonly Q[], p: number): Q[] {
  const out: Q[] = [];
  for (let i = 0; i + p + 1 < U.length; i++) { let s = q(0n); for (let k = 1; k <= p; k++) s = add(s, U[i + k]); out.push(div(s, q(BigInt(p)))); }
  return out;
}
interface Affine { origin: V3; ds: V3; dt: V3 }
interface Bound { position: Q; derivS: Q; derivT: Q; knotsOk: boolean }
const same = (a: Q, b: Q) => le(a, b) && le(b, a);
function validKnots(K: readonly Q[], deg: number, count: number): boolean {
  if (K.length !== count + deg + 1) return false;
  for (let i = 1; i < K.length; i++) if (lt(K[i], K[i - 1])) return false;
  const first = K[0], last = K[K.length - 1];
  for (let i = 0; i <= deg; i++) if (!same(K[i], first) || !same(K[K.length - 1 - i], last)) return false;
  return lt(first, last);
}
/** Max L1 pole residuals against T(s,t) = origin + s·ds + t·dt (s, t normalized to [0,1]) and of the derivative nets against ds and dt. */
function affineBound(g: Surface, T: Affine): Bound {
  const p = g.degreeU, r = g.degreeV, U = g.knotsU.map(exact), V = g.knotsV.map(exact), P = g.controlPoints.map(row => row.map(c => c.map(exact) as V3));
  const n = P.length, m = P[0].length;
  const knotsOk = validKnots(U, p, n) && validKnots(V, r, m) && g.weights.every(row => row.every(w => w === 1));
  const u0 = U[0], lu = sub(U[U.length - 1], u0), v0 = V[0], lv = sub(V[V.length - 1], v0);
  const gu = greville(U, p).map(x => div(sub(x, u0), lu)), gv = greville(V, r).map(x => div(sub(x, v0), lv));
  const Tat = (s: Q, t: Q) => vadd(vadd(T.origin, vscale(T.ds, s)), vscale(T.dt, t));
  let position = q(0n), derivS = q(0n), derivT = q(0n);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) position = maxQ(position, l1(vsub(P[i][j], Tat(gu[i], gv[j]))));
  // Derivative nets, scaled to normalized units (times the knot interval).
  for (let i = 0; i + 1 < n; i++) for (let j = 0; j < m; j++) {
    const span = sub(U[i + p + 1], U[i + 1]);
    if (span.n === 0n) { derivS = q(10n ** 30n); continue; }
    derivS = maxQ(derivS, l1(vsub(vscale(vsub(P[i + 1][j], P[i][j]), mul(div(q(BigInt(p)), span), lu)), T.ds)));
  }
  for (let i = 0; i < n; i++) for (let j = 0; j + 1 < m; j++) {
    const span = sub(V[j + r + 1], V[j + 1]);
    if (span.n === 0n) { derivT = q(10n ** 30n); continue; }
    derivT = maxQ(derivT, l1(vsub(vscale(vsub(P[i][j + 1], P[i][j]), mul(div(q(BigInt(r)), span), lv)), T.dt)));
  }
  return { position, derivS, derivT, knotsOk };
}

const SOURCE = `@model d347 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1;
  knots-u:[2,2,5,5]; knots-v:[-1,-1,3,3];
  control-points:[[[7,-11,13],[7,-11,21]],[[16,1,13],[16,1,21]]];
  weights:[[1,1],[1,1]]; }
}`;
const imported = importSource(emptyDirect(), SOURCE, 'd347');
const panel = imported.objects[0].id;
const A: V3 = [q(7n), q(-11n), q(13n)], UU: V3 = [q(3n), q(4n), q(0n)], VV: V3 = [q(0n), q(0n), q(2n)];
type Edge = 'u-min' | 'u-max' | 'v-min' | 'v-max';
const EDGES: Edge[] = ['u-min', 'u-max', 'v-min', 'v-max'];
/** The affine map the extended plane should be, over normalized s, t. */
function expected(edge: Edge, reach: string): Affine {
  const r = dec(reach), du = div(r, q(5n)), dv = div(r, q(2n)), three = q(3n), four = q(4n);
  switch (edge) {
    case 'u-max': return { origin: A, ds: vscale(UU, add(three, du)), dt: vscale(VV, four) };
    case 'u-min': return { origin: vsub(A, vscale(UU, du)), ds: vscale(UU, add(three, du)), dt: vscale(VV, four) };
    case 'v-max': return { origin: A, ds: vscale(UU, three), dt: vscale(VV, add(four, dv)) };
    case 'v-min': return { origin: vsub(A, vscale(VV, dv)), ds: vscale(UU, three), dt: vscale(VV, add(four, dv)) };
  }
}
const asNum = (v: V3) => v.map(toNum);
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm1 = (v: number[]) => Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]);
const surfaceOfLast = (d: DirectGeometry) => geometryOf(d, d.objects[d.objects.length - 1]) as Surface;

for (const reach of ['0.5', '2.5', '10']) for (const edge of EDGES) {
  test(`extend ${edge} by ${reach} stays the exact plane`, () => {
    const next = directOps.extendSurface(imported, panel, edge, Number(reach));
    const T = expected(edge, reach), b = affineBound(surfaceOfLast(next), T);
    assert.ok(b.knotsOk, `${edge} ${reach}: knots/weights invalid`);
    assert.ok(le(b.position, dec('0.0000001')), `${edge} ${reach}: pole residual ${toNum(b.position)}`);
    const es = toNum(b.derivS), et = toNum(b.derivT), ts = asNum(T.ds), tt = asNum(T.dt);
    if (reach === '2.5') console.log(`oracle ${edge} ${reach}: position=${toNum(b.position)} e_s=${es} e_t=${et}`);
    const c = cross(ts, tt), area = Math.hypot(c[0], c[1], c[2]);
    // L1 norms bound the Euclidean ones from above, so this is a lower bound of the Jacobian.
    const jac = area - norm1(tt) * es - norm1(ts) * et - es * et;
    assert.ok(jac > 0, `${edge} ${reach}: Jacobian bound ${jac} (area ${area}, e_s ${es}, e_t ${et})`);
    assert.ok(c[0] * 0.8 - c[1] * 0.6 > 0, `${edge} ${reach}: orientation flipped`);
  });
}

test('extend u-max 2.5: far corner and shared corner', () => {
  const s = surfaceOfLast(directOps.extendSurface(imported, panel, 'u-max', 2.5));
  const u0 = s.knotsU[0], u1 = s.knotsU[s.knotsU.length - 1], v0 = s.knotsV[0];
  const far = evaluateSurface(s, u1, v0), start = evaluateSurface(s, u0, v0);
  [17.5, 3, 13].forEach((x, k) => assert.ok(Math.abs(far[k] - x) < 1e-9, `far corner ${k}: ${far[k]}`));
  [7, -11, 13].forEach((x, k) => assert.ok(Math.abs(start[k] - x) < 1e-9, `start corner ${k}: ${start[k]}`));
});

test('identity and lifetime of the objects', () => {
  const before = JSON.parse(JSON.stringify(imported));
  const next = directOps.extendSurface(imported, panel, 'u-max', 2.5);
  assert.deepEqual(JSON.parse(JSON.stringify(imported)), before, 'input document mutated');
  const old = next.objects.find(o => o.id === panel)!, orig = imported.objects[0];
  assert.deepEqual(old, { ...orig, hidden: true }, 'original differs by more than hidden');
  assert.equal(next.sources[old.source], imported.sources[orig.source], 'original source text changed');
  assert.equal(next.objects.length, imported.objects.length + 1);
  const fresh = next.objects[next.objects.length - 1];
  assert.ok(!imported.objects.some(o => o.id === fresh.id), 'id not fresh');
  assert.equal(fresh.name, 'd347 · panel · extended');
  assert.ok(!(fresh.source in imported.sources), 'source key not new');
  assert.equal(fresh.geometry, 's1');
  assert.equal(fresh.trims, undefined);
});

function refuses(label: string, d: DirectGeometry, run: () => unknown, message?: RegExp) {
  const before = JSON.stringify(d);
  assert.throws(run, e => { assert.ok(isRefusal(e, 'DIRECT_VALUE'), `${label}: ${(e as Error).message}`); if (message) assert.match((e as Error).message, message); return true; }, label);
  assert.equal(JSON.stringify(d), before, `${label}: input changed`);
}
test('refusals are atomic', () => {
  for (const edge of ['x', 'U-MAX', undefined]) refuses(`edge ${String(edge)}`, imported, () => directOps.extendSurface(imported, panel, edge as never, 2.5), /Extend at u-min/);
  for (const dist of [0, -1, NaN, Infinity, '5']) refuses(`distance ${String(dist)}`, imported, () => directOps.extendSurface(imported, panel, 'u-max', dist as never), /Extend by a positive distance/);
  const trimmed: DirectGeometry = { ...imported, objects: imported.objects.map(o => ({ ...o, trims: [{ keep: 'outside' as const, uv: [[3, 0], [4, 0], [4, 1]] as [number, number][] }] })) };
  refuses('trimmed', trimmed, () => directOps.extendSurface(trimmed, panel, 'u-max', 2.5), /This operation does not preserve surface trims/);
});

test('exponent-sized numbers are written as plain decimals', () => {
  const src = `@model tiny { version:0; length-unit:mm;
 @surface #p { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1];
  control-points:[[[0,0,0.0000005],[0,10,0.0000005]],[[20,0,0.0000005],[20,10,0.0000005]]]; weights:[[1,1],[1,1]]; }
}`;
  const d = importSource(emptyDirect(), src, 'TINY'), id = d.objects[0].id;
  const next = directOps.extendSurface(d, id, 'u-max', 5), last = next.objects[next.objects.length - 1];
  assert.doesNotThrow(() => geometryOf(next, last));
  assert.ok(!/\d[eE][-+]?\d/.test(next.sources[last.source]), next.sources[last.source]);
});

// No wrong success: whatever the reach, the answer is a coded refusal (input untouched) or a plane within 1e-7 mm of the true one.
test('no wrong success over a range of reaches', () => {
  const reaches = ['0.000001', '0.0001', '0.001', '0.01', '0.5', '2.5', '10', '100', '700', '1000', '100000'];
  const outcomes: string[] = [];
  for (const edge of EDGES) for (const reach of reaches) {
    const before = JSON.stringify(imported), label = `${edge} ${reach}`;
    let next: DirectGeometry | undefined;
    try { next = directOps.extendSurface(imported, panel, edge, Number(reach)); } catch (e) { assert.ok(isRefusal(e, 'DIRECT_VALUE'), `${label}: uncoded ${(e as Error).message}`); }
    assert.equal(JSON.stringify(imported), before, `${label}: input changed`);
    if (next) {
      const b = affineBound(surfaceOfLast(next), expected(edge, reach));
      assert.ok(b.knotsOk && le(b.position, dec('0.0000001')), `${label}: accepted with pole residual ${toNum(b.position)}`);
    }
    outcomes.push(`${label}:${next ? 'ok' : 'refused'}`);
    if (['0.5', '2.5', '10'].includes(reach)) assert.ok(next, `${label}: must succeed`);
  }
  console.log(`# reach outcomes: ${outcomes.join(' ')}`);
});

/** The fixture source, translated by an offset and with a chosen v knot vector. */
function shifted(off: number[], kv = '-1,-1,3,3'): string {
  const P = (x: number, y: number, z: number) => `[${x + off[0]},${y + off[1]},${z + off[2]}]`;
  return `@model d347 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[2,2,5,5]; knots-v:[${kv}];
  control-points:[[${P(7, -11, 13)},${P(7, -11, 21)}],[${P(16, 1, 13)},${P(16, 1, 21)}]]; weights:[[1,1],[1,1]]; }
}`;
}
function succeedsExactly(d: DirectGeometry, id: string, edge: Edge, reach: string, off: V3, label: string) {
  const next = directOps.extendSurface(d, id, edge, Number(reach)), T = expected(edge, reach);
  const b = affineBound(surfaceOfLast(next), { ...T, origin: vadd(T.origin, off) });
  assert.ok(b.knotsOk, `${label} ${edge} ${reach}: knots invalid`);
  assert.ok(le(b.position, dec('0.0000001')), `${label} ${edge} ${reach}: pole residual ${toNum(b.position)}`);
}
test('a plane 1e5 mm from the origin extends exactly', () => {
  const d = importSource(emptyDirect(), shifted([1e5, -1e5, 1e5]), 'd347'), id = d.objects[0].id, off: V3 = [q(100000n), q(-100000n), q(100000n)];
  for (const edge of EDGES) for (const reach of ['2.5', '18']) succeedsExactly(d, id, edge, reach, off, 'offset');
  for (const edge of EDGES) { const out = directOps.extendSurface(d, id, edge, 2.5); assert.equal(out.objects[out.objects.length - 1].name, 'd347 · panel · extended', `offset ${edge}: plane name carries a label`); }
});
test('odd domains (end knots that overshoot when sampled) extend without uncoded errors', () => {
  const zero: V3 = [q(0n), q(0n), q(0n)];
  for (const kv of ['121.53304674241028,121.53304674241028,194.9592330046747,194.9592330046747', '-0.00047245177520403137,-0.00047245177520403137,0.0003746328395716221,0.0003746328395716221']) {
    const d = importSource(emptyDirect(), shifted([0, 0, 0], kv), 'd347'), id = d.objects[0].id;
    for (const edge of EDGES) succeedsExactly(d, id, edge, '2.5', zero, `kv ${kv.slice(0, 8)}`);
  }
  // The same ends in u.
  const a = -0.00047245177520403137, b = 0.0003746328395716221;
  const du = importSource(emptyDirect(), shifted([0, 0, 0]).replace('knots-u:[2,2,5,5]', `knots-u:[${a},${a},${b},${b}]`), 'd347');
  for (const edge of EDGES) succeedsExactly(du, du.objects[0].id, edge, '2.5', zero, 'odd u');
});
test('a surface whose poles all coincide has no direction to extend in', () => {
  const src = `@model t { version:0; length-unit:mm; @surface #p { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[1,1,1],[1,1,1]],[[1,1,1],[1,1,1]]]; weights:[[1,1],[1,1]]; } }`;
  const d = importSource(emptyDirect(), src, 'T');
  for (const edge of EDGES) refuses(`degenerate ${edge}`, d, () => directOps.extendSurface(d, d.objects[0].id, edge, 3));
});

// Audit regression: affine parallelogram supports (rational, offset 1e5) that once passed with a plane error above 1e-7 mm.
type N3 = number[];
const dot3 = (a: N3, b: N3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub3 = (a: N3, b: N3) => a.map((x, k) => x - b[k]);
const cross3 = (a: N3, b: N3) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len3 = (a: N3) => Math.hypot(a[0], a[1], a[2]);
/** The largest deviation of a dense sample (61 x 61, boundary included) of the extended surface from the exact extended parallelogram. */
function parallelogramDeviation(g0: Surface, g: Surface, edge: Edge, D: number): number {
  const dm0 = surfaceDomain(g0), dm = surfaceDomain(g), o = evaluateSurface(g0, dm0.u[0], dm0.v[0]);
  const eu = sub3(evaluateSurface(g0, dm0.u[1], dm0.v[0]), o), ev = sub3(evaluateSurface(g0, dm0.u[0], dm0.v[1]), o), nn = cross3(eu, ev).map(x => x / len3(cross3(eu, ev)));
  const g11 = dot3(eu, eu), g12 = dot3(eu, ev), g22 = dot3(ev, ev), det = g11 * g22 - g12 * g12, Lu = len3(eu), Lv = len3(ev);
  const s0 = edge === 'u-min' ? -D / Lu : 0, s1 = edge === 'u-max' ? 1 + D / Lu : 1, t0 = edge === 'v-min' ? -D / Lv : 0, t1 = edge === 'v-max' ? 1 + D / Lv : 1;
  let worst = 0; const N = 60;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const p = evaluateSurface(g, i === N ? dm.u[1] : dm.u[0] + (dm.u[1] - dm.u[0]) * i / N, j === N ? dm.v[1] : dm.v[0] + (dm.v[1] - dm.v[0]) * j / N), r = sub3(p, o), x = dot3(r, eu), y = dot3(r, ev);
    const s = (g22 * x - g12 * y) / det, t = (g11 * y - g12 * x) / det;
    worst = Math.max(worst, Math.abs(dot3(r, nn)), (s0 - s) * Lu, (s - s1) * Lu, (t0 - t) * Lv, (t - t1) * Lv);
    if (i === 0) worst = Math.max(worst, Math.abs(s - s0) * Lu);
    if (i === N) worst = Math.max(worst, Math.abs(s - s1) * Lu);
    if (j === 0) worst = Math.max(worst, Math.abs(t - t0) * Lv);
    if (j === N) worst = Math.max(worst, Math.abs(t - t1) * Lv);
  }
  return worst;
}
const AUDIT: { label: string; edge: Edge; reach: number; source: string }[] = [
  { label: 'audit trial 21 v-max', edge: 'v-max', reach: 18, source: "@model p { version:0; length-unit:mm; @surface #s { type:nurbs; degree-u:1; degree-v:2; knots-u:[2,2,3.5,5,5]; knots-v:[-3,-3,-3,0.333333333333,3.666666666667,7,7,7];\n control-points:[[[84957.408905029297,-97600.269317626953,91894.059628248215],[84955.558069864346,-97598.603203073566,91893.740567906134],[84953.553452075095,-97596.798654005164,91893.394997403855],[84951.90522578769,-97595.314927168351,91893.110864244387],[84950.725894054471,-97594.253297369432,91892.90756251695]],[[84938.089854133592,-97607.283482171973,91893.982465183057],[84936.239018968641,-97605.617367618586,91893.663404840976],[84934.23440117939,-97603.812818550185,91893.317834338697],[84932.586174891985,-97602.329091713371,91893.033701179229],[84931.406843158766,-97601.267461914453,91892.830399451792]],[[84898.967991025274,-97621.487450401633,91893.826206840546],[84897.117155860324,-97619.821335848246,91893.507146498465],[84895.112538071073,-97618.016786779845,91893.161575996186],[84893.464311783668,-97616.533059943031,91892.877442836718],[84892.284980050448,-97615.471430144113,91892.674141109281]]]; weights:[[1.512013639144,1.543792251746,0.624731886947,0.873660337755,1.500517926939],[3.820344046689,3.90063778897,1.578484931145,2.207442435546,3.791298293035],[2.691080265422,2.747639806304,1.111897147366,1.554939739132,2.670620209077]]; } }" },
  { label: 'audit trial 141 u-min', edge: 'u-min', reach: 180, source: "@model p { version:0; length-unit:mm; @surface #s { type:nurbs; degree-u:1; degree-v:3; knots-u:[2,2,3.5,5,5]; knots-v:[5,5,5,5,303.333333333333,601.666666666667,900,900,900,900];\n control-points:[[[-84905.475378036499,-63634.264469146729,53935.903310775757],[-84905.68840780796,-63631.4863988164,53935.487615972284],[-84905.925540437762,-63628.394008871597,53935.024888151347],[-84906.187329028413,-63624.980086434618,53934.514048018536],[-84906.322183964134,-63623.22147545153,53934.250899372149],[-84906.442521584715,-63621.652181305108,53934.016079031331]],[[-84908.526814973855,-63663.293074812238,53942.15050477234],[-84908.739844745316,-63660.515004481909,53941.734809968868],[-84908.976977375118,-63657.422614537107,53941.272082147931],[-84909.238765965769,-63654.008692100128,53940.76124201512],[-84909.37362090149,-63652.250081117039,53940.498093368733],[-84909.493958522071,-63650.680786970617,53940.263273027915]],[[-84910.474297481735,-63681.819658491469,53946.137577512651],[-84910.687327253196,-63679.041588161141,53945.721882709178],[-84910.924459882997,-63675.949198216338,53945.259154888241],[-84911.186248473648,-63672.535275779359,53944.74831475543],[-84911.321103409369,-63670.776664796271,53944.485166109043],[-84911.441441029951,-63669.207370649849,53944.250345768225]]]; weights:[[0.616901255017,0.914803146319,0.328715188624,1.645763631956,0.452761957752,1.421452890281],[1.003372879454,1.487902090635,0.53464618956,2.676789163367,0.7364048388,2.311953927684],[1.025243493174,1.520334033479,0.54629992321,2.735135390378,0.752456324843,2.362347806496]]; } }" },
];
test('audit regressions: refuse, or stay on the exact extended parallelogram', () => {
  const seen: string[] = [];
  for (const c of AUDIT) {
    const d = importSource(emptyDirect(), c.source, 'P'), id = d.objects[0].id, before = JSON.stringify(d);
    let next: DirectGeometry | undefined;
    try { next = directOps.extendSurface(d, id, c.edge, c.reach); } catch (e) { assert.ok(isRefusal(e, 'DIRECT_VALUE'), `${c.label}: uncoded ${(e as Error).message}`); }
    assert.equal(JSON.stringify(d), before, `${c.label}: input changed`);
    if (next) { const dev = parallelogramDeviation(geometryOf(d, d.objects[0]) as Surface, surfaceOfLast(next), c.edge, c.reach); assert.ok(dev <= 1e-7, `${c.label}: accepted with deviation ${dev}`); }
    seen.push(`${c.label}:${next ? 'ok' : 'refused'}`);
  }
  console.log(`# audit outcomes: ${seen.join(' ')}`);
});

// A curved support is re-fitted: its loss between the sample rows is shown in the name, near an independent dense measurement.
test('a curved support names its measured deviation', () => {
  const w = Math.SQRT1_2.toFixed(15), R = 10;
  const src = `@model c { version:0; length-unit:mm; @surface #s { type:nurbs; degree-u:2; degree-v:1; knots-u:[0,0,0,1,1,1]; knots-v:[0,0,1,1];
 control-points:[[[${R},0,0],[${R},0,10]],[[${R},${R},0],[${R},${R},10]],[[0,${R},0],[0,${R},10]]]; weights:[[1,1],[${w},${w}],[1,1]]; } }`;
  const d = importSource(emptyDirect(), src, 'C'), id = d.objects[0].id;
  for (const D of [1, 10]) {
    const out = directOps.extendSurface(d, id, 'u-max', D), name = out.objects[out.objects.length - 1].name, g = surfaceOfLast(out), dm = surfaceDomain(g);
    // Dense measurement: radial distance off the cylinder where x >= 0, distance off the tangent plane y = R where x < 0.
    let dense = 0;
    for (let i = 0; i <= 200; i++) for (let j = 0; j <= 20; j++) {
      const p = evaluateSurface(g, i === 200 ? dm.u[1] : dm.u[0] + (dm.u[1] - dm.u[0]) * i / 200, j === 20 ? dm.v[1] : dm.v[0] + (dm.v[1] - dm.v[0]) * j / 20);
      dense = Math.max(dense, p[0] >= 0 ? Math.abs(Math.hypot(p[0], p[1]) - R) : Math.abs(p[1] - R));
    }
    const m = /\(±([0-9.e+-]+)\)$/.exec(name);
    assert.ok(m, `D=${D}: no deviation label in "${name}" (dense measurement ${dense})`);
    const label = Number(m[1]);
    assert.ok(label >= dense * 0.5 && label <= dense * 2, `D=${D}: label ${label} vs dense ${dense} (name "${name}")`);
  }
});

// A crease across the run (an exact C0 knot hit by a sample): the tangent comes from the iso-curve, so the run is still straight.
test('a crease across the run does not stop the extension', () => {
  const src = `@model fold { version:0; length-unit:mm; @surface #fold { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,10,10]; knots-v:[0,0,1,3,3];
 control-points:[[[0,0,0],[0,5,0],[0,10,4]],[[10,0,0],[10,5,0],[10,10,4]]]; weights:[[1,1,1],[1,1,1]]; } }`;
  const d = importSource(emptyDirect(), src, 'fold'), id = d.objects[0].id;
  for (const edge of ['u-max', 'u-min'] as const) {
    const out = directOps.extendSurface(d, id, edge, 2.5), last = out.objects[out.objects.length - 1], g = surfaceOfLast(out), dm = surfaceDomain(g), sign = edge === 'u-max' ? 1 : -1;
    assert.match(last.name, / · extended( \(±[\d.e-]+\))?$/, `${edge}: name`);
    // The far edge runs straight on along sign * x: its x is the near edge's x moved 2.5, and its ends are the original corners moved 2.5.
    const far = edge === 'u-max' ? dm.u[1] : dm.u[0], x = (edge === 'u-max' ? 10 : 0) + sign * 2.5;
    for (let k = 0; k <= 100; k++) { const p = evaluateSurface(g, far, k === 100 ? dm.v[1] : dm.v[0] + (dm.v[1] - dm.v[0]) * k / 100); assert.ok(Math.abs(p[0] - x) <= 1e-7, `${edge}: far edge x ${p[0]} at sample ${k}`); }
    const c0 = evaluateSurface(g, far, dm.v[0]), c1 = evaluateSurface(g, far, dm.v[1]);
    for (const [got, want] of [[c0, [x, 0, 0]], [c1, [x, 10, 4]]] as const) assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]) <= 1e-7, `${edge}: far corner ${got} vs ${want}`);
  }
  for (const edge of ['v-max', 'v-min'] as const) assert.doesNotThrow(() => directOps.extendSurface(d, id, edge, 2.5), edge);
});
