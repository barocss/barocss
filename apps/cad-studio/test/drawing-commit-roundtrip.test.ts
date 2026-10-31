import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDrawing, readDrawing } from '@barocss/cad-model/drawing/types';
import { starterDoc } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { committedSettings } from '../src/ui/drawing/commitSettings';

test('settings the workspace commits equal their reopened form as JSON', async () => {
  const frame = { id: 'frame-1', view: 'front' as const, place: [1, 2] as [number, number], characteristic: 'profile-surface' as const, value: 0.3, datums: ['A'], around: 'all-over' as const, stacked: { datums: ['B'], value: 0.2 }, statistical: true };
  const committed = committedSettings({ ...defaultDrawing(), frames: [frame] }, { kind: 'part' });
  const opened = await readStudioFile(encodeStudioFile({ ...starterDoc(), drawing: committed })); assert.ok('doc' in opened);
  assert.equal(JSON.stringify(opened.doc.drawing), JSON.stringify(committed));
  assert.equal(JSON.stringify(readDrawing(committed)), JSON.stringify(committed));
});
