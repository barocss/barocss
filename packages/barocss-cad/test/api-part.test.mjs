// R7, cad's facade: a part built through it equals the hand-written CadPartDocument byte for byte, and its results
// equal evaluateCadPart's own outputs on that document byte for byte (mass in MMGS, from the kernel's kg units).
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, BarocssError } from '../dist/api/index.js';
import { evaluateCadPart, tessellateBrep, massPropertiesOf, exportStep, exportStl } from '../dist/index.js';

// The bracket by hand: an 80 × 40 × 10 block, a Ø8 hole through it at (20, 20), its four vertical edges rounded R2.
const handWritten = () => ({
  format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
  features: [
    { id: 'sketch1', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 40] },
    { id: 'extrude1', kind: 'extrude', sketch: 'sketch1', height: 10 },
    { id: 'hole1', kind: 'hole', target: 'extrude1', center: [20, 20], radius: 4, face: 'extrude1.top' },
    { id: 'fillet1', kind: 'fillet', target: 'hole1', edges: ['extrude1.side0|extrude1.side1', 'extrude1.side0|extrude1.side3', 'extrude1.side1|extrude1.side2', 'extrude1.side2|extrude1.side3'], radius: 2 },
  ],
});

// (The verbs are the agent's v2 commands, their options the commands' values with units: api-conventions.md §12.)
const bracket = () => part('bracket')
  .box({ w: 80, d: 40, h: 10 })
  .hole(body => body.faces().facing('+z'), { d: 8, x: 20, y: 20 })
  .fillet(body => body.edges().along('z'), { radius: 2 });

// (exportStep stamps the export's time in FILE_NAME; the two runs are compared without it.)
const unstamped = text => text.replace(/'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d'/g, "'stamp'");

test('the facade writes the hand-written CadPartDocument, byte for byte', () => {
  assert.equal(JSON.stringify(bracket().doc), JSON.stringify(handWritten()));
});

test('its mass, STEP, STL and meshes are the kernel\'s own on that document, byte for byte', () => {
  const [output] = evaluateCadPart(handWritten()).outputs, m = massPropertiesOf(output, 2.7);
  // (The kernel's mass is MMGS since R7.3b: the facade's result shape over it, nothing converted.)
  const expected = { volumeMM3: m.volume, massG: m.mass, centroidMM: [...m.centroid], inertiaGMM2: m.inertia.map(row => [...row]) };
  assert.equal(JSON.stringify(bracket().mass({ density: 2.7 })), JSON.stringify(expected));
  assert.equal(unstamped(bracket().step()), unstamped(exportStep(output, { name: 'bracket' })));
  assert.deepEqual(Buffer.from(bracket().stl()), Buffer.from(exportStl(output)));
  const [mesh] = bracket().meshes(), t = tessellateBrep(output.brep);
  assert.equal(mesh.key, output.id);
  // (The common mesh shape, §10.3: the kernel's Float64 positions and normals as Float32.)
  assert.deepEqual([Buffer.from(mesh.positions.buffer), Buffer.from(mesh.normals.buffer), Buffer.from(mesh.indices.buffer)], [Buffer.from(Float32Array.from(t.positionsMM).buffer), Buffer.from(Float32Array.from(t.normals).buffer), Buffer.from(t.indices.buffer)]);
});

test('every method returns a new part and leaves the old one as it was', () => {
  const block = part('b').box({ w: 80, d: 40, h: 10 }), before = JSON.stringify(block.doc);
  const holed = block.hole(b => b.faces().facing('+z'), { d: 8, x: 20, y: 20 });
  assert.equal(JSON.stringify(block.doc), before);
  assert.notEqual(JSON.stringify(holed.doc), before);
  const copy = holed.doc; copy.features.length = 0;
  assert.equal(holed.doc.features.length, 3);
});

test('typed selectors read the kernel\'s B-rep by its persistent names, its seams and tangent joints left out', () => {
  const body = part().box({ w: 80, d: 40, h: 10 }).hole(b => b.faces().facing('+z'), { d: 8, x: 20, y: 20 }).select();
  assert.deepEqual(body.edges().along('z').names(), ['extrude1.side0|extrude1.side1', 'extrude1.side0|extrude1.side3', 'extrude1.side1|extrude1.side2', 'extrude1.side2|extrude1.side3']);
  assert.deepEqual(body.faces().facing('+z').names(), ['extrude1.top']);
  // The top face's edges: its four sides and the hole's rim (two half-circle edges).
  const top = body.faces().facing('+z').edges();
  assert.equal(top.count, 6);
  assert.equal(top.curved().count, 2);
  assert.deepEqual(body.edges().along('x').sortBy('z').last(2).names(), ['extrude1.side0|extrude1.top', 'extrude1.side2|extrude1.top']);
});

test('refusals are typed: the facade\'s own, and the kernel\'s passed through with its code, once', () => {
  const refusal = f => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  const e1 = refusal(() => part().hole(b => b.faces().facing('+z'), { d: 4, x: 0, y: 0 }));
  assert.ok(e1 instanceof BarocssError); assert.equal(e1.code, 'NO_BODY'); assert.equal(e1.where, 'facade');
  const e2 = refusal(() => part().box({ w: 10, d: 10, h: 10 }).mass({ density: 0 }));
  assert.ok(e2 instanceof BarocssError); assert.equal(e2.code, 'DENSITY');
  // A fillet larger than its walls: the kernel refuses it, and the facade passes its code and words on.
  const e3 = refusal(() => part().box({ w: 10, d: 10, h: 10 }).fillet(b => b.edges().along('z'), { radius: 8 }).mass({ density: 2.7 }));
  assert.ok(e3 instanceof BarocssError); assert.equal(e3.where, 'evaluate');
  assert.equal(e3.details?.feature, 'fillet1');
  assert.ok(e3.code !== 'EVALUATION', 'the kernel\'s code, not a stand-in');
  assert.match(e3.message, /^\[[A-Z_]+\] /);
  // (Two faces picked where a hole needs one, and a value that is no length: the facade's own, before the kernel.)
  const e4 = refusal(() => part().box({ w: 10, d: 10, h: 10 }).hole(b => b.faces().planar(), { d: 2, x: 5, y: 5 }));
  assert.equal(e4.code, 'SELECTION_ONE');
  const e5 = refusal(() => part().box({ w: -1, d: 10, h: 10 }));
  assert.equal(e5.code, 'VALUE');
  assert.equal(e3.message.indexOf(`[${e3.code}]`), e3.message.lastIndexOf(`[${e3.code}]`), 'the code appears once');
});
