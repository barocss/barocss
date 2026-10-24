import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, dispatchTool, type ChatState } from '../src/chat/tools';
import { resolveShopTree } from '../src/engine/shopRows';
import { bomView, deriveBom } from '../src/team/assembly';
import { draftBaseline, moveBaseline } from '../src/team/baseline';
import { userToken } from '../src/team/ecr';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { applyFill, assemblyPlacedBodies, clearanceMap, fillOverlap } from '../src/team/clearanceMap';
import { receivePersonRowFiles, type PersonRowFiles } from '../src/engine/rowFiles';
import { withSampleRows } from './person-file';

// A9 (O5): the coordinator's acceptance — a written brief to what a shop needs, one scripted agent through the real v2
// tools (dispatchTool, no live model), the brief as decisions-outer.md's A9 S0 froze it and O158 corrected it.
// The rows are conformance/a9/rows/*.json: a TEST FIXTURE standing in for the person's files, loaded through the chat's
// person-file path (rows rule b). The owner's own acceptance with a real person-supplied file stays pending.
// O159 holds steps 1–7 (rows, briefs, the four parts); the assembly, drawings, BOM, CSV, outputs and the bundle
// (steps 8–11) follow. Where a part's oracle is not met yet it is said, not asserted (see O159's findings).
const DIR = resolve(import.meta.dirname, '..', 'conformance/a9/rows');
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
/** A placed part's bodies as the assembly sees it: its document with the shop rows it inherits. */
const partBodies = (id: string) => { const inst = s.doc.instances!.find(i => i.id === id)!, r = evaluateDoc(resolveShopTree(inst.doc, s.doc, id), 1); assert.ok(r.ok, JSON.stringify(r)); return r.bodies; };
/** The fixture's files, received as attachments of one conversation at turn 1 (rows rule b). */
function personFiles(): { rowFiles: PersonRowFiles; file: (name: string) => string } {
  const names = readdirSync(DIR).filter(n => n.endsWith('.json')).sort();
  const rowFiles = receivePersonRowFiles('a9a9a9a9a9a9a9a9a9a9a9a9', names.map(name => ({ name, text: readFileSync(join(DIR, name), 'utf8'), turn: 1 })), 1);
  return { rowFiles, file: name => rowFiles.files.find(f => f.source.filename === name)!.id };
}
let s: ChatState;
async function call(tool: string, args: Record<string, unknown>) {
  const r = await dispatchTool(s, tool, args, evaluate);
  assert.ok(!r.isError, `${tool} ${JSON.stringify(args)}: ${r.content}`);
  s = r.state;
  return JSON.parse(r.content) as Record<string, unknown>;
}
async function refused(tool: string, args: Record<string, unknown>) {
  const r = await dispatchTool(s, tool, args, evaluate);
  assert.ok(r.isError, `${tool} ${JSON.stringify(args)} was not refused: ${r.content}`); assert.equal(r.state.doc, s.doc);
  return String((JSON.parse(r.content) as { error?: string }).error ?? r.content);
}

const stated = (value: string) => ({ value, basis: 'stated', source: 'the A9 brief' });
const exclude = <T extends Record<string, unknown>>(o: T) => { const { shopRows: _r, provenance: _p, ...rest } = o; void _r; void _p; return rest; };
const PITCH = 0.5e-6;
/** F4 (b): the cover's hole over the shaft's end — its Ø20 step, and the radial clearance a side, stated (mm). */
const SHAFT_END_MM = 20, COVER_CLEARANCE_MM = 1;

test('A9 steps 1–7: the person\'s rows (the fixture), a brief per part, and the frame, plate, shaft and cover by their oracles', async () => {
  const files = personFiles();
  // (O7: the fastener sizes are the sample rows, loaded as the person loads them.)
  const start = withSampleRows(emptyDoc());
  s = { doc: start, bodies: [], turnBase: start, rowFiles: files.rowFiles } as never as ChatState;

  // 1. Rows. The frame's section and stock lengths, then the parts' stock; the fit, bearing and O-ring rows on the base,
  // which the parts inherit (A9-8). Agent-written rows refused; each loaded row keeps the person's file as its source.
  assert.match(await refused('features', { action: 'frame_sections', rows: JSON.parse(readFileSync(join(DIR, 'sections.json'), 'utf8')) }), /\[ROWS_NOT_FROM_PERSON\]/);
  const sections = await call('features', { action: 'frame_sections', file: files.file('sections.json') });
  assert.deepEqual([sections.added, (sections.rows as { estimate?: boolean }[])[0].estimate], [['R40'], true]);
  await call('features', { action: 'frame_stock', file: files.file('frame-stock.json'), kerf: 2 });
  await call('features', { action: 'stock', file: files.file('stock.json'), allowance: 1 });
  assert.deepEqual([s.doc.frames?.stock?.map(r => r.id), s.doc.frames?.kerf, s.doc.machining?.stock?.map(r => r.id), s.doc.machining?.allowance], [['S6'], 2, ['B1', 'R30'], 1]);

  // 3. The frame (the base part): the table skeleton on R40, butt corners, steel. Exact: A · ΣL with A = 40² − 34².
  await call('features', { action: 'command', command: 'frame', values: { skeleton: 'table', W: 400, D: 300, H: 300, x: 0, y: 0, z: 0, section: 'library', row: 'R40', corners: 'butt' } });
  await call('features', { action: 'material', material: 'steel' });
  assert.equal(s.bodies.length, 8);
  const A = 40 ** 2 - 34 ** 2, frameVolume = s.bodies.reduce((a, b) => a + b.volume!, 0);
  assert.ok(Math.abs(frameVolume - A * (4 * 320 + 2 * 360 + 2 * 260)) <= 1e-6 * frameVolume, String(frameVolume));
  assert.equal(Math.max(...s.bodies.map(b => b.mesh.bounds.max[2])), 320, 'the rails\' top');
  // (The cut list: legs 320 × 4, rails 360 × 2 and 260 × 2; nested into one S6 with FRb's rule, n − 1 kerfs a bar.)
  const cut = await call('query', { action: 'cutlist' }) as { rows: { quantity: number; longPoint: number }[]; nesting: { bars: { stock: string; used: number; kerf: number; offcut: number }[]; unplaced: unknown[] } };
  assert.deepEqual(cut.rows.map(r => [r.quantity, Math.round(r.longPoint)]), [[4, 320], [2, 360], [2, 260]]);
  assert.deepEqual(cut.nesting.bars.map(b => [b.stock, b.used, b.kerf, b.offcut]), [['S6', 2520, 7 * 2, 6000 - 2520 - 7 * 2]]);
  assert.deepEqual(cut.nesting.unplaced, []);

  // 2. Briefs per part (A9-2). The frame states purpose and material only: no weldment process (A9-12, the cut and weld
  // lists stand in), so its process stays a gap.
  const frameBrief = await call('requirements', { action: 'brief', fields: { purpose: stated('the bench drive unit\'s welded frame'), material: stated('steel') } }) as { gaps: { field: string }[] };
  assert.deepEqual(frameBrief.gaps.map(g => g.field), ['process']);

  // 5. The plate (p1): 200 × 300 × 14 (its 300 bridges the frame's two 360 rails, their centres 300 apart, so the
  // four Ø6.6 through holes sit 10 in from its ends, over the rails),
  // the Ø47 bore classed H7, a 50 × 30 × 8 pocket. Exact (B-rep): 840000 − 12000 − 4π·3.3²·14 − π·23.5²·14.
  await call('assembly', { action: 'add_part', name: 'Plate', position: [0, 0, 0] });
  const P = (args: Record<string, unknown>) => ({ ...args, part: 'p1' });
  await call('features', P({ action: 'command', command: 'box', values: { w: 200, d: 300, h: 14, x: 0, y: 0, z: 0 } }));
  for (const [x, y] of [[20, 10], [180, 10], [20, 290], [180, 290]]) await call('features', P({ action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 6.6, x, y } }));
  await call('features', P({ action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 47, x: 100, y: 150 } }));
  await call('features', P({ action: 'command', command: 'box', values: { w: 50, d: 30, h: 8, x: 30, y: 200, z: 6 } }));
  const [plate, pocketBox] = partBodies('p1').map(b => b.key);
  await call('features', P({ action: 'command', command: 'difference', values: {}, bodies: [plate, pocketBox] }));
  const plateVolume = partBodies('p1')[0].volume!, plateExact = 840000 - 12000 - 4 * Math.PI * 3.3 ** 2 * 14 - Math.PI * 23.5 ** 2 * 14;
  assert.ok(Math.abs(plateVolume - plateExact) <= PITCH * plateExact, `${plateVolume} vs ${plateExact}`);

  // 6. The shaft (p2): the defaults, the key, and the 6204 — refused before its rows, then on step 3 against the Ø25
  // shoulder at k5 (O158). Exact: the bearing's body by Pappus, the kernel's case.
  await call('assembly', { action: 'add_part', name: 'Shaft', position: [0, 0, 0] });
  const S = (args: Record<string, unknown>) => ({ ...args, part: 'p2' });
  await call('features', S({ action: 'command', command: 'shaft', values: {} }));
  await call('features', S({ action: 'command', command: 'key', values: { h: 6 }, bodies: ['b0'] }));
  const bearingArgs = S({ action: 'command', command: 'bearing', values: { sc: 'k5', step: 3, against: 'start' }, bodies: ['b0'] });
  assert.match(await refused('features', bearingArgs), /Load your bearing rows first/);
  for (const [kind, name] of [['bearings', 'bearings.json'], ['fits', 'fits.json'], ['orings', 'orings.json']]) {
    const loaded = await call('features', { action: 'load_rows', kind, file: files.file(name) }) as { source: { filename: string; suppliedBy: string; turn: number } };
    assert.deepEqual([loaded.source.filename, loaded.source.suppliedBy, loaded.source.turn], [name, 'person', 1]);
  }
  await call('features', bearingArgs);
  const shaft = partBodies('p2'), notes = shaft.flatMap(b => (b.notes ?? []).map(n => n.text));
  assert.ok(Math.abs(shaft.find(b => b.key === 'b2')!.volume! - 19800.6522) < 1e-4, String(shaft[2].volume));
  assert.ok(notes.includes('Shaft seat k5: 20.002 to 20.011 (the ring\'s tolerance is not in its row), an estimate'), JSON.stringify(notes));
  assert.ok(notes.some(n => /^Bearing 6204: Ø20 × Ø47 × 14, corners r 1 \(your row, B1 \(D139\): NSK/.test(n)), JSON.stringify(notes));
  const fit = exclude(await call('query', S({ action: 'fit_clearance', hole_class: 'H7', shaft_class: 'k6', size: 20 })));
  assert.deepEqual([fit.kind, fit.clearanceMinUM, fit.clearanceMaxUM, fit.estimate], ['transition', -15, 19, true]);

  // 7. The cover (p3): Ø60 × 8 with a face gland on its top for the 214 — the prefills by their closed forms.
  await call('assembly', { action: 'add_part', name: 'Cover', position: [0, 0, 0] });
  const C = (args: Record<string, unknown>) => ({ ...args, part: 'p3' });
  await call('features', C({ action: 'command', command: 'cylinder', values: { r: 30, h: 8, x: 0, y: 0, z: 0 } }));
  await call('features', C({ action: 'command', command: 'oring-gland', values: {}, faces: ['n1.top'] }));
  // (F4 (b): a clearance hole for the shaft's end, which stands 11 above the plate: its Ø20 step and 1 mm a side, Ø22.)
  await call('features', C({ action: 'command', command: 'hole', faces: ['n1.top'], values: { d: SHAFT_END_MM + 2 * COVER_CLEARANCE_MM, x: 0, y: 0 } }));
  const gland = s.doc.instances![2].doc.nodes.find(n => n.kind === 'oring-gland') as { gland: string; ring: string; width: number; depth: number };
  const h = 3.53 * (1 - 0.25), w = Math.PI * 1.765 ** 2 / (0.8 * h);
  assert.deepEqual([gland.gland, gland.ring], ['face', '214']);
  assert.ok(Math.abs(gland.depth - h) <= 5e-4 + 1e-9 && Math.abs(gland.width - w) <= 5e-4 + 1e-9, `${gland.depth} vs ${h}, ${gland.width} vs ${w} (prefills to 3 decimals)`);

  // 2 (the parts). Material and brief per part; each judged by its own process (A9-2).
  for (const [part, process, material] of [['p1', 'cnc-milling', 'al6061'], ['p2', 'cnc-turning', 'steel'], ['p3', 'fdm', 'petg']]) {
    await call('features', { action: 'material', material, part });
    await call('requirements', { action: 'brief', part, fields: { purpose: stated(`the bench drive unit's ${part}`), process: stated(process), material: stated(material) } });
    const dfm = exclude(await call('query', { action: 'manufacturability', part }));
    assert.deepEqual([dfm.part, dfm.process], [part, process]);
    // (O160, F1: the process judges only what it makes — the shaft's turning size is its own Ø25 × 95, not the 6204's Ø47.)
    if (part === 'p2') assert.match((dfm.rules as { id: string; message: string }[]).find(r => r.id === 'size')!.message, /^Ø25 × 95 mm along its axis/);
  }
  // (O160, F1: the cover's print layers are the cover's, not its bought O-ring's: 8 mm at 0.2 is 40 layers, no support —
  // the groove opens upward.)
  const layers = await call('print', C({ action: 'layers', layerHeight: 0.2 })) as { files: { text: string }[] };
  const print = JSON.parse(layers.files[0].text) as { count: number; supportColumns: unknown[]; height: number };
  assert.deepEqual([print.count, print.supportColumns.length, +print.height.toFixed(6)], [40, 0, 8]);

  // 5 (the plate's CAM package, G23 B, from its own document on the base's inherited stock): the pocket's levels 11, 8, 6
  // at step-down 3 in the +Z setup; the stock a box from B1 with the allowance 1.
  const cam = await call('query', { action: 'cam', part: 'p1' }) as { files: { path: string; text: string }[] };
  const pkg = JSON.parse(cam.files[0].text) as { notForProduction: boolean; stock: { kind: string; min: number[]; max: number[] }; setups: { setup: string; moves: { kind: string; a: number[] }[]; passes: { kind: string; feature: string; from: number; to: number }[] }[] };
  assert.equal(pkg.notForProduction, true);
  assert.deepEqual([pkg.stock.kind, pkg.stock.max.map((v, k) => v - pkg.stock.min[k])], ['box', [210, 310, 16]]);
  // (O161: one +Z setup. F2: each feature made once. F3: the Ø6 tool plunges nothing wider than itself, so the four Ø6.6
  // holes and the Ø47 bore are circular pockets, each milled once; with the 50 × 30 pocket, six pocket features, no drill.)
  assert.deepEqual(pkg.setups.map(x => x.setup), ['+Z']);
  const top = pkg.setups[0], features = [...new Set(top.passes.map(q => q.feature))];
  assert.deepEqual([features.length, top.passes.filter(q => q.kind === 'drill').length], [6, 0]);
  // (The 50 × 30 pocket's own levels: 11, 8 and 6 from the top at z 14, step-down 3.)
  const pocketFeature = features.find(f => /^pocket/.test(f))!;
  const pocketFeeds = top.passes.filter(q => q.feature === pocketFeature).flatMap(q => top.moves.slice(q.from, q.to)).filter(m => m.kind === 'feed');
  assert.deepEqual([...new Set(pocketFeeds.map(m => +m.a[2].toFixed(6)))], [11, 8, 6]);
  // (O160, F1: the shaft's CAM with its key and bearing sizes the bare shaft, 95 × 25 × 25 — milled stock cannot hold it
  // from the block list, refused alike with and without the bought bodies; with the 6204 counted it would say 47.)
  const shaftOnly = { ...s.doc, instances: s.doc.instances!.map(i => i.id === 'p2' ? { ...i, doc: { ...i.doc, nodes: i.doc.nodes.filter(n => n.kind !== 'key' && n.kind !== 'bearing') } } : i) };
  const camRefusal = async (doc: StudioDoc) => { const r = await dispatchTool({ ...s, doc }, 'query', { action: 'cam', part: 'p2' }, evaluate); assert.ok(r.isError, r.content); return String((JSON.parse(r.content) as { error: string }).error); };
  const refusal = await camRefusal(s.doc);
  assert.match(refusal, /^\[STOCK_NONE_FITS\] .*the part's 95 × 25 × 25/);
  assert.equal(await camRefusal(shaftOnly), refusal);
});

test('A9 steps 4 and 8: the weldment\'s gussets, caps and beads; the parts placed exactly; the 6204 housed in the plate (A9-7); the clearance map clean', async () => {
  // (It goes on from the steps above: one run, one state.)
  assert.equal(s.doc.instances?.length, 3, 'steps 1–7 first');

  // 4. A gusset 60 × 60 × 5, clipped 10, at each leg top with its 360 rail; an inset end cap 4 thick in each leg's foot.
  // FRk1's oracles: a gusset (l1·l2 − c²)/2·t = 8750 mm³; a cap's plug 34·34·4 = 4624 mm³.
  for (const [leg, rail] of [['b0_part0', 'b0_part4'], ['b0_part1', 'b0_part4'], ['b0_part2', 'b0_part6'], ['b0_part3', 'b0_part6']]) await call('features', { action: 'command', command: 'gusset', values: { l1: 60, l2: 60, t: 5, clip: 10, offset: 0 }, bodies: [leg, rail] });
  for (const leg of ['b0_part0', 'b0_part1', 'b0_part2', 'b0_part3']) await call('features', { action: 'command', command: 'end-cap', values: { end: 'start', fit: 'inset', t: 4 }, bodies: [leg] });
  const plates = s.bodies.filter(b => b.element?.kind === 'gusset' || b.element?.kind === 'end-cap').map(b => [b.element!.kind, +b.volume!.toFixed(6)]);
  assert.deepEqual(plates, [...Array(4).fill(['gusset', (60 * 60 - 10 ** 2) / 2 * 5]), ...Array(4).fill(['end-cap', 34 * 34 * 4])]);
  // (The joints: the 8 rail ends on their legs, each gusset's two seams, each cap's.)
  const joints = (await call('query', { action: 'welds' }) as { joints: { id: string; kind: string }[] }).joints;
  assert.deepEqual([joints.length, joints.filter(j => j.kind === 'cap').length], [20, 4]);
  // (A cap's weld defaults to butt (the S0); a fillet record on one is refused — BEAD_KIND, a cap is welded by a corner
  // weld, said on its joint and its id in the beads' refusedJointIds — and the part still evaluates; those records removed. A 3 mm fillet at every other joint; the rail ends' shared
  // seams owned equal-length.)
  assert.deepEqual([...new Set(joints.filter(j => j.kind === 'cap').map(j => (j as unknown as { weld: { kind: string } }).weld.kind))], ['butt']);
  await call('features', { action: 'welds', welds: joints.map(j => ({ joint: j.id, kind: 'fillet', size: 3 })) });
  await call('features', { action: 'welds', beadOwnership: { version: 1, policy: 'equal-length' } });
  const wq = await call('query', { action: 'welds' }) as { joints: { id: string; kind: string; bead?: { refused?: string } }[]; totals: { beads: { complete: boolean; refusedJointIds: string[] } } };
  assert.deepEqual([wq.totals.beads.complete, wq.totals.beads.refusedJointIds], [false, joints.filter(j => j.kind === 'cap').map(j => j.id)]);
  // (O168, F7: each cap's joint says why, typed, with the parts placed too.)
  for (const j of wq.joints.filter(x => x.kind === 'cap')) assert.match(j.bead?.refused ?? '', /^\[BEAD_KIND\] a cap sits flush/, j.id);
  assert.equal(s.bodies.length > 0, true, 'the part still evaluates');
  await call('features', { action: 'welds', remove: joints.filter(j => j.kind === 'cap').map(j => j.id) });
  const welds = await call('query', { action: 'welds' }) as { joints: { id: string; bead?: { volume: number; nominalVolume: number } }[]; totals: { beads: { complete: boolean; bodyCount: number; nominalVolume: number; refusedJointIds: string[] } } };
  // (Each rail end is the kernel's bead-tee-flush case, 360 mm³ nominal at leg 3: 8 ends, 2880. A gusset's two seams
  // (200 mm) at leg 3: 3²/2 · 200 = 900 mm³ each. Complete, none refused.)
  const railBeads = welds.joints.filter(j => /^b0_part[4-7]\./.test(j.id)).map(j => j.bead!.nominalVolume);
  assert.deepEqual(railBeads, Array(8).fill(360));
  assert.deepEqual(s.bodies.filter(b => /^bead_b[1-4]$/.test(b.key)).map(b => +b.volume!.toFixed(6)), Array(4).fill(3 ** 2 / 2 * 200));
  assert.deepEqual([welds.totals.beads.complete, welds.totals.beads.bodyCount, welds.totals.beads.nominalVolume, welds.totals.beads.refusedJointIds], [true, 12, 8 * 360 + 4 * 900, []]);

  // 8. Placed exactly: the plate on the rails' top (z 320), its holes over the rail centres; the shaft through the bore with
  // the bearing's 14 in the plate's 14 (z 320–334); the cover on the plate over the bore, its Ø22 hole round the shaft's end.
  for (const [part, position] of [['p1', [100, 0, 320]], ['p2', [200, 150, 250]], ['p3', [200, 150, 334]]] as const) await call('assembly', { action: 'place', part, position: [...position] });
  // (A9-7: the 6204's housing is the plate's bore, another part. The agent edits the bearing it put in step 6 (O167, F6:
  // edit_feature offers the other parts' bodies, as the bearing command does — that path is A9-7's own test), H7 the
  // housing's seat.)
  const plateKey = partBodies('p1')[0].key, bearingAt = s.doc.instances![1].doc.nodes.findIndex(n => n.kind === 'bearing');
  await call('features', { action: 'edit', part: 'p2', index: bearingAt, values: { housing: `part:${JSON.stringify({ part: 'p1', body: plateKey })}`, housingClass: 'H7' } });
  const housed = partBodies('p2').flatMap(b => (b.notes ?? []).map(n => n.text));
  assert.ok(housed.includes('In the housing\'s Ø47 bore; no overlap') && housed.includes('Housing seat H7: 47 to 47.025 (the ring\'s tolerance is not in its row), an estimate'), JSON.stringify(housed));
  assert.ok(housed.some(t => /^the housing has no shoulder at either face of the bearing/.test(t)), 'D181: the plain bore does not locate the outer ring');
  // (The map, every contact filled: clean — no overlap at all; the designed seats named; contact touching; the one near pair
  // the shaft's end in the cover's hole, its 1 mm a side less the display meshes' chords.)
  const bodies = await assemblyPlacedBodies(s.doc, evaluate), map = clearanceMap(bodies, { near: 1 });
  for (const p of [...map.pairs]) if (p.overlap && 'pending' in p.overlap) assert.ok(applyFill(map, fillOverlap(map, bodies, p)));
  assert.deepEqual(map.pairs.filter(p => p.state === 'overlap').map(p => [p.a, p.b]), []);
  const designed = map.pairs.filter(p => p.state === 'designed' && !/^weld bead/.test(p.designed ?? '')).map(p => p.designed).sort();
  assert.deepEqual(designed, ['O-ring n3 in its gland n2 (its squeeze)', 'bearing n2 (6204) in p1/b9, seat H7', 'bearing n2 (6204) on its shaft, seat k5', 'key n1 in its keyseat']);
  const near = map.pairs.filter(p => p.state === 'near');
  assert.deepEqual(near.map(p => [p.a, p.b]), [['p2/b0', 'p3/b4']]);
  assert.ok(near[0].minGapMM <= COVER_CLEARANCE_MM && near[0].minGapMM >= COVER_CLEARANCE_MM - 0.02, String(near[0].minGapMM));
});

test('A9 steps 9–11: a drawing per made part; the BOM and the purchase CSV; the bundle on the person\'s approval; reopened, the same files', async () => {
  assert.equal(s.doc.instances?.length, 3, 'steps 1–8 first');
  // 9. A drawing per made part: the weldment on the base's own drawing, each placed part on its own (part-scoped), each
  // set by a proposal the person accepts, then auto-dimensioned and fixed. Every one is drawn; the plate's is clean; no
  // drawing is short of a fit row or has an error. (The warnings still left are O165's F8, not asserted here.)
  const propose = async (title: string, args: Record<string, unknown>) => {
    const pr = await dispatchTool(s, 'proposals', { action: 'propose', title, ops: [{ tool: 'drawing', args: { action: 'set', ...args } }] }, evaluate);
    assert.ok(!pr.isError, pr.content);
    const a = await acceptProposal(pr.state, pr.state.doc.proposals!.at(-1)!.id, evaluate); assert.ok(!('error' in a), JSON.stringify(a)); s = a.state;
  };
  const issues: Record<string, { code: string; severity: string }[]> = {};
  for (const [title, part, args] of [
    ['Weldment drawing', undefined, { sheet: 'A3', views: ['front', 'top', 'right', 'iso'], weldSymbols: true, balloons: true, tables: [{ id: 'bom', from: 'bom' }, { id: 'cut', from: 'cut-list' }, { id: 'welds', from: 'weld-list' }] }],
    ['Plate drawing', 'p1', { sheet: 'A3' }], ['Shaft drawing', 'p2', { sheet: 'A3' }], ['Cover drawing', 'p3', { sheet: 'A3' }],
  ] as const) {
    const P = part ? { part } : {};
    await propose(title, { ...args, ...P });
    for (const action of ['auto', 'fix']) await call('drawing', { action, ...P });
    issues[part ?? 'base'] = (await call('drawing', { action: 'issues', ...P }) as { issues: { code: string; severity: string }[] }).issues;
  }
  for (const id of ['p1', 'p2', 'p3']) assert.equal(s.doc.instances!.find(i => i.id === id)!.doc.drawing?.sheet, 'A3', `${id} has its own drawing`);
  assert.ok(s.doc.drawing?.weldSymbols && s.doc.drawing.balloons && s.doc.drawing.tables?.length === 3);
  assert.deepEqual(issues.p1, [], 'the plate\'s drawing is clean');
  assert.deepEqual(Object.values(issues).flat().filter(x => x.code === 'FIT_ROW_MISSING'), []);
  // (O170, O171: no error on any of them — the S0's oracle after drawing.fix.)
  assert.deepEqual(Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.filter(x => x.severity === 'error').map(x => x.code)])), { base: [], p1: [], p2: [], p3: [] });

  // 10. The BOM and the purchase CSV through v2. The CSV holds exactly the bought lines — the key (no row, no source, an
  // estimate: A9-11), the 6204 and the 214 with their rows and sources; the BOM's made parts their materials' masses
  // (the plate's: its exact volume · 2.7 g/cm³). F9: the four M6 cap screws through the plate's Ø6.6 holes (the plate
  // at [100, 0, 320], its top at 334), each placed as a part of its own, bought by the person's fastener row.
  const fastenerFile = s.rowFiles!.files.find(f => f.source.filename === 'fasteners.json')!.id;
  await call('features', { action: 'load_rows', kind: 'fasteners', file: fastenerFile });
  for (const [x, y] of [[120, 10], [280, 10], [120, 290], [280, 290]]) await call('features', { action: 'command', command: 'fastener', values: { kind: 'socket-screw', size: 'M6', length: '20', joint: 'free', insert: 'instance', x, y, z: 334 } });
  assert.equal(s.doc.instances?.length, 7, 'the plate, the shaft, the cover and four screws');
  const bomOut = await call('query', { action: 'bom' }) as { files: { text: string }[] };
  const bom = JSON.parse(bomOut.files[0].text).bom as { lines: { item: string; qty: number; kind?: string; row?: string | null; source?: string | null; estimate?: boolean; mass: number; material: string | null; member?: { section: string; length: number }; plate?: unknown }[] };
  const plateLine = bom.lines.find(l => l.item === 'Plate')!;
  assert.ok(Math.abs(plateLine.mass - 801794.9075 * 2.7e-3) < 1e-2, String(plateLine.mass));
  assert.deepEqual(bom.lines.filter(l => l.kind).map(l => [l.kind, l.qty, l.row ?? null, l.estimate]), [['fastener', 4, 'SCS-M6x20', false], ['key', 1, null, true], ['bearing', 1, '6204', false], ['oring', 1, '214', false]]);
  // (O169, F10: the frame's members, a made line a cut-list row — legs 320 × 4, rails 360 × 2 and 260 × 2, steel — each
  // A · L · ρ (A = 40² − 34², the library's mild steel); the total mass the parts' and the base part's, nothing assumed.)
  const steel = 7.85e-3, members = bom.lines.filter(l => l.member).map(l => [l.item, l.qty, l.material, +l.mass.toFixed(3)]);
  assert.deepEqual(members, [[320, 4], [360, 2], [260, 2]].map(([L, n]) => [`rect-tube 40 × 40 × 3 × ${L}`, n, 'steel', +(n * (40 ** 2 - 34 ** 2) * L * steel).toFixed(3)]));
  // (The plates too by their material: 4 steel gussets of 8750 mm³, 4 caps of 4624 — no longer the default's density.)
  assert.deepEqual(bom.lines.filter(l => l.plate).map(l => [l.qty, l.material, +l.mass.toFixed(3)]), [[4, 'steel', +(4 * 8750 * steel).toFixed(3)], [4, 'steel', +(4 * 4624 * steel).toFixed(3)]]);
  const total = (JSON.parse(bomOut.files[0].text).bom as { totalMassG: number }).totalMassG, partsMass = bom.lines.filter(l => ['Plate', 'Shaft', 'Cover'].includes(l.item)).reduce((a, l) => a + l.mass, 0);
  assert.ok(total > partsMass + members.reduce((a, m) => a + (m[3] as number), 0), `${total}: the parts, the members, and the plates and beads too`);
  const csvOut = await call('query', { action: 'purchase_csv' }) as { files: { text: string }[] }, csv = csvOut.files[0].text.trim().split('\n');
  assert.equal(csv.length, 5); assert.equal(csv[0], 'item no.,item,qty,kind,size,row,catalogue,source,estimate');
  assert.match(csv[1], /^\d+,Socket head cap screw [^,]*,4,fastener,socket head cap screw M6 × 20,SCS-M6x20,,"conformance\/a9: an illustrative shop row for the A9 run, not a real supplier's",$/);
  csv.splice(1, 1);
  assert.match(csv[1], /^\d+,key 6 × 6 × 18,1,key,6 × 6 × 18,,,,estimate$/);
  assert.match(csv[2], /^\d+,bearing 20 × 47 × 14,1,bearing,20 × 47 × 14,6204,,"B1 \(D139\): NSK, ""6204 Series"", https:\/\/www\.oss\.nsk\.com\/6204-dgbb-sr\.html",$/);
  assert.match(csv[3], /^\d+,oring 24\.99 × 3\.53,1,oring,24\.99 × 3\.53,214,,"O1 \(D139\): Global O-Ring,/);

  // 11. The bundle (A8.6): refused while no baseline is approved; the agent's own approval refused (APPROVAL_IS_THE_USERS);
  // the person approves (the script plays the person with the user's token); then complete, intact, verified.
  assert.match(String((JSON.parse((await dispatchTool(s, 'assembly', { action: 'bundle' }, evaluate)).content) as { error: string }).error), /^\[OUTPUT_BUNDLE_INCOMPLETE\] an approved BOM baseline: none/);
  const evalDoc = async (d: StudioDoc) => evaluateDoc(d, 1);
  const view = await bomView(s.doc, evalDoc), draft = draftBaseline(s.doc, deriveBom(view), view);
  await assert.rejects(moveBaseline(draft.doc, draft.baseline.id, 'review', { by: 'user', at: 0 } as never), /APPROVAL_IS_THE_USERS/);
  const review = await moveBaseline(draft.doc, draft.baseline.id, 'review', userToken('the person'));
  s = { ...s, doc: (await moveBaseline(review.doc, draft.baseline.id, 'approved', userToken('the person'), evalDoc)).doc };
  const bundle = await call('assembly', { action: 'bundle' }) as { check: { complete: boolean; intact: boolean; missing: unknown[]; changed: unknown[]; stale: unknown[] }; files: { path: string }[] };
  assert.deepEqual([bundle.check.complete, bundle.check.intact, bundle.check.missing, bundle.check.changed, bundle.check.stale], [true, true, [], [], []]);
  assert.deepEqual(bundle.files.map(f => f.path), ['document.bcad', 'baseline.json', 'materials.json', 'results.json', 'ecrs.json', 'manifest.json']);

  // Reopened: the saved file opened again gives the same BOM, CSV, clearance map and bundle check.
  const opened = await readStudioFile(encodeStudioFile(s.doc)); assert.ok('doc' in opened, JSON.stringify(opened));
  const again = { ...s, doc: opened.doc };
  for (const action of ['bom', 'purchase_csv', 'clearance'] as const) {
    const [a, b] = [await dispatchTool(s, 'query', { action }, evaluate), await dispatchTool(again, 'query', { action }, evaluate)];
    assert.ok(!a.isError && !b.isError, a.content + b.content);
    // (The clearance map carries its own timing (ms), which differs run to run; the rest is the same.)
    const texts = (r: typeof a) => (JSON.parse(r.content) as { files: { text: string }[] }).files.map(f => action === 'clearance' ? JSON.stringify({ ...JSON.parse(f.text), timing: undefined }) : f.text);
    assert.deepEqual(texts(b), texts(a), action);
  }
  const reopenedBundle = JSON.parse((await dispatchTool(again, 'assembly', { action: 'bundle' }, evaluate)).content) as { check: { complete: boolean; intact: boolean } };
  assert.deepEqual([reopenedBundle.check.complete, reopenedBundle.check.intact], [true, true]);
});
