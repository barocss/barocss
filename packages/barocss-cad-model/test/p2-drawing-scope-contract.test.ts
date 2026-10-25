import test from 'node:test';
import assert from 'node:assert/strict';
import { changeDrawingScope, checkDrawingScope, drawingScopeOf, type DrawingScope } from '../src/drawing/scope';
import { defaultDrawing, type DrawingDimension, type DrawingSettings } from '../src/drawing/types';
import { isRefusal } from '../src/engine/refusal';

// Source contract regressions for the scope transition helper used by SheetSettings and set_drawing.
// These synthetic settings do not evaluate a model, replay P2, or prove document/browser acceptance.
const dimension = (auto = false): DrawingDimension => ({
  id: 'd1', kind: 'linear', view: 'front',
  a: { edge: 'n0.side', at: 'end', near: [0, 0, 0] },
  b: { edge: 'n0.side', at: 'end', near: [10, 0, 0] },
  orient: 'horizontal', place: [5, 10], ...(auto ? { auto: true } : {}),
});
const protectedSettings = (): DrawingSettings => ({
  ...defaultDrawing(), scope: { kind: 'part', part: 'plate' }, dimensions: [dimension()],
  datums: [{ id: 'a', letter: 'A', view: 'front', place: [-10, 10], edge: { edge: 'n0.side', near: [0, 0, 0] } }],
  frames: [{ id: 'f1', dim: 'd1', characteristic: 'position', value: 0.25, datums: ['A'] }],
  notes: [{ id: 'note', text: 'Inspect here', at: [10, 10], leader: { view: 'front', at: [0, 0] } }],
});

test('same part scope snapshots the caller target while retaining manual references unchanged', () => {
  const settings = protectedSettings(), before = structuredClone(settings);
  const requested: DrawingScope = { kind: 'part', part: 'plate' };
  const result = changeDrawingScope(settings, requested);
  assert.deepEqual(settings, before);
  assert.deepEqual(requested, { kind: 'part', part: 'plate' });
  assert.notEqual(result.scope, requested);
  assert.deepEqual(result, before);
  requested.part = 'other';
  assert.equal(Object.isFrozen(requested), false, 'the helper does not freeze caller input');
  assert.deepEqual(drawingScopeOf(result), { kind: 'part', part: 'plate' });
  assert.deepEqual(result.dimensions, before.dimensions);
  assert.deepEqual(result.datums, before.datums);
  assert.deepEqual(result.frames, before.frames);
  assert.deepEqual(result.notes, before.notes);
  assert.throws(() => changeDrawingScope(result, requested), error => isRefusal(error, 'DRAWING_SCOPE_REFERENCES'));
});

test('same scope snapshots even when the requested object is already stored in the input settings', () => {
  const requested: DrawingScope = { kind: 'part', part: 'plate' };
  const settings: DrawingSettings = { ...defaultDrawing(), scope: requested, dimensions: [dimension()] };
  const result = changeDrawingScope(settings, requested);
  assert.notEqual(result.scope, settings.scope);
  requested.part = 'other';
  assert.deepEqual(result.scope, { kind: 'part', part: 'plate' });
  assert.deepEqual(result.dimensions, [dimension()]);
});

test('scope snapshots retain supported inherited kind and part values without changing validation', () => {
  for (const inherited of [{ kind: 'part', part: 'plate' }, { kind: 'assembly' }] as const) {
    const requested = Object.create(inherited) as DrawingScope;
    const settings: DrawingSettings = { ...defaultDrawing(), scope: { ...inherited }, dimensions: [dimension()] };
    assert.deepEqual(checkDrawingScope(requested), []);
    const result = changeDrawingScope(settings, requested);
    assert.deepEqual(result.scope, inherited);
    assert.notEqual(result.scope, requested);
    Object.defineProperty(requested, 'kind', { value: 'part', writable: true, enumerable: true });
    Object.defineProperty(requested, 'part', { value: 'other', writable: true, enumerable: true });
    assert.deepEqual(drawingScopeOf(result), inherited);
    assert.deepEqual(result.dimensions, settings.dimensions);
  }
  const requested = Object.create({ kind: 'part', part: 'cover' }) as DrawingScope;
  const result = changeDrawingScope(defaultDrawing(), requested);
  assert.deepEqual(result.scope, { kind: 'part', part: 'cover' });
});

test('same assembly scope snapshots the kind without weakening manual-reference protection', () => {
  const settings: DrawingSettings = { ...protectedSettings(), scope: { kind: 'assembly' } };
  const requested: { kind: 'part' | 'assembly'; part?: string } = { kind: 'assembly' };
  const result = changeDrawingScope(settings, requested as DrawingScope);
  assert.notEqual(result.scope, requested);
  assert.deepEqual(result.dimensions, settings.dimensions);
  requested.kind = 'part'; requested.part = 'plate';
  assert.deepEqual(drawingScopeOf(result), { kind: 'assembly' });
  assert.throws(() => changeDrawingScope(result, requested as DrawingScope), error => isRefusal(error, 'DRAWING_SCOPE_REFERENCES'));
});

test('a changed part target snapshots its id and still clears automatic dimensions only in the result', () => {
  const settings: DrawingSettings = { ...defaultDrawing(), scope: { kind: 'part', part: 'plate' }, dimensions: [dimension(true)] };
  const before = structuredClone(settings), requested: DrawingScope = { kind: 'part', part: 'cover' };
  const result = changeDrawingScope(settings, requested);
  assert.deepEqual(settings, before);
  assert.deepEqual(result.dimensions, []);
  assert.notEqual(result.scope, requested);
  requested.part = 'other';
  assert.deepEqual(result.scope, { kind: 'part', part: 'cover' });
  assert.deepEqual(settings.scope, { kind: 'part', part: 'plate' });
});

test('a changed assembly scope snapshots its kind and leaves caller objects mutable', () => {
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [dimension(true)] };
  const requested: { kind: 'part' | 'assembly'; part?: string } = { kind: 'assembly' };
  const result = changeDrawingScope(settings, requested as DrawingScope);
  assert.deepEqual(result.dimensions, []);
  assert.notEqual(result.scope, requested);
  requested.kind = 'part'; requested.part = 'other';
  assert.deepEqual(result.scope, { kind: 'assembly' });
  assert.equal(settings.dimensions.length, 1);
});

test('each existing manual-reference category still refuses a different scope atomically', () => {
  const protectedInput = protectedSettings();
  const variants: DrawingSettings[] = [
    { ...defaultDrawing(), dimensions: protectedInput.dimensions },
    { ...defaultDrawing(), datums: protectedInput.datums },
    { ...defaultDrawing(), frames: protectedInput.frames },
    { ...defaultDrawing(), notes: protectedInput.notes },
  ];
  for (const settings of variants) {
    const requested: DrawingScope = { kind: 'assembly' }, before = structuredClone(settings);
    assert.throws(() => changeDrawingScope(settings, requested), error => isRefusal(error, 'DRAWING_SCOPE_REFERENCES'));
    assert.deepEqual(settings, before);
    assert.deepEqual(requested, { kind: 'assembly' });
  }
});

test('implicit part and legacy BOM assembly meanings keep their existing same-scope behavior', () => {
  const part: DrawingSettings = { ...defaultDrawing(), dimensions: [dimension()] };
  assert.deepEqual(changeDrawingScope(part, { kind: 'part' }).dimensions, part.dimensions);
  for (const legacy of [
    { ...part, balloons: true },
    { ...part, tables: [{ id: 'bom', from: 'bom' }] },
  ]) {
    const requested: DrawingScope = { kind: 'assembly' }, result = changeDrawingScope(legacy, requested);
    assert.deepEqual(result.dimensions, legacy.dimensions);
    assert.deepEqual(result.scope, requested);
    assert.notEqual(result.scope, requested);
  }
});

test('invalid scope values retain the existing typed refusal and never change settings', () => {
  const settings = protectedSettings(), before = structuredClone(settings);
  const invalid: unknown[] = [null, [], { kind: 'unknown' }, { kind: 'part', part: '' }, { kind: 'part', part: 1 }, { kind: 'assembly', part: 'plate' }, { kind: 'part', extra: true }];
  for (const requested of invalid) {
    const inputBefore = structuredClone(requested);
    assert.equal(checkDrawingScope(requested)[0]?.code, 'DRAWING_SCOPE');
    assert.throws(() => changeDrawingScope(settings, requested as DrawingScope), error => isRefusal(error, 'DRAWING_SCOPE'));
    assert.deepEqual(requested, inputBefore);
    assert.deepEqual(settings, before);
  }
});
