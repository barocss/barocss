import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { cylinderPart, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { WireSender } from '../src/engine/wireDoc';
import { drawingDocument } from '../src/drawing/scope';
import { defaultDrawing, VIEW_IDS, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import type { DrawingResult } from '../src/drawing/project';

// The production App handler runs unchanged in a Node worker. Only the Web Worker message surface is adapted.
// Each request follows DrawingWorkspace's scoped document -> wire -> drawing handler route. This is not browser proof.
test('production drawing worker isolates base and local part sheets while assembly retains placed part prefixes', { timeout: 30000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'drawing-scope-worker-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { build } = createRequire(resolve(import.meta.dirname, '../../../package.json'))('esbuild') as typeof import('esbuild');
  await build({ entryPoints: [resolve(import.meta.dirname, '../../../apps/cad-studio/src/engine/engine.worker.ts')], outfile: join(dir, 'production.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning' });
  await writeFile(join(dir, 'adapter.mjs'), `import {parentPort} from 'node:worker_threads';
globalThis.self={postMessage:(v,transfer)=>parentPort.postMessage(v,transfer)};
await import('./production.mjs');
parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});`);
  const worker = new Worker(join(dir, 'adapter.mjs')); t.after(() => worker.terminate());
  const [ready] = await once(worker, 'message'); assert.deepEqual(ready, { ready: true });
  const sender = new WireSender(); let id = 0;
  const request = async (doc: StudioDoc, settings: DrawingSettings = defaultDrawing()): Promise<DrawingViews> => {
    const input = sender.pack(drawingDocument(doc, settings));
    const response = once(worker, 'message'), requestId = ++id;
    worker.postMessage({ type: 'drawing', id: requestId, doc: input });
    const [reply] = await response as [{ id: number; drawing: DrawingResult }];
    assert.equal(reply.id, requestId); assert.ok(reply.drawing.ok, JSON.stringify(reply.drawing));
    return reply.drawing.views;
  };
  const base = rectanglePart(120, 80, 8), cover = cylinderPart(30, 12), shaft = cylinderPart(10, 180);
  const assembly: StudioDoc = { ...base, instances: [
    { id: 'cover', name: 'Cover', doc: cover, position: [500, -300, 200], rotation: [15, 35, 70] },
    { id: 'shaft', name: 'Shaft', doc: shaft, position: [-400, 700, -250], rotation: [80, -20, 25] },
  ] };
  const moved: StudioDoc = { ...assembly, instances: assembly.instances!.map(p => ({ ...p,
    position: p.id === 'cover' ? [-900, 1500, 600] : [2000, -1000, 800],
    rotation: p.id === 'cover' ? [90, 45, -30] : [-15, 70, 130],
    ...(p.id === 'shaft' ? { doc: cylinderPart(22, 260) } : {}),
  })) };
  const baseOnly = await request(base), implicit = await request(assembly);
  assert.deepEqual(implicit, baseOnly, 'default base has exactly the base-only projection bounds and edges');
  assert.deepEqual([implicit.front.min, implicit.front.max], [[0, 0], [120, 8]]);
  assert.deepEqual([implicit.top.min, implicit.top.max], [[0, 0], [120, 80]]);
  assert.deepEqual(await request(moved), baseOnly, 'moving and resizing instances cannot change the base sheet');
  for (const [part, local, diameter] of [['cover', cover, 60], ['shaft', shaft, 20]] as const) {
    const settings: DrawingSettings = { ...defaultDrawing(), scope: { kind: 'part', part } };
    const actual = await request(assembly, settings), own = await request(local);
    assert.deepEqual(actual, own, `${part} sheet is its own local geometry, including exact edges`);
    // Projection bounds sample curved silhouettes; circles below carry the exact radius.
    for (const v of actual.top.min) assert.ok(Math.abs(v + diameter / 2) < 1e-3, `${part} min ${JSON.stringify(actual.top.min)} diameter ${diameter}`);
    for (const v of actual.top.max) assert.ok(Math.abs(v - diameter / 2) < 1e-3);
    assert.ok(actual.top.edges.some(e => e.circle && Math.abs(e.circle.radius * 2 - diameter) < 1e-8));
    const placementOnly = { ...moved, instances: moved.instances!.map(p => p.id === part ? { ...p, doc: local } : p) };
    assert.deepEqual(await request(placementOnly, settings), own, `${part} ignores its placement and other instance changes`);
    for (const view of VIEW_IDS) assert.ok(actual[view].edges.every(e => !e.name.startsWith('cover/') && !e.name.startsWith('shaft/')));
  }
  const all = await request(assembly, { ...defaultDrawing(), scope: { kind: 'assembly' } });
  const names = VIEW_IDS.flatMap(v => all[v].edges.map(e => e.name));
  assert.ok(names.some(n => n.startsWith('cover/')), 'assembly preserves cover identity');
  assert.ok(names.some(n => n.startsWith('shaft/')), 'assembly preserves shaft identity');
  assert.ok(names.some(n => !n.includes('/')), 'assembly keeps base identity');
  assert.ok(all.front.max[0] - all.front.min[0] > 600, 'assembly includes the widely placed geometry');
  assert.notDeepEqual(all, baseOnly);
  const changed = await request(moved, { ...defaultDrawing(), scope: { kind: 'assembly' } });
  assert.notDeepEqual(changed.front.min, all.front.min, 'assembly follows instance placement changes');
  assert.throws(() => drawingDocument(assembly, { ...defaultDrawing(), scope: { kind: 'part', part: 'missing' } }), /\[DRAWING_SCOPE\] no part missing/);
});
