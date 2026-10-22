import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editORingRows } from '../src/engine/orings';
import { editRingRows } from '../src/engine/rings';
import { tableContent } from '../src/drawing/tables';
import { cellText, type TableContent } from '../src/drawing/table';
import { drawingInputs } from '../src/chat/drawing';
import { issueContext } from '../src/drawing/issues';
import { readDrawing } from '../src/drawing/types';
import { sheetSvg } from '../src/drawing/svg';
import { sheetPdf } from '../src/drawing/pdf';
import { sheetDxf } from '../src/drawing/dxf';
import { dxfText } from '@barocss/cad';

// R12c on drawings, S2 (O144): the 'elements', 'springs' and 'glands' table sources. Oracles: the shaft-parts scene's
// element lines (O143); the default spring's figures (D153: wire Ø2, mean Ø20, outer 22, 6 active of 8, pitch 5, solid
// 16.0081, closed and ground, right hand, k = Gd⁴/(8D³n) with G 79 300 an estimate); the piston gland's (D159's S0:
// 214 at 24.99 × 3.53, groove Ø25.5 × 4.7 × 2.8, stretch 2.0, squeeze 20.7, fill 73.1 %, judged by Fictiv's estimates).
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const evaluated = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies; };
function run(doc: StudioDoc, id: string, pick: { bodies?: number[]; face?: string }, values: Record<string, number | string> = {}) {
  const bodies = evaluated(doc);
  const faces = pick.face ? [(() => { const body = bodies.findIndex(b => b.mesh.faces.some(f => f.name === pick.face)); return { body, face: bodies[body].mesh.faces.findIndex(f => f.name === pick.face) }; })()] : [];
  const ctx: Ctx = { doc, bodies, selection: { faces, edges: [], bodies: (pick.bodies ?? []).map(node => bodies.findIndex(b => b.ref?.node === node)) } }, c = cmd(id), ok = c.available(ctx);
  assert.ok(ok.ok, ok.ok ? '' : `${id}: ${ok.reason}`);
  return c.build!(ctx, { ...c.defaults!(ctx), ...values });
}
const content = (doc: StudioDoc, from: string) => { const t = tableContent({ id: from, from }, { doc, bodies: evaluated(doc) }); assert.ok(!('error' in t), JSON.stringify(t)); return t as TableContent; };
const shown = (t: TableContent) => t.rows.map(r => r.map((v, i) => cellText(v, t.columns[i])));
function shaftScene(): StudioDoc {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  doc = { ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...(n as Extract<ModelNode, { kind: 'shaft' }>), holes: [{ diameter: 4, at: 80 }] } : n) };
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 20, ri: 10, h: 22, x: 0, y: 0, z: 4 });
  doc = run(doc, 'keyway', { face: `n${doc.nodes.length - 1}.hole0.side0` }, { b: 6, t2: 2.8 });
  doc = run(doc, 'key', { bodies: [0] }, { h: 6 });
  const t = editRingRows(doc, [{ id: 'r20', shaftDiameterMM: 20, grooveDiameterMM: 19, grooveWidthMM: 1.3, source: 'the maker\'s sheet' }]); assert.ok('doc' in t);
  doc = run(t.doc, 'retaining-ring', { bodies: [0] });
  return run(doc, 'pin', { bodies: [0] });
}
const spring = () => { const c = cmd('spring'); return c.build!(blank, { ...c.defaults!(blank), x: 0, y: 0, z: 0, F: 20 }); };
function gland(): StudioDoc {
  const c = cmd('cylinder'); let doc = c.build!(blank, { ...c.defaults!(blank), r: 15.5, h: 20, x: 0, y: 0, z: 0 });
  doc = (editORingRows(doc, [{ id: '214', dash: '2-214', insideDiameterMM: 24.99, crossSectionMM: 3.53, source: 'O1 (D139)' }]) as { doc: StudioDoc }).doc;
  return run(doc, 'oring-gland', { face: 'n1.side0' }, { seal: 31.1, dg: 25.5, w: 4.7, at: 6 });
}

test('the element list: each machine element — kind, our size, the user\'s row and source, bought or made, estimate — and its notes', () => {
  const t = content(shaftScene(), 'elements');
  assert.equal(t.title, 'MACHINE ELEMENTS');
  assert.deepEqual(shown(t).map(r => r.slice(0, 7)), [
    ['n0', 'shaft', '3 steps Ø20–Ø25 × 95', '—', '—', 'made', ''], ['n3', 'keyway', '6 × 2.8 in Ø20', '—', '—', 'made', ''], ['n4', 'key', '6 × 6 × 18', '—', '—', 'bought', 'est.'],
    ['n5', 'retaining-ring', 'Ø19 / Ø24 × 1.2', 'r20', 'the maker\'s sheet', 'bought', ''], ['n6', 'pin', 'Ø4 × 20', '—', '—', 'bought', '']]);
  assert.match(t.notes!.at(-1)!, /none built in/);
  // (A spring's G estimate: marked, and said under the table.)
  const s = content(spring(), 'elements');
  assert.deepEqual([s.rows[0][6], s.notes![0]], ['est.', 'n0: its shear modulus G is an estimate']);
});

test('the spring data: the default spring\'s figures as D153 gives them, its rate Gd⁴/(8D³n), its G an estimate said', () => {
  const t = content(spring(), 'springs'), r = shown(t)[0];
  assert.equal(t.title, 'SPRING DATA');
  const L0 = 2 * 2.0010139858630147 + 30, k = 79300 * 16 / (8 * 8000 * 6);
  assert.deepEqual(r, ['n0', 'compression', '2.00', '20.00', '22.00', '6.00', '8.00', L0.toFixed(2), '5.000', '16.01', 'closed-ground', 'right', k.toFixed(3)]);
  assert.ok(t.notes!.includes('n0: G 79300 MPa, an estimate'), JSON.stringify(t.notes));
});

test('the gland table: the piston gland at D159\'s S0 sizes — stretch 2.0, squeeze 20.7 (20.0 stretched), fill 73.1 % stretched; the ranges with their source, an estimate; its fill warning', () => {
  const t = content(gland(), 'glands'), r = shown(t)[0];
  assert.deepEqual(r, ['n2', 'piston', '214', '24.99', '3.53', '25.500', '4.700', '2.800', '2.0', '20.7', '20.0', '73.1']);
  assert.ok(t.notes!.some(n => /^Judged by: squeeze 18–25 %, fill 75–85 %, stretch up to 5 % — Fictiv.*\(an estimate\)$/.test(n)), JSON.stringify(t.notes));
  assert.ok(t.notes!.some(n => /^n2: fill 73\.135 % outside 75–85 %/.test(n)), JSON.stringify(t.notes));
});

test('a part without them: each table NOT AVAILABLE, saying why; written: the tables in the SVG, the PDF and the DXF', () => {
  const plate = cmd('box').build!(blank, cmd('box').defaults!(blank));
  for (const [from, why] of [['elements', /no machine elements/], ['springs', /no springs/], ['glands', /no O-ring glands/]] as const) {
    const t = tableContent({ id: from, from }, { doc: plate, bodies: evaluated(plate) });
    assert.ok('error' in t && why.test(t.error), JSON.stringify(t));
  }
  const doc = spring(), settings = { ...readDrawing(doc.drawing), sheet: 'A3' as const, tables: [{ id: 'springs', from: 'springs' }, { id: 'elements', from: 'elements' }] };
  const i = drawingInputs(doc, settings); assert.ok(typeof i !== 'string', String(i));
  const ctx = issueContext({ ...i, meta: { ...i.meta, date: '2026-10-22' } });
  const texts = ctx.sheet.groups.filter(g => g.role === 'table').flatMap(g => g.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text));
  for (const t of ['SPRING DATA', 'MACHINE ELEMENTS', 'WIRE Ø [mm]', 'RATE [N/mm]', 'closed-ground']) assert.ok(texts.includes(t), `on the sheet: ${t} (${texts.join(' | ')})`);
  const svg = sheetSvg(ctx.sheet, 'spring'), pdf = new TextDecoder('latin1').decode(sheetPdf(ctx.sheet, 'spring')), dxf = sheetDxf(ctx.sheet, ctx.layout);
  for (const t of ['SPRING DATA', 'MACHINE ELEMENTS', 'closed-ground', 'RATE [N/mm]']) {
    assert.ok(svg.includes(`>${t}<`), `SVG: ${t}`); assert.ok(pdf.includes(`(${t}) Tj`), `PDF: ${t}`); assert.ok(dxf.text.includes(`\n${dxfText(t, false)}\n`) || dxf.text.includes(`\n${dxfText(t, true)}\n`), `DXF: ${t}`);
  }
});
