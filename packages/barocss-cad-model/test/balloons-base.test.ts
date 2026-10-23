import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { drawingInputs } from '../src/chat/drawing';
import { issueContext } from '../src/drawing/issues';
import { readDrawing } from '../src/drawing/types';
import { personFile } from './person-file';

// O177 (found in O176): on an assembly's sheet with balloons, the base part's own lines (O169) — a frame member's
// cut-list row, a made body of its own — had no balloon: their parts are `base:<body key>`, and the balloon read that
// as an instance. Each now points at an edge of one of its own bodies, found by the bodies' face names.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
async function frameAndPlate(): Promise<StudioDoc> {
  const sections = personFile('sections.json', [{ id: 'R40', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, estimate: true }]);
  let s: ChatState = { doc: emptyDoc(), bodies: [], rowFiles: sections.rowFiles };
  const call = async (tool: string, args: Record<string, unknown>) => { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); s = r.state; };
  await call('features', { action: 'frame_sections', file: sections.file });
  await call('features', { action: 'command', command: 'frame', values: { skeleton: 'table', W: 400, D: 300, H: 300, x: 0, y: 0, z: 0, section: 'library', row: 'R40', corners: 'butt' } });
  // (A made body of the base's own besides the frame: a foot block by the table.)
  await call('features', { action: 'command', command: 'box', values: { w: 60, d: 60, h: 10, x: 500, y: 0, z: 0 } });
  return { ...s.doc, instances: [{ id: 'p1', name: 'Plate', doc: rectanglePart(100, 80, 10), position: [0, 0, 320], rotation: [0, 0, 0] }] };
}

test('O177: an assembly sheet with balloons — each member row\'s balloon on an edge of one of its pieces, the base\'s block on its own, the plate on the plate; none without an edge', async () => {
  const doc = await frameAndPlate();
  const i = drawingInputs(doc, { ...readDrawing(doc.drawing), scope: { kind: 'assembly' }, sheet: 'A3', balloons: true, tables: [{ id: 'bom', from: 'bom' }] });
  if (typeof i === 'string') throw Error(i);
  const lines = i.meta.bom!.lines, b = issueContext({ ...i, meta: { ...i.meta, date: '2026-10-23' } }).sheet.balloons!;
  assert.deepEqual(b.noEdge, [], JSON.stringify(lines.map(l => [l.item, l.parts])));
  for (const p of b.placed) {
    const l = lines[p.no - 1], faces = p.edge.split('|');
    if (l.member) {
      // (A member's piece b0_part<k> has the faces n0.m<k>.…: the balloon's edge is on one of this row's pieces.)
      const own = l.parts.map(x => `n0.m${x.slice('base:b0_part'.length)}.`);
      assert.ok(faces.every(f => own.some(o => f.startsWith(o))), `${l.item}: ${p.edge} not on ${own}`);
    } else if (l.item === 'Plate') assert.match(p.edge, /^p1\//);
    else assert.ok(faces.every(f => /^n\d+\.side|^n\d+\.(top|bottom)/.test(f) && !f.startsWith('n0.')), `${l.item}: ${p.edge}`);
  }
  assert.deepEqual(lines.filter(l => l.member).map(l => l.qty), [4, 2, 2]);
  assert.equal(b.placed.length, lines.length);
});
