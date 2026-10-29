import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { openImportedFile } from '../src/files/importedFile';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((r, fail) => { resolve = r; reject = fail; });
  return { promise, resolve, reject };
}
/** Real import routing with deferred file and worker transports; no browser or kernel proof. */
function harness() {
  let current = true;
  const events: string[] = [];
  const worker = {
    engine: {
      async stepMeshes() { events.push('stepMeshes'); return null; },
      async diagnose() { events.push('diagnose'); return { error: 'bad mesh' }; },
      async part() { events.push('part'); return { ok: false, error: { detail: 'bad STEP' } }; },
    },
    nextRevision() { return 1; },
  };
  const options = {
    doc: emptyDoc(), worker,
    ownership: { isCurrent: () => current },
    mesh: { setStage(value: unknown) { events.push(`stage:${value}`); }, setMeshAsk() { events.push('meshAsk'); }, setRepairAsk() { events.push('repairAsk'); } },
    changes: { onOpened() { events.push('opened'); return true; }, commitDirect() { events.push('commit'); return false; }, fitLater() { events.push('fit'); } },
    onNotice() { events.push('notice'); },
  };
  return { events, worker, options: options as unknown as Parameters<typeof openImportedFile>[1], invalidate() { current = false; } };
}

test('STL read completion cannot show a question or error after a newer intent', async () => {
  const h = harness(), bytes = deferred<ArrayBuffer>();
  const file = { name: 'old.stl', arrayBuffer: () => bytes.promise } as File;
  const pending = openImportedFile(file, h.options);
  h.invalidate(); bytes.resolve(new ArrayBuffer(0)); await pending;
  assert.deepEqual(h.events, []);
});

test('DWG header completion cannot replace a newer notice', async () => {
  const h = harness(), bytes = deferred<ArrayBuffer>();
  const file = { name: 'old.dwg', slice: () => ({ arrayBuffer: () => bytes.promise }) } as File;
  const pending = openImportedFile(file, h.options);
  h.invalidate(); bytes.resolve(new TextEncoder().encode('AC1027').buffer); await pending;
  assert.deepEqual(h.events, []);
});

test('STEP file read cannot start a worker after Stop or a newer intent', async () => {
  const h = harness(), text = deferred<string>();
  const pending = openImportedFile({ name: 'old.step', text: () => text.promise } as File, h.options);
  h.invalidate(); text.resolve('ISO-10303-21;'); await pending;
  assert.deepEqual(h.events, []);
});

test('STEP mesh reply cannot clear a newer stage or start a part read', async () => {
  const h = harness(), meshes = deferred<null>();
  h.worker.engine.stepMeshes = () => meshes.promise;
  const pending = openImportedFile({ name: 'old.step', text: async () => 'ISO-10303-21;' } as File, h.options);
  await Promise.resolve();
  assert.deepEqual(h.events, ['stage:reading the file']);
  h.invalidate(); meshes.resolve(null); await pending;
  assert.deepEqual(h.events, ['stage:reading the file']);
});

test('STEP part failure cannot replace a newer notice', async () => {
  const h = harness(), read = deferred<{ ok: false; error: { detail: string } }>();
  const entered = deferred<void>();
  h.worker.engine.part = () => { entered.resolve(); return read.promise; };
  const pending = openImportedFile({ name: 'old.step', text: async () => 'ISO-10303-21;' } as File, h.options);
  await entered.promise;
  const before = [...h.events]; h.invalidate();
  read.resolve({ ok: false, error: { detail: 'old failure' } }); await pending;
  assert.deepEqual(h.events, before);
});

const source = '@model line { version: 0; length-unit: mm; @curve #edge { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[0,0,0],[10,0,0]]; weights: [1,1]; } }';

for (const extension of ['barocad', 'iges']) {
  test(`${extension} file completion cannot commit or fit after a newer intent`, async () => {
    const h = harness(), text = deferred<string>(), entered = deferred<void>();
    const pending = openImportedFile({ name: `old.${extension}`, text: () => { entered.resolve(); return text.promise; } } as File, h.options);
    await entered.promise; h.invalidate(); text.resolve(source); await pending;
    assert.deepEqual(h.events, []);
  });

  test(`${extension} commit refusal does not show success or fit`, async () => {
    const h = harness();
    const module = await import('@barocss/cad-model/engine/direct');
    const content = extension === 'iges' ? module.directIGES(module.importSource(module.emptyDirect(), source, 'line')) : source;
    await openImportedFile({ name: `current.${extension}`, text: async () => content } as File, h.options);
    assert.deepEqual(h.events, ['commit']);
  });

  test(`${extension} accepted commit keeps its success and fit sequence`, async () => {
    const h = harness();
    const module = await import('@barocss/cad-model/engine/direct');
    const content = extension === 'iges' ? module.directIGES(module.importSource(module.emptyDirect(), source, 'line')) : source;
    h.options.changes.commitDirect = () => { h.events.push('commit'); h.invalidate(); return true; };
    await openImportedFile({ name: `current.${extension}`, text: async () => content } as File, h.options);
    assert.deepEqual(h.events, extension === 'iges' ? ['commit', 'notice', 'fit'] : ['commit', 'fit']);
  });
}

test('current OBJ still offers its unit question', async () => {
  const h = harness(), bytes = new TextEncoder().encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  await openImportedFile({ name: 'current.obj', arrayBuffer: async () => bytes.buffer } as File, h.options);
  assert.deepEqual(h.events, ['meshAsk']);
});

test('current STEP read failure remains visible', async () => {
  const h = harness();
  await openImportedFile({ name: 'current.step', text: async () => 'ISO-10303-21;' } as File, h.options);
  assert.deepEqual(h.events, ['stage:reading the file', 'stepMeshes', 'stage:null', 'stage:reading the solids', 'part', 'stage:null', 'notice']);
});

test('STEP diagnosis reply cannot clear a newer stage or show an old repair question', async () => {
  const h = harness(), reply = deferred<{ error: string }>(), entered = deferred<void>();
  h.options.worker.engine.stepMeshes = async () => [{ name: 'old', positions: new Float64Array([0, 0, 0]), indices: new Uint32Array() }];
  h.options.worker.engine.diagnose = () => { entered.resolve(); return reply.promise; };
  const pending = openImportedFile({ name: 'old.step', text: async () => 'ISO-10303-21;' } as File, h.options);
  await entered.promise; const before = [...h.events]; h.invalidate();
  reply.resolve({ error: 'old failure' }); await pending;
  assert.deepEqual(h.events, before);
});

test('rejected STEP file reads cannot show an old error after Stop', async () => {
  const h = harness(), text = deferred<string>();
  const pending = openImportedFile({ name: 'old.step', text: () => text.promise } as File, h.options);
  h.invalidate(); text.reject(new Error('old file failure')); await pending;
  assert.deepEqual(h.events, []);
});

test('current STEP file rejection clears its stage and shows an error', async () => {
  const h = harness();
  await openImportedFile({ name: 'current.step', text: async () => { throw new Error('current file failure'); } } as unknown as File, h.options);
  assert.deepEqual(h.events, ['stage:null', 'notice']);
});

test('current STEP acceptance can change ownership before the success notice', async () => {
  const h = harness();
  h.options.worker.engine.part = async (_doc, revision) => ({ ok: true, revision, wallTime: 0, bodies: [] });
  h.options.changes.onOpened = () => { h.events.push('opened'); h.invalidate(); return true; };
  await openImportedFile({ name: 'current.step', text: async () => 'ISO-10303-21;' } as File, h.options);
  assert.deepEqual(h.events.slice(-2), ['opened', 'notice']);
});

test('refused STEP acceptance cannot show a success notice', async () => {
  const h = harness();
  h.options.worker.engine.part = async (_doc, revision) => ({ ok: true, revision, wallTime: 0, bodies: [] });
  h.options.changes.onOpened = () => { h.events.push('refused'); return false; };
  await openImportedFile({ name: 'current.step', text: async () => 'ISO-10303-21;' } as File, h.options);
  assert.equal(h.events.at(-1), 'refused'); assert.equal(h.events.includes('notice'), false);
});
