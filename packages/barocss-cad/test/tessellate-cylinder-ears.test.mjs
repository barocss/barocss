import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateCadPart, tessellateBrep } from '../dist/index.js';

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const circle = (id, r) => ({ id, kind: 'sketch', profile: 'circle', center: [0, 0], radius: r });
/** Mesh edges (by position) not used exactly twice, body by body. */
function openEdges(brep, mesh) {
  const bodyOf = new Map(brep.faces.map(f => [f.id, brep.shells.find(s => s.id === f.shell).body])), uses = new Map(), P = mesh.positionsMM;
  const key = i => `${P[3 * i]},${P[3 * i + 1]},${P[3 * i + 2]}`;
  for (const f of mesh.faces) for (let t = f.indexOffset; t < f.indexOffset + f.indexCount; t += 3) for (let e = 0; e < 3; e++) {
    const k = `${bodyOf.get(f.faceId)} ${[key(mesh.indices[t + e]), key(mesh.indices[t + (e + 1) % 3])].sort().join(' ')}`;
    uses.set(k, (uses.get(k) ?? 0) + 1);
  }
  return [...uses.values()].filter(n => n !== 2).length;
}

test('tessellation: a cylinder face keeps no triangle whose corners all lie on one smooth run of its boundary (D193)', () => {
  // (Such a triangle lies in the run's plane where the run is planar, and the planar neighbour has it too: the mesh had
  // it twice and its chords four times. L4 fuzz 5: a cylinder less a closed shell tilted 182.8° about Y; 118: two crossed
  // cylinders; the notch tees of D182, a branch coped with a V or a hole saw, their cut split into many edges.)
  const five = D([circle('cs', 2.5), { id: 'cb', kind: 'extrude', sketch: 'cs', height: 6 }, { id: 'c', kind: 'translate', target: 'cb', offset: [1.5, 0, 0] },
    { id: 'bs', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [7.741, 7.004] }, { id: 'bb', kind: 'extrude', sketch: 'bs', height: 3.445 },
    { id: 'bh', kind: 'shell', target: 'bb', thickness: 0.256, open: [] }, { id: 'br0', kind: 'rotate', target: 'bh', axis: 'y', angleDegrees: 278.779, pivot: [0, 0, 0] },
    { id: 'br1', kind: 'rotate', target: 'br0', axis: 'y', angleDegrees: 264.014, pivot: [0, 0, 0] }, { id: 'b', kind: 'translate', target: 'br1', offset: [0.105, 0.819, 2.315] },
    { id: 'r', kind: 'difference', target: 'c', tool: 'b' }]);
  const crossed = D([circle('as', 1.894), { id: 'ab', kind: 'extrude', sketch: 'as', height: 5.281 }, { id: 'ar0', kind: 'rotate', target: 'ab', axis: 'y', angleDegrees: 230.699, pivot: [0, 0, 0] },
    { id: 'ar1', kind: 'rotate', target: 'ar0', axis: 'x', angleDegrees: 196.211, pivot: [0, 0, 0] }, { id: 'a', kind: 'translate', target: 'ar1', offset: [0.027, 2.038, 2.441] },
    circle('cs', 1.465), { id: 'cb', kind: 'extrude', sketch: 'cs', height: 2.223 }, { id: 'c', kind: 'translate', target: 'cb', offset: [1.418, -0.382, 1.519] },
    { id: 'r', kind: 'intersect', target: 'a', tool: 'c' }]);
  for (const [name, doc] of [['fuzz 5', five], ['fuzz 118', crossed]]) {
    const brep = evaluateCadPart(doc).output('r').brep;
    assert.equal(openEdges(brep, tessellateBrep(brep, { segmentsPerQuarter: 8 })), 0, name);
  }
  for (const name of ['notch-v-tee', 'notch-holesaw-tee']) {
    const doc = JSON.parse(readFileSync(join(import.meta.dirname, `../conformance/frk/${name}.json`), 'utf8')).input.partDocument;
    for (const o of evaluateCadPart(doc).outputs) assert.equal(openEdges(o.brep, tessellateBrep(o.brep, { segmentsPerQuarter: 8 })), 0, `${name} ${o.id}`);
  }
});
