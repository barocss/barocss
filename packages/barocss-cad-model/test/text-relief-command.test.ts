import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { part, fontFromBytes, type FontSource } from '../src/api';
import { commandById, type Ctx, type Values } from '../src/app/commands';
import { editCommand } from '../src/app/editCommand';
import { textReliefCommand } from '../src/app/textReliefCommand';
import { evaluateDoc } from '../src/engine/evaluate';
import { withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { referencesOf } from '../src/engine/references';
import { checkValues } from '../src/chat/toolKit';

type Relief = Extract<ModelNode, { kind: 'text-relief' }>;
const original = resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts/abeezee/ABeeZee-Regular.ttf');
async function font(): Promise<FontSource> { return fontFromBytes(new Uint8Array(readFileSync(original)), { filename: 'Original.ttf', license: 'OFL-1.1' }); }
function context(): Ctx {
  const doc = part().box({ w: 40, d: 30, h: 10 }).doc, result = evaluateDoc(doc, 1);
  assert.ok(result.ok, result.ok ? '' : result.error.detail);
  const top = result.bodies[0].mesh.faces.findIndex(f => f.name === 'n1.top'); assert.ok(top >= 0);
  return { doc, bodies: result.bodies, selection: { faces: [{ body: 0, face: top }], edges: [], bodies: [] } };
}
function values(ctx: Ctx, source: FontSource): Values { return { ...textReliefCommand.defaults!(ctx), text: ' A ', font: JSON.stringify(source) }; }
function last(doc: StudioDoc): Relief { const node = doc.nodes.at(-1); assert.ok(node?.kind === 'text-relief'); return node; }

test('Text relief is one selected top-face command with explicit font, placement and mode', async () => {
  const ctx = context(), source = await font(), fields = textReliefCommand.fields!(ctx), defaults = textReliefCommand.defaults!(ctx);
  assert.equal(commandById('text-relief'), textReliefCommand); assert.equal(textReliefCommand.available(ctx).ok, true);
  assert.deepEqual(defaults, { text: '', font: '', size: 10, depth: 2, tolerance: 0.01, tracking: 0, x: 5, y: 5, mode: 'emboss' });
  assert.match(checkValues(fields, defaults)!, /Text.*required/); assert.equal(checkValues(fields, values(ctx, source)), null);
  assert.equal(fields.some(f => f.key === 'height'), false); assert.equal(fields.find(f => f.key === 'mode')?.kind, 'choice');
  const before = structuredClone(ctx.doc), given = values(ctx, source), made = textReliefCommand.build!(ctx, given), node = last(made);
  assert.equal(node.kind, 'text-relief'); assert.deepEqual(node.parent, { node: 1, side: 'solid' }); assert.deepEqual(node.faces, ['n1.top']);
  assert.equal(node.text, ' A '); assert.deepEqual(node.font, source); assert.notEqual(node.font, source); assert.deepEqual(node.at, [5, 5]);
  assert.equal(node.depth, 2); assert.equal(node.mode, 'emboss'); assert.ok(node.sigs?.['n1.top']);
  assert.equal(referencesOf(made, true).refs.at(-1)?.name, 'n1.top'); assert.deepEqual(ctx.doc, before);
});
test('Text relief refuses absent, side, mixed and merged picks before changing the recipe', async () => {
  const ctx = context(), source = await font(), before = structuredClone(ctx.doc), given = values(ctx, source);
  const side = ctx.bodies[0].mesh.faces.findIndex(f => f.name === 'n1.side0'); assert.ok(side >= 0);
  const cases: Ctx[] = [
    { ...ctx, selection: { faces: [], edges: [], bodies: [] } },
    { ...ctx, selection: { ...ctx.selection, faces: [{ body: 0, face: side }] } },
    { ...ctx, selection: { ...ctx.selection, faces: [...ctx.selection.faces, ...ctx.selection.faces] } },
    { ...ctx, selection: { ...ctx.selection, edges: [{ body: 0, edge: 0 }] } },
    { ...ctx, selection: { ...ctx.selection, sketches: [0] } },
    { ...ctx, bodies: [{ ...ctx.bodies[0], mesh: { ...ctx.bodies[0].mesh, faces: ctx.bodies[0].mesh.faces.map(f => ({ ...f, name: 'n1.top+n9.top' })) } }] },
  ];
  for (const bad of cases) { assert.equal(textReliefCommand.available(bad).ok, false); assert.throws(() => textReliefCommand.build!(bad, given)); }
  assert.deepEqual(ctx.doc, before);
});
test('Text relief history edit keeps references, later nodes and untouched authored values', async () => {
  const ctx = context(), source = await font(), created = textReliefCommand.build!(ctx, { ...values(ctx, source), x: -0 }), node = last(created);
  const later = withNode(created, { kind: 'sketch', profile: 'rectangle', min: [70, 0], max: [71, 1] }), current = { ...ctx, doc: later }, before = structuredClone(later);
  const edit = editCommand(2, later.nodes)!; assert.ok(edit); assert.equal(edit.label, 'Edit Text relief');
  const same = edit.build!(current, edit.defaults!(current)); assert.deepEqual(same, later); assert.ok(Object.is(last(created).at[0], -0));
  const changed = edit.build!(current, { ...edit.defaults!(current), text: 'O', mode: 'engrave', depth: '1.25' });
  const relief = changed.nodes[2]; assert.ok(relief.kind === 'text-relief');
  assert.equal(relief.text, 'O'); assert.equal(relief.mode, 'engrave'); assert.equal(relief.depth, 1.25);
  assert.equal(relief.parent, node.parent); assert.equal(relief.faces, node.faces); assert.equal(relief.sigs, node.sigs); assert.equal(relief.id, node.id);
  assert.ok(Object.is(relief.at[0], -0)); assert.equal(changed.nodes[3], later.nodes[3]); assert.equal(changed.nextId, later.nextId);
  assert.deepEqual(later, before);
});
test('Text relief history edit preserves bound placement, depth and em dimensions', async () => {
  const ctx = context(), source = await font(), created = textReliefCommand.build!(ctx, values(ctx, source)), node = last(created);
  const bound: Relief = { ...node, size: { parameter: 'em' }, depth: { parameter: 'd' }, tracking: { parameter: 'gap' }, at: [{ parameter: 'x' }, { parameter: 'y' }] };
  const doc: StudioDoc = { ...created, parameters: { em: 10, d: 2, gap: 0, x: 5, y: 5 }, nodes: [...created.nodes.slice(0, -1), bound] }, current = { ...ctx, doc };
  const edit = editCommand(2, doc.nodes)!, fields = edit.fields!(current), defaults = edit.defaults!(current);
  for (const key of ['size', 'depth', 'tracking', 'x', 'y']) { assert.equal(fields.some(f => f.key === key), false); assert.equal(key in defaults, false); assert.throws(() => edit.build!(current, { ...defaults, [key]: 1 }), /Parameters panel/); }
  assert.deepEqual(edit.build!(current, { ...defaults, text: 'B' }).nodes[2], { ...bound, text: 'B' });
  const noTracking = { ...node }; delete noTracking.tracking;
  const omitted = { ...created, nodes: [...created.nodes.slice(0, -1), noTracking] }, omittedCtx = { ...ctx, doc: omitted }, omittedEdit = editCommand(2, omitted.nodes)!;
  assert.equal(Object.hasOwn(last(omittedEdit.build!(omittedCtx, omittedEdit.defaults!(omittedCtx))), 'tracking'), false);
});
test('Text relief rejects malformed values, unavailable fonts and stale history without mutation', async () => {
  const ctx = context(), source = await font(), given = values(ctx, source), before = structuredClone(ctx.doc);
  const invalid: Values[] = [{ mode: 'union' }, { depth: 0 }, { x: '' }, { y: Infinity }, { text: ' ' }, { font: '{' }, { font: JSON.stringify({ ...source, blob: '0'.repeat(64) }) }];
  for (const patch of invalid) assert.throws(() => textReliefCommand.build!(ctx, { ...given, ...patch }));
  const created = textReliefCommand.build!(ctx, given), edit = editCommand(2, created.nodes)!, node = last(created);
  const stale = { ...ctx, doc: { ...created, nodes: [...created.nodes.slice(0, -1), { ...node, id: 'n99' }] } };
  assert.equal(edit.available(stale).ok, false); assert.throws(() => edit.build!(stale, {}), /changed.*Select it again/);
  assert.deepEqual(ctx.doc, before);
});
