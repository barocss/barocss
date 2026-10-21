import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshReceiver, MeshSender } from '../src/engine/meshWire';
import { evaluateDoc, evaluatePart, evaluateVolumes, shareMeshes, type BodyResult, type EvalResult } from '../src/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import type { DisplayMesh } from '../src/engine/mesh';

// PERF3 B12 (D82): evaluation replies carry only the meshes the client does not hold; the client puts back the rest.
const mesh = (n: number): DisplayMesh => ({ positions: new Float32Array(3 * n).fill(n), normals: new Float32Array(3 * n), faceOfVertex: new Float32Array(n), indices: new Uint32Array(3), faces: [], edgeLines: new Float32Array(6), edgeOfSegment: new Float32Array(2), edges: [], bounds: { min: [0, 0, 0], max: [1, 1, 1] } } as unknown as DisplayMesh);
const result = (...meshes: DisplayMesh[]): EvalResult => ({ ok: true, revision: 1, ms: 0, bodies: meshes.map((m, i) => ({ key: `b${i}`, mesh: m, volumeMM3: i, massG: null } as never)) });
const bytes = (t: readonly unknown[]) => t.reduce((n: number, b) => n + (b as ArrayBuffer).byteLength, 0);

test('B12 protocol: a mesh sent once in a slot goes back as a token; the client gives the same mesh back; slots apart; a refusal forgets the slot; a token not held is an error', () => {
  const send = new MeshSender(), get = new MeshReceiver(), A = mesh(10), B = mesh(20), C = mesh(30);
  let out = send.pack('evaluate', result(A, B));
  assert.equal(out.transfer.length, 12);
  const r1 = get.unpack('evaluate', out.result);
  assert.ok(r1.ok && r1.bodies[0].mesh.positions[0] === 10 && r1.bodies[1].mesh.positions.length === 60);
  // (The kept meshes are not given away: the reply holds copies.)
  assert.equal(A.positions.length, 30);
  // The same A again, B gone, C new: A by token only.
  out = send.pack('evaluate', result(A, C));
  assert.equal(bytes(out.transfer), bytes(send.pack('other', result(C)).transfer));
  const r2 = get.unpack('evaluate', out.result);
  assert.ok(r2.ok && r1.ok && r2.bodies[0].mesh === r1.bodies[0].mesh && r2.bodies[1].mesh.positions[0] === 30);
  // One mesh twice in one reply: sent once.
  out = send.pack('evaluate', result(C, C));
  assert.equal(out.transfer.length, 0);
  const r3 = get.unpack('evaluate', out.result);
  assert.ok(r3.ok && r2.ok && r3.bodies[0].mesh === r2.bodies[1].mesh && r3.bodies[1].mesh === r3.bodies[0].mesh);
  // Another slot knows none of them.
  out = send.pack('part:check', result(A));
  assert.equal(out.transfer.length, 6);
  get.unpack('part:check', out.result);
  // Only the last reply's meshes are held: A left 'evaluate' with the reply before, so it is sent again.
  out = send.pack('evaluate', result(A));
  assert.equal(out.transfer.length, 6);
  get.unpack('evaluate', out.result);
  // A refusal empties the slot on both sides.
  const fail: EvalResult = { ok: false, revision: 2, ms: 0, error: { title: 'x', hint: '', detail: '' } as never };
  get.unpack('evaluate', send.pack('evaluate', fail).result);
  out = send.pack('evaluate', result(A));
  assert.equal(out.transfer.length, 6);
  // A receiver out of step says so rather than guessing.
  const fresh = new MeshReceiver(), again = send.pack('evaluate', result(A));
  assert.throws(() => fresh.unpack('evaluate', again.result), /does not hold/);
});

function plates(width: number): StudioDoc {
  let doc = rectanglePart(width, 40, 10);
  doc = withNode(doc, { kind: 'hole', parent: { node: doc.nodes.length - 1, side: 'solid' }, center: [10, 10], radius: 3 });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [0, 60], max: [30, 90] });
  return withNode(doc, { kind: 'extrude', sketch: doc.nodes.length - 1, height: 5 });
}

test('B12 through the worker\'s path: shared kept meshes, packed and unpacked, equal a plain evaluation every time; an edit to one body sends only that body\'s mesh', () => {
  const send = new MeshSender(), get = new MeshReceiver();
  const docs = [plates(100), plates(100), { ...plates(100), nodes: plates(100).nodes.map(n => n.kind === 'hole' ? { ...n, radius: 4 } : n) }];
  const plain = docs.map((d, k) => { shareMeshes(false); return evaluateDoc(d, k); });
  const sentBytes: number[] = [];
  try {
    shareMeshes(true);
    docs.forEach((d, k) => {
      const out = send.pack('evaluate', evaluateDoc(d, k)); sentBytes.push(bytes(out.transfer));
      const r = get.unpack('evaluate', out.result), p = plain[k];
      if (!r.ok || !p.ok) throw new Error('not evaluated');
      assert.equal(r.bodies.length, p.bodies.length);
      for (let i = 0; i < p.bodies.length; i++) {
        const a: BodyResult = r.bodies[i], b: BodyResult = p.bodies[i];
        assert.equal(a.key, b.key); assert.equal(a.volumeMM3, b.volumeMM3);
        for (const f of ['positions', 'normals', 'faceOfVertex', 'indices', 'edgeLines', 'edgeOfSegment'] as const) assert.deepEqual(Array.from(a.mesh[f]), Array.from(b.mesh[f]), `${k} ${i} ${f}`);
        assert.deepEqual(a.mesh.faces, b.mesh.faces);
      }
    });
  } finally { shareMeshes(false); }
  // The same part again: nothing sent; the hole made larger: only the plate's mesh (the box untouched).
  assert.equal(sentBytes[1], 0);
  assert.ok(sentBytes[2] > 0 && sentBytes[2] < sentBytes[0], String(sentBytes));
});

test('B12 slots and volumes: each purpose its own snapshot; a clash probe\'s volumes without meshes, the same as the full evaluation\'s', () => {
  const doc = plates(80), full = evaluatePart(doc, 1, 8, 'check'), v = evaluateVolumes(doc);
  assert.ok(full.ok && v.ok);
  assert.deepEqual(v.volumes, full.bodies.map(b => ({ key: b.key, volumeMM3: b.volumeMM3 })));
  // Two purposes taking turns each keep reusing their own features (the result the same either way).
  const other = plates(81), a = evaluatePart(other, 2, 8, 'agent'), b = evaluatePart(doc, 3, 8, 'check');
  assert.ok(a.ok && b.ok && b.bodies[0].volumeMM3 === full.bodies[0].volumeMM3);
});
