import test from 'node:test';
import assert from 'node:assert/strict';
import { organicTorus } from './bench/mesh-fixtures';
import { commands } from '@barocss/cad-model/app/commands';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, featureLabel, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';

// R9 (D85): "Simplify mesh" — the kernel's decimate feature on a mesh body, from the palette and from the agent.
const torus = organicTorus(80, 40);
const meshDoc = (): StudioDoc => withNode(emptyDoc(), { kind: 'mesh', name: 'torus', unit: 'mm', positions: [...torus.positions], indices: [...torus.indices], representation: 'facets' });
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, !r.ok ? r.error.detail : ''); return (r as { bodies: BodyResult[] }).bodies; };
const sel = (body: number) => ({ faces: [], edges: [], bodies: [body] });

test('D85 Simplify mesh on a 6 400-triangle organic torus: offered for a mesh body only; to a quarter — its faces\' names kept, the volume near, the report in its notes; its label', () => {
  const doc = meshDoc(), bodies = bodiesOf(doc), cmd = commands.find(c => c.id === 'decimate')!;
  const ctx = { doc, bodies, selection: sel(0) } as never;
  assert.equal(cmd.available!(ctx).ok, true);
  // (Not for a body of exact faces.)
  const box = commands.find(c => c.id === 'box')!, boxDoc = box.build!({ doc: emptyDoc(), bodies: [], selection: sel(0) } as never, { ...box.defaults!({ doc: emptyDoc(), bodies: [], selection: sel(0) } as never), x: 0, y: 0, z: 0 });
  assert.equal(cmd.available!({ doc: boxDoc, bodies: bodiesOf(boxDoc), selection: sel(0) } as never).ok, false);
  const next = cmd.build!(ctx, { ...cmd.defaults!(ctx) }), node = next.nodes[1];
  const noId = (n: object) => { const o = { ...n } as Record<string, unknown>; delete o.id; return o; };
  assert.deepEqual(noId(node), { kind: 'decimate', parent: { node: 0, side: 'solid' }, ratio: 0.25 });
  assert.equal(featureLabel(node, 1, next.nodes), 'Simplify mesh to 25%');
  const [before] = bodies, [after] = bodiesOf(next);
  assert.deepEqual([...new Set(after.mesh.faces.map(f => f.name))].sort(), [...new Set(before.mesh.faces.map(f => f.name))].sort());
  assert.ok(Math.abs(after.volumeMM3! / before.volumeMM3! - 1) < 0.01, `${after.volumeMM3} vs ${before.volumeMM3}`);
  const notes = after.notes!.map(n => n.text);
  assert.match(notes[0], /^Simplified: 6,400 → 1,600 triangles \(stopped at the asked count\)$/);
  assert.match(notes[1], /^Measured distance from the original: at most [\d.]+ mm/);
  // A bound and a crease angle when given; a keep outside 1–99 refused.
  const b2 = cmd.build!(ctx, { keep: 10, maxError: 0.05, crease: 45 });
  assert.deepEqual(noId(b2.nodes[1]), { kind: 'decimate', parent: { node: 0, side: 'solid' }, ratio: 0.1, maxError: 0.05, featureAngle: 45 });
  assert.throws(() => cmd.build!(ctx, { keep: 0, maxError: 0, crease: 0 }), /between 1 and 99/);
  // (A saved document with it opens.)
  const read = readStudioDoc(JSON.stringify(next)); assert.ok('doc' in read, JSON.stringify(read)); assert.equal(read.doc.nodes[1].kind, 'decimate');
});

test('D85 the agent: run_command decimate on the mesh body (its keep, bound and crease angle as values) — the body simplified, its notes in the result', async () => {
  const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
  const r0 = await evaluate(meshDoc()); assert.ok(r0.ok);
  const state: ChatState = { doc: meshDoc(), bodies: r0.bodies };
  const r = await dispatchTool(state, 'run_command', { command: 'decimate', bodies: ['b0'], values: { keep: 20 } }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.equal(r.state.doc.nodes[1].kind, 'decimate');
  assert.ok(r.state.bodies[0].notes?.some(n => /Simplified: 6,400 → 1,280 triangles/.test(n.text)), JSON.stringify(r.state.bodies[0].notes));
});

test('D85 a simplified mesh\'s keep is a value: edit_feature changes it (its field Keep %) (at autonomy L2 too, a value edit of the feature)', async () => {
  const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
  const doc = withNode(meshDoc(), { kind: 'decimate', parent: { node: 0, side: 'solid' }, ratio: 0.25 }), r0 = await evaluate(doc); assert.ok(r0.ok);
  const was = process.env.CAD_AUTONOMY;
  try {
    process.env.CAD_AUTONOMY = '2';
    const state: ChatState = { doc, bodies: r0.bodies, turnBase: doc };
    const r = await dispatchTool(state, 'edit_feature', { index: 1, values: { keep: 50 } }, evaluate);
    assert.ok(!r.isError, r.content);
    assert.equal((r.state.doc.nodes[1] as { ratio: number }).ratio, 0.5);
    assert.ok(r.state.bodies[0].notes?.some(n => /→ 3,200 triangles/.test(n.text)));
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
});
