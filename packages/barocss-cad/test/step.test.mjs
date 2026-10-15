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
