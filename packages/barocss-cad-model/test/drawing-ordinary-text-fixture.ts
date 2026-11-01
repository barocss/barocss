// Shared bounded style fixture: one mitred L-frame, one stacked tolerance and an authored table.
import assert from 'node:assert/strict';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { drawingInputs } from '../src/chat/drawing';
import { snapPoints } from '../src/drawing/dimensions';
import { issueContext } from '../src/drawing/issues';
import { defaultDrawing, type DrawingSettings } from '../src/drawing/types';
export function ordinaryTextFixture(standard?: 'iso' | 'asme') {
  let doc: StudioDoc = withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 200, 0]], segments: [[0, 1], [1, 2]], section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } });
  const base: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', weldSymbols: true, ...(standard ? { standard } : {}), tables: [{ id: 'check', title: 'WELD CHECK', columns: [{ key: 'item', label: 'ITEM' }, { key: 'qty', label: 'QTY' }], rows: [['Mitred frame', 1], ['Inspection', 2]] }] };
  const initial = drawingInputs(doc, base); assert.ok(typeof initial !== 'string', String(initial));
  const points = snapPoints(initial.views.front), bottom = Math.min(...points.map(p => p.at[1])), candidates = points.filter(p => Math.abs(p.at[1] - bottom) < 1e-8).sort((a, b) => a.at[0] - b.at[0]);
  const a = candidates[0], b = candidates.at(-1)!; assert.ok(a.at[0] < b.at[0]);
  const drawing: DrawingSettings = { ...base, dimensions: [{ id: 'width', view: 'front', kind: 'linear', a: a.ref, b: b.ref, orient: 'horizontal', place: [(a.at[0] + b.at[0]) / 2, bottom - 25], tol: { kind: 'deviation', upper: 0.1, lower: -0.05 } }] };
  doc = { ...doc, drawing }; const inputs = drawingInputs(doc, drawing); assert.ok(typeof inputs !== 'string', String(inputs));
  const context = issueContext({ ...inputs, meta: { ...inputs.meta, title: 'Ordinary text', date: '2026-11-01' } });
  assert.equal(context.sheet.welds?.placed.length, 1); assert.ok(context.sheet.tables?.length); return { doc, context, inputs };
}
