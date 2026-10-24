// R7, cad's facade: a part built through it equals the hand-written CadPartDocument byte for byte, and its results
// equal evaluateCadPart's own outputs on that document byte for byte (mass in MMGS, from the kernel's kg units).
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, BarocssError } from '../dist/api/index.js';
import { evaluateCadPart, tessellateBrep } from '../dist/index.js';

// The bracket by hand: an 80 × 40 × 10 block, a Ø8 hole through it at (20, 20), its four vertical edges rounded R2.
const handWritten = () => ({
  format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
  features: [
    { id: 'sketch1', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 40] },
    { id: 'extrude1', kind: 'extrude', sketch: 'sketch1', height: 10 },
    { id: 'hole1', kind: 'hole', target: 'extrude1', center: [20, 20], radius: 4 },
    { id: 'fillet1', kind: 'fillet', target: 'hole1', edges: ['extrude1.side0|extrude1.side1', 'extrude1.side0|extrude1.side3', 'extrude1.side1|extrude1.side2', 'extrude1.side2|extrude1.side3'], radius: 2 },
  ],
});

const bracket = () => part('bracket')
  .box(80, 40, 10)
  .hole({ at: [20, 20], diameterMM: 8 })
  .fillet(body => body.edges().along('z'), 2);

// (exportStep stamps the export's time in FILE_NAME; the two runs are compared without it.)
const unstamped = text => text.replace(/'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d'/g, "'stamp'");

test('the facade writes the hand-written CadPartDocument, byte for byte', () => {
  assert.equal(JSON.stringify(bracket().doc), JSON.stringify(handWritten()));
});

test('its mass, STEP, STL and meshes are the kernel\'s own on that document, byte for byte', () => {
  const [output] = evaluateCadPart(handWritten()).outputs, m = output.massProperties(2700);
  // (MMGS, api-conventions.md §2: the kernel's kg and kg·m² × 1000 and × 1e9; its density in kg/m³ is g/cm³ × 1000.)
  const expected = { volumeMM3: m.volumeMM3, massG: m.massKG * 1000, centroidMM: [...m.centroidMM], inertiaGMM2: m.inertiaCentroidKgM2.map(row => row.map(v => v * 1e9)) };
  assert.equal(JSON.stringify(bracket().mass(2.7)), JSON.stringify(expected));
  assert.equal(unstamped(bracket().step()), unstamped(output.exportStep({ name: 'bracket' })));
  assert.deepEqual(Buffer.from(bracket().stl()), Buffer.from(output.exportStl()));
  const [mesh] = bracket().meshes(), t = tessellateBrep(output.brep);
  assert.equal(mesh.key, output.id);
  assert.deepEqual([Buffer.from(mesh.positions.buffer), Buffer.from(mesh.normals.buffer), Buffer.from(mesh.indices.buffer)], [Buffer.from(t.positionsMM.buffer), Buffer.from(t.normals.buffer), Buffer.from(t.indices.buffer)]);
});

test('every method returns a new part and leaves the old one as it was', () => {
  const block = part('b').box(80, 40, 10), before = JSON.stringify(block.doc);
  const holed = block.hole({ at: [20, 20], diameterMM: 8 });
  assert.equal(JSON.stringify(block.doc), before);
  assert.notEqual(JSON.stringify(holed.doc), before);
  const copy = holed.doc; copy.features.length = 0;
  assert.equal(holed.doc.features.length, 3);
});

test('typed selectors read the kernel\'s B-rep by its persistent names, its seams and tangent joints left out', () => {
  const body = part().box(80, 40, 10).hole({ at: [20, 20], diameterMM: 8 }).select();
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
  const e1 = refusal(() => part().hole({ at: [0, 0], diameterMM: 4 }));
  assert.ok(e1 instanceof BarocssError); assert.equal(e1.code, 'NO_BODY'); assert.equal(e1.where, 'facade');
  const e2 = refusal(() => part().box(10, 10, 10).mass(0));
  assert.ok(e2 instanceof BarocssError); assert.equal(e2.code, 'DENSITY');
  // A fillet larger than its walls: the kernel refuses it, and the facade passes its code and words on.
  const e3 = refusal(() => part().box(10, 10, 10).fillet(b => b.edges().along('z'), 8).mass(2.7));
  assert.ok(e3 instanceof BarocssError); assert.equal(e3.where, 'evaluate');
  assert.equal(e3.details?.feature, 'fillet1');
  assert.ok(e3.code !== 'EVALUATION', 'the kernel\'s code, not a stand-in');
  assert.match(e3.message, /^\[[A-Z_]+\] /);
  assert.equal(e3.message.indexOf(`[${e3.code}]`), e3.message.lastIndexOf(`[${e3.code}]`), 'the code appears once');
});
