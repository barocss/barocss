import test from 'node:test';
import assert from 'node:assert/strict';
import { brepFromPrismatic, checkBrep, evaluateCurve, evaluateSurface, prismaticFromProfile } from '../dist/index.js';
import { buildCylindricalWrapAssembly, isCylindricalWrapAssemblyError } from '../dist/features/cylindrical-wrap-assembly.js';

const options = { id: 'wrap', height: 10 };
function native(radius = 10, z0 = 0, height = 30) {
  const solid = prismaticFromProfile({ outer: [{ kind: 'arc', start: [radius, 0], center: [0, 0], direction: 'ccw' }], height, from: z0, tag: 'post' });
  return { solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) };
}
function rectangle(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
function ink() {
  return [
    { outer: rectangle(1 / 16, 1 / 4, 1 / 4, 3 / 4), holes: [rectangle(1 / 8, 3 / 8, 3 / 16, 5 / 8).reverse()] },
    { outer: rectangle(5 / 16, 1 / 4, 3 / 8, 1 / 2), holes: [] },
  ];
}
function indexed(items) { const out = new Map(); for (const item of items) out.set(item.id, item); return out; }
function named(items, name) { for (const item of items) if (item.name === name) return item; assert.fail(`missing ${name}`); }
function positiveWall(brep) {
  for (const face of brep.faces) if (face.surface.degreeU === 2 && face.surface.controlPoints[1][0][1] > 0) return face;
  assert.fail('missing positive wall');
}
function negativeWall(brep) {
  for (const face of brep.faces) if (face.surface.degreeU === 2 && face.surface.controlPoints[1][0][1] < 0) return face;
  assert.fail('missing negative wall');
}
function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) sum += points[i][0] * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * points[i][1];
  return sum / 2;
}
function loopArea(brep, loopId) {
  const loops = indexed(brep.loops), coedges = indexed(brep.coedges), points = [];
  for (const id of loops.get(loopId).coedges) {
    const coedge = coedges.get(id), poles = coedge.pcurve.controlPoints;
    const p = poles[coedge.sense === 'forward' ? 0 : poles.length - 1]; points.push([p[0], p[1]]);
  }
  return signedArea(points);
}
function explicitQuarter(surface, uv) {
  // Independent tensor formula on original stored coefficients. These samples are regressions, not the global proof.
  const u = 2 * uv[0], v = uv[1], bu = [(1 - u) ** 2, 2 * u * (1 - u), u ** 2], bv = [1 - v, v], sum = [0, 0, 0];
  let divisor = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const coefficient = bu[i] * bv[j] * surface.weights[i][j]; divisor += coefficient;
    for (let k = 0; k < 3; k++) sum[k] += coefficient * surface.controlPoints[i][j][k];
  }
  return [sum[0] / divisor, sum[1] / divisor, sum[2] / divisor];
}
function closePoint(a, b, tolerance = 2e-12) { assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= tolerance, `${a} vs ${b}`); }
const exactStorage = new DataView(new ArrayBuffer(8));
const BINOMIAL = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1], [1, 5, 10, 10, 5, 1]];
function rational(n, d = 1n) {
  if (n === 0n) return { n: 0n, d: 1n };
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n, b = d;
  while (b) { const remainder = a % b; a = b; b = remainder; }
  return { n: n / a, d: d / a };
}
function represented(value) {
  exactStorage.setFloat64(0, value, false); const bits = exactStorage.getBigUint64(0, false), exponent = Number((bits >> 52n) & 2047n);
  let significand = (bits & 0xfffffffffffffn) + (exponent === 0 ? 0n : 1n << 52n);
  if (bits >> 63n) significand = -significand;
  const shift = exponent === 0 ? -1074 : exponent - 1075;
  return shift >= 0 ? rational(significand << BigInt(shift)) : rational(significand, 1n << BigInt(-shift));
}
function rAdd(a, b) { return rational(a.n * b.d + b.n * a.d, a.d * b.d); }
function rSubtract(a, b) { return rational(a.n * b.d - b.n * a.d, a.d * b.d); }
function rMultiply(a, b) { return rational(a.n * b.n, a.d * b.d); }
function rationalDerivative(a) {
  const out = [];
  for (let i = 0; i + 1 < a.length; i++) out.push(rMultiply(rational(BigInt(a.length - 1)), rSubtract(a[i + 1], a[i])));
  return out;
}
function rationalProduct(a, b) {
  const n = a.length - 1, m = b.length - 1, out = [];
  for (let k = 0; k <= n + m; k++) out.push(rational(0n));
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    const coefficient = rational(BigInt(BINOMIAL[n][i] * BINOMIAL[m][j]), BigInt(BINOMIAL[n + m][i + j]));
    out[i + j] = rAdd(out[i + j], rMultiply(coefficient, rMultiply(a[i], b[j])));
  }
  return out;
}
function independentAngularMinimum(curve, sign) {
  // Generic per-operation rational products are independent of the provider's common-dyadic integer sum.
  const x = [], y = [];
  for (let i = 0; i < 4; i++) { const w = represented(curve.weights[i]); x.push(rMultiply(represented(curve.controlPoints[i][0]), w)); y.push(rMultiply(represented(curve.controlPoints[i][1]), w)); }
  const a = rationalProduct(x, rationalDerivative(y)), b = rationalProduct(y, rationalDerivative(x)); let minimum = null;
  for (let i = 0; i < a.length; i++) {
    const coefficient = rMultiply(rational(BigInt(sign)), rSubtract(a[i], b[i])); assert.ok(coefficient.n > 0n);
    if (minimum === null || coefficient.n * minimum.d < minimum.n * coefficient.d) minimum = coefficient;
  }
  return { numerator: String(minimum.n), denominator: String(minimum.d) };
}
function refused(part, components, selected = options, code) {
  const before = structuredClone(part), oldInk = structuredClone(components), oldOptions = structuredClone(selected);
  assert.throws(() => buildCylindricalWrapAssembly(part, components, selected), error => isCylindricalWrapAssemblyError(error) && (code === undefined || error.code === code));
  assert.deepEqual(part, before); assert.deepEqual(components, oldInk); assert.deepEqual(selected, oldOptions);
}

test('rectilinear ring and separate stroke form one strict diagnostic shell with the independent incidence oracle', () => {
  const part = native(), components = ink(), before = structuredClone(part), oldInk = structuredClone(components), result = buildCylindricalWrapAssembly(part, components, options);
  assert.equal(result.check.valid, true); assert.equal(checkBrep(result.brep, { strict: true }).valid, true);
  assert.equal(result.brep.bodies.length, 1); assert.equal(result.brep.bodies[0].kind, 'solid');
  assert.equal(result.brep.shells.length, 1); assert.equal(result.brep.shells[0].closed, true);
  assert.deepEqual(result.proof.added, { vertices: 24, edges: 36, faces: 15, loops: 18, coedges: 72, counters: 1 });
  assert.deepEqual(result.check.counts, { bodies: 1, shells: 1, vertices: 28, edges: 42, faces: 19, loops: 22, coedges: 84 });
  assert.equal(result.check.topology[0].genus, 0);
  assert.equal(result.proof.pieces.length, 12); assert.equal(result.proof.vertices.length, 12);
  assert.equal(result.proof.solidQualified, false); assert.equal(result.proof.diagnosticOnly, true);
  assert.equal(result.proof.generalTextSupported, false); assert.equal(result.proof.representedVolumeCertified, false);
  assert.equal(result.proof.globalEvaluatorErrorCertified, false); assert.equal(result.proof.coordinateFrame, 'original-native-uv');
  assert.equal(result.proof.factor, 2); assert.equal(result.proof.fullSpanRegularity, true);
  assert.ok(result.proof.counts.exactOperations <= result.proof.limits.exactOperations);
  assert.ok(result.proof.counts.work <= result.proof.limits.work);
  assert.equal(result.proof.limits.exactOperations, 200000);
  assert.equal(result.proof.counts.exactOperations, result.proof.counts.helperOperations + result.proof.counts.rationalOperations + result.proof.counts.integerOperations);
  assert.ok(result.proof.counts.integerOperations > 0); assert.ok(result.proof.counts.integerMaximumBits > 0); assert.ok(result.proof.counts.integerMaximumBits <= 8192);
  assert.equal(result.proof.limits.integerBits, 8192);
  assert.equal(result.proof.counts.horizontalCompositions, 3); assert.equal(result.proof.counts.angularCertificates, 3); assert.equal(result.proof.counts.verticalCurves, 6); assert.equal(result.proof.counts.outerClones, 12);
  assert.deepEqual(part, before); assert.deepEqual(components, oldInk);
});

test('all original caps, opposite-half bits, IDs, names, pcurves and tolerances remain protected', () => {
  const part = native(), before = structuredClone(part), selected = positiveWall(before.brep), other = negativeWall(before.brep);
  assert.notEqual(other.surface.weights[1][0], Math.SQRT1_2);
  const result = buildCylindricalWrapAssembly(part, ink(), options), output = result.brep;
  assert.notEqual(output, part.brep);
  for (const field of ['bodies', 'vertices', 'edges', 'loops', 'coedges']) assert.deepEqual(output[field].slice(0, before.brep[field].length), before.brep[field]);
  for (let i = 0; i < before.brep.faces.length; i++) {
    const original = before.brep.faces[i], copy = output.faces[i];
    if (original.id === selected.id) {
      assert.deepEqual({ ...copy, loops: original.loops }, original); assert.deepEqual(copy.loops.slice(0, original.loops.length), original.loops); assert.equal(copy.loops.length, original.loops.length + 2);
    } else assert.deepEqual(copy, original);
  }
  assert.deepEqual(indexed(output.faces).get(other.id), other);
  assert.deepEqual(output.shells[0].faces.slice(0, before.brep.shells[0].faces.length), before.brep.shells[0].faces);
  assert.deepEqual({ ...output.shells[0], faces: before.brep.shells[0].faces }, before.brep.shells[0]);
  for (const edge of output.edges.slice(before.brep.edges.length)) assert.ok(edge.tolerance <= 1e-7);
  for (const vertex of output.vertices.slice(before.brep.vertices.length)) assert.ok(vertex.tolerance <= 1e-7);
  output.vertices[0].point[0] = 123; assert.deepEqual(part, before);
});

test('counter basal face and pcurve winding independently preserve the exact UV ink identity', () => {
  const part = native(), result = buildCylindricalWrapAssembly(part, ink(), options), b = result.brep;
  const original = positiveWall(part.brep), main = indexed(b.faces).get(original.id), outer = named(b.faces, 'wrap.outer.c0'), stroke = named(b.faces, 'wrap.outer.c1'), counter = named(b.faces, 'wrap.base.c0.h1');
  assert.deepEqual(counter.surface, original.surface); assert.equal(counter.sense, original.sense);
  assert.equal(counter.loops.length, 1); assert.equal(indexed(b.loops).get(counter.loops[0]).kind, 'outer');
  assert.equal(loopArea(b, main.loops.at(-2)), -3 / 32); assert.equal(loopArea(b, main.loops.at(-1)), -1 / 64);
  assert.equal(loopArea(b, counter.loops[0]), 1 / 64);
  assert.equal(loopArea(b, outer.loops[0]), 3 / 32); assert.equal(loopArea(b, outer.loops[1]), -1 / 64);
  assert.equal(loopArea(b, stroke.loops[0]), 1 / 64);
  const total = loopArea(b, outer.loops[0]) + loopArea(b, outer.loops[1]) + loopArea(b, stroke.loops[0]);
  assert.equal(total, 3 / 32, 'Independent exact dyadic UV area, not physical volume or nominal-chart area.');
  assert.equal(main.loops.length, original.loops.length + 2);
});

test('canonical edge/pcurve direction, shared endpoints, exact homothety and side rows agree independently', () => {
  const part = native(), result = buildCylindricalWrapAssembly(part, ink(), options), b = result.brep;
  const edges = indexed(b.edges), faces = indexed(b.faces), vertices = indexed(b.vertices), coedges = indexed(b.coedges), loops = indexed(b.loops), selected = positiveWall(part.brep);
  const quarter = { ...selected.surface, controlPoints: selected.surface.controlPoints.slice(0, 3), weights: selected.surface.weights.slice(0, 3) };
  for (const row of result.proof.vertices) {
    const base = vertices.get(row.base), outer = vertices.get(row.outer), radial = edges.get(row.radial);
    closePoint(base.point, explicitQuarter(quarter, row.uv));
    assert.deepEqual(outer.point, [2 * base.point[0], 2 * base.point[1], base.point[2]]);
    assert.deepEqual(radial.vertices, [base.id, outer.id]); assert.deepEqual(radial.curve.controlPoints, [base.point, outer.point]);
  }
  for (const piece of result.proof.pieces) {
    const base = edges.get(piece.baseEdge), outer = edges.get(piece.outerEdge), side = faces.get(piece.sideFace), loop = loops.get(side.loops[0]);
    assert.equal(base.curve.degree, 3); assert.equal(outer.curve.degree, 3); assert.deepEqual(base.curve.weights, outer.curve.weights);
    assert.equal(BigInt(piece.guard.minimum.numerator) > 0n, true); assert.equal(piece.guard.regularSide, true);
    if (piece.guard.kind === 'angular') assert.deepEqual(piece.guard.minimum, independentAngularMinimum(base.curve, Math.sign(piece.end[0] - piece.start[0])));
    const bound = piece.binding, baseNumerator = BigInt(bound.baseError.numerator), baseDenominator = BigInt(bound.baseError.denominator), outerNumerator = BigInt(bound.outerError.numerator), outerDenominator = BigInt(bound.outerError.denominator);
    assert.equal(outerNumerator * baseDenominator, 2n * baseNumerator * outerDenominator);
    assert.equal(bound.baseBudget, result.proof.tolerance / 16); assert.equal(bound.outerBudget, result.proof.tolerance / 8);
    assert.equal(bound.outerAuthority, 'exact-diag-2-2-1-of-admitted-base');
    assert.equal(bound.baseAuthority, piece.guard.kind === 'angular' ? 'horizontal-composition-with-exact-axial-replacement' : 'constant-xy-and-affine-z-bernstein-residual');
    for (let i = 0; i < 4; i++) {
      assert.deepEqual(outer.curve.controlPoints[i], [2 * base.curve.controlPoints[i][0], 2 * base.curve.controlPoints[i][1], base.curve.controlPoints[i][2]]);
      assert.deepEqual(side.surface.controlPoints[i], [base.curve.controlPoints[i], outer.curve.controlPoints[i]]);
      assert.deepEqual(side.surface.weights[i], [base.curve.weights[i], base.curve.weights[i]]);
    }
    const senses = [];
    for (const id of loop.coedges) senses.push(coedges.get(id).sense);
    assert.deepEqual(senses, ['forward', 'forward', 'reversed', 'reversed']);
    for (const id of loop.coedges) {
      const ce = coedges.get(id), twin = coedges.get(ce.twin), edge = edges.get(ce.edge);
      assert.equal(twin.twin, ce.id); assert.equal(twin.edge, ce.edge); assert.notEqual(twin.sense, ce.sense);
      // Pcurve t follows the edge even on the two reversed uses. Samples only check the independent wiring.
      for (const t of [0, 0.5, 1]) {
        const uv = evaluateCurve(ce.pcurve, t), world = evaluateCurve(edge.curve, t);
        closePoint(evaluateSurface(side.surface, uv[0], uv[1]), world);
      }
    }
  }
});

test('nonzero Z and opposite authored ring winding keep the same rectilinear diagnostic contract', () => {
  const components = ink(); components[0].outer.reverse(); components[0].holes[0].reverse(); components[1].outer.reverse();
  const part = native(8, 7, 32), result = buildCylindricalWrapAssembly(part, components, { ...options, height: 8 });
  assert.equal(result.check.valid, true); assert.equal(result.proof.added.counters, 1);
  assert.equal(signedArea(result.proof.components[0].outer), 3 / 32); assert.equal(signedArea(result.proof.components[0].holes[0]), -1 / 64);
  const vertices = indexed(result.brep.vertices);
  for (const row of result.proof.vertices) assert.equal(vertices.get(row.base).point[2], 7 + 32 * row.uv[1]);
});

test('diagonal, touching, cap/seam contact, degenerate and nested ink refuse atomically', () => {
  const part = native();
  const diagonal = ink(); diagonal[0].outer[1][1] += 1 / 64; refused(part, diagonal, options, 'SUPPORT');
  const crossing = [{ outer: [[1 / 16, 1 / 4], [1 / 4, 1 / 4], [1 / 4, 3 / 4], [1 / 8, 3 / 4], [1 / 8, 1 / 8], [1 / 16, 1 / 8]], holes: [] }]; refused(part, crossing, options, 'SUPPORT');
  const seam = ink(); seam[0].outer[0][0] = 0; seam[0].outer[3][0] = 0; refused(part, seam, options, 'SUPPORT');
  const cap = ink(); cap[1].outer = rectangle(5 / 16, 0, 3 / 8, 1 / 2); refused(part, cap, options, 'SUPPORT');
  const repeated = ink(); repeated[0].outer.push([...repeated[0].outer[0]]); refused(part, repeated, options, 'SUPPORT');
  const touching = ink(); touching[1].outer = rectangle(1 / 4, 1 / 4, 3 / 8, 1 / 2); refused(part, touching, options, 'SUPPORT');
  const badCounter = ink(); badCounter[0].holes[0] = rectangle(1 / 16, 3 / 8, 3 / 16, 5 / 8); refused(part, badCounter, options, 'SUPPORT');
  const nested = ink(); nested[1].outer = rectangle(9 / 64, 7 / 16, 11 / 64, 9 / 16); refused(part, nested, options, 'SUPPORT');
});

test('wrong height, malformed records, arrays and work exhaustion have typed refusal boundaries', () => {
  const part = native();
  refused(part, ink(), { ...options, height: 1 }, 'SUPPORT');
  refused(part, ink(), { ...options, height: 0 }, 'INPUT');
  refused(part, ink(), { ...options, height: NaN }, 'INPUT');
  refused(part, ink(), { ...options, extra: true }, 'INPUT');
  refused(part, ink(), { ...options, id: 'a'.repeat(25) }, 'INPUT');
  const diagonal = [{ outer: rectangle(1 / 16, 1 / 4, 1 / 4, 3 / 4), holes: [], extra: true }]; refused(part, diagonal, options, 'INPUT');
  const sparse = ink(); delete sparse[0].outer[1]; refused(part, sparse, options, 'INPUT');
  const typed = ink(); typed[0].outer[0] = new Float64Array([1 / 16, 1 / 4]); refused(part, typed, options, 'INPUT');
  const over = ink(); over[0].outer = Array(513).fill([1 / 8, 1 / 4]); refused(part, over, options, 'INPUT');
  const getter = ink(); let calls = 0; Object.defineProperty(getter[0], 'holes', { enumerable: true, get() { calls++; throw new Error('getter ran'); } });
  assert.throws(() => buildCylindricalWrapAssembly(part, getter, options), isCylindricalWrapAssemblyError); assert.equal(calls, 0);
  refused(part, ink(), { ...options, mapTolerance: 0.01 }, 'INPUT');
  const many = [];
  for (let i = 0; i < 8; i++) many.push({ outer: rectangle((2 * i + 1) / 64, 1 / 4, (2 * i + 2) / 64, 3 / 4), holes: [] });
  refused(part, many, options, 'BUDGET');
});

test('inconsistent source, range overflow and persistent-name collisions cannot change the accepted source', () => {
  const broken = native(); broken.brep.edges[0].tolerance *= 2; refused(broken, ink(), options, 'SUPPORT');
  const large = native(6000); refused(large, ink(), { ...options, height: 6000 }, 'SUPPORT');
  const collision = native(); collision.solid.solid.caps[0].tag = 'wrap.outer.c0'; collision.brep = brepFromPrismatic(collision.solid.solid, { id: 'post' });
  refused(collision, ink(), options, 'INPUT');
});
