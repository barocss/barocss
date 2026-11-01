import { emptyDoc, prefixDoc, withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { captureSignatures } from '@barocss/cad-model/engine/references';

/** A real stored band reference whose source sketch can lose its named side. */
export function referenceOpenFixtures() {
  const loop: ModelNode = { kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [40, 0] }, { kind: 'line', start: [40, 30] }, { kind: 'line', start: [0, 30] }], sideTags: { outer: ['e0', 'e1', 'e2', 'e3'] } } as ModelNode;
  const base = prefixDoc({ ...emptyDoc(), nodes: [loop, { kind: 'extrude', sketch: 0, height: 10 }, { kind: 'sketch', profile: 'circle', center: [20, 15], radius: 10 }, { kind: 'extrude', sketch: 2, height: 10, from: 40 }] }, 4);
  const result = evaluateDoc(base, 0); if (!result.ok) throw new Error(result.error.detail);
  const edges = (node: number) => { const body = result.bodies.find(b => b.ref?.node === node)!; const face = body.mesh.faces.filter(f => f.kind === 'plane' && f.normal[2] > .99).sort((a, b) => b.centroid[2] - a.centroid[2])[0]; return [...new Set(body.mesh.edges.filter(e => e.faces.includes(face.index)).flatMap(e => e.names))]; };
  const valid = captureSignatures(withNode(base, { kind: 'band-surface', version: 1, a: { parent: { node: 1, side: 'solid' }, edges: edges(1) }, b: { parent: { node: 3, side: 'solid' }, edges: edges(3) } }), result.bodies);
  const replaceSketch = (sketch: ModelNode): StudioDoc => prefixDoc({ ...valid, nodes: valid.nodes.map((n, i) => i === 0 ? sketch : n) }, 5);
  const moved = replaceSketch({ ...loop, segments: loop.kind === 'sketch' && loop.profile === 'loop' ? loop.segments.slice(0, 3) : [], sideTags: { outer: ['e0', 'e1', 'e2'] } } as ModelNode);
  const renamed = replaceSketch({ ...loop, sideTags: { outer: ['e0', 'e1', 'e2', 'e4'] } } as ModelNode);
  const unrelated = prefixDoc({ ...base, nodes: base.nodes.map((n, i) => i === 1 ? { ...n, height: 0 } as ModelNode : n) }, 4);
  const lost = structuredClone(valid), band = lost.nodes[4];
  if (band.kind !== 'band-surface') throw new Error('band fixture');
  const old = band.a.edges[0], missing = 'n1.gone|n1.top';
  band.a.edges[0] = missing; band.sigs = { ...band.sigs, [missing]: { ...band.sigs![old], p: [10000, 10000, 10000] } }; delete band.sigs[old];
  return { valid, lost, renamed, moved, unrelated };
}
