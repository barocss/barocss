import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { forgetMeshNotes } from '../src/engine/bodyNotes';
import type { ModelNode, StudioDoc } from '../src/engine/doc';

// D240: a worm pair's check (~0.5 s) is kept by the pair as placed. The oracle: with the notes kept, an evaluation's notes
// are those of one from nothing (every line, the check's own time included, as first computed); a change to the pair is
// checked again (its notes as from nothing); and the kept check costs almost nothing.
const pair: StudioDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, outputs: { b0: { node: 0, side: 'solid' }, b1: { node: 1, side: 'solid' } },
  nodes: [{ kind: 'gear', module: 2.972490504132897, helixAngle: 7.765166018425334, hand: 'right', teeth: 30, faceWidth: 20, bore: 20, center: [0, 16], generator: 'spur-gear@0', id: 'n0' },
    { kind: 'worm', starts: 2, form: 'ZI', length: 66, bore: 12, mesh: { gear: 0 }, generator: 'worm@0', id: 'n1' }] as unknown as ModelNode[] } as StudioDoc;
let revision = 1;
const notes = (doc: StudioDoc) => { const e = evaluateDoc(doc, revision++); assert.ok(e.ok, e.ok ? '' : e.error.title); return JSON.stringify(e.bodies.map(b => b.notes)); };
const timeless = (s: string) => s.replace(/checked in \d+ ms/g, 'checked in N ms');

test('D240: a worm pair\'s check kept by the pair — notes as from nothing; a changed pair checked again', () => {
  forgetMeshNotes(); const fresh = notes(pair);
  assert.match(fresh, /Meshes with .*checked in \d+ ms/);
  const t = performance.now(), again = notes(pair), ms = performance.now() - t;
  assert.equal(again, fresh, 'kept: the very notes, the check\'s time included');
  assert.ok(ms < 300, `the evaluation that keeps it: ${ms.toFixed(0)} ms`);
  const longer = { ...pair, nodes: pair.nodes.map((n, i) => i === 1 ? { ...n, length: 70 } as ModelNode : n) };
  const changed = notes(longer); forgetMeshNotes();
  assert.equal(timeless(changed), timeless(notes(longer)), 'a changed pair: its notes as from nothing');
  assert.notEqual(changed, fresh);
});
