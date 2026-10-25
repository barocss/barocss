// R7.4d, cad's facade: parameters on a CadPartDocument. A part built with parameters equals the hand-written document
// with `{ parameter }` leaves byte for byte; its results equal the kernel's on that document; a part at new parameter
// values has the volume and centroid of the same part built with those numbers. What the document holds as a plain
// number refuses a parameter, typed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, withParameters, BarocssError } from '../dist/api/index.js';
import { evaluateCadPart, massPropertiesOf } from '../dist/index.js';

// An 80 × 40 × 10 plate, its width W, a Ø8 hole at (X, 20), its four vertical edges rounded R.
const plate = () => part('plate').parameter('W', 80).parameter('X', 20).parameter('R', 2)
  .box({ w: param('W'), d: 40, h: 10 })
  .hole(b => b.faces().facing('+z'), { d: 8, x: param('X'), y: 20 })
  .fillet(b => b.edges().along('z'), { radius: param('R') });
const plateDoc = () => ({
  format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { W: 80, X: 20, R: 2 },
  features: [
    { id: 'sketch1', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40] },
    { id: 'extrude1', kind: 'extrude', sketch: 'sketch1', height: 10 },
    { id: 'hole1', kind: 'hole', target: 'extrude1', center: [{ parameter: 'X' }, 20], radius: 4, face: 'extrude1.top' },
    { id: 'fillet1', kind: 'fillet', target: 'hole1', edges: ['extrude1.side0|extrude1.side1', 'extrude1.side0|extrude1.side3', 'extrude1.side1|extrude1.side2', 'extrude1.side2|extrude1.side3'], radius: { parameter: 'R' } },
  ],
});
const look = p => { const m = p.mass({ density: 1 }); return { volume: m.volume, centroid: [...m.centroid] }; };
const near = (a, b) => {
  assert.ok(Math.abs(a.volume - b.volume) <= 1e-9 * b.volume, `volume ${a.volume} vs ${b.volume}`);
  a.centroid.forEach((v, k) => assert.ok(Math.abs(v - b.centroid[k]) <= 1e-9, `centroid ${a.centroid} vs ${b.centroid}`));
};

test('bound values: the hand-written CadPartDocument with { parameter } leaves, byte for byte, and the kernel\'s results on it', () => {
  assert.equal(JSON.stringify(plate().doc), JSON.stringify(plateDoc()));
  const [output] = evaluateCadPart(plateDoc()).outputs, m = massPropertiesOf(output, 1);
  near(look(plate()), { volume: m.volume, centroid: [...m.centroid] });
});

test('withParameters: a function over the document, and the part at new values is the part built with them', () => {
  assert.deepEqual(withParameters(plateDoc(), { W: 60, X: 30 }).parameters, { W: 60, X: 30, R: 2 });
  const moved = plate().withParameters({ W: 60, X: 30, R: 3 });
  assert.equal(JSON.stringify(moved.doc), JSON.stringify({ ...plateDoc(), parameters: { W: 60, X: 30, R: 3 } }));
  near(look(moved), look(part().box({ w: 60, d: 40, h: 10 }).hole(b => b.faces().facing('+z'), { d: 8, x: 30, y: 20 }).fillet(b => b.edges().along('z'), { radius: 3 })));
  // (The fillet's stored names, picked at 80 wide, still name the four corners at 60.)
  assert.deepEqual(moved.doc.features[3].edges, plateDoc().features[3].edges);
});

test('what a CadPartDocument holds as a plain number refuses a parameter, and suppression waits for its flag', () => {
  const refusal = f => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  const p = () => part().parameter('K', 2).box({ w: 10, d: 10, h: 10 });
  const cases = [
    // (A box whose width doesn't start at 0: its far corner is x + w.)
    ['PARAMETER_UNBINDABLE', () => part().parameter('W', 10).box({ w: param('W'), d: 10, h: 10, x: 5 })],
    // (A hole's diameter: the document holds the radius.)
    ['PARAMETER_UNBINDABLE', () => p().hole(b => b.faces().facing('+z'), { d: param('K'), x: 5, y: 5 })],
    // (A scale's factor and a pattern's count are numbers in the kernel's features.)
    ['PARAMETER_UNBINDABLE', () => p().scale({ factor: param('K') })],
    ['PARAMETER_UNBINDABLE', () => p().linearPattern({ axis: 'x', spacing: 20, count: param('K') })],
    ['PARAMETER_UNKNOWN', () => p().fillet(b => b.edges().along('z'), { radius: param('R') })],
    ['UNAVAILABLE', () => plate().suppressed('fillet1')],
    ['FEATURE_UNKNOWN', () => plate().suppressed('fillet9')],
  ];
  for (const [code, f] of cases) {
    const e = refusal(f);
    assert.ok(e instanceof BarocssError, `${code}: ${e}`);
    assert.equal(e.code, code, e.message);
  }
  assert.match(refusal(cases[2][1]).message, /options that do are/);
  assert.deepEqual(plate().features().map(f => f.id), ['sketch1', 'extrude1', 'hole1', 'fillet1']);
});
