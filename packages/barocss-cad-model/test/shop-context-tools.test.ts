import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { dispatchTool, runTool, acceptProposal, type ChatState } from '../src/chat/tools';
import { resolveShopRows, provenanceOfTree } from '../src/engine/shopRows';
import { drawingDocument } from '../src/drawing/scope';
import { readDrawing } from '../src/drawing/types';
import { drawingInputs } from '../src/chat/drawing';
import { massResult, freshnessOf } from '../src/team/freshness';
import { bomPanelData } from '../src/bom/bom';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { listed, SYSTEM_PROMPT_V2, TOOLS_V2 } from '../src/chat/toolset';
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const row = (width: number) => ({ id: 'shop-section', name: 'User tube', source: 'User test drawing', section: { kind: 'rect-tube' as const, width, height: 40, wall: 3, outerRadius: 0 } });
const child = () => withNode(emptyDoc(), { kind: 'frame-member', section: { kind: 'library', id: 'shop-section' }, start: [0, 0, 0], end: [100, 0, 0] });
const assembly = (part = child()): StudioDoc => ({ ...emptyDoc(), frames: { version: 1, sections: [row(40)] }, machining: { version: 1, stock: [{ id: 'shop-stock', kind: 'block', size: [120, 60, 60], source: 'User test stock' }] }, instances: [{ id: 'p', name: 'Part', doc: part, position: [1000, 0, 0], rotation: [0, 0, 0] }] });
const stateOf = (doc: StudioDoc): ChatState => ({ doc, bodies: [] });
const json = (s: string) => JSON.parse(s) as Record<string, unknown>;

test('A9-10 existing v2 actions and describe expose read-only outputs within the per-turn contract', async () => {
  const doc = assembly(rectanglePart(20, 15, 4)), s = stateOf(doc), before = JSON.stringify(doc);
  const described = await dispatchTool(s, 'describe', { tool: 'query', action: 'cam' }, evaluate);
  assert.equal(described.isError, false, described.content); assert.match(described.content, /toolDiameter/); assert.match(described.content, /expectedRevision/);
  const output = await runTool(s, 'query', { action: 'bom' }, evaluate);
  assert.equal(output.isError, false, output.content); assert.equal(output.changed, false); assert.equal(output.state.doc, doc); assert.equal(JSON.stringify(doc), before);
  assert.ok(Array.isArray(json(output.content).files));
  assert.ok(JSON.stringify(TOOLS_V2.map(listed)).length + SYSTEM_PROMPT_V2.length <= 25000);
  assert.equal(TOOLS_V2.length, 13, 'no new top-level tool');
});

test('A9-8 part dispatch, batch and proposal use parent rows but never persist inherited rows', async () => {
  const doc = assembly(), s = stateOf(doc), before = JSON.stringify(doc), original = doc.instances![0].doc;
  const read = await dispatchTool(s, 'query', { action: 'summary', part: 'p' }, evaluate);
  assert.equal(read.isError, false, read.content); assert.equal(read.changed, false); assert.match(read.content, /inherited/); assert.equal(JSON.stringify(doc), before);
  const feature = { ...original.nodes[0], end: [150, 0, 0] };
  const edit = { action: 'edit', part: 'p', index: 0, feature };
  const direct = await dispatchTool(s, 'features', edit, evaluate); assert.equal(direct.isError, false, direct.content);
  assert.equal(direct.state.doc.instances![0].doc.frames, undefined); assert.equal(direct.state.doc.instances![0].doc.machining, undefined);
  const batch = await dispatchTool(s, 'features', { action: 'batch', ops: [{ tool: 'features', args: edit }] }, evaluate); assert.equal(batch.isError, false, batch.content);
  const proposal = await runTool(s, 'proposals', { action: 'propose', title: 'Longer member', ops: [{ tool: 'features', args: edit }] }, evaluate); assert.equal(proposal.isError, false, proposal.content);
  assert.equal(proposal.state.doc.instances![0].doc, original, 'no application before user approval');
  const accepted = await acceptProposal(proposal.state, proposal.state.doc.proposals!.at(-1)!.id, evaluate); assert.ok(!('error' in accepted), JSON.stringify(accepted));
  assert.deepEqual(accepted.state.doc.instances![0].doc, direct.state.doc.instances![0].doc);
  assert.deepEqual(batch.state.doc.instances![0].doc, direct.state.doc.instances![0].doc);
  assert.equal(JSON.stringify(doc), before);
});

test('A9-8 drawing, parent-change freshness, local override BOM and real container roundtrip share row context', async () => {
  const doc = assembly(), settings = { ...readDrawing(undefined), scope: { kind: 'part' as const, part: 'p' } };
  const inputs = drawingInputs(doc, settings); assert.ok(typeof inputs !== 'string', String(inputs));
  const own = evaluatePart(resolveShopRows(doc.instances![0].doc, doc).doc, 1); assert.ok(own.ok);
  const local = evaluatePart(drawingDocument(doc, settings), 1); assert.ok(local.ok); assert.equal(local.bodies[0].volume, own.bodies[0].volume);
  const mass = await massResult(doc, evaluate, 'test', 'p'); assert.equal(mass.status, 'ok');
  const parentChanged: StudioDoc = { ...doc, frames: { version: 1, sections: [row(50)] } };
  assert.equal((await freshnessOf(mass, parentChanged, evaluate)).state, 'stale');
  const overridden = { ...child(), frames: { version: 1 as const, sections: [row(60)] } };
  const pair: StudioDoc = { ...doc, instances: [...doc.instances!, { ...doc.instances![0], id: 'override', name: 'Override', doc: overridden }] };
  const bom = await bomPanelData(pair, evaluate); assert.equal(bom.bom.lines.length, 2, 'different effective section geometry cannot merge by identical feature JSON');
  assert.ok(provenanceOfTree(pair).find(p => p.part === 'override')!.rows.some(r => r.kind === 'section' && r.origin === 'override'));
  const file = await readStudioFile(encodeStudioFile(pair)); assert.ok('doc' in file);
  assert.equal(file.doc.instances![0].doc.frames, undefined, 'Save/Open retains authored absence');
  const reopened = await bomPanelData(file.doc, evaluate); assert.deepEqual(reopened.bom, bom.bom);
});
