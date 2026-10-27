import test from 'node:test';
import assert from 'node:assert/strict';
import { brepFromTriangles, readObj, readStl, encodeBinaryStl, brepMassProperties, checkBrep, isMeshBrepError, exportStep, outputOf, massPropertiesOf } from '../dist/index.js';

// A 20 × 10 × 5 box as an OBJ: six quads, wound outward.
const BOX_OBJ = `# box
v 0 0 0\nv 20 0 0\nv 20 10 0\nv 0 10 0\nv 0 0 5\nv 20 0 5\nv 20 10 5\nv 0 10 5
f 1 4 3 2\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\n`;
const volume = b => brepMassProperties(b, 1, { segmentsPerQuarter: 4, quadratureSegments: 0 }).volume;

test('a closed mesh becomes a planar solid: coplanar triangles one face, the volume exact', () => {
  const { positions, indices } = readObj(BOX_OBJ);
  assert.equal(indices.length, 12 * 3, 'quads fanned into two triangles each');
  const b = brepFromTriangles(positions, indices, { id: 'box' });
  assert.equal(b.faces.length, 6, 'six faces, not twelve triangles');
  assert.equal(b.edges.length, 12); assert.equal(b.vertices.length, 8);
  assert.ok(Math.abs(volume(b) - 1000) < 1e-9, String(volume(b)));
  assert.deepEqual(checkBrep(b).issues, []);
  // Wound inward, it is turned outward; written as STEP it goes out as a solid.
  const inward = indices.slice(); for (let t = 0; t < inward.length; t += 3) [inward[t + 1], inward[t + 2]] = [inward[t + 2], inward[t + 1]];
  assert.ok(Math.abs(volume(brepFromTriangles(positions, inward)) - 1000) < 1e-9);
  assert.match(exportStep([b], { name: 'box' }), /MANIFOLD_SOLID_BREP/);
});

test('STL in and out: a binary file round-trips, an ASCII one reads; a plate with a hole keeps the hole as a loop', () => {
  const { positions, indices } = readObj(BOX_OBJ);
  const bin = encodeBinaryStl(positions, indices, 'box'), tris = readStl(bin);
  assert.equal(tris.length, 12 * 9);
  assert.ok(Math.abs(volume(brepFromTriangles(tris, null)) - 1000) < 1e-9);
  const ascii = new TextEncoder().encode('solid t\n' + Array.from({ length: 12 }, (_, t) => `facet normal 0 0 0\n outer loop\n${[0, 1, 2].map(k => `  vertex ${tris[t * 9 + k * 3]} ${tris[t * 9 + k * 3 + 1]} ${tris[t * 9 + k * 3 + 2]}`).join('\n')}\n endloop\nendfacet`).join('\n') + '\nendsolid t\n');
  assert.deepEqual([...readStl(ascii)], [...tris]);
  // A square frame (an 8 × 8 plate with a 4 × 4 hole, 2 thick): its top and bottom are one face each, with a hole.
  const P = [], I = [], ring = (s, z) => [[-s, -s, z], [s, -s, z], [s, s, z], [-s, s, z]];
  for (const p of [...ring(4, 0), ...ring(2, 0), ...ring(4, 2), ...ring(2, 2)]) P.push(...p);
  const quad = (a, b, c, d) => I.push(a, b, c, a, c, d);
  for (let k = 0; k < 4; k++) {
    const o = k, o1 = (k + 1) % 4;
    quad(o, o + 4, o1 + 4, o1); // bottom ring piece (facing −z)
    quad(8 + o, 8 + o1, 12 + o1, 12 + o); // top ring piece (facing +z)
    quad(o, o1, 8 + o1, 8 + o); // outer wall
    quad(4 + o, 12 + o, 12 + o1, 4 + o1); // hole wall
  }
  const frame = brepFromTriangles(P, I, { id: 'frame' });
  assert.equal(frame.faces.length, 10, 'top, bottom, four outer walls, four hole walls');
  assert.ok(frame.faces.some(f => f.loops.length === 2), 'a face with its hole');
  assert.ok(Math.abs(volume(frame) - (64 - 16) * 2) < 1e-9);
});

test('a mesh that does not close, or crosses itself in winding, is refused with the reason', () => {
  const { positions, indices } = readObj(BOX_OBJ);
  assert.throws(() => brepFromTriangles(positions, indices.slice(0, -3)), e => isMeshBrepError(e) && /not closed: 3 edges/.test(e.message));
  const bad = indices.slice(); [bad[1], bad[2]] = [bad[2], bad[1]];
  assert.throws(() => brepFromTriangles(positions, bad), e => isMeshBrepError(e) && /not consistently wound|not closed/.test(e.message));
  assert.throws(() => readStl(new TextEncoder().encode('hello')), /neither a binary STL/);
  assert.throws(() => readObj('v 0 0 0\nf 1 2 3'), /does not have/);
});

test('a mesh feature in a part: a solid with faces named after it, a hole drilled through it', async () => {
  const { evaluateCadPart } = await import('../dist/index.js');
  const { positions, indices } = readObj(BOX_OBJ);
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const part = evaluateCadPart(D([{ id: 'm', kind: 'mesh', positions, indices }, { id: 'h', kind: 'hole', target: 'm', center: [10, 5], radius: 2 }]));
  const out = outputOf(part, 'h');
  assert.ok(Math.abs(massPropertiesOf(out).volume - (1000 - Math.PI * 4 * 5)) < 1e-6);
  assert.ok(out.brep.faces.some(f => /^m\.facet\d+$/.test(f.name ?? '')));
  assert.throws(() => evaluateCadPart(D([{ id: 'm', kind: 'mesh', positions, indices: indices.slice(0, -3) }])), /not closed/);
});
