import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, placedDoc, withNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { rotationMatrix } from '../src/engine/placement';
import { revisionOf } from '../src/team/team';
import { partDigest } from '../src/util/digest';
import { modelInput } from '../src/team/freshness';
import { evaluatedPart } from '../src/engine/wireDoc';
import { dispatchTool } from '../src/chat/tools';

// FRf2 S0 (O123): what a frame following another part's sketch can build on today — the other part is a placed
// instance whose document the assembly holds; its sketch, lifted by its plane and placed by the instance's rotation
// and position, is where the instance's own bodies are (P1); freshness's model input already holds each part's model
// (P2: a base follower's results go stale with the part — no freshness change); A7's
// revision follows a part's content and not its placement, A8's digest both (P3: the link pins the revision, reads the
// placement live); a part is deleted today whatever refers to it (P4); the base's evaluation holds its parts' documents
// but a part's own evaluation not its siblings' (P5: a placed part's frame following a sibling needs the assembly-wide
// evaluation — flagged, not built).

const part = (w: number): StudioDoc => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, 200] } as never), { kind: 'extrude', sketch: 0, height: 10 } as never);
const inst = (w: number, position: [number, number, number], rotation: [number, number, number]): PartInstance => ({ id: 'p1', name: 'Plate', doc: part(w), position, rotation });

test('FRf2 S0 P1: a placed part\'s sketch (a 300 × 200 rectangle, the part at (100, 50, 0) turned 90° about z), lifted and placed by R·p + t, is where the part\'s own body stands (its box in x and y to 1e-9)', () => {
  const i = inst(300, [100, 50, 0], [0, 0, 90]), R = rotationMatrix(i.rotation);
  const corners = [[0, 0, 0], [300, 0, 0], [300, 200, 0], [0, 200, 0]].map(p => [0, 1, 2].map(r => R[3 * r] * p[0] + R[3 * r + 1] * p[1] + R[3 * r + 2] * p[2] + i.position[r]));
  const e = evaluateDoc(placedDoc(i), 1); assert.ok(e.ok, JSON.stringify(!e.ok && e.error));
  const b = e.bodies[0].mesh.bounds;
  for (const k of [0, 1]) {
    assert.ok(Math.abs(Math.min(...corners.map(c => c[k])) - b.min[k]) <= 1e-9 && Math.abs(Math.max(...corners.map(c => c[k])) - b.max[k]) <= 1e-9, `axis ${k}: ${JSON.stringify(corners)} vs ${JSON.stringify(b)}`);
  }
});

test('FRf2 S0 P2: freshness\'s model input already holds each placed part\'s own model — its sketch widened 300 → 400, the input changes; moved, it changes (so a base frame following a part\'s sketch needs no freshness change: its results go stale with the part)', () => {
  const doc = (w: number, x: number): StudioDoc => ({ ...emptyDoc(), instances: [inst(w, [x, 0, 0], [0, 0, 0])] });
  assert.notEqual(modelInput(doc(300, 0)), modelInput(doc(400, 0)));
  assert.notEqual(modelInput(doc(300, 0)), modelInput(doc(300, 5)));
});

test('FRf2 S0 P3: A7\'s revision of a part follows its content, not its placement; A8\'s digest both — the link pins the revision and reads the placement live', () => {
  const a = inst(300, [0, 0, 0], [0, 0, 0]), moved = inst(300, [50, 0, 0], [0, 0, 0]), wider = inst(400, [0, 0, 0], [0, 0, 0]);
  assert.equal(revisionOf(a.doc), revisionOf(moved.doc)); assert.notEqual(revisionOf(a.doc), revisionOf(wider.doc));
  assert.notEqual(partDigest(a), partDigest(moved)); assert.notEqual(partDigest(a), partDigest(wider));
});

test('FRf2 S0 P4 and P5: a placed part is deleted today whatever refers to it; the base\'s evaluation input holds its parts\' documents, a part\'s own holds no siblings', async () => {
  const doc: StudioDoc = { ...emptyDoc(), instances: [inst(300, [0, 0, 0], [0, 0, 0]), { ...inst(300, [0, 400, 0], [0, 0, 0]), id: 'p2' }] };
  const r = await dispatchTool({ doc, bodies: [] }, 'delete_part', { part: 'p1' }, async d => evaluateDoc(d, 1));
  // (At the chat's default level a part's deletion is proposed; the tool itself does not look at what refers to it.)
  assert.ok(!r.isError || /propos/i.test(r.content), r.content);
  const seen = evaluatedPart(doc);
  assert.equal(seen.instances?.length, 2); assert.equal(seen.instances![0].doc.nodes.length, 2);
  assert.equal(evaluatedPart(doc.instances![0].doc).instances, undefined, 'a part alone: no siblings');
});
