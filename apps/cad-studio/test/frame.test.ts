import test from 'node:test';
import assert from 'node:assert/strict';
import { commands } from '@barocss/cad-model/app/commands';
import { evaluateDoc, evaluatePart, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, featureLabel, rectanglePart, sectionLabel, withNode, type Dim, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { flattenAssembly } from '@barocss/cad-model/engine/flatten';
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { editFields } from '@barocss/cad-model/app/editFields';
import { bodyName, withLook } from '@barocss/cad-model/app/bodies';
import { partCutList } from '@barocss/cad-model/app/cutList';
import { MATERIALS } from '@barocss/cad-model/library/materials';
import { cutText } from '../src/ui/CutListDialog';

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
  const ibe = { kind: 'i-beam', height: 100, width: 60, web: 6, flange: 8, rootRadius: 0, toeRadius: 0, flangeSlope: 0 };
  const supported = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [{ ...node, section: ibe }] }, evaluate);
  assert.ok(!supported.isError, supported.content);
  assert.equal(supported.state.bodies.length, 1);
  assert.ok(Math.abs(supported.state.bodies[0].volumeMM3! / ((2 * 60 * 8 + (100 - 16) * 6) * 800) - 1) < 1e-12);
  assert.match(featureLabel(supported.state.doc.nodes[0], 0, supported.state.doc.nodes), /Member I\/H/);
  const unchanged: ChatState = { doc: emptyDoc(), bodies: [] }, before = JSON.stringify(unchanged.doc);
  const missing = await dispatchTool(unchanged, 'add_features', { features: [{ ...node, section: { kind: 'i-beam' } }] }, evaluate);
  assert.ok(missing.isError && /i-beam section needs "height"/.test(JSON.parse(missing.content).error), missing.content);
  assert.equal(missing.state, unchanged); assert.equal(JSON.stringify(unchanged.doc), before);
  const unknown = await dispatchTool(unchanged, 'add_features', { features: [{ ...node, section: { kind: 'not-a-section' } }] }, evaluate);
  assert.ok(unknown.isError && /a section/.test(JSON.parse(unknown.content).error), unknown.content);
  assert.equal(unknown.state, unchanged); assert.equal(JSON.stringify(unchanged.doc), before);
});

test('D124 Frame from the palette: a table skeleton (8 members), each its own body named by its member, A·L each; the notes say which member and points; the editor moves a point', () => {
  const cmd = commands.find(c => c.id === 'frame')!, ctx = { doc: emptyDoc(), bodies: [], selection: none } as never, d = cmd.defaults!(ctx);
  assert.equal(d.skeleton, 'table');
  // (Its three-member corners left as they are here — FR3b's ordered trim is the palette's default, D126.)
  const doc = cmd.build!(ctx, { ...d, multi: 'none' }), node = doc.nodes[0], bodies = bodiesOf(doc), A = 40 * 40 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9);
  assert.equal(node.kind, 'frame'); assert.equal(bodies.length, 8);
  assert.equal(featureLabel(node, 0, doc.nodes), 'Frame RHS 40×40×3 · 8 members');
  // Legs 700 along Z, then the top's rails 600, 400, 600, 400.
  const lengths = [700, 700, 700, 700, 600, 400, 600, 400];
  bodies.forEach((b, k) => assert.ok(Math.abs(b.volumeMM3! / (A * lengths[k]) - 1) < 1e-12, `member ${k}: ${b.volumeMM3}`));
  assert.equal(bodyName(doc, bodies[2]), 'Frame RHS 40×40×3 · 8 members · member 3');
  const notes = bodies[5].notes!.map(n => n.text);
  assert.equal(notes[0], 'Frame member 6 of 8: point 6 → point 7');
  assert.ok(bodies[5].notes!.some(n => n.warning && /outerRadius 6 mm/.test(n.text)), JSON.stringify(bodies[5].notes));
  // The editor: the section, the roll, each point; moving the top's points up lengthens the legs.
  const fields = editFields(doc.nodes, 0);
  assert.deepEqual(fields.slice(0, 5).map(f => f.key), ['s.width', 's.height', 's.wall', 's.outerRadius', 'roll']);
  let moved = doc.nodes;
  for (const p of [4, 5, 6, 7]) { const f = editFields(moved, 0).find(x => x.key === `p${p}.z`)!; if (f.kind === 'number') moved = f.set(moved, 900); }
  const longer = bodiesOf({ ...doc, nodes: moved });
  assert.ok(Math.abs(longer[0].volumeMM3! / (A * 900) - 1) < 1e-12);
});

test('D124 Frame on picked edges: a layout box\'s 12 edges, their corners shared (8 points), a member on each; saved and read back', () => {
  const box = commands.find(c => c.id === 'box')!, bctx = { doc: emptyDoc(), bodies: [], selection: none } as never;
  const layout = box.build!(bctx, { ...box.defaults!(bctx), w: 500, d: 300, h: 400, x: 0, y: 0, z: 0 }), lb = bodiesOf(layout);
  const straight = lb[0].mesh.edges.filter(e => e.straight).map(e => ({ body: 0, edge: e.index }));
  assert.equal(straight.length, 12);
  const cmd = commands.find(c => c.id === 'frame')!, ctx = { doc: layout, bodies: lb, selection: { faces: [], edges: straight, bodies: [] } } as never, d = cmd.defaults!(ctx);
  assert.equal(d.skeleton, 'edges');
  assert.deepEqual(cmd.steps!(ctx, d), [{ label: 'Edges', text: '12 edges, 8 points', done: true }]);
  const doc = cmd.build!(ctx, { ...d, section: 'round-tube', d: 26.9, t: 2.3, multi: 'none' }), node = doc.nodes.at(-1)!;
  assert.ok(node.kind === 'frame' && node.points.length === 8 && node.segments.length === 12);
  const A = Math.PI / 4 * (26.9 ** 2 - 22.3 ** 2), members = bodiesOf(doc).filter(b => b.ref?.node === doc.nodes.length - 1);
  assert.equal(members.length, 12);
  assert.ok(Math.abs(members.reduce((s, b) => s + b.volumeMM3!, 0) / (A * 4 * (500 + 300 + 400)) - 1) < 1e-12);
  const read = readStudioDoc(JSON.stringify(doc)); assert.ok('doc' in read, JSON.stringify(read)); assert.equal(read.doc.nodes.at(-1)!.kind, 'frame');
  // Without edges picked, "edges" says what to do.
  assert.throws(() => cmd.build!({ doc: layout, bodies: lb, selection: none } as never, { ...d }), /Pick straight edges/);
});

test('D124 the agent\'s frame: a raw node with an override (the legs mirrored angles), checked and built; refused shapes and skeletons', async () => {
  const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
  const ang = { kind: 'angle', legX: 40, legY: 40, thickness: 4, rootRadius: 5, toeRadius: 2.5 }, A = 4 * 76 + SP * (25 - 12.5);
  const node = { kind: 'frame', points: [[0, 0, 0], [0, 0, 500], [300, 0, 0], [300, 0, 500]], segments: [[0, 1], [2, 3], [1, 3]], section: ang, anchor: 'origin', overrides: [{ member: 1, mirror: true }] };
  const a = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [node] }, evaluate);
  assert.ok(!a.isError, a.content);
  assert.deepEqual(noId(a.state.doc.nodes[0]), node);
  assert.equal(a.state.bodies.length, 3);
  assert.ok(Math.abs(a.state.bodies.reduce((s, b) => s + b.volumeMM3!, 0) / (A * 1300) - 1) < 1e-12);
  const refused = async (features: unknown[], re: RegExp) => { const state: ChatState = { doc: emptyDoc(), bodies: [] }, before = JSON.stringify(state.doc); const r = await dispatchTool(state, 'add_features', { features }, evaluate); assert.ok(r.isError && re.test(r.content), r.content); assert.equal(r.state, state); assert.equal(JSON.stringify(state.doc), before); };
  await refused([{ ...node, segments: [[0, 1], [0, 1]] }], /MEMBER_DUPLICATE/);
  await refused([{ ...node, segments: 'all' }], /1 to 256 \[from,to\], .*center:.*through:point.*no extra fields/);
  await refused([{ ...node, overrides: [{ member: 0, colour: 'red' }] }], /an override has no \\"colour\\"/);
  await refused([{ ...node, overrides: [{ member: 0, section: { kind: 'angle', legX: 40 } }] }], /override of member 0: a angle section needs/);
});

test('D125 corners from the palette: a rectangle of sharp tubes mitred (A·L each, 45° ends in the notes); a table\'s three-member corners left square and said so; a corner set apart in the editor', () => {
  const cmd = commands.find(c => c.id === 'frame')!, ctx = { doc: emptyDoc(), bodies: [], selection: none } as never, d = cmd.defaults!(ctx);
  assert.equal(d.corners, 'mitre');
  const A = 1600 - 34 * 34, doc = cmd.build!(ctx, { ...d, skeleton: 'rectangle', ro: 0 }), node = doc.nodes[0];
  assert.ok(node.kind === 'frame'); assert.deepEqual(node.corners, { default: 'mitre', multi: 'order', tee: 'butt' });
  const bodies = bodiesOf(doc), L = [600, 400, 600, 400];
  bodies.forEach((b, k) => assert.ok(Math.abs(b.volumeMM3! / (A * L[k]) - 1) < 1e-12, `member ${k}: ${b.volumeMM3}`));
  assert.ok(bodies[0].notes!.some(n => n.text === 'Ends: start mitre 45° with member 4; end mitre 45° with member 2'), JSON.stringify(bodies[0].notes));
  // A table: every top corner joins a leg and two rails — square, overlapping, said so.
  const table = bodiesOf(cmd.build!(ctx, { ...d, ro: 0, multi: 'none' }));
  assert.ok(table[4].notes!.some(n => n.warning && /^Point 5: 3 members meet, left square and overlapping \(set "Three or more members" to an ordered trim\)$/.test(n.text)), JSON.stringify(table[4].notes));
  // The editor: point 2 (index 1) butted, member 2 through — member 1 ends 20 short there, member 2 runs on 20.
  const f = editFields(doc.nodes, 0).find(x => x.key === 'corner1')!;
  assert.ok(f.kind === 'choice'); assert.deepEqual(f.options.map(o => o.value), ['default', 'mitre', 'butt:0', 'butt:1', 'cope:0', 'cope:1', 'none']);
  const butted = f.kind === 'choice' ? f.set(doc.nodes, 'butt:1') : doc.nodes, bb = bodiesOf({ ...doc, nodes: butted });
  assert.deepEqual((butted[0] as { corners?: unknown }).corners, { default: 'mitre', multi: 'order', tee: 'butt', at: [{ point: 1, kind: 'butt', through: 1 }] });
  assert.ok(Math.abs(bb[0].volumeMM3! / (A * 580) - 1) < 1e-12 && Math.abs(bb[1].volumeMM3! / (A * 420) - 1) < 1e-12, `${bb[0].volumeMM3} ${bb[1].volumeMM3}`);
  if (f.kind === 'choice') assert.equal(f.get(butted), 'butt:1');
  // All corners butted from the frame's field; back to the default for that point.
  const all = editFields(doc.nodes, 0).find(x => x.key === 'corners')!;
  if (all.kind === 'choice') assert.equal((all.set(doc.nodes, 'none')[0] as { corners?: { default?: string } }).corners!.default, 'none');
  if (f.kind === 'choice') assert.deepEqual((f.set(butted, 'default')[0] as { corners?: unknown }).corners, { default: 'mitre', multi: 'order', tee: 'butt' });
});

test('D125 a frame on a sketch section inside an assembly instance: flattened, its section follows its sketch (volumes and face names); the agent\'s corners, checked', async () => {
  // The instance: a 30 × 20 plate sketch with a hole, a two-member frame on it, mitred.
  let part = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20], holes: [[{ kind: 'arc', start: [14, 10], center: [10, 10], direction: 'ccw' }]] } as never);
  part = withNode(part, { kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 200, 0]], segments: [[0, 1], [1, 2]], section: { kind: 'sketch', sketch: 0 }, corners: { default: 'butt' } });
  const sub: StudioDoc = { ...rectanglePart(50, 50, 5), instances: [{ id: 'fr', name: 'fr', doc: part, position: [0, 100, 0], rotation: [0, 0, 0] } as PartInstance] };
  const flat = flattenAssembly(sub), frame = flat.nodes.find(n => n.kind === 'frame')!;
  // (The plate's two nodes come first: the frame's sketch is node 2 now.)
  assert.ok(frame.kind === 'frame' && frame.section.kind === 'sketch' && frame.section.sketch === 2, JSON.stringify(frame));
  const r = evaluatePart(flat, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  // (Placed 100 along Y, each member moved there: its body is the move's, its faces still the frame's.)
  const A = 600 - 16 * Math.PI, members = r.bodies.filter(b => b.mesh.faces.some(f => f.name.startsWith(`${frame.id}.m`))).sort((p, q) => p.mesh.bounds.min[0] - q.mesh.bounds.min[0]);
  assert.equal(members.length, 2);
  // A butt, member 0 through (the same section: the lower index). Member 0 (along +X) has its section x (30 wide) along +Y;
  // member 1 (along +Y) has its x along −X. With x̄ the section's centroid: member 0 runs on x̄ past the corner to cover
  // member 1, and member 1 ends on member 0's face 30 − x̄ from the corner: A(300 + x̄) + A(200 − 30 + x̄).
  const cx = (600 * 15 - 16 * Math.PI * 10) / A;
  assert.ok(Math.abs(members[0].volumeMM3! / (A * (300 + cx)) - 1) < 1e-12, String(members[0].volumeMM3));
  assert.ok(Math.abs(members[1].volumeMM3! / (A * (170 + cx)) - 1) < 1e-12, String(members[1].volumeMM3));
  const fid = frame.id!, names = new Set(members.flatMap(b => b.mesh.faces.map(f => f.name.replace(/#\d+$/, ''))));
  assert.ok([...names].every(n => n.startsWith(`${fid}.m`)) && names.has(`${fid}.m0.start`) && names.has(`${fid}.m1.start.butt`) && names.has(`${fid}.m1.hole0.side0`), [...names].join(' '));
  // The agent's corners: checked before the kernel sees them.
  const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
  const node = { kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 300, 0]], segments: [[0, 1], [1, 2]], section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } };
  const ok = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [node] }, evaluate);
  assert.ok(!ok.isError, ok.content);
  const bad = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [{ ...node, corners: { default: 'weld' } }] }, evaluate);
  assert.ok(bad.isError && /corners\.default: mitre, butt or none/.test(bad.content), bad.content);
  const inline = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [{ ...node, points: [[0, 0, 0], [300, 0, 0], [600, 0, 0]] }] }, evaluate);
  assert.ok(inline.isError && /CORNER_ANGLE/.test(inline.content), inline.content);
});

test('D126 the palette\'s table frame trims its corners in order (legs through, rails between, no warning); a T-joint rail butted on a post; the editor\'s joint fields; the agent\'s trims and refusals', async () => {
  const cmd = commands.find(c => c.id === 'frame')!, ctx = { doc: emptyDoc(), bodies: [], selection: none } as never, d = cmd.defaults!(ctx);
  assert.deepEqual([d.multi, d.tee], ['order', 'butt']);
  const A = 1600 - 34 * 34, doc = cmd.build!(ctx, { ...d, ro: 0 }), node = doc.nodes[0];
  assert.ok(node.kind === 'frame'); assert.deepEqual(node.corners, { default: 'mitre', multi: 'order', tee: 'butt' });
  const bodies = bodiesOf(doc);
  [720, 720, 720, 720, 560, 360, 560, 360].forEach((L, k) => assert.ok(Math.abs(bodies[k].volumeMM3! / (A * L) - 1) < 1e-12, `member ${k}: ${bodies[k].volumeMM3}`));
  assert.ok(bodies.every(b => !b.notes!.some(n => /left square and overlapping/.test(n.text))));
  assert.ok(bodies[4].notes!.some(n => /^Ends: start trimmed to member 1 \(2 in order\); end trimmed to member 2 \(2 in order\)$/.test(n.text)), JSON.stringify(bodies[4].notes));
  assert.ok(bodies[0].notes!.some(n => /end through, 20 mm past point 5 over member 5/.test(n.text)), JSON.stringify(bodies[0].notes));
  // The editor: the frame's joint settings.
  const fields = editFields(doc.nodes, 0), multi = fields.find(f => f.key === 'multi')!, tee = fields.find(f => f.key === 'tee')!;
  assert.ok(multi.kind === 'choice' && tee.kind === 'choice');
  if (multi.kind === 'choice') { assert.equal(multi.get(doc.nodes), 'order'); assert.equal((multi.set(doc.nodes, 'none')[0] as { corners?: { multi?: string } }).corners!.multi, 'none'); }
  // A T-joint by the agent: a rail on a post's middle (butted by `tee`), and a leg trimmed to an inclined floor.
  const evaluate = async (x: StudioDoc) => evaluatePart(x, 1), SH = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 };
  const tnode = { kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [0, 0, 400], [500, 0, 400]], segments: [[0, 1], [3, 2]], section: SH, corners: { tee: 'butt' }, trims: [{ member: 0, end: 'start', plane: { origin: [0, 0, 10], normal: [-0.2, 0, 1] } }] };
  const r = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [tnode] }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.ok(Math.abs(r.state.bodies[0].volumeMM3! / (A * 790) - 1) < 1e-12 && Math.abs(r.state.bodies[1].volumeMM3! / (A * 480) - 1) < 1e-12, `${r.state.bodies.map(b => b.volumeMM3)}`);
  assert.ok(r.state.bodies[0].notes!.some(n => /^Ends: start trimmed to a plane \(11\.31\d*° from square\)/.test(n.text)), JSON.stringify(r.state.bodies[0].notes));
  const refused = async (features: unknown[], re: RegExp) => { const x = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features }, evaluate); assert.ok(x.isError && re.test(x.content), x.content); };
  await refused([{ ...tnode, section: { ...SH, outerRadius: 6 }, trims: undefined }], /BUTT_ON_OPEN_SIDE/);
  await refused([{ ...tnode, trims: [{ member: 0, end: 'start' }] }], /a trim takes a \\"plane\\" or a \\"body\\"/);
  await refused([{ ...tnode, corners: { tee: 'weld' } }], /corners\.tee: butt, cope or none/);
});

test('D127 the cut list: the palette\'s mitred rectangle of sharp tubes — two rows of two, 600 and 400, 45° both ends, masses by the body\'s material (aluminium, an estimate); a body in steel is its own row; the agent\'s cut_list with its CSV', async () => {
  const cmd = commands.find(c => c.id === 'frame')!, ctx = { doc: emptyDoc(), bodies: [], selection: none } as never, d = cmd.defaults!(ctx);
  const A = 1600 - 34 * 34, doc = cmd.build!(ctx, { ...d, skeleton: 'rectangle', ro: 0 }), bodies = bodiesOf(doc);
  const list = partCutList(doc, bodies, 'al6061')!, al = MATERIALS.find(m => m.id === 'al6061')!.gPerCm3 * 1000;
  assert.deepEqual(list.rows.map(r => [r.quantity, Math.round(r.axisLengthMM * 1e9) / 1e9, r.ends.map(e => e.kind)]), [[2, 600, ['mitre', 'mitre']], [2, 400, ['mitre', 'mitre']]]);
  assert.ok(Math.abs(list.rows[0].massKG / (al * A * 600e-9) - 1) < 1e-12);
  assert.equal(list.densityEstimate, true); assert.equal(list.rows[0].material, MATERIALS.find(m => m.id === 'al6061')!.label);
  assert.equal(cutText(list.rows[0].ends[0]), 'mitre 45°');
  // One member's body in steel: apart, by steel's density.
  const steel = MATERIALS.find(m => m.id === 'steel')!, mixed = withLook(doc, bodies[0], { material: 'steel' }), ml = partCutList(mixed, bodiesOf(mixed), 'al6061')!;
  // (In first-seen order: member 1 in steel, members 2 and 4 the 400s, member 3 the other 600.)
  assert.deepEqual(ml.rows.map(r => [r.quantity, r.material, r.pieces.length]), [[1, steel.label, 1], [2, MATERIALS.find(m => m.id === 'al6061')!.label, 2], [1, MATERIALS.find(m => m.id === 'al6061')!.label, 1]]);
  assert.ok(Math.abs(ml.rows[0].massKG / (steel.gPerCm3 * 1000 * A * 600e-9) - 1) < 1e-12);
  // The agent: read only, rows and totals, the CSV on asking; a part without members says so.
  const evaluate = async (x: StudioDoc) => evaluatePart(x, 1), r0 = await evaluate(doc); assert.ok(r0.ok);
  const r = await dispatchTool({ doc, bodies: r0.bodies }, 'cut_list', { csv: true }, evaluate);
  assert.ok(!r.isError, r.content);
  const out = JSON.parse(r.content);
  assert.equal(out.totals.quantity, 4); assert.equal(out.rows.length, 2); assert.match(out.densities, /estimates/);
  assert.match(out.csv, /^item,quantity,section,material,axis length \(mm\)/);
  assert.match(out.rows[0].names[0], /^Frame RHS 40×40×3 · 4 members · member 1$/);
  const none2 = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'cut_list', {}, evaluate);
  assert.ok(none2.isError && /no frame members/.test(none2.content), none2.content);
});


test('FRk3 legacy channel labels omit absent and literal zero slope; nonzero and parameter labels stay visible', () => {
  const channel = { kind: 'channel' as const, height: 80, width: 40, web: 5, flange: 8, rootRadius: 6 };
  const dim = (v: Dim) => typeof v === 'number' ? String(v) : v.parameter;
  assert.equal(sectionLabel(channel, dim), 'C 80×40');
  assert.equal(sectionLabel({ ...channel, flangeSlope: 0 }, dim), 'C 80×40');
  assert.equal(sectionLabel({ ...channel, flangeSlope: .05 }, dim), 'C 80×40 · slope 0.05');
  assert.equal(sectionLabel({ ...channel, flangeSlope: { parameter: 'taper' } }, dim), 'C 80×40 · slope taper');
});
