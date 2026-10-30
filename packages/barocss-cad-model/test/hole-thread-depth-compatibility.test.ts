import test from 'node:test';
import assert from 'node:assert/strict';
import { commandById, patchValues, type Ctx } from '../src/app/commands';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { rectanglePart, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { brepsFor, evaluateDoc } from '../src/engine/evaluate';
import { featureId } from '../src/engine/ids';
import { holeCallout } from '../src/drawing/callout';
import { resolveDimension } from '../src/drawing/dimensions';
import { projectViews } from '../src/drawing/project';
import { buildSheet } from '../src/drawing/sheet';
import { defaultDrawing, type DrawingDimension } from '../src/drawing/types';
import { layoutSheet } from '../src/drawing/views';
import { withSampleRows } from './person-file';

type Hole = Extract<ModelNode, { kind: 'hole' }>;
const hole = commandById('hole')!;

function context(): Ctx {
  const doc = withSampleRows(rectanglePart(32, 32, 8));
  const result = evaluateDoc(doc, 1);
  assert.ok(result.ok, result.ok ? '' : result.error.title + ' ' + result.error.hint);
  const face = result.bodies[0].mesh.faces.find(f => f.name === 'n1.top');
  assert.ok(face, 'the command uses the plate top face');
  return { doc, bodies: result.bodies, selection: { faces: [{ body: 0, face: face.index }], edges: [], bodies: [] } };
}

function makeHole(ctx: Ctx, tapped: boolean, blind: boolean): StudioDoc {
  const values = patchValues(hole, ctx, hole.defaults!(ctx), {
    type: tapped ? 'tapped' : blind ? 'blind' : 'through',
    thread: 'M6', tend: blind ? 'blind' : 'through', d: 5, depth: 5, x: 10, y: 16,
  });
  return hole.build!(ctx, values);
}

function lastHole(doc: StudioDoc): Hole {
  const node = doc.nodes.at(-1);
  assert.ok(node?.kind === 'hole');
  return node;
}

async function roundTrip(doc: StudioDoc): Promise<StudioDoc> {
  const read = await readStudioFile(encodeStudioFile(doc));
  assert.ok('doc' in read, JSON.stringify(read));
  return read.doc;
}

test('Hole command plain and tapped depth choices survive Save/Open with their callouts', async () => {
  const ctx = context();
  const cases = [
    { tapped: false, blind: false, text: 'Ø5 THRU' },
    { tapped: false, blind: true, text: 'Ø5 × 5 DEEP' },
    { tapped: true, blind: false, text: 'M6×1 THRU' },
    { tapped: true, blind: true, text: 'M6×1 × 5 DEEP' },
  ];
  for (const c of cases) {
    const made = makeHole(ctx, c.tapped, c.blind), saved = await roundTrip(made);
    const node = lastHole(saved);
    assert.deepEqual(saved.nodes, made.nodes, c.text);
    assert.equal(saved.units, 'mm');
    assert.equal(node.radius, 2.5, 'the M6 tap drill is Ø5, not the nominal Ø6');
    assert.equal(Object.hasOwn(node, 'depth'), c.blind, 'through omits the command default depth');
    assert.equal(node.depth, c.blind ? 5 : undefined);
    assert.equal(Object.hasOwn(node, 'thread'), c.tapped);
    assert.equal(node.thread, c.tapped ? 'M6×1' : undefined);
    const edge = `${featureId(saved.nodes, saved.nodes.length - 1)}.side0|n1.top`;
    assert.equal(holeCallout(saved.nodes, edge), c.text);
  }
});

test('legacy plain and tapped holes keep omitted depth as through after migration and Save/Open', async () => {
  for (const c of [{ thread: undefined, text: 'Ø5 THRU' }, { thread: 'M6×1', text: 'M6×1 THRU' }]) {
    const base = rectanglePart(32, 32, 8);
    const legacyHole = {
      kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 16], radius: 2.5,
      ...(c.thread === undefined ? {} : { thread: c.thread }),
    };
    const legacy = {
      ...base, schema: 3, units: undefined, nextId: undefined,
      nodes: [...base.nodes.map(({ id: _, ...node }) => node), legacyHole],
    };
    const read = await readStudioFile(new TextEncoder().encode(JSON.stringify(legacy)));
    assert.ok('doc' in read, JSON.stringify(read));
    assert.equal(read.doc.schema, 3);
    assert.equal(read.doc.units, 'mm');
    assert.ok(read.notes.includes('no units given: read as millimetres'));
    const saved = await roundTrip(read.doc), node = lastHole(saved);
    assert.deepEqual(node, { ...legacyHole, id: 'n2' });
    assert.equal(Object.hasOwn(node, 'depth'), false);
    assert.equal(Object.hasOwn(node, 'thread'), c.thread !== undefined);
    assert.equal(holeCallout(saved.nodes, 'n2.side0|n1.top'), c.text);
  }
});

test('a saved tapped blind hole keeps model mm and callout text when the sheet scale changes', async () => {
  // This checks the existing cosmetic tap contract, not a separate thread depth or a helical bore.
  const saved = await roundTrip(makeHole(context(), true, true));
  const breps = brepsFor(saved);
  assert.ok('breps' in breps, JSON.stringify(breps));
  const projected = projectViews(breps.breps, breps.prefixes);
  assert.ok(projected.ok, JSON.stringify(projected));
  const views = projected.views, id = featureId(saved.nodes, saved.nodes.length - 1);
  const edge = views.top.edges.find(e => e.kind === 'circle' && e.name.includes(`${id}.side0`));
  assert.ok(edge?.circle, 'the actual tap-drill rim is projected');
  const dim: DrawingDimension = {
    id: 'd1', view: 'top', kind: 'diameter', edge: edge.name,
    near: [...edge.circle.center] as [number, number, number], place: [20, 20],
  };
  const resolved = resolveDimension(views, dim);
  assert.ok(resolved.ok && resolved.kind === 'diameter', JSON.stringify(resolved));
  // Derived geometry can round: compare lengths within 1e-9 mm, not bit equality; stored values stay strict.
  assert.ok(Math.abs(resolved.radius - 2.5) <= 1e-9, `tap-drill radius in model mm: ${resolved.radius}`);
  assert.ok(Math.abs(resolved.value - 5) <= 1e-9, `tap-drill diameter in model mm: ${resolved.value}`);
  assert.equal(resolved.text, 'Ø5', 'the physical measurement is the tap drill');
  assert.equal(lastHole(saved).depth, 5);
  assert.equal(lastHole(saved).thread, 'M6×1');
  for (const c of [{ scale: 0.5, paperRadius: 1.25 }, { scale: 2, paperRadius: 5 }]) {
    const settings = { ...defaultDrawing(), scale: c.scale, dimensions: [dim] };
    const layout = layoutSheet(views, settings);
    assert.equal(layout.scale, c.scale);
    const sheet = buildSheet(views, layout, settings, {
      title: 'Tap depth compatibility', date: '2026-10-26', callout: name => holeCallout(saved.nodes, name),
    });
    const group = sheet.groups.find(g => g.role === 'dimension' && g.id === 'd1');
    assert.ok(group);
    assert.deepEqual(group.marks.filter(m => m.kind === 'text').map(m => m.text), ['M6×1 × 5 DEEP']);
    const top = sheet.groups.find(g => g.role === 'view' && g.view === 'top');
    const rim = top?.marks.find(m => m.kind === 'arc' && m.pen === 'visible');
    assert.ok(rim?.kind === 'arc');
    assert.ok(Math.abs(Math.hypot(...rim.u) - c.paperRadius) <= 1e-9, `rim u length in paper mm at scale ${c.scale}`);
    assert.ok(Math.abs(Math.hypot(...rim.v) - c.paperRadius) <= 1e-9, `rim v length in paper mm at scale ${c.scale}`);
  }
});
