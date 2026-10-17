import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { runTool, type ChatState } from '../src/chat/tools';
import { readStudioDoc } from '../src/engine/migrate';
import { captureSignatures, refreshSignatures, verifyReferences } from '../src/engine/references';

// Stored references with their signatures (A1.3b): written with the reference, refreshed only by an accepted
// edit, verified on open by the one matcher.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function bodiesOf(doc: StudioDoc) { const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;

test('signatures: written with a reference from the bodies it was picked on; a re-matched one is not refreshed', async () => {
  const box = rectanglePart(10, 10, 5), bodies = await bodiesOf(box);
  const doc: StudioDoc = { ...box, mates: [{ id: 'm1', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p', face: 'origin:xy' } }] };
  const signed = captureSignatures(doc, bodies);
  assert.deepEqual(signed.mates![0].a.sig, { k: 'plane', p: [0, 0, 5], d: [0, 0, 1], s: 0 }, 'from the part’s face table');
  assert.equal(captureSignatures(signed, bodies), signed, 'nothing to write: the same document');
  // Marked re-matched (`was`): left alone by a refresh, so a wrong guess keeps its evidence.
  const marked: StudioDoc = { ...signed, mates: [{ ...signed.mates![0], a: { ...signed.mates![0].a, face: 'n1.bottom', was: 'n1.top' } }] };
  const refreshed = await refreshSignatures(marked, bodies, evaluate);
  assert.deepEqual(refreshed.mates![0].a.sig, signed.mates![0].a.sig);
  // A fillet written by an agent's command gets its edge's signature too.
  const s: ChatState = { doc: box, bodies };
  const r = await runTool(s, 'run_command', { command: 'fillet', edges: [{ between: [{ feature: 1, role: 'top' }, { normal: [1, 0, 0] }] }], values: { radius: 1 } }, evaluate);
  assert.ok(!r.isError, r.content);
  const fillet = r.state.doc.nodes.at(-1) as { edges: string[]; sigs?: Record<string, { k: string }> };
  assert.equal(fillet.sigs?.[fillet.edges[0]]?.k, 'line');
});

// The A1.3b conformance cases (conformance/a1, those with "verify").
const a1 = join(process.cwd(), 'conformance', 'a1');
for (const file of readdirSync(a1).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(join(a1, file), 'utf8'));
  if (!c.input.verify) continue;
  test(`conformance ${c.id}: ${c.about}`, async () => {
    const read = readStudioDoc(JSON.stringify(c.input.file)); assert.ok('doc' in read);
    let doc = read.doc;
    if (c.input.edit) {
      const r = await runTool({ doc, bodies: await bodiesOf(doc) }, 'edit_feature', c.input.edit, evaluate);
      assert.ok(!r.isError, r.content); doc = r.state.doc;
      doc = (readStudioDoc(JSON.stringify(doc)) as { doc: StudioDoc }).doc; // saved and reopened
    }
    const v = await verifyReferences(doc, await bodiesOf(doc), evaluate);
    assert.deepEqual(v.changes, c.expect.changes);
    assert.deepEqual(v.problems.map(p => ({ where: p.where, name: p.name, candidates: p.candidates })), c.expect.problems ?? []);
    for (const [i, why] of Object.entries(c.expect.held ?? {})) assert.deepEqual([v.doc.nodes[Number(i)].suppressed, v.doc.nodes[Number(i)].held], [true, why]);
    if (c.expect.volumeMM3 !== undefined) { const bodies = await bodiesOf(v.doc); assert.ok(Math.abs(bodies.reduce((a, b) => a + b.volumeMM3!, 0) - c.expect.volumeMM3) < 1e-6, 'the rest builds'); }
    if (c.expect.mates) assert.deepEqual(v.doc.mates!.map(m => ({ face: m.a.face, ...(m.a.was ? { was: m.a.was } : {}) })), c.expect.mates);
  });
}
