import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { resolveSkeletons } from '../src/frames/skeleton';
import type { BoundConstraint3D } from '../src/frames/sketch3d';

// FRg's parameter-bound values (O140; the coordinator's note after G17's ask): a 3D skeleton's length bound to a
// document parameter — solved on add for its value, re-solved when the parameter changes (the frame on it follows), a
// conflict refused naming the parameter, a parameter the document lacks refused.
const evaluate = async (d: StudioDoc) => evaluatePart(d, 1);
const A = 1600 - 34 * 34;
const cs = (extra: BoundConstraint3D[] = []): BoundConstraint3D[] => [{ kind: 'fixed', point: 0 }, { kind: 'along', segment: 0, axis: 'x' }, { kind: 'on-plane', point: 2, plane: { origin: [0, 0, 0], normal: [0, 0, 1] } },
  { kind: 'length', segment: 0, value: { parameter: 'W' } }, { kind: 'length', segment: 1, value: { parameter: 'D' } }, { kind: 'perpendicular', a: 0, b: 1 }, { kind: 'parallel', a: 0, b: 2 }, { kind: 'parallel', a: 1, b: 3 }, ...extra];
const sk = (extra?: BoundConstraint3D[]) => ({ kind: 'skeleton', points: [[0, 0, 0], [590, 10, 0], [610, 390, 5], [-5, 405, 3]], segments: [[0, 1], [1, 2], [2, 3], [3, 0]], constraints: cs(extra) });
const frame = { kind: 'frame', follows: { skeleton: 0 }, section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } };
const vols = (bodies: readonly { volume?: number | null }[]) => bodies.map(b => b.volume!).sort((a, b) => a - b);
const close = (a: number[], b: number[]) => assert.ok(a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) <= 1e-6 * b[k]), `${a} vs ${b}`);
async function built(W = 600, D = 400, extra?: BoundConstraint3D[]): Promise<ChatState> {
  const r = await dispatchTool({ doc: { ...emptyDoc(), parameters: { W, D } }, bodies: [] }, 'add_features', { features: [sk(extra), frame] }, evaluate);
  assert.ok(!r.isError, r.content); return r.state;
}

test('a skeleton\'s sides bound to W and D: solved on add for 600 × 400; W set to 800 — re-solved, the frame follows; evaluated without the re-solve, the same', async () => {
  const s = await built();
  close(vols(s.bodies), [400, 400, 600, 600].map(L => A * L));
  const changed = { ...s.doc, parameters: { W: 800, D: 400 } }, r = resolveSkeletons(changed);
  const p = (r.doc.nodes[0] as unknown as { points: number[][] }).points;
  assert.ok(Math.abs(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]) - 800) <= 1e-9, JSON.stringify(p));
  const e = await evaluate(r.doc); assert.ok(e.ok); close(vols(e.bodies), [400, 400, 800, 800].map(L => A * L));
  // (A parameter changed by any path — a configuration, a sensitivity variant — is solved for at evaluation too.)
  const direct = await evaluate(changed); assert.ok(direct.ok); close(vols(direct.bodies), [400, 400, 800, 800].map(L => A * L));
  // Nothing changed: the same document.
  const again = resolveSkeletons(r.doc); assert.equal(again.doc, r.doc);
});

test('a conflict refused naming the parameter; a parameter the document lacks, or a bound length not above 0, refused on add', async () => {
  // (A diagonal held at 600 × 400's √(600² + 400²): W at 800 cannot hold with it.)
  const s = await built(600, 400, [{ kind: 'distance', a: 0, b: 2, value: Math.hypot(600, 400) }]);
  assert.throws(() => resolveSkeletons({ ...s.doc, parameters: { W: 800, D: 400 } }), { code: 'SKETCH3D_CONFLICT', message: /^\[SKETCH3D_CONFLICT\] feature 0 \(.*\): the skeleton's constraints cannot all hold: .* Change the parameters? .*W/ });
  const e = await evaluate({ ...s.doc, parameters: { W: 800, D: 400 } });
  assert.ok(!e.ok && /W/.test(e.error.detail), e.ok ? 'built' : e.error.detail);
  const none = await dispatchTool({ doc: { ...emptyDoc(), parameters: { W: 600 } }, bodies: [] }, 'add_features', { features: [sk(), frame] }, evaluate);
  assert.ok(none.isError); assert.match(JSON.parse(none.content).error, /\[SKETCH3D_PARAMETER\] constraint 4 \(length\) is bound to the parameter "D", which the document does not have/);
  const neg = await dispatchTool({ doc: { ...emptyDoc(), parameters: { W: -5, D: 400 } }, bodies: [] }, 'add_features', { features: [sk(), frame] }, evaluate);
  assert.ok(neg.isError); assert.match(JSON.parse(neg.content).error, /constraint 3 \(length, bound to W = -5\): a segment and a length above 0/);
});
