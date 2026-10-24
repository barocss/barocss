import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { readDrawing } from '../src/drawing/types';
import { deviation, fitCallout, withFit } from '../src/drawing/fits';
import { sheetDxf } from '../src/io/dxf';
import { sheetSvg } from '../src/io/svg';

// D155 with the outer lane (the kernel lane's request): fit callouts on the drawing and the fit_clearance query, from
// the user's tables — the kernel test's tube (a Ø12 bore, H7 +18/0) and pin (Ø12, g6 −6/−17), rows flagged estimates:
// the callout Ø12 H7/g6 (+0.018/0, -0.006/-0.017) (est.); the clearance 0 − (−6) = 6 to 18 − (−17) = 35 µm; a pin
// 0.01 off the bore's axis contradicted at MMC (3 µm of radial clearance); a class with no row a typed issue.

const TABLE = { id: 'shop-fits', rows: [{ class: 'H7', over: 10, upTo: 18, upper: 0.018, lower: 0, estimate: true }, { class: 'g6', over: 10, upTo: 18, upper: -0.006, lower: -0.017, estimate: true }] };
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
function parts(dx = 0, cls: { hole: string; shaft: string } = { hole: 'H7', shaft: 'g6' }, pair = true): StudioDoc {
  const tube = commands.find(c => c.id === 'tube')!, cyl = commands.find(c => c.id === 'cylinder')!;
  const a = tube.build!(blank, { ...tube.defaults!(blank), r: 10, ri: 6, h: 24, x: 0, y: 0, z: 0 });
  const d = cyl.build!({ ...blank, doc: a }, { ...cyl.defaults!(blank), r: 6, h: 24, x: dx, y: 0, z: -5 });
  return { ...d, fits: { version: 1, tables: [TABLE], faces: [{ face: 'n1.hole0.side0', class: cls.hole }, { face: 'n3.side0', class: cls.shaft }], ...(pair ? { pairs: [{ hole: 'n1.hole0.side0', shaft: 'n3.side0' }] } : {}) } };
}
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const state = (doc: StudioDoc): ChatState => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return { doc, bodies: r.bodies }; };

test('D155 callouts: a face\'s class alone Ø12 H7 (+0.018/0) (est.); a declared pair Ø12 H7/g6 (+0.018/0, -0.006/-0.017) (est.); the deviations as drawings write them; a face with no class, none', () => {
  assert.deepEqual([deviation(0.018), deviation(0), deviation(-0.006), deviation(-0.017), deviation(0.025)], ['+0.018', '0', '-0.006', '-0.017', '+0.025']);
  const lone = parts(0, undefined, false), paired = parts();
  assert.deepEqual(fitCallout(lone, 'n1.hole0.side0|n1.top', 12), { text: 'H7 (+0.018/0) (est.)' });
  assert.deepEqual(fitCallout(paired, 'n1.hole0.side0|n1.top', 12), { text: 'H7/g6 (+0.018/0, -0.006/-0.017) (est.)' });
  assert.deepEqual(fitCallout(paired, 'n3.side0|n3.top', 12), { text: 'H7/g6 (+0.018/0, -0.006/-0.017) (est.)' }, 'the shaft\'s edge: the same pair');
  assert.equal(withFit(paired, () => null)('n1.hole0.side0|n1.top', 12), 'Ø12 H7/g6 (+0.018/0, -0.006/-0.017) (est.)');
  assert.equal(withFit(paired, () => 'Ø12 THRU')('n1.hole0.side0|n1.top', 12), 'Ø12 THRU H7/g6 (+0.018/0, -0.006/-0.017) (est.)');
  assert.equal(fitCallout(paired, 'n1.side0|n1.top', 20), null);
});

test('D155 on the sheet: the bore\'s auto diameter reads its fit; a class with no row for the size (H8, none loaded) — its class alone and FIT_ROW_MISSING in the issue list, saying what to load', async () => {
  // (The model's evaluation refuses a class with no row (the kernel lane's D155); the drawing is built from the bodies'
  // B-reps without it, so it meets a class whose row went — here the bore's class changed to H8 after its dimensions.)
  const s = state(parts()), dimensioned = await dispatchTool(s, 'auto_dimension', {}, evaluate); assert.ok(!dimensioned.isError, dimensioned.content);
  for (const [cls, missing] of [['H7', false], ['H8', true]] as const) {
    const doc: StudioDoc = { ...dimensioned.state.doc, fits: { ...dimensioned.state.doc.fits!, faces: [{ face: 'n1.hole0.side0', class: cls }, { face: 'n3.side0', class: 'g6' }] } };
    const i = drawingInputs(doc, readDrawing(doc.drawing)); assert.ok(typeof i !== 'string', String(i));
    const ctx = issueContext({ ...i, meta: { ...i.meta, date: '2026-10-22' } });
    const texts = ctx.sheet.groups.filter(g => g.role === 'dimension').flatMap(g => g.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text));
    const fit = texts.find(t => /H[78]\/g6/.test(t));
    assert.ok(fit, JSON.stringify(texts));
    const issues = drawingIssues(ctx).filter(x => x.code === 'FIT_ROW_MISSING');
    if (missing) { assert.match(fit!, /H8\/g6$/); assert.ok(issues.length >= 1 && /no row for H8 at Ø12 mm .*load a row for H8/.test(issues[0].message), JSON.stringify(issues)); }
    else { assert.match(fit!, /Ø12.* H7\/g6 \(\+0\.018\/0, -0\.006\/-0\.017\) \(est\.\)$/); assert.deepEqual(issues, []); }
  }
});

test('D155 fit_clearance: the faces — clearance, 6 to 35 µm, both rows estimates, clear at MMC and LMC; the classes at Ø12 — the same limits; at Ø30 — FIT_TABLE_MISS; the pin 0.01 off the axis — contradicted at MMC', async () => {
  const s = state(parts());
  let r = await dispatchTool(s, 'fit_clearance', { hole: 'n1.hole0.side0', shaft: 'n3.side0' }, evaluate); assert.ok(!r.isError, r.content);
  const out = JSON.parse(r.content);
  assert.deepEqual([out.kind, out.clearanceMin, out.clearanceMax, out.estimate, out.contradicted], ['clearance', 0.006, 0.035, true, false]);
  assert.deepEqual([out.hole.min, out.hole.max, out.shaft.min, out.shaft.max], [12, 12.018, 11.983, 11.994]);
  assert.deepEqual([out.hole.upper, out.hole.lower, out.shaft.upper, out.shaft.lower], [0.018, 0, -0.006, -0.017]);
  assert.ok(!('clearanceMinUM' in out) && !('clearanceMaxUM' in out), 'no legacy clearance aliases in public JSON');
  for (const limit of [out.hole, out.shaft]) assert.ok(!('upperUM' in limit) && !('lowerUM' in limit), 'no legacy deviation aliases');
  assert.match(out.message, /clearance \+6 to \+35 µm/, 'the explicitly labelled human message keeps micrometres');
  assert.equal(out.mmc.overlap, 0);
  r = await dispatchTool(s, 'fit_clearance', { hole_class: 'H7', shaft_class: 'g6', size: 12 }, evaluate); assert.ok(!r.isError, r.content);
  assert.deepEqual([JSON.parse(r.content).clearanceMin, JSON.parse(r.content).clearanceMax], [0.006, 0.035]);
  r = await dispatchTool(s, 'fit_clearance', { hole_class: 'H7', shaft_class: 'g6', size: 30 }, evaluate);
  assert.ok(r.isError); assert.match(JSON.parse(r.content).error, /^\[FIT_TABLE_MISS\] no row for H7 at Ø30 mm/);
  // (A declared pair the geometry contradicts refuses the model's evaluation (FIT_PAIR); the query reads two faces not declared.)
  const off = await dispatchTool(state(parts(0.01, undefined, false)), 'fit_clearance', { hole: 'n1.hole0.side0', shaft: 'n3.side0' }, evaluate);
  assert.ok(!off.isError, off.content); assert.equal(JSON.parse(off.content).contradicted, true);
});

const dxfPython = join(homedir(), '.cache/barocss-ezdxf/bin/python');
test('R7 fit units: ezdxf reads 12 mm and signed millimetre deviations at sheet scales 1 and 2', { skip: !existsSync(dxfPython) && 'ezdxf interpreter is not installed' }, async () => {
  // Physical oracle: hole 12 + [0, 18]/1000, shaft 12 + [-17, -6]/1000 mm.
  // These written limits and the model diameter must survive the producer's µm-to-mm contract change.
  const dimensioned = await dispatchTool(state(parts()), 'auto_dimension', {}, evaluate); assert.ok(!dimensioned.isError, dimensioned.content);
  const evidence = process.env.DRAWING_FIT_EVIDENCE;
  const dir = evidence ?? mkdtempSync(join(tmpdir(), 'fit-drawing-units-')); mkdirSync(dir, { recursive: true });
  const script = resolve(import.meta.dirname, '../../barocss-cad/scripts/dxf-oracle.py');
  const expected = 'H7/g6 (+0.018/0, -0.006/-0.017) (est.)';
  try {
    for (const scale of [1, 2]) {
      const settings = { ...readDrawing(dimensioned.state.doc.drawing), sheet: 'A3' as const, scale };
      const inputs = drawingInputs(dimensioned.state.doc, settings); assert.ok(typeof inputs !== 'string', String(inputs));
      const ctx = issueContext({ ...inputs, meta: { ...inputs.meta, date: '2026-10-25' } });
      const fit = ctx.sheet.dimensions.filter(d => d.ok && d.text.endsWith(expected)); assert.ok(fit.length > 0);
      for (const d of fit) { assert.ok(d.ok); assert.equal(d.value, 12); }
      assert.ok(sheetSvg(ctx.sheet, 'fit').includes('>mm</text>'), 'the sheet labels its dimensions in millimetres');
      const file = join(dir, `fit-scale-${scale}.dxf`); writeFileSync(file, sheetDxf(ctx.sheet, ctx.layout).bytes);
      const text = execFileSync(dxfPython, ['-I', script, file], { encoding: 'utf8' });
      if (evidence) writeFileSync(join(dir, `fit-scale-${scale}.json`), text);
      const oracle = JSON.parse(text) as { insunits: number; audit: { errors: string[]; fixes: string[] }; modelspace: { type: string; text?: string; measurement?: number }[] };
      assert.equal(oracle.insunits, 4, '$INSUNITS 4 means millimetres');
      assert.deepEqual(oracle.audit.errors, []); assert.deepEqual(oracle.audit.fixes, []);
      const dimensions = oracle.modelspace.filter(e => e.type === 'DIMENSION' && e.text?.endsWith(expected)); assert.ok(dimensions.length > 0);
      for (const d of dimensions) { assert.equal(d.text, `%%c12 ${expected}`, 'DXF stores the diameter sign as %%c'); assert.equal(d.measurement, 12, `model diameter remains 12 mm at sheet scale ${scale}`); }
    }
  } finally { if (!evidence) rmSync(dir, { recursive: true, force: true }); }
});
