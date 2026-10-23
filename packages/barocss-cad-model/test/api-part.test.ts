// R7's first slice: a part built through the facade equals the hand-written document byte for byte, and its results
// equal the core functions' on that document byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, BarocssError } from '../src/api';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, stepFor } from '../src/engine/evaluate';
import { bodyMass } from '../src/app/mass';

// The bracket by hand: an 80 × 40 × 10 block, a Ø8 hole through it at (20, 20), its four vertical edges rounded R2.
function handWritten(): StudioDoc {
  const block = rectanglePart(80, 40, 10);
  const holed = withNode(block, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [20, 20], radius: 4 });
  return withNode(holed, { kind: 'fillet', parent: { node: 2, side: 'solid' }, edges: ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3'], radius: 2 });
}

const bracket = () => part('bracket')
  .box(80, 40, 10)
  .hole({ at: [20, 20], diameterMM: 8 })
  .fillet(body => body.edges().along('z'), 2);

// (stepFor stamps the export's time in FILE_NAME; the two runs are compared without it.)
const unstamped = (text: string) => text.replace(/'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d'/g, "'stamp'");

test('the facade writes the hand-written document, byte for byte', () => {
  assert.equal(JSON.stringify(bracket().doc), JSON.stringify(handWritten()));
});

test('its mass and STEP are the core functions\' on that document, byte for byte', () => {
  const doc = handWritten(), r = evaluateDoc(doc, 7);
  assert.ok(r.ok);
  const body = r.bodies[0], props = bodyMass(body, 2.7)!;
  // (MMGS: the core's inertia is in kg·mm² today, the facade's in g·mm², api-conventions.md §2.)
  const expected = { volumeMM3: body.volumeMM3, massG: props.massG, centroidMM: props.centroid, inertiaGMM2: props.inertia.map(row => row.map(v => v * 1000)) };
  assert.equal(JSON.stringify(bracket().mass('al6061')), JSON.stringify(expected));
  const core = stepFor(doc, 'bracket');
  assert.ok('text' in core);
  assert.equal(unstamped(bracket().step()), unstamped(core.text));
});

test('every method returns a new part and leaves the old one as it was', () => {
  const block = part('b').box(80, 40, 10), before = JSON.stringify(block.doc);
  const holed = block.hole({ at: [20, 20], diameterMM: 8 });
  assert.equal(JSON.stringify(block.doc), before);
  assert.notEqual(JSON.stringify(holed.doc), before);
  // (`.doc` is a copy: changing it changes nothing in the part.)
  const copy = holed.doc; copy.nodes.length = 0;
  assert.equal(holed.doc.nodes.length, 3);
});

test('typed selectors read the core\'s edges and faces by their names', () => {
  const holed = part().box(80, 40, 10).hole({ at: [20, 20], diameterMM: 8 });
  const body = holed.select();
  assert.deepEqual(body.edges().along('z').names(), ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3']);
  assert.deepEqual(body.faces().facing('+z').names(), ['n1.top']);
  // The top face's edges: its four sides and the hole's rim (a closed curve, two names).
  const top = body.faces().facing('+z').edges();
  assert.equal(top.count, 5);
  assert.equal(top.curved().names().length, 2);
  assert.deepEqual(body.edges().along('x').sortBy('z').last(2).names(), ['n1.side0|n1.top', 'n1.side2|n1.top']);
});

test('refusals are typed: the facade\'s own, and the core\'s passed through with its code', () => {
  const refusal = (f: () => unknown) => { try { f(); } catch (e) { return e; } assert.fail('no refusal'); };
  const e1 = refusal(() => part().hole({ at: [0, 0], diameterMM: 4 }));
  assert.ok(e1 instanceof BarocssError); assert.equal(e1.code, 'NO_BODY'); assert.equal(e1.where, 'facade');
  const e2 = refusal(() => part().box(10, 10, 10).fillet(b => b.edges().along('z').where(() => false), 1));
  assert.ok(e2 instanceof BarocssError); assert.equal(e2.code, 'SELECTION_EMPTY');
  const e3 = refusal(() => part().box(10, 10, 10).mass('unobtainium'));
  assert.ok(e3 instanceof BarocssError); assert.equal(e3.code, 'MATERIAL_UNKNOWN');
  // A fillet larger than its walls: the kernel refuses it, and the facade passes its code and words on.
  const e4 = refusal(() => part().box(10, 10, 10).fillet(b => b.edges().along('z'), 8).mass('al6061'));
  assert.ok(e4 instanceof BarocssError); assert.equal(e4.where, 'evaluate');
  assert.ok(e4.details?.friendly, 'the core\'s own words are kept');
  assert.match(e4.message, /^\[[A-Z_]+\] /);
});
