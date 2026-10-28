import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCadPart, reevaluate, outputOf, massPropertiesOf, checkBrep, saveCadPart, loadCadPart,
  CadPartError, prismaticFromProfile, brepFromPrismatic, splitFaceAlongCurve,
} from '../dist/index.js';
import { profileRelief } from '../dist/features/profile-relief.js';

const rect = (id, min, max) => ({ id, kind: 'sketch', profile: 'rectangle', min, max });
const lineLoop = points => points.map(start => ({ kind: 'line', start }));
const rectangle = (x0, y0, x1, y1) => lineLoop([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
const base = () => [
  { ...rect('s', [0, 0], [40, 30]), holes: [rectangle(16, 13, 24, 17)] },
  { id: 'base', kind: 'extrude', sketch: 's', height: 10 },
];
const components = () => [
  { ...rect('ring', [10, 10], [30, 20]), holes: [rectangle(14, 12, 26, 18)] },
  rect('stroke', [32, 10], [34, 20]),
];
const relief = mode => ({ id: 'relief', kind: 'profile-relief', target: 'base', faces: ['base.top'], sketches: ['ring', 'stroke'], depth: { parameter: 'Depth' }, mode, clearance: 0.25 });
const document = (mode = 'emboss', features = [...base(), ...components(), relief(mode)]) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { Depth: 3 }, features });
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-8, `${a} != ${b}`);
function refused(doc, code, pattern) {
  const before = structuredClone(doc);
  assert.throws(() => evaluateCadPart(doc), e => e instanceof CadPartError && e.feature === 'relief' && (code === undefined || e.code === code) && (!pattern || pattern.test(e.message)));
  assert.deepEqual(doc, before);
}
function withRelief(mode, overrides) { return document(mode, [...base(), ...components(), { ...relief(mode), ...overrides }]); }
function shape(snapshot, mode, depth = 3) {
  assert.equal(snapshot.outputs.length, 1);
  const out = outputOf(snapshot, 'relief'), report = checkBrep(out.brep, { strict: true });
  assert.equal(out.bodyCount, 1); assert.equal(out.brep.bodies[0].kind, 'solid');
  for (const shell of out.brep.shells) assert.equal(shell.closed, true);
  assert.equal(report.valid, true, report.issues.join('\n')); assert.equal(report.issues.length, 0);
  // Independent rectangular areas: base (1200-32)*10; ring 200-72; stroke 20.
  const expected = mode === 'emboss' ? 11680 + 148 * depth : 11680 - 148 * depth;
  close(massPropertiesOf(out, 1).volume, expected); close(massPropertiesOf(out, 1).mass, expected / 1000);
  const max = [40, 30, mode === 'emboss' ? 10 + depth : 10];
  for (let k = 0; k < 3; k++) {
    close(Math.min(...out.brep.vertices.map(v => v.point[k])), 0);
    close(Math.max(...out.brep.vertices.map(v => v.point[k])), max[k]);
  }
  const z = mode === 'emboss' ? 10 + depth : 10 - depth;
  for (const point of [[10, 10, z], [30, 20, z], [14, 12, z], [26, 18, z], [32, 10, z], [34, 20, z]])
    assert.ok(out.brep.vertices.some(v => v.point.every((x, k) => x === point[k])), `missing profile corner ${point}`);
  const names = new Set(out.brep.faces.map(f => f.name));
  for (const name of ['base.bottom', 'base.side0', 'base.side1', 'base.side2', 'base.side3']) assert.ok(names.has(name), name);
  assert.ok([...names].some(name => name?.startsWith('relief.component0.')));
  assert.ok([...names].some(name => name?.startsWith('relief.component1.')));
  return out;
}

test('profile relief: independent 12124/11236 volume, counters, separate seated strokes, codec, dimensions and immutable history', () => {
  for (const mode of ['emboss', 'engrave']) {
    const input = document(mode), before = structuredClone(input), snapshot = evaluateCadPart(input), savedDoc = structuredClone(snapshot.document);
    const out = shape(snapshot, mode), text = saveCadPart(snapshot);
    close(massPropertiesOf(out, 1).volume, mode === 'emboss' ? 12124 : 11236);
    const opened = loadCadPart(text);
    assert.deepEqual(opened.document, savedDoc); assert.deepEqual(outputOf(opened, 'relief').brep, out.brep);
    assert.deepEqual(massPropertiesOf(outputOf(opened, 'relief'), 1), massPropertiesOf(out, 1));
    shape(reevaluate(snapshot, { parameters: { Depth: 4 } }), mode, 4);
    assert.throws(() => reevaluate(snapshot, { parameters: { Depth: 0 } }), e => e instanceof CadPartError && e.code === 'PARAMETER');
    if (mode === 'engrave') assert.throws(() => reevaluate(snapshot, { parameters: { Depth: 10 } }), e => e instanceof CadPartError && e.code === 'PARAMETER');
    assert.deepEqual(input, before); assert.deepEqual(snapshot.document, savedDoc); assert.equal(saveCadPart(snapshot), text); shape(snapshot, mode);
  }
});

test('profile relief: a raised height may exceed slab thickness; a pocket must keep a bottom web', () => {
  shape(evaluateCadPart(withRelief('emboss', { depth: 12 })), 'emboss', 12);
  for (const depth of [10, 11, 10 - 5e-8]) refused(withRelief('engrave', { depth }), depth < 10 ? 'GEOMETRY' : 'PARAMETER');
  refused(withRelief('emboss', { depth: 5e-8 }), 'GEOMETRY');
});

test('profile relief: every component lies in actual material, including target holes and concave notches', () => {
  for (const mode of ['emboss', 'engrave']) {
    // Removing the counter fills a source hole even though all outer corners lie on material.
    const solidInk = [rect('ring', [10, 10], [30, 20]), rect('stroke', [32, 10], [34, 20])];
    refused(document(mode, [...base(), ...solidInk, relief(mode)]), 'GEOMETRY', /leaves the selected cap or target material/);
    for (const stroke of [rect('stroke', [17, 14], [18, 15]), rect('stroke', [42, 10], [44, 20]), rect('stroke', [39, 10], [41, 20])])
      refused(document(mode, [...base(), components()[0], stroke, relief(mode)]), 'GEOMETRY');
    const notched = { id: 's', kind: 'sketch', profile: 'loop', segments: lineLoop([[0, 0], [40, 0], [40, 30], [25, 30], [25, 12], [15, 12], [15, 30], [0, 30]]) };
    refused(document(mode, [notched, { id: 'base', kind: 'extrude', sketch: 's', height: 10 }, rect('ink', [10, 10], [30, 20]), { ...relief(mode), sketches: ['ink'] }]), 'GEOMETRY');
  }
});

test('profile relief: cap/material clearance is strict and a smaller request cannot relax the native policy', () => {
  for (const [min, clearance] of [[[0, 5], 0], [[5e-8, 5], 0], [[0.25, 5], 0.25], [[0.2, 5], 0.25]]) {
    const doc = document('emboss', [...base(), rect('ink', min, [4, 8]), { ...relief('emboss'), sketches: ['ink'], clearance }]);
    refused(doc, 'GEOMETRY', /clearance/);
  }
  const accepted = document('emboss', [...base(), rect('ink', [0.25001, 5], [4, 8]), { ...relief('emboss'), sketches: ['ink'], clearance: 0.25 }]);
  assert.equal(checkBrep(outputOf(evaluateCadPart(accepted), 'relief').brep, { strict: true }).valid, true);
});

test('profile relief: overlapping, touching and near-contact raw ink components are explicitly outside initial scope', () => {
  for (const [min, max] of [[[11, 10.5], [12, 11.5]], [[30, 10], [32, 20]], [[30.25, 10], [32, 20]]]) {
    refused(document('emboss', [...base(), components()[0], rect('stroke', min, max), relief('emboss')]), 'GEOMETRY', /overlap or contact/);
  }
  // An island inside a counter remains a separate component, not a hole of the whole run.
  const island = document('emboss', [...base(), components()[0], rect('stroke', [14.5, 12.5], [15, 13]), { ...relief('emboss'), clearance: 0.1 }]);
  close(massPropertiesOf(outputOf(evaluateCadPart(island), 'relief'), 1).volume, 11680 + (128 + 0.25) * 3);
});

test('profile relief: exact selected trim is checked separately from full material on split coplanar caps', () => {
  // Direct internal geometry fixture: the public upright builder merges a connected coplanar cap.
  const source = prismaticFromProfile({ outer: rectangle(0, 0, 40, 30), height: 10, tag: 'base' });
  const brep = brepFromPrismatic(source, { id: 'base' });
  const cut = { kind: 'curve', id: 'cut', degree: 1, knots: [0, 0, 1, 1], controlPoints: [[20, 0, 10], [20, 30, 10]], weights: [1, 1] };
  const split = splitFaceAlongCurve(brep, 'base.top', cut, { names: ['cap0', 'cap1'] }).brep;
  const checked = checkBrep(split, { strict: true }); assert.equal(checked.valid, true, checked.issues.join('\n'));
  const coedges = new Map(split.coedges.map(c => [c.id, c])), edges = new Map(split.edges.map(e => [e.id, e])), points = new Map(split.vertices.map(v => [v.id, v.point]));
  let selected;
  for (const face of split.faces) if (face.name === 'cap0' || face.name === 'cap1') {
    const loop = split.loops.find(l => l.face === face.id && l.kind === 'outer');
    const xs = loop.coedges.flatMap(cid => edges.get(coedges.get(cid).edge).vertices.map(id => points.get(id)[0]));
    if (Math.max(...xs) === 20 && Math.min(...xs) === 0) selected = face.name;
  }
  assert.equal(typeof selected, 'string');
  const before = structuredClone(split), fail = (code, detail) => { throw new CadPartError(code, 'relief', detail); };
  assert.throws(() => profileRelief(source, split, selected, [{ outer: rectangle(25, 10, 30, 15) }], 3, 'emboss', 0.25, 'relief', fail), e => e instanceof CadPartError && e.code === 'GEOMETRY' && /leaves the selected cap or target material/.test(e.message));
  assert.deepEqual(split, before);
});

test('profile relief: selected cap names and stored signatures remain authored references', () => {
  const signature = { kind: 'plane', at: [20, 15, 10], dir: [0, 0, 1], size: 1168 };
  shape(evaluateCadPart(withRelief('emboss', { expect: { 'base.top': signature } })), 'emboss');
  refused(withRelief('emboss', { expect: { 'base.top': { ...signature, dir: [0, 0, -1] } } }), undefined, /REFERENCE_MOVED/);
  for (const face of ['missing', 'base.top#1']) refused(withRelief('emboss', { faces: [face] }), 'REFERENCE');
  for (const face of ['base.bottom', 'base.side0']) refused(withRelief('emboss', { faces: [face] }), 'CAPABILITY');
  for (const faces of [[], [''], [1], [['base.top']], ['base.top+base.bottom'], ['base.top', 'base.bottom'], 'base.top', new Uint8Array([1])]) refused(withRelief('emboss', { faces }), 'INPUT');
  refused(withRelief('emboss', { expect: { wrong: signature } }), 'INPUT');
});

test('profile relief: only one physical line-only upright slab is admitted', () => {
  const curved = [{ id: 's', kind: 'sketch', profile: 'circle', center: [20, 15], radius: 20 }, { id: 'base', kind: 'extrude', sketch: 's', height: 10 }];
  refused(document('emboss', [...curved, ...components(), relief('emboss')]), 'CAPABILITY');
  const stepped = [...base(), rect('extraSketch', [5, 5], [35, 25]), { id: 'extra', kind: 'extrude', sketch: 'extraSketch', height: 15 }, { id: 'steps', kind: 'union', target: 'base', tool: 'extra' }];
  refused(document('emboss', [...stepped, ...components(), { ...relief('emboss'), target: 'steps' }]), 'CAPABILITY');
  const multiple = [...base(), rect('otherSketch', [50, 0], [60, 10]), { id: 'other', kind: 'extrude', sketch: 'otherSketch', height: 10 }, { id: 'both', kind: 'union', target: 'base', tool: 'other' }];
  refused(document('emboss', [...multiple, ...components(), { ...relief('emboss'), target: 'both' }]), 'REFERENCE');
  const source = prismaticFromProfile({ outer: rectangle(0, 0, 40, 30), height: 10, tag: 'base' }), original = brepFromPrismatic(source, { id: 'base' });
  const sheet = { ...original, bodies: original.bodies.map(body => ({ ...body, kind: 'sheet' })) }, fail = (code, detail) => { throw new CadPartError(code, 'relief', detail); };
  assert.throws(() => profileRelief(source, sheet, 'base.top', [{ outer: rectangle(10, 10, 20, 20) }], 3, 'emboss', 0.25, 'relief', fail), e => e instanceof CadPartError && e.code === 'REFERENCE');
  assert.equal(original.bodies[0].kind, 'solid');
});

test('profile relief: non-XY sketch frames, arcs and multiple outer regions refuse; an XY translation preserves area', () => {
  const original = components()[0];
  const planes = [
    { origin: [0, 0, 1], normal: [0, 0, 1], xAxis: [1, 0, 0] },
    { origin: [0, 0, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] },
    { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [-1, 0, 0] },
  ];
  for (const plane of planes) refused(document('emboss', [...base(), { ...original, plane }, components()[1], relief('emboss')]), 'CAPABILITY');
  refused(document('emboss', [...base(), { id: 'ring', kind: 'sketch', profile: 'circle', center: [8, 8], radius: 1 }, components()[1], relief('emboss')]), 'CAPABILITY');
  refused(document('emboss', [...base(), { ...original, regions: [rectangle(5, 5, 6, 6)] }, components()[1], relief('emboss')]), 'CAPABILITY');
  const translated = { ...rect('ink', [0, 0], [2, 3]), plane: { origin: [5, 5, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } };
  close(massPropertiesOf(outputOf(evaluateCadPart(document('emboss', [...base(), translated, { ...relief('emboss'), sketches: ['ink'] }])), 'relief'), 1).volume, 11680 + 6 * 3);
});

test('profile relief: dimensions, references, descriptors and typed arrays have explicit admission boundaries', () => {
  for (const depth of [0, -1, NaN, Infinity, '3', true]) refused(withRelief('emboss', { depth }), 'PARAMETER');
  for (const clearance of [-1, NaN, Infinity, 10001, '0.25', true, { parameter: 'Depth' }]) refused(withRelief('emboss', { clearance }), 'INPUT');
  refused(withRelief('unsupported', {}), 'INPUT');
  for (const sketches of [[], ['ring', 'ring'], new Uint8Array([1]), 'ring', [1]]) refused(withRelief('emboss', { sketches }), 'INPUT');
  for (const sketches of [['missing'], ['base']]) refused(withRelief('emboss', { sketches }), 'REFERENCE');
  for (const target of ['missing', 'relief']) refused(withRelief('emboss', { target }), 'REFERENCE');
  const snapshot = evaluateCadPart(document()), invalid = structuredClone(snapshot.document);
  invalid.parameters.Margin = 0.25; invalid.features.at(-1).clearance = { parameter: 'Margin' };
  assert.throws(() => reevaluate(snapshot, { document: invalid }), e => e instanceof CadPartError && e.code === 'INPUT' && e.feature === 'relief');
  shape(snapshot, 'emboss');
});

test('profile relief: 64 separated components fit direct construction; count and aggregate work limits still refuse', () => {
  const names = [], sketches = [];
  for (let i = 0; i < 65; i++) { const id = `ink${i}`; names.push(id); sketches.push(rect(id, [2 + i % 8, 2 + Math.floor(i / 8)], [2.4 + i % 8, 2.4 + Math.floor(i / 8)])); }
  refused(document('emboss', [...base(), ...sketches, { ...relief('emboss'), sketches: names }]), 'INPUT', /1..64/);
  const admitted = outputOf(evaluateCadPart(document('emboss', [...base(), ...sketches.slice(0, 64), { ...relief('emboss'), sketches: names.slice(0, 64), clearance: 0.01 }])), 'relief');
  assert.equal(admitted.brep.bodies.length, 1); assert.equal(checkBrep(admitted.brep, { strict: true }).valid, true);
  close(massPropertiesOf(admitted, 1).volume, 11680 + 64 * 0.4 * 0.4 * 3);
  const many = [];
  for (let i = 0; i < 1024; i++) { const angle = 2 * Math.PI * i / 1024; many.push([5 + Math.cos(angle), 5 + Math.sin(angle)]); }
  refused(document('emboss', [...base(), { id: 'many', kind: 'sketch', profile: 'loop', segments: lineLoop(many) }, { ...relief('emboss'), sketches: ['many'], clearance: 0.01 }]), 'INPUT', /budget/);
});


test('profile relief: zero-area, crossing, outside, nested and touching profile counters refuse', () => {
  const malformed = [
    { id: 'ink', kind: 'sketch', profile: 'loop', segments: lineLoop([[5, 5], [9, 9], [5, 9], [9, 5]]) },
    { ...rect('ink', [5, 5], [10, 10]), holes: [rectangle(9, 6, 11, 8)] },
    { ...rect('ink', [5, 5], [10, 10]), holes: [rectangle(6, 6, 9, 9), rectangle(7, 7, 8, 8)] },
    { ...rect('ink', [5, 5], [10, 10]), holes: [rectangle(5, 6, 8, 8)] },
  ];
  for (const ink of malformed) refused(document('emboss', [...base(), ink, { ...relief('emboss'), sketches: ['ink'] }]), 'GEOMETRY');
});

test('profile relief: an unproved native boundary representative refuses instead of weakening the exact mass audit', () => {
  const source = prismaticFromProfile({ outer: rectangle(0, 0, 40, 30), height: 10, tag: 'base' }), original = brepFromPrismatic(source, { id: 'base' });
  const changed = structuredClone(original), vertex = changed.vertices.find(v => v.point.every(x => x === 0));
  assert.ok(vertex); vertex.point[0] = 1e-9;
  const report = checkBrep(changed, { strict: true }); assert.equal(report.valid, true, report.issues.join('\n'));
  const before = structuredClone(changed), fail = (code, detail) => { throw new CadPartError(code, 'relief', detail); };
  assert.throws(() => profileRelief(source, changed, 'base.top', [{ outer: rectangle(10, 10, 20, 20) }], 3, 'emboss', 0, 'relief', fail), e => e instanceof CadPartError && e.code === 'CAPABILITY' && /cannot prove unchanged straight-edge representatives/.test(e.message));
  assert.deepEqual(changed, before); assert.equal(original.vertices.find(v => v.id === vertex.id).point[0], 0);
});
