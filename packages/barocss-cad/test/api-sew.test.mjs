import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, sewSpec, BarocssError, Location } from '../dist/api/index.js';
import { evaluateCadPart, checkBrep, outputOf, saveCadPart, loadCadPart, surfaceAreaOf, tessellateBrep } from '../dist/index.js';

// Independent asymmetric 40 × 30 × 12 box; mixed authored orientations and nonunit domains.
const points = [
  [[[10,-6,3],[50,-6,3]],[[10,24,3],[50,24,3]]],
  [[[10,-6,15],[50,-6,15]],[[10,24,15],[50,24,15]]],
  [[[10,-6,3],[10,-6,15]],[[50,-6,3],[50,-6,15]]],
  [[[10,24,3],[10,24,15]],[[50,24,3],[50,24,15]]],
  [[[10,-6,3],[10,-6,15]],[[10,24,3],[10,24,15]]],
  [[[50,-6,3],[50,-6,15]],[[50,24,3],[50,24,15]]],
];
function boxSurfaces() { return points.map(controlPoints => ({ degreeU: 1, degreeV: 1, knotsU: [-2,-2,6,6], knotsV: [1,1,7,7], controlPoints: structuredClone(controlPoints), weights: [[1,1],[1,1]] })); }
const refused = (run, code, where = 'facade') => assert.throws(run, e => e instanceof BarocssError && e.code === code && e.where === where);
const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} expected ${expected}`);
const namesOf = p => outputOf(evaluateCadPart(p.doc), p.doc.features.find(f => f.kind === 'sew').id).brep.faces.map(f => f.name);
function faceArea(mesh, faceId) {
  const face = mesh.faces.find(f => f.faceId === faceId), p = mesh.positions, ix = mesh.indices;
  let area = 0;
  for (let i = face.indexOffset; i < face.indexOffset + face.indexCount; i += 3) {
    const a = 3 * ix[i], b = 3 * ix[i+1], c = 3 * ix[i+2];
    const u = [p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]], v = [p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];
    area += Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]) / 2;
  }
  return area;
}
function qualifiedBox(p, order = [0,1,2,3,4,5]) {
  const mass = p.mass({ density: 1 }); near(mass.volume, 14400, 1e-6);
  for (let k = 0; k < 3; k++) near(mass.centroid[k], [30,9,9][k]);
  const feature = p.doc.features.find(f => f.kind === 'sew'), brep = outputOf(evaluateCadPart(p.doc), feature.id).brep;
  assert.equal(checkBrep(brep).valid, true); assert.equal(brep.bodies.length, 1);
  assert.equal(brep.bodies[0].kind, 'solid'); assert.equal(brep.bodies[0].shells.length, 1); assert.equal(brep.shells.find(s => s.id === brep.bodies[0].shells[0]).closed, true);
  assert.equal(brep.vertices.length, 8); assert.equal(brep.edges.length, 12); assert.equal(brep.faces.length, 6);
  for (let k = 0; k < 3; k++) {
    near(Math.min(...brep.vertices.map(v => v.point[k])), [10,-6,3][k]);
    near(Math.max(...brep.vertices.map(v => v.point[k])), [50,24,15][k]);
  }
  const expectedCentroids = [[30,9,3],[30,9,15],[30,-6,9],[30,24,9],[10,9,9],[50,9,9]];
  const expectedNormals = [[0,0,-1],[0,0,1],[0,-1,0],[0,1,0],[-1,0,0],[1,0,0]];
  const faces = p.select().faces().list(), mesh = tessellateBrep(brep); near(surfaceAreaOf(outputOf(evaluateCadPart(p.doc), feature.id)), 4080, 1e-6);
  for (let i = 0; i < 6; i++) {
    const name = `${feature.id}.surface${i}`, face = faces.find(f => f.name === name); assert.ok(face, name);
    near(faceArea(mesh, brep.faces.find(f => f.name === name).id), [1200,1200,480,480,360,360][order[i]], 1e-6);
    for (let k = 0; k < 3; k++) { near(face.centroid[k], expectedCentroids[order[i]][k]); near(face.normal[k], expectedNormals[order[i]][k]); }
    assert.deepEqual(feature.surfaces[i], boxSurfaces()[order[i]]);
  }
  assert.deepEqual(namesOf(p), Array.from({ length: 6 }, (_, i) => `${feature.id}.surface${i}`));
}

test('public sew: ordered natural surfaces create the independent closed box for explicit and automatic tolerances', () => {
  for (const options of [undefined, {}, { tol: 0 }, { tol: 0.01 }, { tol: 0.02 }, { tol: 1 }]) {
    const source = part('sewn box'), before = source.doc, surfaces = boxSurfaces(), original = structuredClone(surfaces), originalOptions = structuredClone(options);
    const accepted = source.sew(surfaces, options); qualifiedBox(accepted);
    assert.deepEqual(accepted.bodies(), ['sew1']); assert.deepEqual(source.doc, before);
    const feature = accepted.doc.features[0]; assert.deepEqual(feature.surfaces, original);
    assert.equal(Object.hasOwn(feature, 'tolerance'), !!options?.tol);
    const brep = outputOf(evaluateCadPart(accepted.doc), feature.id).brep;
    for (const entity of [...brep.vertices, ...brep.edges]) near(entity.tolerance, options?.tol || 0.05);
    if (options?.tol) assert.equal(feature.tolerance, options.tol);
    assert.deepEqual(surfaces, original); assert.deepEqual(options, originalOptions);
    surfaces[0].controlPoints[0][0][0] = 900; surfaces.reverse();
    const copy = accepted.doc; copy.features[0].surfaces.reverse();
    assert.deepEqual(accepted.doc.features[0], feature);
  }
});

test('public sew: reordered snapshots keep their authored surface-to-name relation', () => {
  qualifiedBox(part().sew(boxSurfaces().reverse(), { tol: 0.01 }), [5,4,3,2,1,0]);
});

test('public sew: spec captures strict outer and inner data without accessors and preserves order', () => {
  const surfaces = boxSurfaces(), original = structuredClone(surfaces), options = { tol: 0.01 }, spec = sewSpec(surfaces, options);
  assert.deepEqual(spec.surfaces, original); assert.equal(spec.values.tol, 0.01);
  surfaces.reverse(); surfaces[0].weights[0][0] = 4; options.tol = 0.5;
  assert.deepEqual(spec.surfaces, original); assert.equal(spec.values.tol, 0.01);
  assert.deepEqual(sewSpec(original).values, { tol: 0 });
  const reversed = sewSpec([...original].reverse()); assert.deepEqual(reversed.surfaces, [...original].reverse());
  const invalid = [null, {}, [], original.slice(0,1), Array(65).fill(original[0]), new Set(original), Object.assign(Object.create({}), original)];
  const sparse = boxSurfaces(); delete sparse[4]; invalid.push(sparse);
  const extra = boxSurfaces(); extra.metadata = true; invalid.push(extra);
  const symbol = boxSurfaces(); symbol[Symbol('source')] = true; invalid.push(symbol);
  const foreign = boxSurfaces(); Object.setPrototypeOf(foreign, { ...Array.prototype }); invalid.push(foreign);
  let reads = 0;
  const accessor = boxSurfaces(); Object.defineProperty(accessor, '5', { get() { reads++; throw Error('getter'); } }); invalid.push(accessor);
  const inner = boxSurfaces(); Object.defineProperty(inner[5], 'degreeU', { get() { reads++; throw Error('getter'); } }); invalid.push(inner);
  for (const list of invalid) refused(() => sewSpec(list), 'VALUE');
  assert.equal(reads, 0);
  for (const mutate of [s => { s.trims = []; }, s => { s.knotsU[0] = Infinity; }, s => { delete s.controlPoints[0][0][1]; }, s => { s.weights[0][0] = 0; }]) {
    const list = boxSurfaces(); mutate(list[5]); refused(() => sewSpec(list), 'VALUE');
  }
  const wide = boxSurfaces(); wide[0].controlPoints[0][0][0] = 1e6; assert.equal(sewSpec(wide).surfaces[0].controlPoints[0][0][0], 1e6);
  assert.equal(sewSpec(Array(64).fill(original[0])).surfaces.length, 64);
  const degree5 = { degreeU: 5, degreeV: 1, knotsU: [...Array(6).fill(-2), ...Array(6).fill(6)], knotsV: [1,1,7,7], controlPoints: [], weights: [] };
  for (let u = 0; u < 6; u++) { degree5.controlPoints.push([[u,0,0],[u,1,0]]); degree5.weights.push([1e6,1e6]); }
  assert.equal(sewSpec([degree5, original[0]]).surfaces[0].degreeU, 5);
});

test('public sew: numeric tolerance admission and existing parameter boundaries refuse without mutation', () => {
  const source = part().parameter('T', 0.01), before = source.doc;
  for (const tol of [-1, NaN, Infinity, -Infinity, 1.000001, '0.01', null, {}, []]) refused(() => source.sew(boxSurfaces(), { tol }), 'VALUE');
  refused(() => source.sew(boxSurfaces(), { tol: param('T') }), 'PARAMETER_UNBINDABLE');
  refused(() => source.sew(boxSurfaces(), { tol: param('missing') }), 'PARAMETER_UNKNOWN');
  assert.deepEqual(source.doc, before);
});

test('public sew: constructor preserves the witness focus and Boolean tool focus follows the new body', () => {
  const witness = part().box({ w: 12, d: 7, h: 5, x: 80, y: -3, z: 1 }).body('extrude1'), before = witness.doc;
  const names = witness.select().faces().names(), mass = witness.mass({ density: 1 }), pair = witness.sew(boxSurfaces(), { tol: 0.01 });
  assert.deepEqual(pair.bodies(), ['extrude1', 'sew1']); assert.deepEqual(pair.select().faces().names(), names);
  assert.deepEqual(pair.mass({ density: 1 }), mass); near(mass.volume, 420); for (let k = 0; k < 3; k++) near(mass.centroid[k], [86,0.5,3.5][k]);
  qualifiedBox(pair.body('sew1')); assert.deepEqual(witness.doc, before);
  const stock = part().box({ w: 80, d: 60, h: 30, x: -10, y: -20, z: -5 }), stockDoc = stock.doc;
  const cut = stock.subtract(p => p.sew(boxSurfaces()).moved(Location.at([0,0,1])));
  assert.deepEqual(cut.bodies(), ['difference1']); near(cut.mass({ density: 1 }).volume, 144000 - 14400, 1e-6);
  assert.equal(cut.doc.features.find(f => f.kind === 'translate').target, 'sew1'); assert.deepEqual(stock.doc, stockDoc);
});

test('public sew: native closure refusals leave source inputs and accepted document unchanged', () => {
  const source = part().box({ w: 12, d: 7, h: 5, x: 80 }), before = source.doc, surfaces = boxSurfaces(), original = structuredClone(surfaces);
  const disconnected = [...surfaces, ...surfaces.map(s => ({ ...s, controlPoints: s.controlPoints.map(row => row.map(([x,y,z]) => [x+100,y,z])) }))];
  for (const invalid of [surfaces.slice(1), [...surfaces, surfaces[0]], disconnected]) {
    assert.throws(() => source.sew(invalid, { tol: 0.01 }), e => e instanceof BarocssError && e.where === 'evaluate' && e.code === 'GEOMETRY' && e.details?.kernelCode === 'GEOMETRY' && /close|surfaces|disconnect|connected/i.test(e.message));
    assert.deepEqual(source.doc, before); assert.deepEqual(surfaces, original);
  }
});

test('public sew: native save/read retains recipe order, numeric tolerance and names', () => {
  for (const tol of [0.01, 0.02, 0]) {
    const accepted = part().sew(boxSurfaces(), { tol }), snapshot = evaluateCadPart(accepted.doc), loaded = loadCadPart(saveCadPart(snapshot));
    assert.deepEqual(loaded.document, snapshot.document);
    assert.deepEqual(outputOf(loaded, 'sew1').brep, outputOf(snapshot, 'sew1').brep);
    const reopened = part('reopened', loaded.document); qualifiedBox(reopened); assert.deepEqual(namesOf(reopened), namesOf(accepted));
  }
});
