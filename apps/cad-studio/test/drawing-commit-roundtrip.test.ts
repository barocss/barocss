import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDrawing, readDrawing, withSections } from '@barocss/cad-model/drawing/types';
import { starterDoc } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { forSheet, mergeSheet } from '@barocss/cad-model/drawing/sheets';
import { committedSettings, committedSheetSettings } from '../src/ui/drawing/commitSettings';

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


test('Fix waits for the committed section settings, including their canonical key order', () => {
  const scope = { kind: 'part' as const };
  const whole = { ...defaultDrawing(), scope, hidden: false, centers: false, precision: { mm: 0 }, views: ['front' as const, 'top' as const, 'right' as const], notes: [{ id: 'n1', text: 'KEEP', at: [0, 0] as [number, number] }] };
  const next = withSections(whole, [{ id: 'B', view: 'top', at: 0 }]);
  const accepted = committedSettings(next, scope), wanted = committedSheetSettings(whole, 0, next, scope);
  assert.notEqual(JSON.stringify(next), JSON.stringify(accepted), 'appending a section changes its reader key order');
  assert.equal(JSON.stringify(wanted), JSON.stringify(accepted));
  assert.equal(wanted.hidden, false); assert.equal(wanted.centers, false); assert.equal(wanted.precision?.mm, 0);
  assert.equal(wanted.sections?.[0].at, 0); assert.deepEqual(wanted.notes?.[0].at, [0, 0]);
  assert.ok(!('scale' in wanted)); assert.ok(!('tangent' in wanted));
  const foreign = committedSettings({ ...next, notes: [{ ...next.notes![0], text: 'CHANGED' }] }, scope);
  assert.notEqual(JSON.stringify(wanted), JSON.stringify(foreign), 'an unrelated semantic edit still cancels the pending round');
});

test('Fix waits for the current sheet while retaining the other sheet and its controls', () => {
  const scope = { kind: 'part' as const };
  const whole = { ...defaultDrawing(), scope, scale: 1, views: ['front' as const, 'top' as const, 'right' as const, 'iso' as const], notes: [{ id: 'first', text: 'KEEP FIRST', at: [0, 0] as [number, number] }], sheets: [{ id: 'S2', name: 'Details', size: 'A3' as const, scale: 0.5, views: ['right', 'iso'] }] };
  const on2 = forSheet(whole, 1), next = { ...on2, notes: [{ id: 'second', text: 'SECOND', at: [0, 0] as [number, number], leader: { view: 'right' as const, at: [0, 0] as [number, number] } }] };
  const accepted = committedSettings(mergeSheet(whole, 1, next), scope);
  const wanted = committedSheetSettings(whole, 1, next, scope);
  assert.equal(JSON.stringify(wanted), JSON.stringify(forSheet(accepted, 1)));
  assert.equal(wanted.sheet, 'A3'); assert.equal(wanted.scale, 0.5);
  assert.deepEqual(wanted.views, ['right', 'iso']); assert.equal(wanted.sheetContext?.n, 2);
  assert.ok(wanted.notes?.some(n => n.id === 'second')); assert.ok(!wanted.notes?.some(n => n.id === 'first'));
  const first = forSheet(accepted, 0); assert.equal(first.scale, 1); assert.ok(first.notes?.some(n => n.id === 'first'));
  assert.notEqual(JSON.stringify(wanted), JSON.stringify(committedSheetSettings(whole, 0, next, scope)), 'active-sheet identity remains distinct');
});
