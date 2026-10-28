import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep, evaluateSurface, surfaceDomain, springDimensions } from '@barocss/cad';
import { part } from '../src/api';
import { partBreps } from '../src/engine/evaluate';

// Exact original Docs public call; this is a regression candidate, not a runtime result.
test('public spring: original closed-ground Docs input keeps one closed body and both ground planes', () => {
  const base = part('spring'), before = base.doc;
  const input = { type: 'compression', d: 2.5, D: 18, n: 5, p: 6, ends: 'closed-ground', hand: 'right' };
  const inputBefore = structuredClone(input), spring = base.spring(input), doc = spring.doc;
  const node = doc.nodes.at(-1); assert.ok(node && node.kind === 'spring');
  assert.equal(node.wire, 2.5); assert.equal(node.diameter, 18); assert.equal(node.activeCoils, 5);
  assert.equal(node.pitch, 6); assert.equal(node.ends, 'closed-ground'); assert.equal(node.hand, 'right');
  assert.deepEqual(node.center, [0, 16]); assert.equal(node.generator, 'spring@0');
  assert.equal(spring.bodies().length, 1);
  const breps = partBreps(doc); assert.equal(breps.length, 1); const brep = breps[0].brep;
  const report = checkBrep(brep); assert.equal(report.valid, true, report.issues.join('; '));
  assert.equal(report.topology.length, 1); assert.equal(report.topology[0].genus, 0);
  assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'solid');
  assert.equal(brep.bodies[0].shells.length, 1); assert.equal(brep.shells.length, 1); assert.equal(brep.shells[0].closed, true);
  assert.equal(new Set(brep.faces.map(f => f.name)).size, brep.faces.length);
  const freeLength = springDimensions({ wireDiameter: 2.5, meanDiameter: 18, activeCoils: 5, pitch: 6, ends: 'closed-ground', hand: 'right' }).freeLength;
  for (const [suffix, z] of [['ground0', 0], ['ground1', freeLength]] as const) {
    const faces = brep.faces.filter(f => f.name?.endsWith(`.${suffix}`)); assert.equal(faces.length, 1);
    const face = faces[0]; assert.ok(face.surface.kind !== 'facets'); const domain = surfaceDomain(face.surface);
    for (const u of domain.u) for (const v of domain.v) {
      const point = evaluateSurface(face.surface, u, v); assert.ok(point.every(Number.isFinite));
      assert.ok(Math.abs(point[2] - z) <= 1e-9, 'reuse the original ground-plane height tolerance');
    }
    assert.ok(face.loops.length > 0, 'the ground face has a topological boundary');
  }
  assert.deepEqual(input, inputBefore); assert.deepEqual(base.doc, before); assert.deepEqual(spring.doc, doc);
  // Default BRep topology only: no strict edge/surface certification, mass oracle or manufacturing validation claim.
});
