import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, exportStep, importStep, checkBrep, brepMassProperties, BrepError } from '../dist/index.js';

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const rect = (id, x0, y0, x1, y1) => ({ id, kind: 'sketch', profile: 'rectangle', min: [x0, y0], max: [x1, y1] });
const volume = b => brepMassProperties(b, 1000, { segmentsPerQuarter: 32 }).volumeMM3;
const box = [rect('s', 0, 0, 30, 20), { id: 'e', kind: 'extrude', sketch: 's', height: 8 }];
const parts = {
  'a holed plate': D([...box, { id: 'h', kind: 'hole', target: 'e', center: [15, 10], radius: 4 }]),
  'a rounded box (cylinders, spheres)': D([...box, { id: 'f', kind: 'fillet', target: 'e', edges: ['e.bottom|e.side0', 'e.side0|e.side1', 'e.side0|e.top', 'e.side0|e.side3', 'e.bottom|e.side1', 'e.side1|e.side2', 'e.side1|e.top', 'e.bottom|e.side2', 'e.side2|e.side3', 'e.side2|e.top', 'e.bottom|e.side3', 'e.side3|e.top'], radius: 2 }]),
  'a torus': D([{ id: 's', kind: 'sketch', profile: 'circle', center: [6, 0], radius: 2 }, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }]),
  'a sphere (poles)': D([{ id: 's', kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [0, -5], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, 5] }] }, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }]),
  'a closed shell (a cavity: BREP_WITH_VOIDS)': D([...box, { id: 'sh', kind: 'shell', target: 'e', thickness: 2 }]),
  'a drafted box': D([rect('s', 0, 0, 40, 30), { id: 'e', kind: 'extrude', sketch: 's', height: 10, draft: 5 }]),
};

test('STEP export is well formed AP214 and round-trips every part exactly (validity, faces, names, volume)', () => {
  for (const [name, doc] of Object.entries(parts)) {
    const o = evaluateCadPart(doc).outputs.at(-1), text = o.exportStep({ name: 'part' });
    // Structure: header and schema, every instance terminated, every reference defined.
    assert.match(text, /^ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION/);
    assert.match(text, /FILE_SCHEMA\(\('AUTOMOTIVE_DESIGN \{ 1 0 10303 214 1 1 1 1 \}'\)\);/);
    assert.match(text, /ENDSEC;\nEND-ISO-10303-21;\n$/);
    const body = text.slice(text.indexOf('DATA;') + 5, text.lastIndexOf('ENDSEC;')).trim().split('\n');
    const defined = new Set(body.map(l => { const m = /^#(\d+)=.*;$/.exec(l); assert.ok(m, `instance line: ${l.slice(0, 60)}`); return m[1]; }));
    for (const l of body) for (const m of l.slice(l.indexOf('=')).matchAll(/#(\d+)/g)) assert.ok(defined.has(m[1]), `#${m[1]} is defined`);
    assert.ok(/MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS/.test(text) && /ADVANCED_BREP_SHAPE_REPRESENTATION/.test(text) && /SI_UNIT\(\.MILLI\.,\.METRE\.\)/.test(text), name);
    const back = importStep(text), report = checkBrep(back);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.equal(back.faces.length, o.brep.faces.length, name);
    assert.deepEqual(back.faces.map(f => f.name).sort(), o.brep.faces.map(f => f.name).sort(), `${name}: face names`);
    assert.ok(Math.abs(volume(back) - volume(o.brep)) <= 1e-9 * volume(o.brep), `${name}: ${volume(back)} vs ${volume(o.brep)}`);
  }
  const voided = exportStep(evaluateCadPart(parts['a closed shell (a cavity: BREP_WITH_VOIDS)']).outputs[0].brep);
  assert.match(voided, /ORIENTED_CLOSED_SHELL\('',\*,#\d+,\.F\.\)/);
  assert.match(voided, /BREP_WITH_VOIDS\('[^']*',#\d+,\(#\d+\)\)/);
});

test('several bodies go into one STEP product; unsupported input is refused with the reason', () => {
  const pattern = evaluateCadPart(D([...box, { id: 'p', kind: 'linear-pattern', target: 'e', axis: 'x', spacing: 40, count: 3 }])).outputs[0];
  const text = exportStep([pattern.brep], { name: 'pattern' });
  assert.equal((text.match(/MANIFOLD_SOLID_BREP/g) ?? []).length, 3);
  const back = importStep(text);
  assert.equal(back.bodies.length, 3);
  assert.ok(Math.abs(volume(back) - 3 * 4800) < 1e-6);
  assert.throws(() => importStep('ISO-10303-21;\nDATA;\n#1=CARTESIAN_POINT(\'\',(0.,0.,0.));\nENDSEC;'), e => e instanceof BrepError && /no solid/.test(e.message));
  assert.throws(() => importStep('nothing'), e => e instanceof BrepError && /no DATA section/.test(e.message));
});

test('STEP from other systems: analytic surfaces, closed circles, seams and poles become seamless patches', async () => {
  const { cylinderStep, holedBoxStep, frustumStep, sphereStep, extrudedSideStep, revolvedProfileStep } = await import('./step-fixtures.mjs');
  const pi = Math.PI, near = (a, b, rel) => Math.abs(a - b) <= rel * Math.abs(b), r1 = 10 - 6 * Math.tan(pi / 6);
  const cases = [
    ['a cylinder (closed circles, a wall with a seam)', cylinderStep(), pi * 250, ['bottom', 'top', 'wall#1', 'wall#2']],
    ['a box with a through hole (the wall faces inwards)', holedBoxStep(), 12000 - 160 * pi, ['back', 'bottom', 'front', 'hole#1', 'hole#2', 'left', 'right', 'top']],
    ['a cone frustum (CONICAL_SURFACE)', frustumStep(), pi * 2 * (100 + 10 * r1 + r1 * r1), ['bottom', 'cone#1', 'cone#2', 'top']],
    ['a sphere (a seam from pole to pole)', sphereStep(), 4 / 3 * pi * 125, ['ball#1', 'ball#2']],
    // A parabolic side (SURFACE_OF_LINEAR_EXTRUSION of a B-spline): the parabola adds 2/3 of its triangle.
    ['a prism with an extruded B-spline side', extrudedSideStep(), (80 + 40 / 3) * 5, ['bottom', 'curved', 'front', 'left', 'right', 'top']],
    // A B-spline profile turned once (SURFACE_OF_REVOLUTION with the profile as its seam): π∫ρ² dh.
    ['a vase (a B-spline profile turned once)', revolvedProfileStep(), (() => { const rho = t => (1 - t) ** 2 * 3 + 12 * t * (1 - t) + 5 * t * t, dh = t => 6 - 12 * t + 12 * t, g = [-0.906179845938664, -0.538469310105683, 0, 0.538469310105683, 0.906179845938664], w = [0.236926885056189, 0.478628670499366, 0.568888888888889, 0.478628670499366, 0.236926885056189]; return g.reduce((sum, x, i) => sum + w[i] / 2 * pi * rho((x + 1) / 2) ** 2 * dh((x + 1) / 2), 0); })(), ['bottom', 'top', 'wall#1', 'wall#2']],
  ];
  for (const [name, text, expected, faces] of cases) {
    const b = importStep(text), report = checkBrep(b);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.deepEqual(b.faces.map(f => f.name).sort(), faces, name);
    // The mesh's own error at 48 segments a quarter (about 2e-4 for a circle).
    assert.ok(near(brepMassProperties(b, 1000, { segmentsPerQuarter: 48 }).volumeMM3, expected, 5e-4), `${name}: ${brepMassProperties(b, 1000, { segmentsPerQuarter: 48 }).volumeMM3} vs ${expected}`);
    assert.ok(b.edges.every(e => e.vertices[0] !== e.vertices[1]), `${name}: no closed edges`);
    const again = importStep(exportStep(b));
    assert.equal(checkBrep(again).valid, true, `${name}: written back and read again`);
  }
  // Imported bodies take features like any other.
  const k = (10 - 3 * pi) / (12 - 3 * pi), corner = 1 - pi / 4;
  const holed = evaluateCadPart(D([{ id: 'i', kind: 'import', step: holedBoxStep() }, { id: 'h', kind: 'hole', target: 'i', center: [8, 8], radius: 2 }])).outputs[0];
  assert.equal(checkBrep(holed.brep).valid, true);
  assert.ok(near(holed.massProperties(1000).volumeMM3, 12000 - 160 * pi - 40 * pi, 1e-4));
  assert.ok(holed.brep.faces.some(f => f.name === 'i.hole#1') && holed.brep.faces.some(f => f.name.startsWith('h.')), 'imported faces are prefixed by the feature id');
  const rim = evaluateCadPart(D([{ id: 'i', kind: 'import', step: holedBoxStep() }, { id: 'f', kind: 'fillet', target: 'i', edges: ['i.hole#1|i.top'], radius: 1 }])).outputs[0];
  assert.equal(checkBrep(rim.brep).valid, true);
  assert.ok(near(rim.massProperties(1000).volumeMM3, 12000 - 160 * pi - 2 * pi * (4 + k) * corner, 1e-4), String(rim.massProperties(1000).volumeMM3));
  const chamfered = evaluateCadPart(D([{ id: 'i', kind: 'import', step: cylinderStep() }, { id: 'c', kind: 'chamfer', target: 'i', edges: ['i.top|i.wall#1'], distance: 1 }])).outputs[0];
  assert.ok(near(chamfered.massProperties(1000).volumeMM3, 250 * pi - 2 * pi * (5 - 1 / 3) * 0.5, 5e-4), String(chamfered.massProperties(1000).volumeMM3)); // (the 32-per-quarter mesh's error)
  // What cannot be read yet is refused by name.
  assert.throws(() => evaluateCadPart(D([{ id: 'i', kind: 'import', step: "ISO-10303-21;\nDATA;\n#1=OFFSET_SURFACE('',#5,1.,.F.);\n#2=MANIFOLD_SOLID_BREP('',#3);\n#3=CLOSED_SHELL('',(#4));\n#4=ADVANCED_FACE('',(),#1,.T.);\nENDSEC;" }])),
    e => e.code === 'CAPABILITY' && /OFFSET_SURFACE surfaces are not supported yet/.test(e.message));
  // A profile off the plane through its axis is not turned yet.
  assert.throws(() => importStep(revolvedProfileStep().replace("CARTESIAN_POINT('',(6.,0.,3.))", "CARTESIAN_POINT('',(6.,1.5,3.))")), e => e instanceof BrepError && /off a plane through its axis/.test(e.message));
});
