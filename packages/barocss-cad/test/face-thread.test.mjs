import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, outputOf, massPropertiesOf, checkOutput, reevaluate, saveCadPart, loadCadPart, CadPartError } from '../dist/index.js';

// A modelled thread cut on an existing cylindrical face. Expectations from the inputs: the thread's section per
// length is the kernel's own threaded rod's (the `thread` feature, built apart), itself within 5e-4 of the ISO 68-1
// basic profile's area; a shaft is cut to a core of d/2 − 0.8·P, a hole filled and tapped.
const doc = (features, parameters = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters, features });
const out = (features, id, parameters) => outputOf(evaluateCadPart(doc(features, parameters)), id);
const volume = (features, id, parameters) => massPropertiesOf(out(features, id, parameters)).volume;
const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const refused = (features, code, pattern) => assert.throws(() => evaluateCadPart(doc(features)), e => e instanceof CadPartError && e.code === code && pattern.test(e.message), String(pattern));
/** The kernel's own rod: its section area (volume per length). */
const rodArea = (d, P) => volume([{ id: 'r', kind: 'thread', diameter: d, pitch: P, seat: 10, length: 10, form: 'helical' }], 'r') / 10;
/** A modelled nut's thread section (its profile 0.04 mm clear of a bolt's): the hex prism less the nut, per height. */
const nutArea = (d, P, s = 2 * d, h = 5) => (Math.sqrt(3) / 2 * s * s * h - volume([{ id: 'n', kind: 'thread', diameter: d, pitch: P, seat: 0, hex: { across: s, height: h, internal: true }, form: 'helical' }], 'n')) / h;
/** The ISO 68-1 basic profile's section area, by quadrature over a turn. */
function isoArea(d, P) {
  const H = Math.sqrt(3) / 2 * P, rMaj = d / 2, rMin = rMaj - 5 * H / 8, N = 100000;
  let sum = 0;
  for (let i = 0; i < N; i++) { let u = (i + 0.5) / N; if (u > 0.5) u -= 1; const a = Math.abs(u); const r = a <= 1 / 16 ? rMaj : a <= 1 / 16 + 0.3125 ? rMaj - (rMaj - rMin) * (a - 1 / 16) / 0.3125 : rMin; sum += r * r; }
  return Math.PI * sum / N;
}
const valid = (o) => { const c = checkOutput(o); assert.equal(c.valid, true, JSON.stringify(c.issues)); assert.equal(c.counts.bodies, 1); };
const shaft = (r = 3, h = 30) => [{ id: 'c', kind: 'sketch', profile: 'circle', center: [0, 0], radius: r }, { id: 'sh', kind: 'extrude', sketch: 'c', height: h }];
const plate = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 30] }, { id: 'p', kind: 'extrude', sketch: 's', height: 10 }];
const hole = (extra = {}) => ({ id: 'h', kind: 'hole', target: 'p', center: [15, 15], radius: 2.5, ...extra });

test('face thread: the rod\'s section is the ISO basic profile\'s', () => {
  for (const [d, P] of [[6, 1], [8, 1.25]]) assert.ok(Math.abs(rodArea(d, P) / isoArea(d, P) - 1) < 5e-4, `M${d}×${P}`);
});

test('face thread: a shaft threaded from its flat free end, with a relief groove where the thread stops inside the face', () => {
  const A = rodArea(6, 1), core = 3 - 0.8;
  const top12 = out([...shaft(), { id: 'th', kind: 'face-thread', target: 'sh', face: 'sh.side0', pitch: 1, length: 12 }], 'th'); valid(top12);
  // The neck over 12 mm, the thread over 11 (one pitch short of z 18: the relief), joined to the core.
  near(massPropertiesOf(top12).volume, Math.PI * 9 * 30 - Math.PI * (9 - core * core) * 12 + (A - Math.PI * core * core) * 11, 'top 12');
  assert.ok(top12.brep.faces.some(f => /^th\.thread#/.test(f.name)), 'the thread\'s faces are named');
  // The whole face: both ends flat and free, so the shaft is the thread, end to end.
  const whole = out([...shaft(), { id: 'th', kind: 'face-thread', target: 'sh', face: 'sh.side0', pitch: 1 }], 'th'); valid(whole);
  near(massPropertiesOf(whole).volume, A * 30, 'whole');
  // From the other end, with a 2 mm relief.
  near(volume([...shaft(), { id: 'th', kind: 'face-thread', target: 'sh', face: 'sh.side0', pitch: 1, length: 10, end: '-', relief: 2 }], 'th'),
    Math.PI * 9 * 30 - Math.PI * (9 - core * core) * 10 + (A - Math.PI * core * core) * 8, 'bottom 10, relief 2');
});

test('face thread: a stepped shaft keeps a relief at its shoulder; no relief there is refused', () => {
  const stepped = [...shaft(3, 20), { id: 'c2', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'hd', kind: 'extrude', sketch: 'c2', height: 10, from: 19 }, { id: 'u', kind: 'union', target: 'sh', tool: 'hd' }];
  const before = volume(stepped, 'u'), A = rodArea(6, 1), core = 2.2;
  const o = out([...stepped, { id: 'th', kind: 'face-thread', target: 'u', face: 'sh.side0', pitch: 1, end: '-' }], 'th'); valid(o);
  // The face runs z 0..19 (the head covers the rest); free at z 0, a shoulder at z 19.
  near(massPropertiesOf(o).volume, before - Math.PI * (9 - core * core) * 19 + (A - Math.PI * core * core) * 18, 'stepped');
  refused([...stepped, { id: 'th', kind: 'face-thread', target: 'u', face: 'sh.side0', pitch: 1, end: '-', relief: 0 }], 'CAPABILITY', /\[FACE_THREAD_RELIEF\]/);
});

test('face thread: a tapped hole, through and blind, 0.04 mm clear of a bolt like a modelled nut', () => {
  const A = nutArea(6, 1), plateHole = volume([...plate, hole()], 'h');
  const through = out([...plate, hole(), { id: 'th', kind: 'face-thread', target: 'h', face: 'h.side0', pitch: 1, diameter: 6 }], 'th'); valid(through);
  near(massPropertiesOf(through).volume, 9000 - A * 10, 'through');
  near(9000 - Math.PI * 6.25 * 10, plateHole, 'the tap drill hole');
  // Blind 8 deep, threaded 6 from the top: the 2 mm below keep the drill's 5 mm.
  near(volume([...plate, hole({ depth: 8 }), { id: 'th', kind: 'face-thread', target: 'h', face: 'h.side0', pitch: 1, diameter: 6, length: 6 }], 'th'), 9000 - Math.PI * 6.25 * 2 - A * 6, 'blind 6');
  near(volume([...plate, hole({ depth: 8 }), { id: 'th', kind: 'face-thread', target: 'h', face: 'h.side0', pitch: 1, diameter: 6 }], 'th'), 9000 - A * 8, 'blind, to the bottom');
  // No clearance: the bolt's own basic profile; more: the profile pushed out by it (the nut's builder, at 0.04).
  near(volume([...plate, hole(), { id: 'th', kind: 'face-thread', target: 'h', face: 'h.side0', pitch: 1, diameter: 6, clearance: 0 }], 'th'), 9000 - rodArea(6, 1) * 10, 'no clearance');
  assert.ok(A > rodArea(6, 1), 'the clearance takes more of the wall');
});

test('face thread: any axis — a shaft along X', () => {
  const xs = [{ id: 'c', kind: 'sketch', profile: 'circle', plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }, center: [0, 0], radius: 4 }, { id: 'sh', kind: 'extrude', sketch: 'c', height: 25 }];
  const A = rodArea(8, 1.25), core = 4 - 0.8 * 1.25;
  const o = out([...xs, { id: 'th', kind: 'face-thread', target: 'sh', face: 'sh.side0', pitch: 1.25, length: 10 }], 'th'); valid(o);
  near(massPropertiesOf(o).volume, Math.PI * 16 * 25 - Math.PI * (16 - core * core) * 10 + (A - Math.PI * core * core) * 8.75, 'along X');
  const xsAll = o.brep.vertices.map(v => v.point[0]); assert.ok(Math.min(...xsAll) >= -1e-9 && Math.max(...xsAll) <= 25 + 1e-9, 'stays on the shaft');
});

test('face thread: follows an upstream edit, and survives save and open', () => {
  const features = [...shaft(3, { parameter: 'L' }), { id: 'th', kind: 'face-thread', target: 'sh', face: 'sh.side0', pitch: 1, length: 12 }];
  const snap = evaluateCadPart(doc(features, { L: 30 })), longer = reevaluate(snap, { parameters: { L: 40 } }), A = rodArea(6, 1), core = 2.2;
  near(massPropertiesOf(outputOf(longer, 'th')).volume, Math.PI * 9 * 40 - Math.PI * (9 - core * core) * 12 + (A - Math.PI * core * core) * 11, 'a 40 mm shaft');
  const reopened = loadCadPart(saveCadPart(snap));
  assert.deepEqual(reopened.document, snap.document); assert.equal(massPropertiesOf(outputOf(reopened, 'th')).volume, massPropertiesOf(outputOf(snap, 'th')).volume);
});

test('face thread: refused with the reason', () => {
  const on = (extra, base = [...plate, hole()], target = 'h') => [...base, { id: 'th', kind: 'face-thread', target, face: 'h.side0', pitch: 1, ...extra }];
  refused(on({}), 'INPUT', /needs its nominal diameter/);
  refused(on({ diameter: 5 }), 'PARAMETER', /\[FACE_THREAD_SIZE\] an M5 thread is no wider/);
  refused(on({ diameter: 6, length: 11 }), 'PARAMETER', /\[FACE_THREAD_SIZE\] .* longer than the face/);
  refused(on({ diameter: 6, face: 'p.top' }), 'CAPABILITY', /\[FACE_THREAD_FACE\] p\.top is not a cylindrical face/);
  refused(on({ diameter: 6, face: 'h.side0#1' }), 'CAPABILITY', /\[FACE_THREAD_FACE\] .*not a whole round face/);
  refused(on({ diameter: 6, face: 'nope' }), 'REFERENCE', /no face nope/);
  // A hole 1 mm from the plate's edge: the wall cannot hold an M6.
  refused([...plate, { id: 'h', kind: 'hole', target: 'p', center: [3.5, 15], radius: 2.5 }, { id: 'th', kind: 'face-thread', target: 'h', face: 'h.side0', pitch: 1, diameter: 6 }], 'GEOMETRY', /\[FACE_THREAD_NOT_CLEAR\] the wall round h\.side0/);
  const sh = (extra) => [...shaft(), { id: 'th', kind: 'face-thread', target: 'sh', face: 'sh.side0', pitch: 1, ...extra }];
  refused(sh({ diameter: 8 }), 'PARAMETER', /\[FACE_THREAD_SIZE\] a thread on a 6 mm shaft is M6, not M8/);
  refused(sh({ pitch: 4 }), 'PARAMETER', /\[FACE_THREAD_SIZE\] a 4 mm pitch is too coarse/);
  refused(sh({ end: 'x' }), 'INPUT', /end must be/);
  refused(sh({ clearance: 0.04 }), 'INPUT', /the clearance goes in the hole/);
  refused(on({ diameter: 6, clearance: 0.25 }), 'INPUT', /clearance must be at least 0 and below a quarter of the pitch/);
  // A key joined to the shaft where the thread goes: the face is no longer whole round.
  const keyed = [...shaft(), { id: 'ks', kind: 'sketch', profile: 'rectangle', min: [-1, 2.5], max: [1, 4] }, { id: 'ke', kind: 'extrude', sketch: 'ks', height: 8, from: 20 }, { id: 'u', kind: 'union', target: 'sh', tool: 'ke' }, { id: 'th', kind: 'face-thread', target: 'u', face: 'sh.side0', pitch: 1, length: 12 }];
  refused(keyed, 'CAPABILITY', /\[FACE_THREAD_FACE\] sh\.side0 is not a whole round face/);
});
