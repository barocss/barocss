import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { BrepProjection, ProjectedCurve } from '@barocss/cad';
import { brepsFor } from '../src/engine/evaluate';
import { rectanglePart, starterDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { halfSection, offsetSection, sectionOf, sectionsCut } from '../src/drawing/section';
import { layoutSheet, toSheet } from '../src/drawing/views';
import { buildSheet, sectionExtents, sheetSections, type Mark } from '../src/drawing/sheet';
import { reorient } from '../src/drawing/reorient';
import { defaultDrawing, readDrawing, withSections, type DrawingSection, type DrawingSettings, type DrawingViews, type XY } from '../src/drawing/types';
import { checkManufacturingDrawing } from '../src/drawing/options';
import { runDrawingTool } from '../src/chat/drawing';
import { sheetDxf } from '../src/io/dxf';

// CG5 DR-3: half and offset sections. Oracles by hand: a 60 × 40 × 10 block with a Ø6 hole at (15, 10) and a Ø8 at
// (45, 30) — the plane Y 10 cuts the first (its cut face X 0–12 and 18–60), Y 30 the second (0–41, 49–60); stepped at
// X 30 the section shows 0–12, 18–30, 30–41, 49–60. The starter plate (64 × 32 × 8, Ø8 at 32, 16) halved at X 32: the
// cut face 36–64 only, the hole's wall visible at X 36, its other wall (X 28) on the uncut side and hidden.

const block = (): StudioDoc => withNode(withNode(rectanglePart(60, 40, 10), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [15, 10], radius: 3 }), { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [45, 30], radius: 4 });
const viewsOf = (doc: StudioDoc): DrawingViews => { const b = brepsFor(doc); assert.ok('breps' in b, JSON.stringify(b)); const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok); return r.views; };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const xs = (rings: readonly (readonly XY[])[]) => rings.map(r => [Math.min(...r.map(p => p[0])), Math.max(...r.map(p => p[0]))].map(x => +x.toFixed(9))).sort((a, b) => a[0] - b[0]);
/** Visible vertical lines of a projection (their u), whole or in pieces. */
const verticals = (pr: BrepProjection, visible = true) => [...new Set(pr.edges.flatMap(e => e.pieces.filter(p => p.visible === visible && p.curve.kind === 'line' && near((p.curve as Extract<ProjectedCurve, { kind: 'line' }>).a[0], (p.curve as Extract<ProjectedCurve, { kind: 'line' }>).b[0], 1e-9)).map(p => +(p.curve as Extract<ProjectedCurve, { kind: 'line' }>).a[0].toFixed(9))))].sort((a, b) => a - b);
const META = { title: 'block', date: '2026-10-24' };

test('the oracle planes alone: Y 10 cuts the Ø6 hole, Y 30 the Ø8', () => {
  const a = sectionOf(block(), 10), b = sectionOf(block(), 30);
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  assert.deepEqual(xs(a.rings), [[0, 12], [18, 60]]);
  assert.deepEqual(xs(b.rings), [[0, 41], [49, 60]]);
});

test('an offset section stepped at X 30 from Y 10 to Y 30: both holes cut in one section, no line at the step', () => {
  const s: DrawingSection = { id: 'B', view: 'front', at: 10, steps: [{ past: 30, at: 30 }] };
  const r = offsetSection(block(), s);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); if (!r.ok) return;
  assert.deepEqual(xs(r.rings), [[0, 12], [18, 30], [30, 41], [49, 60]]);
  // (The holes' walls where the planes cut them; nothing visible at the step, X 30, but the cut faces meeting there.)
  const v = verticals(r.projection);
  for (const x of [0, 12, 18, 41, 49, 60]) assert.ok(v.includes(x), `wall at ${x}: ${v}`);
  assert.ok(!v.includes(30), `no line at the step: ${v}`);
  assert.deepEqual([r.projection.min, r.projection.max], [[0, 0], [60, 10]]);
  // The sheet: the cutting line steps in the top view (X across, Y up) from Y 10 to Y 30 at X 30.
  const views = viewsOf(block()), settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', sections: [s] };
  const cut = sheetSections(sectionsCut(block(), [s])), layout = layoutSheet(views, settings, sectionExtents(settings, cut)), sheet = buildSheet(views, layout, settings, META, cut);
  const line = sheet.groups.filter(g => g.role === 'section' && g.view === 'top').flatMap(g => g.marks).find((m): m is Extract<Mark, { kind: 'polyline' }> => m.kind === 'polyline' && m.pen === 'center')!;
  assert.equal(line.points.length, 4);
  const top = layout.views.top, P = (x: number, y: number) => toSheet(top, [x, y]);
  assert.ok(near(line.points[1][0], P(30, 10)[0]) && near(line.points[1][1], P(30, 10)[1]) && near(line.points[2][0], P(30, 30)[0]) && near(line.points[2][1], P(30, 30)[1]), JSON.stringify(line.points));
  assert.ok(near(line.points[0][1], P(0, 10)[1]) && near(line.points[3][1], P(0, 30)[1]));
  assert.ok(sheet.groups.some(g => g.role === 'label' && g.marks.some(m => m.kind === 'text' && m.text === 'SECTION B–B')));
});

test('a half section of the plate at X 32, cut right: the cut face 36–64 only; the wall at X 36 visible, the one at 28 hidden; a centreline at 32', () => {
  const s: DrawingSection = { id: 'A', view: 'front', at: 16, half: { line: 'vertical', at: 32, cut: 'after' } };
  const r = halfSection(starterDoc(), s);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); if (!r.ok) return;
  assert.deepEqual(xs(r.rings), [[36, 64]]);
  const vis = verticals(r.projection), hid = verticals(r.projection, false);
  assert.ok(vis.includes(36) && vis.includes(0) && vis.includes(64), `visible ${vis}`);
  assert.ok(!vis.includes(28) && hid.includes(28), `the uncut side's wall hidden: ${vis} / ${hid}`);
  // (The top edge Z 8 visible across both halves, met at the centreline.)
  const top = r.projection.edges.flatMap(e => e.pieces).filter(p => p.visible && p.curve.kind === 'line' && near(p.curve.a[1], 8) && near(p.curve.b[1], 8)).map(p => { const c = p.curve as Extract<ProjectedCurve, { kind: 'line' }>; return [Math.min(c.a[0], c.b[0]), Math.max(c.a[0], c.b[0])]; });
  // (Covered from 0 to 64 with no gap: the uncut half's edge to 32, the cut half's from 32 on.)
  let reach = 0; for (const t of [...top].sort((a, b) => a[0] - b[0])) { assert.ok(t[0] <= reach + 1e-9, JSON.stringify(top)); reach = Math.max(reach, t[1]); }
  assert.ok(near(reach, 64) && top.some(t => near(t[1], 32)) && top.some(t => near(t[0], 32)), JSON.stringify(top));
  // Cut left instead: the face 0–28.
  const left = halfSection(starterDoc(), { ...s, half: { line: 'vertical', at: 32, cut: 'before' } });
  assert.ok(left.ok && xs(left.rings).length === 1 && xs(left.rings)[0][0] === 0 && xs(left.rings)[0][1] === 28);
  // On the sheet: the centreline through X 32, past the section's box.
  const views = viewsOf(starterDoc()), settings: DrawingSettings = withSections({ ...defaultDrawing(), sheet: 'A3' }, [s]);
  assert.deepEqual(settings.sections, [s], 'a half A–A is written as a section, not the plain y');
  const cut = sheetSections(sectionsCut(starterDoc(), [s])), layout = layoutSheet(views, settings, sectionExtents(settings, cut)), sheet = buildSheet(views, layout, settings, META, cut);
  const p = sheet.sections![0].placement, g = sheet.groups.find(x => x.role === 'section' && x.marks.some(m => m.kind === 'hatch'))!;
  const c = g.marks.find((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.pen === 'center')!;
  assert.ok(c && near(c.a[0], toSheet(p, [32, 0])[0]) && near(c.b[0], c.a[0]) && c.a[1] < p.box[1] && c.b[1] > p.box[3]);
});

test('saved and offered half and offset sections; refused: on an aligned section, both at once, steps out of order; turning the drawing refused with SECTION_KIND', () => {
  const kept = readDrawing({ sections: [{ id: 'B', view: 'front', at: 1, half: { line: 'vertical', at: 2, cut: 'after' } }, { id: 'C', view: 'top', at: 1, steps: [{ past: 0, at: 2 }, { past: 5, at: 3 }], along: 'vertical' }, { id: 'D', view: 'front', at: 1, dir: [1, 1, 0], half: { line: 'vertical', at: 0, cut: 'after' } }, { id: 'E', view: 'front', at: 1, steps: [{ past: 5, at: 1 }, { past: 5, at: 2 }] }] }).sections!;
  assert.deepEqual(kept.map(x => [x.id, !!x.half, !!x.steps, x.along ?? null]), [['B', true, false, null], ['C', false, true, 'vertical'], ['D', false, false, null], ['E', false, false, null]]);
  const bad = (sections: unknown[]) => checkManufacturingDrawing({ sections })[0]?.message ?? '';
  assert.match(bad([{ id: 'B', view: 'front', at: 1, dir: [1, 0, 0], half: { line: 'vertical', at: 0, cut: 'after' } }]), /principal section/);
  assert.match(bad([{ id: 'B', view: 'front', at: 1, half: { line: 'vertical', at: 0, cut: 'after' }, steps: [{ past: 0, at: 1 }] }]), /not both/);
  assert.match(bad([{ id: 'B', view: 'front', at: 1, steps: [{ past: 2, at: 1 }, { past: 1, at: 2 }] }]), /increasing/);
  assert.equal(bad([{ id: 'B', view: 'front', at: 1, steps: [{ past: 1, at: 2 }], along: 'vertical' }]), '');
  const v = viewsOf(starterDoc()), sb = brepsFor(starterDoc()); assert.ok('breps' in sb); const b = projectViews(sb.breps, sb.prefixes, { orientation: 'x+' });
  assert.ok(b.ok); if (!b.ok) return;
  const t = reorient(v, b.views, withSections(defaultDrawing(), [{ id: 'A', view: 'front', at: 16, half: { line: 'vertical', at: 32, cut: 'after' } }]), 'x+');
  assert.ok(!t.ok && t.code === 'SECTION_KIND');
  // The agent sets an offset section; the issue list comes back with it cut.
  const r = runDrawingTool(block(), 'set_drawing', { sheet: 'A3', sections: [{ id: 'B', view: 'front', at: 10, steps: [{ past: 30, at: 30 }] }] });
  assert.ok(!('error' in r), JSON.stringify(r)); if ('error' in r) return;
  assert.deepEqual(readDrawing(r.doc.drawing).sections, [{ id: 'B', view: 'front', at: 10, steps: [{ past: 30, at: 30 }] }]);
});

test('written: the offset section’s four cut faces as HATCH loops read back by ezdxf', () => {
  const s: DrawingSection = { id: 'B', view: 'front', at: 10, steps: [{ past: 30, at: 30 }] };
  const views = viewsOf(block()), settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', scale: 1, sections: [s] };
  const cut = sheetSections(sectionsCut(block(), [s])), layout = layoutSheet(views, settings, sectionExtents(settings, cut)), sheet = buildSheet(views, layout, settings, META, cut), dxf = sheetDxf(sheet, layout);
  const py = join(homedir(), '.cache/barocss-ezdxf/bin/python'), script = resolve(import.meta.dirname, '../../barocss-cad/scripts/dxf-oracle.py');
  if (!existsSync(py)) { console.log('ezdxf not installed at ~/.cache/barocss-ezdxf: the read-back is skipped'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'dr3-')), file = join(dir, 'offset.dxf');
  writeFileSync(file, dxf.bytes);
  const o = JSON.parse(execFileSync(py, ['-I', script, file], { encoding: 'utf8' }));
  rmSync(dir, { recursive: true, force: true });
  const hatches = entitiesOf(o, []).filter(e => e.type === 'HATCH' && e.layer === 'HATCH');
  assert.equal(hatches.length, 1, 'one body, one hatch');
  // (Each loop's X span on the sheet back in the section's coordinates, at 1:1: the four faces.)
  const p = sheet.sections![0].placement, loops = (hatches[0].loops as { points: number[][] }[]).map(l => l.points.map(q => [q[0] - p.origin[0]] as [number]));
  const spans = loops.map(l => [Math.min(...l.map(q => q[0])), Math.max(...l.map(q => q[0]))].map(x => +x.toFixed(6))).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(spans, [[0, 12], [18, 30], [30, 41], [49, 60]]);
});

function entitiesOf(x: unknown, out: Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(x)) { for (const y of x) entitiesOf(y, out); return out; }
  if (x && typeof x === 'object') { if ('type' in x) out.push(x as Record<string, unknown>); for (const y of Object.values(x)) entitiesOf(y, out); }
  return out;
}
