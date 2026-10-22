import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editRingRows } from '../src/engine/rings';
import { bomPanelData, purchaseCsv, setBought } from '../src/team/bom';

// O147 B1: the BOM panel's data (S1's BOM, a part alone as its own line, the made elements), the bought/made choice on
// every node a line merges (one change), and the purchase list as CSV.
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const evaluated = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies; };
const evaluate = async (d: StudioDoc) => evaluateDoc(d, 2);
function run(doc: StudioDoc, id: string, pick: { bodies?: number[]; face?: string }, values: Record<string, number | string> = {}) {
  const bodies = evaluated(doc);
  const faces = pick.face ? [(() => { const body = bodies.findIndex(b => b.mesh.faces.some(f => f.name === pick.face)); return { body, face: bodies[body].mesh.faces.findIndex(f => f.name === pick.face) }; })()] : [];
  const ctx: Ctx = { doc, bodies, selection: { faces, edges: [], bodies: (pick.bodies ?? []).map(node => bodies.findIndex(b => b.ref?.node === node)) } }, c = cmd(id), ok = c.available(ctx);
  assert.ok(ok.ok, ok.ok ? '' : `${id}: ${ok.reason}`);
  return c.build!(ctx, { ...c.defaults!(ctx), ...values });
}
function part(withRow = true): StudioDoc {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  doc = { ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...(n as Extract<ModelNode, { kind: 'shaft' }>), holes: [{ diameter: 4, at: 80 }] } : n) };
  doc = run(doc, 'key', { bodies: [0] }, { h: 6 });
  if (withRow) { const t = editRingRows(doc, [{ id: 'r20', shaftDiameterMM: 20, grooveDiameterMM: 19, grooveWidthMM: 1.3, source: 'the maker\'s sheet' }]); assert.ok('doc' in t); doc = t.doc; }
  doc = run(doc, 'retaining-ring', { bodies: [0] });
  return run(doc, 'pin', { bodies: [0] });
}
const asm = (p: StudioDoc): StudioDoc => ({ ...emptyDoc(), instances: [0, 1].map(k => ({ id: `i${k}`, name: `shaft ${k}`, doc: p, position: [0, 60 * k, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] })) });

test('the panel: 2 copies — the part ×2, key, ring and pin ×2; the shaft a made element ×2; the purchase list 3 rows, 4 with made parts (+ the shaft)', async () => {
  const d = await bomPanelData(asm(part()), evaluate);
  assert.deepEqual(d.bom.lines.map(l => [l.item, l.qty]), [['shaft 0', 2], ['key 6 × 6 × 18', 2], ['retaining-ring Ø19 / Ø24 × 1.2', 2], ['pin Ø4 × 20', 2]]);
  assert.deepEqual(d.made.map(m => [m.kind, m.qty, m.parts]), [['shaft', 2, ['i0:n0', 'i1:n0']]]);
  const csv = purchaseCsv(d).trim().split('\n');
  assert.deepEqual(csv, ['item no.,item,qty,kind,size,row,catalogue,source,estimate', '2,key 6 × 6 × 18,2,key,6 × 6 × 18,,,,', '3,retaining-ring Ø19 / Ø24 × 1.2,2,retaining-ring,Ø19 / Ø24 × 1.2,r20,,the maker\'s sheet,', '4,pin Ø4 × 20,2,pin,Ø4 × 20,,,,']);
  const all = purchaseCsv(d, true).trim().split('\n');
  assert.deepEqual(all.slice(4), ['1,shaft 0,2,part,,,,,', '5,shaft 3 steps Ø20–Ø25 × 95,2,shaft,3 steps Ø20–Ø25 × 95,,,,']);
  // (A ring with no row: its line an estimate.)
  const e = await bomPanelData(asm(part(false)), evaluate);
  assert.match(purchaseCsv(e), /retaining-ring.*,estimate\n/);
});

test('the bought/made choice: written on every copy\'s node the line merges, one change — the key made leaves the BOM and the list; default clears it', async () => {
  const doc = asm(part()), d = await bomPanelData(doc, evaluate), key = d.bom.lines.find(l => l.kind === 'key')!;
  const made = setBought(doc, key.parts, false);
  assert.deepEqual(made.instances!.map(i => i.doc.nodes.find(n => n.kind === 'key')!.bought), [false, false]);
  const after = await bomPanelData(made, evaluate);
  assert.ok(!after.bom.lines.some(l => l.kind === 'key'));
  assert.deepEqual(after.made.filter(m => m.kind === 'key').map(m => [m.qty, m.override]), [[2, true]]);
  assert.ok(!purchaseCsv(after).includes('key 6'));
  const back = setBought(made, after.made.find(m => m.kind === 'key')!.parts, null);
  assert.deepEqual(back.instances!.map(i => 'bought' in i.doc.nodes.find(n => n.kind === 'key')!), [false, false]);
  // (A part alone: its own line.)
  const single = await bomPanelData(part(), evaluate, 'shaft');
  assert.deepEqual(single.bom.lines.map(l => [l.item, l.qty]).slice(0, 2), [['shaft', 1], ['key 6 × 6 × 18', 1]]);
});
