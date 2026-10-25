// P2 inherited facade contracts: compare document writes with the core, and display changes with known geometry.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { part, assembly, Location, BarocssError } from '../src/api';
import { bodiesOf } from '../src/api/core';
import { addLibraryPartToBody } from '../src/library/libraries';
import { runOutputTool } from '../src/chat/outputs';
import { evaluateDoc } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 0);

test('libraryPart writes the core document and keeps warnings without mutating its source', () => {
  const p = part('floor').box({ w: 30, d: 20, h: 2 }), before = JSON.stringify(p.doc);
  const body = bodiesOf(p.doc)[0], face = p.select().faces().facing('+z').names()[0];
  const options = { variant: 'M3', params: { h: 5 } };
  const raw = addLibraryPartToBody(p.doc, 'enclosure', 'pcb-standoff', options, { body: body.ref!, face, point: [10, 10, 2], normal: [0, 0, 1] });
  assert.ok(!('error' in raw), JSON.stringify(raw));
  if ('error' in raw) return;
  const next = p.libraryPart('enclosure', 'pcb-standoff', { ...options, face: b => b.faces().facing('+z'), point: [10, 10, 2] });
  assert.equal(JSON.stringify(next.doc), JSON.stringify(raw.doc));
  assert.deepEqual(next.libraryWarnings(), raw.node.warnings.map(warning => ({ part: raw.node.name, warning })));
  assert.equal(JSON.stringify(p.doc), before);
  assert.throws(() => p.libraryPart('enclosure', 'pcb-standoff', { face: b => b.faces(), point: [10, 10, 2] }), e => e instanceof BarocssError && e.code === 'SELECTION_ONE');
});

test('the injection finish and pull stay in plain document data; an invalid finish is typed', () => {
  const p = part().box({ w: 10, d: 10, h: 2 });
  const next = p.process('injection', { pull: [0, 0, 1], finish: 'smooth' });
  assert.deepEqual(next.doc.mould, { version: 1, pull: [0, 0, 1], finish: 'smooth' });
  assert.equal(p.doc.mould, undefined);
  assert.throws(() => p.process('injection', { finish: 'absent-finish' }), e => e instanceof BarocssError && e.code === 'VALUE');
});

test('explode moves display geometry only; clearance matches the core output', async () => {
  const a = assembly('two-boxes', part().box({ w: 10, d: 10, h: 2 }))
    .addPart('cover', part().box({ w: 10, d: 10, h: 2 }), { at: Location.of({ position: [0, 0, 3] }) });
  const before = JSON.stringify(a.doc), closed = a.meshes(), exploded = a.meshes({ explode: 1 });
  assert.deepEqual(closed.map(m => m.key), exploded.map(m => m.key));
  assert.deepEqual(closed[0].positions, exploded[0].positions);
  assert.notDeepEqual(closed[1].positions, exploded[1].positions);
  assert.equal(JSON.stringify(a.doc), before);
  assert.throws(() => a.meshes({ explode: -1 }), e => e instanceof BarocssError && e.code === 'VALUE');
  // The output includes elapsed times and a digest of those bytes. Fix the measurement clock for both calls
  // so the entire payload, including the exported file, has a byte-for-byte oracle. This is not a latency test.
  const clock = mock.method(performance, 'now', () => 0);
  try {
    const raw = await runOutputTool(a.doc, bodiesOf(a.doc), 'output_clearance', { near: 2 }, evaluate);
    assert.ok(!('error' in raw), JSON.stringify(raw));
    if ('error' in raw) return;
    assert.deepEqual(await a.clearance({ near: 2 }), raw.content);
  } finally { clock.mock.restore(); }
});
