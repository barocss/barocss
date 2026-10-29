import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, outputOf, prismaticFromProfile, brepFromPrismatic, checkBrep } from '../dist/index.js';
import { buildCylindricalWrapSource, buildCylindricalWrapUVSource, isCylindricalWrapSourceError } from '../dist/features/cylindrical-wrap-source.js';
import { isCylindricalWrapMapError } from '../dist/features/cylindrical-wrap-map.js';

const options = { id: 'wrap', mapTolerance: 0.01 };
function native(radius = 10, z0 = 0, height = 30) {
  const solid = structuredClone(prismaticFromProfile({ outer: [{ kind: 'arc', start: [radius, 0], center: [0, 0], direction: 'ccw' }], height, from: z0, tag: 'post' }));
  return { solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) };
}
function refused(input, code, selected = options) {
  const before = structuredClone(input);
  assert.throws(() => buildCylindricalWrapSource(input, selected), error => (isCylindricalWrapSourceError(error) || code === 'BUDGET' && isCylindricalWrapMapError(error)) && (!code || error.code === code));
  assert.deepEqual(input, before);
}
function wall(brep, positive) {
  return brep.faces.find(face => face.surface.degreeU === 2 && face.surface.controlPoints[0][0][0] === 10 && face.surface.controlPoints[0][0][1] === 0
    && (positive ? face.surface.controlPoints[1][0][1] > 0 : face.surface.controlPoints[1][0][1] < 0));
}

test('native circle-extrusion source agrees with actual Part output and keeps the original +Y quarter', () => {
  const part = native(), before = structuredClone(part);
  const output = outputOf(evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'circle', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 },
    { id: 'post', kind: 'extrude', sketch: 'circle', height: 30 },
  ] }), 'post');
  assert.deepEqual(part.brep, output.brep);
  const result = buildCylindricalWrapSource(part, options);
  assert.equal(result.radius, 10); assert.deepEqual(result.z, [0, 30]);
  assert.equal(checkBrep(result.brep, { strict: true }).valid, true);
  assert.deepEqual(result.brep, before.brep); assert.deepEqual(result.prismatic, before.solid.solid);
  assert.equal(result.face.id, wall(before.brep, true).id); assert.equal(result.face.name, wall(before.brep, true).name);
  assert.equal(result.face.sense, 'forward'); assert.ok(result.face.surface.controlPoints[1][0][1] > 0);
  assert.deepEqual(result.quarter.knotsU, [0, 0, 0, 0.5, 0.5, 0.5]);
  assert.deepEqual(result.quarter.controlPoints, result.face.surface.controlPoints.slice(0, 3));
  assert.deepEqual(result.quarter.weights, result.face.surface.weights.slice(0, 3));
  assert.deepEqual(result.boundary.knots, result.quarter.knotsU);
  assert.equal(result.map.source.controlPoints[0][1], 0);
  assert.equal(result.map.nodes[0].u, 0); assert.equal(result.map.nodes.at(-1).u, 0.5);
  assert.equal(result.proof.nativeSourceConsistency, true); assert.equal(result.proof.historicalProducerProvenance, false);
  assert.equal(result.proof.wrappedSolid, false); assert.equal(result.proof.insertedKnots, 0);
  assert.deepEqual(part, before);
});

test('the other original semicircle retains its distinct weight bit and every protected original record', () => {
  const part = native(), other = wall(part.brep, false);
  assert.ok(other); assert.ok(other.surface.weights[1][0] !== Math.SQRT1_2);
  const result = buildCylindricalWrapSource(part, options);
  assert.deepEqual(result.brep.faces.find(face => face.id === other.id), other);
  for (const key of ['bodies', 'shells', 'faces', 'loops', 'coedges', 'edges', 'vertices']) assert.deepEqual(result.brep[key], part.brep[key]);
});

test('source, cached B-rep, options and returned data do not alias caller data', () => {
  const part = native(), before = structuredClone(part), selected = { ...options }, result = buildCylindricalWrapSource(part, selected);
  assert.notEqual(result.brep, part.brep); assert.notEqual(result.prismatic, part.solid.solid);
  assert.notEqual(result.face.surface, wall(part.brep, true).surface);
  assert.notEqual(result.quarter.controlPoints[0], result.face.surface.controlPoints[0]);
  result.brep.vertices[0].point[0] = 123;
  result.prismatic.slabs[0].regions[0].outer[0].c[0] = 123;
  result.quarter.controlPoints[0][0][0] = 123;
  assert.deepEqual(part, before); assert.deepEqual(selected, options);
});

test('the original Z slab may be above or below zero without replacing its wall domains', () => {
  for (const [radius, z0, height] of [[1, -5, 10], [10, 7, 30], [100, -100, 150]]) {
    const part = native(radius, z0, height), result = buildCylindricalWrapSource(part, options);
    assert.equal(result.radius, radius); assert.deepEqual(result.z, [z0, z0 + height]);
    assert.deepEqual(result.brep, part.brep); assert.deepEqual(result.quarter.knotsV, [0, 0, 1, 1]);
    assert.ok(result.map.bounds.nominal.upper <= options.mapTolerance);
    assert.ok(result.map.counts.rational.operations <= 200000 && result.map.counts.work <= 1048576);
    for (const row of result.quarter.controlPoints) { assert.equal(row[0][2], z0); assert.equal(row[1][2], z0 + height); }
  }
});

test('every original topology/name/sense/pcurve/tolerance or coefficient mismatch is refused', () => {
  const mutations = [
    part => { part.brep.faces[0].name += '_foreign'; },
    part => { part.brep.faces[0].sense = part.brep.faces[0].sense === 'forward' ? 'reversed' : 'forward'; },
    part => { part.brep.faces[0].surface.controlPoints[0][0][0] += Number.EPSILON * 100; },
    part => { part.brep.faces[0].surface.weights[0][0] += Number.EPSILON; },
    part => { part.brep.faces[0].surface.knotsU[0] = -0; },
    part => { part.brep.coedges[0].pcurve.controlPoints[0][0] += 0.01; },
    part => { part.brep.coedges[0].next = part.brep.coedges[0].id; },
    part => { part.brep.edges[0].vertices.reverse(); },
    part => { part.brep.edges[0].tolerance *= 2; },
    part => { part.brep.vertices[0].tolerance *= 2; },
    part => { part.brep.shells[0].closed = false; },
    part => { part.brep.faces.reverse(); },
  ];
  for (const mutate of mutations) { const part = native(); mutate(part); refused(part, 'SOURCE'); }
});

test('hollow, cut, multi-slab, displaced and non-native source families refuse atomically', () => {
  const cuts = [
    part => { part.solid.solid.slabs[0].regions[0].holes.push(part.solid.solid.slabs[0].regions[0].outer); },
    part => { part.solid.solid.slabs.push(structuredClone(part.solid.solid.slabs[0])); },
    part => { part.solid.solid.slabs[0].regions[0].outer[0].sweep /= 2; },
    part => { part.solid.solid.slabs[0].regions[0].outer[0].c[0] = 1; },
    part => { part.solid = { kind: 'brep', brep: part.brep }; },
    part => { part.moved = { from: {}, m: [], o: [0, 0, 0] }; },
  ];
  for (const mutate of cuts) { const part = native(); mutate(part); refused(part, 'SUPPORT'); }
  const part = native(); part.solid.solid.caps[0].regions[0].outer[0].r = 9;
  refused(part);
});

test('a radius label or B-rep provenance string alone cannot replace its native source geometry', () => {
  const part = native(); part.brep.source.family = 'imported-step'; refused(part, 'SOURCE');
  const copied = native(); copied.solid.solid.slabs[0].regions[0].outer[0].r = 9; refused(copied, 'SUPPORT');
  const edited = native(); edited.brep.source.id = 'different'; refused(edited, 'SOURCE');
});

test('plain own data and bounded extraction options are required without invoking getters', () => {
  const part = native(); let called = false;
  const getter = { solid: part.solid, get brep() { called = true; return part.brep; } };
  assert.throws(() => buildCylindricalWrapSource(getter, options), error => isCylindricalWrapSourceError(error) && error.code === 'INPUT');
  assert.equal(called, false);
  assert.throws(() => buildCylindricalWrapSource(Object.assign(Object.create({ foreign: true }), part), options), isCylindricalWrapSourceError);
  for (const selected of [{ ...options, id: 'x'.repeat(33) }, { ...options, mapTolerance: Infinity }, { ...options, mapTolerance: 0 }, { ...options, extra: true }]) {
    assert.throws(() => buildCylindricalWrapSource(part, selected), isCylindricalWrapSourceError);
  }
  const nonfinite = native(); nonfinite.solid.solid.slabs[0].z1 = Infinity;
  assert.throws(() => buildCylindricalWrapSource(nonfinite, options), isCylindricalWrapSourceError);
});


test('native-UV admission stays distinct from a separately certified full inverse request', () => {
  const part = native(100, -100, 150), before = structuredClone(part);
  const result = buildCylindricalWrapUVSource(part, { id: 'native_uv' });
  assert.deepEqual(result.brep, before.brep); assert.deepEqual(result.z, [-100, 50]);
  assert.deepEqual(result.carrier.domain, [0, 0.5]);
  assert.equal(result.carrier.meaning.chart, false); assert.equal(result.carrier.meaning.inverse, false);
  assert.equal(Object.hasOwn(result, 'map'), false);
  assert.equal(Object.hasOwn(result.carrier, 'nodes'), false);
  assert.equal(result.proof.nativeSourceConsistency, true); assert.equal(result.proof.wrappedSolid, false);
  assert.notEqual(result.brep, part.brep);
  const full = buildCylindricalWrapSource(part, { ...options, id: 'native_uv' });
  assert.deepEqual(full.brep, result.brep); assert.deepEqual(full.quarter, result.quarter);
  assert.ok(full.map.nodes.length > 2 && full.map.bounds.nominal.upper <= options.mapTolerance);
  assert.equal(full.map.meaning.chart, 'nominal-radius-times-original-carrier-angle');
  assert.equal(result.carrier.meaning.inverse, false);
  assert.throws(() => buildCylindricalWrapUVSource(part, { id: 'native_uv', mapTolerance: 0.01 }), isCylindricalWrapSourceError);
  assert.deepEqual(part, before);
});
