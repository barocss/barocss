import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDrawing, readDrawing } from '@barocss/cad-model/drawing/types';
import { starterDoc } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { forSheet, mergeSheet } from '@barocss/cad-model/drawing/sheets';
import { committedSettings } from '../src/ui/drawing/commitSettings';

test('settings the workspace commits equal their reopened form as JSON', async () => {
  const frame = { id: 'frame-1', view: 'front' as const, place: [1, 2] as [number, number], characteristic: 'profile-surface' as const, value: 0.3, datums: ['A'], around: 'all-over' as const, stacked: { datums: ['B'], value: 0.2 }, statistical: true };
  const committed = committedSettings({ ...defaultDrawing(), frames: [frame] }, { kind: 'part' });
  const opened = await readStudioFile(encodeStudioFile({ ...starterDoc(), drawing: committed })); assert.ok('doc' in opened);
  assert.equal(JSON.stringify(opened.doc.drawing), JSON.stringify(committed));
  assert.equal(JSON.stringify(readDrawing(committed)), JSON.stringify(committed));
});

test('11 ④: a drawing with sheets, committed from an edit of its second sheet, equals its reopened form as JSON', async () => {
  const whole = { ...defaultDrawing(), views: ['front' as const, 'top' as const, 'right' as const, 'iso' as const], sheets: [{ id: 'S2', name: 'Details', size: 'A3' as const, views: ['iso', 'right'] }], revisions: [{ revision: 'A', date: '2026-10-01', description: 'first', eco: 'ECO-7' }] };
  const on2 = forSheet(whole, 1), edited = mergeSheet(whole, 1, { ...on2, notes: [{ id: 'n1', text: 'NEW', at: [100, 50] as [number, number], leader: { view: 'right' as const, at: [4, 4] as [number, number] } }] });
  const committed = committedSettings(edited, { kind: 'part' });
  const opened = await readStudioFile(encodeStudioFile({ ...starterDoc(), drawing: committed })); assert.ok('doc' in opened);
  assert.equal(JSON.stringify(opened.doc.drawing), JSON.stringify(committed));
  assert.deepEqual(committed.sheets, whole.sheets);
  assert.ok(!('sheetContext' in committed));
});
