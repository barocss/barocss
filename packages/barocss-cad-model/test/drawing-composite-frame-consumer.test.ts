import test from 'node:test';
import assert from 'node:assert/strict';
import { starterDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { drawingInputs, runDrawingTool } from '../src/chat/drawing';
import { defaultDrawing, readDrawing, type DrawingFrame, type DrawingSettings } from '../src/drawing/types';
import { frameMarks, type Mark } from '../src/drawing/sheet';
import { issueContext } from '../src/drawing/issues';
import { modelAnnotations } from '../src/drawing/annotations3d';
import { sheetGroupsSvg, sheetSvg } from '../src/io/svg';

const upper = { characteristic: 'position' as const, value: 0.25, datums: ['A', 'B'], diameter: false, material: 'maximum' as const, datumModifiers: { A: 'least' as const } };
const composite = { value: 0.1, datums: ['B'], material: 'least' as const, datumModifiers: { B: 'maximum' as const } };
const attached: DrawingFrame = { id: 'attached', dim: 'd1', ...upper, composite };
const standalone: DrawingFrame = { id: 'standalone', view: 'front', place: [10, 20], ...upper, composite };
const under: Extract<Mark, { kind: 'text' }> = { kind: 'text', at: [20, 30], text: '64', size: 3.5, anchor: 'start' };
const texts = (marks: Mark[]) => marks.filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
const borderOf = (marks: Mark[]) => { const border = marks[0]; assert.ok(border.kind === 'polyline'); return border; };

test('composite frame has one full-height characteristic cell and two independently sized rows', () => {
  const marks = frameMarks(under, attached), border = borderOf(marks);
  const [x, y] = border.points[0], right = border.points[1][0];
  assert.equal(border.points[2][1] - y, 12);
  assert.deepEqual(texts(marks).map(m => m.text), ['0.25', 'M', 'A', 'L', 'B', 'Ø0.1', 'L', 'B', 'M']);
  assert.ok(marks.some(m => m.kind === 'line' && m.a[0] === x + 7 && m.a[1] === y + 6 && m.b[0] === right && m.b[1] === y + 6), 'row divider starts after the shared symbol');
  assert.equal(marks.filter(m => m.kind === 'arc' && m.center[0] === x + 3.5 && m.center[1] === y + 6).length, 1, 'one centred position symbol');
  assert.ok(texts(marks).slice(0, 5).every(m => m.at[1] < y + 6));
  assert.ok(texts(marks).slice(5).every(m => m.at[1] > y + 6));
  const plainUpper: DrawingFrame = { id: 'upper', dim: 'u', ...upper };
  const plainLower: DrawingFrame = { id: 'lower', dim: 'l', characteristic: 'position', ...composite };
  const upperBorder = borderOf(frameMarks(under, plainUpper));
  const lowerBorder = borderOf(frameMarks(under, plainLower));
  assert.equal(right - x, Math.max(upperBorder.points[1][0] - upperBorder.points[0][0], lowerBorder.points[1][0] - lowerBorder.points[0][0]));
  const topRight = upperBorder.points[1][0], bottomRight = lowerBorder.points[1][0];
  const shortRight = Math.min(topRight, bottomRight);
  if (topRight !== bottomRight) {
    const shortTop = topRight < bottomRight ? y : y + 6;
    assert.ok(marks.some(m => m.kind === 'line' && m.a[0] === shortRight && m.b[0] === shortRight && m.a[1] === shortTop && m.b[1] === shortTop + 6), 'shorter row keeps its last cell width');
  }
  assert.equal(upperBorder.points[2][1] - upperBorder.points[0][1], 6, 'legacy single rows remain 6 paper mm high');
  assert.deepEqual(texts(frameMarks(under, plainUpper)).map(m => m.text), ['0.25', 'M', 'A', 'L', 'B']);
});

test('attached and standalone composite frames keep both rows through the file codec, sheet, SVG and attached PMI at two scales', async () => {
  const doc = starterDoc(), initialInput = drawingInputs(doc);
  if (typeof initialInput === 'string') assert.fail(initialInput);
  const edge = initialInput.views.front.edges.find(e => e.kind === 'line' && e.ends?.some(p => p[0] === 0 && p[1] === 0 && p[2] === 0) && e.ends.some(p => p[0] === 64 && p[1] === 0 && p[2] === 0));
  assert.ok(edge, 'the starter has a 64 mm edge');
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [{ id: 'd1', kind: 'linear', view: 'front', a: { edge: edge.name, at: 'end', near: [0, 0, 0] }, b: { edge: edge.name, at: 'end', near: [64, 0, 0] }, orient: 'horizontal', place: [0, -10] }] };
  const source = { ...doc, drawing: settings }, before = structuredClone(source);
  const accepted = runDrawingTool(source, 'set_drawing', { frames: [attached, standalone] });
  if ('error' in accepted) assert.fail(accepted.error);
  assert.equal(accepted.doc.schema, source.schema, 'the accepted edit keeps the document schema');
  assert.deepEqual(accepted.doc.drawing?.frames, [attached, standalone]);
  const opened = await readStudioFile(encodeStudioFile(accepted.doc));
  assert.ok('doc' in opened);
  assert.equal(opened.doc.schema, source.schema, 'the reopened document keeps the input schema');
  assert.deepEqual(opened.doc.drawing?.frames, [attached, standalone]);
  const input = drawingInputs(opened.doc);
  if (typeof input === 'string') assert.fail(input);
  let width: number | undefined;
  for (const scale of [0.5, 2]) {
    const current = { ...readDrawing(opened.doc.drawing), scale }, ctx = issueContext({ ...input, settings: current });
    const controls = ctx.sheet.groups.filter(g => g.role === 'control');
    assert.equal(controls.length, 2);
    const shown: DrawingFrame[] = [attached, standalone];
    for (const frame of shown) {
      const group: (typeof controls)[number] | undefined = controls.find(g => g.id === frame.id); assert.ok(group);
      const border = borderOf(group.marks), [x, y] = border.points[0];
      assert.ok(Math.abs(border.points[2][1] - y - 12) < 1e-9, 'two 6 mm rows remain paper-sized');
      assert.deepEqual(texts(group.marks).map(m => m.text), ['0.25', 'M', 'A', 'L', 'B', 'Ø0.1', 'L', 'B', 'M']);
      const w = border.points[1][0] - x;
      if (width === undefined) width = w; else assert.ok(Math.abs(w - width) < 1e-9);
      const fragment = sheetGroupsSvg({ ...ctx.sheet, groups: [group] }, null, null, frame.id);
      assert.match(fragment, frame.id === 'standalone' ? /data-standalone-frame="standalone"/ : /data-dim="attached"/);
      if (frame.id === 'standalone') assert.match(fragment, /class="control sel"/);
      else assert.match(fragment, /class="control"/);
      assert.match(fragment, />0\.25<\/text>/); assert.match(fragment, />Ø0\.1<\/text>/);
      if (frame.id === 'standalone') {
        const origin = ctx.layout.views.front.origin;
        assert.deepEqual([x, y], [origin[0] + scale * 10, origin[1] - scale * 20]);
      }
    }
    assert.match(sheetSvg(ctx.sheet, 'Composite frame'), /width="297mm" height="210mm"/);
    const lifted = modelAnnotations({ ...input, settings: current, layout: ctx.layout, sheet: ctx.sheet });
    const item = lifted.items.find(i => i.kind === 'frame' && i.id === 'attached'); assert.ok(item?.frame);
    assert.deepEqual(item.texts.map(t => t.text), ['0.25', 'M', 'A', 'L', 'B', 'Ø0.1', 'L', 'B', 'M']);
    assert.deepEqual(item.frame.composite, { zone: 'diameter', value: 0.1, datums: ['B'], material: 'least', datumModifiers: { B: 'maximum' }, cells: [{ text: 'Ø0.1(L)' }, { text: 'B(M)' }] });
    assert.ok(lifted.left.some(i => i.id === 'standalone' && i.why === 'a standalone frame has no attached model geometry'));
  }
  assert.deepEqual(source, before);
});
