import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSurface, splitTrimmedSurfaceAtParameter } from '@barocss/cad';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { emptyDoc } from '../src/engine/doc';
import { directIGES, directOps, emptyDirect, geometryOf, importSource, type DirectGeometry, type DirectObject } from '../src/engine/direct';
import { isRefusal } from '../src/engine/refusal';
import { keptAt, type TrimLoop } from '../src/engine/trim';
import { trimSplitOracle, type Fraction } from './helpers/trimSplitOracle';

// S(u,v)=[20+5u,-11+5v,3]. The curve has eight straight spans; public Trim stores 160 samples.
const SOURCE = `@model d340 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #mask { type:nurbs; degree:1; knots:[0,0,1,2,3,4,5,6,7,8,8]; control-points:[[15,-1,3],[35,-1,3],[35,15,3],[29,15,3],[29,5,3],[21,5,3],[21,15,3],[15,15,3],[15,-1,3]]; weights:[1,1,1,1,1,1,1,1,1]; }
 @curve #witness { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[80,-3,1],[92,4,6]]; weights:[1,1]; }
}`;
const LOOP: [number, number][] = [[-1, 2], [3, 2], [3, 5.2], [1.8, 5.2], [1.8, 3.2], [0.2, 3.2], [0.2, 5.2], [-1, 5.2]];
function fixture(keep: TrimLoop['keep'], publicLoop = true): DirectGeometry {
  const d = importSource(emptyDirect(), SOURCE, 'D340');
  d.objects[1].hidden = true;
  if (publicLoop) return directOps.trimByCurve(d, d.objects[0].id, d.objects[1].id, keep);
  d.objects[0].trims = [{ keep, uv: structuredClone(LOOP) }];
  return d;
}
function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
}
function near(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) <= 1e-7, `${actual} != ${expected}`);
}
// Independent signed polygon moments in the original affine world chart, not display triangles.
function moments(o: DirectObject): { area: number; centroid: number[] } {
  let area = 0, mx = 0, my = 0;
  for (const loop of o.trims!) {
    let twice = 0, x = 0, y = 0;
    for (let i = 0; i < loop.uv.length; i++) {
      const p = loop.uv[i], q = loop.uv[(i + 1) % loop.uv.length];
      const px = 20 + 5 * p[0], py = -11 + 5 * p[1], qx = 20 + 5 * q[0], qy = -11 + 5 * q[1];
      const cross = px * qy - qx * py;
      twice += cross; x += (px + qx) * cross; y += (py + qy) * cross;
    }
    const signedArea = twice / 2, sign = loop.keep === 'inside' ? 1 : -1;
    area += sign * Math.abs(signedArea);
    mx += sign * Math.abs(signedArea) * x / (3 * twice);
    my += sign * Math.abs(signedArea) * y / (3 * twice);
  }
  return { area, centroid: [mx / area, my / area, 3] };
}
function made(d: DirectGeometry, out: DirectGeometry): DirectObject[] { return out.objects.slice(d.objects.length); }
function ownsResult(d: DirectGeometry, out: DirectGeometry): void {
  const result = made(d, out);
  assert.deepEqual(out.objects[0], { ...d.objects[0], hidden: true });
  assert.deepEqual(out.objects.slice(1, d.objects.length), d.objects.slice(1));
  for (const [key, text] of Object.entries(d.sources)) assert.equal(out.sources[key], text);
  assert.equal(new Set(result.map(o => o.source)).size, 1);
  for (const o of result) {
    assert.ok(o.trims && o.trims.length > 0);
    assert.equal(o.trims[0].keep, 'inside');
    assert.ok(o.trims.slice(1).every(loop => loop.keep === 'outside'));
    assert.notEqual(o.trims, d.objects[0].trims);
    for (const other of result) if (other !== o) {
      assert.notEqual(o.trims, other.trims);
      for (const loop of o.trims) for (const otherLoop of other.trims!) {
        assert.notEqual(loop, otherLoop); assert.notEqual(loop.uv, otherLoop.uv);
        for (const point of loop.uv) for (const otherPoint of otherLoop.uv) assert.notEqual(point, otherPoint);
      }
    }
    const s = geometryOf(out, o); assert.ok(s.kind === 'surface');
    for (const loop of o.trims) for (const [u, v] of loop.uv) {
      const p = evaluateSurface(s, u, v); near(p[0], 20 + 5 * u); near(p[1], -11 + 5 * v); near(p[2], 3);
    }
  }
}

for (const keep of ['inside', 'outside'] as const) {
  test(`trim Split ${keep}: public 160-point U mask yields three independently owned material components`, () => {
    const d = fixture(keep), before = structuredClone(d), panel = d.objects[0];
    assert.equal(panel.trims![0].uv.length, 160); freezeDeep(d);
    const out = directOps.splitSurface(d, panel.id, 'v', 3.7), result = made(d, out);
    assert.deepEqual(d, before); ownsResult(d, out); assert.equal(result.length, 3);
    const lower = result.filter(o => o.name.includes('v lower')), upper = result.filter(o => o.name.includes('v upper'));
    assert.equal(lower.length, keep === 'inside' ? 1 : 2); assert.equal(upper.length, keep === 'inside' ? 2 : 1);
    for (const side of [lower, upper]) side.forEach((o, index) => assert.ok(o.name.endsWith(`region ${index + 1}`)));
    const expected = keep === 'inside'
      ? [{ area: 150, centroid: [25, 2.85, 3] }, { area: 45, centroid: [18, 11.25, 3] }, { area: 45, centroid: [32, 11.25, 3] }]
      : [{ area: 370, centroid: [1195 / 37, -59 / 148, 3] }, { area: 20, centroid: [25, 6.25, 3] }, { area: 570, centroid: [585 / 19, 1251 / 76, 3] }];
    result.forEach((o, i) => { const m = moments(o); near(m.area, expected[i].area); m.centroid.forEach((x, k) => near(x, expected[i].centroid[k])); });
    // Probes catch an omitted pocket or two disjoint inside loops incorrectly combined by AND.
    const probes = [[18, 11], [32, 11], [25, 6.25], [45, 20], [25, 0]];
    for (const [x, y] of probes) {
      const u = (x - 20) / 5, v = (y + 11) / 5;
      assert.equal(result.some(o => keptAt(o.trims!, u, v, 8, 6)), keptAt(panel.trims!, u, v, 8, 6));
    }
    assert.throws(() => directIGES(out), e => isRefusal(e, 'IGES_EXPORT'));
    assert.throws(() => directOps.surfaceRegion(out, result[0].id, [-1, 1], [2, 3]), e => isRefusal(e, 'DIRECT_VALUE'));
    assert.throws(() => directOps.extendSurface(out, result[0].id, 'u-max', 1), e => isRefusal(e, 'DIRECT_VALUE'));
  });
}

test('trim Split: empty upper side creates no whole-surface object', () => {
  const d = fixture('inside'), out = directOps.splitSurface(d, d.objects[0].id, 'v', 5.7), result = made(d, out);
  assert.equal(result.length, 1); assert.ok(result[0].name.includes('v lower')); ownsResult(d, out); near(moments(result[0]).area, 240);
});

test('trim Split: both axes and CW/CCW loops retain material and canonical object order', () => {
  for (const axis of ['u', 'v'] as const) for (const keep of ['inside', 'outside'] as const) {
    const d = fixture(keep, false), reversed = structuredClone(d); reversed.objects[0].trims![0].uv.reverse();
    const parameter = axis === 'u' ? 0.4 : 3.7;
    const a = directOps.splitSurface(d, d.objects[0].id, axis, parameter), b = directOps.splitSurface(reversed, reversed.objects[0].id, axis, parameter);
    assert.deepEqual(made(d, a), made(reversed, b)); ownsResult(d, a);
    const sum = made(d, a).reduce((total, o) => total + moments(o).area, 0); near(sum, keep === 'inside' ? 240 : 960);
  }
});

test('trim Split: Model sidecars match native component boundaries and own all native arrays', () => {
  const d = fixture('outside'), panel = d.objects[0], s = geometryOf(d, panel); assert.ok(s.kind === 'surface');
  const native = splitTrimmedSurfaceAtParameter(s, panel.trims!, { axis: 'v', parameter: 3.7, lowerSurfaceId: 'lo_native', upperSurfaceId: 'hi_native' });
  const out = directOps.splitSurface(d, panel.id, 'v', 3.7), result = made(d, out);
  assert.equal(result.length, native.components.length);
  for (let i = 0; i < result.length; i++) {
    assert.deepEqual(result[i].trims, native.components[i].trimLoops);
    assert.notEqual(result[i].trims, native.components[i].trimLoops);
  }
});

test('trim Split: native Save/Open retains shared supports, IDs, labels, owned trims and editable objects', async () => {
  const d = fixture('outside'), out = directOps.splitSurface(d, d.objects[0].id, 'v', 3.7);
  const bytes = encodeStudioFile({ ...emptyDoc(), direct: out }), read = await readStudioFile(bytes);
  assert.ok(!('error' in read), 'error' in read ? read.error : ''); assert.deepEqual(read.doc.direct, out);
  assert.deepEqual(encodeStudioFile(read.doc), bytes);
  const recovered = read.doc.direct!, result = made(d, recovered); ownsResult(d, recovered);
  assert.equal(result[0].geometry, result[1].geometry); assert.notEqual(result[0].id, result[1].id);
  const renamed = directOps.rename(recovered, result[1].id, 'Pocket');
  assert.deepEqual(renamed.objects.find(o => o.id === result[1].id)!.trims, result[1].trims);
  const reread = await readStudioFile(encodeStudioFile({ ...read.doc, direct: renamed }));
  assert.ok(!('error' in reread)); assert.deepEqual(reread.doc.direct, renamed);
});

test('trim Split: invalid profiles refuse atomically and a valid retry works', () => {
  const cases: DirectGeometry[] = [];
  for (const trims of [null, {}, [{ keep: 'inside', uv: [[-1, 2], [3, 5], [-1, 5], [3, 2]] }], [{ keep: 'inside', uv: LOOP }, { keep: 'outside', uv: LOOP }]]) {
    const d = fixture('inside', false); d.objects[0].trims = trims as TrimLoop[]; cases.push(d);
  }
  const nonaffine = fixture('inside', false); nonaffine.sources[nonaffine.objects[0].source] = SOURCE.replace('[50,24,3]', '[50,24,4]'); cases.push(nonaffine);
  for (const d of cases) {
    const before = structuredClone(d); freezeDeep(d);
    assert.throws(() => directOps.splitSurface(d, d.objects[0].id, 'v', 3.7), e => isRefusal(e, 'DIRECT_VALUE')); assert.deepEqual(d, before);
  }
  const d = fixture('inside'), before = structuredClone(d);
  assert.throws(() => directOps.splitSurface(d, 'missing', 'v', 3.7), e => isRefusal(e, 'DIRECT_PICK'));
  d.objects.push({ ...d.objects[0] }); const ambiguous = structuredClone(d); freezeDeep(d);
  assert.throws(() => directOps.splitSurface(d, d.objects[0].id, 'v', 3.7), e => isRefusal(e, 'DIRECT_PICK')); assert.deepEqual(d, ambiguous);
  assert.equal(made(before, directOps.splitSurface(before, before.objects[0].id, 'v', 3.7)).length, 3);
});

function fractionNumber(value: Fraction): number { return Number(value.numerator) / Number(value.denominator); }
function positiveFraction(value: Fraction): boolean { return BigInt(value.numerator) > 0n && BigInt(value.denominator) > 0n; }
function equalFractionSum(actual: Fraction, expected: Fraction[]): void {
  let n = 0n, d = 1n;
  for (const value of expected) {
    const vn = BigInt(value.numerator), vd = BigInt(value.denominator);
    n = n * vd + vn * d; d *= vd;
  }
  assert.equal(BigInt(actual.numerator) * d, n * BigInt(actual.denominator));
}
for (const keep of ['inside', 'outside'] as const) for (const axis of ['u', 'v'] as const) {
  test(`trim Split ${axis}/${keep}: actual public stored160 material matches independent Fraction components and certified bounds`, () => {
    const d = fixture(keep), panel = d.objects[0], s = geometryOf(d, panel); assert.ok(s.kind === 'surface');
    const parameter = axis === 'u' ? 0.4 : 3.7, loop = panel.trims![0];
    assert.equal(loop.uv.length, 160);
    const input = { uv: loop.uv, domain: { u: [-2, 6], v: [1, 7] }, axis, parameter, keep };
    const authority = trimSplitOracle(input);
    const native = splitTrimmedSurfaceAtParameter(s, panel.trims!, { axis, parameter, lowerSurfaceId: 'oracle_lower', upperSurfaceId: 'oracle_upper' });
    const out = directOps.splitSurface(d, panel.id, axis, parameter), result = made(d, out), report = native.trimSplit;
    assert.equal(report.inputPointCount, 160); assert.equal(report.inputKeep, keep); assert.equal(report.axis, axis);
    assert.ok(report.maximumUVRoundingBound >= 0 && report.maximumUVRoundingBound <= 1e-7);
    assert.ok(report.maximumWorldBoundaryBound >= 0 && report.maximumWorldBoundaryBound <= 1e-7);
    assert.ok(report.maximumNativePointDifference >= 0 && report.maximumNativePointDifference <= 1e-7);
    assert.equal(report.quality.worldBoundary, 'whole-child-coefficient-bound-plus-affine-UV-rounding');
    assert.equal(report.quality.childRegularity, 'strict-positive-projected-bilinear-Jacobian-and-convex-boundary');
    assert.equal(report.quality.globalBinary64EvaluatorErrorCertified, false); assert.equal(report.quality.solid, false);
    const allAreas: Fraction[] = [];
    for (const side of ['lower', 'upper'] as const) {
      const expected = authority[side].slice();
      const actual = result.filter(o => o.name.includes(`${axis} ${side}`)).map(moments);
      assert.equal(actual.length, expected.length); assert.equal(report.componentCounts[side], expected.length);
      const proof = report.usedChildren[side];
      if (expected.length === 0) assert.equal(proof, null);
      else {
        assert.ok(proof); assert.equal(proof.regularityCertified, true); assert.equal(proof.jacobianBernstein.length, 9);
        assert.ok(proof.jacobianBernstein.every(positiveFraction)); assert.ok(positiveFraction(proof.minimumJacobianBernstein));
        assert.ok(proof.projectedCornerTurns.every(positiveFraction));
        assert.ok(proof.maximumWorldPositionBound >= 0 && proof.maximumWorldPositionBound <= report.maximumWorldBoundaryBound);
      }
      // Match full moments, so equal-area symmetric components cannot swap by floating sort noise.
      for (const component of actual) {
        const match = expected.findIndex(candidate => Math.abs(component.area - fractionNumber(candidate.areaWorld)) <= 1e-7
          && component.centroid.every((value, k) => Math.abs(value - fractionNumber(candidate.centroidWorld[k])) <= 1e-7));
        assert.ok(match >= 0, `No independent component matches ${JSON.stringify(component)}`);
        const [candidate] = expected.splice(match, 1);
        near(component.area, fractionNumber(candidate.areaWorld));
        component.centroid.forEach((value, k) => near(value, fractionNumber(candidate.centroidWorld[k])));
        allAreas.push(candidate.areaUV);
      }
      assert.equal(expected.length, 0);
    }
    // Exact authority conservation uses actual represented public UV, without decimal-guide substitution.
    equalFractionSum(report.originalMaterialAreaUV, allAreas); equalFractionSum(report.selectedMaterialAreaUV, allAreas);
    result.forEach((o, i) => assert.deepEqual(o.trims, native.components[i].trimLoops));
  });
}

test('trim Split: a collapsed used child refuses atomically; an empty collapsed side creates no object', () => {
  const text = `@model collapse { version:0; length-unit:mm;
   @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[9998,0,0],[9998,1,0]],[[9999,0,0],[9999,1,0]]]; weights:[[1,1],[1,1]]; }
  }`;
  for (const keep of ['outside', 'inside'] as const) {
    const d = importSource(emptyDirect(), text, 'collapse');
    d.objects[0].trims = [{ keep, uv: [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]] }];
    const before = structuredClone(d); freezeDeep(d);
    if (keep === 'outside') {
      assert.throws(() => directOps.splitSurface(d, d.objects[0].id, 'u', 1e-16), e => isRefusal(e, 'DIRECT_VALUE') && /Jacobian/.test(e.message));
    } else {
      const out = directOps.splitSurface(d, d.objects[0].id, 'u', 1e-16), result = made(d, out);
      assert.equal(result.length, 1); assert.ok(result[0].name.includes('u upper'));
      assert.ok(result[0].trims && result[0].trims.length > 0);
      assert.deepEqual(out.objects[0], { ...before.objects[0], hidden: true });
    }
    assert.deepEqual(d, before);
  }
});

test('trim Split: rounded boundary collapse maps to atomic DIRECT_VALUE; a valid retry succeeds', () => {
  const text = `@model rounded { version:0; length-unit:mm;
   @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,3,3]; control-points:[[[0,0,0],[0,3,0]],[[1,0,0],[1,3,0]]]; weights:[[1,1],[1,1]]; }
  }`;
  const d = importSource(emptyDirect(), text, 'rounded');
  d.objects[0].trims = [{ keep: 'inside', uv: [[0, 1], [1, 2], [1, 2 + 2 ** -51]] }];
  const before = structuredClone(d); freezeDeep(d);
  assert.throws(() => directOps.splitSurface(d, d.objects[0].id, 'u', 0.1), e => isRefusal(e, 'DIRECT_VALUE') && /collapse/.test(e.message));
  assert.deepEqual(d, before);
  const retry = structuredClone(before); retry.objects[0].trims![0].uv[2][1] = 2.25;
  const out = directOps.splitSurface(retry, retry.objects[0].id, 'u', 0.1);
  assert.equal(made(retry, out).length, 2);
});
