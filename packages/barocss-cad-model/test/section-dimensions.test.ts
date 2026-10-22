import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { drawingInputs } from '../src/chat/drawing';
import { autoLayout } from '../src/drawing/layout';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { readDrawing, type DrawingSettings } from '../src/drawing/types';
import { sheetSvg } from '../src/drawing/svg';
import { sheetDxf } from '../src/drawing/dxf';
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

test('X2: a dimension on a section the sheet lacks is lost (DIMENSION_LOST, named by its section); turning the front with one is refused (SECTION_DIMENSIONS)', () => {
  const doc = scene(), i = inputs(doc, { sections: [{ id: 'B', view: 'top', at: -15 }] }), { settings } = autoLayout(i);
  const dropped: DrawingSettings = { ...settings, sections: undefined }; delete dropped.sections;
  const ctx = issueContext({ ...i, settings: dropped }), lost = drawingIssues(ctx).filter(x => x.code === 'DIMENSION_LOST');
  assert.ok(lost.length === 2 && lost.every(x => /in section B–B is lost: Its section \(B–B\) is not on the sheet\.$/.test(x.message)), lost.map(x => x.message).join(' | '));
  const r = reorient(i.views, i.views, settings, 'x+');
  assert.ok(!r.ok && r.code === 'SECTION_DIMENSIONS' && /on a section \(B–B\)/.test(r.message));
});

// (The scene as a model file for the browser flow's step: written with UPDATE_SECTION_FIXTURE=1, checked byte for byte here.)
const FIXTURE = join(import.meta.dirname, 'fixtures/shaft-hub-keyseat.bcad');
test('X2: the flow\'s shaft-and-hub model file is this scene', () => {
  const bytes = encodeStudioFile(scene());
  if (process.env.UPDATE_SECTION_FIXTURE) writeFileSync(FIXTURE, bytes);
  assert.ok(existsSync(FIXTURE), 'the fixture (UPDATE_SECTION_FIXTURE=1 writes it)');
  assert.deepEqual(new Uint8Array(readFileSync(FIXTURE)), bytes);
});
