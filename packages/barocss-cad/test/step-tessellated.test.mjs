import test from 'node:test';
import assert from 'node:assert/strict';
import { exportStep, importStep, stepMeshes, stepValidationProperties, facetBrepFromTriangles, brepMassProperties, brepSurfaceArea, checkBrep, evaluateCadPart, MESH_PLANAR_TRIANGLES, CadPartLimits, stepTessellatedChars, outputOf, massPropertiesOf } from '../dist/index.js';

// AP242 tessellated STEP (R3.5): mesh bodies written as triangulated faces (or planar faces, for older readers) and
// read back as facet faces with their names; mixed files with B-rep solids beside them.
function sphere(r, n, m, c = [0, 0, 0]) {
  const P = [c[0], c[1], c[2] - r], I = [];
  for (let j = 1; j < m; j++) { const phi = -Math.PI / 2 + Math.PI * j / m; for (let i = 0; i < n; i++) { const th = 2 * Math.PI * i / n; P.push(c[0] + r * Math.cos(phi) * Math.cos(th), c[1] + r * Math.cos(phi) * Math.sin(th), c[2] + r * Math.sin(phi)); } }
  P.push(c[0], c[1], c[2] + r);
  const top = P.length / 3 - 1, at = (j, i) => 1 + (j - 1) * n + (i % n);
  for (let i = 0; i < n; i++) I.push(0, at(1, i + 1), at(1, i));
  for (let j = 1; j < m - 1; j++) for (let i = 0; i < n; i++) I.push(at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j, i), at(j + 1, i + 1), at(j + 1, i));
  for (let i = 0; i < n; i++) I.push(at(m - 1, i), at(m - 1, i + 1), top);
  return { P, I };
}
/** A cylinder: caps and side three regions. */
function cylinder(r, h, n) {
  const P = [0, 0, 0, 0, 0, h], I = [];
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; P.push(r * Math.cos(a), r * Math.sin(a), 0, r * Math.cos(a), r * Math.sin(a), h); }
  const lo = i => 2 + 2 * (i % n), hi = i => 3 + 2 * (i % n);
  for (let i = 0; i < n; i++) I.push(0, lo(i + 1), lo(i), 1, hi(i), hi(i + 1), lo(i), lo(i + 1), hi(i + 1), lo(i), hi(i + 1), hi(i));
  return { P, I };
}
const props = b => { const m = brepMassProperties(b, 1); return { v: m.volume, c: m.centroid, a: brepSurfaceArea(b) }; };

test('tessellated: a mesh body out as AP242 triangulated faces and back — volume, area, centroid and face names the same', () => {
  const { P, I } = cylinder(5, 10, 48), b = facetBrepFromTriangles(P, I, { id: 'm' });
  const text = exportStep([b], { name: 'cyl', meshes: 'tessellated' });
  assert.match(text, /FILE_SCHEMA\(\('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF/);
  assert.equal((text.match(/=TRIANGULATED_FACE\(/g) ?? []).length, 3);
  assert.match(text, /=TESSELLATED_SOLID\(/); assert.match(text, /=TESSELLATED_SHAPE_REPRESENTATION\(/);
  assert.ok(!/ADVANCED_FACE/.test(text), 'no B-rep faces');
  const back = importStep(text, { id: 'r' });
  assert.deepEqual(checkBrep(back).issues, []);
  assert.deepEqual(back.faces.map(f => f.name).sort(), b.faces.map(f => f.name).sort());
  const p0 = props(b), p1 = props(back);
  assert.ok(Math.abs(p1.v - p0.v) < 1e-9 * p0.v && Math.abs(p1.a - p0.a) < 1e-9 * p0.a && p1.c.every((x, k) => Math.abs(x - p0.c[k]) < 1e-9));
  // The validation properties are written for it too.
  const gvp = stepValidationProperties(text);
  assert.ok(Math.abs(gvp.volume - p0.v) < 1e-6 * p0.v);
});

test('auto: planar faces up to the threshold (any reader), tessellated above; planar forced and tessellated forced both read back', () => {
  const small = cylinder(5, 10, 48), big = sphere(10, 80, 40);
  const sb = facetBrepFromTriangles(small.P, small.I, { id: 's' }), bb = facetBrepFromTriangles(big.P, big.I, { id: 'b' });
  assert.ok(small.I.length / 3 <= MESH_PLANAR_TRIANGLES && big.I.length / 3 > MESH_PLANAR_TRIANGLES);
  assert.ok(/ADVANCED_FACE/.test(exportStep([sb])) && !/TRIANGULATED_FACE/.test(exportStep([sb])), 'small: planar');
  assert.ok(/TRIANGULATED_FACE/.test(exportStep([bb])), 'big: tessellated');
  const planar = exportStep([bb], { meshes: 'planar' }), tess = exportStep([bb], { meshes: 'tessellated' });
  assert.ok(planar.length > 10 * tess.length, `planar ${planar.length} vs tessellated ${tess.length}`);
  for (const text of [planar, tess]) assert.ok(Math.abs(props(importStep(text)).v - props(bb).v) < 1e-6 * props(bb).v);
});

test('mixed: a B-rep solid and a mesh body in one file (the convergent case) — both read back', () => {
  const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
  const plate = outputOf(evaluateCadPart(D([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'p', kind: 'extrude', sketch: 's', height: 5 }])), 'p').brep;
  const ball = sphere(5, 24, 12, [20, 10, 20]), mesh = facetBrepFromTriangles(ball.P, ball.I, { id: 'ball' });
  const text = exportStep([plate, mesh], { meshes: 'tessellated' });
  assert.match(text, /ADVANCED_FACE/); assert.match(text, /TRIANGULATED_FACE/); assert.match(text, /SHAPE_REPRESENTATION_RELATIONSHIP/);
  const back = importStep(text);
  assert.equal(back.bodies.length, 2);
  const v = brepMassProperties(back, 1).volume, want = brepMassProperties(plate, 1).volume + brepMassProperties(mesh, 1).volume;
  assert.ok(Math.abs(v - want) < 1e-6 * want, `${v} vs ${want}`);
  assert.equal(stepMeshes(text), null, 'a file with B-rep solids: not a mesh file');
});

test('from another system: a tessellated shell that does not close comes in as a sheet (never closed by guessing); stepMeshes gives its triangles', () => {
  const quad = `ISO-10303-21;
HEADER;FILE_DESCRIPTION((''),'2;1');FILE_NAME('a.stp','',(''),(''),'','','');FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF { 1 0 10303 442 1 1 4 }'));ENDSEC;
DATA;
#1=COORDINATES_LIST('',4,((0.,0.,0.),(10.,0.,0.),(10.,10.,0.),(0.,10.,0.)));
#2=TRIANGULATED_FACE('top',#1,4,(),$,(),((1,2,3),(1,3,4)));
#3=TESSELLATED_SHELL('scan',(#2),$);
ENDSEC;
END-ISO-10303-21;
`;
  const b = importStep(quad);
  assert.equal(b.bodies[0].kind, 'sheet');
  assert.deepEqual(b.faces.map(f => f.name), ['top']);
  const meshes = stepMeshes(quad);
  assert.deepEqual([meshes.length, meshes[0].name, meshes[0].indices.length], [1, 'scan', 6]);
});

test('size caps (D49): past stepBytes only when the excess is tessellated, never past stepTessellatedBytes — each refused before it is read', () => {
  const { P, I } = sphere(10, 24, 12), step = exportStep([facetBrepFromTriangles(P, I, { id: 'ball' })], { meshes: 'tessellated' });
  assert.ok(stepTessellatedChars(step) > 0.8 * step.length, `${stepTessellatedChars(step)} of ${step.length}`);
  const part = text => evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'i', kind: 'import', step: text }] });
  // A mesh file past 32 MiB (its coordinates list padded with spaces, which STEP allows between tokens) reads.
  const big = step.replace('COORDINATES_LIST(', `COORDINATES_LIST(${' '.repeat(CadPartLimits.stepBytes)}`);
  assert.ok(big.length > CadPartLimits.stepBytes);
  assert.ok(Math.abs(massPropertiesOf(outputOf(part(big), 'i'), 1).volume - massPropertiesOf(outputOf(part(step), 'i'), 1).volume) < 1e-9);
  // The same excess outside the meshes (a B-rep file that size) is refused, saying how much.
  const brepish = step.replace('DATA;', `DATA;\n/*${' '.repeat(CadPartLimits.stepBytes)}*/`);
  assert.throws(() => part(brepish), /larger than 32 MiB outside its meshes \(32\.0 MiB\)/);
  // Past 64 MiB it still reads (the owner's 128 MiB, D49); past 128 MiB, a mesh too is refused, pointing to the .bcad file.
  assert.equal(CadPartLimits.stepTessellatedBytes, 128 << 20);
  assert.equal(part(step.replace('COORDINATES_LIST(', `COORDINATES_LIST(${' '.repeat(65 << 20)}`)).outputs.length, 1);
  assert.throws(() => part(step.replace('COORDINATES_LIST(', `COORDINATES_LIST(${' '.repeat(CadPartLimits.stepTessellatedBytes)}`)), /larger than 128 MiB; a mesh that large opens from a \.bcad file/);
});
