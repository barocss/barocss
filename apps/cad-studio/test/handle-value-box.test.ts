import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server.edge';
import type { Command, Ctx } from '@barocss/cad-model/app/commands';
import type { Active } from '../src/app/commandState';
import { createValueStore } from '../src/state/valueStore';
import { useCommandGizmos } from '../src/viewport/useCommandGizmos';
import type { FeatureHandle } from '../src/viewport/Viewport';
import { HandleValueBox } from '../src/viewport/HandleValueBox';

// Roadmap 20 ④ ⑥: a running command's handles offer a typed value (the same values the HUD edits) and their unit;
// the box shows the handle's label, value and unit, and says the preview is applied with Enter and cancelled with Esc.
const doc = { nodes: [{ kind: 'box' }] } as never, selection = { faces: [], edges: [], bodies: [] };
const ctx = { doc, bodies: [], selection } as unknown as Ctx;
const cmd = { id: 'fillet', label: 'Fillet', fields: () => [{ key: 'radius', label: 'Radius', kind: 'mm', min: 0.1 }, { key: 'turn', label: 'Turn', kind: 'deg' }],
  build: (c: Ctx) => c.doc,
  handles: (_c: Ctx, v: Record<string, unknown>) => [{ key: 'radius', at: [Number(v.radius), 0, 0], dir: [1, 0, 0], min: 0.1, step: 0.5 },
    { key: 'turn', at: [0, 0, 0], dir: [1, 0, 0], arc: { centre: [0, 0, 0], axis: [0, 0, 1], from: [1, 0, 0] } }] } as unknown as Command;

function handlesOf(store: ReturnType<typeof createValueStore<Active | null>>, handleDrag: { current: unknown }) {
  let out: FeatureHandle[] = [];
  const Gizmos = () => { out = useCommandGizmos({ model: { doc, evaluated: doc, bodies: [], selection, marker: null, editNode: null },
    command: { active: store.get(), ctx, setActive: store.set, handleDrag: handleDrag as never, previewFor: { current: null } },
    context: { sketch: null, rendering: false, drawing: false, measure: null, assemblyDraft: null, instanceCount: 0, snapStep: 1 },
    drag: { bodyDrag: null, setBodyDrag() {} } }).handles; return null; };
  renderToString(createElement(Gizmos));
  return out;
}

test('a running command\'s handle types its value into the command, as the HUD does', () => {
  const store = createValueStore<Active | null>({ cmd, ctx, values: { radius: 3, turn: 30 }, preview: 'ok' } as unknown as Active);
  const handleDrag = { current: { key: 'radius', dragging: false } as unknown };
  const [radius, turn] = handlesOf(store, handleDrag);
  assert.equal(radius.editing, true);
  // (The command the handle belongs to: the value box shows only for the command whose handle was let go.)
  assert.equal(radius.owner, cmd);
  assert.equal(turn.owner, cmd);
  assert.equal(radius.unit, 'mm');
  assert.equal(turn.unit, '°');
  radius.onType!(7.25);
  assert.equal(store.get()!.values.radius, 7.25);
  assert.equal(store.get()!.values.turn, 30);
  assert.equal(store.get()!.preview, 'busy');
  // (A typed value is not a drag: no drag bound holds it.)
  assert.equal(handleDrag.current, null);
});

test('the value box shows the label, the value and its unit, and how the preview is applied or cancelled', () => {
  const html = renderToString(createElement(HandleValueBox, { label: 'Width X', value: 68, unit: 'mm', at: [500, 300], width: 1000, height: 800, onType() {} }));
  assert.match(html, /Width X/);
  assert.match(html, /value="68"/);
  assert.match(html, />mm</);
  assert.match(html, /Enter applies · Esc cancels/);
  assert.match(html, /left:518px;top:314px/);
});

test('near the viewport\'s edges the value box goes left of and above the handle tip', () => {
  const html = renderToString(createElement(HandleValueBox, { label: 'Radius', value: 3, unit: 'mm', at: [990, 790], width: 1000, height: 800, onType() {} }));
  assert.match(html, /left:776px;top:724px/);
});
