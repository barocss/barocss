import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { elementLines } from '../src/engine/elements';
import { bomPanelDataOf, purchaseCsv } from '../src/bom/bom';
import { checkBom } from '../src/team/assembly';
import { weldList, weldListTable } from '../src/frames/welds';

// FRk1 (D165) on the outer lane's side: a frame's gusset and end cap are made plates — elements with their sizes, BOM
// lines of their own (thickness, area, volume, material; merged over copies), out of the made-elements list — and their
// seams are weld joints (`<plate>.<member>`): the gusset's two, 105 and 85 on the mitred L's members, the cap's round
// its member's free end, sizes estimated as the thinner of plate and wall.
const gusset = commands.find(c => c.id === 'gusset')!, cap = commands.find(c => c.id === 'end-cap')!;
const SHARP = { kind: 'rect-tube' as const, width: 40, height: 40, wall: 3, outerRadius: 0 };
const L = (): StudioDoc => withNode(emptyDoc(), { kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section: SHARP, corners: { default: 'mitre' } });
const evaluated = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r; };
const ctxOf = (doc: StudioDoc, bodies: number[]): Ctx => ({ doc, bodies: evaluated(doc).bodies, selection: { bodies, faces: [], edges: [] } });
function part(): StudioDoc {
  let doc = L();
  doc = gusset.build!(ctxOf(doc, [0, 1]), { ...gusset.defaults!(ctxOf(doc, [0, 1])), l1: 120, clip: 15 });
  return cap.build!(ctxOf(doc, [0]), { end: 'start', fit: 'over', t: 4 });
}

test('FRk1 plates as elements and BOM lines: the gusset (5 thick, 5887.5 mm²) and the end cap (4 thick, 1600 mm²) — sizes in the element lines, plate lines of their own (made), checked; two copies merged ×2; not among the made elements', () => {
  const doc = part(), bodies = evaluated(doc).bodies;
  const lines = elementLines(doc, bodies).filter(l => l.kind === 'gusset' || l.kind === 'end-cap');
  assert.deepEqual(lines.map(l => [l.kind, l.size, l.bought]), [['gusset', 'plate 5 thick, legs 120 × 100, clipped 15', false], ['end-cap', 'plate 4 thick, over, 1600 mm²', false]]);
  const one = bomPanelDataOf(doc, d => evaluateDoc(d, 1), 'frame');
  const plates = one.bom.lines.filter(l => l.plate);
  assert.deepEqual(plates.map(l => [l.item, l.qty, l.plate!.thickness, l.plate!.area, l.plate!.volume]), [['gusset plate 5 mm', 1, 5, 5887.5, 29437.5], ['end-cap plate 4 mm', 1, 4, 1600, 6400]]);
  assert.equal(one.bom.plateQty, 2);
  assert.deepEqual(checkBom(one.view, one.bom), []);
  assert.ok(!one.made.some(m => m.kind === 'gusset' || m.kind === 'end-cap'), 'plates are not made elements as well');
  // (The purchase list: not bought; with made parts, their rows by kind and size.)
  assert.ok(!purchaseCsv(one).includes('plate'));
  assert.deepEqual(purchaseCsv(one, true).trim().split('\n').slice(2), ['2,gusset plate 5 mm,1,gusset,"5 mm plate, 5887.5 mm²",,,,', '3,end-cap plate 4 mm,1,end-cap,"4 mm plate, 1600 mm²",,,,']);
  // (Two copies: each plate line ×2.)
  const asm: StudioDoc = { ...emptyDoc(), instances: [0, 1].map(k => ({ id: `i${k}`, name: `frame ${k}`, doc, position: [0, 900 * k, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] })) };
  const two = bomPanelDataOf(asm, d => evaluateDoc(d, 1));
  assert.deepEqual(two.bom.lines.filter(l => l.plate).map(l => [l.item, l.qty, l.parts]), [['gusset plate 5 mm', 2, ['i0:n1', 'i1:n1']], ['end-cap plate 4 mm', 2, ['i0:n2', 'i1:n2']]]);
  assert.deepEqual(checkBom(two.view, two.bom), []);
});

test('FRk1 seams as weld joints: the gusset\'s on each member (105, 85), the cap\'s round member 1\'s start (160), `<plate>.<member>`; sizes the thinner of plate and wall (3, an estimate); the cap a corner (butt) weld by default; in the weld list table', () => {
  const doc = part(), bodies = evaluated(doc).bodies, w = weldList(doc, bodies);
  const key = (node: number) => bodies.find(b => b.ref?.node === node && !b.cutPiece)!.key, m = bodies.filter(b => b.cutPiece).map(b => b.key);
  const plates = w.joints.filter(j => j.kind === 'gusset' || j.kind === 'cap');
  assert.deepEqual(plates.map(j => [j.id, j.kind, j.seamLength, j.end, j.weld.kind, j.weld.size, j.weld.sizeBasis, j.seamBasis]), [
    [`${key(1)}.${m[0]}`, 'gusset', 105, null, 'fillet', 3, 'estimate', 'exact'],
    [`${key(1)}.${m[1]}`, 'gusset', 85, null, 'fillet', 3, 'estimate', 'exact'],
    // (A cap sits flush with its member's outline: a corner weld by default, not a fillet — FRk2's rule.)
    [`${key(2)}.${m[0]}`, 'cap', 160, 'start', 'butt', 3, 'estimate', 'exact'],
  ]);
  assert.ok(plates.every(j => j.face), 'each on a face of its member');
  assert.ok(w.joints.some(j => j.kind === 'mitre'), 'the corner\'s mitre joint stays');
  const t = weldListTable(w, new Map());
  assert.deepEqual(t.rows.map(r => r[1]).filter(x => x !== 'MITRE'), ['GUSSET', 'GUSSET', 'END CAP']);
});
