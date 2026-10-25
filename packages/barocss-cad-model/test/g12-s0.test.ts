import test from 'node:test';
import assert from 'node:assert/strict';
import { booleanAnalytic, brepMassProperties, type Brep } from '@barocss/cad';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';

// G12 S0 (O129): how a proposal's added and removed material can be had exactly, for the GPU lane's two-colour
// overlay. Probes: each side's bodies united, then removed = before − after and added = after − before by the
// kernel's analytic Boolean — independent of body keys (a union node gets a new key though its material hardly
// changes); a hole (removed πr²h, nothing added), a boss (added its cylinder), an extrude made taller (added the slab,
// the hard case: the two sides' faces coincide), and the faces whose names stay but geometry changes.

const plate = (h = 10) => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] } as never), { kind: 'extrude', sketch: 0, height: h } as never);
const unite = (doc: StudioDoc): Brep | null => { const bs = partBreps(doc).map(b => b.brep); if (!bs.length) return null; let u = bs[0]; for (const b of bs.slice(1)) u = booleanAnalytic(u, b, 'union'); return u; };
/** The volume of a − b (0 when nothing is left), or the refusal's text. */
function minus(a: Brep, b: Brep): number | string {
  try { const r = booleanAnalytic(a, b, 'difference'); return r.bodies.length ? brepMassProperties(r, 1).volume : 0; }
  catch (e) { return String(e instanceof Error ? e.message : e).slice(0, 160); }
}
const sides = (before: StudioDoc, after: StudioDoc) => { const A = unite(before)!, B = unite(after)!; return { removed: minus(A, B), added: minus(B, A) }; };
const close = (v: number | string, want: number, what: string) => assert.ok(typeof v === 'number' && Math.abs(v - want) <= 1e-6 * Math.max(1, want), `${what}: ${v} vs ${want}`);

test('G12 S0 P1: a Ø6 hole through the 40 × 30 × 10 plate — removed π · 9 · 10 exactly, added nothing', () => {
  const before = plate(), after = withNode(before, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [20, 15], radius: 3 } as never);
  assert.ok(evaluateDoc(after, 1).ok);
  const s = sides(before, after); console.log('P1', JSON.stringify(s));
  close(s.removed, 90 * Math.PI, 'removed'); close(s.added, 0, 'added');
});

test('G12 S0 P2: a boss r 5 × 8 united on the plate\'s top (a new body key) — added π · 25 · 8, removed nothing', () => {
  const before = plate();
  let after = withNode(before, { kind: 'sketch', profile: 'circle', center: [20, 15], radius: 5, plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] } } as never);
  after = withNode(after, { kind: 'extrude', sketch: 2, height: 8 } as never);
  after = withNode(after, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } } as never);
  const s = sides(before, after); console.log('P2', JSON.stringify(s));
  close(s.added, 200 * Math.PI, 'added'); close(s.removed, 0, 'removed');
});

test('G12 S0 P3: the plate\'s extrude made 15 — added the slab 40 · 30 · 5, removed nothing (coincident side faces: the hard case)', () => {
  const s = sides(plate(10), plate(15)); console.log('P3', JSON.stringify(s));
  close(s.added, 6000, 'added'); close(s.removed, 0, 'removed');
});

test('G12 S0 P4: the faces — the hole adds n2.* faces; the plate\'s top and bottom keep their names, their areas change (π · 9 less): "changed" by geometry, not by name', () => {
  const before = plate(), after = withNode(before, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [20, 15], radius: 3 } as never);
  const fa = (d: StudioDoc) => { const r = evaluateDoc(d, 1); assert.ok(r.ok); return new Map(r.bodies.flatMap(b => b.mesh.faces.map(f => [f.name, f.area] as const))); };
  const a = fa(before), b = fa(after);
  const added = [...b.keys()].filter(k => !a.has(k)), removed = [...a.keys()].filter(k => !b.has(k)), changed = [...b.keys()].filter(k => a.has(k) && Math.abs(a.get(k)! - b.get(k)!) > 1e-6);
  console.log('P4', JSON.stringify({ added, removed, changed }));
  assert.ok(added.length >= 1 && added.every(k => k.startsWith('n2.')), JSON.stringify(added));
  assert.deepEqual(removed, []); assert.deepEqual(changed.sort(), ['n1.bottom', 'n1.top']);
});
