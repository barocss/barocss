import test from 'node:test';
import assert from 'node:assert/strict';
import type { DirectDisplay } from '@barocss/cad-model/engine/direct';
import { sewPreviewDirect } from '../src/viewport/sewPreviewDirect';

function display(id: string, kind: DirectDisplay['kind'] = 'surface'): DirectDisplay {
  return { id, kind, name: id, positions: new Float32Array([1, 2, 3]), controls: new Float32Array([4, 5, 6]) };
}

test('drawn Sew candidate consumes only captured source IDs and preserves other display buffers', () => {
  const bottom = display('bottom'), top = display('top'), unselected = display('unselected'), curve = display('curve', 'curve');
  const items = [bottom, curve, unselected, top], before = structuredClone(items), selected = ['bottom', 'top'];
  const shown = sewPreviewDirect(items, 'sew', { direct: selected }, true);
  assert.deepEqual(shown, [curve, unselected]); assert.equal(shown[0], curve); assert.equal(shown[1], unselected);
  assert.equal(shown[0].positions, curve.positions); assert.equal(shown[1].controls, unselected.controls);
  assert.deepEqual(items, before); assert.deepEqual(selected, ['bottom', 'top']);
});

test('Cancel, failed or absent candidate, command switch and raw snapshots restore original display array', () => {
  const items = [display('bottom'), display('top'), display('curve', 'curve')], ctx = { direct: ['bottom', 'top'] };
  assert.equal(sewPreviewDirect(items, undefined, undefined, false), items); // Cancel.
  assert.equal(sewPreviewDirect(items, 'sew', ctx, false), items); // Error, null or empty preview.
  assert.equal(sewPreviewDirect(items, 'thicken', ctx, true), items);
  assert.equal(sewPreviewDirect(items, 'sew', { ...ctx, sewSnapshot: { surfaces: [], names: [] } }, true), items);
  assert.equal(sewPreviewDirect(items, 'sew', undefined, true), items);
  assert.equal(sewPreviewDirect(items, 'sew', { direct: [] }, true), items);
  assert.equal(sewPreviewDirect(items, 'sew', { direct: ['missing'] }, true), items);
});

test('retained successful candidate uses captured context IDs while current selection can change', () => {
  const first = display('first'), second = display('second'), curve = display('curve', 'curve'), items = [first, second, curve];
  const captured = { direct: ['first'] }, currentSelection = ['second'];
  // Busy evaluation retains the last successful candidate; display admission follows the drawn candidate.
  assert.deepEqual(sewPreviewDirect(items, 'sew', captured, true), [second, curve]);
  assert.deepEqual(currentSelection, ['second']); assert.deepEqual(captured.direct, ['first']);
  assert.equal(sewPreviewDirect(items, 'sew', captured, false), items);
});
