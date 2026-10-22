import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { drawingInputs } from '../src/chat/drawing';
import { autoLayout } from '../src/drawing/layout';
import { applyFix, drawingIssues, issueContext, sectionFor } from '../src/drawing/issues';
import { readDrawing, type DrawingSettings } from '../src/drawing/types';
import { sheetSvg } from '../src/drawing/svg';
import { sectionDxfDocument, sheetDxf } from '../src/drawing/dxf';
import { HATCH_ANGLES, hatch } from '../src/drawing/sheet';
import { sheetPdf } from '../src/drawing/pdf';
import { writeDxf } from '@barocss/cad';
import { reorient } from '../src/drawing/reorient';
import { encodeStudioFile } from '../src/engine/container';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// O148 X2: dimensions on sections — the shaft-and-hub scene of O146 (its keyseat under the hub, hidden in every standard
// view) with B–B square to the top view's depth through the keyseat's middle (z 15): Auto-dimension finds b 6 and d − t1
// 16.5 on the section with visible ends, so DIM_ON_HIDDEN no longer fires (the hub's d + t2 22.8 stays where it is seen); drawn and checked
// as a view's; a dimension on a section the sheet lacks is lost, said; turning the front with one is refused, typed.
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
function scene(): StudioDoc {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 20, ri: 10, h: 22, x: 0, y: 0, z: 4 });
  doc = run(doc, 'keyway', { face: `n${doc.nodes.length - 1}.hole0.side0` }, { b: 6, t2: 2.8 });
  return run(doc, 'key', { bodies: [0] }, { h: 6 });
}
const inputs = (doc: StudioDoc, extra: Partial<DrawingSettings> = {}) => { const i = drawingInputs(doc, { ...readDrawing(doc.drawing), sheet: 'A3', ...extra }); assert.ok(typeof i !== 'string', String(i)); return { ...i, meta: { ...i.meta, date: '2026-10-22' } }; };
const keyDims = (ctx: ReturnType<typeof issueContext>) => ctx.sheet.dimensions.filter(r => r.ok && r.dim.auto && r.dim.kind === 'linear' && /keyseat|keyway/.test(JSON.stringify(r.dim)));

test('X2: with B–B through the keyseat, Auto-dimension puts b 6 and d − t1 16.5 on the section, every end visible (d + t2 22.8 stays on the top view, seen there whole); DIM_ON_HIDDEN gone; drawn there, clean; in the SVG and DXF', () => {
  const doc = scene(), i = inputs(doc, { sections: [{ id: 'B', view: 'top', at: -15 }] });
  const { settings, report } = autoLayout(i);
  assert.equal(report.dimensions.keys, 4, JSON.stringify(report.dimensions.skipped));
  const ctx = issueContext({ ...i, settings }), keys = keyDims(ctx);
  const on = keys.filter(r => r.dim.view === 'section:B').map(r => r.ok ? +r.value.toFixed(6) : NaN).sort((a, b) => a - b);
  for (const want of [6, 16.5]) assert.ok(on.includes(want), `${want} on the section: ${on}`);
  // (The hub's keyway is seen whole from the top as well: d + t2 22.8 stays in that view, every end visible — a section is
  // taken only where it shows more.)
  const hub = keys.find(r => r.ok && Math.abs(r.value - 22.8) < 1e-6)!;
  assert.equal(hub.dim.view, 'top');
  // (Every end of those on visible edges of the section.)
  const pr = ctx.sheet.sections!.find(x => x.id === 'B')!.projection;
  for (const r of keys.filter(x => x.dim.view === 'section:B')) if (r.dim.kind === 'linear') for (const p of [r.dim.a, r.dim.b]) assert.ok(pr.edges.find(e => e.name === p.edge)?.pieces.some(x => x.visible), `${p.edge} visible`);
  const issues = drawingIssues(ctx);
  // (b 6 on the shaft's keyseat and the hub keyway's 6 share a span but no feature: not one given twice.)
  assert.deepEqual(issues.filter(x => x.code === 'DUPLICATE').map(x => x.message), []);
  assert.deepEqual(issues.filter(x => x.code === 'DIM_ON_HIDDEN' && x.dims?.some(id => keys.some(k => k.dim.id === id && k.dim.view === 'section:B'))).map(x => x.message), []);
  assert.ok(!issues.some(x => x.code === 'DIM_ON_HIDDEN' && x.dims?.some(id => { const r = ctx.sheet.dimensions.find(d => d.dim.id === id); return r?.ok && Math.abs(r.value - 16.5) < 1e-6; })), 'd − t1 no longer on a hidden line');
  // (Drawn on the section, as a view's: clear of everything.)
  const ids = new Set(keys.filter(r => r.dim.view === 'section:B').map(r => r.dim.id));
  assert.deepEqual(issues.filter(x => x.severity === 'error' && x.dims?.some(d => ids.has(d))).map(x => `${x.code}: ${x.message}`), []);
  assert.equal(ctx.sheet.groups.filter(g => g.role === 'dimension' && g.view === 'section:B').length, ids.size);
  const svg = sheetSvg(ctx.sheet, 'shaft'), dxf = sheetDxf(ctx.sheet, ctx.layout).text;
  for (const r of keys.filter(x => x.dim.view === 'section:B')) if (r.ok) assert.ok(svg.includes(`>${r.text}</text>`) || svg.includes(r.text), `SVG ${r.text}`);
  assert.ok((dxf.match(/\nDIMENSION\n/g) ?? []).length >= ids.size, 'DXF DIMENSION entities');
  // (In files: the section's dimensions read back.)
  assert.deepEqual(readDrawing(JSON.parse(JSON.stringify(settings))).dimensions.filter(d => d.view === 'section:B').length, ids.size);
});

test('X2: a dimension on a section the sheet lacks is lost (DIMENSION_LOST, named by its section)', () => {
  const doc = scene(), i = inputs(doc, { sections: [{ id: 'B', view: 'top', at: -15 }] }), { settings } = autoLayout(i);
  const dropped: DrawingSettings = { ...settings, sections: undefined }; delete dropped.sections;
  const ctx = issueContext({ ...i, settings: dropped }), lost = drawingIssues(ctx).filter(x => x.code === 'DIMENSION_LOST');
  assert.ok(lost.length === 2 && lost.every(x => /in section B–B is lost: Its section \(B–B\) is not on the sheet\.$/.test(x.message)), lost.map(x => x.message).join(' | '));
});

test('queue 3: a section\'s dimensions carried through a reorient — B–B (square to Z) turned to a front from +X and from +Y: its dimensions stay on it and read 6 and 16.5 again; a section across the new front still refused', () => {
  const doc = scene(), i = inputs(doc, { sections: [{ id: 'B', view: 'top', at: -15 }] }), { settings } = autoLayout(i);
  const valuesOn = (c: ReturnType<typeof issueContext>) => c.sheet.dimensions.filter(r => r.dim.view === 'section:B').map(r => r.ok ? +r.value.toFixed(6) : NaN).sort((a, b) => a - b);
  const want = valuesOn(issueContext({ ...i, settings }));
  assert.ok(want.includes(6) && want.includes(16.5), `${want}`);
  for (const side of ['x+', 'y+'] as const) {
    const to = inputs(doc, { ...settings, orientation: side }).views, r = reorient(i.views, to, settings, side);
    assert.ok(r.ok, !r.ok ? r.message : '');
    assert.deepEqual(r.settings.sections, [{ id: 'B', view: 'top', at: -15 }]);
    const after = inputs(doc, r.settings), ctx = issueContext({ ...after, settings: r.settings });
    assert.deepEqual(valuesOn(ctx), want, `${side}: the same values on B–B`);
    assert.deepEqual(drawingIssues(ctx).filter(x => x.code === 'DIMENSION_LOST').map(x => x.message), []);
  }
  // (A section across the new front: still refused, as A–A always was.)
  const across = reorient(i.views, inputs(doc, { ...settings, orientation: 'x+' }).views, { ...settings, sections: [...settings.sections!, { id: 'C', view: 'front', at: 0 }] }, 'x+');
  assert.ok(!across.ok && across.code === 'SECTION_ACROSS', JSON.stringify(across));
});

// (The scene as a model file for the browser flow's step: written with UPDATE_SECTION_FIXTURE=1, checked byte for byte here.)
const FIXTURE = join(import.meta.dirname, 'fixtures/shaft-hub-keyseat.bcad');
test('X2: the flow\'s shaft-and-hub model file is this scene', () => {
  const bytes = encodeStudioFile(scene());
  if (process.env.UPDATE_SECTION_FIXTURE) writeFileSync(FIXTURE, bytes);
  assert.ok(existsSync(FIXTURE), 'the fixture (UPDATE_SECTION_FIXTURE=1 writes it)');
  assert.deepEqual(new Uint8Array(readFileSync(FIXTURE)), bytes);
});

// ——— O148 X3: the section a hidden dimension needs, as a fix
test('X3: DIM_ON_HIDDEN on d − t1 carries add-section B–B square to the top view at the keyseat\'s middle (Z 15); applied, Auto-dimension moves b and d − t1 onto it and the warnings are gone; with the section there, the fix is Auto-dimension', () => {
  const doc = scene(), i = inputs(doc), first = autoLayout(i).settings, ctx = issueContext({ ...i, settings: first });
  const hidden = drawingIssues(ctx).filter(x => x.code === 'DIM_ON_HIDDEN');
  const valueOf = (c: typeof ctx, id: string) => { const r = c.sheet.dimensions.find(x => x.dim.id === id); return r?.ok ? +r.value.toFixed(6) : NaN; };
  const dt1 = hidden.find(x => x.dims?.some(id => valueOf(ctx, id) === 16.5))!;
  assert.deepEqual(dt1.fix, { kind: 'add-section', id: 'B', view: 'top', at: -15 });
  assert.match(dt1.message, /: section B–B, square to its axis \(Z\) through its middle \(Z 15\), would show it — the fix adds it\.$/);
  // (Applied: the section on the sheet; Auto-dimension again puts the seat's two on it, none left on hidden lines.)
  const withB = applyFix(ctx, dt1.fix!);
  assert.deepEqual(withB.sections, [{ id: 'B', view: 'top', at: -15 }]);
  const i2 = inputs(doc, withB), again = autoLayout(i2).settings, ctx2 = issueContext({ ...i2, settings: again });
  assert.deepEqual(drawingIssues(ctx2).filter(x => x.code === 'DIM_ON_HIDDEN').map(x => x.message), []);
  const on = again.dimensions.filter(d => d.view === 'section:B').map(d => valueOf(ctx2, d.id)).sort((a, b) => a - b);
  assert.ok(on.includes(6) && on.includes(16.5), `on B–B: ${on}`);
  // (The section there but the dimensions still on the views: the fix is Auto-dimension, not another section.)
  const stale = issueContext({ ...i2, settings: { ...withB, dimensions: first.dimensions } });
  const fixes = drawingIssues(stale).filter(x => x.code === 'DIM_ON_HIDDEN').map(x => x.fix);
  assert.ok(fixes.length && fixes.every(f => f?.kind === 'auto-dimension'), JSON.stringify(fixes));
});

test('X3: a keyway on a tilted bore — its axis along none of X, Y, Z — is said with no section offered', () => {
  let doc = cmd('tube').build!(blank, { ...cmd('tube').defaults!(blank), r: 20, ri: 10, h: 22, x: 0, y: 0, z: 0 });
  doc = run(doc, 'rotate', { bodies: [doc.nodes.length - 1] }, { axis: 'x', angle: 30, px: 0, py: 0, pz: 0 });
  const bodies = evaluated(doc), bore = bodies.flatMap(b => b.mesh.faces.map(f => f.name)).find(n => /hole0\.side0$/.test(n))!;
  doc = run(doc, 'keyway', { face: bore }, { b: 6, t2: 2.8 });
  const i = inputs(doc), ctx = issueContext(i), way = (i.elements ?? []).find(e => e.element.kind === 'keyway');
  assert.ok(way, 'the keyway element');
  const ends = i.views.front.edges.filter(e => e.ends && e.name.includes(`${way.id}.keyway`)).flatMap(e => e.ends!.map(p => ({ edge: e.name, at: 'end' as const, near: [p[0], p[1], p[2]] as [number, number, number] })));
  const r = sectionFor(ctx, { id: 'x', view: 'front', kind: 'linear', a: ends[0], b: ends[1], orient: 'aligned', place: [0, 0] });
  assert.ok(r && !r.fix && /its axis runs along none of X, Y and Z, so no principal section shows it/.test(r.text), JSON.stringify(r));
});

// ——— Queue 1 (after O148): adjacent parts hatched apart in one section
test('a section through the shaft, its key and its hub: each body hatched at its own angle (45°, 135°, 30° by body), the same in the SVG, PDF and DXF; one body alone at 45° as before', () => {
  const doc = scene(), i = inputs(doc, { sections: [{ id: 'B', view: 'top', at: -15 }] }), ctx = issueContext(i);
  const B = i.sections!.find(x => x.id === 'B')!, bodies = [...new Set(B.ringBodies)];
  assert.equal(bodies.length, 3, `three bodies cut: ${B.ringBodies}`);
  const body = ctx.sheet.groups.find(g => g.role === 'section' && g.id === 'B' && !g.view)!;
  const hatches = body.marks.filter((m): m is Extract<typeof m, { kind: 'hatch' }> => m.kind === 'hatch');
  assert.deepEqual(hatches.map(h => h.angle), bodies.sort((a, b) => a - b).map(b => HATCH_ANGLES[b % HATCH_ANGLES.length]));
  assert.equal(new Set(hatches.map(h => h.angle)).size, 3, 'three angles');
  // (The lines drawn: each at its angle, on the sheet as in the files.)
  for (const h of hatches) {
    const lines = hatch(h.rings, h.spacing, h.angle);
    assert.ok(lines.length > 0);
    for (const l of lines) { const a = Math.atan2(l.b[1] - l.a[1], l.b[0] - l.a[0]) * 180 / Math.PI; assert.ok(Math.abs(((a - h.angle) % 180 + 180) % 180) < 1e-6 || Math.abs(((a - h.angle) % 180 + 180) % 180 - 180) < 1e-6, `${a} vs ${h.angle}`); }
  }
  const svg = sheetSvg(ctx.sheet, 'shaft'), pdf = new TextDecoder('latin1').decode(sheetPdf(ctx.sheet, 'shaft')), dxf = sheetDxf(ctx.sheet, ctx.layout).text;
  const lineCount = hatches.reduce((n, h) => n + hatch(h.rings, h.spacing, h.angle).length, 0);
  assert.ok((svg.match(/<line /g) ?? []).length >= lineCount, 'the SVG draws every hatch line');
  assert.ok((pdf.match(/ l\b/g) ?? []).length >= lineCount, 'the PDF strokes them');
  const dxfAngles = [...dxf.matchAll(/\nHATCH\n[\s\S]*?\n 52\n([-\d.]+)\n/g)].map(m => Number(m[1]));
  assert.ok(dxfAngles.length >= 3, `DXF hatches: ${dxfAngles}`);
  // (Alone as a 1:1 DXF: a HATCH a body, at the sheet's angles.)
  const alone = writeDxf(sectionDxfDocument(B)).text, aloneAngles = [...alone.matchAll(/\nHATCH\n[\s\S]*?\n 52\n([-\d.]+)\n/g)].map(m => Number(m[1]));
  assert.deepEqual(aloneAngles.sort((a, b) => a - b), hatches.map(h => h.angle).sort((a, b) => a - b));
});

// ——— Item 4 (after G22's S0): a section's edge names keyed by its body, not by the cut's output index
test('item 4: an unrelated body before the shaft, suppressed — the outputs shift, B–B\'s dimensions read 6 and 16.5 as before, none lost or re-matched', () => {
  let doc = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [200, 200], max: [230, 220] } as never), { kind: 'extrude', sketch: 0, height: 5 } as never);
  doc = cmd('shaft').build!({ ...blank, doc }, cmd('shaft').defaults!(blank));
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 20, ri: 10, h: 22, x: 0, y: 0, z: 4 });
  doc = run(doc, 'keyway', { face: `n${doc.nodes.length - 1}.hole0.side0` }, { b: 6, t2: 2.8 });
  doc = run(doc, 'key', { bodies: [2] }, { h: 6 });
  const i = inputs(doc, { sections: [{ id: 'B', view: 'top', at: -15 }] }), { settings } = autoLayout(i);
  const on = (c: ReturnType<typeof issueContext>) => c.sheet.dimensions.filter(r => r.dim.view === 'section:B').map(r => r.ok ? +r.value.toFixed(6) : NaN).sort((a, b) => a - b);
  const before = on(issueContext({ ...i, settings }));
  assert.ok(before.includes(6) && before.includes(16.5), `${before}`);
  const off: StudioDoc = { ...doc, nodes: doc.nodes.map((n, k) => k === 1 ? { ...n, suppressed: true } : n) };
  const i2 = inputs(off, settings), ctx2 = issueContext({ ...i2, settings });
  assert.deepEqual(on(ctx2), before);
  const ids = new Set(settings.dimensions.filter(d => d.view === 'section:B').map(d => d.id));
  assert.deepEqual(drawingIssues(ctx2).filter(x => (x.code === 'DIMENSION_LOST' || x.code === 'REMATCHED') && x.dims?.some(d => ids.has(d))).map(x => x.message), []);
});
