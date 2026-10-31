// Roadmap 11 ③b: with no units setting, the sheet is byte for byte what it was before units existed — plain, ISO and ASME.
// Golden hashes made from the sources before the setting (UPDATE_UNITS_GOLDEN=1 only from such sources). This file only
// uses what those sources had, so it can be run against them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brepsFor } from '../src/engine/evaluate';
import { starterDoc, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { layoutSheet } from '../src/drawing/views';
import { snapPoints } from '../src/drawing/dimensions';
import { buildSheet } from '../src/drawing/sheet';
import { sheetSvg } from '../src/io/svg';
import { sheetDxf } from '../src/io/dxf';
import { defaultDrawing, type DrawingDimension, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import type { DrawingDatumTarget } from '../src/drawing/datumTargets';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/** Every kind of printed length: dimensions with each tolerance kind, a count, a pitch circle's neighbours, datum targets, frames with every extra. */
/** `fine`: with tolerances finer than 0.01 mm (0.0125, 0.125), which round 2 prints as entered instead of to 0.01; coarse ones are unchanged since before units. */
function fixture(fine: boolean): { views: DrawingViews; settings: DrawingSettings } {
  const doc: StudioDoc = (() => { const d = starterDoc(); return { ...d, nodes: d.nodes.map(n => n.kind === 'hole' ? { ...n, radius: 12 } : n) }; })();
  const b = brepsFor(doc); assert.ok('breps' in b);
  const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok);
  const views = r.views, hole = views.top.edges.find(e => e.kind === 'circle')!, f = snapPoints(views.front);
  const at = (u: number, w: number) => f.find(p => near(p.at[0], u) && near(p.at[1], w))!.ref;
  const circle = { edge: hole.name, near: [...hole.circle!.center] as [number, number, number] };
  const dimensions: DrawingDimension[] = [
    { id: 'wide', view: 'front', kind: 'linear', a: at(0, 0), b: at(64, 0), orient: 'horizontal', place: [32, -12], tol: { kind: 'symmetric', value: 0.05 } },
    { id: 'high', view: 'front', kind: 'linear', a: at(0, 0), b: at(0, 8), orient: 'vertical', place: [-12, 4], tol: { kind: 'fit', code: 'h7' } },
    { id: 'slant', view: 'front', kind: 'linear', a: at(0, 0), b: at(64, 8), orient: 'aligned', place: [20, 20] },
    { id: 'short', view: 'front', kind: 'linear', a: at(0, 0), b: at(0, 8), orient: 'vertical', place: [80, 4], tol: { kind: 'deviation', upper: 0.1, lower: -0.05 } },
    { id: 'bore', view: 'top', kind: 'diameter', ...circle, place: [33, 17], count: 2 },
    { id: 'far', view: 'top', kind: 'diameter', ...circle, place: [58, 40], tol: { kind: 'deviation', upper: fine ? 0.0125 : 0.01, lower: 0 } },
    { id: 'round', view: 'top', kind: 'radius', ...circle, place: [28, 10], tol: { kind: 'symmetric', value: fine ? 0.125 : 0.13 } },
  ];
  const targets: DrawingDatumTarget[] = [
    { id: 'line-a', letter: 'A', number: 1, view: 'front', place: [-14, 14], kind: 'line', line: { from: [10, 4], to: [50, 4] } },
    { id: 'area-b', letter: 'B', number: 1, view: 'front', place: [-14, -12], kind: 'area', area: { shape: 'circle', at: [20, 4], d: 6.35 } },
    { id: 'area-c', letter: 'C', number: 1, view: 'front', place: [70, -12], kind: 'area', area: { shape: 'rect', at: [50, 4], w: 12.5, h: 3 } },
  ];
  const line = views.front.edges.find(e => e.kind === 'line' && e.ends)!, [p, q] = line.ends!;
  const settings: DrawingSettings = {
    ...defaultDrawing(), sheet: 'A3', dimensions, datumTargets: targets,
    datums: [{ id: 'da', letter: 'C', view: 'front', edge: { edge: line.name, near: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2] }, place: [32, -26] }],
    frames: [
      { id: 'flat', dim: 'wide', characteristic: 'flatness', value: 0.1, datums: [] },
      { id: 'pos', dim: 'bore', characteristic: 'position', value: 0.25, datums: ['C'], projected: 12.7, material: 'maximum', composite: { value: 0.0625, datums: ['C'] } },
      { id: 'prof', dim: 'slant', characteristic: 'profile-surface', value: 0.5, datums: [], unequal: 0.125, statistical: true },
    ],
  };
  return { views, settings };
}
function outputs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [prefix, fine] of [['coarse-', false], ['', true]] as const) {
    const { views, settings: base } = fixture(fine);
    for (const [name, extra] of Object.entries<Partial<DrawingSettings>>({ plain: {}, iso: { standard: 'iso' }, asme: { standard: 'asme' } })) {
      const settings = { ...base, ...extra }, layout = layoutSheet(views, settings), sheet = buildSheet(views, layout, settings, { title: 'Plate', date: '2026-10-31' });
      out[`${prefix}${name}.svg`] = hash(sheetSvg(sheet, 'Plate')); out[`${prefix}${name}.dxf`] = hash(sheetDxf(sheet, layout).text); out[`${prefix}${name}.dims`] = hash(JSON.stringify(sheet.dimensions));
    }
  }
  return out;
}
const GOLDEN = join(import.meta.dirname, 'fixtures/drawing-units-absent.json');
test('no units setting: plain, ISO and ASME sheets (SVG, DXF and the resolved dimensions; every tolerance kind, targets, frames) are byte for byte the ones made before units', () => {
  const now = outputs();
  if (process.env.UPDATE_UNITS_GOLDEN) writeFileSync(GOLDEN, JSON.stringify(now, null, 2) + '\n');
  assert.deepEqual(now, JSON.parse(readFileSync(GOLDEN, 'utf8')), 'made by the sources before drawing.units existed');
});
