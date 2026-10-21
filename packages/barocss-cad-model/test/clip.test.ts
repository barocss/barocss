import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { rectanglePart, withNode } from '../src/engine/doc';
import { clipMesh } from '../src/engine/clip';
import type { DisplayMesh } from '../src/engine/mesh';

/** A closed mesh's volume (divergence theorem) and whether every edge has two triangles. */
const volume = (m: DisplayMesh) => { let v = 0; const P = m.positions, I = m.indices; for (let t = 0; t < I.length; t += 3) { const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map(i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; } return v; };

test('clipMesh: a plate with a hole cut across each axis keeps its side, capped (the hole a hole in the cap)', () => {
  const doc = withNode(rectanglePart(32, 32, 16), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [16, 16], radius: 5 });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const m = r.bodies[0].mesh, full = volume(m);
  assert.ok(Math.abs(full - (32 * 32 * 16 - Math.PI * 25 * 16)) < 30, String(full));
  for (const [k, at] of [[2, 8], [0, 16], [1, 16]] as const) for (const keep of ['negative', 'positive'] as const) {
    const c = clipMesh(m, k, at, keep, 'n9.cut');
    assert.ok(c, `${k} ${keep}`);
    const cap = c.faces.at(-1)!;
    assert.equal(cap.name, 'n9.cut'); assert.equal(cap.normal[k], keep === 'negative' ? 1 : -1);
    // Half the plate, closed by its cap (the volume is only right when the cap closes it, facing out).
    assert.ok(Math.abs(volume(c) - full / 2) < 1e-3 * full, `${k} ${keep}: ${volume(c)} vs ${full / 2}`);
    const holeArea = k === 2 ? Math.PI * 25 : 10 * 16;
    assert.ok(Math.abs(cap.areaMM2 - ((k === 2 ? 32 * 32 : 32 * 16) - holeArea)) < 2, `${k}: cap ${cap.areaMM2}`);
  }
  assert.equal(clipMesh(m, 2, 20, 'negative', 'x'), m, 'wholly on the kept side');
  assert.equal(clipMesh(m, 2, -1, 'negative', 'x'), null, 'wholly beyond');
});
