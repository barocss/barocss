import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_REPAIR, type MeshDiagnosis, type MeshRepairResult } from '@barocss/cad';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { EngineClient } from '../src/engine/client';
import { createMeshImportController, type MeshImportOptions, type RepairQuestion } from '../src/files/meshImportController';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0], indices = [0, 1, 2];
const diagnosis: MeshDiagnosis = { triangles: 1, vertices: 3, welded: 0, degenerate: 0, duplicates: 0, nonManifoldEdges: 0, inconsistentEdges: 0, holes: [], pieces: 1, pieceVolumes: [1], floaters: 0, selfIntersections: 0, selfIntersectionAt: [], closed: true };
const result: MeshRepairResult = { positions: Float64Array.from(positions), indices: Uint32Array.from(indices), fill: Int32Array.from([-1]), report: { welded: 0, degenerateRemoved: 0, duplicatesRemoved: 0, finsRemoved: 0, finTriangles: 0, flipped: 0, holesFilled: 0, fillTriangles: 0, largestFilledPerimeter: 0, filledArea: 0, holesLeft: 0, floatersRemoved: 0, floaterVolume: 0, nonManifoldEdgesLeft: 0, selfIntersections: 0, closed: true } };
const body: BodyResult = { key: 'b0', family: 'planar', volume: 1, mass: 1, mesh: { positions: new Float32Array(), normals: new Float32Array(), faceOfVertex: new Float32Array(), indices: new Uint32Array(), faces: [], edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), edges: [], bounds: { min: [0, 0, 0], max: [1, 1, 0] } } };
function harness() {
  let scope = {}, session = 0;
  const notices: string[] = [], opened: StudioDoc[] = [], commits: StudioDoc[] = [];
  const engine = {
    diagnose: (async () => diagnosis) as EngineClient['diagnose'],
    repair: (async () => result) as EngineClient['repair'],
    part: (async () => ({ ok: true, revision: 1, wallTime: 0, bodies: [body] })) as EngineClient['part'],
    restart() { session++; },
  };
  const options: MeshImportOptions = {
    doc: emptyDoc(), engine: engine as unknown as EngineClient, nextRevision: () => 1,
    captureOwner() { const owned = scope, worker = session; return { isCurrent: () => owned === scope && worker === session }; },
    onStop() { scope = {}; engine.restart(); }, onNotice(notice) { notices.push(notice.title); },
    onOpened(doc) { opened.push(doc); scope = {}; return true; }, onCommit(doc) { commits.push(doc); scope = {}; return true; },
  };
  const controller = createMeshImportController(() => options);
  return { controller, options, engine, notices, opened, commits, invalidate() { scope = {}; },
    mesh(name = 'A') { controller.setMeshAsk({ name, format: 'STL', mesh: { positions, indices }, unit: 'mm' }); },
    repair(name = 'A', mode: 'import' | 'edit' = 'import') {
      const question: RepairQuestion = { mode, node: mode === 'edit' ? 0 : undefined, name, unit: 'mm', positions, indices, diagnosis, steps: DEFAULT_REPAIR, result: null };
      controller.setRepairAsk(question);
    },
  };
}

test('current unit question reaches the real blob and part pipeline', async () => {
  const h = harness(); h.mesh(); await h.controller.openMesh();
  assert.equal(h.opened.length, 1); assert.equal(h.opened[0].nodes[0].kind, 'mesh');
  assert.deepEqual(h.notices, ['STL opened']); assert.equal(h.controller.stage, null);
});

test('a second unit question keeps its state when the first diagnosis completes', async () => {
  const h = harness(), reply = deferred<MeshDiagnosis>();
  h.engine.diagnose = () => reply.promise; h.mesh();
  const pending = h.controller.openMesh(); h.mesh('B');
  reply.resolve(diagnosis); await pending;
  assert.equal(h.controller.meshAsk?.name, 'B'); assert.equal(h.opened.length, 0); assert.deepEqual(h.notices, []);
});

test('changing units revokes the diagnosis for the previous unit', async () => {
  const h = harness(), reply = deferred<MeshDiagnosis>();
  h.engine.diagnose = () => reply.promise; h.mesh();
  const pending = h.controller.openMesh(); h.controller.setMeshAsk(value => value && { ...value, unit: 'cm' });
  reply.resolve(diagnosis); await pending;
  assert.equal(h.controller.meshAsk?.unit, 'cm'); assert.equal(h.opened.length, 0);
});

test('repair progress and result cannot write into a newer repair question', async () => {
  const h = harness(), reply = deferred<MeshRepairResult>(); let progress!: (stage: string) => void;
  h.engine.repair = (_p, _i, _s, notify) => { progress = notify!; return reply.promise; };
  h.repair(); const pending = h.controller.checkRepair(); h.repair('B');
  progress('fill'); reply.resolve(result); await pending;
  assert.equal(h.controller.stage, null); assert.equal(h.controller.repairAsk?.name, 'B'); assert.equal(h.controller.repairAsk?.result, null);
});

test('changing repair steps revokes the old check without losing the new steps', async () => {
  const h = harness(), reply = deferred<MeshRepairResult>();
  h.engine.repair = () => reply.promise; h.repair();
  const pending = h.controller.checkRepair();
  h.controller.setRepairAsk(value => value && { ...value, steps: { ...value.steps, fill: false }, result: null });
  reply.resolve(result); await pending;
  assert.equal(h.controller.repairAsk?.steps.fill, false); assert.equal(h.controller.repairAsk?.result, null);
});

test('Stop revokes progress before restart and keeps the question ready for a new check', async () => {
  const h = harness(), reply = deferred<MeshRepairResult>(); let progress!: (stage: string) => void;
  h.engine.repair = (_p, _i, _s, notify) => { progress = notify!; return reply.promise; };
  h.repair(); const pending = h.controller.checkRepair();
  h.controller.stopStage(); progress('fill'); reply.resolve(result); await pending;
  assert.equal(h.controller.stage, null); assert.equal(h.controller.repairAsk?.result, null); assert.deepEqual(h.notices, ['Stopped']);
  h.engine.repair = async () => result; await h.controller.checkRepair();
  assert.equal(h.controller.repairAsk?.result, result);
});

test('Cancel revokes a pending diagnosis and a later worker error', async () => {
  const h = harness(), reply = deferred<MeshDiagnosis | { error: string }>();
  h.engine.diagnose = () => reply.promise; h.mesh();
  const pending = h.controller.openMesh(); h.controller.setMeshAsk(null);
  reply.resolve({ error: 'old failure' }); await pending;
  assert.equal(h.controller.meshAsk, null); assert.equal(h.controller.stage, null); assert.deepEqual(h.notices, []);
});

test('a document replacement hides old questions and revokes a pending part read', async () => {
  const h = harness(), reply = deferred<Awaited<ReturnType<EngineClient['part']>>>(), entered = deferred<void>();
  h.engine.part = () => { entered.resolve(); return reply.promise; }; h.mesh();
  const pending = h.controller.openMesh(); await entered.promise; h.invalidate();
  reply.resolve({ ok: false, revision: 1, wallTime: 0, error: { title: 'Old failure', hint: '', detail: 'old failure' } }); await pending;
  assert.equal(h.controller.meshAsk, null); assert.equal(h.controller.stage, null); assert.equal(h.opened.length, 0); assert.deepEqual(h.notices, []);
});

test('Stop during blob hashing cannot start a part read in the restarted worker', async () => {
  const h = harness(), release = deferred<void>(), entered = deferred<void>();
  const original = crypto.subtle.digest.bind(crypto.subtle);
  let reads = 0;
  h.engine.part = async () => { reads++; return { ok: false, revision: 1, wallTime: 0, error: { title: '', hint: '', detail: '' } }; };
  crypto.subtle.digest = async (...args: Parameters<SubtleCrypto['digest']>) => { entered.resolve(); await release.promise; return original(...args); };
  try {
    const pending = h.controller.openMeshNode({ name: 'A', unit: 'mm', positions, indices, diagnosis });
    await entered.promise; h.controller.stopStage(); release.resolve(); await pending;
    assert.equal(reads, 0); assert.deepEqual(h.notices, ['Stopped']); assert.equal(h.controller.stage, null);
  } finally { crypto.subtle.digest = original; }
});

test('current worker errors remain visible and leave the question ready to retry', async () => {
  const h = harness(); h.engine.diagnose = async () => ({ error: 'bad mesh' }); h.mesh();
  await h.controller.openMesh();
  assert.deepEqual(h.notices, ['Could not read this mesh']); assert.equal(h.controller.meshAsk?.name, 'A'); assert.equal(h.opened.length, 0);
});

test('controller cleanup revokes pending work and permits a fresh retry', async () => {
  const h = harness(), reply = deferred<MeshDiagnosis>();
  h.engine.diagnose = () => reply.promise; h.mesh();
  const pending = h.controller.openMesh(); h.controller.invalidate(); reply.resolve(diagnosis); await pending;
  assert.equal(h.opened.length, 0); assert.deepEqual(h.notices, []);
  h.engine.diagnose = async () => diagnosis; h.mesh('B'); await h.controller.openMesh();
  assert.equal(h.opened.length, 1); assert.deepEqual(h.notices, ['STL opened']);
});

test('a refused mesh acceptance does not report success', async () => {
  const h = harness(); h.options.onOpened = () => false; h.mesh();
  await h.controller.openMesh();
  assert.equal(h.opened.length, 0); assert.deepEqual(h.notices, []);
});

test('an edit repair cannot commit after its document changes during blob hashing', async () => {
  const h = harness(), release = deferred<void>(), entered = deferred<void>();
  h.options.doc = { ...emptyDoc(), nodes: [{ kind: 'mesh', name: 'A', unit: 'mm', representation: 'facets', positions, indices }] };
  h.repair('A', 'edit'); h.controller.setRepairAsk(value => value && { ...value, result });
  const original = crypto.subtle.digest.bind(crypto.subtle);
  crypto.subtle.digest = async (...args: Parameters<SubtleCrypto['digest']>) => { entered.resolve(); await release.promise; return original(...args); };
  try {
    const pending = h.controller.applyRepair(); await entered.promise; h.invalidate(); release.resolve(); await pending;
    assert.equal(h.commits.length, 0); assert.equal(h.controller.repairAsk, null); assert.deepEqual(h.notices, []);
  } finally { crypto.subtle.digest = original; }
});
