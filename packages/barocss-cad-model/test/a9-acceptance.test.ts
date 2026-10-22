import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { resolveShopTree } from '../src/engine/shopRows';
import { applyFill, assemblyPlacedBodies, clearanceMap, fillOverlap } from '../src/team/clearanceMap';
import { receivePersonRowFiles, type PersonRowFiles } from '../src/chat/rowFiles';

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
  s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc(), rowFiles: files.rowFiles } as never as ChatState;

  // 1. Rows. The frame's section and stock lengths, then the parts' stock; the fit, bearing and O-ring rows on the base,
  // which the parts inherit (A9-8). Agent-written rows refused; each loaded row keeps the person's file as its source.
  assert.match(await refused('features', { action: 'frame_sections', rows: JSON.parse(readFileSync(join(DIR, 'sections.json'), 'utf8')) }), /\[ROWS_NOT_FROM_PERSON\]/);
  const sections = await call('features', { action: 'frame_sections', file: files.file('sections.json') });
  assert.deepEqual([sections.added, (sections.rows as { estimate?: boolean }[])[0].estimate], [['R40'], true]);
  await call('features', { action: 'frame_stock', file: files.file('frame-stock.json'), kerf: 2 });
  await call('features', { action: 'stock', file: files.file('stock.json'), allowance: 1 });
  assert.deepEqual([s.doc.frames?.stock?.map(r => r.id), s.doc.frames?.kerfMM, s.doc.machining?.stock?.map(r => r.id), s.doc.machining?.allowanceMM], [['S6'], 2, ['B1', 'R30'], 1]);

  // 3. The frame (the base part): the table skeleton on R40, butt corners, steel. Exact: A · ΣL with A = 40² − 34².
  await call('features', { action: 'command', command: 'frame', values: { skeleton: 'table', W: 400, D: 300, H: 300, x: 0, y: 0, z: 0, section: 'library', row: 'R40', corners: 'butt' } });
  await call('features', { action: 'material', material: 'steel' });
  assert.equal(s.bodies.length, 8);
  const A = 40 ** 2 - 34 ** 2, frameVolume = s.bodies.reduce((a, b) => a + b.volumeMM3!, 0);
  assert.ok(Math.abs(frameVolume - A * (4 * 320 + 2 * 360 + 2 * 260)) <= 1e-6 * frameVolume, String(frameVolume));
  assert.equal(Math.max(...s.bodies.map(b => b.mesh.bounds.max[2])), 320, 'the rails\' top');
  // (The cut list: legs 320 × 4, rails 360 × 2 and 260 × 2; nested into one S6 with FRb's rule, n − 1 kerfs a bar.)
  const cut = await call('query', { action: 'cutlist' }) as { rows: { quantity: number; longPointMM: number }[]; nesting: { bars: { stock: string; usedMM: number; kerfMM: number; offcutMM: number }[]; unplaced: unknown[] } };
  assert.deepEqual(cut.rows.map(r => [r.quantity, Math.round(r.longPointMM)]), [[4, 320], [2, 360], [2, 260]]);
  assert.deepEqual(cut.nesting.bars.map(b => [b.stock, b.usedMM, b.kerfMM, b.offcutMM]), [['S6', 2520, 7 * 2, 6000 - 2520 - 7 * 2]]);
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
  const plateVolume = partBodies('p1')[0].volumeMM3!, plateExact = 840000 - 12000 - 4 * Math.PI * 3.3 ** 2 * 14 - Math.PI * 23.5 ** 2 * 14;
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
  assert.ok(Math.abs(shaft.find(b => b.key === 'b2')!.volumeMM3! - 19800.6522) < 1e-4, String(shaft[2].volumeMM3));
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
  const layers = await call('print', C({ action: 'layers', layerMM: 0.2 })) as { files: { text: string }[] };
  const print = JSON.parse(layers.files[0].text) as { count: number; supportColumns: unknown[]; heightMM: number };
  assert.deepEqual([print.count, print.supportColumns.length, +print.heightMM.toFixed(6)], [40, 0, 8]);

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
  const plates = s.bodies.filter(b => b.element?.kind === 'gusset' || b.element?.kind === 'end-cap').map(b => [b.element!.kind, +b.volumeMM3!.toFixed(6)]);
  assert.deepEqual(plates, [...Array(4).fill(['gusset', (60 * 60 - 10 ** 2) / 2 * 5]), ...Array(4).fill(['end-cap', 34 * 34 * 4])]);
  // (The joints: the 8 rail ends on their legs, each gusset's two seams, each cap's.)
  const joints = (await call('query', { action: 'welds' }) as { joints: { id: string; kind: string }[] }).joints;
  assert.deepEqual([joints.length, joints.filter(j => j.kind === 'cap').length], [20, 4]);
  // (A cap's weld defaults to butt (the S0); a fillet record on one is refused — the four caps' joints in the beads'
  // refusedJointIds (BEAD_KIND, a cap is welded by a corner weld; O164's F7: not said on the joint in this order) — and
  // the part still evaluates; those records removed. A 3 mm fillet at every other joint; the rail ends' shared
  // seams owned equal-length.)
  assert.deepEqual([...new Set(joints.filter(j => j.kind === 'cap').map(j => (j as unknown as { weld: { kind: string } }).weld.kind))], ['butt']);
  await call('features', { action: 'welds', welds: joints.map(j => ({ joint: j.id, kind: 'fillet', size: 3 })) });
  await call('features', { action: 'welds', beadOwnership: { version: 1, policy: 'equal-length' } });
  const wq = await call('query', { action: 'welds' }) as { totals: { beads: { complete: boolean; refusedJointIds: string[] } } };
  assert.deepEqual([wq.totals.beads.complete, wq.totals.beads.refusedJointIds], [false, joints.filter(j => j.kind === 'cap').map(j => j.id)]);
  assert.equal(s.bodies.length > 0, true, 'the part still evaluates');
  await call('features', { action: 'welds', remove: joints.filter(j => j.kind === 'cap').map(j => j.id) });
  const welds = await call('query', { action: 'welds' }) as { joints: { id: string; bead?: { volumeMM3: number; nominalVolumeMM3: number } }[]; totals: { beads: { complete: boolean; bodyCount: number; nominalVolumeMM3: number; refusedJointIds: string[] } } };
  // (Each rail end is the kernel's bead-tee-flush case, 360 mm³ nominal at leg 3: 8 ends, 2880. A gusset's two seams
  // (200 mm) at leg 3: 3²/2 · 200 = 900 mm³ each. Complete, none refused.)
  const railBeads = welds.joints.filter(j => /^b0_part[4-7]\./.test(j.id)).map(j => j.bead!.nominalVolumeMM3);
  assert.deepEqual(railBeads, Array(8).fill(360));
  assert.deepEqual(s.bodies.filter(b => /^bead_b[1-4]$/.test(b.key)).map(b => +b.volumeMM3!.toFixed(6)), Array(4).fill(3 ** 2 / 2 * 200));
  assert.deepEqual([welds.totals.beads.complete, welds.totals.beads.bodyCount, welds.totals.beads.nominalVolumeMM3, welds.totals.beads.refusedJointIds], [true, 12, 8 * 360 + 4 * 900, []]);

  // 8. Placed exactly: the plate on the rails' top (z 320), its holes over the rail centres; the shaft through the bore with
  // the bearing's 14 in the plate's 14 (z 320–334); the cover on the plate over the bore, its Ø22 hole round the shaft's end.
  for (const [part, position] of [['p1', [100, 0, 320]], ['p2', [200, 150, 250]], ['p3', [200, 150, 334]]] as const) await call('assembly', { action: 'place', part, position: [...position] });
  // (A9-7: the 6204's housing is the plate's bore, another part: linked through the bearing command, H7 the housing's seat.
  // The chat's edit_feature cannot set a cross-part housing yet — O164's F6 — so the bearing is put again with it.)
  const plateKey = partBodies('p1')[0].key, bearingAt = s.doc.instances![1].doc.nodes.findIndex(n => n.kind === 'bearing');
  await call('features', { action: 'delete', part: 'p2', index: bearingAt });
  await call('features', { action: 'command', part: 'p2', command: 'bearing', bodies: ['b0'], values: { sc: 'k5', step: 3, against: 'start', housing: `part:${JSON.stringify({ part: 'p1', body: plateKey })}`, hc: 'H7' } });
  const housed = partBodies('p2').flatMap(b => (b.notes ?? []).map(n => n.text));
  assert.ok(housed.includes('In the housing\'s Ø47 bore; no overlap') && housed.includes('Housing seat H7: 47 to 47.025 (the ring\'s tolerance is not in its row), an estimate'), JSON.stringify(housed));
  assert.ok(housed.some(t => /^the housing has no shoulder at either face of the bearing/.test(t)), 'D181: the plain bore does not locate the outer ring');
  // (The map, every contact filled: clean — no overlap at all; the designed seats named; contact touching; the one near pair
  // the shaft's end in the cover's hole, its 1 mm a side less the display meshes' chords.)
  const bodies = await assemblyPlacedBodies(s.doc, evaluate), map = clearanceMap(bodies, { nearMM: 1 });
  for (const p of [...map.pairs]) if (p.overlap && 'pending' in p.overlap) assert.ok(applyFill(map, fillOverlap(map, bodies, p)));
  assert.deepEqual(map.pairs.filter(p => p.state === 'overlap').map(p => [p.a, p.b]), []);
  const designed = map.pairs.filter(p => p.state === 'designed' && !/^weld bead/.test(p.designed ?? '')).map(p => p.designed).sort();
  assert.deepEqual(designed, ['O-ring n3 in its gland n2 (its squeeze)', 'bearing n3 (6204) in p1/b9, seat H7', 'bearing n3 (6204) on its shaft, seat k5', 'key n1 in its keyseat']);
  const near = map.pairs.filter(p => p.state === 'near');
  assert.deepEqual(near.map(p => [p.a, p.b]), [['p2/b0', 'p3/b4']]);
  assert.ok(near[0].minGapMM <= COVER_CLEARANCE_MM && near[0].minGapMM >= COVER_CLEARANCE_MM - 0.02, String(near[0].minGapMM));
});
