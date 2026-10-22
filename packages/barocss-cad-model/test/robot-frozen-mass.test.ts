import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';

const LEGACY = resolve(import.meta.dirname, '../../barocss-cad/conformance/rm/arm-6r');

test('D168 frozen refresh changes only mass/inertia scalars: all geometry, mesh, units, joint and pose bytes stay equal', () => {
  const baseline = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/robot-frozen-boundary.json'), 'utf8')) as {
    files: Record<string, { nonInertialSha256: string; numericTokens: number; changes: { token: number; before: number; after: number }[] }>;
  };
  const patterns: Record<string, RegExp> = {
    'robot.xml': /\b(?:mass|fullinertia)="[^"]*"/g,
    'robot.sdf': /<(mass|ixx|iyy|izz)>[^<]*<\/(?:mass|ixx|iyy|izz)>/g,
    'robot.usda': /(?:float physics:mass|float3 physics:diagonalInertia) = [^\n]+/g,
  };
  const number = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
  for (const [file, fields] of Object.entries(patterns)) {
    const after = readFileSync(join(LEGACY, file), 'utf8'), pin = baseline.files[file];
    const mask = (s: string) => s.replace(fields, field => field.replace(number, '#'));
    assert.equal(createHash('sha256').update(mask(after)).digest('hex'), pin.nonInertialSha256, `${file}: all unapproved bytes retain the S0 baseline hash`);
    const a = after.match(number)!; assert.equal(a.length, pin.numericTokens);
    assert.equal(pin.changes.length, 24, `${file}: six link masses and 18 diagonal moments`);
    for (const c of pin.changes) { assert.notEqual(c.before, c.after); assert.equal(Number(a[c.token]), c.after, `${file} token ${c.token}`); }
  }
});

// An independent body-frame oracle: a box minus disjoint cylinders. No kernel mass feeds these values.
function oracle(base: boolean) {
  const rho = 2.7e-6, width = base ? 100 : 20, height = base ? 10 : 80;
  const boxMass = width * width * height * rho;
  let mass = boxMass;
  const I = [boxMass * (width ** 2 + height ** 2) / 12, boxMass * (width ** 2 + height ** 2) / 12, boxMass * (2 * width ** 2) / 12];
  const subtract = (axis: number, length: number, z: number) => {
    const m = Math.PI * 4 ** 2 * length * rho, axial = m * 4 ** 2 / 2, transverse = m * (3 * 4 ** 2 + length ** 2) / 12;
    mass -= m;
    for (let k = 0; k < 3; k++) I[k] -= (k === axis ? axial : transverse) + (k === 2 ? 0 : m * (z - height / 2) ** 2);
  };
  if (base) subtract(2, 10, 5);
  else { subtract(2, 8, 4); subtract(2, 8, 76); subtract(1, 20, 20); subtract(1, 20, 60); }
  return { mass, centre: [width / 2, width / 2, height / 2], inertia: [I[0] * 1e-6, 0, 0, 0, I[1] * 1e-6, 0, 0, 0, I[2] * 1e-6] };
}

test('D168 arm base and six links agree with independent disjoint-cylinder mass/centroid/inertia at 1e-12 scale', () => {
  const arm = JSON.parse(readFileSync(join(LEGACY, 'robot.bcad'), 'utf8')) as StudioDoc;
  for (const [id, doc] of [['base', arm], ...arm.instances!.map(i => [i.id, i.doc] as const)] as const) {
    const base = id === 'base', width = base ? 100 : 20, height = base ? 10 : 80, sk = doc.nodes[0], ext = doc.nodes[1];
    assert.ok(sk.kind === 'sketch' && sk.profile === 'rectangle' && ext.kind === 'extrude');
    assert.deepEqual([sk.min, sk.max, ext.height], [[0, 0], [width, width], height]);
    assert.equal(doc.bodies, undefined); assert.equal(doc.brief?.material, undefined, 'fixture uses the existing default aluminium density');
    const holes = doc.nodes.slice(2).map(n => { assert.ok(n.kind === 'hole'); return [n.radius, n.center, n.axis ?? 'z', n.side ?? 'max', n.depth ?? null]; });
    assert.deepEqual(holes, base ? [[4, [50, 50], 'z', 'max', null]] : [
      [4, [10, 10], 'z', 'max', 8], [4, [10, 10], 'z', 'min', 8], [4, [10, 20], 'y', 'max', null], [4, [10, 60], 'y', 'max', null],
    ]);
    // Blind cylinders occupy z=0..8 and 72..80; transverse ones occupy 16..24 and 56..64: disjoint.
    const expected = oracle(base), e = evaluatePart(doc, 1); assert.ok(e.ok && e.bodies.length === 1);
    const b = e.bodies[0]; assert.ok(b.centroid && b.inertia && b.volumeMM3 !== null);
    assert.ok(Math.abs(b.volumeMM3 * 2.7e-6 - expected.mass) <= expected.mass * 1e-12, `${id} mass`);
    assert.ok(b.centroid.every((v, k) => Math.abs(v - expected.centre[k]) <= height * 1e-12), `${id} centre`);
    const scale = Math.max(...expected.inertia.map(Math.abs));
    assert.ok(b.inertia.flat().every((v, k) => Math.abs(v - expected.inertia[k]) <= scale * 1e-12), `${id} inertia`);
  }
});
