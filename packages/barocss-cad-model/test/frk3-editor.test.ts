import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, sectionLabel, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { dispatchTool } from '../src/chat/tools';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { editFields } from '../src/app/editFields';
const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);
const section = { kind: 'i-beam' as const, height: 120, width: 80, web: 6, flange: 9, rootRadius: 0, toeRadius: 0, flangeSlope: 0 };
const member = (s = section) => ({ kind: 'frame-member', section: s, start: [0, 0, 0], end: [0, 0, 300] });
test('FRk3 v2 creates I/H and channel, common editing changes geometry and Save/Open permits parameter re-edit', async () => {
  for (const kind of ['i-beam', 'channel'] as const) {
    const s = { ...section, kind, flangeSlope: .05 };
    const out = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'add', features: [member(s as typeof section)] }, evaluate);
    assert.equal(out.isError, false, out.content); assert.equal(out.state.bodies.length, 1);
    const node = out.state.doc.nodes[0]; assert.ok(node.kind === 'frame-member');
    assert.match(sectionLabel(node.section, String), kind === 'i-beam' ? /I\/H/ : /C /);
    const field = editFields(out.state.doc.nodes, 0).find(f => f.key === 's.flangeSlope'); assert.ok(field?.kind === 'number'); assert.equal(field.unit, undefined);
    const edited = await dispatchTool(out.state, 'features', { action: 'edit', index: 0, values: { 's.flangeSlope': .1 } }, evaluate);
    assert.equal(edited.isError, false, edited.content); assert.notDeepEqual(edited.state.bodies[0].inertia, out.state.bodies[0].inertia);
    const file = await readStudioFile(encodeStudioFile(edited.state.doc)); assert.ok('doc' in file);
    assert.deepEqual(file.doc.nodes, edited.state.doc.nodes);
    const bound = { ...file.doc, parameters: { web: 7 }, nodes: file.doc.nodes.map(n => n.kind === 'frame-member' ? { ...n, section: { ...n.section, web: { parameter: 'web' } } } : n) } as StudioDoc;
    const a = await evaluate(bound), b = await evaluate({ ...bound, parameters: { web: 8 } }); assert.ok(a.ok && b.ok); assert.notEqual(a.bodies[0].volume, b.bodies[0].volume);
  }
});
test('FRk3 strict v2 refuses missing explicit I fields and unknown or invalid geometry without committing', async () => {
  const variants: unknown[] = [{ ...section, extra: 1 }, { ...section, web: -1 }, { ...section, flangeSlope: 'bad' }];
  for (const key of ['height', 'width', 'web', 'flange', 'rootRadius', 'toeRadius', 'flangeSlope']) { const v: Record<string, unknown> = { ...section }; delete v[key]; variants.push(v); }
  for (const s of variants) {
    const state = { doc: emptyDoc(), bodies: [] };
    const r = await dispatchTool(state, 'features', { action: 'add', features: [member(s as typeof section)] }, evaluate);
    assert.equal(r.isError, true, JSON.stringify(s)); assert.equal(r.state, state);
  }
});
test('FRk3 legacy channel omits its new fields across file Open and can add them with common editing', async () => {
  const { toeRadius: _t, flangeSlope: _s, ...old } = { ...section, kind: 'channel' }; void _t; void _s;
  const out = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'add', features: [member(old as typeof section)] }, evaluate); assert.equal(out.isError, false, out.content);
  const file = await readStudioFile(encodeStudioFile(out.state.doc)); assert.ok('doc' in file);
  const node = file.doc.nodes[0]; assert.ok(node.kind === 'frame-member'); assert.equal('toeRadius' in node.section, false); assert.equal('flangeSlope' in node.section, false);
  assert.ok(editFields(file.doc.nodes, 0).some(f => f.key === 's.flangeSlope'));
});
test('FRk3 common frame/member commands emit editable explicit sections and updated cut pieces', async () => {
  for (const command of ['frame-member', 'frame']) for (const kind of ['i-beam', 'channel']) {
    const out = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'command', command,
      values: { section: kind, w: 80, h: 120, tw: 6, tf: 9, r1: 0, toe: 0, slope: .05, ...(command === 'frame' ? { skeleton: 'rectangle', W: 400, D: 300, corners: 'none' } : {}) } }, evaluate);
    assert.equal(out.isError, false, out.content); assert.ok(out.state.bodies.every(b => b.cutPiece));
    const f = editFields(out.state.doc.nodes, 0).find(f => f.key === 's.web'); assert.ok(f?.kind === 'number');
    const next = { ...out.state.doc, nodes: f.set(out.state.doc.nodes, 8) }, e = await evaluate(next); assert.ok(e.ok);
    assert.notEqual(e.bodies[0].cutPiece!.volume, out.state.bodies[0].cutPiece!.volume);
  }
});
