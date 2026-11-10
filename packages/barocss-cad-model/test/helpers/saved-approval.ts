import assert from 'node:assert/strict';
import { acceptProposal, runTool, type Evaluate } from '../../src/chat/tools';
import { emptyDoc, rectanglePart, type PartInstance, type StudioDoc } from '../../src/engine/doc';
import { evaluateDoc } from '../../src/engine/evaluate';
import { makeVersion, makeVersions } from '../../src/versions/log';

const plate = (height: number): StudioDoc => {
  const doc = rectanglePart(20, 10, height);
  return { ...doc, parameters: { H: height }, nodes: doc.nodes.map(node => node.kind === 'extrude' ? { ...node, height: { parameter: 'H' } } : node),
    requirements: [{ id: 'HEIGHT', source: '5 mm maximum', hard: true, check: { query: { fn: 'bbox', axis: 'z' }, op: '<=', value: 5, unit: 'mm' } }] };
};
const instance = (id: string, doc: StudioDoc): PartInstance => ({ id, name: id, doc, position: [10, 0, 0], rotation: [0, 0, 0] });
const host = (id: string, height: number) => instance(id, { ...emptyDoc(), instances: [instance('p1', plate(height))] });

export async function savedApprovalFixture() {
  const evaluate: Evaluate = async doc => evaluateDoc(doc, 1);
  const root = { ...emptyDoc(), instances: [host('p1', 6), host('p2', 7)] };
  const proposed = await runTool({ doc: root, bodies: [] }, 'proposals', { action: 'propose', title: 'Correction',
    ops: [{ tool: 'features', args: { action: 'parameters', part: 'p1/p1', set: { H: 4 } } }] }, evaluate);
  assert.equal(proposed.isError, false, proposed.content);
  const accepted = await acceptProposal(proposed.state, 'P1', evaluate);
  if ('error' in accepted) assert.fail(accepted.error);
  const before = proposed.state.doc, after = accepted.state.doc;
  const doc = { ...after, instances: [host('p1', 8), after.instances![1]] };
  const first = makeVersions(before, { at: '2026-11-11T00:00:00Z', name: 'Initial' });
  const approved = makeVersion(first, after, { at: '2026-11-11T00:01:00Z', name: 'Approved' });
  const working = makeVersion(approved.log, doc, { at: '2026-11-11T00:02:00Z', name: 'Working' });
  const args = { action: 'approval_evidence', from: first.versions[0].id, to: approved.version.id, part: 'p1/p1' };
  return { before, after, state: { doc, bodies: [], versions: working.log }, args, working: working.version };
}
