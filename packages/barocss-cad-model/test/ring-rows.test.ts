import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { checkRingRow, editRingRows } from '../src/engine/rings';

// O139 (the kernel lane's open studio item): retaining-ring rows the person loads (none built in) — a ring naming one is
// checked against it by the kernel and is no longer an estimate; the default shaft's groove is Ø19 × 1.3 on its Ø20 step.
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
function ring(doc: StudioDoc, values: Record<string, number | string> = {}) {
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const ctx: Ctx = { doc, bodies: r.bodies, selection: { faces: [], edges: [], bodies: [r.bodies.findIndex(b => b.ref?.node === 0)] } }, c = cmd('retaining-ring');
  assert.ok(c.available(ctx).ok);
  return { doc: c.build!(ctx, { ...c.defaults!(ctx), ...values }), defaults: c.defaults!(ctx) };
}
const ROW = { id: 'DIN471-20', designation: '20 × 1.2', shaftDiameter: 20, grooveDiameter: 19, grooveWidth: 1.3, source: 'the maker\'s sheet' };
const notesOf = (doc: StudioDoc) => { const r = evaluateDoc(doc, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies.find(b => b.ref && doc.nodes[b.ref.node].kind === 'retaining-ring')!.notes!.map(n => n.text); };

test('a ring row loaded: the Retaining ring command offers it for the groove\'s sizes, the ring cites it — not an estimate', () => {
  const shaft = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank)), t = editRingRows(shaft, [ROW]); assert.ok('doc' in t);
  const { doc, defaults } = ring(t.doc);
  assert.equal(defaults.row, 'DIN471-20');
  assert.equal((doc.nodes.at(-1) as Extract<ModelNode, { kind: 'retaining-ring' }>).row, 'DIN471-20');
  const notes = notesOf(doc);
  assert.ok(!notes.some(t => /an estimate: your ring's row/.test(t)), JSON.stringify(notes));
  assert.ok(notes.includes('Its groove checked against your ring row (the maker\'s sheet)'), JSON.stringify(notes));
  // Without a row it stays an estimate, said so.
  assert.ok(notesOf(ring(shaft).doc).some(t => /an estimate: your ring's row/.test(t)));
});

test('ring rows refused: a row for another groove (the kernel\'s RING_FIT), a row gone (RING_ROW_UNKNOWN), a bad row, a used row removed', () => {
  const shaft = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  const other = editRingRows(shaft, [{ ...ROW, id: 'wide', grooveWidth: 1.6 }]); assert.ok('doc' in other);
  const r1 = evaluateDoc(ring(other.doc, { row: 'wide' }).doc, 3);
  assert.ok(!r1.ok && /RING_FIT.*groove 1\.6 mm wide/.test(r1.error.detail), r1.ok ? 'built' : r1.error.detail);
  const withRow = editRingRows(shaft, [ROW]); assert.ok('doc' in withRow);
  const used = ring(withRow.doc).doc, gone = { ...used, rings: { version: 1 as const, rows: [] } };
  const r2 = evaluateDoc(gone, 4);
  assert.ok(!r2.ok && /\[RING_ROW_UNKNOWN\].*"DIN471-20"/.test(r2.error.detail), r2.ok ? 'built' : r2.error.detail);
  assert.match(String((editRingRows(used, [], ['DIN471-20']) as { error: string }).error), /used by a retaining ring/);
  assert.match(String(checkRingRow({ id: 'x', shaftDiameter: 20, grooveDiameter: 19, grooveWidth: 1.3 })[0]?.message), /cite its source or say estimate: true/);
  assert.match(String(checkRingRow({ ...ROW, grooveDiameter: 21 })[0]?.message), /below the shaft's/);
  assert.match(String(checkRingRow({ ...ROW, thickness: 1 })[0]?.message), /unknown field thickness/);
});
