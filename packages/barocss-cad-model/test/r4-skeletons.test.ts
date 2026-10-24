import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchTool } from '../src/chat/tools';
import { brepsFor, evaluatePart, partBreps, stepFor, stlFor, baseBodyFaces } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { resolveSkeletons } from '../src/frames/skeleton';
import { revisionOf } from '../src/util/revision';

// R4's finding, pinned (the coordinator's decision): every export path builds geometry from the solved skeletons
// (partSnapshot's own resolveSkeletons), with or without evaluateDoc's skeletonsNow before it; the STEP's source is
// the authored document's revision — the one a saved file has — not the solved one's. Nobody should "fix" either.

const evaluate = async (d: StudioDoc) => evaluatePart(d, 1);
const cs = [{ kind: 'fixed', point: 0 }, { kind: 'along', segment: 0, axis: 'x' }, { kind: 'on-plane', point: 2, plane: { origin: [0, 0, 0], normal: [0, 0, 1] } },
  { kind: 'length', segment: 0, value: { parameter: 'W' } }, { kind: 'length', segment: 1, value: { parameter: 'D' } }, { kind: 'perpendicular', a: 0, b: 1 }, { kind: 'parallel', a: 0, b: 2 }, { kind: 'parallel', a: 1, b: 3 }];
const sk = { kind: 'skeleton', points: [[0, 0, 0], [590, 10, 0], [610, 390, 5], [-5, 405, 3]], segments: [[0, 1], [1, 2], [2, 3], [3, 0]], constraints: cs };
const frame = { kind: 'frame', follows: { skeleton: 0 }, section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } };
const json = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => ArrayBuffer.isView(x) ? Array.from(x as unknown as ArrayLike<number>) : x);

test('R4: a skeleton bound to W, W changed and not re-solved — every export path gives the solved geometry; STEP names the authored revision', async () => {
  const r = await dispatchTool({ doc: { ...emptyDoc(), parameters: { W: 600, D: 400 } }, bodies: [] }, 'add_features', { features: [sk, frame] }, evaluate);
  assert.ok(!r.isError, r.content);
  const authored: StudioDoc = { ...r.state.doc, parameters: { W: 800, D: 400 } }, solved = resolveSkeletons(authored).doc;
  assert.notEqual(revisionOf(authored), revisionOf(solved), 'solving moves the skeleton\'s points');
  // (The members follow W = 800 either way: the longest reaches x = 820 with the tube's half width.)
  const maxX = (d: StudioDoc) => Math.max(...partBreps(d).flatMap(b => b.brep.vertices.map(v => v.point[0])));
  assert.ok(Math.abs(maxX(authored) - 820) < 1e-6, String(maxX(authored)));
  assert.equal(json(partBreps(authored)), json(partBreps(solved)));
  assert.equal(json(brepsFor(authored)), json(brepsFor(solved)));
  assert.equal(json(brepsFor(authored, { made: true })), json(brepsFor(solved, { made: true })));
  assert.equal(json(baseBodyFaces(authored)), json(baseBodyFaces(solved)));
  const e = evaluatePart(solved, 1); assert.ok(e.ok);
  for (const b of e.bodies) assert.equal(json(stlFor(authored, b.key)), json(stlFor(solved, b.key)), b.key);
  const a = stepFor(authored, 'p'), b = stepFor(solved, 'p');
  assert.ok(!('error' in a) && !('error' in b));
  const body = (t: string) => t.replace(/FILE_NAME\([^;]*;/, '').replace(/FILE_DESCRIPTION\([^;]*;/, '');
  assert.equal(body(a.text), body(b.text), 'the same geometry in the STEP');
  assert.equal(a.source, revisionOf(authored), 'the STEP names the authored document\'s revision');
});
