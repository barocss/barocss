import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { emptyDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { dispatchTool } from '../src/chat/tools';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { WireSender } from '../src/engine/wireDoc';
import { MeshReceiver, type WireResult } from '../src/engine/meshWire';

// Real production handler, with Node providing only the Web Worker message surface.
// This checks structured clone, buffer transfer and caches; browser interaction is separate evidence.
test('FRk4 production worker preserves arcs and bends across mesh reuse, Save/Open and edits', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'frk4-worker-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { build } = createRequire(resolve(import.meta.dirname, '../../../package.json'))('esbuild') as typeof import('esbuild');
  await build({ entryPoints: [resolve(import.meta.dirname, '../../../apps/cad-studio/src/engine/engine.worker.ts')], outfile: join(dir, 'production.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning' });
  await writeFile(join(dir, 'adapter.mjs'), `import {parentPort} from 'node:worker_threads';
globalThis.self={postMessage:(v,transfer)=>parentPort.postMessage(v,transfer)};
await import('./production.mjs');
parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});`);
  const worker = new Worker(join(dir, 'adapter.mjs')); t.after(() => worker.terminate());
  await once(worker, 'message');
  const sender = new WireSender(), receiver = new MeshReceiver(); let id = 0;
  const request = async (doc: Parameters<typeof evaluateDoc>[0]) => {
    const next = once(worker, 'message'); worker.postMessage({ id: ++id, revision: id, type: 'evaluate', doc: sender.pack(doc) });
    const [reply] = await next as [{ id: number; result: WireResult }];
    assert.equal(reply.id, id); assert.ok(reply.result.ok, JSON.stringify(reply.result));
    const result = receiver.unpack('evaluate', reply.result); assert.ok(result.ok);
    return { wire: reply.result, bodies: result.bodies };
  };
  for (const path of ['centerarc', 'througharc', 'tangentbend']) {
    const made = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'command', command: 'frame-member', values: {
      path, section: 'round-tube', d: 20, t: 2, x0: 100, y0: 0, z0: 0, x1: 0, y1: 100, z1: 0,
      cx: 0, cy: 0, cz: 0, vx: Math.SQRT1_2 * 100, vy: Math.SQRT1_2 * 100, vz: 0,
      bx: 100, by: 100, bz: 0, radius: 30,
    } }, async doc => evaluateDoc(doc, 1));
    assert.equal(made.isError, false, made.content);
    const opened = await readStudioFile(encodeStudioFile(made.state.doc)); assert.ok('doc' in opened);
    assert.deepEqual(opened.doc.nodes, made.state.doc.nodes);
    const direct = evaluateDoc(opened.doc, 1); assert.ok(direct.ok);
    const first = await request(opened.doc), again = await request(opened.doc);
    assert.ok(first.wire.bodies.every(b => 'mesh' in b));
    assert.ok(again.wire.bodies.every(b => 'meshRef' in b));
    const facts = (bodies: typeof direct.bodies) => bodies.map(b => ({ key: b.key, volume: b.volume, centroid: b.centroid, inertia: b.inertia, piece: b.cutPiece }));
    assert.deepEqual(facts(first.bodies), facts(direct.bodies)); assert.deepEqual(facts(again.bodies), facts(direct.bodies));
    assert.equal(first.bodies.length, 1); assert.equal(first.bodies[0].pieces ?? 1, 1);
    assert.ok(first.bodies[0].cutPiece?.curve);
    const key = path === 'centerarc' ? 'arc0.center.z' : path === 'througharc' ? 'p2.z' : 'bend0.radius';
    const edited = await dispatchTool({ doc: opened.doc, bodies: direct.bodies }, 'features', { action: 'edit', index: 0, values: { [key]: path === 'tangentbend' ? 40 : 10 } }, async doc => evaluateDoc(doc, 1));
    assert.equal(edited.isError, false, edited.content);
    const after = await request(edited.state.doc);
    assert.notEqual(after.bodies[0].volume, first.bodies[0].volume);
    assert.deepEqual(after.bodies[0].cutPiece, edited.state.bodies[0].cutPiece);
  }
});
