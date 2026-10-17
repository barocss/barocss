import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { runTool, type ChatState } from '../src/chat/tools';
import { readStudioDoc } from '../src/engine/migrate';

// Re-matching stored names after an edit renumbers the faces they come from (A1.3).
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
/** A 10 × 10 × 6 prism on a polygon, its corner at (10, 10) filleted r 2 (the edge named as the kernel names it). */
async function filleted(): Promise<ChatState> {
  let doc = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: square }), { kind: 'extrude', sketch: 0, height: 6 });
  const s = await stateOf(doc), corner = s.bodies[0].mesh.edges.find(e => e.straight && Math.abs(e.a[0] - 10) < 1e-9 && Math.abs(e.a[1] - 10) < 1e-9)!;
  doc = withNode(doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [corner.names[0]], radius: 2 });
  return stateOf(doc);
}
const rightCorner = 10 * 10 * 6 - (1 - Math.PI / 4) * 4 * 6;

test('rematch: a corner inserted before the filleted one renumbers the sides; the fillet follows its corner and says so', async () => {
  const s = await filleted(), was = (s.doc.nodes[2] as { edges: string[] }).edges[0];
  assert.ok(Math.abs(s.bodies[0].volumeMM3! - rightCorner) < 1e-6);
  // A new vertex below the bottom edge: side k is now side k + 1, and the old name names the corner at (10, 0).
  const r = await runTool(s, 'edit_feature', { index: 0, feature: { kind: 'sketch', profile: 'polygon', points: [[0, 0], [5, -2], [10, 0], [10, 10], [0, 10]] } }, evaluate);
  assert.ok(!r.isError, r.content);
  const out = parse(r.content), fillet = r.state.doc.nodes[2] as ModelNode & { edges: string[] };
  assert.deepEqual(out.rematched, [{ feature: 2, was, now: fillet.edges[0] }]);
  assert.notEqual(fillet.edges[0], was);
  assert.deepEqual(fillet.rematched, { [fillet.edges[0]]: was }, 'kept on the node until confirmed');
  // The right corner: the prism grew by the triangle below (10 × 2 / 2 × 6), the fillet still takes (1 − π/4) r² h.
  assert.ok(Math.abs(r.state.bodies[0].volumeMM3! - (rightCorner + 10 * 6)) < 1e-6, String(r.state.bodies[0].volumeMM3));
});

test('rematch: a dimension changed keeps every name (no guessing), and a corner gone into two alike is refused with both', async () => {
  const s = await filleted();
  let r = await runTool(s, 'edit_feature', { index: 0, feature: { kind: 'sketch', profile: 'polygon', points: [[0, 0], [12, 0], [12, 10], [0, 10]] } }, evaluate);
  assert.ok(!r.isError, r.content); assert.equal(parse(r.content).rematched, undefined);
  assert.deepEqual((r.state.doc.nodes[2] as { edges: string[] }).edges, (s.doc.nodes[2] as { edges: string[] }).edges);
  // The corner cut off: two vertical edges, at (10, 8) and (8, 10), as near the old one.
  r = await runTool(s, 'edit_feature', { index: 0, feature: { kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 0], [10, 8], [8, 10], [0, 10]] } }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /is now one of n1\.side\d\|n1\.side\d, n1\.side\d\|n1\.side\d; name the one you mean/);
});

// The A1.3 conformance cases (conformance/a1, those with "edit"): a document, an edit_feature call, and the
// stored names and volume that must come out (or the refusal).
const a1 = join(process.cwd(), 'conformance', 'a1');
for (const file of readdirSync(a1).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(join(a1, file), 'utf8'));
  if (!c.input.edit) continue;
  test(`conformance ${c.id}: ${c.about}`, async () => {
    const read = readStudioDoc(JSON.stringify(c.input.file)); assert.ok('doc' in read);
    const r = await runTool(await stateOf(read.doc), 'edit_feature', c.input.edit, evaluate);
    if (c.expect.error) { assert.ok(r.isError); assert.ok(parse(r.content).error.includes(c.expect.error), parse(r.content).error); return; }
    assert.ok(!r.isError, r.content);
    for (const [i, names] of Object.entries(c.expect.names)) assert.deepEqual((r.state.doc.nodes[Number(i)] as { edges: string[] }).edges, names);
    assert.deepEqual(parse(r.content).rematched ?? [], c.expect.rematched);
    const v = r.state.bodies.reduce((a, b) => a + b.volumeMM3!, 0);
    assert.ok(Math.abs(v - c.expect.volumeMM3) <= 1e-6 * c.expect.volumeMM3, `${v} vs ${c.expect.volumeMM3}`);
  });
}
