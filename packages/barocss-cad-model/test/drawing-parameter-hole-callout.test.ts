import test from 'node:test';
import assert from 'node:assert/strict';
import { drawingInputs } from '../src/chat/drawing';
import { rectanglePart, withNode, type Dim, type StudioDoc } from '../src/engine/doc';
import { featureId } from '../src/engine/ids';
import { addParameters } from '../src/engine/parameters';
import { holeCallout } from '../src/drawing/callout';
import { resolveDimension } from '../src/drawing/dimensions';
import { buildSheet } from '../src/drawing/sheet';
import type { DrawingDimension } from '../src/drawing/types';
import { layoutSheet } from '../src/drawing/views';

// Authored cosmetic-hole data uses the existing Dim contract. No separate thread-depth field is added.
// The current drawingInputs callback is used unchanged; no future holeCallout arguments are supplied.
function document(radius: Dim, depth: Dim, parameters: Record<string, number> = {}): StudioDoc {
  return withNode(addParameters(rectanglePart(32, 32, 8), parameters), {
    kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 16],
    radius, depth, thread: 'M6×1',
  });
}

// Derived geometric lengths use the existing Hole/Drawing regression convention, in mm.
function near(actual: number, expected: number): void {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected} mm`);
}

function checkDrawing(doc: StudioDoc, expected: string): void {
  const before = structuredClone(doc), input = drawingInputs(doc);
  assert.ok(typeof input !== 'string', typeof input === 'string' ? input : '');
  const id = featureId(doc.nodes, doc.nodes.length - 1);
  const edge = input.views.top.edges.find(e => e.kind === 'circle' && e.name.includes(`${id}.side0`));
  assert.ok(edge?.circle, 'the real tap-drill rim is projected');
  const node = doc.nodes.at(-1);
  if (node?.kind === 'hole' && typeof node.radius === 'number' && typeof node.depth === 'number') {
    assert.equal(holeCallout(doc.nodes, edge.name), expected, 'legacy two-argument literal callouts stay compatible');
  }
  const dim: DrawingDimension = {
    id: 'tap', view: 'top', kind: 'diameter', edge: edge.name,
    near: [...edge.circle.center] as [number, number, number], place: [20, 20],
  };
  const resolved = resolveDimension(input.views, dim);
  assert.ok(resolved.ok && resolved.kind === 'diameter', JSON.stringify(resolved));
  near(resolved.radius, 2.5); near(resolved.value, 5);
  assert.equal(resolved.text, 'Ø5', 'the measured drill is Ø5 although the nominal cosmetic thread is M6');
  const texts: string[][] = [];
  for (const c of [{ scale: 0.5, paperRadius: 1.25 }, { scale: 2, paperRadius: 5 }]) {
    const settings = { ...input.settings, scale: c.scale, dimensions: [dim] };
    const layout = layoutSheet(input.views, settings);
    assert.equal(layout.scale, c.scale);
    const sheet = buildSheet(input.views, layout, settings, { ...input.meta, callout: input.callout }, input.sections);
    const group = sheet.groups.find(g => g.role === 'dimension' && g.id === 'tap');
    assert.ok(group, 'the actual sheet contains the measured dimension');
    texts.push(group.marks.filter(m => m.kind === 'text').map(m => m.text));
    const top = sheet.groups.find(g => g.role === 'view' && g.view === 'top');
    const rim = top?.marks.find(m => m.kind === 'arc' && m.pen === 'visible');
    assert.ok(rim?.kind === 'arc');
    near(Math.hypot(...rim.u), c.paperRadius); near(Math.hypot(...rim.v), c.paperRadius);
  }
  assert.deepEqual(doc, before, 'Drawing preserves the literal values and parameter references');
  assert.deepEqual(texts, [[expected], [expected]], 'model-mm callouts are independent of paper scale');
}

test('a parameter-bound blind-hole depth draws the same callout as its literal five-mm value', () => {
  checkDrawing(document(2.5, 5), 'M6×1 × 5 DEEP');
  checkDrawing(document(2.5, { parameter: 'D' }, { D: 5 }), 'M6×1 × 5 DEEP');
});

test('a parameter-bound tap-drill radius retains the nominal callout and three-decimal depth rounding', () => {
  checkDrawing(document(2.5, 5), 'M6×1 × 5 DEEP');
  checkDrawing(document(2.5, 5.1236), 'M6×1 × 5.124 DEEP');
  checkDrawing(document({ parameter: 'R' }, 5, { R: 2.5 }), 'M6×1 × 5 DEEP');
  checkDrawing(document({ parameter: 'R' }, { parameter: 'D' }, { R: 2.5, D: 5.1236 }), 'M6×1 × 5.124 DEEP');
});
