import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel } from '../dist/index.js';
import { tessellateSurface } from '../dist/preview.js';
import { validatePreviewPacket, copyPreviewPacket } from '../dist/packet.js';

const cylinder = {
  kind: 'surface', id: 'quarter-cylinder', degreeU: 2, degreeV: 1,
  knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1],
  controlPoints: [[[10, 0, 0], [10, 0, 30]], [[10, 10, 0], [10, 10, 30]], [[0, 10, 0], [0, 10, 30]]],
  weights: [[1, 1], [Math.SQRT1_2, Math.SQRT1_2], [1, 1]],
};
const plane = {
  kind: 'surface', id: 'asymmetric-plane', degreeU: 1, degreeV: 1,
  knotsU: [-2, -2, 3, 3], knotsV: [4, 4, 6, 6],
  controlPoints: [[[1, 2, 3], [5, 11, -2]], [[13, -7, 9], [17, 2, 4]]],
  weights: [[1, 1], [1, 1]],
};
const weightedPatch = {
  kind: 'surface', id: 'weighted-patch', degreeU: 1, degreeV: 1,
  knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
  controlPoints: [[[0, 0, 0], [1, 7, 3]], [[9, 2, 4], [12, 8, -2]]],
  weights: [[1, 2], [3, 4]],
};

const sub = (a, b) => a.map((value, axis) => value - b[axis]);
const add = (a, b) => a.map((value, axis) => value + b[axis]);
const scale = (a, factor) => a.map((value) => value * factor);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(...a);
const pointAt = (positions, index) => positions.slice(index * 3, index * 3 + 3);

function retainAudit(name, evidence) {
  const output = process.env.BAROCSS_CAD_AUDIT_EVIDENCE;
  if (output) {
    mkdirSync(output, { recursive: true });
    writeFileSync(resolve(output, `${name}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  const { probeOffsets, denseOffsets, additionalNonProbeOffsets, ...summary } = evidence;
  console.log(JSON.stringify({ fixture: name, ...summary }));
}

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}
function pointClose(actual, expected, tolerance = 1e-9) {
  actual.forEach((value, axis) => close(value, expected[axis], tolerance));
}

// This oracle is the analytic rational quadratic circle; it does not call CAD math.
function cylinderPoint(u, v) {
  const a = (1 - u) ** 2;
  const b = 2 * Math.SQRT1_2 * u * (1 - u);
  const c = u ** 2;
  const denominator = a + b + c;
  return [10 * (a + b) / denominator, 10 * (b + c) / denominator, 30 * v];
}

// Independent rational bilinear interpolation for the degree-one fixtures.
function bilinearPoint(surface, u, v) {
  const a = (u - surface.knotsU[1]) / (surface.knotsU[2] - surface.knotsU[1]);
  const b = (v - surface.knotsV[1]) / (surface.knotsV[2] - surface.knotsV[1]);
  const coefficients = [[(1 - a) * (1 - b), (1 - a) * b], [a * (1 - b), a * b]];
  let denominator = 0;
  const point = [0, 0, 0];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const factor = coefficients[i][j] * surface.weights[i][j];
      denominator += factor;
      for (let axis = 0; axis < 3; axis++) point[axis] += factor * surface.controlPoints[i][j][axis];
    }
  }
  return scale(point, 1 / denominator);
}

function distanceToSegment(point, a, b) {
  const edge = sub(b, a);
  const fraction = Math.max(0, Math.min(1, dot(sub(point, a), edge) / dot(edge, edge)));
  return norm(sub(point, add(a, scale(edge, fraction))));
}

// Orthogonal plane projection, barycentric containment, and all three edges.
// Product geometry/distance helpers are deliberately absent from this oracle.
function distanceToTriangle(point, a, b, c) {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const normal = cross(ab, ac);
  const normalSquared = dot(normal, normal);
  assert.ok(normalSquared > 0, 'Independent oracle requires a nondegenerate triangle');
  const ap = sub(point, a);
  const projected = sub(ap, scale(normal, dot(ap, normal) / normalSquared));
  const abSquared = dot(ab, ab);
  const acSquared = dot(ac, ac);
  const mixed = dot(ab, ac);
  const determinant = abSquared * acSquared - mixed ** 2;
  const alongB = (acSquared * dot(projected, ab) - mixed * dot(projected, ac)) / determinant;
  const alongC = (abSquared * dot(projected, ac) - mixed * dot(projected, ab)) / determinant;
  const edgeDistance = Math.min(distanceToSegment(point, a, b), distanceToSegment(point, b, c), distanceToSegment(point, c, a));
  if (alongB >= 0 && alongC >= 0 && alongB + alongC <= 1) {
    return Math.min(edgeDistance, Math.abs(dot(ap, normal)) / Math.sqrt(normalSquared));
  }
  return edgeDistance;
}

const probes = [[0.5, 0.5], [0.25, 0.25], [0.25, 0.75], [0.75, 0.25], [0.75, 0.75]];
function audit(result, oracle, offsets) {
  const { packet, report } = result;
  const { countU, countV } = report.grid;
  let maximum = 0;
  let count = 0;
  for (let i = 0; i < countU - 1; i++) {
    for (let j = 0; j < countV - 1; j++) {
      const indices = [i * countV + j, (i + 1) * countV + j, i * countV + j + 1, (i + 1) * countV + j + 1];
      const [a, b, c, d] = indices.map((index) => pointAt(packet.positions, index));
      const u0 = packet.parameters[indices[0] * 2];
      const u1 = packet.parameters[indices[1] * 2];
      const v0 = packet.parameters[indices[0] * 2 + 1];
      const v1 = packet.parameters[indices[2] * 2 + 1];
      for (const [offsetU, offsetV] of offsets) {
        const point = oracle(u0 + (u1 - u0) * offsetU, v0 + (v1 - v0) * offsetV);
        maximum = Math.max(maximum, Math.min(distanceToTriangle(point, a, b, c), distanceToTriangle(point, b, d, c)));
        count++;
      }
    }
  }
  return { maximum, count };
}

function checkPacket(result, surface, countU, countV, oracle) {
  const { packet, report } = result;
  const count = countU * countV;
  validatePreviewPacket(packet);
  assert.equal(packet.version, 0);
  assert.equal(packet.surfaceId, surface.id);
  assert.equal(packet.revision, 19);
  assert.equal(packet.lengthUnit, 'mm');
  assert.equal(packet.coordinateSystem, 'right-handed-y-up');
  assert.equal(packet.winding, 'ccw');
  assert.equal(packet.positions.length, count * 3);
  assert.equal(packet.normals.length, count * 3);
  assert.equal(packet.parameters.length, count * 2);
  const expectedIndices = [];
  for (let i = 0; i < countU - 1; i++) {
    for (let j = 0; j < countV - 1; j++) {
      const a = i * countV + j;
      const b = (i + 1) * countV + j;
      const c = a + 1;
      const d = b + 1;
      expectedIndices.push(a, b, c, b, d, c);
    }
  }
  assert.deepEqual(packet.indices, expectedIndices);
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let analyticVertexDeviationMM = 0;
  for (let i = 0; i < countU; i++) {
    for (let j = 0; j < countV; j++) {
      const index = i * countV + j;
      const u = i === countU - 1 ? report.domain.u[1] : report.domain.u[0] + (report.domain.u[1] - report.domain.u[0]) * i / (countU - 1);
      const v = j === countV - 1 ? report.domain.v[1] : report.domain.v[0] + (report.domain.v[1] - report.domain.v[0]) * j / (countV - 1);
      pointClose(packet.parameters.slice(index * 2, index * 2 + 2), [u, v]);
      const point = pointAt(packet.positions, index);
      const expectedPoint = oracle(u, v);
      pointClose(point, expectedPoint);
      analyticVertexDeviationMM = Math.max(analyticVertexDeviationMM, norm(sub(point, expectedPoint)));
      close(norm(pointAt(packet.normals, index)), 1, 1e-12);
      for (let axis = 0; axis < 3; axis++) {
        bounds.min[axis] = Math.min(bounds.min[axis], point[axis]);
        bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
      }
    }
  }
  assert.deepEqual(packet.bounds, bounds);
  const incidentSums = Array.from({ length: count }, () => [0, 0, 0]);
  for (let triangle = 0; triangle < packet.indices.length; triangle += 3) {
    const [a, b, c] = packet.indices.slice(triangle, triangle + 3);
    const normal = cross(sub(pointAt(packet.positions, b), pointAt(packet.positions, a)), sub(pointAt(packet.positions, c), pointAt(packet.positions, a)));
    assert.ok(norm(normal) > 0);
    for (const index of [a, b, c]) {
      assert.ok(dot(normal, pointAt(packet.normals, index)) > 0);
      incidentSums[index] = add(incidentSums[index], normal);
    }
  }
  for (let index = 0; index < count; index++) {
    pointClose(pointAt(packet.normals, index), scale(incidentSums[index], 1 / norm(incidentSums[index])), 1e-12);
  }
  assert.deepEqual(report.grid, { countU, countV });
  assert.equal(report.vertexCount, count);
  assert.equal(report.triangleCount, 2 * (countU - 1) * (countV - 1));
  assert.equal(report.cellCount, (countU - 1) * (countV - 1));
  assert.equal(report.probeCount, 5 * report.cellCount);
  assert.equal(report.normalMethod, 'area-weighted-incident-triangle');
  assert.equal(report.certified, false);
  const independent = audit(result, oracle, probes);
  assert.equal(independent.count, report.probeCount);
  close(report.maxSampledDeviationMM, independent.maximum, 1e-10);
  return { ...independent, analyticVertexDeviationMM };
}

test('independent distance oracle covers face interior, edge and corner regions', () => {
  const a = [0, 0, 0];
  const b = [2, 0, 0];
  const c = [0, 2, 0];
  close(distanceToTriangle([0.5, 0.5, 3], a, b, c), 3);
  close(distanceToTriangle([3, 0, 0], a, b, c), 1);
  close(distanceToTriangle([-1, -1, 0], a, b, c), Math.SQRT2);
  close(distanceToTriangle([1, 1, 0], a, b, c), 0);
});

test('quarter-cylinder topology, analytic positions, U/V orientation and finite sampled error', () => {
  const coarse = tessellateSurface(cylinder, { countU: 5, countV: 3, revision: 19 });
  const fine = tessellateSurface(cylinder, { countU: 17, countV: 9, revision: 19 });
  const coarseAudit = checkPacket(coarse, cylinder, 5, 3, cylinderPoint);
  const fineAudit = checkPacket(fine, cylinder, 17, 9, cylinderPoint);
  assert.ok(fineAudit.maximum < coarseAudit.maximum / 10);
  for (let index = 0; index < fine.report.vertexCount; index++) {
    const [x, y] = pointAt(fine.packet.positions, index);
    const [nx, ny, nz] = pointAt(fine.packet.normals, index);
    close(Math.hypot(x, y), 10);
    close(nz, 0);
    assert.ok(x * nx + y * ny > 0, 'Increasing circle U crossed with increasing height V points radially positive');
  }
  const offsets = [];
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) offsets.push([i / 12, j / 12]);
  const coarseDense = audit(coarse, cylinderPoint, offsets);
  const fineDense = audit(fine, cylinderPoint, offsets);
  const extraOffsets = offsets.filter(([u, v]) => !probes.some(([probeU, probeV]) => u === probeU && v === probeV));
  const coarseNonProbe = audit(coarse, cylinderPoint, extraOffsets);
  const fineNonProbe = audit(fine, cylinderPoint, extraOffsets);
  assert.ok(fineDense.maximum < coarseDense.maximum);
  assert.ok(coarseDense.maximum + 1e-12 >= coarseAudit.maximum);
  assert.ok(fineDense.maximum + 1e-12 >= fineAudit.maximum);
  retainAudit('quarter-cylinder', {
    oracle: 'analytic rational quadratic circle plus independent plane/barycentric/edge triangle distance',
    normalConvention: 'U cross V; radially positive for this open cylindrical patch, without a closed-solid claim',
    probeOffsets: probes, denseOffsets: offsets, additionalNonProbeOffsets: extraOffsets,
    coarse: { grid: coarse.report.grid, revision: coarse.packet.revision, reportMaximumMM: coarse.report.maxSampledDeviationMM, ...coarseAudit },
    fine: { grid: fine.report.grid, revision: fine.packet.revision, reportMaximumMM: fine.report.maxSampledDeviationMM, ...fineAudit },
    coarseDense, fineDense, coarseNonProbe, fineNonProbe, certified: false,
    limitations: 'Finite sampled distances and analytic fixture checks only; no certified global bound, exact derivative normals, closed solid or GPU pixel claim',
  });
});

test('asymmetric affine plane retains domain, U/V ordering, exact bounds and area-weighted normals', () => {
  const result = tessellateSurface(plane, { countU: 4, countV: 7, revision: 19 });
  const independent = checkPacket(result, plane, 4, 7, (u, v) => bilinearPoint(plane, u, v));
  assert.deepEqual(result.report.domain, { u: [-2, 3], v: [4, 6] });
  const normal = cross(sub(plane.controlPoints[1][0], plane.controlPoints[0][0]), sub(plane.controlPoints[0][1], plane.controlPoints[0][0]));
  const unitNormal = scale(normal, 1 / norm(normal));
  for (let index = 0; index < result.report.vertexCount; index++) pointClose(pointAt(result.packet.normals, index), unitNormal, 1e-12);
  assert.ok(independent.maximum < 1e-12);
  retainAudit('asymmetric-plane', { grid: result.report.grid, revision: result.packet.revision, probeOffsets: probes, reportMaximumMM: result.report.maxSampledDeviationMM, ...independent, certified: false });
});

test('shared asymmetric flat literal replays without a GPU or native geometry dependency', () => {
  const flat = {
    kind: 'surface', id: 'flat_patch', degreeU: 1, degreeV: 1,
    knotsU: [-2, -2, 3, 3], knotsV: [4, 4, 6, 6],
    controlPoints: [[[1, 2, 2], [2, 9, 2]], [[7, 3, 2], [8, 10, 2]]],
    weights: [[1, 1], [1, 1]],
  };
  const { packet, report } = tessellateSurface(flat, { countU: 2, countV: 2, revision: 7 });
  assert.deepEqual(packet, {
    version: 0, surfaceId: 'flat_patch', revision: 7, lengthUnit: 'mm',
    coordinateSystem: 'right-handed-y-up', winding: 'ccw',
    positions: [1, 2, 2, 2, 9, 2, 7, 3, 2, 8, 10, 2],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 2, 1, 2, 3, 1], parameters: [-2, 4, -2, 6, 3, 4, 3, 6],
    bounds: { min: [1, 2, 2], max: [8, 10, 2] },
  });
  assert.ok(report.maxSampledDeviationMM < 1e-12);
  validatePreviewPacket(packet);
});

test('weighted nonplanar patch retains rational weighting and independently measured triangle distance', () => {
  const result = tessellateSurface(weightedPatch, { countU: 7, countV: 6, revision: 19 });
  const independent = checkPacket(result, weightedPatch, 7, 6, (u, v) => bilinearPoint(weightedPatch, u, v));
  const nonrational = { ...weightedPatch, weights: [[1, 1], [1, 1]] };
  const midpoint = bilinearPoint(weightedPatch, 0.5, 0.5);
  const wrongMidpoint = bilinearPoint(nonrational, 0.5, 0.5);
  assert.ok(norm(sub(midpoint, wrongMidpoint)) > 1);
  // A non-unit rational-weight control must fail the analytic vertex assertion.
  const wrong = tessellateSurface(nonrational, { countU: 7, countV: 6, revision: 19 });
  assert.throws(() => checkPacket(wrong, weightedPatch, 7, 6, (u, v) => bilinearPoint(weightedPatch, u, v)), assert.AssertionError);
  assert.ok(independent.maximum > 0);
  retainAudit('weighted-nonplanar', { grid: result.report.grid, revision: result.packet.revision, probeOffsets: probes, reportMaximumMM: result.report.maxSampledDeviationMM, ...independent, certified: false });
});

test('deterministic JSON packets own arrays and preserve frozen input geometry', () => {
  const input = structuredClone(weightedPatch);
  const before = structuredClone(input);
  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
  }
  freeze(input);
  const first = tessellateSurface(input, { countU: 4, countV: 5, revision: 19 });
  const second = tessellateSurface(input, { countU: 4, countV: 5, revision: 19 });
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  for (const key of ['positions', 'normals', 'parameters', 'indices']) assert.notEqual(first.packet[key], second.packet[key]);
  assert.notEqual(first.packet.bounds.min, second.packet.bounds.min);
  first.packet.positions[0] = 999;
  first.packet.normals[0] = 999;
  first.packet.parameters[0] = 999;
  first.packet.indices[0] = 999;
  first.packet.bounds.min[0] = 999;
  assert.deepEqual(input, before);
  assert.deepEqual(tessellateSurface(input, { countU: 4, countV: 5, revision: 19 }), second);
  const revised = tessellateSurface(input, { countU: 4, countV: 5, revision: 20 });
  assert.equal(revised.packet.revision, 20);
  assert.deepEqual(revised.packet.positions, second.packet.positions);
});

test('count, revision, malformed surface, collapsed triangles and cancelling normals reject', () => {
  for (const count of [undefined, null, 0, 1, 2.5, 65, 4096, NaN, Infinity, '3']) {
    assert.throws(() => tessellateSurface(cylinder, { countU: count, countV: 3, revision: 0 }));
    assert.throws(() => tessellateSurface(cylinder, { countU: 3, countV: count, revision: 0 }));
  }
  for (const revision of [undefined, null, -1, 0.5, 2147483648, NaN, Infinity, '1']) {
    assert.throws(() => tessellateSurface(cylinder, { countU: 3, countV: 3, revision }));
  }
  for (const surface of [null, {}, { ...cylinder, kind: 'curve' }, { ...cylinder, degreeU: 6 }, { ...cylinder, weights: [[0, 1], [1, 1], [1, 1]] }, { ...cylinder, knotsV: [0, 0, 1, Infinity] }, { ...cylinder, controlPoints: Array(17).fill([[0, 0, 0], [1, 1, 1]]) }]) {
    assert.throws(() => tessellateSurface(surface, { countU: 3, countV: 3, revision: 0 }));
  }
  const collapsed = { ...weightedPatch, controlPoints: [[[0, 0, 0], [0, 0, 0]], [[0, 0, 0], [0, 0, 0]]] };
  assert.throws(() => tessellateSurface(collapsed, { countU: 3, countV: 3, revision: 0 }));
  const cancelling = {
    kind: 'surface', id: 'fold', degreeU: 1, degreeV: 1,
    knotsU: [0, 0, 0.5, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: [[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]], [[0, 0, 0], [0, 1, 0]]],
    weights: [[1, 1], [1, 1], [1, 1]],
  };
  assert.throws(() => tessellateSurface(cancelling, { countU: 3, countV: 3, revision: 0 }));
  const overCoordinate = structuredClone(weightedPatch);
  overCoordinate.controlPoints[0][0][0] = 1e6 + 1;
  assert.throws(() => tessellateSurface(overCoordinate, { countU: 3, countV: 3, revision: 0 }));
});

test('maximum grid enforces vertex, triangle, cell and probe ceilings', () => {
  const result = tessellateSurface(plane, { countU: 64, countV: 64, revision: 2147483647 });
  assert.equal(result.report.vertexCount, 4096);
  assert.equal(result.report.triangleCount, 7938);
  assert.equal(result.report.cellCount, 3969);
  assert.equal(result.report.probeCount, 19845);
  assert.equal(result.packet.revision, 2147483647);
  validatePreviewPacket(result.packet);
});

test('packet validator rejects malformed metadata, arrays, bounds, indices, winding and degeneracy', () => {
  const original = tessellateSurface(plane, { countU: 2, countV: 2, revision: 19 }).packet;
  assert.doesNotThrow(() => validatePreviewPacket(original));
  assert.throws(() => validatePreviewPacket(null));
  assert.throws(() => validatePreviewPacket({}));
  const mutations = [
    (p) => { p.version = 1; }, (p) => { p.surfaceId = 'bad id'; },
    (p) => { p.revision = -1; }, (p) => { p.revision = 2147483648; },
    (p) => { p.lengthUnit = 'cm'; }, (p) => { p.coordinateSystem = 'left-handed-y-up'; },
    (p) => { p.winding = 'cw'; }, (p) => { delete p.positions; },
    (p) => { p.positions = new Float64Array(p.positions); },
    (p) => { p.positions.pop(); }, (p) => { p.normals.pop(); }, (p) => { p.parameters.pop(); },
    (p) => { p.positions[0] = NaN; }, (p) => { p.positions[0] = 1e6 + 1; },
    (p) => { p.normals[0] = Infinity; }, (p) => { p.parameters[0] = Infinity; },
    (p) => { p.normals = p.normals.map((value) => value * 2); },
    (p) => { p.normals = p.normals.map((value) => -value); },
    (p) => { p.indices = []; }, (p) => { p.indices.pop(); },
    (p) => { p.indices[0] = -1; }, (p) => { p.indices[0] = 4; },
    (p) => { p.indices[0] = 0.5; }, (p) => { p.indices[0] = NaN; },
    (p) => { p.indices[1] = p.indices[0]; },
    (p) => { [p.indices[1], p.indices[2]] = [p.indices[2], p.indices[1]]; },
    (p) => { p.positions.splice(3, 3, ...p.positions.slice(0, 3)); },
    (p) => { p.bounds.min[0] -= 1; }, (p) => { p.bounds.max[0] += 1; },
    (p) => { delete p.bounds; }, (p) => { p.bounds.min = [0, 0]; },
    (p) => { p.positions = Array(4097 * 3).fill(0); p.normals = Array(4097 * 3).fill(0); p.parameters = Array(4097 * 2).fill(0); },
    (p) => { p.indices = Array(7939 * 3).fill(0); },
    (p) => { p.positions = Array(9).fill(0); p.normals = Array(9).fill(0); p.parameters = Array(6).fill(0); },
    (p) => { delete p.positions[0]; },
  ];
  for (const [index, mutation] of mutations.entries()) {
    const packet = structuredClone(original);
    mutation(packet);
    assert.throws(() => validatePreviewPacket(packet), `Mutation ${index} must reject`);
  }
  const before = structuredClone(original);
  validatePreviewPacket(original);
  assert.deepEqual(original, before);
});

test('committed preview sources independently match analytic positions and triangle distances', () => {
  for (const [name, countU, countV] of [['preview-flat', 2, 2], ['preview-weighted', 9, 9]]) {
    const source = readFileSync(new URL(`../../../examples/cad-nurbs/${name}.css`, import.meta.url), 'utf8');
    const compiled = compileCadModel(source,{sourceVersion:0});assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));const surface=compiled.model.objects[0];
    const result = tessellateSurface(surface, { countU, countV, revision: 19 });
    const independent = checkPacket(result, surface, countU, countV, (u, v) => bilinearPoint(surface, u, v));
    retainAudit(name, { grid: result.report.grid, revision: result.packet.revision, probeOffsets: probes, reportMaximumMM: result.report.maxSampledDeviationMM, ...independent, certified: false });
  }
});

test('defensive packet copies retain caller ownership and reject host getter data', () => {
  const original = tessellateSurface(plane, { countU: 2, countV: 2, revision: 19 }).packet;
  const before = structuredClone(original);
  const copy = copyPreviewPacket(original);
  assert.deepEqual(copy, original);
  for (const key of ['positions', 'normals', 'parameters', 'indices']) {
    assert.notEqual(copy[key], original[key]); copy[key][0] = 999;
  }
  assert.notEqual(copy.bounds, original.bounds); copy.bounds.min[0] = 999; copy.bounds.max[0] = 999;
  assert.deepEqual(original, before);
  let calls = 0;
  const accessorPacket = { ...original };
  Object.defineProperty(accessorPacket, 'positions', { enumerable: true, get() { calls++; return original.positions; } });
  assert.throws(() => copyPreviewPacket(accessorPacket));
  const accessorArray = structuredClone(original);
  Object.defineProperty(accessorArray.positions, '0', { enumerable: true, get() { calls++; return 1; } });
  assert.throws(() => copyPreviewPacket(accessorArray));
  assert.equal(calls, 0);
  assert.throws(() => copyPreviewPacket({ ...original, url: 'https://example.invalid' }));
});
