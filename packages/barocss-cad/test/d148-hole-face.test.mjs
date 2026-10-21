import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart } from '../dist/index.js';

// D148 (O80): a hole drilled into a named face measures its depth from that face's plane, not from the target's extreme
// along the axis. The repro: a block with a tower on it — the block's top at z 10, the body's top at z 40 — a blind hole
// into the block's top beside the tower. Before, its depth ran down from z 40 through air and the hole "missed the
// target". Oracles: the volume taken π r² d (the hole is wholly in the block), the parameter edit followed by name.

const D = (features, parameters = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters, features });
const stepped = (h = 10) => [
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 40] }, { id: 'b', kind: 'extrude', sketch: 's', height: h },
  { id: 't', kind: 'sketch', profile: 'rectangle', min: [25, 25], max: [35, 35] }, { id: 'w', kind: 'extrude', sketch: 't', height: 30, from: h },
  { id: 'u', kind: 'union', target: 'b', tool: 'w' },
];
const volume = doc => evaluateCadPart(doc).outputs.at(-1).massProperties(1).volumeMM3;
const code = doc => { try { evaluateCadPart(doc); return 'ok'; } catch (e) { return e.code; } };

test('D148: a blind hole into the block\'s top beside a tower — from that face, π r² d taken; without the face it misses (as before)', () => {
  const base = volume(D(stepped())), r = 3, d = 6;
  const v = volume(D([...stepped(), { id: 'h', kind: 'hole', target: 'u', center: [10, 10], radius: r, depth: d, face: 'b.top' }]));
  assert.ok(Math.abs(base - v - Math.PI * r * r * d) <= 1e-9 * base, `${base - v} vs ${Math.PI * r * r * d}`);
  assert.equal(code(D([...stepped(), { id: 'h', kind: 'hole', target: 'u', center: [10, 10], radius: r, depth: d }])), 'SELECTION', 'from the body\'s top it misses, as before');
  // The face's own normal sets the side: the block's bottom faces −z, so the hole goes up from z 0.
  const up = volume(D([...stepped(), { id: 'h', kind: 'hole', target: 'u', center: [10, 10], radius: r, depth: d, face: 'b.bottom' }]));
  assert.ok(Math.abs(base - up - Math.PI * r * r * d) <= 1e-9 * base);
  // With a countersink, its cone sits on the named face (more taken than the plain hole, the hole's own volume included).
  const csk = volume(D([...stepped(), { id: 'h', kind: 'hole', target: 'u', center: [10, 10], radius: r, depth: d, face: 'b.top', countersink: 10 }]));
  const cone = Math.PI / 3 * 2 * (5 * 5 + 5 * 3 + 3 * 3); // the frustum from Ø10 at the face to Ø6, 2 deep (90°), its bore part counted once
  assert.ok(Math.abs(base - csk - (Math.PI * r * r * (d - 2) + cone)) <= 1e-6 * base, `${base - csk} vs ${Math.PI * r * r * (d - 2) + cone}`);
});

test('D148: the face is a name, so a parameter edit moves the hole with it; refusals — no such face, a face not square to the axis, a side that contradicts it', () => {
  const doc = h => D([...stepped(h), { id: 'h', kind: 'hole', target: 'u', center: [10, 10], radius: 3, depth: 6, face: 'b.top' }]);
  for (const h of [8, 10, 15]) { const base = volume(D(stepped(h))), v = volume(doc(h)); assert.ok(Math.abs(base - v - Math.PI * 9 * 6) <= 1e-9 * base, `block ${h}`); }
  assert.equal(code(D([...stepped(), { id: 'h', kind: 'hole', target: 'u', center: [10, 10], radius: 3, depth: 6, face: 'b.nope' }])), 'REFERENCE');
  assert.equal(code(D([...stepped(), { id: 'h', kind: 'hole', target: 'u', center: [10, 10], radius: 3, depth: 6, face: 'b.side0' }])), 'SELECTION');
  assert.equal(code(D([...stepped(), { id: 'h', kind: 'hole', target: 'u', center: [10, 10], radius: 3, depth: 6, face: 'b.top', side: 'min' }])), 'INPUT');
});

// D148b: from a named face the tool reaches past it by at most half the free space above the face over the hole — an
// overhang 0.5 mm above a block's top stays whole; one closer than 1e-3 mm is refused, named (OBSTRUCTED_ABOVE).
const overhung = gap => [
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 40] }, { id: 'b', kind: 'extrude', sketch: 's', height: 60 },
  { id: 'ps', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [4, 4] }, { id: 'post', kind: 'extrude', sketch: 'ps', height: gap, from: 60 },
  { id: 'qs', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] }, { id: 'lip', kind: 'extrude', sketch: 'qs', height: 1.5, from: 60 + gap },
  { id: 'u1', kind: 'union', target: 'b', tool: 'post' }, { id: 'u', kind: 'union', target: 'u1', tool: 'lip' },
];
test('D148b: an overhang 0.5 mm above the face is not cut by a 55-deep hole (1 % of it, 0.55, would reach it); 0.0005 mm above, refused', () => {
  const base = volume(D(overhung(0.5))), v = volume(D([...overhung(0.5), { id: 'h', kind: 'hole', target: 'u', center: [12, 12], radius: 3, depth: 55, face: 'b.top' }]));
  assert.ok(Math.abs(base - v - Math.PI * 9 * 55) <= 1e-9 * base, `taken ${base - v} vs the bore alone ${Math.PI * 9 * 55} (the lip would add ${Math.PI * 9 * 0.05})`);
  const near = D([...overhung(0.0005), { id: 'h', kind: 'hole', target: 'u', center: [12, 12], radius: 3, depth: 55, face: 'b.top' }]);
  let message = ''; try { evaluateCadPart(near); } catch (e) { message = `${e.code} ${e.message}`; }
  assert.match(message, /^GEOMETRY .*\[OBSTRUCTED_ABOVE\] material 0\.0005 mm above b\.top/);
});
