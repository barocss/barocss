import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, massPropertiesOf, checkOutput, saveCadPart, loadCadPart, reevaluate, tessellateBrep, CadPartError, prismaticFromProfile, brepFromPrismatic } from '../dist/index.js';
import { part, BarocssError } from '../dist/api/index.js';
import { readNativeSIInertia } from '../dist/internal/native-si-mass.js';
import { buildCylindricalWrapClosedReference } from '../dist/features/cylindrical-wrap-closed-reference.js';

const bounds = { u: [0.1, 0.4], v: [0.2, 0.7] };
const document = (edit = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { Height: 10 }, features: [
  { id: 'circle', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 },
  { id: 'post', kind: 'extrude', sketch: 'circle', height: 30, from: -7 },
  { id: 'wrap', kind: 'cylindrical-wrap', target: 'post', faces: ['post.side0#2'], rectangle: structuredClone(bounds), height: { parameter: 'Height' }, ...edit },
] });
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function angle(u) {
  const t = 2 * u, s = 1 - t, w = Math.SQRT1_2;
  return Math.atan2(2 * w * s * t + t * t, s * s + 2 * w * s * t);
}
// Independent ideal-cylinder annular-sector integrals. The native radial shell error is <1e-8 here.
function oracle(density, z0 = -7) {
  const a = angle(bounds.u[0]), b = angle(bounds.u[1]), d = b - a, z1 = z0 + 30 * bounds.v[0], z2 = z0 + 30 * bounds.v[1], h = z2 - z1;
  const baseV = Math.PI * 100 * 30, padV = 150 * d * h, V = baseV + padV;
  const X = 7000 / 3 * (Math.sin(b) - Math.sin(a)) * h, Y = 7000 / 3 * (Math.cos(a) - Math.cos(b)) * h;
  const C = [X / V, Y / V, (baseV * (z0 + 15) + padV * (z1 + z2) / 2) / V];
  const XX = baseV * 25 + 37500 * (d / 2 + (Math.sin(2 * b) - Math.sin(2 * a)) / 4) * h;
  const YY = baseV * 25 + 37500 * (d / 2 - (Math.sin(2 * b) - Math.sin(2 * a)) / 4) * h;
  const XY = 37500 * (Math.sin(b) ** 2 - Math.sin(a) ** 2) / 2 * h;
  const ZZ = baseV * ((z0 + 15) ** 2 + 75) + padV * (z1 * z1 + z1 * z2 + z2 * z2) / 3;
  const XZ = X * (z1 + z2) / 2, YZ = Y * (z1 + z2) / 2, q = density / 1000;
  return { V, C, I: [[(YY + ZZ - V * (C[1] ** 2 + C[2] ** 2)) * q, -(XY - V * C[0] * C[1]) * q, -(XZ - V * C[0] * C[2]) * q],
    [-(XY - V * C[0] * C[1]) * q, (XX + ZZ - V * (C[0] ** 2 + C[2] ** 2)) * q, -(YZ - V * C[1] * C[2]) * q],
    [-(XZ - V * C[0] * C[2]) * q, -(YZ - V * C[1] * C[2]) * q, (XX + YY - V * (C[0] ** 2 + C[1] ** 2)) * q]] };
}
function matches(output, density) {
  const m = massPropertiesOf(output, density), e = oracle(density);
  assert.deepEqual(readNativeSIInertia(m), { ok: false, code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE', reason: 'combined' });
  close(m.volume, e.V); close(m.mass, e.V * density / 1000, 1e-10);
  for (let i = 0; i < 3; i++) { close(m.centroid[i], e.C[i], 1e-10); for (let j = 0; j < 3; j++) close(m.inertia[i][j], e.I[i][j], 1e-7); }
}
function refused(edit, code) {
  const doc = document(edit), before = structuredClone(doc);
  assert.throws(() => evaluateCadPart(doc), e => e instanceof CadPartError && e.feature === 'wrap' && e.code === code);
  assert.deepEqual(doc, before);
}

test('cylindrical wrap: public feature owns one nine-face reference and audits independent asymmetric mass at each density', () => {
  const doc = document(), before = structuredClone(doc), snapshot = evaluateCadPart(doc), [out] = snapshot.outputs;
  assert.equal(snapshot.outputs.length, 1); assert.equal(out.brep.faces.length, 9); assert.equal(out.bodyCount, 1); assert.equal(checkOutput(out).valid, true);
  assert.deepEqual(snapshot.features.at(-1).dependencies, ['post']); assert.equal(out.cylindricalWrap.authority, 'closed-original-radial-reference');
  assert.equal(out.cylindricalWrap.literalStoredBrepMass, false); assert.equal(out.cylindricalWrap.literalStoredBrepClosureCertified, false); assert.equal(out.cylindricalWrap.nativeSIAccuracy, false);
  for (const density of [1, 7.85]) matches(out, density);
  assert.deepEqual(doc, before); doc.features[2].rectangle.u[0] = 0.2; doc.features[1].from = 0;
  matches(out, 7.85); assert.ok(Object.isFrozen(out.brep)); assert.ok(Object.isFrozen(out.cylindricalWrap.rectangle.u));
  for (const density of [0, -1, NaN, Infinity]) assert.throws(() => massPropertiesOf(out, density), e => e instanceof CadPartError && e.code === 'INPUT');
});

test('cylindrical wrap: document save/load and reevaluation restore owned provider; output copies supply no mass authority', () => {
  const snapshot = evaluateCadPart(document()), [out] = snapshot.outputs, text = saveCadPart(snapshot), loaded = loadCadPart(text);
  assert.deepEqual(loaded.document, snapshot.document); assert.deepEqual(loaded.outputs[0].brep, out.brep); matches(loaded.outputs[0], 7.85);
  matches(reevaluate(snapshot, { parameters: {} }).outputs[0], 7.85);
  for (const copy of [{ ...out }, structuredClone(out), JSON.parse(JSON.stringify(out)), { ...out, cylindricalWrap: undefined }]) {
    assert.throws(() => massPropertiesOf(copy, 1), e => e instanceof CadPartError && e.code === 'CAPABILITY' && /live evaluated provider/.test(e.message));
  }
  assert.equal(saveCadPart(snapshot), text);
});

test('cylindrical wrap: native face and strict UV bounds refuse atomically without remapping', () => {
  refused({ faces: ['post.side0#1'] }, 'CAPABILITY'); refused({ faces: ['post.top'] }, 'CAPABILITY'); refused({ faces: ['absent'] }, 'REFERENCE');
  for (const faces of [[], ['post.side0#2', 'post.side0#1'], ['post.side0+post.side1']]) refused({ faces }, 'INPUT');
  for (const rectangle of [{ u: [0, 0.4], v: [0.2, 0.7] }, { u: [0.1, 0.5], v: [0.2, 0.7] }, { u: [0.4, 0.1], v: [0.2, 0.7] }, { u: [0.1, 0.4], v: [0, 0.7] }]) refused({ rectangle }, 'PARAMETER');
  refused({ height: 9 }, 'CAPABILITY'); refused({ rectangle: { u: [NaN, 0.4], v: [0.2, 0.7] } }, 'INPUT');
  refused({ expect: { 'post.side0#2': { kind: 'plane', at: [0, 0, 0], dir: [0, 0, 1], size: 1 } } }, 'REFERENCE_MOVED');
  for (const downstream of [{ kind: 'translate', offset: [1, 0, 0] }, { kind: 'scale', factor: 2 }, { kind: 'union', tool: 'post' }]) {
    const doc = document(); doc.features.push({ id: 'next', target: 'wrap', ...downstream }); const before = structuredClone(doc);
    assert.throws(() => evaluateCadPart(doc), e => e instanceof CadPartError && e.feature === 'next' && e.code === 'CAPABILITY'); assert.deepEqual(doc, before);
  }
});

test('cylindrical wrap: shared public facade writes the same bounded recipe and preserves typed refusal', () => {
  const original = part('wrap').cylinder({ r: 10, h: 30, z: -7 }), before = original.doc;
  const wrap = original.cylindricalWrap(b => b.faces().curved().where(f => f.centroid[1] > 0), { u0: 0.1, u1: 0.4, v0: 0.2, v1: 0.7, height: 10 });
  assert.equal(wrap.doc.features.at(-1).kind, 'cylindrical-wrap'); close(wrap.mass({ density: 7.85 }).volume, oracle(7.85).V); assert.deepEqual(original.doc, before);
  assert.equal(part('loaded', wrap.doc).mass({ density: 7.85 }).mass, wrap.mass({ density: 7.85 }).mass);
  assert.throws(() => original.cylindricalWrap(b => b.faces().curved(), { u0: 0.1, u1: 0.4, v0: 0.2, v1: 0.7, height: 10 }), e => e instanceof BarocssError && e.code === 'SELECTION_ONE');
  assert.throws(() => original.cylindricalWrap(b => b.faces().curved().where(f => f.centroid[1] < 0), { u0: 0.1, u1: 0.4, v0: 0.2, v1: 0.7, height: 10 }), e => e instanceof BarocssError && e.code === 'CAPABILITY');
});

test('cylindrical wrap: actual display triangles retain the strict outer trim, source hole and outward side orientation', () => {
  const [out] = evaluateCadPart(document()).outputs, mesh = tessellateBrep(out.brep, { segmentsPerQuarter: 24 });
  const byId = new Map(out.brep.faces.map(f => [f.id, f])), a = angle(bounds.u[0]), b = angle(bounds.u[1]), z1 = -1, z2 = 14;
  const seen = new Set();
  for (const span of mesh.faces) {
    const face = byId.get(span.faceId), name = face.name; seen.add(name);
    assert.ok(span.indexCount > 0, name);
    for (let i = span.indexOffset; i < span.indexOffset + span.indexCount; i += 3) {
      const points = [0, 1, 2].map(k => Array.from(mesh.positions.slice(3 * mesh.indices[i + k], 3 * mesh.indices[i + k] + 3)));
      const c = [0, 1, 2].map(k => (points[0][k] + points[1][k] + points[2][k]) / 3), theta = Math.atan2(c[1], c[0]);
      const u = points[1].map((x, k) => x - points[0][k]), v = points[2].map((x, k) => x - points[0][k]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (Math.hypot(...n) < 1e-14) continue;
      let outward;
      if (name === 'wrap.outer.c0') {
        for (const p of points) { const t = Math.atan2(p[1], p[0]); assert.ok(t >= a - 1e-12 && t <= b + 1e-12, `outer angle ${t}`); assert.ok(p[2] >= z1 - 1e-12 && p[2] <= z2 + 1e-12, `outer Z ${p[2]}`); close(Math.hypot(p[0], p[1]), 20, 1e-10); }
        outward = n[0] * c[0] + n[1] * c[1];
      } else if (name === 'post.side0#2') {
        assert.ok(!(theta > a + 1e-6 && theta < b - 1e-6 && c[2] > z1 + 1e-6 && c[2] < z2 - 1e-6), 'source triangle covers pad hole');
        outward = n[0] * c[0] + n[1] * c[1];
      } else if (name === 'post.side0#1') outward = n[0] * c[0] + n[1] * c[1];
      else if (name === 'post.top') outward = n[2];
      else if (name === 'post.bottom') outward = -n[2];
      else if (name === 'wrap.side.c0.r0.e0') outward = -n[2];
      else if (name === 'wrap.side.c0.r0.e1') outward = -Math.sin(b) * n[0] + Math.cos(b) * n[1];
      else if (name === 'wrap.side.c0.r0.e2') outward = n[2];
      else if (name === 'wrap.side.c0.r0.e3') outward = Math.sin(a) * n[0] - Math.cos(a) * n[1];
      else assert.fail(`unqualified face ${name}`);
      assert.ok(outward > 0, `inward display triangle on ${name}: ${outward}`);
    }
  }
  assert.equal(seen.size, 9);
});


test('cylindrical wrap: public MMGS data is unchanged while native SI authority stays unavailable at both density branches', () => {
  const [out] = evaluateCadPart(document()).outputs;
  const solid = prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: -7, tag: 'post' });
  const source = { solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) };
  const components = [{ outer: [[0.1, 0.2], [0.4, 0.2], [0.4, 0.7], [0.1, 0.7]], holes: [] }];
  const budgets = { volume: 1e-8, mass: 1e-10, centroid: [1e-10, 1e-10, 1e-10], inertia: [1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7] };
  for (const density of [1, 7.85]) {
    const reference = buildCylindricalWrapClosedReference(source, components, { id: 'wrap', height: 10, density, budgets });
    const actual = massPropertiesOf(out, density);
    assert.deepEqual(actual, reference.mass.properties, 'all MMGS values and metadata retain the private audited values');
    assert.notEqual(actual, reference.mass.properties);
    assert.equal(readNativeSIInertia(reference.mass.properties).ok, true, 'private entry behavior remains unchanged');
    for (let i = 0; i < 2; i++) assert.deepEqual(readNativeSIInertia(actual), { ok: false, code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE', reason: 'combined' });
    assert.equal(readNativeSIInertia(reference.mass.properties).ok, true, 'public lookup does not change private provenance');
  }
});
