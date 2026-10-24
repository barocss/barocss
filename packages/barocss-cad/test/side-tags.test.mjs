import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, CadPartError, outputOf, checkOutput, massPropertiesOf } from '../dist/index.js';

// R10a (D86): a sketch's `sideTags` name the walls of every body made of it `side[<tag>]` — extrude (upright and
// drafted), revolve, loft, sweep — and a sketch without them keeps its positional names (D16).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const names = o => [...new Set(o.brep.faces.map(f => (f.name ?? '').replace(/#\d+$/, '')))].sort();
const tagged = (points, tags = ['a', 'b', 'c', 'd'], extra = {}) => ({ id: 's', kind: 'sketch', profile: 'polygon', points, sideTags: { outer: tags }, ...extra });
const box = [[0, 0], [20, 0], [20, 10], [0, 10]], ring = [[5, 0], [15, 0], [15, 10], [5, 10]];
const out = (features, id) => { const o = outputOf(evaluateCadPart(D(features)), id); assert.equal(checkOutput(o).valid, true, checkOutput(o).issues[0]); return o; };

test('R10a every generator names the sketch\'s sides by their tags: extrude, drafted, revolve, loft, sweep (each piece), holes; a clockwise sketch by its authored order', () => {
  const sides = p => ['a', 'b', 'c', 'd'].map(t => `${p}.side[${t}]`);
  assert.deepEqual(names(out([tagged(box), { id: 'e', kind: 'extrude', sketch: 's', height: 5 }], 'e')), ['e.bottom', ...sides('e'), 'e.top'].sort());
  // (Clockwise: the kernel turns the loop round; each wall still takes its own segment's tag.)
  const cw = out([tagged([...box].reverse(), ['a', 'b', 'c', 'd']), { id: 'e', kind: 'extrude', sketch: 's', height: 5 }], 'e');
  const wallOf = (o, t) => o.brep.faces.find(f => f.name === `e.side[${t}]`).surface.controlPoints.flat().map(p => [p[0], p[1]]);
  // Segment a runs from (0, 10) to (20, 10) in the reversed list: its wall stands on y = 10.
  assert.ok(wallOf(cw, 'a').every(p => Math.abs(p[1] - 10) < 1e-9), JSON.stringify(wallOf(cw, 'a')));
  assert.deepEqual(names(out([tagged(box), { id: 'e', kind: 'extrude', sketch: 's', height: 5, draft: 5 }], 'e')), ['e.bottom', ...sides('e'), 'e.top'].sort());
  assert.deepEqual(names(out([tagged(ring), { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }], 'r')), sides('r'));
  assert.deepEqual(names(out([tagged(box), { ...tagged([[2, 2], [18, 2], [18, 8], [2, 8]], ['p', 'q', 'r', 't']), id: 's2' }, { id: 'l', kind: 'loft', sections: [{ sketch: 's', z: 0 }, { sketch: 's2', z: 10 }] }], 'l')), ['l.bottom', ...sides('l'), 'l.top'].sort());
  assert.deepEqual(names(out([tagged(box), { id: 'w', kind: 'sweep', sketch: 's', path: [{ kind: 'straight', length: 10 }, { kind: 'bend', radius: 30, angleDegrees: 90, toward: 'x' }] }], 'w')),
    ['w.s0.bottom', ...sides('w.s0'), 'w.s1.end', ...sides('w.s1')].sort());
  const hole = [{ kind: 'arc', start: [7, 5], center: [5, 5], direction: 'ccw' }];
  assert.ok(names(out([tagged(box, ['a', 'b', 'c', 'd'], { holes: [hole], sideTags: { outer: ['a', 'b', 'c', 'd'], holes: [['h']] } }), { id: 'e', kind: 'extrude', sketch: 's', height: 5 }], 'e')).includes('e.side[h]'));
  // A circle turned: its halves (and the full turn's parts) all its one tag, numbered #k.
  const c = out([{ id: 's', kind: 'sketch', profile: 'circle', center: [10, 0], radius: 3, sideTags: { outer: ['o'] } }, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }], 'r');
  assert.deepEqual(c.brep.faces.map(f => f.name).sort(), ['r.side[o]#1', 'r.side[o]#2', 'r.side[o]#3', 'r.side[o]#4']);
});

test('R10a a vertex inserted keeps the other sides\' names, and a fillet on a tagged edge goes on; untagged sketches keep side<k>; refusals: a tag twice, too few, a bad tag', () => {
  const before = names(out([tagged(box), { id: 'e', kind: 'extrude', sketch: 's', height: 5 }], 'e'));
  const after = names(out([tagged([[0, 0], [10, -2], [20, 0], [20, 10], [0, 10]], ['a', 'x', 'b', 'c', 'd']), { id: 'e', kind: 'extrude', sketch: 's', height: 5 }], 'e'));
  assert.deepEqual(after.filter(n => n !== 'e.side[x]'), before);
  const f = out([tagged(box), { id: 'e', kind: 'extrude', sketch: 's', height: 5 }, { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side[b]|e.side[c]'], radius: 2 }], 'f');
  assert.ok(Math.abs(massPropertiesOf(f).volume - (1000 - (1 - Math.PI / 4) * 4 * 5)) < 1e-6);
  assert.deepEqual(names(out([{ id: 's', kind: 'sketch', profile: 'polygon', points: box }, { id: 'e', kind: 'extrude', sketch: 's', height: 5 }], 'e')), ['e.bottom', 'e.side0', 'e.side1', 'e.side2', 'e.side3', 'e.top']);
  const refused = (sideTags, msg) => assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'sketch', profile: 'polygon', points: box, sideTags }])), e => e instanceof CadPartError && e.code === 'INPUT' && msg.test(e.message));
  refused({ outer: ['a', 'a', 'c', 'd'] }, /a is given twice/);
  refused({ outer: ['a', 'b', 'c'] }, /must give 4 tags/);
  refused({ outer: ['a', 'b', 'c', 'd.e'] }, /is not a tag/);
  refused(['a'], /must be \{ outer/);
});
