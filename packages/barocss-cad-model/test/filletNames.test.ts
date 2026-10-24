import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { runTool, type ChatState } from '../src/chat/tools';
import { bodyKeyFor } from '../src/engine/ids';
import { captureSignatures } from '../src/engine/references';
import { rematchNames } from '../src/engine/rematch';

// R10.2 (D89, D90): a general fillet's faces are its patches (`n<k>.face#j`, their count following the loft) and its
// edges pieces; what the document stores must still resolve when its radius changes. Faces: the studio shows the patches
// as one face by its base name, and a reference to it is that name — it stands, nothing re-matched. Edges: a reference
// is one piece's name; on a radius edit the prior-document match (D28) finds the edge again by its geometry — the pieces
// of one shown edge count as one (D90), so it resolves, marked re-matched until confirmed.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } as never;
async function bodies(doc: StudioDoc) { const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; }
/** A pipe tee (a tube of 10 along X, a branch of 5 up Z), its junction filleted r 2: nodes 0–5. */
async function tee(): Promise<StudioDoc> {
  let doc = emptyDoc();
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: yz });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 60 });
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [30, 0], radius: 5 });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 25 });
  doc = withNode(doc, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  const edge = (await bodies(doc))[0].mesh.edges.find(e => e.names.some(n => /n1\.side0/.test(n) && /n3\.side0/.test(n)))!.names[0];
  return withNode(doc, { kind: 'fillet', parent: { node: 4, side: 'solid' }, edges: [edge], radius: 2 });
}
const withRadius = (doc: StudioDoc, k: number, radius: number): StudioDoc => ({ ...doc, nodes: doc.nodes.map((n, i) => i === k ? { ...n, radius } as ModelNode : n) });

test('a general fillet\'s face coloured: the patches show as one face (n5.face); the colour keeps its name across a radius edit, nothing re-matched', async () => {
  let doc = await tee();
  const b = await bodies(doc), names = [...new Set(b[0].mesh.faces.map(f => f.name).filter(n => /^n5\.face/.test(n)))];
  assert.deepEqual(names, ['n5.face']);
  doc = captureSignatures({ ...doc, bodies: { [bodyKeyFor(doc.nodes, 5)]: { faces: { 'n5.face': '#ff0000' } } } }, b);
  const r = await runTool({ doc, bodies: b } as ChatState, 'edit_feature', { index: 5, feature: { ...doc.nodes[5], radius: 1 } }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.deepEqual(Object.keys(r.state.doc.bodies![bodyKeyFor(doc.nodes, 5)].faces!), ['n5.face']);
  assert.equal(r.state.doc.bodies![bodyKeyFor(doc.nodes, 5)].facesWas, undefined, 'not re-matched');
});

test('an edge of a general fillet referenced by a later feature: a ring\'s edges are tangent (none shown, none to pick); an oblique groove\'s fillet ends at the plate\'s end on a crease — a radius edit re-matches a reference to it to the same edge, one change', async () => {
  // The tee: the fillet meets the tube and the branch tangentially — the studio shows no edge there.
  const tb = await bodies(await tee());
  assert.equal(tb[0].mesh.edges.filter(e => e.names.some(n => /n5\.face/.test(n))).length, 0);
  // The groove: a rod (4) tilted 10° about Y cut from a plate, its rim filleted r 1; the fillet's end edge at x = 32.
  let g = emptyDoc();
  g = withNode(g, { kind: 'sketch', profile: 'rectangle', min: [8, -20], max: [32, 20] });
  g = withNode(g, { kind: 'extrude', sketch: 0, height: 10 });
  g = withNode(g, { kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: yz });
  g = withNode(g, { kind: 'extrude', sketch: 2, height: 60, from: -10 });
  g = withNode(g, { kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'y', angle: 10, pivot: [20, 0, 10] });
  g = withNode(g, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 4, side: 'solid' } });
  const rim = (await bodies(g))[0].mesh.edges.find(e => e.a[1] > 0 && e.names.some(n => /n3\.side0/.test(n) && /n1\.top/.test(n)))!.names[0];
  g = withNode(g, { kind: 'fillet', parent: { node: 5, side: 'solid' }, edges: [rim], radius: 1 });
  const gb = await bodies(g), end = gb[0].mesh.edges.find(e => e.names.some(n => /n6\.face/.test(n)) && e.names.some(n => /n1\.side1/.test(n)))!;
  for (const [what, doc, k, b, edge, radius] of [['groove', g, 6, gb, end, 0.7]] as const) {
    // A chamfer on that edge (whether the kernel takes it does not matter: the reference is what is matched).
    const prev = captureSignatures(withNode(doc, { kind: 'chamfer', parent: { node: k, side: 'solid' }, edges: [edge.names[0]], distance: 0.2 }), b);
    const m = await rematchNames(prev, withRadius(prev, k, radius), evaluate);
    assert.ok(!('error' in m), `${what}: ${'error' in m ? m.error : ''}`);
    if ('error' in m) continue;
    const edited = withRadius(prev, k, radius), after = await bodies({ ...edited, nodes: edited.nodes.slice(0, k + 1) }), to = (m.doc.nodes[k + 1] as { edges: string[] }).edges[0];
    const shown = after[0].mesh.edges.find(e => e.names.includes(to));
    assert.ok(shown && shown.names.some(n => edge.names.some(o => o.replace(/#\d+/g, '') === n.replace(/#\d+/g, ''))), `${what}: ${edge.names[0]} → ${to}`);
    assert.ok(m.changes.length <= 1, `${what}: ${JSON.stringify(m.changes)}`);
  }
});

test('R10.2b refusals read as plain-language errors: an end meeting another finished edge, an end square on a face, a branching chain', async () => {
  const { friendly } = await import('../src/engine/errors');
  assert.equal(friendly('n6: CAPABILITY: edge a|b: it meets another finished edge at its end; blending them there arrives with R10.3b').title, 'These fillets meet at a corner');
  assert.equal(friendly('n6: CAPABILITY: [VERTEX_BLEND_UNSUPPORTED] edges a|b and c|d meet at a corner with another finished edge; blending three there arrives with R10.3b').title, 'These fillets meet at a corner');
  assert.equal(friendly('n6: CAPABILITY: edge a|b: the fillet would end square on a face (its last section in that face\'s plane); that end is not supported yet').title, 'The fillet can’t end here yet');
  assert.equal(friendly('n6: CAPABILITY: edge a|b: its end meets more than one face; ending a general fillet there arrives with R10.3').title, 'The fillet can’t end here yet');
  assert.equal(friendly('n6: CAPABILITY: edge a|b: its chain branches; finishing it there is not supported yet').title, 'The edge branches');
});
