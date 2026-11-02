import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, exportStep, importStep, stepValidationProperties, stepMeshes, checkBrep, BrepError } from '../dist/index.js';

const native = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 12] },
  { id: 'e', kind: 'extrude', sketch: 's', height: 6 },
] }).outputs[0].brep;
const labels = ['ordinary', 'ENDSEC;', 'DATA;', '/*x*/', "O'Brien", "DATA; /* literal */ O'Brien ENDSEC;"];
const properties = { volume: 2160, area: 1224, centroid: [15, 6, 3], box: { min: [0, 0, 0], max: [30, 12, 6] } };
function namedStep(label) {
  const body = structuredClone(native); body.faces[0].name = label;
  return exportStep(body, { name: label, timestamp: '2026-11-02T00:00:00' });
}
function checkText(text, label) {
  const body = importStep(text);
  assert.equal(checkBrep(body, { strict: true }).valid, true);
  assert.equal(body.faces[0].name, label, 'The decoded face label is the literal independent string oracle');
  assert.deepEqual([body.faces.length, body.edges.length, body.vertices.length], [6, 12, 8]);
  assert.deepEqual(stepValidationProperties(text), properties);
  assert.equal(stepMeshes(text), null, 'The shared reader still identifies native B-rep input');
}

test('quoted section tokens, comment markers and doubled quotes round-trip without changing names or properties', () => {
  for (const label of labels) checkText(namedStep(label), label);
});

test('real comments between tokens and section decoys are whitespace outside quoted strings', () => {
  const text = namedStep('ordinary');
  checkText(text.replace('DATA;', 'DATA;\n/* real comment */').replace(/=([A-Z_]+)\(/g, '=/* a */$1/* b */('), 'ordinary');
  checkText(text.replace('DATA;', '/* DATA; ENDSEC; */\nDATA;').replace('ENDSEC;\nEND-ISO', '/* ENDSEC; DATA; */\nENDSEC;\nEND-ISO'), 'ordinary');
});

test('the mesh-only shared reader retains literal comment and section tokens in mesh names', () => {
  const label = "DATA; /*x*/ O'Brien ENDSEC;", encoded = label.replaceAll("'", "''");
  const text = `ISO-10303-21;
HEADER;FILE_DESCRIPTION((''),'2;1');FILE_NAME('mesh.step','',(''),(''),'','','');FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));ENDSEC;
DATA;
#1=COORDINATES_LIST('',4,((0.,0.,0.),(10.,0.,0.),(10.,10.,0.),(0.,10.,0.)));
#2=TRIANGULATED_FACE('top',#1,4,(),$,(),((1,2,3),(1,3,4)));
#3=TESSELLATED_SHELL('${encoded}',(#2),$);
ENDSEC;
END-ISO-10303-21;
`;
  const meshes = stepMeshes(text);
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].name, label);
  assert.equal(meshes[0].indices.length, 6);
});

test('unclosed strings and comments remain typed INPUT refusals and comments never join section keywords', () => {
  const text = namedStep('ordinary');
  const malformed = [text.replace("PRODUCT('ordinary'", "PRODUCT('ordinary"), text.replace('DATA;', 'DATA;/* unclosed'), text.replace('DATA;', 'DA/* separator */TA;')];
  for (const input of malformed) for (const read of [importStep, stepValidationProperties, stepMeshes]) {
    assert.throws(() => read(input), error => error instanceof BrepError && error.code === 'INPUT');
  }
});

test('only the first DATA section is read and section-like identifiers are not section statements', () => {
  const text = namedStep('ordinary');
  checkText(text.replace('DATA;', 'NOTDATA;\nDATA;').replace('END-ISO-10303-21;', 'DATA;\n#999=UNKNOWN();\nENDSEC;\nEND-ISO-10303-21;'), 'ordinary');
});
