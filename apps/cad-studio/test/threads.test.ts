import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { commands, type Ctx } from '@barocss/cad-model/app/commands';
import { threadLines, threadsOf } from '@barocss/cad-model/app/threads';

const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.title + ' ' + r.error.hint); return r.bodies; };
/** Ring count and radius range of the segments (32 per ring), about the axis through (cx, cy) along Z. */
function rings(lines: number[], cx: number, cy: number) {
  const r: number[] = [], z = new Set<number>();
  for (let i = 0; i < lines.length; i += 3) { r.push(Math.hypot(lines[i] - cx, lines[i + 1] - cy)); z.add(Math.round(lines[i + 2] * 1000)); }
  return { count: lines.length / 6 / 32, rMin: Math.min(...r), rMax: Math.max(...r), levels: z.size };
}

test('a tapped hole carries rings a pitch apart just inside its drill; a plain hole none', () => {
  const plate = rectanglePart(32, 32, 8), at = plate.nodes.length;
  const tapped = withNode(plate, { kind: 'hole', parent: { node: at - 1, side: 'solid' }, center: [10, 16], radius: 2.5, thread: 'M6×1' });
  const [b] = bodiesOf(tapped), t = rings(threadLines(threadsOf(tapped.nodes), b.mesh), 10, 16);
  assert.equal(t.count, 8, '8 mm of M6×1'); assert.ok(t.rMin > 2.4 && t.rMax < 2.5, `${t.rMin}–${t.rMax}`);
  const plain = withNode(plate, { kind: 'hole', parent: { node: at - 1, side: 'solid' }, center: [10, 16], radius: 2.5 });
  assert.equal(threadLines(threadsOf(plain.nodes), bodiesOf(plain)[0].mesh).length, 0);
});

test('a bolt’s shank has rings just outside it, its nut just inside its bore; the washer none', () => {
  const f = commands.find(c => c.id === 'fastener')!, ctx: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const doc = f.build!(ctx, { ...f.defaults!(ctx), kind: 'hex-bolt', size: 'M8', length: '30', joint: 'nut', grip: 10, x: 0, y: 0, z: 0 });
  const t = threadsOf(doc.nodes), bodies = bodiesOf(doc);
  const byName = (name: string) => bodies.find(b => (doc.bodies?.[b.key]?.name ?? '').startsWith(name));
  const bolt = bodies.find(b => !doc.bodies?.[b.key]?.name)!;
  const shank = rings(threadLines(t, bolt.mesh), 0, 0);
  assert.equal(shank.count, 24, '30 mm at 1.25 pitch'); assert.ok(shank.rMin > 4 && shank.rMax < 4.1);
  const nut = rings(threadLines(t, byName('Nut')!.mesh), 0, 0);
  assert.ok(nut.count >= 5 && nut.rMax < 4, `${nut.count} rings, r ≤ ${nut.rMax}`);
  assert.equal(threadLines(t, byName('Washer')!.mesh).length, 0);
});
