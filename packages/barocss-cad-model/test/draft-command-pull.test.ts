import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { part, type BodyQuery } from '../src/api';

// The Studio Draft command's Pull choice (K05 in Studio). +Z keeps the old command's documents byte for byte;
// another axis writes the same draft node as the public API (StudioPart.draft) for the same faces and angle.
const draft = commands.find(c => c.id === 'draft')!;
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.title); return r.bodies; };
const facing = (b: BodyResult, n: [number, number, number]) => b.mesh.faces.findIndex(f => f.kind === 'plane' && n.every((x, k) => Math.abs(f.normal[k] - x) < 1e-9));
const ctxOn = (doc: StudioDoc, normals: [number, number, number][]): Ctx => {
  const bodies = bodiesOf(doc); return { doc, bodies, selection: { faces: normals.map(n => ({ body: 0, face: facing(bodies[0], n) })), edges: [], bodies: [] } };
};
const volume = (doc: StudioDoc) => { const v = bodiesOf(doc)[0].volume; assert.ok(v !== null); return v; };

test('Studio draft: +Z is the default for a side face and builds the old node, without a pull', () => {
  const doc = rectanglePart(40, 30, 10), ctx = ctxOn(doc, [[0, -1, 0]]);
  assert.equal(draft.available(ctx).ok, true);
  const v = draft.defaults!(ctx); assert.equal(v.pull, 'z');
  const node = draft.build!(ctx, v).nodes.at(-1)!;
  assert.ok(node.kind === 'draft'); assert.equal(Object.hasOwn(node, 'pull'), false); assert.equal(Object.hasOwn(node, 'neutral'), false);
  assert.deepEqual({ ...node, id: undefined }, { kind: 'draft', parent: node.parent, faces: node.faces, angle: 5, id: undefined });
  // Every side of the extrusion, pulled along +Z: still the extrusion's own draft, as before.
  const all = ctxOn(doc, [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]]), own = draft.build!(all, draft.defaults!(all));
  assert.equal(own.nodes.length, doc.nodes.length); const ex = own.nodes.find(n => n.kind === 'extrude'); assert.ok(ex && ex.kind === 'extrude' && ex.draft === 5);
});

test('Studio draft: a face no +Z draft takes defaults to the first pull that takes it, and builds what the API builds', () => {
  const doc = rectanglePart(40, 30, 10), top = ctxOn(doc, [[0, 0, 1]]);
  assert.equal(draft.available(top).ok, true, 'the top face drafts along X');
  const v = draft.defaults!(top); assert.equal(v.pull, 'x');
  const steps = draft.steps!(top, v); assert.equal(steps[0].done, true);
  const made = draft.build!(top, v), node = made.nodes.at(-1)!;
  assert.ok(node.kind === 'draft' && node.pull === 'x' && node.angle === 5); assert.equal(Object.hasOwn(node, 'neutral'), false);
  const api = part('api', doc).draft((b: BodyQuery) => b.faces().facing('+z'), { angle: 5, pull: 'x' }).doc.nodes.at(-1)!;
  assert.ok(api.kind === 'draft'); assert.deepEqual([api.pull, api.angle, api.faces], [node.pull, node.angle, node.faces]);
  assert.ok(Math.abs(volume(made) - volume(part('api', doc).draft((b: BodyQuery) => b.faces().facing('+z'), { angle: 5, pull: 'x' }).doc)) < 1e-9);
  // −X for the same side face: a different solid from +Z, the node says which.
  const side = ctxOn(doc, [[0, -1, 0]]), negY = draft.build!(side, { deg: 5, pull: '-x' });
  const n = negY.nodes.at(-1)!; assert.ok(n.kind === 'draft' && n.pull === '-x');
  assert.ok(Math.abs(volume(negY) - volume(draft.build!(side, { deg: 5, pull: 'z' }))) > 1e-6);
});

test('Studio draft: a pull the picked face is not square to is refused, naming the axis', () => {
  const doc = rectanglePart(40, 30, 10), top = ctxOn(doc, [[0, 0, 1]]);
  assert.throws(() => draft.build!(top, { deg: 5, pull: 'z' }), /square to Z/);
  const steps = draft.steps!(top, { deg: 5, pull: 'z' }); assert.equal(steps[0].done, false);
});
