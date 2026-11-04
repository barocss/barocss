import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, exportStep, importStep, stepMeshes, stepValidationProperties } from '../dist/index.js';

const native = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
  { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 12] },
  { id: 'n1', kind: 'extrude', sketch: 'n0', height: 6 },
] }).outputs[0].brep;
const options = { timestamp: '2026-11-02T00:00:00' };
// Independent literal labels and raw writer tokens were frozen before the reader change.
const cases = [
  {
    "id": "01",
    "label": "ordinary",
    "rawQuoted": "'ordinary'"
  },
  {
    "id": "02",
    "label": "one\\slash",
    "rawQuoted": "'one\\\\slash'"
  },
  {
    "id": "03",
    "label": "repeat\\\\slashes",
    "rawQuoted": "'repeat\\\\\\\\slashes'"
  },
  {
    "id": "04",
    "label": "O'Brien\\DATA; /*x*/ ENDSEC;",
    "rawQuoted": "'O''Brien\\\\DATA; /*x*/ ENDSEC;'"
  },
  {
    "id": "05",
    "label": "\\X2\\0041\\X0\\",
    "rawQuoted": "'\\\\X2\\\\0041\\\\X0\\\\'"
  }
];

const properties = { volume: 2160, area: 1224, centroid: [15, 6, 3], box: { min: [0, 0, 0], max: [30, 12, 6] } };
function pointKey(vertex) { return vertex.point.join(','); }
function vertexPoints(body) { return body.vertices.map(pointKey).sort(); }
function named(label) { const body = structuredClone(native); body.faces[0].name = label; return body; }

test('literal ASCII backslash pairs decode once and repeated round-trips do not grow names', () => {
  const geometry = vertexPoints(native);
  for (const c of cases) {
    let body = named(c.label);
    for (let cycle = 0; cycle < 3; cycle++) {
      const text = exportStep(body, { ...options, name: c.label });
      assert.ok(text.includes('PRODUCT(' + c.rawQuoted + ',' + c.rawQuoted + ','));
      assert.ok(text.includes('ADVANCED_FACE(' + c.rawQuoted + ','));
      assert.deepEqual(stepValidationProperties(text), properties);
      body = importStep(text);
      assert.equal(body.faces[0].name, c.label);
      assert.deepEqual(vertexPoints(body), geometry);
      assert.deepEqual([body.faces.length, body.edges.length, body.vertices.length], [6, 12, 8]);
    }
  }
});

test('the shared mesh-only reader retains one literal slash per writer-encoded pair', () => {
  const c = cases[3];
  const text = `ISO-10303-21;
HEADER;FILE_DESCRIPTION((''),'2;1');FILE_NAME('mesh.step','',(''),(''),'','','');FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));ENDSEC;
DATA;
#1=COORDINATES_LIST('',4,((0.,0.,0.),(10.,0.,0.),(10.,10.,0.),(0.,10.,0.)));
#2=TRIANGULATED_FACE('top',#1,4,(),$,(),((1,2,3),(1,3,4)));
#3=TESSELLATED_SHELL(${c.rawQuoted},(#2),$);
ENDSEC;
END-ISO-10303-21;
`;
  const meshes = stepMeshes(text);
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].name, c.label);
  assert.equal(meshes[0].indices.length, 6);
});

test('opaque adjacent directives and mixed escape-looking values stay whole without Unicode qualification', () => {
  const bs = String.fromCharCode(92);
  const opaque = [
    bs + 'PE' + bs + bs + 'S' + bs + '*',
    bs + 'X2' + bs + '0041' + bs + 'X0' + bs + bs + 'X2' + bs + '0042' + bs + 'X0' + bs,
    'mixed' + bs + bs + 'literal ' + bs + 'q tail',
    'unknown' + bs + 'q' + bs + 'X2' + bs + '0041' + bs + 'X0' + bs + 'tail',
    // Legacy opaque metadata compatibility only, not valid-standard or Unicode qualification.
    String.fromCharCode(233) + bs + bs + 'literal',
    'control' + String.fromCharCode(9) + bs + bs + 'literal',
  ];
  const text = exportStep(named('ordinary'), { ...options, name: 'ordinary' });
  for (const value of opaque) {
    const raw = text.replace("ADVANCED_FACE('ordinary',", "ADVANCED_FACE('" + value + "',");
    assert.equal(importStep(raw).faces[0].name, value, 'Existing opaque strings are retained byte-for-byte, not interpreted');
    assert.deepEqual(stepValidationProperties(raw), properties);
  }
});
