import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { gearMoments } from './helpers/gear-moments';

const FROZEN = resolve(import.meta.dirname, '../../barocss-cad/conformance/rm/urdf-gears');
const numberRE = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

test('D168 URDF gears: exactly eight approved scalars; every unapproved byte retains its prior hash', () => {
  const pin = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/robot-frozen-gears-boundary.json'), 'utf8')) as {
    afterSha256: string; unapprovedBytesSha256: string; numericTokens: number;
    changes: { token: number; before: number; after: number }[];
  };
  const text = readFileSync(resolve(FROZEN, 'robot.urdf'), 'utf8'), tokens = text.match(numberRE)!;
  assert.equal(pin.changes.length, 8); assert.equal(tokens.length, pin.numericTokens);
  const indices = new Set(pin.changes.map(c => c.token)); assert.equal(indices.size, 8);
  let index = 0;
  const masked = text.replace(numberRE, s => indices.has(index++) ? '#' : s);
  assert.equal(hash(masked), pin.unapprovedBytesSha256, 'all bytes outside the eight approved token positions');
  for (const c of pin.changes) { assert.notEqual(c.before, c.after); assert.equal(Number(tokens[c.token]), c.after, `token ${c.token}`); }
  assert.equal(hash(text), pin.afterSha256, 'the exact approved output');
});

test('D168 gear area, mass, centroid and all nine moments agree with independent 2D boundary integration at existing 1e-12 scale', () => {
  const doc = JSON.parse(readFileSync(resolve(FROZEN, 'robot.bcad'), 'utf8')) as StudioDoc;
  for (const part of ['g1', 'g2']) {
    const input = doc.instances!.find(i => i.id === part)!.doc, n = input.nodes[0];
    assert.equal(input.nodes.length, 1); assert.ok(n.kind === 'gear');
    assert.deepEqual([n.module, n.faceWidth, n.bore, n.generator, n.center], [2, 8, 8, 'spur-gear@0', [0, 0]]);
    assert.ok(n.teeth === 20 || n.teeth === 30);
    assert.equal(input.bodies, undefined); assert.equal(input.brief?.material, undefined, 'existing default aluminium density');
    const expected = gearMoments(n.teeth, 48), lower = gearMoments(n.teeth, 32), scale = Math.max(...expected.inertia.map(Math.abs));
    assert.ok(Math.abs(lower.volume - expected.volume) <= expected.volume * 1e-12, `${part} reference area convergence`);
    assert.ok(lower.inertia.every((v, k) => Math.abs(v - expected.inertia[k]) <= scale * 1e-12), `${part} reference tensor convergence`);
    const e = evaluatePart(input, 1); assert.ok(e.ok && e.bodies.length === 1);
    const b = e.bodies[0]; assert.ok(b.volume !== null && b.centroid && b.inertia);
    assert.ok(Math.abs(b.volume - expected.volume) <= expected.volume * 1e-12, `${part} volume/area`);
    assert.ok(Math.abs(b.volume * 2.7e-6 - expected.mass) <= expected.mass * 1e-12, `${part} mass`);
    assert.ok(b.centroid.every((v, k) => Math.abs(v - expected.centreMM[k]) <= 8 * 1e-12), `${part} centroid`);
    assert.ok(b.inertia.flat().every((v, k) => Math.abs(v - expected.inertia[k]) <= scale * 1e-12), `${part} inertia`);
  }
});
