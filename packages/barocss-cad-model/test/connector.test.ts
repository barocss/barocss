import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, rectanglePart, usesOf, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluatedPart } from '../src/engine/wireDoc';
import { commands, type Ctx } from '../src/app/commands';
import { editConnectorRows } from '../src/engine/connectors';
import { editSections } from '../src/frames/sections';
import { isSectionTable, sectionTableRows } from '../src/frames/sectionTables';
import { runTool, type ChatState } from '../src/chat/tools';

// R12c.7 (D162) in the studio: the user's connector rows (none built in) — D139's U1 USB-C opening as a test row citing
// it — cut into a plate's top through the command, the body seated, the keep-out written to the part's keep-outs (A6.3);
// a section table read into the section library, a member on one of its sizes. Oracles: the stadium (w − h)h + πh²/4,
// the rounded tube w·h − (4 − π)r_o² − ((w − 2t)(h − 2t) − (4 − π)r_i²).


const cmd = commands.find(c => c.id === 'connector')!;
const U1 = { id: 'usb-c', name: 'USB-C receptacle opening', opening: { shape: 'stadium', widthMM: 8.34, heightMM: 2.56, depthMM: 6.2 }, body: { shape: 'stadium', widthMM: 8.25, heightMM: 2.4, lengthMM: 6.51 }, keepOut: { marginMM: 1, depthMM: 15 }, source: 'U1 (D139): Wikipedia, "USB hardware"' };
const stadium = (w: number, h: number) => (w - h) * h + Math.PI * h * h / 4;
function onTop(doc: StudioDoc, values: Record<string, string | number> = {}) {
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const face = r.bodies[0].mesh.faces.findIndex(f => f.name.endsWith('.top')), ctx: Ctx = { doc, bodies: r.bodies, selection: { faces: [{ body: 0, face }], edges: [], bodies: [] } };
  const ok = cmd.available(ctx); assert.ok(ok.ok, ok.ok ? '' : ok.reason);
  return cmd.build!(ctx, { ...cmd.defaults!(ctx), ...values });
}

test('Connector opening (R12c.7): no rows, no opening; U1\'s row — the opening at the plate\'s centre, the body seated, their volumes, notes and labels; the keep-out in the part\'s keep-outs', () => {
  const plate = rectanglePart(40, 20, 10), r0 = evaluateDoc(plate, 1); assert.ok(r0.ok);
  const none = cmd.available({ doc: plate, bodies: r0.bodies, selection: { faces: [{ body: 0, face: 0 }], edges: [], bodies: [] } });
  assert.ok(!none.ok && /Load your connector rows first .* none is built in/.test(none.reason));
  assert.match(String((editConnectorRows(plate, [{ ...U1, source: undefined }]) as { error: string }).error), /never neither/);
  const doc = onTop((editConnectorRows(plate, [U1]) as { doc: StudioDoc }).doc);
  const o = doc.nodes[2] as Extract<ModelNode, { kind: 'connector-opening' }>, b = doc.nodes[3] as Extract<ModelNode, { kind: 'connector-body' }>;
  assert.deepEqual([o.row, o.face, o.center.map(x => Math.round(x * 1e9) / 1e9), b.opening, usesOf(b)], ['usb-c', 'n1.top', [20, 10, 10], 2, [2]]);
  assert.deepEqual([featureLabel(o, 2, doc.nodes), featureLabel(b, 3, doc.nodes)], ['Connector opening for usb-c', 'Connector body in n2']);
  const r = evaluateDoc(doc, 2); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const body = (kind: string) => r.ok ? r.bodies.find(x => x.ref && doc.nodes[x.ref.node].kind === kind)! : null!;
  assert.ok(Math.abs(body('connector-opening').volumeMM3! - (8000 - stadium(8.34, 2.56) * 6.2)) < 1e-6, String(body('connector-opening').volumeMM3));
  assert.ok(Math.abs(body('connector-body').volumeMM3! - stadium(8.25, 2.4) * 6.51) < 1e-6);
  const notes = body('connector-opening').notes!.map(n => n.text);
  assert.ok(notes.includes(`Connector opening USB-C receptacle opening (your row, U1 (D139): Wikipedia, "USB hardware"): stadium 8.34 × 2.56, 6.2 deep, ${+stadium(8.34, 2.56).toFixed(4)} mm²`), JSON.stringify(notes));
  assert.ok(notes.includes('Its body stadium 8.25 × 2.4 × 6.51: gaps 0.045 and 0.08 each side, standing 0.31 out of the face'), JSON.stringify(notes));
  assert.ok(body('connector-body').notes!.some(n => /touching nothing of the panel \(overlap 0 mm³/.test(n.text)));
  const k = doc.references!.keepouts[0];
  assert.deepEqual([k.id, k.frame.origin.map(x => Math.round(x * 1e9) / 1e9), k.frame.normal, k.shape, k.clearance], ['connector-n2', [14.875, 7.8, 10], [0, 0, 1], { kind: 'box', size: [10.25, 4.4, 15] }, 0]);
  assert.deepEqual(evaluatedPart(doc).connectors, doc.connectors);
  assert.match(String((editConnectorRows(doc, [], ['usb-c']) as { error: string }).error), /used by an opening/);
});

test('Connector opening (R12c.7): moved along its width and turned; a square-cornered body refused with its title; off the face refused', () => {
  const plate = (editConnectorRows(rectanglePart(40, 20, 10), [U1, { ...U1, id: 'sq', name: undefined, body: { shape: 'rect', widthMM: 8.25, heightMM: 2.4, lengthMM: 6.51 } }]) as { doc: StudioDoc }).doc;
  const moved = onTop(plate, { u: 5, rot: 90 }), o = moved.nodes[2] as Extract<ModelNode, { kind: 'connector-opening' }>;
  // (Turned 90°, its width runs along world Y: 5 along it from the centre.)
  assert.deepEqual([o.center.map(x => Math.round(x * 1e9) / 1e9), o.rotation], [[20, 15, 10], 90]);
  assert.ok(evaluateDoc(moved, 2).ok);
  const sq = evaluateDoc(onTop(plate, { row: 'sq' }), 3);
  assert.ok(!sq.ok && sq.error.title === 'The connector\'s body does not fit its opening' && /\[CONNECTOR_FIT\]/.test(sq.error.detail), sq.ok ? 'built' : sq.error.detail);
  const off = evaluateDoc(onTop(plate, { u: 17 }), 4);
  assert.ok(!off.ok && off.error.title === 'The connector opening does not fit on that face', off.ok ? 'built' : off.error.detail);
});

test('Section tables (R12c.7): a table read into the section library as a row a size, checked whole; a member on one; a refused table names why', () => {
  const RHS = { id: 'rhs-a', label: 'RHS', kind: 'rect-tube', estimate: true, rows: [{ size: '40x40x3', width: 40, height: 40, wall: 3, outerRadius: 6, innerRadius: 3 }, { size: '60x40x4', width: 60, height: 40, wall: 4, outerRadius: 8, innerRadius: 4, source: 'a test row with its own source' }] };
  assert.ok(isSectionTable(RHS) && !isSectionTable([RHS.rows[0]]));
  const t = sectionTableRows(RHS) as { rows: { id: string; name?: string; source?: string; estimate?: true; section: Record<string, unknown> }[] };
  assert.deepEqual(t.rows.map(r => [r.id, r.name, r.source ?? null, r.estimate ?? null]), [['rhs-a:40x40x3', 'RHS 40x40x3', null, true], ['rhs-a:60x40x4', 'RHS 60x40x4', 'a test row with its own source', null]]);
  assert.deepEqual(t.rows[0].section, { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 6, innerRadius: 3 });
  const lib = editSections(emptyDoc(), t.rows);
  assert.ok(!('error' in lib), 'error' in lib ? lib.error : '');
  const doc = withNode((lib as { doc: StudioDoc }).doc, { kind: 'frame-member', section: { kind: 'library', id: 'rhs-a:40x40x3' }, start: [0, 0, 0], end: [0, 0, 300] });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail);
  const A = 40 * 40 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9);
  assert.ok(r.ok && Math.abs(r.bodies[0].volumeMM3! - A * 300) < 1e-6 * A * 300, r.ok ? String(r.bodies[0].volumeMM3) : '');
  assert.match(String((sectionTableRows({ ...RHS, estimate: undefined }) as { error: string }).error), /^\[SECTION_TABLE\] section table rhs-a size 40x40x3: cite its source/);
});

test('Connector opening (R12c.7) in the chat: a v2 features command, its values behind describe', async () => {
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1), state: ChatState = { doc: emptyDoc(), bodies: [] };
  const d = await runTool(state, 'describe', { command: 'connector' }, evaluate);
  assert.ok(!d.isError, d.content); assert.match(d.content, /none built in: if none, say so/);
});
