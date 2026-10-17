import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPointInFacets, facetBrepFromTriangles, facetBrepsFromTriangles, facetPieces, FACET_PREVIEW_TRIANGLES, brepFromTriangles, readObj, brepMassProperties, brepSurfaceArea, checkBrep, exportStep, importStep, tessellateBrep, transformBrep, evaluateCadPart, CadPartError, FACET_EXPLODE_TRIANGLES, MeshBrepError, faceGeometry, facetArea } from '../dist/index.js';

// Facet faces (F0, R3): a closed mesh as regions of typed-array triangles, polyline edges between them.

const BOX_OBJ = `v 0 0 0\nv 20 0 0\nv 20 10 0\nv 0 10 0\nv 0 0 5\nv 20 0 5\nv 20 10 5\nv 0 10 5
f 1 4 3 2\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\n`;
const mass = b => brepMassProperties(b, 1000, { quadratureSegments: 0 });

/** A UV sphere: `n` around, `m` from pole to pole, wound outward. */
function sphere(r, n, m) {
  const P = [0, 0, -r], I = [];
  for (let j = 1; j < m; j++) { const phi = -Math.PI / 2 + Math.PI * j / m; for (let i = 0; i < n; i++) { const th = 2 * Math.PI * i / n; P.push(r * Math.cos(phi) * Math.cos(th), r * Math.cos(phi) * Math.sin(th), r * Math.sin(phi)); } }
  P.push(0, 0, r);
  const top = P.length / 3 - 1, at = (j, i) => 1 + (j - 1) * n + (i % n);
  for (let i = 0; i < n; i++) I.push(0, at(1, i + 1), at(1, i));
  for (let j = 1; j < m - 1; j++) for (let i = 0; i < n; i++) I.push(at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j, i), at(j + 1, i + 1), at(j + 1, i));
  for (let i = 0; i < n; i++) I.push(at(m - 1, i), at(m - 1, i + 1), top);
  return { positions: P, indices: I };
}
/** The exact volume of a closed mesh (tetrahedra from the origin). */
function meshVolume(P, I) { let v = 0; for (let t = 0; t < I.length; t += 3) { const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map(k => [P[3 * k], P[3 * k + 1], P[3 * k + 2]]); v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]); } return v / 6; }
/** A cylinder: `n` sides, radius r, height h, capped with fans, wound outward. */
function cylinder(r, h, n) {
  const P = [0, 0, 0, 0, 0, h], I = [];
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; P.push(r * Math.cos(a), r * Math.sin(a), 0, r * Math.cos(a), r * Math.sin(a), h); }
  const lo = i => 2 + 2 * (i % n), hi = i => 3 + 2 * (i % n);
  for (let i = 0; i < n; i++) I.push(0, lo(i + 1), lo(i), 1, hi(i), hi(i + 1), lo(i), lo(i + 1), hi(i + 1), lo(i), hi(i + 1), hi(i));
  return { positions: P, indices: I };
}

test('a box: six flat regions, twelve polyline edges, valid, exact volume and area; flat regions read as planes', () => {
  const { positions, indices } = readObj(BOX_OBJ);
  const b = facetBrepFromTriangles(positions, indices, { id: 'box' });
  assert.deepEqual(checkBrep(b).issues, []);
  assert.deepEqual(checkBrep(b, { strict: true }).issues, []);
  assert.equal(b.faces.length, 6); assert.equal(b.edges.length, 12); assert.equal(b.vertices.length, 8);
  assert.ok(b.faces.every(f => f.surface.kind === 'facets' && f.name.startsWith('box.region')));
  const m = mass(b);
  assert.ok(Math.abs(m.volumeMM3 - 1000) < 1e-9, String(m.volumeMM3)); assert.equal(m.method, 'planar-exact');
  assert.ok(Math.abs(brepSurfaceArea(b) - 2 * (200 + 100 + 50)) < 1e-9);
  assert.deepEqual(b.faces.map(f => faceGeometry(f).kind), Array(6).fill('plane'));
  // Display: the region triangles as they are, watertight against the polyline edges (the same points).
  const mesh = tessellateBrep(b);
  assert.equal(mesh.indices.length, 12 * 3); assert.ok(mesh.faces.every(f => f.kind === 'facet'));
});

test('a sphere (one smooth region) is split in two, every face bounded; volume and centroid exact for the facets', () => {
  const { positions, indices } = sphere(10, 24, 12);
  const b = facetBrepFromTriangles(positions, indices, { id: 's' });
  assert.deepEqual(checkBrep(b).issues, []);
  assert.equal(b.faces.length, 2);
  assert.ok(b.faces.every(f => f.loops.length >= 1));
  const m = mass(b);
  assert.ok(Math.abs(m.volumeMM3 - meshVolume(positions, indices)) < 1e-9 * m.volumeMM3);
  assert.ok(Math.hypot(...m.centroidMM) < 1e-9);
  assert.equal(b.faces.map(f => faceGeometry(f).kind).join(), 'other,other');
  // The quadrature path (a mixed body's) gives the same exact sums.
  const q = brepMassProperties(b, 1000);
  assert.ok(Math.abs(q.volumeMM3 - m.volumeMM3) < 1e-9 * m.volumeMM3, `${q.volumeMM3} vs ${m.volumeMM3}`);
  assert.ok(Math.abs(b.faces.reduce((s, f) => s + facetArea(f.surface), 0) - brepSurfaceArea(b)) < 1e-9 * brepSurfaceArea(b));
});

test('a cylinder: caps and side are three regions (creases at the rims, the 15° side steps smooth); a closed rim gets one vertex', () => {
  const { positions, indices } = cylinder(5, 10, 24);
  const b = facetBrepFromTriangles(positions, indices, { id: 'c' });
  assert.deepEqual(checkBrep(b).issues, []);
  assert.equal(b.faces.length, 3); assert.equal(b.edges.length, 2); assert.equal(b.vertices.length, 2);
  // Each rim edge: a polyline through the 24 rim vertices, closed on its one vertex.
  for (const e of b.edges) { assert.equal(e.curve.degree, 1); assert.equal(e.curve.controlPoints.length, 25); assert.equal(e.vertices[0], e.vertices[1]); }
  // Tessellated edges are exactly those vertices: no T-junctions against the facets.
  const mesh = tessellateBrep(b);
  assert.deepEqual(mesh.edges.map(e => e.pointsMM.length / 3), [25, 25]);
  assert.ok(Math.abs(mass(b).volumeMM3 - meshVolume(positions, indices)) < 1e-9 * 800);
  // Finer creases split the side; a 10° turn keeps 24 sides apart.
  assert.equal(facetBrepFromTriangles(positions, indices, { id: 'c', creaseDegrees: 10 }).faces.length, 26);
});

test('moved, turned and mirrored: patches mapped, a mirror turns the faces over; volume kept, the check passes', () => {
  const { positions, indices } = readObj(BOX_OBJ), b = facetBrepFromTriangles(positions, indices, { id: 'box' });
  const moved = transformBrep(b, { matrix: [0, -1, 0, 1, 0, 0, 0, 0, 1], offset: [100, 0, 0] });
  assert.deepEqual(checkBrep(moved).issues, []); assert.ok(Math.abs(mass(moved).volumeMM3 - 1000) < 1e-9);
  assert.ok(moved.faces.every((f, k) => f.surface.positions !== b.faces[k].surface.positions));
  const mirrored = transformBrep(b, { matrix: [-1, 0, 0, 0, 1, 0, 0, 0, 1] });
  assert.deepEqual(checkBrep(mirrored).issues, []); assert.ok(Math.abs(mass(mirrored).volumeMM3 - 1000) < 1e-9);
  // An identity map (a rename) shares the arrays.
  const renamed = transformBrep(b, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, n => 'x' + n);
  assert.ok(renamed.faces.every((f, k) => f.surface === b.faces[k].surface && f.name === 'x' + b.faces[k].name));
});

test('noisy meshes: regions capped by smoothing then merging; broken meshes refused as before', () => {
  // A sphere with every vertex jittered: thousands of tiny regions without the cap.
  const { positions, indices } = sphere(10, 64, 32);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  const noisy = positions.map(x => x + rnd() * 0.4);
  const b = facetBrepFromTriangles(noisy, indices, { id: 'n', maximumRegions: 50 });
  assert.ok(b.faces.length <= 50, String(b.faces.length));
  assert.deepEqual(checkBrep(b).issues, []);
  assert.ok(Math.abs(mass(b).volumeMM3 - meshVolume(noisy, indices)) < 1e-9 * mass(b).volumeMM3);
  // Open, inconsistently wound, in two pieces: refused with the reason.
  const box = readObj(BOX_OBJ);
  assert.throws(() => facetBrepFromTriangles(box.positions, box.indices.slice(0, -3)), /not closed/);
  const flipped = box.indices.slice(); [flipped[1], flipped[2]] = [flipped[2], flipped[1]];
  assert.throws(() => facetBrepFromTriangles(box.positions, flipped), MeshBrepError);
  const two = [...box.positions, ...box.positions.map((x, i) => i % 3 === 0 ? x + 50 : x)], twoI = [...box.indices, ...box.indices.map(i => i + 8)];
  assert.throws(() => facetBrepFromTriangles(two, twoI), /more than one piece \(2 pieces\)/);
});

test('part model: a mesh node with representation facets is faceted; old nodes stay planar (their names resolve); F0 Booleans explode small meshes, refuse large ones', () => {
  const { positions, indices } = readObj(BOX_OBJ);
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const mesh = (rep, P = positions, I = indices) => ({ id: 'm', kind: 'mesh', positions: P, indices: I, ...(rep ? { representation: rep } : {}) });
  const faceted = evaluateCadPart(D([mesh('facets')])).output('m');
  assert.equal(faceted.representation, 'faceted');
  assert.ok(faceted.brep.faces.every(f => f.name.startsWith('m.region')));
  const planar = evaluateCadPart(D([mesh()])).output('m');
  assert.equal(planar.representation, 'planar');
  assert.ok(planar.brep.faces.every(f => /^m\.facet\d+$/.test(f.name)));
  // A hole through a small facet body: through the planar path, the volume exact.
  const hole = evaluateCadPart(D([mesh('facets'), { id: 'h', kind: 'hole', target: 'm', center: [10, 5], radius: 2 }])).output('h');
  assert.ok(Math.abs(hole.massProperties(1).volumeMM3 - (1000 - Math.PI * 4 * 5)) < 1e-6);
  // Fillets on mesh faces are refused with CAPABILITY.
  assert.throws(() => evaluateCadPart(D([mesh('facets'), { id: 'f', kind: 'fillet', target: 'm', edges: ['x'], radius: 1 }])), e => e instanceof CadPartError && e.code === 'CAPABILITY' && /mesh faces arrives with F1\/F2/.test(e.message));
  // A 6240-triangle mesh: a hole is made when committed (up to 16000), not previewed (over 5000).
  const big = sphere(10, 80, 40), drilled = D([mesh('facets', big.positions, big.indices), { id: 'h', kind: 'hole', target: 'm', center: [0, 0], radius: 2 }]);
  assert.ok(big.indices.length / 3 > FACET_PREVIEW_TRIANGLES && big.indices.length / 3 <= FACET_EXPLODE_TRIANGLES);
  assert.ok(evaluateCadPart(drilled).output('h').massProperties(1).volumeMM3 < meshVolume(big.positions, big.indices));
  assert.throws(() => evaluateCadPart(drilled, undefined, { facetExplodeTriangles: FACET_PREVIEW_TRIANGLES }), e => e instanceof CadPartError && e.code === 'CAPABILITY' && /not previewed \(this mesh has 6240\): apply to run it \(up to 16000\)/.test(e.message));
  // Over 16000: refused, naming what is missing.
  const huge = sphere(10, 160, 80);
  assert.throws(() => evaluateCadPart(D([mesh('facets', huge.positions, huge.indices), { id: 'h', kind: 'hole', target: 'm', center: [0, 0], radius: 2 }])), e => e instanceof CadPartError && e.code === 'CAPABILITY' && /Booleans on large meshes arrive with F1\/F2 \(this mesh has 25280 triangles; up to 16000/.test(e.message));
});

test('STEP: a facet body goes out as its triangles (planar faces), and reads back with the same volume', () => {
  const { positions, indices } = cylinder(5, 10, 24), b = facetBrepFromTriangles(positions, indices, { id: 'c' });
  const text = exportStep([b], { name: 'c' });
  const back = importStep(text);
  assert.ok(Math.abs(brepMassProperties(back, 1).volumeMM3 - meshVolume(positions, indices)) < 1e-6);
  // The planar builder agrees.
  assert.ok(Math.abs(brepMassProperties(brepFromTriangles(positions, indices), 1).volumeMM3 - mass(b).volumeMM3) < 1e-9);
});

test('a mesh in pieces: each closed piece its own body (parts id/j, faces id.partj.regionk), its volume; facetPieces counts them', () => {
  const box = readObj(BOX_OBJ), s = sphere(1, 12, 6);
  // A box, and a small sphere (a floater) beside it.
  const P = [...box.positions, ...s.positions.map((x, i) => x + (i % 3 === 0 ? 40 : 0))], I = [...box.indices, ...s.indices.map(i => i + 8)];
  const pieces = facetPieces(P, I);
  assert.deepEqual(pieces.map(p => p.triangles), [12, s.indices.length / 3]);
  assert.ok(Math.abs(pieces[0].volumeMM3 - 1000) < 1e-9 && pieces[1].volumeMM3 < 5);
  const breps = facetBrepsFromTriangles(P, I, { id: 'k' });
  assert.equal(breps.length, 2);
  assert.ok(breps[0].faces.every(f => /^k\.part0\.region\d+$/.test(f.name)) && breps[1].faces.every(f => /^k\.part1\.region\d+$/.test(f.name)));
  assert.deepEqual(breps.map(b => b.bodies[0].id), ['k_part0', 'k_part1']);
  for (const b of breps) assert.deepEqual(checkBrep(b).issues, []);
  // In a part: outputs m/0 and m/1, the document's typed arrays taken as they are (and saved as plain arrays).
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'm', kind: 'mesh', positions: Float64Array.from(P), indices: Uint32Array.from(I), representation: 'facets', each: true }] };
  const snap = evaluateCadPart(doc);
  assert.deepEqual(snap.outputs.map(o => o.id), ['m/0', 'm/1']);
  assert.ok(Math.abs(snap.output('m/0').massProperties(1).volumeMM3 - 1000) < 1e-9);
  assert.equal(snap.document.features[0].positions, doc.features[0].positions, 'not copied');
  assert.ok(Array.isArray(JSON.parse(snap.save()).features[0].positions));
  // Evaluated again with the same arrays, the mesh is reused (its key hashed once per array).
  assert.deepEqual(snap.withDocument(doc).recomputation.reused, ['m']);
  // One piece asked of a mesh in two: refused, saying how many.
  assert.throws(() => evaluateCadPart({ ...doc, features: [{ ...doc.features[0], each: false }] }), /more than one piece \(2 pieces\)/);
});

test('points against a facet body: inside, outside, on (faces, edges, vertices), through the BVH; a frame\'s hole is outside', () => {
  const box = facetBrepFromTriangles(readObj(BOX_OBJ).positions, readObj(BOX_OBJ).indices, { id: 'b' });
  assert.equal(classifyPointInFacets(box, [10, 5, 2.5]), 'inside');
  assert.equal(classifyPointInFacets(box, [30, 5, 2.5]), 'outside');
  assert.equal(classifyPointInFacets(box, [10, 5, 5]), 'on', 'on the top');
  assert.equal(classifyPointInFacets(box, [20, 10, 5]), 'on', 'on a corner');
  assert.equal(classifyPointInFacets(box, [20, 5, 5]), 'on', 'on an edge');
  assert.equal(classifyPointInFacets(box, [10, 5, 5 + 1e-6]), 'outside', 'just above');
  // Points level with the box's edges and corners (rays from them graze): still told.
  assert.equal(classifyPointInFacets(box, [25, 10, 5]), 'outside');
  assert.equal(classifyPointInFacets(box, [10, 10 - 1e-7, 2.5]), 'inside');
  // A sphere: 2000 random points agree with the distance from the centre (away from the facets' chord band).
  const s = sphere(10, 48, 24), b = facetBrepFromTriangles(s.positions, s.indices, { id: 's' });
  let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 24 - 12; };
  let checked = 0;
  for (let k = 0; k < 2000; k++) {
    const p = [rnd(), rnd(), rnd()], r = Math.hypot(...p);
    if (Math.abs(r - 10) < 0.2) continue;
    assert.equal(classifyPointInFacets(b, p), r < 10 ? 'inside' : 'outside', String(p)); checked++;
  }
  assert.ok(checked > 1500);
  // The square frame (genus 1): its hole is outside, its wall inside.
  const ring = (q, z) => [[-q, -q, z], [q, -q, z], [q, q, z], [-q, q, z]], P = [], I = [];
  for (const p of [...ring(4, 0), ...ring(2, 0), ...ring(4, 2), ...ring(2, 2)]) P.push(...p);
  const quad = (a, b, c, d) => I.push(a, b, c, a, c, d);
  for (let k = 0; k < 4; k++) { const o = k, o1 = (k + 1) % 4; quad(o, o + 4, o1 + 4, o1); quad(8 + o, 8 + o1, 12 + o1, 12 + o); quad(o, o1, 8 + o1, 8 + o); quad(4 + o, 12 + o, 12 + o1, 4 + o1); }
  const frame = facetBrepFromTriangles(P, I, { id: 'f' });
  assert.equal(classifyPointInFacets(frame, [0, 0, 1]), 'outside');
  assert.equal(classifyPointInFacets(frame, [3, 0, 1]), 'inside');
  // Not a facet body: refused.
  assert.throws(() => classifyPointInFacets(brepFromTriangles(readObj(BOX_OBJ).positions, readObj(BOX_OBJ).indices), [1, 1, 1]), /only bodies of facet faces/);
});
