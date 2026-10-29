import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSurface, extractTrimmedSurfaceRegion } from '@barocss/cad';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { emptyDoc } from '../src/engine/doc';
import { directIGES, directOps, emptyDirect, geometryOf, importSource, surfaceIntersection, type DirectGeometry, type DirectObject } from '../src/engine/direct';
import { isRefusal } from '../src/engine/refusal';
import { keptAt, type TrimLoop } from '../src/engine/trim';
import { trimRegionOracle, type Fraction } from './helpers/trimSplitOracle';

const SOURCE = `@model d341 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #mask { type:nurbs; degree:1; knots:[0,0,1,2,3,4,5,6,7,8,8]; control-points:[[15,-1,3],[35,-1,3],[35,15,3],[29,15,3],[29,5,3],[21,5,3],[21,15,3],[15,15,3],[15,-1,3]]; weights:[1,1,1,1,1,1,1,1,1]; }
 @surface #wall { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[20,-8,-2],[20,-8,8]],[[20,26,-2],[20,26,8]]]; weights:[[1,1],[1,1]]; }
}`;
const LOOP: [number, number][] = [[-1, 2], [3, 2], [3, 5.2], [1.8, 5.2], [1.8, 3.2], [0.2, 3.2], [0.2, 5.2], [-1, 5.2]];
type Crop = { name: string; u: [number, number]; v: [number, number]; inside: number; outside: number };
const CROPS: Crop[] = [
  { name: 'four-boundary pocket', u: [-1.6, 5], v: [1.4, 3.7], inside: 1, outside: 2 },
  { name: 'two upper components', u: [-0.8, 2.8], v: [3.7, 5], inside: 2, outside: 1 },
  { name: 'uncut enclosed hole', u: [-1.6, 5], v: [1.4, 6.2], inside: 1, outside: 1 },
  { name: 'empty inside and full outside', u: [0.4, 1.6], v: [3.8, 4.6], inside: 0, outside: 1 },
  { name: 'full-domain copy', u: [-2, 6], v: [1, 7], inside: 1, outside: 1 },
];
function fixture(keep: TrimLoop['keep'], publicLoop = true): DirectGeometry {
  const d = importSource(emptyDirect(), SOURCE, 'D341'); d.objects[1].hidden = true; d.objects[2].hidden = true;
  if (publicLoop) return directOps.trimByCurve(d, d.objects[0].id, d.objects[1].id, keep);
  d.objects[0].trims = [{ keep, uv: structuredClone(LOOP) }]; return d;
}
function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeDeep(child); Object.freeze(value); }
}
const numberOf = (q: Fraction): number => Number(q.numerator) / Number(q.denominator);
function near(a: number, b: number): void { assert.ok(Math.abs(a - b) <= 1e-7, `${a} != ${b}`); }
function exactSum(actual: Fraction, expected: Fraction[]): void {
  let n = 0n, d = 1n;
  for (const q of expected) { n = n * BigInt(q.denominator) + BigInt(q.numerator) * d; d *= BigInt(q.denominator); }
  assert.equal(BigInt(actual.numerator) * d, n * BigInt(actual.denominator));
}
function moments(o: DirectObject): { area: number; centroid: number[] } {
  let area = 0, mx = 0, my = 0;
  for (const loop of o.trims!) {
    let twice = 0, x = 0, y = 0;
    for (let i = 0; i < loop.uv.length; i++) {
      const a = loop.uv[i], b = loop.uv[(i + 1) % loop.uv.length], ax = 20 + 5 * a[0], ay = -11 + 5 * a[1], bx = 20 + 5 * b[0], by = -11 + 5 * b[1], cross = ax * by - bx * ay;
      twice += cross; x += (ax + bx) * cross; y += (ay + by) * cross;
    }
    const contribution = (loop.keep === 'inside' ? 1 : -1) * Math.abs(twice / 2);
    area += contribution; mx += contribution * x / (3 * twice); my += contribution * y / (3 * twice);
  }
  return { area, centroid: [mx / area, my / area, 3] };
}
function made(d: DirectGeometry, out: DirectGeometry): DirectObject[] { return out.objects.slice(d.objects.length); }
function assertOwned(d: DirectGeometry, out: DirectGeometry): void {
  const result = made(d, out); assert.ok(result.length > 0);
  assert.deepEqual(out.objects[0], { ...d.objects[0], hidden: true }); assert.deepEqual(out.objects.slice(1, d.objects.length), d.objects.slice(1));
  for (const [key, source] of Object.entries(d.sources)) assert.equal(out.sources[key], source);
  assert.equal(new Set(result.map(o => o.geometry)).size, 1); assert.equal(new Set(result.map(o => o.source)).size, 1);
  const seen = new Set<unknown>();
  for (let i = 0; i < result.length; i++) {
    const o = result[i]; assert.equal(o.name, `${d.objects[0].name} · region ${i + 1}`); assert.ok(o.trims && o.trims.length > 0);
    assert.equal(o.trims[0].keep, 'inside'); assert.ok(o.trims.slice(1).every(loop => loop.keep === 'outside'));
    for (const value of [o.trims, ...o.trims, ...o.trims.map(loop => loop.uv), ...o.trims.flatMap(loop => loop.uv)]) { assert.ok(!seen.has(value)); seen.add(value); }
    assert.notEqual(o.trims, d.objects[0].trims);
    const s = geometryOf(out, o); assert.ok(s.kind === 'surface');
    for (const loop of o.trims) for (const [u, v] of loop.uv) { const p = evaluateSurface(s, u, v); near(p[0], 20 + 5 * u); near(p[1], -11 + 5 * v); near(p[2], 3); }
  }
}
for (const keep of ['inside', 'outside'] as const) for (const crop of CROPS) {
  test(`trim Region ${keep}/${crop.name}: actual public160 material matches independent rectangle Fraction oracle`, () => {
    const d = fixture(keep), before = structuredClone(d), panel = d.objects[0], surface = geometryOf(d, panel); assert.ok(surface.kind === 'surface');
    assert.equal(panel.trims![0].uv.length, 160); freezeDeep(d);
    const input = { uv: panel.trims![0].uv, domain: { u: [-2, 6], v: [1, 7] }, crop, keep };
    const authority = trimRegionOracle(input), otherAxis = trimRegionOracle({ ...input, axis: 'u' });
    assert.equal(authority.length, crop[keep]); assert.equal(otherAxis.length, authority.length);
    const remaining = authority.slice();
    for (const other of otherAxis) {
      const index = remaining.findIndex(q => q.areaUV.numerator === other.areaUV.numerator && q.areaUV.denominator === other.areaUV.denominator
        && q.centroidWorld.every((value, k) => value.numerator === other.centroidWorld[k].numerator && value.denominator === other.centroidWorld[k].denominator));
      assert.ok(index >= 0, 'Both exact sweep axes must agree on component moments'); remaining.splice(index, 1);
    }
    if (authority.length === 0) {
      assert.throws(() => directOps.surfaceRegion(d, panel.id, crop.u, crop.v), e => isRefusal(e, 'DIRECT_VALUE') && /material/i.test(e.message));
      assert.deepEqual(d, before); assert.equal(d.objects[0].hidden, undefined); return;
    }
    const native = extractTrimmedSurfaceRegion(surface, panel.trims!, { surfaceId: 'oracle_region', uInterval: crop.u, vInterval: crop.v, resultIdPrefix: 'oracle_rg' });
    const out = directOps.surfaceRegion(d, panel.id, crop.u, crop.v), result = made(d, out), expected = authority.slice();
    assert.deepEqual(d, before); assertOwned(d, out); assert.equal(result.length, authority.length);
    exactSum(native.trimRegion.croppedMaterialAreaUV, authority.map(q => q.areaUV));
    assert.equal(native.trimRegion.componentCount, authority.length); assert.equal(native.trimRegion.usedSupportProof.regularityCertified, true);
    const report = native.trimRegion;
    assert.ok(report.maximumUVRoundingBound >= 0 && report.maximumUVRoundingBound <= 1e-7);
    assert.ok(report.maximumWorldBoundaryBound >= 0 && report.maximumWorldBoundaryBound <= 1e-7);
    assert.ok(report.maximumNativePointDifference >= 0 && report.maximumNativePointDifference <= 1e-7);
    assert.equal(report.quality.worldBoundary, 'whole-final-support-coefficient-bound-plus-affine-UV-rounding');
    assert.equal(report.quality.emptyCrop, 'atomic-DOMAIN-refusal'); assert.equal(report.quality.solid, false);
    assert.ok(report.usedSupportProof.jacobianBernstein.every(q => BigInt(q.numerator) > 0n));
    if (crop.name === 'full-domain copy') {
      assert.equal(native.report.operationCount, 0);
      assert.deepEqual(report.originalMaterialAreaUV, report.croppedMaterialAreaUV);
    } else assert.equal(native.report.operationCount, 4);
    for (const o of result) {
      const actual = moments(o), index = expected.findIndex(q => Math.abs(actual.area - numberOf(q.areaWorld)) <= 1e-7 && actual.centroid.every((value, k) => Math.abs(value - numberOf(q.centroidWorld[k])) <= 1e-7));
      assert.ok(index >= 0, `No independent cropped component matches ${JSON.stringify(actual)}`); expected.splice(index, 1);
    }
    assert.equal(expected.length, 0); result.forEach((o, i) => assert.deepEqual(o.trims, native.components[i].trimLoops));
    const probes = [[18, 11], [32, 11], [25, 6.25], [25, 0], [45, 20]];
    for (const [x, y] of probes) {
      const u = (x - 20) / 5, v = (y + 11) / 5, inCrop = u >= crop.u[0] && u <= crop.u[1] && v >= crop.v[0] && v <= crop.v[1];
      assert.equal(result.some(o => keptAt(o.trims!, u, v, 8, 6)), inCrop && keptAt(panel.trims!, u, v, 8, 6));
    }
    if (keep === 'outside' && ['uncut enclosed hole', 'full-domain copy'].includes(crop.name)) assert.equal(result[0].trims!.length, 2);
    assert.throws(() => directIGES(out), e => isRefusal(e, 'IGES_EXPORT'));
    assert.throws(() => directOps.extendSurface(out, result[0].id, 'u-max', 1), e => isRefusal(e, 'DIRECT_VALUE'));
    assert.throws(() => surfaceIntersection(out, result[0].id, d.objects[2].id), e => isRefusal(e, 'DIRECT_INTERSECT'));
  });
}

test('trim Region: fractional CW/CCW source loops retain canonical component order', () => {
  for (const keep of ['inside', 'outside'] as const) {
    const d = fixture(keep, false), reversed = structuredClone(d); reversed.objects[0].trims![0].uv.reverse();
    const crop = CROPS[1], a = directOps.surfaceRegion(d, d.objects[0].id, crop.u, crop.v), b = directOps.surfaceRegion(reversed, reversed.objects[0].id, crop.u, crop.v);
    assert.deepEqual(made(d, a), made(reversed, b));
  }
});

test('trim Region: Save/Open retains shared support, masks, original metadata and an editable renamed result', async () => {
  const d = fixture('inside'), crop = CROPS[1], out = directOps.surfaceRegion(d, d.objects[0].id, crop.u, crop.v);
  const bytes = encodeStudioFile({ ...emptyDoc(), direct: out }), read = await readStudioFile(bytes);
  assert.ok(!('error' in read)); assert.deepEqual(read.doc.direct, out); assert.deepEqual(encodeStudioFile(read.doc), bytes);
  const recovered = read.doc.direct!, result = made(d, recovered); assertOwned(d, recovered);
  const renamed = directOps.rename(recovered, result[1].id, 'Right cropped region');
  assert.deepEqual(renamed.objects.find(o => o.id === result[1].id)!.trims, result[1].trims);
  const reread = await readStudioFile(encodeStudioFile({ ...read.doc, direct: renamed })); assert.ok(!('error' in reread)); assert.deepEqual(reread.doc.direct, renamed);
});

test('trim Region: empty crop and invalid range/profile refusals preserve all state; valid retry works', () => {
  const cases: { d: DirectGeometry; u: [number, number]; v: [number, number] }[] = [];
  for (const trims of [null, {}, [{ keep: 'inside', uv: LOOP }, { keep: 'outside', uv: LOOP }], [{ keep: 'inside', uv: [[-1, 2], [3, 5], [-1, 5], [3, 2]] }]]) {
    const d = fixture('inside', false); d.objects[0].trims = trims as TrimLoop[]; cases.push({ d, u: [-1, 2], v: [2, 5] });
  }
  for (const [u, v] of [[[2, -1], [2, 5]], [[-3, 2], [2, 5]], [[-1, 2], [4, 4]]] as [number[], number[]][]) cases.push({ d: fixture('inside'), u: u as [number, number], v: v as [number, number] });
  cases.push({ d: fixture('inside'), u: CROPS[3].u, v: CROPS[3].v });
  const nonaffine = fixture('inside'); nonaffine.sources[nonaffine.objects[0].source] = SOURCE.replace('[50,24,3]', '[50,24,4]'); cases.push({ d: nonaffine, u: [-1, 2], v: [2, 5] });
  for (const { d, u, v } of cases) { const before = structuredClone(d); freezeDeep(d); assert.throws(() => directOps.surfaceRegion(d, d.objects[0].id, u, v), e => isRefusal(e, 'DIRECT_VALUE')); assert.deepEqual(d, before); }
  const d = fixture('inside'), before = structuredClone(d);
  assert.throws(() => directOps.surfaceRegion(d, 'missing', [-1, 2], [2, 5]), e => isRefusal(e, 'DIRECT_PICK'));
  d.objects.push({ ...d.objects[0] }); const ambiguous = structuredClone(d); freezeDeep(d);
  assert.throws(() => directOps.surfaceRegion(d, d.objects[0].id, [-1, 2], [2, 5]), e => isRefusal(e, 'DIRECT_PICK')); assert.deepEqual(d, ambiguous);
  assert.equal(made(before, directOps.surfaceRegion(before, before.objects[0].id, CROPS[1].u, CROPS[1].v)).length, 2);
});

test('trim Region: 160-point comb exceeds the Split graph profile without dropping tiny components', () => {
  const text = `@model comb { version:0; length-unit:mm;
   @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-3,-3,3,3]; knots-v:[-1,-1,158,158]; control-points:[[[5,-16,3],[5,779,3]],[[35,-16,3],[35,779,3]]]; weights:[[1,1],[1,1]]; }
  }`;
  const uv: [number, number][] = Array.from({ length: 157 }, (_, i) => [i % 2 === 0 ? -1 : 2, i]); uv.push([-2, 156], [-2, 78], [-2, 0]);
  for (const keep of ['inside', 'outside'] as const) {
    const d = importSource(emptyDirect(), text, 'comb'); d.objects[0].trims = [{ keep, uv: structuredClone(uv) }];
    const crop = { u: [0, 1] as [number, number], v: [-0.5, 157] as [number, number] }, authority = trimRegionOracle({ uv, domain: { u: [-3, 3], v: [-1, 158] }, crop, keep });
    assert.equal(authority.length, keep === 'inside' ? 78 : 79);
    if (keep === 'inside') for (const component of authority) { near(numberOf(component.areaUV), 1); near(numberOf(component.centroidWorld[0]), 20 + 5 * 4 / 9); }
    const surface = geometryOf(d, d.objects[0]); assert.ok(surface.kind === 'surface');
    const native = extractTrimmedSurfaceRegion(surface, d.objects[0].trims!, { surfaceId: 'comb_region', uInterval: crop.u, vInterval: crop.v, resultIdPrefix: 'comb_rg' });
    assert.equal(native.trimRegion.work.arrangement.vertices, 476); assert.equal(native.trimRegion.work.arrangement.edges, 788);
    exactSum(native.trimRegion.croppedMaterialAreaUV, authority.map(q => q.areaUV));
    const out = directOps.surfaceRegion(d, d.objects[0].id, crop.u, crop.v), result = made(d, out); assert.equal(result.length, authority.length); assertOwned(d, out);
    near(result.reduce((sum, o) => sum + moments(o).area, 0), authority.reduce((sum, q) => sum + numberOf(q.areaWorld), 0));
    const unmatched = authority.slice();
    for (const o of result) {
      const actual = moments(o), index = unmatched.findIndex(q => Math.abs(actual.area - numberOf(q.areaWorld)) <= 1e-7
        && actual.centroid.every((value, k) => Math.abs(value - numberOf(q.centroidWorld[k])) <= 1e-7));
      assert.ok(index >= 0, `No independent comb component matches ${JSON.stringify(actual)}`); unmatched.splice(index, 1);
    }
    assert.equal(unmatched.length, 0, 'Every independent tooth or outside band must occur exactly once');
  }
});

test('trim Region: rounded boundary collapse refuses atomically before a valid retry', () => {
  const text = `@model rounded { version:0; length-unit:mm;
   @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,3,3]; control-points:[[[0,0,0],[0,3,0]],[[1,0,0],[1,3,0]]]; weights:[[1,1],[1,1]]; }
  }`;
  const d = importSource(emptyDirect(), text, 'rounded'); d.objects[0].trims = [{ keep: 'inside', uv: [[0, 1], [1, 2], [1, 2 + 2 ** -51]] }];
  const before = structuredClone(d); freezeDeep(d);
  assert.throws(() => directOps.surfaceRegion(d, d.objects[0].id, [0.1, 1], [0, 3]), e => isRefusal(e, 'DIRECT_VALUE') && /collapse/.test(e.message)); assert.deepEqual(d, before);
  const retry = structuredClone(before); retry.objects[0].trims![0].uv[2][1] = 2.25;
  assert.equal(made(retry, directOps.surfaceRegion(retry, retry.objects[0].id, [0.1, 1], [0, 3])).length, 1);
});

test('trim Region: perpendicular-edge switch levels give the same exact clipped moments in both sweep axes', () => {
  // Triangle x+y<=4 cropped to [1,3]x[1,3]: area2, centroid[5/3,5/3] in UV.
  const input = { uv: [[0, 0], [4, 0], [0, 4]], domain: { u: [0, 4], v: [0, 4] }, crop: { u: [1, 3], v: [1, 3] }, keep: 'inside' as const };
  for (const axis of ['u', 'v'] as const) {
    const output = trimRegionOracle({ ...input, axis }); assert.equal(output.length, 1);
    assert.deepEqual(output[0].areaUV, { numerator: '2', denominator: '1' });
    near(numberOf(output[0].centroidWorld[0]), 20 + 25 / 3); near(numberOf(output[0].centroidWorld[1]), -11 + 25 / 3);
  }
});

test('trim Region: native parent refusal retains precedence for tiny crops; ordinary nonexact-affine child remains admitted', () => {
  const text = `@model collapse { version:0; length-unit:mm;
   @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[9998,0,0],[9998,1,0]],[[9999,0,0],[9999,1,0]]]; weights:[[1,1],[1,1]]; }
  }`;
  const d = importSource(emptyDirect(), text, 'collapse'); d.objects[0].trims = [{ keep: 'outside', uv: [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]] }];
  const before = structuredClone(d); freezeDeep(d);
  assert.throws(() => directOps.surfaceRegion(d, d.objects[0].id, [0, 1e-16], [0, 1]), e => isRefusal(e, 'DIRECT_VALUE') && /original\/extracted native U\/V partial observation/.test(e.message)); assert.deepEqual(d, before);
  const inside = structuredClone(before); inside.objects[0].trims![0].keep = 'inside';
  assert.throws(() => directOps.surfaceRegion(inside, inside.objects[0].id, [0, 1e-16], [0, 1]), e => isRefusal(e, 'DIRECT_VALUE') && /original\/extracted native U\/V partial observation/.test(e.message));
  const slanted = fixture('inside', false);
  slanted.sources[slanted.objects[0].source] = SOURCE.replace('[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]', '[[[0,0,0],[0,1,1]],[[1,0,1],[1,1,2]]]');
  const out = directOps.surfaceRegion(slanted, slanted.objects[0].id, [-1.6, 2.8], [1.4, 5]);
  assert.ok(made(slanted, out).length > 0); assert.ok(made(slanted, out).every(o => o.trims && o.trims.length > 0));
});

test('trim Region: native endpoint/coincident boundaries and a small positive sliver retain explicit material masks', () => {
  const d = fixture('inside', false);
  for (const crop of [{ u: [-1, 3], v: [2, 3.2] }, { u: [-2, 0.2], v: [1, 5.2] }, { u: [-1, -1 + 1e-8], v: [2.5, 3] }]) {
    const input = { uv: d.objects[0].trims![0].uv, domain: { u: [-2, 6], v: [1, 7] }, crop, keep: 'inside' as const }, authority = trimRegionOracle(input);
    assert.ok(authority.length > 0); const out = directOps.surfaceRegion(d, d.objects[0].id, crop.u as [number, number], crop.v as [number, number]);
    const result = made(d, out); assert.equal(result.length, authority.length);
    near(result.reduce((sum, o) => sum + moments(o).area, 0), authority.reduce((sum, q) => sum + numberOf(q.areaWorld), 0));
    assert.ok(result.every(o => o.trims && o.trims.length > 0));
  }
});
