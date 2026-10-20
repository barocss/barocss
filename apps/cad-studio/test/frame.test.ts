import test from 'node:test';
import assert from 'node:assert/strict';
import { commands } from '../src/app/commands';
import { evaluateDoc, evaluatePart, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, withNode, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { editFields } from '../src/app/editFields';

// FR1 (D123): a structural member in the studio — the palette's command (its section kinds, the prefilled radii and the
// T-slot's slot sizes flagged estimates), the body's panel, the feature editor, saving, and the agent's command and raw node.
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, !r.ok ? r.error.detail : ''); return (r as { bodies: BodyResult[] }).bodies; };
const none = { faces: [], edges: [], bodies: [] };
const noId = (n: object) => { const o = { ...n } as Record<string, unknown>; delete o.id; return o; };
const SP = 1 - Math.PI / 4;

test('D123 Structural member: each section kind from the palette, A·L by the textbook area; the radius prefills flagged estimates in the notes; its label and fields', () => {
  const cmd = commands.find(c => c.id === 'frame-member')!, ctx = { doc: emptyDoc(), bodies: [], selection: none } as never, d = cmd.defaults!(ctx);
  assert.equal(cmd.available(ctx).ok, true);
  const L = 300;
  const cases: [string, Record<string, unknown>, number, string][] = [
    ['rect-tube', {}, 40 * 40 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9), 'Member RHS 40×40×3 · 300 mm'],
    ['round-tube', {}, Math.PI / 4 * (33.7 ** 2 - 27.7 ** 2), 'Member Tube Ø33.7×3 · 300 mm'],
    ['angle', {}, 5 * 95 + SP * (36 - 18), 'Member L 50×50×5 · 300 mm'],
    ['channel', { h: 80, w: 40 }, 80 * 5 + 2 * 35 * 8 + 2 * SP * 36, 'Member C 80×40 · 300 mm'],
    ['tslot', {}, 400 - 4 * (6.2 * 6.1 + 4.8 ** 2 / 4) - Math.PI * 4.41, 'Member T-slot 20 · 300 mm'],
  ];
  for (const [section, more, A, label] of cases) {
    const doc = cmd.build!(ctx, { ...d, section, ...more }), node = doc.nodes[0], [body] = bodiesOf(doc);
    assert.equal(node.kind, 'frame-member');
    assert.ok(Math.abs(body.volumeMM3! / (A * L) - 1) < 1e-12, `${section}: ${body.volumeMM3} vs ${A * L}`);
    assert.equal(featureLabel(node, 0, doc.nodes), label);
    const notes = body.notes!.map(n => n.text);
    assert.match(notes[0], new RegExp(`^Member: ${section} .* · section ${+A.toFixed(3)} mm² · length 300 mm$`));
    assert.match(notes[1], /^Line through its centroid; section x −X, y \+Z$/);
    // (The prefilled radii — and the T-slot's slot sizes — are estimates; a round tube has none.)
    const est = body.notes!.find(n => n.warning);
    if (section === 'round-tube') assert.equal(est, undefined, section);
    else assert.ok(est && /^Estimates, not your stock's: /.test(est.text), `${section}: ${JSON.stringify(body.notes)}`);
  }
  // Its own radius: no estimate. Editing the prefilled radius in the feature editor drops its flag.
  const own = cmd.build!(ctx, { ...d, ro: 4 }), [b] = bodiesOf(own);
  assert.equal(b.notes!.some(n => n.warning), false);
  const doc = cmd.build!(ctx, d), fields = editFields(doc.nodes, 0);
  assert.deepEqual(fields.map(f => f.key), ['s.width', 's.height', 's.wall', 's.outerRadius', 'len', 'roll']);
  const ro = fields.find(f => f.key === 's.outerRadius')!;
  assert.ok(ro.kind === 'number');
  const edited = ro.kind === 'number' ? ro.set(doc.nodes, 5) : doc.nodes;
  assert.equal((edited[0] as { estimates?: string[] }).estimates, undefined);
  // The length along the line, and the roll.
  const len = fields.find(f => f.key === 'len')!;
  if (len.kind === 'number') { assert.equal(len.get(doc.nodes), 300); const longer = len.set(doc.nodes, 450); assert.deepEqual((longer[0] as { end: number[] }).end, [0, 450, 0]); }
  // A zero-length line is refused before it is built.
  assert.throws(() => cmd.build!(ctx, { ...d, y1: 0 }), /start and an end apart/);
});

test('D123 a member of a sketch section, saved and read back; the agent\'s run_command and raw node, its refusals', async () => {
  const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20] });
  doc = withNode(doc, { kind: 'frame-member', section: { kind: 'sketch', sketch: 0 }, start: [0, 0, 0], end: [0, 0, 120], anchor: 'bottom-left' });
  const [body] = bodiesOf(doc);
  assert.ok(Math.abs(body.volumeMM3! - 600 * 120) < 1e-9);
  assert.match(body.notes![1].text, /the line runs along up, so y follows \+X/);
  const read = readStudioDoc(JSON.stringify(doc)); assert.ok('doc' in read, JSON.stringify(read)); assert.equal(read.doc.nodes[1].kind, 'frame-member');
  // The agent: the palette's command with its values, and a raw node with every dimension.
  const state: ChatState = { doc: emptyDoc(), bodies: [] };
  const r = await dispatchTool(state, 'run_command', { command: 'frame-member', values: { section: 'angle', a: 40, b: 40, th: 4, r1: 5, r2: 2.5, x0: 0, y0: 0, z0: 0, x1: 500, y1: 0, z1: 0 } }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.ok(Math.abs(r.state.bodies[0].volumeMM3! - (4 * 76 + SP * (25 - 12.5)) * 500) < 1e-9, String(r.state.bodies[0].volumeMM3));
  const node = { kind: 'frame-member', section: { kind: 'channel', height: 100, width: 50, web: 6, flange: 8.5, rootRadius: 8.5 }, start: [0, 0, 0], end: [0, 800, 0], roll: 90 };
  const a = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [node] }, evaluate);
  assert.ok(!a.isError, a.content);
  assert.deepEqual(noId(a.state.doc.nodes[0]), node);
  assert.ok(Math.abs(a.state.bodies[0].volumeMM3! - (100 * 6 + 2 * 44 * 8.5 + 2 * SP * 8.5 ** 2) * 800) < 1e-8);
  // A section missing a dimension, one the kernel refuses, an unknown kind: refused, nothing added.
  const miss = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [{ ...node, section: { kind: 'channel', height: 100, width: 50, web: 6, flange: 8.5 } }] }, evaluate);
  assert.ok(miss.isError && /a channel section needs \\"rootRadius/.test(miss.content), miss.content);
  const bad = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [{ ...node, section: { ...node.section, height: 20 } }] }, evaluate);
  assert.ok(bad.isError && /SECTION_DIMENSIONS/.test(bad.content), bad.content);
  const kind = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [{ ...node, section: { kind: 'i-beam' } }] }, evaluate);
  assert.ok(kind.isError && /a section \{\\"kind\\": \\"rect-tube/.test(kind.content), kind.content);
});
