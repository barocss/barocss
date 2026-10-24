// R7.4b, cad's facade grown: cylinder, sketch → extrude and revolve on a Plane, chamfer, shell, union, subtract and
// intersect, the patterns, a body chooser and Location. Each part built through it equals its hand-written
// CadPartDocument byte for byte, and its results equal the kernel's own on that document byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch, Plane, Location, BarocssError } from '../dist/api/index.js';
import { evaluateCadPart, exportStep } from '../dist/index.js';

const doc = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const tags = n => ({ outer: Array.from({ length: n }, (_, k) => `e${k + 1}`) });

// A 60 × 40 × 8 plate, a Ø8 bore cut through it by a cylinder, its top's four straight edges chamfered 1.
const plate = () => part('plate').box({ wMM: 60, dMM: 40, hMM: 8 })
  .subtract(p => p.cylinder({ rMM: 4, hMM: 20, xMM: 15, yMM: 20, zMM: -6 }))
  .chamfer(b => b.faces().facing('+z').edges().straight(), { distanceMM: 1 });
const plateDoc = () => doc([
  { id: 'sketch1', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] },
  { id: 'extrude1', kind: 'extrude', sketch: 'sketch1', height: 8 },
  { id: 'sketch2', kind: 'sketch', profile: 'circle', center: [15, 20], radius: 4 },
  { id: 'extrude2', kind: 'extrude', sketch: 'sketch2', height: 20, from: -6 },
  { id: 'difference1', kind: 'difference', target: 'extrude1', tool: 'extrude2' },
  { id: 'chamfer1', kind: 'chamfer', target: 'difference1', edges: ['extrude1.side0|extrude1.top', 'extrude1.side1|extrude1.top', 'extrude1.side2|extrude1.top', 'extrude1.side3|extrude1.top'], distance: 1 },
]);

// A cup: a 20 × 30 section on XZ turned a full turn about Z, hollowed to 2 mm walls with its top open.
const cup = () => part('cup').revolve(sketch(Plane.XZ).polygon([[0, 0], [20, 0], [20, 30], [0, 30]])).shell(b => b.faces().facing('+z'), { tMM: 2 });
const cupDoc = () => doc([
  { id: 'sketch1', kind: 'sketch', profile: 'polygon', points: [[0, 0], [20, 0], [20, 30], [0, 30]], plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] }, sideTags: tags(4) },
  { id: 'revolve1', kind: 'revolve', sketch: 'sketch1', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 },
  // (A full turn's top: the turned side e3, a disc in two halves.)
  { id: 'shell1', kind: 'shell', target: 'revolve1', thickness: 2, open: ['revolve1.side[e3]#1', 'revolve1.side[e3]#2'] },
]);

// A ring of six blocks round Z, two tiers, stood up on X and lifted 5.
const ring = () => part('ring').box({ wMM: 10, dMM: 10, hMM: 5, xMM: 20 }).circularPattern({ count: 6 }).linearPattern({ axis: 'z', spacingMM: 10, count: 2 })
  .moved(Location.of({ positionMM: [0, 0, 5], rotationDeg: [90, 0, 0] }));
const ringDoc = () => doc([
  { id: 'sketch1', kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [30, 10] },
  { id: 'extrude1', kind: 'extrude', sketch: 'sketch1', height: 5 },
  { id: 'circular-pattern1', kind: 'circular-pattern', target: 'extrude1', axis: 'z', angleDegrees: 60, count: 6 },
  { id: 'linear-pattern1', kind: 'linear-pattern', target: 'circular-pattern1', axis: 'z', spacing: 10, count: 2 },
  { id: 'rotate1', kind: 'rotate', target: 'linear-pattern1', axis: 'x', angleDegrees: 90 },
  { id: 'translate1', kind: 'translate', target: 'rotate1', offset: [0, 0, 5] },
]);

// Two bodies: a block and a peg through it; the peg's top rim rounded (the chooser), joined to the block by name, and
// the whole cut down to a 20 × 20 core by intersecting with a box the callback adds.
const pegged = () => {
  const p = part('pegged').box({ wMM: 30, dMM: 30, hMM: 10 }).cylinder({ rMM: 5, hMM: 30, xMM: 15, yMM: 15 });
  const q = p.body('extrude2').fillet(b => b.edges().curved().sortBy('z').last(2), { radiusMM: 1 });
  return q.body('extrude1').union('fillet1').intersect(x => x.box({ wMM: 20, dMM: 20, hMM: 40, xMM: 5, yMM: 5 }));
};
const peggedDoc = () => doc([
  { id: 'sketch1', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 30] },
  { id: 'extrude1', kind: 'extrude', sketch: 'sketch1', height: 10 },
  { id: 'sketch2', kind: 'sketch', profile: 'circle', center: [15, 15], radius: 5 },
  { id: 'extrude2', kind: 'extrude', sketch: 'sketch2', height: 30 },
  { id: 'fillet1', kind: 'fillet', target: 'extrude2', edges: ['extrude2.side0#2|extrude2.top', 'extrude2.side0#1|extrude2.top'], radius: 1 },
  { id: 'union1', kind: 'union', target: 'extrude1', tool: 'fillet1' },
  { id: 'sketch3', kind: 'sketch', profile: 'rectangle', min: [5, 5], max: [25, 25] },
  { id: 'extrude3', kind: 'extrude', sketch: 'sketch3', height: 40 },
  { id: 'intersect1', kind: 'intersect', target: 'union1', tool: 'extrude3' },
]);

// Two bodies of sketches on other planes: a drafted tab from a loop on XY lifted 5, and a quarter-turned ring section on YZ.
const tabs = () => part('tabs')
  .extrude(sketch(Plane.XY.offset(5)).moveTo([0, 0]).lineTo([30, 0]).arcTo([30, 20], { center: [30, 10] }).lineTo([0, 20]).close(), { hMM: 6, draftDeg: 3 })
  .revolve(sketch(Plane.YZ).rectangle({ wMM: 4, dMM: 6, xMM: 10 }), { angleDeg: 90 });
const tabsDoc = () => doc([
  { id: 'sketch1', kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [30, 0], center: [30, 10], direction: 'ccw' }, { kind: 'line', start: [30, 20] }, { kind: 'line', start: [0, 20] }], plane: { origin: [0, 0, 5], normal: [0, 0, 1], xAxis: [1, 0, 0] }, sideTags: tags(4) },
  { id: 'extrude1', kind: 'extrude', sketch: 'sketch1', height: 6, draft: 3 },
  { id: 'sketch2', kind: 'sketch', profile: 'rectangle', min: [10, 0], max: [14, 6], plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }, sideTags: tags(4) },
  { id: 'revolve1', kind: 'revolve', sketch: 'sketch2', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 90 },
]);

const CASES = [['plate', plate, plateDoc], ['cup', cup, cupDoc], ['ring', ring, ringDoc], ['pegged', pegged, peggedDoc], ['tabs', tabs, tabsDoc]];
// (exportStep stamps the export's time in FILE_NAME; the two runs are compared without it.)
const unstamped = text => text.replace(/'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d'/g, "'stamp'");
// (MMGS, api-conventions.md §2, from the kernel's kg units: its density in kg/m³ is g/cm³ × 1000.)
const mmgs = m => ({ volumeMM3: m.volumeMM3, massG: m.massKG * 1000, centroidMM: [...m.centroidMM], inertiaGMM2: m.inertiaCentroidKgM2.map(row => row.map(v => v * 1e9)) });

for (const [name, built, hand] of CASES) {
  test(`${name}: the facade writes the hand-written CadPartDocument, byte for byte`, () => {
    assert.equal(JSON.stringify(built().doc), JSON.stringify(hand()));
  });
  test(`${name}: its bodies, mass and STEP are the kernel's own on that document`, () => {
    const outputs = evaluateCadPart(hand()).outputs, p = built();
    assert.deepEqual(p.bodies(), outputs.map(o => o.id));
    for (const o of outputs) assert.equal(JSON.stringify(p.body(o.id).mass({ densityGPerCm3: 1.2 })), JSON.stringify(mmgs(o.massProperties(1200))));
    const step = outputs.length === 1 ? outputs[0].exportStep({ name }) : exportStep(outputs.map(o => o.brep), { name });
    assert.equal(unstamped(p.step()), unstamped(step));
  });
}

test('a body chooser leaves the document as it was, and follows its body through the verbs that replace it', () => {
  const p = part().box({ wMM: 30, dMM: 30, hMM: 10 }).cylinder({ rMM: 5, hMM: 30, xMM: 15, yMM: 15 });
  assert.equal(JSON.stringify(p.body('extrude2').doc), JSON.stringify(p.doc));
  const q = p.body('extrude2').fillet(b => b.edges().curved().sortBy('z').last(2), { radiusMM: 1 });
  // (The peg's fillet replaced the peg: the choice is the fillet's body now, so the next verb acts on it.)
  assert.deepEqual(q.bodies(), ['extrude1', 'fillet1']);
  assert.equal(q.mass({ densityGPerCm3: 1 }).volumeMM3, q.body('fillet1').mass({ densityGPerCm3: 1 }).volumeMM3);
});

test('Plane, Location and Sketch are immutable values with plain data', () => {
  const lifted = Plane.XY.offset(5);
  assert.deepEqual(Plane.XY.data, { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] });
  assert.deepEqual(lifted.data.origin, [0, 0, 5]);
  assert.ok(Object.isFrozen(Plane.XZ) && Object.isFrozen(Location.IDENTITY));
  assert.deepEqual(Location.at([1, 2, 3]).data, { positionMM: [1, 2, 3], rotationDeg: [0, 0, 0] });
  const s = sketch().circle({ rMM: 2 }), d = s.data;
  d.radius = 99;
  assert.equal(s.data.radius, 2);
  assert.equal(JSON.stringify(sketch().rectangle({ wMM: 2, dMM: 3 }).data), JSON.stringify({ profile: 'rectangle', min: [0, 0], max: [2, 3], sideTags: tags(4) }));
});

test('the growth\'s refusals are typed, the facade\'s own before the kernel\'s', () => {
  const refusal = f => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  const two = () => part().box({ wMM: 10, dMM: 10, hMM: 10 }).cylinder({ rMM: 2, hMM: 10, xMM: 30 });
  const cases = [
    ['BODY_AMBIGUOUS', () => two().mass({ densityGPerCm3: 1 })],
    ['BODY_UNKNOWN', () => two().body('nope')],
    ['VALUE', () => two().body('extrude1').union('extrude1')],
    ['SELECTION_ONE', () => two().body('extrude1').subtract(x => x.box({ wMM: 1, dMM: 1, hMM: 1 }).box({ wMM: 1, dMM: 1, hMM: 1, xMM: 5 }))],
    ['VALUE', () => part().revolve(sketch(Plane.XZ).rectangle({ wMM: 1, dMM: 1, xMM: 1 }), { angleDeg: 400 })],
    ['VALUE', () => part().box({ wMM: 10, dMM: 10, hMM: 10, yMM: 20 }).circularPattern({ axis: 'x', count: 5 })],
    ['VALUE', () => part().box({ wMM: 10, dMM: 10, hMM: 10 }).linearPattern({ axis: 'x', spacingMM: 20, count: 1 })],
    ['VALUE', () => Plane.of({ origin: [0, 0, 0], normal: [0, 0, 2], xAxis: [1, 0, 0] })],
    ['VALUE', () => Plane.of({ origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [0, 0, 1] })],
    ['VALUE', () => sketch().moveTo([0, 0]).lineTo([0, 0]).close()],
    ['SELECTION_EMPTY', () => part().box({ wMM: 10, dMM: 10, hMM: 10 }).chamfer(b => b.edges().curved(), { distanceMM: 1 })],
    ['NO_BODY', () => part().shell({ tMM: 1 })],
  ];
  for (const [code, f] of cases) {
    const e = refusal(f);
    assert.ok(e instanceof BarocssError, `${code}: ${e}`);
    assert.equal(e.code, code, e.message);
    assert.equal(e.where, 'facade');
  }
  // A chamfer wider than the walls: the kernel refuses it, at the verb, its code passed on.
  const k = refusal(() => part().box({ wMM: 10, dMM: 10, hMM: 10 }).chamfer(b => b.edges().along('z'), { distanceMM: 6 }));
  assert.ok(k instanceof BarocssError); assert.equal(k.where, 'evaluate'); assert.equal(k.details?.feature, 'chamfer1');
});
