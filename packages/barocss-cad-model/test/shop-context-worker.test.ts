import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { WireSender } from '../src/engine/wireDoc';
import type { EvalResult } from '../src/engine/evaluate';
import { evaluatePart } from '../src/engine/evaluate';
import { resolveShopRows, provenanceOfTree } from '../src/engine/shopRows';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { MeshReceiver } from '../src/engine/meshWire';

test('A9-8 production worker preserves inherited origins and refreshes parent row geometry', { timeout: 30000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'shop-context-worker-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { build } = createRequire(resolve(import.meta.dirname, '../../../package.json'))('esbuild') as typeof import('esbuild');
  await build({ entryPoints: [resolve(import.meta.dirname, '../../../apps/cad-studio/src/engine/engine.worker.ts')], outfile: join(dir, 'production.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning' });
  await writeFile(join(dir, 'adapter.mjs'), `import {parentPort} from 'node:worker_threads';
globalThis.self={postMessage:(v,transfer)=>parentPort.postMessage(v,transfer)};
await import('./production.mjs');
parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});`);
  const worker = new Worker(join(dir, 'adapter.mjs')); t.after(() => worker.terminate());
  const [ready] = await once(worker, 'message'); assert.deepEqual(ready, { ready: true });
  const child = withNode(emptyDoc(), { kind: 'frame-member', section: { kind: 'library', id: 'R' }, start: [0, 0, 0], end: [100, 0, 0] });
  const parent = (width: number): StudioDoc => ({ ...emptyDoc(), frames: { version: 1, sections: [{ id: 'R', source: 'User test drawing', section: { kind: 'rect-tube', width, height: 40, wall: 3, outerRadius: 0 } }] } });
  const sender = new WireSender(), receiver = new MeshReceiver(); let id = 0;
  const volumes: (number | null)[] = [];
  for (const width of [40, 50]) {
    const view = resolveShopRows(child, parent(width)).doc, native = evaluatePart(view, 1); assert.ok(native.ok);
    const response = once(worker, 'message');
    worker.postMessage({ type: 'part', id: ++id, revision: id, slot: 'read', doc: sender.pack(view) });
    const [reply] = await response as [{ id: number; result: Parameters<MeshReceiver['unpack']>[1] }];
    assert.equal(reply.id, id); const result: EvalResult = receiver.unpack('read', reply.result); assert.ok(result.ok);
    assert.deepEqual(result.shopRows, provenanceOfTree(view)); assert.deepEqual(result.shopRows, native.shopRows);
    assert.equal(result.bodies[0].volumeMM3, native.bodies[0].volumeMM3); volumes.push(result.bodies[0].volumeMM3);
    assert.equal(result.shopRows?.[0].rows[0].origin, 'inherited');
  }
  assert.notEqual(volumes[0], volumes[1]); assert.equal(child.frames, undefined);
});
