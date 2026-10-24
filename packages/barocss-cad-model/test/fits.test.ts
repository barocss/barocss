import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { evaluatedPart } from '../src/engine/wireDoc';
import { commands, type Ctx } from '../src/app/commands';
import { editFitTables } from '../src/engine/fits';
import { runTool, type ChatState } from '../src/chat/tools';

// R12c.2 (D155) in the studio: the user's fit tables (none built in), a class on a face, a declared pair. The rows are
// the Ø20–Ø30 range of a test table, flagged estimates (test values); the clearances follow by arithmetic, the
// overlaps at the limit sizes πL(r_s² − r_h²) (the kernel test's oracle, packages/barocss-cad/test/r12c-fits.test.mjs).

const TABLE = { id: 'shop-fits', rows: [
  { class: 'H7', over: 10, upTo: 18, upperUM: 18, lowerUM: 0, estimate: true }, { class: 'g6', over: 10, upTo: 18, upperUM: -6, lowerUM: -17, estimate: true },
  { class: 'p6', over: 10, upTo: 18, upperUM: 29, lowerUM: 18, estimate: true }] };
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
/** A tube with a Ø12 bore, 24 long, and a Ø12 pin through it (z −5 to 19), its centre `dx` off along X. */
function parts(dx = 0): StudioDoc {
  const tube = commands.find(c => c.id === 'tube')!, cyl = commands.find(c => c.id === 'cylinder')!;
  const a = tube.build!(blank, { ...tube.defaults!(blank), r: 10, ri: 6, h: 24, x: 0, y: 0, z: 0 });
  return cyl.build!({ ...blank, doc: a }, { ...cyl.defaults!(blank), r: 6, h: 24, x: dx, y: 0, z: -5 });
}
/** Run a command with faces picked by name. */
function run(doc: StudioDoc, id: string, faces: string[], values: Record<string, string>) {
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const sel = faces.map(n => { const body = r.bodies.findIndex(b => b.mesh.faces.some(f => f.name === n)); return { body, face: r.bodies[body].mesh.faces.findIndex(f => f.name === n) }; });
  const ctx: Ctx = { doc, bodies: r.bodies, selection: { faces: sel, edges: [], bodies: [] } }, cmd = commands.find(c => c.id === id)!, ok = cmd.available(ctx);
  assert.ok(ok.ok, ok.ok ? '' : ok.reason);
  return cmd.build!(ctx, { ...cmd.defaults!(ctx), ...values });
}

test('Fits (R12c.2): no table, no class — the user loads one; classes on the bore and the pin, a pair — the limits and the check in the notes', () => {
  let doc = parts();
  const r0 = evaluateDoc(doc, 1); assert.ok(r0.ok);
  const fc = commands.find(c => c.id === 'fit-class')!, bore = r0.bodies[0].mesh.faces.findIndex(f => f.name === 'n1.hole0.side0');
  const before = fc.available({ doc, bodies: r0.bodies, selection: { faces: [{ body: 0, face: bore }], edges: [], bodies: [] } });
  assert.ok(!before.ok && /Load a fit table first .* none is built in/.test(before.reason));
  const loaded = editFitTables(doc, [TABLE]); assert.ok('doc' in loaded); doc = loaded.doc;
  assert.match(String((editFitTables(doc, [{ id: 'x', rows: [{ class: 'H7', over: 10, upTo: 18, upperUM: 18, lowerUM: 0 }] }]) as { error: string }).error), /\[FIT_TABLE\].*never neither/);
  doc = run(doc, 'fit-class', ['n1.hole0.side0'], { class: 'H7' });
  doc = run(doc, 'fit-class', ['n3.side0'], { class: 'g6' });
  doc = run(doc, 'fit-pair', ['n3.side0', 'n1.hole0.side0'], {});
  assert.deepEqual(doc.fits!.pairs, [{ hole: 'n1.hole0.side0', shaft: 'n3.side0' }]);
  const r = evaluateDoc(doc, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const tube = r.bodies[0].notes!.map(n => n.text), pin = r.bodies[1].notes!;
  assert.ok(tube.some(t => t === 'n1.hole0.side0: Ø12 H7 +0.018/0 mm — 12 to 12.018 (shop-fits row 0, an estimate)'), JSON.stringify(tube));
  assert.ok(pin.some(n => n.text.startsWith('n3.side0: Ø12 g6 −0.006/−0.017 mm — 11.983 to 11.994') && n.warning));
  assert.ok(pin.some(n => /^Fit n1\.hole0\.side0 \/ n3\.side0: H7\/g6 at Ø12: clearance fit, clearance \+6 to \+35 µm; at MMC clear, at LMC clear \(by the Boolean at the limit sizes, over 19 mm\)/.test(n.text)), JSON.stringify(pin));
  // An interference class on the pin: at MMC πL((6.0145)² − 6²), at LMC πL((6.009)² − (6.009)²) = 0 (line to line).
  const p6 = run(doc, 'fit-class', ['n3.side0'], { class: 'p6' }), rp = evaluateDoc(p6, 3); assert.ok(rp.ok, rp.ok ? '' : rp.error.detail);
  const mmc = Math.PI * 19 * (6.0145 ** 2 - 36);  // (the faces share z 0 to 19)
  assert.ok(rp.bodies[1].notes!.some(n => n.text.includes(`interference fit, clearance -29 to 0 µm; at MMC ${+mmc.toPrecision(4)} mm³ interfering, at LMC clear`)), JSON.stringify(rp.bodies[1].notes));
  // The fits cross to the engine worker with the part.
  assert.deepEqual(evaluatedPart(doc).fits, doc.fits);
});

test('Fits (R12c.2) refusals: a size the table lacks names the row to load; a hole\'s class on the pin; the pin off the bore\'s axis contradicts the clearance fit', () => {
  let doc = (editFitTables(parts(), [TABLE]) as { doc: StudioDoc }).doc;
  doc = run(doc, 'fit-class', ['n1.hole0.side0'], { class: 'H7' }); doc = run(doc, 'fit-class', ['n3.side0'], { class: 'g6' });
  // The tube's outside, Ø20, with H7: no row over 18.
  const big = { ...doc, fits: { ...doc.fits!, faces: [...doc.fits!.faces!, { face: 'n1.side0', class: 'g6' }] } }, rb = evaluateDoc(big, 1);
  assert.ok(!rb.ok && rb.error.title === 'A fit class has no row in your fit tables' && /load a row for g6 whose range holds 20 mm/.test(rb.error.detail), rb.ok ? 'built' : rb.error.detail);
  const wrong = { ...doc, fits: { ...doc.fits!, faces: [{ face: 'n3.side0', class: 'H7' }] } }, rw = evaluateDoc(wrong, 2);
  assert.ok(!rw.ok && /\[FIT_FACE\] n3\.side0 is a shaft's face/.test(rw.error.detail), rw.ok ? 'built' : rw.error.detail);
  // Off by 0.01 mm: more than H7/g6's least clearance a side (3 µm) — at MMC the pin runs into the bore.
  let off = (editFitTables(parts(0.01), [TABLE]) as { doc: StudioDoc }).doc;
  off = run(off, 'fit-class', ['n1.hole0.side0'], { class: 'H7' }); off = run(off, 'fit-class', ['n3.side0'], { class: 'g6' }); off = run(off, 'fit-pair', ['n1.hole0.side0', 'n3.side0'], {});
  const ro = evaluatePart(off, 4);
  assert.ok(!ro.ok && ro.error.title === 'The fit does not hold' && /contradicted by the geometry: at MMC the shaft overlaps the hole/.test(ro.error.detail), ro.ok ? 'built' : ro.error.detail);
});

test('Fits (R12c.2) in the chat: fit-class and fit-pair are v2 features commands, their values behind describe', async () => {
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1), state: ChatState = { doc: emptyDoc(), bodies: [] };
  for (const c of ['fit-class', 'fit-pair']) { const d = await runTool(state, 'describe', { command: c }, evaluate); assert.ok(!d.isError, d.content); }
  assert.match((await runTool(state, 'describe', { command: 'fit-class' }, evaluate)).content, /none built in/);
});
