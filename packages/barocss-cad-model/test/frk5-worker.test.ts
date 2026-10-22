// FRk5 source-only preparation. Native/Model validation and browser permission are separate gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { dispatchTool } from '../src/chat/tools';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { WireSender } from '../src/engine/wireDoc';
import { MeshReceiver, type WireResult } from '../src/engine/meshWire';

// Production worker code is bundled unchanged. Node supplies only the browser Worker's message surface.
test('FRk5 production worker preserves corner gaps and notch bodies across mesh reuse, Save/Open and edits', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'frk5-worker-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { build } = createRequire(resolve(import.meta.dirname, '../../../package.json'))('esbuild') as typeof import('esbuild');
  await build({ entryPoints: [resolve(import.meta.dirname, '../../../apps/cad-studio/src/engine/engine.worker.ts')], outfile: join(dir, 'production.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning' });
  await writeFile(join(dir, 'adapter.mjs'), `import {parentPort} from 'node:worker_threads';
globalThis.self={postMessage:(v,transfer)=>parentPort.postMessage(v,transfer)};
await import('./production.mjs');
parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});`);
  const worker = new Worker(join(dir, 'adapter.mjs')); t.after(() => worker.terminate()); await once(worker, 'message');
  const sender = new WireSender(), receiver = new MeshReceiver(); let id = 0;
  const request = async (doc: StudioDoc) => {
    const next = once(worker, 'message'); worker.postMessage({ id: ++id, revision: id, type: 'evaluate', doc: sender.pack(doc) });
    const [reply] = await next as [{ id: number; result: WireResult }]; assert.equal(reply.id, id); assert.ok(reply.result.ok, JSON.stringify(reply.result));
    const result = receiver.unpack('evaluate', reply.result); assert.ok(result.ok); return { wire: reply.result, bodies: result.bodies };
  };
  const section = { kind: 'round-tube', diameter: 30, wall: 2 };
  const base = { kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400]], segments: [[0, 1], [2, 3]], section };
  const variants = [
    { label: 'gap', corners: { tee: 'butt', gap: 2 }, key: 'gap', next: 3 },
    { label: 'holesaw', corners: { at: [{ point: 3, kind: 'cope', through: 0, notch: { kind: 'holesaw', diameter: 52, offset: 3 } }] }, key: 'corner3.notchDiameter', next: 56 },
    { label: 'v', corners: { at: [{ point: 3, kind: 'cope', through: 0, notch: { kind: 'v', depth: 20, angle: 90 } }] }, key: 'corner3.notchDepth', next: 22 },
  ];
  for (const variant of variants) {
    const made = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'add', features: [{ ...base, section: variant.label === 'gap' ? { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 } : section, corners: variant.corners }] }, async doc => evaluateDoc(doc, 1));
    assert.equal(made.isError, false, `${variant.label}: ${made.content}`);
    const opened = await readStudioFile(encodeStudioFile(made.state.doc)); assert.ok('doc' in opened); assert.deepEqual(opened.doc.nodes, made.state.doc.nodes);
    const direct = evaluateDoc(opened.doc, 1); assert.ok(direct.ok);
    const first = await request(opened.doc), again = await request(opened.doc);
    assert.ok(again.wire.bodies.every(b => 'meshRef' in b), 'unchanged actual worker cache reuses meshes');
    const facts = (bodies: typeof direct.bodies) => bodies.map(b => ({ key: b.key, volume: b.volumeMM3, centroid: b.centroid, inertia: b.inertia, piece: b.cutPiece, element: b.element }));
    assert.deepEqual(facts(first.bodies), facts(direct.bodies)); assert.deepEqual(facts(again.bodies), facts(direct.bodies));
    assert.equal(first.bodies.length, 2); assert.ok(first.bodies.every(b => (b.pieces ?? 1) === 1));
    const edited = await dispatchTool({ doc: opened.doc, bodies: direct.bodies }, 'features', { action: 'edit', index: 0, values: { [variant.key]: variant.next } }, async doc => evaluateDoc(doc, 1));
    assert.equal(edited.isError, false, edited.content); const after = await request(edited.state.doc);
    assert.notEqual(after.bodies[1].volumeMM3, first.bodies[1].volumeMM3, 'actual branch geometry changes');
    assert.deepEqual(after.bodies[1].cutPiece, edited.state.bodies[1].cutPiece, 'worker retains new end metadata');
    assert.deepEqual(facts([after.bodies[0]]), facts([first.bodies[0]]), 'through member survives unchanged');
  }
});
