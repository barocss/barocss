import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, BarocssError, type BodyQuery, type StudioPart } from '../src/api';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';

// Fixed K04 oracle: 40x30x10 mm; the selected edge runs [0,0,10] to [40,0,10].
// Public Model consumer only. No new fillet solver or UI/GPU proof.
const EPS = 1e-9;
// Preserve R10.5's relative 1e-9 comparison of removed volume, not total-volume absolute error.
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= EPS * Math.abs(expected), `${actual} != ${expected}`);
const removedVolume = (r0: number, r1: number) => (1 - Math.PI / 4) * 40 * (r0 * r0 + r0 * r1 + r1 * r1) / 3;
const seed = () => part('variable fillet').box({ w: 40, d: 30, h: 10 });
const edge = (body: BodyQuery) => body.edges().where(e => e.straight && e.axis === 'x' && e.a[1] === 0 && e.b[1] === 0 && e.a[2] === 10 && e.b[2] === 10);
const mass = (p: StudioPart, r0: number, r1: number) => {
  const m = p.mass({ density: 1 }), removed = removedVolume(r0, r1);
  close(12000 - m.volume, removed); close(12000 / 1000 - m.mass, removed / 1000); return m;
};

test('public variable fillet: endpoint radii follow the selected edge direction and survive codec reopen', async () => {
  const base = seed(), before = base.doc, picked = edge(base.select()); assert.equal(picked.count, 1);
  const selected = picked.list()[0], selectedBefore = structuredClone(selected);
  assert.deepEqual(selected.a, [0, 0, 10]); assert.deepEqual(selected.b, [40, 0, 10]);
  const options = { radius: 1, endRadius: 3 }, optionsBefore = structuredClone(options), made = base.fillet(edge, options);
  const doc = made.doc, node = doc.nodes.at(-1); assert.ok(node && node.kind === 'fillet');
  assert.equal(node.radius, 1); assert.deepEqual(node.edges, selected.names);
  assert.deepEqual(node.radii, [{ at: selected.a, radius: 1, atEnd: true }, { at: selected.b, radius: 3, atEnd: true }]);
  assert.deepEqual(doc.nodes.slice(0, -1), before.nodes); const expectedMass = mass(made, 1, 3);
  assert.deepEqual(base.doc, before); assert.deepEqual(options, optionsBefore); assert.deepEqual(selected, selectedBefore);
  options.endRadius = 9; const detached = made.doc; detached.nodes.length = 0;
  assert.deepEqual(made.doc, doc); assert.deepEqual(mass(made, 1, 3), expectedMass);
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened));
  assert.deepEqual(opened.doc, doc); assert.deepEqual(mass(part('reopened', opened.doc), 1, 3), expectedMass);
});

test('public variable fillet: equal numeric radii preserve the constant command and only the distinct end parameter binds', () => {
  const base = seed(), before = base.doc;
  const constant = base.fillet(edge, { radius: 1 }), equal = base.fillet(edge, { radius: 1, endRadius: 1 });
  assert.deepEqual(equal.doc, constant.doc); assert.deepEqual(equal.mass({ density: 1 }), constant.mass({ density: 1 }));
  const parameterized = base.parameter('End', 3), parameterBefore = parameterized.doc;
  const made = parameterized.fillet(edge, { radius: 1, endRadius: param('End') });
  const doc = made.doc, node = doc.nodes.at(-1); assert.ok(node && node.kind === 'fillet' && node.radii);
  assert.equal(node.radii[0].radius, 1); assert.deepEqual(node.radii[1].radius, { parameter: 'End' });
  mass(made, 1, 3); const edited = made.withParameters({ End: 4 }); mass(edited, 1, 4);
  const after = edited.doc.nodes.at(-1); assert.ok(after && after.kind === 'fillet' && after.radii);
  assert.deepEqual(after.radii[1].radius, { parameter: 'End' });
  // Stored Dim edits retain their endpoint assignment even at equal or nearly equal values.
  // The volume check alone does not establish the physical taper direction.
  for (const endRadius of [1, 1 + 5e-10]) {
    const changed = made.withParameters({ End: endRadius }), changedDoc = changed.doc, changedNode = changedDoc.nodes.at(-1);
    assert.equal(changedDoc.parameters.End, endRadius);
    assert.ok(changedNode && changedNode.kind === 'fillet' && changedNode.radii);
    assert.equal(changedNode.radius, 1); assert.deepEqual(changedNode.edges, node.edges);
    assert.deepEqual(changedNode.radii, [{ at: [0, 0, 10], radius: 1, atEnd: true }, { at: [40, 0, 10], radius: { parameter: 'End' }, atEnd: true }]);
    mass(changed, 1, endRadius);
  }
  assert.deepEqual(made.doc, doc); assert.deepEqual(parameterized.doc, parameterBefore); assert.deepEqual(base.doc, before);
});

test('public variable fillet: unsupported endpoint options and selection preserve the accepted document', () => {
  const base = seed().parameter('Start', 1).parameter('End', 3).parameter('EqualEnd', 1);
  const before = base.doc, accepted = base.fillet(edge, { radius: 1, endRadius: 3 }), acceptedDoc = accepted.doc;
  const acceptedMass = accepted.mass({ density: 1 });
  const rejected = (options: Parameters<StudioPart['fillet']>[1], code: string) => {
    const snapshot = structuredClone(options);
    assert.throws(() => base.fillet(edge, options), error => error instanceof BarocssError && error.code === code);
    assert.deepEqual(options, snapshot); assert.deepEqual(base.doc, before);
    assert.deepEqual(accepted.doc, acceptedDoc); assert.deepEqual(accepted.mass({ density: 1 }), acceptedMass);
  };
  for (const options of [{ radius: 1, endRadius: 0 }, { radius: 0.05, endRadius: 1 }, { radius: 1, endRadius: 0.05 },
    { radius: 1, endRadius: 1 + 5e-10 }, { radius: 1, endRadius: NaN }, { radius: 1, endRadius: Infinity }]) rejected(options, 'VALUE');
  rejected({ radius: param('Start'), endRadius: 3 }, 'PARAMETER_UNBINDABLE');
  rejected({ radius: 1, endRadius: param('EqualEnd') }, 'PARAMETER_UNBINDABLE');
  assert.throws(() => base.fillet(body => body.edges(), { radius: 1, endRadius: 3 }), error => error instanceof BarocssError && error.code === 'SELECTION_ONE');
  assert.deepEqual(base.doc, before); assert.deepEqual(accepted.doc, acceptedDoc);
});

test('variable fillet radii at the chain ends follow the box when its height or width changes', () => {
  // A box whose W and H are parameters; the fillet's edge runs [0,0,H] to [W,0,H] and its ends move with them.
  const removed = (length: number, r0: number, r1: number) => (1 - Math.PI / 4) * length * (r0 * r0 + r0 * r1 + r1 * r1) / 3;
  const made = part('ends').parameter('W', 40).parameter('H', 10).box({ w: param('W'), d: 30, h: param('H') }).fillet(edge, { radius: 1, endRadius: 3 });
  const at = (W: number, H: number) => { const p = made.withParameters({ W, H }); return { p, cut: W * 30 * H - p.mass({ density: 1 }).volume }; };
  close(at(40, 10).cut, removed(40, 1, 3));
  close(at(40, 12).cut, removed(40, 1, 3));
  close(at(60, 10).cut, removed(60, 1, 3));
  close(at(30, 8).cut, removed(30, 1, 3));
  // The same document without atEnd keeps its authored points: off the edge after a height change (refused) and
  // short of the new end after a width change (the taper stops at x = 40, carried on past it).
  const fixed = structuredClone(made.doc), node = fixed.nodes.at(-1)!;
  assert.ok(node.kind === 'fillet' && node.radii);
  node.radii = node.radii.map(({ atEnd: _, ...p }) => p);
  assert.throws(() => part('fixed', fixed).withParameters({ H: 12 }).mass({ density: 1 }), /lies on none of the edges/);
  const wide = part('fixed', fixed).withParameters({ W: 60 }), cut = 60 * 30 * 10 - wide.mass({ density: 1 }).volume;
  assert.ok(Math.abs(cut - removed(60, 1, 3)) > 1, `without atEnd the width change does not follow the end (${cut})`);
});

test('the Studio Fillet command writes a varying radius at the chain ends and it follows a later height change', async () => {
  const { commands } = await import('../src/app/commands');
  const { evaluateDoc } = await import('../src/engine/evaluate');
  const fillet = commands.find(c => c.id === 'fillet')!, base = seed().parameter('H', 10);
  const doc = { ...base.doc, nodes: base.doc.nodes.map((n, i) => i === 1 && n.kind === 'extrude' ? { ...n, height: { parameter: 'H' } } : n) };
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const body = r.bodies[0], edge = body.mesh.edges.findIndex(e => e.straight && e.a[1] === 0 && e.b[1] === 0 && e.a[2] === 10 && e.b[2] === 10);
  assert.ok(edge >= 0);
  const made = fillet.build!({ doc, bodies: r.bodies, selection: { faces: [], edges: [{ body: 0, edge }], bodies: [] } }, { radius: 1, endRadius: 3, shape: 'circular' });
  const node = made.nodes.at(-1)!; assert.ok(node.kind === 'fillet' && node.radii);
  assert.deepEqual(node.radii.map(p => p.atEnd), [true, true]);
  const taller = part('taller', made).withParameters({ H: 12 });
  close(40 * 30 * 12 - taller.mass({ density: 1 }).volume, removedVolume(1, 3));
});
