// O19 (with the kernel's D277): a stored edge name is checked against what it named. A sketch without sideTags names
// its walls by position, so a vertex inserted upstream renumbers them and a fillet's stored `side1|side2` would round
// another corner, silently (the API lane measured the square's (10, 10) corner moving to (10, 0)). The fillet now
// passes its names' signatures (`sigs`) to the kernel as `expect`: a name on other geometry is refused, never built
// on; a dimension change that keeps the names still builds. Through the agent's tools, the moved name is matched
// again by its signature, as on open.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { captureSignatures } from '../src/engine/references';
import { runTool, type ChatState } from '../src/chat/tools';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return { doc, bodies: r.bodies }; }
const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
/** A 10 × 10 × 6 prism on a polygon, its corner at (10, 10) filleted r 2, the name's signature kept as it was picked. */
async function filleted(): Promise<ChatState> {
  let doc = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: square }), { kind: 'extrude', sketch: 0, height: 6 });
  const s = await stateOf(doc), corner = s.bodies[0].mesh.edges.find(e => e.straight && Math.abs(e.a[0] - 10) < 1e-9 && Math.abs(e.a[1] - 10) < 1e-9)!;
  doc = captureSignatures(withNode(doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [corner.names[0]], radius: 2 }), s.bodies);
  return stateOf(doc);
}
const sketched = (doc: StudioDoc, points: [number, number][]): StudioDoc => ({ ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...n, points } as ModelNode : n) });
const rightCorner = 10 * 10 * 6 - (1 - Math.PI / 4) * 4 * 6;

test('O19: the fillet carries its name\'s signature (sigs), written when it was picked', async () => {
  const s = await filleted(), f = s.doc.nodes[2] as { edges: string[]; sigs?: Record<string, unknown> };
  assert.ok(f.sigs && f.sigs[f.edges[0]], JSON.stringify(f));
  assert.ok(Math.abs(s.bodies[0].volumeMM3! - rightCorner) < 1e-6);
});

test('O19: a vertex inserted upstream (the document edited elsewhere) is refused, REFERENCE_MOVED, never the other corner', async () => {
  const s = await filleted(), moved = sketched(s.doc, [[0, 0], [5, -2], [10, 0], [10, 10], [0, 10]]);
  const r = await evaluate(moved);
  assert.ok(!r.ok, 'the moved name builds on nothing');
  assert.equal(r.error.code, 'REFERENCE_MOVED');
  assert.match(r.error.detail, /\[REFERENCE_MOVED\] fillet edge \S+ is no longer the edge it named \(was at \(10, 10, 3\)/);
  // (Without the signature — the gap O19 closes — the same document rounds the corner at (10, 0).)
  const blind = { ...moved, nodes: moved.nodes.map((n, i) => i === 2 ? { ...n, sigs: undefined } as ModelNode : n) }, b = await evaluate(blind);
  assert.ok(b.ok);
  const pentagon = 10 * 10 * 6 + (10 * 2) / 2 * 6, onItsCorner = pentagon - (1 - Math.PI / 4) * 4 * 6;
  assert.ok(Math.abs(b.bodies[0].volumeMM3! - onItsCorner) > 1e-3, 'unchecked, it rounds another corner');
});

test('O19: a dimension change that keeps the names still builds, the fillet on its corner', async () => {
  const s = await filleted(), wider = sketched(s.doc, [[0, 0], [12, 0], [12, 10], [0, 10]]);
  const r = await evaluate(wider);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - (12 * 10 * 6 - (1 - Math.PI / 4) * 4 * 6)) < 1e-6, String(r.bodies[0].volumeMM3));
});

test('O19: through the agent\'s tools, the moved name is matched again by its signature (marked), and the fillet stays on its corner', async () => {
  const s = await filleted(), moved = sketched(s.doc, [[0, 0], [5, -2], [10, 0], [10, 10], [0, 10]]);
  // (The moved document as the state the agent works on — edited elsewhere; any change it then makes is evaluated.)
  const r = await runTool({ doc: moved, bodies: s.bodies }, 'add_features', { features: [{ kind: 'sketch', profile: 'polygon', points: [[30, 0], [32, 0], [32, 2], [30, 2]] }] }, evaluate);
  assert.ok(!r.isError, r.content);
  const out = JSON.parse(r.content) as { rematched?: { was: string; now: string }[] };
  assert.equal(out.rematched?.length, 1, r.content);
  const f = r.state.doc.nodes[2] as { edges: string[]; rematched?: Record<string, string> };
  assert.equal(out.rematched![0].now, f.edges[0]);
  assert.ok(f.rematched, 'marked re-matched until confirmed');
  const prism = 10 * 10 * 6 + (10 * 2) / 2 * 6;
  assert.ok(Math.abs(r.state.bodies[0].volumeMM3! - (prism - (1 - Math.PI / 4) * 4 * 6)) < 1e-6, String(r.state.bodies[0].volumeMM3));
});
