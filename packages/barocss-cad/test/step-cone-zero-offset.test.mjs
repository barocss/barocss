import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { importStep, checkBrep, evaluateCadPart, BrepError } from '../dist/index.js';
import { frustumStep } from './step-fixtures.mjs';

const plain = frustumStep(10, 6, 30);
const basisRefusal = /OFFSET_SURFACE basis CONICAL_SURFACE is not supported yet \(direct plane, cylinder or sphere only\)$/;
const document = step => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'n0', kind: 'import', step }] });
const hash = text => createHash('sha256').update(text).digest('hex');
function append(text, record) { return text.replace('ENDSEC;\nEND-ISO-10303-21;', record + '\nENDSEC;\nEND-ISO-10303-21;'); }
function nextId(text) { return Math.max(...[...text.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1]))) + 1; }
function wrap(text, distance = '0.', logical = 'F') {
  const m = /^#(\d+)=(CONICAL_SURFACE\('',#\d+,[^;]+\));$/m.exec(text); assert.ok(m);
  const n = nextId(text);
  return append(text.replace(m[0], `#${m[1]}=OFFSET_SURFACE('',#${n},${distance},.${logical}.);`), `#${n}=${m[2]};`);
}
function pair(text, distance = '0.', logical = 'F') {
  const a = importStep(text, { id: 'same' }), b = importStep(wrap(text, distance, logical), { id: 'same' });
  assert.deepEqual(b, a, 'Every native field, ID, coordinate, weight, knot, sense and tolerance stays unchanged');
  assert.equal(checkBrep(b, { strict: true }).valid, true);
  return b;
}
function unsupported(text, pattern = /OFFSET_SURFACE.*not supported/) {
  assert.throws(() => importStep(text), e => e instanceof BrepError && e.code === 'INPUT' && pattern.test(e.message));
}
function malformed(text) { assert.throws(() => importStep(text), e => e instanceof BrepError && e.code === 'INPUT'); }
function changeRecord(text, id, body) { return text.replace(new RegExp(`^#${id}=.*;$`, 'm'), `#${id}=${body};`); }
function coneRecord(text) { const m = /^#(\d+)=CONICAL_SURFACE\('',(#\d+),([^,]+),([^,]+)\);$/m.exec(text); assert.ok(m); return m; }
function frameTransform(text, translate = [5, -7, 11]) {
  const xRefs = new Set([...text.matchAll(/AXIS2_PLACEMENT_3D\('',#\d+,#\d+,#(\d+)\)/g)].map(m => m[1]));
  return text.replace(/^#(\d+)=(CARTESIAN_POINT|DIRECTION)\('',\(([^)]+)\)\);$/gm, (_all, id, type, raw) => {
    const p = raw.split(',').map(Number), v = [0.6 * p[0] - 0.48 * p[1] + 0.64 * p[2], 0.8 * p[0] + 0.36 * p[1] - 0.48 * p[2], 0.8 * p[1] + 0.6 * p[2]];
    const q = type === 'CARTESIAN_POINT' ? v.map((x, k) => x + translate[k]) : v.map((x, k) => 7 * (x + (xRefs.has(id) ? 0.37 * [0.64, -0.48, 0.6][k] : 0)));
    return `#${id}=${type}('',(${q.join(',')}));`;
  });
}
function topFirst(text) {
  return text.replace(/CLOSED_SHELL\('',\((#\d+),(#\d+),(#\d+)\)\)/, "CLOSED_SHELL('',($2,$1,$3))");
}
function lineOriginElsewhere(text) {
  const n = nextId(text), m = /^#(\d+)=LINE\('',#\d+,(#\d+)\);$/m.exec(text); assert.ok(m);
  return append(changeRecord(text, m[1], `LINE('',#${n},${m[2]})`), `#${n}=CARTESIAN_POINT('',(200.,0.,0.));`);
}

test('D443 immutable graph and complete canonical native output retain their captured identity', () => {
  assert.equal(hash(plain), '82a6a31b874d158b8d799bc35798ac0b4706c0c44f3f3efeaf475cb8de367fcd');
  assert.equal(hash(wrap(plain)), '4cf2dde3679f70694c9323bd37e9123ffdda962a6249cb13c6a9f53b8d0033ed');
  const a = importStep(plain), b = importStep(wrap(plain));
  assert.equal(hash(JSON.stringify(a)), '6d5d7736e3dd507c82971d19f4e981ffa7fe245bb7e06d3de0276880b7c87252');
  assert.deepEqual(b, a);
  assert.equal(checkBrep(b, { strict: true }).valid, true);
});
test('oblique nonunit reference vectors retain the exact legacy frame arithmetic and all native fields', () => pair(frameTransform(plain)));
test('a shared circular edge read by its cap first keeps complete native equality', () => pair(topFirst(plain)));
for (const [distance, logical] of [['-0.', 'F'], ['+000.000E+3', 'T'], ['-0.E-9999', 'U']]) {
  test(`literal zero ${distance} with advisory ${logical} is an exact identity`, () => pair(plain, distance, logical));
}
test('public part admits exact zero with the same original document and native output', () => {
  const a = evaluateCadPart(document(plain)), doc = document(wrap(plain)), before = structuredClone(doc), b = evaluateCadPart(doc);
  assert.deepEqual(b.outputs, a.outputs);
  assert.deepEqual(doc, before);
});
for (const distance of ['2.', '1E-9999', '-1E-9999', '0.0001E-9999']) {
  test(`nonzero raw distance ${distance} retains the existing cone refusal`, () => {
    const text = wrap(plain, distance); unsupported(text, basisRefusal);
    assert.throws(() => evaluateCadPart(document(text)), e => e.code === 'CAPABILITY' && basisRefusal.test(e.message));
  });
}
test('quoted zero decoys and nested scalar payloads cannot supply exact-zero provenance', () => {
  unsupported(wrap(plain, '1E-9999').replace("OFFSET_SURFACE('',", "OFFSET_SURFACE('0. E0 #33=OFFSET_SURFACE zero',"), basisRefusal);
  for (const value of ["'0.'", 'LENGTH_MEASURE(0.)', '(0.)', '$']) malformed(wrap(plain, value));
});
test('real comments around the third zero token do not alter the identity', () => pair(plain, '/* not 1E-9999 */ -0.E+17 /* end */'));
test('nested, oriented and cyclic bases remain unsupported rather than recursively reduced', () => {
  const text = wrap(plain), m = coneRecord(text), n = nextId(text);
  unsupported(append(changeRecord(text, m[1], `OFFSET_SURFACE('',#${n},0.,.F.)`), `#${n}=${m[0].slice(m[0].indexOf('=') + 1)}`), /basis OFFSET_SURFACE.*not supported/);
  unsupported(changeRecord(text, m[1], `ORIENTED_SURFACE('',*,.T.)`), /basis ORIENTED_SURFACE.*not supported/);
  unsupported(changeRecord(text, m[1], `OFFSET_SURFACE('',#${m[1]},0.,.F.)`), /basis OFFSET_SURFACE.*not supported/);
});
test('malformed wrapper and finite-cone fields are typed refusals', () => {
  const text = wrap(plain), m = coneRecord(text);
  malformed(text.replace("OFFSET_SURFACE('',", 'OFFSET_SURFACE(3.,'));
  malformed(wrap(plain, '0.', 'BAD'));
  malformed(changeRecord(text, m[1], `CONICAL_SURFACE(3.,${m[2]},${m[3]},${m[4]})`));
  malformed(changeRecord(text, m[1], `CONICAL_SURFACE('',${m[2]},${m[3]})`));
  malformed(changeRecord(text, m[1], `CONICAL_SURFACE('',${m[2]},'radius',${m[4]})`));
  malformed(changeRecord(text, m[1], `CONICAL_SURFACE('',${m[2]},${m[3]},1E9999)`));
});
test('cone-only frame, point and direction names/arity and orientation are checked', () => {
  const text = wrap(plain), m = coneRecord(text), f = new RegExp(`^${m[2]}=AXIS2_PLACEMENT_3D\\('',(#\\d+),(#\\d+),(#\\d+)\\);$`, 'm').exec(text); assert.ok(f);
  malformed(text.replace(f[0], f[0].replace("('',", '(4.,')));
  malformed(changeRecord(text, f[1].slice(1), "CARTESIAN_POINT(4.,(0.,0.,6.))"));
  malformed(changeRecord(text, f[2].slice(1), "DIRECTION('',(0.,0.))"));
  malformed(changeRecord(text, f[3].slice(1), "DIRECTION('',(0.,0.,-1.))"));
  malformed(text.replace(/(ADVANCED_FACE\('cone',\([^;]+,)(\.T\.)(\);)/, '$1.U.$3'));
  malformed(text.replace(/(ORIENTED_EDGE\('',\*,\*,#\d+,)\.T\./, '$1.U.'));
});
test('a cached ellipse cannot enter the declared circular-rim profile', () => {
  const rim = [...plain.matchAll(/^#(\d+)=CIRCLE\('',(#\d+),([^,)]+)\);$/gm)][1]; assert.ok(rim);
  const text = topFirst(changeRecord(plain, rim[1], `ELLIPSE('',${rim[2]},${rim[3]},${rim[3]})`));
  assert.match(text, /ELLIPSE/);
  unsupported(wrap(text), /exact-zero cone.*boundary ELLIPSE/);
});
test('a cached malformed rim sense is checked again for the cone face', () => {
  const rim = [...plain.matchAll(/^#(\d+)=CIRCLE\('',#\d+,[^;]+;$/gm)][1]; assert.ok(rim);
  const text = topFirst(plain).replace(new RegExp(`(EDGE_CURVE\\('',#\\d+,#\\d+,#${rim[1]},)\\.T\\.`), '$1.U.');
  malformed(wrap(text));
});
test('raw LINE support is not replaced silently by its pinned endpoints', () => {
  assert.throws(() => importStep(wrap(lineOriginElsewhere(plain))), e => e instanceof BrepError && e.code === 'GEOMETRY' && /OFFSET_SURFACE edge.*separated/.test(e.message));
});
test('correct edge counts do not admit a disconnected rim/seam ordering', () => {
  const text = plain.replace(/EDGE_LOOP\('',\((#\d+),(#\d+),(#\d+),(#\d+)\)\)/, "EDGE_LOOP('',($2,$4,$1,$3))");
  assert.notEqual(text, plain);
  unsupported(wrap(text), /cyclically connected/);
});
test('a reversed face sense retains plain native semantics without a positive-volume claim', () => {
  const text = plain.replace(/(ADVANCED_FACE\('cone',\([^;]+,)\.T\.(\);)/, '$1.F.$2');
  assert.notEqual(text, plain);
  assert.deepEqual(importStep(wrap(text), { id: 'same' }), importStep(text, { id: 'same' }));
});
test('a padded chart that reaches the apex stays outside the selected profile', () => unsupported(wrap(frustumStep(1e-8, 1e-8, 30)), /apex or another nappe/));
test('a world-rounded planar cone patch gets a named representation refusal', () => {
  const tiny = frustumStep(1e-12, 6, 1e-12).replace(/(CARTESIAN_POINT|DIRECTION)\('',\(([^)]+)\)\)/g, (_all, type, raw) => {
    const p = raw.split(',').map(Number), q = type === 'CARTESIAN_POINT' ? [999000 - p[1], p[0], p[2]] : [-p[1], p[0], p[2]];
    return `${type}('',(${q.join(',')}))`;
  });
  unsupported(wrap(tiny), /frustum would lose its three-dimensional shape/);
});
test('zero radius or negative-angle cones remain named unsupported subsets, without changing plain policy', () => {
  const text = wrap(plain), m = coneRecord(text);
  unsupported(changeRecord(text, m[1], `CONICAL_SURFACE('',${m[2]},0.,${m[4]})`));
  unsupported(changeRecord(text, m[1], `CONICAL_SURFACE('',${m[2]},${m[3]},-${m[4]})`));
});
