import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brepsFor, evaluateDoc, forgetPlacedOutputs, stepFor } from '../src/engine/evaluate';
import { readStudioFile } from '../src/engine/container';
import type { PartInstance, StudioDoc } from '../src/engine/doc';
import { emptyDoc } from '../src/engine/doc';
import { build } from '../src/rb9/core';

// R4 C4's rule (#2188 M1): a cache is checked against a full re-evaluation on the same fixtures. stepFor and brepsFor
// now build each placed copy through its last snapshot (the kernel's withDocument); here every export with the kept
// snapshots equals the export from nothing (forgetPlacedOutputs first) — after a copy is moved, turned or its part
// edited too — byte for byte.

const repo = resolve(import.meta.dirname, '../../..');
const json = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => ArrayBuffer.isView(x) ? Array.from(x as unknown as ArrayLike<number>) : x);
const body = (t: string) => t.replace(/FILE_NAME\([^;]*;/, '');
const read = async (f: string) => { const r = await readStudioFile(new Uint8Array(readFileSync(resolve(repo, f)))); assert.ok('doc' in r, f); return r.doc; };
function exports(doc: StudioDoc) { const s = stepFor(doc, 'p'); return json({ step: 'error' in s ? s : body(s.text), breps: brepsFor(doc), made: brepsFor(doc, { made: true }) }); }
function fromNothing(doc: StudioDoc) { forgetPlacedOutputs(); return exports(doc); }
const moved = (doc: StudioDoc, k: number, at: [number, number, number], turn: [number, number, number]): StudioDoc => ({ ...doc, instances: doc.instances!.map((i, j) => j === k ? { ...i, position: at, rotation: turn } : i) });

async function check(doc: StudioDoc, what: string) {
  evaluateDoc(doc, 1);
  const cold = fromNothing(doc);
  assert.equal(exports(doc), cold, `${what}: again, kept`);
  const m = moved(doc, 0, [7, -3, 11], [0, 0, 90]);
  const warm = exports(m);
  assert.equal(warm, fromNothing(m), `${what}: a copy moved and turned`);
  assert.equal(exports(doc), fromNothing(doc), `${what}: moved back`);
}

test('R4 C4: placed copies kept between exports — the clearance fixture, a 6R arm and fasteners as parts, as from nothing', async () => {
  for (const f of ['apps/cad-studio/test/fixtures/clearance-states.bcad', 'packages/barocss-cad/conformance/rm/arm-6r/robot.bcad', 'packages/barocss-cad-model/test/fixtures/o7-legacy/fasteners-instances.bcad']) await check(await read(f), f);
});

test('R4 C4: a placed weldment (its beads placed from the origin snapshot), kept and edited, as from nothing', async () => {
  const { calls } = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/frk-weldment-table.calls.json'), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  const table = (await build(calls)).doc;
  const own = evaluateDoc(table, 1);
  assert.ok(own.ok && own.bodies.some(b => b.notes?.some(n => /bead/i.test(n.text))), 'the weldment has beads, placed from the origin snapshot');
  const inst = (id: string, at: [number, number, number]): PartInstance => ({ id, name: id, doc: table, position: at, rotation: [0, 0, 0] });
  const doc: StudioDoc = { ...emptyDoc(), instances: [inst('t1', [0, 0, 0]), inst('t2', [900, 0, 0])] };
  await check(doc, 'weldment table');
  // (The copy's part edited: a member's section changed — rebuilt through the kept snapshot, the same as from nothing.)
  const edited = { ...table, frames: { ...(table.frames ?? {}), welds: [] } } as StudioDoc;
  const e: StudioDoc = { ...doc, instances: [doc.instances![0], { ...doc.instances![1], doc: edited }] };
  assert.equal(exports(e), fromNothing(e), 'a copy\'s part edited');
});
