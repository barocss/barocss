import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { diffWork, proposalDiff, proposalDiffFor, type Side } from '../src/chat/proposalDiff';

// G12 (O136): a proposal's added and removed material by the Boolean of both sides, and its faces whole.
const side = (doc: StudioDoc): Side => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return { doc, bodies: r.bodies }; };
const plate = (h = 10) => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] } as never), { kind: 'extrude', sketch: 0, height: h } as never);
const hole = (d: StudioDoc) => withNode(d, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [20, 15], radius: 3 } as never);
const close = (v: number | undefined, want: number) => assert.ok(v !== undefined && Math.abs(v - want) <= 1e-6 * Math.max(1, want), `${v} vs ${want}`);

test('a hole: removed π · 9 · 10 as a body\'s mesh, nothing added; its faces added, the plate\'s top and bottom changed', () => {
  const d = proposalDiff(side(plate()), side(hole(plate())));
  assert.equal(d.method, 'boolean');
  close(d.removed?.volumeMM3, 90 * Math.PI); assert.equal(d.added, null);
  assert.ok(d.removed!.mesh.positions.length > 0 && d.removed!.mesh.faces.length >= 1);
  assert.ok(d.changedFaces.filter(f => f.kind === 'added').every(f => f.name.startsWith('n2.')));
  assert.deepEqual(d.changedFaces.filter(f => f.kind === 'changed').map(f => f.name), ['n1.bottom', 'n1.top']);
  assert.deepEqual(d.parts.map(p => [p.id, p.kind]), [['n2', 'added']]);
});

test('a boss united on top (its body keyed anew): added π · 25 · 8, nothing removed', () => {
  let after = withNode(plate(), { kind: 'sketch', profile: 'circle', center: [20, 15], radius: 5, plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] } } as never);
  after = withNode(withNode(after, { kind: 'extrude', sketch: 2, height: 8 } as never), { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } } as never);
  const d = proposalDiff(side(plate()), side(after));
  close(d.added?.volumeMM3, 200 * Math.PI); assert.equal(d.removed, null);
});

test('the extrude made taller (coincident faces): added the slab 6000, nothing removed; the side faces changed', () => {
  const d = proposalDiff(side(plate(10)), side(plate(15)));
  close(d.added?.volumeMM3, 6000); assert.equal(d.removed, null);
  assert.ok(d.changedFaces.some(f => f.name === 'n1.top' && f.kind === 'changed'));
});

test('a facet body, where the Boolean refuses: method "faces" with why, its faces whole — every face of the moved mesh changed', () => {
  // (A 10 mm cube as facets; the proposal moves it 5 up.)
  const cube = (z: number) => ({ kind: 'mesh', name: 'cube', unit: 'mm', representation: 'facets', positions: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10].map((v, i) => i % 3 === 2 ? v + z : v), indices: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7] });
  const a = side(withNode(plate(), cube(20) as never)), b = side(withNode(plate(), cube(25) as never));
  const d = proposalDiff(a, b);
  const meshFaces = new Set(b.bodies.flatMap(x => x.mesh.faces.filter(f => f.facet).map(f => f.name)));
  assert.ok(meshFaces.size >= 1);
  for (const name of meshFaces) assert.ok(d.changedFaces.some(f => f.name === name && f.kind === 'changed'), `${name} listed changed`);
  assert.ok(!d.changedFaces.some(f => f.name.startsWith('n1.')), 'the plate did not change');
  // (Until the kernel's F3 takes facet faces in its Boolean: then this is 'boolean', 500 added and 500 removed.)
  assert.equal(d.method, 'faces'); assert.match(d.why ?? '', /facet|mesh/i);
  assert.equal(d.added, null); assert.equal(d.removed, null);
});

test('cached by (base revision, proposal id): a proposal hovered twice runs its Booleans once', () => {
  const a = side(plate()), b = side(hole(plate())), key = { revision: 'r1', proposal: 'P1' };
  const n0 = diffWork.booleans, first = proposalDiffFor(key, a, b), n1 = diffWork.booleans;
  assert.ok(n1 > n0);
  assert.equal(proposalDiffFor(key, a, b), first); assert.equal(diffWork.booleans, n1);
  proposalDiffFor({ revision: 'r2', proposal: 'P1' }, a, b); assert.ok(diffWork.booleans > n1, 'another base revision is worked out');
});
