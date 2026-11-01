import { bezierCurve, bezierPoint, bezierTangent } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/bezier';
import { outlineCurve, curvesSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/curveSource';
import { toWorld, tiltPlane, offsetPlane, standardPlane, xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
import { emptyDirect, importSource, geometryOf, modelOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/direct';
import { copyLoftGuide } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/loftGuides';
import { loadDirect } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/directModule';
import { evaluateCurve } from '@barocss/cad';
await loadDirect();
// exact rational of a double
type R = [bigint, bigint];
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const norm = ([n, d]: R): R => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return [n / g, d / g]; };
function rat(x: number): R { if (x === 0) return [0n, 1n]; const buf = new DataView(new ArrayBuffer(8)); buf.setFloat64(0, x); const hi = buf.getUint32(0), lo = buf.getUint32(4); const sign = hi >>> 31 ? -1n : 1n; const e = (hi >>> 20) & 0x7ff; let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo); let ex: number; if (e === 0) ex = -1074; else { m |= 1n << 52n; ex = e - 1075; } return norm(ex >= 0 ? [sign * m * (1n << BigInt(ex)), 1n] : [sign * m, 1n << BigInt(-ex)]); }
const add = (a: R, b: R): R => norm([a[0] * b[1] + b[0] * a[1], a[1] * b[1]]), mul = (a: R, b: R): R => norm([a[0] * b[0], a[1] * b[1]]);
const sub = (a: R, b: R): R => add(a, [-b[0], b[1]]);
// nearest double of rational (via string division with high precision)
function toD([n, d]: R): number { const neg = n < 0n; if (neg) n = -n; const s = 400n; const q = (n * 10n ** s) / d; let str = q.toString().padStart(Number(s) + 1, '0'); str = str.slice(0, -Number(s)) + '.' + str.slice(-Number(s)); return (neg ? -1 : 1) * Number(str); }
const binom = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]];
function exactPt(poles: number[][], t: number, k: number): number { const T = rat(t), S = sub([1n, 1n], T), n = poles.length - 1; let acc: R = [0n, 1n]; for (let i = 0; i <= n; i++) { let b: R = [BigInt(binom[n][i]), 1n]; for (let j = 0; j < i; j++) b = mul(b, T); for (let j = 0; j < n - i; j++) b = mul(b, S); acc = add(acc, mul(b, rat(poles[i][k]))); } return toD(acc); }
function exactTan(poles: number[][], t: number, k: number): number { const n = poles.length - 1; const legs = poles.slice(1).map((b, i) => b.map((v, kk) => toD(sub(rat(v), rat(poles[i][kk]))))); /* legs exact only if subtraction exact */ return n * exactPt(legs, t, k); }
const ulps = (a: number, b: number) => { if (a === b) return 0; const d = Math.abs(a - b), u = Math.max(Number.EPSILON * Math.max(Math.abs(a), Math.abs(b)), Number.MIN_VALUE); return d / u; };
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let dyadicMis = 0, dyadicN = 0, maxUlpNon = 0, nonN = 0, maxTanUlpNon = 0, tanMisDy = 0;
for (let trial = 0; trial < 400; trial++) {
  const deg = trial % 2 ? 3 : 2;
  const dy = Array.from({ length: deg + 1 }, () => [Math.round((rnd() - 0.5) * 2000) / 8, Math.round((rnd() - 0.5) * 2000) / 16]);
  const non = Array.from({ length: deg + 1 }, () => [(rnd() - 0.5) * 300 / 3, (rnd() - 0.5) * 1e3 * Math.PI]);
  for (const t of [0, 1 / 8, 1 / 4, 3 / 8, 1 / 2, 5 / 8, 3 / 4, 1, 0.1, 1 / 3, 0.7]) {
    const dyT = [0, 1 / 8, 1 / 4, 3 / 8, 1 / 2, 5 / 8, 3 / 4, 1].includes(t);
    for (const k of [0, 1]) {
      const p = bezierPoint(dy as any, t)[k], e = exactPt(dy, t, k);
      if (dyT) { dyadicN++; if (p !== e) dyadicMis++; const tg = bezierTangent(dy as any, t)[k], et = exactTan(dy, t, k); if (tg !== et) tanMisDy++; }
      const pn = bezierPoint(non as any, t)[k], en = exactPt(non, t, k); nonN++; maxUlpNon = Math.max(maxUlpNon, ulps(pn, en));
      const tn = bezierTangent(non as any, t)[k], etn = exactTan(non, t, k); maxTanUlpNon = Math.max(maxTanUlpNon, ulps(tn, etn));
    }
  }
}
console.log('dyadic poles+dyadic t: point mismatches', dyadicMis, '/', dyadicN, 'tangent mismatches', tanMisDy);
console.log('non-dyadic: max point ulps (rel to max magnitude)', maxUlpNon.toFixed(2), 'over', nonN, ' max tangent ulps', maxTanUlpNon.toFixed(2));
// mapping vs outlineCurve, bitwise
const planes = [xyPlane(), standardPlane('xz'), standardPlane('yz'), tiltPlane({ origin: [5, -2, 7], normal: [0, 0, 1], xAxis: [1, 0, 0] }, 30), offsetPlane(tiltPlane(standardPlane('xz'), 17), 12.3), { origin: [1.1, 2.2, 3.3], normal: [0.3, 0.4, Math.sqrt(1 - 0.25)], xAxis: [0.4 / 0.5 * 1, -0.3 / 0.5, 0] } as any];
let mapMis = 0, mapN = 0;
for (const P of planes) for (let trial = 0; trial < 50; trial++) {
  const poles = Array.from({ length: 4 }, () => [(rnd() - 0.5) * 100, (rnd() - 0.5) * 100] as [number, number]);
  const c = bezierCurve(P, poles), o = outlineCurve(P, poles, undefined, false);
  // outline open polyline: spans are line p0,p1(mid),p2; fromSpans packs; the poles at even index are the vertices
  const verts = o.points.filter((_, i) => i % 2 === 0);
  for (let i = 0; i < 4; i++) { mapN++; if (!c.points[i].every((v, k) => Object.is(v, verts[i][k]))) mapMis++; }
}
console.log('bezierCurve poles vs outlineCurve vertices (bitwise):', mapMis, 'mismatches of', mapN);
// kernel evaluation of made curve vs exact on world poles (after source), and source rounding
let srcMaxDiff = 0, kernMaxUlp = 0, kernVsSketch = 0;
for (const P of planes) for (let trial = 0; trial < 20; trial++) {
  const poles = Array.from({ length: trial % 2 ? 4 : 3 }, () => [(rnd() - 0.5) * 100, (rnd() - 0.5) * 100] as [number, number]);
  const c = bezierCurve(P, poles), src = curvesSource('sketch', [c]), d = importSource(emptyDirect(), src, 'x'), g = geometryOf(d, d.objects[0]) as any;
  for (let i = 0; i < c.points.length; i++) for (let k = 0; k < 3; k++) srcMaxDiff = Math.max(srcMaxDiff, Math.abs(g.controlPoints[i][k] - c.points[i][k]));
  for (const t of [0, 0.125, 0.3, 0.5, 0.9, 1]) { const e = evaluateCurve(g, t); for (let k = 0; k < 3; k++) { kernMaxUlp = Math.max(kernMaxUlp, ulps(e[k], exactPt(g.controlPoints, t, k))); const w = toWorld(P, bezierPoint(poles, t)); kernVsSketch = Math.max(kernVsSketch, Math.abs(e[k] - w[k])); } }
}
console.log('source round-trip max |pole diff| mm:', srcMaxDiff, ' kernel evaluate vs exact Bernstein (max ulps):', kernMaxUlp.toFixed(2), ' kernel vs toWorld(bezierPoint) max mm:', kernVsSketch);
// tiny/huge values
for (const v of [1e-12, 4e-10, 6e-10, 1e-7, 123456.123456789123, 1e15, 1e20, 1e21, 1.5e21, 1e300, -1e21]) {
  const c = bezierCurve(xyPlane(), [[0, 0], [v, 1], [2, 0]]), src = curvesSource('s', [c]);
  const frag = src.match(/control-points: \[(\[[^\]]*\]),(\[[^\]]*\])/)![2];
  let res: string; try { const d = importSource(emptyDirect(), src, 'x'), g = geometryOf(d, d.objects[0]) as any; res = 'parsed x1 = ' + g.controlPoints[1][0] + (g.controlPoints[1][0] === v ? ' (same)' : ' (CHANGED)'); const lg = copyLoftGuide({ direct: d }, d.objects[0].id); res += ' loftGuide ' + (lg.ok ? lg.guide.kind : 'refused: ' + lg.reason); } catch (e: any) { res = 'THROWS ' + (e.code ?? '') + ' ' + String(e.message).slice(0, 120); }
  console.log('pole x', v, '-> source', frag, '->', res);
}
