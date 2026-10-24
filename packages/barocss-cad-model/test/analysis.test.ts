import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { runTool, type ChatState } from '../src/chat/tools';
import { withLook } from '../src/app/bodies';

// Analysis tools (A2.2): mass properties, interference and clearance, section, wall thickness, draft.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const call = async (s: ChatState, tool: string, args: unknown) => { const r = await runTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); return parse(r.content); };
const box = (doc: StudioDoc, x: number, w: number, h: number) => withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + w, 10] }), { kind: 'extrude', sketch: doc.nodes.length, height: h });

test('mass properties: area, mass by material (aluminium assumed until set), inertia scaled to the density', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  let [b] = (await call(s, 'mass_properties', {})).bodies;
  assert.deepEqual([b.volume, b.area, b.mass, b.assumed, b.centroid], [6400, 2560, 17.28, true, [20, 10, 4]]);
  // Steel: 7.85 g/cm³; Izz of a box about its centre m (a² + b²)/12.
  const doc = withLook(s.doc, s.bodies[0], { material: 'steel' }); s = await stateOf(doc);
  [b] = (await call(s, 'mass_properties', {})).bodies;
  assert.deepEqual([b.mass, b.assumed, b.material], [50.24, false, 'Steel (mild)']);
  // Independent MMGS oracle: 50.24 g and sides in mm give g·mm².
  const izz = 50.24 * (40 ** 2 + 20 ** 2) / 12;
  assert.ok(Math.abs(b.inertia[2][2] - izz) < 1e-6 * izz + 1e-12, String(b.inertia[2][2]));
  assert.equal(parse((await runTool(s, 'get_part_summary', {}, evaluate)).content).facts.mass_assumed, false);
});

test('interference: an overlap by its volume; apart, the clearance', async () => {
  const s = await stateOf(box(box(box(emptyDoc(), 0, 10, 5), 5, 10, 5), 30, 10, 5));
  const { pairs } = await call(s, 'interference', {});
  const p = (a: string, b: string) => pairs.find((x: { a: string; b: string }) => x.a === a && x.b === b);
  assert.equal(p('b1', 'b3').overlap_mm3, 5 * 10 * 5);
  assert.ok(Math.abs(p('b3', 'b5').clearance_mm - 15) < 1e-6);
  assert.ok(Math.abs(p('b1', 'b5').clearance_mm - 20) < 1e-6);
});

test('section, wall thickness and draft of a plate', async () => {
  const s = await stateOf(rectanglePart(40, 20, 8));
  const sec = await call(s, 'section', { axis: 'x', at: 10 });
  assert.deepEqual([sec.cut[0].body, sec.cut[0].cutArea, sec.cut[0].regions], ['b1', 160, 1]);
  assert.match(parse((await runTool(s, 'section', { axis: 'z', at: 50 }, evaluate)).content).error, /cuts no body/);
  const wall = await call(s, 'wall_thickness', {});
  assert.equal(wall.thinnest, 8);
  const draft = await call(s, 'draft', { body: 'b1' });
  assert.deepEqual([draft.walls.length, draft.under_min.length, draft.walls.every((w: { draft: number }) => w.draft === 0)], [4, 4, true]);
});
