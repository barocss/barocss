import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, booleanAnalytic, brepMassProperties, loopArea, loopPerimeter } from '../dist/index.js';

// FRk1 (D165): gussets and end caps on a frame's members — plates placed by the members as built, each its own output,
// its report what the weld list and the BOM read. Oracles written here, none of them the kernel's: a clipped triangle's
// area (l₁l₂ − c²)·sin φ/2 and its corner where the two inner faces' lines meet (solved here in the plane), a section's
// outline and bore areas and perimeters in closed form, the plates welded to the members weighing their sum. Every size
// is a test value.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const run = features => evaluateCadPart(D(features));
const volume = o => o.massProperties(1).volumeMM3;
const near = (got, want, rel, what) => assert.ok(Math.abs(got - want) <= rel * Math.max(1, Math.abs(want)), `${what}: ${got} vs ${want} (${Math.abs(got - want) / Math.max(1, Math.abs(want))})`);
const refuse = (features, code, re) => assert.throws(() => run(features), e => e.code === code && re.test(e.message), String(re));
function welded(breps) { let b = breps[0]; for (const o of breps.slice(1)) b = booleanAnalytic(b, o, 'union'); return b; }
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, A_SHARP = 1600 - 34 * 34;
const ROUND = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 6 }, K = 4 - Math.PI;
const L_FRAME = { id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], corners: { default: 'mitre' } };

test('FRk1 a gusset in a mitred L: on both members\' inner faces (their lines\' meeting at (20, 20)), clipped, (l₁l₂ − c²)/2·t; its report (legs, plane, outline, seams on f.m0.top and f.m1.top); welded with the members, their sum — sharp and round-cornered', () => {
  for (const [name, section] of [['sharp', SHARP], ['round-cornered', ROUND]]) {
    const s = run([{ ...L_FRAME, section }, { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [120, 100], thickness: 5, clip: 15 }]);
    const g = s.output('g'), r = g.gusset;
    near(volume(g), (120 * 100 - 15 * 15) / 2 * 5, 1e-12, `${name}: the gusset`);
    assert.equal(g.bodyCount, 1); assert.ok(g.validate().valid);
    // On the inner faces: the horizontal member's top at z 20, the vertical one's +x face at x 20; centred on y 0.
    const P = g.brep.vertices.map(v => v.point), span = i => [Math.min(...P.map(p => p[i])), Math.max(...P.map(p => p[i]))];
    assert.deepEqual([span(0), span(1), span(2)], [[20, 140], [-2.5, 2.5], [20, 120]], name);
    assert.deepEqual([r.frame, r.point, r.members, r.legsMM, r.thicknessMM, r.clipMM, r.offsetMM], ['f', 1, [0, 1], [120, 100], 5, 15, 0]);
    near(r.angleDegrees, 90, 1e-12, 'angle'); near(r.areaMM2, (120 * 100 - 225) / 2, 1e-12, 'area'); near(r.volumeMM3, volume(g), 1e-12, 'its volume');
    assert.deepEqual(r.plane.normal.map(x => Math.abs(x)), [0, 1, 0]);
    assert.deepEqual(r.outline.map(p => p.map(x => +x.toFixed(9))), [[35, 0, 20], [140, 0, 20], [20, 0, 120], [20, 0, 35]]);
    assert.deepEqual(r.seams, [{ member: 0, lengthMM: 105, face: 'f.m0.top' }, { member: 1, lengthMM: 85, face: 'f.m1.top' }]);
    // Faces by role: on each member, the free edge, the clip, the two sides.
    assert.deepEqual([...new Set(g.brep.faces.map(f => f.name))].sort(), ['g.back', 'g.clip', 'g.free', 'g.front', 'g.on.m0', 'g.on.m1']);
    const [m0, m1] = s.outputs.filter(o => o.member), w = welded([m0.brep, m1.brep, g.brep]);
    assert.equal(w.bodies.length, 1);
    near(brepMassProperties(w, 1).volumeMM3, volume(m0) + volume(m1) + volume(g), 1e-9, `${name}: welded, their sum (no overlap)`);
  }
});

test('FRk1 a gusset at an open corner (120°) and in a T: its corner where the inner faces\' lines meet (on the bisector, 20·cot(φ/2) along); (l₁l₂ − c²)·sin φ/2·t; a T\'s two gussets either way along the post (along 1, −1), moved off the plane by offset', () => {
  // Member 0 from x 600 into the corner, member 1 out of it at 120° from member 0's way back (+x).
  const phi = 120 * Math.PI / 180, d1 = [Math.cos(phi), 0, Math.sin(phi)];
  const s = run([{ id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [500 * d1[0], 0, 500 * d1[2]]], segments: [[0, 1], [1, 2]], section: SHARP, corners: { default: 'mitre' } },
    { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [90, 80], thickness: 6 }]);
  const g = s.output('g');
  near(volume(g), 90 * 80 * Math.sin(phi) / 2 * 6, 1e-12, 'at 120°');
  // The corner is 20 from both members' lines (their half-widths), so on the bisector, 20/sin(φ/2) out: (20·cot(φ/2), 20).
  const x = 20 / Math.tan(phi / 2), z = 20;
  const corner = g.gusset.outline[0];
  near(corner[0], x, 1e-12, 'corner x'); near(corner[2], z, 1e-12, 'corner z');
  const [m0, m1] = s.outputs.filter(o => o.member), w = welded([m0.brep, m1.brep, g.brep]);
  near(brepMassProperties(w, 1).volumeMM3, volume(m0) + volume(m1) + volume(g), 1e-9, '120°, welded, their sum');
  // A rail butted on a post's middle: two gussets, under and over it, moved 8 off the plane.
  const t = run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400]], segments: [[0, 1], [2, 3]], section: SHARP, corners: { tee: 'butt' } },
    { id: 'up', kind: 'gusset', frame: 'f', point: 3, members: [1, 0], along: 1, legs: [100, 100], thickness: 4, offset: 8 },
    { id: 'down', kind: 'gusset', frame: 'f', point: 3, members: [1, 0], along: -1, legs: [100, 100], thickness: 4, offset: 8 }]);
  for (const [k, zs] of [['up', [420, 520]], ['down', [280, 380]]]) {
    const o = t.output(k), P = o.brep.vertices.map(v => v.point);
    near(volume(o), 100 * 100 / 2 * 4, 1e-12, k);
    assert.deepEqual([Math.min(...P.map(p => p[0])), Math.max(...P.map(p => p[0]))], [20, 120], `${k}: from the post's face`);
    assert.deepEqual([Math.min(...P.map(p => p[2])), Math.max(...P.map(p => p[2]))], zs, `${k}: on the rail's face`);
    assert.deepEqual([Math.min(...P.map(p => Math.abs(p[1]))), Math.max(...P.map(p => Math.abs(p[1])))], [6, 10], `${k}: moved 8 off`);
  }
  const all = welded(t.outputs.map(o => o.brep)), sum = t.outputs.reduce((v, o) => v + volume(o), 0);
  assert.equal(all.bodies.length, 1); near(brepMassProperties(all, 1).volumeMM3, sum, 1e-12, 'the T and its gussets, their sum');
});

test('FRk1 end caps: over a square end (the section\'s outline, A_env·t) and inset in its bore (A_bore·t), on either end, a through end where it runs on; areas and seams by the sections\' closed forms; welded, their sum', () => {
  const env = 1600 - K * 36, bore = 34 * 34 - K * 9, Penv = 160 - 48 + 12 * Math.PI, Pbore = 136 - 24 + 6 * Math.PI;
  const s = run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 300]], segments: [[0, 1]], section: ROUND },
    { id: 'top', kind: 'end-cap', frame: 'f', member: 0, end: 'end', fit: 'over', thickness: 4 },
    { id: 'foot', kind: 'end-cap', frame: 'f', member: 0, end: 'start', fit: 'inset', thickness: 6 }]);
  const top = s.output('top'), foot = s.output('foot'), m = s.output('f');
  near(volume(top), env * 4, 1e-12, 'the cap over'); near(volume(foot), bore * 6, 1e-12, 'the plug');
  near(top.massProperties(1).centroidMM[2], 302, 1e-12, 'the cap on the end'); near(foot.massProperties(1).centroidMM[2], 3, 1e-12, 'the plug in the bore, flush');
  const r = top.endCap;
  assert.deepEqual([r.frame, r.member, r.end, r.fit, r.thicknessMM], ['f', 0, 'end', 'over', 4]);
  near(r.areaMM2, env, 1e-12, 'area'); near(r.seam.lengthMM, Penv, 1e-12, 'its seam'); assert.equal(r.seam.exact, true);
  assert.deepEqual([r.plane.origin, r.plane.normal], [[0, 0, 300], [0, 0, 1]]);
  near(foot.endCap.seam.lengthMM, Pbore, 1e-12, 'the plug\'s seam'); assert.deepEqual(foot.endCap.plane.normal, [0, 0, -1]);
  for (const o of [top, foot]) { const w = welded([m.brep, o.brep]); assert.equal(w.bodies.length, 1); near(brepMassProperties(w, 1).volumeMM3, volume(m) + volume(o), 1e-10, `${o.id} welded`); }
  // A round tube's cap (a circle); the helpers against the closed forms.
  const c = run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [100, 0, 0]], segments: [[0, 1]], section: { kind: 'round-tube', diameter: 30, wall: 2 } }, { id: 'c', kind: 'end-cap', frame: 'f', member: 0, end: 'end', fit: 'over', thickness: 3 }]).output('c');
  near(volume(c), Math.PI * 225 * 3, 1e-12, 'a round cap'); near(c.endCap.seam.lengthMM, 30 * Math.PI, 1e-12, 'its seam');
  near(loopArea([{ kind: 'arc', start: [5, 0], center: [0, 0], direction: 'cw' }]), 25 * Math.PI, 1e-15, 'a clockwise circle');
  near(loopPerimeter([{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [3, 0] }, { kind: 'line', start: [3, 4] }]), 12, 1e-15, 'a triangle');
  // An ordered table's leg runs through at its top (to z 720 under 40 × 40 rails): its cap sits there.
  const points = [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0], [0, 0, 700], [600, 0, 700], [600, 400, 700], [0, 400, 700]];
  const t = run([{ id: 't', kind: 'frame', points, segments: [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]], section: SHARP, corners: { multi: 'order' } },
    { id: 'c', kind: 'end-cap', frame: 't', member: 0, end: 'end', fit: 'over', thickness: 3 }]);
  near(t.output('c').massProperties(1).centroidMM[2], 721.5, 1e-12, 'on the through end at 720');
  const leg = t.outputs[0], w = welded([leg.brep, t.output('c').brep]);
  near(brepMassProperties(w, 1).volumeMM3, A_SHARP * 720 + 1600 * 3, 1e-12, 'the leg and its cap');
});

test('FRk1 refusals: GUSSET_FIT (three members without members, a round tube, a member turned 30°, a leg past its member, a clip past the legs, members in line, no member at the point), CAP_END (a mitred end, a plug in an angle), INPUT (along at a T, bad fields), REFERENCE (not a frame)', () => {
  const g = (extra, frame = { ...L_FRAME, section: SHARP }) => [frame, { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [100, 100], thickness: 5, ...extra }];
  const table = { id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 700], [600, 0, 700], [0, 400, 700]], segments: [[0, 1], [1, 2], [3, 1]], section: SHARP, corners: { multi: 'order' } };
  refuse([table, { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [100, 100], thickness: 5 }], 'PARAMETER', /\[GUSSET_FIT\] 3 members meet at point 1: say which two/);
  assert.ok(run([table, { id: 'g', kind: 'gusset', frame: 'f', point: 1, members: [0, 1], legs: [100, 100], thickness: 5 }]).output('g'), 'two of three named');
  refuse(g({}, { ...L_FRAME, section: { kind: 'round-tube', diameter: 40, wall: 3 } }), 'PARAMETER', /\[GUSSET_FIT\] member 0 has no flat face under the gusset/);
  refuse(g({ thickness: 30 }, { ...L_FRAME, section: ROUND }), 'PARAMETER', /\[GUSSET_FIT\] member 0 has no flat face under the gusset: it spans -15 to 15 mm across that side, whose flat material is at -14 to 14/);
  refuse(g({}, { ...L_FRAME, section: SHARP, roll: 30, corners: undefined }), 'PARAMETER', /\[GUSSET_FIT\] member 0 meets the gusset at an edge of its section/);
  refuse(g({ legs: [700, 100] }), 'PARAMETER', /\[GUSSET_FIT\] leg 700 runs past member 0: 580 mm of its face from the corner/);
  refuse(g({ clip: 100 }), 'PARAMETER', /\[GUSSET_FIT\] a clip of 100 mm leaves nothing/);
  refuse(g({ point: 0 }), 'PARAMETER', /\[GUSSET_FIT\] 1 members meet at point 0/);
  refuse([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [600, 0, 0]], segments: [[0, 1], [1, 2]], section: SHARP }, { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [100, 100], thickness: 5 }], 'PARAMETER', /\[GUSSET_FIT\] members 0 and 1 are in line/);
  refuse(g({ members: [0, 2] }, { ...L_FRAME, points: [...L_FRAME.points, [600, 0, 600]], segments: [...L_FRAME.segments, [2, 3]], section: SHARP }), 'PARAMETER', /\[GUSSET_FIT\] member 2 does not meet point 1/);
  const tee = { id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400]], segments: [[0, 1], [2, 3]], section: SHARP, corners: { tee: 'butt' } };
  refuse([tee, { id: 'g', kind: 'gusset', frame: 'f', point: 3, legs: [100, 100], thickness: 5 }], 'INPUT', /member 0 runs through point 3: along \(1 or −1\)/);
  refuse(g({ legs: [100] }), 'INPUT', /legs must be \[l1, l2\]/); refuse(g({ thickness: 0 }), 'PARAMETER', /thickness/); refuse(g({ along: 2 }), 'INPUT', /along must be 1/);
  refuse([{ id: 'b', kind: 'frame-member', section: SHARP, start: [0, 0, 0], end: [0, 0, 100] }, { id: 'g', kind: 'gusset', frame: 'b', point: 0, legs: [10, 10], thickness: 2 }], 'REFERENCE', /b is not a frame/);
  const cap = (extra, frame = { ...L_FRAME, section: SHARP }) => [frame, { id: 'c', kind: 'end-cap', frame: 'f', member: 0, end: 'end', fit: 'over', thickness: 4, ...extra }];
  refuse(cap({}), 'PARAMETER', /\[CAP_END\] member 0's end is cut by a mitre: a cap sits on a square end/);
  refuse(cap({ end: 'start', fit: 'inset' }, { ...L_FRAME, section: { kind: 'angle', legX: 50, legY: 50, thickness: 5, rootRadius: 0, toeRadius: 0 }, corners: undefined }), 'PARAMETER', /\[CAP_END\] member 0's section has no bore/);
  assert.equal(volume(run(cap({ end: 'start' })).output('c')), 1600 * 4, 'its square end takes one');
  refuse(cap({ fit: 'flush' }), 'INPUT', /fit must be over/); refuse(cap({ end: 'middle' }), 'INPUT', /end must be start or end/); refuse(cap({ member: 5 }), 'INPUT', /member/);
});
