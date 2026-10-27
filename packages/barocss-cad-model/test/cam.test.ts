import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, type ModelNode } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editFields } from '../src/app/editFields';
import { CHAT_COMMANDS, runTool, type ChatState } from '../src/chat/tools';

// R12c.6a (D160): the Cam command, its node, edit fields and notes; the chat's v2 surface names it (describe has its
// values). Oracles: the conformance case r12c/cam-roller-cycloidal — S0's cam with a Ø8 bore, the exact profile's area by
// Green's theorem (17878.6577 mm³ at 10 thick) — and S0's least convex pitch radius 23.6902.

const ctx: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = commands.find(c => c.id === 'cam')!;
type Cam = Extract<ModelNode, { kind: 'cam' }>;

test('Cam (R12c.6a): the command\'s default — S0\'s cam, a roller on base 20, cycloidal rise 8 and return, Ø8 bore; its volume, label and notes', () => {
  assert.ok(cmd.available(ctx).ok);
  const doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), x: 0, y: 0, z: 0 }), r = evaluateDoc(doc, 1);
  assert.ok(r.ok, r.ok ? '' : `${r.error.title} ${r.error.detail}`);
  const node = doc.nodes[0] as Cam;
  assert.deepEqual([node.follower, node.motion, node.base, node.roller, node.thickness, node.bore, node.segments], ['roller', undefined, 20, 5, 10, 8, [{ angle: 120, to: 8, law: 'cycloidal' }, { angle: 60 }, { angle: 120, to: 0, law: 'cycloidal' }, { angle: 60 }]]);
  assert.equal(featureLabel(node, 0, doc.nodes), 'Cam for a roller follower, base R20, lift 8');
  const body = r.ok ? r.bodies[0] : null!, notes = body.notes!.map(n => n.text);
  assert.ok(Math.abs(body.volume! - 17878.657703) <= 1e-4 * 17878.66, String(body.volume));
  assert.ok(notes.includes('Disc cam for a translating roller follower (r 5, prime circle R 25): base R 20, lift 8 mm'), JSON.stringify(notes));
  assert.ok(notes.includes('Motion: rise to 8 mm over 0–120° (cycloidal), dwell to 180°, return to 0 mm over 180–300° (cycloidal), dwell to 360°'), JSON.stringify(notes));
  assert.ok(notes.some(t => /^Pressure angle at most 14\.8683° at 243\.4°, against 30° \(a rule of thumb, an estimate\)$/.test(t)), JSON.stringify(notes));
  assert.ok(notes.includes('The pitch curve\'s least convex radius 23.6902 at 214.5°, above the roller\'s 5: no undercut (the profile\'s 18.6902)'), JSON.stringify(notes));
  assert.ok(notes.some(t => /^Profile within \d\.\de-4 mm of its closed form \(34 cubic pieces, tolerance 2\.0e-3\); the follower found on the built profile within \d\.\de-4 mm of the law \(720 positions\)$/.test(t)), JSON.stringify(notes));
  assert.ok(body.notes!.some(n => /^Not validated for manufacturing/.test(n.text) && n.warning));
});

test('Cam (R12c.6a): a flat-faced oscillating follower from the command; the lift edited scales the program; an undercut refused with its title', () => {
  const doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), follower: 'flat', motion: 'oscillating', a: 60, c: 0, h: 10, lr: 'polynomial-345', lf: 'modified-trapezoid', bore: 10, x: 0, y: 0, z: 0 }), r = evaluateDoc(doc, 1);
  assert.ok(r.ok, r.ok ? '' : `${r.error.title} ${r.error.detail}`);
  const node = doc.nodes[0] as Cam;
  assert.deepEqual([node.follower, node.motion, node.pivotDistance, node.armLength, node.roller], ['flat', 'oscillating', 60, undefined, undefined]);
  assert.equal(featureLabel(node, 0, doc.nodes), 'Cam for an oscillating flat-faced follower, base R20, swing 10°');
  const notes = r.ok ? r.bodies[0].notes!.map(n => n.text) : [];
  assert.ok(notes.some(t => /^Disc cam for an oscillating flat-faced follower, pivot 60 off the centre, at rest 19\.5°: base R 20, swing 10°$/.test(t)), JSON.stringify(notes));
  assert.ok(notes.some(t => /^Least radius of curvature [\d.]+ at [\d.]+° \(ρ = h \+ h_ββ > 0: no undercut\); the face touches from [\d.]+ to [\d.]+ mm from the pivot$/.test(t)), JSON.stringify(notes));
  // The lift: 10° → 14°, every position alike.
  const h = editFields(doc.nodes, 0).find(f => f.key === 'h')!, lifted = h.kind === 'number' ? h.set(doc.nodes, 14) : doc.nodes;
  assert.deepEqual((lifted[0] as Cam).segments.map(s => s.to), [14, undefined, 0, undefined]);
  assert.equal(h.kind === 'number' ? h.unit : '', '°');
  // A big roller on a small base: the pitch curve's convex radius below r_r.
  const tight = cmd.build!(ctx, { ...cmd.defaults!(ctx), rb: 6, rr: 15, h: 20, br: 60, d1: 0, bf: 60, bore: 0, x: 0, y: 0, z: 0 }), rt = evaluateDoc(tight, 2);
  assert.ok(!rt.ok && rt.error.title === 'The cam cannot make its follower follow the motion' && /\[CAM_UNDERCUT\].*r_r 15/.test(rt.error.detail), rt.ok ? 'built' : rt.error.detail);
});

test('Cam (R12c.6a) in the chat: a v2 features command, its values behind describe', async () => {
  assert.ok(CHAT_COMMANDS.includes('cam'));
  const evaluate = async (doc: ChatState['doc']) => evaluatePart(doc, 1), state: ChatState = { doc: emptyDoc(), bodies: [] };
  const d = await runTool(state, 'describe', { command: 'cam' }, evaluate);
  assert.ok(!d.isError, d.content); assert.match(d.content, /uniform is refused/); assert.match(d.content, /polynomial-345/);
  const made = await runTool(state, 'features', { action: 'command', command: 'cam', values: { follower: 'flat', rb: 25, h: 6, br: 90, lr: 'polynomial-345', d1: 90, bf: 90, lf: 'harmonic', x: 0, y: 0, z: 0 } }, evaluate);
  assert.ok(!made.isError && made.changed, made.content.slice(0, 400));
  const node = made.state.doc.nodes[0] as Cam;
  assert.deepEqual([node.follower, node.base, node.segments.length, node.segments[3]], ['flat', 25, 4, { angle: 90 }]);
});
