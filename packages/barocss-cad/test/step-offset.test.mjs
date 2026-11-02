import test from 'node:test';
import assert from 'node:assert/strict';
import { importStep, exportStep, checkBrep, brepMassProperties, evaluateCadPart, BrepError } from '../dist/index.js';
import { evaluateSurface, surfaceDomain } from '../dist/core/math.js';
import { planeOffsetStep, cylinderOffsetStep, unsupportedOffsetStep } from './step-offset-fixtures.mjs';
import { holedBoxStep, cylinderStep } from './step-fixtures.mjs';
import { checkOffsetBoundary } from '../dist/io/step-offset-internal.js';
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
const doc = step => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'i', kind: 'import', step }] });
function supported(text, volume, faces, normalVolume = true) {
  const b = importStep(text), report = checkBrep(b, { strict: true });
  assert.equal(report.valid, true, report.issues.join('\n')); assert.equal(b.faces.length, faces);
  const m = brepMassProperties(b, 1), error = Math.abs(m.volume - volume);
  assert.ok(error <= 1e-5, `absolute volume error ${error} exceeds 1e-5`);
  if (normalVolume) assert.ok(error <= 1e-9 * Math.abs(volume), `relative volume error ${error / Math.abs(volume)} exceeds 1e-9`);
  assert.ok(m.volume > 0);
  return b;
}
function mapFrame(text, rotate, translate = [0, 0, 0], directionScale = 1) {
  return text.replace(/(CARTESIAN_POINT|DIRECTION)\('([^']*)',\(([^)]*)\)\)/g, (_all, type, name, raw) => {
    const p = rotate(raw.split(',').map(Number)), out = p.map((v, i) => type === 'DIRECTION' ? v * directionScale : v + translate[i]);
    return `${type}('${name}',(${out.join(',')}))`;
  });
}
const cycle = p => [p[2], p[0], p[1]];
const oblique = p => [0.6 * p[0] - 0.8 * p[1], 0.8 * p[0] + 0.6 * p[1], p[2]];
function replaceDistance(text, raw) { return text.replace(/(OFFSET_SURFACE\('',#\d+,)[^,]+,/, `$1${raw},`); }
function malformed(text) { assert.throws(() => importStep(text), e => e instanceof BrepError && e.code === 'INPUT' && /OFFSET_SURFACE/.test(e.message)); }
function unsupported(text, phrase) { assert.throws(() => evaluateCadPart(doc(text)), e => e.code === 'CAPABILITY' && e.message.includes(phrase)); }
function geometry(text) { assert.throws(() => importStep(text), e => e instanceof BrepError && e.code === 'GEOMETRY' && /OFFSET_SURFACE.*separated/.test(e.message)); }

for (const selfIntersect of ['T', 'F', 'U']) {
  test(`offset plane advisory ${selfIntersect} preserves literal box`, () => supported(planeOffsetStep({ selfIntersect }), 24, 6));
  test(`offset cylinder advisory ${selfIntersect} keeps signed radius and seam split`, () => supported(cylinderOffsetStep({ selfIntersect }), 1440 * Math.PI, 4));
}
for (const [name, options] of [['negative', { baseHeight: 3, distance: -1 }], ['zero', { baseHeight: 2, distance: 0 }]]) test(`plane ${name} offset`, () => supported(planeOffsetStep(options), 24, 6));
for (const [name, options, radius] of [['negative', { baseRadius: 14, distance: -2 }, 12], ['zero', { baseRadius: 12, distance: 0 }, 12], ['large positive', { baseRadius: 2, distance: 5 }, 7], ['near collapse positive', { baseRadius: 1, distance: -1023 / 1024 }, 1 / 1024]]) {
  test(`cylinder ${name} offset`, () => supported(cylinderOffsetStep(options), 10 * Math.PI * radius * radius, 4, name !== 'near collapse positive'));
}
for (const [name, rotate] of [['cyclic', cycle], ['oblique', oblique]]) {
  test(`offset plane ${name} translated frame with nonunit directions`, () => supported(mapFrame(planeOffsetStep(), rotate, [5, -7, 11], 7), 24, 6));
  test(`offset cylinder ${name} translated frame with nonunit directions`, () => supported(mapFrame(cylinderOffsetStep(), rotate, [5, -7, 11], 7), 1440 * Math.PI, 4));
}
test('scaled cylinder keeps exact analytic scaling and round-trip geometry', () => {
  const b = supported(cylinderOffsetStep({ baseRadius: 30, distance: 6, height: 30 }), 38880 * Math.PI, 4);
  supported(exportStep(b), 38880 * Math.PI, 4);
});
test('offset face sense does not reverse cylinder distance on inward hole wall', () => {
  const input = holedBoxStep(40, 30, 10, 12), ids = [...input.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1])), id = Math.max(...ids) + 1;
  const m = /^#(\d+)=CYLINDRICAL_SURFACE\('',(#\d+),12\.\);$/m.exec(input); assert.ok(m);
  const text = input.replace(m[0], `#${m[1]}=OFFSET_SURFACE('',#${id},2.,.F.);`).replace('ENDSEC;\nEND-ISO', `#${id}=CYLINDRICAL_SURFACE('',${m[2]},10.);\nENDSEC;\nEND-ISO`);
  const b = supported(text, 12000 - 1440 * Math.PI, 8); assert.ok(b.faces.some(f => f.name === 'hole#1'));
});
test('selected native plane and cylinder contain literal support samples', () => {
  for (const [text, prefix] of [[planeOffsetStep(), 'top'], [cylinderOffsetStep(), 'wall']]) {
    const b = importStep(text);
    for (const face of b.faces) if (face.name?.startsWith(prefix)) {
      const s = face.surface, { u, v } = surfaceDomain(s);
      for (const a of [0, 0.125, 0.5, 0.875, 1]) for (const d of [0, 0.5, 1]) {
        const p = evaluateSurface(s, u[0] + (u[1] - u[0]) * a, v[0] + (v[1] - v[0]) * d);
        if (prefix === 'top') near(p[2], 2); else near(Math.hypot(p[0], p[1]), 12);
      }
    }
  }
});
test('old plane boundary is not silently moved onto the offset', () => geometry(planeOffsetStep({ distance: 2 })));
test('old cylinder rims are not silently moved onto the offset', () => geometry(cylinderOffsetStep({ distance: 3, boundaryRadius: 12 })));
test('raw LINE support disagreement is not hidden by vertex endpoint reconstruction', () => {
  const text = planeOffsetStep();
  // Every raw LINE is moved in z, while vertices and planes stay fixed.
  const changed = text.replace(/LINE\('',(#\d+),/g, "LINE('',#999991,").replace('ENDSEC;\nEND-ISO', "#999991=CARTESIAN_POINT('',(100.,100.,100.));\nENDSEC;\nEND-ISO"); geometry(changed);
});
test('raw CIRCLE radius disagreement is not hidden by endpoint pinning', () => geometry(cylinderOffsetStep().replace(/CIRCLE\('',(#\d+),12\.\)/g, "CIRCLE('',$1,10.)")));
for (const raw of ["'1'", '$', '.T.', '(1.)', '1E309']) test(`offset rejects nonfinite/nonnumeric distance ${raw}`, () => malformed(replaceDistance(cylinderOffsetStep(), raw)));
for (const raw of ['.X.', '.TRUE.', '$', '1.']) test(`offset rejects malformed logical ${raw}`, () => malformed(cylinderOffsetStep().replace(/(OFFSET_SURFACE\('[^']*',#\d+,[^,]+,)\.[TFU]\.\)/, `$1${raw})`)));
for (const r of ['0.', '-1.', '1E309', "'10'"]) test(`offset rejects invalid base radius ${r}`, () => {
  const text = cylinderOffsetStep().replace(/(CYLINDRICAL_SURFACE\('',#\d+,)[^;)]+/, `$1${r}`);
  assert.throws(() => importStep(text), e => e instanceof BrepError && e.code === 'INPUT' && /basis radius must be finite and positive/.test(e.message));
});
for (const distance of [-10, -11]) test(`offset rejects collapsed/cross-focal radius ${distance}`, () => unsupported(cylinderOffsetStep({ baseRadius: 10, distance, boundaryRadius: 12 }), 'radius at or beyond collapse is not supported yet'));
test('offset refuses unsupported analytic cone without following a missing reference', () => unsupported(unsupportedOffsetStep(), 'OFFSET_SURFACE basis CONICAL_SURFACE is not supported yet'));
test('nested and cyclic offset bases are refused nonrecursively', () => {
  for (const cycle of [false, true]) {
    let text = cylinderOffsetStep(); const m = /^#(\d+)=OFFSET_SURFACE\('',#(\d+),/m.exec(text); assert.ok(m);
    text = text.replace(new RegExp(`^#${m[2]}=.*;$`, 'm'), `#${m[2]}=OFFSET_SURFACE('',#${cycle ? m[1] : m[2]},1.,.F.);`);
    unsupported(text, 'OFFSET_SURFACE basis OFFSET_SURFACE is not supported yet');
  }
});
test('new offset path refuses B-spline boundaries rather than sampling them', () => {
  const original = planeOffsetStep(), records = new Map([...original.matchAll(/^#(\d+)=(.*);$/gm)].map(m => [m[1], m[2]]));
  const face = [...records.values()].find(s => s.startsWith("ADVANCED_FACE('top'"));
  const bound = records.get(/\(#(\d+)\)/.exec(face)[1]), loop = records.get(/,#(\d+),/.exec(bound)[1]);
  const oriented = records.get(/\(#(\d+)/.exec(loop)[1]), edge = records.get(/,\*,\*,#(\d+),/.exec(oriented)[1]), curve = /,#(\d+),\.[TF]\.\)/.exec(edge)[1];
  const text = original.replace(new RegExp(`^#${curve}=.*;$`, 'm'), `#${curve}=B_SPLINE_CURVE_WITH_KNOTS('',1,(#1,#1),.UNSPECIFIED.,.F.,.F.,(2,2),(0.,1.),.UNSPECIFIED.);`);
  unsupported(text, 'OFFSET_SURFACE boundary B_SPLINE_CURVE_WITH_KNOTS is not supported yet');
});
test('offset frame zero and parallel directions refuse with typed input', () => {
  for (const raw of ['(0.,0.,0.)', '(1E309,0.,0.)']) malformed(cylinderOffsetStep().replace(/DIRECTION\('',\(0\.,0\.,1\.\)\)/g, `DIRECTION('',${raw})`));
  malformed(cylinderOffsetStep().replace(/DIRECTION\('',\(1\.,0\.,0\.\)\)/g, "DIRECTION('',(0.,0.,1.))"));
});
test('matched plain cylinder distinguishes existing default quadrature error from offset normalization', () => {
  const plain = brepMassProperties(importStep(cylinderStep(12, 10)), 1), offset = brepMassProperties(importStep(cylinderOffsetStep()), 1);
  assert.equal(offset.volume, plain.volume); near(offset.volume, 1440 * Math.PI, 1e-5);
});
for (const name of ['1.', '.F.']) test(`offset rejects nonstring name ${name}`, () => malformed(cylinderOffsetStep().replace("OFFSET_SURFACE('',", `OFFSET_SURFACE(${name},`)));
for (const two of [false, true]) test(`offset boundary wrapper ${two ? 'two-cycle' : 'self-cycle'} is bounded typed refusal`, () => {
  let text = cylinderOffsetStep();
  const id = /^#(\d+)=SURFACE_CURVE/m.exec(text)[1];
  text = text.replace(new RegExp(`^#${id}=.*;$`, 'm'), `#${id}=SURFACE_CURVE('',#${two ? 999992 : id},(),.CURVE_3D.);`);
  if (two) text = text.replace('ENDSEC;\nEND-ISO', `#999992=TRIMMED_CURVE('',#${id},(),(),.T.,.PARAMETER.);\nENDSEC;\nEND-ISO`);
  unsupported(text, 'OFFSET_SURFACE boundary wrapper cycle or depth is not supported yet');
});
test('exact raw tolerance equality is retained; a strict breach refuses without epsilon', () => {
  const f = { o: [0,0,0], x: [1,0,0], y: [0,1,0], z: [0,0,1] }, tolerance = 1 / 1024;
  const line = (x, z) => ({ kind: 'curve', id: 'line', degree: 1, knots: [0,0,1,1], weights: [1,1], controlPoints: [[x,0,z],[x,0,z+1]] });
  for (const d of [tolerance / 2, tolerance]) assert.doesNotThrow(() => checkOffsetBoundary({ kind: 'cylinder', f, r: 12 }, line(12+d, 0), tolerance, 'face', 'edge'));
  assert.throws(() => checkOffsetBoundary({ kind: 'cylinder', f, r: 12 }, line(12+tolerance+2**-40, 0), tolerance, 'face', 'edge'), e => e.code === 'GEOMETRY');
  const planeLine = { ...line(0, 0), controlPoints: [[0,0,tolerance],[1,0,tolerance]] };
  assert.doesNotThrow(() => checkOffsetBoundary({ kind: 'plane', f }, planeLine, tolerance, 'face', 'edge'));
  planeLine.controlPoints[1][2] += 2**-40;
  assert.throws(() => checkOffsetBoundary({ kind: 'plane', f }, planeLine, tolerance, 'face', 'edge'), e => e.code === 'GEOMETRY');
});
test('cylinder certificate does not accept a diameter merely because its endpoints have the right radius', () => {
  const f = { o: [0,0,0], x: [1,0,0], y: [0,1,0], z: [0,0,1] }, c = { kind:'curve', id:'diameter', degree:1, knots:[0,0,1,1],weights:[1,1],controlPoints:[[-12,0,0],[12,0,0]] };
  assert.throws(() => checkOffsetBoundary({kind:'cylinder', f, r:12}, c, 1e-7, 'face', 'edge'), e => e instanceof BrepError && /not supported yet/.test(e.message));
});
test('offset plane accepts a circular boundary with nonzero signed displacement', () => {
  let text = cylinderStep(12, 10);
  const records = new Map([...text.matchAll(/^#(\d+)=(.*);$/gm)].map(m => [m[1], m[2]])), face = [...records.values()].find(s => s.startsWith("ADVANCED_FACE('top'"));
  const plane = /,\(#\d+\),#(\d+),/.exec(face)[1], axis = /,#(\d+)\)/.exec(records.get(plane))[1], point = /,#(\d+),/.exec(records.get(axis))[1];
  const id = Math.max(...[...records.keys()].map(Number)) + 1;
  text = text.replace(new RegExp(`^#${point}=.*;$`, 'm'), `#${point}=CARTESIAN_POINT('',(0.,0.,9.));`).replace(new RegExp(`^#${plane}=.*;$`, 'm'), `#${plane}=OFFSET_SURFACE('',#${id},1.,.F.);`).replace('ENDSEC;\nEND-ISO', `#${id}=PLANE('',#${axis});\nENDSEC;\nEND-ISO`);
  supported(text, 1440 * Math.PI, 4);
});
test('malformed new offset edge endpoint coordinates refuse before legacy point parsing', () => {
  const text = cylinderOffsetStep(), point = /VERTEX_POINT\('',#(\d+)\)/.exec(text)[1];
  for (const raw of ["'bad'", '(1.,2.)', '(1.,2.,1E309)']) {
    const changed = text.replace(new RegExp(`^#${point}=.*;$`, 'm'), `#${point}=CARTESIAN_POINT('',${raw});`);
    malformed(changed);
  }
});
for (const raw of ['.U.', '$']) test(`new offset face rejects same_sense ${raw} with typed INPUT`, () => {
  const text = planeOffsetStep().replace(/^(#\d+=ADVANCED_FACE\('top',.*,)\.[TF]\.\);$/m, `$1${raw});`);
  assert.throws(() => importStep(text), e => e instanceof BrepError && e.code === 'INPUT' && /OFFSET_SURFACE face same_sense must be BOOLEAN T or F/.test(e.message));
});
test('offset precision refuses amplified literal raw-axis normalization loss', () => {
  // Integer affine image: dimensions20x3x10, top plane3x+4y=0. Only its source support changes.
  let text = mapFrame(planeOffsetStep({ distance: 5 }), p => [-4*p[0]+3*p[2], 3*p[0]+4*p[2], p[1]], [-6,-8,0]);
  const records = new Map([...text.matchAll(/^#(\d+)=(.*);$/gm)].map(m => [m[1], m[2]]));
  const offset = [...records.values()].find(s => s.startsWith("OFFSET_SURFACE(''")), base = /,#(\d+),/.exec(offset)[1];
  const axis = /,#(\d+)\)/.exec(records.get(base))[1], point = /,#(\d+),/.exec(records.get(axis))[1];
  text = text.replace(new RegExp(`^#${point}=.*;$`, 'm'), `#${point}=CARTESIAN_POINT('',(10808639105689190.,14411518807585588.,0.));`);
  text = replaceDistance(text, '-18014398509481984.');
  // Exact raw normal=(3/5,4/5,0); the source plane is2/5mm from this unchanged boundary.
  unsupported(text, 'OFFSET_SURFACE reduction precision exceeds declared tolerance');
});
test('offset precision retains exact-axis representable large cancellation', () => {
  supported(planeOffsetStep({ baseHeight: 2**54, distance: 2-2**54 }), 24, 6);
  supported(cylinderOffsetStep({ baseRadius: 2**54, distance: 4-2**54, boundaryRadius: 4 }), 160*Math.PI, 4);
});
test('offset precision cylinder reduction residue cannot spend the raw tolerance twice', () => {
  const f = { o:[0,0,0], x:[1,0,0], y:[0,1,0], z:[0,0,1] }, epsilon = 2**-53, tolerance = 2**-52;
  const s = {kind:'cylinder',f,r:1,input:{origin:f.o,axis:f.z,radius:1,distance:epsilon}}, c = {kind:'curve',id:'line',degree:1,knots:[0,0,1,1],weights:[1,1],controlPoints:[[1-tolerance,0,0],[1-tolerance,0,1]]};
  assert.throws(() => checkOffsetBoundary(s,c,tolerance,'face','edge'), e => e instanceof BrepError && e.code === 'INPUT' && /not supported yet/.test(e.message));
});
test('offset precision remaining-budget uncertainty is CAPABILITY; proved separation stays GEOMETRY', () => {
  const epsilon = 2**-53, tolerance = 4*epsilon, f = {o:[0,0,1],x:[1,0,0],y:[0,1,0],z:[0,0,1]}, s = {kind:'plane',f,input:{origin:f.o,axis:f.z,distance:epsilon}};
  const line = z => ({kind:'curve',id:'line',degree:1,knots:[0,0,1,1],weights:[1,1],controlPoints:[[0,0,z],[1,0,z]]});
  assert.doesNotThrow(() => checkOffsetBoundary(s,line(1-3*epsilon),tolerance,'face','edge'));
  assert.throws(() => checkOffsetBoundary(s,line(1-4*epsilon),tolerance,'face','edge'), e => e instanceof BrepError && e.code === 'INPUT' && /not supported yet/.test(e.message));
  assert.throws(() => checkOffsetBoundary(s,line(1-6*epsilon),tolerance,'face','edge'), e => e instanceof BrepError && e.code === 'GEOMETRY');
});
test('offset precision preserves ordinary declared-centimetre source geometry', () => supported(cylinderOffsetStep({baseRadius:1,distance:0.2,height:1,unit:'cm'}),1.44*Math.PI,4));
