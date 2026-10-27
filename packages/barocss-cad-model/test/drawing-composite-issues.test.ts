import test from 'node:test';
import assert from 'node:assert/strict';
import { starterDoc } from '../src/engine/doc';
import { drawingInputs } from '../src/chat/drawing';
import { defaultDrawing, type DrawingFrame, type DrawingSettings } from '../src/drawing/types';
import { drawingIssues, issueContext } from '../src/drawing/issues';

test('composite frames report missing datums from both rows without changing the frame', () => {
  const input = drawingInputs(starterDoc());
  if (typeof input === 'string') assert.fail(input);
  const frame: DrawingFrame = { id: 'composite', view: 'front', place: [10, 20], characteristic: 'position', value: 0.2, datums: ['A'], composite: { value: 0.1, datums: ['A', 'B'] } };
  const settings: DrawingSettings = { ...defaultDrawing(), frames: [frame] }, before = structuredClone(settings);
  const issues = drawingIssues(issueContext({ ...input, settings }));
  const missing = issues.filter(issue => issue.code === 'DATUM_UNDEFINED' && issue.frames?.includes(frame.id));
  assert.equal(missing.length, 1);
  assert.match(missing[0].message, /A, B/);
  assert.deepEqual(settings, before);
});
