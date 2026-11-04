import test from 'node:test';
import assert from 'node:assert/strict';
import { exportStep, evaluateCadPart, stepValidationProperties } from '@barocss/cad';
import { emptyDoc, withNode } from '../src/engine/doc';
import { exportStudioStep } from '../src/engine/evaluate';
import { revisionOf } from '../src/util/revision';

// Locally authored aligned R5 meridian fixture, shared in shape with the CAD regression.
const sphereStep = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('mass translation'),'2;1');
FILE_NAME('mass-translation.step','',(''),(''),'','','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
#1=CARTESIAN_POINT('',(0,0,-5));
#2=VERTEX_POINT('',#1);
#3=CARTESIAN_POINT('',(0,0,5));
#4=VERTEX_POINT('',#3);
#5=CARTESIAN_POINT('',(0,0,0));
#6=DIRECTION('',(0,-1,0));
#7=DIRECTION('',(1,0,0));
#8=AXIS2_PLACEMENT_3D('',#5,#6,#7);
#9=CIRCLE('',#8,5);
#10=SEAM_CURVE('',#9,(),.PCURVE_S1.);
#11=EDGE_CURVE('',#2,#4,#10,.T.);
#12=CARTESIAN_POINT('',(0,0,0));
#13=DIRECTION('',(0,0,1));
#14=DIRECTION('',(1,0,0));
#15=AXIS2_PLACEMENT_3D('',#12,#13,#14);
#16=SPHERICAL_SURFACE('',#15,5);
#17=ORIENTED_EDGE('',*,*,#11,.T.);
#18=ORIENTED_EDGE('',*,*,#11,.F.);
#19=EDGE_LOOP('',(#17,#18));
#20=FACE_OUTER_BOUND('',#19,.T.);
#21=ADVANCED_FACE('literal-sphere',(#20),#16,.T.);
#22=CLOSED_SHELL('',(#21));
#23=MANIFOLD_SOLID_BREP('independent',#22);
#24=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));
#25=(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNIT_ASSIGNED_CONTEXT((#24))REPRESENTATION_CONTEXT('',''));
#26=ADVANCED_BREP_SHAPE_REPRESENTATION('',(#23),#25);
ENDSEC;
END-ISO-10303-21;
`;

const options = { name: 'D438-properties', timestamp: '2026-11-02T00:00:00' };
const loss = 'Bounding-box validation is not included in this STEP file.';

test('the actual omitted sphere bbox is reported without changing its document or source revision', () => {
  const doc = withNode(emptyDoc(), { kind: 'import', name: 'sphere.step', step: sphereStep }), before = structuredClone(doc), source = revisionOf(doc);
  const result = exportStudioStep(doc, options), properties = stepValidationProperties(result.text);
  assert.equal(properties.box, undefined);
  assert.ok(properties.volume! > 0 && properties.area! > 0 && properties.centroid!.every(Number.isFinite));
  assert.deepEqual(result.omitted, [loss], 'Imported STEP gains the actual missing validation report, not invented feature or appearance losses');
  assert.equal(result.source, source);
  assert.deepEqual(doc, before);
});

test('a planar imported solid keeps its bbox and gains no bbox loss', () => {
  const native = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [4, 3] },
    { id: 'e', kind: 'extrude', sketch: 's', height: 2 },
  ] }).outputs[0].brep;
  const doc = withNode(emptyDoc(), { kind: 'import', name: 'prism.step', step: exportStep(native, options) }), before = structuredClone(doc);
  const result = exportStudioStep(doc, options);
  assert.deepEqual(stepValidationProperties(result.text).box, { min: [0, 0, 0], max: [4, 3, 2] });
  assert.equal(result.omitted, undefined);
  assert.equal(result.source, revisionOf(doc));
  assert.deepEqual(doc, before);
});


test('export names with section tokens or bbox decoys cannot refuse or hide the real omission', () => {
  const doc = withNode(emptyDoc(), { kind: 'import', name: 'sphere.step', step: sphereStep }), before = structuredClone(doc);
  const names = [
    { name: 'ENDSEC;', losses: [loss] },
    { name: "sphere\n#123=REPRESENTATION('bounding box',(#1,#2),#3);", losses: ['Non-ASCII and control characters in the STEP header file name and product name are replaced with underscores.', loss] },
  ];
  for (const { name, losses } of names) {
    const result = exportStudioStep(doc, { ...options, name });
    assert.match(result.text, /END-ISO-10303-21;/);
    assert.doesNotMatch(result.text, /^#\d+=REPRESENTATION\('bounding box',\(#\d+,#\d+\),#\d+\);$/m);
    assert.deepEqual(result.omitted, losses);
    assert.equal(result.source, revisionOf(doc));
    assert.deepEqual(doc, before);
  }
});
