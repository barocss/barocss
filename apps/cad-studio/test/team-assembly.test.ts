import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool } from '@barocss/cad-model/chat/tools';
import { bomView, checkAssembly, checkBom, deriveBom } from '@barocss/cad-model/team/assembly';
import { runPartsScenario, type PartsScenario } from '../src/team/scripted';

// A8.4 (O36): the Assembly integrator's whole-assembly gate and the BOM agent. A part moved after its acceptance caught
// (PATTERN_MISALIGNED); parts in face contact not passed (undecided or meeting); the total mass; the BOM derived from a
// built view and checked against the assembly — every instance once, the quantities, the totals, a library part's
// source — its seeded defects refused.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a8/scenarios');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const clean = async () => (await runPartsScenario(JSON.parse(readFileSync(join(CASES, 'parts-clean.json'), 'utf8')) as PartsScenario, evaluate)).final;

test('the whole-assembly gate: clean passes with its mass; a part moved off the shared pattern after acceptance is caught; a part resting on another is not passed', async () => {
  const doc = await clean(), ok = await checkAssembly(doc, evaluate);
  assert.equal(ok.verdict, 'pass', JSON.stringify(ok.findings));
  // (Both aluminium, assumed: 60·40·10 less two Ø4 holes, and 60·40·2 less two: 2.7 g/cm³.)
  const want = 2.7e-3 * (60 * 40 * 10 - 2 * Math.PI * 4 * 10 + 60 * 40 * 2 - 2 * Math.PI * 4 * 2);
  // (massProperties gives grams to 3 decimals: each part to ±0.0005 g.)
  assert.ok(Math.abs(ok.massG - want) <= 2 * 0.0005 + 1e-9, `${ok.massG} vs ${want}`);
  // (The board moved 2 mm along X — an assembly change after its acceptance: off the pattern.)
  const moved: StudioDoc = { ...doc, instances: doc.instances!.map(i => (i.id === 'p2' ? { ...i, position: [2, 0, 20] as [number, number, number] } : i)) };
  const m = await checkAssembly(moved, evaluate);
  assert.equal(m.verdict, 'fail'); assert.deepEqual(m.findings.map(f => [f.code, f.entities]), [['PATTERN_MISALIGNED', ['p2']]]);
  // (The board set down on the bracket, face to face at z 10: they share the pattern H1 — expected contact, named, passed.)
  const resting: StudioDoc = { ...doc, instances: doc.instances!.map(i => (i.id === 'p2' ? { ...i, position: [0, 0, 10] as [number, number, number] } : i)) };
  const r = await checkAssembly(resting, evaluate);
  assert.equal(r.verdict, 'pass', JSON.stringify(r.findings)); assert.deepEqual(r.findings.map(f => [f.code, f.message]), [['EXPECTED_CONTACT', 'p1 and p2 touch, as the hole pattern H1 puts them together']]);
  // (A third part resting on the bracket with nothing declared: undecided, held — PARTS_TOUCH.)
  const lid = (await dispatchTool({ doc: resting, bodies: [] }, 'add_part', { name: 'lid', position: [0, 0, 12] }, evaluate)).state;
  const built = (await dispatchTool(lid, 'run_command', { command: 'box', values: { w: 10, d: 10, h: 2, x: 0, y: 0, z: 0 }, part: 'p3' }, evaluate)).state.doc;
  const u = await checkAssembly(built, evaluate);
  assert.equal(u.verdict, 'undecided'); assert.deepEqual(u.findings.map(f => [f.code, f.entities]), [['EXPECTED_CONTACT', ['p1', 'p2']], ['PARTS_TOUCH', ['p2', 'p3']]]);
  // (A mate declares it: expected contact too.)
  const mated: StudioDoc = { ...built, mates: [{ id: 'm1', kind: 'coincident', a: { part: 'p2', face: 'n1.top' }, b: { part: 'p3', face: 'n1.bottom' } } as never] };
  const v = await checkAssembly(mated, evaluate);
  assert.equal(v.verdict, 'pass', JSON.stringify(v.findings)); assert.ok(v.findings.some(f => f.code === 'EXPECTED_CONTACT' && /the mate m1/.test(f.message)));
});

test('the BOM agent on a built view: derived lines (identical parts on one line), checked against the assembly; its seeded defects refused; a library part\'s source named', async () => {
  let doc = await clean();
  // (A second board, a copy: one line of two.)
  const st = (await dispatchTool({ doc, bodies: [] }, 'add_part', { name: 'board', copy_of: 'p2', position: [0, 0, 40] }, evaluate)).state;
  doc = st.doc;
  const view = await bomView(doc, evaluate), bom = deriveBom(view);
  assert.deepEqual(bom.lines.map(l => [l.item, l.qty, l.parts]), [['bracket', 1, ['p1']], ['board', 2, ['p2', 'p3']]]);
  assert.equal(bom.totalQty, 3); assert.deepEqual(checkBom(view, bom), []);
  assert.ok(Object.isFrozen(view) === false && !JSON.stringify(view).includes('function'), 'a plain view');
  // (Seeded defects: a part dropped, a quantity wrong, a part twice, a total off.)
  const dropped = { ...bom, lines: bom.lines.slice(0, 1) }, qty = { ...bom, lines: bom.lines.map(l => ({ ...l, qty: l.qty + 1 })) }, twice = { ...bom, lines: [...bom.lines, bom.lines[0]] }, total = { ...bom, totalMassG: bom.totalMassG + 1 };
  assert.match(checkBom(view, dropped).join(), /p2 \(board\) is on 0 lines/); assert.match(checkBom(view, qty).join(), /quantity 2, 1 parts/);
  assert.match(checkBom(view, twice).join(), /p1 \(bracket\) is on 2 lines/); assert.match(checkBom(view, total).join(), /total mass/);
  // (A library part: its line names the library, version, part and variant; a BOM without it is refused.)
  const lib = (await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'insert_part', { library: 'tslot-20', part: 'profile', variant: '2020' }, evaluate)).state.doc;
  const lv = await bomView(lib, evaluate), lb = deriveBom(lv);
  assert.equal(lb.lines[0].source, 'tslot-20@0.1.0/profile:2020'); assert.deepEqual(checkBom(lv, lb), []);
  assert.match(checkBom(lv, { ...lb, lines: lb.lines.map(l => ({ ...l, source: null })) }).join(), /a library part with no source/);
});
