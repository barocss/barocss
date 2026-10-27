import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, rectanglePart, usesOf, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluatedPart } from '../src/engine/wireDoc';
import { commands, type Ctx } from '../src/app/commands';
import { editORingRows } from '../src/engine/orings';
import { runTool, type ChatState } from '../src/chat/tools';

// R12c.5 (D159) in the studio: the user's O-ring rows (none built in), a piston gland on a Ø31 cylinder for AS568-214
// (D139 O1, a test row citing its chart) at S0's sizes, and a face gland on a plate. Oracles: S0's figures (stretch 2.0 %,
// squeeze 20.7 / 20.0 %, the free ring's overlap 136.4858 mm³) and the groove's removal π(R² − r²)w.

const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const O1 = { id: '214', dash: '2-214', insideDiameter: 24.99, crossSection: 3.53, source: 'O1 (D139)' };
function onFace(doc: StudioDoc, face: string, values: Record<string, string | number> = {}) {
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const body = r.bodies.findIndex(b => b.mesh.faces.some(f => f.name === face)), ctx: Ctx = { doc, bodies: r.bodies, selection: { faces: [{ body, face: r.bodies[body].mesh.faces.findIndex(f => f.name === face) }], edges: [], bodies: [] } };
  const c = cmd('oring-gland'), ok = c.available(ctx); assert.ok(ok.ok, ok.ok ? '' : ok.reason);
  return { doc: c.build!(ctx, { ...c.defaults!(ctx), ...values }), defaults: c.defaults!(ctx) };
}

test('O-ring gland (R12c.5): no rows, no gland; the user\'s row — a piston gland on S0\'s sizes, its notes and the ring\'s overlap; the prefills from 20 % squeeze and 80 % fill', () => {
  const c = cmd('cylinder'); let doc = c.build!(blank, { ...c.defaults!(blank), r: 15.5, h: 20, x: 0, y: 0, z: 0 });
  const r0 = evaluateDoc(doc, 1); assert.ok(r0.ok);
  const none = cmd('oring-gland').available({ doc, bodies: r0.bodies, selection: { faces: [{ body: 0, face: 0 }], edges: [], bodies: [] } });
  assert.ok(!none.ok && /Load your O-ring rows first .* none is built in/.test(none.reason));
  doc = (editORingRows(doc, [O1]) as { doc: StudioDoc }).doc;
  const { doc: d1, defaults } = onFace(doc, 'n1.side0', { seal: 31.1, dg: 25.5, w: 4.7, at: 6 });
  // (The prefills: the bore Ø31.1, the depth 0.8 CS so the bottom 31.1 − 2·2.824, the width πCS²/4 over 0.8 h, centred.)
  assert.deepEqual([defaults.seal, defaults.dg, defaults.w, defaults.at], [31.1, +(31.1 - 2 * 0.8 * 3.53).toFixed(3), +(Math.PI * 3.53 ** 2 / 4 / (0.8 * 0.8 * 3.53)).toFixed(3), +((20 - Math.PI * 3.53 ** 2 / 4 / (0.8 * 0.8 * 3.53)) / 2).toFixed(3)]);
  const g = d1.nodes[d1.nodes.length - 2] as Extract<ModelNode, { kind: 'oring-gland' }>, o = d1.nodes[d1.nodes.length - 1] as Extract<ModelNode, { kind: 'oring' }>;
  assert.deepEqual([g.gland, g.ring, g.face, o.gland], ['piston', '214', 'n1.side0', d1.nodes.length - 2]);
  assert.deepEqual(usesOf(o), [d1.nodes.length - 2]); assert.equal(featureLabel(g, 0, d1.nodes), 'O-ring gland (piston) for 214');
  const r = evaluateDoc(d1, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const body = (kind: string) => r.ok ? r.bodies.find(b => b.ref && d1.nodes[b.ref.node].kind === kind)! : null!;
  const gb = body('oring-gland'), notes = gb.notes!.map(n => n.text);
  assert.ok(Math.abs(gb.volume! - Math.PI * (15.5 ** 2 * 20 - (15.5 ** 2 - 12.75 ** 2) * 4.7)) < 1e-6, String(gb.volume));
  assert.ok(notes.includes('O-ring gland (piston) for 214: ID 24.99 × CS 3.53 (your row, O1 (D139)); groove Ø25.5 × 4.7, 2.8 deep to the Ø31.1 bore'), JSON.stringify(notes));
  assert.ok(notes.includes('Stretch 2 %, the section 3.5006 stretched; squeeze 20.7 % (20 % stretched); fill 73.1 %'), JSON.stringify(notes));
  assert.ok(gb.notes!.some(n => /^Against squeeze 18–25 %, fill 75–85 %, stretch ≤ 5 % \(estimates: Fictiv/.test(n.text) && n.warning), JSON.stringify(notes));
  assert.ok(gb.notes!.some(n => /^FILL_RANGE: fill 73\.135 % outside 75–85 % \(an estimate\)$/.test(n.text) && n.warning), JSON.stringify(notes));
  assert.ok(body('oring').notes!.some(n => /overlaps what squeezes it by 136\.4858 mm³/.test(n.text)), JSON.stringify(body('oring').notes));
  // The rows cross to the engine worker; a row in use stays.
  assert.deepEqual(evaluatedPart(d1).orings, d1.orings);
  assert.match(String((editORingRows(d1, [], ['214']) as { error: string }).error), /used by a gland/);
});

test('O-ring gland (R12c.5): a face gland on a plate\'s top about its centre; a gland with no squeeze refused with its title', () => {
  let doc = rectanglePart(80, 80, 10);
  doc = (editORingRows(doc, [{ ...O1, insideDiameter: 29.5 }]) as { doc: StudioDoc }).doc;
  const top = (() => { const r = evaluateDoc(doc, 1); return r.ok ? r.bodies[0].mesh.faces.find(f => f.name.endsWith('.top'))!.name : ''; })();
  const { doc: d } = onFace(doc, top, { dg: 30, w: 4, h: 2.6 });
  const g = d.nodes[d.nodes.length - 2] as Extract<ModelNode, { kind: 'oring-gland' }>;
  assert.deepEqual([g.gland, g.depth, g.center?.map(x => Math.round(x))], ['face', 2.6, [40, 40, 10]]);
  const r = evaluateDoc(d, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const c = cmd('cylinder'); let p = c.build!(blank, { ...c.defaults!(blank), r: 15.5, h: 20, x: 0, y: 0, z: 0 });
  p = (editORingRows(p, [O1]) as { doc: StudioDoc }).doc;
  const { doc: shallow } = onFace(p, 'n1.side0', { seal: 32.6, dg: 25.5, w: 4.7, at: 6 }), rs = evaluateDoc(shallow, 3);
  assert.ok(!rs.ok && rs.error.title === 'The O-ring gland does not work' && /not squeezed/.test(rs.error.detail), rs.ok ? 'built' : rs.error.detail);
});

test('O-ring gland (R12c.5) in the chat: a v2 features command, its values behind describe', async () => {
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1), state: ChatState = { doc: emptyDoc(), bodies: [] };
  const d = await runTool(state, 'describe', { command: 'oring-gland' }, evaluate);
  assert.ok(!d.isError, d.content); assert.match(d.content, /none built in: if none, say so/);
});
