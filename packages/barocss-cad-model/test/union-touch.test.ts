import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';

/** Two 10 mm cubes, the second at (x, y, z), then their union. */
function pair(x: number, y: number, z: number): StudioDoc {
  let d = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] });
  d = withNode(d, { kind: 'extrude', sketch: 0, height: 10 });
  d = withNode(d, { kind: 'sketch', profile: 'rectangle', min: [x, y], max: [x + 10, y + 10] });
  d = withNode(d, { kind: 'extrude', sketch: 2, height: 10, ...(z ? { from: z } : {}) });
  return withNode(d, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
}

test('union: bodies touching only along an edge or at a point stay two bodies in one result, as bodies apart do; face to face they unite', () => {
  // (Refused before the kernel's D204, a limit of the kernel: now its result holds the two lumps, each a body of its own.)
  for (const [x, y, z] of [[10, 10, 0], [10, 10, 10], [10, 10, 5]]) {
    const r = evaluateDoc(pair(x, y, z), 1); assert.ok(r.ok, `${[x, y, z]}: ${!r.ok && r.error.detail}`);
    assert.equal(r.bodies.length, 1, `${[x, y, z]}`);
    assert.ok(Math.abs(r.bodies[0].volume! - 2000) < 1e-6, `${[x, y, z]}: ${r.bodies[0].volume}`);
  }
  const apart = evaluateDoc(pair(20, 0, 0), 1); assert.ok(apart.ok && Math.abs(apart.bodies.reduce((v, b) => v + b.volume!, 0) - 2000) < 1e-6);
  const faces = evaluateDoc(pair(10, 0, 0), 1); assert.ok(faces.ok && faces.bodies.length === 1 && Math.abs(faces.bodies[0].volume! - 2000) < 1e-6);
});
