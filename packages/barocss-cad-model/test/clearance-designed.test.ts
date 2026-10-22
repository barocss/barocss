import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { personFile } from './person-file';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { editBearingRows } from '../src/engine/bearings';
import { editFitTables } from '../src/engine/fits';
import { editORingRows } from '../src/engine/orings';
import { applyFill, assemblyPlacedBodies, clearanceMap, designedSeats, fillOverlap, TOUCHING_MM3, type ClearanceMap, type PlacedBody } from '../src/team/clearanceMap';

// A9-5/6: contact is not a clash. Two boxes side by side are in contact at once, then touching (0 mm³); a welded table
// frame's members all touching, none overlapping. Pairs a feature seats together are designed, named: a key in its
// keyseat, a bearing on its shaft at k5 — and the default shaft's key under that bearing is a clash (115 mm³, nothing
// seats them). An O-ring is designed against what squeezes it, in another part too: a plate on the cover's face gland
// overlaps the ring by exactly its gland's figure; pressed further, more than that, a clash. Rows are the tests' own.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const box = (x: number, y: number, z: number): StudioDoc => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [x, y] } as never), { kind: 'extrude', sketch: 0, height: z } as never);
const inst = (id: string, doc: StudioDoc, position: [number, number, number]): PartInstance => ({ id, name: id, doc, position, rotation: [0, 0, 0] });
const ROW = { id: '6204', designation: '6204', boreMM: 20, outsideMM: 47, widthMM: 14, chamferMM: 1, daMinMM: 25, daMaxMM: 26.5, DaMaxMM: 42, raMaxMM: 1, boreDeviationUM: [0, -10], source: 'B1 (D139)' };
const FITS = { id: 'seat-fits', rows: [{ class: 'k5', overMM: 18, upToMM: 30, upperUM: 11, lowerUM: 2, estimate: true }] };
const O1 = { id: '214', dash: '2-214', insideDiameterMM: 24.99, crossSectionMM: 3.53, source: 'O1 (D139)' };
/** The map with every pending volume filled. */
function filled(bodies: readonly PlacedBody[], nearMM = 1): ClearanceMap {
  const map = clearanceMap(bodies, { nearMM });
  for (const p of [...map.pairs]) if (p.overlap && 'pending' in p.overlap) assert.ok(applyFill(map, fillOverlap(map, bodies, p)));
  return map;
}
const pairOf = (map: ClearanceMap, a: string, b: string) => map.pairs.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a))!;
let s: ChatState;
async function run(tool: string, args: Record<string, unknown>) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }

test('A9-5: two boxes side by side — in contact at once (pending, not an overlap), then touching: 0 mm³', async () => {
  const bodies = await assemblyPlacedBodies({ ...box(20, 20, 10), instances: [inst('p', box(20, 20, 10), [20, 0, 0])] }, evaluate);
  const map = clearanceMap(bodies, { nearMM: 1 }), p = map.pairs[0];
  assert.deepEqual([map.pairs.length, p.state, p.minGapMM, map.pending], [1, 'contact', 0, 1]);
  assert.ok(applyFill(map, fillOverlap(map, bodies, p)));
  assert.ok(p.state === 'touching' && p.overlap && 'volumeMM3' in p.overlap && p.overlap.volumeMM3 <= TOUCHING_MM3, JSON.stringify([p.state, p.overlap && 'volumeMM3' in p.overlap ? p.overlap.volumeMM3 : p.overlap]));
});

test('A9-5: a welded table frame (R40, butt corners) — every pair of members at no distance is touching once filled, none overlapping', async () => {
  const sections = personFile('sections.json', [{ id: 'R40', name: 'RHS 40', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, source: 'a test value' }]);
  s = { doc: emptyDoc(), bodies: [], rowFiles: sections.rowFiles };
  await run('features', { action: 'frame_sections', file: sections.file });
  await run('features', { action: 'command', command: 'frame', values: { skeleton: 'table', W: 400, D: 300, H: 300, x: 0, y: 0, z: 0, section: 'library', row: 'R40', corners: 'butt' } });
  const map = filled(await assemblyPlacedBodies(s.doc, evaluate)), at0 = map.pairs.filter(p => p.minGapMM === 0);
  assert.equal(at0.length, 12, JSON.stringify(map.pairs.map(p => [p.a, p.b, p.state])));
  assert.deepEqual([...new Set(at0.map(p => p.state))], ['touching']);
});

test('A9-6: the default shaft, a key in its keyseat, a 6204 on step 1 at k5 — both seats designed, named; the key under the bearing a clash (nothing seats them)', async () => {
  s = { doc: emptyDoc(), bodies: [] };
  await run('features', { action: 'command', command: 'shaft', values: {} });
  s = { ...s, doc: (editFitTables((editBearingRows(s.doc, [ROW]) as { doc: StudioDoc }).doc, [FITS]) as { doc: StudioDoc }).doc };
  await run('features', { action: 'command', command: 'key', values: { h: 6 }, bodies: ['b0'] });
  await run('features', { action: 'command', command: 'bearing', values: { sc: 'k5' }, bodies: ['b0'] });
  const bodies = await assemblyPlacedBodies(s.doc, evaluate), map = filled(bodies);
  const key = pairOf(map, 'b0', 'b1'), seat = pairOf(map, 'b0', 'b2'), clash = pairOf(map, 'b1', 'b2');
  assert.deepEqual([key.state, key.designed], ['designed', 'key n1 in its keyseat']);
  assert.deepEqual([seat.state, seat.designed], ['designed', 'bearing n2 (6204) on its shaft, seat k5']);
  assert.ok(clash.state === 'overlap' && !clash.designed && clash.overlap && 'volumeMM3' in clash.overlap && clash.overlap.volumeMM3 > 100, JSON.stringify([clash.state, clash.overlap && 'volumeMM3' in clash.overlap && clash.overlap.volumeMM3]));
  // (Both ways, by body key; nothing seats the key with the bearing.)
  const e = await evaluate(s.doc); assert.ok(e.ok);
  const seats = designedSeats(s.doc, e.bodies);
  assert.equal(seats.get('b0')?.get('b2'), seats.get('b2')?.get('b0'));
  assert.equal(seats.get('b1')?.get('b2'), undefined);
});

test('A9-6: an O-ring in a face gland, a plate placed on the cover — designed against the plate, its overlap exactly the gland\'s figure; pressed 0.2 further, more than that: a clash', async () => {
  s = { doc: emptyDoc(), bodies: [] };
  await run('features', { action: 'command', command: 'cylinder', values: { r: 30, h: 8, x: 0, y: 0, z: 0 } });
  s = { ...s, doc: (editORingRows(s.doc, [O1]) as { doc: StudioDoc }).doc };
  await run('features', { action: 'command', command: 'oring-gland', values: {}, faces: ['n1.top'] });
  await run('assembly', { action: 'add_part', name: 'Plate', position: [-40, -40, 8] });
  await run('features', { action: 'command', part: 'p1', command: 'box', values: { w: 80, d: 80, h: 6, x: 0, y: 0, z: 0 } });
  const bodies = await assemblyPlacedBodies(s.doc, evaluate), ring = bodies.find(b => b.squeeze)!, map = filled(bodies);
  const on = pairOf(map, ring.key, 'p1/b1'), inGland = map.pairs.find(p => p !== on && (p.a === ring.key || p.b === ring.key))!;
  assert.ok(on.state === 'designed' && on.overlap && 'volumeMM3' in on.overlap, JSON.stringify(on.state));
  assert.equal(on.designed, `O-ring 214: its squeeze, up to ${+ring.squeeze!.mm3.toFixed(4)} mm³ (its gland's figure)`);
  assert.ok(Math.abs(on.overlap.volumeMM3 - ring.squeeze!.mm3) <= 1e-6 * ring.squeeze!.mm3, `${on.overlap.volumeMM3} vs ${ring.squeeze!.mm3}`);
  assert.deepEqual([inGland.state, inGland.designed], ['designed', 'O-ring n3 in its gland n2 (its squeeze)']);
  assert.equal(pairOf(map, 'b2', 'p1/b1').state, 'touching', 'the cover under the plate');
  const pressed = { ...s.doc, instances: s.doc.instances!.map(i => ({ ...i, position: [-40, -40, 7.8] as [number, number, number] })) };
  const more = pairOf(filled(await assemblyPlacedBodies(pressed, evaluate)), ring.key, 'p1/b1');
  assert.ok(more.state === 'overlap' && more.designed && more.overlap && 'volumeMM3' in more.overlap && more.overlap.volumeMM3 > ring.squeeze!.mm3, JSON.stringify(more.state));
});
